-- purchase_order_items.quantity was an INTEGER, silently rejecting/rounding any
-- decimal quantity entered on the Create Purchase Order form. unit_price only
-- carried 2 decimal places of scale, rounding away the precision entered there too.
-- Widen both so the UI's 4dp quantity / 7dp unit price inputs actually persist.

ALTER TABLE purchase_order_items
    ALTER COLUMN quantity TYPE NUMERIC(14, 4) USING quantity::numeric(14, 4);

ALTER TABLE purchase_order_items
    ALTER COLUMN unit_price TYPE NUMERIC(14, 7) USING unit_price::numeric(14, 7);

NOTIFY pgrst, 'reload schema';
