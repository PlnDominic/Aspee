'use client';

import React, { useMemo } from 'react';
import Modal from './Modal';
import StatCard from './StatCard';
import { supabase } from '@/lib/supabase';
import { formatCurrency } from '@/lib/formatCurrency';
import { useFetch } from '@/lib/hooks';
import {
    Building2, User, Phone, Mail, MapPin, CreditCard,
    Landmark, Wallet, Scale,
} from 'lucide-react';

interface LedgerLine {
    date: string | null;
    type: 'Opening Balance' | 'Bill' | 'Payment';
    ref: string;
    description: string;
    debit: number;
    credit: number;
    runningBalance: number;
    nativeCurrency: string;
    nativeAmount: number;
    exchangeRate: number;
}

interface SupplierProfileModalProps {
    isOpen: boolean;
    onClose: () => void;
    supplier: any;
}

// Mirrors the AP Ledger's per-supplier basis exactly (Billed at PO
// approval/receipt status, valued at the PO total in GHS; Paid from
// Approved/Completed supplier_payments) so the balance shown here never
// drifts from the standalone AP Ledger page — just scoped to one supplier
// and prefixed with that supplier's opening balance.
export default function SupplierProfileModal({ isOpen, onClose, supplier }: SupplierProfileModalProps) {
    const supplierId = supplier?.id;

    const { data, isLoading: loading } = useFetch<{ purchaseOrders: any[]; payments: any[] }>(
        ['supplier_profile', supplierId],
        async () => {
            const [poRes, paymentsRes] = await Promise.all([
                supabase
                    .from('purchase_orders')
                    .select('id, po_number, total_amount, currency, exchange_rate, status, approved_at, created_at')
                    .eq('supplier_id', supplierId),
                supabase
                    .from('supplier_payments')
                    .select('id, payment_number, payment_date, amount, status, po_id, purchase_orders:po_id(po_number, currency, exchange_rate)')
                    .eq('supplier_id', supplierId)
                    .in('status', ['Approved', 'Completed']),
            ]);

            if (poRes.error) return { data: null, error: poRes.error };
            if (paymentsRes.error) return { data: null, error: paymentsRes.error };

            return {
                data: { purchaseOrders: poRes.data || [], payments: paymentsRes.data || [] },
                error: null,
            };
        },
        { enabled: isOpen && !!supplierId }
    );

    const { lines, totalBilled, totalPaid, balanceDue } = useMemo(() => {
        const openingBalance = Number(supplier?.opening_balance) || 0;
        const rawLines: LedgerLine[] = [];
        let billed = 0;
        let paid = 0;

        for (const po of data?.purchaseOrders || []) {
            if (['Pending', 'Draft', 'Cancelled', 'Rejected'].includes(po.status)) continue;

            const nativeAmount = Number(po.total_amount) || 0;
            const rate = Number(po.exchange_rate) || 1;
            const value = nativeAmount * rate;
            if (value <= 0) continue;

            billed += value;
            rawLines.push({
                date: po.approved_at || po.created_at,
                type: 'Bill',
                ref: po.po_number,
                description: `Purchase Order ${po.po_number || '—'} (${po.status})`,
                debit: 0,
                credit: value,
                runningBalance: 0,
                nativeCurrency: po.currency || 'GHS',
                nativeAmount,
                exchangeRate: rate,
            });
        }

        for (const p of data?.payments || []) {
            const nativeAmount = Number(p.amount) || 0;
            const rate = Number(p.purchase_orders?.exchange_rate) || 1;
            const amount = nativeAmount * rate;

            paid += amount;
            rawLines.push({
                date: p.payment_date,
                type: 'Payment',
                ref: p.payment_number,
                description: `Payment against PO ${p.purchase_orders?.po_number || '—'}`,
                debit: amount,
                credit: 0,
                runningBalance: 0,
                nativeCurrency: p.purchase_orders?.currency || 'GHS',
                nativeAmount,
                exchangeRate: rate,
            });
        }

        rawLines.sort((a, b) => (a.date || '').localeCompare(b.date || ''));

        let running = openingBalance;
        const linesWithBalance = rawLines.map(l => {
            running += l.credit - l.debit;
            return { ...l, runningBalance: running };
        });

        const openingLine: LedgerLine = {
            date: null,
            type: 'Opening Balance',
            ref: '—',
            description: 'Balance carried forward before this system',
            debit: 0,
            credit: 0,
            runningBalance: openingBalance,
            nativeCurrency: 'GHS',
            nativeAmount: openingBalance,
            exchangeRate: 1,
        };

        return {
            lines: [openingLine, ...linesWithBalance],
            totalBilled: billed,
            totalPaid: paid,
            balanceDue: openingBalance + billed - paid,
        };
    }, [data, supplier]);

    if (!supplier) return null;

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Supplier Profile"
            subtitle={supplier.name}
            width={900}
        >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {/* Details card */}
                <div style={{
                    display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14,
                    padding: 16, background: 'var(--slate-50)', border: '1px solid var(--slate-200)', borderRadius: 12,
                }}>
                    <ProfileField icon={<Building2 size={14} />} label="Category" value={supplier.category} />
                    <ProfileField icon={<Wallet size={14} />} label="Status" value={supplier.status} />
                    <ProfileField icon={<User size={14} />} label="Contact Person" value={supplier.contact_person || '—'} />
                    <ProfileField icon={<CreditCard size={14} />} label="Payment Terms" value={supplier.payment_terms || '—'} />
                    <ProfileField icon={<Mail size={14} />} label="Email" value={supplier.email || '—'} />
                    <ProfileField icon={<Phone size={14} />} label="Phone" value={supplier.phone || '—'} />
                    <ProfileField icon={<MapPin size={14} />} label="Address" value={supplier.address || '—'} full />
                </div>

                {/* Financial summary */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                    <StatCard title="Opening Balance" value={formatCurrency(Number(supplier.opening_balance) || 0)} icon={<Landmark size={18} />} color="purple" />
                    <StatCard title="Total Billed" value={formatCurrency(totalBilled)} icon={<Scale size={18} />} color="blue" />
                    <StatCard title="Total Paid" value={formatCurrency(totalPaid)} icon={<CreditCard size={18} />} color="teal" />
                    <StatCard title="Balance Due" value={formatCurrency(Math.abs(balanceDue))} icon={<Wallet size={18} />} color={balanceDue > 0 ? 'red' : 'green'} />
                </div>

                {/* Transaction history */}
                <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--slate-700)', marginBottom: 8 }}>
                        Transaction History
                    </div>
                    <div style={{ border: '1px solid var(--slate-200)', borderRadius: 12, overflow: 'hidden' }}>
                        <div style={{
                            display: 'grid', gridTemplateColumns: '100px 120px 1fr 110px 110px 120px', gap: 8,
                            padding: '8px 16px', background: 'var(--slate-50)', fontSize: 10, fontWeight: 700,
                            color: 'var(--slate-500)', letterSpacing: '0.05em', textTransform: 'uppercase',
                        }}>
                            <span>Date</span>
                            <span>Reference</span>
                            <span>Description</span>
                            <span style={{ textAlign: 'right' }}>Billed</span>
                            <span style={{ textAlign: 'right' }}>Paid</span>
                            <span style={{ textAlign: 'right' }}>Balance</span>
                        </div>
                        {loading ? (
                            <div style={{ padding: 24, textAlign: 'center', color: 'var(--slate-400)', fontSize: 12 }}>Loading transactions…</div>
                        ) : (
                            lines.map((line, idx) => (
                                <div
                                    key={idx}
                                    style={{
                                        display: 'grid', gridTemplateColumns: '100px 120px 1fr 110px 110px 120px', gap: 8,
                                        padding: '9px 16px', borderTop: '1px solid var(--slate-50)', fontSize: 12,
                                        background: line.type === 'Opening Balance' ? 'var(--primary-50)' : idx % 2 === 0 ? 'transparent' : 'var(--slate-50)',
                                        alignItems: 'center',
                                    }}
                                >
                                    <span style={{ color: 'var(--slate-500)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                                        {line.date ? new Date(line.date).toLocaleDateString('en-GB') : '—'}
                                    </span>
                                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600, color: 'var(--primary-600)' }}>{line.ref}</span>
                                    <span style={{ color: 'var(--slate-700)' }}>{line.description}</span>
                                    <span style={{ textAlign: 'right', fontWeight: 600, color: line.credit > 0 ? 'var(--slate-800)' : 'var(--slate-300)' }}>
                                        {line.credit > 0 ? formatCurrency(line.credit) : '—'}
                                    </span>
                                    <span style={{ textAlign: 'right', fontWeight: 600, color: line.debit > 0 ? 'var(--slate-800)' : 'var(--slate-300)' }}>
                                        {line.debit > 0 ? formatCurrency(line.debit) : '—'}
                                    </span>
                                    <span style={{ textAlign: 'right', fontWeight: 700, fontFamily: 'var(--font-mono)', fontSize: 12, color: line.runningBalance > 0 ? '#b91c1c' : '#15803d' }}>
                                        {formatCurrency(Math.abs(line.runningBalance))}
                                    </span>
                                </div>
                            ))
                        )}
                        {!loading && lines.length === 1 && (
                            <div style={{ padding: 24, textAlign: 'center', color: 'var(--slate-400)', fontSize: 12 }}>
                                No purchase orders or payments recorded yet.
                            </div>
                        )}
                    </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 8 }}>
                    <button
                        type="button"
                        onClick={onClose}
                        style={{
                            padding: '10px 22px', borderRadius: 10, border: '1.5px solid var(--slate-200)',
                            background: 'var(--card-bg)', color: 'var(--slate-600)', fontSize: 11, fontWeight: 600, cursor: 'pointer',
                        }}
                    >
                        Close
                    </button>
                </div>
            </div>
        </Modal>
    );
}

function ProfileField({ icon, label, value, full }: { icon: React.ReactNode; label: string; value: string; full?: boolean }) {
    return (
        <div style={{ gridColumn: full ? 'span 2' : undefined, display: 'flex', alignItems: 'flex-start', gap: 8 }}>
            <span style={{ color: 'var(--slate-400)', marginTop: 2 }}>{icon}</span>
            <div>
                <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--slate-400)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
                <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--slate-800)' }}>{value}</div>
            </div>
        </div>
    );
}
