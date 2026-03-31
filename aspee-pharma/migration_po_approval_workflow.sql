-- ============================================================
-- Migration: PO Approval Workflow
-- Adds approval tracking and threshold-based approval routing
-- ============================================================

-- 1. Add approval fields to purchase_orders
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES profiles(id);
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS approval_level TEXT; -- 'Manager', 'Finance', 'SuperAdmin'
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS approval_notes TEXT;

-- 2. Update status values to include new approval states
-- Note: This assumes existing CHECK constraint - may need manual adjustment
-- We'll handle this in the application logic instead

-- 3. Create function to handle PO approval with threshold checking
CREATE OR REPLACE FUNCTION approve_purchase_order(
    p_po_id UUID,
    p_approved_by UUID,
    p_approval_level TEXT DEFAULT 'Manager',
    p_notes TEXT DEFAULT NULL
)
RETURNS TEXT AS $$
DECLARE
    v_po RECORD;
    v_threshold_finance DECIMAL := 10000; -- GH¢10,000 threshold
    v_current_total DECIMAL;
    v_new_status TEXT;
BEGIN
    -- Get PO details
    SELECT * INTO v_po FROM purchase_orders WHERE id = p_po_id;
    
    IF NOT FOUND THEN
        RETURN 'ERROR: Purchase order not found';
    END IF;
    
    -- Check if already approved
    IF v_po.status IN ('Approved', 'Shipped', 'Received') THEN
        RETURN 'ERROR: PO is already approved or completed';
    END IF;
    
    -- Get the total amount (handle both currency formats)
    v_current_total := COALESCE(v_po.total_amount, 0);
    
    -- Check threshold for Finance approval requirement
    IF v_current_total > v_threshold_finance AND p_approval_level != 'Finance' THEN
        RETURN 'WARNING: POs over GH¢10,000 require Finance approval';
    END IF;
    
    -- Update the PO with approval info
    UPDATE purchase_orders
    SET 
        status = 'Approved',
        approved_by = p_approved_by,
        approved_at = NOW(),
        approval_level = p_approval_level,
        approval_notes = p_notes,
        updated_at = NOW()
    WHERE id = p_po_id;
    
    -- Return success with notification
    RETURN 'SUCCESS: PO approved by ' || p_approval_level;
END;
$$ LANGUAGE plpgsql;

-- 4. Create function to submit PO for approval (creates notification)
CREATE OR REPLACE FUNCTION submit_po_for_approval(p_po_id UUID)
RETURNS TEXT AS $$
DECLARE
    v_po RECORD;
    v_threshold_finance DECIMAL := 10000;
    v_current_total DECIMAL;
BEGIN
    SELECT * INTO v_po FROM purchase_orders WHERE id = p_po_id;
    
    IF NOT FOUND THEN
        RETURN 'ERROR: Purchase order not found';
    END IF;
    
    IF v_po.status != 'Pending' THEN
        RETURN 'ERROR: Only pending POs can be submitted for approval';
    END IF;
    
    v_current_total := COALESCE(v_po.total_amount, 0);
    
    -- Determine who should approve based on amount
    IF v_current_total > v_threshold_finance THEN
        -- Notify Finance for large POs
        INSERT INTO notifications (title, message, type, target_role, link)
        VALUES (
            'PO Requires Finance Approval',
            'PO ' || v_po.po_number || ' (GH¢' || v_current_total::TEXT || ') requires Finance approval.',
            'warning',
            'Finance',
            '/purchasing/purchase-orders'
        );
        RETURN 'NOTICE: PO submitted for Finance approval (amount exceeds GH¢10,000)';
    ELSE
        -- Notify Manager for regular POs
        INSERT INTO notifications (title, message, type, target_role, link)
        VALUES (
            'PO Pending Approval',
            'PO ' || v_po.po_number || ' (GH¢' || v_current_total::TEXT || ') is pending your approval.',
            'info',
            'Manager',
            '/purchasing/purchase-orders'
        );
        RETURN 'NOTICE: PO submitted for Manager approval';
    END IF;
END;
$$ LANGUAGE plpgsql;

-- 5. Create trigger to auto-submit for approval when PO is created with amount
CREATE OR REPLACE FUNCTION auto_submit_po_for_approval()
RETURNS TRIGGER AS $$
DECLARE
    v_threshold_finance DECIMAL := 10000;
BEGIN
    -- Only trigger when a new PO is created with status Pending and has amount
    IF NEW.status = 'Pending' AND NEW.total_amount IS NOT NULL AND NEW.total_amount > 0 THEN
        -- Determine approval route based on amount
        IF NEW.total_amount > v_threshold_finance THEN
            INSERT INTO notifications (title, message, type, target_role, link)
            VALUES (
                'New PO Requires Finance Approval',
                'PO ' || NEW.po_number || ' (GH¢' || NEW.total_amount::TEXT || ') requires Finance approval.',
                'warning',
                'Finance',
                '/purchasing/purchase-orders'
            );
        ELSE
            INSERT INTO notifications (title, message, type, target_role, link)
            VALUES (
                'New PO Pending Approval',
                'PO ' || NEW.po_number || ' (GH¢' || NEW.total_amount::TEXT || ') is pending approval.',
                'info',
                'Manager',
                '/purchasing/purchase-orders'
            );
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_auto_submit_po ON purchase_orders;
CREATE TRIGGER trg_auto_submit_po
    AFTER INSERT ON purchase_orders
    FOR EACH ROW
    EXECUTE FUNCTION auto_submit_po_for_approval();

-- 6. Add comment for documentation
COMMENT ON COLUMN purchase_orders.approved_by IS 'User who approved this purchase order';
COMMENT ON COLUMN purchase_orders.approved_at IS 'Timestamp when the PO was approved';
COMMENT ON COLUMN purchase_orders.approval_level IS 'Level of approval: Manager, Finance, or SuperAdmin';
COMMENT ON COLUMN purchase_orders.approval_notes IS 'Optional notes from approver';
