'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Modal from './Modal';
import { Plus, Trash2, Save, Printer, Hash, Calendar, Banknote, User, Clock, AlignLeft, Percent } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import PrintableInvoice from './PrintableInvoice';
import { generatePDF } from '@/lib/pdfGenerator';
import { formatCurrency } from '@/lib/formatCurrency';
import { getVanStockLocationByVanId, reconcileVanStockFromWaybills } from '@/lib/vanStock';
import { formatMixedBulk } from '@/lib/unitConversions';

interface InvoiceModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (invoice: any) => Promise<void>;
    record?: any;
}

export default function InvoiceModal({ isOpen, onClose, onSave, record }: InvoiceModalProps) {
    const [loading, setLoading] = useState(false);

    const [fetchingProducts, setFetchingProducts] = useState(false);
    const [products, setProducts] = useState<any[]>([]);
    const [productMap, setProductMap] = useState<Record<string, any>>({});
    const [stockMap, setStockMap] = useState<Record<string, number>>({});
    const [customers, setCustomers] = useState<any[]>([]);
    const [fetchingCustomers, setFetchingCustomers] = useState(false);
    const [vans, setVans] = useState<any[]>([]);
    const [fetchingVans, setFetchingVans] = useState(false);
    const [maxDiscountPct, setMaxDiscountPct] = useState<number>(0);

    const [invoiceNumber, setInvoiceNumber] = useState('');
    const [customerName, setCustomerName] = useState('');
    const [routeId, setRouteId] = useState('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [dueDate, setDueDate] = useState('');
    const [notes, setNotes] = useState('');
    const [currency, setCurrency] = useState('GHS');

    const [items, setItems] = useState<any[]>([]);
    const currentDraftReservedByProduct = useMemo(() => {
        const reserved: Record<string, number> = {};
        for (const item of items) {
            if (!item.product_id) continue;
            reserved[item.product_id] = (reserved[item.product_id] || 0) + (Number(item.quantity) || 0);
        }
        return reserved;
    }, [items]);

    useEffect(() => {
        if (isOpen) {
            fetchCustomers();
            fetchVans();
            fetchMaxDiscount();
        }
    }, [isOpen]);

    const fetchMaxDiscount = async () => {
        const { data } = await supabase
            .from('system_settings')
            .select('value')
            .eq('key', 'max_discount_pct')
            .single();
        if (data?.value) setMaxDiscountPct(parseFloat(data.value) || 0);
    };

    const fetchProducts = async () => {
        setFetchingProducts(true);
        try {
            if (!routeId) {
                setProducts([]);
                setStockMap({});
                return;
            }

            const { data, error } = await supabase
                .from('products')
                .select('id, name, sku, unit, bulk_unit, bulk_to_base_ratio, cash_price, credit_price')
                .eq('material_type', 'Finished Good')
                .order('name');
            if (error) throw error;
            setProducts(data || []);
            const pMap: Record<string, any> = {};
            (data || []).forEach((p: any) => { pMap[p.id] = p; });
            setProductMap(pMap);

            const productIds = (data || []).map((p: any) => p.id);
            await reconcileVanStockFromWaybills(routeId, productIds);

            const vanLocation = await getVanStockLocationByVanId(routeId);
            if (!vanLocation) {
                setStockMap({});
                return;
            }

            // Sales can only invoice from stock already loaded onto the selected van.
            if (data && data.length > 0) {
                const { data: levels } = await supabase
                    .from('stock_levels')
                    .select('product_id, qty_on_hand')
                    .eq('location_id', vanLocation.id)
                    .in('product_id', productIds);
                const map: Record<string, number> = {};
                (levels || []).forEach((l: any) => {
                    map[l.product_id] = (map[l.product_id] || 0) + (Number(l.qty_on_hand) || 0);
                });
                setStockMap(map);
            }
        } catch (error: any) {
            toast.error('Failed to fetch products: ' + error.message);
        } finally {
            setFetchingProducts(false);
        }
    };

    const fetchVans = async () => {
        setFetchingVans(true);
        try {
            const { data, error } = await supabase
                .from('vans')
                .select('id, van_id, driver_name, route_area, status')
                .neq('status', 'Maintenance')
                .order('van_id');
            if (error) throw error;
            setVans(data || []);
        } catch (error: any) {
            toast.error('Failed to fetch vans: ' + error.message);
        } finally {
            setFetchingVans(false);
        }
    };

    const fetchCustomers = async () => {
        setFetchingCustomers(true);
        try {
            const { data, error } = await supabase
                .from('customers')
                .select('id, name, status')
                .eq('status', 'Active')
                .order('name');
            if (error) throw error;
            setCustomers(data || []);
        } catch (error: any) {
            toast.error('Failed to fetch customers: ' + error.message);
        } finally {
            setFetchingCustomers(false);
        }
    };

    useEffect(() => {
        if (record) {
            setInvoiceNumber(record.invoice_number || '');
            setCustomerName(record.customer_name || '');
            setRouteId(record.route_id || '');
            setDate(record.date || new Date().toISOString().split('T')[0]);
            setDueDate(record.due_date || '');
            setNotes(record.notes || '');
            setCurrency(record.currency || 'GHS');

            if (record.items) {
                setItems(
                    record.items.map((item: any) => ({
                        ...item,
                        cash_sale: Number(item.cash_sale) || 0,
                        credit_sale: Number(item.credit_sale) || 0,
                    }))
                );
            } else {
                fetchItems(record.id);
            }
        } else {
            setInvoiceNumber(`INV-${Date.now().toString().slice(-6)}`);
            setCustomerName('');
            setRouteId('');
            setDate(new Date().toISOString().split('T')[0]);
            setDueDate('');
            setNotes('');
            setCurrency('GHS');
            setItems([]);
        }
    }, [record, isOpen]);

    useEffect(() => {
        if (isOpen) fetchProducts();
    }, [isOpen, routeId]);

    const fetchItems = async (invoiceId: string) => {
        try {
            const { data, error } = await supabase
                .from('sales_invoice_items')
                .select('*')
                .eq('invoice_id', invoiceId);
            if (error) throw error;
            setItems(
                (data || []).map((item: any) => ({
                    ...item,
                    cash_sale: Number(item.cash_sale) || 0,
                    credit_sale: Number(item.credit_sale) || 0,
                }))
            );
        } catch (error: any) {
            toast.error('Failed to load invoice items');
        }
    };

    const handleAddItem = () => {
        setItems([...items, { product_id: '', quantity: 1, unit_price: 0, discount_pct: 0, discount_amount: 0, returns_qty: 0, cash_sale: 0, credit_sale: 0, total_price: 0 }]);
    };

    const recalcItem = (item: any) => {
        const qty = Number(item.quantity) || 0;
        const price = Number(item.unit_price) || 0;
        const disc = Math.min(Number(item.discount_pct) || 0, maxDiscountPct > 0 ? maxDiscountPct : 100);
        const gross = qty * price;
        const discAmt = parseFloat((gross * disc / 100).toFixed(2));
        const total = parseFloat((gross - discAmt).toFixed(2));
        return { ...item, discount_pct: disc, discount_amount: discAmt, total_price: total };
    };

    const handleUpdateItem = (index: number, field: string, value: any) => {
        const newItems = [...items];
        newItems[index] = { ...newItems[index], [field]: value };

        if (field === 'product_id') {
            const prod = productMap[value];
            if (prod?.cash_price != null) newItems[index].unit_price = prod.cash_price;
            newItems[index] = recalcItem(newItems[index]);
        } else if (['quantity', 'unit_price', 'discount_pct'].includes(field)) {
            // enforce ceiling
            if (field === 'discount_pct' && maxDiscountPct > 0 && Number(value) > maxDiscountPct) {
                toast.error(`Max discount allowed is ${maxDiscountPct}%`);
                newItems[index].discount_pct = maxDiscountPct;
            }
            newItems[index] = recalcItem(newItems[index]);
            const cash = Number(newItems[index].cash_sale) || 0;
            if (cash <= newItems[index].total_price) {
                newItems[index].credit_sale = newItems[index].total_price - cash;
            }
        } else if (field === 'cash_sale' || field === 'credit_sale' || field === 'returns_qty') {
            newItems[index][field] = Number(value) || 0;
        }

        setItems(newItems);
    };

    const handleRemoveItem = (index: number) => {
        setItems(items.filter((_, i) => i !== index));
    };

    const subtotal = useMemo(() => items.reduce((sum, item) => sum + (Number(item.total_price) || 0), 0), [items]);
    const totalDiscount = useMemo(() => items.reduce((sum, item) => sum + (Number(item.discount_amount) || 0), 0), [items]);
    const totalAmount = subtotal;
    const cashSalesTotal = useMemo(() => items.reduce((sum, item) => sum + (Number(item.cash_sale) || 0), 0), [items]);
    const creditSalesTotal = useMemo(() => items.reduce((sum, item) => sum + (Number(item.credit_sale) || 0), 0), [items]);
    const invoiceType = useMemo(() => {
        if (cashSalesTotal > 0 && creditSalesTotal > 0) return 'Mixed Sale';
        if (cashSalesTotal > 0) return 'Cash Sale';
        return 'Credit Sale';
    }, [cashSalesTotal, creditSalesTotal]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (items.length === 0) {
            toast.error('Please add at least one line item');
            return;
        }

        if (!routeId) {
            toast.error('Please select the van that received stock from Stores');
            return;
        }

        for (const item of items) {
            if (!item.product_id) return toast.error('Please select a product for all line items');
            if (!item.quantity || item.quantity <= 0) return toast.error('Quantity must be greater than zero');
            if (item.unit_price < 0) return toast.error('Unit price cannot be negative');
            const lineTotal = Number(item.total_price) || 0;
            const lineCash = Number(item.cash_sale) || 0;
            const lineCredit = Number(item.credit_sale) || 0;
            if (lineCash < 0 || lineCredit < 0) return toast.error('Cash/Credit sale values cannot be negative');
            if (Math.abs(lineTotal - (lineCash + lineCredit)) > 0.01) {
                return toast.error('For each line item, Cash Sale + Credit Sale must equal Total');
            }
        }

        setLoading(true);

        const headerData = {
            ...(record ? { id: record.id } : {}),
            invoice_number: invoiceNumber,
            customer_name: customerName,
            route_id: routeId,
            status: record?.status || 'ISSUED',
            date,
            due_date: dueDate || null,
            type: invoiceType,
            currency,
            notes,
            total_amount: totalAmount,
            total_discount: totalDiscount,
        };

        try {
            await onSave({ ...headerData, items });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={record ? 'Edit Sales Invoice' : 'New Sales Invoice'}
            subtitle={record ? `Invoice #${record.invoice_number}` : 'Create a new sales invoice'}
            fullCanvas
        >
            <form onSubmit={handleSubmit} className="inv-form">
                {/* Header Section */}
                <div className="inv-grid">
                    <div className="inv-field full-width">
                        <label>Customer Name *</label>
                        <div className="inv-input-wrap">
                            <User size={15} className="inv-icon" />
                            <input
                                type="text"
                                value={customerName}
                                onChange={(e) => setCustomerName(e.target.value)}
                                placeholder="E.g. John Doe Clinics..."
                                required
                                list="inv-customer-list"
                            />
                            <datalist id="inv-customer-list">
                                {customers.map((c) => (
                                    <option key={c.id} value={c.name} />
                                ))}
                            </datalist>
                        </div>
                        {fetchingCustomers && (
                            <div style={{ fontSize: 10, color: 'var(--slate-500)', marginTop: 4 }}>
                                Loading customers…
                            </div>
                        )}
                    </div>

                    <div className="inv-field full-width">
                        <label>Sales Van / Route *</label>
                        <div className="inv-input-wrap">
                            <AlignLeft size={15} className="inv-icon" />
                            <select
                                value={routeId}
                                onChange={(e) => setRouteId(e.target.value)}
                                required
                            >
                                <option value="">Select loaded van...</option>
                                {vans.map((van) => (
                                    <option key={van.id} value={van.id}>
                                        {van.van_id} - {van.driver_name} ({van.route_area})
                                    </option>
                                ))}
                            </select>
                        </div>
                        {(fetchingVans || fetchingProducts) && (
                            <div style={{ fontSize: 10, color: 'var(--slate-500)', marginTop: 4 }}>
                                {fetchingVans ? 'Loading vans…' : 'Loading van stock…'}
                            </div>
                        )}
                        {!routeId && !fetchingVans && (
                            <div style={{ fontSize: 10, color: 'var(--slate-500)', marginTop: 4 }}>
                                {'Real flow: Stores -> Sales Department -> Individual Vans -> Sales Invoices.'}
                            </div>
                        )}
                    </div>

                    <div className="inv-field">
                        <label>Invoice Number *</label>
                        <div className={`inv-input-wrap ${record ? 'disabled' : ''}`}>
                            <Hash size={15} className="inv-icon" />
                            <input
                                type="text"
                                value={invoiceNumber}
                                onChange={(e) => setInvoiceNumber(e.target.value)}
                                required
                                readOnly={!!record}
                            />
                        </div>
                    </div>

                    <div className="inv-field">
                        <label>Invoice Date *</label>
                        <div className="inv-input-wrap">
                            <Calendar size={15} className="inv-icon" />
                            <input
                                type="date"
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                                required
                            />
                        </div>
                    </div>

                    <div className="inv-field">
                        <label>Due Date</label>
                        <div className="inv-input-wrap">
                            <Clock size={15} className="inv-icon" />
                            <input
                                type="date"
                                value={dueDate}
                                onChange={(e) => setDueDate(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="inv-field">
                        <label>Currency</label>
                        <div className="inv-input-wrap">
                            <Banknote size={15} className="inv-icon" />
                            <select
                                value={currency}
                                onChange={(e) => setCurrency(e.target.value)}
                            >
                                <option value="GHS">GHS (GH₵)</option>
                                <option value="USD">USD ($)</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Line Items Section */}
                <div className="inv-line-items-shell" style={{ border: '1.5px solid var(--slate-200)', borderRadius: 10, overflow: 'hidden', marginTop: 24, marginBottom: 24 }}>
                    <div className="inv-line-items-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'var(--slate-50)', borderBottom: '1px solid var(--slate-200)' }}>
                        <h4 className="inv-line-items-title" style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--slate-800)' }}>Line Items ({items.length})</h4>
                        <button
                            type="button"
                            onClick={handleAddItem}
                            className="inv-add-line-btn"
                            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 6, border: '1px solid var(--slate-300)', background: 'var(--card-bg)', fontSize: 11, fontWeight: 600, color: 'var(--slate-700)', cursor: 'pointer' }}
                        >
                            <Plus size={14} /> Add Item
                        </button>
                    </div>
                    <div className="inv-line-items-body" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12, maxHeight: 300, overflowY: 'auto' }}>
                        {items.length === 0 ? (
                            <div className="inv-line-items-empty" style={{ textAlign: 'center', padding: '32px 0', color: 'var(--slate-500)', fontSize: 12 }}>
                                No items added yet. Click &quot;Add Item&quot; to begin.
                            </div>
                        ) : (
                            items.map((item, index) => (
                                <div key={index} className="inv-line-item-card" style={{ display: 'flex', gap: 12, alignItems: 'flex-start', paddingBottom: 12, borderBottom: index < items.length - 1 ? '1px solid var(--slate-100)' : 'none' }}>
                                    <div style={{ flex: 2, display: 'flex', flexDirection: 'column', gap: 4 }}>
                                        <label style={{ fontSize: 10, fontWeight: 600, color: 'var(--slate-500)', textTransform: 'uppercase' }}>Product</label>
                                        <select
                                            value={item.product_id}
                                            onChange={(e) => handleUpdateItem(index, 'product_id', e.target.value)}
                                            style={{ padding: '8px 12px', border: '1px solid var(--slate-200)', borderRadius: 6, fontSize: 12, outline: 'none', background: 'var(--card-bg)', width: '100%' }}
                                        >
                                            <option value="">Select a product...</option>
                                            {products.map(p => {
                                                const avail = stockMap[p.id] ?? 0;
                                                return (
                                                    <option key={p.id} value={p.id}>
                                                        {p.name} ({p.sku}) — {avail} in stock
                                                    </option>
                                                );
                                            })}
                                        </select>
                                        {item.product_id && (
                                            <span style={{ fontSize: 10, color: Math.max(0, (stockMap[item.product_id] ?? 0) - ((currentDraftReservedByProduct[item.product_id] ?? 0) - (Number(item.quantity) || 0))) === 0 ? 'var(--danger)' : 'var(--slate-500)', marginTop: 2 }}>
                                                {Math.max(0, (stockMap[item.product_id] ?? 0) - ((currentDraftReservedByProduct[item.product_id] ?? 0) - (Number(item.quantity) || 0))) === 0
                                                    ? 'No stock loaded on selected van'
                                                    : `${Math.max(0, (stockMap[item.product_id] ?? 0) - ((currentDraftReservedByProduct[item.product_id] ?? 0) - (Number(item.quantity) || 0)))} available on selected van`}
                                            </span>
                                        )}
                                    </div>
                                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                                        <label style={{ fontSize: 10, fontWeight: 600, color: 'var(--slate-500)', textTransform: 'uppercase' }}>Quantity</label>
                                        <input
                                            type="number"
                                            min="0.01"
                                            step="any"
                                            value={item.quantity}
                                            onChange={(e) => handleUpdateItem(index, 'quantity', e.target.value)}
                                            style={{
                                                padding: '8px 12px',
                                                border: `1px solid ${item.product_id && Number(item.quantity) > Math.max(0, (stockMap[item.product_id] ?? 0) - ((currentDraftReservedByProduct[item.product_id] ?? 0) - (Number(item.quantity) || 0))) ? 'var(--danger)' : 'var(--slate-200)'}`,
                                                borderRadius: 6, fontSize: 12, outline: 'none', width: '100%'
                                            }}
                                        />
                                        {item.product_id && Number(item.quantity) > Math.max(0, (stockMap[item.product_id] ?? 0) - ((currentDraftReservedByProduct[item.product_id] ?? 0) - (Number(item.quantity) || 0))) && (
                                            <span style={{ fontSize: 10, color: 'var(--danger)', marginTop: 2 }}>
                                                Exceeds available stock
                                            </span>
                                        )}
                                        {item.product_id && productMap[item.product_id]?.bulk_unit && productMap[item.product_id]?.bulk_to_base_ratio && Number(item.quantity) > 0 && (
                                            <span style={{ fontSize: 10, color: 'var(--primary-600)', fontWeight: 600, marginTop: 2 }}>
                                                {formatMixedBulk(
                                                    Number(item.quantity),
                                                    productMap[item.product_id].unit,
                                                    productMap[item.product_id].bulk_unit,
                                                    productMap[item.product_id].bulk_to_base_ratio
                                                ) || `${Number(item.quantity).toLocaleString()} ${productMap[item.product_id].unit}`}
                                            </span>
                                        )}
                                    </div>
                                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                                        <label style={{ fontSize: 10, fontWeight: 600, color: 'var(--slate-500)', textTransform: 'uppercase' }}>
                                            Unit Price
                                        </label>
                                        <input
                                            type="number"
                                            min="0"
                                            step="any"
                                            value={item.unit_price}
                                            onChange={(e) => handleUpdateItem(index, 'unit_price', e.target.value)}
                                            style={{ padding: '8px 12px', border: '1px solid var(--slate-200)', borderRadius: 6, fontSize: 12, outline: 'none', width: '100%' }}
                                        />
                                        {item.product_id && (() => {
                                            const prod = productMap[item.product_id];
                                            const cashPrice = prod?.cash_price;
                                            const creditPrice = prod?.credit_price;
                                            if (cashPrice == null && creditPrice == null) return null;
                                            return (
                                                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                                                    {cashPrice != null && (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleUpdateItem(index, 'unit_price', cashPrice)}
                                                            style={{ padding: '3px 8px', borderRadius: 999, border: '1px solid #bbf7d0', background: '#f0fdf4', color: '#166534', fontSize: 10, fontWeight: 700, cursor: 'pointer' }}
                                                        >
                                                            Cash GH₵ {Number(cashPrice).toFixed(2)}
                                                        </button>
                                                    )}
                                                    {creditPrice != null && (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleUpdateItem(index, 'unit_price', creditPrice)}
                                                            style={{ padding: '3px 8px', borderRadius: 999, border: '1px solid #fed7aa', background: '#fff7ed', color: '#9a3412', fontSize: 10, fontWeight: 700, cursor: 'pointer' }}
                                                        >
                                                            Credit GH₵ {Number(creditPrice).toFixed(2)}
                                                        </button>
                                                    )}
                                                </div>
                                            );
                                        })()}
                                    </div>
                                    <div style={{ flex: '0 0 70px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                                        <label style={{ fontSize: 10, fontWeight: 600, color: 'var(--slate-500)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 2 }}>
                                            <Percent size={9} /> Disc.
                                            {maxDiscountPct > 0 && <span style={{ color: 'var(--danger)', fontWeight: 700 }}> max {maxDiscountPct}%</span>}
                                        </label>
                                        <input
                                            type="number"
                                            min="0"
                                            max={maxDiscountPct > 0 ? maxDiscountPct : 100}
                                            step="0.5"
                                            value={item.discount_pct ?? 0}
                                            onChange={(e) => handleUpdateItem(index, 'discount_pct', e.target.value)}
                                            style={{ padding: '8px 8px', border: '1px solid var(--slate-200)', borderRadius: 6, fontSize: 12, outline: 'none', width: '100%' }}
                                        />
                                    </div>
                                    <div style={{ flex: '0 0 70px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                                        <label style={{ fontSize: 10, fontWeight: 600, color: 'var(--slate-500)', textTransform: 'uppercase' }}>Returns</label>
                                        <input
                                            type="number"
                                            min="0"
                                            step="any"
                                            value={item.returns_qty ?? 0}
                                            onChange={(e) => handleUpdateItem(index, 'returns_qty', e.target.value)}
                                            style={{ padding: '8px 8px', border: '1px solid var(--amber-300, #fcd34d)', borderRadius: 6, fontSize: 12, outline: 'none', width: '100%', background: 'var(--amber-50, #fffbeb)' }}
                                        />
                                    </div>
                                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                                        <label style={{ fontSize: 10, fontWeight: 600, color: 'var(--slate-500)', textTransform: 'uppercase' }}>Cash Sale</label>
                                        <input
                                            type="number"
                                            min="0"
                                            step="any"
                                            value={item.cash_sale ?? 0}
                                            onChange={(e) => handleUpdateItem(index, 'cash_sale', e.target.value)}
                                            style={{ padding: '8px 12px', border: '1px solid var(--slate-200)', borderRadius: 6, fontSize: 12, outline: 'none', width: '100%' }}
                                        />
                                    </div>
                                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                                        <label style={{ fontSize: 10, fontWeight: 600, color: 'var(--slate-500)', textTransform: 'uppercase' }}>Credit Sale</label>
                                        <input
                                            type="number"
                                            min="0"
                                            step="any"
                                            value={item.credit_sale ?? 0}
                                            onChange={(e) => handleUpdateItem(index, 'credit_sale', e.target.value)}
                                            style={{ padding: '8px 12px', border: '1px solid var(--slate-200)', borderRadius: 6, fontSize: 12, outline: 'none', width: '100%' }}
                                        />
                                    </div>
                                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                                        <label style={{ fontSize: 10, fontWeight: 600, color: 'var(--slate-500)', textTransform: 'uppercase' }}>Total</label>
                                        <input
                                            type="text"
                                            readOnly
                                            value={(Number(item.total_price) || 0).toFixed(2)}
                                            style={{ padding: '8px 12px', border: '1px solid var(--slate-200)', borderRadius: 6, fontSize: 12, outline: 'none', width: '100%', background: 'var(--slate-50)', color: 'var(--slate-700)', fontWeight: 600 }}
                                        />
                                    </div>
                                    <div className="inv-line-remove-wrap" style={{ display: 'flex', alignItems: 'center', paddingTop: 20 }}>
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveItem(index)}
                                            style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                    <div className="inv-line-items-footer" style={{ padding: '12px 16px', background: 'var(--slate-50)', borderTop: '1px solid var(--slate-200)', display: 'flex', justifyContent: 'flex-end', gap: 20, fontSize: 13, flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--slate-600)' }}>
                            <span>Cash Sale:</span>
                            <span style={{ fontWeight: 600, color: 'var(--slate-800)' }}>{formatCurrency(cashSalesTotal, currency)}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--slate-600)' }}>
                            <span>Credit Sale:</span>
                            <span style={{ fontWeight: 600, color: 'var(--slate-800)' }}>{formatCurrency(creditSalesTotal, currency)}</span>
                        </div>
                        {totalDiscount > 0 && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--danger)' }}>
                                <span>Discount:</span>
                                <span style={{ fontWeight: 600 }}>-{formatCurrency(totalDiscount, currency)}</span>
                            </div>
                        )}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--primary-700)', fontSize: 14 }}>
                            <span style={{ fontWeight: 600 }}>Total:</span>
                            <span style={{ fontWeight: 800 }}>{formatCurrency(totalAmount, currency)}</span>
                        </div>
                    </div>
                </div>

                <div className="inv-grid">
                    <div className="inv-field full-width">
                        <label>Notes</label>
                        <div className="inv-input-wrap">
                            <AlignLeft size={15} className="inv-icon" />
                            <textarea
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                rows={2}
                                placeholder="Additional notes or payment instructions..."
                            />
                        </div>
                    </div>
                </div>



                <div className="inv-actions">
                    <button type="button" onClick={onClose} className="inv-btn-secondary">
                        Cancel
                    </button>
                    <button type="submit" disabled={loading} className="inv-btn-primary">
                        <Save size={14} />
                        {loading ? 'Saving...' : 'Save Invoice'}
                    </button>
                    {record && (
                        <button
                            type="button"
                            onClick={() => generatePDF('printable-invoice', `Invoice_${record.invoice_number}`)}
                            className="inv-btn-print"
                        >
                            <Printer size={14} />
                            Print PDF
                        </button>
                    )}
                </div>
            </form>

            <style>{`
                .inv-form { padding: 4px; }
                .inv-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 16px;
                }
                .full-width { grid-column: span 2; }
                .inv-field { position: relative; }
                .inv-field label {
                    display: block;
                    font-size: 11px;
                    font-weight: 600;
                    color: var(--slate-600);
                    margin-bottom: 6px;
                }
                .inv-input-wrap { position: relative; }
                .inv-input-wrap .inv-icon {
                    position: absolute;
                    left: 12px;
                    top: 50%;
                    transform: translateY(-50%);
                    color: var(--slate-400);
                }
                .inv-input-wrap.disabled { opacity: 0.7; }
                .inv-input-wrap.disabled input { background: var(--slate-50); }
                .inv-input-wrap input, .inv-input-wrap select {
                    width: 100%;
                    padding: 10px 12px 10px 38px;
                    border: 1.5px solid var(--slate-200);
                    border-radius: 8px;
                    font-size: 11px;
                    outline: none;
                }
                .inv-input-wrap textarea {
                    width: 100%;
                    padding: 10px 12px 10px 38px;
                    border: 1.5px solid var(--slate-200);
                    border-radius: 8px;
                    font-size: 11px;
                    outline: none;
                    resize: vertical;
                }
                .inv-line-items-shell {
                    border-radius: 18px !important;
                    border-color: var(--slate-200) !important;
                    background: color-mix(in srgb, var(--card-bg) 96%, var(--slate-50) 4%);
                }
                .inv-line-items-header {
                    align-items: flex-start !important;
                    gap: 16px;
                    padding: 18px 20px !important;
                    background: color-mix(in srgb, var(--slate-50) 90%, white 10%) !important;
                }
                .inv-line-items-title {
                    font-size: 14px !important;
                    font-weight: 700 !important;
                }
                .inv-add-line-btn {
                    min-height: 38px;
                    padding: 0 14px !important;
                    border-radius: 10px !important;
                    font-weight: 700 !important;
                    white-space: nowrap;
                }
                .inv-line-items-body {
                    gap: 14px !important;
                    padding: 18px !important;
                    max-height: calc(100vh - 360px) !important;
                    overflow-x: auto !important;
                }
                .inv-line-items-empty {
                    padding: 42px 18px !important;
                }
                .inv-line-item-card {
                    display: flex !important;
                    flex-wrap: nowrap !important;
                    gap: 10px !important;
                    align-items: start !important;
                    padding: 16px !important;
                    border: 1px solid var(--slate-200);
                    border-radius: 16px;
                    background: color-mix(in srgb, var(--card-bg) 94%, var(--slate-50) 6%);
                    min-width: 1320px;
                }
                .inv-line-item-card > :nth-child(1) { flex: 2.8 1 0 !important; min-width: 250px; }
                .inv-line-item-card > :nth-child(2) { flex: 1 1 0 !important; min-width: 96px; }
                .inv-line-item-card > :nth-child(3) { flex: 1 1 0 !important; min-width: 110px; }
                .inv-line-item-card > :nth-child(4) { flex: 0 0 78px !important; min-width: 78px; }
                .inv-line-item-card > :nth-child(5) { flex: 0 0 88px !important; min-width: 88px; }
                .inv-line-item-card > :nth-child(6) { flex: 1 1 0 !important; min-width: 110px; }
                .inv-line-item-card > :nth-child(7) { flex: 1 1 0 !important; min-width: 110px; }
                .inv-line-item-card > :nth-child(8) {
                    flex: 0 0 132px !important;
                    min-width: 0;
                    padding: 12px 14px;
                    border: 1px solid color-mix(in srgb, var(--primary-100) 86%, var(--slate-200) 14%);
                    border-radius: 14px;
                    background: color-mix(in srgb, var(--primary-50) 82%, white 18%);
                }
                .inv-line-item-card > :nth-child(8) input {
                    background: transparent !important;
                    border-color: color-mix(in srgb, var(--primary-100) 70%, var(--slate-200) 30%) !important;
                    color: var(--primary-800) !important;
                    font-size: 14px !important;
                    font-weight: 700 !important;
                }
                .inv-line-item-card > :nth-child(8) label {
                    color: var(--primary-700) !important;
                }
                .inv-line-item-card > :nth-child(9) {
                    flex: 0 0 44px !important;
                    justify-content: flex-end;
                    align-items: flex-start !important;
                    padding-top: 0 !important;
                }
                .inv-line-item-card > div {
                    min-width: 0;
                }
                .inv-line-item-card select,
                .inv-line-item-card input {
                    min-height: 40px;
                    border-radius: 12px !important;
                    font-size: 11px !important;
                }
                .inv-line-item-card > :nth-child(2) input {
                    border-width: 1.5px !important;
                }
                .inv-line-item-card > :nth-child(3) > div {
                    gap: 8px !important;
                    margin-top: 6px !important;
                }
                .inv-line-item-card > :nth-child(3) button {
                    min-height: 30px;
                    padding: 0 10px !important;
                    border-radius: 999px !important;
                    font-size: 10px !important;
                    font-weight: 800 !important;
                }
                .inv-line-item-card > :nth-child(9) button {
                    width: 36px;
                    height: 36px;
                    border-radius: 10px;
                    border: 1px solid color-mix(in srgb, var(--danger) 24%, var(--slate-200) 76%);
                    background: color-mix(in srgb, var(--danger) 8%, white 92%);
                }
                .inv-line-items-footer {
                    gap: 12px !important;
                    padding: 16px 18px 18px !important;
                    background: color-mix(in srgb, var(--slate-50) 92%, white 8%) !important;
                }
                .inv-line-items-footer > div {
                    min-width: 132px;
                    padding: 12px 14px;
                    border: 1px solid var(--slate-200);
                    border-radius: 14px;
                    background: var(--card-bg);
                }
                .inv-line-items-footer > div:last-child {
                    background: color-mix(in srgb, var(--primary-50) 82%, white 18%);
                    border-color: color-mix(in srgb, var(--primary-100) 88%, var(--slate-200) 12%);
                }
                .inv-line-items-footer > div:last-child span {
                    color: var(--primary-700) !important;
                }
                @media (max-width: 960px) {
                    .inv-line-item-card {
                        display: grid !important;
                        grid-template-columns: repeat(6, minmax(0, 1fr));
                        min-width: 0;
                    }
                    .inv-line-item-card > :nth-child(1),
                    .inv-line-item-card > :nth-child(6),
                    .inv-line-item-card > :nth-child(7),
                    .inv-line-item-card > :nth-child(8) {
                        grid-column: span 6;
                    }
                    .inv-line-item-card > :nth-child(2),
                    .inv-line-item-card > :nth-child(3),
                    .inv-line-item-card > :nth-child(5) {
                        grid-column: span 2;
                    }
                    .inv-line-item-card > :nth-child(4),
                    .inv-line-item-card > :nth-child(9) {
                        grid-column: span 2;
                    }
                }
                @media (max-width: 720px) {
                    .inv-grid {
                        grid-template-columns: 1fr;
                    }
                    .full-width {
                        grid-column: span 1;
                    }
                    .inv-line-items-header {
                        flex-direction: column;
                        align-items: stretch !important;
                    }
                    .inv-add-line-btn {
                        justify-content: center;
                    }
                    .inv-line-item-card {
                        grid-template-columns: 1fr;
                    }
                    .inv-line-item-card > :nth-child(n) {
                        grid-column: span 1;
                    }
                    .inv-line-item-card > :nth-child(9) {
                        justify-content: flex-start;
                    }
                    .inv-line-items-body {
                        max-height: none !important;
                    }
                    .inv-actions {
                        flex-wrap: wrap;
                    }
                    .inv-btn-secondary,
                    .inv-btn-primary,
                    .inv-btn-print {
                        width: 100%;
                        justify-content: center;
                    }
                }
                .inv-actions {
                    display: flex;
                    justify-content: flex-end;
                    gap: 12px;
                    margin-top: 24px;
                    padding-top: 16px;
                    border-top: 1.5px solid var(--slate-100);
                }
                .inv-btn-secondary {
                    padding: 8px 16px;
                    border-radius: 8px;
                    border: 1.5px solid var(--slate-200);
                    background: var(--card-bg);
                    font-size: 11px;
                    font-weight: 600;
                    cursor: pointer;
                }
                .inv-btn-primary {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding: 8px 20px;
                    border-radius: 8px;
                    border: none;
                    background: var(--primary-600);
                    color: white;
                    font-size: 11px;
                    font-weight: 600;
                    cursor: pointer;
                }
                .inv-btn-primary:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }
                .inv-btn-print {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding: 8px 20px;
                    border-radius: 8px;
                    border: 1.5px solid var(--primary-600);
                    background: var(--primary-50);
                    color: var(--primary-700);
                    font-size: 11px;
                    font-weight: 700;
                    cursor: pointer;
                }
            `}</style>

            <PrintableInvoice invoice={{ ...record, items, type: invoiceType, customer_name: customerName, date, due_date: dueDate, currency, notes, total_amount: totalAmount }} />
        </Modal>
    );
}
