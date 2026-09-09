create table if not exists public.weekly_reports (
    id uuid primary key default gen_random_uuid(),
    department text not null,
    report_week_start date not null,
    report_week_end date not null,
    summary text not null,
    achievements text,
    challenges text,
    next_week_plan text,
    submitted_by text,
    submitted_by_email text,
    submitted_at timestamptz not null default now(),
    status text not null default 'Submitted',
    read_status text not null default 'Unread',
    reviewed_at timestamptz,
    reviewed_by text,
    approved_at timestamptz,
    approved_by text,
    approval_notes text,
    attachments jsonb not null default '[]'::jsonb,
    reminder_sent_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint weekly_reports_department_week_unique unique (department, report_week_start)
);

alter table if exists public.weekly_reports add column if not exists read_status text not null default 'Unread';
alter table if exists public.weekly_reports add column if not exists reviewed_at timestamptz;
alter table if exists public.weekly_reports add column if not exists reviewed_by text;
alter table if exists public.weekly_reports add column if not exists approved_at timestamptz;
alter table if exists public.weekly_reports add column if not exists approved_by text;
alter table if exists public.weekly_reports add column if not exists approval_notes text;
alter table if exists public.weekly_reports add column if not exists attachments jsonb not null default '[]'::jsonb;
alter table if exists public.weekly_reports add column if not exists reminder_sent_at timestamptz;

create index if not exists idx_weekly_reports_department on public.weekly_reports (department);
create index if not exists idx_weekly_reports_week_start on public.weekly_reports (report_week_start desc);
create index if not exists idx_weekly_reports_status on public.weekly_reports (status);
create index if not exists idx_weekly_reports_read_status on public.weekly_reports (read_status);

create or replace function public.set_weekly_reports_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

drop trigger if exists trg_weekly_reports_updated_at on public.weekly_reports;
create trigger trg_weekly_reports_updated_at
before update on public.weekly_reports
for each row
execute function public.set_weekly_reports_updated_at();
