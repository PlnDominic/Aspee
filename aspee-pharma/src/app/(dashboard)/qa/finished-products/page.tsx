'use client';

import React, { useState } from 'react';
import { useSupabaseQuery } from '@/lib/hooks';
import { useQueryClient } from '@tanstack/react-query';
import PageHeader from '@/components/PageHeader';
import DataTable from '@/components/DataTable';
import StatusBadge from '@/components/StatusBadge';
import QAFinishedProductsModal from '@/components/QAFinishedProductsModal';
import { Plus, ShieldCheck, Download, Factory } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

export default function QAFinishedProductsPage() {
    const { data, isLoading } = useSupabaseQuery<any>('qa_finished_products', {
        columns: `*, production_order:production_orders(order_number)`
    });
    const records = data ?? [];
    const queryClient = useQueryClient();

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedRecord, setSelectedRecord] = useState<any | null>(null);

    const handleSave = async () => {
        queryClient.invalidateQueries({ queryKey: ['qa_finished_products'] });
        setIsModalOpen(false);
        setSelectedRecord(null);
    };

    const statusVariant = (s: string): 'success' | 'warning' | 'danger' | 'default' => {
        switch (s) {
            case 'Passed': return 'success';
            case 'Failed': return 'danger';
            case 'Quarantine': return 'warning';
            default: return 'default';
        }
    };

    const handleExport = () => {
        if (records.length === 0) return;
        const headers = ['Product', 'Batch No.', 'Status', 'Analyst', 'Analysis Date', 'Release Date'];
        const csvContent = [
            headers.join(','),
            ...records.map((r: any) => [
                `"${r.product_name}"`,
                `"${r.batch_number}"`,
                `"${r.overall_status}"`,
                `"${r.analyst || ''}"`,
                `"${r.analysis_date ? new Date(r.analysis_date).toLocaleDateString() : ''}"`,
                `"${r.release_date ? new Date(r.release_date).toLocaleDateString() : ''}"`
            ].join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `qa_finished_products_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // Quick approve from page
    const handleQuickApprove = async (row: any, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!confirm(`Mark batch ${row.batch_number} as PASSED and release to stock?`)) return;
        try {
            const { error } = await supabase
                .from('qa_finished_products')
                .update({ overall_status: 'Passed', release_date: new Date().toISOString().split('T')[0] })
                .eq('id', row.id);
            if (error) throw error;
            toast.success(`${row.batch_number} approved and released`);
            queryClient.invalidateQueries({ queryKey: ['qa_finished_products'] });
        } catch (err: any) {
            toast.error('Approval failed: ' + err.message);
        }
    };

    const columns = [
        {
            key: 'product_name',
            label: 'Product',
            render: (value: any) => (
                <span style={{ fontWeight: 600, color: 'var(--slate-800)' }}>{value}</span>
            )
        },
        {
            key: 'batch_number',
            label: 'Batch No.',
            render: (value: any) => (
                <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--primary-600)', fontWeight: 600 }}>{value}</span>
            )
        },
        {
            key: 'overall_status',
            label: 'Status',
            render: (value: any) => (
                <StatusBadge status={value} variant={statusVariant(value)} />
            )
        },
        { key: 'analyst', label: 'Analyst' },
        {
            key: 'analysis_date',
            label: 'Analysis Date',
            render: (value: any) => value ? new Date(value).toLocaleDateString() : '-'
        },
        {
            key: 'release_date',
            label: 'Release Date',
            render: (value: any) => value
                ? <span style={{ color: 'var(--green-600, #16a34a)', fontWeight: 600 }}>{new Date(value).toLocaleDateString()}</span>
                : <span style={{ color: 'var(--slate-400)', fontStyle: 'italic' }}>Pending</span>
        },
        {
            key: 'production_order',
            label: 'Job Order',
            render: (value: any, row: any) => value?.order_number 
                ? <span style={{ display:'inline-flex', alignItems:'center', gap:4, fontSize:11, color:'var(--primary-600)', fontWeight:600 }}><Factory size={13} /> {value.order_number}</span>
                : <span style={{ fontSize:10, color:'var(--slate-400)' }}>-</span>
        },
        {
            key: 'quick_approve',
            label: '',
            render: (_: any, row: any) => row.overall_status === 'Quarantine' ? (
                <button
                    onClick={(e) => handleQuickApprove(row, e)}
                    style={{
                        display: 'flex', alignItems: 'center', gap: 4,
                        padding: '5px 10px', borderRadius: 6,
                        border: 'none', background: 'var(--green-600, #16a34a)',
                        color: 'white', fontSize: 10, fontWeight: 600, cursor: 'pointer'
                    }}
                >
                    <ShieldCheck size={12} /> Approve & Release
                </button>
            ) : null
        }
    ];

    const quarantineCount = records.filter((r: any) => r.overall_status === 'Quarantine').length;

    return (
        <div className="animate-fade-in">
            <PageHeader
                title="Finished Products Analysis"
                subtitle="Final QA checks before product release to stock"
                breadcrumbs={[
                    { label: 'Quality Assurance', href: '/qa' },
                    { label: 'Finished Products' },
                ]}
                actions={
                    <>
                        {quarantineCount > 0 && (
                            <div style={{
                                display: 'flex', alignItems: 'center', gap: 6,
                                padding: '7px 14px', borderRadius: 8,
                                background: 'var(--amber-100, #fef3c7)',
                                border: '1px solid var(--amber-300, #fcd34d)',
                                fontSize: 11, fontWeight: 600, color: 'var(--amber-800, #92400e)'
                            }}>
                                <ShieldCheck size={14} />
                                {quarantineCount} awaiting QA approval
                            </div>
                        )}
                        <button
                            onClick={handleExport}
                            disabled={records.length === 0}
                            style={{
                                display: 'flex', alignItems: 'center', gap: 8,
                                padding: '9px 16px', borderRadius: 8,
                                border: '1px solid var(--slate-200)', background: 'var(--card-bg)',
                                fontSize: 11, fontWeight: 500, color: 'var(--slate-700)',
                                cursor: 'pointer', opacity: records.length === 0 ? 0.5 : 1
                            }}
                        >
                            <Download size={16} /> Export
                        </button>
                        <button
                            onClick={() => { setSelectedRecord(null); setIsModalOpen(true); }}
                            style={{
                                display: 'flex', alignItems: 'center', gap: 8,
                                padding: '9px 18px', borderRadius: 8,
                                border: 'none', background: 'linear-gradient(135deg, var(--primary-600), var(--primary-500))',
                                fontSize: 11, fontWeight: 600, color: 'white',
                                cursor: 'pointer',
                            }}
                        >
                            <Plus size={16} /> Add Analysis Record
                        </button>
                    </>
                }
            />

            <DataTable
                columns={columns}
                data={records}
                loading={isLoading}
                searchPlaceholder="Search by product or batch..."
                onRowClick={(record) => {
                    setSelectedRecord(record);
                    setIsModalOpen(true);
                }}
                emptyMessage="No Finished Products Analysis records found"
            />

            <QAFinishedProductsModal
                isOpen={isModalOpen}
                onClose={() => {
                    setIsModalOpen(false);
                    setSelectedRecord(null);
                }}
                onSave={handleSave}
                record={selectedRecord}
            />
        </div>
    );
}
