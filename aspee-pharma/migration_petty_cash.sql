-- ============================================================
-- Migration: Add Petty Cash Table
-- ============================================================

CREATE TABLE IF NOT EXISTS petty_cash (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    voucher_number TEXT UNIQUE NOT NULL,
    date DATE NOT NULL,
    type TEXT NOT NULL, -- 'Disbursement' or 'Replenishment'
    description TEXT NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    category TEXT,
    custodian TEXT NOT NULL,
    approved_by TEXT,
    receipt_attached BOOLEAN DEFAULT false,
    balance_after DECIMAL(15,2) NOT NULL,
    status TEXT DEFAULT 'Pending',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE petty_cash ENABLE ROW LEVEL SECURITY;

-- Policies
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Enable all for all on petty_cash' AND tablename = 'petty_cash') THEN
        CREATE POLICY "Enable all for all on petty_cash" ON petty_cash FOR ALL USING (true);
    END IF;
END
$$;

-- Updated_at Automations
CREATE OR REPLACE FUNCTION update_petty_cash_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_petty_cash_updated_at ON petty_cash;
CREATE TRIGGER update_petty_cash_updated_at
    BEFORE UPDATE ON petty_cash
    FOR EACH ROW
    EXECUTE FUNCTION update_petty_cash_updated_at();
