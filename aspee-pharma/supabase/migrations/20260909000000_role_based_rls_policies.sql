-- ============================================================================
-- Role-based RLS policies for every table currently protected only by
-- "authenticated USING (true)" (or no RLS at all).
--
-- WHY THIS MIGRATION EXISTS
-- Several earlier ad-hoc scripts (kept at the repo root, not in this folder —
-- DATABASE_FIX.sql, CONSOLIDATED_DATABASE_FIX.sql, complete_financial_setup.sql,
-- fix_production_policies.sql, fix_production_schema.sql,
-- migration_fix_all_rls_policies.sql) granted every *authenticated* user full
-- SELECT/INSERT/UPDATE/DELETE on ~45 core tables — payroll, journal entries,
-- customers, invoices, purchase orders, production, stock, everything.
-- Next.js middleware and requireRoles()/requireAuthenticatedUser() only guard
-- page routes and a handful of custom API routes; they do nothing to stop a
-- signed-in browser session from calling the Supabase REST API directly with
-- the public anon key (already shipped in the JS bundle) plus its own auth
-- cookie. In effect, any employee account — regardless of assigned role —
-- currently has unrestricted read/write on the whole database.
--
-- This migration re-locks every one of those tables with policies scoped to
-- the same role groupings the app itself already claims to enforce in
-- src/lib/routePermissions.ts, so the database finally agrees with the UI.
--
-- IMPORTANT — DO NOT RE-RUN THE OLD ROOT-LEVEL SCRIPTS AFTER THIS.
-- Postgres RLS policies are OR'd together (they're all "permissive" by
-- default): if any leftover policy on a table still says USING (true), that
-- alone re-opens the table no matter how many strict policies also exist.
-- This migration explicitly drops every existing policy on every table it
-- touches before creating the new ones, but if DATABASE_FIX.sql /
-- CONSOLIDATED_DATABASE_FIX.sql / migration_fix_all_rls_policies.sql / etc.
-- are ever run again afterwards, they will silently re-open these tables.
-- Treat those files as retired; do not execute them again.
--
-- SCOPE NOTE
-- This was written from a full source-code review, not a live database
-- inspection (no DB credentials were available while drafting it). Every
-- table below is wrapped in an existence check, so this migration is safe
-- to run even if some of them don't exist in your database — but that also
-- means it can't catch a permissively-open table this review didn't find.
-- Run the verification query at the bottom after applying this, and treat
-- any row it returns as a table this migration missed.
--
-- WHAT THIS DOES NOT DO
-- It grants each role group *table-level* CRUD matching routePermissions.ts
-- — a large, immediate improvement over "everyone, everything" — but it does
-- not yet add row-level nuance (e.g. "a Van Sales Rep may only edit invoices
-- on their own route", "an Accountant can view but not delete a posted
-- journal entry"). Those are good follow-up migrations once this baseline
-- is confirmed not to break anything.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Helper functions
--
-- public.has_any_app_role(text[]), public.current_app_user_role(),
-- public.current_app_user_email(), public.current_app_user_department() are
-- assumed to already exist from 20260421000100_harden_sensitive_access.sql.
-- They are NOT redefined here (that migration already got them right and
-- system_users' own policies + trigger depend on their exact behavior).
--
-- public.current_app_user_active() and public.app_role_ok(text[]) are new,
-- additive helpers: app_role_ok() is what every policy below actually calls,
-- so it also fails closed for a user whose system_users.status isn't
-- 'Active' — matching requireAuthenticatedUser()'s app-layer check, which
-- until now had no equivalent at the database layer.
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.current_app_user_active()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.system_users su
    WHERE (su.auth_user_id = auth.uid() OR lower(su.email) = public.current_app_user_email())
      AND su.status = 'Active'
  );
$$;

CREATE OR REPLACE FUNCTION public.app_role_ok(roles text[])
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_any_app_role(roles) AND public.current_app_user_active();
$$;

REVOKE ALL ON FUNCTION public.current_app_user_active() FROM public;
REVOKE ALL ON FUNCTION public.app_role_ok(text[]) FROM public;
GRANT EXECUTE ON FUNCTION public.current_app_user_active() TO authenticated;
GRANT EXECUTE ON FUNCTION public.app_role_ok(text[]) TO authenticated;

-- ----------------------------------------------------------------------------
-- 2. Reusable policy-application procedures
--
-- _set_module_rls: standard case — only members of `p_roles` (plus anyone in
-- `p_select_extra_roles`, for read-only oversight access) can touch the
-- table at all, and only `p_roles` can write.
--
-- _set_reference_rls: for shared lookup/reference tables (products, vans,
-- sales_reps, stock_locations, suppliers, routes) that legitimately need to
-- be readable across modules (e.g. Sales needs to read `products` to build
-- an invoice) but should only be *written* by the module that owns them.
-- SELECT is any active, currently-employed user; INSERT/UPDATE/DELETE is
-- restricted to `p_write_roles`.
--
-- Both drop every existing policy on the table first (by name, via
-- pg_policies) — required so no leftover USING(true) policy from the old
-- scripts survives to override these.
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public._set_module_rls(
    p_table text,
    p_roles text[],
    p_select_extra_roles text[] DEFAULT ARRAY[]::text[]
)
RETURNS void
LANGUAGE plpgsql
AS $func$
DECLARE
    policy_name text;
    select_roles text[];
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = p_table
    ) THEN
        RETURN;
    END IF;

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', p_table);

    FOR policy_name IN
        SELECT policyname FROM pg_policies
        WHERE schemaname = 'public' AND tablename = p_table
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', policy_name, p_table);
    END LOOP;

    select_roles := p_roles || p_select_extra_roles;

    EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (public.app_role_ok(%L::text[]))',
        p_table || '_select_role', p_table, select_roles
    );
    EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (public.app_role_ok(%L::text[]))',
        p_table || '_insert_role', p_table, p_roles
    );
    EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (public.app_role_ok(%L::text[])) WITH CHECK (public.app_role_ok(%L::text[]))',
        p_table || '_update_role', p_table, p_roles, p_roles
    );
    EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (public.app_role_ok(%L::text[]))',
        p_table || '_delete_role', p_table, p_roles
    );
