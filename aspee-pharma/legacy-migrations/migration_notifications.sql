-- ============================================================
-- Migration: Notifications System
-- Adds support for: System Notifications, Cross-module alerts
-- ============================================================

-- 1. Create Notifications Table
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT DEFAULT 'info', -- 'info', 'success', 'warning', 'error'
    target_role TEXT, -- e.g., 'Stores', 'QA', 'Sales' or NULL for all
    link TEXT, -- URL to redirect when clicked
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Add RLS Policies
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Enable all for all on notifications') THEN
        CREATE POLICY "Enable all for all on notifications" ON notifications FOR ALL USING (true);
    END IF;
END
$$;

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_notifications_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_notifications_timestamp ON notifications;
CREATE TRIGGER update_notifications_timestamp
    BEFORE UPDATE ON notifications
    FOR EACH ROW
    EXECUTE FUNCTION update_notifications_updated_at();

-- ============================================================
-- 2. Trigger: Purchase Order Approved -> Notify Stores (GRN Pending)
-- ============================================================
-- This function runs whenever a purchase_orders row is updated
CREATE OR REPLACE FUNCTION notify_on_po_approval()
RETURNS TRIGGER AS $$
BEGIN
    -- Only trigger if the status CHANGED TO 'Approved'
    IF NEW.status = 'Approved' AND OLD.status != 'Approved' THEN
        INSERT INTO notifications (
            title, 
            message, 
            type, 
            target_role, 
            link
        ) VALUES (
            'Purchase Order Approved',
            'PO ' || NEW.po_number || ' has been approved. Pending Goods Receipt (GRN).',
            'info',
            'Stores',
            '/purchasing/grn'
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_notify_po_approval ON purchase_orders;
CREATE TRIGGER trg_notify_po_approval
    AFTER UPDATE ON purchase_orders
    FOR EACH ROW
    EXECUTE FUNCTION notify_on_po_approval();
