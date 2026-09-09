-- =====================================================
-- Migration: Create system_users and system_settings
-- Run this in Supabase SQL Editor:
-- https://supabase.com/dashboard/project/hgwubhigvmgrikhpogxg/sql
-- =====================================================

-- 1. system_users table
CREATE TABLE IF NOT EXISTS public.system_users (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    auth_user_id uuid UNIQUE,
    name text NOT NULL,
    email text UNIQUE NOT NULL,
    phone text,
    role text NOT NULL DEFAULT 'Sales Manager',
    department text DEFAULT 'Sales',
    status text NOT NULL DEFAULT 'Active',
    mfa_enabled boolean DEFAULT false,
    last_login timestamptz,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.system_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to system_users"
    ON public.system_users FOR ALL
    USING (true) WITH CHECK (true);

-- 2. system_settings table
CREATE TABLE IF NOT EXISTS public.system_settings (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    key text UNIQUE NOT NULL,
    value text,
    updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to system_settings"
    ON public.system_settings FOR ALL
    USING (true) WITH CHECK (true);
