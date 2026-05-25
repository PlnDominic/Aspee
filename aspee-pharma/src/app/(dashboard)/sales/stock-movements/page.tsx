'use client';

import React from 'react';
import PageHeader from '@/components/PageHeader';
import DataTable from '@/components/DataTable';
import StatCard from '@/components/StatCard';
import EntityLink from '@/components/EntityLink';
import { PackageMinus, Hash, Users, Download } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useFetch } from '@/lib/hooks';
import { exportToCsv } from '@/lib/csvExport';
import { toast } from 'sonner';
import { isSalesDepartmentLocation, isVanStockLocation, isFinishedGoodsLocation, isSalespersonStockLocation } from '@/lib/vanStock';

type MovementRow = {
    id: string;
    date: string | null;
    type: 'Van Load' | 'Salesperson Dispatch' | 'Sales Invoice';
    reference: string;
    flow: string;
    customer: string;
    product_name: string;
    sku: string;
    unit: string;
    quantity: number;
    notes: string;
};

export default function SalesStockMovementsPage() {
    const handleExport = () => {
        try {
            exportToCsv(
                `sales_stock_movements_${new Date().toISOString().split('T')[0]}.csv`,
                data,
                [
                    { header: 'Date', accessor: (r) => r.date ? new Date(r.date).toLocaleDateString('en-GB') : '' },
                    { header: 'Type', accessor: (r) => r.type },
                    { header: 'Reference', accessor: (r) => r.reference },
                    { header: 'Flow', accessor: (r) => r.flow },
                    { header: 'Customer', accessor: (r) => r.customer },
                    { header: 'Product', accessor: (r) => r.product_name },
                    { header: 'SKU', accessor: (r) => r.sku },
                    { header: 'Unit', accessor: (r) => r.unit },
                    { header: 'Quantity', accessor: (r) => r.quantity },
                    { header: 'Notes', accessor: (r) => r.notes },
                ]
            );
        } catch {
            toast.error('No data to export');
        }
    };

    const { data: rows, isLoading } = useFetch<MovementRow[]>(
        ['sales-stock-movements'],
        async () => {
            const { data: fgProducts, error: fgError } = await supabase
                .from('products')
                .select('id, name, sku, unit')
                .eq('material_type', 'Finished Good');
            if (fgError) return { data: null, error: fgError };

            const fgMap: Record<string, any> = {};
            (fgProducts || []).forEach((p: any) => { fgMap[p.id] = p; });
            const fgIds = Object.keys(fgMap);

            const { data: transfers, error: transferError } = await supabase
                .from('stock_transfers')
                .select(`
                    id,
                    transfer_number,
                    created_at,
                    from:stock_locations!from_location_id(name, type),
                    to:stock_locations!to_location_id(name, type)
                `)
                .order('created_at', { ascending: false });
            if (transferError) return { data: null, error: transferError };

            const vanLoadTransfers = (transfers || []).filter((transfer: any) =>
                isSalesDepartmentLocation(transfer.from) && isVanStockLocation(transfer.to)
            );
            const salespersonDispatchTransfers = (transfers || []).filter((transfer: any) =>
                isFinishedGoodsLocation(transfer.from) && isSalespersonStockLocation(transfer.to)
            );

            const relevantIds = [
                ...vanLoadTransfers.map((t: any) => t.id),
                ...salespersonDispatchTransfers.map((t: any) => t.id),
            ];
            const transferItemsRes = relevantIds.length > 0
                ? await supabase
                    .from('stock_transfer_items')
                    .select('transfer_id, product_id, quantity')
                    .in('transfer_id', relevantIds)
                : { data: [], error: null };
            if (transferItemsRes.error) return { data: null, error: transferItemsRes.error as any };

            const allTransferItems = transferItemsRes.data || [];

            const loadRows: MovementRow[] = allTransferItems
                .filter((item: any) => fgIds.includes(item.product_id) && vanLoadTransfers.some((t: any) => t.id === item.transfer_id))
                .map((item: any) => {
                    const transfer = vanLoadTransfers.find((row: any) => row.id === item.transfer_id);
                    const fromLocation = Array.isArray(transfer?.from) ? transfer.from[0] : transfer?.from;
                    const toLocation = Array.isArray(transfer?.to) ? transfer.to[0] : transfer?.to;
                    const product = fgMap[item.product_id];
                    return {
                        id: `transfer-${item.transfer_id}-${item.product_id}`,
                        date: transfer?.created_at || null,
                        type: 'Van Load' as const,
                        reference: transfer?.transfer_number || '-',
                        flow: `${fromLocation?.name || 'Sales Department'} → ${toLocation?.name || 'Van'}`,
                        customer: 'Internal Transfer',
                        product_name: product?.name || '-',
                        sku: product?.sku || '-',
                        unit: product?.unit || '',
                        quantity: Number(item.quantity || 0),
                        notes: `Loaded from ${fromLocation?.name || 'Sales Department'} to ${toLocation?.name || 'Van'}`,
                    };
                });

            const dispatchRows: MovementRow[] = allTransferItems
                .filter((item: any) => fgIds.includes(item.product_id) && salespersonDispatchTransfers.some((t: any) => t.id === item.transfer_id))
                .map((item: any) => {
                    const transfer = salespersonDispatchTransfers.find((row: any) => row.id === item.transfer_id);
                    const fromLocation = Array.isArray(transfer?.from) ? transfer.from[0] : transfer?.from;
                    const toLocation = Array.isArray(transfer?.to) ? transfer.to[0] : transfer?.to;
                    const toName: string = toLocation?.name || '';
                    const salespersonName = toName.replace(/^Sales Rep - /i, '') || toName;
                    const product = fgMap[item.product_id];
                    return {
                        id: `dispatch-${item.transfer_id}-${item.product_id}`,
                        date: transfer?.created_at || null,
                        type: 'Salesperson Dispatch' as const,
                        reference: transfer?.transfer_number || '-',
                        flow: `${fromLocation?.name || 'Finished Goods'} → ${toName || 'Salesperson'}`,
                        customer: salespersonName,
                        product_name: product?.name || '-',
                        sku: product?.sku || '-',
                        unit: product?.unit || '',
                        quantity: Number(item.quantity || 0),
                        notes: `Dispatched to ${salespersonName}`,
                    };
                });

            const { data: invoices, error: invoiceError } = await supabase
                .from('sales_invoices')
                .select(`
                    id,
                    invoice_number,
                    customer_name,
                    date,
                    route_id,
                    route:vans!route_id(van_id),
                    items:sales_invoice_items(product_id, quantity)
                `)
                .not('status', 'eq', 'Draft')
                .order('created_at', { ascending: false });
            if (invoiceError) return { data: null, error: invoiceError };

            const invoiceRows: MovementRow[] = (invoices || []).flatMap((invoice: any) =>
                (invoice.items || [])
                    .filter((item: any) => fgIds.includes(item.product_id))
                    .map((item: any) => {
                        const product = fgMap[item.product_id];
                        return {
                            id: `invoice-${invoice.id}-${item.product_id}`,
                            date: invoice.date || null,
                            type: 'Sales Invoice',
                            reference: invoice.invoice_number || '-',
                            flow: `${invoice.route?.van_id || 'Van'} -> Customer`,
                            customer: invoice.customer_name || '-',
                            product_name: product?.name || '-',
                            sku: product?.sku || '-',
                            unit: product?.unit || '',
                            quantity: Number(item.quantity || 0),
                            notes: `Sold to ${invoice.customer_name || 'Customer'}`,
                        };
                    })
            );

            const combined = [...loadRows, ...dispatchRows, ...invoiceRows].sort((a, b) => {
                const aTime = a.date ? new Date(a.date).getTime() : 0;
                const bTime = b.date ? new Date(b.date).getTime() : 0;
                return bTime - aTime;
            });

            return { data: combined, error: null };
        }
    );

    const data = rows ?? [];
    const totalQty = data.reduce((sum, row) => sum + Number(row.quantity || 0), 0);
    const uniqueProducts = new Set(data.map((row) => row.product_name)).size;
    const uniqueReferences = new Set(data.map((row) => `${row.type}:${row.reference}`)).size;

    const columns = [
        {
            key: 'date',
            label: 'Date',
            render: (v: any) => v
                ? new Date(v).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
                : '-',
        },
        {
            key: 'type',
            label: 'Type',
            render: (v: any) => {
                const styles: Record<string, { bg: string; color: string }> = {
                    'Sales Invoice':         { bg: '#dcfce7', color: '#15803d' },
                    'Van Load':              { bg: '#e0f2fe', color: '#0369a1' },
                    'Salesperson Dispatch':  { bg: '#fef3c7', color: '#92400e' },
                };
                const s = styles[v] || { bg: '#f1f5f9', color: '#475569' };
                return (
                    <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 600, background: s.bg, color: s.color }}>
                        {v}
                    </span>
                );
            },
        },
        {
            key: 'reference',
            label: 'Reference',
            render: (v: any, row: any) => row.type === 'Sales Invoice'
                ? <EntityLink href={`/sales/invoices?search=${encodeURIComponent(v)}`} mono>{v}</EntityLink>
                : <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--primary-600)', fontWeight: 700 }}>{v}</span>,
        },
        {
            key: 'flow',
            label: 'Flow',
            render: (v: any) => <span style={{ fontSize: 12 }}>{v}</span>,
        },
        {
            key: 'customer',
            label: 'Customer',
            render: (v: any) => <span style={{ fontSize: 12 }}>{v}</span>,
        },
        {
            key: 'product_name',
            label: 'Product',
            render: (v: any, row: any) => (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontWeight: 600, fontSize: 12, color: 'var(--slate-800)' }}>{v}</span>
                    <span style={{ fontSize: 10, color: 'var(--slate-400)', fontFamily: 'var(--font-mono)' }}>{row.sku}</span>
                </div>
            ),
        },
        {
            key: 'quantity',
            label: 'Qty',
            render: (v: any, row: any) => (
                <span style={{
                    fontWeight: 700,
                    color: row.type === 'Sales Invoice' ? 'var(--danger)' : row.type === 'Salesperson Dispatch' ? '#92400e' : 'var(--primary-700)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 13,
                }}>
                    {Number(v).toLocaleString()} <span style={{ fontWeight: 400, fontSize: 11 }}>{row.unit}</span>
                </span>
            ),
        },
        {
            key: 'notes',
            label: 'Notes',
            render: (v: any) => <span style={{ fontSize: 11, color: 'var(--slate-500)' }}>{v ?? '-'}</span>,
        },
    ];

    return (
        <div className="animate-fade-in">
            <PageHeader
                title="Stock Movements"
                subtitle="Business-level view of van loading and sales deductions"
                breadcrumbs={[
                    { label: 'Sales', href: '/sales/invoices' },
                    { label: 'Stock Movements' },
                ]}
                actions={
                    <button
                        onClick={handleExport}
                        style={{
                            display: 'flex', alignItems: 'center', gap: 8,
                            padding: '9px 18px', borderRadius: 8, border: '1.5px solid var(--slate-200)',
                            background: 'var(--card-bg)',
                            fontSize: 11, fontWeight: 600, color: 'var(--slate-700)', cursor: 'pointer',
                        }}
                    >
                        <Download size={16} /> Export
                    </button>
                }
            />

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
                <StatCard
                    title="Total Units Moved"
                    value={totalQty.toLocaleString()}
                    icon={<PackageMinus size={20} />}
                    color="red"
                />
                <StatCard
                    title="Products"
                    value={uniqueProducts.toString()}
                    icon={<Hash size={20} />}
                    color="blue"
                />
                <StatCard
                    title="References"
                    value={uniqueReferences.toString()}
                    icon={<Users size={20} />}
                    color="teal"
                />
            </div>

            <DataTable
                columns={columns}
                data={data as unknown as Record<string, unknown>[]}
                loading={isLoading}
                searchPlaceholder="Search by product, transfer, invoice, or customer..."
                emptyMessage="No sales stock movements yet."
            />

        </div>
    );
}
