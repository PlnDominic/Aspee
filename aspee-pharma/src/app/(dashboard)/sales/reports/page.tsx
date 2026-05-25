'use client';

import React, { useState, useEffect, useCallback } from 'react';
import PageHeader from '@/components/PageHeader';
import StatCard from '@/components/StatCard';
import DataTable from '@/components/DataTable';
import StatusBadge from '@/components/StatusBadge';
import {
    BarChart3, Users, Truck, Banknote, CreditCard, AlertTriangle,
    TrendingUp, ClipboardList, Download, Calendar, RefreshCw,
    CheckCircle, Clock, Package, ArrowUpDown
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatCurrency } from '@/lib/formatCurrency';
import { toast } from 'sonner';
import { exportToCsv } from '@/lib/csvExport';

// ── Types ──────────────────────────────────────────────────────────────────────

type ReportTab =
    | 'distribution'
    | 'stock_by_salesperson'
    | 'stock_by_route'
    | 'debtors_by_staff'
    | 'debtors_by_route'
    | 'debtors_by_period'
    | 'sales_vs_cash'
    | 'cheques_received'
    | 'shortage_excess'
    | 'requisitions'
    | 'product_distribution';

// ── Helpers ───────────────────────────────────────────────────────────────────

const today = new Date().toISOString().split('T')[0];
const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    .toISOString().split('T')[0];
const VAN_LOCATION_PREFIX = 'sales van - ';

function normalizeKey(value?: string | null) {
    return String(value || '').trim().toLowerCase();
}

function getVanCodeFromLocationName(name?: string | null) {
    const normalized = normalizeKey(name);
    return normalized.startsWith(VAN_LOCATION_PREFIX)
        ? normalized.slice(VAN_LOCATION_PREFIX.length).trim()
        : null;
}

function buildVanLocationMap(vanLocations: any[] = []) {
    const map: Record<string, string> = {};
    for (const loc of vanLocations) {
        const vanCode = getVanCodeFromLocationName(loc.name);
        if (vanCode) map[vanCode] = loc.id;
    }
    return map;
}

function addNestedQty(
    map: Record<string, Record<string, number>>,
    groupKey: string,
    productId: string,
    qty: number,
) {
    if (!map[groupKey]) map[groupKey] = {};
    map[groupKey][productId] = (map[groupKey][productId] || 0) + qty;
}

function buildStockGivenGroupMaps(
    vanMap: Record<string, any>,
    stockGivenMap: Record<string, Record<string, number>>,
) {
    const bySalesperson: Record<string, Record<string, number>> = {};
    const byRoute: Record<string, Record<string, number>> = {};

    for (const van of Object.values(vanMap)) {
        if (!van?.location_id) continue;
        const stockForVan = stockGivenMap[van.location_id] || {};
        const salesperson = van.driver_name || 'Unassigned';
        const route = van.route_area || 'No Route';

        for (const [productId, qty] of Object.entries(stockForVan)) {
            addNestedQty(bySalesperson, salesperson, productId, qty);
            addNestedQty(byRoute, route, productId, qty);
        }
    }

    return { bySalesperson, byRoute };
}

// Build a map of customer_name → { sales_person, route, category, location }
async function buildCustomerMap(): Promise<Record<string, any>> {
    const { data } = await supabase
        .from('customers')
        .select('name, sales_person, route, customer_category, customer_location');
    const map: Record<string, any> = {};
    for (const c of data || []) {
        if (c.name) map[c.name.trim().toLowerCase()] = c;
    }
    return map;
}

// Build a map of product_id → total qty on hand (across all locations)
async function buildStockMap(): Promise<Record<string, number>> {
    const { data } = await supabase
        .from('stock_levels')
        .select('product_id, qty_on_hand');
    const map: Record<string, number> = {};
    for (const s of data || []) {
        map[s.product_id] = (map[s.product_id] || 0) + Number(s.qty_on_hand);
    }
    return map;
}

// Build a map of van.id → { van_id, driver_name (salesperson), route_area, location_id }
async function buildVanMap(): Promise<Record<string, any>> {
    const { data: vans } = await supabase
        .from('vans')
        .select('id, van_id, driver_name, route_area');
    const { data: vanLocations } = await supabase
        .from('stock_locations')
        .select('id, name')
        .eq('type', 'Sales Van');

    const vanIdToLocId = buildVanLocationMap(vanLocations || []);

    const map: Record<string, any> = {};
    for (const van of vans || []) {
        map[van.id] = {
            ...van,
            location_id: vanIdToLocId[normalizeKey(van.van_id)] || null,
        };
    }
    return map;
}

// Build stock_given per van location per product (from transfers INTO van locations)
async function buildStockGivenMap(startDate?: string, endDate?: string): Promise<Record<string, Record<string, number>>> {
    const { data: vanLocations } = await supabase
        .from('stock_locations')
        .select('id, name')
        .eq('type', 'Sales Van');
    const locIds = (vanLocations || []).map(l => l.id);
    if (locIds.length === 0) return {};

    // Get all transfers into van locations
    let transfersQuery = supabase
        .from('stock_transfers')
        .select('id, to_location_id, created_at')
        .in('to_location_id', locIds);
    if (startDate) transfersQuery = transfersQuery.gte('created_at', startDate);
    if (endDate) transfersQuery = transfersQuery.lte('created_at', `${endDate}T23:59:59`);

    const { data: transfers } = await transfersQuery;
    const hasTransferRows = !!transfers && transfers.length > 0;

    const transferIds = (transfers || []).map(t => t.id);
    const transferToLocMap: Record<string, string> = {};
    for (const t of transfers || []) transferToLocMap[t.id] = t.to_location_id;

    const { data: items } = hasTransferRows
        ? await supabase
            .from('stock_transfer_items')
            .select('transfer_id, product_id, quantity')
            .in('transfer_id', transferIds)
        : { data: [] };

    // location_id → product_id → total qty given
    const map: Record<string, Record<string, number>> = {};
    for (const item of items || []) {
        const locId = transferToLocMap[item.transfer_id];
        if (!locId) continue;
        if (!map[locId]) map[locId] = {};
        map[locId][item.product_id] = (map[locId][item.product_id] || 0) + Number(item.quantity);
    }

    const vanCodeToLocId = buildVanLocationMap(vanLocations || []);

    const { data: vans } = await supabase
        .from('vans')
        .select('id, van_id');

    const vanIdToLocId: Record<string, string> = {};
    for (const van of vans || []) {
        const locId = vanCodeToLocId[normalizeKey(van.van_id)];
        if (locId) vanIdToLocId[van.id] = locId;
    }

    let waybillsQuery = supabase
        .from('waybills')
        .select('id, van_id, date');
    if (startDate) waybillsQuery = waybillsQuery.gte('date', startDate);
    if (endDate) waybillsQuery = waybillsQuery.lte('date', endDate);

    const { data: waybills } = await waybillsQuery;
    const waybillIds = (waybills || []).map((waybill: any) => waybill.id);
    const waybillToLocMap: Record<string, string> = {};
    for (const waybill of waybills || []) {
        const locId = waybill.van_id ? vanIdToLocId[waybill.van_id] : null;
        if (locId) waybillToLocMap[waybill.id] = locId;
    }

    if (waybillIds.length > 0) {
        const { data: waybillItems } = await supabase
            .from('waybill_items')
            .select('waybill_id, product_id, qty_received_from_stores')
            .in('waybill_id', waybillIds);

        for (const item of waybillItems || []) {
            const locId = waybillToLocMap[item.waybill_id];
            if (!locId) continue;
            if (!map[locId]) map[locId] = {};
            map[locId][item.product_id] = (map[locId][item.product_id] || 0) + Number(item.qty_received_from_stores || 0);
        }
    }

    return map;
}

