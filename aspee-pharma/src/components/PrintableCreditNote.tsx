import React from 'react';
import { formatCurrency } from '@/lib/currency';

interface PrintableCreditNoteProps {
    creditNote: any;
}

export default function PrintableCreditNote({ creditNote }: PrintableCreditNoteProps) {
    if (!creditNote) return null;

    const subtotal = creditNote.items?.reduce((sum: number, item: any) => sum + Number(item.total_price || 0), 0) || 0;
    const tax = creditNote.tax_amount || 0;
    const total = creditNote.amount || subtotal + tax;

    return (
        <div id="printable-credit-note" style={{
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
                    <h2 style={{ margin: 0, fontSize: '20pt', fontWeight: 700, color: '#dc2626', textTransform: 'uppercase' }}>Credit Note</h2>
                    <p style={{ margin: '2mm 0 0 0', fontSize: '10pt', fontWeight: 600 }}>CN#: {creditNote.cn_number}</p>
                    <p style={{ margin: 0, fontSize: '10pt' }}>Date: {creditNote.date ? new Date(creditNote.date).toLocaleDateString() : '-'}</p>
                </div>
            </div>

            {/* Customer & Invoice Info */}
            <div style={{ display: 'flex', gap: '20mm', marginBottom: '10mm' }}>
                <div style={{ flex: 1 }}>
                    <h3 style={{ margin: '0 0 2mm 0', fontSize: '11pt', fontWeight: 700, color: '#334155', textTransform: 'uppercase' }}>Bill To:</h3>
                    <p style={{ margin: 0, fontSize: '12pt', fontWeight: 600 }}>{creditNote.customer_name || 'N/A'}</p>
                    {creditNote.customer_address && (
                        <p style={{ margin: '1mm 0 0 0', fontSize: '10pt', color: '#475569' }}>{creditNote.customer_address}</p>
                    )}
                </div>
                <div style={{ flex: 1 }}>
                    <h3 style={{ margin: '0 0 2mm 0', fontSize: '11pt', fontWeight: 700, color: '#334155', textTransform: 'uppercase' }}>Original Invoice:</h3>
                    <p style={{ margin: 0, fontSize: '12pt', fontWeight: 600 }}>{creditNote.invoice?.invoice_number || 'N/A'}</p>
                    <p style={{ margin: '1mm 0 0 0', fontSize: '10pt', color: '#475569' }}>Status: {creditNote.status || 'Issued'}</p>
                </div>
            </div>

            {/* Reason */}
            {creditNote.reason && (
                <div style={{ marginBottom: '10mm', padding: '4mm', background: '#fef3c7', borderRadius: 4 }}>
                    <strong>Reason: </strong>
                    <span>{creditNote.reason}</span>
                </div>
            )}

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
                    {creditNote.items?.map((item: any, idx: number) => (
                        <tr key={idx}>
                            <td style={{ padding: '3mm', borderBottom: '1px solid #e2e8f0', fontSize: '10pt' }}>
                                <strong>{item.product?.name || 'Unknown Product'}</strong><br/>
                                <span style={{ fontSize: '8pt', color: '#64748b' }}>SKU: {item.product?.sku || '-'}</span>
                            </td>
                            <td style={{ padding: '3mm', textAlign: 'center', borderBottom: '1px solid #e2e8f0', fontSize: '10pt' }}>{item.quantity || '-'}</td>
                            <td style={{ padding: '3mm', textAlign: 'right', borderBottom: '1px solid #e2e8f0', fontSize: '10pt' }}>{formatCurrency(item.unit_price || 0)}</td>
                            <td style={{ padding: '3mm', textAlign: 'right', borderBottom: '1px solid #e2e8f0', fontSize: '10pt', fontWeight: 600 }}>{formatCurrency(item.total_price || 0)}</td>
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
                            <td style={{ padding: '2mm', textAlign: 'right', fontSize: '11pt', fontWeight: 600 }}>{formatCurrency(subtotal)}</td>
                        </tr>
                        <tr>
                            <td style={{ padding: '2mm', textAlign: 'right', fontSize: '10pt', color: '#475569', borderBottom: '1px solid #cbd5e1' }}>Tax:</td>
                            <td style={{ padding: '2mm', textAlign: 'right', fontSize: '11pt', fontWeight: 600, borderBottom: '1px solid #cbd5e1' }}>{formatCurrency(tax)}</td>
                        </tr>
                        <tr>
                            <td style={{ padding: '3mm 2mm', textAlign: 'right', fontSize: '12pt', fontWeight: 700, color: '#dc2626' }}>Credit Amount:</td>
                            <td style={{ padding: '3mm 2mm', textAlign: 'right', fontSize: '14pt', fontWeight: 800, color: '#dc2626' }}>{formatCurrency(total)}</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            {/* Footer / Notes */}
            <div style={{ marginTop: 'auto', borderTop: '1px solid #cbd5e1', paddingTop: '5mm' }}>
                {creditNote.notes && (
                    <div style={{ marginBottom: '5mm' }}>
                        <h4 style={{ margin: '0 0 1mm 0', fontSize: '9pt', color: '#64748b', textTransform: 'uppercase' }}>Notes</h4>
                        <p style={{ margin: 0, fontSize: '9pt', color: '#334155' }}>{creditNote.notes}</p>
                    </div>
                )}
                <p style={{ margin: 0, fontSize: '8pt', color: '#94a3b8', textAlign: 'center' }}>
                    Credit Note generated by Aspee ERP on {new Date().toLocaleString()}
                </p>
            </div>
        </div>
    );
}
