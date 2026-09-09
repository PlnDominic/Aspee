-- Create employees table (if it doesn't exist) with all HR fields
CREATE TABLE IF NOT EXISTS public.employees (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id         TEXT,
    full_name           TEXT NOT NULL,
    department          TEXT NOT NULL,
    job_title           TEXT,
    employment_type     TEXT DEFAULT 'Full-Time',
    date_joined         DATE,
    phone               TEXT,
    email               TEXT,
    status              TEXT DEFAULT 'Active',
    -- Identity & credentials
    ghana_card_number   TEXT,
    nhis_number         TEXT,
    nhis_provider       TEXT,
    credentials         TEXT,
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- If the table already exists, add the new columns safely
ALTER TABLE public.employees
    ADD COLUMN IF NOT EXISTS ghana_card_number TEXT,
    ADD COLUMN IF NOT EXISTS nhis_number       TEXT,
    ADD COLUMN IF NOT EXISTS nhis_provider     TEXT,
    ADD COLUMN IF NOT EXISTS credentials       TEXT;

-- Enable RLS
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read/write employees
DROP POLICY IF EXISTS "employees_all" ON public.employees;
CREATE POLICY "employees_all" ON public.employees
    FOR ALL TO authenticated USING (true) WITH CHECK (true);
