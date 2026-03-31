import React from 'react';
import { formatCurrency } from '@/lib/currency';

interface PrintableGRNProps {
    grn: any;
}

export default function PrintableGRN({ grn }: PrintableGRNProps) {
    if (!grn) return null;

    const subtotal = grn.items?.reduce((sum: number, item: any) => sum + (Number(item.unit_cost || 0) * Number(item.quantity_received || 0)), 0) || 0;
    const tax = grn.tax_amount || 0;
    const total = grn.total_amount || subtotal + tax;

    return (
        <div id="printable-grn" style={{
            position: 'absolute',
            top: '-9999px',
            left: '-9999px',
            width: '210mm',
            minHeight: '297mm',
            background: 'white',
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
                    <h2 style={{ margin: 0, fontSize: '20pt', fontWeight: 700, color: '#0ea5e9', textTransform: 'uppercase' }}>GRN</h2>
                    <p style={{ margin: '2mm 0 0 0', fontSize: '10pt', fontWeight: 600 }}>GRN#: {grn.grn_number}</p>
                    <p style={{ margin: 0, fontSize: '10pt' }}>Date: {grn.grn_date ? new Date(grn.grn_date).toLocaleDateString() : '-'}</p>
                </div>
            </div>

            {/* Supplier & PO Info */}
            <div style={{ display: 'flex', gap: '20mm', marginBottom: '10mm' }}>
                <div style={{ flex: 1 }}>
                    <h3 style={{ margin: '0 0 2mm 0', fontSize: '11pt', fontWeight: 700, color: '#334155', textTransform: 'uppercase' }}>Supplier:</h3>
                    <p style={{ margin: 0, fontSize: '12pt', fontWeight: 600 }}>{grn.supplier_name || 'N/A'}</p>
                </div>
                <div style={{ flex: 1 }}>
                    <h3 style={{ margin: '0 0 2mm 0', fontSize: '11pt', fontWeight: 700, color: '#334155', textTransform: 'uppercase' }}>Purchase Order:</h3>
                    <p style={{ margin: 0, fontSize: '12pt', fontWeight: 600 }}>{grn.purchase_orders?.po_number || 'N/A'}</p>
                    <p style={{ margin: '1mm 0 0 0', fontSize: '10pt', color: '#475569' }}>Status: {grn.status || 'Pending'}</p>
                </div>
            </div>

            {/* Line Items Table */}
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '10mm' }}>
                <thead>
                    <tr style={{ background: '#f1f5f9' }}>
                        <th style={{ padding: '3mm', textAlign: 'left', borderBottom: '1px solid #cbd5e1', fontSize: '10pt', color: '#334155' }}>Item Description</th>
                        <th style={{ padding: '3mm', textAlign: 'center', borderBottom: '1px solid #cbd5e1', fontSize: '10pt', color: '#334155' }}>PO Qty</th>
                        <th style={{ padding: '3mm', textAlign: 'center', borderBottom: '1px solid #cbd5e1', fontSize: '10pt', color: '#334155' }}>Received</th>
                        <th style={{ padding: '3mm', textAlign: 'right', borderBottom: '1px solid #cbd5e1', fontSize: '10pt', color: '#334155' }}>Unit Cost</th>
                        <th style={{ padding: '3mm', textAlign: 'center', borderBottom: '1px solid #cbd5e1', fontSize: '10pt', color: '#334155' }}>Batch</th>
                        <th style={{ padding: '3mm', textAlign: 'center', borderBottom: '1px solid #cbd5e1', fontSize: '10pt', color: '#334155' }}>Expiry</th>
                        <th style={{ padding: '3mm', textAlign: 'right', borderBottom: '1px solid #cbd5e1', fontSize: '10pt', color: '#334155' }}>Total</th>
                    </tr>
                </thead>
                <tbody>
                    {grn.items?.map((item: any, idx: number) => (
                        <tr key={idx}>
                            <td style={{ padding: '3mm', borderBottom: '1px solid #e2e8f0', fontSize: '10pt' }}>
                                <strong>{item.product?.name || 'Unknown Product'}</strong><br/>
                                <span style={{ fontSize: '8pt', color: '#64748b' }}>SKU: {item.product?.sku || '-'}</span>
                            </td>
                            <td style={{ padding: '3mm', textAlign: 'center', borderBottom: '1px solid #e2e8f0', fontSize: '10pt' }}>{item.quantity_ordered || '-'}</td>
                            <td style={{ padding: '3mm', textAlign: 'center', borderBottom: '1px solid #e2e8f0', fontSize: '10pt' }}>{item.quantity_received || '-'}</td>
                            <td style={{ padding: '3mm', textAlign: 'right', borderBottom: '1px solid #e2e8f0', fontSize: '10pt' }}>{formatCurrency(item.unit_cost || 0)}</td>
                            <td style={{ padding: '3mm', textAlign: 'center', borderBottom: '1px solid #e2e8f0', fontSize: '10pt' }}>{item.batch_number || '-'}</td>
                            <td style={{ padding: '3mm', textAlign: 'center', borderBottom: '1px solid #e2e8f0', fontSize: '10pt' }}>{item.expiry_date ? new Date(item.expiry_date).toLocaleDateString('en-GB') : '-'}</td>
                            <td style={{ padding: '3mm', textAlign: 'right', borderBottom: '1px solid #e2e8f0', fontSize: '10pt', fontWeight: 600 }}>{formatCurrency((item.unit_cost || 0) * (item.quantity_received || 0))}</td>
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
                            <td style={{ padding: '3mm 2mm', textAlign: 'right', fontSize: '12pt', fontWeight: 700, color: '#0f172a' }}>Total Amount:</td>
                            <td style={{ padding: '3mm 2mm', textAlign: 'right', fontSize: '14pt', fontWeight: 800, color: '#0ea5e9' }}>{formatCurrency(total)}</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            {/* QA Status */}
            {grn.qa_status && (
                <div style={{ marginBottom: '10mm', padding: '4mm', background: grn.qa_status === 'Approved' ? '#ecfdf5' : '#fef3c7', borderRadius: 4 }}>
                    <strong>QA Status: </strong>
                    <span style={{ color: grn.qa_status === 'Approved' ? '#047857' : '#92400e' }}>{grn.qa_status}</span>
                    {grn.qa_notes && <span style={{ marginLeft: '10mm', color: '#475569' }}> - {grn.qa_notes}</span>}
                </div>
            )}

            {/* Footer / Notes */}
            <div style={{ marginTop: 'auto', borderTop: '1px solid #cbd5e1', paddingTop: '5mm' }}>
                {grn.notes && (
                    <div style={{ marginBottom: '5mm' }}>
                        <h4 style={{ margin: '0 0 1mm 0', fontSize: '9pt', color: '#64748b', textTransform: 'uppercase' }}>Notes</h4>
                        <p style={{ margin: 0, fontSize: '9pt', color: '#334155' }}>{grn.notes}</p>
                    </div>
                )}
                <p style={{ margin: 0, fontSize: '8pt', color: '#94a3b8', textAlign: 'center' }}>
                    Goods Received Note generated by Aspee ERP on {new Date().toLocaleString()}
                </p>
            </div>
        </div>
    );
}
