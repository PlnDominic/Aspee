-- QA couldn't see Production job orders at all: two separate gates were both
-- missing 'Quality Assurance' —
--   1. the app-layer route/menu permission (src/lib/routePermissions.ts and
--      src/components/Sidebar.tsx), fixed in code, and
--   2. this RLS policy on production_orders / production_order_items, which
--      would have kept blocking every row even after the UI let QA in.
--
-- QA gets read-only oversight access (p_select_extra_roles) — they can see
-- job orders to know what's being produced/which batch they're inspecting,
-- but INSERT/UPDATE/DELETE stays with Production Manager/Store
-- Manager/Accountant/Super Admin exactly as before.

DO $$
DECLARE
    production_roles text[] := ARRAY['Super Admin','Production Manager','Store Manager','Accountant'];
BEGIN
    PERFORM public._set_module_rls('production_orders', production_roles, ARRAY['Quality Assurance']);
    PERFORM public._set_module_rls('production_order_items', production_roles, ARRAY['Quality Assurance']);
END $$;
