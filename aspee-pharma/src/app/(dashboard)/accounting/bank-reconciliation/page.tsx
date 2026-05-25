/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import PageHeader from '@/components/PageHeader';
import DataTable from '@/components/DataTable';
import StatCard from '@/components/StatCard';
import BankReconciliationModal from '@/components/BankReconciliationModal';
import { 
  Upload, 
  FileSpreadsheet, 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  Banknote, 
  TrendingUp,
  RefreshCw,
  Link2,
  Link
} from 'lucide-react';
import { formatCurrency } from '@/lib/currency';
import { toast } from 'sonner';

const MATCH_STATUS_COLORS: Record<string, { bg: string; color: string; border: string }> = {
  matched: { bg: '#f0fdf4', color: '#15803d', border: '#bbf7d0' },
  unmatched: { bg: '#fef2f2', color: '#b91c1c', border: '#fecaca' },
  partial: { bg: '#fffbeb', color: '#a16207', border: '#fde68a' },
  disputed: { bg: '#f5f3ff', color: '#7c3aed', border: '#ddd6fe' },
};

interface BankAccount {
  id: string;
  name: string;
  code: string;
}

interface BankStatement {
  id: string;
  transaction_date: string;
  description: string;
  reference: string | null;
  debit_amount: number;
  credit_amount: number;
  balance: number | null;
  match_status: string;
  matched_journal_entry_id: string | null;
  created_at: string;
}

const bankStatementColumns = [
  {
    key: 'transaction_date',
    label: 'Date',
    render: (v: unknown) => (
      <span style={{ fontWeight: 500, color: 'var(--slate-700)' }}>
        {v as string}
      </span>
    ),
  },
  { 
    key: 'description', 
    label: 'Description',
    render: (v: unknown) => (
      <span style={{ fontSize: '13px', lineHeight: '1.5' }}>{v as string}</span>
    ),
  },
  {
    key: 'reference',
    label: 'Reference',
    render: (v: unknown) => (
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--slate-600)' }}>
        {v ? v as string : '-'}
      </span>
    ),
  },
  {
    key: 'debit_amount',
    label: 'Debit',
    render: (v: unknown, row: any) => {
      const amount = Number(v) || 0;
      return amount > 0 ? (
        <span style={{ fontWeight: 600, color: 'var(--danger-600)' }}>
          {formatCurrency(amount)}
        </span>
      ) : (
        <span>-</span>
      );
    },
  },
  {
    key: 'credit_amount',
    label: 'Credit',
    render: (v: unknown, row: any) => {
      const amount = Number(v) || 0;
      return amount > 0 ? (
        <span style={{ fontWeight: 600, color: 'var(--success-600)' }}>
          {formatCurrency(amount)}
        </span>
      ) : (
        <span>-</span>
      );
    },
  },
  {
    key: 'match_status',
    label: 'Status',
    render: (v: unknown) => {
      const status = v as string;
      const style = MATCH_STATUS_COLORS[status] || MATCH_STATUS_COLORS.unmatched;
      const icon = status === 'matched' ? <CheckCircle size={12} /> : 
                   status === 'unmatched' ? <XCircle size={12} /> :
                   status === 'partial' ? <AlertCircle size={12} /> :
                   <AlertCircle size={12} />;
      
      return (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px',
            padding: '4px 10px',
            borderRadius: '20px',
            fontSize: '11px',
            fontWeight: '600',
            background: style.bg,
            color: style.color,
            border: `1px solid ${style.border}`,
            whiteSpace: 'nowrap',
            textTransform: 'capitalize'
          }}
        >
          {icon}
          {status}
        </span>
      );
    },
  },
  {
    key: 'matched_journal_entry_id',
    label: 'Matched Entry',
    render: (v: unknown) => (
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--slate-600)' }}>
        {v ? v as string : '-'}
      </span>
    ),
  },
];

