-- issue_material_request_impl previously drew ALL material requests from
-- Main Warehouse only. Packaging materials are physically stocked in a
-- separate "Packaging Store" location, so any Packaging Material request
-- (or a mixed 'All'-type request containing packaging items) failed with
-- "Insufficient stock ... Available 0" even when the product had plenty of
-- stock, just in the wrong location per this function's hardcoded lookup.
--
-- Fix: resolve the source location per line item from the product's
-- material_type — 'Packaging Material' issues from Packaging Store,
-- everything else keeps issuing from Main Warehouse. Packaging Store is
-- only required to exist when a request actually contains a packaging item.

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
    packaging_store_id uuid;
    requested_product record;
    batch_row record;
    qty_remaining numeric;
    qty_to_take numeric;
    item_location_id uuid;
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

    SELECT id INTO packaging_store_id
    FROM public.stock_locations
    WHERE lower(name) = 'packaging store'
    LIMIT 1;

    IF NOT EXISTS (
        SELECT 1 FROM public.material_request_items WHERE request_id = request_uuid
    ) THEN
        RAISE EXCEPTION 'No items found in this material request.';
    END IF;

    FOR requested_product IN
        SELECT
            mri.product_id,
            coalesce(p.name, 'Product') AS product_name,
            p.material_type AS material_type,
            sum(coalesce(mri.quantity_requested, 0)) AS quantity_requested
        FROM public.material_request_items mri
        LEFT JOIN public.products p ON p.id = mri.product_id
        WHERE mri.request_id = request_uuid
        GROUP BY mri.product_id, p.name, p.material_type
    LOOP
        IF requested_product.product_id IS NULL OR requested_product.quantity_requested <= 0 THEN
            RAISE EXCEPTION 'Each material request item must have a product and quantity greater than zero.';
        END IF;

        item_location_id := CASE
            WHEN requested_product.material_type = 'Packaging Material' THEN packaging_store_id
            ELSE main_store_id
        END;

        IF item_location_id IS NULL THEN
            RAISE EXCEPTION 'Packaging Store location was not found in stock_locations.';
        END IF;

        WITH locked_stock AS (
            SELECT coalesce(qty_on_hand, 0) AS qty_on_hand
            FROM public.stock_levels
            WHERE product_id = requested_product.product_id AND location_id = item_location_id
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
        SELECT
            mri.product_id,
            p.material_type AS material_type,
            sum(coalesce(mri.quantity_requested, 0)) AS quantity_requested
        FROM public.material_request_items mri
        LEFT JOIN public.products p ON p.id = mri.product_id
        WHERE mri.request_id = request_uuid
        GROUP BY mri.product_id, p.material_type
    LOOP
        qty_remaining := requested_product.quantity_requested;
        item_location_id := CASE
            WHEN requested_product.material_type = 'Packaging Material' THEN packaging_store_id
            ELSE main_store_id
        END;

        FOR batch_row IN
            SELECT id, batch_number, expiry_date, coalesce(qty_on_hand, 0) AS qty_on_hand
            FROM public.stock_levels
            WHERE product_id = requested_product.product_id
              AND location_id = item_location_id
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

REVOKE ALL ON FUNCTION app_private.issue_material_request_impl(uuid, text, uuid) FROM PUBLIC;
GRANT USAGE ON SCHEMA app_private TO authenticated;
GRANT EXECUTE ON FUNCTION app_private.issue_material_request_impl(uuid, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.issue_material_request(uuid) TO authenticated;
