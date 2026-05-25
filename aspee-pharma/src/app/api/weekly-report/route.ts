import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { ACCOUNTING_ROLES, REPORT_ADMIN_ROLES } from '@/lib/routePermissions';
import {
    createServiceRoleClient,
    isAuthorizedCronRequest,
    requireAuthenticatedUser,
    requireRoles,
} from '@/lib/serverAuth';

const supabase = createServiceRoleClient();

function escapeHtml(value: string) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function sanitizeAttachmentUrl(input: string) {
    try {
        const url = new URL(input);
        if (!['http:', 'https:'].includes(url.protocol)) return null;
        return url.toString();
    } catch {
        return null;
    }
}

// ── Data fetchers ────────────────────────────────────────────────────────────

function weekRange() {
    const now = new Date();
    const day = now.getDay(); // 0=Sun
    const diffToMon = (day === 0 ? -6 : 1 - day);
    const monday = new Date(now);
    monday.setDate(now.getDate() + diffToMon);
    monday.setHours(0, 0, 0, 0);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);
    return {
        from: monday.toISOString(),
        to: sunday.toISOString(),
        label: `${monday.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} – ${sunday.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`,
    };
}

async function fetchSales(from: string, to: string) {
    const { data: invoices } = await supabase
        .from('sales_invoices')
        .select('status, total_amount, date')
        .gte('date', from.split('T')[0])
        .lte('date', to.split('T')[0]);

    const all = invoices || [];
    const revenue = all
        .filter(i => !['Draft', 'Cancelled'].includes(i.status))
        .reduce((s, i) => s + Number(i.total_amount), 0);
    const outstanding = all.filter(i => ['Issued', 'Partially Paid', 'Overdue'].includes(i.status));
    const outstandingTotal = outstanding.reduce((s, i) => s + Number(i.total_amount), 0);

    const { count: customerCount } = await supabase
        .from('customers')
        .select('*', { count: 'exact', head: true });

    return {
        invoicesThisWeek: all.length,
        revenueThisWeek: revenue,
        outstandingCount: outstanding.length,
        outstandingTotal,
        totalCustomers: customerCount || 0,
    };
}

async function fetchPurchasing(from: string, to: string) {
    const { data: pos } = await supabase
        .from('purchase_orders')
        .select('status, total_amount')
        .gte('created_at', from)
        .lte('created_at', to);

    const { data: grns } = await supabase
        .from('goods_receipt_notes')
        .select('id')
        .gte('created_at', from)
        .lte('created_at', to);

    const { count: pendingPos } = await supabase
        .from('purchase_orders')
        .select('*', { count: 'exact', head: true })
        .not('status', 'in', '("Received","Cancelled")');

    return {
        newPOs: (pos || []).length,
        poValue: (pos || []).reduce((s, p) => s + Number(p.total_amount || 0), 0),
        grnsReceived: (grns || []).length,
        pendingPOs: pendingPos || 0,
    };
}

async function fetchStores() {
    const { count: totalProducts } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true });

    const { data: stockData } = await supabase
        .from('stock_levels')
        .select('qty_on_hand, product:products(reorder_level)');

    const low = (stockData || []).filter(s => {
        const prod: any = Array.isArray(s.product) ? s.product[0] : s.product;
        return s.qty_on_hand <= (prod?.reorder_level || 0);
    });

    const { count: transferCount } = await supabase
        .from('stock_movements')
        .select('*', { count: 'exact', head: true })
        .eq('reference_type', 'Transfer')
        .gte('created_at', new Date(Date.now() - 7 * 86400000).toISOString());

    return {
        totalProducts: totalProducts || 0,
        lowStockItems: low.length,
        stockTransfersThisWeek: transferCount || 0,
    };
}

