-- Fix RLS policies for products table
-- Run this in your Supabase SQL editor

CREATE POLICY "Allow authenticated select on products"
    ON products FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Allow authenticated insert on products"
    ON products FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Allow authenticated update on products"
    ON products FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Allow authenticated delete on products"
    ON products FOR DELETE
    TO authenticated
    USING (true);
