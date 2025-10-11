-- Create the complete hold/capture credit system with proper locking
-- This enables pre-authorization (holds) and exact charging (capture) for API usage

-- ============================================================================
-- Drop existing functions first (to avoid signature conflicts)
-- ============================================================================
DROP FUNCTION IF EXISTS fn_get_or_create_account(UUID);
DROP FUNCTION IF EXISTS fn_create_hold(UUID, BIGINT, TEXT, BIGINT);
DROP FUNCTION IF EXISTS fn_create_hold(UUID, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS fn_capture_hold(UUID, BIGINT);
DROP FUNCTION IF EXISTS fn_capture_hold(UUID, TEXT);
DROP FUNCTION IF EXISTS fn_release_hold(UUID);
DROP FUNCTION IF EXISTS fn_increase_hold(UUID, TEXT);

-- ============================================================================
-- FUNCTION: Get or Create Account
-- ============================================================================
CREATE FUNCTION fn_get_or_create_account(
  p_user_id UUID
)
RETURNS UUID AS $$
DECLARE
  v_account_id UUID;
BEGIN
  -- Try to get existing account
  SELECT id INTO v_account_id
  FROM accounts
  WHERE user_id = p_user_id;
  
  -- Create if doesn't exist
  IF v_account_id IS NULL THEN
    INSERT INTO accounts (user_id, balance_microcredits)
    VALUES (p_user_id, 0)
    RETURNING id INTO v_account_id;
  END IF;
  
  RETURN v_account_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FUNCTION: Create Hold (Pre-authorize credits)
-- ============================================================================
CREATE OR REPLACE FUNCTION fn_create_hold(
  p_account_id UUID,
  p_amount_micro TEXT,  -- bigint as text to avoid JS precision issues
  p_idempotency_key TEXT,
  p_factor_micros TEXT  -- Credit USD value snapshot
)
RETURNS UUID AS $$
DECLARE
  v_hold_id UUID;
  v_current_balance BIGINT;
  v_amount BIGINT;
  v_factor BIGINT;
  v_existing_hold UUID;
BEGIN
  v_amount := p_amount_micro::BIGINT;
  v_factor := p_factor_micros::BIGINT;
  
  -- Check for existing hold with same idempotency key
  SELECT id INTO v_existing_hold
  FROM credit_holds
  WHERE idempotency_key = p_idempotency_key
    AND status = 'active';
  
  IF v_existing_hold IS NOT NULL THEN
    -- Idempotent: return existing hold
    RETURN v_existing_hold;
  END IF;
  
  -- Lock account row to prevent race conditions
  SELECT balance_microcredits INTO v_current_balance
  FROM accounts
  WHERE id = p_account_id
  FOR UPDATE;
  
  -- Check sufficient balance
  IF v_current_balance < v_amount THEN
    RAISE EXCEPTION 'Insufficient credits: have %, need %', v_current_balance, v_amount
      USING ERRCODE = '53400';
  END IF;
  
  -- Deduct from balance immediately (hold = reserved credits)
  UPDATE accounts
  SET balance_microcredits = balance_microcredits - v_amount
  WHERE id = p_account_id;
  
  -- Create hold record
  INSERT INTO credit_holds (
    account_id,
    amount_microcredits,
    status,
    idempotency_key,
    credit_usd_per_credit_micros_at_hold,
    expires_at,
    created_at
  ) VALUES (
    p_account_id,
    v_amount,
    'active',
    p_idempotency_key,
    v_factor,
    NOW() + INTERVAL '1 hour',  -- Holds expire after 1 hour
    NOW()
  )
  RETURNING id INTO v_hold_id;
  
  -- Record in ledger
  INSERT INTO credits_ledger (
    account_id,
    type,
    amount_microcredits,
    hold_id,
    created_at
  ) VALUES (
    p_account_id,
    'hold',
    -v_amount,  -- Negative for deduction
    v_hold_id,
    NOW()
  );
  
  RETURN v_hold_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FUNCTION: Capture Hold (Charge actual usage)
-- ============================================================================
CREATE OR REPLACE FUNCTION fn_capture_hold(
  p_hold_id UUID,
  p_capture_micro TEXT  -- bigint as text
)
RETURNS VOID AS $$
DECLARE
  v_hold RECORD;
  v_capture_amount BIGINT;
  v_remainder BIGINT;
BEGIN
  v_capture_amount := p_capture_micro::BIGINT;
  
  -- Lock and get hold
  SELECT id, account_id, amount_microcredits, status
  INTO v_hold
  FROM credit_holds
  WHERE id = p_hold_id
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Hold not found: %', p_hold_id;
  END IF;
  
  IF v_hold.status != 'active' THEN
    RAISE EXCEPTION 'Hold is not active: %', v_hold.status;
  END IF;
  
  IF v_capture_amount > v_hold.amount_microcredits THEN
    RAISE EXCEPTION 'Capture amount % exceeds hold amount %', v_capture_amount, v_hold.amount_microcredits;
  END IF;
  
  -- Calculate remainder to return
  v_remainder := v_hold.amount_microcredits - v_capture_amount;
  
  -- Return unused credits to balance
  IF v_remainder > 0 THEN
    UPDATE accounts
    SET balance_microcredits = balance_microcredits + v_remainder
    WHERE id = v_hold.account_id;
    
    -- Record release in ledger
    INSERT INTO credits_ledger (
      account_id,
      type,
      amount_microcredits,
      hold_id,
      created_at
    ) VALUES (
      v_hold.account_id,
      'release',
      v_remainder,  -- Positive for credit back
      p_hold_id,
      NOW()
    );
  END IF;
  
  -- Mark hold as captured
  UPDATE credit_holds
  SET status = 'captured',
      captured_at = NOW()
  WHERE id = p_hold_id;
  
  -- Record capture in ledger (actual charge)
  INSERT INTO credits_ledger (
    account_id,
    type,
    amount_microcredits,
    hold_id,
    created_at
  ) VALUES (
    v_hold.account_id,
    'capture',
    v_capture_amount,  -- Actual usage (informational, already deducted via hold)
    p_hold_id,
    NOW()
  );
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FUNCTION: Release Hold (Return all credits on failure)
-- ============================================================================
CREATE OR REPLACE FUNCTION fn_release_hold(
  p_hold_id UUID
)
RETURNS VOID AS $$
DECLARE
  v_hold RECORD;
BEGIN
  -- Lock and get hold
  SELECT id, account_id, amount_microcredits, status
  INTO v_hold
  FROM credit_holds
  WHERE id = p_hold_id
  FOR UPDATE;
  
  IF NOT FOUND THEN
    -- Hold doesn't exist, treat as no-op (idempotent)
    RETURN;
  END IF;
  
  IF v_hold.status != 'active' THEN
    -- Already captured or released, treat as no-op (idempotent)
    RETURN;
  END IF;
  
  -- Return all credits to balance
  UPDATE accounts
  SET balance_microcredits = balance_microcredits + v_hold.amount_microcredits
  WHERE id = v_hold.account_id;
  
  -- Mark hold as released
  UPDATE credit_holds
  SET status = 'released',
      released_at = NOW()
  WHERE id = p_hold_id;
  
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
    v_hold.amount_microcredits,  -- Positive for credit back
    p_hold_id,
    NOW()
  );
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FUNCTION: Increase Hold (When actual usage exceeds estimate)
-- ============================================================================
CREATE OR REPLACE FUNCTION fn_increase_hold(
  p_hold_id UUID,
  p_additional_micro TEXT
)
RETURNS VOID AS $$
DECLARE
  v_hold RECORD;
  v_additional BIGINT;
  v_current_balance BIGINT;