async function fetchProduction(from: string, to: string) {
    const { data: jobs } = await supabase
        .from('production_orders')
        .select('status')
        .gte('created_at', from)
        .lte('created_at', to);

    const { count: activeJobs } = await supabase
        .from('production_orders')
        .select('*', { count: 'exact', head: true })
        .in('status', ['In Progress', 'Pending']);

    const { count: pendingMR } = await supabase
        .from('material_requests')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'Pending');

    return {
        newJobsThisWeek: (jobs || []).length,
        completedThisWeek: (jobs || []).filter(j => j.status === 'Completed').length,
        activeJobs: activeJobs || 0,
        pendingMaterialRequests: pendingMR || 0,
    };
}

async function fetchQA(from: string, to: string) {
    const { data: inProcess } = await supabase
        .from('qa_in_process')
        .select('result')
        .gte('created_at', from)
        .lte('created_at', to);

    const { data: finished } = await supabase
        .from('qa_finished_products')
        .select('status')
        .gte('created_at', from)
        .lte('created_at', to);

    const ipPassed = (inProcess || []).filter(q => q.result === 'Pass').length;
    const ipTotal = (inProcess || []).length;
    const fpReleased = (finished || []).filter(q => q.status === 'Released').length;
    const fpTotal = (finished || []).length;

    return {
        inProcessChecks: ipTotal,
        inProcessPassRate: ipTotal > 0 ? Math.round((ipPassed / ipTotal) * 100) : null,
        finishedProductChecks: fpTotal,
        releasedBatches: fpReleased,
    };
}

async function fetchAccounting(from: string, to: string) {
    const { data: expenses } = await supabase
        .from('expenses')
        .select('amount')
        .gte('date', from.split('T')[0])
        .lte('date', to.split('T')[0]);

    const { data: payroll } = await supabase
        .from('payroll')
        .select('net_pay')
        .gte('created_at', from)
        .lte('created_at', to);

    const { data: payments } = await supabase
        .from('supplier_payments')
        .select('amount')
        .gte('created_at', from)
        .lte('created_at', to);

    return {
        totalExpenses: (expenses || []).reduce((s, e) => s + Number(e.amount || 0), 0),
        payrollProcessed: (payroll || []).reduce((s, p) => s + Number(p.net_pay || 0), 0),
        supplierPayments: (payments || []).reduce((s, p) => s + Number(p.amount || 0), 0),
    };
}

// ── HTML email generator ─────────────────────────────────────────────────────

