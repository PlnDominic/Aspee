-- Bank Reconciliation Module
-- Create table for storing bank statement transactions

CREATE TABLE IF NOT EXISTS bank_statements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Bank account reference (links to chart_of_accounts)
    account_id UUID NOT NULL REFERENCES chart_of_accounts(id) ON DELETE CASCADE,
    
    -- Statement metadata
    statement_date DATE NOT NULL,
    transaction_date DATE NOT NULL,
    
    -- Transaction details from bank statement
    description TEXT NOT NULL,
    reference TEXT,  -- Check number, transaction reference, etc.
    
    -- Amounts (separate debit/credit columns for easier matching)
    debit_amount DECIMAL(15,2) DEFAULT 0,
    credit_amount DECIMAL(15,2) DEFAULT 0,
    balance DECIMAL(15,2),  -- Running balance from statement
    
    -- Matching status
    match_status VARCHAR(20) DEFAULT 'unmatched' CHECK (match_status IN ('unmatched', 'matched', 'partial', 'disputed')),
    matched_journal_entry_id TEXT REFERENCES journal_entries(entry_number),
    
    -- Additional metadata
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES employees(id),
    
    -- CSV import tracking
    import_batch_id VARCHAR(100),  -- Group transactions from same CSV upload
    original_csv_row JSONB  -- Store original CSV data for debugging
);

-- Create indexes for performance
CREATE INDEX idx_bank_statements_account_date ON bank_statements(account_id, transaction_date);
CREATE INDEX idx_bank_statements_match_status ON bank_statements(match_status);
CREATE INDEX idx_bank_statements_matched_entry ON bank_statements(matched_journal_entry_id);
CREATE INDEX idx_bank_statements_import_batch ON bank_statements(import_batch_id);

-- Create view for reconciliation summary
CREATE OR REPLACE VIEW bank_reconciliation_summary AS
SELECT 
    bs.account_id,
    coa.name as account_name,
    coa.code as account_code,
    COUNT(*) as total_transactions,
    SUM(CASE WHEN bs.match_status = 'matched' THEN 1 ELSE 0 END) as matched_count,
    SUM(CASE WHEN bs.match_status = 'unmatched' THEN 1 ELSE 0 END) as unmatched_count,
    SUM(bs.debit_amount) as total_debits,
    SUM(bs.credit_amount) as total_credits,
    SUM(CASE WHEN bs.match_status = 'unmatched' THEN bs.debit_amount ELSE 0 END) as unmatched_debits,
    SUM(CASE WHEN bs.match_status = 'unmatched' THEN bs.credit_amount ELSE 0 END) as unmatched_credits
FROM bank_statements bs
JOIN chart_of_accounts coa ON bs.account_id = coa.id
GROUP BY bs.account_id, coa.name, coa.code;

-- Enable RLS
ALTER TABLE bank_statements ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Allow all operations on bank statements" ON bank_statements
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- Insert notification for new module
INSERT INTO notifications (type, title, message, created_at)
VALUES (
    'system',
    'Bank Reconciliation Module Added',
    'The bank reconciliation feature is now available. Upload bank statements and match them with journal entries.',
    NOW()
);