BEGIN
  v_additional := p_additional_micro::BIGINT;
  
  -- Lock and get hold
  SELECT id, account_id, amount_microcredits, status
  INTO v_hold
  FROM credit_holds
  WHERE id = p_hold_id
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Hold not found: %', p_hold_id;
  END IF;
  
  IF v_hold.status != 'active' THEN
    RAISE EXCEPTION 'Hold is not active: %', v_hold.status;
  END IF;
  
  -- Lock account and check balance
  SELECT balance_microcredits INTO v_current_balance
  FROM accounts
  WHERE id = v_hold.account_id
  FOR UPDATE;
  
  IF v_current_balance < v_additional THEN
    RAISE EXCEPTION 'Insufficient credits for hold increase: have %, need %', v_current_balance, v_additional
      USING ERRCODE = '53400';
  END IF;
  
  -- Deduct additional from balance
  UPDATE accounts
  SET balance_microcredits = balance_microcredits - v_additional
  WHERE id = v_hold.account_id;
  
  -- Increase hold amount
  UPDATE credit_holds
  SET amount_microcredits = amount_microcredits + v_additional
  WHERE id = p_hold_id;
  
  -- Record additional hold in ledger
  INSERT INTO credits_ledger (
    account_id,
    type,
    amount_microcredits,
    hold_id,
    created_at
  ) VALUES (
    v_hold.account_id,
    'hold_increase',
    -v_additional,  -- Negative for deduction
    p_hold_id,
    NOW()
  );
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Add captured_at and released_at columns if they don't exist
-- ============================================================================
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'credit_holds' AND column_name = 'captured_at'
  ) THEN
    ALTER TABLE credit_holds ADD COLUMN captured_at TIMESTAMP;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'credit_holds' AND column_name = 'released_at'
  ) THEN
    ALTER TABLE credit_holds ADD COLUMN released_at TIMESTAMP;
  END IF;
END $$;

-- ============================================================================
-- Create index for hold lookups
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_credit_holds_idempotency ON credit_holds(idempotency_key) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_credit_holds_account_status ON credit_holds(account_id, status);
CREATE INDEX IF NOT EXISTS idx_credit_holds_expires ON credit_holds(expires_at) WHERE status = 'active';

