-- ============================================================
-- Migration: Standalone Sales Reps roster
--
-- Every "Sales Person" picker in the app (Receipt Modal, Cash Receipts
-- bulk entry, Cash Reconciliation, Customer assignment) currently sources
-- names from system_users filtered to Van Sales Rep / Sales Manager roles
-- — meaning a sales rep must be a logged-in system user to be assignable
-- anywhere. Most real van sales reps aren't system users at all. This adds
-- an independent sales_reps roster (no auth/system_users coupling) and
-- migrates the cash-collection/customer-assignment flows onto it.
--
-- customers.sales_person stays a free-text field (unchanged schema) — only
-- its dropdown's source moves. sales_invoices.salesperson_id and
-- requisitions.salesperson_id are untouched: the former auto-records
-- whichever logged-in user posted the invoice (not a rep picker), and the
-- Products Requisition flow is a separately-scoped feature — out of scope
-- here.
-- ============================================================

-- 1. Standalone roster table
CREATE TABLE IF NOT EXISTS public.sales_reps (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    phone text,
    email text,
    status text NOT NULL DEFAULT 'Active',
    notes text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.sales_reps ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE policyname = 'Enable all for all on sales_reps'
          AND tablename = 'sales_reps'
    ) THEN
        CREATE POLICY "Enable all for all on sales_reps"
            ON public.sales_reps FOR ALL USING (true);
    END IF;
END $$;

-- 2. Seed the roster from existing Van Sales Rep / Sales Manager system
-- users, reusing the same id — this lets the backfill below match existing
-- sales_person_id values with zero remapping, with no ongoing coupling to
-- system_users going forward (new reps get fresh ids, unrelated to auth).
INSERT INTO public.sales_reps (id, name, email, status, created_at)
SELECT id, name, email, COALESCE(status, 'Active'), now()
FROM public.system_users
WHERE role IN ('Van Sales Rep', 'Sales Manager')
ON CONFLICT (id) DO NOTHING;

-- 3. New sales_rep_id column on sales_receipts (the sales_person_id column
-- is left in place, untouched, as historical/legacy data).
ALTER TABLE public.sales_receipts
    ADD COLUMN IF NOT EXISTS sales_rep_id uuid REFERENCES public.sales_reps(id) ON DELETE SET NULL;

UPDATE public.sales_receipts sr
SET sales_rep_id = sr.sales_person_id
WHERE sr.sales_person_id IS NOT NULL
  AND sr.sales_rep_id IS NULL
  AND EXISTS (SELECT 1 FROM public.sales_reps rep WHERE rep.id = sr.sales_person_id);

