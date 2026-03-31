/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import {
    Banknote,
    FileText,
    Calendar,
    Hash,
    CheckCircle,
    XCircle,
    AlertCircle,
    Save,
    Search
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/currency';

interface BankTransaction {
  id: string;
  transaction_date: string;
  description: string;
  reference: string | null;
  debit_amount: number;
  credit_amount: number;
  balance: number | null;
  match_status: string;
  matched_journal_entry_id: string | null;
}

interface JournalEntry {
  entry_number: string;
  date: string;
  debit_account: string;
  credit_account: string;
  debit_amount: number;
  credit_amount: number;
  description: string;
  ref_type: string;
}

interface BankReconciliationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  bankTransaction?: BankTransaction;
}

export default function BankReconciliationModal({ 
  isOpen, 
  onClose, 
  onSuccess, 
  bankTransaction 
}: BankReconciliationModalProps) {
  const [loading, setLoading] = useState(false);
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [selectedEntry, setSelectedEntry] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateRange, setDateRange] = useState({
    start: '',
    end: ''
  });

  useEffect(() => {
    if (isOpen && bankTransaction) {
      loadPotentialMatches();
      // Set date range to ±7 days from transaction date
      const txDate = new Date(bankTransaction.transaction_date);
      const startDate = new Date(txDate);
      startDate.setDate(startDate.getDate() - 7);
      const endDate = new Date(txDate);
      endDate.setDate(endDate.getDate() + 7);
      
      setDateRange({
        start: startDate.toISOString().split('T')[0],
        end: endDate.toISOString().split('T')[0]
      });
    }
  }, [isOpen, bankTransaction]);

  const loadPotentialMatches = async () => {
    if (!bankTransaction) return;

    try {
      setLoading(true);
      
      // Calculate amount to match (positive for credits, negative for debits)
      const transactionAmount = bankTransaction.credit_amount > 0 
        ? bankTransaction.credit_amount 
        : -bankTransaction.debit_amount;

      // Query journal entries within date range and amount tolerance
      const { data, error } = await supabase
        .from('journal_entries')
        .select('*')
        .gte('date', dateRange.start || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
        .lte('date', dateRange.end || new Date().toISOString().split('T')[0])
        .order('date', { ascending: false });

      if (error) {
        console.error('Error loading journal entries:', error);
        toast.error('Failed to load journal entries');
        return;
      }

      // Filter entries by amount (exact match or within tolerance)
      const potentialMatches = (data || []).filter(entry => {
        const entryAmount = entry.credit_amount > 0 ? entry.credit_amount : -entry.debit_amount;
        const amountDiff = Math.abs(entryAmount - transactionAmount);
        const tolerance = 0.01; // 1 cent tolerance
        return amountDiff <= tolerance;
      });

      setJournalEntries(potentialMatches);
    } catch (error: any) {
      console.error('Error loading matches:', error);
      toast.error('Error loading potential matches');
    } finally {
      setLoading(false);
    }
  };

  const handleMatch = async () => {
    if (!bankTransaction || !selectedEntry) {
      toast.error('Please select a journal entry to match');
      return;
    }

    try {
      setLoading(true);

      const { error } = await supabase
        .from('bank_statements')
        .update({
          matched_journal_entry_id: selectedEntry,
          match_status: 'matched'
        })
        .eq('id', bankTransaction.id);

      if (error) {
        console.error('Error matching transaction:', error);
        toast.error('Failed to match transaction');
        return;
      }

      toast.success('Transaction matched successfully');
      onSuccess?.();
      onClose();
    } catch (error: any) {
      console.error('Error matching transaction:', error);
      toast.error('Error matching transaction');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateJournalEntry = async () => {
    if (!bankTransaction) return;

    try {
      setLoading(true);

      // Create a journal entry for this bank transaction
      const now = new Date();
      const yy = now.getFullYear().toString().slice(-2);
      const mm = (now.getMonth() + 1).toString().padStart(2, '0');
      const rand = Math.floor(1000 + Math.random() * 9000);
      const entryNumber = `JNL-${yy}${mm}-${rand}`;

      const { error: insertError } = await supabase
        .from('journal_entries')
        .insert({
          entry_number: entryNumber,
          date: bankTransaction.transaction_date,
          debit_account: bankTransaction.debit_amount > 0 ? 'Bank Charges' : 'Cash at Bank',
          credit_account: bankTransaction.credit_amount > 0 ? 'Bank Accounts' : 'Bank Charges',
          debit_amount: bankTransaction.debit_amount,
          credit_amount: bankTransaction.credit_amount,
          description: bankTransaction.description,
          ref_type: 'Bank Transaction',
          notes: bankTransaction.reference || ''
        });

      if (insertError) {
        console.error('Error creating journal entry:', insertError);
        toast.error('Failed to create journal entry');
        return;
      }

      // Update bank statement with the new journal entry
      const { error: updateError } = await supabase
        .from('bank_statements')
        .update({
          matched_journal_entry_id: entryNumber,
          match_status: 'matched'
        })
        .eq('id', bankTransaction.id);

      if (updateError) {
        console.error('Error updating bank statement:', updateError);
        toast.error('Journal entry created but failed to link to bank transaction');
        return;
      }

      toast.success('Journal entry created and matched successfully');
      onSuccess?.();
      onClose();
    } catch (error: any) {
      console.error('Error creating journal entry:', error);
      toast.error('Error creating journal entry');
    } finally {
      setLoading(false);
    }
  };

  const filteredEntries = journalEntries.filter(entry => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      entry.description.toLowerCase().includes(searchLower) ||
      entry.debit_account.toLowerCase().includes(searchLower) ||
      entry.credit_account.toLowerCase().includes(searchLower) ||
      entry.ref_type.toLowerCase().includes(searchLower)
    );
  });

  if (!bankTransaction) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Match Bank Transaction"
      size="lg"
    >
      <div style={{ maxHeight: '70vh', overflowY: 'auto' }}>
        {/* Bank Transaction Details */}
        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>Bank Transaction Details</h3>
          <div style={styles.transactionCard}>
            <div style={styles.detailRow}>
              <span style={styles.detailLabel}>Date:</span>
              <span style={styles.detailValue}>{bankTransaction.transaction_date}</span>
            </div>
            <div style={styles.detailRow}>
              <span style={styles.detailLabel}>Description:</span>
              <span style={styles.detailValue}>{bankTransaction.description}</span>
            </div>
            {bankTransaction.reference && (
              <div style={styles.detailRow}>
                <span style={styles.detailLabel}>Reference:</span>
                <span style={styles.detailValue}>{bankTransaction.reference}</span>
              </div>
            )}
            <div style={styles.detailRow}>
              <span style={styles.detailLabel}>Amount:</span>
              <span style={{
                ...styles.detailValue,
                color: bankTransaction.credit_amount > 0 ? 'var(--success-600)' : 'var(--danger-600)',
                fontWeight: 'bold'
              }}>
                {bankTransaction.credit_amount > 0 ? '+' : '-'}
                {formatCurrency(bankTransaction.credit_amount > 0 ? bankTransaction.credit_amount : bankTransaction.debit_amount)}
              </span>
            </div>
          </div>
        </div>

        {/* Matching Options */}
        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>Match Options</h3>
          
          {/* Search and Filter */}
          <div style={styles.filterRow}>
            <input
              type="text"
              placeholder="Search journal entries..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={styles.searchInput}
            />
            <button
              onClick={loadPotentialMatches}
              disabled={loading}
              style={styles.refreshButton}
            >
              <Search size={16} />
              Refresh
            </button>
          </div>

          {/* Journal Entries List */}
          <div style={styles.entriesList}>
            {filteredEntries.length === 0 ? (
              <div style={styles.emptyState}>
                <AlertCircle size={48} style={{ color: 'var(--slate-400)', marginBottom: '16px' }} />
                <p>No matching journal entries found</p>
                <p style={{ fontSize: '14px', color: 'var(--slate-500)', marginTop: '8px' }}>
                  Try adjusting the date range or search criteria
                </p>
              </div>
            ) : (
              filteredEntries.map(entry => (
                <div
                  key={entry.entry_number}
                  style={{
                    ...styles.entryCard,
                    ...(selectedEntry === entry.entry_number ? styles.entryCardSelected : {})
                  }}
                  onClick={() => setSelectedEntry(entry.entry_number)}
                >
                  <div style={styles.entryHeader}>
                    <span style={styles.entryNumber}>{entry.entry_number}</span>
                    <span style={styles.entryDate}>{entry.date}</span>
                  </div>
                  <div style={styles.entryDescription}>{entry.description}</div>
                  <div style={styles.entryAccounts}>
                    <span style={styles.debitLabel}>Debit:</span>
                    <span style={styles.accountName}>{entry.debit_account}</span>
                    <span style={styles.amount}>{formatCurrency(entry.debit_amount)}</span>
                  </div>
                  <div style={styles.entryAccounts}>
                    <span style={styles.creditLabel}>Credit:</span>
                    <span style={styles.accountName}>{entry.credit_account}</span>
                    <span style={styles.amount}>{formatCurrency(entry.credit_amount)}</span>
                  </div>
                  <div style={styles.entryFooter}>
                    <span style={styles.refType}>{entry.ref_type}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div style={styles.actionRow}>
          <button
            onClick={handleMatch}
            disabled={loading || !selectedEntry}
            style={{
              ...styles.primaryButton,
              ...(loading || !selectedEntry ? styles.buttonDisabled : {})
            }}
          >
            <CheckCircle size={16} />
            {selectedEntry ? 'Match Selected Entry' : 'Select an Entry to Match'}
          </button>
          
          <button
            onClick={handleCreateJournalEntry}
            disabled={loading}
            style={{
              ...styles.secondaryButton,
              ...(loading ? styles.buttonDisabled : {})
            }}
          >
            <FileText size={16} />
            Create Journal Entry
          </button>
        </div>
      </div>
    </Modal>
  );
}

const styles: Record<string, React.CSSProperties> = {
  section: {
    marginBottom: '24px'
  },
  sectionTitle: {
    fontSize: '16px',
    fontWeight: '600',
    color: 'var(--slate-800)',
    marginBottom: '12px'
  },
  transactionCard: {
    backgroundColor: 'var(--slate-50)',
    border: '1px solid var(--slate-200)',
    borderRadius: '8px',
    padding: '16px'
  },
  detailRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 0',
    borderBottom: '1px solid var(--slate-200)'
  },
  detailLabel: {
    fontWeight: '500',
    color: 'var(--slate-600)'
  },
  detailValue: {
    fontWeight: '600',
    color: 'var(--slate-800)'
  },
  filterRow: {
    display: 'flex',
    gap: '12px',
    marginBottom: '16px'
  },
  searchInput: {
    flex: 1,
    padding: '10px 14px',
    border: '1px solid var(--slate-300)',
    borderRadius: '6px',
    fontSize: '14px'
  },
  refreshButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '10px 16px',
    backgroundColor: 'var(--primary-600)',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500'
  },
  entriesList: {
    maxHeight: '300px',
    overflowY: 'auto'
  },
  emptyState: {
    textAlign: 'center',
    padding: '40px 20px',
    color: 'var(--slate-500)'
  },
  entryCard: {
    backgroundColor: 'white',
    border: '1px solid var(--slate-200)',
    borderRadius: '8px',
    padding: '16px',
    marginBottom: '12px',
    cursor: 'pointer',
    transition: 'all 0.2s'
  },
  entryCardSelected: {
    borderColor: 'var(--primary-600)',
    backgroundColor: 'var(--primary-50)',
    boxShadow: '0 0 0 2px var(--primary-100)'
  },
  entryHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8px'
  },
  entryNumber: {
    fontWeight: '600',
    color: 'var(--primary-600)',
    fontSize: '14px'
  },
  entryDate: {
    fontSize: '13px',
    color: 'var(--slate-500)'
  },
  entryDescription: {
    fontSize: '14px',
    color: 'var(--slate-700)',
    marginBottom: '12px',
    lineHeight: '1.5'
  },
  entryAccounts: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '6px',
    fontSize: '13px'
  },
  debitLabel: {
    fontWeight: '500',
    color: 'var(--danger-600)',
    minWidth: '45px'
  },
  creditLabel: {
    fontWeight: '500',
    color: 'var(--success-600)',
    minWidth: '45px'
  },
  accountName: {
    flex: 1,
    color: 'var(--slate-700)'
  },
  amount: {
    fontWeight: '600',
    color: 'var(--slate-800)'
  },
  entryFooter: {
    marginTop: '8px',
    paddingTop: '8px',
    borderTop: '1px solid var(--slate-200)'
  },
  refType: {
    display: 'inline-block',
    padding: '2px 8px',
    backgroundColor: 'var(--slate-100)',
    borderRadius: '4px',
    fontSize: '12px',
    color: 'var(--slate-600)'
  },
  actionRow: {
    display: 'flex',
    gap: '12px',
    marginTop: '24px',
    paddingTop: '20px',
    borderTop: '1px solid var(--slate-200)'
  },
  primaryButton: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    padding: '12px 24px',
    background: 'linear-gradient(135deg, var(--primary-600), var(--primary-500))',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '600'
  },
  secondaryButton: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    padding: '12px 24px',
    backgroundColor: 'white',
    color: 'var(--primary-600)',
    border: '1px solid var(--primary-300)',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '600'
  },
  buttonDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed'
  }
};