// Build van stock maps keyed by salesperson and route.
// Each van has a stock_location ("Sales Van - VAN-XXX") with per-product stock_levels.
// Returns: { bySalesperson: { salesperson → { product_id → qty } }, byRoute: { route → { product_id → qty } } }
async function buildVanStockMaps(): Promise<{
    bySalesperson: Record<string, Record<string, number>>;
    byRoute: Record<string, Record<string, number>>;
}> {
    // 1. Fetch vans with their salesperson (driver_name) and route
    const { data: vans } = await supabase
        .from('vans')
        .select('id, van_id, driver_name, route_area');

    // 2. Fetch all van stock locations
    const { data: vanLocations } = await supabase
        .from('stock_locations')
        .select('id, name, type')
        .eq('type', 'Sales Van');

    // 3. Build van_id → location_id mapping
    const vanIdToLocationId = buildVanLocationMap(vanLocations || []);

    // 4. Collect all van location IDs
    const locationIds = Object.values(vanIdToLocationId);
    if (locationIds.length === 0) {
        return { bySalesperson: {}, byRoute: {} };
    }

    // 5. Fetch stock levels for van locations
    const { data: levels } = await supabase
        .from('stock_levels')
        .select('product_id, location_id, qty_on_hand')
        .in('location_id', locationIds);

    // 6. Build location_id → product_id → qty map
    const locStockMap: Record<string, Record<string, number>> = {};
    for (const sl of levels || []) {
        if (!locStockMap[sl.location_id]) locStockMap[sl.location_id] = {};
        locStockMap[sl.location_id][sl.product_id] =
            (locStockMap[sl.location_id][sl.product_id] || 0) + Number(sl.qty_on_hand);
    }

    // 7. Map salesperson and route to their van stock
    const bySalesperson: Record<string, Record<string, number>> = {};
    const byRoute: Record<string, Record<string, number>> = {};

    for (const van of vans || []) {
        const locId = vanIdToLocationId[normalizeKey(van.van_id)];
        if (!locId) continue;
        const stockForVan = locStockMap[locId] || {};
        const sp = van.driver_name || 'Unassigned';
        const route = van.route_area || 'No Route';

        // Merge into salesperson map (a salesperson could theoretically have multiple vans)
        if (!bySalesperson[sp]) bySalesperson[sp] = {};
        for (const [pid, qty] of Object.entries(stockForVan)) {
            bySalesperson[sp][pid] = (bySalesperson[sp][pid] || 0) + qty;
        }

        // Merge into route map
        if (!byRoute[route]) byRoute[route] = {};
        for (const [pid, qty] of Object.entries(stockForVan)) {
            byRoute[route][pid] = (byRoute[route][pid] || 0) + qty;
        }
    }

    return { bySalesperson, byRoute };
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function SalesReportsPage() {
    const [activeTab, setActiveTab] = useState<ReportTab>('stock_by_salesperson');

    const tabs: { key: ReportTab; label: string; icon: React.ReactNode }[] = [
        { key: 'stock_by_salesperson', label: 'Stock Balance / Salesperson', icon: <Users size={15} /> },
        { key: 'stock_by_route',       label: 'Stock Balance / Route',        icon: <Truck size={15} /> },
        { key: 'debtors_by_staff',     label: 'Debtors / Staff',              icon: <Users size={15} /> },
        { key: 'debtors_by_route',     label: 'Debtors / Route',              icon: <Truck size={15} /> },
        { key: 'debtors_by_period',    label: 'Debtors / Period',             icon: <Calendar size={15} /> },
        { key: 'sales_vs_cash',        label: 'Sales vs Cash Received',       icon: <TrendingUp size={15} /> },
        { key: 'cheques_received',     label: 'Cheques Received',             icon: <CreditCard size={15} /> },
        { key: 'shortage_excess',      label: 'Shortage & Excess / Salesperson', icon: <AlertTriangle size={15} /> },
        { key: 'requisitions',         label: 'Product Requisitions',         icon: <ClipboardList size={15} /> },
        { key: 'product_distribution', label: 'Products Distribution',        icon: <Package size={15} /> },
    ];

    return (
        <div className="animate-fade-in">
            <PageHeader
                title="Sales Reports"
                subtitle="Comprehensive sales, stock, debtors, and requisition reports"
                breadcrumbs={[{ label: 'Sales', href: '/sales/invoices' }, { label: 'Reports' }]}
            />

            {/* Tab Bar */}
            <div style={{
                display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 24,
                background: 'var(--card-bg)', borderRadius: 12, padding: 6,
                border: '1px solid var(--slate-200)'
            }}>
                {tabs.map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        style={{
                            display: 'flex', alignItems: 'center', gap: 6,
                            padding: '7px 13px', borderRadius: 8, border: 'none',
                            cursor: 'pointer', fontSize: 11, fontWeight: 600,
                            transition: 'all 0.15s ease',
                            background: activeTab === tab.key
                                ? 'linear-gradient(135deg, var(--primary-600), var(--primary-500))'
                                : 'transparent',
                            color: activeTab === tab.key ? 'white' : 'var(--slate-600)',
                            boxShadow: activeTab === tab.key ? '0 2px 8px rgba(59,130,246,0.3)' : 'none',
                        }}
                    >
                        {tab.icon} {tab.label}
                    </button>
                ))}
            </div>

            {/* Report Panels */}
            {activeTab === 'stock_by_salesperson' && <StockBySalesperson />}
            {activeTab === 'stock_by_route'       && <StockByRoute />}
            {activeTab === 'debtors_by_staff'     && <DebtorsByStaff />}
            {activeTab === 'debtors_by_route'     && <DebtorsByRoute />}
            {activeTab === 'debtors_by_period'    && <DebtorsByPeriod />}
            {activeTab === 'sales_vs_cash'        && <SalesVsCash />}
            {activeTab === 'cheques_received'     && <ChequesReceived />}
            {activeTab === 'shortage_excess'      && <ShortageExcess />}
            {activeTab === 'requisitions'         && <RequisitionsReport />}
            {activeTab === 'product_distribution' && <ProductDistributionReport />}
        </div>
    );
}

// ── Reusable Filter Bar ───────────────────────────────────────────────────────

function FilterBar({
    startDate, endDate,
    onStartChange, onEndChange,
    onRefresh, loading,
    extra,
}: {
    startDate: string; endDate: string;
    onStartChange: (v: string) => void; onEndChange: (v: string) => void;
    onRefresh: () => void; loading: boolean;
    extra?: React.ReactNode;
}) {
    return (
        <div style={{
            display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap',
            marginBottom: 20, padding: '12px 16px', background: 'var(--card-bg)',
            borderRadius: 10, border: '1px solid var(--slate-200)'
        }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--slate-600)' }}>
                <Calendar size={14} /> From
                <input type="date" value={startDate} onChange={e => onStartChange(e.target.value)}
                    style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--slate-200)', fontSize: 12 }} />
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--slate-600)' }}>
                To
                <input type="date" value={endDate} onChange={e => onEndChange(e.target.value)}
                    style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--slate-200)', fontSize: 12 }} />
            </label>
            {extra}
            <button onClick={onRefresh} disabled={loading}
                style={{
                    display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px',
                    borderRadius: 8, border: '1px solid var(--slate-200)', background: 'var(--card-bg)',
                    fontSize: 12, fontWeight: 600, color: 'var(--slate-700)', cursor: 'pointer'
                }}>
                <RefreshCw size={13} /> Refresh
            </button>
        </div>
    );
}

function ExportBtn({ onClick }: { onClick: () => void }) {
    return (
        <button onClick={onClick}
            style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px',
                borderRadius: 8, border: '1px solid var(--slate-200)', background: 'var(--card-bg)',
                fontSize: 12, fontWeight: 600, color: 'var(--slate-700)', cursor: 'pointer'
            }}>
            <Download size={13} /> Export CSV
        </button>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. STOCK BALANCE PER SALESPERSON
// ═══════════════════════════════════════════════════════════════════════════════

