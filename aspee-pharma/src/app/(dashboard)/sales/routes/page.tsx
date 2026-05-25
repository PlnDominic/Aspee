'use client';

import React, { useState } from 'react';
import PageHeader from '@/components/PageHeader';
import DataTable from '@/components/DataTable';
import StatCard from '@/components/StatCard';
import StatusBadge from '@/components/StatusBadge';
import VanModal from '@/components/VanModal';
import { Plus, Truck, Banknote, MapPin, Users, Edit2, Trash2, Eye } from 'lucide-react';
import { useSupabaseQuery, useDelete } from '@/lib/hooks';
import { useQueryClient } from '@tanstack/react-query';
import { formatCurrency } from '@/lib/currency';
import { toast } from 'sonner';

export default function RoutesPage() {
    const { data, isLoading: loading } = useSupabaseQuery<any>('vans');
    const vans = data ?? [];
    const queryClient = useQueryClient();

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedVan, setSelectedVan] = useState<any>(null);
    const [viewOnly, setViewOnly] = useState(false);

    const deleteMutation = useDelete('vans');

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this van?')) return;
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
    const activeVans = vans.filter(v => v.status !== 'Maintenance').length;
    const todaysRevenue = vans.reduce((sum, v) => sum + (parseFloat(v.today_sales) || 0), 0);
    const activeRoutes = new Set(vans.filter(v => v.status === 'On Route').map(v => v.route_area)).size;
    const totalCustomers = vans.reduce((sum, v) => sum + (parseInt(v.customer_count) || 0), 0);

    const columns = [
        {
            key: 'van_id',
            label: 'Van ID',
            render: (v: unknown) => <span style={{ fontWeight: 700, color: 'var(--primary-600)' }}>{v as string}</span>
        },
        {
            key: 'plate_number',
            label: 'Plate No.',
            render: (v: unknown) => <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>{v as string}</span>
        },
        { key: 'driver_name', label: 'Sales Person' },
        { key: 'route_area', label: 'Route Area' },
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
                        title="View Van"
                    >
                        <Eye size={14} />
                    </button>
                    <button
                        onClick={() => { setSelectedVan(row); setViewOnly(false); setIsModalOpen(true); }}
                        style={{ padding: 6, borderRadius: 6, border: '1px solid var(--slate-200)', background: 'var(--card-bg)', color: 'var(--primary-600)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        title="Edit Van"
                    >
                        <Edit2 size={14} />
                    </button>
                    <button
                        onClick={() => handleDelete(row.id)}
                        style={{ padding: 6, borderRadius: 6, border: '1px solid var(--slate-200)', background: 'var(--card-bg)', color: 'var(--danger)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        title="Delete Van"
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
                title="Routes & Vans"
                subtitle="Van inventory, route plans, and daily operations"
                breadcrumbs={[{ label: 'Routes & Vans' }]}
                actions={
                    <button
                        onClick={() => { setSelectedVan(null); setViewOnly(false); setIsModalOpen(true); }}
                        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 18px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg, var(--primary-600), var(--primary-500))', fontSize: 11, fontWeight: 600, color: 'white', cursor: 'pointer' }}
                    >
                        <Plus size={16} /> Add Van
                    </button>
                }
            />

            <div className="animate-stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
                <StatCard title="Active Vans" value={activeVans} icon={<Truck size={20} />} color="blue" />
                <StatCard title="Today's Revenue" value={formatCurrency(todaysRevenue)} icon={<Banknote size={20} />} color="green" />
                <StatCard title="Active Routes" value={activeRoutes} icon={<MapPin size={20} />} color="teal" />
                <StatCard title="Total Customers" value={totalCustomers} icon={<Users size={20} />} color="purple" />
            </div>

            <DataTable
                columns={columns}
                data={vans}
                loading={loading}
                searchPlaceholder="Search vans or routes..."
            />

            <VanModal
                isOpen={isModalOpen}
                onClose={() => { setIsModalOpen(false); setViewOnly(false); }}
                onSuccess={() => { toast.success(selectedVan ? 'Van updated successfully' : 'Van added successfully'); queryClient.invalidateQueries({ queryKey: ['vans'] }); }}
                record={selectedVan}
                readOnly={viewOnly}
            />
        </div>
    );
}
