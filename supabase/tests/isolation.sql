-- Run against a migrated disposable local Supabase DB: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/isolation.sql
begin;
insert into auth.users(id,email) values ('11111111-1111-4111-8111-111111111111','rls-a@example.invalid'),('22222222-2222-4222-8222-222222222222','rls-b@example.invalid');
insert into public.tasks(id,user_id,title,kind,duration_minutes,priority,splittable,recurrence) values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','Private A','flexible',30,'medium',true,'none');
set local role authenticated;
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
do $$ begin
 if exists(select 1 from public.tasks) then raise exception 'RLS read leak'; end if;
 update public.tasks set title='attacker' where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
 if found then raise exception 'RLS update leak'; end if;
 delete from public.tasks where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
 if found then raise exception 'RLS delete leak'; end if;
 begin
 insert into public.tasks(user_id,title,kind,duration_minutes,priority,splittable,recurrence) values('11111111-1111-4111-8111-111111111111','attack','flexible',30,'medium',true,'none');
 raise exception 'RLS insert leak';
 exception when insufficient_privilege then null; end;
end $$;
select public.create_task_idempotent('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',repeat('a',64),'{"title":"B task","kind":"flexible","duration_minutes":30,"priority":"medium","splittable":true,"recurrence":"none"}');
select public.create_task_idempotent('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',repeat('a',64),'{"title":"B task","kind":"flexible","duration_minutes":30,"priority":"medium","splittable":true,"recurrence":"none"}');
do $$ begin
 if (select count(*) from public.tasks) <> 1 then raise exception 'Idempotency duplicated tasks'; end if;
 begin
 perform public.create_task_idempotent('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',repeat('b',64),'{}');
 raise exception 'Idempotency failed to reject mismatch';
 exception when raise_exception then if sqlerrm <> 'IDEMPOTENCY_CONFLICT' then raise; end if; end;
end $$;
reset role;
do $$ begin
 begin
 insert into public.notification_records(user_id,task_id,scheduled_at,version) values('22222222-2222-4222-8222-222222222222','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',now(),1);
 raise exception 'Composite ownership failed';
 exception when foreign_key_violation then null; end;
end $$;
rollback;
