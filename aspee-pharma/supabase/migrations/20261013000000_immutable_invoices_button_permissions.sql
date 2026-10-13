-- Permanently lock issued/paid/partial/overdue invoices and their line items.
-- Draft invoices remain editable; payment/status workflows can still update
-- payment-related columns on the header, but invoice content cannot change.
CREATE OR REPLACE FUNCTION public.guard_issued_invoice_update()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF upper(coalesce(OLD.status, 'DRAFT')) <> 'DRAFT' AND (
        NEW.invoice_number IS DISTINCT FROM OLD.invoice_number OR
        NEW.customer_name IS DISTINCT FROM OLD.customer_name OR
        NEW.route_id IS DISTINCT FROM OLD.route_id OR
        NEW.date IS DISTINCT FROM OLD.date OR
        NEW.due_date IS DISTINCT FROM OLD.due_date OR
        NEW.type IS DISTINCT FROM OLD.type OR
        NEW.currency IS DISTINCT FROM OLD.currency OR
        NEW.notes IS DISTINCT FROM OLD.notes OR
        NEW.total_amount IS DISTINCT FROM OLD.total_amount OR
        NEW.total_discount IS DISTINCT FROM OLD.total_discount OR
        NEW.salesperson_id IS DISTINCT FROM OLD.salesperson_id
    ) THEN
        RAISE EXCEPTION 'Issued invoices are permanently locked. Create a credit note or a new invoice instead.';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_issued_invoice_update ON public.sales_invoices;
CREATE TRIGGER guard_issued_invoice_update
    BEFORE UPDATE ON public.sales_invoices
    FOR EACH ROW EXECUTE FUNCTION public.guard_issued_invoice_update();

CREATE OR REPLACE FUNCTION public.guard_issued_invoice_items()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    invoice_status text;
BEGIN
    SELECT upper(coalesce(status, 'DRAFT')) INTO invoice_status
    FROM public.sales_invoices
    WHERE id = CASE WHEN TG_OP = 'DELETE' THEN OLD.invoice_id ELSE NEW.invoice_id END;

    IF invoice_status <> 'DRAFT' THEN
        RAISE EXCEPTION 'Issued invoice lines are permanently locked. Create a credit note or a new invoice instead.';
    END IF;
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_issued_invoice_items_insert_update ON public.sales_invoice_items;
CREATE TRIGGER guard_issued_invoice_items_insert_update
    BEFORE INSERT OR UPDATE OR DELETE ON public.sales_invoice_items
    FOR EACH ROW EXECUTE FUNCTION public.guard_issued_invoice_items();

-- Fine-grained button-level access. An absent row means the button inherits
-- the user's effective module access (none/view/edit).
CREATE TABLE IF NOT EXISTS public.user_button_permissions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES public.system_users(id) ON DELETE CASCADE,
    module text NOT NULL,
    button text NOT NULL,
    access text NOT NULL CHECK (access IN ('none', 'view', 'edit')),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (user_id, module, button)
);

ALTER TABLE public.user_button_permissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS user_button_permissions_select_self_or_admin ON public.user_button_permissions;
DROP POLICY IF EXISTS user_button_permissions_write_admin_only ON public.user_button_permissions;
CREATE POLICY user_button_permissions_select_self_or_admin
ON public.user_button_permissions FOR SELECT TO authenticated
USING (
    public.has_any_app_role(ARRAY['Super Admin', 'Managing Director', 'HR Manager'])
    OR user_id IN (
        SELECT id FROM public.system_users
        WHERE auth_user_id = auth.uid() OR lower(email) = public.current_app_user_email()
    )
);
CREATE POLICY user_button_permissions_write_admin_only
ON public.user_button_permissions FOR ALL TO authenticated
USING (public.has_any_app_role(ARRAY['Super Admin', 'Managing Director', 'HR Manager']))
WITH CHECK (public.has_any_app_role(ARRAY['Super Admin', 'Managing Director', 'HR Manager']));

CREATE OR REPLACE FUNCTION public.effective_button_access(
    p_user_id uuid, p_module text, p_button text
)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT coalesce(
        (SELECT access FROM public.user_button_permissions
         WHERE user_id = p_user_id AND module = p_module AND button = p_button),
        public.effective_module_access(p_user_id, p_module)
    );
$$;
REVOKE ALL ON FUNCTION public.effective_button_access(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.effective_button_access(uuid, text, text) TO authenticated;
