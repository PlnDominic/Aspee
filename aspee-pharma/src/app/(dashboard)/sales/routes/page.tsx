'use client';

import React, { useState } from 'react';
import PageHeader from '@/components/PageHeader';
import DataTable from '@/components/DataTable';
import StatCard from '@/components/StatCard';
import StatusBadge from '@/components/StatusBadge';
import VanModal from '@/components/VanModal';
import { Plus, Route, Banknote, MapPin, Users, Edit2, Trash2, Eye } from 'lucide-react';
import { useSupabaseQuery, useDelete } from '@/lib/hooks';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { formatCurrency } from '@/lib/currency';
import { toast } from 'sonner';

export default function RoutesPage() {
    const { data, isLoading: loading } = useSupabaseQuery<any>('vans');
    const vans = data ?? [];
    const queryClient = useQueryClient();

    const { data: loadedValueMap = {} } = useQuery<Record<string, number>>({
        queryKey: ['vans', 'loaded-values', vans.map(v => v.van_id).join(',')],
        enabled: vans.length > 0,
        queryFn: async () => {
            const locationNames = vans
                .map((v: any) => v.van_id ? `Sales Van - ${v.van_id}` : null)
                .filter((n: string | null): n is string => !!n);

            if (locationNames.length === 0) return {};

            const { data: locations } = await supabase
                .from('stock_locations')
                .select('id, name')
                .in('name', locationNames);

            const locationIdToVanId = new Map<string, string>();
            for (const loc of locations || []) {
                const vanId = (loc.name as string).replace(/^Sales Van - /, '');
                locationIdToVanId.set(loc.id, vanId);
            }

            const locationIds = Array.from(locationIdToVanId.keys());
            if (locationIds.length === 0) return {};

            const { data: stockRows } = await supabase
                .from('stock_levels')
                .select('product_id, location_id, qty_on_hand')
                .in('location_id', locationIds);

            const productIds = Array.from(new Set((stockRows || []).map(r => r.product_id).filter(Boolean)));
            if (productIds.length === 0) return {};

            const { data: products } = await supabase
                .from('products')
                .select('id, cash_price, unit_price')
                .in('id', productIds);

            const priceMap = new Map<string, number>();
            for (const p of products || []) {
                priceMap.set(p.id, Number((p as any).cash_price ?? (p as any).unit_price ?? 0));
            }

            const totals: Record<string, number> = {};
            for (const row of stockRows || []) {
                const vanId = locationIdToVanId.get(row.location_id);
                if (!vanId) continue;
                const qty = Number(row.qty_on_hand) || 0;
                const price = priceMap.get(row.product_id) || 0;
                totals[vanId] = (totals[vanId] || 0) + qty * price;
            }
            return totals;
        },
    });

    const { data: todaysSalesMap = {} } = useQuery<Record<string, number>>({
        queryKey: ['vans', 'todays-sales', vans.map(v => v.id).join(',')],
        enabled: vans.length > 0,
        queryFn: async () => {
            const today = new Date().toISOString().split('T')[0];
            const vanIds = vans.map((v: any) => v.id).filter(Boolean);
            if (vanIds.length === 0) return {};

            const { data: invoices } = await supabase
                .from('sales_invoices')
                .select('route_id, total_amount, status')
                .in('route_id', vanIds)
                .eq('date', today);

            // Map by route_id (= van.id) to total sales, only committed invoices
            const totals: Record<string, number> = {};
            for (const inv of invoices || []) {
                const status = String(inv.status || '').trim().toUpperCase();
                if (!['ISSUED', 'PAID', 'PARTIAL', 'OVERDUE'].includes(status)) continue;
                totals[inv.route_id] = (totals[inv.route_id] || 0) + (Number(inv.total_amount) || 0);
            }
            return totals;
        },
    });

    const vansWithLoadedValue = vans.map((v: any) => ({
        ...v,
        loaded_value: loadedValueMap[v.van_id] ?? 0,
        today_sales: todaysSalesMap[v.id] ?? 0,
    }));

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedVan, setSelectedVan] = useState<any>(null);
    const [viewOnly, setViewOnly] = useState(false);

    const deleteMutation = useDelete('vans');

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this route?')) return;
        deleteMutation.mutate(id);
    };

    const getStatusVariant = (status: string) => {
        switch (status) {
            case 'On Route': return 'success';
            case 'Loading': return 'warning';
            case 'Returning': return 'info';
            case 'Maintenance': return 'danger';
            default: return 'default';
        }
    };

    // Stats
    const activeRouteCount = vansWithLoadedValue.filter(v => v.status !== 'Maintenance').length;
    const todaysRevenue = vansWithLoadedValue.reduce((sum, v) => sum + (parseFloat(v.today_sales) || 0), 0);
    const activeRoutes = new Set(vansWithLoadedValue.filter(v => v.status === 'On Route').map(v => v.route_area)).size;
    const totalCustomers = vansWithLoadedValue.reduce((sum, v) => sum + (parseInt(v.customer_count) || 0), 0);

    const columns = [
        {
            key: 'van_id',
            label: 'Route Heading',
            render: (v: unknown) => <span style={{ fontWeight: 700, color: 'var(--primary-600)' }}>{v as string}</span>
        },
        {
            key: 'plate_number',
            label: 'Vehicle Plate',
            render: (v: unknown) => <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>{(v as string) || '-'}</span>
        },
        { key: 'driver_name', label: 'Sales Person' },
        {
            key: 'route_area',
            label: 'Locations',
            render: (v: unknown) => {
                const locations = String(v || '')
                    .split(/\s*(?:\/|,|\||\band\b)\s*/i)
                    .map((location) => location.trim())
                    .filter(Boolean);

                if (locations.length === 0) return <span>-</span>;

                return (
                    <div style={{ display: 'grid', gap: 3 }}>
                        {locations.map((location, index) => (
                            <span key={`${location}-${index}`} style={{ fontSize: 11, color: 'var(--slate-700)' }}>
                                {location}
                            </span>
                        ))}
                    </div>
                );
            }
        },
        {
            key: 'loaded_value',
            label: 'Loaded Value',
            render: (v: unknown) => <span style={{ fontWeight: 600 }}>{formatCurrency(parseFloat(v as string) || 0)}</span>
        },
        {
            key: 'today_sales',
            label: "Today's Sales",
            render: (v: unknown) => <span style={{ fontWeight: 600, color: 'var(--success)' }}>{formatCurrency(parseFloat(v as string) || 0)}</span>
        },
        { key: 'customer_count', label: 'Customers' },
        {
            key: 'status',
            label: 'Status',
            render: (v: unknown) => {
                const status = v as string;
                return <StatusBadge status={status} variant={getStatusVariant(status)} />;
            }
        },
        {
            key: 'actions',
            label: 'Actions',
            width: '140px',
            render: (_: any, row: any) => (
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                        onClick={() => { setSelectedVan(row); setViewOnly(true); setIsModalOpen(true); }}
                        style={{ padding: 6, borderRadius: 6, border: '1px solid var(--slate-200)', background: 'var(--card-bg)', color: 'var(--slate-600)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        title="View Route"
                    >
                        <Eye size={14} />
                    </button>
                    <button
                        onClick={() => { setSelectedVan(row); setViewOnly(false); setIsModalOpen(true); }}
                        style={{ padding: 6, borderRadius: 6, border: '1px solid var(--slate-200)', background: 'var(--card-bg)', color: 'var(--primary-600)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        title="Edit Route"
                    >
                        <Edit2 size={14} />
                    </button>
                    <button
                        onClick={() => handleDelete(row.id)}
                        style={{ padding: 6, borderRadius: 6, border: '1px solid var(--slate-200)', background: 'var(--card-bg)', color: 'var(--danger)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        title="Delete Route"
                    >
                        <Trash2 size={14} />
                    </button>
                </div>
            )
        }
    ];

    return (
        <div className="animate-fade-in">
            <PageHeader
                title="Routes"
                subtitle="Sales person route assignments, locations, and daily operations"
                breadcrumbs={[{ label: 'Routes' }]}
                actions={
                    <button
                        onClick={() => { setSelectedVan(null); setViewOnly(false); setIsModalOpen(true); }}
                        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 18px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg, var(--primary-600), var(--primary-500))', fontSize: 11, fontWeight: 600, color: 'white', cursor: 'pointer' }}
                    >
                        <Plus size={16} /> Add Route
                    </button>
                }
            />

            <div className="animate-stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
                <StatCard title="Active Routes" value={activeRouteCount} icon={<Route size={20} />} color="blue" />
                <StatCard title="Today's Revenue" value={formatCurrency(todaysRevenue)} icon={<Banknote size={20} />} color="green" />
                <StatCard title="Routes On Road" value={activeRoutes} icon={<MapPin size={20} />} color="teal" />
                <StatCard title="Total Customers" value={totalCustomers} icon={<Users size={20} />} color="purple" />
            </div>

            <DataTable
                columns={columns}
                data={vansWithLoadedValue}
                loading={loading}
                searchPlaceholder="Search routes or locations..."
            />

            <VanModal
                isOpen={isModalOpen}
                onClose={() => { setIsModalOpen(false); setViewOnly(false); }}
                onSuccess={() => { toast.success(selectedVan ? 'Route updated successfully' : 'Route added successfully'); queryClient.invalidateQueries({ queryKey: ['vans'] }); }}
                record={selectedVan}
                readOnly={viewOnly}
            />
        </div>
    );
}
