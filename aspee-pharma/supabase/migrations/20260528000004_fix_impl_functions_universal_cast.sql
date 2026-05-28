-- Universal fix: cast both sides to text so this works whether
-- auth_user_id is TEXT (original) or UUID (after migration 000001).
-- auth_user_id::text = auth_user_uuid::text is safe for both column types.
-- Both sides are uuid so no cast is needed.
-- 1. Sales receipts
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
    invoice_uuid uuid;
    invoice_row record;
    receipt_amount numeric;
    total_paid_excluding_current numeric;
    total_paid numeric;
    new_invoice_status text;
    inserted_receipt_id uuid;
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

    IF coalesce(app_user.role, '') NOT IN ('Super Admin', 'Managing Director', 'Accountant', 'Sales Manager', 'Van Sales Rep') THEN
        RAISE EXCEPTION 'Insufficient permissions to post sales receipts.';
    END IF;

    receipt_uuid := nullif(receipt_payload->>'id', '')::uuid;
    invoice_uuid := nullif(receipt_payload->>'invoice_id', '')::uuid;
    receipt_amount := coalesce(nullif(receipt_payload->>'amount', '')::numeric, 0);

    IF invoice_uuid IS NULL THEN
        RAISE EXCEPTION 'Receipt must be linked to an invoice.';
    END IF;

    IF receipt_amount <= 0 THEN
        RAISE EXCEPTION 'Receipt amount must be greater than zero.';
    END IF;

    SELECT id, invoice_number, customer_name, total_amount, status
    INTO invoice_row
    FROM public.sales_invoices
    WHERE id = invoice_uuid
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Invoice was not found.';
    END IF;

    SELECT coalesce(sum(amount), 0)
    INTO total_paid_excluding_current
    FROM public.sales_receipts
    WHERE invoice_id = invoice_uuid
      AND coalesce(status, '') NOT IN ('VOID', 'Void', 'CANCELLED', 'Cancelled')
      AND (receipt_uuid IS NULL OR id <> receipt_uuid);

    IF total_paid_excluding_current + receipt_amount > coalesce(invoice_row.total_amount, 0) THEN
        RAISE EXCEPTION 'Amount exceeds outstanding balance. Outstanding %, received %.',
            greatest(coalesce(invoice_row.total_amount, 0) - total_paid_excluding_current, 0),
            receipt_amount;
    END IF;

    IF receipt_uuid IS NOT NULL THEN
        UPDATE public.sales_receipts
        SET receipt_number = receipt_payload->>'receipt_number',
            invoice_id = invoice_uuid,
            invoice_number = coalesce(receipt_payload->>'invoice_number', invoice_row.invoice_number),
            customer_name = coalesce(receipt_payload->>'customer_name', invoice_row.customer_name),
            date = coalesce(nullif(receipt_payload->>'date', '')::date, current_date),
            payment_method = receipt_payload->>'payment_method',
            payment_reference = nullif(receipt_payload->>'payment_reference', ''),
            amount = receipt_amount,
            notes = receipt_payload->>'notes',
            status = coalesce(nullif(receipt_payload->>'status', ''), 'Confirmed'),
            updated_at = now()
        WHERE id = receipt_uuid
        RETURNING id INTO inserted_receipt_id;

        IF inserted_receipt_id IS NULL THEN
            RAISE EXCEPTION 'Receipt was not found.';
        END IF;
    ELSE
        INSERT INTO public.sales_receipts (
            receipt_number, invoice_id, invoice_number, customer_name,
            date, payment_method, payment_reference, amount, notes, status,
            created_at, updated_at
        )
        VALUES (
            receipt_payload->>'receipt_number',
            invoice_uuid,
            coalesce(receipt_payload->>'invoice_number', invoice_row.invoice_number),
            coalesce(receipt_payload->>'customer_name', invoice_row.customer_name),
            coalesce(nullif(receipt_payload->>'date', '')::date, current_date),
            receipt_payload->>'payment_method',
            nullif(receipt_payload->>'payment_reference', ''),
            receipt_amount,
            receipt_payload->>'notes',
            coalesce(nullif(receipt_payload->>'status', ''), 'Confirmed'),
            now(), now()
        )
        RETURNING id INTO inserted_receipt_id;
    END IF;

    total_paid := total_paid_excluding_current + receipt_amount;
    new_invoice_status := CASE
        WHEN total_paid >= coalesce(invoice_row.total_amount, 0) THEN 'PAID'
        ELSE 'PARTIAL'
    END;

    UPDATE public.sales_invoices
    SET status = new_invoice_status, updated_at = now()
    WHERE id = invoice_uuid;

    PERFORM app_private.post_receipt_journal(
        receipt_payload->>'receipt_number',
        coalesce(receipt_payload->>'customer_name', invoice_row.customer_name),
        coalesce(receipt_payload->>'invoice_number', invoice_row.invoice_number),
        coalesce(nullif(receipt_payload->>'date', '')::date, current_date),
        receipt_amount,
        receipt_payload->>'payment_method'
    );

    RETURN inserted_receipt_id;
