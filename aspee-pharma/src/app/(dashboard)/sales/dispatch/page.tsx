'use client';

import React, { useState } from 'react';
import PageHeader from '@/components/PageHeader';
import DataTable from '@/components/DataTable';
import StatCard from '@/components/StatCard';
import StatusBadge from '@/components/StatusBadge';
import DispatchModal from '@/components/DispatchModal';
import { Plus, Truck, Eye, Pencil, Trash2, CheckCircle, Clock, Banknote, PackageCheck } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { useFetch } from '@/lib/hooks';
import { useQueryClient } from '@tanstack/react-query';
import { formatCurrency } from '@/lib/currency';

const statusVariantMap: Record<string, 'default' | 'info' | 'warning' | 'success' | 'danger'> = {
    'Draft':      'default',
    'Pending':    'warning',
    'In Transit': 'info',
    'Completed':  'success',
    'Cancelled':  'danger',
};

export default function DispatchPage() {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedDispatch, setSelectedDispatch] = useState<any>(null);
    const [modalMode, setModalMode] = useState<'create' | 'view' | 'edit'>('create');
    const queryClient = useQueryClient();

    const { data: dispatches = [], isLoading } = useFetch<any[]>(
        ['dispatches'],
        async () => {
            const result = await supabase
                .from('dispatches')
                .select(`
                    *,
                    van:vans(van_id, driver_name, plate_number, route_area),
                    dispatch_items(id, status, invoice:sales_invoices(total_amount))
                `)
                .order('created_at', { ascending: false });
            return { data: result.data || [], error: result.error };
        }
    );

    const handleCreate = () => {
        setSelectedDispatch(null);
        setModalMode('create');
        setIsModalOpen(true);
    };

    const handleView = (row: any) => {
        setSelectedDispatch(row);
        setModalMode('view');
        setIsModalOpen(true);
    };

    const handleEdit = (row: any) => {
        setSelectedDispatch(row);
        setModalMode('edit');
        setIsModalOpen(true);
    };

    const handleDelete = async (row: any) => {
        if (!confirm(`Delete dispatch ${row.dispatch_number}? This cannot be undone.`)) return;
        try {
            await supabase.from('dispatch_items').delete().eq('dispatch_id', row.id);
            const { error } = await supabase.from('dispatches').delete().eq('id', row.id);
            if (error) throw error;
            toast.success('Dispatch deleted');
            queryClient.invalidateQueries({ queryKey: ['dispatches'] });
        } catch (err: any) {
            toast.error('Failed to delete: ' + err.message);
        }
    };

    const stats = {
        total:      dispatches.length,
        inTransit:  dispatches.filter((d: any) => d.status === 'In Transit').length,
        completed:  dispatches.filter((d: any) => d.status === 'Completed').length,
        totalValue: dispatches.reduce((sum: number, d: any) =>
            sum + (d.dispatch_items || []).reduce((s: number, it: any) => s + Number(it.invoice?.total_amount || 0), 0)
        , 0),
    };

    const columns = [
        {
            key: 'dispatch_number',
            label: 'Dispatch #',
            render: (v: string) => (
                <span style={{ fontWeight: 700, color: 'var(--primary-600)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>{v}</span>
            )
        },
        {
            key: 'van',
            label: 'Van / Driver',
            render: (v: any) => v ? (
                <div>
                    <div style={{ fontWeight: 600, fontSize: 12, color: 'var(--slate-800)' }}>{v.driver_name}</div>
                    <div style={{ fontSize: 10, color: 'var(--slate-400)', fontFamily: 'var(--font-mono)', marginTop: 1 }}>
                        {v.van_id} · {v.plate_number}
                    </div>
                </div>
            ) : <span style={{ color: 'var(--slate-400)' }}>—</span>
        },
        {
            key: 'van',
            label: 'Route Area',
            render: (v: any) => v?.route_area
                ? <span style={{ fontSize: 11, color: 'var(--slate-600)' }}>{v.route_area}</span>
                : <span style={{ color: 'var(--slate-400)' }}>—</span>
        },
        {
            key: 'dispatch_date',
            label: 'Date',
            render: (v: string) => v
                ? new Date(v).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
                : '—'
        },
        {
            key: 'dispatch_items',
            label: 'Invoices',
            render: (v: any[]) => {
                const count     = v?.length || 0;
                const delivered = v?.filter((i: any) => i.status === 'Delivered').length || 0;
                return count === 0
                    ? <span style={{ color: 'var(--slate-400)' }}>—</span>
                    : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontWeight: 700 }}>{count}</span>
                            <span style={{ fontSize: 10, color: 'var(--slate-400)' }}>
                                ({delivered} delivered)
                            </span>
                        </div>
                    );
            }
        },
        {
            key: 'dispatch_items_value',
            label: 'Total Value',
            render: (_: any, row: any) => {
                const total = (row.dispatch_items || []).reduce(
                    (s: number, it: any) => s + Number(it.invoice?.total_amount || 0), 0
                );
                return <span style={{ fontWeight: 700, color: 'var(--slate-800)' }}>{formatCurrency(total)}</span>;
            }
        },
        {
            key: 'status',
            label: 'Status',
            render: (v: string) => <StatusBadge status={v} variant={statusVariantMap[v] || 'default'} />
        },
        {
            key: 'actions',
            label: '',
            render: (_: any, row: any) => (
                <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                    <button
                        onClick={() => handleView(row)}
                        title="View"
                        style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 10px', borderRadius: 6, border: '1px solid var(--slate-200)', background: 'var(--card-bg)', color: 'var(--slate-700)', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
                    >
                        <Eye size={13} /> View
                    </button>
                    {row.status !== 'Completed' && row.status !== 'Cancelled' && (
                        <button
                            onClick={() => handleEdit(row)}
                            title="Edit"
                            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 10px', borderRadius: 6, border: '1px solid var(--slate-200)', background: 'var(--card-bg)', color: 'var(--slate-700)', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
                        >
                            <Pencil size={13} /> Edit
                        </button>
                    )}
                    {(row.status === 'Draft' || row.status === 'Cancelled') && (
                        <button
                            onClick={() => handleDelete(row)}
                            title="Delete"
                            style={{ display: 'flex', alignItems: 'center', padding: '6px 8px', borderRadius: 6, border: '1px solid var(--danger)', background: 'none', color: 'var(--danger)', cursor: 'pointer' }}
                        >
                            <Trash2 size={13} />
                        </button>
                    )}
                </div>
            )
        },
    ];

    return (
        <div className="animate-fade-in">
            <PageHeader
                title="Dispatch Management"
                subtitle="Assign invoices to vans and track deliveries to customers"
                breadcrumbs={[{ label: 'Sales', href: '/sales/invoices' }, { label: 'Dispatch' }]}
                actions={
                    <button
                        onClick={handleCreate}
                        style={{
                            display: 'flex', alignItems: 'center', gap: 8,
                            padding: '9px 18px', borderRadius: 8, border: 'none',
                            background: 'linear-gradient(135deg, var(--primary-600), var(--primary-500))',
                            fontSize: 11, fontWeight: 600, color: 'white', cursor: 'pointer',
                        }}
                    >
                        <Plus size={16} /> New Dispatch
                    </button>
                }
            />

            <div className="animate-stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
                <StatCard title="Total Dispatches"   value={stats.total}                   icon={<Truck size={20} />}        color="blue"   />
                <StatCard title="In Transit"          value={stats.inTransit}               icon={<Clock size={20} />}        color="amber"  />
                <StatCard title="Completed"           value={stats.completed}               icon={<CheckCircle size={20} />}  color="green"  />
                <StatCard title="Total Invoice Value" value={formatCurrency(stats.totalValue)} icon={<Banknote size={20} />} color="purple" />
            </div>

            <DataTable
                columns={columns}
                data={dispatches}
                loading={isLoading}
                searchPlaceholder="Search by dispatch number, driver, or route..."
                emptyMessage="No dispatch records found. Click 'New Dispatch' to get started."
            />

            <DispatchModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                initialData={selectedDispatch}
                mode={modalMode}
                onSuccess={() => {
                    queryClient.invalidateQueries({ queryKey: ['dispatches'] });
                    setIsModalOpen(false);
                }}
            />
        </div>
    );
}
