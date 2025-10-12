-- Clean up all test data and start fresh
-- WARNING: This will delete all video generations and release all holds
-- Only run this in development!

-- ============================================================================
-- Step 1: Release all active holds
-- ============================================================================
DO $$
DECLARE
  v_hold RECORD;
  v_released_count INTEGER := 0;
BEGIN
  FOR v_hold IN (
    SELECT id FROM credit_holds WHERE status = 'active'
  )
  LOOP
    BEGIN
      PERFORM fn_release_hold(v_hold.id::TEXT);
      v_released_count := v_released_count + 1;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Failed to release hold %: %', v_hold.id, SQLERRM;
    END;
  END LOOP;
  
  RAISE NOTICE '✅ Released % active holds', v_released_count;
END $$;

-- ============================================================================
-- Step 2: Delete all video generations
-- ============================================================================
DELETE FROM video_generations;

-- ============================================================================
-- Step 3: Delete all credit holds (already released above)
-- ============================================================================
DELETE FROM credit_holds;

-- ============================================================================
-- Step 4: Delete all credits ledger entries
-- ============================================================================
DELETE FROM credits_ledger;

-- ============================================================================
-- Step 5: Reset account balances to 0 (optional - uncomment if needed)
-- ============================================================================
-- UPDATE accounts SET balance_microcredits = 0;

-- ============================================================================
-- Verification queries
-- ============================================================================
-- Check what's left:
SELECT 
  'video_generations' as table_name,
  COUNT(*) as row_count
FROM video_generations
UNION ALL
SELECT 
  'credit_holds' as table_name,
  COUNT(*) as row_count
FROM credit_holds
UNION ALL
SELECT 
  'credits_ledger' as table_name,
  COUNT(*) as row_count
FROM credits_ledger
UNION ALL
SELECT 
  'accounts' as table_name,
  COUNT(*) as row_count
FROM accounts;

-- Show current account balances:
SELECT 
  user_id,
  balance_microcredits / 1000000.0 as balance_credits
FROM accounts;

