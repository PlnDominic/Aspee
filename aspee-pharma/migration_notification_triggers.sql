-- ============================================================
-- Migration: Additional Notification Triggers
-- Adds: GRN QA status, Low Stock, Invoice Overdue, Production Order
-- ============================================================

-- 1. Add request_type column to material_requests if missing
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'material_requests' AND column_name = 'request_type'
    ) THEN
        ALTER TABLE material_requests ADD COLUMN request_type TEXT DEFAULT 'All';
    END IF;
END
$$;

-- ============================================================
-- 2. GRN QA Rejected/Quarantined → Notify Warehouse
-- ============================================================
CREATE OR REPLACE FUNCTION notify_on_grn_qa_result()
RETURNS TRIGGER AS $$
BEGIN
    -- Only trigger if qa_status CHANGED TO 'Rejected' or 'Quarantine'
    IF NEW.qa_status = 'Rejected' AND (OLD.qa_status IS NULL OR OLD.qa_status != 'Rejected') THEN
        INSERT INTO notifications (title, message, type, target_role, link)
        VALUES (
            'GRN Rejected by QA',
            'GRN ' || COALESCE(NEW.grn_number, NEW.id::TEXT) || ' has been rejected by QA.' ||
            CASE WHEN NEW.qa_remarks IS NOT NULL THEN ' Remarks: ' || NEW.qa_remarks ELSE '' END,
            'error',
            'Warehouse',
            '/purchasing/grn'
        );
    ELSIF NEW.qa_status = 'Quarantine' AND (OLD.qa_status IS NULL OR OLD.qa_status != 'Quarantine') THEN
        INSERT INTO notifications (title, message, type, target_role, link)
        VALUES (
            'GRN Sent to Quarantine',
            'GRN ' || COALESCE(NEW.grn_number, NEW.id::TEXT) || ' has been quarantined by QA.' ||
            CASE WHEN NEW.qa_remarks IS NOT NULL THEN ' Remarks: ' || NEW.qa_remarks ELSE '' END,
            'warning',
            'Warehouse',
            '/purchasing/grn'
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_notify_grn_qa_result ON grn;
CREATE TRIGGER trg_notify_grn_qa_result
    AFTER UPDATE ON grn
    FOR EACH ROW
    EXECUTE FUNCTION notify_on_grn_qa_result();

-- ============================================================
-- 3. Low Stock Alert → Notify Procurement (when stock drops to/below reorder level)
-- ============================================================
CREATE OR REPLACE FUNCTION notify_on_low_stock()
RETURNS TRIGGER AS $$
DECLARE
    prod_name TEXT;
    reorder_lvl INTEGER;
    recent_exists BOOLEAN;
BEGIN
    -- Only trigger on stock decrease
    IF NEW.qty_on_hand < OLD.qty_on_hand THEN
        SELECT name, reorder_level INTO prod_name, reorder_lvl
        FROM products WHERE id = NEW.product_id;

        IF reorder_lvl IS NOT NULL AND reorder_lvl > 0 AND NEW.qty_on_hand <= reorder_lvl THEN
            -- Deduplicate: check if this same alert was sent in the last hour
            SELECT EXISTS (
                SELECT 1 FROM notifications
                WHERE title = 'Low Stock Alert'
                AND message LIKE '%' || prod_name || '%'
                AND created_at > NOW() - INTERVAL '1 hour'
            ) INTO recent_exists;

            IF NOT recent_exists THEN
                INSERT INTO notifications (title, message, type, target_role, link)
                VALUES (
                    'Low Stock Alert',
                    prod_name || ' is at ' || NEW.qty_on_hand || ' units (reorder level: ' || reorder_lvl || '). Consider placing a purchase order.',
                    CASE WHEN NEW.qty_on_hand = 0 THEN 'error' ELSE 'warning' END,
                    'Procurement',
                    '/stores/stock'
                );
            END IF;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_notify_low_stock ON stock_levels;
CREATE TRIGGER trg_notify_low_stock
    AFTER UPDATE ON stock_levels
    FOR EACH ROW
    EXECUTE FUNCTION notify_on_low_stock();

-- ============================================================
-- 4. Production Order Status → Notify Production / Stores
-- ============================================================
CREATE OR REPLACE FUNCTION notify_on_production_order_status()
RETURNS TRIGGER AS $$
DECLARE
    prod_name TEXT;
BEGIN
    SELECT name INTO prod_name FROM products WHERE id = NEW.product_id;

    -- Released → Notify Production to start
    IF NEW.status = 'Released' AND OLD.status != 'Released' THEN
        INSERT INTO notifications (title, message, type, target_role, link)
        VALUES (
            'Job Order Released',
            'Job Order ' || NEW.order_number || ' for ' || COALESCE(prod_name, 'Unknown') || ' (' || NEW.quantity || ' units) has been released for production.',
            'info',
            'Production',
            '/production'
        );
    -- Completed → Notify Warehouse of finished goods
    ELSIF NEW.status = 'Completed' AND OLD.status != 'Completed' THEN
        INSERT INTO notifications (title, message, type, target_role, link)
        VALUES (
            'Finished Goods Ready',
            'Job Order ' || NEW.order_number || ': ' || NEW.quantity || ' units of ' || COALESCE(prod_name, 'Unknown') || ' have been transferred to Finished Goods.',
            'success',
            'Warehouse',
            '/stores/stock'
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_notify_production_order_status ON production_orders;
CREATE TRIGGER trg_notify_production_order_status
    AFTER UPDATE ON production_orders
    FOR EACH ROW
    EXECUTE FUNCTION notify_on_production_order_status();

-- ============================================================
-- 5. Material Request Status → Notify Production when Stores issues
-- (This trigger already exists in migration_material_request_notifications.sql
--  but adding it here as a safety net in case that migration wasn't applied)
-- ============================================================
CREATE OR REPLACE FUNCTION notify_on_material_request_issued_v2()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'Issued' AND (OLD.status IS NULL OR OLD.status != 'Issued') THEN
        INSERT INTO notifications (title, message, type, target_role, link)
        VALUES (
            'Materials Issued',
            'Materials for request ' || NEW.request_number || ' have been issued by Stores and are ready for collection.',
            'success',
            'Production',
            '/production/material-requests'
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Only create if the old trigger doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'trg_notify_material_request_issued'
    ) THEN
        CREATE TRIGGER trg_notify_material_request_issued
            AFTER UPDATE ON material_requests
            FOR EACH ROW
            EXECUTE FUNCTION notify_on_material_request_issued_v2();
    END IF;
END
$$;

-- ============================================================
-- 6. New Material Request → Notify Stores
-- ============================================================
CREATE OR REPLACE FUNCTION notify_on_material_request_created()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO notifications (title, message, type, target_role, link)
    VALUES (
        'New Material Request',
        'Material Request ' || NEW.request_number || ' (' || COALESCE(NEW.request_type, 'All') || ') has been submitted by Production. Priority: ' || COALESCE(NEW.priority, 'Medium'),
        CASE WHEN NEW.priority = 'Urgent' THEN 'error' WHEN NEW.priority = 'High' THEN 'warning' ELSE 'info' END,
        'Stores',
        '/stores/stock'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_notify_material_request_created ON material_requests;
CREATE TRIGGER trg_notify_material_request_created
    AFTER INSERT ON material_requests
    FOR EACH ROW
    EXECUTE FUNCTION notify_on_material_request_created();
