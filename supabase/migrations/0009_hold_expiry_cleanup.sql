-- Function to clean up expired holds and return credits to users
-- Should be run periodically (e.g., hourly cron job)

CREATE OR REPLACE FUNCTION fn_expire_old_holds()
RETURNS JSON AS $$
DECLARE
  v_expired_count INTEGER := 0;
  v_hold RECORD;
BEGIN
  -- Find and process all expired active holds
  FOR v_hold IN
    SELECT id, account_id, amount_microcredits
    FROM credit_holds
    WHERE status = 'active'
      AND expires_at < NOW()
    FOR UPDATE SKIP LOCKED  -- Skip if another process is handling it
  LOOP
    -- Return credits to balance
    UPDATE accounts
    SET balance_microcredits = balance_microcredits + v_hold.amount_microcredits
    WHERE id = v_hold.account_id;
    
    -- Mark hold as released
    UPDATE credit_holds
    SET status = 'released',
        released_at = NOW()
    WHERE id = v_hold.id;
    
    -- Record in ledger
    INSERT INTO credits_ledger (
      account_id,
      type,
      amount_microcredits,
      hold_id,
      created_at
    ) VALUES (
      v_hold.account_id,
      'release',
      v_hold.amount_microcredits,
      v_hold.id,
      NOW()
    );
    
    v_expired_count := v_expired_count + 1;
  END LOOP;
  
  RETURN json_build_object(
    'expired_count', v_expired_count,
    'cleaned_at', NOW()
  );
END;
$$ LANGUAGE plpgsql;

-- Example usage (can be called from a cron job):
-- SELECT fn_expire_old_holds();

