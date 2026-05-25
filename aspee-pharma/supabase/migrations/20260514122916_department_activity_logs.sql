create table if not exists public.department_activity_logs (
    id uuid primary key default gen_random_uuid(),
    department text not null,
    activity_date date not null default current_date,
    action text not null,
    module text not null,
    description text not null,
    record_id text,
    record_type text,
    user_id uuid,
    user_email text,
    user_name text,
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now()
);

alter table public.department_activity_logs enable row level security;

create index if not exists idx_department_activity_logs_department_date
    on public.department_activity_logs (department, activity_date desc);

create index if not exists idx_department_activity_logs_created_at
    on public.department_activity_logs (created_at desc);

create index if not exists idx_department_activity_logs_module
    on public.department_activity_logs (module);

drop policy if exists department_activity_logs_select_department_or_admin
    on public.department_activity_logs;
create policy department_activity_logs_select_department_or_admin
on public.department_activity_logs
for select
using (
    public.has_any_app_role(array['Super Admin', 'Managing Director', 'Internal Auditor'])
    or department = public.current_app_user_department()
);

drop policy if exists department_activity_logs_insert_own_department
    on public.department_activity_logs;
create policy department_activity_logs_insert_own_department
on public.department_activity_logs
for insert
with check (
    public.has_any_app_role(array['Super Admin', 'Managing Director'])
    or department = public.current_app_user_department()
);
