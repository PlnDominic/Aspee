'use client';

import React, { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import PageHeader from '@/components/PageHeader';
import DataTable from '@/components/DataTable';
import StatCard from '@/components/StatCard';
import { supabase } from '@/lib/supabase';
import { useFetch } from '@/lib/hooks';
import { formatCurrency } from '@/lib/formatCurrency';
import { Package, Truck, Users } from 'lucide-react';

const VAN_LOCATION_PREFIX = 'Sales Van - ';

function RouteActivityContent() {
    const params = useSearchParams();
    const locationName = params.get('location') || '';
    // Vans used to load via "Sales Rep - {name}" locations before the
    // direct-to-van migration; support both prefixes so old links still work.
    const vanId = locationName.startsWith(VAN_LOCATION_PREFIX)
        ? locationName.slice(VAN_LOCATION_PREFIX.length)
        : null;

    const { data: van } = useFetch<any>(
        ['route-activity-van', locationName],
        async () => {
            if (!vanId) return { data: null, error: null };
            const { data, error } = await supabase
                .from('vans')
                .select('id, van_id, driver_name, route_area')
                .eq('van_id', vanId)
                .maybeSingle();
            return { data, error };
        },
        { enabled: !!vanId }
    );

    const { data: received = [], isLoading: loadingReceived } = useFetch<any[]>(
        ['route-activity-received', locationName],
        async () => {
            if (!locationName) return { data: [], error: null };
            const { data: loc } = await supabase
                .from('stock_locations')
                .select('id')
                .eq('name', locationName)
                .maybeSingle();
            if (!loc) return { data: [], error: null };

            const { data, error } = await supabase
                .from('stock_transfer_items')
                .select(`
                    id, quantity, unit,
                    product:products(id, name, sku, unit),
                    transfer:stock_transfers!inner(transfer_number, created_at, status, to_location_id)
                `)
                .eq('transfer.to_location_id', loc.id)
                .order('created_at', { ascending: false, referencedTable: 'stock_transfers' });
            return { data: data || [], error };
        },
        { enabled: !!locationName }
    );

    const { data: sold = [], isLoading: loadingSold } = useFetch<any[]>(
        ['route-activity-sold', van?.id],
        async () => {
            if (!van?.id) return { data: [], error: null };
            const { data, error } = await supabase
                .from('sales_invoices')
                .select(`
                    id, invoice_number, customer_name, date, status,
                    items:sales_invoice_items(id, quantity, unit_price, total_price, product:products(id, name, sku, unit))
                `)
                .eq('route_id', van.id)
                .order('date', { ascending: false });
            return { data: data || [], error };
        },
        { enabled: !!van?.id }
    );

    const soldRows = (sold || []).flatMap((inv: any) =>
        (inv.items || []).map((item: any) => ({
            key: `${inv.id}-${item.id}`,
            invoice_number: inv.invoice_number,
            customer_name: inv.customer_name,
            date: inv.date,
            status: inv.status,
            product_name: item.product?.name || '-',
            sku: item.product?.sku || '-',
            quantity: item.quantity,
            unit: item.product?.unit || '',
            total_price: item.total_price,
        }))
    );

    const totalReceivedUnits = received.reduce((s, r) => s + (Number(r.quantity) || 0), 0);
    const totalSoldUnits = soldRows.reduce((s, r) => s + (Number(r.quantity) || 0), 0);
    const uniqueCustomers = new Set(soldRows.map(r => r.customer_name)).size;

    const receivedColumns = [
        {
            key: 'transfer',
            label: 'Transfer Ref',
            render: (v: any) => <span style={{ fontWeight: 600, color: 'var(--primary-600)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>{v?.transfer_number || '-'}</span>,
        },
        {
            key: 'transfer_date',
            label: 'Date',
            render: (_: any, row: any) => row.transfer?.created_at ? new Date(row.transfer.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '-',
        },
        {
            key: 'product',
            label: 'Product',
            render: (v: any) => (
                <div>
                    <div style={{ fontSize: 12 }}>{v?.name || '-'}</div>
                    <div style={{ fontSize: 10, color: 'var(--slate-500)', fontFamily: 'var(--font-mono)' }}>{v?.sku || '-'}</div>
                </div>
            ),
        },
        {
            key: 'quantity',
            label: 'Qty Received',
            render: (v: any, row: any) => <span style={{ fontWeight: 700, color: 'var(--success, #16a34a)' }}>+{Number(v).toLocaleString()} {row.unit || row.product?.unit}</span>,
        },
    ];

    const soldColumns = [
        {
            key: 'invoice_number',
            label: 'Invoice',
            render: (v: string) => <span style={{ fontWeight: 600, color: 'var(--primary-600)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>{v}</span>,
        },
        {
            key: 'date',
            label: 'Date',
            render: (v: string) => new Date(v).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
        },
        {
            key: 'customer_name',
            label: 'Customer',
            render: (v: string) => <span style={{ fontWeight: 600 }}>{v}</span>,
        },
        {
            key: 'product_name',
            label: 'Product',
            render: (v: string, row: any) => (
                <div>
                    <div style={{ fontSize: 12 }}>{v}</div>
                    <div style={{ fontSize: 10, color: 'var(--slate-500)', fontFamily: 'var(--font-mono)' }}>{row.sku}</div>
                </div>
            ),
        },
        {
            key: 'quantity',
            label: 'Qty Sold',
            render: (v: number, row: any) => <span style={{ fontWeight: 700, color: 'var(--danger)' }}>-{Number(v).toLocaleString()} {row.unit}</span>,
        },
        {
            key: 'total_price',
            label: 'Total',
            render: (v: number) => formatCurrency(Number(v) || 0),
        },
    ];

    return (
        <div className="animate-fade-in">
            <PageHeader
                title={van ? `${van.driver_name || van.van_id} — Route Activity` : 'Route Activity'}
                subtitle={van?.route_area ? `Route: ${van.route_area}` : locationName}
                breadcrumbs={[
                    { label: 'Stores', href: '/stores/transfers' },
                    { label: 'Transfers', href: '/stores/transfers' },
                    { label: 'Route Activity' },
                ]}
            />

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
                <StatCard title="Units Received" value={totalReceivedUnits.toLocaleString()} icon={<Truck size={20} />} color="blue" />
                <StatCard title="Units Sold" value={totalSoldUnits.toLocaleString()} icon={<Package size={20} />} color="green" />
                <StatCard title="Customers Served" value={uniqueCustomers.toString()} icon={<Users size={20} />} color="amber" />
            </div>

            <h4 style={{ fontSize: 13, fontWeight: 700, color: 'var(--slate-800)', marginBottom: 10 }}>Items Received on This Route</h4>
            <DataTable
                columns={receivedColumns}
                data={received}
                loading={loadingReceived}
                searchPlaceholder="Search by product or transfer ref..."
                emptyMessage="No stock has been transferred to this route yet."
            />

            <h4 style={{ fontSize: 13, fontWeight: 700, color: 'var(--slate-800)', margin: '28px 0 10px' }}>How It Was Sold to Customers</h4>
            <DataTable
                columns={soldColumns}
                data={soldRows}
                loading={loadingSold}
                searchPlaceholder="Search by customer, product, or invoice..."
                emptyMessage={vanId ? 'No sales recorded against this route yet.' : 'This location is not a sales van route — nothing sold against it.'}
            />
        </div>
    );
}

export default function RouteActivityPage() {
    return (
        <Suspense fallback={null}>
            <RouteActivityContent />
        </Suspense>
    );
}
