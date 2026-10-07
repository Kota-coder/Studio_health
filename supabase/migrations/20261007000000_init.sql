-- CardioCare initial schema.
-- Run once against a new Supabase project (SQL editor, or `supabase db push`).
--
-- Conventions
--   * Column names are the snake_case form of the TypeScript field names in src/types,
--     so src/lib/data can map rows <-> objects mechanically.
--   * Optional fields are nullable: the app writes null when a form field is cleared.
--   * Dates the UI captures as "dd/MM/yyyy" (date of birth, bill date, ...) stay text;
--     record timestamps (created_at) are timestamptz.
--   * Images live in the private "patient-files" storage bucket; tables only keep the
--     object paths.
--   * Every table has row level security: only signed-in, active staff can read or
--     write, deletes are Super Admin only, and finance/staff tables are limited to
--     the roles that see those screens in the app.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Staff (linked to Supabase Auth users)
-- ---------------------------------------------------------------------------

create table public.staff (
  id            bigint generated always as identity primary key,
  auth_user_id  uuid unique references auth.users (id) on delete set null,
  name          text not null,
  phone_number  text default '',
  email         text not null unique,
  role          text not null check (role in ('Super Admin', 'Admin', 'Doctor', 'Nurse', 'Receptionist', 'Accounts')),
  hire_date     text default '',
  salary        numeric(12, 2),
  active        boolean not null default true,
  created_at    timestamptz not null default now()
);

-- Helper functions used by the policies. SECURITY DEFINER so they can read staff
-- without recursing through staff's own policies.
create or replace function public.current_staff_id() returns bigint
language sql stable security definer set search_path = public as $$
  select id from public.staff where auth_user_id = auth.uid() and active
$$;

create or replace function public.current_staff_role() returns text
language sql stable security definer set search_path = public as $$
  select role from public.staff where auth_user_id = auth.uid() and active
$$;

create or replace function public.is_active_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.staff where auth_user_id = auth.uid() and active)
$$;

create or replace function public.has_role(roles text[]) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.current_staff_role() = any (roles), false)
$$;

-- ---------------------------------------------------------------------------
-- Reference data
-- ---------------------------------------------------------------------------

create table public.referring_doctors (
  id              bigint generated always as identity primary key,
  name            text not null,
  location        text default '',
  phone_number    text default '',
  contact_number  text default '',
  email           text default '',
  specialization  text default '',
  notes           text default '',
  created_at      timestamptz not null default now()
);

create sequence public.medical_test_catalog_seq;
create table public.medical_test_catalog (
  id             text primary key default 'test_cat_' || nextval('public.medical_test_catalog_seq'),
  name           text not null,
  category       text default '',
  description    text default '',
  default_price  numeric(12, 2)
);

create sequence public.medications_seq;
create table public.medications (
  id                   text primary key default 'med_' || nextval('public.medications_seq'),
  name                 text not null,
  treatment            text default '',
  list_price           numeric(12, 2) default 0,
  quantity_in_package  numeric(12, 2),
  unit_of_measure      text default '',
  additional_notes     text default ''
);

create sequence public.materials_seq;
create table public.materials (
  id                                  text primary key default 'mat_' || nextval('public.materials_seq'),
  name                                text not null,
  category                            text default '',
  unit_of_measure                     text default '',
  list_price                          numeric(12, 2),
  associated_treatment_template_name  text default '',
  notes                               text default ''
);

create sequence public.vendors_seq;
create table public.vendors (
  id              text primary key default 'vendor_' || nextval('public.vendors_seq'),
  name            text not null,
  contact_person  text default '',
  phone_number    text default '',
  email           text default '',
  address         text default '',
  notes           text default ''
);

create sequence public.treatment_templates_seq;
create table public.treatment_templates (
  id               text primary key default 'user_tpl_' || nextval('public.treatment_templates_seq'),
  name             text not null,
  description      text default '',
  care_note_fields jsonb default '[]'
);

-- ---------------------------------------------------------------------------
-- Patients
-- ---------------------------------------------------------------------------

