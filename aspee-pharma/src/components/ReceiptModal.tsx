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
    User
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
    date: string;
}

interface ReceiptModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: () => void;
}

export default function ReceiptModal({ isOpen, onClose, onSuccess }: ReceiptModalProps) {
    const [loading, setLoading] = useState(false);
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
    const [previousReceipts, setPreviousReceipts] = useState<number>(0);
    const [searchTerm, setSearchTerm] = useState('');
    const [showDropdown, setShowDropdown] = useState(false);
    const searchRef = useRef<HTMLDivElement>(null);

    const [receiptNumber, setReceiptNumber] = useState('');
    const [receiptDate, setReceiptDate] = useState(new Date().toISOString().split('T')[0]);
    const [paymentMethod, setPaymentMethod] = useState('');
    const [paymentReference, setPaymentReference] = useState('');
    const [amount, setAmount] = useState<number>(0);
    const [notes, setNotes] = useState('');

    useEffect(() => {
        if (isOpen) {
            fetchInvoices();
            generateReceiptNumber();
            resetForm();
        }
    }, [isOpen]);

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
        setPreviousReceipts(0);
        setSearchTerm('');
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
                .in('status', ['Issued', 'Partially Paid', 'Overdue'])
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

    const handleSelectInvoice = async (invoice: Invoice) => {
        setSelectedInvoice(invoice);
        setSearchTerm(invoice.invoice_number);
        setShowDropdown(false);

        // Fetch previous receipts for this invoice
        try {
            const { data, error } = await supabase
                .from('sales_receipts')
                .select('amount')
                .eq('invoice_id', invoice.id);

            if (error) throw error;

            const totalPaid = (data || []).reduce((sum, r) => sum + Number(r.amount), 0);
            setPreviousReceipts(totalPaid);
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
            // 1. Create the receipt
            const { error: receiptError } = await supabase
                .from('sales_receipts')
                .insert([{
                    receipt_number: receiptNumber,
                    invoice_id: selectedInvoice.id,
                    customer_name: selectedInvoice.customer_name,
                    date: receiptDate,
                    payment_method: paymentMethod,
                    payment_reference: paymentReference || null,
                    amount,
                    notes,
                    status: 'Confirmed'
                }]);

            if (receiptError) throw receiptError;

            // 2. Update the invoice status
            const newTotalPaid = previousReceipts + amount;
            const newStatus = newTotalPaid >= selectedInvoice.total_amount
                ? 'Paid'
                : 'Partially Paid';

            const { error: invoiceError } = await supabase
                .from('sales_invoices')
                .update({ status: newStatus })
                .eq('id', selectedInvoice.id);

            if (invoiceError) throw invoiceError;

            // Auto-post GL entry: DR Cash at Bank / CR Accounts Receivable
            await autoPostJournal({
                event: 'RECEIPT_RECEIVED',
                amount,
                date: receiptDate,
                description: `Payment from ${selectedInvoice.customer_name} — Inv ${selectedInvoice.invoice_number}`,
                refNumber: receiptNumber,
                paymentMethod,
            });

            toast.success('Receipt recorded successfully');
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
            title="Record Payment Receipt"
            subtitle="Record a payment received against a sales invoice"
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

                    {/* Invoice Search */}
                    <div className="rct-field full-width" ref={searchRef}>
                        <label>Invoice *</label>
                        <div className="rct-input-wrap">
                            <Search size={15} className="rct-icon" />
                            <input
                                type="text"
                                placeholder="Search by invoice number or customer..."
                                value={searchTerm}
                                onChange={(e) => {
                                    setSearchTerm(e.target.value);
                                    setShowDropdown(true);
                                    if (!e.target.value) {
                                        setSelectedInvoice(null);
                                        setPreviousReceipts(0);
                                        setAmount(0);
                                    }
                                }}
                                onFocus={() => setShowDropdown(true)}
                            />
                        </div>
                        {showDropdown && (
                            <div className="rct-dropdown">
                                {filteredInvoices.length > 0 ? (
                                    filteredInvoices.slice(0, 8).map(inv => (
                                        <div
                                            key={inv.id}
                                            className="rct-dropdown-item"
                                            onClick={() => handleSelectInvoice(inv)}
                                        >
                                            <div>
                                                <div style={{ fontWeight: 600, fontSize: 12 }}>{inv.invoice_number}</div>
                                                <div style={{ fontSize: 10, color: 'var(--slate-500)' }}>
                                                    {inv.customer_name} &middot; {formatCurrency(inv.total_amount)}
                                                </div>
                                            </div>
                                            <StatusBadge status={inv.status} variant={inv.status === 'Overdue' ? 'danger' : 'warning'} />
                                        </div>
                                    ))
                                ) : (
                                    <div className="rct-no-results">No outstanding invoices found</div>
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
                        {loading ? 'Recording...' : 'Record Receipt'}
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

                .rct-dropdown {
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
                .rct-dropdown-item {
                    padding: 10px 14px;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    transition: background 0.15s;
                }
                .rct-dropdown-item:hover {
                    background: var(--slate-50);
                }
                .rct-dropdown-item:not(:last-child) {
                    border-bottom: 1px solid var(--slate-50);
                }
                .rct-no-results {
                    padding: 16px;
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
