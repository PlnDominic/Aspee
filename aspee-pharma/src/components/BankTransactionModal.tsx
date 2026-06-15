'use client';

import React, { useState } from 'react';
import Modal from './Modal';
import { ArrowDownCircle, ArrowUpCircle, Calendar, FileText, Save } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { CURRENCY_SYMBOL } from '@/lib/currency';

interface BankTransactionModalProps {
    isOpen: boolean;
    onClose: () => void;
    bank: { id: string; bank_name: string; color: string } | null;
    defaultType?: 'deposit' | 'withdrawal';
    onSuccess: () => void;
}

export const BankTransactionModal = ({
    isOpen,
    onClose,
    bank,
    defaultType = 'deposit',
    onSuccess,
}: BankTransactionModalProps) => {
    const [type, setType] = useState<'deposit' | 'withdrawal'>(defaultType);
    const [amount, setAmount] = useState('');
    const [description, setDescription] = useState('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [saving, setSaving] = useState(false);

    const handleClose = () => {
        setAmount('');
        setDescription('');
        setDate(new Date().toISOString().split('T')[0]);
        setType(defaultType);
        onClose();
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!bank) return;

        const num = parseFloat(amount);
        if (!num || num <= 0) {
            toast.error('Enter a valid amount greater than 0');
            return;
        }

        setSaving(true);
        try {
            const { error: txError } = await supabase.from('bank_transactions').insert({
                bank_account_id: bank.id,
                type,
                amount: num,
                description: description.trim() || null,
                date,
            });
            if (txError) throw txError;

            const delta = type === 'deposit' ? num : -num;
            const { error: balError } = await supabase.rpc('increment_bank_balance', {
                p_bank_id: bank.id,
                p_delta: delta,
            });
            if (balError) throw balError;

            toast.success(`${type === 'deposit' ? 'Deposit' : 'Withdrawal'} of ${CURRENCY_SYMBOL}${num.toFixed(2)} recorded`);
            onSuccess();
            handleClose();
        } catch (err: any) {
            toast.error(err.message);
        } finally {
            setSaving(false);
        }
    };

    if (!bank) return null;

    const isDeposit = type === 'deposit';

    return (
        <Modal
            isOpen={isOpen}
            onClose={handleClose}
            title={`${isDeposit ? 'Deposit' : 'Withdrawal'} — ${bank.bank_name}`}
            size="sm"
        >
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {/* Type toggle */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    {(['deposit', 'withdrawal'] as const).map(t => (
                        <button
                            key={t}
                            type="button"
                            onClick={() => setType(t)}
                            style={{
                                padding: '10px 0',
                                borderRadius: 8,
                                border: `2px solid ${type === t ? (t === 'deposit' ? '#16a34a' : '#dc2626') : 'var(--slate-200)'}`,
                                background: type === t ? (t === 'deposit' ? '#f0fdf4' : '#fef2f2') : 'var(--card-bg)',
                                color: type === t ? (t === 'deposit' ? '#16a34a' : '#dc2626') : 'var(--slate-500)',
                                fontWeight: 700,
                                fontSize: 13,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 6,
                                transition: 'all 0.15s',
                            }}
                        >
                            {t === 'deposit'
                                ? <ArrowDownCircle size={15} />
                                : <ArrowUpCircle size={15} />}
                            {t.charAt(0).toUpperCase() + t.slice(1)}
                        </button>
                    ))}
                </div>

                {/* Amount */}
                <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--slate-600)', display: 'block', marginBottom: 6 }}>
                        Amount ({CURRENCY_SYMBOL}) *
                    </label>
                    <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        value={amount}
                        onChange={e => setAmount(e.target.value)}
                        placeholder="0.00"
                        required
                        style={{
                            width: '100%',
                            padding: '10px 12px',
                            border: '1px solid var(--slate-200)',
                            borderRadius: 8,
                            fontSize: 14,
                            fontWeight: 700,
                            outline: 'none',
                            background: 'var(--card-bg)',
                            color: 'var(--text-primary)',
                            boxSizing: 'border-box',
                        }}
                    />
                </div>

                {/* Date */}
                <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--slate-600)', display: 'block', marginBottom: 6 }}>
                        <Calendar size={12} style={{ display: 'inline', marginRight: 4 }} />
                        Date *
                    </label>
                    <input
                        type="date"
                        value={date}
                        onChange={e => setDate(e.target.value)}
                        required
                        style={{
                            width: '100%',
                            padding: '10px 12px',
                            border: '1px solid var(--slate-200)',
                            borderRadius: 8,
                            fontSize: 13,
                            outline: 'none',
                            background: 'var(--card-bg)',
                            color: 'var(--text-primary)',
                            boxSizing: 'border-box',
                        }}
                    />
                </div>

                {/* Description */}
                <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--slate-600)', display: 'block', marginBottom: 6 }}>
                        <FileText size={12} style={{ display: 'inline', marginRight: 4 }} />
                        Description
                    </label>
                    <textarea
                        value={description}
                        onChange={e => setDescription(e.target.value)}
                        placeholder="Optional note..."
                        rows={3}
                        style={{
                            width: '100%',
                            padding: '10px 12px',
                            border: '1px solid var(--slate-200)',
                            borderRadius: 8,
                            fontSize: 13,
                            outline: 'none',
                            resize: 'vertical',
                            background: 'var(--card-bg)',
                            color: 'var(--text-primary)',
                            boxSizing: 'border-box',
                        }}
                    />
                </div>

                <button
                    type="submit"
                    disabled={saving}
                    style={{
                        padding: '12px 0',
                        borderRadius: 8,
                        border: 'none',
                        background: isDeposit ? '#16a34a' : '#dc2626',
                        color: '#fff',
                        fontWeight: 700,
                        fontSize: 13,
                        cursor: saving ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                        opacity: saving ? 0.7 : 1,
                    }}
                >
                    <Save size={15} />
                    {saving ? 'Saving...' : `Record ${isDeposit ? 'Deposit' : 'Withdrawal'}`}
                </button>
            </form>
        </Modal>
    );
};
