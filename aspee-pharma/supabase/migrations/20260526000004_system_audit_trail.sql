create table if not exists public.audit_log (
    id uuid primary key default gen_random_uuid(),
    user_id uuid,
    user_email text,
    user_name text,
    action text not null,
    module text not null,
    description text not null,
    record_id text,
    record_type text,
    old_values jsonb,
    new_values jsonb,
    ip_address text,
    created_at timestamptz not null default now()
);

alter table public.audit_log
    add column if not exists user_id uuid,
    add column if not exists user_email text,
    add column if not exists user_name text,
    add column if not exists action text,
    add column if not exists module text,
    add column if not exists description text,
    add column if not exists record_id text,
    add column if not exists record_type text,
    add column if not exists old_values jsonb,
    add column if not exists new_values jsonb,
    add column if not exists ip_address text,
    add column if not exists created_at timestamptz default now();

do $$
begin
    if exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'audit_log'
          and column_name = 'old_values'
          and data_type <> 'jsonb'
    ) then
        alter table public.audit_log
            alter column old_values type jsonb
            using case
                when old_values is null or old_values::text = '' then null
                else old_values::jsonb
            end;
    end if;

    if exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'audit_log'
          and column_name = 'new_values'
          and data_type <> 'jsonb'
    ) then
        alter table public.audit_log
            alter column new_values type jsonb
            using case
                when new_values is null or new_values::text = '' then null
                else new_values::jsonb
            end;
    end if;
end $$;

alter table public.audit_log enable row level security;

create index if not exists idx_audit_log_created_at
    on public.audit_log (created_at desc);

create index if not exists idx_audit_log_record
    on public.audit_log (record_type, record_id);

create index if not exists idx_audit_log_user
    on public.audit_log (user_email);

drop policy if exists audit_log_select_auditors on public.audit_log;
create policy audit_log_select_auditors
on public.audit_log
for select
to authenticated
using (
    public.has_any_app_role(array['Super Admin', 'Managing Director', 'Internal Auditor'])
);

drop policy if exists audit_log_insert_current_user on public.audit_log;
create policy audit_log_insert_current_user
on public.audit_log
for insert
to authenticated
with check (
    auth.uid() is not null
    and (
        user_id = auth.uid()
        or public.has_any_app_role(array['Super Admin', 'Managing Director', 'Internal Auditor'])
    )
);

create or replace function public.record_system_audit_trail()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    actor_id uuid := auth.uid();
    actor_email text := lower(coalesce(auth.jwt() ->> 'email', 'system'));
    actor_name text := coalesce(auth.jwt() ->> 'email', 'system');
    actor_department text := 'Administration';
    old_snapshot jsonb;
    new_snapshot jsonb;
    changed_fields jsonb;
    affected_id text;
    affected_label text;
begin
    if tg_op = 'INSERT' then
        new_snapshot := to_jsonb(new);
        old_snapshot := null;
        affected_id := coalesce(new_snapshot ->> 'id', new_snapshot ->> 'uuid');
    elsif tg_op = 'UPDATE' then
        old_snapshot := to_jsonb(old);
        new_snapshot := to_jsonb(new);
        affected_id := coalesce(new_snapshot ->> 'id', old_snapshot ->> 'id', new_snapshot ->> 'uuid', old_snapshot ->> 'uuid');

        select coalesce(jsonb_object_agg(fields.key, jsonb_build_object('old', old_snapshot -> fields.key, 'new', new_snapshot -> fields.key)), '{}'::jsonb)
        into changed_fields
        from jsonb_object_keys(old_snapshot || new_snapshot) as fields(key)
        where old_snapshot -> fields.key is distinct from new_snapshot -> fields.key;

        if changed_fields = '{}'::jsonb then
            return new;
        end if;
    else
        old_snapshot := to_jsonb(old);
        new_snapshot := null;
        affected_id := coalesce(old_snapshot ->> 'id', old_snapshot ->> 'uuid');
    end if;

    select
        coalesce(
            (
                select su.name
                from public.system_users su
                where su.auth_user_id::text = actor_id::text
                   or lower(su.email) = actor_email
                order by case when su.auth_user_id::text = actor_id::text then 0 else 1 end
                limit 1
            ),
            actor_name
        ),
        coalesce(
            (
                select su.department
                from public.system_users su
                where su.auth_user_id::text = actor_id::text
                   or lower(su.email) = actor_email
                order by case when su.auth_user_id::text = actor_id::text then 0 else 1 end
                limit 1
            ),
            actor_department
        )
    into actor_name, actor_department
    ;

    affected_label := coalesce(
        new_snapshot ->> 'name',
        old_snapshot ->> 'name',
        new_snapshot ->> 'title',
        old_snapshot ->> 'title',
        new_snapshot ->> 'request_number',
        old_snapshot ->> 'request_number',
        new_snapshot ->> 'invoice_number',
        old_snapshot ->> 'invoice_number',
        new_snapshot ->> 'po_number',
        old_snapshot ->> 'po_number',
        new_snapshot ->> 'grn_number',
        old_snapshot ->> 'grn_number',
        new_snapshot ->> 'receipt_number',
        old_snapshot ->> 'receipt_number',
        affected_id,
        'record'
    );

    insert into public.audit_log (
        user_id,
        user_email,
        user_name,
        action,
        module,
        description,
        record_id,
        record_type,
        old_values,
        new_values,
        created_at
    )
    values (
        actor_id,
        actor_email,
        actor_name,
        tg_op,
        initcap(replace(tg_table_name, '_', ' ')),
        format('%s %s: %s', initcap(tg_op), replace(tg_table_name, '_', ' '), affected_label),
        affected_id,
        tg_table_name,
        case when tg_op in ('UPDATE', 'DELETE') then old_snapshot else null end,
        case when tg_op = 'UPDATE' then changed_fields when tg_op = 'INSERT' then new_snapshot else null end,
        now()
    );

    insert into public.department_activity_logs (
        department,
        activity_date,
        user_id,
        user_email,
        user_name,
        action,
        module,
        description,
        record_id,
        record_type,
        metadata,
        created_at
    )
    values (
        actor_department,
        current_date,
        actor_id,
        actor_email,
        actor_name,
        tg_op,
        initcap(replace(tg_table_name, '_', ' ')),
        format('%s %s: %s', initcap(tg_op), replace(tg_table_name, '_', ' '), affected_label),
        affected_id,
        tg_table_name,
        jsonb_build_object(
            'old_values', case when tg_op in ('UPDATE', 'DELETE') then old_snapshot else null end,
            'new_values', case when tg_op = 'UPDATE' then changed_fields when tg_op = 'INSERT' then new_snapshot else null end,
            'source', 'database_trigger'
        ),
        now()
    );

    if tg_op = 'DELETE' then
        return old;
    end if;

    return new;
exception
    when others then
        raise warning 'Audit trail trigger failed for %.% %: %', tg_table_schema, tg_table_name, tg_op, sqlerrm;
        if tg_op = 'DELETE' then
            return old;
        end if;
        return new;
end;
$$;

do $$
declare
    table_record record;
begin
    for table_record in
        select tablename
        from pg_tables
        where schemaname = 'public'
          and tablename not in (
              'audit_log',
              'department_activity_logs',
              'schema_migrations',
              'spatial_ref_sys'
          )
    loop
        execute format('drop trigger if exists trg_system_audit_trail on public.%I', table_record.tablename);
        execute format(
            'create trigger trg_system_audit_trail after insert or update or delete on public.%I for each row execute function public.record_system_audit_trail()',
            table_record.tablename
        );
    end loop;
end $$;
