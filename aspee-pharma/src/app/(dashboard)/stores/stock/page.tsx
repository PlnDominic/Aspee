'use client';

import React, { useState } from 'react';
import PageHeader from '@/components/PageHeader';
import DataTable from '@/components/DataTable';
import StatCard from '@/components/StatCard';
import StatusBadge from '@/components/StatusBadge';
import EntityLink from '@/components/EntityLink';
import { Boxes, Package, AlertTriangle, MapPin, Download, RefreshCw, Send } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useFetch } from '@/lib/hooks';
import SendToMDModal from '@/components/SendToMDModal';

interface Location {
    id: string;
    name: string;
    type: string;
}

interface StockRow {
    product_id: string;
    product_name: string;
    sku: string;
    unit: string;
    material_type: string;
    reorder_level: number;
    locations: Record<string, number>;
    total: number;
    approved_qty: number;
    status: string;
}

interface StockData {
    rows: StockRow[];
    locations: Location[];
}

export default function StockLevelsPage() {
    const [filterType, setFilterType] = useState<string>('All');
    const [isReportModalOpen, setIsReportModalOpen] = useState(false);

    const { data: stockData, isLoading: loading, refetch } = useFetch<StockData>(
        ['stock-levels-matrix'],
        async () => {
            const [locRes, prodRes, stockRes, qaRes] = await Promise.all([
                supabase.from('stock_locations').select('*').order('name'),
                supabase.from('products').select('id, name, sku, unit, material_type, reorder_level').order('name'),
                supabase.from('stock_levels').select('product_id, location_id, qty_on_hand'),
                supabase.from('grn_items').select('product_id, quantity_received').eq('qa_status', 'Approved'),
            ]);

            if (locRes.error) throw locRes.error;
            if (prodRes.error) throw prodRes.error;
            if (stockRes.error) throw stockRes.error;
            if (qaRes.error) throw qaRes.error;

            const locs = locRes.data || [];
            const products = prodRes.data || [];
            const levels = stockRes.data || [];
            const qaItems = qaRes.data || [];

            // Build a lookup: product_id -> location_id -> qty
            const stockMap: Record<string, Record<string, number>> = {};
            for (const level of levels) {
                if (!stockMap[level.product_id]) stockMap[level.product_id] = {};
                stockMap[level.product_id][level.location_id] = level.qty_on_hand;
            }

            // Build lookup for approved QA qty
            const approvedMap: Record<string, number> = {};
            for (const item of qaItems) {
                approvedMap[item.product_id] = (approvedMap[item.product_id] || 0) + (item.quantity_received || 0);
            }

            // Build rows for every product
            const rows: StockRow[] = products.map(product => {
                const locQtys = stockMap[product.id] || {};
                const locationValues: Record<string, number> = {};
                let total = 0;

                for (const loc of locs) {
                    const qty = locQtys[loc.id] || 0;
                    locationValues[loc.id] = qty;
                    total += qty;
                }

                const approved_qty = approvedMap[product.id] || 0;

                const reorder = product.reorder_level || 0;
                let status = 'Adequate';
                if (total === 0) {
                    status = 'Out of Stock';
                } else if (reorder > 0 && total <= reorder) {
                    status = 'Low';
                } else if (reorder > 0 && total <= reorder * 1.5) {
                    status = 'Warning';
                }

                return {
                    product_id: product.id,
                    product_name: product.name,
                    sku: product.sku,
                    unit: product.unit,
                    material_type: product.material_type,
                    reorder_level: reorder,
                    locations: locationValues,
                    total,
                    approved_qty,
                    status,
                };
            });

            return { data: { rows, locations: locs }, error: null };
        }
    );

    const stockRows = stockData?.rows ?? [];
    const locations = stockData?.locations ?? [];

    const materialTypes = ['All', ...Array.from(new Set(stockRows.map(r => r.material_type).filter(Boolean)))];
    const filteredRows = filterType === 'All' ? stockRows : stockRows.filter(r => r.material_type === filterType);

    const stats = {
        totalProducts: stockRows.length,
        totalUnits: stockRows.reduce((sum, r) => sum + r.total, 0),
        lowStock: stockRows.filter(r => r.status === 'Low' || r.status === 'Warning').length,
        outOfStock: stockRows.filter(r => r.status === 'Out of Stock').length,
    };

    const statusVariant = (s: string): 'success' | 'warning' | 'danger' | 'default' => {
        switch (s) {
            case 'Adequate': return 'success';
            case 'Warning': return 'warning';
            case 'Low': return 'warning';
            case 'Out of Stock': return 'danger';
            default: return 'default';
        }
    };

    const handleExport = () => {
        if (filteredRows.length === 0) return;
        const locHeaders = locations.map(l => l.name);
        const headers = ['Product', 'SKU', 'Unit', 'Type', ...locHeaders, 'Total', 'Approved Qty', 'Reorder Level', 'Status'];
        const csvContent = [
            headers.join(','),
            ...filteredRows.map(r => [
                `"${r.product_name}"`,
                `"${r.sku}"`,
                `"${r.unit}"`,
                `"${r.material_type}"`,
                ...locations.map(l => r.locations[l.id] || 0),
                r.total,
                r.approved_qty,
                r.reorder_level,
                `"${r.status}"`
            ].join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `stock_inventory_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // Build dynamic columns based on locations
    const columns = [
        {
            key: 'product_name',
            label: 'Product',
            render: (v: any, row: any) => (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <EntityLink href={`/stores/products?search=${encodeURIComponent(v)}`}>{v}</EntityLink>
                    <span style={{ fontSize: 10, color: 'var(--slate-400)' }}>{row.material_type}</span>
                </div>
            )
        },
        {
            key: 'sku',
            label: 'SKU',
            render: (v: any) => (
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>{v}</span>
            )
        },
        { key: 'unit', label: 'Unit' },
        // Dynamic location columns
        ...locations.map(loc => ({
            key: `loc_${loc.id}`,
            label: loc.name,
            render: (_: any, row: any) => {
                const qty = row.locations[loc.id] || 0;
                return (
                    <span style={{
                        fontWeight: 600,
                        color: qty === 0 ? 'var(--slate-300)' : 'var(--slate-700)',
                    }}>
                        {qty.toLocaleString()}
                    </span>
                );
            }
        })),
        {
            key: 'total',
            label: 'Total Stock',
            render: (v: any) => (
                <span style={{ fontWeight: 700, color: 'var(--slate-900)', fontSize: 12 }}>
                    {(v as number).toLocaleString()}
                </span>
            )
        },
        {
            key: 'approved_qty',
            label: 'Approved Qty',
            render: (v: any) => (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontWeight: 700, color: 'var(--success)', fontSize: 12 }}>
                        {(v as number).toLocaleString()}
                    </span>
                    <span style={{ fontSize: 9, color: 'var(--slate-400)', fontWeight: 500 }}>Quality Release</span>
                </div>
            )
        },
        {
            key: 'reorder_level',
            label: 'Reorder Lvl',
            render: (v: any) => (
                <span style={{ color: 'var(--slate-500)' }}>{v || '-'}</span>
            )
        },
        {
            key: 'status',
            label: 'Status',
            render: (v: any) => (
                <StatusBadge status={v} variant={statusVariant(v)} />
            )
        },
    ];

    return (
        <div className="animate-fade-in">
            <PageHeader
                title="Stock Inventory"
                subtitle="Real-time inventory levels across all locations"
                breadcrumbs={[
                    { label: 'Stores', href: '/stores/products' },
                    { label: 'Stock Inventory' },
                ]}
                actions={
                    <div style={{ display: 'flex', gap: 10 }}>
                        <button
                            onClick={() => setIsReportModalOpen(true)}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                                padding: '10px 16px',
                                borderRadius: 10,
                                background: 'linear-gradient(135deg, #0f766e, #14b8a6)',
                                color: 'white',
                                fontSize: 13,
                                fontWeight: 700,
                                border: 'none',
                                cursor: 'pointer',
                            }}
                        >
                            <Send size={15} /> Send Weekly Report
                        </button>
                        <button
                            onClick={() => refetch()}
                            style={{
                                display: 'flex', alignItems: 'center', gap: 8,
                                padding: '9px 16px', borderRadius: 8,
                                border: '1px solid var(--slate-200)', background: 'var(--card-bg)',
                                fontSize: 11, fontWeight: 500, color: 'var(--slate-700)',
                                cursor: 'pointer',
                            }}
                        >
                            <RefreshCw size={16} /> Refresh
                        </button>
                        <button
                            onClick={handleExport}
                            disabled={filteredRows.length === 0}
                            style={{
                                display: 'flex', alignItems: 'center', gap: 8,
                                padding: '9px 16px', borderRadius: 8,
                                border: '1px solid var(--slate-200)', background: 'var(--card-bg)',
                                fontSize: 11, fontWeight: 500, color: 'var(--slate-700)',
                                cursor: 'pointer', opacity: filteredRows.length === 0 ? 0.5 : 1,
                            }}
                        >
                            <Download size={16} /> Export
                        </button>
                    </div>
                }
            />

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
                <StatCard title="Total Products" value={stats.totalProducts.toString()} icon={<Package size={20} />} color="blue" />
                <StatCard title="Total Units in Stock" value={stats.totalUnits.toLocaleString()} icon={<Boxes size={20} />} color="teal" />
                <StatCard title="Low Stock Items" value={stats.lowStock.toString()} icon={<AlertTriangle size={20} />} color="amber" />
                <StatCard title="Out of Stock" value={stats.outOfStock.toString()} icon={<AlertTriangle size={20} />} color="red" />
            </div>

            {/* Location summary cards */}
            {locations.length > 0 && (
                <div style={{
                    display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap',
                }}>
                    {locations.map(loc => {
                        const locTotal = stockRows.reduce((sum, r) => sum + (r.locations[loc.id] || 0), 0);
                        const itemCount = stockRows.filter(r => (r.locations[loc.id] || 0) > 0).length;
                        return (
                            <div
                                key={loc.id}
                                style={{
                                    flex: '1 1 180px',
                                    background: 'var(--card-bg)',
                                    borderRadius: 10,
                                    border: '1px solid var(--slate-200)',
                                    padding: '14px 18px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 12,
                                }}
                            >
                                <div style={{
                                    width: 36, height: 36, borderRadius: 8,
                                    background: 'var(--primary-50)', color: 'var(--primary-500)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                                }}>
                                    <MapPin size={18} />
                                </div>
                                <div>
                                    <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--slate-800)', margin: 0 }}>{loc.name}</p>
                                    <p style={{ fontSize: 10, color: 'var(--slate-400)', margin: 0 }}>
                                        {locTotal.toLocaleString()} units &middot; {itemCount} items
                                    </p>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Material type filter tabs */}
            {materialTypes.length > 1 && (
                <div style={{
                    display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap',
                }}>
                    {materialTypes.map(type => (
                        <button
                            key={type}
                            onClick={() => setFilterType(type)}
                            style={{
                                padding: '6px 14px',
                                borderRadius: 20,
                                border: filterType === type ? 'none' : '1px solid var(--slate-200)',
                                background: filterType === type
                                    ? 'linear-gradient(135deg, var(--primary-600), var(--primary-500))'
                                    : 'white',
                                color: filterType === type ? 'white' : 'var(--slate-600)',
                                fontSize: 11,
                                fontWeight: filterType === type ? 600 : 400,
                                cursor: 'pointer',
                                transition: 'all 0.15s ease',
                            }}
                        >
                            {type}
                        </button>
                    ))}
                </div>
            )}

            <DataTable
                columns={columns}
                data={filteredRows as unknown as Record<string, unknown>[]}
                loading={loading}
                searchPlaceholder="Search by product name, SKU, or type..."
                emptyMessage="No stock records found"
            />

            <SendToMDModal 
                isOpen={isReportModalOpen} 
                onClose={() => setIsReportModalOpen(false)} 
                department="Stores" 
            />
        </div>
    );
}
