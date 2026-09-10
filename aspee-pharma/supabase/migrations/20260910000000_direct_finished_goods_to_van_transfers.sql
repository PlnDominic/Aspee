-- ============================================================================
-- Stock transfers now go straight from Finished Goods Store to a sales rep's
-- van/route — the Sales Department intermediate hop enforced by
-- 20260525130531_transactional_stock_transfer_posting.sql
-- (app_private.validate_stock_transfer_flow) is no longer how the business
-- operates. That function raised an exception on any Stores -> Van transfer
-- that didn't originate from "Sales Department", which the app's own
-- TransferModal.tsx rep-destination flow already tries to do directly (see
-- fromIsFinishedGoods in that component) — so this migration brings the DB
-- guard in line with the app, rather than changing behavior on its own.
--
-- Van-to-van transfers stay blocked; that rule is unrelated to the Sales
-- Department hop and still holds. The "must come from a single named
-- location" shape of the old guard is kept, just re-anchored on Finished
-- Goods Store instead of Sales Department, matching src/lib/vanStock.ts's
-- FINISHED_GOODS_LOCATION_NAME.
-- ============================================================================

CREATE OR REPLACE FUNCTION app_private.is_finished_goods_location(location_uuid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.stock_locations
        WHERE id = location_uuid
          AND lower(coalesce(name, '')) = 'finished goods store'
    );
$$;

CREATE OR REPLACE FUNCTION app_private.validate_stock_transfer_flow(
    from_location_uuid uuid,
    to_location_uuid uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app_private
AS $$
DECLARE
    from_exists boolean;
    to_exists boolean;
BEGIN
    SELECT EXISTS (SELECT 1 FROM public.stock_locations WHERE id = from_location_uuid)
    INTO from_exists;

    SELECT EXISTS (SELECT 1 FROM public.stock_locations WHERE id = to_location_uuid)
    INTO to_exists;

    IF NOT from_exists OR NOT to_exists THEN
        RAISE EXCEPTION 'Selected transfer locations could not be verified.';
    END IF;

    IF from_location_uuid = to_location_uuid THEN
        RAISE EXCEPTION 'Transfer source and destination must be different.';
    END IF;

    IF app_private.is_van_stock_location(to_location_uuid)
       AND NOT app_private.is_finished_goods_location(from_location_uuid) THEN
        RAISE EXCEPTION 'Vans can only be loaded directly from Finished Goods Store.';
    END IF;

    IF app_private.is_van_stock_location(from_location_uuid)
       AND app_private.is_van_stock_location(to_location_uuid) THEN
        RAISE EXCEPTION 'Van-to-van transfers are not allowed.';
    END IF;
END;
$$;
