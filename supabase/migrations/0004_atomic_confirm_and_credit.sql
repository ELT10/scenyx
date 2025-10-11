-- Atomic function to confirm payment and issue credits in a single transaction
-- This prevents race conditions and ensures either both operations succeed or both fail
CREATE OR REPLACE FUNCTION fn_confirm_payment_and_issue_credits(
  p_payment_id UUID,
  p_signature TEXT,
  p_amount_microcredits BIGINT,
  p_request_user_id UUID
)
RETURNS JSON AS $$
DECLARE
  v_payment RECORD;
  v_account_id UUID;
  v_ledger_count INTEGER;
  v_new_balance BIGINT;
  v_update_count INTEGER;
BEGIN
  -- Lock the payment row for update to prevent concurrent modifications
  SELECT id, user_id, status, credited_microcredits
  INTO v_payment
  FROM payments
  WHERE id = p_payment_id
  FOR UPDATE;

  -- Verify payment exists
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment not found: %', p_payment_id;
  END IF;

  -- Verify ownership
  IF v_payment.user_id != p_request_user_id THEN
    RAISE EXCEPTION 'Payment belongs to different user';
  END IF;

  -- Check if already confirmed (idempotency)
  IF v_payment.status = 'confirmed' THEN
    RETURN json_build_object(
      'status', 'already_confirmed',
      'payment_id', p_payment_id,
      'credited_microcredits', v_payment.credited_microcredits
    );
  END IF;

  -- Verify status is pending
  IF v_payment.status != 'pending' THEN
    RAISE EXCEPTION 'Payment status must be pending, got: %', v_payment.status;
  END IF;

  -- Update payment to confirmed
  UPDATE payments
  SET 
    status = 'confirmed',
    tx_signature = p_signature,
    credited_microcredits = p_amount_microcredits,
    confirmed_at = NOW()
  WHERE id = p_payment_id
    AND status = 'pending';  -- Double-check status hasn't changed

  GET DIAGNOSTICS v_update_count = ROW_COUNT;

  IF v_update_count = 0 THEN
    -- Another request beat us to it
    RAISE EXCEPTION 'Payment was already confirmed by concurrent request';
  END IF;

  -- Check if credits were already issued (shouldn't happen, but extra safety)
  SELECT COUNT(*) INTO v_ledger_count
  FROM credits_ledger
  WHERE payment_id = p_payment_id;

  IF v_ledger_count > 0 THEN
    -- Already credited somehow
    RETURN json_build_object(
      'status', 'already_credited',
      'payment_id', p_payment_id,
      'warning', 'Credits were already in ledger'
    );
  END IF;

  -- Get or create account
  SELECT id INTO v_account_id
  FROM accounts
  WHERE user_id = v_payment.user_id;

  IF v_account_id IS NULL THEN
    INSERT INTO accounts (user_id, balance_microcredits)
    VALUES (v_payment.user_id, 0)
    RETURNING id INTO v_account_id;
  END IF;

  -- Update balance
  UPDATE accounts
  SET balance_microcredits = balance_microcredits + p_amount_microcredits
  WHERE id = v_account_id
  RETURNING balance_microcredits INTO v_new_balance;

  -- Record in ledger
  INSERT INTO credits_ledger (
    account_id,
    type,
    amount_microcredits,
    payment_id,
    created_at
  ) VALUES (
    v_account_id,
    'deposit',
    p_amount_microcredits,
    p_payment_id,
    NOW()
  );

  RETURN json_build_object(
    'status', 'confirmed',
    'payment_id', p_payment_id,
    'account_id', v_account_id,
    'amount_microcredits', p_amount_microcredits,
    'new_balance_microcredits', v_new_balance
  );
END;
$$ LANGUAGE plpgsql;

