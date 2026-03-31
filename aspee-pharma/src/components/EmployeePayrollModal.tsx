'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Modal from './Modal';
import {
    User,
    Hash,
    Briefcase,
    Building2,
    Banknote,
    Calendar,
    CreditCard,
    FileText,
    Activity,
    Save,
} from 'lucide-react';
import { formatCurrency, CURRENCY_SYMBOL } from '@/lib/currency';

interface EmployeePayrollModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: (data: any) => Promise<void>;
    record?: any;
    availableStatuses?: string[];
}

const departments = ['Production', 'Sales', 'Administration', 'Stores', 'Quality Assurance', 'Accounts', 'Human Resources', 'Internal Audit'];
const paymentMethods = ['Bank Transfer', 'Cash', 'Mobile Money'];
const ALL_STATUSES = ['Draft', 'Approved by HR', 'Processed', 'Paid'];

const getDefaultPayPeriod = () => {
    const now = new Date();
    return now.toLocaleString('en-US', { month: 'long', year: 'numeric' });
};

export default function EmployeePayrollModal({ isOpen, onClose, onSuccess, record, availableStatuses }: EmployeePayrollModalProps) {
    const statuses = availableStatuses ?? ALL_STATUSES;
    const [loading, setLoading] = useState(false);

    const [employeeName, setEmployeeName] = useState('');
    const [employeeIdNumber, setEmployeeIdNumber] = useState('');
    const [role, setRole] = useState('');
    const [department, setDepartment] = useState('');
    const [grossPay, setGrossPay] = useState<number>(0);
    const [allowances, setAllowances] = useState<number>(0);
    const [deductions, setDeductions] = useState<number>(0);
    const [payeTax, setPayeTax] = useState<number>(0);
    const [payPeriod, setPayPeriod] = useState(getDefaultPayPeriod());
    const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
    const [paymentMethod, setPaymentMethod] = useState('Bank Transfer');
    const [bankName, setBankName] = useState('');
    const [accountNumber, setAccountNumber] = useState('');
    const [status, setStatus] = useState('Draft');
    const [notes, setNotes] = useState('');

    const netPay = useMemo(() => {
        return (grossPay || 0) + (allowances || 0) - (deductions || 0) - (payeTax || 0);
    }, [grossPay, allowances, deductions, payeTax]);

    const isEditing = !!record;

    useEffect(() => {
        if (record) {
            setEmployeeName(record.employee_name || '');
            setEmployeeIdNumber(record.employee_id_number || '');
            setRole(record.role || '');
            setDepartment(record.department || '');
            setGrossPay(Number(record.gross_pay) || 0);
            setAllowances(Number(record.allowances) || 0);
            setDeductions(Number(record.deductions) || 0);
            setPayeTax(Number(record.paye_tax) || 0);
            setPayPeriod(record.pay_period || getDefaultPayPeriod());
            setPaymentDate(record.payment_date || new Date().toISOString().split('T')[0]);
            setPaymentMethod(record.payment_method || 'Bank Transfer');
            setBankName(record.bank_name || '');
            setAccountNumber(record.account_number || '');
            setStatus(record.status || 'Draft');
            setNotes(record.notes || '');
        } else {
            setEmployeeName('');
            setEmployeeIdNumber('');
            setRole('');
            setDepartment('');
            setGrossPay(0);
            setAllowances(0);
            setDeductions(0);
            setPayeTax(0);
            setPayPeriod(getDefaultPayPeriod());
            setPaymentDate(new Date().toISOString().split('T')[0]);
            setPaymentMethod('Bank Transfer');
            setBankName('');
            setAccountNumber('');
            setStatus(availableStatuses?.[0] ?? 'Draft');
            setNotes('');
        }
    }, [record, isOpen]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await onSuccess({
                id: record?.id,
                employee_name: employeeName,
                employee_id_number: employeeIdNumber,
                role,
                department,
                gross_pay: grossPay,
                allowances,
                deductions,
                paye_tax: payeTax,
                net_pay: netPay,
                pay_period: payPeriod,
                payment_date: paymentDate,
                payment_method: paymentMethod,
                bank_name: bankName || null,
                account_number: accountNumber || null,
                status,
                notes: notes || null,
            });
            onClose();
        } catch (error: any) {
            console.error('Error saving payroll record:', error);
        } finally {
            setLoading(false);
        }
    };

    const parseNum = (val: string) => {
        const n = parseFloat(val);
        return isNaN(n) ? 0 : n;
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={isEditing ? 'Edit Payroll Record' : 'Add Payroll Entry'}
            subtitle={isEditing ? 'Update the payroll details below' : 'Enter employee salary details for processing'}
            width={700}
        >
            <form onSubmit={handleSubmit}>
                {/* Employee Info Section */}
                <div className="payroll-form-section">
                    <div className="payroll-form-section-header">
                        <User size={15} />
                        <span>Employee Information</span>
                    </div>

                    <div className="payroll-form-row">
                        <div className="payroll-form-field">
                            <label className="payroll-form-label">
                                Employee Name <span className="payroll-form-required">*</span>
                            </label>
                            <div className="payroll-form-input-wrapper">
                                <User size={16} className="payroll-form-input-icon" />
                                <input
                                    required
                                    type="text"
                                    value={employeeName}
                                    onChange={(e) => setEmployeeName(e.target.value)}
                                    placeholder="e.g. Kwame Asante"
                                    className="payroll-form-input has-icon"
                                />
                            </div>
                        </div>

                        <div className="payroll-form-field">
                            <label className="payroll-form-label">
                                Staff ID <span className="payroll-form-required">*</span>
                            </label>
                            <div className="payroll-form-input-wrapper">
                                <Hash size={16} className="payroll-form-input-icon" />
                                <input
                                    required
                                    type="text"
                                    value={employeeIdNumber}
                                    onChange={(e) => setEmployeeIdNumber(e.target.value)}
                                    placeholder="e.g. ASP-001"
                                    className="payroll-form-input has-icon"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="payroll-form-row">
                        <div className="payroll-form-field">
                            <label className="payroll-form-label">Role / Job Title</label>
                            <div className="payroll-form-input-wrapper">
                                <Briefcase size={16} className="payroll-form-input-icon" />
                                <input
                                    type="text"
                                    value={role}
                                    onChange={(e) => setRole(e.target.value)}
                                    placeholder="e.g. Production Manager"
                                    className="payroll-form-input has-icon"
                                />
                            </div>
                        </div>

                        <div className="payroll-form-field">
                            <label className="payroll-form-label">
                                Department <span className="payroll-form-required">*</span>
                            </label>
                            <div className="payroll-form-input-wrapper">
                                <Building2 size={16} className="payroll-form-input-icon" />
                                <select
                                    required
                                    value={department}
                                    onChange={(e) => setDepartment(e.target.value)}
                                    className="payroll-form-input has-icon"
                                >
                                    <option value="">Select Department</option>
                                    {departments.map(d => (
                                        <option key={d} value={d}>{d}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Salary Breakdown Section */}
                <div className="payroll-form-section">
                    <div className="payroll-form-section-header">
                        <Banknote size={15} />
                        <span>Salary Breakdown</span>
                    </div>

                    <div className="payroll-form-row">
                        <div className="payroll-form-field">
                            <label className="payroll-form-label">
                                Gross Pay ({CURRENCY_SYMBOL}) <span className="payroll-form-required">*</span>
                            </label>
                            <div className="payroll-form-input-wrapper">
                                <Banknote size={16} className="payroll-form-input-icon" />
                                <input
                                    required
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={grossPay || ''}
                                    onChange={(e) => setGrossPay(parseNum(e.target.value))}
                                    placeholder="0.00"
                                    className="payroll-form-input has-icon"
                                />
                            </div>
                        </div>

                        <div className="payroll-form-field">
                            <label className="payroll-form-label">Allowances ({CURRENCY_SYMBOL})</label>
                            <div className="payroll-form-input-wrapper">
                                <Banknote size={16} className="payroll-form-input-icon" />
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={allowances || ''}
                                    onChange={(e) => setAllowances(parseNum(e.target.value))}
                                    placeholder="0.00"
                                    className="payroll-form-input has-icon"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="payroll-form-row">
                        <div className="payroll-form-field">
                            <label className="payroll-form-label">Deductions ({CURRENCY_SYMBOL})</label>
                            <div className="payroll-form-input-wrapper">
                                <Banknote size={16} className="payroll-form-input-icon" />
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={deductions || ''}
                                    onChange={(e) => setDeductions(parseNum(e.target.value))}
                                    placeholder="0.00"
                                    className="payroll-form-input has-icon"
                                />
                            </div>
                        </div>

                        <div className="payroll-form-field">
                            <label className="payroll-form-label">PAYE Tax ({CURRENCY_SYMBOL})</label>
                            <div className="payroll-form-input-wrapper">
                                <Banknote size={16} className="payroll-form-input-icon" />
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={payeTax || ''}
                                    onChange={(e) => setPayeTax(parseNum(e.target.value))}
                                    placeholder="0.00"
                                    className="payroll-form-input has-icon"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Net Pay Display */}
                    <div className="payroll-net-pay-box">
                        <div className="payroll-net-pay-label">Net Pay (Auto-calculated)</div>
                        <div className="payroll-net-pay-value" style={{ color: netPay >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                            {formatCurrency(netPay)}
                        </div>
                        <div className="payroll-net-pay-formula">
                            Gross ({formatCurrency(grossPay)}) + Allowances ({formatCurrency(allowances)}) - Deductions ({formatCurrency(deductions)}) - PAYE ({formatCurrency(payeTax)})
                        </div>
                    </div>
                </div>

                {/* Payment Details Section */}
                <div className="payroll-form-section">
                    <div className="payroll-form-section-header">
                        <CreditCard size={15} />
                        <span>Payment Details</span>
                    </div>

                    <div className="payroll-form-row">
                        <div className="payroll-form-field">
                            <label className="payroll-form-label">
                                Pay Period <span className="payroll-form-required">*</span>
                            </label>
                            <div className="payroll-form-input-wrapper">
                                <Calendar size={16} className="payroll-form-input-icon" />
                                <input
                                    required
                                    type="text"
                                    value={payPeriod}
                                    onChange={(e) => setPayPeriod(e.target.value)}
                                    placeholder="e.g. March 2026"
                                    className="payroll-form-input has-icon"
                                />
                            </div>
                        </div>

                        <div className="payroll-form-field">
                            <label className="payroll-form-label">
                                Payment Date <span className="payroll-form-required">*</span>
                            </label>
                            <div className="payroll-form-input-wrapper">
                                <Calendar size={16} className="payroll-form-input-icon" />
                                <input
                                    required
                                    type="date"
                                    value={paymentDate}
                                    onChange={(e) => setPaymentDate(e.target.value)}
                                    className="payroll-form-input has-icon"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="payroll-form-row">
                        <div className="payroll-form-field">
                            <label className="payroll-form-label">
                                Payment Method <span className="payroll-form-required">*</span>
                            </label>
                            <div className="payroll-form-input-wrapper">
                                <CreditCard size={16} className="payroll-form-input-icon" />
                                <select
                                    required
                                    value={paymentMethod}
                                    onChange={(e) => setPaymentMethod(e.target.value)}
                                    className="payroll-form-input has-icon"
                                >
                                    {paymentMethods.map(m => (
                                        <option key={m} value={m}>{m}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="payroll-form-field">
                            <label className="payroll-form-label">Status</label>
                            <div className="payroll-form-input-wrapper">
                                <Activity size={16} className="payroll-form-input-icon" />
                                <select
                                    value={status}
                                    onChange={(e) => setStatus(e.target.value)}
                                    className="payroll-form-input has-icon"
                                >
                                    {statuses.map(s => (
                                        <option key={s} value={s}>{s}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>

                    <div className="payroll-form-row">
                        <div className="payroll-form-field">
                            <label className="payroll-form-label">Bank Name</label>
                            <div className="payroll-form-input-wrapper">
                                <Building2 size={16} className="payroll-form-input-icon" />
                                <input
                                    type="text"
                                    value={bankName}
                                    onChange={(e) => setBankName(e.target.value)}
                                    placeholder="e.g. GCB Bank"
                                    className="payroll-form-input has-icon"
                                />
                            </div>
                        </div>

                        <div className="payroll-form-field">
                            <label className="payroll-form-label">Account Number</label>
                            <div className="payroll-form-input-wrapper">
                                <Hash size={16} className="payroll-form-input-icon" />
                                <input
                                    type="text"
                                    value={accountNumber}
                                    onChange={(e) => setAccountNumber(e.target.value)}
                                    placeholder="e.g. 1234567890"
                                    className="payroll-form-input has-icon"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Notes Section */}
                <div className="payroll-form-section" style={{ borderBottom: 'none', paddingBottom: 0 }}>
                    <div className="payroll-form-section-header">
                        <FileText size={15} />
                        <span>Additional Notes</span>
                    </div>

                    <div className="payroll-form-field full-width">
                        <div className="payroll-form-input-wrapper textarea-wrapper">
                            <FileText size={16} className="payroll-form-input-icon textarea-icon" />
                            <textarea
                                rows={3}
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                placeholder="Any additional notes about this payroll entry..."
                                className="payroll-form-textarea has-icon"
                            />
                        </div>
                    </div>
                </div>

                {/* Actions */}
                <div className="payroll-form-actions">
                    <button
                        type="button"
                        onClick={onClose}
                        className="payroll-btn-cancel"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={loading}
                        className="payroll-btn-submit"
                    >
                        {loading ? (
                            <>
                                <span className="payroll-btn-spinner" />
                                Saving...
                            </>
                        ) : isEditing ? (
                            <>
                                <Save size={15} />
                                Update Record
                            </>
                        ) : (
                            <>
                                <Save size={15} />
                                Add Payroll Entry
                            </>
                        )}
                    </button>
                </div>
            </form>

            <style>{`
                .payroll-form-section {
                    border-bottom: 1px solid var(--slate-100);
                    padding-bottom: 20px;
                    margin-bottom: 20px;
                }

                .payroll-form-section-header {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    font-size: 11px;
                    font-weight: 600;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                    color: var(--primary-600);
                    margin-bottom: 16px;
                }

                .payroll-form-row {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 14px;
                    margin-top: 14px;
                }

                .payroll-form-row:first-of-type {
                    margin-top: 0;
                }

                .payroll-form-field {
                    display: flex;
                    flex-direction: column;
                }

                .payroll-form-field.full-width {
                    grid-column: span 2;
                }

                .payroll-form-label {
                    font-size: 11px;
                    font-weight: 500;
                    color: var(--slate-600);
                    margin-bottom: 6px;
                }

                .payroll-form-required {
                    color: var(--danger);
                    margin-left: 2px;
                }

                .payroll-form-input-wrapper {
                    position: relative;
                    display: flex;
                    align-items: center;
                }

                .payroll-form-input-wrapper.textarea-wrapper {
                    align-items: flex-start;
                }

                .payroll-form-input-icon {
                    position: absolute;
                    left: 12px;
                    color: var(--slate-400);
                    pointer-events: none;
                    transition: color 0.2s ease;
                    flex-shrink: 0;
                }

                .payroll-form-input-icon.textarea-icon {
                    top: 12px;
                }

                .payroll-form-input,
                .payroll-form-textarea {
                    width: 100%;
                    padding: 10px 14px;
                    border-radius: 10px;
                    border: 1.5px solid var(--slate-200);
                    font-size: 11px;
                    color: var(--slate-800);
                    background: var(--card-bg);
                    outline: none;
                    transition: all 0.2s ease;
                    font-family: inherit;
                }

                .payroll-form-input.has-icon,
                .payroll-form-textarea.has-icon {
                    padding-left: 38px;
                }

                .payroll-form-textarea {
                    resize: vertical;
                    min-height: 80px;
                }

                .payroll-form-input:hover,
                .payroll-form-textarea:hover {
                    border-color: var(--slate-300);
                }

                .payroll-form-input:focus,
                .payroll-form-textarea:focus {
                    border-color: var(--primary-400);
                    box-shadow: 0 0 0 3px var(--primary-50);
                }

                .payroll-form-input:focus + .payroll-form-input-icon,
                .payroll-form-input-wrapper:focus-within .payroll-form-input-icon {
                    color: var(--primary-500);
                }

                .payroll-form-input::placeholder,
                .payroll-form-textarea::placeholder {
                    color: var(--slate-400);
                }

                select.payroll-form-input {
                    appearance: none;
                    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
                    background-repeat: no-repeat;
                    background-position: right 12px center;
                    padding-right: 36px;
                    cursor: pointer;
                }

                /* Net Pay Box */
                .payroll-net-pay-box {
                    margin-top: 16px;
                    padding: 16px 20px;
                    background: var(--slate-50);
                    border-radius: 12px;
                    border: 1.5px dashed var(--slate-200);
                    text-align: center;
                }

                .payroll-net-pay-label {
                    font-size: 11px;
                    font-weight: 600;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                    color: var(--slate-500);
                    margin-bottom: 6px;
                }

                .payroll-net-pay-value {
                    font-size: 24px;
                    font-weight: 800;
                    letter-spacing: -0.02em;
                    line-height: 1.2;
                }

                .payroll-net-pay-formula {
                    font-size: 10px;
                    color: var(--slate-400);
                    margin-top: 8px;
                    line-height: 1.4;
                }

                /* Actions */
                .payroll-form-actions {
                    display: flex;
                    gap: 12px;
                    justify-content: flex-end;
                    margin-top: 24px;
                    padding-top: 20px;
                    border-top: 1px solid var(--slate-100);
                }

                .payroll-btn-cancel {
                    padding: 10px 22px;
                    border-radius: 10px;
                    border: 1.5px solid var(--slate-200);
                    background: var(--card-bg);
                    color: var(--slate-600);
                    font-size: 11px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    font-family: inherit;
                }

                .payroll-btn-cancel:hover {
                    background: var(--slate-50);
                    border-color: var(--slate-300);
                    color: var(--slate-700);
                }

                .payroll-btn-submit {
                    padding: 10px 28px;
                    border-radius: 10px;
                    border: none;
                    background: linear-gradient(135deg, var(--primary-600), var(--primary-500));
                    color: white;
                    font-size: 11px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    box-shadow: 0 2px 8px rgba(37, 99, 235, 0.3);
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    font-family: inherit;
                }

                .payroll-btn-submit:hover:not(:disabled) {
                    background: linear-gradient(135deg, var(--primary-700), var(--primary-600));
                    box-shadow: 0 4px 12px rgba(37, 99, 235, 0.4);
                    transform: translateY(-1px);
                }

                .payroll-btn-submit:active:not(:disabled) {
                    transform: translateY(0);
                }

                .payroll-btn-submit:disabled {
                    opacity: 0.7;
                    cursor: not-allowed;
                }

                .payroll-btn-spinner {
                    width: 16px;
                    height: 16px;
                    border: 2px solid rgba(255, 255, 255, 0.3);
                    border-top-color: white;
                    border-radius: 50%;
                    animation: payrollSpin 0.6s linear infinite;
                }

                @keyframes payrollSpin {
                    to { transform: rotate(360deg); }
                }

                /* Number input - hide spinners */
                .payroll-form-input[type="number"]::-webkit-outer-spin-button,
                .payroll-form-input[type="number"]::-webkit-inner-spin-button {
                    -webkit-appearance: none;
                    margin: 0;
                }

                .payroll-form-input[type="number"] {
                    -moz-appearance: textfield;
                }

                @media (max-width: 640px) {
                    .payroll-form-row {
                        grid-template-columns: 1fr;
                    }
                }
            `}</style>
        </Modal>
    );
}
