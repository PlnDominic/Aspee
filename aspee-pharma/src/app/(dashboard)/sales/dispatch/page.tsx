'use client';

import React, { useState } from 'react';
import PageHeader from '@/components/PageHeader';
import DataTable from '@/components/DataTable';
import StatusBadge from '@/components/StatusBadge';
import { Plus, Truck, Eye, CheckCircle, Clock } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { useFetch } from '@/lib/hooks';
import DispatchModal from '@/components/DispatchModal';

export default function DispatchPage() {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedDispatch, setSelectedDispatch] = useState<any>(null);
    const [modalMode, setModalMode] = useState<'create' | 'view' | 'edit'>('create');

    const { data: dispatches, isLoading, refetch } = useFetch<any[]>(
        ['dispatches'],
        async () => {
            const result = await supabase
                .from('dispatches')
                .select(`
                    *,
                    van:vans(name, license_plate),
                    dispatch_items(count)
                `)
                .order('created_at', { ascending: false });
            return { data: result.data, error: result.error };
        }
    );

    const handleCreateDispatch = () => {
        setSelectedDispatch(null);
        setModalMode('create');
        setIsModalOpen(true);
    };

    const handleViewDispatch = (dispatch: any) => {
        setSelectedDispatch(dispatch);
        setModalMode('view');
        setIsModalOpen(true);
    };

    const handleEditDispatch = (dispatch: any) => {
        setSelectedDispatch(dispatch);
        setModalMode('edit');
        setIsModalOpen(true);
    };

    const columns = [
        {
            key: 'dispatch_number',
            label: 'Dispatch #',
            render: (v: string) => <span style={{ fontWeight: 600, color: 'var(--primary-600)' }}>{v}</span>
        },
        {
            key: 'van',
            label: 'Van / Driver',
            render: (v: any) => v ? `${v.name} (${v.license_plate})` : '-'
        },
        {
            key: 'dispatch_date',
            label: 'Date',
            render: (v: string) => new Date(v).toLocaleDateString()
        },
        {
            key: 'items_count',
            label: 'Invoices',
            render: (_: any, row: any) => row.dispatch_items?.[0]?.count || 0
        },
        {
            key: 'status',
            label: 'Status',
            render: (v: string) => {
                const variantMap: any = {
                    'Draft': 'info',
                    'Pending': 'warning',
                    'In Transit': 'warning',
                    'Completed': 'success',
                    'Cancelled': 'danger'
                };
                return <StatusBadge status={v} variant={variantMap[v] || 'default'} />;
            }
        },
        {
            key: 'actions',
            label: '',
            render: (_: any, row: any) => (
                <div style={{ display: 'flex', gap: 8 }}>
                    <button 
                        onClick={() => handleViewDispatch(row)}
                        style={{ padding: 6, borderRadius: 6, border: '1px solid var(--slate-200)', background: 'var(--card-bg)', cursor: 'pointer' }}
                    >
                        <Eye size={14} />
                    </button>
                    {row.status !== 'Completed' && (
                        <button 
                            onClick={() => handleEditDispatch(row)}
                            style={{ padding: 6, borderRadius: 6, border: '1px solid var(--slate-200)', background: 'var(--card-bg)', cursor: 'pointer' }}
                        >
                            <Truck size={14} />
                        </button>
                    )}
                </div>
            )
        }
    ];

    return (
        <div className="animate-fade-in">
            <PageHeader 
                title="Dispatch Management"
                subtitle="Assign invoices to vans and track deliveries"
                breadcrumbs={[{ label: 'Sales', href: '/sales/invoices' }, { label: 'Dispatch' }]}
                actions={
                    <button 
                        onClick={handleCreateDispatch}
                        style={{ 
                            display: 'flex', alignItems: 'center', gap: 8, 
                            padding: '9px 18px', borderRadius: 8, border: 'none', 
                            background: 'linear-gradient(135deg, var(--primary-600), var(--primary-500))',
                            fontSize: 11, fontWeight: 600, color: 'white', cursor: 'pointer' 
                        }}
                    >
                        <Plus size={16} /> New Dispatch
                    </button>
                }
            />

            <DataTable 
                columns={columns}
                data={dispatches || []}
                loading={isLoading}
                searchPlaceholder="Search dispatch records..."
            />

            <DispatchModal 
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                initialData={selectedDispatch}
                mode={modalMode}
                onSuccess={() => {
                    refetch();
                    setIsModalOpen(false);
                }}
            />
        </div>
    );
}
