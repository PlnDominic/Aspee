'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import PageHeader from '@/components/PageHeader';
import StatCard from '@/components/StatCard';
import StatusBadge from '@/components/StatusBadge';
import { supabase } from '@/lib/supabase';
import { useCurrentUser } from '@/lib/hooks';
import {
    CalendarDays,
    CheckCircle,
    Clock,
    FileText,
    RefreshCw,
    Save,
    Send,
    Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';

type DailyEntry = {
    day: string;
    date: string;
    work_done: string;
    challenges: string;
    next_action: string;
};

type ActivityRow = {
    action?: string;
    description?: string;
    module?: string;
    activity_date?: string;
    created_at?: string;
    user_name?: string;
};

const WEEK_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

function getWorkWeek(date = new Date()) {
    const current = new Date(date);
    const day = current.getDay();
    const diffToMonday = day === 0 ? -6 : 1 - day;
    const monday = new Date(current);
    monday.setDate(current.getDate() + diffToMonday);
    monday.setHours(0, 0, 0, 0);

    const friday = new Date(monday);
    friday.setDate(monday.getDate() + 4);
    friday.setHours(23, 59, 59, 999);

    return { monday, friday };
}

function toInputDate(date: Date) {
    return date.toISOString().split('T')[0];
}

function emptyEntries(monday: Date): DailyEntry[] {
    return WEEK_DAYS.map((day, index) => {
        const date = new Date(monday);
        date.setDate(monday.getDate() + index);
        return {
            day,
            date: toInputDate(date),
            work_done: '',
            challenges: '',
            next_action: '',
        };
    });
}

function buildSummary(entries: DailyEntry[]) {
    const completed = entries
        .filter((entry) => entry.work_done.trim())
        .map((entry) => `${entry.day}: ${entry.work_done.trim()}`);

    return completed.length > 0
        ? completed.join('\n')
        : 'Weekly report draft in progress.';
}

function buildNextPlan(entries: DailyEntry[]) {
    return entries
        .filter((entry) => entry.next_action.trim())
        .map((entry) => `${entry.day}: ${entry.next_action.trim()}`)
        .join('\n');
}

function summarizeActivities(rows: ActivityRow[]) {
    if (rows.length === 0) return '';

    const moduleCounts = rows.reduce<Record<string, number>>((acc, row) => {
        const moduleName = row.module || 'General';
        acc[moduleName] = (acc[moduleName] || 0) + 1;
        return acc;
    }, {});

    const moduleSummary = Object.entries(moduleCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([moduleName, count]) => `${moduleName} (${count})`)
        .join(', ');

    const highlights = rows
        .slice(0, 6)
        .map((row) => row.description)
        .filter(Boolean);

    return [
        `${rows.length} system activities recorded across ${moduleSummary}.`,
        highlights.length ? `Key work: ${highlights.join('; ')}.` : '',
    ].filter(Boolean).join('\n');
}

export default function WeeklyReportsPage() {
    const { data: currentUser } = useCurrentUser();
    const { monday, friday } = useMemo(() => getWorkWeek(), []);
    const weekStart = toInputDate(monday);
    const weekEnd = toInputDate(friday);

    const [reportId, setReportId] = useState<string | null>(null);
    const [entries, setEntries] = useState<DailyEntry[]>(() => emptyEntries(monday));
    const [selectedDate, setSelectedDate] = useState(toInputDate(new Date()));
    const [summary, setSummary] = useState('');
    const [status, setStatus] = useState('Draft');
    const [readStatus, setReadStatus] = useState('Unread');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [prefilling, setPrefilling] = useState(false);

    const department = currentUser?.department || '';
    const completedDays = entries.filter((entry) => entry.work_done.trim()).length;
    const fridayReady = completedDays === 5 && summary.trim().length > 0;
    const selectedEntry = entries.find((entry) => entry.date === selectedDate) || entries[0];

    const prefillFromActivity = useCallback(async () => {
        if (!department) return emptyEntries(monday);

        setPrefilling(true);
        try {
            const { data: auditRows, error } = await supabase
                .from('department_activity_logs')
                .select('action, description, module, activity_date, created_at, user_name')
                .eq('department', department)
                .gte('activity_date', weekStart)
                .lte('activity_date', weekEnd)
                .order('created_at', { ascending: true });

            if (error) throw error;

            const seeded = emptyEntries(monday);
            return seeded.map((entry) => {
                const daily = (auditRows || []).filter((row: any) => row.activity_date === entry.date);

                return {
                    ...entry,
                    work_done: summarizeActivities(daily),
                    challenges: '',
                    next_action: '',
                };
            });
        } catch (error: any) {
            toast.error('Failed to prefill daily work: ' + error.message);
            return emptyEntries(monday);
        } finally {
            setPrefilling(false);
        }
    }, [department, monday, weekEnd, weekStart]);

    const loadReport = useCallback(async () => {
        if (!department) return;

        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('weekly_reports')
                .select('*')
                .eq('department', department)
                .eq('report_week_start', weekStart)
                .maybeSingle();

            if (error) throw error;

            if (data) {
                setReportId(data.id);
                setEntries(Array.isArray(data.daily_entries) && data.daily_entries.length ? data.daily_entries : emptyEntries(monday));
                setSummary(data.summary === 'Weekly report draft in progress.' ? '' : data.summary || '');
                setStatus(data.status || 'Draft');
                setReadStatus(data.read_status || 'Unread');
            } else {
                const seeded = await prefillFromActivity();
                setEntries(seeded);
                setSummary(buildSummary(seeded) === 'Weekly report draft in progress.' ? '' : buildSummary(seeded));
                setStatus('Draft');
                setReadStatus('Unread');
                setReportId(null);
            }
        } catch (error: any) {
            toast.error('Failed to load weekly report: ' + error.message);
        } finally {
            setLoading(false);
        }
    }, [department, monday, prefillFromActivity, weekStart]);

    useEffect(() => {
        loadReport();
    }, [loadReport]);

    const handleRefreshPrefill = async () => {
        const seeded = await prefillFromActivity();
        setEntries(seeded);
        setSummary(buildSummary(seeded) === 'Weekly report draft in progress.' ? '' : buildSummary(seeded));
        toast.success('Weekly report refreshed from system activity.');
    };

    const saveReport = async (nextStatus: 'Draft' | 'Submitted') => {
        if (!department) {
            toast.error('Your department is not set on your user profile.');
            return null;
        }

        const effectiveSummary = summary.trim() || buildSummary(entries);
        const payload = {
            id: reportId || undefined,
            department,
            report_week_start: weekStart,
            report_week_end: weekEnd,
            summary: effectiveSummary,
            achievements: null,
            challenges: null,
            next_week_plan: buildNextPlan(entries) || null,
            submitted_by: currentUser?.name || currentUser?.email || 'Unknown user',
            submitted_by_email: currentUser?.email || null,
            submitted_at: new Date().toISOString(),
            status: nextStatus,
            read_status: nextStatus === 'Submitted' ? 'Unread' : readStatus,
            attachments: [],
            daily_entries: entries,
            department_data: {},
            draft_saved_at: new Date().toISOString(),
        };

        setSaving(true);
        try {
            const { data, error } = await supabase
                .from('weekly_reports')
                .upsert([payload], { onConflict: 'department,report_week_start' })
                .select('*')
                .single();

            if (error) throw error;

            setReportId(data.id);
            setStatus(data.status);
            setReadStatus(data.read_status);
            toast.success(nextStatus === 'Draft' ? 'Generated weekly report draft saved.' : 'Generated weekly report saved for submission.');
            return { ...payload, id: data.id };
        } catch (error: any) {
            toast.error('Failed to save weekly report: ' + error.message);
            return null;
        } finally {
            setSaving(false);
        }
    };

    const handleSaveDraft = async () => {
        await saveReport('Draft');
    };

    const handleSubmit = async () => {
        if (!summary.trim() && entries.every((entry) => !entry.work_done.trim())) {
            toast.error('No system-recorded work was found for the week.');
            return;
        }

        const saved = await saveReport('Submitted');
        if (!saved) return;

        try {
            const response = await fetch('/api/weekly-report', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ mode: 'department-submission', report: saved }),
            });

            const result = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(result.error || 'Failed to send report to Managing Director.');

            toast.success('Weekly report sent to the Managing Director.');
            setStatus('Submitted');
        } catch (error: any) {
            toast.error(error.message || 'Failed to send report.');
        }
    };

    if (loading) {
        return <div style={{ padding: 32, color: 'var(--slate-500)' }}>Loading weekly report...</div>;
    }

    return (
        <div className="animate-fade-in">
            <PageHeader
                title="Weekly Reports"
                subtitle="Automatically generated department work summary for the selected date"
                breadcrumbs={[{ label: 'Reports' }, { label: 'Weekly Reports' }]}
                actions={
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                        <button onClick={handleRefreshPrefill} disabled={prefilling || saving} className="weekly-btn ghost">
                            <RefreshCw size={15} /> {prefilling ? 'Refreshing...' : 'Refresh from Activity'}
                        </button>
                        <button onClick={handleSaveDraft} disabled={saving} className="weekly-btn secondary">
                            <Save size={15} /> Save Draft
                        </button>
                        <button onClick={handleSubmit} disabled={saving} className="weekly-btn primary">
                            <Send size={15} /> Send to MD
                        </button>
                    </div>
                }
            />

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 16, marginBottom: 24 }}>
                <StatCard title="Department" value={department || '-'} icon={<FileText size={20} />} color="blue" />
                <StatCard title="Days With Activity" value={`${completedDays}/5`} icon={<CalendarDays size={20} />} color="green" />
                <StatCard title="Week Ends" value={new Date(weekEnd).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} icon={<Clock size={20} />} color="amber" />
                <div style={{ padding: 18, borderRadius: 12, background: 'var(--card-bg)', border: '1px solid var(--slate-200)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--slate-500)', textTransform: 'uppercase' }}>Status</span>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <StatusBadge status={status} variant={status === 'Submitted' ? 'success' : 'warning'} />
                        {fridayReady && <CheckCircle size={16} color="var(--success)" />}
                    </div>
                </div>
            </div>

            <div className="weekly-shell">
                <section className="weekly-panel">
                    <div className="panel-title">
                        <Sparkles size={16} />
                        Selected Day Activity
                    </div>
                    <div className="auto-note">
                        Select a date from Monday to Friday. Activities logged by your department on that date are summarized automatically.
                    </div>
                    <div className="date-picker-row">
                        <label>Activity date</label>
                        <input
                            type="date"
                            min={weekStart}
                            max={weekEnd}
                            value={selectedDate}
                            onChange={(event) => setSelectedDate(event.target.value)}
                        />
                    </div>
                    <div className="daily-card selected">
                        <div className="daily-card-head">
                            <div>
                                <strong>{selectedEntry?.day}</strong>
                                <span>{selectedEntry ? new Date(selectedEntry.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'}</span>
                            </div>
                            <StatusBadge status={selectedEntry?.work_done.trim() ? 'Logged' : 'No Activity'} variant={selectedEntry?.work_done.trim() ? 'success' : 'warning'} />
                        </div>
                        <label>Generated department activity</label>
                        <div className="generated-copy">{selectedEntry?.work_done || 'No department activity has been logged for this date.'}</div>
                    </div>

                    <div className="week-strip">
                        {entries.map((entry) => (
                            <button
                                key={entry.date}
                                type="button"
                                onClick={() => setSelectedDate(entry.date)}
                                className={`day-chip ${entry.date === selectedDate ? 'active' : ''}`}
                            >
                                <span>{entry.day.slice(0, 3)}</span>
                                <strong>{entry.work_done.trim() ? 'Logged' : '-'}</strong>
                            </button>
                        ))}
                    </div>
                </section>

                <aside className="weekly-panel">
                    <div className="panel-title">
                        <FileText size={16} />
                        Friday Submission Preview
                    </div>
                    <div className="form-field">
                        <label>Generated Executive Summary</label>
                        <div className="generated-summary">{summary || buildSummary(entries)}</div>
                    </div>
                    <div className="form-field">
                        <label>Daily coverage</label>
                        <div className="coverage-list">
                            {entries.map((entry) => (
                                <div key={entry.date} className="coverage-item">
                                    <span>{entry.day}</span>
                                    <StatusBadge status={entry.work_done.trim() ? 'Included' : 'No Activity'} variant={entry.work_done.trim() ? 'success' : 'warning'} />
                                </div>
                            ))}
                        </div>
                    </div>
                </aside>
            </div>

            <style>{`
                .weekly-btn {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                    min-height: 36px;
                    padding: 9px 14px;
                    border-radius: 8px;
                    font-size: 11px;
                    font-weight: 700;
                    cursor: pointer;
                    border: 1px solid transparent;
                }
                .weekly-btn.primary { background: linear-gradient(135deg, #0f766e, #14b8a6); color: white; }
                .weekly-btn.secondary { background: var(--primary-600); color: white; }
                .weekly-btn.ghost { background: var(--card-bg); color: var(--slate-700); border-color: var(--slate-200); }
                .weekly-btn.full { width: 100%; margin-top: 12px; }
                .weekly-btn:disabled { opacity: 0.6; cursor: not-allowed; }
                .weekly-shell {
                    display: grid;
                    grid-template-columns: minmax(0, 1.7fr) minmax(320px, 0.8fr);
                    gap: 20px;
                    align-items: start;
                }
                .weekly-panel {
                    background: var(--card-bg);
                    border: 1px solid var(--slate-200);
                    border-radius: 12px;
                    padding: 18px;
                }
                .panel-title {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    font-size: 13px;
                    font-weight: 800;
                    color: var(--slate-800);
                    margin-bottom: 16px;
                }
                .auto-note {
                    padding: 10px 12px;
                    border: 1px solid var(--primary-100);
                    border-radius: 8px;
                    background: var(--primary-50);
                    color: var(--primary-700);
                    font-size: 11px;
                    font-weight: 700;
                    margin-bottom: 14px;
                }
                .daily-card {
                    border: 1px solid var(--slate-200);
                    border-radius: 10px;
                    padding: 14px;
                    background: var(--slate-50);
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                }
                .daily-card.selected {
                    margin-top: 14px;
                }
                .daily-card-head {
                    display: flex;
                    justify-content: space-between;
                    gap: 12px;
                    align-items: flex-start;
                    margin-bottom: 4px;
                }
                .daily-card-head strong {
                    display: block;
                    font-size: 13px;
                    color: var(--slate-900);
                }
                .daily-card-head span {
                    display: block;
                    margin-top: 2px;
                    font-size: 11px;
                    color: var(--slate-500);
                }
                label {
                    font-size: 10px;
                    font-weight: 700;
                    color: var(--slate-500);
                    text-transform: uppercase;
                }
                .generated-copy, .generated-summary {
                    width: 100%;
                    border: 1px solid var(--slate-200);
                    border-radius: 8px;
                    padding: 10px 11px;
                    font-size: 12px;
                    background: var(--card-bg);
                    color: var(--slate-900);
                    white-space: pre-wrap;
                    line-height: 1.55;
                    min-height: 96px;
                }
                .generated-summary {
                    min-height: 220px;
                }
                .date-picker-row {
                    display: grid;
                    grid-template-columns: 140px minmax(180px, 260px);
                    gap: 12px;
                    align-items: center;
                }
                .date-picker-row input {
                    width: 100%;
                    border: 1px solid var(--slate-200);
                    border-radius: 8px;
                    padding: 9px 10px;
                    font-size: 12px;
                    background: var(--card-bg);
                    color: var(--slate-900);
                }
                .week-strip {
                    display: grid;
                    grid-template-columns: repeat(5, 1fr);
                    gap: 8px;
                    margin-top: 14px;
                }
                .day-chip {
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                    align-items: center;
                    padding: 10px 8px;
                    border-radius: 8px;
                    border: 1px solid var(--slate-200);
                    background: var(--card-bg);
                    color: var(--slate-600);
                    cursor: pointer;
                }
                .day-chip.active {
                    border-color: var(--primary-500);
                    background: var(--primary-50);
                    color: var(--primary-700);
                }
                .day-chip span {
                    font-size: 10px;
                    font-weight: 800;
                    text-transform: uppercase;
                }
                .day-chip strong {
                    font-size: 11px;
                }
                .coverage-list {
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                }
                .coverage-item {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    gap: 12px;
                    padding: 10px 12px;
                    border-radius: 8px;
                    background: var(--slate-50);
                    border: 1px solid var(--slate-200);
                    font-size: 12px;
                    font-weight: 700;
                    color: var(--slate-700);
                }
                .form-field { display: flex; flex-direction: column; gap: 8px; margin-bottom: 14px; }
                @media (max-width: 1100px) {
                    .weekly-shell { grid-template-columns: 1fr; }
                }
            `}</style>
        </div>
    );
}