function StockBySalesperson() {
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [startDate, setStartDate] = useState(firstOfMonth);
    const [endDate, setEndDate] = useState(today);

    const fetch = useCallback(async () => {
        setLoading(true);
        try {
            const [vanMap, vanStockMaps, stockGivenMap] = await Promise.all([
                buildVanMap(), buildVanStockMaps(), buildStockGivenMap(startDate, endDate),
            ]);
            const spStockMap = vanStockMaps.bySalesperson;
            const stockGivenGroups = buildStockGivenGroupMaps(vanMap, stockGivenMap);

            // Fetch invoice items with the invoice's route_id (van link)
            const { data: items, error } = await supabase
                .from('sales_invoice_items')
                .select(`
                    product_id, quantity, total_price,
                    product:products(id, name, sku, reorder_level),
                    invoice:sales_invoices!inner(route_id, date, status)
                `)
                .gte('invoice.date', startDate)
                .lte('invoice.date', endDate)
                .in('invoice.status', ['Issued', 'ISSUED', 'Partially Paid', 'PARTIALLY PAID', 'Paid', 'PAID']);

            if (error) throw error;

            const map: Record<string, any> = {};
            for (const r of items || []) {
                const inv = r.invoice as any;
                const prod = r.product as any;
                if (!inv || !prod) continue;
                // Derive salesperson from the invoice's van (route_id), not the customer
                const van = inv.route_id ? vanMap[inv.route_id] : null;
                const sp = van?.driver_name || 'Unassigned';
                const key = `${sp}__${prod.id}`;
                if (!map[key]) {
                    map[key] = {
                        salesperson: sp,
                        product_name: prod.name,
                        sku: prod.sku,
                        reorder_level: prod.reorder_level ?? 0,
                        stock_given: stockGivenGroups.bySalesperson[sp]?.[prod.id] ?? 0,
                        van_stock: spStockMap[sp]?.[prod.id] ?? 0,
                        qty_sold: 0,
                        revenue: 0,
                    };
                }
                map[key].qty_sold += Number(r.quantity);
                map[key].revenue += Number(r.total_price);
            }
            setData(Object.values(map).sort((a, b) =>
                a.salesperson.localeCompare(b.salesperson) || a.product_name.localeCompare(b.product_name)
            ));
        } catch (e: any) { toast.error(e.message); }
        finally { setLoading(false); }
    }, [startDate, endDate]);

    useEffect(() => { fetch(); }, [fetch]);

    const columns = [
        { key: 'salesperson',    label: 'Salesperson' },
        { key: 'product_name',   label: 'Product' },
        { key: 'sku',            label: 'SKU', render: (v: any) => <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>{v}</span> },
        { key: 'stock_given',    label: 'Stock Given', render: (v: any) => <span style={{ fontWeight: 600, color: 'var(--primary-600)' }}>{v}</span> },
        { key: 'qty_sold',       label: 'Qty Sold', render: (v: any) => <span style={{ fontWeight: 700 }}>{v}</span> },
        { key: 'van_stock',      label: 'Van Balance', render: (v: any, row: any) => (
            <span style={{ fontWeight: 700, color: v <= row.reorder_level ? 'var(--danger)' : 'var(--success)' }}>{v}</span>
        )},
        { key: 'revenue',        label: 'Revenue', render: (v: any) => <span style={{ fontWeight: 700 }}>{formatCurrency(v)}</span> },
    ];

    return (
        <div>
            <FilterBar startDate={startDate} endDate={endDate} onStartChange={setStartDate} onEndChange={setEndDate}
                onRefresh={fetch} loading={loading}
                extra={<ExportBtn onClick={() => exportToCsv(`stock_by_salesperson_${today}.csv`, data, [
                    { header: 'Salesperson', accessor: r => r.salesperson },
                    { header: 'Product', accessor: r => r.product_name },
                    { header: 'SKU', accessor: r => r.sku },
                    { header: 'Stock Given', accessor: r => r.stock_given },
                    { header: 'Qty Sold', accessor: r => r.qty_sold },
                    { header: 'Van Balance', accessor: r => r.van_stock },
                    { header: 'Revenue (GHS)', accessor: r => r.revenue },
                ])} />}
            />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 20 }}>
                <StatCard title="Salespersons" value={new Set(data.map(r => r.salesperson)).size} icon={<Users size={20} />} color="blue" />
                <StatCard title="Units Sold"   value={data.reduce((s, r) => s + r.qty_sold, 0)} icon={<Package size={20} />} color="teal" />
                <StatCard title="Revenue"      value={formatCurrency(data.reduce((s, r) => s + r.revenue, 0))} icon={<Banknote size={20} />} color="green" />
            </div>
            <DataTable columns={columns} data={data} loading={loading} searchPlaceholder="Search salesperson or product..." />
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 2. STOCK BALANCE PER ROUTE
// ═══════════════════════════════════════════════════════════════════════════════

function StockByRoute() {
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [startDate, setStartDate] = useState(firstOfMonth);
    const [endDate, setEndDate] = useState(today);

    const fetch = useCallback(async () => {
        setLoading(true);
        try {
            const [vanMap, vanStockMaps, stockGivenMap] = await Promise.all([
                buildVanMap(), buildVanStockMaps(), buildStockGivenMap(startDate, endDate),
            ]);
            const routeStockMap = vanStockMaps.byRoute;
            const stockGivenGroups = buildStockGivenGroupMaps(vanMap, stockGivenMap);

            // Fetch invoice items with the invoice's route_id (van link)
            const { data: items, error } = await supabase
                .from('sales_invoice_items')
                .select(`
                    product_id, quantity, total_price,
                    product:products(id, name, sku, reorder_level),
                    invoice:sales_invoices!inner(route_id, date, status)
                `)
                .gte('invoice.date', startDate)
                .lte('invoice.date', endDate)
                .in('invoice.status', ['Issued', 'ISSUED', 'Partially Paid', 'PARTIALLY PAID', 'Paid', 'PAID']);

            if (error) throw error;

            const map: Record<string, any> = {};
            for (const r of items || []) {
                const inv = r.invoice as any;
                const prod = r.product as any;
                if (!inv || !prod) continue;
                // Derive route from the invoice's van (route_id), not the customer
                const van = inv.route_id ? vanMap[inv.route_id] : null;
                const route = van?.route_area || 'No Route';
                const key = `${route}__${prod.id}`;
                if (!map[key]) {
                    map[key] = {
                        route,
                        product_name: prod.name,
                        sku: prod.sku,
                        reorder_level: prod.reorder_level ?? 0,
                        stock_given: stockGivenGroups.byRoute[route]?.[prod.id] ?? 0,
                        van_stock: routeStockMap[route]?.[prod.id] ?? 0,
                        qty_sold: 0,
                        revenue: 0,
                    };
                }
                map[key].qty_sold += Number(r.quantity);
                map[key].revenue += Number(r.total_price);
            }
            setData(Object.values(map).sort((a, b) =>
                a.route.localeCompare(b.route) || a.product_name.localeCompare(b.product_name)
            ));
        } catch (e: any) { toast.error(e.message); }
        finally { setLoading(false); }
    }, [startDate, endDate]);

    useEffect(() => { fetch(); }, [fetch]);

    const columns = [
        { key: 'route',         label: 'Route' },
        { key: 'product_name',  label: 'Product' },
        { key: 'sku',           label: 'SKU', render: (v: any) => <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>{v}</span> },
        { key: 'stock_given',   label: 'Stock Given', render: (v: any) => <span style={{ fontWeight: 600, color: 'var(--primary-600)' }}>{v}</span> },
        { key: 'qty_sold',      label: 'Qty Sold', render: (v: any) => <span style={{ fontWeight: 700 }}>{v}</span> },
        { key: 'van_stock',     label: 'Van Balance', render: (v: any, row: any) => (
            <span style={{ fontWeight: 700, color: v <= row.reorder_level ? 'var(--danger)' : 'var(--success)' }}>{v}</span>
        )},
        { key: 'revenue',       label: 'Revenue', render: (v: any) => <span style={{ fontWeight: 700 }}>{formatCurrency(v)}</span> },
    ];

    return (
        <div>
            <FilterBar startDate={startDate} endDate={endDate} onStartChange={setStartDate} onEndChange={setEndDate}
                onRefresh={fetch} loading={loading}
                extra={<ExportBtn onClick={() => exportToCsv(`stock_by_route_${today}.csv`, data, [
                    { header: 'Route', accessor: r => r.route },
                    { header: 'Product', accessor: r => r.product_name },
                    { header: 'Stock Given', accessor: r => r.stock_given },
                    { header: 'Qty Sold', accessor: r => r.qty_sold },
                    { header: 'Van Balance', accessor: r => r.van_stock },
                    { header: 'Revenue (GHS)', accessor: r => r.revenue },
                ])} />}
            />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 20 }}>
                <StatCard title="Routes"     value={new Set(data.map(r => r.route)).size} icon={<Truck size={20} />} color="blue" />
                <StatCard title="Units Sold" value={data.reduce((s, r) => s + r.qty_sold, 0)} icon={<Package size={20} />} color="teal" />
                <StatCard title="Revenue"    value={formatCurrency(data.reduce((s, r) => s + r.revenue, 0))} icon={<Banknote size={20} />} color="green" />
            </div>
            <DataTable columns={columns} data={data} loading={loading} searchPlaceholder="Search route or product..." />
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Helper: build debtors list (invoices with outstanding amounts)
// ═══════════════════════════════════════════════════════════════════════════════

async function fetchDebtorsRaw(startDate: string, endDate: string): Promise<any[]> {
    // Fetch outstanding invoices
    const { data: invoices, error } = await supabase
        .from('sales_invoices')
        .select('id, invoice_number, customer_name, date, total_amount, status')
        .in('status', ['Issued', 'ISSUED', 'Partially Paid', 'PARTIALLY PAID', 'Overdue', 'OVERDUE'])
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: false });
    if (error) throw error;

    if (!invoices || invoices.length === 0) return [];

    // Fetch receipts for these invoices
    const invoiceIds = invoices.map(i => i.id);
    const { data: receipts } = await supabase
        .from('sales_receipts')
        .select('invoice_id, amount')
        .in('invoice_id', invoiceIds);

    // Build paid-per-invoice map
    const paidMap: Record<string, number> = {};
    for (const r of receipts || []) {
        paidMap[r.invoice_id] = (paidMap[r.invoice_id] || 0) + Number(r.amount);
    }

    // Get customer info
    const custMap = await buildCustomerMap();

    return invoices.map(inv => {
        const paid = paidMap[inv.id] || 0;
        const outstanding = Number(inv.total_amount) - paid;
        const cust = custMap[(inv.customer_name || '').trim().toLowerCase()];
        const days = Math.max(0, Math.floor((Date.now() - new Date(inv.date).getTime()) / 86400000));
        let aging_bucket = '0-30 Days';
        if (days > 90) aging_bucket = '90+ Days';
        else if (days > 60) aging_bucket = '61-90 Days';
        else if (days > 30) aging_bucket = '31-60 Days';
        return {
            invoice_number: inv.invoice_number,
            invoice_date: inv.date,
            customer_name: inv.customer_name,
            sales_person: cust?.sales_person || 'Unassigned',
            route: cust?.route || 'No Route',
            customer_category: cust?.customer_category || '-',
            customer_location: cust?.customer_location || '-',
            total_amount: Number(inv.total_amount),
            amount_paid: paid,
            outstanding,
            days_overdue: days,
            aging_bucket,
            status: inv.status,
        };
    }).filter(r => r.outstanding > 0);
}

