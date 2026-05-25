'use client';

import { supabase } from '@/lib/supabase';

export interface VanRecord {
    id: string;
    van_id: string;
    driver_name?: string | null;
    route_area?: string | null;
}

export interface SalespersonRecord {
    id: string;
    full_name: string;
}

export const SALES_DEPARTMENT_LOCATION_NAME  = 'Sales Department';
export const FINISHED_GOODS_LOCATION_NAME    = 'Finished Goods Store';
export const SALESPERSON_LOCATION_PREFIX     = 'Sales Rep - ';

export function getVanStockLocationName(van: Pick<VanRecord, 'van_id'>) {
    return `Sales Van - ${van.van_id}`;
}

export function getSalespersonLocationName(fullName: string) {
    return `${SALESPERSON_LOCATION_PREFIX}${fullName}`;
}

export function isSalespersonStockLocation(location?: Pick<{ name?: string | null; type?: string | null }, 'name' | 'type'> | null) {
    const type = (location?.type || '').trim().toLowerCase();
    const name = (location?.name || '').trim().toLowerCase();
    return type === 'salesperson' || name.startsWith(SALESPERSON_LOCATION_PREFIX.toLowerCase());
}

export function isSalesDepartmentLocation(location?: Pick<{ name?: string | null }, 'name'> | null) {
    return (location?.name || '').trim().toLowerCase() === SALES_DEPARTMENT_LOCATION_NAME.toLowerCase();
}

export function isFinishedGoodsLocation(location?: Pick<{ name?: string | null }, 'name'> | null) {
    return (location?.name || '').trim().toLowerCase() === FINISHED_GOODS_LOCATION_NAME.toLowerCase();
}

export function isVanStockLocation(location?: Pick<{ name?: string | null; type?: string | null }, 'name' | 'type'> | null) {
    const type = (location?.type || '').trim().toLowerCase();
    const name = (location?.name || '').trim().toLowerCase();
    return type === 'sales van' || name.startsWith('sales van - ');
}

export async function ensureSalesDepartmentLocation() {
    const { data: existing, error: existingError } = await supabase
        .from('stock_locations')
        .select('id, name, type')
        .eq('name', SALES_DEPARTMENT_LOCATION_NAME)
        .maybeSingle();

    if (existingError) throw existingError;
    if (existing) return existing;

    const { data: created, error: createError } = await supabase
        .from('stock_locations')
        .insert([{
            name: SALES_DEPARTMENT_LOCATION_NAME,
            type: 'Sales',
        }])
        .select('id, name, type')
        .single();

    if (createError) throw createError;
    return created;
}

export async function ensureVanStockLocation(van: VanRecord) {
    const locationName = getVanStockLocationName(van);

    const { data: existing, error: existingError } = await supabase
        .from('stock_locations')
        .select('id, name, type')
        .eq('name', locationName)
        .maybeSingle();

    if (existingError) throw existingError;
    if (existing) return existing;

    const { data: created, error: createError } = await supabase
        .from('stock_locations')
        .insert([{
            name: locationName,
            type: 'Sales Van',
        }])
        .select('id, name, type')
        .single();

    if (createError) throw createError;
    return created;
}

export async function ensureSalespersonStockLocation(profile: SalespersonRecord) {
    if (!profile.full_name) return null;
    const locationName = getSalespersonLocationName(profile.full_name);

    const { data: existing, error: existingError } = await supabase
        .from('stock_locations')
        .select('id, name, type')
        .eq('name', locationName)
        .maybeSingle();

    if (existingError) throw existingError;
    if (existing) return existing;

    const { data: created, error: createError } = await supabase
        .from('stock_locations')
        .insert([{ name: locationName, type: 'Salesperson' }])
        .select('id, name, type')
        .single();

    if (createError) throw createError;
    return created;
}

export async function getVanStockLocationByVanId(vanId: string) {
    const { data: van, error: vanError } = await supabase
        .from('vans')
        .select('id, van_id, driver_name, route_area')
        .eq('id', vanId)
        .maybeSingle();

    if (vanError) throw vanError;
    if (!van) return null;

    return ensureVanStockLocation(van as VanRecord);
}

