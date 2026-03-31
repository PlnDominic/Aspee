import React from 'react';

interface PrintablePOProps {
    po: any;
}

export default function PrintablePO({ po }: PrintablePOProps) {
    if (!po) return null;

    const subtotal = po.items?.reduce((sum: number, item: any) => sum + Number(item.total_price), 0) || 0;
    const tax = po.tax_amount || 0;
    const total = po.total_amount || 0;

    return (
        <div id="printable-po" style={{
            position: 'absolute',
            top: '-9999px',
            left: '-9999px',
            width: '210mm',         // A4 width
            minHeight: '297mm',     // A4 height
            background: 'var(--card-bg)',
            padding: '20mm',
            color: 'black',
            fontFamily: 'sans-serif',
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column'
        }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #334155', paddingBottom: '10mm', marginBottom: '10mm' }}>
                <div>
                    <h1 style={{ margin: 0, fontSize: '24pt', fontWeight: 800, color: '#0f172a' }}>ASPEE PHARMACEUTICALS</h1>
                    <p style={{ margin: '2mm 0 0 0', fontSize: '10pt', color: '#475569' }}>123 Industrial Area, Accra, Ghana</p>
                    <p style={{ margin: 0, fontSize: '10pt', color: '#475569' }}>Phone: +233 20 123 4567 | Email: logistics@aspeepharma.com</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                    <h2 style={{ margin: 0, fontSize: '18pt', fontWeight: 700, color: '#8b5cf6', textTransform: 'uppercase' }}>Purchase Order</h2>
                    <p style={{ margin: '2mm 0 0 0', fontSize: '10pt', fontWeight: 600 }}>PO#: {po.po_number}</p>
                    <p style={{ margin: 0, fontSize: '10pt' }}>Date: {new Date(po.date).toLocaleDateString()}</p>
                    {po.expected_delivery && <p style={{ margin: 0, fontSize: '10pt' }}>Expected: {new Date(po.expected_delivery).toLocaleDateString()}</p>}
                </div>
            </div>

            {/* Vendor Info */}
            <div style={{ marginBottom: '10mm', display: 'flex', justifyContent: 'space-between' }}>
                <div style={{ width: '45%' }}>
                    <h3 style={{ margin: '0 0 2mm 0', fontSize: '11pt', fontWeight: 700, color: '#334155', textTransform: 'uppercase' }}>Vendor Details:</h3>
                    <p style={{ margin: 0, fontSize: '12pt', fontWeight: 600 }}>{po.supplier?.name || po.supplier_id}</p>
                    {po.supplier?.contact_person && <p style={{ margin: '1mm 0 0 0', fontSize: '10pt', color: '#475569' }}>Attn: {po.supplier.contact_person}</p>}
                    {po.supplier?.email && <p style={{ margin: '1mm 0 0 0', fontSize: '10pt', color: '#475569' }}>{po.supplier.email}</p>}
                    {po.supplier?.phone && <p style={{ margin: '1mm 0 0 0', fontSize: '10pt', color: '#475569' }}>{po.supplier.phone}</p>}
                </div>
                <div style={{ width: '45%' }}>
                    <h3 style={{ margin: '0 0 2mm 0', fontSize: '11pt', fontWeight: 700, color: '#334155', textTransform: 'uppercase' }}>Ship To:</h3>
                    <p style={{ margin: 0, fontSize: '11pt', fontWeight: 500 }}>Aspee Pharmaceuticals - Central Warehouse</p>
                    <p style={{ margin: '1mm 0 0 0', fontSize: '10pt', color: '#475569' }}>123 Industrial Area</p>
                    <p style={{ margin: 0, fontSize: '10pt', color: '#475569' }}>Accra, Ghana</p>
                </div>
            </div>

            {/* Line Items Table */}
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '10mm' }}>
                <thead>
                    <tr style={{ background: '#f1f5f9' }}>
                        <th style={{ padding: '3mm', textAlign: 'left', borderBottom: '1px solid #cbd5e1', fontSize: '10pt', color: '#334155' }}>Item Description</th>
                        <th style={{ padding: '3mm', textAlign: 'center', borderBottom: '1px solid #cbd5e1', fontSize: '10pt', color: '#334155' }}>Qty Requested</th>
                        <th style={{ padding: '3mm', textAlign: 'right', borderBottom: '1px solid #cbd5e1', fontSize: '10pt', color: '#334155' }}>Unit Price (GH₵)</th>
                        <th style={{ padding: '3mm', textAlign: 'right', borderBottom: '1px solid #cbd5e1', fontSize: '10pt', color: '#334155' }}>Total (GH₵)</th>
                    </tr>
                </thead>
                <tbody>
                    {po.items?.map((item: any, idx: number) => (
                        <tr key={idx}>
                            <td style={{ padding: '3mm', borderBottom: '1px solid #e2e8f0', fontSize: '10pt' }}>
                                <strong>{item.product?.name}</strong><br/>
                                <span style={{ fontSize: '8pt', color: '#64748b' }}>SKU: {item.product?.sku} | UOM: {item.product?.unit}</span>
                            </td>
                            <td style={{ padding: '3mm', textAlign: 'center', borderBottom: '1px solid #e2e8f0', fontSize: '10pt' }}>{item.quantity}</td>
                            <td style={{ padding: '3mm', textAlign: 'right', borderBottom: '1px solid #e2e8f0', fontSize: '10pt' }}>{Number(item.unit_price).toFixed(2)}</td>
                            <td style={{ padding: '3mm', textAlign: 'right', borderBottom: '1px solid #e2e8f0', fontSize: '10pt' }}>{Number(item.total_price).toFixed(2)}</td>
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
                            <td style={{ padding: '2mm', textAlign: 'right', fontSize: '11pt', fontWeight: 600 }}>GH₵ {subtotal.toFixed(2)}</td>
                        </tr>
                        <tr>
                            <td style={{ padding: '2mm', textAlign: 'right', fontSize: '10pt', color: '#475569', borderBottom: '1px solid #cbd5e1' }}>VAT / Tax:</td>
                            <td style={{ padding: '2mm', textAlign: 'right', fontSize: '11pt', fontWeight: 600, borderBottom: '1px solid #cbd5e1' }}>GH₵ {tax.toFixed(2)}</td>
                        </tr>
                        <tr>
                            <td style={{ padding: '3mm 2mm', textAlign: 'right', fontSize: '12pt', fontWeight: 700, color: '#0f172a' }}>PO Total:</td>
                            <td style={{ padding: '3mm 2mm', textAlign: 'right', fontSize: '14pt', fontWeight: 800, color: '#8b5cf6' }}>GH₵ {total.toFixed(2)}</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            {/* Footer / Notes */}
            <div style={{ marginTop: 'auto', borderTop: '1px solid #cbd5e1', paddingTop: '5mm' }}>
                {po.notes && (
                    <div style={{ marginBottom: '5mm' }}>
                        <h4 style={{ margin: '0 0 1mm 0', fontSize: '9pt', color: '#64748b', textTransform: 'uppercase' }}>Purchasing Notes / Instructions</h4>
                        <p style={{ margin: 0, fontSize: '9pt', color: '#334155' }}>{po.notes}</p>
                    </div>
                )}
                
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10mm', paddingTop: '10mm', borderTop: '1px dashed #cbd5e1' }}>
                    <div style={{ width: '40%', textAlign: 'center' }}>
                        <div style={{ borderBottom: '1px solid #000', height: '10mm', marginBottom: '2mm' }}></div>
                        <p style={{ margin: 0, fontSize: '9pt' }}>Authorized Signature (Aspee Pharma)</p>
                    </div>
                    <div style={{ width: '40%', textAlign: 'center' }}>
                        <div style={{ borderBottom: '1px solid #000', height: '10mm', marginBottom: '2mm' }}></div>
                        <p style={{ margin: 0, fontSize: '9pt' }}>Vendor Acknowledgement</p>
                    </div>
                </div>

                <p style={{ margin: '10mm 0 0 0', fontSize: '8pt', color: '#94a3b8', textAlign: 'center' }}>
                    This document is a formal purchase request. Please reference the PO Number on all packing slips and invoices.<br/>
                    Generated on {new Date().toLocaleString()}
                </p>
            </div>
        </div>
    );
}