// ═══════════════════════════════════════════════════════════════════════════════
// 3. DEBTORS LIST PER STAFF
// ═══════════════════════════════════════════════════════════════════════════════

function DebtorsByStaff() {
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [startDate, setStartDate] = useState(firstOfMonth);
    const [endDate, setEndDate] = useState(today);

    const fetch = useCallback(async () => {
        setLoading(true);
        try {
            const rows = await fetchDebtorsRaw(startDate, endDate);
            setData(rows.sort((a, b) => a.sales_person.localeCompare(b.sales_person)));
        } catch (e: any) { toast.error(e.message); }
        finally { setLoading(false); }
    }, [startDate, endDate]);

    useEffect(() => { fetch(); }, [fetch]);

    const columns = [
        { key: 'sales_person',  label: 'Salesperson' },
        { key: 'customer_name', label: 'Customer' },
        { key: 'customer_category', label: 'Category' },
        { key: 'invoice_number', label: 'Invoice', render: (v: any) => <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--primary-600)', fontWeight: 700 }}>{v}</span> },
        { key: 'invoice_date',  label: 'Date', render: (v: any) => new Date(v).toLocaleDateString('en-GB') },
        { key: 'total_amount',  label: 'Invoice Total', render: (v: any) => formatCurrency(v) },
        { key: 'amount_paid',   label: 'Paid', render: (v: any) => <span style={{ color: 'var(--success)' }}>{formatCurrency(v)}</span> },
        { key: 'outstanding',   label: 'Outstanding', render: (v: any) => <span style={{ fontWeight: 700, color: 'var(--danger)' }}>{formatCurrency(v)}</span> },
        { key: 'days_overdue',  label: 'Days', render: (v: any) => (
            <span style={{ fontWeight: 700, color: v > 60 ? 'var(--danger)' : v > 30 ? '#d97706' : 'var(--slate-600)' }}>{v}d</span>
        )},
        { key: 'status', label: 'Status', render: (v: any) => <StatusBadge status={v} variant={v === 'Overdue' ? 'danger' : 'warning'} /> },
    ];

    const totalOutstanding = data.reduce((s, r) => s + r.outstanding, 0);

    return (
        <div>
            <FilterBar startDate={startDate} endDate={endDate} onStartChange={setStartDate} onEndChange={setEndDate}
                onRefresh={fetch} loading={loading}
                extra={<ExportBtn onClick={() => exportToCsv(`debtors_by_staff_${today}.csv`, data, [
                    { header: 'Salesperson', accessor: r => r.sales_person },
                    { header: 'Customer', accessor: r => r.customer_name },
                    { header: 'Invoice No.', accessor: r => r.invoice_number },
                    { header: 'Date', accessor: r => r.invoice_date },
                    { header: 'Total', accessor: r => r.total_amount },
                    { header: 'Paid', accessor: r => r.amount_paid },
                    { header: 'Outstanding', accessor: r => r.outstanding },
                    { header: 'Days', accessor: r => r.days_overdue },
                ])} />}
            />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 20 }}>
                <StatCard title="Staff with Debtors" value={new Set(data.map(r => r.sales_person)).size} icon={<Users size={20} />} color="blue" />
                <StatCard title="Unpaid Invoices"    value={data.length} icon={<Clock size={20} />} color="amber" />
                <StatCard title="Total Outstanding"  value={formatCurrency(totalOutstanding)} icon={<Banknote size={20} />} color="red" />
            </div>
            <DataTable columns={columns} data={data} loading={loading} searchPlaceholder="Search salesperson or customer..." />
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 4. DEBTORS LIST PER ROUTE
// ═══════════════════════════════════════════════════════════════════════════════

function DebtorsByRoute() {
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [startDate, setStartDate] = useState(firstOfMonth);
    const [endDate, setEndDate] = useState(today);

    const fetch = useCallback(async () => {
        setLoading(true);
        try {
            const rows = await fetchDebtorsRaw(startDate, endDate);
            setData(rows.sort((a, b) => a.route.localeCompare(b.route)));
        } catch (e: any) { toast.error(e.message); }
        finally { setLoading(false); }
    }, [startDate, endDate]);

    useEffect(() => { fetch(); }, [fetch]);

    const columns = [
        { key: 'route',         label: 'Route' },
        { key: 'customer_name', label: 'Customer' },
        { key: 'customer_category', label: 'Category' },
        { key: 'invoice_number', label: 'Invoice', render: (v: any) => <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--primary-600)', fontWeight: 700 }}>{v}</span> },
        { key: 'invoice_date',  label: 'Date', render: (v: any) => new Date(v).toLocaleDateString('en-GB') },
        { key: 'total_amount',  label: 'Invoice Total', render: (v: any) => formatCurrency(v) },
        { key: 'amount_paid',   label: 'Paid', render: (v: any) => <span style={{ color: 'var(--success)' }}>{formatCurrency(v)}</span> },
        { key: 'outstanding',   label: 'Outstanding', render: (v: any) => <span style={{ fontWeight: 700, color: 'var(--danger)' }}>{formatCurrency(v)}</span> },
        { key: 'days_overdue',  label: 'Days', render: (v: any) => (
            <span style={{ fontWeight: 700, color: v > 60 ? 'var(--danger)' : v > 30 ? '#d97706' : 'var(--slate-600)' }}>{v}d</span>
        )},
    ];

    const totalOutstanding = data.reduce((s, r) => s + r.outstanding, 0);

    return (
        <div>
            <FilterBar startDate={startDate} endDate={endDate} onStartChange={setStartDate} onEndChange={setEndDate}
                onRefresh={fetch} loading={loading}
                extra={<ExportBtn onClick={() => exportToCsv(`debtors_by_route_${today}.csv`, data, [
                    { header: 'Route', accessor: r => r.route },
                    { header: 'Customer', accessor: r => r.customer_name },
                    { header: 'Invoice No.', accessor: r => r.invoice_number },
                    { header: 'Date', accessor: r => r.invoice_date },
                    { header: 'Total', accessor: r => r.total_amount },
                    { header: 'Paid', accessor: r => r.amount_paid },
                    { header: 'Outstanding', accessor: r => r.outstanding },
                ])} />}
            />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 20 }}>
                <StatCard title="Routes with Debtors" value={new Set(data.map(r => r.route)).size} icon={<Truck size={20} />} color="blue" />
                <StatCard title="Unpaid Invoices"     value={data.length} icon={<Clock size={20} />} color="amber" />
                <StatCard title="Total Outstanding"   value={formatCurrency(totalOutstanding)} icon={<Banknote size={20} />} color="red" />
            </div>
            <DataTable columns={columns} data={data} loading={loading} searchPlaceholder="Search route or customer..." />
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 5. CUSTOMER PAYMENT BALANCE (DEBTORS) PER PERIOD
// ═══════════════════════════════════════════════════════════════════════════════

