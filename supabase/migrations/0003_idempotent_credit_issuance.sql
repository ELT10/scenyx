-- Drop existing function if it exists (to change return type)
DROP FUNCTION IF EXISTS fn_issue_credits_for_payment(UUID, UUID, BIGINT);

-- Create the credit issuance function with idempotency protection
CREATE FUNCTION fn_issue_credits_for_payment(
  p_payment_id UUID,
  p_user_id UUID,
  p_credits_micro BIGINT
)
RETURNS JSON AS $$
DECLARE
  v_account_id UUID;
  v_ledger_count INTEGER;
  v_new_balance BIGINT;
BEGIN
  -- Check if credits were already issued for this payment
  SELECT COUNT(*) INTO v_ledger_count
  FROM credits_ledger
  WHERE payment_id = p_payment_id;

  IF v_ledger_count > 0 THEN
    -- Already credited, return success (idempotent)
    RETURN json_build_object(
      'status', 'already_credited',
      'payment_id', p_payment_id,
      'ledger_entries', v_ledger_count
    );
  END IF;

  -- Get or create account for this user
  SELECT id INTO v_account_id
  FROM accounts
  WHERE user_id = p_user_id;

  IF v_account_id IS NULL THEN
    INSERT INTO accounts (user_id, balance_microcredits)
    VALUES (p_user_id, 0)
    RETURNING id INTO v_account_id;
  END IF;

  -- Update balance and insert ledger entry in a transaction
  UPDATE accounts
  SET balance_microcredits = balance_microcredits + p_credits_micro
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
    p_credits_micro,
    p_payment_id,
    NOW()
  );

  RETURN json_build_object(
    'status', 'credited',
    'payment_id', p_payment_id,
    'account_id', v_account_id,
    'amount_microcredits', p_credits_micro,
    'new_balance_microcredits', v_new_balance
  );
END;
$$ LANGUAGE plpgsql;

