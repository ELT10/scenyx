-- Add reasonable safety limits to prevent exploitation

-- Add constraint to prevent unreasonably large payments (max $1M per transaction)
ALTER TABLE payments ADD CONSTRAINT payments_max_amount_check 
  CHECK (amount_usd_micros IS NULL OR amount_usd_micros <= 1000000000000);

-- Add constraint to prevent negative amounts
ALTER TABLE payments ADD CONSTRAINT payments_positive_amount_check 
  CHECK (amount_usd_micros IS NULL OR amount_usd_micros > 0);

-- Add constraint to credits ledger for positive deposits only
ALTER TABLE credits_ledger ADD CONSTRAINT credits_ledger_positive_deposit_check
  CHECK (type != 'deposit' OR amount_microcredits > 0);

-- Ensure accounts balance never goes negative
ALTER TABLE accounts ADD CONSTRAINT accounts_non_negative_balance_check
  CHECK (balance_microcredits >= 0);

-- Add index for payment lookups by signature and user (used in confirm/verify)
CREATE INDEX IF NOT EXISTS idx_payments_signature_user ON payments(tx_signature, user_id);