-- 4. Redefine post_sales_receipt_impl to read/write sales_rep_id instead of
-- sales_person_id — identical to the customer-centric version
-- (20260602000001) otherwise.
CREATE OR REPLACE FUNCTION app_private.post_sales_receipt_impl(
    auth_user_uuid uuid,
    auth_email text,
    receipt_payload jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app_private
AS $$
DECLARE
    app_user record;
    receipt_uuid uuid;
    customer_uuid uuid;
    customer_row record;
    receipt_amount numeric;
    inserted_receipt_id uuid;
    allocations jsonb;
    alloc jsonb;
    alloc_total numeric := 0;
    alloc_invoice uuid;
    alloc_amount numeric;
    invoice_total numeric;
    existing_allocated numeric;
    affected_invoice uuid;
    primary_invoice_uuid uuid;
    primary_invoice_number text;
BEGIN
    IF auth_user_uuid IS NULL THEN
        RAISE EXCEPTION 'Authentication required.';
    END IF;

    SELECT id, role, status
    INTO app_user
    FROM public.system_users
    WHERE auth_user_id = auth_user_uuid
       OR lower(email) = lower(COALESCE(auth_email, ''))
    ORDER BY CASE WHEN auth_user_id = auth_user_uuid THEN 0 ELSE 1 END
    LIMIT 1;

    IF app_user.id IS NULL THEN
        RAISE EXCEPTION 'System user profile was not found.';
    END IF;

    IF app_user.status IS NOT NULL AND app_user.status <> 'Active' THEN
        RAISE EXCEPTION 'Your account is inactive.';
    END IF;

    IF COALESCE(app_user.role, '') NOT IN (
        'Super Admin', 'Managing Director', 'Accountant', 'Sales Manager', 'Van Sales Rep'
    ) THEN
        RAISE EXCEPTION 'Insufficient permissions to post sales receipts.';
    END IF;

    receipt_uuid   := NULLIF(receipt_payload->>'id', '')::uuid;
    customer_uuid  := NULLIF(receipt_payload->>'customer_id', '')::uuid;
    receipt_amount := COALESCE(NULLIF(receipt_payload->>'amount', '')::numeric, 0);
    allocations    := receipt_payload->'allocations';

    IF customer_uuid IS NULL THEN
        RAISE EXCEPTION 'Receipt must be linked to a customer.';
    END IF;

    IF receipt_amount <= 0 THEN
        RAISE EXCEPTION 'Receipt amount must be greater than zero.';
    END IF;

    SELECT id, name INTO customer_row
    FROM public.customers
    WHERE id = customer_uuid;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Customer was not found.';
    END IF;

    -- Validate allocations (if provided)
    IF allocations IS NOT NULL AND jsonb_typeof(allocations) = 'array' THEN
        FOR alloc IN SELECT * FROM jsonb_array_elements(allocations)
        LOOP
            alloc_invoice := NULLIF(alloc->>'invoice_id', '')::uuid;
            alloc_amount  := COALESCE(NULLIF(alloc->>'amount', '')::numeric, 0);

            IF alloc_invoice IS NULL OR alloc_amount <= 0 THEN
                CONTINUE;
            END IF;

            SELECT total_amount INTO invoice_total
            FROM public.sales_invoices
            WHERE id = alloc_invoice
            FOR UPDATE;

            IF NOT FOUND THEN
                RAISE EXCEPTION 'Allocated invoice % was not found.', alloc_invoice;
            END IF;

            SELECT COALESCE(SUM(a.amount), 0)
            INTO existing_allocated
            FROM public.sales_receipt_allocations a
            JOIN public.sales_receipts r ON r.id = a.receipt_id
            WHERE a.invoice_id = alloc_invoice
              AND (receipt_uuid IS NULL OR a.receipt_id <> receipt_uuid)
              AND COALESCE(r.status, '') NOT IN ('VOID', 'Void', 'CANCELLED', 'Cancelled');

            IF existing_allocated + alloc_amount > COALESCE(invoice_total, 0) + 0.01 THEN
                RAISE EXCEPTION 'Allocation to invoice % exceeds invoice total. Outstanding %, allocating %.',
                    alloc_invoice,
                    GREATEST(COALESCE(invoice_total, 0) - existing_allocated, 0),
                    alloc_amount;
            END IF;

            alloc_total := alloc_total + alloc_amount;
        END LOOP;

        IF alloc_total > receipt_amount + 0.01 THEN
            RAISE EXCEPTION 'Total allocations (%) exceed receipt amount (%).',
                alloc_total, receipt_amount;
        END IF;
    END IF;

    -- Resolve primary invoice id for backward-compatible invoice_id / invoice_number columns
    IF allocations IS NOT NULL AND jsonb_typeof(allocations) = 'array' AND jsonb_array_length(allocations) > 0 THEN
        primary_invoice_uuid := NULLIF(allocations->0->>'invoice_id', '')::uuid;
        SELECT invoice_number INTO primary_invoice_number
        FROM public.sales_invoices WHERE id = primary_invoice_uuid;
    ELSE
        primary_invoice_uuid := NULLIF(receipt_payload->>'invoice_id', '')::uuid;
        primary_invoice_number := NULLIF(receipt_payload->>'invoice_number', '');
    END IF;

    -- Insert or update the receipt
    IF receipt_uuid IS NOT NULL THEN
        UPDATE public.sales_receipts
        SET receipt_number      = receipt_payload->>'receipt_number',
            customer_id         = customer_uuid,
            customer_name       = COALESCE(receipt_payload->>'customer_name', customer_row.name),
            invoice_id          = primary_invoice_uuid,
            invoice_number      = primary_invoice_number,
            sales_rep_id        = NULLIF(receipt_payload->>'sales_rep_id', '')::uuid,
            route_id            = NULLIF(receipt_payload->>'route_id', '')::uuid,
            date                = COALESCE(NULLIF(receipt_payload->>'date', '')::date, current_date),
            payment_method      = receipt_payload->>'payment_method',
            payment_reference   = NULLIF(receipt_payload->>'payment_reference', ''),
            amount              = receipt_amount,
            notes               = receipt_payload->>'notes',
            status              = COALESCE(NULLIF(receipt_payload->>'status', ''), 'Confirmed'),
            confirmation_status = COALESCE(NULLIF(receipt_payload->>'confirmation_status', ''), confirmation_status, 'registered'),
            updated_at          = NOW()
        WHERE id = receipt_uuid
        RETURNING id INTO inserted_receipt_id;

        IF inserted_receipt_id IS NULL THEN
            RAISE EXCEPTION 'Receipt was not found.';
        END IF;

        -- Remove old allocations; will rewrite below
        DELETE FROM public.sales_receipt_allocations WHERE receipt_id = receipt_uuid;
    ELSE
        INSERT INTO public.sales_receipts (
            receipt_number, customer_id, customer_name, invoice_id, invoice_number,
            sales_rep_id, route_id, date, payment_method, payment_reference,
            amount, notes, status, confirmation_status,
            registered_by, registered_at, created_at, updated_at
        )
        VALUES (
            receipt_payload->>'receipt_number',
            customer_uuid,
            COALESCE(receipt_payload->>'customer_name', customer_row.name),
            primary_invoice_uuid,
            primary_invoice_number,
            NULLIF(receipt_payload->>'sales_rep_id', '')::uuid,
            NULLIF(receipt_payload->>'route_id', '')::uuid,
            COALESCE(NULLIF(receipt_payload->>'date', '')::date, current_date),
            receipt_payload->>'payment_method',
            NULLIF(receipt_payload->>'payment_reference', ''),
            receipt_amount,
            receipt_payload->>'notes',
            COALESCE(NULLIF(receipt_payload->>'status', ''), 'Confirmed'),
            COALESCE(NULLIF(receipt_payload->>'confirmation_status', ''), 'registered'),
            app_user.id,
            NOW(),
            NOW(),
            NOW()
        )
        RETURNING id INTO inserted_receipt_id;
    END IF;

    -- Insert allocations (if any)
    IF allocations IS NOT NULL AND jsonb_typeof(allocations) = 'array' THEN
        FOR alloc IN SELECT * FROM jsonb_array_elements(allocations)
        LOOP
            alloc_invoice := NULLIF(alloc->>'invoice_id', '')::uuid;
            alloc_amount  := COALESCE(NULLIF(alloc->>'amount', '')::numeric, 0);

            IF alloc_invoice IS NULL OR alloc_amount <= 0 THEN
                CONTINUE;
            END IF;

            INSERT INTO public.sales_receipt_allocations (receipt_id, invoice_id, amount)
            VALUES (inserted_receipt_id, alloc_invoice, alloc_amount);

            PERFORM app_private.recompute_invoice_status(alloc_invoice);
        END LOOP;
    END IF;

    -- Journal posting (DR Cash/Bank, CR Accounts Receivable)
    PERFORM app_private.post_receipt_journal(
        receipt_payload->>'receipt_number',
        COALESCE(receipt_payload->>'customer_name', customer_row.name),
        COALESCE(primary_invoice_number, '-'),
        COALESCE(NULLIF(receipt_payload->>'date', '')::date, current_date),
        receipt_amount,
        receipt_payload->>'payment_method'
    );

    RETURN inserted_receipt_id;
END;
$$;

-- 5. Reconciliation view now joins sales_reps instead of system_users.
-- DROP first: CREATE OR REPLACE VIEW cannot rename an existing column
-- (sales_person_id -> sales_rep_id), only DROP + CREATE can.
DROP VIEW IF EXISTS public.v_sales_receipt_reconciliation;

CREATE VIEW public.v_sales_receipt_reconciliation AS
SELECT
    sr.id,
    sr.receipt_number,
    sr.date,
    sr.customer_id,
    sr.customer_name,
    sr.sales_rep_id,
    rep.name           AS sales_rep_name,
    sr.route_id,
    v.driver_name       AS route_name,
    sr.payment_method,
    sr.amount           AS amount_registered,
    COALESCE(sr.amount_collected, 0) AS amount_confirmed,
    (sr.amount - COALESCE(sr.amount_collected, 0)) AS variance,
    sr.confirmation_status,
    sr.variance_reason,
    sr.registered_by,
    sr.registered_at,
    sr.collected_by   AS confirmed_by,
    sr.collected_at   AS confirmed_at,
    sr.status         AS posting_status,
    sr.notes
FROM public.sales_receipts sr
LEFT JOIN public.sales_reps rep ON rep.id = sr.sales_rep_id
LEFT JOIN public.vans v         ON v.id  = sr.route_id;

GRANT SELECT ON public.v_sales_receipt_reconciliation TO authenticated;

NOTIFY pgrst, 'reload schema';
