'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { useSupabaseQuery } from '@/lib/hooks';
import { useQueryClient } from '@tanstack/react-query';
import PageHeader from '@/components/PageHeader';
import DataTable from '@/components/DataTable';
import StatusBadge from '@/components/StatusBadge';
import QAInProcessModal from '@/components/QAInProcessModal';
import { Plus, FileCheck, Download, ShieldCheck, CheckCircle, XCircle, Clock } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

export default function QAInProcessPage() {
    const { data, isLoading } = useSupabaseQuery<any>('qa_in_process', {
        columns: `*, production_order:production_orders(order_number)`
    });
    const records = data ?? [];
    const queryClient = useQueryClient();

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedRecord, setSelectedRecord] = useState<any | null>(null);

    // Pending material requests awaiting QA
    const [pendingMaterialRequests, setPendingMaterialRequests] = useState<any[]>([]);
    const [mrLoading, setMrLoading] = useState(false);
    const [approveNotes, setApproveNotes] = useState<{ [id: string]: string }>({});

    const fetchPendingMRs = useCallback(async () => {
        setMrLoading(true);
        try {
            const { data, error } = await supabase
                .from('material_requests')
                .select(`
                    *,
                    production_order:production_orders(
                        order_number,
                        product:products(name)
                    )
                `)
                .eq('qa_status', 'Pending QA')
                .order('created_at', { ascending: true });
            if (error) throw error;
            setPendingMaterialRequests(data || []);
        } catch (err: any) {
            toast.error('Failed to load pending QA requests: ' + err.message);
        } finally {
            setMrLoading(false);
        }
    }, []);

    useEffect(() => { fetchPendingMRs(); }, [fetchPendingMRs]);

    const handleApprove = async (row: any) => {
        try {
            const { error } = await supabase
                .from('material_requests')
                .update({
                    qa_status: 'QA Approved',
                    qa_approved_at: new Date().toISOString(),
                    qa_notes: approveNotes[row.id] || null,
                })
                .eq('id', row.id);
            if (error) throw error;
            toast.success(`Materials approved for ${row.request_number}`);
            fetchPendingMRs();
        } catch (err: any) {
            toast.error('Approval failed: ' + err.message);
        }
    };

    const handleReject = async (row: any) => {
        const reason = approveNotes[row.id] || '';
        if (!reason) {
            toast.error('Please enter a rejection reason in the notes field first');
            return;
        }
        try {
            const { error } = await supabase
                .from('material_requests')
                .update({
                    qa_status: 'QA Rejected',
                    qa_approved_at: new Date().toISOString(),
                    qa_notes: reason,
                })
                .eq('id', row.id);
            if (error) throw error;
            toast.success(`Materials rejected for ${row.request_number}`);
            fetchPendingMRs();
        } catch (err: any) {
            toast.error('Rejection failed: ' + err.message);
        }
    };

    const handleSave = async () => {
        queryClient.invalidateQueries({ queryKey: ['qa_in_process'] });
        setIsModalOpen(false);
        setSelectedRecord(null);
    };

    const statusVariant = (s: string): 'success' | 'warning' | 'danger' | 'default' => {
        switch (s) {
            case 'Passed': return 'success';
            case 'Failed': return 'danger';
            case 'Needs Review': return 'warning';
            default: return 'default';
        }
    };

    const handleExport = () => {
        if (records.length === 0) return;
        const headers = ['Batch No.', 'Product', 'Stage', 'Status', 'Inspector', 'Date'];
        const csvContent = [
            headers.join(','),
            ...records.map((r: any) => [
                `"${r.batch_number}"`,
                `"${r.product_name}"`,
                `"${r.stage}"`,
                `"${r.status}"`,
                `"${r.inspector || ''}"`,
                `"${r.inspection_date ? new Date(r.inspection_date).toLocaleDateString() : ''}"`
            ].join(','))
        ].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `qa_in_process_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const columns = [
        {
            key: 'production_order',
            label: 'Job Order',
            render: (value: any) => value?.order_number 
                ? <span style={{ display:'inline-flex', alignItems:'center', gap:4, fontSize:11, color:'var(--primary-600)', fontWeight:600 }}>{value.order_number}</span>
                : <span style={{ fontSize:10, color:'var(--slate-400)' }}>-</span>
        },
        {
            key: 'batch_number',
            label: 'Batch No.',
            render: (value: any) => (
                <span style={{ fontWeight: 600, color: 'var(--primary-600)', fontFamily: 'var(--font-mono)' }}>{value}</span>
            )
        },
        { key: 'product_name', label: 'Product' },
        { key: 'stage', label: 'Stage' },
        {
            key: 'status',
            label: 'Status',
            render: (value: any) => (
                <StatusBadge status={value} variant={statusVariant(value)} />
            )
        },
        { key: 'inspector', label: 'Inspector' },
        {
            key: 'inspection_date',
            label: 'Date',
            render: (value: any) => value ? new Date(value).toLocaleDateString() : '-'
        }
    ];

    return (
        <div className="animate-fade-in">
            <PageHeader
                title="In Process Controls"
                subtitle="QA checks during production — including material inspections"
                breadcrumbs={[
                    { label: 'Quality Assurance', href: '/qa' },
                    { label: 'In Process Controls' },
                ]}
                actions={
                    <>
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
                            <Plus size={16} /> Add IPC Record
                        </button>
                    </>
                }
            />

            {/* ── Stage 1: Pending Material Approvals ─────────────────── */}
            {(pendingMaterialRequests.length > 0 || mrLoading) && (
                <div style={{
                    background: 'var(--amber-50, #fffbeb)',
                    border: '1.5px solid var(--amber-200, #fde68a)',
                    borderRadius: 12,
                    padding: '16px 20px',
                    marginBottom: 24,
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                        <ShieldCheck size={18} color="var(--amber-600, #d97706)" />
                        <span style={{ fontWeight: 700, fontSize: 12, color: 'var(--amber-800, #92400e)' }}>
                            Pending Material Inspections ({pendingMaterialRequests.length})
                        </span>
                        <span style={{ fontSize: 11, color: 'var(--amber-600, #d97706)', marginLeft: 4 }}>
                            — These material batches have been issued by Stores and need QA inspection before use
                        </span>
                    </div>

                    {mrLoading ? (
                        <div style={{ color: 'var(--slate-500)', fontSize: 11, padding: '8px 0' }}>Loading...</div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            {pendingMaterialRequests.map(req => (
                                <div key={req.id} style={{
                                    background: 'white',
                                    border: '1px solid var(--amber-200, #fde68a)',
                                    borderRadius: 10,
                                    padding: '14px 16px',
                                    display: 'grid',
                                    gridTemplateColumns: '1fr 1fr auto',
                                    gap: 16,
                                    alignItems: 'center',
                                }}>
                                    {/* Request info */}
                                    <div>
                                        <div style={{ fontWeight: 700, fontSize: 12, color: 'var(--primary-600)', fontFamily: 'var(--font-mono)' }}>
                                            {req.request_number}
                                        </div>
                                        <div style={{ fontSize: 11, color: 'var(--slate-600)', marginTop: 2 }}>
                                            Job Order: <strong>{req.production_order?.order_number || '—'}</strong>
                                        </div>
                                        <div style={{ fontSize: 11, color: 'var(--slate-500)' }}>
                                            {req.production_order?.product?.name || '—'}
                                        </div>
                                        <div style={{ fontSize: 10, color: 'var(--slate-400)', marginTop: 2 }}>
                                            <Clock size={10} style={{ display: 'inline', marginRight: 4 }} />
                                            Requested: {new Date(req.created_at).toLocaleDateString('en-GB')}
                                        </div>
                                    </div>

                                    {/* QA Notes */}
                                    <div>
                                        <label style={{ fontSize: 10, fontWeight: 600, color: 'var(--slate-500)', display: 'block', marginBottom: 4 }}>
                                            QA Notes / Rejection Reason
                                        </label>
                                        <input
                                            type="text"
                                            placeholder="Inspection notes or rejection reason..."
                                            value={approveNotes[req.id] || ''}
                                            onChange={(e) => setApproveNotes(prev => ({ ...prev, [req.id]: e.target.value }))}
                                            style={{
                                                width: '100%',
                                                padding: '7px 10px',
                                                border: '1px solid var(--slate-200)',
                                                borderRadius: 7,
                                                fontSize: 11,
                                                outline: 'none',
                                                boxSizing: 'border-box',
                                            }}
                                        />
                                    </div>

                                    {/* Approve / Reject */}
                                    <div style={{ display: 'flex', gap: 8 }}>
                                        <button
                                            onClick={() => handleApprove(req)}
                                            style={{
                                                display: 'flex', alignItems: 'center', gap: 5,
                                                padding: '8px 14px', borderRadius: 8, border: 'none',
                                                background: 'var(--green-600, #16a34a)', color: 'white',
                                                fontSize: 11, fontWeight: 600, cursor: 'pointer',
                                            }}
                                        >
                                            <CheckCircle size={13} /> Approve
                                        </button>
                                        <button
                                            onClick={() => handleReject(req)}
                                            style={{
                                                display: 'flex', alignItems: 'center', gap: 5,
                                                padding: '8px 14px', borderRadius: 8,
                                                border: '1px solid var(--danger, #ef4444)',
                                                background: 'white', color: 'var(--danger, #ef4444)',
                                                fontSize: 11, fontWeight: 600, cursor: 'pointer',
                                            }}
                                        >
                                            <XCircle size={13} /> Reject
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* ── Standard IPC Records Table ───────────────────────────── */}
            <DataTable
                columns={columns}
                data={records}
                loading={isLoading}
                searchPlaceholder="Search by batch, product or stage..."
                onRowClick={(record) => {
                    setSelectedRecord(record);
                    setIsModalOpen(true);
                }}
                emptyMessage="No In Process Control records found"
            />

            <QAInProcessModal
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
