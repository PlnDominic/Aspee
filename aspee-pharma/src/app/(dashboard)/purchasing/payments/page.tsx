'use client';

import React, { useState } from 'react';
import PageHeader from '@/components/PageHeader';
import DataTable from '@/components/DataTable';
import StatusBadge from '@/components/StatusBadge';
import SupplierPaymentModal from '@/components/SupplierPaymentModal';
import EntityLink from '@/components/EntityLink';
import { Plus, Eye, CreditCard, Edit2, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/formatCurrency';
import { useFetch, useAction } from '@/lib/hooks';
import { logAudit } from '@/lib/auditLog';
import { autoPostJournal } from '@/lib/autoPostJournal';

export default function SupplierPaymentsPage() {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedPayment, setSelectedPayment] = useState<any>(null);
    const [modalMode, setModalMode] = useState<'create' | 'edit' | 'view'>('create');

    const { data: paymentsList, isLoading: loading } = useFetch<any[]>(
        ['supplier_payments', '*, purchase_orders:po_id(po_number, total_amount, supplier_id, currency), suppliers:supplier_id(name)'],
        async () => {
            const result = await supabase
                .from('supplier_payments')
                .select(`
                    *,
                    purchase_orders:po_id(po_number, total_amount, supplier_id, currency),
                    suppliers:supplier_id(name)
                `)
                .order('created_at', { ascending: false });
            return { data: result.data, error: result.error };
        },
    );

    const payments = paymentsList ?? [];

    const saveMutation = useAction<any>({
        mutationFn: async (paymentData: any) => {
            const { id, ...paymentBase } = paymentData;

            const isNewPayment = !id;

            if (id) {
                const { error } = await supabase
                    .from('supplier_payments')
                    .update(paymentBase)
                    .eq('id', id);
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('supplier_payments')
                    .insert([paymentBase]);
                if (error) throw error;
            }

            // Auto-post GL entry for new payments: DR Accounts Payable / CR Cash at Bank
            if (isNewPayment) {
                // Fetch supplier name for the description
                const { data: supplierData } = await supabase
                    .from('suppliers')
                    .select('name')
                    .eq('id', paymentData.supplier_id)
                    .single();

                const { data: poData2 } = await supabase
                    .from('purchase_orders')
                    .select('po_number')
                    .eq('id', paymentData.po_id)
                    .single();

                await autoPostJournal({
                    event: 'SUPPLIER_PAYMENT',
                    amount: Number(paymentData.amount),
                    date: paymentData.payment_date || new Date().toISOString().split('T')[0],
                    description: `Payment to ${supplierData?.name || 'Supplier'} — PO ${poData2?.po_number || paymentData.po_id}`,
                    refNumber: paymentData.payment_number,
                    paymentMethod: paymentData.payment_method,
                });
            }

            // Update PO payment_status
            if (paymentData.po_id) {
                // Get PO total
                const { data: poData } = await supabase
                    .from('purchase_orders')
                    .select('total_amount')
                    .eq('id', paymentData.po_id)
                    .single();

                // Get all completed payments for this PO
                const { data: allPayments } = await supabase
                    .from('supplier_payments')
                    .select('amount')
                    .eq('po_id', paymentData.po_id)
                    .in('status', ['Approved', 'Completed']);

                const totalPaid = allPayments?.reduce((sum: number, p: any) => sum + Number(p.amount), 0) || 0;
                const poTotal = Number(poData?.total_amount) || 0;

                let paymentStatus = 'Unpaid';
                if (totalPaid >= poTotal) {
                    paymentStatus = 'Paid';
                } else if (totalPaid > 0) {
                    paymentStatus = 'Partial';
                }

                await supabase
                    .from('purchase_orders')
                    .update({ payment_status: paymentStatus })
                    .eq('id', paymentData.po_id);
            }
        },
        invalidateKeys: ['supplier_payments', 'purchase_orders'],
        successMessage: 'Payment saved successfully!',
    });

    const deleteMutation = useAction<string>({
        mutationFn: async (id: string) => {
            const paymentToDelete = payments.find((p: any) => p.id === id);
            
            // Delete the payment
            const { error } = await supabase
                .from('supplier_payments')
                .delete()
                .eq('id', id);

            if (error) throw error;

            // Recalculate PO payment_status if it was linked to a PO
            if (paymentToDelete?.po_id) {
                const { data: poData } = await supabase
                    .from('purchase_orders')
                    .select('total_amount')
                    .eq('id', paymentToDelete.po_id)
                    .single();

                const { data: allPayments } = await supabase
                    .from('supplier_payments')
                    .select('amount')
                    .eq('po_id', paymentToDelete.po_id)
                    .in('status', ['Approved', 'Completed']);

                const totalPaid = allPayments?.reduce((sum: number, p: any) => sum + Number(p.amount), 0) || 0;
                const poTotal = Number(poData?.total_amount) || 0;

                let paymentStatus = 'Unpaid';
                if (totalPaid >= poTotal) {
                    paymentStatus = 'Paid';
                } else if (totalPaid > 0) {
                    paymentStatus = 'Partial';
                }

                await supabase
                    .from('purchase_orders')
                    .update({ payment_status: paymentStatus })
                    .eq('id', paymentToDelete.po_id);
            }

            await logAudit({
                action: 'DELETE',
                module: 'Supplier Payments',
                description: `Deleted Payment: ${paymentToDelete?.payment_number || id}`,
                record_id: id,
                record_type: 'supplier_payments',
                old_values: paymentToDelete,
            });
        },
        invalidateKeys: ['supplier_payments', 'purchase_orders'],
        successMessage: 'Payment deleted successfully',
    });

    const handleCreatePayment = () => {
        setSelectedPayment(null);
        setModalMode('create');
        setIsModalOpen(true);
    };

    const handleViewPayment = (payment: any) => {
        setSelectedPayment(payment);
        setModalMode('view');
        setIsModalOpen(true);
    };

    const handleEditPayment = (payment: any) => {
        setSelectedPayment(payment);
        setModalMode('edit');
        setIsModalOpen(true);
    };

    const handleDeletePayment = async (id: string) => {
        if (!confirm('Are you sure you want to delete this payment? This action cannot be undone.')) return;
        await deleteMutation.mutateAsync(id);
    };

    const handleSavePayment = async (paymentData: any) => {
        await saveMutation.mutateAsync(paymentData);
    };

    const columns = [
        {
            key: 'payment_number',
            label: 'Payment No.',
            render: (v: unknown) => (
                <span style={{ fontWeight: 600, color: 'var(--primary-600)', fontFamily: 'var(--font-mono)' }}>
                    {v as string}
                </span>
            )
        },
        {
            key: 'po_number',
            label: 'PO Reference',
            render: (_: unknown, row: any) => row.purchase_orders?.po_number ? <EntityLink href={`/purchasing/purchase-orders?search=${encodeURIComponent(row.purchase_orders.po_number)}`} mono subtle>{row.purchase_orders.po_number}</EntityLink> : <span style={{ color: 'var(--slate-400)' }}>-</span>
        },
        {
            key: 'supplier',
            label: 'Supplier',
            render: (_: unknown, row: any) => row.suppliers?.name ? <EntityLink href={`/purchasing/suppliers?search=${encodeURIComponent(row.suppliers.name)}`}>{row.suppliers.name}</EntityLink> : <span style={{ color: 'var(--slate-400)' }}>-</span>
        },
        {
            key: 'payment_date',
            label: 'Date',
            render: (v: unknown) => v ? new Date(v as string).toLocaleDateString('en-GB') : '-'
        },
        {
            key: 'payment_method',
            label: 'Method',
            render: (v: unknown) => {
                const method = v as string;
                const colors: Record<string, { bg: string; color: string }> = {
                    'Bank Transfer': { bg: '#eff6ff', color: '#1d4ed8' },
                    'Cheque': { bg: '#fefce8', color: '#a16207' },
                    'Cash': { bg: '#f0fdf4', color: '#15803d' },
                };
                const style = colors[method] || { bg: 'var(--slate-100)', color: 'var(--slate-600)' };
                return (
                    <span style={{
                        padding: '2px 8px',
                        borderRadius: 4,
                        fontSize: 11,
                        fontWeight: 600,
                        background: style.bg,
                        color: style.color,
                    }}>
                        {method}
                    </span>
                );
            }
        },
        {
            key: 'amount',
            label: 'Amount',
            render: (v: unknown, row: any) => (
                <span style={{ fontWeight: 700, color: 'var(--slate-900)' }}>
                    {formatCurrency(Number(v), row.purchase_orders?.currency)}
                </span>
            )
        },
        {
            key: 'status',
            label: 'Status',
            render: (v: unknown) => (
                <StatusBadge
                    status={v as string}
                    variant={v === 'Completed' ? 'success' : v === 'Cancelled' ? 'danger' : 'warning'}
                />
            )
        },
        {
            key: 'actions',
            label: '',
            render: (_: unknown, row: any) => (
                <div style={{ display: 'flex', gap: 6 }}>
                    <button
                        onClick={() => handleViewPayment(row)}
                        style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            width: 32, height: 32, borderRadius: 6, border: 'none',
                            background: 'var(--slate-100)', color: 'var(--slate-600)', cursor: 'pointer'
                        }}
                        title="View Payment"
                    >
                        <Eye size={16} />
                    </button>
                    <button
                        onClick={() => handleEditPayment(row)}
                        title="Edit Payment"
                        style={{
                            border: 'none', background: 'var(--primary-50)', color: 'var(--primary-600)',
                            width: '32px', height: '32px', borderRadius: '6px',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer'
                        }}
                    >
                        <Edit2 size={16} />
                    </button>
                    <button
                        onClick={() => handleDeletePayment(row.id as string)}
                        title="Delete Payment"
                        style={{
                            border: 'none', background: 'var(--danger-50)', color: 'var(--danger)',
                            width: '32px', height: '32px', borderRadius: '6px',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer'
                        }}
                    >
                        <Trash2 size={16} />
                    </button>
                </div>
            )
        }
    ];

    return (
        <div className="animate-fade-in">
            <PageHeader
                title="Supplier Payments"
                subtitle="Track and manage payments to suppliers"
                breadcrumbs={[
                    { label: 'Purchasing', href: '/purchasing/payments' },
                    { label: 'Supplier Payments' },
                ]}
                actions={
                    <button
                        onClick={handleCreatePayment}
                        style={{
                            display: 'flex', alignItems: 'center', gap: 8,
                            padding: '9px 18px', borderRadius: 8, border: 'none',
                            background: 'linear-gradient(135deg, var(--primary-600), var(--primary-500))',
                            fontSize: 11, fontWeight: 600, color: 'white', cursor: 'pointer',
                        }}
                    >
                        <Plus size={16} /> Record Payment
                    </button>
                }
            />
            <DataTable columns={columns} data={payments} searchPlaceholder="Search payments..." loading={loading} />

            <SupplierPaymentModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSave={handleSavePayment}
                initialData={selectedPayment}
                mode={modalMode}
            />
        </div>
    );
}
