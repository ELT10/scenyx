-- Create table to track video generations and their credit holds
-- This enables proper charging only when videos complete successfully

CREATE TABLE IF NOT EXISTS video_generations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- OpenAI video ID
  video_id TEXT NOT NULL UNIQUE,
  
  -- User and account info
  user_id UUID NOT NULL,
  account_id UUID NOT NULL REFERENCES accounts(id),
  
  -- Hold tracking
  hold_id UUID REFERENCES credit_holds(id),
  
  -- Video details
  model TEXT NOT NULL,
  prompt TEXT,
  seconds TEXT,
  size TEXT,
  orientation TEXT,
  resolution TEXT,
  
  -- Status tracking
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'in_progress', 'completed', 'failed')),
  
  -- Error information for failed videos
  error_code TEXT,
  error_message TEXT,
  
  -- Credit settlement (NULL = not finalized, FALSE = finalized/refunded, TRUE = finalized/charged)
  credits_charged BOOLEAN DEFAULT NULL,
  charged_amount_microcredits BIGINT,
  charged_at TIMESTAMPTZ,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  
  -- Prevent duplicate charging - three valid states:
  -- 1. Not finalized: (NULL, NULL, NULL)
  -- 2. Failed/Refunded: (FALSE, NULL, timestamp)
  -- 3. Completed/Charged: (TRUE, amount, timestamp)
  CONSTRAINT video_generations_charge_once CHECK (
    (credits_charged IS NULL AND charged_amount_microcredits IS NULL AND charged_at IS NULL) OR
    (credits_charged = FALSE AND charged_amount_microcredits IS NULL AND charged_at IS NOT NULL) OR
    (credits_charged = TRUE AND charged_amount_microcredits IS NOT NULL AND charged_at IS NOT NULL)
  )
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_video_generations_video_id ON video_generations(video_id);
CREATE INDEX IF NOT EXISTS idx_video_generations_user_id ON video_generations(user_id);
CREATE INDEX IF NOT EXISTS idx_video_generations_hold_id ON video_generations(hold_id);
CREATE INDEX IF NOT EXISTS idx_video_generations_status ON video_generations(status);
CREATE INDEX IF NOT EXISTS idx_video_generations_created_at ON video_generations(created_at DESC);

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION fn_update_video_generation_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if it exists, then create it (makes migration idempotent)
DROP TRIGGER IF EXISTS trg_video_generations_updated_at ON video_generations;

CREATE TRIGGER trg_video_generations_updated_at
  BEFORE UPDATE ON video_generations
  FOR EACH ROW
  EXECUTE FUNCTION fn_update_video_generation_timestamp();

-- ============================================================================
-- FUNCTION: Create video generation with hold
-- ============================================================================
CREATE OR REPLACE FUNCTION fn_create_video_generation(
  p_video_id TEXT,
  p_user_id UUID,
  p_account_id UUID,
  p_hold_id UUID,
  p_model TEXT,
  p_prompt TEXT,
  p_seconds TEXT,
  p_size TEXT,
  p_orientation TEXT,
  p_resolution TEXT
)
RETURNS UUID AS $$
DECLARE
  v_generation_id UUID;
BEGIN
  -- Check if this video_id already exists (idempotency)
  SELECT id INTO v_generation_id
  FROM video_generations
  WHERE video_id = p_video_id;
  
  IF v_generation_id IS NOT NULL THEN
    -- Already exists, return existing ID
    RETURN v_generation_id;
  END IF;
  
  -- Create new generation record
  INSERT INTO video_generations (
    video_id,
    user_id,
    account_id,
    hold_id,
    model,
    prompt,
    seconds,
    size,
    orientation,
    resolution,
    status
  ) VALUES (
    p_video_id,
    p_user_id,
    p_account_id,
    p_hold_id,
    p_model,
    p_prompt,
    p_seconds,
    p_size,
    p_orientation,
    p_resolution,
    'queued'
  )
  RETURNING id INTO v_generation_id;
  
  RETURN v_generation_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FUNCTION: Finalize video generation (capture or release hold)
