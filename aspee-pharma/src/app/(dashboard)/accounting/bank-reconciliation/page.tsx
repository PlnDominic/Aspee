/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import PageHeader from '@/components/PageHeader';
import BankReconciliationModal from '@/components/BankReconciliationModal';
import {
  Upload,
  CheckCircle,
  XCircle,
  AlertCircle,
  Link2,
  Landmark,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
} from 'lucide-react';
import { formatCurrency } from '@/lib/currency';
import { toast } from 'sonner';

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

const MATCH_STYLE: Record<string, { bg: string; color: string; border: string; label: string }> = {
  matched:   { bg: '#f0fdf4', color: '#15803d', border: '#bbf7d0', label: 'Matched' },
  unmatched: { bg: '#fef2f2', color: '#b91c1c', border: '#fecaca', label: 'Unmatched' },
  partial:   { bg: '#fffbeb', color: '#a16207', border: '#fde68a', label: 'Partial' },
  disputed:  { bg: '#f5f3ff', color: '#7c3aed', border: '#ddd6fe', label: 'Disputed' },
};

function StatusPill({ status }: { status: string }) {
  const s = MATCH_STYLE[status] || MATCH_STYLE.unmatched;
  const Icon = status === 'matched' ? CheckCircle : status === 'partial' ? AlertCircle : XCircle;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '3px 9px', borderRadius: 20, fontSize: 11, fontWeight: 600,
      background: s.bg, color: s.color, border: `1px solid ${s.border}`,
      whiteSpace: 'nowrap', textTransform: 'capitalize',
    }}>
      <Icon size={11} />
      {s.label}
    </span>
  );
}

