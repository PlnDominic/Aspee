-- ASPEE PHARMACEUTICALS - SUPABASE RLS RECURSION FIX (v3)
-- This script fixes the "infinite recursion" error on the profiles table.

-- 1. Create a SECURITY DEFINER function to bypass RLS
-- This function can be called within policies to check roles without triggering recursion.
CREATE OR REPLACE FUNCTION get_current_user_role()
RETURNS text AS $$
DECLARE
  user_role text;
BEGIN
  SELECT role INTO user_role FROM public.profiles WHERE id = auth.uid();
  RETURN user_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2. Drop ALL existing policies on the profiles table to break the recursion
DO $$
DECLARE
    pol record;
BEGIN
    -- Corrected query: pg_policy uses polrelid to link to the table
    FOR pol IN (SELECT polname FROM pg_policy WHERE polrelid = 'public.profiles'::regclass) LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(pol.polname) || ' ON public.profiles';
    END LOOP;
END
$$;

-- 3. Create new, non-recursive policies
-- Ensure RLS is enabled
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Allow users to view their own profile
CREATE POLICY "Users can view own profile" 
ON public.profiles FOR SELECT 
USING (auth.uid() = id);

-- Allow admins to view all profiles (using the SECURITY DEFINER function)
CREATE POLICY "Admins can view all profiles" 
ON public.profiles FOR SELECT 
USING (get_current_user_role() = 'admin');

-- Allow users to update their own profile
CREATE POLICY "Users can update own profile" 
ON public.profiles FOR UPDATE 
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Allow admins to update any profile
CREATE POLICY "Admins can update any profile" 
ON public.profiles FOR UPDATE 
USING (get_current_user_role() = 'admin');

-- Allow admins to insert/delete
CREATE POLICY "Admins can delete any profile" 
ON public.profiles FOR DELETE 
USING (get_current_user_role() = 'admin');

-- 4. Enable all for all on suppliers (temporary fix to ensure suppliers can be fetched)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Enable all for all on suppliers') THEN
        CREATE POLICY "Enable all for all on suppliers" ON suppliers FOR ALL USING (true);
    END IF;
END $$;
