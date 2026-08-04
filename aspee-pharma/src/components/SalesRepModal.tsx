'use client';

import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import { User, Phone, Mail, CheckSquare, StickyNote, Save } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

const STATUSES = ['Active', 'Inactive'];

interface SalesRepModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    record?: any;
}

export default function SalesRepModal({ isOpen, onClose, onSuccess, record }: SalesRepModalProps) {
    const [loading, setLoading] = useState(false);

    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [email, setEmail] = useState('');
    const [status, setStatus] = useState('Active');
    const [notes, setNotes] = useState('');

    const isEdit = !!record;

    useEffect(() => {
        if (isOpen) {
            if (record) {
                setName(record.name || '');
                setPhone(record.phone || '');
                setEmail(record.email || '');
                setStatus(record.status || 'Active');
                setNotes(record.notes || '');
            } else {
                setName('');
                setPhone('');
                setEmail('');
                setStatus('Active');
                setNotes('');
            }
        }
    }, [isOpen, record]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!name.trim()) {
            toast.error('Please enter a name');
            return;
        }

        setLoading(true);
        try {
            const payload = {
                name: name.trim(),
                phone: phone.trim() || null,
                email: email.trim() || null,
                status,
                notes: notes.trim() || null,
            };

            if (isEdit) {
                const { error } = await supabase
                    .from('sales_reps')
                    .update(payload)
                    .eq('id', record.id);

                if (error) throw error;
                toast.success('Sales rep updated successfully');
            } else {
                const { error } = await supabase
                    .from('sales_reps')
                    .insert([payload]);

                if (error) throw error;
                toast.success('Sales rep added successfully');
            }

            onSuccess();
            onClose();
        } catch (error: any) {
            toast.error('Error saving sales rep: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={isEdit ? 'Edit Sales Rep' : 'Add Sales Rep'}
            subtitle={isEdit ? 'Update this sales rep’s details' : 'Add a van sales rep to the roster — no system login required'}
            width={560}
        >
            <form onSubmit={handleSubmit} className="srm-form">
                <div className="srm-grid">
                    <div className="srm-field full-width">
                        <label>Full Name *</label>
                        <div className="srm-input-wrap">
                            <User size={15} className="srm-icon" />
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="e.g. Kwame Mensah"
                                required
                            />
                        </div>
                    </div>

                    <div className="srm-field">
                        <label>Phone</label>
                        <div className="srm-input-wrap">
                            <Phone size={15} className="srm-icon" />
                            <input
                                type="text"
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                                placeholder="024 000 0000"
                            />
                        </div>
                    </div>

                    <div className="srm-field">
                        <label>Email</label>
                        <div className="srm-input-wrap">
                            <Mail size={15} className="srm-icon" />
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="optional"
                            />
                        </div>
                    </div>

                    <div className="srm-field full-width">
                        <label>Status</label>
                        <div className="srm-input-wrap">
                            <CheckSquare size={15} className="srm-icon" />
                            <select value={status} onChange={(e) => setStatus(e.target.value)}>
                                {STATUSES.map(s => (
                                    <option key={s} value={s}>{s}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="srm-field full-width">
                        <label>Notes</label>
                        <div className="srm-input-wrap">
                            <StickyNote size={15} className="srm-icon" />
                            <textarea
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                placeholder="Additional notes..."
                                rows={2}
                            />
                        </div>
                    </div>
                </div>

                <div className="srm-actions">
                    <button type="button" onClick={onClose} className="srm-btn-secondary">Cancel</button>
                    <button type="submit" disabled={loading} className="srm-btn-primary">
                        <Save size={16} />
                        {loading ? 'Saving...' : (isEdit ? 'Update Rep' : 'Add Rep')}
                    </button>
                </div>
            </form>

            <style>{`
                .srm-form { padding: 4px; }
                .srm-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 16px;
                }
                .full-width { grid-column: span 2; }
                .srm-field { position: relative; }
                .srm-field label {
                    display: block;
                    font-size: 11px;
                    font-weight: 600;
                    color: var(--slate-600);
                    margin-bottom: 6px;
                }
                .srm-input-wrap { position: relative; }
                .srm-input-wrap .srm-icon {
                    position: absolute;
                    left: 12px;
                    top: 12px;
                    color: var(--slate-400);
                }
                .srm-input-wrap input, .srm-input-wrap select {
                    width: 100%;
                    padding: 10px 12px 10px 38px;
                    border: 1.5px solid var(--slate-200);
                    border-radius: 8px;
                    font-size: 11px;
                    outline: none;
                    transition: border-color 0.2s;
                }
                .srm-input-wrap input:focus, .srm-input-wrap select:focus {
                    border-color: var(--primary-400);
                }
                .srm-input-wrap textarea {
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
                .srm-input-wrap textarea:focus {
                    border-color: var(--primary-400);
                }
                .srm-actions {
                    display: flex;
                    justify-content: flex-end;
                    gap: 12px;
                    margin-top: 24px;
                    padding-top: 16px;
                    border-top: 1.5px solid var(--slate-100);
                }
                .srm-btn-secondary {
                    padding: 8px 16px;
                    border-radius: 8px;
                    border: 1.5px solid var(--slate-200);
                    background: var(--card-bg);
                    font-size: 11px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.15s;
                }
                .srm-btn-secondary:hover {
                    background: var(--slate-50);
                    border-color: var(--slate-300);
                }
                .srm-btn-primary {
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
                .srm-btn-primary:hover:not(:disabled) {
                    background: var(--primary-700);
                }
                .srm-btn-primary:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }
            `}</style>
        </Modal>
    );
}
