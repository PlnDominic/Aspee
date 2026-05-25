CREATE SCHEMA IF NOT EXISTS app_private;

CREATE TABLE IF NOT EXISTS public.material_requests (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    request_number text UNIQUE NOT NULL,
    production_order_id uuid REFERENCES public.production_orders(id) ON DELETE SET NULL,
    priority text DEFAULT 'Medium',
    status text DEFAULT 'Pending',
    notes text,
    requested_by uuid,
    request_type text DEFAULT 'All',
    qa_status text NOT NULL DEFAULT 'Not Required',
    qa_approved_by text,
    qa_approved_at timestamptz,
    qa_notes text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.material_request_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id uuid REFERENCES public.material_requests(id) ON DELETE CASCADE,
    product_id uuid REFERENCES public.products(id),
    quantity_requested numeric(15, 2) NOT NULL,
    quantity_issued numeric(15, 2) DEFAULT 0,
    unit text DEFAULT 'Pieces',
    created_at timestamptz DEFAULT now()
);

ALTER TABLE public.material_requests
    ADD COLUMN IF NOT EXISTS request_type text DEFAULT 'All',
    ADD COLUMN IF NOT EXISTS qa_status text NOT NULL DEFAULT 'Not Required',
    ADD COLUMN IF NOT EXISTS qa_approved_by text,
    ADD COLUMN IF NOT EXISTS qa_approved_at timestamptz,
    ADD COLUMN IF NOT EXISTS qa_notes text,
    ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

ALTER TABLE public.material_request_items
    ADD COLUMN IF NOT EXISTS quantity_issued numeric(15, 2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS unit text DEFAULT 'Pieces';

ALTER TABLE public.stock_levels
    ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now(),
    ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

ALTER TABLE public.stock_movements
    ADD COLUMN IF NOT EXISTS quantity numeric,
    ADD COLUMN IF NOT EXISTS batch_number text,
    ADD COLUMN IF NOT EXISTS expiry_date date,
    ADD COLUMN IF NOT EXISTS notes text,
    ADD COLUMN IF NOT EXISTS created_by uuid,
    ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'stock_movements'
          AND column_name = 'quantity_change'
    ) THEN
        ALTER TABLE public.stock_movements ALTER COLUMN quantity_change DROP NOT NULL;
    END IF;
END $$;

ALTER TABLE public.stock_movements
    DROP CONSTRAINT IF EXISTS stock_movements_movement_type_check;

ALTER TABLE public.stock_movements
    ADD CONSTRAINT stock_movements_movement_type_check
    CHECK (
        movement_type IN (
            'PURCHASE',
            'SALE',
            'DAMAGED',
            'GIFT',
            'RETURN',
            'ADJUSTMENT',
            'REQUISITION',
            'IN',
            'OUT',
            'TRANSFER'
        )
    );

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

    IF coalesce(app_user.role, '') NOT IN ('Super Admin', 'Managing Director', 'Store Manager', 'Production Manager') THEN
        RAISE EXCEPTION 'Insufficient permissions to issue material requests.';
    END IF;

    SELECT *
    INTO request_row
    FROM public.material_requests
    WHERE id = request_uuid
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Material request was not found.';
    END IF;

    IF coalesce(request_row.status, '') <> 'Pending' THEN
        RAISE EXCEPTION 'Only pending material requests can be issued.';
    END IF;

    SELECT id
    INTO main_store_id
    FROM public.stock_locations
    WHERE lower(name) = 'main warehouse'
    LIMIT 1;

    IF main_store_id IS NULL THEN
        RAISE EXCEPTION 'Main Warehouse location was not found in stock_locations.';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.material_request_items
        WHERE request_id = request_uuid
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
            WHERE product_id = requested_product.product_id
              AND location_id = main_store_id
            FOR UPDATE
        )
        SELECT coalesce(sum(qty_on_hand), 0)
        INTO qty_remaining
        FROM locked_stock;

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
            sum(coalesce(mri.quantity_requested, 0)) AS quantity_requested
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
            SET qty_on_hand = batch_row.qty_on_hand - qty_to_take,
                updated_at = now()
            WHERE id = batch_row.id;

            INSERT INTO public.stock_movements (
                product_id,
                movement_type,
                quantity,
                reference_type,
                reference_id,
                batch_number,
                expiry_date,
                notes,
                created_by,
                created_at
            )
            VALUES (
                requested_product.product_id,
                'OUT',
                qty_to_take,
                'Material Request',
                request_uuid,
                batch_row.batch_number,
                batch_row.expiry_date,
                'Issued to Production (Req: ' || coalesce(request_row.request_number, '-') || ')',
                app_user.id,
                now()
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
    SET status = 'Issued',
        updated_at = now()
    WHERE id = request_uuid;
END;
$$;

CREATE OR REPLACE FUNCTION public.issue_material_request(request_uuid uuid)
RETURNS void
LANGUAGE sql
SECURITY INVOKER
SET search_path = public, app_private
AS $$
    SELECT app_private.issue_material_request_impl(
        auth.uid(),
        lower(coalesce(auth.jwt() ->> 'email', '')),
        request_uuid
    );
$$;

REVOKE ALL ON FUNCTION app_private.issue_material_request_impl(uuid, text, uuid) FROM PUBLIC;
GRANT USAGE ON SCHEMA app_private TO authenticated;
GRANT EXECUTE ON FUNCTION public.issue_material_request(uuid) TO authenticated;
