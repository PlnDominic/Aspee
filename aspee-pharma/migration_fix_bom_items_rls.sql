-- Fix RLS policies for bom_items table
-- Run this in your Supabase SQL editor
-- This project performs inserts from the browser client, so `anon`
-- must be allowed in addition to `authenticated`.

ALTER TABLE IF EXISTS bom_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated insert on bom_items" ON bom_items;
DROP POLICY IF EXISTS "Allow authenticated select on bom_items" ON bom_items;
DROP POLICY IF EXISTS "Allow authenticated update on bom_items" ON bom_items;
DROP POLICY IF EXISTS "Allow authenticated delete on bom_items" ON bom_items;
DROP POLICY IF EXISTS "Enable all for all on bom_items" ON bom_items;
DROP POLICY IF EXISTS "Allow app insert on bom_items" ON bom_items;
DROP POLICY IF EXISTS "Allow app select on bom_items" ON bom_items;
DROP POLICY IF EXISTS "Allow app update on bom_items" ON bom_items;
DROP POLICY IF EXISTS "Allow app delete on bom_items" ON bom_items;

CREATE POLICY "Allow app select on bom_items"
    ON bom_items FOR SELECT
    TO anon, authenticated
    USING (true);

CREATE POLICY "Allow app insert on bom_items"
    ON bom_items FOR INSERT
    TO anon, authenticated
    WITH CHECK (true);

CREATE POLICY "Allow app update on bom_items"
    ON bom_items FOR UPDATE
    TO anon, authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Allow app delete on bom_items"
    ON bom_items FOR DELETE
    TO anon, authenticated
    USING (true);