function BankStatementView({
  account,
  queryClient,
}: {
  account: BankAccount;
  queryClient: ReturnType<typeof useQueryClient>;
}) {
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [showMatchModal, setShowMatchModal] = useState(false);
  const [selectedTx, setSelectedTx] = useState<BankStatement | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const { data: rawStatements, isLoading } = useQuery<BankStatement[]>({
    queryKey: ['bank_statements', account.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bank_statements')
        .select('*')
        .eq('account_id', account.id)
        .order('transaction_date', { ascending: false });
      if (error) throw error;
      return (data || []) as BankStatement[];
    },
  });

  const statements = rawStatements || [];

  // Build running balance from oldest→newest then reverse for display
  const statementsWithBalance = useMemo(() => {
    const sorted = [...statements].sort(
      (a, b) => new Date(a.transaction_date).getTime() - new Date(b.transaction_date).getTime()
    );
    let running = 0;
    const withBal = sorted.map((s) => {
      // If DB has a balance column, use that for last row; otherwise compute
      running += (Number(s.credit_amount) || 0) - (Number(s.debit_amount) || 0);
      return { ...s, _runningBalance: s.balance ?? running };
    });
    return withBal.reverse(); // newest first
  }, [statements]);

  const filtered = filterStatus === 'all'
    ? statementsWithBalance
    : statementsWithBalance.filter(s => s.match_status === filterStatus);

  // Stats
  const totalCredits = statements.reduce((s, r) => s + (Number(r.credit_amount) || 0), 0);
  const totalDebits  = statements.reduce((s, r) => s + (Number(r.debit_amount)  || 0), 0);
  const matched   = statements.filter(s => s.match_status === 'matched').length;
  const unmatched = statements.filter(s => s.match_status === 'unmatched').length;
  const currentBalance = statementsWithBalance[0]?._runningBalance ?? 0;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setCsvFile(file);
  };

  const handleUpload = async () => {
    if (!csvFile) { toast.error('Please select a CSV file'); return; }
    setUploading(true);
    const formData = new FormData();
    formData.append('file', csvFile);
    formData.append('accountId', account.id);
    try {
      const response = await fetch('/api/bank-statements/upload', { method: 'POST', body: formData });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Upload failed');
      toast.success(`Uploaded ${result.summary?.validTransactions ?? 0} transactions`);
      if (result.errors?.length) toast.warning(`${result.errors.length} rows had errors`);
      queryClient.invalidateQueries({ queryKey: ['bank_statements', account.id] });
      setCsvFile(null);
      const inp = document.getElementById(`csv-input-${account.id}`) as HTMLInputElement;
      if (inp) inp.value = '';
    } catch (err: any) {
      toast.error(err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleAutoMatch = async () => {
    try {
      setUploading(true);
      const unmatched = statements.filter(s => s.match_status === 'unmatched');
      if (!unmatched.length) { toast.info('No unmatched transactions'); return; }

      const { data: journalEntries } = await supabase
        .from('journal_entries')
        .select('*')
        .gte('date', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
        .lte('date', new Date().toISOString().split('T')[0]);

      if (!journalEntries?.length) { toast.info('No journal entries found'); return; }

      let matchCount = 0;
      for (const s of unmatched) {
        const sAmt = s.credit_amount > 0 ? s.credit_amount : -s.debit_amount;
        const sDate = new Date(s.transaction_date);
        for (const e of journalEntries) {
          if (e.entry_number === s.matched_journal_entry_id) continue;
          const eAmt = e.credit_amount > 0 ? e.credit_amount : -e.debit_amount;
          const diff = Math.abs(sDate.getTime() - new Date(e.date).getTime());
          if (Math.abs(sAmt - eAmt) <= 0.01 && diff <= 3 * 86400000) {
            await supabase.from('bank_statements').update({ matched_journal_entry_id: e.entry_number, match_status: 'matched' }).eq('id', s.id);
            matchCount++;
            break;
          }
        }
      }

      if (matchCount > 0) { toast.success(`Auto-matched ${matchCount} transactions`); queryClient.invalidateQueries({ queryKey: ['bank_statements', account.id] }); }
      else toast.info('No auto-matches found. Try manual matching.');
    } catch {
      toast.error('Error during auto-matching');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      {/* Account Statement Header */}
      <div style={{
        background: 'linear-gradient(135deg, var(--primary-700, #1e40af) 0%, var(--primary-500, #3b82f6) 100%)',
        borderRadius: 14,
        padding: '28px 32px',
        marginBottom: 24,
        color: 'white',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 20,
      }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', opacity: 0.75, marginBottom: 6 }}>
            Bank Account Statement
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.5px', marginBottom: 4 }}>
            {account.name}
          </div>
          <div style={{ fontSize: 13, opacity: 0.8, fontFamily: 'var(--font-mono, monospace)' }}>
            Account Code: {account.code}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 12, fontWeight: 600, opacity: 0.75, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Current Balance
          </div>
          <div style={{ fontSize: 32, fontWeight: 800, letterSpacing: '-1px' }}>
            {formatCurrency(currentBalance)}
          </div>
          <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>
            {statements.length} total transactions
          </div>
        </div>
      </div>

      {/* Summary Tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'Total Credits', value: formatCurrency(totalCredits), icon: <ArrowDownRight size={18} />, color: '#15803d', bg: '#f0fdf4', border: '#bbf7d0' },
          { label: 'Total Debits',  value: formatCurrency(totalDebits),  icon: <ArrowUpRight  size={18} />, color: '#b91c1c', bg: '#fef2f2', border: '#fecaca' },
          { label: 'Matched',       value: `${matched} txn`,             icon: <CheckCircle   size={18} />, color: '#0369a1', bg: '#eff6ff', border: '#bfdbfe' },
          { label: 'Unmatched',     value: `${unmatched} txn`,           icon: <AlertCircle   size={18} />, color: '#a16207', bg: '#fffbeb', border: '#fde68a' },
        ].map(tile => (
          <div key={tile.label} style={{
            background: tile.bg, border: `1px solid ${tile.border}`,
            borderRadius: 10, padding: '16px 20px',
            display: 'flex', alignItems: 'center', gap: 14,
          }}>
            <div style={{ color: tile.color, opacity: 0.8 }}>{tile.icon}</div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: tile.color, opacity: 0.8, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>
                {tile.label}
              </div>
              <div style={{ fontSize: 17, fontWeight: 800, color: tile.color }}>
                {tile.value}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Actions bar */}
      <div style={{
        background: 'var(--card-bg, white)',
        border: '1px solid var(--slate-200)',
        borderRadius: 12,
        padding: '16px 20px',
        marginBottom: 20,
        display: 'flex',
        gap: 12,
        alignItems: 'center',
        flexWrap: 'wrap',
      }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--slate-700)' }}>Upload Statement:</span>
        <input
          id={`csv-input-${account.id}`}
          type="file"
          accept=".csv"
          onChange={handleFileSelect}
          style={{ fontSize: 13, color: 'var(--slate-600)', border: '1px solid var(--slate-300)', borderRadius: 8, padding: '6px 10px', background: 'white' }}
        />
        <button
          onClick={handleUpload}
          disabled={uploading || !csvFile}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 16px', borderRadius: 8, border: 'none',
            background: 'linear-gradient(135deg, var(--primary-600, #2563eb), var(--primary-500, #3b82f6))',
            color: 'white', fontSize: 13, fontWeight: 600,
            cursor: uploading || !csvFile ? 'not-allowed' : 'pointer',
            opacity: uploading || !csvFile ? 0.6 : 1,
          }}
        >
          <Upload size={14} />
          {uploading ? 'Uploading…' : 'Upload CSV'}
        </button>

        <div style={{ flex: 1 }} />

        {/* Filter tabs */}
        <div style={{ display: 'flex', gap: 4, background: 'var(--slate-100)', borderRadius: 8, padding: 3 }}>
          {(['all', 'unmatched', 'matched', 'partial', 'disputed'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilterStatus(f)}
              style={{
                padding: '5px 12px', borderRadius: 6, border: 'none',
                fontSize: 12, fontWeight: 600, cursor: 'pointer',
                background: filterStatus === f ? 'white' : 'transparent',
                color: filterStatus === f ? 'var(--slate-800)' : 'var(--slate-500)',
                boxShadow: filterStatus === f ? '0 1px 3px rgba(0,0,0,0.12)' : 'none',
                textTransform: 'capitalize',
                transition: 'all 0.15s',
              }}
            >
              {f === 'all' ? `All (${statements.length})` : f}
            </button>
          ))}
        </div>

        <button
          onClick={handleAutoMatch}
          disabled={uploading}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 16px', borderRadius: 8, border: 'none',
            background: 'linear-gradient(135deg, #16a34a, #22c55e)',
            color: 'white', fontSize: 13, fontWeight: 600,
            cursor: uploading ? 'not-allowed' : 'pointer',
            opacity: uploading ? 0.6 : 1,
          }}
        >
          <Link2 size={14} /> Auto Match
        </button>
      </div>

      {/* Statement Table */}
      <div style={{
        background: 'var(--card-bg, white)',
        border: '1px solid var(--slate-200)',
        borderRadius: 12,
        overflow: 'hidden',
        boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
      }}>
        {/* Table Header */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '120px 1fr 130px 140px 140px 150px 130px',
          background: 'var(--slate-50)',
          borderBottom: '2px solid var(--slate-200)',
          padding: '12px 20px',
          gap: 12,
        }}>
          {['Date', 'Description', 'Reference', 'Debit', 'Credit', 'Balance', 'Status'].map(h => (
            <div key={h} style={{ fontSize: 11, fontWeight: 700, color: 'var(--slate-500)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
              {h}
            </div>
          ))}
        </div>

        {/* Table Body */}
        {isLoading ? (
          <div style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--slate-400)', fontSize: 14 }}>
            <RefreshCw size={20} style={{ margin: '0 auto 10px', display: 'block', animation: 'spin 1s linear infinite' }} />
            Loading transactions…
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--slate-400)', fontSize: 14 }}>
            <Landmark size={32} style={{ margin: '0 auto 12px', display: 'block', opacity: 0.35 }} />
            {statements.length === 0
              ? 'No transactions yet. Upload a CSV bank statement to get started.'
              : 'No transactions match this filter.'}
          </div>
        ) : (
          filtered.map((row, idx) => {
            const debit  = Number(row.debit_amount)  || 0;
            const credit = Number(row.credit_amount) || 0;
            const bal    = row._runningBalance;
            const isEven = idx % 2 === 0;

            return (
              <div
                key={row.id}
                onClick={() => { setSelectedTx(row); setShowMatchModal(true); }}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '120px 1fr 130px 140px 140px 150px 130px',
                  padding: '13px 20px',
                  gap: 12,
                  background: isEven ? 'white' : 'var(--slate-50, #f8fafc)',
                  borderBottom: '1px solid var(--slate-100)',
                  cursor: 'pointer',
                  transition: 'background 0.12s',
                  alignItems: 'center',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--primary-50, #eff6ff)')}
                onMouseLeave={e => (e.currentTarget.style.background = isEven ? 'white' : 'var(--slate-50, #f8fafc)')}
              >
                {/* Date */}
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--slate-700)' }}>
                  {new Date(row.transaction_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                </div>

                {/* Description */}
                <div style={{ fontSize: 13, color: 'var(--slate-800)', lineHeight: 1.45, wordBreak: 'break-word' }}>
                  {row.description}
                  {row.matched_journal_entry_id && (
                    <span style={{ marginLeft: 8, fontSize: 11, fontFamily: 'var(--font-mono, monospace)', color: 'var(--slate-400)', background: 'var(--slate-100)', padding: '2px 6px', borderRadius: 4 }}>
                      JE#{row.matched_journal_entry_id}
                    </span>
                  )}
                </div>

                {/* Reference */}
                <div style={{ fontSize: 12, fontFamily: 'var(--font-mono, monospace)', color: 'var(--slate-500)' }}>
                  {row.reference || '—'}
                </div>

                {/* Debit */}
                <div style={{ textAlign: 'right', fontWeight: 600, fontSize: 13, color: debit > 0 ? '#b91c1c' : 'var(--slate-300)' }}>
                  {debit > 0 ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <ArrowUpRight size={13} />
                      {formatCurrency(debit)}
                    </span>
                  ) : '—'}
                </div>

                {/* Credit */}
                <div style={{ textAlign: 'right', fontWeight: 600, fontSize: 13, color: credit > 0 ? '#15803d' : 'var(--slate-300)' }}>
                  {credit > 0 ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <ArrowDownRight size={13} />
                      {formatCurrency(credit)}
                    </span>
                  ) : '—'}
                </div>

                {/* Balance */}
                <div style={{ textAlign: 'right', fontWeight: 700, fontSize: 13, color: bal >= 0 ? 'var(--slate-800)' : '#b91c1c' }}>
                  {formatCurrency(bal)}
                </div>

                {/* Status */}
                <div>
                  <StatusPill status={row.match_status} />
                </div>
              </div>
            );
          })
        )}

        {/* Totals footer */}
        {filtered.length > 0 && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: '120px 1fr 130px 140px 140px 150px 130px',
            padding: '14px 20px',
            gap: 12,
            background: 'var(--slate-800, #1e293b)',
            borderTop: '2px solid var(--slate-300)',
            alignItems: 'center',
          }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'white', gridColumn: '1 / 4', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Showing {filtered.length} of {statements.length}
            </div>
            <div style={{ textAlign: 'right', fontWeight: 800, fontSize: 14, color: '#fca5a5' }}>
              {formatCurrency(filtered.reduce((s, r) => s + (Number(r.debit_amount) || 0), 0))}
            </div>
            <div style={{ textAlign: 'right', fontWeight: 800, fontSize: 14, color: '#86efac' }}>
              {formatCurrency(filtered.reduce((s, r) => s + (Number(r.credit_amount) || 0), 0))}
            </div>
            <div style={{ textAlign: 'right', fontWeight: 800, fontSize: 14, color: 'white' }}>
              {formatCurrency(currentBalance)}
            </div>
            <div />
          </div>
        )}
      </div>

      <BankReconciliationModal
        isOpen={showMatchModal}
        onClose={() => { setShowMatchModal(false); setSelectedTx(null); }}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['bank_statements', account.id] });
          setShowMatchModal(false);
          setSelectedTx(null);
        }}
        bankTransaction={selectedTx ?? undefined}
      />
    </div>
  );
}

