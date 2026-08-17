-- Wires the existing sales_invoice_items.batch_number column (added in
-- 20260331130745_complete_sales_system.sql) into the invoice posting RPC,
-- so batch numbers entered on the invoice line items are actually persisted.
-- Column already exists; this migration only updates the function body.

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
            batch_number
        )
        VALUES (
            inserted_invoice_id,
            nullif(line->>'product_id', '')::uuid,
            coalesce(nullif(line->>'quantity', '')::numeric, 0),
            coalesce(nullif(line->>'unit_price', '')::numeric, 0),
            coalesce(nullif(line->>'discount_pct', '')::numeric, 0),
            coalesce(nullif(line->>'discount_amount', '')::numeric, 0),
            coalesce(nullif(line->>'total_price', '')::numeric, 0),
            nullif(line->>'batch_number', '')
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

REVOKE ALL ON FUNCTION app_private.post_sales_invoice_impl(uuid, text, jsonb, jsonb) FROM PUBLIC;
GRANT USAGE ON SCHEMA app_private TO authenticated;
GRANT EXECUTE ON FUNCTION app_private.post_sales_invoice_impl(uuid, text, jsonb, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.post_sales_invoice(jsonb, jsonb) TO authenticated;
