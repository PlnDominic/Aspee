-- Security Hardening: Securing Arbitrary SQL Execution
-- This migration secures or removes functions that allow arbitrary SQL execution.

-- 1. Revoke execution from PUBLIC for any such functions that might exist
-- This prevents the 'anon' and 'authenticated' roles from using them via the API.
DO $$
BEGIN
    -- exec_sql
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'exec_sql') THEN
        EXECUTE 'REVOKE EXECUTE ON FUNCTION exec_sql(text) FROM PUBLIC';
        EXECUTE 'REVOKE EXECUTE ON FUNCTION exec_sql(text) FROM authenticated';
        EXECUTE 'REVOKE EXECUTE ON FUNCTION exec_sql(text) FROM anon';
    END IF;

    -- execute_sql
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'execute_sql') THEN
        EXECUTE 'REVOKE EXECUTE ON FUNCTION execute_sql(text) FROM PUBLIC';
        EXECUTE 'REVOKE EXECUTE ON FUNCTION execute_sql(text) FROM authenticated';
        EXECUTE 'REVOKE EXECUTE ON FUNCTION execute_sql(text) FROM anon';
    END IF;
END $$;

-- 2. Drop the functions entirely to be safe
-- We prefer dropping them because migrations should be handled via the Supabase CLI or Dashboard.
DROP FUNCTION IF EXISTS public.exec_sql(text);
DROP FUNCTION IF EXISTS public.execute_sql(text);
DROP FUNCTION IF EXISTS public.run_sql(text);
