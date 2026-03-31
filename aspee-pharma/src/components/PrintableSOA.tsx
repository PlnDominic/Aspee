import React from 'react';
import { formatCurrency } from '@/lib/currency';

interface Transaction {
    date: string;
    reference: string;
    type: 'Invoice' | 'Payment';
    amount: number;
    balance: number;
}

interface PrintableSOAProps {
    customer: any;
    transactions: Transaction[];
    summary: {
        totalInvoices: number;
        totalPayments: number;
        balance: number;
    };
    dateRange: {
        from: string;
        to: string;
    };
}

export default function PrintableSOA({ customer, transactions, summary, dateRange }: PrintableSOAProps) {
    return (
        <div 
            id="printable-soa" 
            style={{
                position: 'absolute',
                top: '-9999px',
                left: '-9999px',
                width: '210mm',
                minHeight: '297mm',
                background: 'var(--card-bg)',
                padding: '15mm',
                color: '#1e293b',
                fontFamily: 'Arial, sans-serif',
                boxSizing: 'border-box',
                fontSize: '10pt',
                lineHeight: 1.4
            }}
        >
            {/* Header */}
            <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'flex-start',
                borderBottom: '3px solid #0ea5e9', 
                paddingBottom: '10px',
                marginBottom: '20px'
            }}>
                <div>
                    <h1 style={{ margin: 0, fontSize: '18pt', fontWeight: 800, color: '#0f172a' }}>
                        ASPEE PHARMACEUTICALS
                    </h1>
                    <p style={{ margin: '4px 0 0 0', fontSize: '9pt', color: '#64748b' }}>
                        123 Industrial Area, Accra, Ghana
                    </p>
                    <p style={{ margin: 0, fontSize: '9pt', color: '#64748b' }}>
                        Phone: +233 20 123 4567 | Email: info@aspeepharma.com
                    </p>
                </div>
                <div style={{ textAlign: 'right' }}>
                    <h2 style={{ margin: 0, fontSize: '16pt', fontWeight: 700, color: '#0ea5e9', textTransform: 'uppercase' }}>
                        Statement of Account
                    </h2>
                    <p style={{ margin: '4px 0 0 0', fontSize: '9pt', color: '#64748b' }}>
                        Period: {dateRange.from} - {dateRange.to}
                    </p>
                    <p style={{ margin: 0, fontSize: '9pt', color: '#64748b' }}>
                        Generated: {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </p>
                </div>
            </div>

            {/* Customer Details */}
            <div style={{ 
                background: '#f8fafc', 
                padding: '12px', 
                borderRadius: '6px',
                marginBottom: '20px',
                border: '1px solid #e2e8f0'
            }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <tbody>
                        <tr>
                            <td style={{ padding: '4px 0', width: '120px', fontWeight: 600, color: '#475569' }}>Customer Name:</td>
                            <td style={{ padding: '4px 0', fontWeight: 700, color: '#0f172a' }}>{customer.name}</td>
                            <td style={{ padding: '4px 0', width: '100px', fontWeight: 600, color: '#475569' }}>Route:</td>
                            <td style={{ padding: '4px 0', color: '#0f172a' }}>{customer.route || 'N/A'}</td>
                        </tr>
                        <tr>
                            <td style={{ padding: '4px 0', fontWeight: 600, color: '#475569' }}>Contact:</td>
                            <td style={{ padding: '4px 0', color: '#0f172a' }}>{customer.phone || customer.email || 'N/A'}</td>
                            <td style={{ padding: '4px 0', fontWeight: 600, color: '#475569' }}>Payment Terms:</td>
                            <td style={{ padding: '4px 0', color: '#0f172a' }}>{customer.payment_terms || 'N/A'}</td>
                        </tr>
                        <tr>
                            <td style={{ padding: '4px 0', fontWeight: 600, color: '#475569' }}>Credit Limit:</td>
                            <td style={{ padding: '4px 0', color: '#0f172a' }}>{formatCurrency(customer.credit_limit || 0)}</td>
                            <td style={{ padding: '4px 0', fontWeight: 600, color: '#475569' }}>Current Balance:</td>
                            <td style={{ padding: '4px 0', fontWeight: 700, color: summary.balance > 0 ? '#dc2626' : '#16a34a' }}>
                                {formatCurrency(summary.balance)}
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>

            {/* Transactions Table */}
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px' }}>
                <thead>
                    <tr style={{ background: '#0f172a' }}>
                        <th style={{ padding: '8px', textAlign: 'left', color: 'white', fontSize: '9pt', fontWeight: 600 }}>DATE</th>
                        <th style={{ padding: '8px', textAlign: 'left', color: 'white', fontSize: '9pt', fontWeight: 600 }}>REFERENCE</th>
                        <th style={{ padding: '8px', textAlign: 'left', color: 'white', fontSize: '9pt', fontWeight: 600 }}>TYPE</th>
                        <th style={{ padding: '8px', textAlign: 'right', color: 'white', fontSize: '9pt', fontWeight: 600 }}>DEBIT</th>
                        <th style={{ padding: '8px', textAlign: 'right', color: 'white', fontSize: '9pt', fontWeight: 600 }}>CREDIT</th>
                        <th style={{ padding: '8px', textAlign: 'right', color: 'white', fontSize: '9pt', fontWeight: 600 }}>BALANCE</th>
                    </tr>
                </thead>
                <tbody>
                    {transactions.length === 0 ? (
                        <tr>
                            <td colSpan={6} style={{ padding: '20px', textAlign: 'center', color: '#64748b' }}>
                                No transactions found for this period
                            </td>
                        </tr>
                    ) : (
                        transactions.map((txn, idx) => (
                            <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                                <td style={{ padding: '8px', fontSize: '9pt' }}>{txn.date}</td>
                                <td style={{ padding: '8px', fontSize: '9pt', fontFamily: 'monospace' }}>{txn.reference}</td>
                                <td style={{ padding: '8px', fontSize: '9pt' }}>
                                    <span style={{
                                        padding: '2px 6px',
                                        borderRadius: '3px',
                                        fontSize: '8pt',
                                        fontWeight: 600,
                                        background: txn.type === 'Invoice' ? '#fef2f2' : '#f0fdf4',
                                        color: txn.type === 'Invoice' ? '#dc2626' : '#16a34a'
                                    }}>
                                        {txn.type}
                                    </span>
                                </td>
                                <td style={{ padding: '8px', textAlign: 'right', fontSize: '9pt', color: txn.type === 'Invoice' ? '#dc2626' : '#94a3b8' }}>
                                    {txn.type === 'Invoice' ? formatCurrency(txn.amount) : '-'}
                                </td>
                                <td style={{ padding: '8px', textAlign: 'right', fontSize: '9pt', color: txn.type === 'Payment' ? '#16a34a' : '#94a3b8' }}>
                                    {txn.type === 'Payment' ? formatCurrency(txn.amount) : '-'}
                                </td>
                                <td style={{ padding: '8px', textAlign: 'right', fontSize: '9pt', fontWeight: 600, color: txn.balance < 0 ? '#dc2626' : '#0f172a' }}>
                                    {formatCurrency(txn.balance)}
                                </td>
                            </tr>
                        ))
                    )}
                </tbody>
            </table>

            {/* Summary Section */}
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <div style={{ 
                    width: '250px', 
                    background: '#f8fafc', 
                    padding: '12px', 
                    borderRadius: '6px',
                    border: '1px solid #e2e8f0'
                }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <tbody>
                            <tr>
                                <td style={{ padding: '4px 0', fontSize: '10pt', color: '#475569' }}>Total Invoices:</td>
                                <td style={{ padding: '4px 0', textAlign: 'right', fontSize: '10pt', fontWeight: 600, color: '#dc2626' }}>
                                    {formatCurrency(summary.totalInvoices)}
                                </td>
                            </tr>
                            <tr>
                                <td style={{ padding: '4px 0', fontSize: '10pt', color: '#475569' }}>Total Payments:</td>
                                <td style={{ padding: '4px 0', textAlign: 'right', fontSize: '10pt', fontWeight: 600, color: '#16a34a' }}>
                                    {formatCurrency(summary.totalPayments)}
                                </td>
                            </tr>
                            <tr style={{ borderTop: '2px solid #0f172a' }}>
                                <td style={{ padding: '8px 0 4px 0', fontSize: '11pt', fontWeight: 700, color: '#0f172a' }}>Balance Due:</td>
                                <td style={{ padding: '8px 0 4px 0', textAlign: 'right', fontSize: '11pt', fontWeight: 700, color: summary.balance > 0 ? '#dc2626' : '#16a34a' }}>
                                    {formatCurrency(summary.balance)}
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Footer */}
            <div style={{ 
                marginTop: '30px', 
                paddingTop: '15px', 
                borderTop: '1px solid #e2e8f0',
                textAlign: 'center',
                fontSize: '8pt',
                color: '#94a3b8'
            }}>
                <p style={{ margin: 0 }}>This statement is computer-generated and does not require a signature.</p>
                <p style={{ margin: '4px 0 0 0' }}>For inquiries, please contact our accounts department.</p>
            </div>
        </div>
    );
}
