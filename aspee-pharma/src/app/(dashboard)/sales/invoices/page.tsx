'use client';

import React, { useState } from 'react';
import PageHeader from '@/components/PageHeader';
import DataTable from '@/components/DataTable';
import StatCard from '@/components/StatCard';
import StatusBadge from '@/components/StatusBadge';
import InvoiceModal from '@/components/InvoiceModal';
import EntityLink from '@/components/EntityLink';
import { Plus, Download, FileText, Banknote, Clock, CheckCircle, Pencil, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { exportToCsv } from '@/lib/csvExport';
import { formatCurrency } from '@/lib/formatCurrency';
import { useFetch, useAction } from '@/lib/hooks';
import { notifyLowStock } from '@/lib/notifications';
import { autoPostJournal } from '@/lib/autoPostJournal';
import SendToMDModal from '@/components/SendToMDModal';
import { Send } from 'lucide-react';

const statusVariant = (s: string) => {
    switch (s) {
        case 'Paid': return 'success';
        case 'Issued': case 'Partially Paid': return 'info';
        case 'Overdue': return 'danger';
        case 'Draft': return 'default';
        default: return 'default';
    }
};

export default function InvoicesPage() {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
    const [isReportModalOpen, setIsReportModalOpen] = useState(false);

    const { data: invoicesList, isLoading: loading } = useFetch<any[]>(
        ['sales_invoices', '*, items:sales_invoice_items(id, product_id, quantity, unit_price, total_price, product:products(name, sku))'],
        async () => {
            const result = await supabase
                .from('sales_invoices')
                .select(`
                    *,
                    items:sales_invoice_items(
                        id, product_id, quantity, unit_price, total_price,
                        product:products(name, sku)
                    )
                `)
                .order('created_at', { ascending: false });
            return { data: result.data, error: result.error };
        },
    );

    const invoices = invoicesList ?? [];

    const saveMutation = useAction<any>({
        mutationFn: async (invoiceData: any) => {
            const { items, id, ...header } = invoiceData;

            // Check stock levels before saving if transitioning to Issued/Paid
            const isNewIssuance = (
                (header.status === 'Issued' || header.status === 'Paid' || header.status === 'Partially Paid') &&
                (!id || selectedInvoice?.status === 'Draft')
            );

            if (isNewIssuance) {
                const mainStoreId = '1'; // Defaulting to main store for simplicity
                for (const item of items) {
                    const { data: stockData, error: stockFetchError } = await supabase
                        .from('stock_levels')
                        .select('qty_on_hand')
                        .eq('product_id', item.product_id)
                        .eq('location_id', mainStoreId)
                        .single();

                    if (stockFetchError && stockFetchError.code !== 'PGRST116') {
                        throw new Error(`Error checking stock for product ${item.product_id}`);
                    }

                    const currentQty = stockData?.qty_on_hand || 0;
                    if (currentQty < item.quantity) {
                        throw new Error(`Insufficient stock for one or more items. Only ${currentQty} available.`);
                    }
                }
            }

            let invoiceId = id;

            if (id) {
                // Update existing
                const { error } = await supabase.from('sales_invoices').update(header).eq('id', id);
                if (error) throw error;

                // Clear old items
                await supabase.from('sales_invoice_items').delete().eq('invoice_id', id);
            } else {
                // Create new
                const { data, error } = await supabase.from('sales_invoices').insert([header]).select().single();
                if (error) throw error;
                invoiceId = data.id;
            }

            // Insert new items
            if (items && items.length > 0) {
                const itemsToSave = items.map((item: any) => ({
                    invoice_id: invoiceId,
                    product_id: item.product_id,
                    quantity: item.quantity,
                    unit_price: item.unit_price,
                    total_price: item.total_price
                }));
                const { error: itemsError } = await supabase.from('sales_invoice_items').insert(itemsToSave);
                if (itemsError) throw itemsError;
            }

            // Auto-post GL entry: DR Accounts Receivable / CR Sales Revenue
            if (isNewIssuance) {
                await autoPostJournal({
                    event: 'INVOICE_ISSUED',
                    amount: header.total_amount,
                    date: header.date || new Date().toISOString().split('T')[0],
                    description: `Sales Invoice ${header.invoice_number} — ${header.customer_name}`,
                    refNumber: header.invoice_number,
                });
            }

            // Outbound Inventory Updates
            if (isNewIssuance) {
                const mainStoreId = '1';

                for (const item of items) {
                    // Fetch existing
                    const { data: stockData } = await supabase
                        .from('stock_levels')
                        .select('qty_on_hand')
                        .eq('product_id', item.product_id)
                        .eq('location_id', mainStoreId)
                        .single();

                    const currentQty = stockData?.qty_on_hand || 0;
                    const newQty = currentQty - item.quantity;

                    // Update
                    await supabase
                        .from('stock_levels')
                        .update({
                            qty_on_hand: newQty,
                            updated_at: new Date().toISOString()
                        })
                        .eq('product_id', item.product_id)
                        .eq('location_id', mainStoreId);

                    // Movement Log (OUT)
                    await supabase
                        .from('stock_movements')
                        .insert([{
                            product_id: item.product_id,
                            movement_type: 'OUT',
                            quantity: item.quantity,
                            reference_type: 'Sales Invoice',
                            reference_id: invoiceId,
                            notes: `Sale to ${header.customer_name} (Invoice: ${header.invoice_number})`
                        }]);

                    // Check if stock dropped to/below reorder level
                    const { data: productData } = await supabase
                        .from('products')
                        .select('name, reorder_level')
                        .eq('id', item.product_id)
                        .single();

                    if (productData && productData.reorder_level > 0) {
                        notifyLowStock(productData.name, newQty, productData.reorder_level);
                    }
                }
            }
        },
        invalidateKeys: ['sales_invoices', 'stock_levels', 'stock_movements'],
        successMessage: 'Invoice saved successfully!',
    });

    const deleteMutation = useAction<{ id: string; status: string }>({
        mutationFn: async ({ id, status }) => {
            if (status !== 'Draft') {
                throw new Error('Cannot delete an invoice that has already been issued.');
            }

            await supabase.from('sales_invoice_items').delete().eq('invoice_id', id);
            const { error } = await supabase.from('sales_invoices').delete().eq('id', id);
            if (error) throw error;
        },
        invalidateKeys: ['sales_invoices'],
        successMessage: 'Invoice deleted.',
    });

    const handleSaveInvoice = async (invoiceData: any) => {
        await saveMutation.mutateAsync(invoiceData);
        setIsModalOpen(false);
    };

    const handleDeleteInvoice = async (id: string, currentStatus: string) => {
        if (currentStatus !== 'Draft') {
            toast.error('Cannot delete an invoice that has already been issued.');
            return;
        }

        if (!confirm('Are you sure you want to delete this invoice?')) return;
        await deleteMutation.mutateAsync({ id, status: currentStatus });
    };

    const stats = {
        total: invoices.length,
        revenue: invoices.reduce((acc: number, curr: any) => curr.status !== 'Draft' ? acc + Number(curr.total_amount) : acc, 0),
        outstanding: invoices.reduce((acc: number, curr: any) => (curr.status === 'Issued' || curr.status === 'Overdue' || curr.status === 'Partially Paid') ? acc + Number(curr.total_amount) : acc, 0),
        paid: invoices.reduce((acc: number, curr: any) => curr.status === 'Paid' ? acc + Number(curr.total_amount) : acc, 0),
    };

    const handleExport = () => {
        try {
            exportToCsv(
                `sales_invoices_${new Date().toISOString().split('T')[0]}.csv`,
                invoices,
                [
                    { header: 'Invoice No.', accessor: (r) => r.invoice_number },
                    { header: 'Customer', accessor: (r) => r.customer_name },
                    { header: 'Date', accessor: (r) => r.date ? new Date(r.date).toLocaleDateString() : '' },
                    { header: 'Type', accessor: (r) => r.type },
                    { header: 'Total', accessor: (r) => r.total_amount },
                    { header: 'Status', accessor: (r) => r.status },
                ]
            );
            toast.success('Exported to CSV successfully');
        } catch (e: any) {
            toast.error(e?.message || 'No data to export');
        }
    };

    const columns = [
        { key: 'invoice_number', label: 'Invoice No.', render: (v: unknown) => <span style={{ fontWeight: 600, color: 'var(--primary-600)', fontFamily: 'var(--font-mono)' }}>{v as string}</span> },
        { key: 'customer_name', label: 'Customer', render: (v: unknown) => v ? <EntityLink href={`/customers?search=${encodeURIComponent(v as string)}`}>{v as string}</EntityLink> : '-' },
        { key: 'date', label: 'Date', render: (v: unknown) => new Date(v as string).toLocaleDateString() },
        {
            key: 'type', label: 'Type', render: (v: unknown) => (
                <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 500, background: v === 'Cash Sale' ? 'var(--success-light)' : v === 'Credit Sale' ? 'var(--info-light)' : 'var(--slate-100)', color: v === 'Cash Sale' ? '#047857' : v === 'Credit Sale' ? '#0e7490' : 'var(--slate-600)' }}>{v as string}</span>
            )
        },
        { key: 'total_amount', label: 'Total', render: (v: unknown, row: any) => <span style={{ fontWeight: 700 }}>{formatCurrency(v as number, row.currency)}</span> },
        { key: 'status', label: 'Status', render: (v: unknown) => <StatusBadge status={v as string} variant={statusVariant(v as string)} /> },
        {
            key: 'actions',
            label: 'Actions',
            render: (_: any, row: any) => (
                <div style={{ display: 'flex', gap: 8 }}>
                    <button
                        onClick={() => { setSelectedInvoice(row); setIsModalOpen(true); }}
                        style={{ padding: 6, borderRadius: 6, border: '1px solid var(--slate-200)', background: 'var(--card-bg)', color: 'var(--primary-600)', cursor: 'pointer' }}
                        title="Edit"
                    >
                        <Pencil size={14} />
                    </button>
                    {row.status === 'Draft' && (
                        <button
                            onClick={() => handleDeleteInvoice(row.id, row.status)}
                            style={{ padding: 6, borderRadius: 6, border: '1px solid var(--slate-200)', background: 'var(--card-bg)', color: 'var(--danger)', cursor: 'pointer' }}
                            title="Delete"
                        >
                            <Trash2 size={14} />
                        </button>
                    )}
                </div>
            )
        }
    ];

    return (
        <div className="animate-fade-in">
            <PageHeader
                title="Sales Invoices"
                subtitle="Create and manage sales invoices"
                breadcrumbs={[{ label: 'Sales', href: '/sales/invoices' }, { label: 'Invoices' }]}
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
                            onClick={handleExport}
                            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 16px', borderRadius: 8, border: '1px solid var(--slate-200)', background: 'var(--card-bg)', fontSize: 11, fontWeight: 500, color: 'var(--slate-700)', cursor: 'pointer' }}
                        >
                            <Download size={16} /> Export
                        </button>
                        <button
                            onClick={() => { setSelectedInvoice(null); setIsModalOpen(true); }}
                            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 18px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg, var(--primary-600), var(--primary-500))', fontSize: 11, fontWeight: 600, color: 'white', cursor: 'pointer' }}
                        >
                            <Plus size={16} /> New Invoice
                        </button>
                    </div>
                }
            />

            <div className="animate-stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
                <StatCard title="Total Invoices" value={stats.total} icon={<FileText size={20} />} color="blue" />
                <StatCard title="Revenue" value={`GH₵ ${stats.revenue.toFixed(2)}`} icon={<Banknote size={20} />} color="green" />
                <StatCard title="Outstanding" value={`GH₵ ${stats.outstanding.toFixed(2)}`} icon={<Clock size={20} />} color="amber" />
                <StatCard title="Paid" value={`GH₵ ${stats.paid.toFixed(2)}`} icon={<CheckCircle size={20} />} color="teal" />
            </div>

            <DataTable columns={columns} data={invoices} loading={loading} searchPlaceholder="Search invoices..." />

            <InvoiceModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSave={handleSaveInvoice}
                record={selectedInvoice}
            />

            <SendToMDModal 
                isOpen={isReportModalOpen} 
                onClose={() => setIsReportModalOpen(false)} 
                department="Sales" 
            />
        </div>
    );
}
