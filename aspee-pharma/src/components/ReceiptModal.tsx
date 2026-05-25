'use client';

import React, { useState, useEffect, useRef } from 'react';
import Modal from './Modal';
import {
    CreditCard,
    Hash,
    Calendar,
    Banknote,
    Save,
    Search,
    FileText,
    ChevronDown,
    X
} from 'lucide-react';
import StatusBadge from './StatusBadge';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { formatCurrency, CURRENCY_SYMBOL } from '@/lib/currency';

interface Invoice {
    id: string;
    invoice_number: string;
    customer_name: string;
    total_amount: number;
    status: string;
    date: string;
}

interface ReceiptModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: () => void;
    record?: any;
}

export default function ReceiptModal({ isOpen, onClose, onSuccess, record }: ReceiptModalProps) {
    const [loading, setLoading] = useState(false);
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
    const [previousReceipts, setPreviousReceipts] = useState<number>(0);
    const [searchTerm, setSearchTerm] = useState('');
    const [isOpen_dropdown, setIsOpen_dropdown] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);

    const [receiptNumber, setReceiptNumber] = useState('');
    const [receiptDate, setReceiptDate] = useState(new Date().toISOString().split('T')[0]);
    const [paymentMethod, setPaymentMethod] = useState('');
    const [paymentReference, setPaymentReference] = useState('');
    const [amount, setAmount] = useState<number>(0);
    const [notes, setNotes] = useState('');

    useEffect(() => {
        if (isOpen) {
            fetchInvoices();
            if (record) {
                setReceiptNumber(record.receipt_number || '');
                setReceiptDate(record.date || new Date().toISOString().split('T')[0]);
                setPaymentMethod(record.payment_method || '');
                setPaymentReference(record.payment_reference || '');
                setAmount(Number(record.amount) || 0);
                setNotes(record.notes || '');
                if (record.invoice_id) {
                    supabase
                        .from('sales_invoices')
                        .select('id, invoice_number, customer_name, total_amount, status, date')
                        .eq('id', record.invoice_id)
                        .single()
                        .then(({ data }) => {
                            if (data) {
                                setSelectedInvoice(data);
                                loadPreviousReceipts(data.id, record.id).catch(() => {
                                    setPreviousReceipts(0);
                                });
                            }
                        });
                }
            } else {
                generateReceiptNumber();
                resetForm();
            }
        }
    }, [isOpen, record]);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setIsOpen_dropdown(false);
                setSearchTerm('');
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const resetForm = () => {
        setSelectedInvoice(null);
        setPreviousReceipts(0);
        setSearchTerm('');
        setIsOpen_dropdown(false);
        setReceiptDate(new Date().toISOString().split('T')[0]);
        setPaymentMethod('');
        setPaymentReference('');
        setAmount(0);
        setNotes('');
    };

    const fetchInvoices = async () => {
        try {
            const { data, error } = await supabase
                .from('sales_invoices')
                .select('id, invoice_number, customer_name, total_amount, status, date')
                .not('status', 'in', '("PAID","Paid")')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setInvoices(data || []);
        } catch (error: any) {
            toast.error('Failed to load invoices: ' + error.message);
        }
    };

    const generateReceiptNumber = () => {
        const date = new Date();
        const year = date.getFullYear().toString().slice(-2);
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const random = Math.floor(1000 + Math.random() * 9000);
        setReceiptNumber(`RCT-${year}${month}-${random}`);
    };

    const loadPreviousReceipts = async (invoiceId: string, excludeReceiptId?: string) => {
        let query = supabase
            .from('sales_receipts')
            .select('amount')
            .eq('invoice_id', invoiceId);

        if (excludeReceiptId) {
            query = query.neq('id', excludeReceiptId);
        }

        const { data, error } = await query;
        if (error) throw error;

        const totalPaid = (data || []).reduce((sum, r) => sum + Number(r.amount), 0);
        setPreviousReceipts(totalPaid);
        return totalPaid;
    };

    const handleSelectInvoice = async (invoice: Invoice) => {
        setSelectedInvoice(invoice);
        setIsOpen_dropdown(false);
        setSearchTerm('');

        // Fetch previous receipts for this invoice
        try {
            const totalPaid = await loadPreviousReceipts(invoice.id, record?.id);
            setAmount(invoice.total_amount - totalPaid);
        } catch {
            setPreviousReceipts(0);
            setAmount(invoice.total_amount);
        }
    };

    const filteredInvoices = invoices.filter(inv => {
        if (!searchTerm) return true;
        const term = searchTerm.toLowerCase();
        return inv.invoice_number.toLowerCase().includes(term) ||
            inv.customer_name.toLowerCase().includes(term);
    });

    const outstandingAmount = selectedInvoice
        ? selectedInvoice.total_amount - previousReceipts
        : 0;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!selectedInvoice) {
            toast.error('Please select an invoice');
            return;
        }
        if (!paymentMethod) {
            toast.error('Please select a payment method');
            return;
        }
        if (amount <= 0) {
            toast.error('Amount must be greater than zero');
            return;
        }
        if (amount > outstandingAmount) {
            toast.error(`Amount exceeds outstanding balance of ${formatCurrency(outstandingAmount)}`);
            return;
        }

        setLoading(true);
        try {
            const receiptPayload = {
                ...(record?.id ? { id: record.id } : {}),
                receipt_number: receiptNumber,
                invoice_id: selectedInvoice.id,
                invoice_number: selectedInvoice.invoice_number,
                customer_name: selectedInvoice.customer_name,
                date: receiptDate,
                payment_method: paymentMethod,
                payment_reference: paymentReference || null,
                amount,
                notes,
                status: 'Confirmed'
            };

            const { error } = await supabase.rpc('post_sales_receipt', {
                receipt_payload: receiptPayload,
            });
            if (error) throw error;

            toast.success(record?.id ? 'Receipt updated successfully' : 'Receipt recorded successfully');
            onSuccess?.();
            onClose();
        } catch (error: any) {
            toast.error('Error recording receipt: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={record?.id ? 'Edit Payment Receipt' : 'Record Payment Receipt'}
            subtitle={record?.id ? 'Update receipt details' : 'Record a payment received against a sales invoice'}
            width={640}
        >
            <form onSubmit={handleSubmit} className="rct-form">
                <div className="rct-grid">
                    {/* Receipt Number */}
                    <div className="rct-field">
                        <label>Receipt Number</label>
                        <div className="rct-input-wrap disabled">
                            <Hash size={15} className="rct-icon" />
                            <input value={receiptNumber} readOnly />
                        </div>
                    </div>

                    {/* Receipt Date */}
                    <div className="rct-field">
                        <label>Receipt Date</label>
                        <div className="rct-input-wrap">
                            <Calendar size={15} className="rct-icon" />
                            <input
                                type="date"
                                value={receiptDate}
                                onChange={(e) => setReceiptDate(e.target.value)}
                                required
                            />
                        </div>
                    </div>

                    {/* Invoice Dropdown */}
                    <div className="rct-field full-width" ref={dropdownRef} style={{ position: 'relative' }}>
                        <label>Invoice *</label>

                        {/* Trigger button */}
                        <div
                            className={`rct-select-trigger ${isOpen_dropdown ? 'open' : ''} ${!selectedInvoice && isOpen_dropdown === false ? '' : ''}`}
                            onClick={() => {
                                setIsOpen_dropdown(v => !v);
                                setTimeout(() => searchInputRef.current?.focus(), 50);
                            }}
                        >
                            {selectedInvoice ? (
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flex: 1 }}>
                                    <div>
                                        <span style={{ fontWeight: 700, fontSize: 12, color: 'var(--primary-600)' }}>
                                            {selectedInvoice.invoice_number}
                                        </span>
                                        <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--slate-500)' }}>
                                            {selectedInvoice.customer_name} · {formatCurrency(selectedInvoice.total_amount)}
                                        </span>
                                    </div>
                                    <button
                                        type="button"
                                        className="rct-clear-btn"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setSelectedInvoice(null);
                                            setPreviousReceipts(0);
                                            setAmount(0);
                                            setSearchTerm('');
                                        }}
                                    >
                                        <X size={13} />
                                    </button>
                                </div>
                            ) : (
                                <span style={{ color: 'var(--slate-400)', fontSize: 12 }}>Select an invoice...</span>
                            )}
                            <ChevronDown size={15} className={`rct-chevron ${isOpen_dropdown ? 'rotated' : ''}`} />
                        </div>

                        {/* Dropdown panel */}
                        {isOpen_dropdown && (
                            <div className="rct-dropdown-panel">
                                {/* Search inside dropdown */}
                                <div className="rct-dropdown-search">
                                    <Search size={13} style={{ color: 'var(--slate-400)', flexShrink: 0 }} />
                                    <input
                                        ref={searchInputRef}
                                        type="text"
                                        placeholder="Search invoice no. or customer..."
                                        value={searchTerm}
                                        onChange={e => setSearchTerm(e.target.value)}
                                        onClick={e => e.stopPropagation()}
                                    />
                                    {searchTerm && (
                                        <button type="button" onClick={() => setSearchTerm('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--slate-400)', display: 'flex', padding: 2 }}>
                                            <X size={12} />
                                        </button>
                                    )}
                                </div>

                                {/* Invoice list */}
                                <div className="rct-dropdown-list">
                                    {filteredInvoices.length === 0 ? (
                                        <div className="rct-no-results">No outstanding invoices found</div>
                                    ) : (
                                        filteredInvoices.map(inv => (
                                            <div
                                                key={inv.id}
                                                className={`rct-dropdown-item ${selectedInvoice?.id === inv.id ? 'selected' : ''}`}
                                                onClick={() => handleSelectInvoice(inv)}
                                            >
                                                <div style={{ flex: 1 }}>
                                                    <div style={{ fontWeight: 700, fontSize: 12, color: 'var(--primary-600)' }}>
                                                        {inv.invoice_number}
                                                    </div>
                                                    <div style={{ fontSize: 11, color: 'var(--slate-500)', marginTop: 2 }}>
                                                        {inv.customer_name}
                                                    </div>
                                                </div>
                                                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                                    <div style={{ fontWeight: 700, fontSize: 12 }}>{formatCurrency(inv.total_amount)}</div>
                                                    <div style={{ marginTop: 3 }}>
                                                        <StatusBadge status={inv.status} variant={inv.status === 'Overdue' ? 'danger' : 'warning'} />
                                                    </div>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>

                                {/* Count footer */}
                                {filteredInvoices.length > 0 && (
                                    <div className="rct-dropdown-footer">
                                        {filteredInvoices.length} invoice{filteredInvoices.length !== 1 ? 's' : ''} found
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Invoice Summary */}
                    {selectedInvoice && (
                        <div className="rct-summary full-width">
                            <div className="rct-summary-row">
                                <span>Customer</span>
                                <span className="rct-summary-val">{selectedInvoice.customer_name}</span>
                            </div>
                            <div className="rct-summary-row">
                                <span>Invoice Total</span>
                                <span className="rct-summary-val">{formatCurrency(selectedInvoice.total_amount)}</span>
                            </div>
                            <div className="rct-summary-row">
                                <span>Previously Paid</span>
                                <span className="rct-summary-val">{formatCurrency(previousReceipts)}</span>
                            </div>
                            <div className="rct-summary-row highlight">
                                <span>Outstanding Balance</span>
                                <span className="rct-summary-val">{formatCurrency(outstandingAmount)}</span>
                            </div>
                        </div>
                    )}

                    {/* Payment Method */}
                    <div className="rct-field">
                        <label>Payment Method *</label>
                        <div className="rct-input-wrap">
                            <CreditCard size={15} className="rct-icon" />
                            <select
                                value={paymentMethod}
                                onChange={(e) => setPaymentMethod(e.target.value)}
                                required
                            >
                                <option value="">Select method...</option>
                                <option value="Cash">Cash</option>
                                <option value="Bank Transfer">Bank Transfer</option>
                                <option value="Mobile Money">Mobile Money</option>
                                <option value="Cheque">Cheque</option>
                            </select>
                        </div>
                    </div>

                    {/* Amount */}
                    <div className="rct-field">
                        <label>Amount ({CURRENCY_SYMBOL}) *</label>
                        <div className="rct-input-wrap">
                            <Banknote size={15} className="rct-icon" />
                            <input
                                type="number"
                                value={amount}
                                onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                                min="0.01"
                                max={outstandingAmount || undefined}
                                step="0.01"
                                required
                            />
                        </div>
                    </div>

                    {/* Payment Reference */}
                    <div className="rct-field full-width">
                        <label>Payment Reference</label>
                        <div className="rct-input-wrap">
                            <FileText size={15} className="rct-icon" />
                            <input
                                type="text"
                                placeholder="Cheque number, transaction ID, etc."
                                value={paymentReference}
                                onChange={(e) => setPaymentReference(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Notes */}
                    <div className="rct-field full-width">
                        <label>Notes</label>
                        <div className="rct-input-wrap">
                            <textarea
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                placeholder="Additional notes..."
                                rows={2}
                            />
                        </div>
                    </div>
                </div>

                <div className="rct-actions">
                    <button type="button" onClick={onClose} className="rct-btn-secondary">Cancel</button>
                    <button type="submit" disabled={loading || !selectedInvoice} className="rct-btn-primary">
                        <Save size={16} />
                        {loading ? 'Saving...' : record?.id ? 'Update Receipt' : 'Record Receipt'}
                    </button>
                </div>
            </form>

            <style>{`
                .rct-form { padding: 4px; }
                .rct-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 16px;
                }
                .full-width { grid-column: span 2; }
                .rct-field { position: relative; }
                .rct-field label {
                    display: block;
                    font-size: 11px;
                    font-weight: 600;
                    color: var(--slate-600);
                    margin-bottom: 6px;
                }
                .rct-input-wrap { position: relative; }
                .rct-input-wrap .rct-icon {
                    position: absolute;
                    left: 12px;
                    top: 50%;
                    transform: translateY(-50%);
                    color: var(--slate-400);
                }
                .rct-input-wrap.disabled { opacity: 0.7; }
                .rct-input-wrap input, .rct-input-wrap select {
                    width: 100%;
                    padding: 10px 12px 10px 38px;
                    border: 1.5px solid var(--slate-200);
                    border-radius: 8px;
                    font-size: 11px;
                    outline: none;
                }
                .rct-input-wrap textarea {
                    width: 100%;
                    padding: 10px 12px;
                    border: 1.5px solid var(--slate-200);
                    border-radius: 8px;
                    font-size: 11px;
                    outline: none;
                    resize: vertical;
                }

                /* ── Invoice Select Trigger ── */
                .rct-select-trigger {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 8px;
                    padding: 10px 12px;
                    border: 1.5px solid var(--slate-200);
                    border-radius: 8px;
                    background: var(--card-bg);
                    cursor: pointer;
                    font-size: 12px;
                    min-height: 42px;
                    transition: border-color 0.15s, box-shadow 0.15s;
                    user-select: none;
                }
                .rct-select-trigger:hover {
                    border-color: var(--primary-300);
                }
                .rct-select-trigger.open {
                    border-color: var(--primary-500);
                    box-shadow: 0 0 0 3px rgba(59,130,246,0.12);
                }
                .rct-chevron {
                    color: var(--slate-400);
                    flex-shrink: 0;
                    transition: transform 0.2s ease;
                }
                .rct-chevron.rotated {
                    transform: rotate(180deg);
                }
                .rct-clear-btn {
                    background: none;
                    border: none;
                    cursor: pointer;
                    color: var(--slate-400);
                    display: flex;
                    align-items: center;
                    padding: 2px 4px;
                    border-radius: 4px;
                    margin-left: 6px;
                }
                .rct-clear-btn:hover { color: var(--danger); background: var(--danger-50); }

                /* ── Dropdown Panel ── */
                .rct-dropdown-panel {
                    position: absolute;
                    top: calc(100% + 4px);
                    left: 0;
                    right: 0;
                    background: var(--card-bg);
                    border: 1.5px solid var(--slate-200);
                    border-radius: 10px;
                    box-shadow: 0 12px 32px rgba(0,0,0,0.12);
                    z-index: 9999;
                    overflow: hidden;
                }
                .rct-dropdown-search {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding: 10px 14px;
                    border-bottom: 1.5px solid var(--slate-100);
                    background: var(--slate-50);
                }
                .rct-dropdown-search input {
                    flex: 1;
                    border: none;
                    background: none;
                    font-size: 12px;
                    outline: none;
                    color: var(--foreground);
                    padding: 0;
                }
                .rct-dropdown-list {
                    max-height: 260px;
                    overflow-y: auto;
                }
                .rct-dropdown-item {
                    padding: 10px 14px;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    transition: background 0.12s;
                    border-bottom: 1px solid var(--slate-50);
                }
                .rct-dropdown-item:last-child { border-bottom: none; }
                .rct-dropdown-item:hover {
                    background: rgba(59,130,246,0.04);
                }
                .rct-dropdown-item.selected {
                    background: rgba(59,130,246,0.07);
                }
                .rct-dropdown-footer {
                    padding: 8px 14px;
                    border-top: 1.5px solid var(--slate-100);
                    font-size: 10px;
                    color: var(--slate-400);
                    background: var(--slate-50);
                    text-align: right;
                }
                .rct-no-results {
                    padding: 20px;
                    text-align: center;
                    font-size: 11px;
                    color: var(--slate-400);
                }

                .rct-summary {
                    background: var(--slate-50);
                    border: 1.5px solid var(--slate-100);
                    border-radius: 10px;
                    padding: 14px 16px;
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                }
                .rct-summary-row {
                    display: flex;
                    justify-content: space-between;
                    font-size: 11px;
                    color: var(--slate-600);
                }
                .rct-summary-val {
                    font-weight: 600;
                    color: var(--slate-800);
                }
                .rct-summary-row.highlight {
                    padding-top: 8px;
                    border-top: 1.5px solid var(--slate-200);
                    font-weight: 700;
                    color: var(--primary-700);
                    font-size: 12px;
                }
                .rct-summary-row.highlight .rct-summary-val {
                    color: var(--primary-700);
                    font-weight: 800;
                }

                .rct-actions {
                    display: flex;
                    justify-content: flex-end;
                    gap: 12px;
                    margin-top: 24px;
                    padding-top: 16px;
                    border-top: 1.5px solid var(--slate-100);
                }
                .rct-btn-secondary {
                    padding: 8px 16px;
                    border-radius: 8px;
                    border: 1.5px solid var(--slate-200);
                    background: var(--card-bg);
                    font-size: 11px;
                    font-weight: 600;
                    cursor: pointer;
                }
                .rct-btn-primary {
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
                .rct-btn-primary:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }
            `}</style>
        </Modal>
    );
}
