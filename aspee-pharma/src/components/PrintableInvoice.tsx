import React from 'react';
import { formatCurrency } from '@/lib/formatCurrency';

interface PrintableInvoiceProps {
    invoice: any;
}

export default function PrintableInvoice({ invoice }: PrintableInvoiceProps) {
    if (!invoice) return null;

    const subtotal = invoice.items?.reduce((sum: number, item: any) => sum + Number(item.total_price), 0) || 0;
    const tax = invoice.tax_amount || 0;
    const total = invoice.total_amount || 0;

    return (
        <div id="printable-invoice" style={{
            position: 'absolute',
            top: '-9999px',
            left: '-9999px',
            width: '210mm',         // A4 width
            minHeight: '297mm',     // A4 height
            background: 'var(--card-bg)',
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
                    <h2 style={{ margin: 0, fontSize: '20pt', fontWeight: 700, color: '#0ea5e9', textTransform: 'uppercase' }}>Invoice</h2>
                    <p style={{ margin: '2mm 0 0 0', fontSize: '10pt', fontWeight: 600 }}>Inv#: {invoice.invoice_number}</p>
                    <p style={{ margin: 0, fontSize: '10pt' }}>Date: {new Date(invoice.date).toLocaleDateString()}</p>
                    {invoice.due_date && <p style={{ margin: 0, fontSize: '10pt' }}>Due: {new Date(invoice.due_date).toLocaleDateString()}</p>}
                </div>
            </div>

            {/* Bill To */}
            <div style={{ marginBottom: '10mm' }}>
                <h3 style={{ margin: '0 0 2mm 0', fontSize: '11pt', fontWeight: 700, color: '#334155', textTransform: 'uppercase' }}>Bill To:</h3>
                <p style={{ margin: 0, fontSize: '12pt', fontWeight: 600 }}>{invoice.customer_name}</p>
                <p style={{ margin: '1mm 0 0 0', fontSize: '10pt', color: '#475569' }}>Type: {invoice.type}</p>
                <p style={{ margin: 0, fontSize: '10pt', color: '#475569' }}>Status: {invoice.status}</p>
            </div>

            {/* Line Items Table */}
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '10mm' }}>
                <thead>
                    <tr style={{ background: '#f1f5f9' }}>
                        <th style={{ padding: '3mm', textAlign: 'left', borderBottom: '1px solid #cbd5e1', fontSize: '10pt', color: '#334155' }}>Item Description</th>
                        <th style={{ padding: '3mm', textAlign: 'center', borderBottom: '1px solid #cbd5e1', fontSize: '10pt', color: '#334155' }}>Qty</th>
                        <th style={{ padding: '3mm', textAlign: 'right', borderBottom: '1px solid #cbd5e1', fontSize: '10pt', color: '#334155' }}>Unit Price</th>
                        <th style={{ padding: '3mm', textAlign: 'right', borderBottom: '1px solid #cbd5e1', fontSize: '10pt', color: '#334155' }}>Total</th>
                    </tr>
                </thead>
                <tbody>
                    {invoice.items?.map((item: any, idx: number) => (
                        <tr key={idx}>
                            <td style={{ padding: '3mm', borderBottom: '1px solid #e2e8f0', fontSize: '10pt' }}>
                                <strong>{item.product?.name}</strong><br/>
                                <span style={{ fontSize: '8pt', color: '#64748b' }}>SKU: {item.product?.sku}</span>
                            </td>
                            <td style={{ padding: '3mm', textAlign: 'center', borderBottom: '1px solid #e2e8f0', fontSize: '10pt' }}>{item.quantity}</td>
                            <td style={{ padding: '3mm', textAlign: 'right', borderBottom: '1px solid #e2e8f0', fontSize: '10pt' }}>{formatCurrency(item.unit_price, invoice.currency)}</td>
                            <td style={{ padding: '3mm', textAlign: 'right', borderBottom: '1px solid #e2e8f0', fontSize: '10pt' }}>{formatCurrency(item.total_price, invoice.currency)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>

            {/* Totals */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '15mm' }}>
                <table style={{ width: '80mm', borderCollapse: 'collapse' }}>
                    <tbody>
                        <tr>
                            <td style={{ padding: '2mm', textAlign: 'right', fontSize: '10pt', color: '#475569' }}>Subtotal:</td>
                            <td style={{ padding: '2mm', textAlign: 'right', fontSize: '11pt', fontWeight: 600 }}>{formatCurrency(subtotal, invoice.currency)}</td>
                        </tr>
                        <tr>
                            <td style={{ padding: '2mm', textAlign: 'right', fontSize: '10pt', color: '#475569', borderBottom: '1px solid #cbd5e1' }}>Tax (15%):</td>
                            <td style={{ padding: '2mm', textAlign: 'right', fontSize: '11pt', fontWeight: 600, borderBottom: '1px solid #cbd5e1' }}>{formatCurrency(tax, invoice.currency)}</td>
                        </tr>
                        <tr>
                            <td style={{ padding: '3mm 2mm', textAlign: 'right', fontSize: '12pt', fontWeight: 700, color: '#0f172a' }}>Total Amount:</td>
                            <td style={{ padding: '3mm 2mm', textAlign: 'right', fontSize: '14pt', fontWeight: 800, color: '#0ea5e9' }}>{formatCurrency(total, invoice.currency)}</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            {/* Footer / Notes */}
            <div style={{ marginTop: 'auto', borderTop: '1px solid #cbd5e1', paddingTop: '5mm' }}>
                {invoice.notes && (
                    <div style={{ marginBottom: '5mm' }}>
                        <h4 style={{ margin: '0 0 1mm 0', fontSize: '9pt', color: '#64748b', textTransform: 'uppercase' }}>Notes / Terms</h4>
                        <p style={{ margin: 0, fontSize: '9pt', color: '#334155' }}>{invoice.notes}</p>
                    </div>
                )}
                <p style={{ margin: 0, fontSize: '8pt', color: '#94a3b8', textAlign: 'center' }}>
                    Thank you for your business. Please make all cheques payable to Aspee Pharmaceuticals.<br/>
                    Generated by Aspee ERP on {new Date().toLocaleString()}
                </p>
            </div>
        </div>
    );
}
