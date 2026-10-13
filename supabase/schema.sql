-- Team Dashboard schema. Run in the Supabase SQL editor.

create type user_role as enum ('admin', 'manager', 'employee');
create type task_status as enum ('todo', 'in_progress', 'in_review', 'changes_requested', 'done');
create type task_priority as enum ('low', 'medium', 'high');
create type attendance_status as enum ('present', 'absent', 'half_day', 'leave');
create type review_status as enum ('pending', 'approved', 'changes_requested');

create table profiles (
  id uuid primary key references auth.users on delete cascade,
  full_name text not null,
  role user_role not null default 'employee',
  active boolean not null default true,
  weekly_capacity_hours numeric not null default 40
);

create table clients (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  logo_url text,
  active boolean not null default true
);

create table projects (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients on delete cascade,
  name text not null,
  active boolean not null default true,
  unique (client_id, name)
);

create table tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects on delete cascade,
  title text not null,
  description text,
  status task_status not null default 'todo',
  priority task_priority not null default 'medium',
  deadline date not null,
  estimated_hours numeric,
  reviewer_id uuid references profiles,
  completed_at timestamptz,
  created_by uuid not null references profiles default auth.uid(),
  created_at timestamptz not null default now()
);

create table task_assignees (
  task_id uuid references tasks on delete cascade,
  user_id uuid references profiles,
  primary key (task_id, user_id)
);

create table submissions (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks on delete cascade,
  version int not null,
  link text not null check (link ~* '^https?://'),
  hours_spent numeric not null check (hours_spent > 0),
  note text,
  is_final boolean not null default false,
  submitted_by uuid not null references profiles default auth.uid(),
  submitted_at timestamptz not null default now(),
  review review_status,
  review_note text,
  reviewed_by uuid references profiles,
  reviewed_at timestamptz,
  unique (task_id, version)
);

create table attendance (
  user_id uuid references profiles,
  day date,
  status attendance_status not null,
  marked_by uuid not null references profiles default auth.uid(),
  primary key (user_id, day)
);

-- helpers --------------------------------------------------------------
create function current_role_is(variadic roles user_role[]) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and active and role = any(roles));
$$;

create function is_assignee(t uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from task_assignees where task_id = t and user_id = auth.uid());
$$;

-- a new auth user gets an employee profile; admins promote later
create function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email));
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();

-- submission rules: auto version, status transitions, completion gate ----
create function on_submission() returns trigger
language plpgsql security definer set search_path = public as $$
declare t tasks;
begin
  select * into t from tasks where id = new.task_id for update;
  if not (is_assignee(t.id) or current_role_is('admin','manager')) then
    raise exception 'Only an assignee can submit work';
  end if;
  if t.status = 'done' then
    raise exception 'This task is already completed';
  end if;
  select coalesce(max(version), 0) + 1 into new.version from submissions where task_id = new.task_id;
  new.submitted_by := auth.uid();
  -- no reviewer: a final submission is self-approved; drafts need no review
  if t.reviewer_id is null then
    new.review := case when new.is_final then 'approved'::review_status else null end;
  else
    new.review := 'pending';
  end if;
  return new;
end $$;
create trigger submission_before_insert before insert on submissions
  for each row execute function on_submission();

-- runs after the row exists so the Done guard can see the approved final
create function after_submission() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.is_final and new.review = 'approved' then
    update tasks set status = 'done', completed_at = now() where id = new.task_id;
  elsif new.review = 'pending' then
    update tasks set status = 'in_review' where id = new.task_id;
  else
    update tasks set status = 'in_progress' where id = new.task_id;
  end if;
  return new;
end $$;
create trigger submission_after_insert after insert on submissions
  for each row execute function after_submission();

create function review_submission(p_sub uuid, p_approve boolean, p_note text) returns void
language plpgsql security definer set search_path = public as $$
declare s submissions; t tasks;
begin
  select * into s from submissions where id = p_sub;
  select * into t from tasks where id = s.task_id for update;
  if s.review is distinct from 'pending' then
    raise exception 'This submission is not awaiting review';
  end if;
  if t.reviewer_id is distinct from auth.uid() and not current_role_is('admin') then
    raise exception 'Only the reviewer can review this task';
  end if;
  update submissions set
    review = case when p_approve then 'approved'::review_status else 'changes_requested' end,
    review_note = p_note, reviewed_by = auth.uid(), reviewed_at = now()
  where id = p_sub;
  if p_approve and s.is_final then
    update tasks set status = 'done', completed_at = now() where id = t.id;
  elsif not p_approve then
    update tasks set status = 'changes_requested' where id = t.id;
  else
    update tasks set status = 'in_progress' where id = t.id;  -- draft approved, keep working
  end if;
end $$;

-- hard gate: Done needs an approved final submission
create function guard_done() returns trigger language plpgsql as $$
begin
  if new.status = 'done' and old.status is distinct from 'done' and not exists (
    select 1 from submissions where task_id = new.id and is_final and review = 'approved'
  ) then
    raise exception 'A task needs an approved final submission (link + hours) to be completed';
  end if;
  return new;
end $$;
create trigger tasks_guard_done before update on tasks
  for each row execute function guard_done();

-- row level security ---------------------------------------------------
alter table profiles enable row level security;
alter table clients enable row level security;
alter table projects enable row level security;
alter table tasks enable row level security;
alter table task_assignees enable row level security;
alter table submissions enable row level security;
alter table attendance enable row level security;

create policy read_all on profiles for select to authenticated using (true);
create policy admin_write on profiles for all to authenticated
  using (current_role_is('admin')) with check (current_role_is('admin'));

create policy read_all on clients for select to authenticated using (true);
create policy admin_write on clients for all to authenticated
  using (current_role_is('admin')) with check (current_role_is('admin'));
create policy read_all on projects for select to authenticated using (true);
create policy admin_write on projects for all to authenticated
  using (current_role_is('admin','manager')) with check (current_role_is('admin','manager'));

create policy read_all on tasks for select to authenticated using (true);
create policy mgr_write on tasks for all to authenticated
  using (current_role_is('admin','manager')) with check (current_role_is('admin','manager'));

create policy read_all on task_assignees for select to authenticated using (true);
create policy mgr_write on task_assignees for all to authenticated
  using (current_role_is('admin','manager')) with check (current_role_is('admin','manager'));

create policy read_all on submissions for select to authenticated using (true);
create policy assignee_insert on submissions for insert to authenticated
  with check (is_assignee(task_id) or current_role_is('admin','manager'));

create policy read_all on attendance for select to authenticated using (true);
create policy admin_write on attendance for all to authenticated
  using (current_role_is('admin')) with check (current_role_is('admin'));

-- assignees may only toggle todo <-> in_progress; every other status change
-- goes through submissions / review_submission
create function set_task_progress(t uuid, started boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_assignee(t) then raise exception 'Not assigned to you'; end if;
  update tasks set status = case when started then 'in_progress'::task_status else 'todo' end
    where id = t and status in ('todo', 'in_progress', 'changes_requested');
end $$;

-- lock down RPC surface: signed-in users only
revoke execute on all functions in schema public from public, anon;
grant execute on function current_role_is(user_role[]), is_assignee(uuid),
  review_submission(uuid, boolean, text), set_task_progress(uuid, boolean) to authenticated;
