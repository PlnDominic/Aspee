-- CONSOLIDATED DATABASE FIX MIGRATION
-- Applies missing tables and policies for Purchase Requests and QA Internal Reporting.
-- RUN THIS IN YOUR SUPABASE SQL EDITOR (https://supabase.com/dashboard/project/hgwubhigvmgrikhpogxg/sql/new)

--------------------------------------------------------------------------------
-- 1. PURCHASE REQUEST SYSTEM (STORES TO PURCHASING)
--------------------------------------------------------------------------------

-- Create purchase_requests table
CREATE TABLE IF NOT EXISTS purchase_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_number TEXT UNIQUE NOT NULL,
    requested_by UUID REFERENCES system_users(id),
    status TEXT NOT NULL DEFAULT 'Pending',
    priority TEXT NOT NULL DEFAULT 'Normal',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create purchase_request_items table
CREATE TABLE IF NOT EXISTS purchase_request_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID REFERENCES purchase_requests(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id),
    quantity DECIMAL NOT NULL,
    unit TEXT,
    last_purchase_price DECIMAL DEFAULT 0,
    last_purchase_date DATE,
    purpose TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE purchase_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_request_items ENABLE ROW LEVEL SECURITY;

-- Create Policies
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Enable all for all on purchase_requests') THEN
        CREATE POLICY "Enable all for all on purchase_requests" ON purchase_requests FOR ALL USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Enable all for all on purchase_request_items') THEN
        CREATE POLICY "Enable all for all on purchase_request_items" ON purchase_request_items FOR ALL USING (true);
    END IF;
END $$;

--------------------------------------------------------------------------------
-- 2. STORES TO QA INTERNAL REPORTING SYSTEM
--------------------------------------------------------------------------------

-- Create qa_internal_reports table
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

-- Create qa_internal_report_items table
CREATE TABLE IF NOT EXISTS qa_internal_report_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id UUID REFERENCES qa_internal_reports(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id),
    batch_number TEXT,
    defect_type TEXT, -- 'Expired Material', 'Leakage', 'Breakage', 'Spillage'
    quantity DECIMAL,
    expiry_date DATE,
    remarks TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE qa_internal_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE qa_internal_report_items ENABLE ROW LEVEL SECURITY;

-- Create Policies
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Enable all for all on qa_internal_reports') THEN
        CREATE POLICY "Enable all for all on qa_internal_reports" ON qa_internal_reports FOR ALL USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Enable all for all on qa_internal_report_items') THEN
        CREATE POLICY "Enable all for all on qa_internal_report_items" ON qa_internal_report_items FOR ALL USING (true);
    END IF;
END $$;

--------------------------------------------------------------------------------
-- 3. SHARED HELPERS (UPDATED_AT TRIGGER)
--------------------------------------------------------------------------------

-- Ensure trigger function exists
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_purchase_requests') THEN
        CREATE TRIGGER set_updated_at_purchase_requests
        BEFORE UPDATE ON purchase_requests
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_qa_internal_reports') THEN
        CREATE TRIGGER set_updated_at_qa_internal_reports
        BEFORE UPDATE ON qa_internal_reports
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;
