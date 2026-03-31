-- Fix RLS policies for bom_items table
-- Run this in your Supabase SQL editor

-- Allow authenticated users full access to bom_items
CREATE POLICY "Allow authenticated insert on bom_items"
    ON bom_items FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Allow authenticated select on bom_items"
    ON bom_items FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Allow authenticated update on bom_items"
    ON bom_items FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Allow authenticated delete on bom_items"
    ON bom_items FOR DELETE
    TO authenticated
    USING (true);
