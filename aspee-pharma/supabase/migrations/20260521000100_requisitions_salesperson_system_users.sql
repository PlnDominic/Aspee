-- Align sales requisition salesperson assignments with the app user table.
-- Sales request UI now selects active sales users from public.system_users.

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'requisitions'
    ) THEN
        ALTER TABLE public.requisitions
            DROP CONSTRAINT IF EXISTS requisitions_salesperson_id_fkey;

        IF EXISTS (
            SELECT 1
            FROM information_schema.tables
            WHERE table_schema = 'public'
              AND table_name = 'profiles'
        ) THEN
            UPDATE public.requisitions r
            SET salesperson_id = su.id
            FROM public.profiles p
            JOIN public.system_users su
              ON lower(su.email) = lower(p.email)
            WHERE r.salesperson_id = p.id
              AND r.salesperson_id IS DISTINCT FROM su.id;
        END IF;

        UPDATE public.requisitions r
        SET salesperson_id = NULL
        WHERE salesperson_id IS NOT NULL
          AND NOT EXISTS (
              SELECT 1
              FROM public.system_users su
              WHERE su.id = r.salesperson_id
          );

        ALTER TABLE public.requisitions
            ADD CONSTRAINT requisitions_salesperson_id_fkey
            FOREIGN KEY (salesperson_id)
            REFERENCES public.system_users(id)
            ON DELETE RESTRICT;
    END IF;
END $$;
