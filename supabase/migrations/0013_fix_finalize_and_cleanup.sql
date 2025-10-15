-- Fix finalize to use UUID and to be idempotent if hold already captured
CREATE OR REPLACE FUNCTION fn_finalize_video_generation(
  p_video_id TEXT,
  p_status TEXT,
  p_error_code TEXT DEFAULT NULL,
  p_error_message TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  v_generation RECORD;
  v_hold RECORD;
BEGIN
  SELECT 
    id, video_id, user_id, account_id, hold_id, status, credits_charged, model, seconds, resolution
  INTO v_generation
  FROM video_generations
  WHERE video_id = p_video_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Video generation not found: %', p_video_id;
  END IF;

  IF v_generation.credits_charged = TRUE THEN
    RETURN json_build_object(
      'status', 'already_finalized',
      'video_id', p_video_id,
      'final_status', v_generation.status,
      'credits_charged', TRUE
    );
  END IF;

  IF v_generation.status IN ('completed', 'failed') THEN
    RETURN json_build_object(
      'status', 'already_finalized',
      'video_id', p_video_id,
      'final_status', v_generation.status,
      'credits_charged', FALSE,
      'warning', 'Was already in terminal state but not charged'
    );
  END IF;

  UPDATE video_generations
  SET 
    status = p_status,
    error_code = p_error_code,
    error_message = p_error_message,
    completed_at = NOW()
  WHERE id = v_generation.id;

  IF v_generation.hold_id IS NULL THEN
    RETURN json_build_object(
      'status', 'finalized_no_hold',
      'video_id', p_video_id,
      'credits_charged', FALSE
    );
  END IF;

  IF p_status = 'completed' THEN
    SELECT id, account_id, amount_microcredits, status
    INTO v_hold
    FROM credit_holds
    WHERE id = v_generation.hold_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Hold not found: %', v_generation.hold_id;
    END IF;

    -- Only capture if still active; skip if already captured
    IF v_hold.status = 'active' THEN
      PERFORM fn_capture_hold(v_generation.hold_id, v_hold.amount_microcredits::TEXT);
      SELECT id, account_id, amount_microcredits, status
      INTO v_hold
      FROM credit_holds
      WHERE id = v_generation.hold_id;
    ELSIF v_hold.status = 'captured' THEN
      -- no-op
    ELSE
      UPDATE video_generations
      SET 
        credits_charged = FALSE,
        charged_amount_microcredits = NULL,
        charged_at = NOW()
      WHERE id = v_generation.id;

      RETURN json_build_object(
        'status', 'completed_but_hold_unavailable',
        'video_id', p_video_id,
        'credits_charged', FALSE,
        'hold_id', v_generation.hold_id
      );
    END IF;

    UPDATE video_generations
    SET 
      credits_charged = TRUE,
      charged_amount_microcredits = v_hold.amount_microcredits,
      charged_at = NOW()
    WHERE id = v_generation.id;

    RETURN json_build_object(
      'status', 'completed_and_charged',
      'video_id', p_video_id,
      'credits_charged', TRUE,
      'hold_id', v_generation.hold_id
    );

  ELSIF p_status = 'failed' THEN
    SELECT id, status INTO v_hold
    FROM credit_holds
    WHERE id = v_generation.hold_id
    FOR UPDATE;

    IF FOUND AND v_hold.status = 'active' THEN
      PERFORM fn_release_hold(v_generation.hold_id);
    END IF;

    UPDATE video_generations
    SET 
      credits_charged = FALSE,
      charged_amount_microcredits = NULL,
      charged_at = NOW()
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

-- Fix cleanup to call with UUID, not TEXT
CREATE OR REPLACE FUNCTION fn_cleanup_expired_video_holds()
RETURNS JSON AS $$
DECLARE
  v_expired_count INTEGER := 0;
  v_released_count INTEGER := 0;
  v_row RECORD;
BEGIN
  SELECT COUNT(*) INTO v_expired_count
  FROM video_generations vg
  JOIN credit_holds h ON h.id = vg.hold_id
  WHERE vg.credits_charged IS NULL
    AND h.status = 'active'
    AND h.expires_at < NOW();

  IF v_expired_count > 0 THEN
    FOR v_row IN
      SELECT h.id AS hold_id
      FROM credit_holds h
      JOIN video_generations vg ON vg.hold_id = h.id
      WHERE vg.credits_charged IS NULL
        AND h.status = 'active'
        AND h.expires_at < NOW()
    LOOP
      BEGIN
        PERFORM fn_release_hold(v_row.hold_id);
        v_released_count := v_released_count + 1;
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Failed to release hold %: %', v_row.hold_id, SQLERRM;
      END;
    END LOOP;

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


