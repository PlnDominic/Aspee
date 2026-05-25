-- Fix requisitions and requisition_items RLS policies.
-- Replaces old policies querying profiles with standard authenticated user access.

DO $$
BEGIN
    -- Drop legacy policy if it exists
    DROP POLICY IF EXISTS "Salespersons can manage their requisitions" ON public.requisitions;

    -- Ensure RLS is enabled
    ALTER TABLE public.requisitions ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.requisition_items ENABLE ROW LEVEL SECURITY;

    -- Create select policy
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'requisitions' AND policyname = 'Allow authenticated select on requisitions'
    ) THEN
        CREATE POLICY "Allow authenticated select on requisitions" ON public.requisitions 
            FOR SELECT TO authenticated USING (true);
    END IF;

    -- Create insert policy
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'requisitions' AND policyname = 'Allow authenticated insert on requisitions'
    ) THEN
        CREATE POLICY "Allow authenticated insert on requisitions" ON public.requisitions 
            FOR INSERT TO authenticated WITH CHECK (true);
    END IF;

    -- Create update policy
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'requisitions' AND policyname = 'Allow authenticated update on requisitions'
    ) THEN
        CREATE POLICY "Allow authenticated update on requisitions" ON public.requisitions 
            FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
    END IF;

    -- Create delete policy
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'requisitions' AND policyname = 'Allow authenticated delete on requisitions'
    ) THEN
        CREATE POLICY "Allow authenticated delete on requisitions" ON public.requisitions 
            FOR DELETE TO authenticated USING (true);
    END IF;

    -- Create select policy for requisition_items
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'requisition_items' AND policyname = 'Allow authenticated select on requisition_items'
    ) THEN
        CREATE POLICY "Allow authenticated select on requisition_items" ON public.requisition_items 
            FOR SELECT TO authenticated USING (true);
    END IF;

    -- Create insert policy for requisition_items
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'requisition_items' AND policyname = 'Allow authenticated insert on requisition_items'
    ) THEN
        CREATE POLICY "Allow authenticated insert on requisition_items" ON public.requisition_items 
            FOR INSERT TO authenticated WITH CHECK (true);
    END IF;

    -- Create update policy for requisition_items
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'requisition_items' AND policyname = 'Allow authenticated update on requisition_items'
    ) THEN
        CREATE POLICY "Allow authenticated update on requisition_items" ON public.requisition_items 
            FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
    END IF;

    -- Create delete policy for requisition_items
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'requisition_items' AND policyname = 'Allow authenticated delete on requisition_items'
    ) THEN
        CREATE POLICY "Allow authenticated delete on requisition_items" ON public.requisition_items 
            FOR DELETE TO authenticated USING (true);
    END IF;

END $$;
