'use client';

import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import { Truck, Hash, Calendar, Plus, Trash2, Save, Printer, User, Search, MapPin, CheckCircle, XCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/formatCurrency';
import PrintableDeliveryNote from './PrintableDeliveryNote';

interface DispatchModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialData?: any;
    mode?: 'create' | 'view' | 'edit';
    onSuccess: () => void;
}

export default function DispatchModal({ isOpen, onClose, initialData, mode = 'create', onSuccess }: DispatchModalProps) {
    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(false);
    const [vans, setVans] = useState<any[]>([]);
    const [availableInvoices, setAvailableInvoices] = useState<any[]>([]);
    
    const [dispatchNumber, setDispatchNumber] = useState('');
    const [vanId, setVanId] = useState('');
    const [dispatchDate, setDispatchDate] = useState(new Date().toISOString().split('T')[0]);
    const [status, setStatus] = useState('Draft');
    const [notes, setNotes] = useState('');
    const [items, setItems] = useState<any[]>([]);

    useEffect(() => {
        if (isOpen) {
            fetchVans();
            fetchAvailableInvoices();
            if (initialData) {
                populateForm(initialData);
            } else {
                setDispatchNumber(`DSP-${Date.now().toString().slice(-6)}`);
                setVanId('');
                setDispatchDate(new Date().toISOString().split('T')[0]);
                setStatus('Draft');
                setNotes('');
                setItems([]);
            }
        }
    }, [isOpen, initialData]);

    const fetchVans = async () => {
        const { data } = await supabase.from('vans').select('*').eq('status', 'Active');
        setVans(data || []);
    };

    const fetchAvailableInvoices = async () => {
        const { data } = await supabase
            .from('sales_invoices')
            .select('id, invoice_number, customer_name, total_amount, date')
            .eq('dispatch_status', 'Pending')
            .order('created_at', { ascending: false });
        setAvailableInvoices(data || []);
    };

    const populateForm = async (data: any) => {
        setDispatchNumber(data.dispatch_number);
        setVanId(data.van_id || '');
        setDispatchDate(data.dispatch_date);
        setStatus(data.status);
        setNotes(data.notes || '');
        
        // Fetch dispatch items
        const { data: dispatchItems, error } = await supabase
            .from('dispatch_items')
            .select('*, invoice:sales_invoices(*)')
            .eq('dispatch_id', data.id);
        
        if (dispatchItems) {
            setItems(dispatchItems);
        }
    };

    const handleAddInvoice = (invoice: any) => {
        if (items.some(item => item.invoice_id === invoice.id)) {
            toast.error('Invoice already added to this dispatch');
            return;
        }
        setItems([...items, { 
            invoice_id: invoice.id, 
            invoice: invoice,
            status: 'Pending'
        }]);
    };

    const handleRemoveItem = (index: number) => {
        setItems(items.filter((_, i) => i !== index));
    };

    const handleUpdateItemStatus = (index: number, newStatus: string) => {
        const newItems = [...items];
        newItems[index].status = newStatus;
        if (newStatus === 'Delivered') {
            newItems[index].delivery_confirmation_date = new Date().toISOString();
        }
        setItems(newItems);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!vanId) return toast.error('Please select a van');
        if (items.length === 0) return toast.error('Please add at least one invoice');

        setLoading(true);
        try {
            const dispatchData = {
                dispatch_number: dispatchNumber,
                van_id: vanId,
                dispatch_date: dispatchDate,
                status: status,
                notes: notes
            };

            let dispatchId = initialData?.id;

            if (dispatchId) {
                await supabase.from('dispatches').update(dispatchData).eq('id', dispatchId);
            } else {
                const { data, error } = await supabase.from('dispatches').insert([dispatchData]).select().single();
                if (error) throw error;
                dispatchId = data.id;
            }

            // Sync items
            // For simplicity in this demo: delete existing and re-insert
            if (initialData?.id) {
                await supabase.from('dispatch_items').delete().eq('dispatch_id', dispatchId);
            }

            const itemsToInsert = items.map(item => ({
                dispatch_id: dispatchId,
                invoice_id: item.invoice_id,
                status: item.status,
                delivery_confirmation_date: item.delivery_confirmation_date || null,
                recipient_name: item.recipient_name || null,
                notes: item.notes || null
            }));

            const { error: itemsError } = await supabase.from('dispatch_items').insert(itemsToInsert);
            if (itemsError) throw itemsError;

            toast.success('Dispatch record saved successfully');
            onSuccess();
        } catch (error: any) {
            toast.error('Failed to save dispatch: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const isViewOnly = mode === 'view';

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={mode === 'create' ? 'Plan New Dispatch' : mode === 'edit' ? 'Update Dispatch' : 'Dispatch Details'}
            subtitle={dispatchNumber}
            width={900}
        >
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                    <div className="field">
                        <label>Dispatch Number</label>
                        <div className="input-wrap disabled">
                            <Hash size={14} className="icon" />
                            <input value={dispatchNumber} readOnly />
                        </div>
                    </div>
                    <div className="field">
                        <label>Select Van / Driver *</label>
                        <div className="input-wrap">
                            <Truck size={14} className="icon" />
                            <select value={vanId} onChange={(e) => setVanId(e.target.value)} disabled={isViewOnly}>
                                <option value="">Select a van...</option>
                                {vans.map(v => (
                                    <option key={v.id} value={v.id}>{v.name} ({v.license_plate})</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <div className="field">
                        <label>Dispatch Date</label>
                        <div className="input-wrap">
                            <Calendar size={14} className="icon" />
                            <input type="date" value={dispatchDate} onChange={(e) => setDispatchDate(e.target.value)} disabled={isViewOnly} />
                        </div>
                    </div>
                    <div className="field">
                        <label>Status</label>
                        <div className="input-wrap">
                            <select value={status} onChange={(e) => setStatus(e.target.value)} disabled={isViewOnly}>
                                <option value="Draft">Draft</option>
                                <option value="Pending">Pending</option>
                                <option value="In Transit">In Transit</option>
                                <option value="Completed">Completed</option>
                                <option value="Cancelled">Cancelled</option>
                            </select>
                        </div>
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 24 }}>
                    {/* Left: Dispatch Items */}
                    <div style={{ border: '1px solid var(--slate-200)', borderRadius: 12, overflow: 'hidden' }}>
                        <div style={{ padding: '12px 16px', background: 'var(--slate-50)', borderBottom: '1px solid var(--slate-200)', fontWeight: 600, fontSize: 12 }}>
                            Assigned Invoices ({items.length})
                        </div>
                        <div style={{ maxHeight: 400, overflowY: 'auto' }}>
                            {items.length === 0 ? (
                                <div style={{ padding: 40, textAlign: 'center', color: 'var(--slate-400)', fontSize: 12 }}>
                                    No invoices assigned to this trip.
                                </div>
                            ) : (
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                                    <thead style={{ background: 'var(--slate-50)', position: 'sticky', top: 0 }}>
                                        <tr>
                                            <th style={{ padding: 12, textAlign: 'left' }}>Invoice #</th>
                                            <th style={{ padding: 12, textAlign: 'left' }}>Customer</th>
                                            <th style={{ padding: 12, textAlign: 'right' }}>Amount</th>
                                            <th style={{ padding: 12, textAlign: 'center' }}>Delivery Status</th>
                                            {!isViewOnly && <th style={{ padding: 12 }}></th>}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {items.map((item, idx) => (
                                            <tr key={idx} style={{ borderTop: '1px solid var(--slate-100)' }}>
                                                <td style={{ padding: 12, fontWeight: 600 }}>{item.invoice?.invoice_number}</td>
                                                <td style={{ padding: 12 }}>{item.invoice?.customer_name}</td>
                                                <td style={{ padding: 12, textAlign: 'right' }}>{formatCurrency(item.invoice?.total_amount)}</td>
                                                <td style={{ padding: 12, textAlign: 'center' }}>
                                                    <select 
                                                        value={item.status} 
                                                        onChange={(e) => handleUpdateItemStatus(idx, e.target.value)}
                                                        disabled={isViewOnly}
                                                        style={{ padding: '4px 8px', borderRadius: 4, border: '1px solid var(--slate-200)', fontSize: 11 }}
                                                    >
                                                        <option value="Pending">Pending</option>
                                                        <option value="Delivered">Delivered</option>
                                                        <option value="Failed">Failed</option>
                                                        <option value="Returned">Returned</option>
                                                    </select>
                                                </td>
                                                {!isViewOnly && (
                                                    <td style={{ padding: 12, textAlign: 'center' }}>
                                                        <button type="button" onClick={() => handleRemoveItem(idx)} style={{ color: 'var(--danger)', background: 'none', border: 'none', cursor: 'pointer' }}>
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </td>
                                                )}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>

                    {/* Right: Available Invoices Picker */}
                    {!isViewOnly && (
                        <div style={{ border: '1px solid var(--slate-200)', borderRadius: 12, display: 'flex', flexDirection: 'column' }}>
                            <div style={{ padding: '12px 16px', background: 'var(--slate-50)', borderBottom: '1px solid var(--slate-200)', fontWeight: 600, fontSize: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                                <Search size={14} /> Available Invoices
                            </div>
                            <div style={{ flex: 1, overflowY: 'auto', maxHeight: 400 }}>
                                {availableInvoices.filter(inv => !items.some(it => it.invoice_id === inv.id)).length === 0 ? (
                                    <div style={{ padding: 20, textAlign: 'center', color: 'var(--slate-400)', fontSize: 11 }}>
                                        No pending invoices found.
                                    </div>
                                ) : (
                                    availableInvoices.filter(inv => !items.some(it => it.invoice_id === inv.id)).map(inv => (
                                        <div 
                                            key={inv.id} 
                                            onClick={() => handleAddInvoice(inv)}
                                            style={{ padding: 12, borderBottom: '1px solid var(--slate-50)', cursor: 'pointer', transition: 'background 0.2s' }}
                                            className="invoice-picker-item"
                                        >
                                            <div style={{ fontWeight: 600, fontSize: 11, display: 'flex', justifyContent: 'space-between' }}>
                                                {inv.invoice_number}
                                                <Plus size={14} color="var(--primary-600)" />
                                            </div>
                                            <div style={{ fontSize: 10, color: 'var(--slate-500)', marginTop: 2 }}>{inv.customer_name}</div>
                                            <div style={{ fontSize: 10, fontWeight: 700, marginTop: 4 }}>{formatCurrency(inv.total_amount)}</div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, borderTop: '1px solid var(--slate-100)', paddingTop: 20 }}>
                    <button type="button" onClick={onClose} style={{ padding: '10px 20px', borderRadius: 8, border: '1px solid var(--slate-200)', background: 'var(--card-bg)', cursor: 'pointer', fontSize: 12 }}>
                        Cancel
                    </button>
                    {!isViewOnly && (
                        <button type="submit" disabled={loading} style={{ padding: '10px 24px', borderRadius: 8, border: 'none', background: 'var(--primary-600)', color: 'white', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                            <Save size={16} /> {loading ? 'Saving...' : 'Save Dispatch'}
                        </button>
                    )}
                    {initialData && (
                        <button type="button" onClick={() => window.print()} style={{ padding: '10px 24px', borderRadius: 8, border: '1px solid var(--primary-600)', background: 'var(--primary-50)', color: 'var(--primary-700)', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                            <Printer size={16} /> Print Delivery Note
                        </button>
                    )}
                </div>
            </form>

            {initialData && <PrintableDeliveryNote dispatch={{...initialData, items, van: vans.find(v => v.id === vanId)}} />}

            <style>{`
                .field { display: flex; flexDirection: column; gap: 6px; }
                .field label { font-size: 11px; fontWeight: 600; color: var(--slate-600); }
                .input-wrap { position: relative; display: flex; alignItems: center; }
                .input-wrap .icon { position: absolute; left: 12px; color: var(--slate-400); }
                .input-wrap input, .input-wrap select { width: 100%; padding: 10px 12px 10px 36px; border: 1px solid var(--slate-200); borderRadius: 8px; fontSize: 12px; outline: none; }
                .input-wrap.disabled input { background: var(--slate-50); color: var(--slate-500); }
                .invoice-picker-item:hover { background: var(--primary-50); }
            `}</style>
        </Modal>
    );
}
