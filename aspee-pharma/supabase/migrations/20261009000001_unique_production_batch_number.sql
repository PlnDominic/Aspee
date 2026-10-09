-- Job Order Batch Number must be unique (requested by Sales/Production —
-- it's the traceability key QA and Stores use to tie a job order to the
-- stock it produced). The app now checks for a duplicate before save, but
-- that's a race-prone best-effort check; this partial unique index is the
-- real guarantee. Partial (WHERE batch_number IS NOT NULL) because the
-- field is optional and many existing orders have none — a plain UNIQUE
-- constraint would treat all those NULLs as one page of "duplicates" under
-- some engines and reject unrelated inserts; Postgres already treats NULL
-- as distinct from NULL, so this is a defensive match for the app's
-- not-null style, not a correctness fix, and keeps the index small.
CREATE UNIQUE INDEX IF NOT EXISTS production_orders_batch_number_unique
    ON public.production_orders (batch_number)
    WHERE batch_number IS NOT NULL;
