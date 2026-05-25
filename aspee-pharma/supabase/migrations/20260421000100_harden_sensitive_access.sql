-- Harden access to critical tables and storage objects.

CREATE OR REPLACE FUNCTION public.current_app_user_email()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT lower(coalesce(auth.jwt() ->> 'email', ''));
$$;

CREATE OR REPLACE FUNCTION public.current_app_user_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT su.role
  FROM public.system_users su
  WHERE su.auth_user_id = auth.uid()
     OR lower(su.email) = public.current_app_user_email()
  ORDER BY CASE WHEN su.auth_user_id = auth.uid() THEN 0 ELSE 1 END
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.current_app_user_department()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT su.department
  FROM public.system_users su
  WHERE su.auth_user_id = auth.uid()
     OR lower(su.email) = public.current_app_user_email()
  ORDER BY CASE WHEN su.auth_user_id = auth.uid() THEN 0 ELSE 1 END
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.has_any_app_role(roles text[])
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(public.current_app_user_role() = ANY(roles), false);
$$;

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
     OR lower(coalesce(NEW.email, '')) IS DISTINCT FROM lower(coalesce(OLD.email, '')) THEN
    RAISE EXCEPTION 'You are not allowed to modify protected account fields.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_system_users_update ON public.system_users;
CREATE TRIGGER trg_guard_system_users_update
BEFORE UPDATE ON public.system_users
FOR EACH ROW
EXECUTE FUNCTION public.guard_system_users_update();

ALTER TABLE public.system_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_statements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  policy_name text;
  target_table text;
BEGIN
  FOREACH target_table IN ARRAY ARRAY['system_users', 'system_settings', 'weekly_reports', 'bank_statements', 'journal_entries']
  LOOP
    FOR policy_name IN
      SELECT policyname
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = target_table
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', policy_name, target_table);
    END LOOP;
  END LOOP;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'entity_documents') THEN
    ALTER TABLE public.entity_documents ENABLE ROW LEVEL SECURITY;
    FOR policy_name IN
      SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'entity_documents'
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.entity_documents', policy_name);
    END LOOP;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'regulatory_documents') THEN
    ALTER TABLE public.regulatory_documents ENABLE ROW LEVEL SECURITY;
    FOR policy_name IN
      SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'regulatory_documents'
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.regulatory_documents', policy_name);
    END LOOP;
  END IF;
END $$;

CREATE POLICY system_users_select_self_or_admin
ON public.system_users
FOR SELECT
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND (
    auth_user_id = auth.uid()
    OR lower(email) = public.current_app_user_email()
    OR public.has_any_app_role(ARRAY['Super Admin', 'Managing Director', 'HR Manager'])
  )
);

CREATE POLICY system_users_update_self_or_admin
ON public.system_users
FOR UPDATE
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND (
    auth_user_id = auth.uid()
    OR lower(email) = public.current_app_user_email()
    OR public.has_any_app_role(ARRAY['Super Admin', 'Managing Director', 'HR Manager'])
  )
)
WITH CHECK (
  auth.uid() IS NOT NULL
  AND (
    auth_user_id = auth.uid()
    OR lower(email) = public.current_app_user_email()
    OR public.has_any_app_role(ARRAY['Super Admin', 'Managing Director', 'HR Manager'])
  )
);

CREATE POLICY system_users_delete_admin_only
ON public.system_users
FOR DELETE
TO authenticated
USING (public.has_any_app_role(ARRAY['Super Admin', 'Managing Director']));

CREATE POLICY system_settings_read_limited
ON public.system_settings
FOR SELECT
TO authenticated
USING (
  public.has_any_app_role(ARRAY['Super Admin', 'Managing Director', 'Accountant', 'Sales Manager'])
);

CREATE POLICY system_settings_write_admin_only
ON public.system_settings
FOR ALL
TO authenticated
USING (public.has_any_app_role(ARRAY['Super Admin', 'Managing Director']))
WITH CHECK (public.has_any_app_role(ARRAY['Super Admin', 'Managing Director']));

CREATE POLICY weekly_reports_select_department_or_admin
ON public.weekly_reports
FOR SELECT
TO authenticated
USING (
  public.has_any_app_role(ARRAY['Super Admin', 'Managing Director', 'Internal Auditor'])
  OR department = public.current_app_user_department()
);

