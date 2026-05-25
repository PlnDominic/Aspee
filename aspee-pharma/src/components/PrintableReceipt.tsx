import React from 'react';
import { formatCurrency } from '@/lib/currency';

interface PrintableReceiptProps {
    receipt: any;
}

export default function PrintableReceipt({ receipt }: PrintableReceiptProps) {
    if (!receipt) return null;

    return (
        <div id="printable-receipt" style={{
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
                    <h2 style={{ margin: 0, fontSize: '20pt', fontWeight: 700, color: '#059669', textTransform: 'uppercase' }}>Receipt</h2>
                    <p style={{ margin: '2mm 0 0 0', fontSize: '10pt', fontWeight: 600 }}>Receipt#: {receipt.receipt_number}</p>
                    <p style={{ margin: 0, fontSize: '10pt' }}>Date: {receipt.date ? new Date(receipt.date).toLocaleDateString() : '-'}</p>
                </div>
            </div>

            {/* Payment Info Box */}
            <div style={{ display: 'flex', gap: '20mm', marginBottom: '10mm' }}>
                <div style={{ flex: 1 }}>
                    <h3 style={{ margin: '0 0 2mm 0', fontSize: '11pt', fontWeight: 700, color: '#334155', textTransform: 'uppercase' }}>Received From:</h3>
                    <p style={{ margin: 0, fontSize: '12pt', fontWeight: 600 }}>{receipt.customer_name || 'N/A'}</p>
                    {receipt.customer_address && (
                        <p style={{ margin: '1mm 0 0 0', fontSize: '10pt', color: '#475569' }}>{receipt.customer_address}</p>
                    )}
                </div>
                <div style={{ flex: 1 }}>
                    <h3 style={{ margin: '0 0 2mm 0', fontSize: '11pt', fontWeight: 700, color: '#334155', textTransform: 'uppercase' }}>Payment Details:</h3>
                    <table style={{ width: '100%', fontSize: '10pt' }}>
                        <tbody>
                            <tr>
                                <td style={{ padding: '1mm 0', color: '#475569' }}>Invoice Ref:</td>
                                <td style={{ padding: '1mm 0', fontWeight: 600 }}>{receipt.invoice?.invoice_number || 'N/A'}</td>
                            </tr>
                            <tr>
                                <td style={{ padding: '1mm 0', color: '#475569' }}>Payment Method:</td>
                                <td style={{ padding: '1mm 0', fontWeight: 600 }}>{receipt.payment_method || 'N/A'}</td>
                            </tr>
                            {receipt.payment_reference && (
                                <tr>
                                    <td style={{ padding: '1mm 0', color: '#475569' }}>Ref Number:</td>
                                    <td style={{ padding: '1mm 0', fontWeight: 600, fontFamily: 'monospace' }}>{receipt.payment_reference}</td>
                                </tr>
                            )}
                            <tr>
                                <td style={{ padding: '1mm 0', color: '#475569' }}>Status:</td>
                                <td style={{ padding: '1mm 0', fontWeight: 600, color: receipt.status === 'Confirmed' ? '#059669' : '#92400e' }}>{receipt.status || 'Confirmed'}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Amount Box */}
            <div style={{ 
                marginBottom: '15mm', 
                padding: '8mm', 
                background: '#ecfdf5', 
                borderRadius: 8,
                border: '2px solid #059669'
            }}>
                <p style={{ margin: 0, fontSize: '11pt', color: '#065f46', textTransform: 'uppercase', fontWeight: 600 }}>Amount Received</p>
                <p style={{ margin: '2mm 0 0 0', fontSize: '28pt', fontWeight: 800, color: '#059669' }}>{formatCurrency(receipt.amount || 0)}</p>
                {receipt.currency && receipt.currency !== 'GHS' && (
                    <p style={{ margin: '1mm 0 0 0', fontSize: '10pt', color: '#065f46' }}>Currency: {receipt.currency}</p>
                )}
            </div>

            {/* Footer / Notes */}
            <div style={{ marginTop: 'auto', borderTop: '1px solid #cbd5e1', paddingTop: '5mm' }}>
                {receipt.notes && (
                    <div style={{ marginBottom: '5mm' }}>
                        <h4 style={{ margin: '0 0 1mm 0', fontSize: '9pt', color: '#64748b', textTransform: 'uppercase' }}>Notes</h4>
                        <p style={{ margin: 0, fontSize: '9pt', color: '#334155' }}>{receipt.notes}</p>
                    </div>
                )}
                <p style={{ margin: 0, fontSize: '8pt', color: '#94a3b8', textAlign: 'center' }}>
                    Thank you for your payment. Receipt generated by Aspee ERP on {new Date().toLocaleString()}
                </p>
            </div>
        </div>
    );
}
