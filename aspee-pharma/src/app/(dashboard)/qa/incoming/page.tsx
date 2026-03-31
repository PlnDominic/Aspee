'use client';

import React, { useState } from 'react';
import PageHeader from '@/components/PageHeader';
import DataTable from '@/components/DataTable';
import StatusBadge from '@/components/StatusBadge';
import { useSupabaseQuery } from '@/lib/hooks';
import { 
    Truck, 
    Search, 
    Filter, 
    FileText, 
    CheckCircle, 
    XCircle, 
    Clock, 
    ShieldCheck, 
    MoreVertical,
    Activity,
    Eye,
    Edit2
} from 'lucide-react';
import QARawMaterialModal from '@/components/QARawMaterialModal';

export default function QAIncomingMaterialsPage() {
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedGrn, setSelectedGrn] = useState<any>(null);
    const [modalMode, setModalMode] = useState<'view' | 'edit'>('edit');

    const { data: grns, isLoading, refetch } = useSupabaseQuery<any>(
        'grn',
        {
            columns: '*, purchase_orders:po_id(po_number, suppliers:supplier_id(name)), items:grn_items(*, product:products(name, sku, unit))',
            orderBy: 'created_at',
            ascending: false
        }
    );

    const handleInspect = (grn: any) => {
        setSelectedGrn(grn);
        setModalMode('edit');
        setIsModalOpen(true);
    };

    const handleViewGRN = (grn: any) => {
        setSelectedGrn(grn);
        setModalMode('view');
        setIsModalOpen(true);
    };

    const handleEditGRN = (grn: any) => {
        setSelectedGrn(grn);
        setModalMode('edit');
        setIsModalOpen(true);
    };

    const statusVariant = (status: string): 'success' | 'warning' | 'danger' | 'default' => {
        switch (status) {
            case 'Approved': return 'success';
            case 'Rejected': return 'danger';
            case 'Quarantine': return 'warning';
            case 'Pending': return 'warning';
            default: return 'default';
        }
    };

    const columns = [
        {
            key: 'grn_number',
            label: 'GRN Number',
            render: (val: string) => (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ padding: 6, background: 'var(--primary-50)', borderRadius: 6, color: 'var(--primary-600)' }}>
                        <Truck size={14} />
                    </div>
                    <span style={{ fontWeight: 600 }}>{val}</span>
                </div>
            )
        },
        {
            key: 'suppliers',
            label: 'Supplier',
            render: (_: any, row: any) => <span>{row.purchase_orders?.suppliers?.name || 'Unknown'}</span>
        },
        {
            key: 'received_date',
            label: 'Received Date',
            render: (val: string) => <span>{new Date(val).toLocaleDateString()}</span>
        },
        {
            key: 'items',
            label: 'Items',
            render: (items: any[]) => (
                <div style={{ fontSize: '10px', color: 'var(--slate-500)' }}>
                    {items?.length || 0} items received
                </div>
            )
        },
        {
            key: 'qa_status',
            label: 'QA Status',
            render: (status: string) => <StatusBadge status={status || 'Pending'} variant={statusVariant(status || 'Pending')} />
        },
        {
            key: 'qa_inspector',
            label: 'Inspector',
            render: (val: string) => <span style={{ fontSize: '11px' }}>{val || '-'}</span>
        },
        {
            key: 'qa_date',
            label: 'Date Inspected',
            render: (val: string) => <span style={{ fontSize: '11px' }}>{val ? new Date(val).toLocaleDateString() : '-'}</span>
        },
        {
            key: 'id',
            label: 'Actions',
            render: (_: string, row: any) => (
                <div style={{ display: 'flex', gap: 8 }}>
                    <button
                        onClick={() => handleViewGRN(row)}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: 32,
                            height: 32,
                            borderRadius: 6,
                            border: 'none',
                            background: 'var(--slate-100)',
                            color: 'var(--slate-600)',
                            cursor: 'pointer'
                        }}
                        title="View QA Inspection"
                    >
                        <Eye size={16} />
                    </button>
                    <button
                        onClick={() => handleEditGRN(row)}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: 32,
                            height: 32,
                            borderRadius: 6,
                            border: 'none',
                            background: 'var(--blue-50)',
                            color: 'var(--blue-600)',
                            cursor: 'pointer'
                        }}
                        title="Edit QA Inspection"
                    >
                        <Edit2 size={16} />
                    </button>
                    <button
                        onClick={() => handleInspect(row)}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: 32,
                            height: 32,
                            borderRadius: 6,
                            border: 'none',
                            background: 'var(--primary-50)',
                            color: 'var(--primary-600)',
                            cursor: 'pointer'
                        }}
                        title={row.qa_status === 'Pending' ? 'Inspect' : 'Update QA'}
                    >
                        <ShieldCheck size={16} />
                    </button>
                </div>
            )
        }
    ];

    const filteredData = (grns as any[])?.filter(item => 
        (item.grn_number?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
        (item.purchase_orders?.suppliers?.name?.toLowerCase() || '').includes(searchTerm.toLowerCase())
    ) || [];

    return (
        <div className="animate-fade-in">
            <PageHeader
                title="Incoming Material Inspection"
                subtitle="Verify and release raw materials from suppliers into inventory"
                breadcrumbs={[
                    { label: 'Quality Assurance', href: '/qa' },
                    { label: 'Incoming Materials' },
                ]}
                actions={
                    <div style={{ display: 'flex', gap: 12 }}>
                        <div style={{ position: 'relative' }}>
                            <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--slate-400)' }} />
                            <input
                                type="text"
                                placeholder="Search GRN or Supplier..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                style={{
                                    padding: '8px 12px 8px 36px',
                                    borderRadius: 10,
                                    border: '1px solid var(--slate-200)',
                                    fontSize: 12,
                                    width: 240,
                                    outline: 'none',
                                    background: 'var(--card-bg)'
                                }}
                            />
                        </div>
                    </div>
                }
            />

            <div style={{ marginBottom: 20, display: 'flex', gap: 12 }}>
                <div style={{ flex: 1, padding: 16, background: 'var(--card-bg)', borderRadius: 12, border: '1px solid var(--slate-200)', display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgb(255, 243, 224)', display: 'flex', alignItems: 'center', justifyItems: 'center', color: 'rgb(245, 124, 0)', justifyContent: 'center' }}>
                        <Clock size={20} />
                    </div>
                    <div>
                        <p style={{ fontSize: 11, color: 'var(--slate-500)', fontWeight: 500 }}>Pending Inspections</p>
                        <p style={{ fontSize: 18, fontWeight: 700, color: 'var(--slate-900)' }}>
                            {(grns as any[])?.filter(g => g.qa_status === 'Pending').length || 0}
                        </p>
                    </div>
                </div>
                <div style={{ flex: 1, padding: 16, background: 'var(--card-bg)', borderRadius: 12, border: '1px solid var(--slate-200)', display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--primary-50)', display: 'flex', alignItems: 'center', justifyItems: 'center', color: 'var(--primary-600)', justifyContent: 'center' }}>
                        <ShieldCheck size={20} />
                    </div>
                    <div>
                        <p style={{ fontSize: 11, color: 'var(--slate-500)', fontWeight: 500 }}>Approved This Month</p>
                        <p style={{ fontSize: 18, fontWeight: 700, color: 'var(--slate-900)' }}>
                            {(grns as any[])?.filter(g => g.qa_status === 'Approved').length || 0}
                        </p>
                    </div>
                </div>
            </div>

            <DataTable
                columns={columns}
                data={filteredData}
                loading={isLoading}
                pageSize={10}
            />

            {selectedGrn && (
                <QARawMaterialModal
                    isOpen={isModalOpen}
                    onClose={() => {
                        setIsModalOpen(false);
                        setSelectedGrn(null);
                    }}
                    onSave={() => {
                        refetch();
                        setIsModalOpen(false);
                        setSelectedGrn(null);
                    }}
                    grn={selectedGrn}
                    mode={modalMode}
                />
            )}
        </div>
    );
}