END;
$func$;

REVOKE ALL ON FUNCTION public._set_module_rls(text, text[], text[]) FROM PUBLIC;
-- (No GRANT to authenticated/anon: this is a migration-time utility that
-- alters RLS policies on arbitrary tables. It must only ever run as the
-- migration/superuser role that owns this migration — never be callable via
-- supabase.rpc() by a logged-in client.)

CREATE OR REPLACE FUNCTION public._set_reference_rls(
    p_table text,
    p_write_roles text[]
)
RETURNS void
LANGUAGE plpgsql
AS $func$
DECLARE
    policy_name text;
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = p_table
    ) THEN
        RETURN;
    END IF;

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', p_table);

    FOR policy_name IN
        SELECT policyname FROM pg_policies
        WHERE schemaname = 'public' AND tablename = p_table
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', policy_name, p_table);
    END LOOP;

    EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (public.current_app_user_active())',
        p_table || '_select_any_active', p_table
    );
    EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (public.app_role_ok(%L::text[]))',
        p_table || '_insert_role', p_table, p_write_roles
    );
    EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (public.app_role_ok(%L::text[])) WITH CHECK (public.app_role_ok(%L::text[]))',
        p_table || '_update_role', p_table, p_write_roles, p_write_roles
    );
    EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (public.app_role_ok(%L::text[]))',
        p_table || '_delete_role', p_table, p_write_roles
    );
END;
$func$;

REVOKE ALL ON FUNCTION public._set_reference_rls(text, text[]) FROM PUBLIC;

-- ----------------------------------------------------------------------------
-- 3. Role groups (mirrors src/lib/routePermissions.ts — keep these in sync
--    with that file; a role added there for a module should be added here).
-- ----------------------------------------------------------------------------

