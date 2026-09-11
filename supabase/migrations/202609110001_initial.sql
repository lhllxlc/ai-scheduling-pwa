-- No raw natural-language plans are stored.
create table public.preferences (
 user_id uuid primary key references auth.users(id) on delete cascade,
 data jsonb not null check (jsonb_typeof(data) = 'object'),
 updated_at timestamptz not null default now()
);
create table public.tasks (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 title text not null check (char_length(btrim(title)) between 1 and 200),
 kind text not null check (kind in ('fixed','deadline','flexible','recurring','life','break')),
 duration_minutes integer not null check (duration_minutes between 5 and 1440),
 priority text not null check (priority in ('low','medium','high')),
 start_at timestamptz, end_at timestamptz, due_at timestamptz,
 splittable boolean not null default true,
 recurrence text not null check (recurrence in ('none','daily','weekly')),
 status text not null default 'pending' check (status in ('pending','completed','skipped')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(user_id,id),
 check ((start_at is null) = (end_at is null)),
 check (end_at is null or end_at > start_at),
 check (kind <> 'fixed' or (start_at is not null and end_at is not null)),
 check (kind <> 'deadline' or due_at is not null),
 check (kind <> 'recurring' or recurrence <> 'none')
);
create index tasks_user_created on public.tasks(user_id,created_at desc);
create table public.notification_records (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 task_id uuid not null, scheduled_at timestamptz not null,
 status text not null default 'pending' check (status in ('pending','sent','cancelled','failed')),
 version integer not null check (version > 0),
 unique(task_id,version,scheduled_at),
 foreign key(user_id,task_id) references public.tasks(user_id,id) on delete cascade
);
create table public.request_keys (
 user_id uuid not null references auth.users(id) on delete cascade, key uuid not null,
 payload_hash text not null, response jsonb, created_at timestamptz not null default now(), primary key(user_id,key)
);
create table public.rate_limit_buckets (
 user_id uuid primary key references auth.users(id) on delete cascade,
 window_start timestamptz not null, requests integer not null
);
alter table public.preferences enable row level security;
alter table public.tasks enable row level security;
alter table public.notification_records enable row level security;
alter table public.request_keys enable row level security;
alter table public.rate_limit_buckets enable row level security;
create policy preferences_owner on public.preferences for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy tasks_owner on public.tasks for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy notifications_owner on public.notification_records for select to authenticated using (auth.uid() = user_id);
-- Key and rate tables are accessed only through authenticated, narrowly scoped RPCs.
revoke all on public.preferences,public.tasks,public.notification_records,public.request_keys,public.rate_limit_buckets from anon,authenticated;
grant select,insert,update,delete on public.preferences,public.tasks to authenticated;
grant select on public.notification_records to authenticated;

create or replace function public.consume_rate_limit() returns boolean
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); count_now integer;
begin
 if uid is null then raise exception 'UNAUTHORIZED'; end if;
 insert into public.rate_limit_buckets(user_id,window_start,requests) values(uid,now(),1)
 on conflict(user_id) do update set
 requests = case when public.rate_limit_buckets.window_start < now() - interval '1 minute' then 1 else public.rate_limit_buckets.requests + 1 end,
 window_start = case when public.rate_limit_buckets.window_start < now() - interval '1 minute' then now() else public.rate_limit_buckets.window_start end
 returning requests into count_now;
 return count_now <= 60;
end $$;
revoke all on function public.consume_rate_limit() from public,anon;
grant execute on function public.consume_rate_limit() to authenticated;

create or replace function public.create_task_idempotent(request_key uuid, request_hash text, task_data jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); saved public.request_keys; created public.tasks;
begin
 if uid is null then raise exception 'UNAUTHORIZED'; end if;
 if request_hash is null or length(request_hash) <> 64 then raise exception 'INVALID_HASH'; end if;
 insert into public.request_keys(user_id,key,payload_hash) values(uid,request_key,request_hash) on conflict do nothing;
 select * into saved from public.request_keys where user_id=uid and key=request_key for update;
 if saved.payload_hash <> request_hash then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
 if saved.response is not null then return saved.response; end if;
 insert into public.tasks(user_id,title,kind,duration_minutes,priority,start_at,end_at,due_at,splittable,recurrence)
 values(uid,task_data->>'title',task_data->>'kind',(task_data->>'duration_minutes')::integer,task_data->>'priority',
 (task_data->>'start_at')::timestamptz,(task_data->>'end_at')::timestamptz,(task_data->>'due_at')::timestamptz,
 (task_data->>'splittable')::boolean,task_data->>'recurrence') returning * into created;
 update public.request_keys set response=to_jsonb(created) where user_id=uid and key=request_key;
 return to_jsonb(created);
end $$;
revoke all on function public.create_task_idempotent(uuid,text,jsonb) from public,anon;
grant execute on function public.create_task_idempotent(uuid,text,jsonb) to authenticated;