function fmt(n: number) {
    return `GH₵ ${n.toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function card(color: string, icon: string, title: string, rows: [string, string][]) {
    const borderTop = `border-top: 4px solid ${color};`;
    const rowsHtml = rows
        .map(([label, value]) => `
            <tr>
                <td style="padding:6px 0;font-size:13px;color:#64748b;">${label}</td>
                <td style="padding:6px 0;font-size:13px;font-weight:600;color:#0f172a;text-align:right;">${value}</td>
            </tr>`)
        .join('');
    return `
    <div style="background:#ffffff;border-radius:12px;border:1px solid #e2e8f0;${borderTop}padding:20px 24px;margin-bottom:16px;">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;">
            <span style="font-size:20px;">${icon}</span>
            <h3 style="margin:0;font-size:15px;font-weight:700;color:#0f172a;">${title}</h3>
        </div>
        <table style="width:100%;border-collapse:collapse;">
            <tbody>${rowsHtml}</tbody>
        </table>
    </div>`;
}

function generateHtml(data: any, weekLabel: string) {
    const { sales, purchasing, stores, production, qa, accounting } = data;
    const sentAt = new Date().toLocaleString('en-GB', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });

    return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">

<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 0;">
  <tr><td align="center">
    <table width="640" cellpadding="0" cellspacing="0" style="max-width:640px;width:100%;">

      <!-- Header -->
      <tr><td style="background:linear-gradient(135deg,#0891b2,#0d9488);border-radius:16px 16px 0 0;padding:32px 36px;">
        <p style="margin:0 0 4px;font-size:12px;font-weight:600;color:rgba(255,255,255,0.7);text-transform:uppercase;letter-spacing:0.1em;">Aspee Pharmaceuticals Limited</p>
        <h1 style="margin:0 0 8px;font-size:26px;font-weight:800;color:#ffffff;line-height:1.2;">Weekly Department Report</h1>
        <p style="margin:0;font-size:14px;color:rgba(255,255,255,0.8);">Period: <strong>${weekLabel}</strong></p>
      </td></tr>

      <!-- Body -->
      <tr><td style="background:#f8fafc;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 16px 16px;padding:32px 36px;">

        <p style="margin:0 0 24px;font-size:14px;color:#475569;">
          Good afternoon. Here is the automated weekly performance summary across all departments for the period ending <strong>${weekLabel.split('–')[1]?.trim() || weekLabel}</strong>.
        </p>

        ${card('#0891b2', '🧾', 'Sales', [
            ['Invoices raised this week', String(sales.invoicesThisWeek)],
            ['Revenue this week', fmt(sales.revenueThisWeek)],
            ['Outstanding invoices', `${sales.outstandingCount} (${fmt(sales.outstandingTotal)})`],
            ['Total active customers', String(sales.totalCustomers)],
        ])}

        ${card('#7c3aed', '🛒', 'Purchasing', [
            ['New purchase orders', String(purchasing.newPOs)],
            ['PO value this week', fmt(purchasing.poValue)],
            ['GRNs received', String(purchasing.grnsReceived)],
            ['Pending / open POs', String(purchasing.pendingPOs)],
        ])}

        ${card('#047857', '🏭', 'Stores & Inventory', [
            ['Total products in catalog', String(stores.totalProducts)],
            ['Low stock alerts', String(stores.lowStockItems)],
            ['Stock transfers this week', String(stores.stockTransfersThisWeek)],
        ])}

        ${card('#b45309', '⚙️', 'Production', [
            ['New job orders this week', String(production.newJobsThisWeek)],
            ['Completed this week', String(production.completedThisWeek)],
            ['Currently active jobs', String(production.activeJobs)],
            ['Pending material requests', String(production.pendingMaterialRequests)],
        ])}

        ${card('#be185d', '🔬', 'Quality Assurance', [
            ['In-process checks done', String(qa.inProcessChecks)],
            ['In-process pass rate', qa.inProcessPassRate !== null ? `${qa.inProcessPassRate}%` : 'N/A'],
            ['Finished product checks', String(qa.finishedProductChecks)],
            ['Batches released', String(qa.releasedBatches)],
        ])}

        ${card('#6d28d9', '💰', 'Accounting', [
            ['Total expenses this week', fmt(accounting.totalExpenses)],
            ['Payroll processed', fmt(accounting.payrollProcessed)],
            ['Supplier payments made', fmt(accounting.supplierPayments)],
        ])}

        <hr style="border:none;border-top:1px solid #e2e8f0;margin:28px 0;">

        <p style="margin:0;font-size:12px;color:#94a3b8;text-align:center;">
          This report was automatically generated by the Aspee Pharma Management System on ${sentAt}.<br>
          Log in at <a href="https://aspee-pharma.vercel.app" style="color:#0891b2;">aspee-pharma.vercel.app</a> to view detailed breakdowns.
        </p>
      </td></tr>

    </table>
  </td></tr>
</table>
</body>
</html>`;
}

