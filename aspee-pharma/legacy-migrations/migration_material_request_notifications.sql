-- ============================================================
-- Migration: Material Request Notifications
-- Notify Production when Stores issues materials
-- ============================================================

CREATE OR REPLACE FUNCTION notify_on_material_request_issued()
RETURNS TRIGGER AS $$
BEGIN
    -- Only trigger if the status CHANGED TO 'Issued'
    IF NEW.status = 'Issued' AND OLD.status != 'Issued' THEN
        INSERT INTO notifications (
            title, 
            message, 
            type, 
            target_role, 
            link
        ) VALUES (
            'Materials Issued',
            'Materials for request ' || NEW.request_number || ' have been issued and are ready for production.',
            'success',
            'Production',
            '/production/material-requests'
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_notify_material_request_issued ON material_requests;
CREATE TRIGGER trg_notify_material_request_issued
    AFTER UPDATE ON material_requests
    FOR EACH ROW
    EXECUTE FUNCTION notify_on_material_request_issued();