function DebtorsByPeriod() {
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [startDate, setStartDate] = useState(firstOfMonth);
    const [endDate, setEndDate] = useState(today);
    const [agingFilter, setAgingFilter] = useState('ALL');

    const fetch = useCallback(async () => {
        setLoading(true);
        try {
            const rows = await fetchDebtorsRaw(startDate, endDate);
            setData(rows);
        } catch (e: any) { toast.error(e.message); }
        finally { setLoading(false); }
    }, [startDate, endDate]);

    useEffect(() => { fetch(); }, [fetch]);

    const filtered = agingFilter === 'ALL' ? data : data.filter(r => r.aging_bucket === agingFilter);
    const totalOutstanding = filtered.reduce((s, r) => s + r.outstanding, 0);

    const columns = [
        { key: 'customer_name',     label: 'Customer' },
        { key: 'customer_category', label: 'Category' },
        { key: 'customer_location', label: 'Location' },
        { key: 'invoice_number', label: 'Invoice', render: (v: any) => <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--primary-600)', fontWeight: 700 }}>{v}</span> },
        { key: 'invoice_date',  label: 'Invoice Date', render: (v: any) => new Date(v).toLocaleDateString('en-GB') },
        { key: 'total_amount',  label: 'Total', render: (v: any) => formatCurrency(v) },
        { key: 'amount_paid',   label: 'Paid', render: (v: any) => <span style={{ color: 'var(--success)' }}>{formatCurrency(v)}</span> },
        { key: 'outstanding',   label: 'Outstanding', render: (v: any) => <span style={{ fontWeight: 700, color: 'var(--danger)' }}>{formatCurrency(v)}</span> },
        { key: 'aging_bucket',  label: 'Aging', render: (v: any) => (
            <span style={{
                padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600,
                background: v === '90+ Days' ? '#fee2e2' : v === '61-90 Days' ? '#fef3c7' : v === '31-60 Days' ? '#fef9c3' : '#dcfce7',
                color: v === '90+ Days' ? '#dc2626' : v === '61-90 Days' ? '#d97706' : v === '31-60 Days' ? '#ca8a04' : '#16a34a',
            }}>{v}</span>
        )},
    ];

    return (
        <div>
            <FilterBar startDate={startDate} endDate={endDate} onStartChange={setStartDate} onEndChange={setEndDate}
                onRefresh={fetch} loading={loading}
                extra={
                    <>
                        <select value={agingFilter} onChange={e => setAgingFilter(e.target.value)}
                            style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--slate-200)', fontSize: 12 }}>
                            {['ALL', '0-30 Days', '31-60 Days', '61-90 Days', '90+ Days'].map(o => (
                                <option key={o} value={o}>{o === 'ALL' ? 'All Aging Buckets' : o}</option>
                            ))}
                        </select>
                        <ExportBtn onClick={() => exportToCsv(`debtors_by_period_${today}.csv`, filtered, [
                            { header: 'Customer', accessor: r => r.customer_name },
                            { header: 'Category', accessor: r => r.customer_category },
                            { header: 'Invoice No.', accessor: r => r.invoice_number },
                            { header: 'Invoice Date', accessor: r => r.invoice_date },
                            { header: 'Total', accessor: r => r.total_amount },
                            { header: 'Paid', accessor: r => r.amount_paid },
                            { header: 'Outstanding', accessor: r => r.outstanding },
                            { header: 'Aging', accessor: r => r.aging_bucket },
                        ])} />
                    </>
                }
            />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 20 }}>
                <StatCard title="Customers"   value={new Set(filtered.map(r => r.customer_name)).size} icon={<Users size={20} />} color="blue" />
                <StatCard title="Invoices"    value={filtered.length} icon={<Clock size={20} />} color="amber" />
                <StatCard title="Outstanding" value={formatCurrency(totalOutstanding)} icon={<Banknote size={20} />} color="red" />
                <StatCard title="Oldest Debt" value={`${Math.max(0, ...filtered.map(r => r.days_overdue), 0)}d`} icon={<AlertTriangle size={20} />} color="purple" />
            </div>
            <DataTable columns={columns} data={filtered} loading={loading} searchPlaceholder="Search customer or invoice..." />
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 6. TOTAL SALES vs TOTAL CASH RECEIVED
// ═══════════════════════════════════════════════════════════════════════════════

