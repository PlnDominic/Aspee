CREATE SCHEMA IF NOT EXISTS app_private;

CREATE UNIQUE INDEX IF NOT EXISTS idx_stock_locations_name ON public.stock_locations (name);

ALTER TABLE public.sales_invoices
    ADD COLUMN IF NOT EXISTS customer_name text,
    ADD COLUMN IF NOT EXISTS date date DEFAULT current_date,
    ADD COLUMN IF NOT EXISTS type text,
    ADD COLUMN IF NOT EXISTS currency text DEFAULT 'GHS',
    ADD COLUMN IF NOT EXISTS total_discount numeric DEFAULT 0,
    ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

ALTER TABLE public.sales_invoice_items
    ADD COLUMN IF NOT EXISTS discount_pct numeric DEFAULT 0,
    ADD COLUMN IF NOT EXISTS discount_amount numeric DEFAULT 0;

ALTER TABLE public.stock_levels
    ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

CREATE OR REPLACE FUNCTION app_private.normalize_invoice_status(status_value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT CASE upper(regexp_replace(coalesce(status_value, 'DRAFT'), '\s+', ' ', 'g'))
        WHEN 'PARTIALLY PAID' THEN 'PARTIAL'
        WHEN '' THEN 'DRAFT'
        ELSE upper(regexp_replace(coalesce(status_value, 'DRAFT'), '\s+', ' ', 'g'))
    END;
$$;

CREATE OR REPLACE FUNCTION app_private.is_committed_invoice_status(status_value text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT app_private.normalize_invoice_status(status_value) IN ('ISSUED', 'PAID', 'PARTIAL', 'OVERDUE');
$$;

CREATE OR REPLACE FUNCTION app_private.get_or_create_van_stock_location(van_uuid uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app_private
AS $$
DECLARE
    van_code text;
    location_name text;
    location_uuid uuid;
BEGIN
    SELECT v.van_id
    INTO van_code
    FROM public.vans v
    WHERE v.id = van_uuid;

    IF van_code IS NULL THEN
        RETURN NULL;
    END IF;

    location_name := 'Sales Van - ' || van_code;

    INSERT INTO public.stock_locations (name, type)
    VALUES (location_name, 'Sales Van')
    ON CONFLICT (name) DO UPDATE
    SET type = excluded.type
    RETURNING id INTO location_uuid;

    RETURN location_uuid;
END;
$$;

CREATE OR REPLACE FUNCTION app_private.restore_invoice_stock(invoice_uuid uuid, route_uuid uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app_private
AS $$
DECLARE
    location_uuid uuid;
    line record;
    stock_uuid uuid;
BEGIN
    location_uuid := app_private.get_or_create_van_stock_location(route_uuid);
    IF location_uuid IS NULL THEN
        RETURN;
    END IF;

    FOR line IN
        SELECT product_id, quantity
        FROM public.sales_invoice_items
        WHERE invoice_id = invoice_uuid
    LOOP
        SELECT id
        INTO stock_uuid
        FROM public.stock_levels
        WHERE product_id = line.product_id
          AND location_id = location_uuid
        ORDER BY updated_at DESC NULLS LAST, id
        LIMIT 1
        FOR UPDATE;

        IF stock_uuid IS NULL THEN
            INSERT INTO public.stock_levels (product_id, location_id, qty_on_hand, updated_at)
            VALUES (line.product_id, location_uuid, coalesce(line.quantity, 0), now());
        ELSE
            UPDATE public.stock_levels
            SET qty_on_hand = coalesce(qty_on_hand, 0) + coalesce(line.quantity, 0),
                updated_at = now()
            WHERE id = stock_uuid;
        END IF;
    END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION app_private.apply_invoice_stock(
    invoice_uuid uuid,
    route_uuid uuid,
    customer_label text,
    invoice_label text,
    item_rows jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app_private
AS $$
DECLARE
    location_uuid uuid;
    line jsonb;
    product_uuid uuid;
    qty numeric;
    stock_uuid uuid;
    available_qty numeric;
BEGIN
    location_uuid := app_private.get_or_create_van_stock_location(route_uuid);
    IF location_uuid IS NULL THEN
        RAISE EXCEPTION 'Stores must load stock to a sales van before this invoice can be issued.';
    END IF;

    FOR line IN SELECT value FROM jsonb_array_elements(item_rows)
    LOOP
        product_uuid := nullif(line->>'product_id', '')::uuid;
        qty := coalesce(nullif(line->>'quantity', '')::numeric, 0);

        IF product_uuid IS NULL OR qty <= 0 THEN
            RAISE EXCEPTION 'Each invoice item must have a product and quantity greater than zero.';
        END IF;

        SELECT id, coalesce(qty_on_hand, 0)
        INTO stock_uuid, available_qty
        FROM public.stock_levels
        WHERE product_id = product_uuid
          AND location_id = location_uuid
        ORDER BY updated_at DESC NULLS LAST, id
        LIMIT 1
        FOR UPDATE;

        IF stock_uuid IS NULL OR available_qty < qty THEN
            RAISE EXCEPTION 'Insufficient stock on the selected van for product %. Available %, required %.',
                product_uuid, coalesce(available_qty, 0), qty;
        END IF;

        UPDATE public.stock_levels
        SET qty_on_hand = available_qty - qty,
            updated_at = now()
        WHERE id = stock_uuid;

        INSERT INTO public.stock_movements (
            product_id,
            movement_type,
            quantity,
            reference_type,
            reference_id,
            notes,
            created_at
        )
        VALUES (
            product_uuid,
            'OUT',
            qty,
            'Sales Invoice',
            invoice_uuid,
            'Sale to ' || coalesce(customer_label, 'Customer') || ' (Invoice: ' || coalesce(invoice_label, '-') || ')',
            now()
        );
    END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION app_private.post_invoice_journal(
    invoice_label text,
    customer_label text,
    invoice_date date,
    invoice_amount numeric
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app_private
AS $$
DECLARE
    journal_notes text;
    journal_number text;
BEGIN
    IF coalesce(invoice_amount, 0) <= 0 THEN
        RETURN;
    END IF;

    journal_notes := 'Auto-posted from Sales Invoice ' || coalesce(invoice_label, '-');

    IF EXISTS (
        SELECT 1
        FROM public.journal_entries
        WHERE notes = journal_notes
        LIMIT 1
    ) THEN
        RETURN;
    END IF;

    journal_number := 'SLS-' || to_char(now(), 'YYMM') || '-' || floor(1000 + random() * 9000)::text;

    INSERT INTO public.journal_entries (
        entry_number,
        date,
        description,
        ref_type,
        debit_account,
        debit_amount,
        credit_account,
        credit_amount,
        created_by,
        notes
    )
    VALUES (
        journal_number,
        coalesce(invoice_date, current_date),
        'Sales Invoice ' || coalesce(invoice_label, '-') || ' - ' || coalesce(customer_label, 'Customer'),
        'Sales',
        'Accounts Receivable',
        abs(invoice_amount),
        'Sales Revenue',
        abs(invoice_amount),
        'System',
        journal_notes
    );
END;
$$;

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
            total_price
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

CREATE OR REPLACE FUNCTION public.post_sales_invoice(invoice_payload jsonb, item_payload jsonb)
RETURNS uuid
LANGUAGE sql
SECURITY INVOKER
SET search_path = public, app_private
AS $$
    SELECT app_private.post_sales_invoice_impl(
        auth.uid(),
        lower(coalesce(auth.jwt() ->> 'email', '')),
        invoice_payload,
        item_payload
    );
$$;

REVOKE ALL ON FUNCTION app_private.post_sales_invoice_impl(uuid, text, jsonb, jsonb) FROM PUBLIC;
GRANT USAGE ON SCHEMA app_private TO authenticated;
GRANT EXECUTE ON FUNCTION app_private.post_sales_invoice_impl(uuid, text, jsonb, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.post_sales_invoice(jsonb, jsonb) TO authenticated;
