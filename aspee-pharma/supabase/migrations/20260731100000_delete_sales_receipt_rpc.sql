-- The Sales Receipts page had a Delete button gated on receipt.status !==
-- 'Confirmed', but post_sales_receipt_impl always sets status to
-- 'Confirmed' by default — that field is just posting status, not proof
-- Accounts verified the cash (that's confirmation_status: registered ->
-- confirmed/variance/voided). So the button was effectively dead for every
-- receipt created through the normal flow.
--
-- On top of that, the client did a raw `sales_receipts.delete()`, which
-- left the GL journal entry this receipt posted (DR Cash/Bank, CR Accounts
-- Receivable) in place, and never recomputed the affected invoice's
-- PAID/PARTIAL status after its allocation disappeared. This adds a proper
-- delete RPC that reverses both, following the same
-- app_private impl / public wrapper pattern as delete_stock_transfer.

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

    SELECT id, receipt_number, invoice_id, confirmation_status
    INTO receipt_row
    FROM public.sales_receipts
    WHERE id = receipt_uuid
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Receipt was not found.';
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

CREATE OR REPLACE FUNCTION public.delete_sales_receipt(receipt_uuid uuid)
RETURNS void
LANGUAGE sql
SECURITY INVOKER
SET search_path = public, app_private
AS $$
    SELECT app_private.delete_sales_receipt_impl(
        auth.uid(),
        lower(coalesce(auth.jwt() ->> 'email', '')),
        receipt_uuid
    );
$$;

REVOKE ALL ON FUNCTION app_private.delete_sales_receipt_impl(uuid, text, uuid) FROM PUBLIC;
GRANT USAGE ON SCHEMA app_private TO authenticated;
GRANT EXECUTE ON FUNCTION app_private.delete_sales_receipt_impl(uuid, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_sales_receipt(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
