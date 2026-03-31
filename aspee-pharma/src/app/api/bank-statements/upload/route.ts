import { NextRequest, NextResponse } from 'next/server';
import { supabase as createClient } from '@/lib/supabase';
import Papa from 'papaparse';
import { v4 as uuidv4 } from 'uuid';

interface BankStatementRow {
  date?: string;
  description?: string;
  reference?: string;
  debit?: string;
  credit?: string;
  balance?: string;
  [key: string]: any;
}

interface ParsedTransaction {
  transaction_date: string;
  description: string;
  reference: string | null;
  debit_amount: number;
  credit_amount: number;
  balance: number | null;
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const accountId = formData.get('accountId') as string;
    const createdBy = formData.get('createdBy') as string;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    if (!accountId) {
      return NextResponse.json(
        { error: 'No account ID provided' },
        { status: 400 }
      );
    }

    // Validate file type
    if (!file.name.toLowerCase().endsWith('.csv')) {
      return NextResponse.json(
        { error: 'File must be a CSV file' },
        { status: 400 }
      );
    }

    // Read file content
    const fileContent = await file.text();
    const importBatchId = uuidv4();

    // Parse CSV
    const parseResult = Papa.parse<BankStatementRow>(fileContent, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: false,
      transformHeader: (header) => header.toLowerCase().trim()
    });

    if (parseResult.errors.length > 0) {
      console.error('CSV parsing errors:', parseResult.errors);
      return NextResponse.json(
        { error: 'Error parsing CSV file', details: parseResult.errors },
        { status: 400 }
      );
    }

    const supabase = createClient;
    const transactions: ParsedTransaction[] = [];
    const errors: string[] = [];

    // Process each row
    for (let i = 0; i < parseResult.data.length; i++) {
      const row = parseResult.data[i];
      
      try {
        // Try to detect column names (handle different bank formats)
        const dateStr = row.date || row['transaction date'] || row['value date'] || row.posting_date || row['posting date'];
        const description = row.description || row.narrative || row.particulars || row['transaction details'] || row.details || '';
        const reference = row.reference || row['cheque no'] || row['check number'] || row['transaction id'] || null;
        
        const debitStr = row.debit || row.debits || row['debit amount'] || row.withdrawal || '';
        const creditStr = row.credit || row.credits || row['credit amount'] || row.deposit || '';
        const balanceStr = row.balance || row['closing balance'] || '';

        // Validate required fields
        if (!dateStr || !description) {
          errors.push(`Row ${i + 1}: Missing required fields (date or description)`);
          continue;
        }

        // Parse amounts
        const debitAmount = parseFloat(debitStr.replace(/[^0-9.-]/g, '')) || 0;
        const creditAmount = parseFloat(creditStr.replace(/[^0-9.-]/g, '')) || 0;
        const balance = balanceStr ? parseFloat(balanceStr.replace(/[^0-9.-]/g, '')) : null;

        // At least one amount must be non-zero
        if (debitAmount === 0 && creditAmount === 0) {
          errors.push(`Row ${i + 1}: No amount specified`);
          continue;
        }

        // Parse date
        const transactionDate = new Date(dateStr);
        if (isNaN(transactionDate.getTime())) {
          errors.push(`Row ${i + 1}: Invalid date format: ${dateStr}`);
          continue;
        }

        transactions.push({
          transaction_date: transactionDate.toISOString().split('T')[0],
          description: description.trim(),
          reference: reference ? reference.toString().trim() : null,
          debit_amount: debitAmount,
          credit_amount: creditAmount,
          balance: balance
        });

      } catch (error: any) {
        errors.push(`Row ${i + 1}: ${error.message}`);
      }
    }

    if (transactions.length === 0) {
      return NextResponse.json(
        { error: 'No valid transactions found in CSV file', details: errors },
        { status: 400 }
      );
    }

    // Insert transactions into database
    const insertData = transactions.map(tx => ({
      account_id: accountId,
      statement_date: new Date().toISOString().split('T')[0],
      transaction_date: tx.transaction_date,
      description: tx.description,
      reference: tx.reference,
      debit_amount: tx.debit_amount,
      credit_amount: tx.credit_amount,
      balance: tx.balance,
      match_status: 'unmatched',
      import_batch_id: importBatchId,
      created_by: createdBy,
      original_csv_row: {} // Could store original row data if needed
    }));

    const { error: insertError } = await supabase
      .from('bank_statements')
      .insert(insertData);

    if (insertError) {
      console.error('Database insert error:', insertError);
      return NextResponse.json(
        { error: 'Failed to save transactions to database', details: insertError.message },
        { status: 500 }
      );
    }

    // Return success with summary
    return NextResponse.json({
      success: true,
      summary: {
        totalRows: parseResult.data.length,
        validTransactions: transactions.length,
        errors: errors.length,
        importBatchId,
        totalDebits: transactions.reduce((sum, tx) => sum + tx.debit_amount, 0),
        totalCredits: transactions.reduce((sum, tx) => sum + tx.credit_amount, 0)
      },
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error: any) {
    console.error('Bank statement upload error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
