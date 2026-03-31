'use client';

import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import {
    Hash,
    Calendar,
    Banknote,
    Save,
    FileText,
    User,
    Tag,
    ArrowDownCircle,
    ArrowUpCircle,
    CheckSquare,
    StickyNote,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { CURRENCY_SYMBOL } from '@/lib/currency';

const CATEGORIES = ['Transport', 'Office Supplies', 'Cleaning', 'Refreshments', 'Postage', 'Miscellaneous'];
const STATUSES = ['Pending', 'Approved', 'Rejected'];
const TYPES = ['Disbursement', 'Replenishment'];

interface PettyCashModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    record?: any;
}

export default function PettyCashModal({ isOpen, onClose, onSuccess, record }: PettyCashModalProps) {
    const [loading, setLoading] = useState(false);

    const [voucherNumber, setVoucherNumber] = useState('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [type, setType] = useState('Disbursement');
    const [description, setDescription] = useState('');
    const [amount, setAmount] = useState<number>(0);
    const [category, setCategory] = useState('');
    const [custodian, setCustodian] = useState('');
    const [approvedBy, setApprovedBy] = useState('');
    const [receiptAttached, setReceiptAttached] = useState(false);
    const [status, setStatus] = useState('Pending');
    const [notes, setNotes] = useState('');

    const isEdit = !!record;

    useEffect(() => {
        if (isOpen) {
            if (record) {
                setVoucherNumber(record.voucher_number || '');
                setDate(record.date || new Date().toISOString().split('T')[0]);
                setType(record.type || 'Disbursement');
                setDescription(record.description || '');
                setAmount(Number(record.amount) || 0);
                setCategory(record.category || '');
                setCustodian(record.custodian || '');
                setApprovedBy(record.approved_by || '');
                setReceiptAttached(record.receipt_attached || false);
                setStatus(record.status || 'Pending');
                setNotes(record.notes || '');
            } else {
                resetForm();
                generateVoucherNumber();
            }
        }
    }, [isOpen, record]);

    const resetForm = () => {
        setDate(new Date().toISOString().split('T')[0]);
        setType('Disbursement');
        setDescription('');
        setAmount(0);
        setCategory('');
        setCustodian('');
        setApprovedBy('');
        setReceiptAttached(false);
        setStatus('Pending');
        setNotes('');
    };

    const generateVoucherNumber = () => {
        const now = new Date();
        const year = now.getFullYear().toString().slice(-2);
        const month = (now.getMonth() + 1).toString().padStart(2, '0');
        const random = Math.floor(1000 + Math.random() * 9000);
        setVoucherNumber(`PCV-${year}${month}-${random}`);
    };

    const calculateBalanceAfter = async (newAmount: number, newType: string): Promise<number> => {
        try {
            const { data, error } = await supabase
                .from('petty_cash')
                .select('amount, type');

            if (error) throw error;

            let balance = 0;
            (data || []).forEach((entry: any) => {
                if (record && entry.id === record.id) return; // exclude current record in edit mode
                if (entry.type === 'Replenishment') {
                    balance += Number(entry.amount);
                } else {
                    balance -= Number(entry.amount);
                }
            });

            // Apply the new entry
            if (newType === 'Replenishment') {
                balance += newAmount;
            } else {
                balance -= newAmount;
            }

            return balance;
        } catch {
            return 0;
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!description.trim()) {
            toast.error('Please enter a description');
            return;
        }
        if (amount <= 0) {
            toast.error('Amount must be greater than zero');
            return;
        }
        if (type === 'Disbursement' && !category) {
            toast.error('Please select a category');
            return;
        }
        if (!custodian.trim()) {
            toast.error('Please enter a custodian');
            return;
        }

        setLoading(true);
        try {
            const balanceAfter = await calculateBalanceAfter(amount, type);

            const payload = {
                voucher_number: voucherNumber,
                date,
                type,
                description: description.trim(),
                amount,
                category: type === 'Disbursement' ? category : null,
                custodian: custodian.trim(),
                approved_by: approvedBy.trim() || null,
                receipt_attached: receiptAttached,
                balance_after: balanceAfter,
                status,
                notes: notes.trim() || null,
            };

            if (isEdit) {
                const { error } = await supabase
                    .from('petty_cash')
                    .update(payload)
                    .eq('id', record.id);

                if (error) throw error;
                toast.success('Voucher updated successfully');
            } else {
                const { error } = await supabase
                    .from('petty_cash')
                    .insert([payload]);

                if (error) throw error;
                toast.success('Voucher created successfully');
            }

            onSuccess();
            onClose();
        } catch (error: any) {
            toast.error('Error saving voucher: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={isEdit ? 'Edit Petty Cash Voucher' : 'New Petty Cash Voucher'}
            subtitle={isEdit ? `Editing ${voucherNumber}` : 'Record a new petty cash disbursement or replenishment'}
            width={640}
        >
            <form onSubmit={handleSubmit} className="pcm-form">
                <div className="pcm-grid">
                    {/* Voucher Number */}
                    <div className="pcm-field">
                        <label>Voucher Number</label>
                        <div className="pcm-input-wrap disabled">
                            <Hash size={15} className="pcm-icon" />
                            <input value={voucherNumber} readOnly />
                        </div>
                    </div>

                    {/* Date */}
                    <div className="pcm-field">
                        <label>Date *</label>
                        <div className="pcm-input-wrap">
                            <Calendar size={15} className="pcm-icon" />
                            <input
                                type="date"
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                                required
                            />
                        </div>
                    </div>

                    {/* Type */}
                    <div className="pcm-field">
                        <label>Type *</label>
                        <div className="pcm-input-wrap">
                            {type === 'Disbursement'
                                ? <ArrowDownCircle size={15} className="pcm-icon" />
                                : <ArrowUpCircle size={15} className="pcm-icon" />
                            }
                            <select
                                value={type}
                                onChange={(e) => setType(e.target.value)}
                                required
                            >
                                {TYPES.map(t => (
                                    <option key={t} value={t}>{t}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Amount */}
                    <div className="pcm-field">
                        <label>Amount ({CURRENCY_SYMBOL}) *</label>
                        <div className="pcm-input-wrap">
                            <Banknote size={15} className="pcm-icon" />
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

                    {/* Description */}
                    <div className="pcm-field full-width">
                        <label>Description / Purpose *</label>
                        <div className="pcm-input-wrap">
                            <FileText size={15} className="pcm-icon" />
                            <input
                                type="text"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Purpose of the transaction..."
                                required
                            />
                        </div>
                    </div>

                    {/* Category - only for Disbursement */}
                    {type === 'Disbursement' && (
                        <div className="pcm-field">
                            <label>Category *</label>
                            <div className="pcm-input-wrap">
                                <Tag size={15} className="pcm-icon" />
                                <select
                                    value={category}
                                    onChange={(e) => setCategory(e.target.value)}
                                    required
                                >
                                    <option value="">Select category...</option>
                                    {CATEGORIES.map(c => (
                                        <option key={c} value={c}>{c}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    )}

                    {/* Custodian */}
                    <div className="pcm-field">
                        <label>Custodian *</label>
                        <div className="pcm-input-wrap">
                            <User size={15} className="pcm-icon" />
                            <input
                                type="text"
                                value={custodian}
                                onChange={(e) => setCustodian(e.target.value)}
                                placeholder="Fund custodian name"
                                required
                            />
                        </div>
                    </div>

                    {/* Approved By */}
                    <div className="pcm-field">
                        <label>Approved By</label>
                        <div className="pcm-input-wrap">
                            <User size={15} className="pcm-icon" />
                            <input
                                type="text"
                                value={approvedBy}
                                onChange={(e) => setApprovedBy(e.target.value)}
                                placeholder="Approver name"
                            />
                        </div>
                    </div>

                    {/* Status */}
                    <div className="pcm-field">
                        <label>Status</label>
                        <div className="pcm-input-wrap">
                            <CheckSquare size={15} className="pcm-icon" />
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

                    {/* Receipt Attached */}
                    <div className="pcm-field pcm-checkbox-field">
                        <label className="pcm-checkbox-label">
                            <input
                                type="checkbox"
                                checked={receiptAttached}
                                onChange={(e) => setReceiptAttached(e.target.checked)}
                            />
                            <span>Receipt Attached</span>
                        </label>
                    </div>

                    {/* Notes */}
                    <div className="pcm-field full-width">
                        <label>Notes</label>
                        <div className="pcm-input-wrap">
                            <textarea
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                placeholder="Additional notes..."
                                rows={2}
                            />
                        </div>
                    </div>
                </div>

                <div className="pcm-actions">
                    <button type="button" onClick={onClose} className="pcm-btn-secondary">Cancel</button>
                    <button type="submit" disabled={loading} className="pcm-btn-primary">
                        <Save size={16} />
                        {loading ? 'Saving...' : (isEdit ? 'Update Voucher' : 'Create Voucher')}
                    </button>
                </div>
            </form>

            <style>{`
                .pcm-form { padding: 4px; }
                .pcm-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 16px;
                }
                .full-width { grid-column: span 2; }
                .pcm-field { position: relative; }
                .pcm-field label {
                    display: block;
                    font-size: 11px;
                    font-weight: 600;
                    color: var(--slate-600);
                    margin-bottom: 6px;
                }
                .pcm-input-wrap { position: relative; }
                .pcm-input-wrap .pcm-icon {
                    position: absolute;
                    left: 12px;
                    top: 50%;
                    transform: translateY(-50%);
                    color: var(--slate-400);
                }
                .pcm-input-wrap.disabled { opacity: 0.7; }
                .pcm-input-wrap input, .pcm-input-wrap select {
                    width: 100%;
                    padding: 10px 12px 10px 38px;
                    border: 1.5px solid var(--slate-200);
                    border-radius: 8px;
                    font-size: 11px;
                    outline: none;
                    transition: border-color 0.2s;
                }
                .pcm-input-wrap input:focus, .pcm-input-wrap select:focus {
                    border-color: var(--primary-400);
                }
                .pcm-input-wrap textarea {
                    width: 100%;
                    padding: 10px 12px;
                    border: 1.5px solid var(--slate-200);
                    border-radius: 8px;
                    font-size: 11px;
                    outline: none;
                    resize: vertical;
                    transition: border-color 0.2s;
                }
                .pcm-input-wrap textarea:focus {
                    border-color: var(--primary-400);
                }
                .pcm-checkbox-field {
                    display: flex;
                    align-items: flex-end;
                    padding-bottom: 4px;
                }
                .pcm-checkbox-label {
                    display: flex !important;
                    align-items: center;
                    gap: 8px;
                    cursor: pointer;
                    font-size: 11px;
                    font-weight: 600;
                    color: var(--slate-600);
                }
                .pcm-checkbox-label input[type="checkbox"] {
                    width: 16px;
                    height: 16px;
                    accent-color: var(--primary-600);
                    cursor: pointer;
                }
                .pcm-actions {
                    display: flex;
                    justify-content: flex-end;
                    gap: 12px;
                    margin-top: 24px;
                    padding-top: 16px;
                    border-top: 1.5px solid var(--slate-100);
                }
                .pcm-btn-secondary {
                    padding: 8px 16px;
                    border-radius: 8px;
                    border: 1.5px solid var(--slate-200);
                    background: var(--card-bg);
                    font-size: 11px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.15s;
                }
                .pcm-btn-secondary:hover {
                    background: var(--slate-50);
                    border-color: var(--slate-300);
                }
                .pcm-btn-primary {
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
                .pcm-btn-primary:hover {
                    background: var(--primary-700);
                }
                .pcm-btn-primary:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }
            `}</style>
        </Modal>
    );
}
