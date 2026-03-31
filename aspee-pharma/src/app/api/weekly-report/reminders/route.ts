import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';
import { REPORT_DEPARTMENTS } from '@/lib/hooks';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

function getCurrentWeekStart() {
    const now = new Date();
    const day = now.getDay();
    const diffToMonday = day === 0 ? -6 : 1 - day;
    const monday = new Date(now);
    monday.setDate(now.getDate() + diffToMonday);
    monday.setHours(0, 0, 0, 0);
    return monday.toISOString().split('T')[0];
}

function createTransporter() {
    return nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
        },
    });
}

function reminderHtml(department: string, weekStart: string) {
    return `<!DOCTYPE html>
<html>
<body style="font-family:Segoe UI, sans-serif;background:#f8fafc;padding:24px;">
    <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;">
        <div style="padding:24px 28px;background:linear-gradient(135deg,#dc2626,#f97316);color:#ffffff;">
            <p style="margin:0 0 6px;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:rgba(255,255,255,0.8);">Aspee Pharmaceuticals Limited</p>
            <h1 style="margin:0;font-size:24px;">Weekly Report Reminder</h1>
        </div>
        <div style="padding:24px 28px;color:#334155;line-height:1.7;">
            <p>Hello ${department} team,</p>
            <p>This is an automatic reminder that your department has not yet submitted its weekly report for the week starting <strong>${new Date(weekStart).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</strong>.</p>
            <p>Please log in to the Aspee Pharma Management System and complete your submission from the <strong>Weekly Reports</strong> page before close of business today.</p>
            <p style="margin-bottom:0;">Thank you.</p>
        </div>
    </div>
</body>
</html>`;
}

export async function POST() {
    try {
        const today = new Date();
        if (today.getDay() !== 5) {
            return NextResponse.json({ success: true, message: 'Today is not Friday. No reminders sent.' });
        }

        const weekStart = getCurrentWeekStart();

        const { data: submittedReports, error: reportError } = await supabase
            .from('weekly_reports')
            .select('department')
            .eq('report_week_start', weekStart);
        if (reportError) throw reportError;

        const submittedDepartments = new Set((submittedReports || []).map((row: any) => row.department));
        const pendingDepartments = REPORT_DEPARTMENTS.filter((department) => !submittedDepartments.has(department));

        if (pendingDepartments.length === 0) {
            return NextResponse.json({ success: true, message: 'All departments have submitted their reports.' });
        }

        const { data: users, error: usersError } = await supabase
            .from('system_users')
            .select('name, email, department, status')
            .in('department', pendingDepartments as unknown as string[])
            .eq('status', 'Active');
        if (usersError) throw usersError;

        const transporter = createTransporter();
        const sentTo: string[] = [];

        for (const department of pendingDepartments) {
            const recipients = (users || [])
                .filter((user: any) => user.department === department && user.email)
                .map((user: any) => user.email);

            if (recipients.length === 0) continue;

            await transporter.sendMail({
                from: `"${process.env.SMTP_FROM_NAME || 'Aspee Pharma System'}" <${process.env.SMTP_USER}>`,
                to: recipients,
                subject: `Reminder: ${department} weekly report is still pending`,
                html: reminderHtml(department, weekStart),
            });

            sentTo.push(`${department} (${recipients.length})`);

            await supabase
                .from('weekly_reports')
                .upsert([
                    {
                        department,
                        report_week_start: weekStart,
                        report_week_end: weekStart,
                        summary: 'Reminder placeholder - report not yet submitted.',
                        submitted_by: null,
                        submitted_by_email: null,
                        status: 'Pending Submission',
                        read_status: 'Unread',
                        reminder_sent_at: new Date().toISOString(),
                    },
                ], { onConflict: 'department,report_week_start' });
        }

        return NextResponse.json({ success: true, message: `Reminder emails sent to: ${sentTo.join(', ')}` });
    } catch (error: any) {
        return NextResponse.json({ error: error.message || 'Failed to send reminders.' }, { status: 500 });
    }
}