-- ============================================================================
CREATE OR REPLACE FUNCTION fn_finalize_video_generation(
  p_video_id TEXT,
  p_status TEXT,
  p_error_code TEXT DEFAULT NULL,
  p_error_message TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  v_generation RECORD;
  v_actual_cost BIGINT;
  v_remainder BIGINT;
BEGIN
  -- Lock the generation record
  SELECT 
    id, 
    video_id, 
    user_id, 
    account_id, 
    hold_id, 
    status,
    credits_charged,
    model,
    seconds,
    resolution
  INTO v_generation
  FROM video_generations
  WHERE video_id = p_video_id
  FOR UPDATE;
  
  -- Check if exists
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Video generation not found: %', p_video_id;
  END IF;
  
  -- Check if already finalized (idempotency)
  IF v_generation.credits_charged = TRUE THEN
    RETURN json_build_object(
      'status', 'already_finalized',
      'video_id', p_video_id,
      'final_status', v_generation.status,
      'credits_charged', TRUE
    );
  END IF;
  
  -- Check if already in terminal state
  IF v_generation.status IN ('completed', 'failed') THEN
    RETURN json_build_object(
      'status', 'already_finalized',
      'video_id', p_video_id,
      'final_status', v_generation.status,
      'credits_charged', FALSE,
      'warning', 'Was already in terminal state but not charged'
    );
  END IF;
  
  -- Update status
  UPDATE video_generations
  SET 
    status = p_status,
    error_code = p_error_code,
    error_message = p_error_message,
    completed_at = NOW()
  WHERE id = v_generation.id;
  
  -- If status is 'completed', capture the hold
  IF p_status = 'completed' THEN
    -- Calculate actual cost based on video parameters
    -- This would call the pricing functions - for now, capture full hold amount
    -- In production, you'd import the pricing logic here
    
    -- Capture the hold (this will charge credits)
    PERFORM fn_capture_hold(v_generation.hold_id::TEXT, (
      SELECT amount_microcredits::TEXT 
      FROM credit_holds 
      WHERE id = v_generation.hold_id
    ));
    
    -- Mark as charged
    UPDATE video_generations
    SET 
      credits_charged = TRUE,
      charged_amount_microcredits = (
        SELECT amount_microcredits 
        FROM credit_holds 
        WHERE id = v_generation.hold_id
      ),
      charged_at = NOW()
    WHERE id = v_generation.id;
    
    RETURN json_build_object(
      'status', 'completed_and_charged',
      'video_id', p_video_id,
      'credits_charged', TRUE,
      'hold_id', v_generation.hold_id
    );
    
  -- If status is 'failed', release the hold (refund)
  ELSIF p_status = 'failed' THEN
    -- Release the hold (refund all credits)
    PERFORM fn_release_hold(v_generation.hold_id);
    
    -- Mark as finalized but not charged (credits refunded)
    UPDATE video_generations
    SET 
      credits_charged = FALSE,
      charged_amount_microcredits = NULL,  -- NULL = no charge (was refunded)
      charged_at = NOW()  -- Record when we finalized
    WHERE id = v_generation.id;
    
    RETURN json_build_object(
      'status', 'failed_and_refunded',
      'video_id', p_video_id,
      'credits_charged', FALSE,
      'hold_id', v_generation.hold_id,
      'error_code', p_error_code,
      'error_message', p_error_message
    );
    
  ELSE
    RAISE EXCEPTION 'Invalid status for finalization: %. Must be completed or failed', p_status;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Add RLS policies (optional, adjust based on your security needs)
ALTER TABLE video_generations ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (makes migration idempotent)
DROP POLICY IF EXISTS video_generations_user_select ON video_generations;
DROP POLICY IF EXISTS video_generations_service_all ON video_generations;

-- Users can only see their own video generations
CREATE POLICY video_generations_user_select 
  ON video_generations FOR SELECT 
  USING (user_id = auth.uid());

-- Only the backend can insert/update (via service role)
CREATE POLICY video_generations_service_all 
  ON video_generations FOR ALL 
  USING (true);

-- ============================================================================
-- FUNCTION: Cleanup expired video holds
-- ============================================================================
-- This function should be called by a cron job (e.g., every hour)
-- It handles edge cases where we never got a definitive status from OpenAI:
-- - Network errors
-- - Extended OpenAI API downtime
-- - Videos stuck in limbo
CREATE OR REPLACE FUNCTION fn_cleanup_expired_video_holds()
RETURNS JSON AS $$
DECLARE
  v_expired_count INTEGER := 0;
  v_released_count INTEGER := 0;
BEGIN
  -- Find video generations with expired holds that are still pending
  SELECT COUNT(*) INTO v_expired_count
  FROM video_generations vg
  JOIN credit_holds h ON h.id = vg.hold_id
  WHERE vg.credits_charged IS NULL  -- Not yet finalized
  AND h.status = 'active'
  AND h.expires_at < NOW();
  
  IF v_expired_count > 0 THEN
    -- Release the expired holds
    FOR v_hold_id IN (
      SELECT h.id
      FROM credit_holds h
      JOIN video_generations vg ON vg.hold_id = h.id
      WHERE vg.credits_charged IS NULL
      AND h.status = 'active'
      AND h.expires_at < NOW()
    ) LOOP
      BEGIN
        PERFORM fn_release_hold(v_hold_id::TEXT);
        v_released_count := v_released_count + 1;
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Failed to release hold %: %', v_hold_id, SQLERRM;
      END;
    END LOOP;
    
    -- Mark videos as failed due to timeout
    UPDATE video_generations vg
    SET 
      status = 'failed',
      credits_charged = FALSE,
      charged_amount_microcredits = NULL,
      charged_at = NOW(),
      error_code = 'hold_expired',
      error_message = 'Video generation timed out - hold expired after 1 hour',
      completed_at = NOW()
    FROM credit_holds h
    WHERE vg.hold_id = h.id
    AND vg.credits_charged IS NULL
    AND h.expires_at < NOW();
  END IF;
  
  RETURN json_build_object(
    'expired_holds_found', v_expired_count,
    'holds_released', v_released_count,
    'timestamp', NOW()
  );
END;
$$ LANGUAGE plpgsql;

