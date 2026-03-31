'use client';

import React, { useState, useEffect, useRef } from 'react';
import Modal from './Modal';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import {
    User, Phone, Mail, MapPin, Activity,
    Building2, IdCard, Upload, X, FileText, CheckCircle2,
} from 'lucide-react';

interface CustomerModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    record?: any;
}

const initialForm = {
    name: '',
    contact_person: '',
    email: '',
    phone: '',
    address: '',
    status: 'Active',
};

const BUCKET = 'compliance-documents';

function safeFileName(name: string) {
    return name.replace(/[^a-zA-Z0-9._-]/g, '_');
}

export default function CustomerModal({ isOpen, onClose, onSuccess, record }: CustomerModalProps) {
    const [formData, setFormData] = useState(initialForm);
    const [loading, setLoading] = useState(false);

    // Ghana Card state
    const [ghanaCardNumber, setGhanaCardNumber] = useState('');
    const [ghanaCardFile, setGhanaCardFile] = useState<File | null>(null);
    const [ghanaCardPreview, setGhanaCardPreview] = useState<string | null>(null);
    const [existingGhanaCard, setExistingGhanaCard] = useState<any | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (record) {
            setFormData({
                name: record.name || '',
                contact_person: record.contact_person || '',
                email: record.email || '',
                phone: record.phone || '',
                address: record.address || '',
                status: record.status || 'Active',
            });
            // Load existing Ghana Card doc
            if (record.id) {
                supabase
                    .from('entity_documents')
                    .select('*')
                    .eq('entity_type', 'customer')
                    .eq('entity_id', record.id)
                    .eq('document_type', 'GHANA_CARD')
                    .maybeSingle()
                    .then(({ data }) => {
                        setExistingGhanaCard(data || null);
                        setGhanaCardNumber(data?.document_number || '');
                    });
            }
        } else {
            setFormData(initialForm);
            setGhanaCardNumber('');
            setGhanaCardFile(null);
            setGhanaCardPreview(null);
            setExistingGhanaCard(null);
        }
    }, [record, isOpen]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0];
        if (!f) return;
        setGhanaCardFile(f);
        if (f.type.startsWith('image/')) {
            setGhanaCardPreview(URL.createObjectURL(f));
        } else {
            setGhanaCardPreview(null);
        }
    };

    const clearFile = () => {
        setGhanaCardFile(null);
        setGhanaCardPreview(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const uploadGhanaCard = async (customerId: string) => {
        if (!ghanaCardFile && !ghanaCardNumber) return;

        let filePath = existingGhanaCard?.file_path || null;

        // Upload file if selected
        if (ghanaCardFile) {
            const ext = ghanaCardFile.name.split('.').pop();
            filePath = `customers/${customerId}/ghana_card_${Date.now()}_${safeFileName(ghanaCardFile.name)}`;
            const { error: uploadError } = await supabase.storage
                .from(BUCKET)
                .upload(filePath, ghanaCardFile, { upsert: true });
            if (uploadError) throw new Error('File upload failed: ' + uploadError.message);
        }

        if (!filePath && !ghanaCardNumber) return;

        const docPayload = {
            entity_type: 'customer',
            entity_id: customerId,
            document_type: 'GHANA_CARD',
            document_number: ghanaCardNumber || null,
            file_path: filePath || '',
            file_name: ghanaCardFile?.name || existingGhanaCard?.file_name || null,
            mime_type: ghanaCardFile?.type || existingGhanaCard?.mime_type || null,
            file_size: ghanaCardFile?.size || existingGhanaCard?.file_size || null,
        };

        if (existingGhanaCard?.id) {
            const { error } = await supabase
                .from('entity_documents')
                .update(docPayload)
                .eq('id', existingGhanaCard.id);
            if (error) throw new Error(error.message);
        } else {
            const { error } = await supabase
                .from('entity_documents')
                .insert(docPayload);
            if (error) throw new Error(error.message);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            let customerId = record?.id;

            if (record?.id) {
                const { error } = await supabase.from('customers').update(formData).eq('id', record.id);
                if (error) throw error;
                toast.success('Customer updated successfully');
            } else {
                const { data, error } = await supabase.from('customers').insert([formData]).select('id').single();
                if (error) throw error;
                customerId = data.id;
                toast.success('Customer added successfully');
            }

            if (customerId) await uploadGhanaCard(customerId);

            onSuccess();
            onClose();
        } catch (error: any) {
            toast.error('Error saving customer: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const isEditing = !!record;

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={isEditing ? 'Edit Customer' : 'Add New Customer'}
            subtitle={isEditing ? 'Update customer details below' : 'Fill in the details to register a new customer'}
            width={680}
        >
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>

                {/* ── Section: Customer Information ── */}
                <div style={sectionStyle}>
                    <div style={sectionHeaderStyle}>
                        <Building2 size={13} />
                        <span>Customer Information</span>
                    </div>

                    <div style={fieldStyle}>
                        <label style={labelStyle}>Customer Name <span style={{ color: 'var(--danger)' }}>*</span></label>
                        <div style={inputWrapStyle}>
                            <Building2 size={14} style={iconStyle} />
                            <input required type="text" value={formData.name}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                                placeholder="e.g. Korle-Bu Teaching Hospital Pharmacy"
                                style={{ ...inputStyle, paddingLeft: 36 }} />
                        </div>
                    </div>

                    <div style={rowStyle}>
                        <div style={fieldStyle}>
                            <label style={labelStyle}>Contact Person</label>
                            <div style={inputWrapStyle}>
                                <User size={14} style={iconStyle} />
                                <input type="text" value={formData.contact_person}
                                    onChange={e => setFormData({ ...formData, contact_person: e.target.value })}
                                    placeholder="e.g. Kwame Asante"
                                    style={{ ...inputStyle, paddingLeft: 36 }} />
                            </div>
                        </div>
                        <div style={fieldStyle}>
                            <label style={labelStyle}>Status</label>
                            <div style={inputWrapStyle}>
                                <Activity size={14} style={iconStyle} />
                                <select value={formData.status}
                                    onChange={e => setFormData({ ...formData, status: e.target.value })}
                                    style={{ ...inputStyle, paddingLeft: 36 }}>
                                    <option value="Active">Active</option>
                                    <option value="Inactive">Inactive</option>
                                </select>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── Section: Contact Details ── */}
                <div style={sectionStyle}>
                    <div style={sectionHeaderStyle}>
                        <Phone size={13} />
                        <span>Contact Details</span>
                    </div>

                    <div style={rowStyle}>
                        <div style={fieldStyle}>
                            <label style={labelStyle}>Phone Number</label>
                            <div style={inputWrapStyle}>
                                <Phone size={14} style={iconStyle} />
                                <input type="tel" value={formData.phone}
                                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                    placeholder="+233 XX XXX XXXX"
                                    style={{ ...inputStyle, paddingLeft: 36 }} />
                            </div>
                        </div>
                        <div style={fieldStyle}>
                            <label style={labelStyle}>Email Address</label>
                            <div style={inputWrapStyle}>
                                <Mail size={14} style={iconStyle} />
                                <input type="email" value={formData.email}
                                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                                    placeholder="contact@example.com"
                                    style={{ ...inputStyle, paddingLeft: 36 }} />
                            </div>
                        </div>
                    </div>

                    <div style={{ ...fieldStyle, marginTop: 12 }}>
                        <label style={labelStyle}>Address</label>
                        <div style={{ ...inputWrapStyle, alignItems: 'flex-start' }}>
                            <MapPin size={14} style={{ ...iconStyle, top: 11 }} />
                            <textarea rows={2} value={formData.address}
                                onChange={e => setFormData({ ...formData, address: e.target.value })}
                                placeholder="Full physical address..."
                                style={{ ...inputStyle, paddingLeft: 36, paddingTop: 10, resize: 'vertical', minHeight: 64, fontFamily: 'inherit' }} />
                        </div>
                    </div>
                </div>

                {/* ── Section: Ghana Card ── */}
                <div style={{ ...sectionStyle, borderBottom: 'none', paddingBottom: 0 }}>
                    <div style={sectionHeaderStyle}>
                        <IdCard size={13} />
                        <span>Ghana Card</span>
                        {existingGhanaCard && (
                            <span style={{
                                marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4,
                                fontSize: 10, fontWeight: 600, color: '#065f46',
                                background: '#d1fae5', padding: '2px 8px', borderRadius: 10,
                            }}>
                                <CheckCircle2 size={10} /> On file
                            </span>
                        )}
                    </div>

                    <div style={rowStyle}>
                        <div style={fieldStyle}>
                            <label style={labelStyle}>Ghana Card Number</label>
                            <div style={inputWrapStyle}>
                                <IdCard size={14} style={iconStyle} />
                                <input type="text" value={ghanaCardNumber}
                                    onChange={e => setGhanaCardNumber(e.target.value)}
                                    placeholder="GHA-XXXXXXXXX-X"
                                    style={{ ...inputStyle, paddingLeft: 36, fontFamily: 'var(--font-mono)', letterSpacing: '0.04em' }} />
                            </div>
                        </div>
                        <div style={fieldStyle}>
                            <label style={labelStyle}>Upload Ghana Card</label>
                            <input ref={fileInputRef} type="file"
                                accept="image/*,application/pdf"
                                onChange={handleFileChange}
                                style={{ display: 'none' }} />

                            {ghanaCardFile ? (
                                <div style={{
                                    display: 'flex', alignItems: 'center', gap: 10,
                                    padding: '9px 12px', borderRadius: 10,
                                    border: '1.5px solid #bbf7d0', background: '#f0fdf4',
                                }}>
                                    {ghanaCardPreview ? (
                                        <img src={ghanaCardPreview} alt="preview"
                                            style={{ width: 36, height: 36, objectFit: 'cover', borderRadius: 6, border: '1px solid #bbf7d0' }} />
                                    ) : (
                                        <div style={{ width: 36, height: 36, borderRadius: 6, background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <FileText size={16} style={{ color: '#16a34a' }} />
                                        </div>
                                    )}
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <p style={{ fontSize: 11, fontWeight: 600, color: '#15803d', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ghanaCardFile.name}</p>
                                        <p style={{ fontSize: 10, color: '#4ade80' }}>{(ghanaCardFile.size / 1024).toFixed(1)} KB</p>
                                    </div>
                                    <button type="button" onClick={clearFile}
                                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#16a34a', padding: 2, display: 'flex' }}>
                                        <X size={14} />
                                    </button>
                                </div>
                            ) : existingGhanaCard?.file_path ? (
                                <div style={{
                                    display: 'flex', alignItems: 'center', gap: 10,
                                    padding: '9px 12px', borderRadius: 10,
                                    border: '1.5px solid var(--slate-200)', background: 'var(--slate-50)',
                                }}>
                                    <div style={{ width: 36, height: 36, borderRadius: 6, background: '#dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <FileText size={16} style={{ color: '#2563eb' }} />
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--slate-700)' }}>{existingGhanaCard.file_name || 'Ghana Card'}</p>
                                        <p style={{ fontSize: 10, color: 'var(--slate-400)' }}>Already uploaded — select a new file to replace</p>
                                    </div>
                                    <button type="button" onClick={() => fileInputRef.current?.click()}
                                        style={{ fontSize: 10, fontWeight: 600, color: 'var(--primary-600)', background: 'none', border: 'none', cursor: 'pointer' }}>
                                        Replace
                                    </button>
                                </div>
                            ) : (
                                <button type="button" onClick={() => fileInputRef.current?.click()}
                                    style={{
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                                        width: '100%', padding: '9px 12px', borderRadius: 10,
                                        border: '1.5px dashed var(--slate-300)', background: 'var(--slate-50)',
                                        color: 'var(--slate-500)', fontSize: 11, fontWeight: 600,
                                        cursor: 'pointer', transition: 'all 0.2s',
                                    }}
                                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--primary-400)'; e.currentTarget.style.color = 'var(--primary-600)'; e.currentTarget.style.background = 'var(--primary-50)'; }}
                                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--slate-300)'; e.currentTarget.style.color = 'var(--slate-500)'; e.currentTarget.style.background = 'var(--slate-50)'; }}
                                >
                                    <Upload size={14} /> Click to upload image or PDF
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* ── Actions ── */}
                <div style={{
                    display: 'flex', gap: 10, justifyContent: 'flex-end',
                    marginTop: 24, paddingTop: 18, borderTop: '1px solid var(--slate-100)',
                }}>
                    <button type="button" onClick={onClose}
                        style={{
                            padding: '9px 20px', borderRadius: 10, border: '1.5px solid var(--slate-200)',
                            background: 'var(--card-bg)', color: 'var(--slate-600)',
                            fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                        }}>
                        Cancel
                    </button>
                    <button type="submit" disabled={loading}
                        style={{
                            padding: '9px 24px', borderRadius: 10, border: 'none',
                            background: 'linear-gradient(135deg, var(--primary-600), var(--primary-500))',
                            color: 'white', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                            display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'inherit',
                            boxShadow: '0 2px 8px rgba(6,182,212,0.25)',
                            opacity: loading ? 0.7 : 1,
                        }}>
                        {loading ? (
                            <>
                                <span style={{
                                    width: 14, height: 14, borderRadius: '50%',
                                    border: '2px solid rgba(255,255,255,0.3)',
                                    borderTopColor: 'white', animation: 'custSpin 0.6s linear infinite',
                                    display: 'inline-block',
                                }} />
                                Saving…
                            </>
                        ) : isEditing ? 'Update Customer' : 'Add Customer'}
                    </button>
                </div>
            </form>

            <style>{`
                @keyframes custSpin { to { transform: rotate(360deg); } }
                select { appearance: none; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 10px center; padding-right: 32px; cursor: pointer; }
            `}</style>
        </Modal>
    );
}

// ── Shared style objects ────────────────────────────────
const sectionStyle: React.CSSProperties = {
    borderBottom: '1px solid var(--slate-100)',
    paddingBottom: 18,
    marginBottom: 18,
};

const sectionHeaderStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 10,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.07em',
    color: 'var(--primary-600)',
    marginBottom: 14,
};

const rowStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 12,
};

const fieldStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
};

const labelStyle: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 600,
    color: 'var(--slate-600)',
    marginBottom: 6,
};

const inputWrapStyle: React.CSSProperties = {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
};

const iconStyle: React.CSSProperties = {
    position: 'absolute',
    left: 11,
    color: 'var(--slate-400)',
    pointerEvents: 'none',
    flexShrink: 0,
};

const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '9px 12px',
    borderRadius: 10,
    border: '1.5px solid var(--slate-200)',
    fontSize: 12,
    color: 'var(--slate-800)',
    background: 'var(--card-bg)',
    outline: 'none',
    fontFamily: 'inherit',
    boxSizing: 'border-box',
};