function generateDepartmentSubmissionHtml(report: any) {
    const weekLabel = `${new Date(report.report_week_start).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} – ${new Date(report.report_week_end).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`;
    const section = (title: string, content?: string | null) => `
        <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;padding:18px 20px;margin-bottom:14px;">
            <h3 style="margin:0 0 10px;font-size:14px;font-weight:700;color:#0f172a;">${title}</h3>
            <p style="margin:0;font-size:13px;line-height:1.7;color:#475569;white-space:pre-wrap;">${content && content.trim() ? content : 'Not provided.'}</p>
        </div>`;
    const dailyEntriesHtml = Array.isArray(report.daily_entries) && report.daily_entries.length
        ? `
        <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;padding:18px 20px;margin-bottom:14px;">
            <h3 style="margin:0 0 14px;font-size:14px;font-weight:700;color:#0f172a;">Monday to Friday Work Log</h3>
            ${report.daily_entries.map((entry: any) => `
                <div style="border-top:1px solid #e2e8f0;padding-top:12px;margin-top:12px;">
                    <div style="display:flex;justify-content:space-between;gap:12px;margin-bottom:8px;">
                        <strong style="font-size:13px;color:#0f172a;">${entry.day}</strong>
                        <span style="font-size:12px;color:#64748b;">${entry.date ? new Date(entry.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : ''}</span>
                    </div>
                    <p style="margin:0;font-size:13px;line-height:1.7;color:#475569;white-space:pre-wrap;">${entry.work_done || 'No system-recorded activity for this day.'}</p>
                </div>
            `).join('')}
        </div>`
        : '';
    const attachmentHtml = Array.isArray(report.attachments) && report.attachments.length
        ? `
        <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;padding:18px 20px;margin-bottom:14px;">
            <h3 style="margin:0 0 10px;font-size:14px;font-weight:700;color:#0f172a;">Attachments</h3>
            <ul style="margin:0;padding-left:18px;">
                ${report.attachments.map((attachment: any) => `<li style="margin-bottom:8px;"><a href="${attachment.url}" style="color:#0891b2;text-decoration:none;font-size:13px;">${escapeHtml(attachment.name)}</a></li>`).join('')}
            </ul>
        </div>`
        : '';

    return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:24px;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
    <div style="max-width:760px;margin:0 auto;background:#f8fafc;border:1px solid #e2e8f0;border-radius:18px;overflow:hidden;">
        <div style="padding:28px 32px;background:linear-gradient(135deg,#1d4ed8,#0891b2);color:#ffffff;">
            <p style="margin:0 0 6px;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:rgba(255,255,255,0.75);">Aspee Pharmaceuticals Limited</p>
            <h1 style="margin:0;font-size:26px;font-weight:800;line-height:1.2;">Department Weekly Report Submission</h1>
            <p style="margin:8px 0 0;font-size:14px;color:rgba(255,255,255,0.85);">${escapeHtml(report.department)} · Reporting week ${weekLabel}</p>
        </div>
        <div style="padding:28px 32px;">
            <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-bottom:18px;">
                <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;padding:16px;">
                    <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#94a3b8;margin-bottom:4px;">Submitted By</div>
                    <div style="font-size:14px;font-weight:700;color:#0f172a;">${escapeHtml(report.submitted_by || 'N/A')}</div>
                    <div style="font-size:12px;color:#64748b;margin-top:4px;">${escapeHtml(report.submitted_by_email || 'No email provided')}</div>
                </div>
                <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;padding:16px;">
                    <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#94a3b8;margin-bottom:4px;">Submitted At</div>
                    <div style="font-size:14px;font-weight:700;color:#0f172a;">${new Date(report.submitted_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
                </div>
            </div>
            ${section('Executive Summary', report.summary)}
            ${dailyEntriesHtml}
            ${section('Major Achievements', report.achievements)}
            ${attachmentHtml}
        </div>
    </div>
</body>
</html>`;
}

async function getReportRecipients() {
    const { data: settings } = await supabase
        .from('system_settings')
        .select('key, value')
        .in('key', ['report_md_email', 'report_cc_emails']);

    const mdEmail = settings?.find(s => s.key === 'report_md_email')?.value;
    const ccRaw = settings?.find(s => s.key === 'report_cc_emails')?.value || '';
    const ccList = ccRaw.split(',').map((e: string) => e.trim()).filter(Boolean);

    return { mdEmail, ccList };
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

// ── Route handler ────────────────────────────────────────────────────────────

export async function POST(request: Request) {
    try {
        let body: any = {};
        try {
            body = await request.json();
        } catch {
            body = {};
        }

        const { mdEmail, ccList } = await getReportRecipients();

        if (!mdEmail) {
            return NextResponse.json(
                { error: 'MD email not configured. Go to Settings → Reports to set it.' },
                { status: 400 }
            );
        }

        const transporter = createTransporter();

        if (body?.mode === 'department-submission' && body?.report) {
            const { appUser, error } = await requireAuthenticatedUser();
            if (error || !appUser) return error;

            const report = body.report;
            const allowedDepartment = appUser.systemUser.department || '';
            const submitterEmail = appUser.authUser.email?.toLowerCase();

            if (!report.department || report.department !== allowedDepartment) {
                return NextResponse.json({ error: 'You can only submit reports for your own department.' }, { status: 403 });
            }

            if (!submitterEmail || String(report.submitted_by_email || '').toLowerCase() !== submitterEmail) {
                return NextResponse.json({ error: 'Report submitter does not match the authenticated user.' }, { status: 403 });
            }

            report.summary = escapeHtml(report.summary || '');
            report.achievements = escapeHtml(report.achievements || '');
            report.challenges = escapeHtml(report.challenges || '');
            report.next_week_plan = escapeHtml(report.next_week_plan || '');
            report.submitted_by = escapeHtml(appUser.systemUser.name || report.submitted_by || 'Unknown user');
            report.submitted_by_email = escapeHtml(submitterEmail);
            report.department = escapeHtml(report.department);
            report.daily_entries = Array.isArray(report.daily_entries)
                ? report.daily_entries.map((entry: any) => ({
                    day: escapeHtml(String(entry?.day || '')),
                    date: escapeHtml(String(entry?.date || '')),
                    work_done: escapeHtml(String(entry?.work_done || '')),
                    challenges: escapeHtml(String(entry?.challenges || '')),
                    next_action: escapeHtml(String(entry?.next_action || '')),
                }))
                : [];
            report.attachments = Array.isArray(report.attachments)
                ? report.attachments
                    .map((attachment: any) => {
                        const safeUrl = sanitizeAttachmentUrl(String(attachment?.url || ''));
                        if (!safeUrl) return null;
                        return {
                            name: escapeHtml(String(attachment?.name || 'Attachment')),
                            url: safeUrl,
                        };
                    })
                    .filter(Boolean)
                : [];

            const html = generateDepartmentSubmissionHtml(report);
            const weekStr = `${new Date(report.report_week_start).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} – ${new Date(report.report_week_end).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`;

            await transporter.sendMail({
                from: `"${process.env.SMTP_FROM_NAME || 'Aspee Pharma System'}" <${process.env.SMTP_USER}>`,
                to: mdEmail,
                cc: ccList.length ? ccList : undefined,
                subject: `${report.department} Weekly Report Submission — ${weekStr}`,
                html,
            });

            return NextResponse.json({ success: true, message: `Department report sent to ${mdEmail}` });
        }

        if (!isAuthorizedCronRequest(request)) {
            const { error } = await requireRoles([...REPORT_ADMIN_ROLES, ...ACCOUNTING_ROLES]);
            if (error) return error;
        }

        const { from, to, label } = weekRange();
        const [sales, purchasing, stores, production, qa, accounting] = await Promise.all([
            fetchSales(from, to),
            fetchPurchasing(from, to),
            fetchStores(),
            fetchProduction(from, to),
            fetchQA(from, to),
            fetchAccounting(from, to),
        ]);

        const html = generateHtml({ sales, purchasing, stores, production, qa, accounting }, label);
        const weekStr = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

        await transporter.sendMail({
            from: `"${process.env.SMTP_FROM_NAME || 'Aspee Pharma System'}" <${process.env.SMTP_USER}>`,
            to: mdEmail,
            cc: ccList.length ? ccList : undefined,
            subject: `Weekly Department Report — ${weekStr}`,
            html,
        });

        return NextResponse.json({ success: true, message: `Report sent to ${mdEmail}` });
    } catch (err: any) {
        console.error('[weekly-report]', err);
        return NextResponse.json({ error: err.message || 'Unknown error' }, { status: 500 });
    }
}
