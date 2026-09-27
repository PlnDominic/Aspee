-- ============================================================================
-- Access Control: per-user module permissions + role-tiered edit windows.
--
-- Two separate things, both requested together:
--
-- 1. Per-user module access (None / View / Edit) — an override on top of the
--    existing role-based route gating (Sidebar.tsx ROUTE_ROLES,
--    src/lib/routePermissions.ts, and this migration's own module_default_access
--    fallback). Nothing changes for any existing user until an admin sets an
--    explicit row in user_module_permissions for them — this table starts
--    empty, and every helper below falls back to the current role-based
--    default when no override row exists.
--
-- 2. A role-tiered lock on editing/deleting transactions that are already
--    "done": 21 days for officer-tier roles (Van Sales Rep, Quality
--    Assurance, Accountant, Internal Auditor), 60 days for manager-tier
--    roles (Sales/Store/Purchasing/Production/HR Manager), unlimited for
--    Super Admin and Managing Director. A per-user
--    system_users.edit_window_override_days can override either default for
--    an individual (e.g. a trusted officer who needs more room, or a
--    manager who should be tighter than the default).
--
-- Enforcement lives in two places, deliberately:
--   a. RESTRICTIVE RLS policies on tables written to directly by the client
--      (credit_notes, requisitions, and the DELETE path on sales_invoices /
--      sales_invoice_items, stock_transfers / stock_transfer_items,
--      sales_stock_losses) — see _set_edit_window_guard below.
--   b. Explicit checks inside the SECURITY DEFINER RPCs that own the write
--      path for sales_invoices/receipts/stock_transfers (post_sales_invoice,
--      post_sales_receipt, post_stock_transfer and their delete
--      counterparts) — added in the companion migration
--      20260927000001_enforce_edit_window_in_rpcs.sql. RESTRICTIVE table
--      policies alone would NOT catch these: those functions run
--      SECURITY DEFINER and their internal UPDATE/DELETE statements are not
--      subject to the calling user's RLS, so the check has to live in the
--      function body itself.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Per-user override window (nullable — NULL means "use the role default").
-- ----------------------------------------------------------------------------

ALTER TABLE public.system_users
    ADD COLUMN IF NOT EXISTS edit_window_override_days integer;

ALTER TABLE public.system_users
    DROP CONSTRAINT IF EXISTS system_users_edit_window_override_days_check;
ALTER TABLE public.system_users
    ADD CONSTRAINT system_users_edit_window_override_days_check
    CHECK (edit_window_override_days IS NULL OR edit_window_override_days > 0);

-- Extend the existing self-update guard (20260421000100_harden_sensitive_access.sql)
-- so a non-admin can't quietly widen their own lock window the same way they
-- already can't change their own role/department/status. Bypass roles are
-- unchanged from that migration.
CREATE OR REPLACE FUNCTION public.guard_system_users_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.has_any_app_role(ARRAY['Super Admin', 'Managing Director', 'HR Manager']) THEN
    RETURN NEW;
  END IF;

  IF OLD.auth_user_id IS DISTINCT FROM auth.uid()
     AND lower(coalesce(OLD.email, '')) <> public.current_app_user_email() THEN
    RAISE EXCEPTION 'You can only update your own profile.';
  END IF;

  IF NEW.role IS DISTINCT FROM OLD.role
     OR NEW.department IS DISTINCT FROM OLD.department
     OR NEW.status IS DISTINCT FROM OLD.status
     OR NEW.mfa_enabled IS DISTINCT FROM OLD.mfa_enabled
     OR NEW.auth_user_id IS DISTINCT FROM OLD.auth_user_id
     OR NEW.edit_window_override_days IS DISTINCT FROM OLD.edit_window_override_days
     OR lower(coalesce(NEW.email, '')) IS DISTINCT FROM lower(coalesce(OLD.email, '')) THEN
    RAISE EXCEPTION 'You are not allowed to modify protected account fields.';
  END IF;

  RETURN NEW;
END;
$$;

-- ----------------------------------------------------------------------------
-- 2. Per-user module access overrides.
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.user_module_permissions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES public.system_users(id) ON DELETE CASCADE,
    module text NOT NULL CHECK (module IN (
        'dashboard', 'purchasing', 'qa', 'stores', 'production',
        'sales', 'accounting', 'internal_audit', 'hr', 'compliance', 'settings'
    )),
    access text NOT NULL CHECK (access IN ('none', 'view', 'edit')),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (user_id, module)
);

ALTER TABLE public.user_module_permissions ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
    policy_name text;
BEGIN
    FOR policy_name IN
        SELECT policyname FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'user_module_permissions'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.user_module_permissions', policy_name);
    END LOOP;
