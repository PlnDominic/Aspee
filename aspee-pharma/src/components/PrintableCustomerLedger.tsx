import React from 'react';

// Faithful reproduction of the accountant's "Book (by Slip)" customer statement.
// The money columns intentionally show plain formatted numbers (no GH₵ symbol) to
// match the source document; all values are in Ghana Cedis.

export interface StatementRow {
    type: 'beginning' | 'invoice' | 'item' | 'receipt' | 'subtotal' | 'ytd';
    date?: string;
    remark?: string;
    sales?: number | null;
    receipt?: number | null;
    balance?: number | null;
}

interface PrintableCustomerLedgerProps {
    customer: any;
    period: { from: string; to: string };
    rows: StatementRow[];
    generatedAt: string;
}

const num = (v: number | null | undefined) =>
    v === null || v === undefined
        ? ''
        : v.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const cell: React.CSSProperties = {
    border: '1px solid #cbd5e1',
    padding: '4px 8px',
    fontSize: '9pt',
    verticalAlign: 'top',
};

const infoCell: React.CSSProperties = {
    border: '1px solid #cbd5e1',
    padding: '5px 8px',
    fontSize: '9pt',
};

export default function PrintableCustomerLedger({ customer, period, rows, generatedAt }: PrintableCustomerLedgerProps) {
    const info = {
        businessNo: customer.business_no ?? customer.code ?? customer.customer_code ?? '',
        ceo: customer.ceo ?? customer.contact_person ?? '',
        creditLimit: Number(customer.credit_limit ?? 0),
        phone: customer.phone ?? customer.mobile ?? '',
        email: customer.email ?? '',
        fax: customer.fax ?? '',
        address: customer.address ?? customer.customer_location ?? customer.location ?? '',
        remarks: customer.remarks ?? customer.notes ?? '',
    };

    const isBold = (t: StatementRow['type']) => t === 'subtotal' || t === 'ytd' || t === 'beginning';
    const isCentered = (t: StatementRow['type']) => t === 'beginning' || t === 'subtotal' || t === 'ytd';

    return (
        <div
            id="printable-customer-ledger"
            style={{
                position: 'absolute',
                top: '-9999px',
                left: '-9999px',
                width: '210mm',
                minHeight: '297mm',
                background: '#ffffff',
                padding: '14mm',
                color: '#1e293b',
                fontFamily: 'Arial, sans-serif',
                boxSizing: 'border-box',
                fontSize: '10pt',
                lineHeight: 1.35,
            }}
        >
            {/* Title */}
            <div style={{ textAlign: 'center', marginBottom: '16px' }}>
                <span style={{ fontSize: '17pt', fontWeight: 800, textDecoration: 'underline', color: '#0f172a' }}>
                    {customer.name} Book
                </span>
                <span style={{ fontSize: '11pt', fontWeight: 700, color: '#0f172a' }}> (by Slip)</span>
            </div>

            {/* Company / period line */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '8px' }}>
                <span style={{ fontSize: '9.5pt', fontWeight: 700 }}>
                    Company Name : Aspee Pharmaceuticals Ltd / PIC :
                </span>
                <span style={{ fontSize: '9.5pt', fontWeight: 700 }}>
                    {period.from} ~ {period.to}
                </span>
            </div>

            {/* Customer info box */}
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '16px' }}>
                <tbody>
                    <tr>
                        <td style={{ ...infoCell, width: '15%', fontWeight: 600, background: '#f1f5f9' }}>Business No.</td>
                        <td style={{ ...infoCell, width: '28%', fontWeight: 700 }}>{info.businessNo}</td>
                        <td style={{ ...infoCell, width: '12%', fontWeight: 600, background: '#f1f5f9' }}>CEO</td>
                        <td style={{ ...infoCell, width: '45%' }}>{info.ceo}</td>
                    </tr>
                    <tr>
                        <td style={{ ...infoCell, fontWeight: 600, background: '#f1f5f9' }}>Credit Limit</td>
                        <td style={infoCell}>{num(info.creditLimit)}</td>
                        <td style={{ ...infoCell, fontWeight: 600, background: '#f1f5f9' }}>Phone</td>
                        <td style={infoCell}>{info.phone ? info.phone : '(Mobile :  )'}</td>
                    </tr>
                    <tr>
                        <td style={{ ...infoCell, fontWeight: 600, background: '#f1f5f9' }}>Email</td>
                        <td style={infoCell}>{info.email}</td>
                        <td style={{ ...infoCell, fontWeight: 600, background: '#f1f5f9' }}>Fax</td>
                        <td style={infoCell}>{info.fax}</td>
                    </tr>
                    <tr>
                        <td style={{ ...infoCell, fontWeight: 600, background: '#f1f5f9' }}>Address</td>
                        <td style={infoCell} colSpan={3}>{info.address}</td>
                    </tr>
                    <tr>
                        <td style={{ ...infoCell, fontWeight: 600, background: '#f1f5f9' }}>Remarks</td>
                        <td style={infoCell} colSpan={3}>{info.remarks}</td>
                    </tr>
                </tbody>
            </table>

            {/* Sales / Receipt details */}
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                    <tr>
                        <td style={{ ...cell, textAlign: 'center', fontWeight: 700, background: '#f1f5f9' }} colSpan={5}>
                            Sales/Receipt Details
                        </td>
                    </tr>
                    <tr>
                        <th style={{ ...cell, textAlign: 'center', fontWeight: 700, background: '#f8fafc', width: '13%' }}>Date</th>
                        <th style={{ ...cell, textAlign: 'center', fontWeight: 700, background: '#f8fafc' }}>Remark</th>
                        <th style={{ ...cell, textAlign: 'center', fontWeight: 700, background: '#f8fafc', width: '15%' }}>Sales</th>
                        <th style={{ ...cell, textAlign: 'center', fontWeight: 700, background: '#f8fafc', width: '15%' }}>Receipt</th>
                        <th style={{ ...cell, textAlign: 'center', fontWeight: 700, background: '#f8fafc', width: '15%' }}>Balance</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map((r, idx) => {
                        const bold = isBold(r.type);
                        const remarkStyle: React.CSSProperties = {
                            ...cell,
                            fontWeight: bold ? 700 : r.type === 'item' ? 400 : 500,
                            color: r.type === 'item' ? '#334155' : '#0f172a',
                            paddingLeft: r.type === 'item' ? '18px' : '8px',
                            textAlign: isCentered(r.type) ? 'center' : 'left',
                        };
                        return (
                            <tr key={idx}>
                                <td style={{ ...cell, textAlign: 'center', color: '#475569', fontWeight: bold ? 700 : 400 }}>
                                    {r.date || ''}
                                </td>
                                <td style={remarkStyle}>
                                    {r.remark || ''}
                                </td>
                                <td style={{ ...cell, textAlign: 'right', fontWeight: bold ? 700 : 400 }}>{num(r.sales)}</td>
                                <td style={{ ...cell, textAlign: 'right', fontWeight: bold ? 700 : 400 }}>{num(r.receipt)}</td>
                                <td style={{ ...cell, textAlign: 'right', fontWeight: bold ? 700 : 400 }}>{num(r.balance)}</td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>

            {/* Generated timestamp */}
            <div style={{ textAlign: 'right', marginTop: '8px', fontSize: '9pt', color: '#334155' }}>
                {generatedAt}
            </div>
        </div>
    );
}
