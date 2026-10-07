-- Departments, care teams and doctor fees per case.
-- Run after 20261007000000_init.sql (SQL editor, or `supabase db push`).
--
--   * departments: e.g. Cardiology, Orthopaedics, each with a default doctor fee per case.
--   * department_staff: which doctors and nurses belong to each department.
--   * patients get a department, an attending doctor and nurse, and the fee the
--     attending doctor earns for the case. A "Doctor Fee" payment marks fees as paid.

create table public.departments (
  id                  bigint generated always as identity primary key,
  name                text not null unique,
  description         text default '',
  default_doctor_fee  numeric(12, 2),
  active              boolean not null default true,
  created_at          timestamptz not null default now()
);

create table public.department_staff (
  department_id  bigint not null references public.departments (id) on delete cascade,
  staff_id       bigint not null references public.staff (id) on delete cascade,
  primary key (department_id, staff_id)
);
create index department_staff_staff_id_idx on public.department_staff (staff_id);

alter table public.patients
  add column department_id         bigint references public.departments (id) on delete set null,
  add column attending_doctor_id   bigint references public.staff (id) on delete set null,
  add column attending_nurse_id    bigint references public.staff (id) on delete set null,
  add column doctor_fee            numeric(12, 2),
  add column doctor_fee_status     text not null default 'Pending' check (doctor_fee_status in ('Pending', 'Paid')),
  add column doctor_fee_payment_id text references public.payments (id) on delete set null;
create index patients_department_id_idx on public.patients (department_id);
create index patients_attending_doctor_id_idx on public.patients (attending_doctor_id);

-- Only finance roles may set or settle a doctor's fee; other staff can still update
-- everything else on the patient.
create or replace function public.guard_doctor_fee() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.role() is distinct from 'service_role'
     and (new.doctor_fee is distinct from old.doctor_fee
          or new.doctor_fee_status is distinct from old.doctor_fee_status
          or new.doctor_fee_payment_id is distinct from old.doctor_fee_payment_id)
     and not public.has_role(array['Super Admin', 'Admin', 'Accounts']) then
    raise exception 'Only Super Admin, Admin or Accounts staff can change a doctor''s fee.';
  end if;
  return new;
end
$$;
create trigger patients_guard_doctor_fee before update on public.patients
  for each row execute function public.guard_doctor_fee();

create or replace function public.guard_doctor_fee_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.role() is distinct from 'service_role'
     and (new.doctor_fee is not null or new.doctor_fee_status = 'Paid' or new.doctor_fee_payment_id is not null)
     and not public.has_role(array['Super Admin', 'Admin', 'Accounts']) then
    raise exception 'Only Super Admin, Admin or Accounts staff can set a doctor''s fee.';
  end if;
  return new;
end
$$;
create trigger patients_guard_doctor_fee_insert before insert on public.patients
  for each row execute function public.guard_doctor_fee_insert();

-- Payments gain the "Doctor Fee" type (payment_type is free text, nothing to change).

-- Row level security: all active staff can see departments (to assign patients);
-- Super Admin and Admin manage them in Organization Setup.
alter table public.departments      enable row level security;
alter table public.department_staff enable row level security;

create policy departments_select on public.departments for select to authenticated
  using (public.is_active_staff());
create policy departments_write on public.departments for all to authenticated
  using (public.has_role(array['Super Admin', 'Admin']))
  with check (public.has_role(array['Super Admin', 'Admin']));

create policy department_staff_select on public.department_staff for select to authenticated
  using (public.is_active_staff());
create policy department_staff_write on public.department_staff for all to authenticated
  using (public.has_role(array['Super Admin', 'Admin']))
  with check (public.has_role(array['Super Admin', 'Admin']));
