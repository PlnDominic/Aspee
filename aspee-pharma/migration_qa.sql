-- ============================================================
-- Migration: Add Quality Assurance Tables
-- ============================================================

-- 1. Create In Process Controls Table
CREATE TABLE IF NOT EXISTS qa_in_process (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_number TEXT NOT NULL,
    product_name TEXT NOT NULL,
    stage TEXT NOT NULL,
    parameters_checked TEXT NOT NULL,
    results TEXT NOT NULL,
    status TEXT DEFAULT 'Pending' CHECK (status IN ('Pending', 'Passed', 'Failed', 'Needs Review')),
    inspector TEXT NOT NULL,
    inspection_date TIMESTAMPTZ DEFAULT now(),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Create Finished Products Analysis Table
CREATE TABLE IF NOT EXISTS qa_finished_products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_name TEXT NOT NULL,
    batch_number TEXT NOT NULL,
    tests_performed TEXT NOT NULL,
    overall_status TEXT DEFAULT 'Pending' CHECK (overall_status IN ('Pending', 'Passed', 'Failed', 'Quarantine')),
    release_date TIMESTAMPTZ,
    analyst TEXT NOT NULL,
    analysis_date TIMESTAMPTZ DEFAULT now(),
    remarks TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Enable RLS on qa_in_process
ALTER TABLE qa_in_process ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Enable all for all on qa_in_process' AND tablename = 'qa_in_process') THEN
        CREATE POLICY "Enable all for all on qa_in_process" ON qa_in_process FOR ALL USING (true) WITH CHECK (true);
    END IF;
END
$$;

-- 4. Enable RLS on qa_finished_products
ALTER TABLE qa_finished_products ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Enable all for all on qa_finished_products' AND tablename = 'qa_finished_products') THEN
        CREATE POLICY "Enable all for all on qa_finished_products" ON qa_finished_products FOR ALL USING (true) WITH CHECK (true);
    END IF;
END
$$;
