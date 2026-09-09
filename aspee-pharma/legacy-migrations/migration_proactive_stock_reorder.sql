-- ============================================================
-- Migration: Proactive Stock Reorder Notifications
-- Auto-notify Procurement when stock drops to/below reorder level
-- ============================================================

-- 1. Create function to check and notify low stock
CREATE OR REPLACE FUNCTION notify_on_low_stock()
RETURNS TRIGGER AS $$
DECLARE
    prod_record RECORD;
    reorder_lvl INTEGER;
    current_qty INTEGER;
    notification_key TEXT;
    one_hour_ago TIMESTAMPTZ;
    existing_notification BOOLEAN;
BEGIN
    -- Only proceed if qty_on_hand changed and is now at or below reorder level
    IF NEW.qty_on_hand IS NOT NULL AND NEW.qty_on_hand != OLD.qty_on_hand THEN
        -- Get product info and reorder level
        SELECT p.name, p.reorder_level INTO prod_record
        FROM products p
        WHERE p.id = NEW.product_id;

        IF prod_record IS NULL THEN
            RETURN NEW;
        END IF;

        reorder_lvl := COALESCE(prod_record.reorder_level, 0);
        current_qty := NEW.qty_on_hand;

        -- Only notify if current qty is at or below reorder level
        IF current_qty <= reorder_lvl AND reorder_lvl > 0 THEN
            -- Create a unique key to prevent duplicate notifications
            notification_key := 'low_stock_' || NEW.product_id::TEXT || '_' || NEW.location_id::TEXT;
            one_hour_ago := NOW() - INTERVAL '1 hour';

            -- Check if we already sent a notification for this product/location in the last hour
            SELECT EXISTS (
                SELECT 1 FROM notifications 
                WHERE title = 'Low Stock Alert' 
                AND message LIKE '%' || prod_record.name || '%'
                AND created_at >= one_hour_ago
            ) INTO existing_notification;

            IF NOT existing_notification THEN
                INSERT INTO notifications (
                    title,
                    message,
                    type,
                    target_role,
                    link
                ) VALUES (
                    'Low Stock Alert',
                    prod_record.name || ' is at ' || current_qty || ' units (reorder level: ' || reorder_lvl || '). Consider placing a purchase order.',
                    CASE WHEN current_qty = 0 THEN 'error' ELSE 'warning' END,
                    'Procurement',
                    '/stores/stock'
                );
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Create trigger on stock_levels
DROP TRIGGER IF EXISTS trg_notify_low_stock ON stock_levels;
CREATE TRIGGER trg_notify_low_stock
    AFTER INSERT OR UPDATE OF qty_on_hand ON stock_levels
    FOR EACH ROW
    EXECUTE FUNCTION notify_on_low_stock();

-- 3. Also create a function to check ALL stock levels and notify (can be run manually or on schedule)
CREATE OR REPLACE FUNCTION check_all_low_stock()
RETURNS void AS $$
DECLARE
    stock_rec RECORD;
    prod_record RECORD;
    notification_key TEXT;
    one_hour_ago TIMESTAMPTZ;
    existing_notification BOOLEAN;
BEGIN
    one_hour_ago := NOW() - INTERVAL '1 hour';

    FOR stock_rec IN
        SELECT sl.product_id, sl.location_id, sl.qty_on_hand, p.name, p.reorder_level
        FROM stock_levels sl
        JOIN products p ON p.id = sl.product_id
        WHERE p.reorder_level > 0
        AND sl.qty_on_hand <= p.reorder_level
    LOOP
        -- Check for existing recent notification
        SELECT EXISTS (
            SELECT 1 FROM notifications 
            WHERE title = 'Low Stock Alert' 
            AND message LIKE '%' || stock_rec.name || '%'
            AND created_at >= one_hour_ago
        ) INTO existing_notification;

        IF NOT existing_notification THEN
            INSERT INTO notifications (
                title,
                message,
                type,
                target_role,
                link
            ) VALUES (
                'Low Stock Alert',
                stock_rec.name || ' is at ' || stock_rec.qty_on_hand || ' units (reorder level: ' || stock_rec.reorder_level || '). Consider placing a purchase order.',
                CASE WHEN stock_rec.qty_on_hand = 0 THEN 'error' ELSE 'warning' END,
                'Procurement',
                '/stores/stock'
            );
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;
