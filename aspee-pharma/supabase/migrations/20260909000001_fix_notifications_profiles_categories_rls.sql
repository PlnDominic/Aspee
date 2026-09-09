-- ============================================================================
-- Follow-up to 20260909000000_role_based_rls_policies.sql.
--
-- That migration's `notifications` block guessed a `user_id` owner column
-- that doesn't exist, hit its EXCEPTION handler, and rolled back cleanly —
-- meaning `notifications` was left exactly as it was: fully open
-- ("Enable all for all on notifications", USING (true)) to every
-- authenticated user for SELECT/INSERT/UPDATE/DELETE.
--
-- The verification query at the bottom of that migration also surfaced two
-- tables it never touched at all: `categories` (harmless — pure lookup
-- data) and `profiles` (a legacy, completely unused mirror of system_users
-- — grep across src/ found zero references to it).
--
-- Real schemas, confirmed via information_schema.columns this time instead
-- of guessed:
--
--   notifications: id, title, message, type, target_role, link, is_read,
--                   created_at, updated_at
--     -> no owner column at all. target_role holds a *department* name
--        (e.g. 'Procurement','Warehouse','Finance','QA','Production',
--        'Accounts') or NULL for a global broadcast — confirmed by
--        src/lib/hooks.ts's `target_role.eq.${user.department}` filter and
--        src/lib/notifications.ts's payload shapes. There is no per-user
--        notifications.delete() call anywhere in the app.
--
--   profiles: id, full_name, name, email, role, department, status,
--             created_at, updated_at
--     -> zero references anywhere in src/ (grep confirmed) — dead table
--        left over from an earlier build, duplicating system_users' shape.
--        Locked to Super Admin only; nothing in the app depends on broader
--        access, so this is safe.
--
--   categories: id, name, created_at
--     -> harmless reference data (e.g. product categories). Read stays
--        open to any active employee; write restricted to the roles that
--        plausibly manage product categorization.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- notifications — department-broadcast, not per-user ownership.
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

    -- Visible if it's a global broadcast (target_role IS NULL), targeted at
    -- the caller's own department, or the caller has cross-department
    -- oversight (Super Admin / Managing Director).
    EXECUTE $sql$
        CREATE POLICY notifications_select_department_or_admin
        ON public.notifications FOR SELECT TO authenticated
        USING (
            public.current_app_user_active()
            AND (
                target_role IS NULL
                OR target_role = public.current_app_user_department()
                OR public.app_role_ok(ARRAY['Super Admin','Managing Director'])
            )
        )
    $sql$;

    -- Any active employee can raise a notification for their own workflow
    -- (e.g. Store creating a material request notifies Warehouse) — kept
    -- permissive since the worst case is notification spam, not data
    -- exposure, and this mirrors how src/lib/notifications.ts is called
    -- from many different roles today.
    EXECUTE $sql$
        CREATE POLICY notifications_insert_any_active
        ON public.notifications FOR INSERT TO authenticated
        WITH CHECK (public.current_app_user_active())
    $sql$;

    -- Marking as read only makes sense for a notification you could
    -- actually see.
    EXECUTE $sql$
        CREATE POLICY notifications_update_department_or_admin
        ON public.notifications FOR UPDATE TO authenticated
        USING (
            public.current_app_user_active()
            AND (
                target_role IS NULL
                OR target_role = public.current_app_user_department()
                OR public.app_role_ok(ARRAY['Super Admin','Managing Director'])
            )
        )
        WITH CHECK (
            public.current_app_user_active()
            AND (
                target_role IS NULL
                OR target_role = public.current_app_user_department()
                OR public.app_role_ok(ARRAY['Super Admin','Managing Director'])
            )
        )
    $sql$;

    -- No client code ever deletes a notification (confirmed via grep) —
    -- restricted to admin oversight only, not the receiving department,
    -- since deleting a broadcast/department notification removes it for
    -- everyone who could see it, not just the caller.
    EXECUTE $sql$
        CREATE POLICY notifications_delete_admin_only
        ON public.notifications FOR DELETE TO authenticated
        USING (public.app_role_ok(ARRAY['Super Admin','Managing Director']))
    $sql$;
END $$;

-- ----------------------------------------------------------------------------
-- profiles — unused duplicate of system_users. Lock to Super Admin; nothing
-- in the app reads or writes it, so this cannot break anything currently
-- working. If something turns up later needing it, widen deliberately then.
-- ----------------------------------------------------------------------------

DO $$
DECLARE
    policy_name text;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'profiles') THEN
        RETURN;
    END IF;

    ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

    FOR policy_name IN
        SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'profiles'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.profiles', policy_name);
    END LOOP;

    EXECUTE $sql$
        CREATE POLICY profiles_super_admin_only
        ON public.profiles FOR ALL TO authenticated
        USING (public.app_role_ok(ARRAY['Super Admin']))
        WITH CHECK (public.app_role_ok(ARRAY['Super Admin']))
    $sql$;
END $$;

-- ----------------------------------------------------------------------------
-- categories — harmless reference data. Broad read, narrow write.
-- ----------------------------------------------------------------------------

SELECT public._set_reference_rls('categories', ARRAY['Super Admin','Store Manager','Purchasing Manager']);

-- ----------------------------------------------------------------------------
-- Re-run the same verification query as before — should now return no rows
-- for notifications/profiles/categories. Any other rows are still tables
-- neither this nor the previous migration covered.
-- ----------------------------------------------------------------------------

-- SELECT tablename, policyname, cmd, qual
-- FROM pg_policies
-- WHERE schemaname = 'public'
--   AND (qual = 'true' OR qual ILIKE '%using (true)%' OR with_check = 'true')
-- ORDER BY tablename;
