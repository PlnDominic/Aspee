'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Modal from './Modal';
import { 
    Send, 
    Paperclip, 
    X, 
    Calendar, 
    FileText, 
    Info, 
    Plus, 
    Trash2,
    Save,
    ClipboardList,
    TrendingUp,
    AlertTriangle,
    Target,
    Link as LinkIcon,
    Layers,
    Activity,
    CheckCircle2,
    DollarSign,
    Users,
    Scale,
    ShoppingCart,
    ShieldCheck,
    Lock,
    Percent
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useCurrentUser } from '@/lib/hooks';
import { toast } from 'sonner';

type AttachmentItem = { name: string; url: string };

interface SendToMDModalProps {
    isOpen: boolean;
    onClose: () => void;
    department: string;
}

type DepartmentField = {
    key: string;
    label: string;
    icon: React.ElementType;
    type: 'text' | 'number' | 'percentage';
    placeholder?: string;
};

const DEPARTMENT_PROMPTS: Record<string, { summary: string; nextPlan: string }> = {
    'QA': {
        summary: 'Total batches tested, major quality trends, and compliance status.',
        nextPlan: 'Upcoming audits, validation schedules, and stability testing goals.'
    },
    'Production': {
        summary: 'Total output vs target, yield percentages, and downtime summary.',
        nextPlan: 'Maintenance schedules, new batch launches, and output targets.'
    },
    'Accounting': {
        summary: 'Cash flow status, major collections, and budget variance overview.',
        nextPlan: 'Payroll processing, financial reporting deadlines, and vendor payments.'
    },
    'HR': {
        summary: 'Headcount changes, recruitment status, and employee morale overview.',
        nextPlan: 'Appraisal cycles, welfare programs, and recruitment drives.'
    },
    'Stores': {
        summary: 'Stock variance report, inventory turnover, and warehouse updates.',
        nextPlan: 'Replenishment orders, stock re-organization, and disposal of expired goods.'
    },
    'Sales': {
        summary: 'Sales targets vs actuals, market share updates, and top customer status.',
        nextPlan: 'Promotional campaigns, client visits, and seasonal sales strategies.'
    },
    'Purchasing': {
        summary: 'Procurement cycle time, vendor performance, and price trends.',
        nextPlan: 'L/C openings, bulk purchase planning, and vendor audits.'
    },
    'Internal Audit': {
        summary: 'Audit coverage this week, critical findings, and risk assessment updates.',
        nextPlan: 'Follow-up on audit remediations, new department audit cycles, and surprise checks.'
    },
    'Compliance': {
        summary: 'Status of regulatory filings, license renewals, and legal updates.',
        nextPlan: 'Document submissions, external audit preparations, and compliance training.'
    }
};

const Clock = (props: any) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

