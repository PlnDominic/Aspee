-- ============================================================
-- Migration: Customer-centric receipt posting RPC
--
-- post_sales_receipt now:
--   - requires customer_id
--   - accepts optional allocations array [{invoice_id, amount}]
--   - derives each invoice's PAID/PARTIAL status from allocations
--
-- Adds confirm_sales_receipt(receipt_id, amount_confirmed, variance_reason)
-- for the Accounts confirmation step.
-- ============================================================

CREATE OR REPLACE FUNCTION app_private.recompute_invoice_status(invoice_uuid uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app_private
AS $$
DECLARE
    inv_total numeric;
    allocated numeric;
    new_status text;
BEGIN
    SELECT total_amount INTO inv_total
    FROM public.sales_invoices
    WHERE id = invoice_uuid;

    IF NOT FOUND THEN
        RETURN;
    END IF;

    SELECT COALESCE(SUM(a.amount), 0)
    INTO allocated
    FROM public.sales_receipt_allocations a
    JOIN public.sales_receipts r ON r.id = a.receipt_id
    WHERE a.invoice_id = invoice_uuid
      AND COALESCE(r.status, '') NOT IN ('VOID', 'Void', 'CANCELLED', 'Cancelled');

    new_status := CASE
        WHEN allocated <= 0 THEN 'UNPAID'
        WHEN allocated >= COALESCE(inv_total, 0) THEN 'PAID'
        ELSE 'PARTIAL'
    END;

    UPDATE public.sales_invoices
    SET status = new_status,
        updated_at = NOW()
    WHERE id = invoice_uuid;
END;
$$;

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
            sales_person_id     = NULLIF(receipt_payload->>'sales_person_id', '')::uuid,
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
            sales_person_id, route_id, date, payment_method, payment_reference,
            amount, notes, status, confirmation_status,
            registered_by, registered_at, created_at, updated_at
        )
        VALUES (
            receipt_payload->>'receipt_number',
            customer_uuid,
            COALESCE(receipt_payload->>'customer_name', customer_row.name),
            primary_invoice_uuid,
            primary_invoice_number,
            NULLIF(receipt_payload->>'sales_person_id', '')::uuid,
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

-- ---- confirm_sales_receipt: the Accounts confirmation step ----

CREATE OR REPLACE FUNCTION app_private.confirm_sales_receipt_impl(
    auth_user_uuid uuid,
    auth_email text,
    receipt_uuid uuid,
    amount_confirmed numeric,
    variance_reason_in text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app_private
AS $$
DECLARE
    app_user record;
    receipt_row record;
    new_status text;
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

    IF COALESCE(app_user.role, '') NOT IN ('Super Admin', 'Managing Director', 'Accountant') THEN
        RAISE EXCEPTION 'Only Accounts users can confirm cash receipts.';
    END IF;

    SELECT id, amount, confirmation_status INTO receipt_row
    FROM public.sales_receipts
    WHERE id = receipt_uuid
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Receipt was not found.';
    END IF;

    IF amount_confirmed < 0 THEN
        RAISE EXCEPTION 'Confirmed amount cannot be negative.';
    END IF;

    new_status := CASE
        WHEN abs(amount_confirmed - COALESCE(receipt_row.amount, 0)) < 0.01 THEN 'confirmed'
        ELSE 'variance'
    END;

    UPDATE public.sales_receipts
    SET amount_collected     = amount_confirmed,
        collected_by         = app_user.id,
        collected_at         = NOW(),
        confirmation_status  = new_status,
        variance_reason      = CASE WHEN new_status = 'variance' THEN variance_reason_in ELSE NULL END,
        status               = CASE WHEN new_status = 'confirmed' THEN 'Cleared' ELSE status END,
        updated_at           = NOW()
    WHERE id = receipt_uuid;

    RETURN receipt_uuid;
END;
$$;

CREATE OR REPLACE FUNCTION public.confirm_sales_receipt(
    receipt_uuid uuid,
    amount_confirmed numeric,
    variance_reason_in text DEFAULT NULL
)
RETURNS uuid
LANGUAGE sql
SECURITY INVOKER
SET search_path = public, app_private
AS $$
    SELECT app_private.confirm_sales_receipt_impl(
        auth.uid(),
        lower(COALESCE(auth.jwt() ->> 'email', '')),
        receipt_uuid,
        amount_confirmed,
        variance_reason_in
    );
$$;

REVOKE ALL ON FUNCTION app_private.confirm_sales_receipt_impl(uuid, text, uuid, numeric, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.confirm_sales_receipt_impl(uuid, text, uuid, numeric, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_sales_receipt(uuid, numeric, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
