-- Fix the video_generations constraint to allow tracking finalization time
-- This migration fixes the issue where failed videos couldn't be properly finalized

-- ============================================================================
-- Step 1: Drop the old broken constraint
-- ============================================================================
ALTER TABLE video_generations 
DROP CONSTRAINT IF EXISTS video_generations_charge_once;

-- ============================================================================
-- Step 2: Fix any existing rows that don't match the new constraint
-- ============================================================================
-- Fix rows where credits_charged = FALSE but data is inconsistent
UPDATE video_generations
SET 
  charged_amount_microcredits = NULL,
  charged_at = COALESCE(charged_at, updated_at, created_at)
WHERE credits_charged = FALSE
AND (charged_amount_microcredits IS NOT NULL OR charged_at IS NULL);

-- Fix rows where credits_charged = TRUE but data is inconsistent  
UPDATE video_generations
SET 
  charged_at = COALESCE(charged_at, updated_at, created_at)
WHERE credits_charged = TRUE
AND charged_at IS NULL;

-- Fix rows where credits_charged is NULL but other fields are set
UPDATE video_generations
SET 
  charged_amount_microcredits = NULL,
  charged_at = NULL
WHERE credits_charged IS NULL
AND (charged_amount_microcredits IS NOT NULL OR charged_at IS NOT NULL);

-- ============================================================================
-- Step 3: Update the default value for credits_charged
-- ============================================================================
-- NULL = not finalized, FALSE = finalized/refunded, TRUE = finalized/charged
ALTER TABLE video_generations 
ALTER COLUMN credits_charged SET DEFAULT NULL;

-- ============================================================================
-- Step 4: Add the corrected constraint with three valid states
-- ============================================================================
ALTER TABLE video_generations 
ADD CONSTRAINT video_generations_charge_once CHECK (
  -- State 1: Not finalized yet
  (credits_charged IS NULL AND charged_amount_microcredits IS NULL AND charged_at IS NULL) OR
  -- State 2: Finalized as failed (refunded) - tracks when we finalized
  (credits_charged = FALSE AND charged_amount_microcredits IS NULL AND charged_at IS NOT NULL) OR
  -- State 3: Finalized as completed (charged) - tracks amount and when we charged
  (credits_charged = TRUE AND charged_amount_microcredits IS NOT NULL AND charged_at IS NOT NULL)
);

-- ============================================================================
-- Step 5: Release any stuck holds from failed finalizations
-- ============================================================================
DO $$
DECLARE
  v_stuck_hold RECORD;
  v_released_count INTEGER := 0;
BEGIN
  -- Find video generations that are marked as failed but have active holds
  FOR v_stuck_hold IN (
    SELECT 
      vg.id as gen_id,
      vg.video_id,
      vg.hold_id,
      h.status as hold_status,
      h.amount_microcredits
    FROM video_generations vg
    JOIN credit_holds h ON h.id = vg.hold_id
    WHERE vg.status = 'failed'
    AND vg.credits_charged IS NULL  -- Not finalized
    AND h.status = 'active'  -- Hold still active
  )
  LOOP
    BEGIN
      -- Release the stuck hold
      PERFORM fn_release_hold(v_stuck_hold.hold_id::TEXT);
      
      -- Mark the video generation as finalized (refunded)
      UPDATE video_generations
      SET 
        credits_charged = FALSE,
        charged_amount_microcredits = NULL,
        charged_at = NOW()
      WHERE id = v_stuck_hold.gen_id;
      
      v_released_count := v_released_count + 1;
      
      RAISE NOTICE 'Released stuck hold for video % (hold: %, amount: %)',
        v_stuck_hold.video_id,
        v_stuck_hold.hold_id,
        v_stuck_hold.amount_microcredits;
        
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Failed to release hold % for video %: %',
        v_stuck_hold.hold_id,
        v_stuck_hold.video_id,
        SQLERRM;
    END;
  END LOOP;
  
  IF v_released_count > 0 THEN
    RAISE NOTICE '✅ Released % stuck holds and refunded credits', v_released_count;
  ELSE
    RAISE NOTICE '✓ No stuck holds found';
  END IF;
END $$;

-- ============================================================================
-- Verification query (commented out - uncomment to run manually)
-- ============================================================================
-- Check constraint:
-- SELECT conname, pg_get_constraintdef(oid) 
-- FROM pg_constraint 
-- WHERE conrelid = 'video_generations'::regclass 
-- AND conname = 'video_generations_charge_once';

-- Check for any remaining stuck holds:
-- SELECT 
--   vg.video_id,
--   vg.status,
--   vg.credits_charged,
--   h.status as hold_status,
--   h.amount_microcredits / 1000000.0 as amount_dollars
-- FROM video_generations vg
-- JOIN credit_holds h ON h.id = vg.hold_id
-- WHERE vg.status = 'failed'
-- AND h.status = 'active';