DO $$
DECLARE
    sales_roles        text[] := ARRAY['Super Admin','Sales Manager','Van Sales Rep','Accountant'];
    sales_store_roles  text[] := ARRAY['Super Admin','Sales Manager','Van Sales Rep','Store Manager','Accountant'];
    stores_roles       text[] := ARRAY['Super Admin','Store Manager','Purchasing Manager','Accountant'];
    operations_roles   text[] := ARRAY['Super Admin','Store Manager','Purchasing Manager','Production Manager','Sales Manager','Van Sales Rep','Quality Assurance','Accountant'];
    stores_qa_roles    text[] := ARRAY['Super Admin','Store Manager','Purchasing Manager','Production Manager','Quality Assurance','Accountant'];
    purchasing_roles   text[] := ARRAY['Super Admin','Purchasing Manager','Accountant'];
    grn_roles          text[] := ARRAY['Super Admin','Purchasing Manager','Quality Assurance','Accountant'];
    production_roles   text[] := ARRAY['Super Admin','Production Manager','Store Manager','Accountant'];
    qa_roles           text[] := ARRAY['Super Admin','Quality Assurance','Accountant'];
    accounting_roles   text[] := ARRAY['Super Admin','Managing Director','Accountant'];
    hr_roles           text[] := ARRAY['Super Admin','HR Manager','Accountant'];
    audit_roles        text[] := ARRAY['Super Admin','Internal Auditor'];
    admin_only_roles   text[] := ARRAY['Super Admin'];
