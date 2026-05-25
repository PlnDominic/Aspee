alter table if exists public.weekly_reports
    add column if not exists daily_entries jsonb not null default '[]'::jsonb,
    add column if not exists department_data jsonb not null default '{}'::jsonb,
    add column if not exists draft_saved_at timestamptz,
    add column if not exists auto_prefilled_at timestamptz;

create index if not exists idx_weekly_reports_daily_entries
    on public.weekly_reports using gin (daily_entries);

comment on column public.weekly_reports.daily_entries is
    'Monday-Friday department work log used to build the weekly report sent to the Managing Director.';

comment on column public.weekly_reports.department_data is
    'Department KPI values captured with the weekly report draft or submission.';
