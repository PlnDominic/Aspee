-- ============================================================================
-- Companion to 20260927000000_user_module_permissions.sql: the RESTRICTIVE
-- table policies that migration adds cannot see writes made by these four
-- SECURITY DEFINER RPCs, because a SECURITY DEFINER function's internal
-- UPDATE/DELETE statements run under the function owner's privileges, not
-- the calling user's — RLS on the underlying table does not see the calling
-- user's row at all in that case. The only place left to put the module
-- access + edit-window check is inside each function's own body, exactly
-- where every other authorization check in these functions already lives
-- (the role whitelist a few lines above each one below).
--
-- Bodies are otherwise byte-for-byte the latest applied version of each
-- function:
--   post_sales_invoice_impl   <- 20260910010000_persist_invoice_returns_cash_credit.sql
--   post_stock_transfer_impl,
--   delete_stock_transfer_impl <- 20260528000004_fix_impl_functions_universal_cast.sql
--   post_sales_receipt_impl   <- 20260731090000_sales_reps_roster.sql
--   delete_sales_receipt_impl <- 20260731100000_delete_sales_receipt_rpc.sql
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Sales Invoices
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION app_private.post_sales_invoice_impl(
    auth_user_uuid uuid,
    auth_email text,
    invoice_payload jsonb,
    item_payload jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app_private
AS $$
DECLARE
    app_user record;
    invoice_uuid uuid;
    previous_route_uuid uuid;
    previous_status text;
    previous_date date;
    was_committed boolean;
    should_apply_stock boolean;
    normalized_status text;
    route_uuid uuid;
    salesperson_uuid uuid;
    inserted_invoice_id uuid;
    line jsonb;
BEGIN
    IF auth_user_uuid IS NULL THEN
        RAISE EXCEPTION 'Authentication required.';
    END IF;

    SELECT id, role, status
    INTO app_user
    FROM public.system_users
    WHERE auth_user_id = auth_user_uuid
       OR lower(email) = lower(coalesce(auth_email, ''))
    ORDER BY CASE WHEN auth_user_id = auth_user_uuid THEN 0 ELSE 1 END
    LIMIT 1;

    IF app_user.id IS NULL THEN
        RAISE EXCEPTION 'System user profile was not found.';
    END IF;

    IF app_user.status IS NOT NULL AND app_user.status <> 'Active' THEN
        RAISE EXCEPTION 'Your account is inactive.';
    END IF;

    IF coalesce(app_user.role, '') NOT IN ('Super Admin', 'Managing Director', 'Sales Manager', 'Van Sales Rep') THEN
        RAISE EXCEPTION 'Insufficient permissions to post sales invoices.';
    END IF;

    IF NOT app_private.can_edit_module('sales') THEN
        RAISE EXCEPTION 'Your access to Sales is view-only.';
    END IF;

    IF coalesce(jsonb_array_length(item_payload), 0) = 0 THEN
        RAISE EXCEPTION 'Invoice must contain at least one item.';
    END IF;

    normalized_status := app_private.normalize_invoice_status(invoice_payload->>'status');
    should_apply_stock := app_private.is_committed_invoice_status(normalized_status);
    invoice_uuid := nullif(invoice_payload->>'id', '')::uuid;
    route_uuid := nullif(invoice_payload->>'route_id', '')::uuid;
    salesperson_uuid := coalesce(nullif(invoice_payload->>'salesperson_id', '')::uuid, app_user.id);

    IF should_apply_stock AND route_uuid IS NULL THEN
        RAISE EXCEPTION 'A route/van is required before this invoice can be issued.';
    END IF;

    IF invoice_uuid IS NOT NULL THEN
        SELECT route_id, status, date
        INTO previous_route_uuid, previous_status, previous_date
        FROM public.sales_invoices
        WHERE id = invoice_uuid
        FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Invoice was not found.';
        END IF;

        IF NOT app_private.within_edit_window(previous_date) THEN
            RAISE EXCEPTION 'This invoice is outside your %-day edit window and can no longer be changed.',
                coalesce(app_private.edit_window_days_for_role(app_user.role), 0);
        END IF;

        was_committed := app_private.is_committed_invoice_status(previous_status);

        IF was_committed THEN
            PERFORM app_private.restore_invoice_stock(invoice_uuid, previous_route_uuid);

            DELETE FROM public.stock_movements
            WHERE reference_type = 'Sales Invoice'
              AND reference_id = invoice_uuid;
        END IF;

        UPDATE public.sales_invoices
        SET invoice_number = invoice_payload->>'invoice_number',
            customer_name = invoice_payload->>'customer_name',
            route_id = route_uuid,
            status = normalized_status,
            date = coalesce(nullif(invoice_payload->>'date', '')::date, current_date),
            due_date = nullif(invoice_payload->>'due_date', '')::date,
            type = invoice_payload->>'type',
            currency = coalesce(nullif(invoice_payload->>'currency', ''), 'GHS'),
            notes = invoice_payload->>'notes',
            total_amount = coalesce(nullif(invoice_payload->>'total_amount', '')::numeric, 0),
            total_discount = coalesce(nullif(invoice_payload->>'total_discount', '')::numeric, 0),
            salesperson_id = salesperson_uuid,
            updated_at = now()
        WHERE id = invoice_uuid;

        DELETE FROM public.sales_invoice_items
        WHERE invoice_id = invoice_uuid;

        inserted_invoice_id := invoice_uuid;
    ELSE
        INSERT INTO public.sales_invoices (
            invoice_number,
            customer_name,
            route_id,
            status,
            date,
            due_date,
            type,
            currency,
            notes,
            total_amount,
            total_discount,
            salesperson_id,
            created_by,
            created_at,
            updated_at
        )
        VALUES (
            invoice_payload->>'invoice_number',
            invoice_payload->>'customer_name',
            route_uuid,
            normalized_status,
            coalesce(nullif(invoice_payload->>'date', '')::date, current_date),
            nullif(invoice_payload->>'due_date', '')::date,
            invoice_payload->>'type',
            coalesce(nullif(invoice_payload->>'currency', ''), 'GHS'),
            invoice_payload->>'notes',
            coalesce(nullif(invoice_payload->>'total_amount', '')::numeric, 0),
            coalesce(nullif(invoice_payload->>'total_discount', '')::numeric, 0),
            salesperson_uuid,
            app_user.id,
            now(),
            now()
        )
        RETURNING id INTO inserted_invoice_id;
    END IF;

    FOR line IN SELECT value FROM jsonb_array_elements(item_payload)
    LOOP
        INSERT INTO public.sales_invoice_items (
            invoice_id,
            product_id,
            quantity,
            unit_price,
            discount_pct,
            discount_amount,
            total_price,
            batch_number,
            cash_sale,
            credit_sale,
            returns_qty
        )
        VALUES (
            inserted_invoice_id,
            nullif(line->>'product_id', '')::uuid,
            coalesce(nullif(line->>'quantity', '')::numeric, 0),
            coalesce(nullif(line->>'unit_price', '')::numeric, 0),
            coalesce(nullif(line->>'discount_pct', '')::numeric, 0),
            coalesce(nullif(line->>'discount_amount', '')::numeric, 0),
            coalesce(nullif(line->>'total_price', '')::numeric, 0),
            nullif(line->>'batch_number', ''),
            coalesce(nullif(line->>'cash_sale', '')::numeric, 0),
            coalesce(nullif(line->>'credit_sale', '')::numeric, 0),
            coalesce(nullif(line->>'returns_qty', '')::numeric, 0)
        );
    END LOOP;

    IF should_apply_stock THEN
        PERFORM app_private.apply_invoice_stock(
            inserted_invoice_id,
            route_uuid,
            invoice_payload->>'customer_name',
            invoice_payload->>'invoice_number',
            item_payload
        );

        PERFORM app_private.post_invoice_journal(
            invoice_payload->>'invoice_number',
            invoice_payload->>'customer_name',
            coalesce(nullif(invoice_payload->>'date', '')::date, current_date),
            coalesce(nullif(invoice_payload->>'total_amount', '')::numeric, 0)
        );
    END IF;

    RETURN inserted_invoice_id;
END;
$$;

-- ----------------------------------------------------------------------------
-- Stock Transfers
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION app_private.post_stock_transfer_impl(
    auth_user_uuid uuid,
    auth_email text,
    transfer_payload jsonb,
    item_payload jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app_private
AS $$
DECLARE
    app_user record;
    transfer_uuid uuid;
    inserted_transfer_id uuid;
    from_location_uuid uuid;
    to_location_uuid uuid;
    transfer_label text;
    existing_transfer record;
    line record;
BEGIN
    IF auth_user_uuid IS NULL THEN
        RAISE EXCEPTION 'Authentication required.';
    END IF;

    SELECT id, role, status
    INTO app_user
    FROM public.system_users
    WHERE auth_user_id::text = auth_user_uuid::text
       OR lower(email) = lower(coalesce(auth_email, ''))
    ORDER BY CASE WHEN auth_user_id::text = auth_user_uuid::text THEN 0 ELSE 1 END
    LIMIT 1;

    IF app_user.id IS NULL THEN
        RAISE EXCEPTION 'System user profile was not found.';
    END IF;

    IF app_user.status IS NOT NULL AND app_user.status <> 'Active' THEN
        RAISE EXCEPTION 'Your account is inactive.';
    END IF;

    IF coalesce(app_user.role, '') NOT IN ('Super Admin', 'Managing Director', 'Store Manager', 'Sales Manager') THEN
        RAISE EXCEPTION 'Insufficient permissions to post stock transfers.';
    END IF;

    IF NOT app_private.can_edit_module('stores') THEN
        RAISE EXCEPTION 'Your access to Stores is view-only.';
    END IF;

    IF coalesce(jsonb_array_length(item_payload), 0) = 0 THEN
        RAISE EXCEPTION 'Transfer must contain at least one item.';
    END IF;

    transfer_uuid := nullif(transfer_payload->>'id', '')::uuid;
    from_location_uuid := nullif(transfer_payload->>'from_location_id', '')::uuid;
    to_location_uuid := nullif(transfer_payload->>'to_location_id', '')::uuid;
    transfer_label := transfer_payload->>'transfer_number';

    IF from_location_uuid IS NULL OR to_location_uuid IS NULL THEN
        RAISE EXCEPTION 'Transfer source and destination are required.';
    END IF;

    PERFORM app_private.validate_stock_transfer_flow(from_location_uuid, to_location_uuid);

    IF transfer_uuid IS NOT NULL THEN
        SELECT id, from_location_id, to_location_id, created_at
        INTO existing_transfer
        FROM public.stock_transfers
        WHERE id = transfer_uuid
        FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Transfer was not found.';
        END IF;

        IF NOT app_private.within_edit_window(existing_transfer.created_at) THEN
            RAISE EXCEPTION 'This transfer is outside your %-day edit window and can no longer be changed.',
                coalesce(app_private.edit_window_days_for_role(app_user.role), 0);
        END IF;

        PERFORM app_private.reverse_stock_transfer_effects(
            transfer_uuid, existing_transfer.from_location_id, existing_transfer.to_location_id
        );

        UPDATE public.stock_transfers
        SET transfer_number = transfer_label,
            from_location_id = from_location_uuid,
            to_location_id = to_location_uuid,
            status = coalesce(nullif(transfer_payload->>'status', ''), status),
            notes = transfer_payload->>'notes',
            updated_at = now()
        WHERE id = transfer_uuid;

        DELETE FROM public.stock_transfer_items WHERE transfer_id = transfer_uuid;
        inserted_transfer_id := transfer_uuid;
    ELSE
        INSERT INTO public.stock_transfers (
            transfer_number, from_location_id, to_location_id, status, notes, created_at, updated_at
        )
        VALUES (
            transfer_label, from_location_uuid, to_location_uuid,
            coalesce(nullif(transfer_payload->>'status', ''), 'Completed'),
            transfer_payload->>'notes', now(), now()
        )
        RETURNING id INTO inserted_transfer_id;
    END IF;

    FOR line IN
        SELECT
            nullif(value->>'product_id', '')::uuid AS product_id,
            sum(coalesce(nullif(value->>'quantity', '')::numeric, 0)) AS quantity
        FROM jsonb_array_elements(item_payload)
        GROUP BY nullif(value->>'product_id', '')::uuid
    LOOP
        IF line.product_id IS NULL OR line.quantity <= 0 THEN
            RAISE EXCEPTION 'Each transfer item must have a product and quantity greater than zero.';
        END IF;

        INSERT INTO public.stock_transfer_items (transfer_id, product_id, quantity, created_at)
        VALUES (inserted_transfer_id, line.product_id, line.quantity::integer, now());
    END LOOP;

    PERFORM app_private.apply_stock_transfer_effects(
        inserted_transfer_id, transfer_label, from_location_uuid, to_location_uuid, item_payload
    );

    RETURN inserted_transfer_id;
END;
$$;

CREATE OR REPLACE FUNCTION app_private.delete_stock_transfer_impl(
    auth_user_uuid uuid,
    auth_email text,
    transfer_uuid uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app_private
AS $$
DECLARE
    app_user record;
    transfer_row record;
BEGIN
    IF auth_user_uuid IS NULL THEN
        RAISE EXCEPTION 'Authentication required.';
    END IF;

    SELECT id, role, status
    INTO app_user
    FROM public.system_users
    WHERE auth_user_id::text = auth_user_uuid::text
       OR lower(email) = lower(coalesce(auth_email, ''))
    ORDER BY CASE WHEN auth_user_id::text = auth_user_uuid::text THEN 0 ELSE 1 END
    LIMIT 1;

    IF app_user.id IS NULL THEN
        RAISE EXCEPTION 'System user profile was not found.';
    END IF;

    IF app_user.status IS NOT NULL AND app_user.status <> 'Active' THEN
        RAISE EXCEPTION 'Your account is inactive.';
    END IF;

    IF coalesce(app_user.role, '') NOT IN ('Super Admin', 'Managing Director', 'Store Manager', 'Sales Manager') THEN
        RAISE EXCEPTION 'Insufficient permissions to delete stock transfers.';
    END IF;

    IF NOT app_private.can_edit_module('stores') THEN
        RAISE EXCEPTION 'Your access to Stores is view-only.';
    END IF;

    SELECT id, from_location_id, to_location_id, created_at
    INTO transfer_row
    FROM public.stock_transfers
    WHERE id = transfer_uuid
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Transfer was not found.';
    END IF;

    IF NOT app_private.within_edit_window(transfer_row.created_at) THEN
        RAISE EXCEPTION 'This transfer is outside your %-day edit window and can no longer be deleted.',
            coalesce(app_private.edit_window_days_for_role(app_user.role), 0);
    END IF;

    PERFORM app_private.reverse_stock_transfer_effects(
        transfer_row.id, transfer_row.from_location_id, transfer_row.to_location_id
    );

    DELETE FROM public.stock_transfers WHERE id = transfer_row.id;
END;
$$;

-- ----------------------------------------------------------------------------
-- Sales Receipts
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION app_private.post_sales_receipt_impl(
    auth_user_uuid uuid,
    auth_email text,
    receipt_payload jsonb,
    allocations jsonb
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
    confirmation_status text;
    inserted_receipt_id uuid;
    primary_invoice_uuid uuid;
    primary_invoice_number text;
    alloc jsonb;
    alloc_invoice uuid;
    alloc_amount numeric;
    alloc_total numeric := 0;
    invoice_total numeric;
    existing_allocated numeric;
    previous_date date;
BEGIN
    IF auth_user_uuid IS NULL THEN
        RAISE EXCEPTION 'Authentication required.';
    END IF;

    SELECT id, role, status
    INTO app_user
    FROM public.system_users
    WHERE auth_user_id = auth_user_uuid
       OR lower(email) = lower(coalesce(auth_email, ''))
    ORDER BY CASE WHEN auth_user_id = auth_user_uuid THEN 0 ELSE 1 END
    LIMIT 1;

    IF app_user.id IS NULL THEN
        RAISE EXCEPTION 'System user profile was not found.';
    END IF;

    IF app_user.status IS NOT NULL AND app_user.status <> 'Active' THEN
        RAISE EXCEPTION 'Your account is inactive.';
    END IF;

    IF coalesce(app_user.role, '') NOT IN (
        'Super Admin', 'Managing Director', 'Accountant', 'Sales Manager', 'Van Sales Rep'
    ) THEN
        RAISE EXCEPTION 'Insufficient permissions to post sales receipts.';
    END IF;

    IF NOT app_private.can_edit_module('sales') THEN
        RAISE EXCEPTION 'Your access to Sales is view-only.';
    END IF;

    receipt_uuid := nullif(receipt_payload->>'id', '')::uuid;
    customer_uuid := nullif(receipt_payload->>'customer_id', '')::uuid;
    receipt_amount := coalesce(nullif(receipt_payload->>'amount', '')::numeric, 0);
    confirmation_status := nullif(receipt_payload->>'confirmation_status', '');

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
        SELECT date INTO previous_date
        FROM public.sales_receipts
        WHERE id = receipt_uuid
        FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Receipt was not found.';
        END IF;

        IF NOT app_private.within_edit_window(previous_date) THEN
            RAISE EXCEPTION 'This receipt is outside your %-day edit window and can no longer be changed.',
                coalesce(app_private.edit_window_days_for_role(app_user.role), 0);
        END IF;

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

CREATE OR REPLACE FUNCTION app_private.delete_sales_receipt_impl(
    auth_user_uuid uuid,
    auth_email text,
    receipt_uuid uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app_private
AS $$
DECLARE
    app_user record;
    receipt_row record;
    affected_invoice_ids uuid[];
    inv_id uuid;
BEGIN
    IF auth_user_uuid IS NULL THEN
        RAISE EXCEPTION 'Authentication required.';
    END IF;

    SELECT id, role, status
    INTO app_user
    FROM public.system_users
    WHERE auth_user_id = auth_user_uuid
       OR lower(email) = lower(coalesce(auth_email, ''))
    ORDER BY CASE WHEN auth_user_id = auth_user_uuid THEN 0 ELSE 1 END
    LIMIT 1;

    IF app_user.id IS NULL THEN
        RAISE EXCEPTION 'System user profile was not found.';
    END IF;

    IF app_user.status IS NOT NULL AND app_user.status <> 'Active' THEN
        RAISE EXCEPTION 'Your account is inactive.';
    END IF;

    IF coalesce(app_user.role, '') NOT IN (
        'Super Admin', 'Managing Director', 'Accountant', 'Sales Manager', 'Van Sales Rep'
    ) THEN
        RAISE EXCEPTION 'Insufficient permissions to delete sales receipts.';
    END IF;

    IF NOT app_private.can_edit_module('sales') THEN
        RAISE EXCEPTION 'Your access to Sales is view-only.';
    END IF;

    SELECT id, receipt_number, invoice_id, confirmation_status, date
    INTO receipt_row
    FROM public.sales_receipts
    WHERE id = receipt_uuid
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Receipt was not found.';
    END IF;

    IF NOT app_private.within_edit_window(receipt_row.date) THEN
        RAISE EXCEPTION 'This receipt is outside your %-day edit window and can no longer be deleted.',
            coalesce(app_private.edit_window_days_for_role(app_user.role), 0);
    END IF;

    -- Once Accounts has confirmed the cash, only Accounts can undo it.
    IF receipt_row.confirmation_status = 'confirmed'
       AND coalesce(app_user.role, '') NOT IN ('Super Admin', 'Managing Director', 'Accountant') THEN
        RAISE EXCEPTION 'This receipt has been confirmed by Accounts — only an Accounts user can delete it.';
    END IF;

    -- Capture affected invoices before the cascade-delete removes the
    -- allocation rows, so their PAID/PARTIAL status can be recomputed after.
    SELECT array_agg(DISTINCT invoice_id) INTO affected_invoice_ids
    FROM public.sales_receipt_allocations
    WHERE receipt_id = receipt_row.id;

    IF receipt_row.invoice_id IS NOT NULL THEN
        affected_invoice_ids := array_append(coalesce(affected_invoice_ids, ARRAY[]::uuid[]), receipt_row.invoice_id);
    END IF;

    -- Reverse the GL entry this receipt posted, if any.
    DELETE FROM public.journal_entries
    WHERE notes = 'Auto-posted from Sales Receipt ' || receipt_row.receipt_number;

    -- sales_receipt_allocations cascade-deletes with the receipt.
    DELETE FROM public.sales_receipts WHERE id = receipt_row.id;

    IF affected_invoice_ids IS NOT NULL THEN
        FOREACH inv_id IN ARRAY affected_invoice_ids LOOP
            PERFORM app_private.recompute_invoice_status(inv_id);
        END LOOP;
    END IF;
END;
$$;