function SalesVsCash() {
    const [data, setData]       = useState<any[]>([]);
    const [summary, setSummary] = useState({ totalSales: 0, totalCash: 0, totalCredit: 0, totalReceived: 0 });
    const [loading, setLoading] = useState(false);
    const [startDate, setStartDate] = useState(firstOfMonth);
    const [endDate, setEndDate]     = useState(today);

    const fetch = useCallback(async () => {
        setLoading(true);
        try {
            const { data: invoices, error } = await supabase
                .from('sales_invoices')
                .select('id, invoice_number, customer_name, date, type, total_amount, status')
                .in('status', ['Issued', 'ISSUED', 'Partially Paid', 'PARTIALLY PAID', 'Paid', 'PAID', 'Overdue', 'OVERDUE'])
                .gte('date', startDate)
                .lte('date', endDate)
                .order('date', { ascending: false });
            if (error) throw error;

            const invoiceIds = (invoices || []).map(i => i.id);
            const { data: receipts } = await supabase
                .from('sales_receipts')
                .select('invoice_id, amount')
                .in('invoice_id', invoiceIds.length ? invoiceIds : ['none']);

            const paidMap: Record<string, number> = {};
            for (const r of receipts || []) {
                paidMap[r.invoice_id] = (paidMap[r.invoice_id] || 0) + Number(r.amount);
            }

            let totalSales = 0, totalCash = 0, totalCredit = 0, totalReceived = 0;
            const rows = (invoices || []).map((inv: any) => {
                const received = paidMap[inv.id] || 0;
                totalSales    += Number(inv.total_amount);
                totalReceived += received;
                if (inv.type === 'Cash Sale') totalCash += Number(inv.total_amount);
                else                          totalCredit += Number(inv.total_amount);
                return {
                    invoice_date:    inv.date,
                    invoice_number:  inv.invoice_number,
                    customer_name:   inv.customer_name,
                    type:            inv.type,
                    total_amount:    Number(inv.total_amount),
                    received,
                    outstanding:     Number(inv.total_amount) - received,
                    status:          inv.status,
                };
            });
            setSummary({ totalSales, totalCash, totalCredit, totalReceived });
            setData(rows);
        } catch (e: any) { toast.error(e.message); }
        finally { setLoading(false); }
    }, [startDate, endDate]);

    useEffect(() => { fetch(); }, [fetch]);

    const collectionRate = summary.totalSales > 0
        ? ((summary.totalReceived / summary.totalSales) * 100).toFixed(1) : '0';

    const columns = [
        { key: 'invoice_date',   label: 'Date', render: (v: any) => new Date(v).toLocaleDateString('en-GB') },
        { key: 'invoice_number', label: 'Invoice', render: (v: any) => <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--primary-600)', fontWeight: 700 }}>{v}</span> },
        { key: 'customer_name',  label: 'Customer' },
        { key: 'type', label: 'Type', render: (v: any) => (
            <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600,
                background: v === 'Cash Sale' ? '#dcfce7' : '#dbeafe', color: v === 'Cash Sale' ? '#16a34a' : '#1d4ed8' }}>{v}</span>
        )},
        { key: 'total_amount', label: 'Invoice Total', render: (v: any) => <span style={{ fontWeight: 700 }}>{formatCurrency(v)}</span> },
        { key: 'received', label: 'Cash Received', render: (v: any) => <span style={{ color: 'var(--success)', fontWeight: 600 }}>{formatCurrency(v)}</span> },
        { key: 'outstanding', label: 'Outstanding', render: (v: any) => <span style={{ fontWeight: 700, color: v > 0 ? 'var(--danger)' : 'var(--success)' }}>{formatCurrency(v)}</span> },
        { key: 'status', label: 'Status', render: (v: any) => <StatusBadge status={v} variant={v === 'Paid' ? 'success' : v === 'Overdue' ? 'danger' : 'warning'} /> },
    ];

    return (
        <div>
            <FilterBar startDate={startDate} endDate={endDate} onStartChange={setStartDate} onEndChange={setEndDate}
                onRefresh={fetch} loading={loading}
                extra={<ExportBtn onClick={() => exportToCsv(`sales_vs_cash_${today}.csv`, data, [
                    { header: 'Date', accessor: r => r.invoice_date },
                    { header: 'Invoice No.', accessor: r => r.invoice_number },
                    { header: 'Customer', accessor: r => r.customer_name },
                    { header: 'Type', accessor: r => r.type },
                    { header: 'Invoice Total', accessor: r => r.total_amount },
                    { header: 'Cash Received', accessor: r => r.received },
                    { header: 'Outstanding', accessor: r => r.outstanding },
                ])} />}
            />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 16, marginBottom: 20 }}>
                <StatCard title="Total Sales"      value={formatCurrency(summary.totalSales)} icon={<TrendingUp size={20} />} color="blue" />
                <StatCard title="Cash Sales"       value={formatCurrency(summary.totalCash)} icon={<Banknote size={20} />} color="green" />
                <StatCard title="Credit Sales"     value={formatCurrency(summary.totalCredit)} icon={<CreditCard size={20} />} color="purple" />
                <StatCard title="Cash Received"    value={formatCurrency(summary.totalReceived)} icon={<CheckCircle size={20} />} color="teal" />
                <StatCard title="Collection Rate"  value={`${collectionRate}%`} icon={<BarChart3 size={20} />} color="amber" />
            </div>
            <div style={{ background: 'var(--card-bg)', border: '1px solid var(--slate-200)', borderRadius: 12, padding: '16px 20px', marginBottom: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 600, marginBottom: 8 }}>
                    <span>Collection Progress</span>
                    <span style={{ color: 'var(--danger)' }}>Outstanding: {formatCurrency(summary.totalSales - summary.totalReceived)}</span>
                </div>
                <div style={{ height: 10, background: 'var(--slate-100)', borderRadius: 5, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${collectionRate}%`, background: 'linear-gradient(90deg, #16a34a, #22c55e)', borderRadius: 5, transition: 'width 0.5s' }} />
                </div>
            </div>
            <DataTable columns={columns} data={data} loading={loading} searchPlaceholder="Search invoice or customer..." />
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 7. CHEQUES RECEIVED
// ═══════════════════════════════════════════════════════════════════════════════

function ChequesReceived() {
    const [data, setData]       = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [startDate, setStartDate] = useState(firstOfMonth);
    const [endDate, setEndDate]     = useState(today);
    const [statusFilter, setStatusFilter] = useState('ALL');

    const fetch = useCallback(async () => {
        setLoading(true);
        try {
            const { data: rows, error } = await supabase
                .from('sales_receipts')
                .select(`
                    receipt_number, invoice_id, invoice_number, date, customer_name,
                    payment_method, payment_reference, amount, status, notes
                `)
                .ilike('payment_method', 'Cheque')
                .gte('date', startDate)
                .lte('date', endDate)
                .order('date', { ascending: false });
            if (error) throw error;

            const invoiceIds = Array.from(
                new Set((rows || []).map((r: any) => r.invoice_id).filter(Boolean)),
            );
            const invoiceNumberMap = new Map<string, string>();
            if (invoiceIds.length > 0) {
                const { data: invoices, error: invoicesError } = await supabase
                    .from('sales_invoices')
                    .select('id, invoice_number')
                    .in('id', invoiceIds);
                if (invoicesError) throw invoicesError;

                (invoices || []).forEach((invoice: any) => {
                    if (invoice.invoice_number) invoiceNumberMap.set(invoice.id, invoice.invoice_number);
                });
            }

            setData((rows || []).map((r: any) => ({
                receipt_number:  r.receipt_number,
                payment_date:    r.date,
                customer_name:   r.customer_name,
                invoice_number:  r.invoice_number || (r.invoice_id ? invoiceNumberMap.get(r.invoice_id) : null) || '-',
                cheque_number:   r.payment_reference ?? '-',
                amount:          Number(r.amount),
                status:          r.status ?? 'Confirmed',
                notes:           r.notes ?? '',
            })));
        } catch (e: any) { toast.error(e.message); }
        finally { setLoading(false); }
    }, [startDate, endDate]);

    useEffect(() => { fetch(); }, [fetch]);

    const filtered = statusFilter === 'ALL' ? data : data.filter(r => r.status === statusFilter);
    const totalAmount   = filtered.reduce((s, r) => s + r.amount, 0);
    const confirmedAmt  = filtered.filter(r => r.status === 'Confirmed').reduce((s, r) => s + r.amount, 0);
    const pendingAmt    = filtered.filter(r => r.status !== 'Confirmed').reduce((s, r) => s + r.amount, 0);

    const columns = [
        { key: 'payment_date',   label: 'Date', render: (v: any) => new Date(v).toLocaleDateString('en-GB') },
        { key: 'receipt_number', label: 'Receipt No.', render: (v: any) => <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--primary-600)', fontWeight: 700 }}>{v}</span> },
        { key: 'customer_name',  label: 'Customer' },
        { key: 'invoice_number', label: 'Invoice Ref', render: (v: any) => <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>{v}</span> },
        { key: 'cheque_number',  label: 'Cheque / Ref No.', render: (v: any) => <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600 }}>{v}</span> },
        { key: 'amount',  label: 'Amount', render: (v: any) => <span style={{ fontWeight: 700 }}>{formatCurrency(v)}</span> },
        { key: 'status',  label: 'Status', render: (v: any) => <StatusBadge status={v} variant={v === 'Confirmed' ? 'success' : 'warning'} /> },
    ];

    return (
        <div>
            <FilterBar startDate={startDate} endDate={endDate} onStartChange={setStartDate} onEndChange={setEndDate}
                onRefresh={fetch} loading={loading}
                extra={
                    <>
                        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
                            style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--slate-200)', fontSize: 12 }}>
                            <option value="ALL">All Statuses</option>
                            <option value="Confirmed">Confirmed</option>
                            <option value="Pending">Pending</option>
                        </select>
                        <ExportBtn onClick={() => exportToCsv(`cheques_received_${today}.csv`, filtered, [
                            { header: 'Date', accessor: r => r.payment_date },
                            { header: 'Receipt No.', accessor: r => r.receipt_number },
                            { header: 'Customer', accessor: r => r.customer_name },
                            { header: 'Invoice Ref', accessor: r => r.invoice_number },
                            { header: 'Cheque / Ref No.', accessor: r => r.cheque_number },
                            { header: 'Amount (GHS)', accessor: r => r.amount },
                            { header: 'Status', accessor: r => r.status },
                        ])} />
                    </>
                }
            />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 20 }}>
                <StatCard title="Total Cheques"    value={filtered.length} icon={<CreditCard size={20} />} color="blue" />
                <StatCard title="Total Value"      value={formatCurrency(totalAmount)} icon={<Banknote size={20} />} color="green" />
                <StatCard title="Confirmed"        value={formatCurrency(confirmedAmt)} icon={<CheckCircle size={20} />} color="teal" />
                <StatCard title="Pending / Other"  value={formatCurrency(pendingAmt)} icon={<Clock size={20} />} color="amber" />
            </div>
            <DataTable columns={columns} data={filtered} loading={loading} searchPlaceholder="Search customer or cheque no..." />
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 8. PRODUCTS SHORTAGE & EXCESS PER SALESPERSON
// ═══════════════════════════════════════════════════════════════════════════════

function ShortageExcess() {
    const [data, setData]       = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [startDate, setStartDate] = useState(firstOfMonth);
    const [endDate, setEndDate]     = useState(today);
    const [filterType, setFilterType] = useState('ALL');

    const fetch = useCallback(async () => {
        setLoading(true);
        try {
            const [vanMap, vanStockMaps, stockGivenMap] = await Promise.all([
                buildVanMap(), buildVanStockMaps(), buildStockGivenMap(startDate, endDate),
            ]);
            const spStockMap = vanStockMaps.bySalesperson;
            const stockGivenGroups = buildStockGivenGroupMaps(vanMap, stockGivenMap);

            const { data: products, error: pErr } = await supabase
                .from('products')
                .select('id, name, sku, reorder_level, material_type');
            if (pErr) throw pErr;

            // Fetch invoice items with the invoice's route_id (van link)
            const { data: items, error: iErr } = await supabase
                .from('sales_invoice_items')
                .select(`
                    product_id, quantity,
                    invoice:sales_invoices!inner(route_id, date, status)
                `)
                .gte('invoice.date', startDate)
                .lte('invoice.date', endDate)
                .in('invoice.status', ['Issued', 'ISSUED', 'Partially Paid', 'PARTIALLY PAID', 'Paid', 'PAID']);
            if (iErr) throw iErr;

            const map: Record<string, any> = {};
            for (const item of items || []) {
                const inv = item.invoice as any;
                if (!inv) continue;
                // Derive salesperson from the invoice's van (route_id)
                const van = inv.route_id ? vanMap[inv.route_id] : null;
                const sp = van?.driver_name || 'Unassigned';
                const key = `${sp}__${item.product_id}`;
                if (!map[key]) {
                    const prod = (products || []).find(p => p.id === item.product_id);
                    map[key] = {
                        salesperson: sp,
                        product_id: item.product_id,
                        product_name: prod?.name ?? 'Unknown',
                        sku: prod?.sku ?? '-',
                        reorder_level: prod?.reorder_level ?? 0,
                        stock_given: stockGivenGroups.bySalesperson[sp]?.[item.product_id] ?? 0,
                        van_stock: spStockMap[sp]?.[item.product_id] ?? 0,
                        qty_sold: 0,
                    };
                }
                map[key].qty_sold += Number(item.quantity);
            }

            const rows = Object.values(map).map(r => ({
                ...r,
                stock_status: r.van_stock < r.reorder_level ? 'SHORTAGE'
                    : r.van_stock > r.reorder_level * 3 ? 'EXCESS'
                    : 'NORMAL',
            }));
            setData(rows);
        } catch (e: any) { toast.error(e.message); }
        finally { setLoading(false); }
    }, [startDate, endDate]);

    useEffect(() => { fetch(); }, [fetch]);

    const filtered = filterType === 'ALL' ? data : data.filter(r => r.stock_status === filterType);

    const columns = [
        { key: 'salesperson',   label: 'Salesperson' },
        { key: 'product_name',  label: 'Product' },
        { key: 'sku',           label: 'SKU', render: (v: any) => <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>{v}</span> },
        { key: 'stock_given',   label: 'Stock Given', render: (v: any) => <span style={{ fontWeight: 600, color: 'var(--primary-600)' }}>{v}</span> },
        { key: 'qty_sold',      label: 'Qty Sold', render: (v: any) => <span style={{ fontWeight: 700 }}>{v}</span> },
        { key: 'van_stock',     label: 'Van Balance', render: (v: any) => <span style={{ fontWeight: 700 }}>{v}</span> },
        { key: 'stock_status',  label: 'Status', render: (v: any) => (
            <span style={{
                padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700,
                background: v === 'SHORTAGE' ? '#fee2e2' : v === 'EXCESS' ? '#fef9c3' : '#dcfce7',
                color: v === 'SHORTAGE' ? '#dc2626' : v === 'EXCESS' ? '#b45309' : '#16a34a',
            }}>{v}</span>
        )},
    ];

    const shortages = filtered.filter(r => r.stock_status === 'SHORTAGE').length;
    const excesses  = filtered.filter(r => r.stock_status === 'EXCESS').length;

    return (
        <div>
            <FilterBar startDate={startDate} endDate={endDate} onStartChange={setStartDate} onEndChange={setEndDate}
                onRefresh={fetch} loading={loading}
                extra={
                    <>
                        <select value={filterType} onChange={e => setFilterType(e.target.value)}
                            style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--slate-200)', fontSize: 12 }}>
                            <option value="ALL">All Statuses</option>
                            <option value="SHORTAGE">Shortage Only</option>
                            <option value="EXCESS">Excess Only</option>
                            <option value="NORMAL">Normal Only</option>
                        </select>
                        <ExportBtn onClick={() => exportToCsv(`shortage_excess_${today}.csv`, filtered, [
                            { header: 'Salesperson', accessor: r => r.salesperson },
                            { header: 'Product', accessor: r => r.product_name },
                            { header: 'Stock Given', accessor: r => r.stock_given },
                            { header: 'Qty Sold', accessor: r => r.qty_sold },
                            { header: 'Van Balance', accessor: r => r.van_stock },
                            { header: 'Status', accessor: r => r.stock_status },
                        ])} />
                    </>
                }
            />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 20 }}>
                <StatCard title="Salespersons"   value={new Set(filtered.map(r => r.salesperson)).size} icon={<Users size={20} />} color="blue" />
                <StatCard title="Products"       value={filtered.length} icon={<Package size={20} />} color="teal" />
                <StatCard title="Shortages"      value={shortages} icon={<AlertTriangle size={20} />} color="red" />
                <StatCard title="Excess Stock"   value={excesses} icon={<ArrowUpDown size={20} />} color="amber" />
            </div>
            <DataTable columns={columns} data={filtered} loading={loading} searchPlaceholder="Search salesperson or product..." />
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 9. PRODUCT REQUISITIONS
// ═══════════════════════════════════════════════════════════════════════════════

function RequisitionsReport() {
    const [data, setData]         = useState<any[]>([]);
    const [loading, setLoading]   = useState(false);
    const [noTable, setNoTable]   = useState(false);
    const [startDate, setStartDate] = useState(firstOfMonth);
    const [endDate, setEndDate]     = useState(today);
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [expanded, setExpanded]   = useState<string | null>(null);

    const fetch = useCallback(async () => {
        setLoading(true);
        setNoTable(false);
        try {
            const { data: rows, error } = await supabase
                .from('requisitions')
                .select(`
                    id, requisition_number, status, notes, created_at,
                    salesperson_name, route_name,
                    items:requisition_items(
                        id, quantity_requested, quantity_approved, quantity_issued, notes,
                        product:products(id, name, sku)
                    )
                `)
                .gte('created_at', startDate)
                .lte('created_at', endDate + 'T23:59:59')
                .order('created_at', { ascending: false });

            if (error) {
                // Table does not exist yet
                if (error.message?.includes('does not exist') || error.code === '42P01') {
                    setNoTable(true);
                } else {
                    throw error;
                }
                return;
            }

            setData((rows || []).map((r: any) => ({
                id: r.id,
                requisition_number: r.requisition_number,
                created_at: r.created_at,
                salesperson_name: r.salesperson_name ?? 'Unassigned',
                route_name: r.route_name ?? '-',
                status: r.status,
                notes: r.notes ?? '',
                item_count: (r.items || []).length,
                total_requested: (r.items || []).reduce((s: number, i: any) => s + (i.quantity_requested || 0), 0),
                total_approved:  (r.items || []).reduce((s: number, i: any) => s + (i.quantity_approved  || 0), 0),
                total_issued:    (r.items || []).reduce((s: number, i: any) => s + (i.quantity_issued    || 0), 0),
                items: r.items || [],
            })));
        } catch (e: any) { toast.error(e.message); }
        finally { setLoading(false); }
    }, [startDate, endDate]);

    useEffect(() => { fetch(); }, [fetch]);

    const filtered = statusFilter === 'ALL' ? data : data.filter(r => r.status === statusFilter);
    const statusVariant = (s: string) => s === 'FULFILLED' ? 'success' : s === 'APPROVED' ? 'info' : s === 'REJECTED' ? 'danger' : 'warning';

    if (noTable) {
        return (
            <div style={{ textAlign: 'center', padding: 60 }}>
                <ClipboardList size={48} style={{ color: 'var(--slate-300)', marginBottom: 16 }} />
                <h3 style={{ fontWeight: 700, marginBottom: 8, color: 'var(--slate-700)' }}>Requisitions Not Set Up</h3>
                <p style={{ color: 'var(--slate-500)', fontSize: 13 }}>
                    The requisitions table has not been created yet. Run the complete sales system migration to enable this feature.
                </p>
            </div>
        );
    }

    return (
        <div>
            <FilterBar startDate={startDate} endDate={endDate} onStartChange={setStartDate} onEndChange={setEndDate}
                onRefresh={fetch} loading={loading}
                extra={
                    <>
                        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
                            style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--slate-200)', fontSize: 12 }}>
                            <option value="ALL">All Statuses</option>
                            <option value="PENDING">Pending</option>
                            <option value="APPROVED">Approved</option>
                            <option value="REJECTED">Rejected</option>
                            <option value="FULFILLED">Fulfilled</option>
                        </select>
                        <ExportBtn onClick={() => exportToCsv(`requisitions_${today}.csv`, filtered, [
                            { header: 'Requisition No.', accessor: r => r.requisition_number },
                            { header: 'Date', accessor: r => new Date(r.created_at).toLocaleDateString('en-GB') },
                            { header: 'Salesperson', accessor: r => r.salesperson_name },
                            { header: 'Route', accessor: r => r.route_name },
                            { header: 'Items', accessor: r => r.item_count },
                            { header: 'Total Requested', accessor: r => r.total_requested },
                            { header: 'Total Approved',  accessor: r => r.total_approved },
                            { header: 'Total Issued',    accessor: r => r.total_issued },
                            { header: 'Status', accessor: r => r.status },
                        ])} />
                    </>
                }
            />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 20 }}>
                <StatCard title="Total"     value={filtered.length} icon={<ClipboardList size={20} />} color="blue" />
                <StatCard title="Pending"   value={filtered.filter(r => r.status === 'PENDING').length} icon={<Clock size={20} />} color="amber" />
                <StatCard title="Approved"  value={filtered.filter(r => r.status === 'APPROVED').length} icon={<CheckCircle size={20} />} color="teal" />
                <StatCard title="Fulfilled" value={filtered.filter(r => r.status === 'FULFILLED').length} icon={<Package size={20} />} color="green" />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {loading && <div style={{ textAlign: 'center', padding: 40, color: 'var(--slate-400)' }}>Loading...</div>}
                {!loading && filtered.length === 0 && (
                    <div style={{ textAlign: 'center', padding: 40, color: 'var(--slate-400)' }}>No requisitions found for this period.</div>
                )}
                {filtered.map(req => (
                    <div key={req.id} style={{ border: '1px solid var(--slate-200)', borderRadius: 12, overflow: 'hidden', background: 'var(--card-bg)' }}>
                        <div onClick={() => setExpanded(expanded === req.id ? null : req.id)}
                            style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '12px 16px', cursor: 'pointer',
                                borderBottom: expanded === req.id ? '1px solid var(--slate-200)' : 'none' }}>
                            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--primary-600)', fontSize: 12, minWidth: 120 }}>
                                {req.requisition_number}
                            </span>
                            <span style={{ fontSize: 12, color: 'var(--slate-500)', minWidth: 90 }}>
                                {new Date(req.created_at).toLocaleDateString('en-GB')}
                            </span>
                            <span style={{ fontWeight: 600, fontSize: 12, flex: 1 }}>{req.salesperson_name}</span>
                            <span style={{ fontSize: 12, color: 'var(--slate-500)', minWidth: 100 }}>{req.route_name}</span>
                            <span style={{ fontSize: 12, color: 'var(--slate-500)', minWidth: 70 }}>{req.item_count} item{req.item_count !== 1 ? 's' : ''}</span>
                            <StatusBadge status={req.status} variant={statusVariant(req.status)} />
                            <span style={{ color: 'var(--slate-400)', fontSize: 12 }}>{expanded === req.id ? '▲' : '▼'}</span>
                        </div>
                        {expanded === req.id && (
                            <div style={{ padding: '12px 16px' }}>
                                {req.notes && <div style={{ fontSize: 12, color: 'var(--slate-500)', marginBottom: 12, fontStyle: 'italic' }}>Note: {req.notes}</div>}
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                                    <thead>
                                        <tr style={{ background: 'var(--slate-50)' }}>
                                            {['Product', 'SKU', 'Requested', 'Approved', 'Issued'].map(h => (
                                                <th key={h} style={{ textAlign: h === 'Product' || h === 'SKU' ? 'left' : 'center', padding: '8px 12px', fontWeight: 600, color: 'var(--slate-600)' }}>{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {req.items.map((item: any) => (
                                            <tr key={item.id} style={{ borderTop: '1px solid var(--slate-100)' }}>
                                                <td style={{ padding: '8px 12px', fontWeight: 600 }}>{item.product?.name ?? '-'}</td>
                                                <td style={{ padding: '8px 12px', fontFamily: 'var(--font-mono)', color: 'var(--slate-500)' }}>{item.product?.sku ?? '-'}</td>
                                                <td style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 700 }}>{item.quantity_requested}</td>
                                                <td style={{ padding: '8px 12px', textAlign: 'center', color: 'var(--primary-600)', fontWeight: 600 }}>{item.quantity_approved ?? '—'}</td>
                                                <td style={{ padding: '8px 12px', textAlign: 'center', color: 'var(--success)', fontWeight: 600 }}>{item.quantity_issued ?? '—'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 10. PRODUCTS DISTRIBUTION REPORT
// ═══════════════════════════════════════════════════════════════════════════════

function ProductDistributionReport() {
    const [data, setData]               = useState<any[]>([]);
    const [loading, setLoading]         = useState(false);
    const [startDate, setStartDate]     = useState(firstOfMonth);
    const [endDate, setEndDate]         = useState(today);
    const [productFilter, setProductFilter] = useState('ALL');
    const [products, setProducts]       = useState<{ id: string; name: string }[]>([]);

    const fetch = useCallback(async () => {
        setLoading(true);
        try {
            const { data: items, error } = await supabase
                .from('sales_invoice_items')
                .select(`
                    product_id, quantity, unit_price,
                    discount_pct, discount_amount, total_price,
                    product:products(id, name, sku),
                    invoice:sales_invoices!inner(invoice_number, customer_name, date, status, route_id)
                `)
                .in('invoice.status', ['Issued', 'ISSUED', 'Partially Paid', 'PARTIALLY PAID', 'Paid', 'PAID'])
                .gte('invoice.date', startDate)
                .lte('invoice.date', endDate);

            if (error) throw error;

            // Aggregate per product
            const map: Record<string, {
                product_id: string;
                product_name: string;
                sku: string;
                qty_distributed: number;
                invoice_count: number;
                customers: Set<string>;
                gross_revenue: number;
                total_discount: number;
                net_revenue: number;
            }> = {};

            for (const item of items || []) {
                const prod = item.product as any;
                const inv  = item.invoice as any;
                if (!prod || !inv) continue;

                const pid = item.product_id;
                if (!map[pid]) {
                    map[pid] = {
                        product_id: pid,
                        product_name: prod.name ?? 'Unknown',
                        sku: prod.sku ?? '-',
                        qty_distributed: 0,
                        invoice_count: 0,
                        customers: new Set(),
                        gross_revenue: 0,
                        total_discount: 0,
                        net_revenue: 0,
                    };
                }

                const qty  = Number(item.quantity    || 0);
                const price = Number(item.unit_price || 0);
                const disc = Number(item.discount_amount || (qty * price * (Number(item.discount_pct || 0) / 100)));
                const net  = Number(item.total_price || (qty * price - disc));

                map[pid].qty_distributed += qty;
                map[pid].invoice_count   += 1;
                map[pid].customers.add(inv.customer_name ?? 'Unknown');
                map[pid].gross_revenue   += qty * price;
                map[pid].total_discount  += disc;
                map[pid].net_revenue     += net;
            }

            const rows = Object.values(map).map(r => ({
                product_id:      r.product_id,
                product_name:    r.product_name,
                sku:             r.sku,
                qty_distributed: r.qty_distributed,
                invoice_count:   r.invoice_count,
                customer_count:  r.customers.size,
                gross_revenue:   r.gross_revenue,
                total_discount:  r.total_discount,
                net_revenue:     r.net_revenue,
            })).sort((a, b) => b.qty_distributed - a.qty_distributed);

            const uniqueProducts = rows.map(r => ({ id: r.product_id, name: r.product_name }))
                .sort((a, b) => a.name.localeCompare(b.name));
            setProducts(uniqueProducts);
            setData(rows);
        } catch (e: any) { toast.error(e.message); }
        finally { setLoading(false); }
    }, [startDate, endDate]);

    useEffect(() => { fetch(); }, [fetch]);

    const filtered = productFilter === 'ALL'
        ? data
        : data.filter(r => r.product_id === productFilter);

    const totalQty      = filtered.reduce((s, r) => s + r.qty_distributed, 0);
    const totalGross    = filtered.reduce((s, r) => s + r.gross_revenue,   0);
    const totalDiscount = filtered.reduce((s, r) => s + r.total_discount,  0);
    const totalNet      = filtered.reduce((s, r) => s + r.net_revenue,     0);

    const columns = [
        {
            key: 'product_name',
            label: 'Product',
            render: (v: any) => <span style={{ fontWeight: 700, color: 'var(--slate-800)' }}>{v}</span>,
        },
        {
            key: 'sku',
            label: 'SKU',
            render: (v: any) => (
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--slate-500)' }}>{v}</span>
            ),
        },
        {
            key: 'qty_distributed',
            label: 'Qty Distributed',
            render: (v: any) => <span style={{ fontWeight: 800, color: 'var(--primary-700)', fontSize: 13 }}>{v}</span>,
        },
        {
            key: 'invoice_count',
            label: 'Invoices',
            render: (v: any) => <span style={{ color: 'var(--slate-600)' }}>{v}</span>,
        },
        {
            key: 'customer_count',
            label: 'Customers',
            render: (v: any) => <span style={{ color: 'var(--slate-600)' }}>{v}</span>,
        },
        {
            key: 'gross_revenue',
            label: 'Gross Revenue',
            render: (v: any) => <span style={{ fontWeight: 600 }}>{formatCurrency(v)}</span>,
        },
        {
            key: 'total_discount',
            label: 'Discount Given',
            render: (v: any) => (
                <span style={{ color: v > 0 ? '#16a34a' : 'var(--slate-400)', fontWeight: v > 0 ? 600 : 400 }}>
                    {v > 0 ? `\u2212${formatCurrency(v)}` : '\u2014'}
                </span>
            ),
        },
        {
            key: 'net_revenue',
            label: 'Net Revenue',
            render: (v: any) => (
                <span style={{ fontWeight: 800, color: 'var(--primary-600)' }}>{formatCurrency(v)}</span>
            ),
        },
    ];

    return (
        <div>
            <FilterBar
                startDate={startDate} endDate={endDate}
                onStartChange={setStartDate} onEndChange={setEndDate}
                onRefresh={fetch} loading={loading}
                extra={
                    <>
                        <select
                            value={productFilter}
                            onChange={e => setProductFilter(e.target.value)}
                            style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--slate-200)', fontSize: 12, minWidth: 180 }}
                        >
                            <option value="ALL">All Products</option>
                            {products.map(p => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                        </select>
                        <ExportBtn onClick={() => exportToCsv(`product_distribution_${today}.csv`, filtered, [
                            { header: 'Product',         accessor: (r: any) => r.product_name },
                            { header: 'SKU',             accessor: (r: any) => r.sku },
                            { header: 'Qty Distributed', accessor: (r: any) => r.qty_distributed },
                            { header: 'Invoices',        accessor: (r: any) => r.invoice_count },
                            { header: 'Customers',       accessor: (r: any) => r.customer_count },
                            { header: 'Gross Revenue',   accessor: (r: any) => r.gross_revenue.toFixed(2) },
                            { header: 'Discount Given',  accessor: (r: any) => r.total_discount.toFixed(2) },
                            { header: 'Net Revenue',     accessor: (r: any) => r.net_revenue.toFixed(2) },
                        ])} />
                    </>
                }
            />

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 20 }}>
                <StatCard title="Products Sold"   value={filtered.length}               icon={<Package size={20} />}     color="blue" />
                <StatCard title="Total Qty Out"   value={totalQty}                      icon={<ArrowUpDown size={20} />} color="teal" />
                <StatCard title="Discounts Given" value={formatCurrency(totalDiscount)} icon={<Banknote size={20} />}    color="amber" />
                <StatCard title="Net Revenue"     value={formatCurrency(totalNet)}      icon={<TrendingUp size={20} />}  color="green" />
            </div>

            {totalGross > 0 && (
                <div style={{
                    background: 'var(--card-bg)', border: '1px solid var(--slate-200)',
                    borderRadius: 12, padding: '16px 20px', marginBottom: 20,
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 600, marginBottom: 8 }}>
                        <span style={{ color: 'var(--slate-600)' }}>
                            Gross: <strong style={{ color: 'var(--slate-800)' }}>{formatCurrency(totalGross)}</strong>
                        </span>
                        <span style={{ color: '#16a34a' }}>
                            Discount: <strong>&minus;{formatCurrency(totalDiscount)}</strong>
                            &nbsp;({((totalDiscount / totalGross) * 100).toFixed(1)}%)
                        </span>
                        <span style={{ color: 'var(--primary-700)' }}>
                            Net Revenue: <strong>{formatCurrency(totalNet)}</strong>
                        </span>
                    </div>
                    <div style={{ height: 10, background: 'var(--slate-100)', borderRadius: 5, overflow: 'hidden' }}>
                        <div style={{
                            height: '100%',
                            width: `${(totalNet / totalGross) * 100}%`,
                            background: 'linear-gradient(90deg, var(--primary-600), var(--primary-400))',
                            borderRadius: 5,
                            transition: 'width 0.5s',
                        }} />
                    </div>
                </div>
            )}

            <DataTable
                columns={columns}
                data={filtered}
                loading={loading}
                searchPlaceholder="Search product or SKU..."
            />
        </div>
    );
}