const DEPARTMENT_FIELDS: Record<string, DepartmentField[]> = {
    'QA': [
        { key: 'pending_ipc', label: 'Pending IPC', icon: Activity, type: 'number', placeholder: '0' },
        { key: 'pending_finished', label: 'Pending Finished Analysis', icon: CheckCircle2, type: 'number', placeholder: '0' },
        { key: 'pending_materials', label: 'Pending Raw/Pack Materials', icon: Layers, type: 'number', placeholder: '0' },
    ],
    'Production': [
        { key: 'active_orders', label: 'Active Orders', icon: Activity, type: 'number', placeholder: '0' },
        { key: 'completed_month', label: 'Completed This Month', icon: CheckCircle2, type: 'number', placeholder: '0' },
        { key: 'yield_avg', label: 'Average Yield %', icon: Percent, type: 'percentage', placeholder: '98.5' },
    ],
    'Sales': [
        { key: 'weekly_revenue', label: 'Weekly Revenue (GHS)', icon: DollarSign, type: 'number', placeholder: '0.00' },
        { key: 'outstanding', label: 'Outstanding Invoices', icon: AlertTriangle, type: 'number', placeholder: '0' },
        { key: 'paid_this_week', label: 'Paid This Week', icon: CheckCircle2, type: 'number', placeholder: '0' },
    ],
    'HR': [
        { key: 'active_headcount', label: 'Active Employees', icon: Users, type: 'number' },
        { key: 'pending_recv', label: 'Pending Recruitments', icon: ClipboardList, type: 'number' },
        { key: 'morale_score', label: 'Staff Morale (1-10)', icon: Target, type: 'number', placeholder: '1-10' },
    ],
    'Accounting': [
        { key: 'bank_balance', label: 'Current Bank Balance', icon: DollarSign, type: 'number' },
        { key: 'weekly_debits', label: 'Total Weekly Debits', icon: TrendingUp, type: 'number' },
        { key: 'weekly_credits', label: 'Total Weekly Credits', icon: Scale, type: 'number' },
    ],
    'Stores': [
        { key: 'low_stock', label: 'Low Stock Items', icon: AlertTriangle, type: 'number' },
        { key: 'out_of_stock', label: 'Out of Stock Items', icon: X, type: 'number' },
        { key: 'total_units', label: 'Total Units in Stock', icon: Layers, type: 'number' },
    ],
    'Purchasing': [
        { key: 'new_pos', label: 'New POs Issued', icon: ShoppingCart, type: 'number' },
        { key: 'pending_pos', label: 'Pending PO Approvals', icon: Clock, type: 'number' },
        { key: 'total_po_value', label: 'Total PO Value', icon: DollarSign, type: 'number' },
    ],
    'Internal Audit': [
        { key: 'risks_identified', label: 'New Risks Identified', icon: AlertTriangle, type: 'number' },
        { key: 'closed_inv', label: 'Closed Investigations', icon: ShieldCheck, type: 'number' },
        { key: 'follow_up', label: 'Follow-up Completion %', icon: Percent, type: 'percentage' },
    ],
    'Compliance': [
        { key: 'expiring_licenses', label: 'Expiring Licenses', icon: Lock, type: 'number' },
        { key: 'filings_status', label: 'Regulatory Filings %', icon: Percent, type: 'percentage' },
        { key: 'audit_prep', label: 'Audit Readiness %', icon: ShieldCheck, type: 'percentage' },
    ]
};

function getWeekRange(date = new Date()) {
    const current = new Date(date);
    const day = current.getDay();
    const diffToMonday = day === 0 ? -6 : 1 - day;
    const weekStart = new Date(current);
    weekStart.setDate(current.getDate() + diffToMonday);
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);
    return { weekStart, weekEnd };
}

function toInputDate(date: Date) {
    return date.toISOString().split('T')[0];
}


