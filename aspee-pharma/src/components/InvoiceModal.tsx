'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Modal from './Modal';
import { Plus, Trash2, Save, Printer, Hash, Calendar, Banknote, User, Tag, Clock, AlignLeft } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import PrintableInvoice from './PrintableInvoice';
import { generatePDF } from '@/lib/pdfGenerator';
import { formatCurrency } from '@/lib/formatCurrency';

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

    const [invoiceNumber, setInvoiceNumber] = useState('');
    const [customerName, setCustomerName] = useState('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [dueDate, setDueDate] = useState('');
    const [type, setType] = useState('Credit Sale');
    const [notes, setNotes] = useState('');
    const [currency, setCurrency] = useState('GHS');

    const [items, setItems] = useState<any[]>([]);

    useEffect(() => {
        if (isOpen) fetchProducts();
    }, [isOpen]);

    const fetchProducts = async () => {
        setFetchingProducts(true);
        try {
            const { data, error } = await supabase
                .from('products')
                .select('id, name, sku, unit')
                .order('name');
            if (error) throw error;
            setProducts(data || []);
        } catch (error: any) {
            toast.error('Failed to fetch products: ' + error.message);
        } finally {
            setFetchingProducts(false);
        }
    };

    useEffect(() => {
        if (record) {
            setInvoiceNumber(record.invoice_number || '');
            setCustomerName(record.customer_name || '');
            setDate(record.date || new Date().toISOString().split('T')[0]);
            setDueDate(record.due_date || '');
            setType(record.type || 'Credit Sale');
            setNotes(record.notes || '');
            setCurrency(record.currency || 'GHS');

            if (record.items) {
                setItems(record.items);
            } else {
                fetchItems(record.id);
            }
        } else {
            setInvoiceNumber(`INV-${Date.now().toString().slice(-6)}`);
            setCustomerName('');
            setDate(new Date().toISOString().split('T')[0]);
            setDueDate('');
            setType('Credit Sale');
            setNotes('');
            setCurrency('GHS');
            setItems([]);
        }
    }, [record, isOpen]);

    const fetchItems = async (invoiceId: string) => {
        try {
            const { data, error } = await supabase
                .from('sales_invoice_items')
                .select('*')
                .eq('invoice_id', invoiceId);
            if (error) throw error;
            setItems(data || []);
        } catch (error: any) {
            toast.error('Failed to load invoice items');
        }
    };

    const handleAddItem = () => {
        setItems([...items, { product_id: '', quantity: 1, unit_price: 0, total_price: 0 }]);
    };

    const handleUpdateItem = (index: number, field: string, value: any) => {
        const newItems = [...items];
        newItems[index] = { ...newItems[index], [field]: value };
        
        if (field === 'quantity' || field === 'unit_price') {
            const qty = Number(newItems[index].quantity) || 0;
            const price = Number(newItems[index].unit_price) || 0;
            newItems[index].total_price = qty * price;
        }

        setItems(newItems);
    };

    const handleRemoveItem = (index: number) => {
        setItems(items.filter((_, i) => i !== index));
    };

    const subtotal = useMemo(() => items.reduce((sum, item) => sum + (Number(item.total_price) || 0), 0), [items]);
    const totalAmount = subtotal;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (items.length === 0) {
            toast.error('Please add at least one line item');
            return;
        }

        for (const item of items) {
            if (!item.product_id) return toast.error('Please select a product for all line items');
            if (!item.quantity || item.quantity <= 0) return toast.error('Quantity must be greater than zero');
            if (item.unit_price < 0) return toast.error('Unit price cannot be negative');
        }

        setLoading(true);

        const headerData = {
            ...(record ? { id: record.id } : {}),
            invoice_number: invoiceNumber,
            customer_name: customerName,
            date,
            due_date: dueDate || null,
            type,
            currency,
            notes,
            total_amount: totalAmount
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
            width={800}
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
                            />
                        </div>
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
                        <label>Sale Type</label>
                        <div className="inv-input-wrap">
                            <Tag size={15} className="inv-icon" />
                            <select
                                value={type}
                                onChange={(e) => setType(e.target.value)}
                            >
                                <option value="Credit Sale">Credit Sale</option>
                                <option value="Cash Sale">Cash Sale</option>
                            </select>
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
                <div style={{ border: '1.5px solid var(--slate-200)', borderRadius: 10, overflow: 'hidden', marginTop: 24, marginBottom: 24 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'var(--slate-50)', borderBottom: '1px solid var(--slate-200)' }}>
                        <h4 style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--slate-800)' }}>Line Items ({items.length})</h4>
                        <button
                            type="button"
                            onClick={handleAddItem}
                            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 6, border: '1px solid var(--slate-300)', background: 'var(--card-bg)', fontSize: 11, fontWeight: 600, color: 'var(--slate-700)', cursor: 'pointer' }}
                        >
                            <Plus size={14} /> Add Item
                        </button>
                    </div>
                    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12, maxHeight: 300, overflowY: 'auto' }}>
                        {items.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--slate-500)', fontSize: 12 }}>
                                No items added yet. Click &quot;Add Item&quot; to begin.
                            </div>
                        ) : (
                            items.map((item, index) => (
                                <div key={index} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', paddingBottom: 12, borderBottom: index < items.length - 1 ? '1px solid var(--slate-100)' : 'none' }}>
                                    <div style={{ flex: 2, display: 'flex', flexDirection: 'column', gap: 4 }}>
                                        <label style={{ fontSize: 10, fontWeight: 600, color: 'var(--slate-500)', textTransform: 'uppercase' }}>Product</label>
                                        <select
                                            value={item.product_id}
                                            onChange={(e) => handleUpdateItem(index, 'product_id', e.target.value)}
                                            style={{ padding: '8px 12px', border: '1px solid var(--slate-200)', borderRadius: 6, fontSize: 12, outline: 'none', background: 'var(--card-bg)', width: '100%' }}
                                        >
                                            <option value="">Select a product...</option>
                                            {products.map(p => (
                                                <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                                        <label style={{ fontSize: 10, fontWeight: 600, color: 'var(--slate-500)', textTransform: 'uppercase' }}>Quantity</label>
                                        <input
                                            type="number"
                                            min="0.01"
                                            step="any"
                                            value={item.quantity}
                                            onChange={(e) => handleUpdateItem(index, 'quantity', e.target.value)}
                                            style={{ padding: '8px 12px', border: '1px solid var(--slate-200)', borderRadius: 6, fontSize: 12, outline: 'none', width: '100%' }}
                                        />
                                    </div>
                                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                                        <label style={{ fontSize: 10, fontWeight: 600, color: 'var(--slate-500)', textTransform: 'uppercase' }}>Unit Price</label>
                                        <input
                                            type="number"
                                            min="0"
                                            step="any"
                                            value={item.unit_price}
                                            onChange={(e) => handleUpdateItem(index, 'unit_price', e.target.value)}
                                            style={{ padding: '8px 12px', border: '1px solid var(--slate-200)', borderRadius: 6, fontSize: 12, outline: 'none', width: '100%' }}
                                        />
                                    </div>
                                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                                        <label style={{ fontSize: 10, fontWeight: 600, color: 'var(--slate-500)', textTransform: 'uppercase' }}>Total</label>
                                        <input
                                            type="text"
                                            readOnly
                                            value={item.total_price.toFixed(2)}
                                            style={{ padding: '8px 12px', border: '1px solid var(--slate-200)', borderRadius: 6, fontSize: 12, outline: 'none', width: '100%', background: 'var(--slate-50)', color: 'var(--slate-700)', fontWeight: 600 }}
                                        />
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', paddingTop: 20 }}>
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
                    <div style={{ padding: '12px 16px', background: 'var(--slate-50)', borderTop: '1px solid var(--slate-200)', display: 'flex', justifyContent: 'flex-end', gap: 24, fontSize: 13 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--slate-600)' }}>
                            <span>Subtotal:</span>
                            <span style={{ fontWeight: 600, color: 'var(--slate-800)' }}>{formatCurrency(subtotal, currency)}</span>
                        </div>
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

            <PrintableInvoice invoice={{ ...record, items, type, customer_name: customerName, date, due_date: dueDate, currency, notes, total_amount: totalAmount }} />
        </Modal>
    );
}
