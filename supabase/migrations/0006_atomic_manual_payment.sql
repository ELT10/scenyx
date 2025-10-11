-- Atomic function to create manual payment and issue credits in a single transaction
-- This prevents the scenario where payment is saved but credits fail to issue
CREATE OR REPLACE FUNCTION fn_create_manual_payment_and_issue_credits(
  p_user_id UUID,
  p_signature TEXT,
  p_amount_microcredits BIGINT,
  p_mint TEXT
)
RETURNS JSON AS $$
DECLARE
  v_payment_id UUID;
  v_account_id UUID;
  v_ledger_count INTEGER;
  v_new_balance BIGINT;
  v_existing_payment RECORD;
BEGIN
  -- Check if payment with this signature already exists
  SELECT id, user_id, status, credited_microcredits, type
  INTO v_existing_payment
  FROM payments
  WHERE tx_signature = p_signature;

  IF FOUND THEN
    -- Payment already exists
    IF v_existing_payment.user_id != p_user_id THEN
      RAISE EXCEPTION 'Signature already credited for different user' USING ERRCODE = '42501';
    END IF;

    -- Return existing payment info
    RETURN json_build_object(
      'status', CASE WHEN v_existing_payment.status = 'confirmed' THEN 'already_confirmed' ELSE v_existing_payment.status END,
      'payment_id', v_existing_payment.id,
      'credited_microcredits', v_existing_payment.credited_microcredits,
      'type', COALESCE(v_existing_payment.type, 'manual'),
      'already_existed', true
    );
  END IF;

  -- Insert new manual payment
  INSERT INTO payments (
    user_id,
    reference,
    tx_signature,
    status,
    type,
    mint,
    amount_tokens,
    amount_usd_micros,
    credited_microcredits,
    confirmed_at,
    created_at
  ) VALUES (
    p_user_id,
    NULL,  -- manual payments have no reference
    p_signature,
    'confirmed',
    'manual',
    p_mint,
    p_amount_microcredits,
    p_amount_microcredits,
    p_amount_microcredits,
    NOW(),
    NOW()
  )
  RETURNING id INTO v_payment_id;

  -- Check if credits already issued for this payment (shouldn't happen, but extra safety)
  SELECT COUNT(*) INTO v_ledger_count
  FROM credits_ledger
  WHERE payment_id = v_payment_id;

  IF v_ledger_count > 0 THEN
    RAISE EXCEPTION 'Credits already issued for this payment';
  END IF;

  -- Get or create account
  SELECT id INTO v_account_id
  FROM accounts
  WHERE user_id = p_user_id;

  IF v_account_id IS NULL THEN
    INSERT INTO accounts (user_id, balance_microcredits)
    VALUES (p_user_id, 0)
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
    v_payment_id,
    NOW()
  );

  RETURN json_build_object(
    'status', 'confirmed',
    'payment_id', v_payment_id,
    'account_id', v_account_id,
    'amount_microcredits', p_amount_microcredits,
    'new_balance_microcredits', v_new_balance,
    'type', 'manual',
    'already_existed', false
  );
END;
$$ LANGUAGE plpgsql;