BEGIN
    -- Sales: customer-facing documents and the sales roster/route reference.
    PERFORM public._set_module_rls('customers', sales_roles);
    PERFORM public._set_module_rls('sales_invoices', sales_roles);
    PERFORM public._set_module_rls('sales_invoice_items', sales_roles);
    PERFORM public._set_module_rls('sales_receipts', sales_roles);
    PERFORM public._set_module_rls('sales_receipt_items', sales_roles);
    PERFORM public._set_module_rls('sales_receipt_allocations', sales_roles);
    PERFORM public._set_module_rls('credit_notes', sales_roles);
    PERFORM public._set_module_rls('dispatches', sales_roles);
    PERFORM public._set_module_rls('dispatch_items', sales_roles);
    PERFORM public._set_module_rls('sales_returns', sales_roles);
    PERFORM public._set_module_rls('sales_return_items', sales_roles);
    PERFORM public._set_module_rls('payment_receipts', sales_roles);
    PERFORM public._set_module_rls('payment_schedules', sales_roles);
    PERFORM public._set_module_rls('price_lists', sales_roles);
    PERFORM public._set_module_rls('price_list_items', sales_roles);

    -- Sales <-> Stores handoff: sales requests, waybills — both sides need
    -- full access, matching routePermissions['/sales/requests'].
    PERFORM public._set_module_rls('requisitions', sales_store_roles);
    PERFORM public._set_module_rls('requisition_items', sales_store_roles);
    PERFORM public._set_module_rls('waybills', sales_store_roles);
    PERFORM public._set_module_rls('waybill_items', sales_store_roles);

    -- Shared reference data: broad read (any active employee), narrow write.
    PERFORM public._set_reference_rls('products', stores_roles);
    PERFORM public._set_reference_rls('suppliers', purchasing_roles);
    PERFORM public._set_reference_rls('vans', sales_roles);
    PERFORM public._set_reference_rls('routes', sales_roles);
    PERFORM public._set_reference_rls('sales_reps', sales_roles);
    PERFORM public._set_reference_rls('stock_locations', operations_roles);

    -- Inventory movement — genuinely cross-module (sales van loads, store
    -- transfers, purchasing receipts, production consumption all touch
    -- these), so kept intentionally broad rather than guessed too narrow.
    PERFORM public._set_module_rls('stock_levels', operations_roles);
    PERFORM public._set_module_rls('stock_movements', operations_roles);
    PERFORM public._set_module_rls('stock_transfers', operations_roles);
    PERFORM public._set_module_rls('stock_transfer_items', operations_roles);
    PERFORM public._set_module_rls('stock_internal_use', stores_qa_roles);
    PERFORM public._set_module_rls('stock_material_defects', stores_qa_roles);
    PERFORM public._set_module_rls('stock_material_expiry', stores_qa_roles);

    -- Stores-owned documents.
    PERFORM public._set_module_rls('purchase_requests', stores_roles);
    PERFORM public._set_module_rls('purchase_request_items', stores_roles);

    -- Purchasing.
    PERFORM public._set_module_rls('purchase_orders', purchasing_roles);
    PERFORM public._set_module_rls('purchase_order_items', purchasing_roles);
    PERFORM public._set_module_rls('supplier_payments', purchasing_roles);

    -- Goods receipt / QA inspection — both names handled since the live
    -- schema may use either 'grn'/'grn_items' or 'goods_receipts'/
    -- 'goods_receipt_items' (both were found referenced in this codebase).
    PERFORM public._set_module_rls('grn', grn_roles);
    PERFORM public._set_module_rls('grn_items', grn_roles);
    PERFORM public._set_module_rls('goods_receipts', grn_roles);
    PERFORM public._set_module_rls('goods_receipt_items', grn_roles);

    -- Production.
    PERFORM public._set_module_rls('production_orders', production_roles);
    PERFORM public._set_module_rls('production_order_items', production_roles);
    PERFORM public._set_module_rls('bill_of_materials', production_roles);
    PERFORM public._set_module_rls('bom_items', production_roles);
    PERFORM public._set_module_rls('material_requests', production_roles);
    PERFORM public._set_module_rls('material_request_items', production_roles);

    -- Quality Assurance.
    PERFORM public._set_module_rls('qa_in_process', qa_roles);
    PERFORM public._set_module_rls('qa_finished_products', qa_roles);
    PERFORM public._set_module_rls('qa_internal_reports', qa_roles);
    PERFORM public._set_module_rls('qa_internal_report_items', qa_roles);

    -- Accounting / finance. (bank_statements, journal_entries, system_settings,
    -- weekly_reports, system_users are already handled by
    -- 20260421000100_harden_sensitive_access.sql — not touched here.)
    PERFORM public._set_module_rls('chart_of_accounts', accounting_roles);
    PERFORM public._set_module_rls('expenses', accounting_roles);
    PERFORM public._set_module_rls('petty_cash', accounting_roles);
    PERFORM public._set_module_rls('tax_periods', accounting_roles);
    PERFORM public._set_module_rls('bank_accounts', accounting_roles);
    PERFORM public._set_module_rls('bank_transactions', accounting_roles);

    -- HR. payroll_records carries the same role set as the rest of HR here,
    -- matching routePermissions.ts['/hr'] as written today — tighten this to
    -- ['Super Admin','HR Manager'] separately if Accountant shouldn't see
    -- individual pay records in practice.
    PERFORM public._set_module_rls('employees', hr_roles);
    PERFORM public._set_module_rls('attendance_records', hr_roles);
    PERFORM public._set_module_rls('leave_requests', hr_roles);
    PERFORM public._set_module_rls('payroll_records', hr_roles);

    -- Internal Audit — Managing Director gets read-only oversight via
    -- p_select_extra_roles rather than full write access.
    PERFORM public._set_module_rls('internal_audits', audit_roles, ARRAY['Managing Director']);
    PERFORM public._set_module_rls('audit_reports', audit_roles, ARRAY['Managing Director']);
    PERFORM public._set_module_rls('non_conformances', audit_roles, ARRAY['Managing Director']);

    -- Legacy/duplicate audit table (the app writes to the *singular*
    -- `audit_log`, which already has its own correct policies from
    -- 20260526000004_system_audit_trail.sql — this is the plural table that
    -- showed up in the old blanket-access array with no evidence anything
    -- still writes to it). Read-only for oversight roles; no client write
    -- policy at all, so only the service role can write it if anything does.
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'audit_logs') THEN
        PERFORM public._set_module_rls('audit_logs', admin_only_roles, ARRAY['Managing Director','Internal Auditor']);
        EXECUTE 'DROP POLICY IF EXISTS audit_logs_insert_role ON public.audit_logs';
        EXECUTE 'DROP POLICY IF EXISTS audit_logs_update_role ON public.audit_logs';
        EXECUTE 'DROP POLICY IF EXISTS audit_logs_delete_role ON public.audit_logs';
    END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 3b. notifications — per-user table, not role-based like the rest.
