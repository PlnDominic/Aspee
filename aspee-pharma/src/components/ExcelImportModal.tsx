'use client';

import React, { useState, useRef } from 'react';
import Modal from './Modal';
import { Upload, Download, FileSpreadsheet, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

interface ExcelImportModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    entityType: 'customers' | 'products' | 'suppliers';
}

interface ImportResult {
    success: boolean;
    message: string;
    errors?: string[];
    importedCount?: number;
}

export default function ExcelImportModal({ isOpen, onClose, onSuccess, entityType }: ExcelImportModalProps) {
    const [loading, setLoading] = useState(false);
    const [importResult, setImportResult] = useState<ImportResult | null>(null);
    const [previewData, setPreviewData] = useState<any[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Template columns based on entity type
    const getTemplateColumns = () => {
        if (entityType === 'customers') {
            return [
                'Customer Name*',
                'Contact Person',
                'Email',
                'Phone',
                'Address',
                'Location',
                'Category',
                'Route Code',
                'Sales Person Email',
                'Status'
            ];
        }
        return [];
    };

    const getTemplateData = () => {
        if (entityType === 'customers') {
            return [
                {
                    'Customer Name*': 'Example Pharmacy Ltd',
                    'Contact Person': 'John Doe',
                    'Email': 'john@example.com',
                    'Phone': '+233123456789',
                    'Address': '123 Main Street, Accra',
                    'Location': 'Downtown Accra',
                    'Category': 'RETAIL PHARMACY',
                    'Route Code': 'RT-001',
                    'Sales Person Email': 'sales@aspee.com',
                    'Status': 'Active'
                },
                {
                    'Customer Name*': 'City Hospital',
                    'Contact Person': 'Dr. Sarah Smith',
                    'Email': 'procurement@cityhospital.com',
                    'Phone': '+233987654321',
                    'Address': '456 Hospital Road, Accra',
                    'Location': 'East Legon',
                    'Category': 'HOSPITAL',
                    'Route Code': 'RT-002',
                    'Sales Person Email': 'rep@aspee.com',
                    'Status': 'Active'
                }
            ];
        }
        return [];
    };

    const generateTemplate = async () => {
        try {
            setLoading(true);
            
            // Dynamically import xlsx to avoid SSR issues
            const XLSX = await import('xlsx');
            
            const worksheet = XLSX.utils.json_to_sheet(getTemplateData());
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, 'Template');

            // Set column widths
            worksheet['!cols'] = getTemplateColumns().map(() => ({ wch: 20 }));

            // Add header styling
            const headerCells = getTemplateColumns().map((_, index) => 
                XLSX.utils.encode_cell({ r: 0, c: index })
            );
            
            headerCells.forEach(cell => {
                if (worksheet[cell]) {
                    worksheet[cell].s = {
                        font: { bold: true, color: { rgb: "FFFFFF" } },
                        fill: { fgColor: { rgb: "4472C4" }, patternType: "solid" },
                        alignment: { horizontal: "center" }
                    };
                }
            });

            // Add data validation info sheet
            const infoData = [
                ['Field', 'Description', 'Required', 'Valid Values'],
                ['Customer Name', 'Full name of the customer/business', 'Yes', 'Any text'],
                ['Contact Person', 'Primary contact person name', 'No', 'Any text'],
                ['Email', 'Contact email address', 'No', 'Valid email format'],
                ['Phone', 'Contact phone number', 'No', 'Any text'],
                ['Address', 'Full physical address', 'No', 'Any text'],
                ['Location', 'Geographic location/area', 'No', 'Any text'],
                ['Category', 'Customer category', 'No', 'OTC, WHOLESALE PHARMACY, RETAIL PHARMACY, CLINIC, HOSPITAL, MEDICAL STORES'],
                ['Route Code', 'Route identifier', 'No', 'Must match existing route code'],
                ['Sales Person Email', 'Email of assigned sales person', 'No', 'Must match existing user email'],
                ['Status', 'Customer status', 'No', 'Active or Inactive']
            ];
            
            const infoSheet = XLSX.utils.aoa_to_sheet(infoData);
            infoSheet['!cols'] = [{ wch: 20 }, { wch: 40 }, { wch: 10 }, { wch: 50 }];
            XLSX.utils.book_append_sheet(workbook, infoSheet, 'Instructions');

            // Generate file
            const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
            const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            
            // Download file
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `aspee_${entityType}_template.xlsx`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);

            toast.success('Template downloaded successfully!');
        } catch (error) {
            console.error('Error generating template:', error);
            toast.error('Failed to generate template. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setLoading(true);
        setImportResult(null);

        try {
            const XLSX = await import('xlsx');
            const arrayBuffer = await file.arrayBuffer();
            const workbook = XLSX.read(arrayBuffer, { type: 'array' });
            const worksheet = workbook.Sheets[workbook.SheetNames[0]];
            const jsonData = XLSX.utils.sheet_to_json(worksheet);

            if (jsonData.length === 0) {
                throw new Error('Excel sheet is empty');
            }

            setPreviewData(jsonData.slice(0, 5)); // Show first 5 rows as preview
            
            // Process and validate data
            const result = await processImportData(jsonData);
            setImportResult(result);

            if (result.success) {
                toast.success(result.message);
                onSuccess();
                setTimeout(() => onClose(), 2000);
            } else {
                toast.error(result.message);
            }
        } catch (error: any) {
            console.error('Error processing file:', error);
            setImportResult({
                success: false,
                message: 'Failed to process Excel file',
                errors: [error.message]
            });
            toast.error('Error processing file: ' + error.message);
        } finally {
            setLoading(false);
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };

    const processImportData = async (data: any[]): Promise<ImportResult> => {
        const errors: string[] = [];
        let importedCount = 0;

        if (entityType === 'customers') {
            // Get routes and sales persons for validation
            const { data: routes } = await supabase.from('vans').select('id, van_id');
            const { data: salesPersons } = await supabase.from('system_users').select('id, email, name');

            const routeMap = new Map(routes?.map(r => [r.van_id, r.id]) || []);
            const salesPersonMap = new Map(salesPersons?.map(p => [p.email, p.id]) || []);

            for (let i = 0; i < data.length; i++) {
                const row = data[i];
                const rowNum = i + 2; // +2 for header row and 1-based indexing

                try {
                    // Validate required fields
                    if (!row['Customer Name*'] || !row['Customer Name*'].toString().trim()) {
                        errors.push(`Row ${rowNum}: Customer Name is required`);
                        continue;
                    }

                    // Validate category
                    const validCategories = ['OTC', 'WHOLESALE PHARMACY', 'RETAIL PHARMACY', 'CLINIC', 'HOSPITAL', 'MEDICAL STORES'];
                    const category = row['Category']?.toString().toUpperCase().trim();
                    if (category && !validCategories.includes(category)) {
                        errors.push(`Row ${rowNum}: Invalid category "${row['Category']}"`);
                        continue;
                    }

                    // Validate route
                    let routeId = null;
                    if (row['Route Code']) {
                        routeId = routeMap.get(row['Route Code'].toString().trim());
                        if (!routeId) {
                            errors.push(`Row ${rowNum}: Route "${row['Route Code']}" not found`);
                            continue;
                        }
                    }

                    // Validate sales person
                    let salesPersonId = null;
                    if (row['Sales Person Email']) {
                        salesPersonId = salesPersonMap.get(row['Sales Person Email'].toString().trim().toLowerCase());
                        if (!salesPersonId) {
                            errors.push(`Row ${rowNum}: Sales person with email "${row['Sales Person Email']}" not found`);
                            continue;
                        }
                    }

                    // Validate status
                    const status = row['Status']?.toString().trim() || 'Active';
                    if (!['Active', 'Inactive'].includes(status)) {
                        errors.push(`Row ${rowNum}: Status must be "Active" or "Inactive"`);
                        continue;
                    }

                    // Prepare customer data
                    const customerData = {
                        name: row['Customer Name*'].toString().trim(),
                        contact_person: row['Contact Person']?.toString().trim() || null,
                        email: row['Email']?.toString().trim() || null,
                        phone: row['Phone']?.toString().trim() || null,
                        address: row['Address']?.toString().trim() || null,
                        location: row['Location']?.toString().trim() || null,
                        category: category || null,
                        route_id: routeId,
                        sales_person_id: salesPersonId,
                        status: status
                    };

                    // Check if customer already exists
                    const { data: existingCustomer } = await supabase
                        .from('customers')
                        .select('id')
                        .ilike('name', customerData.name)
                        .maybeSingle();

                    if (existingCustomer) {
                        // Update existing customer
                        const { error } = await supabase
                            .from('customers')
                            .update(customerData)
                            .eq('id', existingCustomer.id);

                        if (error) throw error;
                    } else {
                        // Insert new customer
                        const { error } = await supabase
                            .from('customers')
                            .insert([customerData]);

                        if (error) throw error;
                    }

                    importedCount++;
                } catch (error: any) {
                    errors.push(`Row ${rowNum}: ${error.message}`);
                }
            }
        }

        return {
            success: errors.length === 0,
            message: errors.length === 0 
                ? `Successfully imported ${importedCount} customers` 
                : `Imported ${importedCount} customers with ${errors.length} errors`,
            errors: errors.length > 0 ? errors : undefined,
            importedCount
        };
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Import Customers from Excel"
            subtitle="Download template, fill data, and upload"
            width={600}
        >
            <div style={{ padding: '24px 0' }}>
                {/* Step 1: Download Template */}
                <div style={{ marginBottom: 24 }}>
                    <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: 'var(--slate-800)' }}>
                        Step 1: Download Template
                    </h3>
                    <div style={{
                        padding: 16,
                        border: '2px dashed var(--slate-300)',
                        borderRadius: 8,
                        background: 'var(--slate-50)',
                        textAlign: 'center'
                    }}>
                        <FileSpreadsheet size={32} style={{ color: 'var(--primary-600)', marginBottom: 8 }} />
                        <p style={{ fontSize: 13, marginBottom: 12, color: 'var(--slate-600)' }}>
                            Download the Excel template with the correct format
                        </p>
                        <button
                            onClick={generateTemplate}
                            disabled={loading}
                            style={{
                                padding: '8px 16px',
                                background: 'var(--primary-600)',
                                color: 'white',
                                border: 'none',
                                borderRadius: 6,
                                fontSize: 12,
                                fontWeight: 600,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 8
                            }}
                        >
                            <Download size={14} />
                            Download Template
                        </button>
                    </div>
                </div>

                {/* Step 2: Upload Filled Template */}
                <div style={{ marginBottom: 24 }}>
                    <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: 'var(--slate-800)' }}>
                        Step 2: Upload Filled Template
                    </h3>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".xlsx,.xls,.csv"
                        onChange={handleFileUpload}
                        style={{ display: 'none' }}
                        disabled={loading}
                    />
                    <div
                        onClick={() => fileInputRef.current?.click()}
                        style={{
                            padding: 24,
                            border: '2px dashed var(--primary-400)',
                            borderRadius: 8,
                            background: 'var(--primary-50)',
                            textAlign: 'center',
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.borderColor = 'var(--primary-600)';
                            e.currentTarget.style.background = 'var(--primary-100)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.borderColor = 'var(--primary-400)';
                            e.currentTarget.style.background = 'var(--primary-50)';
                        }}
                    >
                        <Upload size={32} style={{ color: 'var(--primary-600)', marginBottom: 8 }} />
                        <p style={{ fontSize: 13, marginBottom: 4, color: 'var(--slate-700)', fontWeight: 600 }}>
                            Click to upload your filled template
                        </p>
                        <p style={{ fontSize: 12, color: 'var(--slate-500)' }}>
                            Supports .xlsx, .xls, and .csv files
                        </p>
                    </div>
                </div>

                {/* Loading State */}
                {loading && (
                    <div style={{ textAlign: 'center', padding: 24 }}>
                        <div style={{
                            width: 32,
                            height: 32,
                            border: '3px solid var(--slate-200)',
                            borderTopColor: 'var(--primary-600)',
                            borderRadius: '50%',
                            animation: 'spin 1s linear infinite',
                            margin: '0 auto 12px'
                        }} />
                        <p style={{ fontSize: 13, color: 'var(--slate-600)' }}>Processing file...</p>
                    </div>
                )}

                {/* Import Result */}
                {importResult && !loading && (
                    <div style={{
                        padding: 16,
                        borderRadius: 8,
                        background: importResult.success ? 'var(--success-50)' : 'var(--danger-50)',
                        border: `1px solid ${importResult.success ? 'var(--success-200)' : 'var(--danger-200)'}`
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                            {importResult.success ? (
                                <CheckCircle2 size={16} style={{ color: 'var(--success-600)' }} />
                            ) : (
                                <XCircle size={16} style={{ color: 'var(--danger-600)' }} />
                            )}
                            <p style={{
                                fontSize: 13,
                                fontWeight: 600,
                                color: importResult.success ? 'var(--success-700)' : 'var(--danger-700)'
                            }}>
                                {importResult.message}
                            </p>
                        </div>
                        
                        {importResult.importedCount && (
                            <p style={{ fontSize: 12, color: 'var(--slate-600)', marginBottom: 8 }}>
                                Records processed: {importResult.importedCount}
                            </p>
                        )}

                        {importResult.errors && importResult.errors.length > 0 && (
                            <div style={{ marginTop: 12 }}>
                                <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--danger-700)', marginBottom: 6 }}>
                                    Errors ({importResult.errors.length}):
                                </p>
                                <div style={{
                                    maxHeight: 150,
                                    overflowY: 'auto',
                                    padding: 8,
                                    background: 'white',
                                    borderRadius: 4,
                                    fontSize: 11,
                                    color: 'var(--danger-600)'
                                }}>
                                    {importResult.errors.map((error, index) => (
                                        <div key={index} style={{ marginBottom: 4 }}>• {error}</div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Data Preview */}
                {previewData.length > 0 && !loading && (
                    <div style={{ marginTop: 24 }}>
                        <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: 'var(--slate-800)' }}>
                            Preview (First 5 Rows)
                        </h3>
                        <div style={{
                            maxHeight: 200,
                            overflow: 'auto',
                            border: '1px solid var(--slate-200)',
                            borderRadius: 6
                        }}>
                            <table style={{ width: '100%', fontSize: 11 }}>
                                <thead>
                                    <tr style={{ background: 'var(--slate-50)' }}>
                                        {Object.keys(previewData[0]).map((key) => (
                                            <th key={key} style={{
                                                padding: '6px 8px',
                                                textAlign: 'left',
                                                borderBottom: '1px solid var(--slate-200)',
                                                fontWeight: 600,
                                                color: 'var(--slate-700)'
                                            }}>
                                                {key}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {previewData.map((row, index) => (
                                        <tr key={index} style={{
                                            background: index % 2 === 0 ? 'white' : 'var(--slate-50)'
                                        }}>
                                            {Object.values(row).map((value: any, cellIndex) => (
                                                <td key={cellIndex} style={{
                                                    padding: '6px 8px',
                                                    borderBottom: '1px solid var(--slate-100)',
                                                    color: 'var(--slate-700)'
                                                }}>
                                                    {value?.toString() || '-'}
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>

            <style>{`
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </Modal>
    );
}
