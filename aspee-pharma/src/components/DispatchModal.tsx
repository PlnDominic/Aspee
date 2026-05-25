'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import Modal from './Modal';
import { Truck, Hash, Calendar, Plus, Trash2, Save, Printer, User, Search, MapPin, CheckCircle, XCircle, Download, ArrowLeft, Package, FileText, CircleDot, StickyNote, ChevronRight, AlertCircle } from 'lucide-react';
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
    const [vans, setVans] = useState<any[]>([]);
    const [availableInvoices, setAvailableInvoices] = useState<any[]>([]);
    const [invoiceSearch, setInvoiceSearch] = useState('');

    const [dispatchNumber, setDispatchNumber] = useState('');
    const [vanId, setVanId] = useState('');
    const [dispatchDate, setDispatchDate] = useState(new Date().toISOString().split('T')[0]);
    const [status, setStatus] = useState('Draft');
    const [notes, setNotes] = useState('');
    const [items, setItems] = useState<any[]>([]);

    const printRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (isOpen) {
            fetchVans();
            fetchAvailableInvoices();
            setInvoiceSearch('');
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
        const { data } = await supabase
            .from('vans')
            .select('id, van_id, driver_name, plate_number, route_area, status')
            .neq('status', 'Maintenance')
            .order('van_id');
        setVans(data || []);
    };

    const fetchAvailableInvoices = async () => {
        const { data } = await supabase
            .from('sales_invoices')
            .select('id, invoice_number, customer_name, total_amount, date')
            .in('status', ['Issued', 'Partially Paid', 'Draft', 'ISSUED', 'PARTIALLY PAID', 'PARTIAL', 'DRAFT'])
            .order('created_at', { ascending: false });
        setAvailableInvoices(data || []);
    };

    const populateForm = async (data: any) => {
        setDispatchNumber(data.dispatch_number);
        setVanId(data.van_id || '');
        setDispatchDate(data.dispatch_date);
        setStatus(data.status);
        setNotes(data.notes || '');

        const { data: dispatchItems } = await supabase
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
    const selectedVan = vans.find(v => v.id === vanId);

    const totalValue = useMemo(() =>
        items.reduce((sum, item) => sum + Number(item.invoice?.total_amount || 0), 0),
        [items]
    );

    const filteredInvoices = useMemo(() => {
        const unassigned = availableInvoices.filter(inv => !items.some(it => it.invoice_id === inv.id));
        if (!invoiceSearch.trim()) return unassigned;
        const q = invoiceSearch.toLowerCase();
        return unassigned.filter(inv =>
            inv.invoice_number?.toLowerCase().includes(q) ||
            inv.customer_name?.toLowerCase().includes(q)
        );
    }, [availableInvoices, items, invoiceSearch]);

    // --- PDF / Print helpers ---
    const getClonedContent = () => {
        const printContent = printRef.current;
        if (!printContent) return null;
        const clonedContent = printContent.cloneNode(true) as HTMLElement;
        const originalSvgs = printContent.querySelectorAll('svg');
        const clonedSvgs = clonedContent.querySelectorAll('svg');
        originalSvgs.forEach((svg, i) => {
            if (clonedSvgs[i]) {
                clonedSvgs[i].setAttribute('xmlns', 'http://www.w3.org/2000/svg');
            }
        });
        return clonedContent;
    };

    const handleDownloadPDF = async () => {
        const clonedContent = getClonedContent();
        if (!clonedContent) return;
        const container = document.createElement('div');
        container.style.position = 'fixed';
        container.style.left = '-9999px';
        container.style.top = '0';
        const styleEl = document.createElement('style');
        styleEl.textContent = dispatchDocStyles;
        container.appendChild(styleEl);
        container.appendChild(clonedContent);
        document.body.appendChild(container);
        try {
            const html2pdf = (await import('html2pdf.js')).default;
            await html2pdf()
                .set({
                    margin: 0,
                    filename: `${dispatchNumber}.pdf`,
                    image: { type: 'jpeg', quality: 0.98 },
                    html2canvas: { scale: 2, useCORS: true, letterRendering: true },
                    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
                })
                .from(clonedContent)
                .save();
            toast.success('PDF downloaded successfully!');
        } catch (error) {
            console.error('PDF download failed:', error);
            toast.error('Failed to download PDF. Please try again.');
        } finally {
            document.body.removeChild(container);
        }
    };

    const openPrintWindow = () => {
        const clonedContent = getClonedContent();
        if (!clonedContent) return;
        const printWindow = window.open('', '_blank', 'width=900,height=700');
        if (!printWindow) {
            toast.error('Please allow pop-ups to print.');
            return;
        }
        const html = `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Dispatch - ${dispatchNumber}</title>
    <style>
        ${dispatchDocStyles}
        @media print {
            body { background: white; }
            .a4-page { margin: 0; padding: 15mm 20mm; min-height: 297mm; }
        }
    </style>
</head>
<body>${clonedContent.outerHTML}</body>
</html>`;
        printWindow.document.write(html);
        printWindow.document.close();
        printWindow.onload = () => {
            printWindow.focus();
            printWindow.print();
        };
    };

    // ========================
    //  VIEW MODE — A4 Preview
    // ========================
    if (isViewOnly) {
        return (
            <Modal
                isOpen={isOpen}
                onClose={onClose}
                title="Dispatch Details"
                subtitle={dispatchNumber}
                width={1000}
                noPadding
            >
                <div className="a4-document-container">
                    <div className="a4-actions no-print">
                        <button onClick={onClose} className="btn-back">
                            <ArrowLeft size={16} /> Back
                        </button>
                        <div className="a4-action-group">
                            <button onClick={handleDownloadPDF} className="btn-download">
                                <Download size={16} /> Download PDF
                            </button>
                            <button onClick={openPrintWindow} className="btn-print">
                                <Printer size={16} /> Print
                            </button>
                        </div>
                    </div>

                    <div className="a4-preview-scroller">
                        <div className="a4-page" ref={printRef}>
                            <style dangerouslySetInnerHTML={{ __html: dispatchDocStyles }} />

                            <div className="doc-header">
                                <div className="company-info">
                                    <h1 className="company-name">ASPEE PHARMACEUTICALS LTD</h1>
                                    <p className="company-tagline">Quality Healthcare for All</p>
                                    <div className="contact-details">
                                        <p><MapPin size={12} /> Ejisu - Asamang, Ashanti Region</p>
                                        <p><Truck size={12} /> 0244791052 / 0501234567</p>
                                        <p>aspeepharmaceuticalsgh@gmail.com</p>
                                    </div>
                                </div>
                                <div className="doc-type">
                                    <h2>DELIVERY NOTE</h2>
                                    <div className="dispatch-meta">
                                        <div className="meta-row">
                                            <span className="label">Dispatch #:</span>
                                            <span className="value">{dispatchNumber}</span>
                                        </div>
                                        <div className="meta-row">
                                            <span className="label">Date:</span>
                                            <span className="value">{new Date(dispatchDate).toLocaleDateString('en-GB')}</span>
                                        </div>
                                        <div className="meta-row">
                                            <span className="label">Status:</span>
                                            <span className={`status-badge ${status.toLowerCase().replace(' ', '-')}`}>{status}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="van-info-section">
                                <h3>DELIVERY VAN</h3>
                                <div className="van-details">
                                    <div className="van-field">
                                        <span className="van-label">Driver:</span>
                                        <span className="van-value">{selectedVan?.driver_name || 'N/A'}</span>
                                    </div>
                                    <div className="van-field">
                                        <span className="van-label">Van ID:</span>
                                        <span className="van-value">{selectedVan?.van_id || 'N/A'}</span>
                                    </div>
                                    <div className="van-field">
                                        <span className="van-label">Plate Number:</span>
                                        <span className="van-value">{selectedVan?.plate_number || 'N/A'}</span>
                                    </div>
                                    <div className="van-field">
                                        <span className="van-label">Route Area:</span>
                                        <span className="van-value">{selectedVan?.route_area || 'N/A'}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="doc-items">
                                <table className="items-table">
                                    <thead>
                                        <tr>
                                            <th style={{ width: '40px' }}>#</th>
                                            <th>Invoice #</th>
                                            <th>Customer / Recipient</th>
                                            <th style={{ textAlign: 'right' }}>Amount</th>
                                            <th style={{ textAlign: 'center' }}>Status</th>
                                            <th style={{ width: '150px' }}>Customer Signature</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {items.map((item, idx) => (
                                            <tr key={idx}>
                                                <td>{idx + 1}</td>
                                                <td style={{ fontWeight: 700 }}>{item.invoice?.invoice_number}</td>
                                                <td>
                                                    <div style={{ fontWeight: 600 }}>{item.invoice?.customer_name}</div>
                                                    <div style={{ fontSize: 10, color: '#64748b' }}>Date: {new Date(item.invoice?.date).toLocaleDateString()}</div>
                                                </td>
                                                <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatCurrency(item.invoice?.total_amount)}</td>
                                                <td style={{ textAlign: 'center' }}>
                                                    <span className={`item-status ${item.status?.toLowerCase()}`}>{item.status}</span>
                                                </td>
                                                <td style={{ borderBottom: '1px solid #ccc', height: '40px' }}></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot>
                                        <tr className="grand-total-row">
                                            <td colSpan={3}></td>
                                            <td style={{ textAlign: 'right', fontWeight: 700, fontSize: 12 }}>{formatCurrency(totalValue)}</td>
                                            <td colSpan={2}></td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>

                            {notes && (
                                <div className="notes-section">
                                    <h4>Notes</h4>
                                    <p>{notes}</p>
                                </div>
                            )}

                            <div className="doc-footer">
                                <div className="signatures">
                                    <div className="sig-block">
                                        <div className="sig-line"></div>
                                        <p>Dispatched By</p>
                                    </div>
                                    <div className="sig-block">
                                        <div className="sig-line"></div>
                                        <p>Van Driver</p>
                                    </div>
                                    <div className="sig-block">
                                        <div className="sig-line"></div>
                                        <p>Received By</p>
                                    </div>
                                </div>
                            </div>

                            <div className="page-footer">
                                <p>This is a computer generated document.</p>
                            </div>
                        </div>
                    </div>
                </div>

                <style>{`
                    .a4-document-container { background: #f1f5f9; min-height: 100%; }
                    .a4-actions { display: flex; justify-content: space-between; align-items: center; padding: 16px 24px; background: white; border-bottom: 1px solid #e2e8f0; }
                    .btn-back { display: flex; align-items: center; gap: 8px; padding: 8px 16px; border: 1px solid #e2e8f0; border-radius: 8px; background: white; font-size: 12px; font-weight: 500; cursor: pointer; }
                    .btn-back:hover { background: #f8fafc; }
                    .a4-action-group { display: flex; gap: 12px; }
                    .btn-download, .btn-print { display: flex; align-items: center; gap: 8px; padding: 8px 16px; border-radius: 8px; font-size: 12px; font-weight: 600; cursor: pointer; }
                    .btn-download { background: #0f172a; color: white; border: none; }
                    .btn-print { background: white; color: #0f172a; border: 1px solid #e2e8f0; }
                    .btn-download:hover { background: #1e293b; }
                    .btn-print:hover { background: #f8fafc; }
                    .a4-preview-scroller { padding: 24px; overflow: auto; max-height: calc(100vh - 200px); display: flex; justify-content: center; }
                    .a4-page { width: 210mm; min-height: 297mm; padding: 15mm 20mm; background: white; box-shadow: 0 4px 20px rgba(0,0,0,0.15); }
                `}</style>
            </Modal>
        );
    }

    // ============================
    //  CREATE / EDIT MODE — Form
    // ============================
    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={mode === 'create' ? 'Plan New Dispatch' : 'Update Dispatch'}
            subtitle={dispatchNumber}
            width={960}
            noPadding
        >
            <form onSubmit={handleSubmit}>
                {/* ── Section 1: Dispatch Info ── */}
                <div className="dsp-section">
                    <div className="dsp-section-header">
                        <div className="dsp-section-icon">
                            <Truck size={14} />
                        </div>
                        <div>
                            <h4 className="dsp-section-title">Dispatch Information</h4>
                            <p className="dsp-section-desc">Set the van, date, and status for this dispatch trip</p>
                        </div>
                    </div>

                    <div className="dsp-fields-grid">
                        {/* Dispatch Number */}
                        <div className="dsp-field">
                            <label className="dsp-label">Dispatch Number</label>
                            <div className="dsp-input-wrap dsp-input-disabled">
                                <Hash size={14} className="dsp-input-icon" />
                                <input value={dispatchNumber} readOnly className="dsp-input" />
                            </div>
                        </div>

                        {/* Dispatch Date */}
                        <div className="dsp-field">
                            <label className="dsp-label">Dispatch Date *</label>
                            <div className="dsp-input-wrap">
                                <Calendar size={14} className="dsp-input-icon" />
                                <input
                                    type="date"
                                    value={dispatchDate}
                                    onChange={(e) => setDispatchDate(e.target.value)}
                                    className="dsp-input"
                                />
                            </div>
                        </div>

                        {/* Status */}
                        <div className="dsp-field">
                            <label className="dsp-label">Status</label>
                            <div className="dsp-input-wrap">
                                <CircleDot size={14} className="dsp-input-icon" />
                                <select value={status} onChange={(e) => setStatus(e.target.value)} className="dsp-input">
                                    <option value="Draft">Draft</option>
                                    <option value="Pending">Pending</option>
                                    <option value="In Transit">In Transit</option>
                                    <option value="Completed">Completed</option>
                                    <option value="Cancelled">Cancelled</option>
                                </select>
                            </div>
                        </div>

                        {/* Van Selection — full width */}
                        <div className="dsp-field dsp-field-full">
                            <label className="dsp-label">Select Van / Driver *</label>
                            <div className="dsp-input-wrap">
                                <Truck size={14} className="dsp-input-icon" />
                                <select value={vanId} onChange={(e) => setVanId(e.target.value)} className="dsp-input">
                                    <option value="">Choose a van...</option>
                                    {vans.map(v => (
                                        <option key={v.id} value={v.id}>
                                            {v.van_id} — {v.driver_name} ({v.plate_number}) — {v.route_area || 'No route'}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Van Preview Card */}
                    {selectedVan && (
                        <div className="dsp-van-card">
                            <div className="dsp-van-card-icon">
                                <Truck size={18} />
                            </div>
                            <div className="dsp-van-card-details">
                                <div className="dsp-van-card-row">
                                    <div className="dsp-van-card-item">
                                        <span className="dsp-van-card-label">Driver</span>
                                        <span className="dsp-van-card-value">{selectedVan.driver_name}</span>
                                    </div>
                                    <div className="dsp-van-card-item">
                                        <span className="dsp-van-card-label">Van ID</span>
                                        <span className="dsp-van-card-value dsp-mono">{selectedVan.van_id}</span>
                                    </div>
                                    <div className="dsp-van-card-item">
                                        <span className="dsp-van-card-label">Plate</span>
                                        <span className="dsp-van-card-value dsp-mono">{selectedVan.plate_number}</span>
                                    </div>
                                    <div className="dsp-van-card-item">
                                        <span className="dsp-van-card-label">Route Area</span>
                                        <span className="dsp-van-card-value">
                                            <MapPin size={11} style={{ display: 'inline', verticalAlign: '-1px' }} /> {selectedVan.route_area || '—'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* ── Section 2: Invoice Assignment ── */}
                <div className="dsp-section">
                    <div className="dsp-section-header">
                        <div className="dsp-section-icon">
                            <FileText size={14} />
                        </div>
                        <div>
                            <h4 className="dsp-section-title">Invoice Assignment</h4>
                            <p className="dsp-section-desc">Pick invoices from the right panel to assign them to this dispatch</p>
                        </div>
                        {items.length > 0 && (
                            <div className="dsp-invoice-summary">
                                <span className="dsp-invoice-count">{items.length} invoice{items.length !== 1 ? 's' : ''}</span>
                                <span className="dsp-invoice-total">{formatCurrency(totalValue)}</span>
                            </div>
                        )}
                    </div>

                    <div className="dsp-invoice-layout">
                        {/* LEFT: Assigned Invoices */}
                        <div className="dsp-assigned-panel">
                            <div className="dsp-panel-header">
                                <Package size={13} />
                                <span>Assigned to Trip ({items.length})</span>
                            </div>

                            {items.length === 0 ? (
                                <div className="dsp-empty-state">
                                    <div className="dsp-empty-icon">
                                        <FileText size={28} strokeWidth={1.2} />
                                    </div>
                                    <p className="dsp-empty-title">No invoices assigned</p>
                                    <p className="dsp-empty-desc">Click invoices from the right panel to add them here</p>
                                </div>
                            ) : (
                                <div className="dsp-assigned-list">
                                    {items.map((item, idx) => (
                                        <div key={idx} className="dsp-assigned-row">
                                            <div className="dsp-assigned-info">
                                                <div className="dsp-assigned-num">{item.invoice?.invoice_number}</div>
                                                <div className="dsp-assigned-customer">{item.invoice?.customer_name}</div>
                                            </div>
                                            <div className="dsp-assigned-amount">{formatCurrency(item.invoice?.total_amount)}</div>
                                            <select
                                                value={item.status}
                                                onChange={(e) => handleUpdateItemStatus(idx, e.target.value)}
                                                className="dsp-status-select"
                                            >
                                                <option value="Pending">Pending</option>
                                                <option value="Delivered">Delivered</option>
                                                <option value="Failed">Failed</option>
                                                <option value="Returned">Returned</option>
                                            </select>
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveItem(idx)}
                                                className="dsp-remove-btn"
                                                title="Remove invoice"
                                            >
                                                <Trash2 size={13} />
                                            </button>
                                        </div>
                                    ))}
                                    {/* Totals footer */}
                                    <div className="dsp-assigned-total">
                                        <span>Total</span>
                                        <span className="dsp-assigned-total-value">{formatCurrency(totalValue)}</span>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* RIGHT: Available Invoices Picker */}
                        <div className="dsp-picker-panel">
                            <div className="dsp-panel-header">
                                <Search size={13} />
                                <span>Available Invoices</span>
                            </div>
                            <div className="dsp-picker-search">
                                <Search size={13} className="dsp-picker-search-icon" />
                                <input
                                    type="text"
                                    placeholder="Search by invoice # or customer..."
                                    value={invoiceSearch}
                                    onChange={(e) => setInvoiceSearch(e.target.value)}
                                    className="dsp-picker-search-input"
                                />
                            </div>
                            <div className="dsp-picker-list">
                                {filteredInvoices.length === 0 ? (
                                    <div className="dsp-picker-empty">
                                        {invoiceSearch ? 'No matching invoices' : 'No pending invoices available'}
                                    </div>
                                ) : (
                                    filteredInvoices.map(inv => (
                                        <div
                                            key={inv.id}
                                            onClick={() => handleAddInvoice(inv)}
                                            className="dsp-picker-item"
                                        >
                                            <div className="dsp-picker-item-top">
                                                <span className="dsp-picker-item-num">{inv.invoice_number}</span>
                                                <Plus size={14} className="dsp-picker-item-add" />
                                            </div>
                                            <div className="dsp-picker-item-customer">{inv.customer_name}</div>
                                            <div className="dsp-picker-item-bottom">
                                                <span className="dsp-picker-item-amount">{formatCurrency(inv.total_amount)}</span>
                                                <span className="dsp-picker-item-date">
                                                    {inv.date ? new Date(inv.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : ''}
                                                </span>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── Section 3: Notes ── */}
                <div className="dsp-section dsp-section-last">
                    <div className="dsp-section-header">
                        <div className="dsp-section-icon">
                            <StickyNote size={14} />
                        </div>
                        <div>
                            <h4 className="dsp-section-title">Notes</h4>
                            <p className="dsp-section-desc">Optional delivery instructions or comments</p>
                        </div>
                    </div>
                    <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="E.g. priority delivery for Kumasi customer, contact driver before 8am..."
                        className="dsp-notes-textarea"
                        rows={3}
                    />
                </div>

                {/* ── Footer ── */}
                <div className="dsp-footer">
                    <div className="dsp-footer-info">
                        {items.length > 0 && (
                            <>
                                <span className="dsp-footer-badge">{items.length} invoice{items.length !== 1 ? 's' : ''}</span>
                                <span className="dsp-footer-total">{formatCurrency(totalValue)}</span>
                            </>
                        )}
                    </div>
                    <div className="dsp-footer-actions">
                        <button type="button" onClick={onClose} className="dsp-btn-cancel">
                            Cancel
                        </button>
                        <button type="submit" disabled={loading} className="dsp-btn-save">
                            <Save size={15} />
                            {loading ? 'Saving...' : mode === 'create' ? 'Create Dispatch' : 'Save Changes'}
                        </button>
                    </div>
                </div>
            </form>

            <style>{dispatchFormStyles}</style>
        </Modal>
    );
}

// ─── Form Styles ──────────────────────────────────────
const dispatchFormStyles = `
    /* Sections */
    .dsp-section {
        padding: 20px 28px;
        border-bottom: 1px solid var(--slate-100);
    }
    .dsp-section-last {
        border-bottom: none;
    }
    .dsp-section-header {
        display: flex;
        align-items: flex-start;
        gap: 12px;
        margin-bottom: 18px;
    }
    .dsp-section-icon {
        width: 32px;
        height: 32px;
        border-radius: 8px;
        background: var(--primary-50, #eff6ff);
        color: var(--primary-600, #2563eb);
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        margin-top: 1px;
    }
    .dsp-section-title {
        font-size: 13px;
        font-weight: 700;
        color: var(--slate-800, #1e293b);
        margin: 0 0 2px 0;
    }
    .dsp-section-desc {
        font-size: 11px;
        color: var(--slate-400, #94a3b8);
        margin: 0;
        font-weight: 400;
    }

    /* Fields Grid */
    .dsp-fields-grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 14px;
    }
    .dsp-field-full {
        grid-column: 1 / -1;
    }
    .dsp-field {}
    .dsp-label {
        display: block;
        font-size: 11px;
        font-weight: 600;
        color: var(--slate-500, #64748b);
        margin-bottom: 6px;
        letter-spacing: 0.01em;
    }
    .dsp-input-wrap {
        position: relative;
        display: flex;
        align-items: center;
    }
    .dsp-input-icon {
        position: absolute;
        left: 12px;
        color: var(--slate-400, #94a3b8);
        pointer-events: none;
    }
    .dsp-input {
        width: 100%;
        padding: 9px 12px 9px 36px;
        border: 1.5px solid var(--slate-200, #e2e8f0);
        border-radius: 8px;
        font-size: 12px;
        color: var(--slate-800, #1e293b);
        background: var(--card-bg, white);
        outline: none;
        transition: border-color 0.15s, box-shadow 0.15s;
    }
    .dsp-input:focus {
        border-color: var(--primary-400, #60a5fa);
        box-shadow: 0 0 0 3px rgba(59,130,246,0.08);
    }
    .dsp-input-disabled .dsp-input {
        background: var(--slate-50, #f8fafc);
        color: var(--slate-400, #94a3b8);
        cursor: default;
    }
    select.dsp-input {
        cursor: pointer;
        appearance: auto;
    }

    /* Van Preview Card */
    .dsp-van-card {
        display: flex;
        align-items: center;
        gap: 14px;
        margin-top: 14px;
        padding: 12px 16px;
        background: linear-gradient(135deg, var(--primary-50, #eff6ff) 0%, #f0f9ff 100%);
        border: 1.5px solid var(--primary-100, #dbeafe);
        border-radius: 10px;
        animation: dsp-slideDown 0.2s ease;
    }
    @keyframes dsp-slideDown {
        from { opacity: 0; transform: translateY(-6px); }
        to { opacity: 1; transform: translateY(0); }
    }
    .dsp-van-card-icon {
        width: 38px;
        height: 38px;
        border-radius: 10px;
        background: var(--primary-600, #2563eb);
        color: white;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
    }
    .dsp-van-card-details {
        flex: 1;
        min-width: 0;
    }
    .dsp-van-card-row {
        display: flex;
        gap: 24px;
        flex-wrap: wrap;
    }
    .dsp-van-card-item {
        display: flex;
        flex-direction: column;
        gap: 1px;
    }
    .dsp-van-card-label {
        font-size: 10px;
        font-weight: 500;
        color: var(--primary-400, #60a5fa);
        text-transform: uppercase;
        letter-spacing: 0.04em;
    }
    .dsp-van-card-value {
        font-size: 12px;
        font-weight: 700;
        color: var(--slate-800, #1e293b);
    }
    .dsp-mono {
        font-family: var(--font-mono, 'SF Mono', 'Menlo', monospace);
    }

    /* Invoice Summary Badge */
    .dsp-invoice-summary {
        margin-left: auto;
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 6px 14px;
        background: var(--slate-50, #f8fafc);
        border: 1px solid var(--slate-200, #e2e8f0);
        border-radius: 8px;
    }
    .dsp-invoice-count {
        font-size: 11px;
        font-weight: 600;
        color: var(--slate-500, #64748b);
    }
    .dsp-invoice-total {
        font-size: 12px;
        font-weight: 800;
        color: var(--primary-600, #2563eb);
        font-family: var(--font-mono, monospace);
    }

    /* Invoice Layout - Two Panels */
    .dsp-invoice-layout {
        display: grid;
        grid-template-columns: 1fr 320px;
        gap: 0;
        border: 1.5px solid var(--slate-200, #e2e8f0);
        border-radius: 12px;
        overflow: hidden;
        min-height: 340px;
    }

    /* Panel Header */
    .dsp-panel-header {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 10px 16px;
        background: var(--slate-50, #f8fafc);
        border-bottom: 1px solid var(--slate-200, #e2e8f0);
        font-size: 11px;
        font-weight: 700;
        color: var(--slate-600, #475569);
        letter-spacing: 0.01em;
    }

    /* Assigned Panel (left) */
    .dsp-assigned-panel {
        display: flex;
        flex-direction: column;
        border-right: 1.5px solid var(--slate-200, #e2e8f0);
    }
    .dsp-assigned-list {
        flex: 1;
        overflow-y: auto;
        max-height: 320px;
    }
    .dsp-assigned-row {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 10px 16px;
        border-bottom: 1px solid var(--slate-50, #f8fafc);
        transition: background 0.1s;
    }
    .dsp-assigned-row:hover {
        background: var(--slate-50, #f8fafc);
    }
    .dsp-assigned-info {
        flex: 1;
        min-width: 0;
    }
    .dsp-assigned-num {
        font-size: 11px;
        font-weight: 700;
        color: var(--primary-600, #2563eb);
        font-family: var(--font-mono, monospace);
    }
    .dsp-assigned-customer {
        font-size: 10.5px;
        color: var(--slate-500, #64748b);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        margin-top: 1px;
    }
    .dsp-assigned-amount {
        font-size: 11px;
        font-weight: 700;
        color: var(--slate-700, #334155);
        white-space: nowrap;
        min-width: 70px;
        text-align: right;
        font-family: var(--font-mono, monospace);
    }
    .dsp-status-select {
        padding: 4px 8px;
        border: 1px solid var(--slate-200, #e2e8f0);
        border-radius: 6px;
        font-size: 10px;
        font-weight: 600;
        color: var(--slate-600, #475569);
        background: white;
        cursor: pointer;
        outline: none;
    }
    .dsp-status-select:focus {
        border-color: var(--primary-400);
    }
    .dsp-remove-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 28px;
        height: 28px;
        border-radius: 6px;
        border: 1px solid transparent;
        background: none;
        color: var(--slate-300, #cbd5e1);
        cursor: pointer;
        transition: all 0.15s;
    }
    .dsp-remove-btn:hover {
        color: var(--danger, #ef4444);
        background: #fef2f2;
        border-color: #fecaca;
    }

    /* Assigned Total */
    .dsp-assigned-total {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 10px 16px;
        background: var(--slate-50, #f8fafc);
        border-top: 1.5px solid var(--slate-200, #e2e8f0);
        font-size: 11px;
        font-weight: 700;
        color: var(--slate-600, #475569);
    }
    .dsp-assigned-total-value {
        font-size: 12px;
        font-weight: 800;
        color: var(--slate-900, #0f172a);
        font-family: var(--font-mono, monospace);
    }

    /* Empty State */
    .dsp-empty-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 48px 20px;
        flex: 1;
    }
    .dsp-empty-icon {
        width: 52px;
        height: 52px;
        border-radius: 14px;
        background: var(--slate-50, #f8fafc);
        color: var(--slate-300, #cbd5e1);
        display: flex;
        align-items: center;
        justify-content: center;
        margin-bottom: 12px;
    }
    .dsp-empty-title {
        font-size: 12px;
        font-weight: 700;
        color: var(--slate-500, #64748b);
        margin: 0 0 4px 0;
    }
    .dsp-empty-desc {
        font-size: 11px;
        color: var(--slate-400, #94a3b8);
        margin: 0;
    }

    /* Picker Panel (right) */
    .dsp-picker-panel {
        display: flex;
        flex-direction: column;
        background: var(--slate-50, #f8fafc);
    }
    .dsp-picker-search {
        position: relative;
        padding: 8px 12px;
        border-bottom: 1px solid var(--slate-200, #e2e8f0);
    }
    .dsp-picker-search-icon {
        position: absolute;
        left: 22px;
        top: 50%;
        transform: translateY(-50%);
        color: var(--slate-400, #94a3b8);
        pointer-events: none;
    }
    .dsp-picker-search-input {
        width: 100%;
        padding: 7px 10px 7px 32px;
        border: 1.5px solid var(--slate-200, #e2e8f0);
        border-radius: 7px;
        font-size: 11px;
        color: var(--slate-700, #334155);
        background: white;
        outline: none;
        transition: border-color 0.15s;
    }
    .dsp-picker-search-input:focus {
        border-color: var(--primary-400, #60a5fa);
    }
    .dsp-picker-search-input::placeholder {
        color: var(--slate-300, #cbd5e1);
    }
    .dsp-picker-list {
        flex: 1;
        overflow-y: auto;
        max-height: 290px;
    }
    .dsp-picker-empty {
        padding: 32px 16px;
        text-align: center;
        font-size: 11px;
        color: var(--slate-400, #94a3b8);
    }
    .dsp-picker-item {
        padding: 10px 14px;
        border-bottom: 1px solid var(--slate-100, #f1f5f9);
        cursor: pointer;
        transition: background 0.12s;
    }
    .dsp-picker-item:hover {
        background: white;
    }
    .dsp-picker-item-top {
        display: flex;
        justify-content: space-between;
        align-items: center;
    }
    .dsp-picker-item-num {
        font-size: 11px;
        font-weight: 700;
        color: var(--slate-700, #334155);
        font-family: var(--font-mono, monospace);
    }
    .dsp-picker-item-add {
        color: var(--primary-500, #3b82f6);
        opacity: 0;
        transition: opacity 0.12s;
    }
    .dsp-picker-item:hover .dsp-picker-item-add {
        opacity: 1;
    }
    .dsp-picker-item-customer {
        font-size: 10.5px;
        color: var(--slate-500, #64748b);
        margin-top: 2px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }
    .dsp-picker-item-bottom {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-top: 4px;
    }
    .dsp-picker-item-amount {
        font-size: 11px;
        font-weight: 700;
        color: var(--slate-800, #1e293b);
    }
    .dsp-picker-item-date {
        font-size: 10px;
        color: var(--slate-400, #94a3b8);
    }

    /* Notes */
    .dsp-notes-textarea {
        width: 100%;
        padding: 10px 14px;
        border: 1.5px solid var(--slate-200, #e2e8f0);
        border-radius: 8px;
        font-size: 12px;
        color: var(--slate-700, #334155);
        background: var(--card-bg, white);
        outline: none;
        resize: vertical;
        font-family: inherit;
        line-height: 1.5;
        transition: border-color 0.15s, box-shadow 0.15s;
    }
    .dsp-notes-textarea:focus {
        border-color: var(--primary-400, #60a5fa);
        box-shadow: 0 0 0 3px rgba(59,130,246,0.08);
    }
    .dsp-notes-textarea::placeholder {
        color: var(--slate-300, #cbd5e1);
    }

    /* Footer */
    .dsp-footer {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 16px 28px;
        background: var(--slate-50, #f8fafc);
        border-top: 1.5px solid var(--slate-200, #e2e8f0);
    }
    .dsp-footer-info {
        display: flex;
        align-items: center;
        gap: 10px;
    }
    .dsp-footer-badge {
        font-size: 10px;
        font-weight: 600;
        color: var(--primary-600, #2563eb);
        background: var(--primary-50, #eff6ff);
        padding: 3px 10px;
        border-radius: 6px;
    }
    .dsp-footer-total {
        font-size: 13px;
        font-weight: 800;
        color: var(--slate-800, #1e293b);
        font-family: var(--font-mono, monospace);
    }
    .dsp-footer-actions {
        display: flex;
        gap: 10px;
    }
    .dsp-btn-cancel {
        padding: 9px 18px;
        border-radius: 8px;
        border: 1.5px solid var(--slate-200, #e2e8f0);
        background: white;
        color: var(--slate-600, #475569);
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.15s;
    }
    .dsp-btn-cancel:hover {
        background: var(--slate-50, #f8fafc);
        border-color: var(--slate-300, #cbd5e1);
    }
    .dsp-btn-save {
        display: flex;
        align-items: center;
        gap: 7px;
        padding: 9px 22px;
        border-radius: 8px;
        border: none;
        background: linear-gradient(135deg, var(--primary-600, #2563eb), var(--primary-500, #3b82f6));
        color: white;
        font-size: 12px;
        font-weight: 700;
        cursor: pointer;
        transition: all 0.15s;
        box-shadow: 0 1px 3px rgba(37,99,235,0.2);
    }
    .dsp-btn-save:hover {
        background: linear-gradient(135deg, var(--primary-700, #1d4ed8), var(--primary-600, #2563eb));
        box-shadow: 0 2px 6px rgba(37,99,235,0.3);
    }
    .dsp-btn-save:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }
`;

// ─── A4 Document Styles (for view/print) ──────────────
const dispatchDocStyles = `
    @page { size: A4; margin: 0; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', 'Inter', -apple-system, sans-serif; color: #1a1a1a; background: white; }
    .a4-page { width: 210mm; min-height: 297mm; padding: 15mm 20mm; margin: 0 auto; background: white; }
    .doc-header { display: flex; justify-content: space-between; border-bottom: 2px solid #1a1a1a; padding-bottom: 20px; margin-bottom: 24px; }
    .company-name { font-size: 16px; font-weight: 800; margin: 0; color: #0f172a; }
    .company-tagline { font-size: 11px; color: #64748b; font-style: italic; margin: 2px 0 8px 0; }
    .contact-details p { display: flex; align-items: center; gap: 6px; font-size: 10px; margin: 2px 0; color: #334155; }
    .doc-type h2 { text-align: right; font-size: 18px; font-weight: 800; margin: 0 0 12px 0; color: #0f172a; }
    .dispatch-meta { display: flex; flex-direction: column; gap: 4px; }
    .meta-row { display: flex; justify-content: flex-end; gap: 10px; font-size: 11px; }
    .meta-row .label { color: #64748b; font-weight: 500; }
    .meta-row .value { color: #0f172a; font-weight: 700; font-family: monospace; }
    .status-badge { padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 700; }
    .status-badge.draft { background: #f1f5f9; color: #475569; }
    .status-badge.pending { background: #fef3c7; color: #92400e; }
    .status-badge.in-transit { background: #dbeafe; color: #1e40af; }
    .status-badge.completed { background: #dcfce7; color: #166534; }
    .status-badge.cancelled { background: #fef2f2; color: #991b1b; }
    .van-info-section { margin-bottom: 20px; padding: 12px 16px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; }
    .van-info-section h3 { font-size: 10px; font-weight: 800; color: #64748b; margin: 0 0 10px 0; letter-spacing: 0.05em; }
    .van-details { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
    .van-field { display: flex; flex-direction: column; gap: 2px; }
    .van-label { font-size: 10px; color: #64748b; }
    .van-value { font-size: 11px; font-weight: 600; color: #0f172a; }
    .items-table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
    .items-table th { background: #f8fafc; padding: 10px 8px; text-align: left; font-size: 10px; font-weight: 700; color: #334155; border-top: 1.5px solid #1a1a1a; border-bottom: 1.5px solid #1a1a1a; }
    .items-table td { padding: 12px 8px; border-bottom: 1px solid #e2e8f0; font-size: 11px; }
    .items-table tbody tr:last-child td { border-bottom: 1.5px solid #1a1a1a; }
    .item-status { padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 600; }
    .item-status.pending { background: #fef3c7; color: #92400e; }
    .item-status.delivered { background: #dcfce7; color: #166534; }
    .item-status.failed { background: #fef2f2; color: #991b1b; }
    .item-status.returned { background: #f3e8ff; color: #6b21a8; }
    .grand-total-row td { padding: 10px 8px !important; background: #f8fafc; border-top: 2px solid #1a1a1a !important; }
    .notes-section { margin-bottom: 20px; padding: 12px 16px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; }
    .notes-section h4 { font-size: 10px; font-weight: 800; color: #64748b; margin: 0 0 6px 0; }
    .notes-section p { font-size: 11px; color: #334155; margin: 0; }
    .doc-footer { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: auto; padding-top: 30px; }
    .signatures { display: flex; gap: 40px; }
    .sig-block { text-align: center; }
    .sig-line { border-bottom: 1px solid #1a1a1a; margin-bottom: 6px; width: 120px; }
    .sig-block p { font-size: 10px; font-weight: 700; color: #334155; text-transform: uppercase; margin: 0; }
    .page-footer { margin-top: 40px; padding-top: 12px; border-top: 1px solid #eee; text-align: center; font-size: 10px; color: #94a3b8; }
`;
