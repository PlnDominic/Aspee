-- Move Sales Request salesperson selections to the standalone sales_reps roster.
-- Existing system-user sales reps were seeded into sales_reps with matching ids by
-- 20260731090000_sales_reps_roster.sql, so historical request rows keep resolving.

INSERT INTO public.sales_reps (id, name, email, status, created_at)
SELECT id, name, email, COALESCE(status, 'Active'), now()
FROM public.system_users
WHERE role IN ('Van Sales Rep', 'Sales Manager')
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.requisitions
    DROP CONSTRAINT IF EXISTS requisitions_salesperson_id_fkey;

UPDATE public.requisitions r
SET salesperson_id = NULL
WHERE salesperson_id IS NOT NULL
  AND NOT EXISTS (
      SELECT 1
      FROM public.sales_reps rep
      WHERE rep.id = r.salesperson_id
  );

ALTER TABLE public.requisitions
    ADD CONSTRAINT requisitions_salesperson_id_fkey
    FOREIGN KEY (salesperson_id)
    REFERENCES public.sales_reps(id)
    ON DELETE RESTRICT;
