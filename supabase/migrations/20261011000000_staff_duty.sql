-- Duty roster and attendance. Run after 20261010000000_referral_percent.sql.
--
--   * staff_shifts: the schedule. Super Admin and Admin plan shifts; everyone can see them.
--     A shift whose end_time is not after start_time ends the next day (night shifts),
--     and equal times mean a 24-hour shift.
--   * staff_attendance: when staff were actually on duty. Staff clock themselves in and out
--     with clock_in() / clock_out(), which use the server's clock. Super Admin and Admin can
--     add or correct entries; those are marked 'Manual' with who made the change.

create table if not exists public.staff_shifts (
  id            bigint generated always as identity primary key,
  staff_id      bigint not null references public.staff (id) on delete cascade,
  shift_date    date not null,
  start_time    time not null,
  end_time      time not null,
  shift_type    text not null default 'Custom',
  department_id bigint references public.departments (id) on delete set null,
  notes         text,
  created_at    timestamptz not null default now(),
  constraint staff_shifts_shift_type_check
    check (shift_type in ('Morning', 'Evening', 'Night', 'Day', 'On Call', 'Custom'))
);
create index if not exists staff_shifts_date_idx on public.staff_shifts (shift_date);
create index if not exists staff_shifts_staff_date_idx on public.staff_shifts (staff_id, shift_date);

create table if not exists public.staff_attendance (
  id                   bigint generated always as identity primary key,
  staff_id             bigint not null references public.staff (id) on delete cascade,
  clock_in             timestamptz not null,
  clock_out            timestamptz,
  source               text not null default 'Manual',
  notes                text,
  recorded_by_staff_id bigint references public.staff (id) on delete set null,
  created_at           timestamptz not null default now(),
  constraint staff_attendance_source_check check (source in ('Clock', 'Manual')),
  constraint staff_attendance_times_check check (clock_out is null or clock_out > clock_in)
);
create index if not exists staff_attendance_clock_in_idx on public.staff_attendance (clock_in);
-- At most one open (not clocked out) entry per person.
create unique index if not exists staff_attendance_one_open_idx
  on public.staff_attendance (staff_id) where clock_out is null;

alter table public.staff_shifts enable row level security;
alter table public.staff_attendance enable row level security;

drop policy if exists staff_shifts_select on public.staff_shifts;
drop policy if exists staff_shifts_write on public.staff_shifts;
create policy staff_shifts_select on public.staff_shifts for select to authenticated
  using (public.is_active_staff());
create policy staff_shifts_write on public.staff_shifts for all to authenticated
  using (public.has_role(array['Super Admin', 'Admin']))
  with check (public.has_role(array['Super Admin', 'Admin']));

-- Everyone sees their own attendance; managers and Accounts (for salaries) see everyone's.
drop policy if exists staff_attendance_select on public.staff_attendance;
drop policy if exists staff_attendance_write on public.staff_attendance;
create policy staff_attendance_select on public.staff_attendance for select to authenticated
  using (staff_id = public.current_staff_id() or public.has_role(array['Super Admin', 'Admin', 'Accounts']));
create policy staff_attendance_write on public.staff_attendance for all to authenticated
  using (public.has_role(array['Super Admin', 'Admin']))
  with check (public.has_role(array['Super Admin', 'Admin']));

-- Entries written directly (not through clock_in/clock_out) are manual corrections.
create or replace function public.stamp_staff_attendance() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(current_setting('seva.clock', true), '') = 'on' then
    new.source := 'Clock';
  elsif auth.role() is distinct from 'service_role' then
    new.source := 'Manual';
    new.recorded_by_staff_id := public.current_staff_id();
  end if;
  return new;
end
$$;

drop trigger if exists staff_attendance_stamp on public.staff_attendance;
create trigger staff_attendance_stamp before insert or update on public.staff_attendance
  for each row execute function public.stamp_staff_attendance();

create or replace function public.clock_in(note text default null) returns public.staff_attendance
language plpgsql security definer set search_path = public as $$
declare
  me bigint := public.current_staff_id();
  entry public.staff_attendance;
begin
  if me is null then
    raise exception 'Only active staff can clock in.';
  end if;
  if exists (select 1 from public.staff_attendance where staff_id = me and clock_out is null) then
    raise exception 'You are already clocked in.';
  end if;
  perform set_config('seva.clock', 'on', true);
  insert into public.staff_attendance (staff_id, clock_in, notes)
  values (me, now(), nullif(trim(note), ''))
  returning * into entry;
  perform set_config('seva.clock', '', true);
  return entry;
end
$$;

create or replace function public.clock_out(note text default null) returns public.staff_attendance
language plpgsql security definer set search_path = public as $$
declare
  me bigint := public.current_staff_id();
  entry public.staff_attendance;
begin
  if me is null then
    raise exception 'Only active staff can clock out.';
  end if;
  perform set_config('seva.clock', 'on', true);
  update public.staff_attendance
     set clock_out = greatest(now(), clock_in + interval '1 second'),
         notes = coalesce(nullif(trim(note), ''), notes)
   where staff_id = me and clock_out is null
  returning * into entry;
  perform set_config('seva.clock', '', true);
  if entry.id is null then
    raise exception 'You are not clocked in.';
  end if;
  return entry;
end
$$;

revoke all on function public.clock_in(text) from public;
revoke all on function public.clock_out(text) from public;
grant execute on function public.clock_in(text) to authenticated;
grant execute on function public.clock_out(text) to authenticated;

notify pgrst, 'reload schema';