CREATE POLICY weekly_reports_insert_department_or_admin
ON public.weekly_reports
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_any_app_role(ARRAY['Super Admin', 'Managing Director'])
  OR department = public.current_app_user_department()
);

CREATE POLICY weekly_reports_update_department_or_admin
ON public.weekly_reports
FOR UPDATE
TO authenticated
USING (
  public.has_any_app_role(ARRAY['Super Admin', 'Managing Director'])
  OR department = public.current_app_user_department()
)
WITH CHECK (
  public.has_any_app_role(ARRAY['Super Admin', 'Managing Director'])
  OR department = public.current_app_user_department()
);

CREATE POLICY bank_statements_accounting_only
ON public.bank_statements
FOR ALL
TO authenticated
USING (public.has_any_app_role(ARRAY['Super Admin', 'Managing Director', 'Accountant']))
WITH CHECK (public.has_any_app_role(ARRAY['Super Admin', 'Managing Director', 'Accountant']));

CREATE POLICY journal_entries_accounting_only
ON public.journal_entries
FOR ALL
TO authenticated
USING (public.has_any_app_role(ARRAY['Super Admin', 'Managing Director', 'Accountant']))
WITH CHECK (public.has_any_app_role(ARRAY['Super Admin', 'Managing Director', 'Accountant']));

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'entity_documents') THEN
    EXECUTE $sql$
      CREATE POLICY entity_documents_role_scoped
      ON public.entity_documents
      FOR ALL
      TO authenticated
      USING (
        public.has_any_app_role(ARRAY['Super Admin', 'Managing Director', 'Internal Auditor'])
        OR (entity_type = 'employee' AND public.has_any_app_role(ARRAY['HR Manager']))
        OR (entity_type = 'customer' AND public.has_any_app_role(ARRAY['Sales Manager']))
      )
      WITH CHECK (
        public.has_any_app_role(ARRAY['Super Admin', 'Managing Director', 'Internal Auditor'])
        OR (entity_type = 'employee' AND public.has_any_app_role(ARRAY['HR Manager']))
        OR (entity_type = 'customer' AND public.has_any_app_role(ARRAY['Sales Manager']))
      )
    $sql$;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'regulatory_documents') THEN
    EXECUTE $sql$
      CREATE POLICY regulatory_documents_admin_only
      ON public.regulatory_documents
      FOR ALL
      TO authenticated
      USING (public.has_any_app_role(ARRAY['Super Admin', 'Managing Director', 'Internal Auditor']))
      WITH CHECK (public.has_any_app_role(ARRAY['Super Admin', 'Managing Director', 'Internal Auditor']))
    $sql$;
  END IF;
END $$;

DO $$
DECLARE
  policy_name text;
BEGIN
  FOR policy_name IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname LIKE 'compliance_documents_%'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', policy_name);
  END LOOP;
END $$;

CREATE POLICY compliance_documents_select_restricted
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'compliance-documents'
  AND public.has_any_app_role(ARRAY['Super Admin', 'Managing Director', 'Internal Auditor', 'HR Manager', 'Sales Manager'])
);

CREATE POLICY compliance_documents_insert_restricted
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'compliance-documents'
  AND public.has_any_app_role(ARRAY['Super Admin', 'Managing Director', 'Internal Auditor', 'HR Manager', 'Sales Manager'])
);

CREATE POLICY compliance_documents_update_restricted
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'compliance-documents'
  AND public.has_any_app_role(ARRAY['Super Admin', 'Managing Director', 'Internal Auditor', 'HR Manager', 'Sales Manager'])
)
WITH CHECK (
  bucket_id = 'compliance-documents'
  AND public.has_any_app_role(ARRAY['Super Admin', 'Managing Director', 'Internal Auditor', 'HR Manager', 'Sales Manager'])
);

CREATE POLICY compliance_documents_delete_restricted
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'compliance-documents'
  AND public.has_any_app_role(ARRAY['Super Admin', 'Managing Director', 'Internal Auditor', 'HR Manager', 'Sales Manager'])
);
