'use client';

import React, { useState } from 'react';
import PageHeader from '@/components/PageHeader';
import DataTable from '@/components/DataTable';
import StatCard from '@/components/StatCard';
import EntityLink from '@/components/EntityLink';
import { ArrowUpRight, PackageMinus, Hash, Users } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useFetch } from '@/lib/hooks';

export default function SalesMovementsPage() {
    const [search, setSearch] = useState('');

    const { data: rows, isLoading } = useFetch<any[]>(
        ['stores-sales-movements'],
        async () => {
            const { data: movements, error } = await supabase
                .from('stock_movements')
                .select('id, product_id, quantity, notes, created_at, reference_id')
                .eq('reference_type', 'Sales Invoice')
                .eq('movement_type', 'OUT')
                .order('created_at', { ascending: false });
            if (error) throw error;
            if (!movements || movements.length === 0) return { data: [], error: null };

            const productIds = [...new Set(movements.map((m: any) => m.product_id))];
            const invoiceIds = [...new Set(movements.map((m: any) => m.reference_id).filter(Boolean))];

            const [prodRes, invRes] = await Promise.all([
                supabase.from('products').select('id, name, sku, unit').in('id', productIds),
                invoiceIds.length > 0
                    ? supabase.from('sales_invoices').select('id, invoice_number, customer_name, date').in('id', invoiceIds)
                    : Promise.resolve({ data: [], error: null }),
            ]);

            const prodMap: Record<string, any> = {};
            (prodRes.data || []).forEach((p: any) => { prodMap[p.id] = p; });
            const invMap: Record<string, any> = {};
            ((invRes as any).data || []).forEach((inv: any) => { invMap[inv.id] = inv; });

            return {
                data: movements.map((m: any) => ({
                    ...m,
                    product_name: prodMap[m.product_id]?.name ?? '-',
                    sku: prodMap[m.product_id]?.sku ?? '-',
                    unit: prodMap[m.product_id]?.unit ?? '',
                    invoice_number: invMap[m.reference_id]?.invoice_number ?? '-',
                    customer_name: invMap[m.reference_id]?.customer_name ?? '-',
                    invoice_date: invMap[m.reference_id]?.date ?? null,
                })),
                error: null,
            };
        }
    );

    const data = rows ?? [];
    const totalQty = data.reduce((s: number, r: any) => s + Number(r.quantity || 0), 0);
    const uniqueProducts = new Set(data.map((r: any) => r.product_id)).size;
    const uniqueCustomers = new Set(data.map((r: any) => r.customer_name)).size;

    const columns = [
        {
            key: 'invoice_date',
            label: 'Date',
            render: (v: any) => v
                ? new Date(v).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
                : '-',
        },
        {
            key: 'product_name',
            label: 'Product',
            render: (v: any, row: any) => (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <EntityLink href={`/stores/stock?search=${encodeURIComponent(v)}`} title="View current stock level">
                        {v}
                    </EntityLink>
                    <span style={{ fontSize: 10, color: 'var(--slate-400)', fontFamily: 'var(--font-mono)' }}>{row.sku}</span>
                </div>
            ),
        },
        {
            key: 'quantity',
            label: 'Qty Out',
            render: (v: any, row: any) => (
                <span style={{ fontWeight: 700, color: 'var(--danger)', fontFamily: 'var(--font-mono)', fontSize: 13 }}>
                    -{Number(v).toLocaleString()} <span style={{ fontWeight: 400, fontSize: 11 }}>{row.unit}</span>
                </span>
            ),
        },
        {
            key: 'invoice_number',
            label: 'Invoice No.',
            render: (v: any) => (
                <EntityLink href={`/sales/invoices?search=${encodeURIComponent(v)}`} mono title="View invoice">
                    {v}
                </EntityLink>
            ),
        },
        {
            key: 'customer_name',
            label: 'Customer',
            render: (v: any) => <span style={{ fontSize: 12 }}>{v}</span>,
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
                title="Sales Movements"
                subtitle="Finished goods deducted from store by sales invoices"
                breadcrumbs={[
                    { label: 'Stores', href: '/stores/products' },
                    { label: 'Sales Movements' },
                ]}
            />

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
                <StatCard
                    title="Total Units Out"
                    value={totalQty.toLocaleString()}
                    icon={<PackageMinus size={20} />}
                    color="red"
                />
                <StatCard
                    title="Products Sold"
                    value={uniqueProducts.toString()}
                    icon={<Hash size={20} />}
                    color="blue"
                />
                <StatCard
                    title="Customers"
                    value={uniqueCustomers.toString()}
                    icon={<Users size={20} />}
                    color="teal"
                />
            </div>

            <DataTable
                columns={columns}
                data={data as unknown as Record<string, unknown>[]}
                loading={isLoading}
                searchPlaceholder="Search by product, invoice, or customer..."
                emptyMessage="No sales movements yet. Movements are recorded when invoices are issued."
            />
        </div>
    );
}
