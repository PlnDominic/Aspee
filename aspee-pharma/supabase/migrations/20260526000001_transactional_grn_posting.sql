-- Transactional GRN Posting Logic
-- This migration moves complex, multi-table GRN operations to the server for atomicity.

CREATE SCHEMA IF NOT EXISTS app_private;

CREATE OR REPLACE FUNCTION app_private.reverse_grn_stock_effects(grn_uuid uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app_private
AS $$
DECLARE
    line record;
    main_store_id uuid;
BEGIN
    SELECT id
    INTO main_store_id
    FROM public.stock_locations
    WHERE name IN ('Main Warehouse', 'Main Store', 'Raw Materials Store')
    ORDER BY CASE name WHEN 'Main Warehouse' THEN 0 WHEN 'Main Store' THEN 1 ELSE 2 END
    LIMIT 1;
    
    IF main_store_id IS NULL THEN
        RAISE EXCEPTION 'Main Warehouse location not found.';
    END IF;

    FOR line IN
        SELECT product_id, quantity_received, batch_no, qa_status
        FROM public.grn_items
        WHERE grn_id = grn_uuid
          AND qa_status = 'Approved'
    LOOP
        UPDATE public.stock_levels
        SET qty_on_hand = GREATEST(0, qty_on_hand - line.quantity_received),
            updated_at = now()
        WHERE product_id = line.product_id
          AND location_id = main_store_id
          AND coalesce(batch_number, 'N/A') = coalesce(line.batch_no, 'N/A');
    END LOOP;

    DELETE FROM public.stock_movements
    WHERE reference_type = 'GRN'
      AND reference_id = grn_uuid;
END;
$$;

CREATE OR REPLACE FUNCTION app_private.update_po_status_from_grns(po_uuid uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app_private
AS $$
DECLARE
    total_ordered numeric;
    total_received numeric;
    new_status text;
BEGIN
    SELECT coalesce(sum(quantity), 0) INTO total_ordered
    FROM public.purchase_order_items
    WHERE po_id = po_uuid;

    SELECT coalesce(sum(gi.quantity_received), 0) INTO total_received
    FROM public.grn g
    JOIN public.grn_items gi ON gi.grn_id = g.id
    WHERE g.po_id = po_uuid;

    IF total_received >= total_ordered THEN
        new_status := 'Received';
    ELSIF total_received > 0 THEN
        new_status := 'Partial';
    ELSE
        new_status := 'Pending';
    END IF;

    UPDATE public.purchase_orders
    SET status = new_status
    WHERE id = po_uuid;
END;
$$;

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
    WHERE auth_user_id = auth_user_uuid
       OR lower(email) = lower(coalesce(auth_email, ''))
    ORDER BY CASE WHEN auth_user_id = auth_user_uuid THEN 0 ELSE 1 END
    LIMIT 1;

    IF app_user.id IS NULL THEN RAISE EXCEPTION 'System user profile not found.'; END IF;
    IF app_user.status <> 'Active' THEN RAISE EXCEPTION 'Account is inactive.'; END IF;
    IF app_user.role NOT IN ('Super Admin', 'Managing Director', 'Store Manager', 'Purchasing Manager') THEN
        RAISE EXCEPTION 'Insufficient permissions to post GRN.';
    END IF;

    grn_uuid := nullif(grn_payload->>'id', '')::uuid;
    po_uuid := nullif(grn_payload->>'po_id', '')::uuid;
    header_approved := (grn_payload->>'qa_status' = 'Approved');
    
    SELECT id
    INTO main_store_id
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
            qa_inspector, qa_date, goods_condition, qa_remarks,
            notes, created_by
        ) VALUES (
            grn_payload->>'grn_number',
            po_uuid,
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
        product_id uuid, quantity_received numeric, batch_no text, expiry_date date, po_item_id uuid, qa_status text
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
                inserted_grn_id, line.product_id, line.quantity_received, line.batch_no, 
                line.expiry_date, line.po_item_id, item_status
            );

            IF item_status = 'Approved' AND line.quantity_received > 0 THEN
                INSERT INTO public.stock_levels (product_id, location_id, batch_number, expiry_date, qty_on_hand, updated_at)
                VALUES (line.product_id, main_store_id, coalesce(line.batch_no, 'N/A'), line.expiry_date, line.quantity_received, now())
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

CREATE OR REPLACE FUNCTION public.post_grn(grn_payload jsonb, item_payload jsonb)
RETURNS uuid
LANGUAGE sql
SECURITY INVOKER
AS $$
    SELECT app_private.post_grn_impl(
        auth.uid(),
        lower(coalesce(auth.jwt() ->> 'email', '')),
        grn_payload,
        item_payload
    );
$$;

REVOKE ALL ON FUNCTION app_private.post_grn_impl(uuid, text, jsonb, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.post_grn(jsonb, jsonb) TO authenticated;
