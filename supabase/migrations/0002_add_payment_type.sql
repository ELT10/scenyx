-- Make reference column nullable (manual payments don't have references)
ALTER TABLE payments ALTER COLUMN reference DROP NOT NULL;

-- Make amount_tokens nullable (can be derived from amount_usd_micros)
ALTER TABLE payments ALTER COLUMN amount_tokens DROP NOT NULL;

-- Ensure tx_signature has unique constraint for idempotency
-- This prevents double-crediting the same transaction
DO $$ 
BEGIN
    -- Try to add the constraint if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'payments_tx_signature_unique'
    ) THEN
        ALTER TABLE payments ADD CONSTRAINT payments_tx_signature_unique UNIQUE (tx_signature);
    END IF;
END $$;

-- Add type column to payments table to distinguish between intent-based and manual payments
ALTER TABLE payments ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'intent' CHECK (type IN ('intent', 'manual'));

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_payments_type ON payments(type);
CREATE INDEX IF NOT EXISTS idx_payments_status_user ON payments(status, user_id);
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON payments(created_at DESC);

-- Update existing rows to have type = 'intent' (they came from create-intent flow)
UPDATE payments SET type = 'intent' WHERE type IS NULL AND reference IS NOT NULL;

-- Manual payments without reference should be marked as 'manual'
UPDATE payments SET type = 'manual' WHERE type IS NULL AND reference IS NULL;

