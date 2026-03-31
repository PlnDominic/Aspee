'use client';

import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import { Save, AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

interface Account {
    id: string;
    code: string;
    name: string;
    type: string;
}

interface JournalEntryModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

const REF_TYPES = ['Manual', 'Sales', 'Purchase', 'Expense', 'Payroll', 'Adjustment'];

function generateEntryNumber(): string {
    const now = new Date();
    const yy = String(now.getFullYear()).slice(-2);
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const seq = String(Math.floor(1000 + Math.random() * 9000));
    return `JNL-${yy}${mm}-${seq}`;
}

export default function JournalEntryModal({ isOpen, onClose, onSuccess }: JournalEntryModalProps) {
    const [loading, setLoading] = useState(false);
    const [fetchingAccounts, setFetchingAccounts] = useState(false);
    const [accounts, setAccounts] = useState<Account[]>([]);

    const [entryNumber, setEntryNumber] = useState('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [description, setDescription] = useState('');
    const [refType, setRefType] = useState('Manual');
    const [debitAccount, setDebitAccount] = useState('');
    const [debitAmount, setDebitAmount] = useState<string>('');
    const [creditAccount, setCreditAccount] = useState('');
    const [creditAmount, setCreditAmount] = useState<string>('');
    const [createdBy, setCreatedBy] = useState('');
    const [notes, setNotes] = useState('');

    useEffect(() => {
        if (isOpen) {
            setEntryNumber(generateEntryNumber());
            setDate(new Date().toISOString().split('T')[0]);
            setDescription('');
            setRefType('Manual');
            setDebitAccount('');
            setDebitAmount('');
            setCreditAccount('');
            setCreditAmount('');
            setCreatedBy('');
            setNotes('');
            fetchAccounts();
        }
    }, [isOpen]);

    const fetchAccounts = async () => {
        setFetchingAccounts(true);
        try {
            const { data, error } = await supabase
                .from('chart_of_accounts')
                .select('id, code, name, type')
                .eq('is_active', true)
                .order('code');
            if (error) throw error;
            setAccounts(data || []);
        } catch (error: any) {
            toast.error('Failed to load accounts: ' + error.message);
        } finally {
            setFetchingAccounts(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const debit = parseFloat(debitAmount) || 0;
        const credit = parseFloat(creditAmount) || 0;

        if (debit <= 0 || credit <= 0) {
            toast.error('Both debit and credit amounts must be greater than zero');
            return;
        }

        if (Math.abs(debit - credit) > 0.001) {
            toast.error('Debit and credit amounts must be equal for a balanced entry');
            return;
        }

        if (!debitAccount || !creditAccount) {
            toast.error('Both debit and credit accounts are required');
            return;
        }

        if (debitAccount === creditAccount) {
            toast.error('Debit and credit accounts must be different');
            return;
        }

        if (!description.trim()) {
            toast.error('Description is required');
            return;
        }

        if (!createdBy.trim()) {
            toast.error('Created By is required');
            return;
        }

        setLoading(true);

        try {
            // Find account names for the record
            const debAcc = accounts.find(a => a.id === debitAccount)?.name || '';
            const creAcc = accounts.find(a => a.id === creditAccount)?.name || '';

            const { error } = await supabase.from('journal_entries').insert({
                entry_number: entryNumber,
                date,
                description: description.trim(),
                ref_type: refType,
                debit_account: debAcc,
                debit_amount: debit,
                credit_account: creAcc,
                credit_amount: credit,
                created_by: createdBy.trim(),
                notes: notes.trim() || null,
            });

            if (error) throw error;

            toast.success('Journal entry created successfully');
            onSuccess();
            onClose();
        } catch (error: any) {
            toast.error('Failed to create journal entry: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const inputStyle: React.CSSProperties = {
        padding: '8px 12px',
        border: '1px solid var(--slate-200)',
        borderRadius: 8,
        fontSize: 12,
        outline: 'none',
        width: '100%',
        background: 'var(--card-bg)',
    };

    const labelStyle: React.CSSProperties = {
        fontSize: 12,
        fontWeight: 600,
        color: 'var(--slate-700)',
    };

    const fieldStyle: React.CSSProperties = {
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="New Journal Entry"
            subtitle="Create a double-entry bookkeeping record"
            width={640}
        >
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {/* Row 1: Entry Number + Date */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    <div style={fieldStyle}>
                        <label style={labelStyle}>Entry Number</label>
                        <input
                            type="text"
                            value={entryNumber}
                            readOnly
                            style={{ ...inputStyle, background: 'var(--slate-50)', color: 'var(--slate-500)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}
                        />
                    </div>
                    <div style={fieldStyle}>
                        <label style={labelStyle}>Date *</label>
                        <input
                            type="date"
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                            required
                            style={inputStyle}
                        />
                    </div>
                </div>

                {/* Row 2: Description + Reference Type */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    <div style={fieldStyle}>
                        <label style={labelStyle}>Description *</label>
                        <input
                            type="text"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="e.g. Office rent payment"
                            required
                            style={inputStyle}
                        />
                    </div>
                    <div style={fieldStyle}>
                        <label style={labelStyle}>Reference Type</label>
                        <select
                            value={refType}
                            onChange={(e) => setRefType(e.target.value)}
                            style={inputStyle}
                        >
                            {REF_TYPES.map((t) => (
                                <option key={t} value={t}>{t}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Row 3: Debit Account + Debit Amount */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    <div style={fieldStyle}>
                        <label style={labelStyle}>Debit Account *</label>
                        <select
                            value={debitAccount}
                            onChange={(e) => setDebitAccount(e.target.value)}
                            required
                            style={inputStyle}
                        >
                            <option value="">Select Account...</option>
                            {accounts.map(acc => (
                                <option key={acc.id} value={acc.id}>
                                    {acc.code} - {acc.name} ({acc.type})
                                </option>
                            ))}
                        </select>
                    </div>
                    <div style={fieldStyle}>
                        <label style={labelStyle}>Debit Amount (GH&#8373;) *</label>
                        <input
                            type="number"
                            min="0.01"
                            step="0.01"
                            value={debitAmount}
                            onChange={(e) => setDebitAmount(e.target.value)}
                            placeholder="0.00"
                            required
                            style={inputStyle}
                        />
                    </div>
                </div>

                {/* Row 4: Credit Account + Credit Amount */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    <div style={fieldStyle}>
                        <label style={labelStyle}>Credit Account *</label>
                        <select
                            value={creditAccount}
                            onChange={(e) => setCreditAccount(e.target.value)}
                            required
                            style={inputStyle}
                        >
                            <option value="">Select Account...</option>
                            {accounts.map(acc => (
                                <option key={acc.id} value={acc.id}>
                                    {acc.code} - {acc.name} ({acc.type})
                                </option>
                            ))}
                        </select>
                    </div>
                    <div style={fieldStyle}>
                        <label style={labelStyle}>Credit Amount (GH&#8373;) *</label>
                        <input
                            type="number"
                            min="0.01"
                            step="0.01"
                            value={creditAmount}
                            onChange={(e) => setCreditAmount(e.target.value)}
                            placeholder="0.00"
                            required
                            style={inputStyle}
                        />
                    </div>
                </div>

                {/* Balance indicator */}
                {debitAmount && creditAmount && (
                    <div
                        style={{
                            padding: '8px 14px',
                            borderRadius: 8,
                            fontSize: 12,
                            fontWeight: 600,
                            border: '1px solid',
                            ...(Math.abs((parseFloat(debitAmount) || 0) - (parseFloat(creditAmount) || 0)) < 0.01
                                ? { background: 'var(--success-light)', color: '#047857', borderColor: '#a7f3d0' }
                                : { background: 'var(--danger-light)', color: '#b91c1c', borderColor: '#fecaca' }),
                        }}
                    >
                        {Math.abs((parseFloat(debitAmount) || 0) - (parseFloat(creditAmount) || 0)) < 0.01
                            ? 'Entry is balanced'
                            : `Imbalance of GH\u20B5 ${Math.abs((parseFloat(debitAmount) || 0) - (parseFloat(creditAmount) || 0)).toFixed(2)}`}
                    </div>
                )}

                {/* Row 5: Created By */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    <div style={fieldStyle}>
                        <label style={labelStyle}>Created By *</label>
                        <input
                            type="text"
                            value={createdBy}
                            onChange={(e) => setCreatedBy(e.target.value)}
                            placeholder="e.g. John Mensah"
                            required
                            style={inputStyle}
                        />
                    </div>
                </div>

                {/* Notes */}
                <div style={fieldStyle}>
                    <label style={labelStyle}>Notes</label>
                    <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        rows={2}
                        placeholder="Optional notes or supporting details..."
                        style={{ ...inputStyle, resize: 'vertical' }}
                    />
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, paddingTop: 16, borderTop: '1px solid var(--slate-200)' }}>
                    <button
                        type="button"
                        onClick={onClose}
                        style={{
                            padding: '8px 20px',
                            border: '1px solid var(--slate-300)',
                            borderRadius: 6,
                            fontSize: 12,
                            fontWeight: 600,
                            color: 'var(--slate-700)',
                            background: 'var(--card-bg)',
                            cursor: 'pointer',
                        }}
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={loading}
                        style={{
                            padding: '8px 20px',
                            border: 'none',
                            borderRadius: 6,
                            fontSize: 12,
                            fontWeight: 600,
                            color: 'white',
                            background: loading ? 'var(--slate-400)' : 'var(--primary-600)',
                            cursor: loading ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                        }}
                    >
                        <Save size={14} />
                        {loading ? 'Saving...' : 'Save Entry'}
                    </button>
                </div>
            </form>
        </Modal>
    );
}
