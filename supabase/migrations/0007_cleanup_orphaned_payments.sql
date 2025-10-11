-- Optional: Create a function to clean up abandoned payment intents
-- These are payments where user cancelled in wallet (pending with no signature)
-- Run this periodically (e.g., daily cron job) to keep database clean

CREATE OR REPLACE FUNCTION fn_cleanup_orphaned_payments(
  p_age_minutes INTEGER DEFAULT 60
)
RETURNS JSON AS $$
DECLARE
  v_deleted_count INTEGER;
BEGIN
  -- Delete pending payments older than specified age with no signature
  -- These are wallet cancellations that were never completed
  DELETE FROM payments
  WHERE status = 'pending'
    AND tx_signature IS NULL
    AND created_at < NOW() - (p_age_minutes || ' minutes')::INTERVAL;
  
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  
  RETURN json_build_object(
    'deleted_count', v_deleted_count,
    'age_minutes', p_age_minutes,
    'cleaned_at', NOW()
  );
END;
$$ LANGUAGE plpgsql;

-- Example usage (can be called from a cron job or admin endpoint):
-- SELECT fn_cleanup_orphaned_payments(60);  -- Clean payments older than 60 minutes

