'use client';

import React, { useEffect, useState } from 'react';
import Modal from './Modal';
import { ShieldCheck, Landmark, StickyNote, AlertTriangle, FileText, Truck, Lock } from 'lucide-react';
import { formatCurrency } from '@/lib/formatCurrency';
import { useCurrentUser } from '@/lib/hooks';

const APPROVAL_LEVELS = ['Manager', 'Finance'] as const;
const FINANCE_THRESHOLD = 10000;
// Only these roles carry Finance sign-off authority — a Purchasing Manager or
// other approver-page role can still clear the "Manager" tier, but must hand
// high-value POs to one of these roles rather than self-approving them.
const FINANCE_APPROVER_ROLES = ['Accountant', 'Managing Director', 'Super Admin'];

interface POApprovalModalProps {
    isOpen: boolean;
    onClose: () => void;
    po: any;
    onApprove: (approvalLevel: string, notes: string) => Promise<void>;
}

export default function POApprovalModal({ isOpen, onClose, po, onApprove }: POApprovalModalProps) {
    const { data: currentUser } = useCurrentUser();
    const [approvalLevel, setApprovalLevel] = useState<string>('Manager');
    const [notes, setNotes] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const amount = Number(po?.total_amount) || 0;
    const financeRequired = amount > FINANCE_THRESHOLD;
    const suggestedLevel = financeRequired ? 'Finance' : 'Manager';
    const canApproveFinance = FINANCE_APPROVER_ROLES.includes(currentUser?.role);
    const blocked = financeRequired && !canApproveFinance;

    useEffect(() => {
        if (isOpen) {
            setApprovalLevel(canApproveFinance ? suggestedLevel : 'Manager');
            setNotes('');
        }
    }, [isOpen, po?.id, canApproveFinance]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (blocked) return;
        setSubmitting(true);
        try {
            await onApprove(approvalLevel, notes.trim());
            onClose();
        } catch {
            // onApprove's mutation already surfaces a toast on failure — keep the
            // modal open so the user can retry without re-entering their input.
        } finally {
            setSubmitting(false);
        }
    };

    if (!po) return null;

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Approve Purchase Order"
            subtitle={`Reviewing ${po.po_number}`}
            width={520}
        >
            <form onSubmit={handleSubmit} className="poa-form">
                <div className="poa-summary">
                    <div className="poa-summary-row">
                        <span className="poa-summary-label"><Truck size={14} /> Supplier</span>
                        <span className="poa-summary-value">{po.suppliers?.name || 'N/A'}</span>
                    </div>
                    <div className="poa-summary-row">
                        <span className="poa-summary-label"><FileText size={14} /> PO Number</span>
                        <span className="poa-summary-value">{po.po_number}</span>
                    </div>
                    <div className="poa-summary-row">
                        <span className="poa-summary-label"><Landmark size={14} /> Amount</span>
                        <span className="poa-summary-value poa-amount">{formatCurrency(amount, po.currency)}</span>
                    </div>
                </div>

                {blocked ? (
                    <div className="poa-warning poa-warning-blocked">
                        <Lock size={14} />
                        <span>
                            This PO exceeds {formatCurrency(FINANCE_THRESHOLD, po.currency)} and requires Finance-level
                            approval. Your role ({currentUser?.role || 'Unknown'}) can't grant that — ask an Accountant,
                            Managing Director, or Super Admin to approve it.
                        </span>
                    </div>
                ) : financeRequired && (
                    <div className="poa-warning">
                        <AlertTriangle size={14} />
                        <span>This PO exceeds {formatCurrency(FINANCE_THRESHOLD, po.currency)} and requires Finance-level approval.</span>
                    </div>
                )}

                <div className="poa-field">
                    <label>Approval Level *</label>
                    <div className="poa-level-group">
                        {APPROVAL_LEVELS.map(level => {
                            const disabled = level === 'Finance' && !canApproveFinance;
                            return (
                                <button
                                    key={level}
                                    type="button"
                                    disabled={disabled}
                                    title={disabled ? 'Only Accountant, Managing Director, or Super Admin can approve at Finance level' : undefined}
                                    className={`poa-level-btn${approvalLevel === level ? ' active' : ''}${disabled ? ' disabled' : ''}`}
                                    onClick={() => !disabled && setApprovalLevel(level)}
                                >
                                    {disabled ? <Lock size={14} /> : <ShieldCheck size={14} />}
                                    {level}
                                </button>
                            );
                        })}
                    </div>
                </div>

                <div className="poa-field">
                    <label>Approval Notes</label>
                    <div className="poa-input-wrap">
                        <StickyNote size={15} className="poa-icon" />
                        <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Optional notes for this approval..."
                            rows={3}
                        />
                    </div>
                </div>

                <div className="poa-actions">
                    <button type="button" onClick={onClose} className="poa-btn-secondary">Cancel</button>
                    <button type="submit" disabled={submitting || blocked} className="poa-btn-primary">
                        {blocked ? <Lock size={16} /> : <ShieldCheck size={16} />}
                        {blocked ? 'Finance approval required' : submitting ? 'Approving...' : `Approve as ${approvalLevel}`}
                    </button>
                </div>
            </form>

            <style>{`
                .poa-form { padding: 4px; }
                .poa-summary {
                    background: var(--slate-50);
                    border: 1px solid var(--slate-200);
                    border-radius: 10px;
                    padding: 12px 14px;
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                    margin-bottom: 16px;
                }
                .poa-summary-row {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    font-size: 12px;
                }
                .poa-summary-label {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    color: var(--slate-500);
                    font-weight: 600;
                }
                .poa-summary-value {
                    font-weight: 700;
                    color: var(--slate-800);
                }
                .poa-amount { color: var(--primary-600); }
                .poa-warning {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding: 10px 12px;
                    background: #fffbeb;
                    border: 1px solid #fde68a;
                    border-radius: 8px;
                    color: #92400e;
                    font-size: 11px;
                    font-weight: 600;
                    margin-bottom: 16px;
                }
                .poa-warning-blocked {
                    background: #fef2f2;
                    border-color: #fecaca;
                    color: #b91c1c;
                    align-items: flex-start;
                }
                .poa-field { margin-bottom: 16px; }
                .poa-field label {
                    display: block;
                    font-size: 11px;
                    font-weight: 600;
                    color: var(--slate-600);
                    margin-bottom: 6px;
                }
                .poa-level-group {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 10px;
                }
                .poa-level-btn {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 6px;
                    padding: 10px 12px;
                    border-radius: 8px;
                    border: 1.5px solid var(--slate-200);
                    background: var(--card-bg);
                    color: var(--slate-600);
                    font-size: 12px;
                    font-weight: 700;
                    cursor: pointer;
                    transition: all 0.15s;
                }
                .poa-level-btn:hover {
                    border-color: var(--primary-300);
                }
                .poa-level-btn.active {
                    border-color: var(--primary-500);
                    background: var(--primary-50);
                    color: var(--primary-700);
                }
                .poa-level-btn.disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                    background: var(--slate-50);
                }
                .poa-level-btn.disabled:hover {
                    border-color: var(--slate-200);
                }
                .poa-input-wrap { position: relative; }
                .poa-input-wrap .poa-icon {
                    position: absolute;
                    left: 12px;
                    top: 12px;
                    color: var(--slate-400);
                }
                .poa-input-wrap textarea {
                    width: 100%;
                    padding: 10px 12px 10px 38px;
                    border: 1.5px solid var(--slate-200);
                    border-radius: 8px;
                    font-size: 11px;
                    outline: none;
                    resize: vertical;
                    font-family: inherit;
                    transition: border-color 0.2s;
                }
                .poa-input-wrap textarea:focus {
                    border-color: var(--primary-400);
                }
                .poa-actions {
                    display: flex;
                    justify-content: flex-end;
                    gap: 12px;
                    margin-top: 8px;
                    padding-top: 16px;
                    border-top: 1.5px solid var(--slate-100);
                }
                .poa-btn-secondary {
                    padding: 8px 16px;
                    border-radius: 8px;
                    border: 1.5px solid var(--slate-200);
                    background: var(--card-bg);
                    font-size: 11px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.15s;
                }
                .poa-btn-secondary:hover {
                    background: var(--slate-50);
                    border-color: var(--slate-300);
                }
                .poa-btn-primary {
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
                .poa-btn-primary:hover:not(:disabled) {
                    background: var(--primary-700);
                }
                .poa-btn-primary:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }
            `}</style>
        </Modal>
    );
}
