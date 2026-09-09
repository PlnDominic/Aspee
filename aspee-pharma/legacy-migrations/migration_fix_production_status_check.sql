-- Fix production_orders status check constraint
-- Drops the old restrictive constraint and replaces it with one that
-- includes all status values used by the application.

ALTER TABLE production_orders
  DROP CONSTRAINT IF EXISTS production_orders_status_check;

ALTER TABLE production_orders
  ADD CONSTRAINT production_orders_status_check
  CHECK (status IN (
    'Draft',
    'Planned',
    'Released',
    'In Progress',
    'Completed',
    'Complete',
    'Cancelled',
    'On Hold'
  ));