create table public.patients (
  id                                   bigint generated always as identity primary key,
  first_name                           text not null,
  last_name                            text not null,
  gender                               text default '',
  date_of_birth                        text default '',
  mobile_number                        text default '',
  email_address                        text default '',
  address                              text default '',
  id_card_type                         text default '',
  -- Aadhaar numbers are stored masked (XXXX XXXX 1234); see src/lib/aadhaar.ts.
  id_number                            text default '',
  emergency_contact_name               text default '',
  emergency_contact_number             text default '',
  -- Storage paths in the patient-files bucket. Aadhaar card images are never stored.
  id_card_images                       text[] not null default '{}',
  patient_photos                       text[] not null default '{}',
  condition                            text not null default 'Unassigned'
                                       check (condition in ('Critical', 'Medium', 'Low', 'Discharged', 'Unassigned')),
  assigned_staff_ids                   bigint[] default '{}',
  admission_date                       text,
  referred_doctor_id                   bigint references public.referring_doctors (id) on delete set null,
  reason_for_visit                     text,
  initial_observations_text            text,
  initial_observation_attachments      text[] not null default '{}',
  admission_condition                  text default '',
  -- DPDP Act 2023: record of the patient's consent to processing their data.
  consent_given_at                     timestamptz not null,
  consent_version                      text not null,
  consent_recorded_by_staff_id         bigint references public.staff (id) on delete set null,
  created_at                           timestamptz not null default now(),
  updated_at                           timestamptz not null default now()
);

create table public.care_notes (
  id                     uuid primary key default gen_random_uuid(),
  patient_id             bigint not null references public.patients (id) on delete cascade,
  text                   text default '',
  staff_id               bigint references public.staff (id) on delete set null,
  staff_name             text,
  template_id            text,
  template_name          text,
  template_fields_data   jsonb,
  medications_mentioned  jsonb default '[]',
  attachments            text[] not null default '{}',
  created_at             timestamptz not null default now()
);
create index care_notes_patient_id_idx on public.care_notes (patient_id);

create table public.patient_tests (
  id                       uuid primary key default gen_random_uuid(),
  patient_id               bigint not null references public.patients (id) on delete cascade,
  test_type_id             text not null,
  test_type_name           text not null,
  date_performed           text not null,
  test_data                jsonb default '{}',
  overall_results          text,
  notes                    text,
  performed_by_staff_id    bigint references public.staff (id) on delete set null,
  performed_by_staff_name  text,
  attachments              text[] not null default '{}',
  created_at               timestamptz not null default now()
);
create index patient_tests_patient_id_idx on public.patient_tests (patient_id);

-- ---------------------------------------------------------------------------
-- Billing and payments
-- ---------------------------------------------------------------------------

create sequence public.bills_seq;
create table public.bills (
  id               text primary key default 'BILL-' || lpad(nextval('public.bills_seq')::text, 3, '0'),
  patient_id       bigint not null references public.patients (id) on delete restrict,
  patient_name     text not null,
  bill_date        text not null,
  bill_type        text default '',
  items            jsonb default '[]',
  total_amount     numeric(12, 2) default 0,
  payment_method   text default '',
  payment_status   text default '',
  notes            text,
  attachments      text[] not null default '{}',
  payment_date     text,
  created_at       timestamptz not null default now()
);
create index bills_patient_id_idx on public.bills (patient_id);