export async function reconcileVanStockFromWaybills(vanId: string, productIds?: string[]) {
    const location = await getVanStockLocationByVanId(vanId);
    if (!location) return null;

    const productFilter = Array.from(new Set((productIds || []).filter(Boolean)));

    const { data: waybills, error: waybillsError } = await supabase
        .from('waybills')
        .select('id')
        .eq('van_id', vanId);
    if (waybillsError) throw waybillsError;

    const waybillIds = (waybills || []).map((waybill: any) => waybill.id);
    if (waybillIds.length === 0) return location;

    let waybillItemsQuery = supabase
        .from('waybill_items')
        .select('product_id, qty_received_from_stores')
        .in('waybill_id', waybillIds);

    if (productFilter.length > 0) {
        waybillItemsQuery = waybillItemsQuery.in('product_id', productFilter);
    }

    const { data: waybillItems, error: waybillItemsError } = await waybillItemsQuery;
    if (waybillItemsError) throw waybillItemsError;

    const loadedByProduct = new Map<string, number>();
    for (const item of waybillItems || []) {
        loadedByProduct.set(
            item.product_id,
            (loadedByProduct.get(item.product_id) || 0) + (Number(item.qty_received_from_stores) || 0)
        );
    }

    const { data: invoices, error: invoicesError } = await supabase
        .from('sales_invoices')
        .select('id, status')
        .eq('route_id', vanId);
    if (invoicesError) throw invoicesError;

    const committedInvoiceIds = (invoices || [])
        .filter((invoice: any) => ['ISSUED', 'PAID', 'PARTIAL', 'OVERDUE'].includes(String(invoice.status || '').trim().toUpperCase()))
        .map((invoice: any) => invoice.id);

    const soldByProduct = new Map<string, number>();
    if (committedInvoiceIds.length > 0) {
        let invoiceItemsQuery = supabase
            .from('sales_invoice_items')
            .select('product_id, quantity')
            .in('invoice_id', committedInvoiceIds);

        if (productFilter.length > 0) {
            invoiceItemsQuery = invoiceItemsQuery.in('product_id', productFilter);
        }

        const { data: invoiceItems, error: invoiceItemsError } = await invoiceItemsQuery;
        if (invoiceItemsError) throw invoiceItemsError;

        for (const item of invoiceItems || []) {
            soldByProduct.set(
                item.product_id,
                (soldByProduct.get(item.product_id) || 0) + (Number(item.quantity) || 0)
            );
        }
    }

    const stockProductIds = Array.from(new Set([
        ...Array.from(loadedByProduct.keys()),
        ...productFilter,
    ]));

    if (stockProductIds.length === 0) return location;

    const { data: stockRows, error: stockRowsError } = await supabase
        .from('stock_levels')
        .select('id, product_id, qty_on_hand')
        .eq('location_id', location.id)
        .in('product_id', stockProductIds);
    if (stockRowsError) throw stockRowsError;

    const existingStock = new Map((stockRows || []).map((row: any) => [row.product_id, row]));

    for (const productId of stockProductIds) {
        const expectedQty = Math.max(0, (loadedByProduct.get(productId) || 0) - (soldByProduct.get(productId) || 0));
        const currentRow: any = existingStock.get(productId);
        const currentQty = Number(currentRow?.qty_on_hand || 0);

        if (expectedQty <= currentQty) continue;

        if (currentRow?.id) {
            const { error: updateError } = await supabase
                .from('stock_levels')
                .update({ qty_on_hand: expectedQty, updated_at: new Date().toISOString() })
                .eq('id', currentRow.id);
            if (updateError) throw updateError;
        } else {
            const { error: insertError } = await supabase
                .from('stock_levels')
                .insert([{
                    product_id: productId,
                    location_id: location.id,
                    qty_on_hand: expectedQty,
                    updated_at: new Date().toISOString(),
                }]);
            if (insertError) throw insertError;
        }
    }

    return location;
}
