'use client';

import React, { useState, useEffect, useRef } from 'react';
import Modal from './Modal';
import {
    Hash,
    Calendar,
    Banknote,
    Save,
    Search,
    FileText,
    User,
    AlertTriangle
} from 'lucide-react';
import StatusBadge from './StatusBadge';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { formatCurrency, CURRENCY_SYMBOL } from '@/lib/currency';
import { autoPostJournal } from '@/lib/autoPostJournal';

interface Invoice {
    id: string;
    invoice_number: string;
    customer_name: string;
    total_amount: number;
    status: string;
}

interface CreditNoteModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: () => void;
    record?: any;
    readOnly?: boolean;
}

export default function CreditNoteModal({ isOpen, onClose, onSuccess, record, readOnly }: CreditNoteModalProps) {
    const [loading, setLoading] = useState(false);
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [showDropdown, setShowDropdown] = useState(false);
    const searchRef = useRef<HTMLDivElement>(null);

    const [cnNumber, setCnNumber] = useState('');
    const [customerName, setCustomerName] = useState('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [reason, setReason] = useState('');
    const [amount, setAmount] = useState<number>(0);
    const [maxAmount, setMaxAmount] = useState<number>(0);
    const [notes, setNotes] = useState('');
    const [status, setStatus] = useState('Draft');

    const reasons = [
        'Product Return',
        'Price Adjustment',
        'Damaged Goods',
        'Short Delivery',
        'Other'
    ];

    useEffect(() => {
        if (isOpen) {
            fetchInvoices();
            if (record) {
                populateFromRecord(record);
            } else {
                generateCnNumber();
                resetForm();
            }
        }
    }, [isOpen, record]);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
                setShowDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const resetForm = () => {
        setSelectedInvoice(null);
        setSearchTerm('');
        setCustomerName('');
        setDate(new Date().toISOString().split('T')[0]);
        setReason('');
        setAmount(0);
        setMaxAmount(0);
        setNotes('');
        setStatus('Draft');
    };

    const populateFromRecord = (rec: any) => {
        setCnNumber(rec.cn_number || '');
        setCustomerName(rec.customer_name || '');
        setDate(rec.date || new Date().toISOString().split('T')[0]);
        setReason(rec.reason || '');
        setAmount(Number(rec.amount) || 0);
        setNotes(rec.notes || '');
        setStatus(rec.status || 'Draft');
        if (rec.invoice_id && rec.invoice) {
            const inv = {
                id: rec.invoice_id,
                invoice_number: rec.invoice?.invoice_number || '',
                customer_name: rec.customer_name || '',
                total_amount: rec.invoice?.total_amount || 0,
                status: rec.invoice?.status || ''
            };
            setSelectedInvoice(inv);
            setSearchTerm(inv.invoice_number);
            setMaxAmount(inv.total_amount);
        } else {
            setSelectedInvoice(null);
            setSearchTerm('');
            setMaxAmount(0);
        }
    };

    const fetchInvoices = async () => {
        try {
            const { data, error } = await supabase
                .from('sales_invoices')
                .select('id, invoice_number, customer_name, total_amount, status')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setInvoices(data || []);
        } catch (error: any) {
            toast.error('Failed to load invoices: ' + error.message);
        }
    };

    const generateCnNumber = () => {
        const now = new Date();
        const yy = now.getFullYear().toString().slice(-2);
        const mm = (now.getMonth() + 1).toString().padStart(2, '0');
        const random = Math.floor(1000 + Math.random() * 9000);
        setCnNumber(`CN-${yy}${mm}-${random}`);
    };

    const handleSelectInvoice = (invoice: Invoice) => {
        setSelectedInvoice(invoice);
        setSearchTerm(invoice.invoice_number);
        setCustomerName(invoice.customer_name);
        setMaxAmount(invoice.total_amount);
        setShowDropdown(false);
    };

    const filteredInvoices = invoices.filter(inv => {
        if (!searchTerm) return true;
        const term = searchTerm.toLowerCase();
        return inv.invoice_number.toLowerCase().includes(term) ||
            inv.customer_name.toLowerCase().includes(term);
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!customerName.trim()) {
            toast.error('Customer name is required');
            return;
        }
        if (!reason) {
            toast.error('Please select a reason');
            return;
        }
        if (amount <= 0) {
            toast.error('Amount must be greater than zero');
            return;
        }
        if (maxAmount > 0 && amount > maxAmount) {
            toast.error(`Amount cannot exceed invoice total of ${formatCurrency(maxAmount)}`);
            return;
        }

        setLoading(true);
        try {
            const payload = {
                cn_number: cnNumber,
                invoice_id: selectedInvoice?.id || null,
                customer_name: customerName.trim(),
                date,
                reason,
                amount,
                notes: notes.trim() || null,
                status
            };

            if (record) {
                const { error } = await supabase
                    .from('credit_notes')
                    .update(payload)
                    .eq('id', record.id);
                if (error) throw error;
                toast.success('Credit note updated successfully');

                // Auto-post GL when status transitions to Approved or Applied
                const wasUnposted = record.status === 'Draft';
                const isNowPosted = status === 'Approved' || status === 'Applied';
                if (wasUnposted && isNowPosted) {
                    await autoPostJournal({
                        event: 'CREDIT_NOTE_ISSUED',
                        amount,
                        date,
                        description: `Credit Note ${cnNumber} — ${customerName.trim()} (${reason})`,
                        refNumber: cnNumber,
                    });
                }
            } else {
                const { error } = await supabase
                    .from('credit_notes')
                    .insert([payload]);
                if (error) throw error;
                toast.success('Credit note created successfully');
            }

            onSuccess?.();
            onClose();
        } catch (error: any) {
            toast.error('Error saving credit note: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={readOnly ? 'View Credit Note' : record ? 'Edit Credit Note' : 'New Credit Note'}
            subtitle={record ? `Credit Note ${record.cn_number}` : 'Issue a credit note against a sales invoice'}
            width={640}
        >
            <form onSubmit={handleSubmit} className="cn-form">
                <div className="cn-grid">
                    {/* CN Number */}
                    <div className="cn-field">
                        <label>CN Number</label>
                        <div className="cn-input-wrap disabled">
                            <Hash size={15} className="cn-icon" />
                            <input value={cnNumber} readOnly />
                        </div>
                    </div>

                    {/* Date */}
                    <div className="cn-field">
                        <label>Date *</label>
                        <div className="cn-input-wrap">
                            <Calendar size={15} className="cn-icon" />
                            <input
                                type="date"
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                                required
                                readOnly={readOnly}
                            />
                        </div>
                    </div>

                    {/* Invoice Search */}
                    <div className="cn-field full-width" ref={searchRef}>
                        <label>Invoice Reference</label>
                        <div className="cn-input-wrap">
                            <Search size={15} className="cn-icon" />
                            <input
                                type="text"
                                placeholder="Search by invoice number or customer..."
                                value={searchTerm}
                                onChange={(e) => {
                                    if (readOnly) return;
                                    setSearchTerm(e.target.value);
                                    setShowDropdown(true);
                                    if (!e.target.value) {
                                        setSelectedInvoice(null);
                                        setMaxAmount(0);
                                    }
                                }}
                                onFocus={() => !readOnly && setShowDropdown(true)}
                                readOnly={readOnly}
                            />
                        </div>
                        {showDropdown && (
                            <div className="cn-dropdown">
                                {filteredInvoices.length > 0 ? (
                                    filteredInvoices.slice(0, 8).map(inv => (
                                        <div
                                            key={inv.id}
                                            className="cn-dropdown-item"
                                            onClick={() => handleSelectInvoice(inv)}
                                        >
                                            <div>
                                                <div style={{ fontWeight: 600, fontSize: 12 }}>{inv.invoice_number}</div>
                                                <div style={{ fontSize: 10, color: 'var(--slate-500)' }}>
                                                    {inv.customer_name} &middot; {formatCurrency(inv.total_amount)}
                                                </div>
                                            </div>
                                            <StatusBadge status={inv.status} variant={inv.status === 'Paid' ? 'success' : inv.status === 'Overdue' ? 'danger' : 'warning'} />
                                        </div>
                                    ))
                                ) : (
                                    <div className="cn-no-results">No invoices found</div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Selected Invoice Summary */}
                    {selectedInvoice && (
                        <div className="cn-summary full-width">
                            <div className="cn-summary-row">
                                <span>Invoice</span>
                                <span className="cn-summary-val">{selectedInvoice.invoice_number}</span>
                            </div>
                            <div className="cn-summary-row">
                                <span>Customer</span>
                                <span className="cn-summary-val">{selectedInvoice.customer_name}</span>
                            </div>
                            <div className="cn-summary-row highlight">
                                <span>Invoice Total (Max Credit)</span>
                                <span className="cn-summary-val">{formatCurrency(selectedInvoice.total_amount)}</span>
                            </div>
                        </div>
                    )}

                    {/* Customer Name */}
                    <div className="cn-field full-width">
                        <label>Customer Name *</label>
                        <div className="cn-input-wrap">
                            <User size={15} className="cn-icon" />
                            <input
                                type="text"
                                placeholder="Customer name"
                                value={customerName}
                                onChange={(e) => setCustomerName(e.target.value)}
                                required
                                readOnly={readOnly}
                            />
                        </div>
                    </div>

                    {/* Reason */}
                    <div className="cn-field">
                        <label>Reason *</label>
                        <div className="cn-input-wrap">
                            <AlertTriangle size={15} className="cn-icon" />
                            <select
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
                                required
                                disabled={readOnly}
                            >
                                <option value="">Select reason...</option>
                                {reasons.map(r => (
                                    <option key={r} value={r}>{r}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Amount */}
                    <div className="cn-field">
                        <label>Amount ({CURRENCY_SYMBOL}) *</label>
                        <div className="cn-input-wrap">
                            <Banknote size={15} className="cn-icon" />
                            <input
                                type="number"
                                value={amount}
                                onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                                min="0.01"
                                max={maxAmount > 0 ? maxAmount : undefined}
                                step="0.01"
                                required
                                readOnly={readOnly}
                            />
                        </div>
                        {maxAmount > 0 && (
                            <span className="cn-hint">Max: {formatCurrency(maxAmount)}</span>
                        )}
                    </div>

                    {/* Status (only for editing or viewing) */}
                    {record && (
                        <div className="cn-field full-width">
                            <label>Status</label>
                            <div className="cn-input-wrap">
                                <FileText size={15} className="cn-icon" />
                                <select
                                    value={status}
                                    onChange={(e) => setStatus(e.target.value)}
                                    disabled={readOnly}
                                >
                                    <option value="Draft">Draft</option>
                                    <option value="Approved">Approved</option>
                                    <option value="Applied">Applied</option>
                                </select>
                            </div>
                        </div>
                    )}

                    {/* Notes */}
                    <div className="cn-field full-width">
                        <label>Notes</label>
                        <div className="cn-input-wrap">
                            <textarea
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                placeholder="Additional notes or details..."
                                rows={2}
                                readOnly={readOnly}
                            />
                        </div>
                    </div>
                </div>

                <div className="cn-actions">
                    <button type="button" onClick={onClose} className="cn-btn-secondary">{readOnly ? 'Close' : 'Cancel'}</button>
                    {!readOnly && (
                        <button type="submit" disabled={loading} className="cn-btn-primary">
                            <Save size={16} />
                            {loading ? 'Saving...' : record ? 'Update Credit Note' : 'Create Credit Note'}
                        </button>
                    )}
                </div>
            </form>

            <style>{`
                .cn-form { padding: 4px; }
                .cn-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 16px;
                }
                .full-width { grid-column: span 2; }
                .cn-field { position: relative; }
                .cn-field label {
                    display: block;
                    font-size: 11px;
                    font-weight: 600;
                    color: var(--slate-600);
                    margin-bottom: 6px;
                }
                .cn-input-wrap { position: relative; }
                .cn-input-wrap .cn-icon {
                    position: absolute;
                    left: 12px;
                    top: 50%;
                    transform: translateY(-50%);
                    color: var(--slate-400);
                }
                .cn-input-wrap.disabled { opacity: 0.7; }
                .cn-input-wrap input, .cn-input-wrap select {
                    width: 100%;
                    padding: 10px 12px 10px 38px;
                    border: 1.5px solid var(--slate-200);
                    border-radius: 8px;
                    font-size: 11px;
                    outline: none;
                }
                .cn-input-wrap input:focus, .cn-input-wrap select:focus {
                    border-color: var(--primary-400);
                    box-shadow: 0 0 0 3px rgba(var(--primary-500-rgb, 99, 102, 241), 0.1);
                }
                .cn-input-wrap textarea {
                    width: 100%;
                    padding: 10px 12px;
                    border: 1.5px solid var(--slate-200);
                    border-radius: 8px;
                    font-size: 11px;
                    outline: none;
                    resize: vertical;
                }
                .cn-input-wrap textarea:focus {
                    border-color: var(--primary-400);
                }
                .cn-hint {
                    display: block;
                    font-size: 10px;
                    color: var(--slate-400);
                    margin-top: 4px;
                }

                .cn-dropdown {
                    position: absolute;
                    top: 100%;
                    left: 0;
                    right: 0;
                    background: var(--card-bg);
                    border: 1.5px solid var(--slate-200);
                    border-radius: 8px;
                    box-shadow: 0 8px 24px rgba(0,0,0,0.1);
                    z-index: 50;
                    max-height: 240px;
                    overflow-y: auto;
                    margin-top: 4px;
                }
                .cn-dropdown-item {
                    padding: 10px 14px;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    transition: background 0.15s;
                }
                .cn-dropdown-item:hover {
                    background: var(--slate-50);
                }
                .cn-dropdown-item:not(:last-child) {
                    border-bottom: 1px solid var(--slate-50);
                }
                .cn-no-results {
                    padding: 16px;
                    text-align: center;
                    font-size: 11px;
                    color: var(--slate-400);
                }

                .cn-summary {
                    background: var(--slate-50);
                    border: 1.5px solid var(--slate-100);
                    border-radius: 10px;
                    padding: 14px 16px;
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                }
                .cn-summary-row {
                    display: flex;
                    justify-content: space-between;
                    font-size: 11px;
                    color: var(--slate-600);
                }
                .cn-summary-val {
                    font-weight: 600;
                    color: var(--slate-800);
                }
                .cn-summary-row.highlight {
                    padding-top: 8px;
                    border-top: 1.5px solid var(--slate-200);
                    font-weight: 700;
                    color: var(--danger);
                    font-size: 12px;
                }
                .cn-summary-row.highlight .cn-summary-val {
                    color: var(--danger);
                    font-weight: 800;
                }

                .cn-actions {
                    display: flex;
                    justify-content: flex-end;
                    gap: 12px;
                    margin-top: 24px;
                    padding-top: 16px;
                    border-top: 1.5px solid var(--slate-100);
                }
                .cn-btn-secondary {
                    padding: 8px 16px;
                    border-radius: 8px;
                    border: 1.5px solid var(--slate-200);
                    background: var(--card-bg);
                    font-size: 11px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.15s;
                }
                .cn-btn-secondary:hover {
                    background: var(--slate-50);
                    border-color: var(--slate-300);
                }
                .cn-btn-primary {
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
                    transition: all 0.15s;
                }
                .cn-btn-primary:hover {
                    background: var(--primary-700);
                }
                .cn-btn-primary:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }
            `}</style>
        </Modal>
    );
}