-- Its CREATE TABLE was never found in this repo's tracked SQL (another
-- dashboard-created table), so its owner column is guessed as `user_id uuid`
-- (the same convention audit_log/department_activity_logs use) rather than
-- confirmed. Wrapped in its own exception handler so a wrong guess here
-- can't fail the rest of this migration — check the WARNING in the migration
-- output if this block doesn't apply cleanly, and fix the column name below.
-- ----------------------------------------------------------------------------

DO $$
DECLARE
    policy_name text;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'notifications') THEN
        RETURN;
    END IF;

    ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

    FOR policy_name IN
        SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'notifications'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.notifications', policy_name);
    END LOOP;

    -- Owner can read/update (e.g. mark-as-read) their own notifications;
    -- Super Admin/Managing Director can see everything for oversight.
    -- user_id is matched against both auth.uid() directly and against
    -- system_users.id (via auth_user_id), since either convention is
    -- plausible and this schema wasn't directly inspectable.
    EXECUTE $sql$
        CREATE POLICY notifications_select_own_or_admin
        ON public.notifications FOR SELECT TO authenticated
        USING (
            public.app_role_ok(ARRAY['Super Admin','Managing Director'])
            OR user_id = auth.uid()
            OR user_id = (SELECT id FROM public.system_users WHERE auth_user_id = auth.uid())
        )
    $sql$;

    -- Any active employee may create a notification (e.g. notifying a
    -- manager about a new request) — low severity if abused (spam, not data
    -- exposure), so kept permissive rather than risk breaking a legitimate
    -- cross-user notify flow this review couldn't fully trace.
    EXECUTE $sql$
        CREATE POLICY notifications_insert_any_active
        ON public.notifications FOR INSERT TO authenticated
        WITH CHECK (public.current_app_user_active())
    $sql$;

    EXECUTE $sql$
        CREATE POLICY notifications_update_own_or_admin
        ON public.notifications FOR UPDATE TO authenticated
        USING (
            public.app_role_ok(ARRAY['Super Admin','Managing Director'])
            OR user_id = auth.uid()
            OR user_id = (SELECT id FROM public.system_users WHERE auth_user_id = auth.uid())
        )
        WITH CHECK (
            public.app_role_ok(ARRAY['Super Admin','Managing Director'])
            OR user_id = auth.uid()
            OR user_id = (SELECT id FROM public.system_users WHERE auth_user_id = auth.uid())
        )
    $sql$;

    EXECUTE $sql$
        CREATE POLICY notifications_delete_own_or_admin
        ON public.notifications FOR DELETE TO authenticated
        USING (
            public.app_role_ok(ARRAY['Super Admin','Managing Director'])
            OR user_id = auth.uid()
            OR user_id = (SELECT id FROM public.system_users WHERE auth_user_id = auth.uid())
        )
    $sql$;
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Skipped notifications RLS — schema did not match the expected user_id column (%). Fix and re-run this block manually.', SQLERRM;
END $$;

-- ----------------------------------------------------------------------------
-- 4. Verification — run this after applying, and treat any row it returns
--    as a table this migration didn't cover. (Safe to run any time; it only
--    reads pg_policies.)
-- ----------------------------------------------------------------------------

-- SELECT tablename, policyname, cmd, qual
-- FROM pg_policies
-- WHERE schemaname = 'public'
--   AND (qual = 'true' OR qual ILIKE '%using (true)%' OR with_check = 'true')
-- ORDER BY tablename;