END $$;

CREATE POLICY user_module_permissions_select_self_or_admin
ON public.user_module_permissions FOR SELECT TO authenticated
USING (
    public.has_any_app_role(ARRAY['Super Admin', 'Managing Director', 'HR Manager'])
    OR user_id IN (
        SELECT id FROM public.system_users
        WHERE auth_user_id = auth.uid() OR lower(email) = public.current_app_user_email()
    )
);

CREATE POLICY user_module_permissions_write_admin_only
ON public.user_module_permissions FOR ALL TO authenticated
USING (public.has_any_app_role(ARRAY['Super Admin', 'Managing Director', 'HR Manager']))
WITH CHECK (public.has_any_app_role(ARRAY['Super Admin', 'Managing Director', 'HR Manager']));

-- Role-based default access per module — mirrors today's route gating
-- (Sidebar.tsx ROUTE_ROLES / src/lib/routePermissions.ts). Used as the
-- fallback whenever no override row exists in user_module_permissions, so
-- this is a description of current behavior, not a change to it.
CREATE OR REPLACE FUNCTION public.module_default_access(p_role text, p_module text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT CASE
        WHEN p_role = 'Super Admin' THEN 'edit'
        WHEN p_module = 'dashboard' THEN 'view'
        WHEN p_module = 'purchasing' THEN CASE
            WHEN p_role = 'Purchasing Manager' THEN 'edit'
            WHEN p_role IN ('Managing Director', 'Accountant') THEN 'view'
            ELSE 'none' END
        WHEN p_module = 'qa' THEN CASE
            WHEN p_role = 'Quality Assurance' THEN 'edit'
            WHEN p_role IN ('Managing Director', 'Accountant') THEN 'view'
            ELSE 'none' END
        WHEN p_module = 'stores' THEN CASE
            WHEN p_role = 'Store Manager' THEN 'edit'
            WHEN p_role IN ('Purchasing Manager', 'Accountant') THEN 'view'
            ELSE 'none' END
        WHEN p_module = 'production' THEN CASE
            WHEN p_role = 'Production Manager' THEN 'edit'
            WHEN p_role IN ('Store Manager', 'Accountant') THEN 'view'
            ELSE 'none' END
        WHEN p_module = 'sales' THEN CASE
            WHEN p_role IN ('Sales Manager', 'Van Sales Rep') THEN 'edit'
            WHEN p_role = 'Accountant' THEN 'view'
            ELSE 'none' END
        WHEN p_module = 'accounting' THEN CASE
            WHEN p_role = 'Accountant' THEN 'edit'
            WHEN p_role = 'Managing Director' THEN 'view'
            ELSE 'none' END
        WHEN p_module = 'internal_audit' THEN CASE
            WHEN p_role = 'Internal Auditor' THEN 'edit'
            WHEN p_role = 'Managing Director' THEN 'view'
            ELSE 'none' END
        WHEN p_module = 'hr' THEN CASE
            WHEN p_role = 'HR Manager' THEN 'edit'
            WHEN p_role = 'Accountant' THEN 'view'
            ELSE 'none' END
        WHEN p_module = 'compliance' THEN CASE
            WHEN p_role IN ('Quality Assurance', 'Managing Director') THEN 'edit'
            WHEN p_role = 'Accountant' THEN 'view'
            ELSE 'none' END
        WHEN p_module = 'settings' THEN 'none'
        ELSE 'view'
    END;
$$;

-- Effective access for one user on one module — override if set, else the
-- role default above.
CREATE OR REPLACE FUNCTION public.effective_module_access(p_user_id uuid, p_module text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT coalesce(
        (SELECT access FROM public.user_module_permissions
         WHERE user_id = p_user_id AND module = p_module),
        public.module_default_access(
            (SELECT role FROM public.system_users WHERE id = p_user_id),
            p_module
        )
    );
$$;

REVOKE ALL ON FUNCTION public.effective_module_access(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.effective_module_access(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.module_default_access(text, text) TO authenticated;

-- Can the CURRENT caller edit this module — resolves their own system_users
-- row internally, so client code never has to pass a user id (and can't
-- spoof one). Super Admin always passes.
CREATE OR REPLACE FUNCTION app_private.can_edit_module(p_module text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, app_private
AS $$
DECLARE
    caller_id uuid;
    caller_role text;
BEGIN
    SELECT id, role INTO caller_id, caller_role
    FROM public.system_users
    WHERE auth_user_id = auth.uid() OR lower(email) = public.current_app_user_email()
    ORDER BY CASE WHEN auth_user_id = auth.uid() THEN 0 ELSE 1 END
    LIMIT 1;

    IF caller_id IS NULL THEN
        RETURN false;
    END IF;

    IF caller_role = 'Super Admin' THEN
        RETURN true;
    END IF;

    RETURN public.effective_module_access(caller_id, p_module) = 'edit';
END;
$$;

REVOKE ALL ON FUNCTION app_private.can_edit_module(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.can_edit_module(text) TO authenticated;

-- ----------------------------------------------------------------------------
-- 3. Role-tiered edit window.
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION app_private.edit_window_days_for_role(p_role text)
RETURNS int
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT CASE
        WHEN p_role IN ('Super Admin', 'Managing Director') THEN NULL
        WHEN p_role IN (
            'Sales Manager', 'Store Manager', 'Purchasing Manager',
            'Production Manager', 'HR Manager'
        ) THEN 60
        ELSE 21
    END;
$$;

REVOKE ALL ON FUNCTION app_private.edit_window_days_for_role(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.edit_window_days_for_role(text) TO authenticated;

-- Is the CURRENT caller still inside their edit window for a row dated/created
-- at p_row_at? NULL p_row_at (no date on the row yet) always passes. NULL
-- resolved window (Super Admin / Managing Director, or nobody found) always
-- passes.
CREATE OR REPLACE FUNCTION app_private.within_edit_window(p_row_at timestamptz)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, app_private
AS $$
DECLARE
    caller_role text;
    override_days int;
    days int;
BEGIN
    IF p_row_at IS NULL THEN
        RETURN true;
    END IF;

    SELECT role, edit_window_override_days INTO caller_role, override_days
    FROM public.system_users
    WHERE auth_user_id = auth.uid() OR lower(email) = public.current_app_user_email()
    ORDER BY CASE WHEN auth_user_id = auth.uid() THEN 0 ELSE 1 END
    LIMIT 1;

    IF caller_role IS NULL OR caller_role IN ('Super Admin', 'Managing Director') THEN
        RETURN true;
    END IF;

    days := coalesce(override_days, app_private.edit_window_days_for_role(caller_role));
    IF days IS NULL THEN
        RETURN true;
    END IF;

    RETURN p_row_at >= now() - (days || ' days')::interval;
END;
$$;

REVOKE ALL ON FUNCTION app_private.within_edit_window(timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.within_edit_window(timestamptz) TO authenticated;

-- ----------------------------------------------------------------------------
-- 4. Apply as RESTRICTIVE RLS on the tables written to directly by the
--    client (not through a SECURITY DEFINER RPC). RESTRICTIVE policies AND
--    with the result of the existing PERMISSIVE policies rather than
--    replacing them, so this only ever narrows access, never widens it.
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public._set_edit_window_guard(
    p_table text,
    p_module text,
    p_date_expr text
)
RETURNS void
LANGUAGE plpgsql
AS $func$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = p_table
    ) THEN
        RETURN;
    END IF;

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', p_table || '_edit_window_update', p_table);
    EXECUTE format(
        'CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR UPDATE USING (app_private.can_edit_module(%L) AND app_private.within_edit_window(%s)) WITH CHECK (app_private.can_edit_module(%L) AND app_private.within_edit_window(%s))',
        p_table || '_edit_window_update', p_table, p_module, p_date_expr, p_module, p_date_expr
    );

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', p_table || '_edit_window_delete', p_table);
    EXECUTE format(
        'CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR DELETE USING (app_private.can_edit_module(%L) AND app_private.within_edit_window(%s))',
        p_table || '_edit_window_delete', p_table, p_module, p_date_expr
    );
END;
$func$;

REVOKE ALL ON FUNCTION public._set_edit_window_guard(text, text, text) FROM PUBLIC;

SELECT public._set_edit_window_guard('sales_invoices', 'sales', 'date');
SELECT public._set_edit_window_guard(
    'sales_invoice_items', 'sales',
    '(SELECT si.date FROM public.sales_invoices si WHERE si.id = sales_invoice_items.invoice_id)'
);
SELECT public._set_edit_window_guard('sales_receipts', 'sales', 'date');
SELECT public._set_edit_window_guard('credit_notes', 'sales', 'date');
SELECT public._set_edit_window_guard('requisitions', 'sales', 'created_at');
SELECT public._set_edit_window_guard('sales_stock_losses', 'sales', 'date');
SELECT public._set_edit_window_guard('stock_transfers', 'stores', 'created_at');
SELECT public._set_edit_window_guard(
    'stock_transfer_items', 'stores',
    '(SELECT st.created_at FROM public.stock_transfers st WHERE st.id = stock_transfer_items.transfer_id)'
);