export default function BankReconciliationPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<string>('');

  const { data: bankAccounts, isLoading: loadingAccounts } = useQuery<BankAccount[]>({
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
    onSuccess: (data: BankAccount[]) => {
      if (data.length && !activeTab) setActiveTab(data[0].id);
    },
  } as any);

  const accounts = bankAccounts || [];
  const activeAccount = accounts.find(a => a.id === activeTab);

  // Auto-select first account
  React.useEffect(() => {
    if (accounts.length && !activeTab) setActiveTab(accounts[0].id);
  }, [accounts, activeTab]);

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Bank Reconciliation"
        subtitle="Statement view — match transactions with journal entries"
        breadcrumbs={[
          { label: 'Accounting', href: '/accounting/journal' },
          { label: 'Bank Reconciliation' },
        ]}
      />

      {/* Bank Tabs */}
      {loadingAccounts ? (
        <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--slate-400)', fontSize: 14 }}>
          Loading bank accounts…
        </div>
      ) : accounts.length === 0 ? (
        <div style={{
          background: 'var(--card-bg, white)', border: '1px solid var(--slate-200)',
          borderRadius: 12, padding: '48px 32px', textAlign: 'center',
        }}>
          <Landmark size={40} style={{ margin: '0 auto 14px', display: 'block', color: 'var(--slate-300)' }} />
          <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--slate-600)', marginBottom: 6 }}>No bank accounts found</p>
          <p style={{ fontSize: 13, color: 'var(--slate-400)' }}>
            Add accounts with type <strong>Asset</strong> and subtype <strong>Cash</strong> in your Chart of Accounts.
          </p>
        </div>
      ) : (
        <>
          {/* Tab strip */}
          <div style={{
            display: 'flex', gap: 0, marginBottom: 28,
            borderBottom: '2px solid var(--slate-200)',
            overflowX: 'auto',
          }}>
            {accounts.map((acc) => {
              const isActive = acc.id === activeTab;
              return (
                <button
                  key={acc.id}
                  onClick={() => setActiveTab(acc.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '12px 24px',
                    border: 'none', background: 'transparent',
                    cursor: 'pointer', whiteSpace: 'nowrap',
                    fontSize: 14, fontWeight: isActive ? 700 : 500,
                    color: isActive ? 'var(--primary-600, #2563eb)' : 'var(--slate-500)',
                    borderBottom: isActive ? '3px solid var(--primary-600, #2563eb)' : '3px solid transparent',
                    marginBottom: -2,
                    transition: 'all 0.15s',
                  }}
                >
                  <Landmark size={15} style={{ opacity: isActive ? 1 : 0.55 }} />
                  <span>{acc.name}</span>
                  <span style={{
                    fontSize: 11, fontWeight: 600,
                    padding: '2px 7px', borderRadius: 20,
                    background: isActive ? 'var(--primary-100, #dbeafe)' : 'var(--slate-100)',
                    color: isActive ? 'var(--primary-700, #1d4ed8)' : 'var(--slate-400)',
                  }}>
                    {acc.code}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Active tab content */}
          {activeAccount && (
            <BankStatementView
              key={activeAccount.id}
              account={activeAccount}
              queryClient={queryClient}
            />
          )}
        </>
      )}
    </div>
  );
}
