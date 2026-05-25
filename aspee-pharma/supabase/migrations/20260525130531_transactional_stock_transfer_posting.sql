CREATE SCHEMA IF NOT EXISTS app_private;

ALTER TABLE public.stock_transfers
    ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

ALTER TABLE public.stock_transfer_items
    ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

ALTER TABLE public.stock_levels
    ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

CREATE OR REPLACE FUNCTION app_private.is_sales_department_location(location_uuid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.stock_locations
        WHERE id = location_uuid
          AND (
              lower(coalesce(type, '')) = 'sales department'
              OR lower(coalesce(name, '')) = 'sales department'
          )
    );
$$;

CREATE OR REPLACE FUNCTION app_private.is_van_stock_location(location_uuid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.stock_locations
        WHERE id = location_uuid
          AND (
              lower(coalesce(type, '')) IN ('sales van', 'van')
              OR lower(coalesce(name, '')) LIKE 'sales van%'
          )
    );
$$;

CREATE OR REPLACE FUNCTION app_private.validate_stock_transfer_flow(
    from_location_uuid uuid,
    to_location_uuid uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app_private
AS $$
DECLARE
    from_exists boolean;
    to_exists boolean;
BEGIN
    SELECT EXISTS (SELECT 1 FROM public.stock_locations WHERE id = from_location_uuid)
    INTO from_exists;

    SELECT EXISTS (SELECT 1 FROM public.stock_locations WHERE id = to_location_uuid)
    INTO to_exists;

    IF NOT from_exists OR NOT to_exists THEN
        RAISE EXCEPTION 'Selected transfer locations could not be verified.';
    END IF;

    IF from_location_uuid = to_location_uuid THEN
        RAISE EXCEPTION 'Transfer source and destination must be different.';
    END IF;

    IF app_private.is_van_stock_location(to_location_uuid)
       AND NOT app_private.is_sales_department_location(from_location_uuid) THEN
        RAISE EXCEPTION 'Direct Stores -> Van transfers are not allowed. Move stock through Sales Department first.';
    END IF;

    IF app_private.is_van_stock_location(from_location_uuid)
       AND app_private.is_van_stock_location(to_location_uuid) THEN
        RAISE EXCEPTION 'Van-to-van transfers are not allowed. Move stock through Sales Department first.';
    END IF;
END;
$$;

CREATE OR REPLACE FUNCTION app_private.consolidate_stock_level(
    product_uuid uuid,
    location_uuid uuid
)
RETURNS TABLE(stock_id uuid, qty numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app_private
AS $$
DECLARE
    row_ids uuid[];
    total_qty numeric;
BEGIN
    WITH locked_rows AS (
        SELECT id, coalesce(qty_on_hand, 0)::numeric AS qty_on_hand
        FROM public.stock_levels
        WHERE product_id = product_uuid
          AND location_id = location_uuid
        ORDER BY updated_at DESC NULLS LAST, id
        FOR UPDATE
    )
    SELECT array_agg(id), coalesce(sum(qty_on_hand), 0)
    INTO row_ids, total_qty
    FROM locked_rows;

    IF row_ids IS NULL OR array_length(row_ids, 1) IS NULL THEN
        stock_id := NULL;
        qty := 0;
        RETURN NEXT;
        RETURN;
    END IF;

    UPDATE public.stock_levels
    SET qty_on_hand = total_qty,
        updated_at = now()
    WHERE id = row_ids[1];

    IF array_length(row_ids, 1) > 1 THEN
        DELETE FROM public.stock_levels
        WHERE id = ANY(row_ids[2:array_length(row_ids, 1)]);
    END IF;

    stock_id := row_ids[1];
    qty := total_qty;
    RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION app_private.move_product_stock(
    product_uuid uuid,
    from_location_uuid uuid,
    to_location_uuid uuid,
    transfer_qty numeric
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app_private
AS $$
DECLARE
    source_row record;
    destination_row record;
BEGIN
    IF product_uuid IS NULL OR transfer_qty <= 0 THEN
        RAISE EXCEPTION 'Each transfer item must have a product and quantity greater than zero.';
    END IF;

    SELECT *
    INTO source_row
    FROM app_private.consolidate_stock_level(product_uuid, from_location_uuid);

    IF source_row.stock_id IS NULL OR source_row.qty < transfer_qty THEN
        RAISE EXCEPTION 'Transfer would make stock negative. Review current stock before saving or deleting this transfer.';
    END IF;

    UPDATE public.stock_levels
    SET qty_on_hand = source_row.qty - transfer_qty,
        updated_at = now()
    WHERE id = source_row.stock_id;

    SELECT *
    INTO destination_row
    FROM app_private.consolidate_stock_level(product_uuid, to_location_uuid);

    IF destination_row.stock_id IS NULL THEN
        INSERT INTO public.stock_levels (product_id, location_id, qty_on_hand, updated_at)
        VALUES (product_uuid, to_location_uuid, transfer_qty, now());
    ELSE
        UPDATE public.stock_levels
        SET qty_on_hand = destination_row.qty + transfer_qty,
            updated_at = now()
        WHERE id = destination_row.stock_id;
    END IF;
END;
$$;

CREATE OR REPLACE FUNCTION app_private.apply_stock_transfer_effects(
    transfer_uuid uuid,
    transfer_label text,
    from_location_uuid uuid,
    to_location_uuid uuid,
    item_rows jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app_private
AS $$
DECLARE
    line record;
BEGIN
    FOR line IN
        SELECT
            nullif(value->>'product_id', '')::uuid AS product_id,
            sum(coalesce(nullif(value->>'quantity', '')::numeric, 0)) AS quantity
        FROM jsonb_array_elements(item_rows)
        GROUP BY nullif(value->>'product_id', '')::uuid
    LOOP
        IF line.product_id IS NULL OR line.quantity <= 0 THEN
            RAISE EXCEPTION 'Each transfer item must have a product and quantity greater than zero.';
        END IF;

        PERFORM app_private.move_product_stock(
            line.product_id,
            from_location_uuid,
            to_location_uuid,
            line.quantity
        );

        INSERT INTO public.stock_movements (
            product_id,
            movement_type,
            quantity,
            reference_type,
            reference_id,
            notes,
            created_at
        )
        VALUES
            (
                line.product_id,
                'OUT',
                line.quantity,
                'Stock Transfer',
                transfer_uuid,
                'Transfer ' || coalesce(transfer_label, '-') || ': out of source',
                now()
            ),
            (
                line.product_id,
                'IN',
                line.quantity,
                'Stock Transfer',
                transfer_uuid,
                'Transfer ' || coalesce(transfer_label, '-') || ': into destination',
                now()
            );
    END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION app_private.reverse_stock_transfer_effects(
    transfer_uuid uuid,
    from_location_uuid uuid,
    to_location_uuid uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app_private
AS $$
DECLARE
    line record;
BEGIN
    FOR line IN
        SELECT product_id, sum(coalesce(quantity, 0))::numeric AS quantity
        FROM public.stock_transfer_items
        WHERE transfer_id = transfer_uuid
        GROUP BY product_id
    LOOP
        PERFORM app_private.move_product_stock(
            line.product_id,
            to_location_uuid,
            from_location_uuid,
            line.quantity
        );
    END LOOP;

    DELETE FROM public.stock_movements
    WHERE reference_type = 'Stock Transfer'
      AND reference_id = transfer_uuid;
END;
$$;

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
            transfer_uuid,
            existing_transfer.from_location_id,
            existing_transfer.to_location_id
        );

        UPDATE public.stock_transfers
        SET transfer_number = transfer_label,
            from_location_id = from_location_uuid,
            to_location_id = to_location_uuid,
            status = coalesce(nullif(transfer_payload->>'status', ''), status),
            notes = transfer_payload->>'notes',
            updated_at = now()
        WHERE id = transfer_uuid;

        DELETE FROM public.stock_transfer_items
        WHERE transfer_id = transfer_uuid;

        inserted_transfer_id := transfer_uuid;
    ELSE
        INSERT INTO public.stock_transfers (
            transfer_number,
            from_location_id,
            to_location_id,
            status,
            notes,
            created_at,
            updated_at
        )
        VALUES (
            transfer_label,
            from_location_uuid,
            to_location_uuid,
            coalesce(nullif(transfer_payload->>'status', ''), 'Completed'),
            transfer_payload->>'notes',
            now(),
            now()
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

        INSERT INTO public.stock_transfer_items (
            transfer_id,
            product_id,
            quantity,
            created_at
        )
        VALUES (
            inserted_transfer_id,
            line.product_id,
            line.quantity::integer,
            now()
        );
    END LOOP;

    PERFORM app_private.apply_stock_transfer_effects(
        inserted_transfer_id,
        transfer_label,
        from_location_uuid,
        to_location_uuid,
        item_payload
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
        transfer_row.id,
        transfer_row.from_location_id,
        transfer_row.to_location_id
    );

    DELETE FROM public.stock_transfers
    WHERE id = transfer_row.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.post_stock_transfer(transfer_payload jsonb, item_payload jsonb)
RETURNS uuid
LANGUAGE sql
SECURITY INVOKER
SET search_path = public, app_private
AS $$
    SELECT app_private.post_stock_transfer_impl(
        auth.uid(),
        lower(coalesce(auth.jwt() ->> 'email', '')),
        transfer_payload,
        item_payload
    );
$$;

CREATE OR REPLACE FUNCTION public.delete_stock_transfer(transfer_uuid uuid)
RETURNS void
LANGUAGE sql
SECURITY INVOKER
SET search_path = public, app_private
AS $$
    SELECT app_private.delete_stock_transfer_impl(
        auth.uid(),
        lower(coalesce(auth.jwt() ->> 'email', '')),
        transfer_uuid
    );
$$;

REVOKE ALL ON FUNCTION app_private.post_stock_transfer_impl(uuid, text, jsonb, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION app_private.delete_stock_transfer_impl(uuid, text, uuid) FROM PUBLIC;
GRANT USAGE ON SCHEMA app_private TO authenticated;
GRANT EXECUTE ON FUNCTION app_private.post_stock_transfer_impl(uuid, text, jsonb, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION app_private.delete_stock_transfer_impl(uuid, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.post_stock_transfer(jsonb, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_stock_transfer(uuid) TO authenticated;
