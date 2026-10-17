-- Migration 003: keep the owner (slot) chosen by the app; slot 0 = everyone. Run after 002. Safe to re-run.

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
  if new.custom_sections is not null and jsonb_array_length(new.custom_sections) > 0 then
    -- Sections read from the teacher's brief (sanitised).
    select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
             't', left(coalesce(nullif(trim(e ->> 't'), ''), 'Section'), 200),
             'k', case when e ->> 'k' in ('section', 'milestone', 'admin') then e ->> 'k' else 'section' end,
             'w', greatest(1, least(5, round(coalesce((e ->> 'w')::numeric, 3))::int)),
             'p', greatest(0, least(1, coalesce((e ->> 'p')::numeric, 0.5))),
             's', case when e ? 's' then greatest(0, least(12, round((e ->> 's')::numeric)::int)) end)))
      into items
      from jsonb_array_elements(new.custom_sections) e;
  else
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
  end if;

  loads := array_fill(0, array[n]);

  if exists (select 1 from jsonb_array_elements(items) e where e ? 's') then
    -- Owners were chosen by the app (0 = everyone): keep them.
    for it in select value from jsonb_array_elements(items) loop
      best := (it ->> 's')::int;
      if best > n then best := ((best - 1) % n) + 1; end if;
      if best >= 1 then loads[best] := loads[best] + (it ->> 'w')::int; end if;
      insert into tasks (project_id, title, kind, effort, assignee_slot, due_date)
      values (new.id, it ->> 't', it ->> 'k', (it ->> 'w')::int, best,
              start_d + round(span * (it ->> 'p')::numeric)::int);
    end loop;
    -- Weekly check-ins go to whoever has the least work.
    checkins := greatest(1, span / 7);
    for k in 1..checkins loop
      best := 1;
      for i in 2..n loop
        if loads[i] < loads[best] then best := i; end if;
      end loop;
      loads[best] := loads[best] + 1;
      insert into tasks (project_id, title, kind, effort, assignee_slot, due_date)
      values (new.id, 'Check-in #' || k || ': book slot, run meeting, post notes', 'admin', 1, best,
              least(start_d + 7 * k, new.due_date));
    end loop;
    return new;
  end if;


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