export default function BankReconciliationPage() {
  const [selectedAccount, setSelectedAccount] = useState<string>('');
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [showMatchModal, setShowMatchModal] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<BankStatement | null>(null);
  const queryClient = useQueryClient();

  // Fetch bank accounts (chart of accounts with type 'Asset' and subtype 'Cash')
  const { data: bankAccounts } = useQuery<BankAccount[]>({
    queryKey: ['chart_of_accounts', 'bank_accounts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('chart_of_accounts')
        .select('id, name, code')
        .eq('type', 'Asset')
        .eq('subtype', 'Cash');
      if (error) throw error;
      return (data || []) as BankAccount[];
    },
  });

  // Fetch bank statements for selected account
  const { data: bankStatements, isLoading: loadingStatements } = useQuery<BankStatement[]>({
    queryKey: ['bank_statements', selectedAccount],
    queryFn: async () => {
      let query = supabase
        .from('bank_statements')
        .select('*')
        .order('transaction_date', { ascending: false });
      if (selectedAccount) {
        query = query.eq('account_id', selectedAccount);
      }
      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as BankStatement[];
    },
    enabled: !!selectedAccount,
  });

  const statements = bankStatements || [];

  // Calculate summary statistics
  const totalTransactions = statements.length;
  const matchedCount = statements.filter(s => s.match_status === 'matched').length;
  const unmatchedCount = statements.filter(s => s.match_status === 'unmatched').length;
  const totalDebits = statements.reduce((sum, s) => sum + s.debit_amount, 0);
  const totalCredits = statements.reduce((sum, s) => sum + s.credit_amount, 0);
  const unmatchedDebits = statements.filter(s => s.match_status === 'unmatched').reduce((sum, s) => sum + s.debit_amount, 0);
  const unmatchedCredits = statements.filter(s => s.match_status === 'unmatched').reduce((sum, s) => sum + s.credit_amount, 0);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCsvFile(file);
    }
  };

  const handleUpload = async () => {
    if (!csvFile || !selectedAccount) {
      toast.error('Please select a CSV file and bank account');
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append('file', csvFile);
    formData.append('accountId', selectedAccount);
    try {
      const response = await fetch('/api/bank-statements/upload', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Upload failed');
      }

      toast.success(`Successfully uploaded ${result.summary.validTransactions} transactions`);
      if (result.errors && result.errors.length > 0) {
        toast.warning(`${result.errors.length} rows had errors and were skipped`);
      }

      // Refresh data
      queryClient.invalidateQueries({ queryKey: ['bank_statements'] });
      setCsvFile(null);
      
      // Clear file input
      const fileInput = document.getElementById('csv-file-input') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
    } catch (error: any) {
      console.error('Upload error:', error);
      toast.error(error.message || 'Failed to upload bank statement');
    } finally {
      setUploading(false);
    }
  };

  const handleAutoMatch = async () => {
    if (!selectedAccount) {
      toast.error('Please select a bank account');
      return;
    }

    try {
      setUploading(true);
      
      // Get unmatched bank statements
      const unmatchedStatements = statements.filter(s => s.match_status === 'unmatched');
      
      if (unmatchedStatements.length === 0) {
        toast.info('No unmatched transactions to match');
        return;
      }

      // Get all journal entries within relevant date range
      const { data: journalEntries } = await supabase
        .from('journal_entries')
        .select('*')
        .gte('date', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
        .lte('date', new Date().toISOString().split('T')[0]);

      if (!journalEntries || journalEntries.length === 0) {
        toast.info('No journal entries found for matching');
        return;
      }

      let matchCount = 0;

      // Auto-match algorithm: amount + date within ±3 days
      for (const statement of unmatchedStatements) {
        const statementAmount = statement.credit_amount > 0 ? statement.credit_amount : -statement.debit_amount;
        const statementDate = new Date(statement.transaction_date);
        
        for (const entry of journalEntries) {
          if (entry.entry_number === statement.matched_journal_entry_id) continue;
          
          const entryAmount = entry.credit_amount > 0 ? entry.credit_amount : -entry.debit_amount;
          const entryDate = new Date(entry.date);
          
          // Check amount match (within 1 cent tolerance)
          const amountMatch = Math.abs(statementAmount - entryAmount) <= 0.01;
          
          // Check date match (within ±3 days)
          const dateDiff = Math.abs(statementDate.getTime() - entryDate.getTime());
          const dateMatch = dateDiff <= 3 * 24 * 60 * 60 * 1000;
          
          if (amountMatch && dateMatch) {
            // Match found!
            await supabase
              .from('bank_statements')
              .update({
                matched_journal_entry_id: entry.entry_number,
                match_status: 'matched'
              })
              .eq('id', statement.id);
            
            matchCount++;
            break; // Move to next statement
          }
        }
      }

      if (matchCount > 0) {
        toast.success(`Auto-matched ${matchCount} transactions`);
        queryClient.invalidateQueries({ queryKey: ['bank_statements'] });
      } else {
        toast.info('No auto-matches found. Try manual matching.');
      }
    } catch (error: any) {
      console.error('Auto-match error:', error);
      toast.error('Error during auto-matching');
    } finally {
      setUploading(false);
    }
  };

  const handleMatchTransaction = (transaction: BankStatement) => {
    setSelectedTransaction(transaction);
    setShowMatchModal(true);
  };

  const handleMatchSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['bank_statements'] });
    setShowMatchModal(false);
    setSelectedTransaction(null);
  };

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Bank Reconciliation"
        subtitle="Match bank statements with journal entries"
        breadcrumbs={[
          { label: 'Accounting', href: '/accounting/journal' },
          { label: 'Bank Reconciliation' },
        ]}
        actions={
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={handleAutoMatch}
              disabled={uploading || !selectedAccount}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 16px',
                borderRadius: 10,
                background: 'linear-gradient(135deg, var(--success-600), var(--success-500))',
                color: 'white',
                fontSize: 13,
                fontWeight: 700,
                border: 'none',
                cursor: uploading || !selectedAccount ? 'not-allowed' : 'pointer',
                opacity: uploading || !selectedAccount ? 0.6 : 1,
              }}
            >
              <Link2 size={15} /> Auto Match
            </button>
          </div>
        }
      />

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 20, marginBottom: 24 }}>
        <StatCard
          title="Total Transactions"
          value={totalTransactions.toString()}
          icon={<FileSpreadsheet size={24} />}
          color="blue"
        />
        <StatCard
          title="Matched"
          value={matchedCount.toString()}
          icon={<CheckCircle size={24} />}
          color="green"
        />
        <StatCard
          title="Unmatched"
          value={unmatchedCount.toString()}
          icon={<XCircle size={24} />}
          color="red"
        />
        <StatCard
          title="Unmatched Debits"
          value={formatCurrency(unmatchedDebits)}
          icon={<TrendingUp size={24} />}
          color="amber"
        />
        <StatCard
          title="Unmatched Credits"
          value={formatCurrency(unmatchedCredits)}
          icon={<Banknote size={24} />}
          color="purple"
        />
      </div>

      {/* Upload Section */}
      <div style={{
        backgroundColor: 'white',
        border: '1px solid var(--slate-200)',
        borderRadius: 12,
        padding: 24,
        marginBottom: 24,
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
      }}>
        <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--slate-800)', marginBottom: 20 }}>
          Upload Bank Statement
        </h3>
        
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end' }}>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--slate-700)', marginBottom: 8 }}>
              Bank Account
            </label>
            <select
              value={selectedAccount}
              onChange={(e) => setSelectedAccount(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 14px',
                border: '1px solid var(--slate-300)',
                borderRadius: 8,
                fontSize: 14,
                backgroundColor: 'white'
              }}
            >
              <option value="">Select Bank Account</option>
              {bankAccounts?.map(account => (
                <option key={account.id} value={account.id}>
                  {account.code} - {account.name}
                </option>
              ))}
            </select>
          </div>

          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--slate-700)', marginBottom: 8 }}>
              CSV File
            </label>
            <input
              id="csv-file-input"
              type="file"
              accept=".csv"
              onChange={handleFileSelect}
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid var(--slate-300)',
                borderRadius: 8,
                fontSize: 14
              }}
            />
          </div>

          <button
            onClick={handleUpload}
            disabled={uploading || !csvFile || !selectedAccount}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 20px',
              borderRadius: 8,
              background: 'linear-gradient(135deg, var(--primary-600), var(--primary-500))',
              color: 'white',
              fontSize: 14,
              fontWeight: 600,
              border: 'none',
              cursor: uploading || !csvFile || !selectedAccount ? 'not-allowed' : 'pointer',
              opacity: uploading || !csvFile || !selectedAccount ? 0.6 : 1,
              height: 'fit-content'
            }}
          >
            <Upload size={16} />
            {uploading ? 'Uploading...' : 'Upload'}
          </button>
        </div>
        
        {csvFile && (
          <p style={{ marginTop: 12, fontSize: 13, color: 'var(--slate-600)' }}>
            Selected: {csvFile.name}
          </p>
        )}
      </div>

      {/* Transactions Table */}
      <div style={{
        backgroundColor: 'white',
        border: '1px solid var(--slate-200)',
        borderRadius: 12,
        padding: 24,
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--slate-800)' }}>
            Bank Transactions
          </h3>
          {!selectedAccount && (
            <span style={{ fontSize: 13, color: 'var(--slate-500)' }}>
              Select a bank account to view transactions
            </span>
          )}
        </div>
        
        <DataTable
          columns={bankStatementColumns}
          data={statements as unknown as Record<string, unknown>[]}
          loading={loadingStatements}
          onRowClick={handleMatchTransaction}
          pageSize={20}
        />
      </div>

      {/* Match Modal */}
      <BankReconciliationModal
        isOpen={showMatchModal}
        onClose={() => {
          setShowMatchModal(false);
          setSelectedTransaction(null);
        }}
        onSuccess={handleMatchSuccess}
        bankTransaction={selectedTransaction ?? undefined}
      />
    </div>
  );
}
