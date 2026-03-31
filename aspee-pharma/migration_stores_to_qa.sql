-- Migration: Stores to QA Internal Reporting System
-- Description: Adds tables for stores to report critical issues or requisitions to QA.

-- 1. Create qa_internal_reports table
CREATE TABLE IF NOT EXISTS qa_internal_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_number TEXT UNIQUE NOT NULL,
    type TEXT NOT NULL, -- 'Critical Report', 'Requisition'
    category TEXT NOT NULL, -- 'Expiring Materials', 'Controlled Materials', 'Other'
    status TEXT NOT NULL DEFAULT 'Pending', -- 'Pending', 'In-Review', 'Action Taken', 'Closed'
    priority TEXT NOT NULL DEFAULT 'Normal',
    notes TEXT,
    requested_by UUID REFERENCES system_users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create qa_internal_report_items table
CREATE TABLE IF NOT EXISTS qa_internal_report_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id UUID REFERENCES qa_internal_reports(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id),
    batch_number TEXT,
    quantity DECIMAL,
    expiry_date DATE,
    remarks TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Enable RLS
ALTER TABLE qa_internal_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE qa_internal_report_items ENABLE ROW LEVEL SECURITY;

-- 4. Create Policies
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Enable all for all on qa_internal_reports') THEN
        CREATE POLICY "Enable all for all on qa_internal_reports" ON qa_internal_reports FOR ALL USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Enable all for all on qa_internal_report_items') THEN
        CREATE POLICY "Enable all for all on qa_internal_report_items" ON qa_internal_report_items FOR ALL USING (true);
    END IF;
END $$;

-- 5. Trigger for updated_at
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_qa_internal_reports') THEN
        CREATE TRIGGER set_updated_at_qa_internal_reports
        BEFORE UPDATE ON qa_internal_reports
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;