export default function SendToMDModal({ isOpen, onClose, department }: SendToMDModalProps) {
    const { data: currentUser } = useCurrentUser();
    const { weekStart, weekEnd } = useMemo(() => getWeekRange(), []);
    
    const [weekStartDate, setWeekStartDate] = useState(toInputDate(weekStart));
    const [weekEndDate, setWeekEndDate] = useState(toInputDate(weekEnd));
    const [summary, setSummary] = useState('');
    const [nextWeekPlan, setNextWeekPlan] = useState('');
    const [attachments, setAttachments] = useState<AttachmentItem[]>([]);
    const [departmentData, setDepartmentData] = useState<Record<string, string>>({});
    
    const [attachmentName, setAttachmentName] = useState('');
    const [attachmentUrl, setAttachmentUrl] = useState('');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!isOpen) {
            setSummary('');
            setNextWeekPlan('');
            setAttachments([]);
            setDepartmentData({});
        }
    }, [isOpen]);

    const prompts = DEPARTMENT_PROMPTS[department] || {
        summary: "Summarize the department's key outcomes and performance highlights...",
        nextPlan: "Describe priorities and planned actions for next week..."
    };

    const deptFields = DEPARTMENT_FIELDS[department] || [];

    const handleDeptFieldChange = (key: string, value: string) => {
        setDepartmentData(prev => ({ ...prev, [key]: value }));
    };

    const addAttachment = () => {
        if (!attachmentName.trim() || !attachmentUrl.trim()) {
            toast.error('Enter both an attachment name and URL.');
            return;
        }
        setAttachments((prev) => [...prev, { name: attachmentName.trim(), url: attachmentUrl.trim() }]);
        setAttachmentName('');
        setAttachmentUrl('');
    };

    const removeAttachment = (index: number) => {
        setAttachments((prev) => prev.filter((_, i) => i !== index));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!summary.trim()) {
            toast.error('Please enter the Executive Summary before submitting.');
            return;
        }
        
        setSaving(false);
        setSaving(true);
        try {
            // Enrich summary with department data if present
            let enrichedSummary = summary.trim();
            if (Object.keys(departmentData).length > 0) {
                const metricsText = deptFields
                    .map(f => `• ${f.label}: ${departmentData[f.key] || 'N/A'}${f.type === 'percentage' ? '%' : ''}`)
                    .join('\n');
                enrichedSummary = `[DEPARTMENT METRICS]\n${metricsText}\n\n[EXECUTIVE SUMMARY]\n${enrichedSummary}`;
            }

            const payload = {
                department,
                report_week_start: weekStartDate,
                report_week_end: weekEndDate,
                summary: enrichedSummary,
                next_week_plan: nextWeekPlan.trim() || null,
                submitted_by: currentUser?.name || currentUser?.email || 'Unknown user',
                submitted_by_email: currentUser?.email || null,
                submitted_at: new Date().toISOString(),
                status: 'Submitted',
                read_status: 'Unread',
                attachments,
                // If the column exists, we pass the object too
                department_data: departmentData
            };

            const { error: saveError } = await supabase
                .from('weekly_reports')
                .upsert([payload], { onConflict: 'department,report_week_start' });

            if (saveError) {
                // If it fails because of department_data column, retry without it
                if (saveError.code === '42703') { // Undefined column
                    const { department_data, ...legacyPayload } = payload;
                    const { error: retryError } = await supabase
                        .from('weekly_reports')
                        .upsert([legacyPayload], { onConflict: 'department,report_week_start' });
                    if (retryError) throw retryError;
                } else {
                    throw saveError;
                }
            }

            await fetch('/api/weekly-report', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ mode: 'department-submission', report: payload }),
            });

            toast.success('Weekly report submitted to the Managing Director successfully!');
            onClose();
        } catch (error: any) {
            toast.error(error.message || 'Failed to submit weekly report');
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Weekly Management Report"
            subtitle={`Consolidated weekly performance briefing for ${department}`}
            width={850}
        >
            <form onSubmit={handleSubmit} className="report-form">
                <div className="form-grid">
                    {/* Identification Section */}
                    <div className="section-title full-width">Reporting Identity & Period</div>
                    
                    <div className="form-field">
                        <label>Department</label>
                        <div className="input-wrapper disabled">
                            <Target size={16} className="icon" />
                            <input value={department} readOnly />
                        </div>
                    </div>

                    <div className="form-field">
                        <label>Report Week Range</label>
                        <div className="input-wrapper disabled" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 12px' }}>
                            <Calendar size={16} style={{ color: 'var(--slate-400)' }} />
                            <span style={{ fontSize: 11, color: 'var(--slate-600)', fontWeight: 600 }}>
                                {new Date(weekStartDate).toLocaleDateString()} - {new Date(weekEndDate).toLocaleDateString()}
                            </span>
                        </div>
                    </div>

                    {/* Department Specific KPIs */}
                    {deptFields.length > 0 && (
                        <>
                            <div className="section-title full-width" style={{ marginTop: 12 }}>Department Key Metrics</div>
                            {deptFields.map((field) => (
                                <div key={field.key} className="form-field">
                                    <label>{field.label}</label>
                                    <div className="input-wrapper">
                                        <field.icon size={16} className="icon" />
                                        <input 
                                            type={field.type === 'text' ? 'text' : 'number'}
                                            step={field.type === 'percentage' ? '0.1' : '1'}
                                            value={departmentData[field.key] || ''}
                                            onChange={(e) => handleDeptFieldChange(field.key, e.target.value)}
                                            placeholder={field.placeholder || (field.type === 'percentage' ? '0.0' : '0')}
                                        />
                                        {field.type === 'percentage' && (
                                            <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 11, fontWeight: 700, color: 'var(--slate-400)' }}>%</span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </>
                    )}

                    {/* Content Section */}
                    <div className="section-title full-width" style={{ marginTop: 12 }}>Performance Details</div>

                    <div className="form-field full-width">
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Info size={14} color="var(--primary-600)" />
                            Executive Summary *
                        </label>
                        <div className="input-wrapper">
                            <ClipboardList size={16} className="icon" style={{ top: 16 }} />
                            <textarea 
                                required
                                value={summary} 
                                onChange={(e) => setSummary(e.target.value)}
                                placeholder={prompts.summary}
                                rows={3}
                            />
                        </div>
                    </div>


                    <div className="form-field full-width">
                        <label>Plan for Upcoming Week</label>
                        <div className="input-wrapper">
                            <FileText size={16} className="icon" style={{ top: 16 }} />
                            <textarea 
                                value={nextWeekPlan} 
                                onChange={(e) => setNextWeekPlan(e.target.value)}
                                placeholder={prompts.nextPlan}
                                rows={2}
                            />
                        </div>
                    </div>

                    {/* Attachments Section */}
                    <div className="section-title full-width" style={{ marginTop: 12 }}>Supporting Documents & Links</div>
                    
                    <div className="attachments-entry full-width">
                        <div className="entry-grid">
                            <div className="form-field">
                                <label>Link Title</label>
                                <div className="input-wrapper">
                                    <FileText size={14} className="icon" />
                                    <input 
                                        value={attachmentName} 
                                        onChange={(e) => setAttachmentName(e.target.value)} 
                                        placeholder="e.g. Weekly KPI Sheet" 
                                    />
                                </div>
                            </div>
                            <div className="form-field">
                                <label>URL Address</label>
                                <div className="input-wrapper">
                                    <LinkIcon size={14} className="icon" />
                                    <input 
                                        value={attachmentUrl} 
                                        onChange={(e) => setAttachmentUrl(e.target.value)} 
                                        placeholder="https://google.drive/..." 
                                    />
                                </div>
                            </div>
                            <button type="button" onClick={addAttachment} className="btn-add-attachment">
                                <Plus size={16} /> Add
                            </button>
                        </div>

                        {attachments.length > 0 && (
                            <div className="attachments-list">
                                {attachments.map((item, i) => (
                                    <div key={i} className="attachment-chip">
                                        <div className="chip-info">
                                            <Paperclip size={12} />
                                            <span>{item.name}</span>
                                        </div>
                                        <button type="button" onClick={() => removeAttachment(i)} className="btn-remove-chip">
                                            <X size={14} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <div className="modal-actions">
                    <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
                    <button type="submit" disabled={saving} className="btn-primary">
                        <Send size={16} />
                        {saving ? 'Sending Report...' : 'Send to Managing Director'}
                    </button>
                </div>
            </form>

            <style>{`
                .report-form {
                    padding: 8px 4px;
                }
                .form-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 16px;
                }
                .full-width {
                    grid-column: span 2;
                }
                .section-title {
                    font-size: 11px;
                    font-weight: 700;
                    color: var(--slate-800);
                    border-bottom: 2px solid var(--slate-100);
                    padding-bottom: 8px;
                    margin-bottom: 4px;
                }
                .form-field label {
                    display: block;
                    font-size: 11px;
                    font-weight: 600;
                    color: var(--slate-600);
                    margin-bottom: 6px;
                }
                .input-wrapper {
                    position: relative;
                }
                .input-wrapper .icon {
                    position: absolute;
                    left: 12px;
                    top: 50%;
                    transform: translateY(-50%);
                    color: var(--slate-400);
                }
                .input-wrapper.disabled {
                    opacity: 0.8;
                    background: var(--slate-50);
                    border-radius: 10px;
                    border: 1.5px solid var(--slate-100);
                }
                .input-wrapper input, textarea {
                    width: 100%;
                    padding: 10px 12px 10px 38px;
                    border: 1.5px solid var(--slate-200);
                    border-radius: 10px;
                    font-size: 11px;
                    outline: none;
                    transition: all 0.2s;
                    background: var(--card-bg);
                    color: var(--slate-800);
                }
                .input-wrapper.disabled input {
                    border: none;
                    background: transparent;
                }
                textarea {
                    padding-top: 10px;
                    resize: vertical;
                    min-height: 40px;
                    font-family: inherit;
                }
                .input-wrapper input:focus, textarea:focus {
                    border-color: var(--primary-500);
                    box-shadow: 0 0 0 4px var(--primary-50);
                }
                
                .attachments-entry {
                    background: var(--slate-50);
                    padding: 16px;
                    border-radius: 12px;
                    border: 1px dashed var(--slate-200);
                }
                .entry-grid {
                    display: grid;
                    grid-template-columns: 1fr 1.5fr auto;
                    gap: 12px;
                    align-items: flex-end;
                }
                .btn-add-attachment {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    padding: 10px 20px;
                    background: var(--primary-600);
                    color: white;
                    border: none;
                    border-radius: 8px;
                    font-size: 11px;
                    font-weight: 700;
                    cursor: pointer;
                    height: 38px;
                    transition: all 0.2s;
                }
                .btn-add-attachment:hover {
                    background: var(--primary-700);
                    transform: translateY(-1px);
                }

                .attachments-list {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 8px;
                    margin-top: 12px;
                }
                .attachment-chip {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding: 6px 10px;
                    background: white;
                    border-radius: 8px;
                    border: 1px solid var(--slate-200);
                    box-shadow: 0 1px 2px rgba(0,0,0,0.05);
                }
                .chip-info {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    color: var(--slate-700);
                    font-size: 10px;
                    font-weight: 600;
                }
                .btn-remove-chip {
                    color: var(--slate-400);
                    background: none;
                    border: none;
                    cursor: pointer;
                    padding: 2px;
                    display: flex;
                    align-items: center;
                }
                .btn-remove-chip:hover {
                    color: var(--danger);
                }

                .modal-actions {
                    display: flex;
                    justify-content: flex-end;
                    gap: 12px;
                    margin-top: 24px;
                    padding-top: 20px;
                    border-top: 1.5px solid var(--slate-100);
                }
                .btn-secondary {
                    padding: 10px 20px;
                    border-radius: 10px;
                    border: 1.5px solid var(--slate-200);
                    background: var(--card-bg);
                    color: var(--slate-600);
                    font-size: 11px;
                    font-weight: 600;
                    cursor: pointer;
                }
                .btn-primary {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding: 10px 24px;
                    border-radius: 10px;
                    border: none;
                    background: linear-gradient(135deg, #0f766e, #14b8a6);
                    color: white;
                    font-size: 11px;
                    font-weight: 700;
                    cursor: pointer;
                    box-shadow: 0 4px 12px rgba(20, 184, 166, 0.2);
                    transition: all 0.2s;
                }
                .btn-primary:hover:not(:disabled) {
                    transform: translateY(-1px);
                    box-shadow: 0 6px 16px rgba(20, 184, 166, 0.3);
                }
                .btn-primary:disabled {
                    opacity: 0.6;
                    cursor: not-allowed;
                }
            `}</style>
        </Modal>
    );
}
