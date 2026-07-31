-- The Purchase Order approval UI (POApprovalModal) gates Finance-level
-- approval to Accountant/Managing Director/Super Admin client-side only —
-- the actual write was a plain `purchase_orders.update()` call any
-- authenticated client could issue with any approval_level, bypassing the
-- UI entirely. This adds a SECURITY DEFINER RPC that re-checks the
-- approver's role and the PO's amount threshold server-side before writing,
-- following the same app_private impl / public wrapper pattern used by
-- issue_material_request, post_grn, post_sales_invoice, etc.

CREATE OR REPLACE FUNCTION app_private.approve_purchase_order_impl(
    auth_user_uuid uuid,
    auth_email text,
    po_uuid uuid,
    p_approval_level text,
    p_notes text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app_private
AS $$
DECLARE
    app_user record;
    po_row record;
    finance_required boolean;
BEGIN
    IF auth_user_uuid IS NULL THEN
        RAISE EXCEPTION 'Authentication required.';
    END IF;

    IF p_approval_level NOT IN ('Manager', 'Finance') THEN
        RAISE EXCEPTION 'Invalid approval level.';
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

    IF coalesce(app_user.role, '') NOT IN ('Super Admin', 'Purchasing Manager', 'Accountant', 'Managing Director') THEN
        RAISE EXCEPTION 'Insufficient permissions to approve purchase orders.';
    END IF;

    SELECT id, status, total_amount
    INTO po_row
    FROM public.purchase_orders
    WHERE id = po_uuid
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Purchase order was not found.';
    END IF;

    IF coalesce(po_row.status, '') <> 'Pending' THEN
        RAISE EXCEPTION 'Only pending purchase orders can be approved.';
    END IF;

    finance_required := coalesce(po_row.total_amount, 0) > 10000;

    IF (p_approval_level = 'Finance' OR finance_required)
       AND coalesce(app_user.role, '') NOT IN ('Accountant', 'Managing Director', 'Super Admin') THEN
        RAISE EXCEPTION 'Only Accountant, Managing Director, or Super Admin can grant Finance-level approval.';
    END IF;

    IF finance_required AND p_approval_level <> 'Finance' THEN
        RAISE EXCEPTION 'This purchase order exceeds the Finance approval threshold and must be approved at Finance level.';
    END IF;

    UPDATE public.purchase_orders
    SET status = 'Approved',
        approved_by = auth_user_uuid,
        approved_at = now(),
        approval_level = p_approval_level,
        approval_notes = nullif(p_notes, ''),
        updated_at = now()
    WHERE id = po_uuid;
END;
$$;

CREATE OR REPLACE FUNCTION public.approve_purchase_order(
    po_uuid uuid,
    p_approval_level text,
    p_notes text DEFAULT NULL
)
RETURNS void
LANGUAGE sql
SECURITY INVOKER
SET search_path = public, app_private
AS $$
    SELECT app_private.approve_purchase_order_impl(
        auth.uid(),
        lower(coalesce(auth.jwt() ->> 'email', '')),
        po_uuid,
        p_approval_level,
        p_notes
    );
$$;

REVOKE ALL ON FUNCTION app_private.approve_purchase_order_impl(uuid, text, uuid, text, text) FROM PUBLIC;
GRANT USAGE ON SCHEMA app_private TO authenticated;
GRANT EXECUTE ON FUNCTION app_private.approve_purchase_order_impl(uuid, text, uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_purchase_order(uuid, text, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
