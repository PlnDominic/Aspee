-- Add qa_status to grn_items
ALTER TABLE grn_items 
ADD COLUMN IF NOT EXISTS qa_status TEXT DEFAULT 'Pending' CHECK (qa_status IN ('Pending', 'Approved', 'Rejected', 'Quarantine'));
