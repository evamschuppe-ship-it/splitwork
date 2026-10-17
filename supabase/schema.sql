-- SplitWork schema. Paste into Supabase → SQL Editor → New query → Run.
-- Safe to re-run.

create extension if not exists pgcrypto;

-- ---------- Tables ----------
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  team_size int not null default 4 check (team_size between 1 and 12),
  due_date date not null default (current_date + 14),
  template text not null default 'Standard Research & Presentation',
  doc_url text,
  created_at timestamptz not null default now()
);

-- Teammates invited to a workspace (matched by their login email).
create table if not exists public.project_members (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  email text not null,
  slot int not null check (slot between 1 and 12),
  created_at timestamptz not null default now(),
  unique (project_id, email),
  unique (project_id, slot)
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null,
  kind text not null default 'section', -- section | milestone | admin
  effort int not null default 1,
  assignee_slot int not null default 1,
  due_date date not null,
  done boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists tasks_project_idx on public.tasks(project_id);
create index if not exists members_project_idx on public.project_members(project_id);

-- ---------- Access helper ----------
-- True if the logged-in user owns the project or was invited to it.
create or replace function public.is_project_member(pid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from projects p where p.id = pid and p.owner_id = auth.uid())
      or exists (select 1 from project_members m
                 where m.project_id = pid
                   and lower(m.email) = lower(coalesce(auth.jwt() ->> 'email', '')));
$$;

create or replace function public.is_project_owner(pid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from projects p where p.id = pid and p.owner_id = auth.uid());
$$;

-- ---------- Row Level Security ----------
alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.tasks enable row level security;

drop policy if exists "projects_select" on public.projects;
drop policy if exists "projects_insert" on public.projects;
drop policy if exists "projects_update" on public.projects;
drop policy if exists "projects_delete" on public.projects;
create policy "projects_select" on public.projects for select to authenticated
  using (owner_id = auth.uid() or public.is_project_member(id));
create policy "projects_insert" on public.projects for insert to authenticated
  with check (owner_id = auth.uid());
create policy "projects_update" on public.projects for update to authenticated
  using (public.is_project_member(id)) with check (public.is_project_member(id));
create policy "projects_delete" on public.projects for delete to authenticated
  using (owner_id = auth.uid());

drop policy if exists "members_select" on public.project_members;
drop policy if exists "members_insert" on public.project_members;
drop policy if exists "members_delete" on public.project_members;
create policy "members_select" on public.project_members for select to authenticated
  using (public.is_project_member(project_id));
create policy "members_insert" on public.project_members for insert to authenticated
  with check (public.is_project_owner(project_id));
create policy "members_delete" on public.project_members for delete to authenticated
  using (public.is_project_owner(project_id));

drop policy if exists "tasks_select" on public.tasks;
drop policy if exists "tasks_update" on public.tasks;
create policy "tasks_select" on public.tasks for select to authenticated
  using (public.is_project_member(project_id));
create policy "tasks_update" on public.tasks for update to authenticated
  using (public.is_project_member(project_id)) with check (public.is_project_member(project_id));

-- Members may only change "done" on tasks.
revoke update on public.tasks from authenticated;
grant update (done) on public.tasks to authenticated;

-- Nothing for anonymous visitors.
revoke all on public.projects, public.project_members, public.tasks from anon;

-- ---------- Auto-split the work when a project is created ----------
create or replace function public.generate_tasks()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  items jsonb;
  it jsonb;
  n int := greatest(1, least(new.team_size, 12));
  start_d date := current_date;
  span int := greatest(new.due_date - current_date, 1);
  loads int[];
  best int;
  i int;
  k int;
  checkins int;
begin
  items := case new.template
    when 'Lab Report' then '[
      {"t":"Kickoff: agree hypothesis & split","k":"milestone","w":1,"p":0.05},
      {"t":"Methods section","k":"section","w":3,"p":0.35},
      {"t":"Run experiment & record data","k":"section","w":5,"p":0.45},
      {"t":"Data analysis & figures","k":"section","w":4,"p":0.6},
      {"t":"Results section","k":"section","w":3,"p":0.7},
      {"t":"Discussion section","k":"section","w":3,"p":0.8},
      {"t":"Introduction & abstract","k":"section","w":2,"p":0.8},
      {"t":"Draft complete","k":"milestone","w":1,"p":0.85},
      {"t":"References & formatting check","k":"section","w":2,"p":0.92},
      {"t":"Submit report","k":"milestone","w":1,"p":1}
    ]'::jsonb
    when 'Case Study Analysis' then '[
      {"t":"Kickoff: read case & agree angle","k":"milestone","w":1,"p":0.05},
      {"t":"Company & industry background","k":"section","w":3,"p":0.3},
      {"t":"Problem diagnosis","k":"section","w":3,"p":0.4},
      {"t":"Financial analysis","k":"section","w":4,"p":0.5},
      {"t":"Options & evaluation","k":"section","w":4,"p":0.6},
      {"t":"Recommendation & implementation plan","k":"section","w":3,"p":0.7},
      {"t":"Draft complete","k":"milestone","w":1,"p":0.75},
      {"t":"Slide deck","k":"section","w":3,"p":0.85},
      {"t":"Final edit & citations","k":"section","w":2,"p":0.92},
      {"t":"Rehearsal","k":"milestone","w":1,"p":0.95},
      {"t":"Submit & present","k":"milestone","w":1,"p":1}
    ]'::jsonb
    when 'Software Project' then '[
      {"t":"Kickoff: scope & user stories","k":"milestone","w":1,"p":0.05},
      {"t":"Wireframes & UI design","k":"section","w":3,"p":0.25},
      {"t":"Database & backend","k":"section","w":5,"p":0.5},
      {"t":"Frontend screens","k":"section","w":5,"p":0.6},
      {"t":"MVP working end-to-end","k":"milestone","w":1,"p":0.65},
      {"t":"Testing & bug fixes","k":"section","w":3,"p":0.8},
      {"t":"README & documentation","k":"section","w":2,"p":0.85},
      {"t":"Demo video / slides","k":"section","w":3,"p":0.9},
      {"t":"Submit & demo","k":"milestone","w":1,"p":1}
    ]'::jsonb
    else '[
      {"t":"Kickoff: agree topic & research question","k":"milestone","w":1,"p":0.05},
      {"t":"Literature review (part A)","k":"section","w":3,"p":0.3},
      {"t":"Literature review (part B)","k":"section","w":3,"p":0.3},
      {"t":"Data collection & sources","k":"section","w":4,"p":0.45},
      {"t":"Analysis & findings","k":"section","w":4,"p":0.6},
      {"t":"Introduction & conclusion","k":"section","w":2,"p":0.7},
      {"t":"Draft report complete","k":"milestone","w":1,"p":0.72},
      {"t":"Slide deck design","k":"section","w":3,"p":0.8},
      {"t":"Speaker notes & script","k":"section","w":2,"p":0.85},
      {"t":"Final edit, citations & formatting","k":"section","w":2,"p":0.92},
      {"t":"Full rehearsal","k":"milestone","w":1,"p":0.95},
      {"t":"Submit deliverable","k":"milestone","w":1,"p":1}
    ]'::jsonb
  end;

  loads := array_fill(0, array[n]);

  -- Admin work rotates: a weekly check-in owner (book slot, run meeting, post notes).
  checkins := greatest(1, span / 7);
  for k in 1..checkins loop
    best := ((k - 1) % n) + 1;
    loads[best] := loads[best] + 1;
    insert into tasks (project_id, title, kind, effort, assignee_slot, due_date)
    values (new.id, 'Check-in #' || k || ': book slot, run meeting, post notes', 'admin', 1, best,
            least(start_d + 7 * k, new.due_date));
  end loop;

  -- Sections & milestones: heaviest first, each to the least-loaded teammate.
  for it in select value from jsonb_array_elements(items) order by (value ->> 'w')::int desc loop
    best := 1;
    for i in 2..n loop
      if loads[i] < loads[best] then best := i; end if;
    end loop;
    loads[best] := loads[best] + (it ->> 'w')::int;
    insert into tasks (project_id, title, kind, effort, assignee_slot, due_date)
    values (new.id, it ->> 't', it ->> 'k', (it ->> 'w')::int, best,
            start_d + round(span * (it ->> 'p')::numeric)::int);
  end loop;

  return new;
end;
$$;

drop trigger if exists projects_generate_tasks on public.projects;
create trigger projects_generate_tasks after insert on public.projects
  for each row execute function public.generate_tasks();