create sequence public.payments_seq;
create table public.payments (
  id                      text primary key default 'PAY-' || lpad(nextval('public.payments_seq')::text, 3, '0'),
  payment_date            text not null,
  payment_type            text default '',
  payee_id                text,
  payee_name              text,
  payee_type              text,
  associated_patient_ids  bigint[] default '{}',
  description             text default '',
  amount                  numeric(12, 2) default 0,
  payment_method          text default '',
  transaction_id          text,
  notes                   text,
  purchased_medications   jsonb default '[]',
  purchased_materials     jsonb default '[]',
  recorded_by_staff_id    bigint references public.staff (id) on delete set null,
  recorded_by_staff_name  text,
  created_at              timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Audit log (append-only)
-- ---------------------------------------------------------------------------

create table public.audit_log (
  id              uuid primary key default gen_random_uuid(),
  entity_type     text not null check (entity_type in ('patient', 'bill', 'payment', 'staff')),
  entity_id       text not null,
  action_type     text not null,
  change_details  text default '',
  staff_id        bigint references public.staff (id) on delete set null,
  staff_name      text,
  created_at      timestamptz not null default now()
);
create index audit_log_entity_idx on public.audit_log (entity_type, entity_id);

-- Who made the change comes from the session, never from the client. Trusted
-- server code using the service-role key (e.g. /api/staff) supplies it explicitly.
create or replace function public.audit_log_stamp() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.role() is distinct from 'service_role' then
    new.staff_id := public.current_staff_id();
    new.staff_name := (select name from public.staff where id = new.staff_id);
  end if;
  new.created_at := now();
  return new;
end
$$;
create trigger audit_log_stamp before insert on public.audit_log
  for each row execute function public.audit_log_stamp();

create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end
$$;
create trigger patients_touch before update on public.patients
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.staff                enable row level security;
alter table public.referring_doctors    enable row level security;
alter table public.medical_test_catalog enable row level security;
alter table public.medications          enable row level security;
alter table public.materials            enable row level security;
alter table public.vendors              enable row level security;
alter table public.treatment_templates  enable row level security;
alter table public.patients             enable row level security;
alter table public.care_notes           enable row level security;
alter table public.patient_tests        enable row level security;
alter table public.bills                enable row level security;
alter table public.payments             enable row level security;
alter table public.audit_log            enable row level security;

-- Staff: everyone signed in can see the roster (names on notes, assignments);
-- creating and changing staff goes through /api/staff, which checks the caller's
-- role and uses the service key, so there are no write policies here.
create policy staff_select on public.staff for select to authenticated
  using (public.is_active_staff());

-- Clinical and reference tables: any active staff reads and writes, Super Admin deletes.
do $$
declare t text;
begin
  foreach t in array array[
    'referring_doctors', 'medical_test_catalog', 'medications', 'materials', 'vendors',
    'treatment_templates', 'patients', 'care_notes', 'patient_tests'
  ] loop
    execute format('create policy %1$s_select on public.%1$s for select to authenticated using (public.is_active_staff())', t);
    execute format('create policy %1$s_insert on public.%1$s for insert to authenticated with check (public.is_active_staff())', t);
    execute format('create policy %1$s_update on public.%1$s for update to authenticated using (public.is_active_staff()) with check (public.is_active_staff())', t);
    execute format('create policy %1$s_delete on public.%1$s for delete to authenticated using (public.has_role(array[''Super Admin'']))', t);
  end loop;
end
$$;

-- Bills: like the clinical tables, except any staff member may delete a bill that is
-- still unpaid (the Billing screen offers this); other bills only a Super Admin can.
create policy bills_select on public.bills for select to authenticated using (public.is_active_staff());
create policy bills_insert on public.bills for insert to authenticated with check (public.is_active_staff());
create policy bills_update on public.bills for update to authenticated
  using (public.is_active_staff()) with check (public.is_active_staff());
create policy bills_delete on public.bills for delete to authenticated
  using (public.has_role(array['Super Admin']) or (public.is_active_staff() and payment_status = 'Unpaid'));

-- Payments (clinic expenses, salaries): same roles that can open the Payments screen
-- (PAGE_ROLES.payments in src/config/permissions.ts).
create policy payments_select on public.payments for select to authenticated
  using (public.has_role(array['Super Admin', 'Admin', 'Doctor', 'Accounts']));
create policy payments_insert on public.payments for insert to authenticated
  with check (public.has_role(array['Super Admin', 'Admin', 'Doctor', 'Accounts']));
create policy payments_update on public.payments for update to authenticated
  using (public.has_role(array['Super Admin', 'Admin', 'Doctor', 'Accounts']))
  with check (public.has_role(array['Super Admin', 'Admin', 'Doctor', 'Accounts']));
create policy payments_delete on public.payments for delete to authenticated
  using (public.has_role(array['Super Admin']));

-- Audit log: readable and appendable by staff, never editable or deletable.
create policy audit_log_select on public.audit_log for select to authenticated
  using (public.is_active_staff());
create policy audit_log_insert on public.audit_log for insert to authenticated
  with check (public.is_active_staff());

-- ---------------------------------------------------------------------------
-- Storage: private bucket for ID cards, photos and attachments
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('patient-files', 'patient-files', false, 1048576, array['image/jpeg', 'image/webp'])
on conflict (id) do nothing;

create policy patient_files_select on storage.objects for select to authenticated
  using (bucket_id = 'patient-files' and public.is_active_staff());
create policy patient_files_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'patient-files' and public.is_active_staff());
create policy patient_files_delete on storage.objects for delete to authenticated
  using (bucket_id = 'patient-files' and public.has_role(array['Super Admin', 'Admin']));