END;
$$;

-- 2. Sales invoices
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

    IF coalesce(app_user.role, '') NOT IN ('Super Admin', 'Managing Director', 'Sales Manager', 'Van Sales Rep') THEN
        RAISE EXCEPTION 'Insufficient permissions to post sales invoices.';
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
        SELECT route_id, status
        INTO previous_route_uuid, previous_status
        FROM public.sales_invoices
        WHERE id = invoice_uuid
        FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Invoice was not found.';
        END IF;

        was_committed := app_private.is_committed_invoice_status(previous_status);

        IF was_committed THEN
            PERFORM app_private.restore_invoice_stock(invoice_uuid, previous_route_uuid);
            DELETE FROM public.stock_movements
            WHERE reference_type = 'Sales Invoice' AND reference_id = invoice_uuid;
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

        DELETE FROM public.sales_invoice_items WHERE invoice_id = invoice_uuid;
        inserted_invoice_id := invoice_uuid;
    ELSE
        INSERT INTO public.sales_invoices (
            invoice_number, customer_name, route_id, status, date, due_date,
            type, currency, notes, total_amount, total_discount, salesperson_id,
            created_by, created_at, updated_at
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
            now(), now()
        )
        RETURNING id INTO inserted_invoice_id;
    END IF;

    FOR line IN SELECT value FROM jsonb_array_elements(item_payload)
    LOOP
        INSERT INTO public.sales_invoice_items (
            invoice_id, product_id, quantity, unit_price,
            discount_pct, discount_amount, total_price
        )
        VALUES (
            inserted_invoice_id,
            nullif(line->>'product_id', '')::uuid,
            coalesce(nullif(line->>'quantity', '')::numeric, 0),
            coalesce(nullif(line->>'unit_price', '')::numeric, 0),
            coalesce(nullif(line->>'discount_pct', '')::numeric, 0),
            coalesce(nullif(line->>'discount_amount', '')::numeric, 0),
            coalesce(nullif(line->>'total_price', '')::numeric, 0)
        );
    END LOOP;

    IF should_apply_stock THEN
        PERFORM app_private.apply_invoice_stock(
            inserted_invoice_id, route_uuid,
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

-- 3. Stock transfers (post)
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
        SELECT id, from_location_id, to_location_id
        INTO existing_transfer
        FROM public.stock_transfers
        WHERE id = transfer_uuid
        FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Transfer was not found.';
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

-- 4. Stock transfers (delete)
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

    SELECT id, from_location_id, to_location_id
    INTO transfer_row
    FROM public.stock_transfers
    WHERE id = transfer_uuid
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Transfer was not found.';
    END IF;

    PERFORM app_private.reverse_stock_transfer_effects(
        transfer_row.id, transfer_row.from_location_id, transfer_row.to_location_id
    );

    DELETE FROM public.stock_transfers WHERE id = transfer_row.id;
END;
$$;

-- 5. GRN posting
CREATE OR REPLACE FUNCTION app_private.post_grn_impl(
    auth_user_uuid uuid,
    auth_email text,
    grn_payload jsonb,
    item_payload jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app_private
AS $$
DECLARE
    app_user record;
    grn_uuid uuid;
    inserted_grn_id uuid;
    main_store_id uuid;
    line record;
    header_approved boolean;
    was_already_approved boolean;
    po_uuid uuid;
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

    IF app_user.id IS NULL THEN RAISE EXCEPTION 'System user profile not found.'; END IF;
    IF app_user.status <> 'Active' THEN RAISE EXCEPTION 'Account is inactive.'; END IF;
    IF app_user.role NOT IN ('Super Admin', 'Managing Director', 'Store Manager', 'Purchasing Manager') THEN
        RAISE EXCEPTION 'Insufficient permissions to post GRN.';
    END IF;

    grn_uuid := nullif(grn_payload->>'id', '')::uuid;
    po_uuid := nullif(grn_payload->>'po_id', '')::uuid;
    header_approved := (grn_payload->>'qa_status' = 'Approved');

    SELECT id INTO main_store_id
    FROM public.stock_locations
    WHERE name IN ('Main Warehouse', 'Main Store', 'Raw Materials Store')
    ORDER BY CASE name WHEN 'Main Warehouse' THEN 0 WHEN 'Main Store' THEN 1 ELSE 2 END
    LIMIT 1;

    IF main_store_id IS NULL THEN
        RAISE EXCEPTION 'Main Warehouse location not found.';
    END IF;

    IF grn_uuid IS NOT NULL THEN
        SELECT qa_status = 'Approved' INTO was_already_approved
        FROM public.grn WHERE id = grn_uuid FOR UPDATE;

        PERFORM app_private.reverse_grn_stock_effects(grn_uuid);

        UPDATE public.grn SET
            grn_number = grn_payload->>'grn_number',
            po_id = po_uuid,
            received_date = coalesce(nullif(grn_payload->>'received_date', '')::date, current_date),
            status = coalesce(nullif(grn_payload->>'status', ''), 'Confirmed'),
            qa_status = grn_payload->>'qa_status',
            qa_inspector = nullif(grn_payload->>'qa_inspector', ''),
            qa_date = nullif(grn_payload->>'qa_date', '')::date,
            goods_condition = coalesce(nullif(grn_payload->>'goods_condition', ''), 'Good'),
            qa_remarks = nullif(grn_payload->>'qa_remarks', ''),
            notes = grn_payload->>'notes',
            updated_at = now()
        WHERE id = grn_uuid;

        DELETE FROM public.grn_items WHERE grn_id = grn_uuid;
        inserted_grn_id := grn_uuid;
    ELSE
        INSERT INTO public.grn (
            grn_number, po_id, received_date, status, qa_status,
            qa_inspector, qa_date, goods_condition, qa_remarks, notes, created_by
        ) VALUES (
            grn_payload->>'grn_number', po_uuid,
            coalesce(nullif(grn_payload->>'received_date', '')::date, current_date),
            coalesce(nullif(grn_payload->>'status', ''), 'Confirmed'),
            grn_payload->>'qa_status',
            nullif(grn_payload->>'qa_inspector', ''),
            nullif(grn_payload->>'qa_date', '')::date,
            coalesce(nullif(grn_payload->>'goods_condition', ''), 'Good'),
            nullif(grn_payload->>'qa_remarks', ''),
            grn_payload->>'notes',
            app_user.id
        ) RETURNING id INTO inserted_grn_id;
    END IF;

    FOR line IN SELECT * FROM jsonb_to_recordset(item_payload) AS x(
        product_id uuid, quantity_received numeric, batch_no text,
        expiry_date date, po_item_id uuid, qa_status text
    ) LOOP
        DECLARE
            item_status text;
        BEGIN
            item_status := CASE
                WHEN header_approved AND line.qa_status NOT IN ('Rejected', 'Quarantine') THEN 'Approved'
                ELSE coalesce(line.qa_status, 'Pending')
            END;

            INSERT INTO public.grn_items (
                grn_id, product_id, quantity_received, batch_no, expiry_date, po_item_id, qa_status
            ) VALUES (
                inserted_grn_id, line.product_id, line.quantity_received,
                line.batch_no, line.expiry_date, line.po_item_id, item_status
            );

            IF item_status = 'Approved' AND line.quantity_received > 0 THEN
                INSERT INTO public.stock_levels (
                    product_id, location_id, batch_number, expiry_date, qty_on_hand, updated_at
                )
                VALUES (
                    line.product_id, main_store_id,
                    coalesce(line.batch_no, 'N/A'), line.expiry_date, line.quantity_received, now()
                )
                ON CONFLICT (product_id, location_id, batch_number) DO UPDATE
                SET qty_on_hand = stock_levels.qty_on_hand + EXCLUDED.qty_on_hand,
                    expiry_date = coalesce(EXCLUDED.expiry_date, stock_levels.expiry_date),
                    updated_at = now();

                INSERT INTO public.stock_movements (
                    product_id, movement_type, quantity, reference_type, reference_id,
                    batch_number, expiry_date, notes
                ) VALUES (
                    line.product_id, 'IN', line.quantity_received, 'GRN', inserted_grn_id,
                    line.batch_no, line.expiry_date, 'GRN Approved: ' || (grn_payload->>'grn_number')
                );
            END IF;
        END;
    END LOOP;

    IF po_uuid IS NOT NULL THEN
        PERFORM app_private.update_po_status_from_grns(po_uuid);
    END IF;

    RETURN inserted_grn_id;
END;
$$;

-- 6. Material request issuance
CREATE OR REPLACE FUNCTION app_private.issue_material_request_impl(
    auth_user_uuid uuid,
    auth_email text,
    request_uuid uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app_private
AS $$
DECLARE
    app_user record;
    request_row record;
    main_store_id uuid;
    requested_product record;
    batch_row record;
    qty_remaining numeric;
    qty_to_take numeric;
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

    IF coalesce(app_user.role, '') NOT IN ('Super Admin', 'Managing Director', 'Store Manager', 'Production Manager') THEN
        RAISE EXCEPTION 'Insufficient permissions to issue material requests.';
    END IF;

    SELECT * INTO request_row
    FROM public.material_requests
    WHERE id = request_uuid
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Material request was not found.';
    END IF;

    IF coalesce(request_row.status, '') <> 'Pending' THEN
        RAISE EXCEPTION 'Only pending material requests can be issued.';
    END IF;

    SELECT id INTO main_store_id
    FROM public.stock_locations
    WHERE lower(name) = 'main warehouse'
    LIMIT 1;

    IF main_store_id IS NULL THEN
        RAISE EXCEPTION 'Main Warehouse location was not found in stock_locations.';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.material_request_items WHERE request_id = request_uuid
    ) THEN
        RAISE EXCEPTION 'No items found in this material request.';
    END IF;

    FOR requested_product IN
        SELECT
            mri.product_id,
            coalesce(p.name, 'Product') AS product_name,
            sum(coalesce(mri.quantity_requested, 0)) AS quantity_requested
        FROM public.material_request_items mri
        LEFT JOIN public.products p ON p.id = mri.product_id
        WHERE mri.request_id = request_uuid
        GROUP BY mri.product_id, p.name
    LOOP
        IF requested_product.product_id IS NULL OR requested_product.quantity_requested <= 0 THEN
            RAISE EXCEPTION 'Each material request item must have a product and quantity greater than zero.';
        END IF;

        WITH locked_stock AS (
            SELECT coalesce(qty_on_hand, 0) AS qty_on_hand
            FROM public.stock_levels
            WHERE product_id = requested_product.product_id AND location_id = main_store_id
            FOR UPDATE
        )
        SELECT coalesce(sum(qty_on_hand), 0) INTO qty_remaining FROM locked_stock;

        IF coalesce(qty_remaining, 0) < requested_product.quantity_requested THEN
            RAISE EXCEPTION 'Insufficient stock for %. Available %, requested %.',
                requested_product.product_name,
                coalesce(qty_remaining, 0),
                requested_product.quantity_requested;
        END IF;
    END LOOP;

    FOR requested_product IN
        SELECT mri.product_id, sum(coalesce(mri.quantity_requested, 0)) AS quantity_requested
        FROM public.material_request_items mri
        WHERE mri.request_id = request_uuid
        GROUP BY mri.product_id
    LOOP
        qty_remaining := requested_product.quantity_requested;

        FOR batch_row IN
            SELECT id, batch_number, expiry_date, coalesce(qty_on_hand, 0) AS qty_on_hand
            FROM public.stock_levels
            WHERE product_id = requested_product.product_id
              AND location_id = main_store_id
              AND coalesce(qty_on_hand, 0) > 0
            ORDER BY expiry_date ASC NULLS LAST, created_at ASC NULLS LAST, id
            FOR UPDATE
        LOOP
            EXIT WHEN qty_remaining <= 0;

            qty_to_take := least(batch_row.qty_on_hand, qty_remaining);

            UPDATE public.stock_levels
            SET qty_on_hand = batch_row.qty_on_hand - qty_to_take, updated_at = now()
            WHERE id = batch_row.id;

            INSERT INTO public.stock_movements (
                product_id, movement_type, quantity, reference_type, reference_id,
                batch_number, expiry_date, notes, created_by, created_at
            )
            VALUES (
                requested_product.product_id, 'OUT', qty_to_take,
                'Material Request', request_uuid,
                batch_row.batch_number, batch_row.expiry_date,
                'Issued to Production (Req: ' || coalesce(request_row.request_number, '-') || ')',
                app_user.id, now()
            );

            qty_remaining := qty_remaining - qty_to_take;
        END LOOP;

        IF qty_remaining > 0 THEN
            RAISE EXCEPTION 'Material request stock issue could not be completed.';
        END IF;
    END LOOP;

    UPDATE public.material_request_items
    SET quantity_issued = quantity_requested
    WHERE request_id = request_uuid;

    UPDATE public.material_requests
    SET status = 'Issued', updated_at = now()
    WHERE id = request_uuid;
END;
$$;
