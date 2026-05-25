-- Align vans table schema with current application expectations.
-- The React UI reads/writes columns:
--   van_id, plate_number, driver_name, driver_phone,
--   route_area, loaded_value, status, notes, created_at

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'vans'
    ) THEN
        -- If vans table does not exist at all, create it with the new schema
        CREATE TABLE public.vans (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            van_id TEXT UNIQUE NOT NULL,
            plate_number TEXT NOT NULL,
            driver_name TEXT NOT NULL,
            driver_phone TEXT,
            route_area TEXT NOT NULL,
            loaded_value NUMERIC(12,2) DEFAULT 0,
            status TEXT NOT NULL DEFAULT 'At Depot',
            notes TEXT,
            created_at TIMESTAMPTZ DEFAULT now()
        );

        ALTER TABLE public.vans ENABLE ROW LEVEL SECURITY;
        CREATE POLICY "Enable all for all on vans" ON public.vans FOR ALL USING (true);
    ELSE
        -- Table exists: add missing columns in a backward-compatible way
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'vans' AND column_name = 'van_id'
        ) THEN
            ALTER TABLE public.vans ADD COLUMN van_id TEXT;
        END IF;

        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'vans' AND column_name = 'plate_number'
        ) THEN
            ALTER TABLE public.vans ADD COLUMN plate_number TEXT;
        END IF;

        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'vans' AND column_name = 'driver_name'
        ) THEN
            ALTER TABLE public.vans ADD COLUMN driver_name TEXT;
        END IF;

        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'vans' AND column_name = 'driver_phone'
        ) THEN
            ALTER TABLE public.vans ADD COLUMN driver_phone TEXT;
        END IF;

        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'vans' AND column_name = 'route_area'
        ) THEN
            ALTER TABLE public.vans ADD COLUMN route_area TEXT;
        END IF;

        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'vans' AND column_name = 'loaded_value'
        ) THEN
            ALTER TABLE public.vans ADD COLUMN loaded_value NUMERIC(12,2) DEFAULT 0;
        END IF;

        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'vans' AND column_name = 'status'
        ) THEN
            ALTER TABLE public.vans ADD COLUMN status TEXT DEFAULT 'At Depot';
        END IF;

        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'vans' AND column_name = 'notes'
        ) THEN
            ALTER TABLE public.vans ADD COLUMN notes TEXT;
        END IF;

        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'vans' AND column_name = 'created_at'
        ) THEN
            ALTER TABLE public.vans ADD COLUMN created_at TIMESTAMPTZ DEFAULT now();
        END IF;
    END IF;
END $$;

