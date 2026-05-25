import React from 'react';
import { formatCurrency } from '@/lib/currency';

interface PrintablePayslipProps {
    payroll: any;
}

export default function PrintablePayslip({ payroll }: PrintablePayslipProps) {
    if (!payroll) return null;

    const earnings = [
        { label: 'Basic Salary', amount: payroll.basic_salary || 0 },
        { label: 'Overtime', amount: payroll.overtime_pay || 0 },
        { label: 'Allowances', amount: payroll.allowances || 0 },
        { label: 'Bonuses', amount: payroll.bonuses || 0 },
    ].filter(e => e.amount > 0);

    const deductions = [
        { label: 'PAYE Tax', amount: payroll.paye_tax || 0 },
        { label: 'Social Security (SSNIT)', amount: payroll.ssnit_contribution || 0 },
        { label: 'Health Insurance', amount: payroll.health_insurance || 0 },
        { label: 'Other Deductions', amount: payroll.other_deductions || 0 },
    ].filter(d => d.amount > 0);

    const totalEarnings = earnings.reduce((sum, e) => sum + e.amount, 0);
    const totalDeductions = deductions.reduce((sum, d) => sum + d.amount, 0);
    const netPay = payroll.net_pay || (totalEarnings - totalDeductions);

    return (
        <div id="printable-payslip" style={{
            position: 'absolute',
            top: '-9999px',
            left: '-9999px',
            width: '210mm',
            minHeight: '297mm',
            background: '#ffffff',
            padding: '20mm',
            color: 'black',
            fontFamily: 'sans-serif',
            boxSizing: 'border-box'
        }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #334155', paddingBottom: '10mm', marginBottom: '10mm' }}>
                <div>
                    <h1 style={{ margin: 0, fontSize: '24pt', fontWeight: 800, color: '#0f172a' }}>ASPEE PHARMACEUTICALS</h1>
                    <p style={{ margin: '2mm 0 0 0', fontSize: '10pt', color: '#475569' }}>123 Industrial Area, Accra, Ghana</p>
                    <p style={{ margin: 0, fontSize: '10pt', color: '#475569' }}>Phone: +233 20 123 4567 | Email: info@aspeepharma.com</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                    <h2 style={{ margin: 0, fontSize: '20pt', fontWeight: 700, color: '#7c3aed', textTransform: 'uppercase' }}>Payslip</h2>
                    <p style={{ margin: '2mm 0 0 0', fontSize: '10pt', fontWeight: 600 }}>Period: {payroll.period || 'N/A'}</p>
                    <p style={{ margin: 0, fontSize: '10pt' }}>Pay Date: {payroll.pay_date ? new Date(payroll.pay_date).toLocaleDateString() : '-'}</p>
                </div>
            </div>

            {/* Employee Info */}
            <div style={{ display: 'flex', gap: '20mm', marginBottom: '10mm', padding: '6mm', background: '#f8fafc', borderRadius: 8 }}>
                <div style={{ flex: 1 }}>
                    <h3 style={{ margin: '0 0 2mm 0', fontSize: '11pt', fontWeight: 700, color: '#334155', textTransform: 'uppercase' }}>Employee Details:</h3>
                    <p style={{ margin: 0, fontSize: '14pt', fontWeight: 700 }}>{payroll.employee_name || 'N/A'}</p>
                    <table style={{ width: '100%', fontSize: '10pt', marginTop: '2mm' }}>
                        <tbody>
                            <tr>
                                <td style={{ padding: '1mm 0', color: '#475569' }}>Employee ID:</td>
                                <td style={{ padding: '1mm 0', fontFamily: 'monospace' }}>{payroll.employee_id_number || '-'}</td>
                            </tr>
                            <tr>
                                <td style={{ padding: '1mm 0', color: '#475569' }}>Role:</td>
                                <td style={{ padding: '1mm 0' }}>{payroll.role || '-'}</td>
                            </tr>
                            <tr>
                                <td style={{ padding: '1mm 0', color: '#475569' }}>Department:</td>
                                <td style={{ padding: '1mm 0' }}>{payroll.department || '-'}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                <div style={{ flex: 1 }}>
                    <h3 style={{ margin: '0 0 2mm 0', fontSize: '11pt', fontWeight: 700, color: '#334155', textTransform: 'uppercase' }}>Payment Summary:</h3>
                    <table style={{ width: '100%', fontSize: '10pt' }}>
                        <tbody>
                            <tr>
                                <td style={{ padding: '1mm 0', color: '#475569' }}>Gross Pay:</td>
                                <td style={{ padding: '1mm 0', fontWeight: 600 }}>{formatCurrency(payroll.gross_pay || totalEarnings)}</td>
                            </tr>
                            <tr>
                                <td style={{ padding: '1mm 0', color: '#475569' }}>Total Deductions:</td>
                                <td style={{ padding: '1mm 0', fontWeight: 600, color: '#dc2626' }}>- {formatCurrency(totalDeductions)}</td>
                            </tr>
                            <tr style={{ borderTop: '2px solid #334155' }}>
                                <td style={{ padding: '2mm 0', fontWeight: 700, fontSize: '12pt' }}>NET PAY:</td>
                                <td style={{ padding: '2mm 0', fontWeight: 800, fontSize: '14pt', color: '#059669' }}>{formatCurrency(netPay)}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Earnings & Deductions Tables */}
            <div style={{ display: 'flex', gap: '10mm', marginBottom: '10mm' }}>
                {/* Earnings */}
                <div style={{ flex: 1 }}>
                    <h3 style={{ margin: '0 0 3mm 0', fontSize: '11pt', fontWeight: 700, color: '#059669', textTransform: 'uppercase' }}>Earnings</h3>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10pt' }}>
                        <tbody>
                            {earnings.map((item, idx) => (
                                <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                                    <td style={{ padding: '2mm 0' }}>{item.label}</td>
                                    <td style={{ padding: '2mm 0', textAlign: 'right', fontWeight: 600 }}>{formatCurrency(item.amount)}</td>
                                </tr>
                            ))}
                            <tr style={{ borderTop: '2px solid #059669' }}>
                                <td style={{ padding: '2mm 0', fontWeight: 700 }}>Total Earnings</td>
                                <td style={{ padding: '2mm 0', textAlign: 'right', fontWeight: 700, color: '#059669' }}>{formatCurrency(totalEarnings)}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                {/* Deductions */}
                <div style={{ flex: 1 }}>
                    <h3 style={{ margin: '0 0 3mm 0', fontSize: '11pt', fontWeight: 700, color: '#dc2626', textTransform: 'uppercase' }}>Deductions</h3>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10pt' }}>
                        <tbody>
                            {deductions.map((item, idx) => (
                                <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                                    <td style={{ padding: '2mm 0' }}>{item.label}</td>
                                    <td style={{ padding: '2mm 0', textAlign: 'right', fontWeight: 600, color: '#dc2626' }}>- {formatCurrency(item.amount)}</td>
                                </tr>
                            ))}
                            <tr style={{ borderTop: '2px solid #dc2626' }}>
                                <td style={{ padding: '2mm 0', fontWeight: 700 }}>Total Deductions</td>
                                <td style={{ padding: '2mm 0', textAlign: 'right', fontWeight: 700, color: '#dc2626' }}>- {formatCurrency(totalDeductions)}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Footer */}
            <div style={{ marginTop: 'auto', borderTop: '1px solid #cbd5e1', paddingTop: '5mm' }}>
                <p style={{ margin: 0, fontSize: '9pt', color: '#475569', textAlign: 'center' }}>
                    This is a computer-generated payslip. For queries, please contact HR department.
                </p>
                <p style={{ margin: '2mm 0 0 0', fontSize: '8pt', color: '#94a3b8', textAlign: 'center' }}>
                    Generated by Aspee ERP on {new Date().toLocaleString()}
                </p>
            </div>
        </div>
    );
}
