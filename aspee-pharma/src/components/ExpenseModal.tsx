'use client';

import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import {
    Hash,
    Calendar,
    Tag,
    FileText,
    User,
    Banknote,
    CreditCard,
    Receipt,
    ShieldCheck,
    StickyNote,
    Save
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { CURRENCY_SYMBOL } from '@/lib/currency';
import { notifyExpensePending } from '@/lib/notifications';
import { autoPostJournal } from '@/lib/autoPostJournal';
import { UNIT_OPTIONS, GROUPED_UNIT_OPTIONS, EXPENSE_CATEGORIES } from '@/lib/constants';
import UnitConversionHint from './UnitConversionHint';

const PAYMENT_METHODS = ['Cash', 'Bank Transfer', 'Mobile Money', 'Cheque'];
const STATUSES = ['Pending', 'Approved', 'Rejected'];

interface ExpenseModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: () => void;
    record?: any;
}

export default function ExpenseModal({ isOpen, onClose, onSuccess, record }: ExpenseModalProps) {
    const [loading, setLoading] = useState(false);

    const [expenseNumber, setExpenseNumber] = useState('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [category, setCategory] = useState('');
    const [description, setDescription] = useState('');
    const [payee, setPayee] = useState('');
    const [amount, setAmount] = useState<number>(0);
    const [paymentMethod, setPaymentMethod] = useState('');
    const [receiptReference, setReceiptReference] = useState('');
    const [status, setStatus] = useState('Pending');
    const [approvedBy, setApprovedBy] = useState('');
    const [notes, setNotes] = useState('');

    const isEditMode = !!record;

    useEffect(() => {
        if (isOpen) {
            if (record) {
                populateForm(record);
            } else {
                resetForm();
                generateExpenseNumber();
            }
        }
    }, [isOpen, record]);

    const generateExpenseNumber = () => {
        const now = new Date();
        const yy = now.getFullYear().toString().slice(-2);
        const mm = (now.getMonth() + 1).toString().padStart(2, '0');
        const rand = Math.floor(1000 + Math.random() * 9000);
        setExpenseNumber(`EXP-${yy}${mm}-${rand}`);
    };

    const resetForm = () => {
        setDate(new Date().toISOString().split('T')[0]);
        setCategory('');
        setDescription('');
        setPayee('');
        setAmount(0);
        setPaymentMethod('');
        setReceiptReference('');
        setStatus('Pending');
        setApprovedBy('');
        setNotes('');
    };

    const populateForm = (r: any) => {
        setExpenseNumber(r.expense_number || '');
        setDate(r.date || new Date().toISOString().split('T')[0]);
        setCategory(r.category || '');
        setDescription(r.description || '');
        setPayee(r.payee || '');
        setAmount(r.amount || 0);
        setPaymentMethod(r.payment_method || '');
        setReceiptReference(r.receipt_reference || '');
        setStatus(r.status || 'Pending');
        setApprovedBy(r.approved_by || '');
        setNotes(r.notes || '');
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!category) {
            toast.error('Please select a category');
            return;
        }
        if (!description.trim()) {
            toast.error('Please enter a description');
            return;
        }
        if (amount <= 0) {
            toast.error('Amount must be greater than zero');
            return;
        }
        if (!paymentMethod) {
            toast.error('Please select a payment method');
            return;
        }

        setLoading(true);
        try {
            const payload = {
                expense_number: expenseNumber,
                date,
                category,
                description: description.trim(),
                payee: payee.trim() || null,
                amount,
                payment_method: paymentMethod,
                receipt_reference: receiptReference.trim() || null,
                status,
                approved_by: approvedBy.trim() || null,
                notes: notes.trim() || null,
            };

            if (isEditMode) {
                const { error } = await supabase
                    .from('expenses')
                    .update(payload)
                    .eq('id', record.id);
                if (error) throw error;
                toast.success('Expense updated successfully');

                // Auto-post GL when status transitions to Approved on an edit
                const wasNotApproved = record.status !== 'Approved';
                const isNowApproved = status === 'Approved';
                if (wasNotApproved && isNowApproved) {
                    await autoPostJournal({
                        event: 'EXPENSE_APPROVED',
                        amount,
                        date,
                        description: `${category} — ${description.trim()}${payee ? ` (${payee.trim()})` : ''}`,
                        refNumber: expenseNumber,
                        paymentMethod,
                        expenseCategory: category,
                    });
                }
            } else {
                const { error } = await supabase
                    .from('expenses')
                    .insert([payload]);
                if (error) throw error;
                toast.success('Expense recorded successfully');

                // Auto-post GL when a new expense is created as Approved
                if (status === 'Approved') {
                    await autoPostJournal({
                        event: 'EXPENSE_APPROVED',
                        amount,
                        date,
                        description: `${category} — ${description.trim()}${payee ? ` (${payee.trim()})` : ''}`,
                        refNumber: expenseNumber,
                        paymentMethod,
                        expenseCategory: category,
                    });
                }

                // Notify Finance of pending expense
                if (status === 'Pending') {
                    notifyExpensePending(expenseNumber, amount, category);
                }
            }

            onSuccess?.();
            onClose();
        } catch (error: any) {
            toast.error('Error saving expense: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={isEditMode ? 'Edit Expense' : 'Record Expense'}
            subtitle={isEditMode ? 'Update expense record details' : 'Add a new business expense entry'}
            width={660}
        >
            <form onSubmit={handleSubmit} className="exp-form">
                <div className="exp-grid">
                    {/* Expense Number */}
                    <div className="exp-field">
                        <label>Expense Number</label>
                        <div className="exp-input-wrap disabled">
                            <Hash size={15} className="exp-icon" />
                            <input value={expenseNumber} readOnly />
                        </div>
                    </div>

                    {/* Date */}
                    <div className="exp-field">
                        <label>Date *</label>
                        <div className="exp-input-wrap">
                            <Calendar size={15} className="exp-icon" />
                            <input
                                type="date"
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                                required
                            />
                        </div>
                    </div>

                    {/* Category */}
                    <div className="exp-field">
                        <label>Category *</label>
                        <div className="exp-input-wrap">
                            <Tag size={15} className="exp-icon" />
                            <select
                                value={category}
                                onChange={(e) => setCategory(e.target.value)}
                                required
                            >
                                <option value="">Select category...</option>
                                {EXPENSE_CATEGORIES.map(group => (
                                    <optgroup key={group.label} label={group.label}>
                                        {group.categories.map(c => (
                                            <option key={c} value={c}>{c}</option>
                                        ))}
                                    </optgroup>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Payee */}
                    <div className="exp-field">
                        <label>Payee</label>
                        <div className="exp-input-wrap">
                            <User size={15} className="exp-icon" />
                            <input
                                type="text"
                                placeholder="Who was paid..."
                                value={payee}
                                onChange={(e) => setPayee(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Description */}
                    <div className="exp-field full-width">
                        <label>Description *</label>
                        <div className="exp-input-wrap">
                            <FileText size={15} className="exp-icon" />
                            <input
                                type="text"
                                placeholder="What was the expense for..."
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                required
                            />
                        </div>
                    </div>

                    {/* Amount */}
                    <div className="exp-field">
                        <label>Amount ({CURRENCY_SYMBOL}) *</label>
                        <div className="exp-input-wrap">
                            <Banknote size={15} className="exp-icon" />
                            <input
                                type="number"
                                value={amount || ''}
                                onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                                min="0.01"
                                step="0.01"
                                placeholder="0.00"
                                required
                            />
                        </div>
                    </div>

                    {/* Payment Method */}
                    <div className="exp-field">
                        <label>Payment Method *</label>
                        <div className="exp-input-wrap">
                            <CreditCard size={15} className="exp-icon" />
                            <select
                                value={paymentMethod}
                                onChange={(e) => setPaymentMethod(e.target.value)}
                                required
                            >
                                <option value="">Select method...</option>
                                {PAYMENT_METHODS.map(m => (
                                    <option key={m} value={m}>{m}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Receipt Reference */}
                    <div className="exp-field">
                        <label>Receipt Reference</label>
                        <div className="exp-input-wrap">
                            <Receipt size={15} className="exp-icon" />
                            <input
                                type="text"
                                placeholder="Receipt or reference number..."
                                value={receiptReference}
                                onChange={(e) => setReceiptReference(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Status */}
                    <div className="exp-field">
                        <label>Status</label>
                        <div className="exp-input-wrap">
                            <ShieldCheck size={15} className="exp-icon" />
                            <select
                                value={status}
                                onChange={(e) => setStatus(e.target.value)}
                            >
                                {STATUSES.map(s => (
                                    <option key={s} value={s}>{s}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Notes */}
                    <div className="exp-field full-width">
                        <label>Notes</label>
                        <div className="exp-input-wrap">
                            <textarea
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                placeholder="Additional notes..."
                                rows={2}
                            />
                        </div>
                    </div>
                </div>

                <div className="exp-actions">
                    <button type="button" onClick={onClose} className="exp-btn-secondary">Cancel</button>
                    <button type="submit" disabled={loading} className="exp-btn-primary">
                        <Save size={16} />
                        {loading ? 'Saving...' : isEditMode ? 'Update Expense' : 'Record Expense'}
                    </button>
                </div>
            </form>

            <style>{`
                .exp-form { padding: 4px; }
                .exp-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 16px;
                }
                .full-width { grid-column: span 2; }
                .exp-field { position: relative; }
                .exp-field label {
                    display: block;
                    font-size: 11px;
                    font-weight: 600;
                    color: var(--slate-600);
                    margin-bottom: 6px;
                }
                .exp-input-wrap { position: relative; }
                .exp-input-wrap .exp-icon {
                    position: absolute;
                    left: 12px;
                    top: 50%;
                    transform: translateY(-50%);
                    color: var(--slate-400);
                }
                .exp-input-wrap.disabled { opacity: 0.7; }
                .exp-input-wrap input, .exp-input-wrap select {
                    width: 100%;
                    padding: 10px 12px 10px 38px;
                    border: 1.5px solid var(--slate-200);
                    border-radius: 8px;
                    font-size: 11px;
                    outline: none;
                    transition: border-color 0.2s, box-shadow 0.2s;
                }
                .exp-input-wrap input:focus, .exp-input-wrap select:focus {
                    border-color: var(--primary-500);
                    box-shadow: 0 0 0 3px var(--primary-50);
                }
                .exp-input-wrap textarea {
                    width: 100%;
                    padding: 10px 12px;
                    border: 1.5px solid var(--slate-200);
                    border-radius: 8px;
                    font-size: 11px;
                    outline: none;
                    resize: vertical;
                    transition: border-color 0.2s, box-shadow 0.2s;
                }
                .exp-input-wrap textarea:focus {
                    border-color: var(--primary-500);
                    box-shadow: 0 0 0 3px var(--primary-50);
                }
                .exp-actions {
                    display: flex;
                    justify-content: flex-end;
                    gap: 12px;
                    margin-top: 24px;
                    padding-top: 16px;
                    border-top: 1.5px solid var(--slate-100);
                }
                .exp-btn-secondary {
                    padding: 10px 20px;
                    border-radius: 8px;
                    border: 1.5px solid var(--slate-200);
                    background: var(--card-bg);
                    color: var(--slate-600);
                    font-size: 11px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.15s;
                }
                .exp-btn-secondary:hover {
                    background: var(--slate-50);
                    border-color: var(--slate-300);
                }
                .exp-btn-primary {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding: 10px 24px;
                    border-radius: 8px;
                    border: none;
                    background: linear-gradient(135deg, var(--primary-600), var(--primary-500));
                    color: white;
                    font-size: 11px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.15s;
                }
                .exp-btn-primary:hover {
                    box-shadow: 0 4px 12px rgba(var(--primary-600-rgb, 0, 0, 0), 0.3);
                }
                .exp-btn-primary:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }
            `}</style>
        </Modal>
    );
}
