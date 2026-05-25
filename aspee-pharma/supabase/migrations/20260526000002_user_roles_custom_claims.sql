-- Custom Claims for Role-Based Access Control
-- This migration syncs the 'role' from public.system_users to auth.users app_metadata.
-- This allows the Next.js middleware to check roles WITHOUT a database query.

CREATE OR REPLACE FUNCTION app_private.sync_user_role_to_claims()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
    -- Update the auth.users table with the new role in app_metadata
    -- This will be included in the next JWT issued to the user.
    UPDATE auth.users
    SET raw_app_meta_data = 
        coalesce(raw_app_meta_data, '{}'::jsonb) || 
        jsonb_build_object('role', NEW.role)
    WHERE email = NEW.email;
    
    RETURN NEW;
END;
$$;

-- Trigger on system_users to keep claims in sync
DROP TRIGGER IF EXISTS tr_sync_user_role ON public.system_users;
CREATE TRIGGER tr_sync_user_role
AFTER INSERT OR UPDATE OF role ON public.system_users
FOR EACH ROW
EXECUTE FUNCTION app_private.sync_user_role_to_claims();

-- Initialize existing users
DO $$
DECLARE
    r record;
BEGIN
    FOR r IN SELECT email, role FROM public.system_users LOOP
        UPDATE auth.users
        SET raw_app_meta_data = 
            coalesce(raw_app_meta_data, '{}'::jsonb) || 
            jsonb_build_object('role', r.role)
        WHERE email = r.email;
    END LOOP;
END $$;
