-- =============================================================================
-- Seva — the complete database in one script.
--
-- Run it in the Supabase SQL Editor (or `npm run migrate:hospitals`) for each hospital's
-- project. It is safe to run on:
--   * a brand-new, empty project,
--   * a project where an earlier attempt stopped half way,
--   * a database set up with the earlier step-by-step scripts (it brings it up to date),
-- and running it again changes nothing.
--
-- Conventions
--   * Column names are the snake_case form of the TypeScript field names in src/types,
--     so src/lib/data maps rows <-> objects mechanically.
--   * Optional fields are nullable: the app writes null when a form field is cleared.
--   * Dates the UI captures as "dd/MM/yyyy" (date of birth, bill date, ...) stay text;
--     bills and payments also get a real date column worked out from them, for filters.
--     Record timestamps (created_at) are timestamptz.
--   * Every table has row level security. Policies call the helper functions inside
--     (select ...) so Postgres evaluates them once per query, not once per row.
-- =============================================================================

create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- Staff (linked to Supabase Auth users) and the helpers the policies use
-- -----------------------------------------------------------------------------

create table if not exists public.staff (
  id            bigint generated always as identity primary key,
  auth_user_id  uuid unique references auth.users (id) on delete set null,
  name          text not null,
  phone_number  text default '',
  email         text not null unique,
  role          text not null,
  hire_date     text default '',
  salary        numeric(12, 2),
  active        boolean not null default true,
  preferred_language text not null default 'en',  -- 'en' or 'te' (Telugu)
  created_at    timestamptz not null default now()
);
alter table public.staff drop constraint if exists staff_role_check;
alter table public.staff add constraint staff_role_check
  check (role in ('Super Admin', 'Admin', 'Doctor', 'Nurse', 'Receptionist', 'Accounts'));

-- SECURITY DEFINER so they can read staff without recursing through staff's own policies.
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

-- "dd/MM/yyyy" text -> date; null when it isn't a valid date in that format.
create or replace function public.parse_dmy(value text) returns date
language plpgsql immutable as $$
begin
  if value ~ '^\d{2}/\d{2}/\d{4}$' then
    return to_date(value, 'DD/MM/YYYY');
  end if;
  return null;
exception when others then
  return null;
end
$$;

-- -----------------------------------------------------------------------------
-- Reference data and catalogs
-- -----------------------------------------------------------------------------

create table if not exists public.referring_doctors (
  id                        bigint generated always as identity primary key,
  name                      text not null,
  location                  text default '',
  phone_number              text default '',
  contact_number            text default '',
  email                     text default '',
  specialization            text default '',
  notes                     text default '',
  default_referral_fee      numeric(12, 2),   -- suggested fixed fee per referred patient
  default_referral_percent  numeric(5, 2),    -- or suggested % of procedures billed
  created_at                timestamptz not null default now()
);

create sequence if not exists public.medical_test_catalog_seq;
create table if not exists public.medical_test_catalog (
  id             text primary key default 'test_cat_' || nextval('public.medical_test_catalog_seq'),
  name           text not null,
  category       text default '',
  description    text default '',
  default_price  numeric(12, 2)
);

create sequence if not exists public.medications_seq;
create table if not exists public.medications (
  id                   text primary key default 'med_' || nextval('public.medications_seq'),
  name                 text not null,
  treatment            text default '',
  list_price           numeric(12, 2) default 0,
  quantity_in_package  numeric(12, 2),
  unit_of_measure      text default '',
  additional_notes     text default '',
  reorder_level        numeric(12, 2)  -- warn when stock falls to this (null: no warning)
);

create sequence if not exists public.materials_seq;
create table if not exists public.materials (
  id                                  text primary key default 'mat_' || nextval('public.materials_seq'),
  name                                text not null,
  category                            text default '',
  unit_of_measure                     text default '',
  list_price                          numeric(12, 2),
  associated_treatment_template_name  text default '',
  notes                               text default '',
  reorder_level                       numeric(12, 2)
);

create sequence if not exists public.vendors_seq;
create table if not exists public.vendors (
  id              text primary key default 'vendor_' || nextval('public.vendors_seq'),
  name            text not null,
  contact_person  text default '',
  phone_number    text default '',
  email           text default '',
  address         text default '',
  notes           text default ''
);

create sequence if not exists public.treatment_templates_seq;
create table if not exists public.treatment_templates (
  id               text primary key default 'user_tpl_' || nextval('public.treatment_templates_seq'),
  name             text not null,
  description      text default '',
  care_note_fields jsonb default '[]'
);

-- Ways money is received (bills) or paid out (payments); managed by the Super Admin.
create table if not exists public.payment_methods (
  id          bigint generated always as identity primary key,
  name        text not null unique,
  used_for    text not null default 'Both',
  active      boolean not null default true,
  sort_order  integer not null default 100,
  created_at  timestamptz not null default now(),
  constraint payment_methods_used_for_check check (used_for in ('Both', 'Bills', 'Payments')),
  constraint payment_methods_name_check check (length(trim(name)) > 0)
);

-- The hospital's own name, logo, colour and contact details (one row per hospital).
create table if not exists public.hospital_profile (
  id                  smallint primary key default 1,
  name                text not null default 'Seva',
  short_name          text,
  tagline             text,
  address             text,
  phone               text,
  email               text,
  website             text,
  registration_number text,
  brand_color         text not null default '#2563eb',
  logo_folder         text,         -- folder in the public "branding" bucket; new folder per change
  disabled_modules    text[] not null default '{}', -- menu sections this hospital has switched off (src/config/modules.ts)
  configured_at       timestamptz,  -- first time the Super Admin saved the profile
  updated_at          timestamptz not null default now(),
  constraint hospital_profile_single_row check (id = 1),
  constraint hospital_profile_name_check check (length(trim(name)) > 0),
  constraint hospital_profile_color_check check (brand_color ~ '^#[0-9a-fA-F]{6}$')
);

-- -----------------------------------------------------------------------------
-- Departments and care teams
-- -----------------------------------------------------------------------------

create table if not exists public.departments (
  id                  bigint generated always as identity primary key,
  name                text not null unique,
  description         text default '',
  default_doctor_fee  numeric(12, 2),
  active              boolean not null default true,
  created_at          timestamptz not null default now()
);

create table if not exists public.department_staff (
  department_id  bigint not null references public.departments (id) on delete cascade,
  staff_id       bigint not null references public.staff (id) on delete cascade,
  primary key (department_id, staff_id)
);

-- -----------------------------------------------------------------------------
-- Patients, care notes and tests
-- -----------------------------------------------------------------------------

create table if not exists public.patients (
  id                               bigint generated always as identity primary key,
  first_name                       text not null,
  last_name                        text not null,
  gender                           text default '',
  date_of_birth                    text default '',
  mobile_number                    text default '',
  email_address                    text default '',
  address                          text default '',
  id_card_type                     text default '',
  -- Aadhaar numbers are stored masked (XXXX XXXX 1234); see src/lib/aadhaar.ts.
  id_number                        text default '',
  emergency_contact_name           text default '',
  emergency_contact_number         text default '',
  -- Storage paths in the patient-files bucket. Aadhaar card images are never stored.
  id_card_images                   text[] not null default '{}',
  patient_photos                   text[] not null default '{}',
  condition                        text not null default 'Unassigned'
                                   check (condition in ('Critical', 'Medium', 'Low', 'Discharged', 'Unassigned')),
  assigned_staff_ids               bigint[] default '{}',
  admission_date                   text,
  referred_doctor_id               bigint references public.referring_doctors (id) on delete set null,
  reason_for_visit                 text,
  initial_observations_text        text,
  initial_observation_attachments  text[] not null default '{}',
  admission_condition              text default '',
  -- Department and care team, and the attending doctor's fee for the case.
  department_id                    bigint references public.departments (id) on delete set null,
  attending_doctor_id              bigint references public.staff (id) on delete set null,
  attending_nurse_id               bigint references public.staff (id) on delete set null,
  doctor_fee                       numeric(12, 2),
  doctor_fee_status                text not null default 'Pending',
  -- doctor_fee_payment_id and referral_fee_payment_id are added after payments below.
  -- Fee the hospital pays the referring doctor; basis records how a % fee was worked out.
  referral_fee                     numeric(12, 2),
  referral_fee_status              text not null default 'Pending',
  referral_fee_basis               jsonb,
  -- DPDP Act 2023: record of the patient's consent to processing their data.
  consent_given_at                 timestamptz not null,
  consent_version                  text not null,
  consent_recorded_by_staff_id     bigint references public.staff (id) on delete set null,
  created_at                       timestamptz not null default now(),
  updated_at                       timestamptz not null default now()
);

create table if not exists public.care_notes (
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

create table if not exists public.patient_tests (
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

-- -----------------------------------------------------------------------------
-- Billing and payments
-- -----------------------------------------------------------------------------

create sequence if not exists public.bills_seq;
create table if not exists public.bills (
  id                       text primary key default 'BILL-' || lpad(nextval('public.bills_seq')::text, 3, '0'),
  patient_id               bigint not null references public.patients (id) on delete restrict,
  patient_name             text not null,
  bill_date                text not null,
  bill_type                text default '',
  items                    jsonb default '[]',
  total_amount             numeric(12, 2) default 0,
  payment_method           text default '',
  payment_status           text default '',
  notes                    text,
  attachments              text[] not null default '{}',
  payment_date             text,
  -- Who processed it: the person creating it, unless the Super Admin chose someone else.
  processed_by_staff_id    bigint references public.staff (id) on delete set null,
  processed_by_staff_name  text,
  created_at               timestamptz not null default now(),
  -- Real date for filtering, from bill_date (or the day it was created).
  billed_on                date generated always as
                           (coalesce(public.parse_dmy(bill_date), (created_at at time zone 'Asia/Kolkata')::date)) stored
);

create sequence if not exists public.payments_seq;
create table if not exists public.payments (
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
  -- Who processed it (shown as "Processed by"); same rule as bills.
  recorded_by_staff_id    bigint references public.staff (id) on delete set null,
  recorded_by_staff_name  text,
  created_at              timestamptz not null default now(),
  paid_on                 date generated always as
                          (coalesce(public.parse_dmy(payment_date), (created_at at time zone 'Asia/Kolkata')::date)) stored
);

-- The payments that settled a patient's doctor and referral fees.
alter table public.patients
  add column if not exists doctor_fee_payment_id   text references public.payments (id) on delete set null,
  add column if not exists referral_fee_payment_id text references public.payments (id) on delete set null;

-- Online payments through a payment provider (Razorpay, PhonePe, ...), ready for when one is
-- connected (see src/lib/payments). Rows are written only by the server, after the provider
-- confirms a payment; staff can see them.
create table if not exists public.payment_transactions (
  id                   uuid primary key default gen_random_uuid(),
  bill_id              text references public.bills (id) on delete set null,
  provider             text not null,               -- e.g. 'razorpay'
  provider_order_id    text not null,
  provider_payment_id  text,
  amount               numeric(12, 2) not null,
  currency             text not null default 'INR',
  status               text not null default 'created',
  method               text,                        -- as reported by the provider, e.g. 'upi', 'card'
  details              jsonb not null default '{}', -- the provider's reply (no card numbers or secrets)
  created_by_staff_id  bigint references public.staff (id) on delete set null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint payment_transactions_status_check
    check (status in ('created', 'pending', 'paid', 'failed', 'refunded', 'cancelled')),
  constraint payment_transactions_order_unique unique (provider, provider_order_id)
);

-- -----------------------------------------------------------------------------
-- Inventory: every change to pharmacy and material stock, one row each
-- -----------------------------------------------------------------------------
-- Rows from bills and payments (source_type 'bill' / 'payment') are kept in step with them
-- by triggers: a pharmacy bill takes stock out, a Pharmacy or Material purchase payment
-- puts it in, and editing, cancelling or deleting them corrects the stock. Rows without a
-- source are entered on the Inventory page (opening stock, received, used, expired, counts).
-- Quantities are in the item's own unit (the unit its price is for); out is negative.

create table if not exists public.stock_movements (
  id                      bigint generated always as identity primary key,
  medication_id           text references public.medications (id) on delete cascade,
  material_id             text references public.materials (id) on delete cascade,
  quantity                numeric(12, 2) not null,
  unit_cost               numeric(12, 2),       -- purchase price per unit, for stock coming in
  reason                  text not null,
  source_type             text,
  source_id               text,
  moved_on                date not null default ((now() at time zone 'Asia/Kolkata')::date),
  note                    text,
  recorded_by_staff_id    bigint references public.staff (id) on delete set null,
  recorded_by_staff_name  text,
  created_at              timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Duty roster and attendance
-- -----------------------------------------------------------------------------

-- A shift whose end_time is not after start_time ends the next day (equal = 24 hours).
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

-- Staff clock in and out with clock_in() / clock_out() (server time); Super Admin and
-- Admin can add or correct entries, which are then marked 'Manual'.
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

-- -----------------------------------------------------------------------------
-- Audit log (append-only)
-- -----------------------------------------------------------------------------

create table if not exists public.audit_log (
  id              uuid primary key default gen_random_uuid(),
  entity_type     text not null check (entity_type in ('patient', 'bill', 'payment', 'staff')),
  entity_id       text not null,
  action_type     text not null,
  change_details  text default '',
  staff_id        bigint references public.staff (id) on delete set null,
  staff_name      text,
  created_at      timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Bringing an older database up to date
--
-- Databases set up with the earlier step-by-step scripts already have the tables above,
-- so "create table if not exists" skipped them; these add whatever they are missing.
-- On a new database they change nothing.
-- -----------------------------------------------------------------------------

-- Very first version: one image path per record instead of lists.
alter table public.patients      add column if not exists id_card_images                  text[] not null default '{}';
alter table public.patients      add column if not exists patient_photos                  text[] not null default '{}';
alter table public.patients      add column if not exists initial_observation_attachments text[] not null default '{}';
alter table public.care_notes    add column if not exists attachments                     text[] not null default '{}';
alter table public.patient_tests add column if not exists attachments                     text[] not null default '{}';
alter table public.bills         add column if not exists attachments                     text[] not null default '{}';
do $$
declare
  moves constant text[][] := array[
    array['patients', 'id_card_image_path', 'id_card_images'],
    array['patients', 'patient_photo_path', 'patient_photos'],
    array['patients', 'initial_observation_attachment_path', 'initial_observation_attachments'],
    array['care_notes', 'attachment_path', 'attachments'],
    array['patient_tests', 'attachment_path', 'attachments'],
    array['bills', 'attachment_path', 'attachments']
  ];
  move text[];
begin
  foreach move slice 1 in array moves loop
    if exists (select 1 from information_schema.columns
               where table_schema = 'public' and table_name = move[1] and column_name = move[2]) then
      execute format(
        'update public.%1$I set %3$I = array_append(%3$I, %2$I) where %2$I is not null and not (%2$I = any (%3$I))',
        move[1], move[2], move[3]);
      execute format('alter table public.%I drop column %I', move[1], move[2]);
    end if;
  end loop;
end
$$;

alter table public.referring_doctors
  add column if not exists default_referral_fee     numeric(12, 2),
  add column if not exists default_referral_percent numeric(5, 2);

alter table public.patients
  add column if not exists department_id         bigint references public.departments (id) on delete set null,
  add column if not exists attending_doctor_id   bigint references public.staff (id) on delete set null,
  add column if not exists attending_nurse_id    bigint references public.staff (id) on delete set null,
  add column if not exists doctor_fee            numeric(12, 2),
  add column if not exists doctor_fee_status     text not null default 'Pending',
  add column if not exists referral_fee          numeric(12, 2),
  add column if not exists referral_fee_status   text not null default 'Pending',
  add column if not exists referral_fee_basis    jsonb;

alter table public.hospital_profile add column if not exists disabled_modules text[] not null default '{}';

-- A payment method collected online names its provider (e.g. "UPI (online)" -> 'razorpay').
alter table public.payment_methods add column if not exists gateway text;

alter table public.bills
  add column if not exists processed_by_staff_id   bigint references public.staff (id) on delete set null,
  add column if not exists processed_by_staff_name text,
  add column if not exists billed_on date generated always as
    (coalesce(public.parse_dmy(bill_date), (created_at at time zone 'Asia/Kolkata')::date)) stored;
alter table public.payments
  add column if not exists paid_on date generated always as
    (coalesce(public.parse_dmy(payment_date), (created_at at time zone 'Asia/Kolkata')::date)) stored;

-- Who processed existing bills, from the audit trail (only fills in blanks).
update public.bills b
   set processed_by_staff_id = first_entry.staff_id,
       processed_by_staff_name = first_entry.staff_name
  from (
    select distinct on (entity_id) entity_id, staff_id, staff_name
    from public.audit_log
    where entity_type = 'bill' and staff_id is not null
    order by entity_id, created_at
  ) first_entry
 where b.processed_by_staff_id is null and first_entry.entity_id = b.id;

-- Replaced by financial_summary(text, date, date) below.
drop function if exists public.financial_summary(text);

-- Each person's language for the app (English or Telugu).
alter table public.staff add column if not exists preferred_language text not null default 'en';

-- Inventory: reorder levels.
alter table public.medications add column if not exists reorder_level numeric(12, 2);
alter table public.materials   add column if not exists reorder_level numeric(12, 2);

-- -----------------------------------------------------------------------------
-- Constraints (named, so they can be re-applied)
-- -----------------------------------------------------------------------------

alter table public.patients drop constraint if exists patients_doctor_fee_status_check;
alter table public.patients add constraint patients_doctor_fee_status_check
  check (doctor_fee_status in ('Pending', 'Paid'));
alter table public.patients drop constraint if exists patients_referral_fee_status_check;
alter table public.patients add constraint patients_referral_fee_status_check
  check (referral_fee_status in ('Pending', 'Paid'));
alter table public.referring_doctors drop constraint if exists referring_doctors_default_referral_percent_check;
alter table public.referring_doctors add constraint referring_doctors_default_referral_percent_check
  check (default_referral_percent is null or (default_referral_percent >= 0 and default_referral_percent <= 100));
alter table public.staff drop constraint if exists staff_preferred_language_check;
alter table public.staff add constraint staff_preferred_language_check check (preferred_language in ('en', 'te'));
alter table public.stock_movements drop constraint if exists stock_movements_item_check;
alter table public.stock_movements add constraint stock_movements_item_check
  check ((medication_id is null) <> (material_id is null));
alter table public.stock_movements drop constraint if exists stock_movements_reason_check;
alter table public.stock_movements add constraint stock_movements_reason_check
  check (reason in ('purchase', 'received', 'opening', 'dispensed', 'used', 'expired', 'adjustment'));
alter table public.stock_movements drop constraint if exists stock_movements_source_check;
alter table public.stock_movements add constraint stock_movements_source_check
  check (source_type is null or (source_type in ('bill', 'payment') and source_id is not null));
alter table public.stock_movements drop constraint if exists stock_movements_quantity_check;
alter table public.stock_movements add constraint stock_movements_quantity_check check (quantity <> 0);
alter table public.medications drop constraint if exists medications_reorder_level_check;
alter table public.medications add constraint medications_reorder_level_check check (reorder_level is null or reorder_level >= 0);
alter table public.materials drop constraint if exists materials_reorder_level_check;
alter table public.materials add constraint materials_reorder_level_check check (reorder_level is null or reorder_level >= 0);

-- -----------------------------------------------------------------------------
-- Indexes: foreign keys used in lookups and joins, and the filters the screens use
-- -----------------------------------------------------------------------------

-- Notes by patient, newest first (patient page, and the dashboard's "latest note").
create index if not exists care_notes_patient_created_idx on public.care_notes (patient_id, created_at desc);
drop index if exists public.care_notes_patient_id_idx;  -- covered by the index above
create index if not exists patient_tests_patient_id_idx on public.patient_tests (patient_id);
create index if not exists department_staff_staff_id_idx on public.department_staff (staff_id);
create index if not exists patients_department_id_idx on public.patients (department_id);
create index if not exists patients_attending_doctor_id_idx on public.patients (attending_doctor_id);
create index if not exists patients_referred_doctor_id_idx on public.patients (referred_doctor_id);
create index if not exists patients_doctor_fee_payment_idx on public.patients (doctor_fee_payment_id) where doctor_fee_payment_id is not null;
create index if not exists patients_referral_fee_payment_idx on public.patients (referral_fee_payment_id) where referral_fee_payment_id is not null;
create index if not exists bills_patient_id_idx on public.bills (patient_id);
create index if not exists bills_billed_on_idx on public.bills (billed_on);
create index if not exists bills_payment_method_idx on public.bills (payment_method);
create index if not exists bills_processed_by_idx on public.bills (processed_by_staff_id);
create index if not exists payments_paid_on_idx on public.payments (paid_on);
create index if not exists payments_payment_method_idx on public.payments (payment_method);
create index if not exists payments_recorded_by_idx on public.payments (recorded_by_staff_id);
create index if not exists staff_shifts_date_idx on public.staff_shifts (shift_date);
create index if not exists staff_shifts_staff_date_idx on public.staff_shifts (staff_id, shift_date);
create index if not exists staff_attendance_clock_in_idx on public.staff_attendance (clock_in);
-- At most one open (not clocked out) entry per person.
create unique index if not exists staff_attendance_one_open_idx on public.staff_attendance (staff_id) where clock_out is null;
create index if not exists audit_log_entity_idx on public.audit_log (entity_type, entity_id);
create index if not exists payment_transactions_bill_idx on public.payment_transactions (bill_id);
create index if not exists stock_movements_medication_idx on public.stock_movements (medication_id, created_at desc) where medication_id is not null;
create index if not exists stock_movements_material_idx on public.stock_movements (material_id, created_at desc) where material_id is not null;
create index if not exists stock_movements_source_idx on public.stock_movements (source_type, source_id) where source_type is not null;

-- -----------------------------------------------------------------------------
-- Triggers
-- -----------------------------------------------------------------------------

-- Audit entries: who made the change comes from the session, never from the client.
-- Trusted server code using the service-role key (e.g. /api/staff) supplies it.
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
drop trigger if exists audit_log_stamp on public.audit_log;
create trigger audit_log_stamp before insert on public.audit_log
  for each row execute function public.audit_log_stamp();

create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end
$$;
drop trigger if exists patients_touch on public.patients;
create trigger patients_touch before update on public.patients
  for each row execute function public.touch_updated_at();

-- Only finance roles may set or settle doctor and referral fees.
create or replace function public.guard_doctor_fee() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.role() is distinct from 'service_role'
     and (new.doctor_fee is distinct from old.doctor_fee
          or new.doctor_fee_status is distinct from old.doctor_fee_status
          or new.doctor_fee_payment_id is distinct from old.doctor_fee_payment_id
          or new.referral_fee is distinct from old.referral_fee
          or new.referral_fee_basis is distinct from old.referral_fee_basis
          or new.referral_fee_status is distinct from old.referral_fee_status
          or new.referral_fee_payment_id is distinct from old.referral_fee_payment_id)
     and not public.has_role(array['Super Admin', 'Admin', 'Accounts']) then
    raise exception 'Only Super Admin, Admin or Accounts staff can change doctor or referral fees.';
  end if;
  return new;
end
$$;
drop trigger if exists patients_guard_doctor_fee on public.patients;
create trigger patients_guard_doctor_fee before update on public.patients
  for each row execute function public.guard_doctor_fee();

create or replace function public.guard_doctor_fee_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.role() is distinct from 'service_role'
     and (new.doctor_fee is not null or new.doctor_fee_status = 'Paid' or new.doctor_fee_payment_id is not null
          or new.referral_fee is not null or new.referral_fee_basis is not null
          or new.referral_fee_status = 'Paid' or new.referral_fee_payment_id is not null)
     and not public.has_role(array['Super Admin', 'Admin', 'Accounts']) then
    raise exception 'Only Super Admin, Admin or Accounts staff can set doctor or referral fees.';
  end if;
  return new;
end
$$;
drop trigger if exists patients_guard_doctor_fee_insert on public.patients;
create trigger patients_guard_doctor_fee_insert before insert on public.patients
  for each row execute function public.guard_doctor_fee_insert();

-- Who processed a bill or payment: staff are recorded as themselves unless the Super Admin
-- assigns someone else; the stored name always comes from the staff table.
create or replace function public.stamp_processed_by() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  me bigint := public.current_staff_id();
  is_super boolean := public.has_role(array['Super Admin']);
  new_id bigint;
  old_id bigint;
begin
  if tg_table_name = 'bills' then
    new_id := new.processed_by_staff_id;
    old_id := case when tg_op = 'UPDATE' then old.processed_by_staff_id end;
  else
    new_id := new.recorded_by_staff_id;
    old_id := case when tg_op = 'UPDATE' then old.recorded_by_staff_id end;
  end if;

  if auth.role() is distinct from 'service_role' then
    if tg_op = 'INSERT' then
      if new_id is null then
        new_id := me;
      elsif new_id is distinct from me and not is_super then
        raise exception 'Only the Super Admin can record a bill or payment as processed by someone else.';
      end if;
    elsif new_id is distinct from old_id and not is_super then
      raise exception 'Only the Super Admin can change who processed a bill or payment.';
    end if;
  end if;

  if tg_table_name = 'bills' then
    new.processed_by_staff_id := new_id;
    new.processed_by_staff_name := (select name from public.staff where id = new_id);
  else
    new.recorded_by_staff_id := new_id;
    new.recorded_by_staff_name := coalesce((select name from public.staff where id = new_id), new.recorded_by_staff_name);
  end if;
  return new;
end
$$;
drop trigger if exists bills_stamp_processed_by on public.bills;
create trigger bills_stamp_processed_by before insert or update on public.bills
  for each row execute function public.stamp_processed_by();
drop trigger if exists payments_stamp_processed_by on public.payments;
create trigger payments_stamp_processed_by before insert or update on public.payments
  for each row execute function public.stamp_processed_by();

-- Renaming a payment method renames it on the bills and payments that used it.
create or replace function public.rename_payment_method() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.name is distinct from old.name then
    update public.bills set payment_method = new.name where payment_method = old.name;
    update public.payments set payment_method = new.name where payment_method = old.name;
  end if;
  return new;
end
$$;
drop trigger if exists payment_methods_rename on public.payment_methods;
create trigger payment_methods_rename after update of name on public.payment_methods
  for each row execute function public.rename_payment_method();

-- Attendance written directly (not through clock_in/clock_out) is a manual correction.
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

create or replace function public.touch_hospital_profile() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  new.configured_at := coalesce(old.configured_at, now());
  return new;
end
$$;
drop trigger if exists hospital_profile_touch on public.hospital_profile;
create trigger hospital_profile_touch before update on public.hospital_profile
  for each row execute function public.touch_hospital_profile();

-- Inventory: pharmacy bills take stock out. A bill item counts against a pharmacy item
-- when it carries that item's id, or (older bills, typed names) has exactly its name.
-- Cancelled bills take nothing. Re-run whenever the bill's items, type, status or date change.
create or replace function public.sync_bill_stock() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' and current_setting('seva.stock_resync', true) is distinct from 'on'
     and old.items is not distinct from new.items
     and old.bill_type is not distinct from new.bill_type
     and (old.payment_status = 'Cancelled') is not distinct from (new.payment_status = 'Cancelled')
     and old.billed_on is not distinct from new.billed_on
     and old.patient_name is not distinct from new.patient_name then
    return new;
  end if;
  if tg_op in ('UPDATE', 'DELETE') then
    delete from public.stock_movements where source_type = 'bill' and source_id = old.id;
  end if;
  if tg_op in ('INSERT', 'UPDATE') and new.bill_type = 'Pharmacy' and coalesce(new.payment_status, '') <> 'Cancelled' then
    insert into public.stock_movements
      (medication_id, quantity, reason, source_type, source_id, moved_on, note, recorded_by_staff_id, recorded_by_staff_name)
    select med.id, -sum(line.qty), 'dispensed', 'bill', new.id, new.billed_on,
           'Bill ' || new.id || ' · ' || new.patient_name, new.processed_by_staff_id, new.processed_by_staff_name
    from jsonb_array_elements(case when jsonb_typeof(new.items) = 'array' then new.items else '[]'::jsonb end) item
    cross join lateral (select case when item->>'quantity' ~ '^\s*-?[0-9]+(\.[0-9]+)?\s*$'
                                    then (item->>'quantity')::numeric else 0 end as qty) line
    join lateral (
      select m.id from public.medications m
      where m.id = item->>'medicationId' or lower(trim(m.name)) = lower(trim(item->>'description'))
      order by (m.id = item->>'medicationId') desc nulls last, m.id
      limit 1
    ) med on true
    group by med.id
    having sum(line.qty) <> 0;
  end if;
  return coalesce(new, old);
end
$$;
drop trigger if exists bills_sync_stock on public.bills;
create trigger bills_sync_stock after insert or update or delete on public.bills
  for each row execute function public.sync_bill_stock();

-- Inventory: Pharmacy and Material purchase payments put stock in, at the price paid.
create or replace function public.sync_payment_stock() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' and current_setting('seva.stock_resync', true) is distinct from 'on'
     and old.purchased_medications is not distinct from new.purchased_medications
     and old.purchased_materials is not distinct from new.purchased_materials
     and old.payment_type is not distinct from new.payment_type
     and old.paid_on is not distinct from new.paid_on
     and old.payee_name is not distinct from new.payee_name then
    return new;
  end if;
  if tg_op in ('UPDATE', 'DELETE') then
    delete from public.stock_movements where source_type = 'payment' and source_id = old.id;
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    insert into public.stock_movements
      (medication_id, material_id, quantity, unit_cost, reason, source_type, source_id, moved_on, note,
       recorded_by_staff_id, recorded_by_staff_name)
    select case when line.kind = 'medication' then line.item_id end,
           case when line.kind = 'material' then line.item_id end,
           line.qty, line.cost, 'purchase', 'payment', new.id, new.paid_on,
           'Payment ' || new.id || coalesce(' · ' || nullif(new.payee_name, ''), ''),
           new.recorded_by_staff_id, new.recorded_by_staff_name
    from (
      select 'medication' as kind, item->>'medicationId' as item_id, item
      from jsonb_array_elements(case when new.payment_type = 'Pharmacy' and jsonb_typeof(new.purchased_medications) = 'array'
                                     then new.purchased_medications else '[]'::jsonb end) item
      union all
      select 'material', item->>'materialId', item
      from jsonb_array_elements(case when new.payment_type = 'Material' and jsonb_typeof(new.purchased_materials) = 'array'
                                     then new.purchased_materials else '[]'::jsonb end) item
    ) raw
    cross join lateral (
      select raw.kind, raw.item_id,
             case when raw.item->>'quantityPurchased' ~ '^\s*[0-9]+(\.[0-9]+)?\s*$'
                  then (raw.item->>'quantityPurchased')::numeric else 0 end as qty,
             coalesce(case when raw.item->>'unitPriceAtPurchase' ~ '^\s*[0-9]+(\.[0-9]+)?\s*$' then (raw.item->>'unitPriceAtPurchase')::numeric end,
                      case when raw.item->>'listPriceSnapshot' ~ '^\s*[0-9]+(\.[0-9]+)?\s*$' then (raw.item->>'listPriceSnapshot')::numeric end) as cost
    ) line
    where line.qty > 0
      and ((line.kind = 'medication' and exists (select 1 from public.medications m where m.id = line.item_id))
        or (line.kind = 'material' and exists (select 1 from public.materials m where m.id = line.item_id)));
  end if;
  return coalesce(new, old);
end
$$;
drop trigger if exists payments_sync_stock on public.payments;
create trigger payments_sync_stock after insert or update or delete on public.payments
  for each row execute function public.sync_payment_stock();

-- Entries made on the Inventory page are recorded as the person making them.
create or replace function public.stamp_stock_movement() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.source_type is null and auth.role() is distinct from 'service_role' then
    new.recorded_by_staff_id := public.current_staff_id();
    new.recorded_by_staff_name := (select name from public.staff where id = new.recorded_by_staff_id);
    new.unit_cost := case when new.quantity > 0 then new.unit_cost end;
  end if;
  return new;
end
$$;
drop trigger if exists stock_movements_stamp on public.stock_movements;
create trigger stock_movements_stamp before insert on public.stock_movements
  for each row execute function public.stamp_stock_movement();

-- -----------------------------------------------------------------------------
-- Functions the app calls
-- -----------------------------------------------------------------------------

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

-- Financial Dashboard totals for a period (bills by billed_on, payments by paid_on; null
-- dates = all time). The monthly series covers the period's months (at most 24), or the
-- last 6 months for all time. Doctor and referral fee tables are what is owed now.
-- SECURITY INVOKER: row level security still applies to the caller.
create or replace function public.financial_summary(tz text default 'Asia/Kolkata', from_date date default null, to_date date default null)
returns jsonb
language sql stable security invoker set search_path = public as $$
  with
  b as (select * from public.bills
        where (from_date is null or billed_on >= from_date) and (to_date is null or billed_on <= to_date)),
  p as (select * from public.payments
        where (from_date is null or paid_on >= from_date) and (to_date is null or paid_on <= to_date)),
  bounds as (
    select
      case when from_date is null and to_date is null
           then date_trunc('month', now() at time zone tz) - interval '5 months'
           else greatest(date_trunc('month', coalesce(from_date, (select min(billed_on) from public.bills), (now() at time zone tz)::date)),
                         date_trunc('month', coalesce(to_date, (now() at time zone tz)::date)) - interval '23 months')
      end as first_month,
      date_trunc('month', coalesce(to_date, (now() at time zone tz)::date)) as last_month
  ),
  months as (
    select generate_series(first_month, greatest(first_month, last_month), interval '1 month') as month from bounds
  ),
  bill_months as (
    select date_trunc('month', billed_on) as month,
           sum(total_amount) as billed,
           sum(case when payment_status = 'Paid' then total_amount else 0 end) as collected
    from b group by 1
  ),
  payment_months as (
    select date_trunc('month', paid_on) as month, sum(amount) as spent from p group by 1
  ),
  doctor_fees as (
    select pt.attending_doctor_id as "doctorId",
           coalesce(s.name, 'Staff #' || pt.attending_doctor_id) as doctor,
           coalesce(array_agg(distinct d.name) filter (where d.name is not null), '{}') as departments,
           count(*) as cases,
           coalesce(sum(pt.doctor_fee) filter (where pt.doctor_fee_status = 'Paid'), 0) as paid,
           coalesce(sum(pt.doctor_fee) filter (where pt.doctor_fee_status is distinct from 'Paid'), 0) as pending
    from public.patients pt
    left join public.staff s on s.id = pt.attending_doctor_id
    left join public.departments d on d.id = pt.department_id
    where pt.attending_doctor_id is not null and pt.doctor_fee is not null
    group by pt.attending_doctor_id, s.name
  ),
  -- Unpaid referrals without their own fee count at the doctor's default fixed fee.
  referral_fees as (
    select pt.referred_doctor_id as "doctorId",
           coalesce(r.name, 'Referring doctor #' || pt.referred_doctor_id) as doctor,
           count(*) as referrals,
           coalesce(sum(pt.referral_fee) filter (where pt.referral_fee_status = 'Paid'), 0) as paid,
           coalesce(sum(coalesce(pt.referral_fee, r.default_referral_fee))
             filter (where pt.referral_fee_status is distinct from 'Paid'), 0) as pending,
           count(*) filter (where pt.referral_fee_status is distinct from 'Paid'
                              and coalesce(pt.referral_fee, r.default_referral_fee) is null) as unpriced
    from public.patients pt
    left join public.referring_doctors r on r.id = pt.referred_doctor_id
    where pt.referred_doctor_id is not null
    group by pt.referred_doctor_id, r.name
  )
  select jsonb_build_object(
    'billCount', (select count(*) from b),
    'paymentCount', (select count(*) from p),
    'totalBilled', (select coalesce(sum(total_amount), 0) from b),
    -- "Partially Paid" bills count as half collected (partial amounts aren't recorded).
    'totalCollected', (select round(coalesce(sum(case payment_status when 'Paid' then total_amount
                                                                     when 'Partially Paid' then total_amount / 2
                                                                     else 0 end), 0), 2) from b),
    'totalSpent', (select coalesce(sum(amount), 0) from p),
    'billStatusCounts', (select coalesce(jsonb_object_agg(status, n), '{}') from
                           (select coalesce(nullif(payment_status, ''), 'Unknown') as status, count(*) as n from b group by 1) x),
    'billTypeAmounts', (select coalesce(jsonb_object_agg(type, total), '{}') from
                          (select coalesce(nullif(bill_type, ''), 'Unknown') as type, sum(total_amount) as total from b group by 1) x),
    'paymentTypeAmounts', (select coalesce(jsonb_object_agg(type, total), '{}') from
                             (select coalesce(nullif(payment_type, ''), 'Unknown') as type, sum(amount) as total from p group by 1) x),
    'receivedByMethod', (select coalesce(jsonb_object_agg(method, total), '{}') from
                           (select coalesce(nullif(payment_method, ''), 'Not recorded') as method,
                                   round(sum(case payment_status when 'Paid' then total_amount when 'Partially Paid' then total_amount / 2 else 0 end), 2) as total
                            from b where payment_status in ('Paid', 'Partially Paid') group by 1) x),
    'paidOutByMethod', (select coalesce(jsonb_object_agg(method, total), '{}') from
                          (select coalesce(nullif(payment_method, ''), 'Not recorded') as method, sum(amount) as total from p group by 1) x),
    'monthly', (select jsonb_agg(jsonb_build_object(
                  'month', to_char(m.month, 'YYYY-MM'),
                  'billed', coalesce(bm.billed, 0),
                  'collected', coalesce(bm.collected, 0),
                  'spent', coalesce(pm.spent, 0)) order by m.month)
                from months m
                left join bill_months bm on bm.month = m.month
                left join payment_months pm on pm.month = m.month),
    'doctorFees', (select coalesce(jsonb_agg(to_jsonb(f) order by f.pending desc, f.doctor), '[]') from doctor_fees f),
    'referralFees', (select coalesce(jsonb_agg(to_jsonb(f) order by f.pending desc, f.doctor), '[]') from referral_fees f)
  )
$$;

-- Inventory page: every pharmacy item and material with its stock on hand (all time), its
-- average purchase cost, and what came in and went out in the period (null dates: all time).
-- Items never bought at a recorded price are valued at their list price (costFromList).
create or replace function public.inventory_summary(from_date date default null, to_date date default null)
returns jsonb
language sql stable security invoker set search_path = public as $$
  with items as (
    select 'pharmacy' as kind, id, name, coalesce(unit_of_measure, '') as unit, coalesce(treatment, '') as category,
           list_price, reorder_level
    from public.medications
    union all
    select 'material', id, name, coalesce(unit_of_measure, ''), coalesce(category, ''), list_price, reorder_level
    from public.materials
  ), totals as (
    select coalesce(medication_id, material_id) as item_id,
           sum(quantity) as on_hand,
           sum(quantity * unit_cost) filter (where quantity > 0 and unit_cost is not null)
             / nullif(sum(quantity) filter (where quantity > 0 and unit_cost is not null), 0) as avg_cost,
           sum(quantity) filter (where quantity > 0 and (from_date is null or moved_on >= from_date)
                                   and (to_date is null or moved_on <= to_date)) as qty_in,
           -sum(quantity) filter (where quantity < 0 and (from_date is null or moved_on >= from_date)
                                    and (to_date is null or moved_on <= to_date)) as qty_out,
           -sum(quantity) filter (where reason = 'expired' and (from_date is null or moved_on >= from_date)
                                    and (to_date is null or moved_on <= to_date)) as qty_expired,
           max(moved_on) as last_moved
    from public.stock_movements
    group by 1
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'kind', i.kind, 'id', i.id, 'name', i.name, 'unit', i.unit, 'category', i.category,
           'reorderLevel', i.reorder_level,
           'onHand', coalesce(t.on_hand, 0),
           'unitCost', round(coalesce(t.avg_cost, i.list_price, 0), 2),
           'costFromList', t.avg_cost is null,
           'qtyIn', coalesce(t.qty_in, 0),
           'qtyOut', coalesce(t.qty_out, 0),
           'qtyExpired', coalesce(t.qty_expired, 0),
           'lastMoved', t.last_moved
         ) order by i.kind, lower(i.name)), '[]'::jsonb)
  from items i
  left join totals t on t.item_id = i.id
$$;

-- Home dashboard: a short summary for the signed-in person, containing only what their
-- role may see (the role lists match PAGE_ROLES in src/config/permissions.ts). One call,
-- about 1 KB. Sections a role may not see are left out, not zeroed.
create or replace function public.home_summary(tz text default 'Asia/Kolkata')
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  me bigint := public.current_staff_id();
  today date := (now() at time zone tz)::date;
  now_time time := (now() at time zone tz)::time;
  result jsonb;
begin
  if me is null then
    return null;
  end if;

  -- Everyone: patients in care, and their own patients and duty.
  select jsonb_build_object('patients', jsonb_build_object(
           'inCare', count(*) filter (where condition <> 'Discharged'),
           'critical', count(*) filter (where condition = 'Critical'),
           'newToday', count(*) filter (where coalesce(
                         case when admission_date ~ '^\d{4}-\d{2}-\d{2}T' then (admission_date::timestamptz at time zone tz)::date end,
                         public.parse_dmy(admission_date), (created_at at time zone tz)::date) = today),
           'mine', count(*) filter (where condition <> 'Discharged'
                                      and (attending_doctor_id = me or attending_nurse_id = me or me = any (assigned_staff_ids))),
           'myCritical', count(*) filter (where condition = 'Critical'
                                            and (attending_doctor_id = me or attending_nurse_id = me or me = any (assigned_staff_ids)))))
    into result
    from public.patients;

  result := result || jsonb_build_object('duty', jsonb_build_object(
    'clockedInSince', (select clock_in from public.staff_attendance where staff_id = me and clock_out is null),
    'onDutyNow', (select count(*) from public.staff_attendance where clock_out is null),
    'nextShift', (select jsonb_build_object('date', shift_date, 'type', shift_type,
                                            'start', to_char(start_time, 'HH24:MI'), 'end', to_char(end_time, 'HH24:MI'))
                  from public.staff_shifts
                  where staff_id = me
                    and (shift_date > today or (shift_date = today and (end_time > now_time or end_time <= start_time)))
                  order by shift_date, start_time
                  limit 1)));

  -- Billing (every role that opens Billing).
  if public.has_role(array['Super Admin', 'Admin', 'Doctor', 'Nurse', 'Receptionist', 'Accounts']) then
    result := result || (select jsonb_build_object('billing', jsonb_build_object(
      'todayCount', count(*) filter (where billed_on = today and payment_status <> 'Cancelled'),
      'todayAmount', coalesce(sum(total_amount) filter (where billed_on = today and payment_status <> 'Cancelled'), 0),
      'unpaidCount', count(*) filter (where payment_status in ('Unpaid', 'Partially Paid')),
      'unpaidAmount', coalesce(sum(total_amount) filter (where payment_status in ('Unpaid', 'Partially Paid')), 0)))
      from public.bills);
  end if;

  -- Money in and out (the Financial Dashboard roles).
  if public.has_role(array['Super Admin', 'Admin', 'Doctor', 'Accounts']) then
    result := result || jsonb_build_object('money', jsonb_build_object(
      'collectedToday', (select coalesce(sum(total_amount), 0) from public.bills
                         where payment_status = 'Paid' and public.parse_dmy(payment_date) = today),
      'collectedMonth', (select coalesce(sum(total_amount), 0) from public.bills
                         where payment_status = 'Paid' and public.parse_dmy(payment_date) >= date_trunc('month', today)::date),
      'paidOutToday', (select coalesce(sum(amount), 0) from public.payments where paid_on = today),
      'paidOutMonth', (select coalesce(sum(amount), 0) from public.payments where paid_on >= date_trunc('month', today)::date)));
  end if;

  -- Fees the hospital owes (the roles that settle them).
  if public.has_role(array['Super Admin', 'Admin', 'Accounts']) then
    result := result || (select jsonb_build_object('feesOwed', jsonb_build_object(
      'doctorAmount', coalesce(sum(doctor_fee) filter (where doctor_fee_status = 'Pending' and attending_doctor_id is not null), 0),
      'doctorCases', count(*) filter (where doctor_fee is not null and doctor_fee_status = 'Pending' and attending_doctor_id is not null),
      'referralAmount', coalesce(sum(referral_fee) filter (where referral_fee_status = 'Pending' and referred_doctor_id is not null), 0),
      'referralCases', count(*) filter (where referred_doctor_id is not null and referral_fee_status = 'Pending')))
      from public.patients);
  end if;

  -- A doctor's own fees still to be paid.
  if public.has_role(array['Doctor']) then
    result := result || (select jsonb_build_object('myFees', jsonb_build_object(
      'pendingAmount', coalesce(sum(doctor_fee), 0), 'pendingCases', count(*)))
      from public.patients
      where attending_doctor_id = me and doctor_fee is not null and doctor_fee_status = 'Pending');
  end if;

  -- Stock needing a refill (the Inventory roles).
  if public.has_role(array['Super Admin', 'Admin', 'Doctor', 'Nurse', 'Accounts']) then
    result := result || (with items as (
        select m.id, m.reorder_level, coalesce(sum(s.quantity), 0) as on_hand
        from public.medications m left join public.stock_movements s on s.medication_id = m.id group by m.id
        union all
        select m.id, m.reorder_level, coalesce(sum(s.quantity), 0)
        from public.materials m left join public.stock_movements s on s.material_id = m.id group by m.id
      )
      select jsonb_build_object('stock', jsonb_build_object(
        'outOfStock', count(*) filter (where on_hand <= 0 and (reorder_level is not null or exists (
                          select 1 from public.stock_movements x where x.medication_id = items.id or x.material_id = items.id))),
        'low', count(*) filter (where on_hand > 0 and reorder_level is not null and on_hand <= reorder_level)))
      from items);
  end if;

  return result;
end
$$;

-- Anyone signed in can choose the language the app shows them.
create or replace function public.set_my_language(lang text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if lang not in ('en', 'te') then
    raise exception 'Unsupported language: %', lang;
  end if;
  update public.staff set preferred_language = lang where id = public.current_staff_id();
end
$$;

-- Salaries, for the roles that open Staff Management (PAGE_ROLES.staff).
create or replace function public.staff_salaries()
returns table (id bigint, salary numeric)
language sql stable security definer set search_path = public as $$
  select s.id, s.salary from public.staff s
  where public.has_role(array['Super Admin', 'Admin', 'Doctor'])
$$;

revoke all on function public.clock_in(text) from public;
revoke all on function public.clock_out(text) from public;
revoke all on function public.financial_summary(text, date, date) from public;
grant execute on function public.clock_in(text) to authenticated;
grant execute on function public.clock_out(text) to authenticated;
grant execute on function public.financial_summary(text, date, date) to authenticated;
revoke all on function public.inventory_summary(date, date) from public;
grant execute on function public.inventory_summary(date, date) to authenticated;
revoke all on function public.home_summary(text) from public;
grant execute on function public.home_summary(text) to authenticated;
revoke all on function public.set_my_language(text) from public;
grant execute on function public.set_my_language(text) to authenticated;
revoke all on function public.staff_salaries() from public;
grant execute on function public.staff_salaries() to authenticated;

-- -----------------------------------------------------------------------------
-- Row level security
-- -----------------------------------------------------------------------------

do $$
declare t text;
begin
  foreach t in array array[
    'staff', 'referring_doctors', 'medical_test_catalog', 'medications', 'materials', 'vendors',
    'treatment_templates', 'payment_methods', 'hospital_profile', 'departments', 'department_staff',
    'patients', 'care_notes', 'patient_tests', 'bills', 'payments', 'staff_shifts', 'staff_attendance', 'audit_log',
    'payment_transactions', 'stock_movements'
  ] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end
$$;

-- Staff: everyone signed in sees the roster (names on notes, assignments), but not salaries:
-- those come from staff_salaries() for the roles that manage staff. Creating and changing
-- staff goes through /api/staff (role-checked, service key), so no write policies.
revoke select on public.staff from anon, authenticated;
grant select (id, auth_user_id, name, phone_number, email, role, hire_date, active, preferred_language, created_at)
  on public.staff to authenticated;
drop policy if exists staff_select on public.staff;
create policy staff_select on public.staff for select to authenticated
  using ((select public.is_active_staff()));

-- Clinical and reference tables: any active staff reads and writes, Super Admin deletes.
do $$
declare t text;
begin
  foreach t in array array[
    'referring_doctors', 'medical_test_catalog', 'medications', 'materials', 'vendors',
    'treatment_templates', 'patients', 'care_notes', 'patient_tests'
  ] loop
    execute format('drop policy if exists %1$s_select on public.%1$s', t);
    execute format('drop policy if exists %1$s_insert on public.%1$s', t);
    execute format('drop policy if exists %1$s_update on public.%1$s', t);
    execute format('drop policy if exists %1$s_delete on public.%1$s', t);
    execute format('create policy %1$s_select on public.%1$s for select to authenticated using ((select public.is_active_staff()))', t);
    execute format('create policy %1$s_insert on public.%1$s for insert to authenticated with check ((select public.is_active_staff()))', t);
    execute format('create policy %1$s_update on public.%1$s for update to authenticated using ((select public.is_active_staff())) with check ((select public.is_active_staff()))', t);
    execute format('create policy %1$s_delete on public.%1$s for delete to authenticated using ((select public.has_role(array[''Super Admin''])))', t);
  end loop;
end
$$;

-- Bills: any staff member may delete a bill that is still unpaid; others only the Super Admin.
drop policy if exists bills_select on public.bills;
drop policy if exists bills_insert on public.bills;
drop policy if exists bills_update on public.bills;
drop policy if exists bills_delete on public.bills;
create policy bills_select on public.bills for select to authenticated using ((select public.is_active_staff()));
create policy bills_insert on public.bills for insert to authenticated with check ((select public.is_active_staff()));
create policy bills_update on public.bills for update to authenticated
  using ((select public.is_active_staff())) with check ((select public.is_active_staff()));
create policy bills_delete on public.bills for delete to authenticated
  using ((select public.has_role(array['Super Admin'])) or ((select public.is_active_staff()) and payment_status = 'Unpaid'));

-- Payments (expenses, salaries, fees): the roles that can open the Payments screen
-- (PAGE_ROLES.payments in src/config/permissions.ts).
drop policy if exists payments_select on public.payments;
drop policy if exists payments_insert on public.payments;
drop policy if exists payments_update on public.payments;
drop policy if exists payments_delete on public.payments;
create policy payments_select on public.payments for select to authenticated
  using ((select public.has_role(array['Super Admin', 'Admin', 'Doctor', 'Accounts'])));
create policy payments_insert on public.payments for insert to authenticated
  with check ((select public.has_role(array['Super Admin', 'Admin', 'Doctor', 'Accounts'])));
create policy payments_update on public.payments for update to authenticated
  using ((select public.has_role(array['Super Admin', 'Admin', 'Doctor', 'Accounts'])))
  with check ((select public.has_role(array['Super Admin', 'Admin', 'Doctor', 'Accounts'])));
create policy payments_delete on public.payments for delete to authenticated
  using ((select public.has_role(array['Super Admin'])));

-- Departments and their teams: everyone reads (to assign patients); Super Admin and Admin manage.
drop policy if exists departments_select on public.departments;
drop policy if exists departments_write on public.departments;
drop policy if exists department_staff_select on public.department_staff;
drop policy if exists department_staff_write on public.department_staff;
create policy departments_select on public.departments for select to authenticated
  using ((select public.is_active_staff()));
create policy departments_write on public.departments for all to authenticated
  using ((select public.has_role(array['Super Admin', 'Admin'])))
  with check ((select public.has_role(array['Super Admin', 'Admin'])));
create policy department_staff_select on public.department_staff for select to authenticated
  using ((select public.is_active_staff()));
create policy department_staff_write on public.department_staff for all to authenticated
  using ((select public.has_role(array['Super Admin', 'Admin'])))
  with check ((select public.has_role(array['Super Admin', 'Admin'])));

-- Payment methods: everyone reads; only the Super Admin manages them.
drop policy if exists payment_methods_select on public.payment_methods;
drop policy if exists payment_methods_write on public.payment_methods;
create policy payment_methods_select on public.payment_methods for select to authenticated
  using ((select public.is_active_staff()));
create policy payment_methods_write on public.payment_methods for all to authenticated
  using ((select public.has_role(array['Super Admin'])))
  with check ((select public.has_role(array['Super Admin'])));

-- Hospital profile: anyone may read it (the login page shows it); only the Super Admin edits.
drop policy if exists hospital_profile_select on public.hospital_profile;
drop policy if exists hospital_profile_update on public.hospital_profile;
create policy hospital_profile_select on public.hospital_profile for select to anon, authenticated
  using (true);
create policy hospital_profile_update on public.hospital_profile for update to authenticated
  using ((select public.has_role(array['Super Admin'])))
  with check ((select public.has_role(array['Super Admin'])));
grant select on public.hospital_profile to anon, authenticated;
grant update on public.hospital_profile to authenticated;

-- Duty roster: everyone reads; Super Admin and Admin plan it.
drop policy if exists staff_shifts_select on public.staff_shifts;
drop policy if exists staff_shifts_write on public.staff_shifts;
create policy staff_shifts_select on public.staff_shifts for select to authenticated
  using ((select public.is_active_staff()));
create policy staff_shifts_write on public.staff_shifts for all to authenticated
  using ((select public.has_role(array['Super Admin', 'Admin'])))
  with check ((select public.has_role(array['Super Admin', 'Admin'])));

-- Attendance: everyone sees their own; Super Admin, Admin and Accounts (salaries) see all;
-- Super Admin and Admin correct entries. Clocking in/out goes through clock_in()/clock_out().
drop policy if exists staff_attendance_select on public.staff_attendance;
drop policy if exists staff_attendance_write on public.staff_attendance;
create policy staff_attendance_select on public.staff_attendance for select to authenticated
  using (staff_id = (select public.current_staff_id()) or (select public.has_role(array['Super Admin', 'Admin', 'Accounts'])));
create policy staff_attendance_write on public.staff_attendance for all to authenticated
  using ((select public.has_role(array['Super Admin', 'Admin'])))
  with check ((select public.has_role(array['Super Admin', 'Admin'])));

-- Audit log: append-only (no update or delete policies).
drop policy if exists audit_log_select on public.audit_log;
drop policy if exists audit_log_insert on public.audit_log;
create policy audit_log_select on public.audit_log for select to authenticated
  using ((select public.is_active_staff()));
create policy audit_log_insert on public.audit_log for insert to authenticated
  with check ((select public.is_active_staff()));

-- Online payment records: staff can see them; only the server writes them (no write policies).
drop policy if exists payment_transactions_select on public.payment_transactions;
create policy payment_transactions_select on public.payment_transactions for select to authenticated
  using ((select public.is_active_staff()));

-- Inventory: everyone reads stock; the roles that run the pharmacy and stores add entries
-- (PAGE_ROLES.inventory in src/config/permissions.ts). Bill and payment rows are written by
-- their triggers only. Entries are never edited; Super Admin and Admin may delete a mistaken
-- manual entry (or record a correcting one).
drop policy if exists stock_movements_select on public.stock_movements;
drop policy if exists stock_movements_insert on public.stock_movements;
drop policy if exists stock_movements_delete on public.stock_movements;
create policy stock_movements_select on public.stock_movements for select to authenticated
  using ((select public.is_active_staff()));
create policy stock_movements_insert on public.stock_movements for insert to authenticated
  with check (source_type is null
              and reason in ('received', 'opening', 'used', 'expired', 'adjustment')
              and (select public.has_role(array['Super Admin', 'Admin', 'Doctor', 'Nurse', 'Accounts'])));
create policy stock_movements_delete on public.stock_movements for delete to authenticated
  using (source_type is null and (select public.has_role(array['Super Admin', 'Admin'])));

-- -----------------------------------------------------------------------------
-- File storage
-- -----------------------------------------------------------------------------

-- Private: ID cards, patient photos and attachments (shown through short-lived signed links).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('patient-files', 'patient-files', false, 1048576, array['image/jpeg', 'image/webp'])
on conflict (id) do nothing;

drop policy if exists patient_files_select on storage.objects;
drop policy if exists patient_files_insert on storage.objects;
drop policy if exists patient_files_delete on storage.objects;
create policy patient_files_select on storage.objects for select to authenticated
  using (bucket_id = 'patient-files' and (select public.is_active_staff()));
create policy patient_files_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'patient-files' and (select public.is_active_staff()));
create policy patient_files_delete on storage.objects for delete to authenticated
  using (bucket_id = 'patient-files' and (select public.has_role(array['Super Admin', 'Admin'])));

-- Public: the hospital's logo and app icons (PNG; the app converts uploads).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('branding', 'branding', true, 1048576, array['image/png'])
on conflict (id) do update set public = true, file_size_limit = 1048576, allowed_mime_types = array['image/png'];

drop policy if exists branding_insert on storage.objects;
drop policy if exists branding_update on storage.objects;
drop policy if exists branding_delete on storage.objects;
create policy branding_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'branding' and (select public.has_role(array['Super Admin'])));
create policy branding_update on storage.objects for update to authenticated
  using (bucket_id = 'branding' and (select public.has_role(array['Super Admin'])));
create policy branding_delete on storage.objects for delete to authenticated
  using (bucket_id = 'branding' and (select public.has_role(array['Super Admin'])));

-- -----------------------------------------------------------------------------
-- Starting data
-- -----------------------------------------------------------------------------

insert into public.hospital_profile (id) values (1) on conflict (id) do nothing;

insert into public.payment_methods (name, used_for, sort_order) values
  ('Cash', 'Both', 10),
  ('UPI', 'Both', 20),
  ('Online/Card', 'Bills', 30),
  ('Card', 'Payments', 35),
  ('Bank Transfer', 'Payments', 40),
  ('Cheque', 'Payments', 50),
  ('Arogyasree', 'Bills', 60),
  ('Insurance', 'Bills', 70),
  ('Other', 'Both', 90)
on conflict (name) do nothing;

-- Any other method already used on a bill or payment is kept as an option too.
insert into public.payment_methods (name, used_for, sort_order)
select method, 'Both', 95 from (
  select distinct trim(payment_method) as method from public.bills
  union
  select distinct trim(payment_method) from public.payments
) used
where method <> ''
on conflict (name) do nothing;

-- Inventory: the first time this runs, build the stock entries for the pharmacy bills and
-- purchase payments recorded before inventory existed.
do $$
begin
  if not exists (select 1 from public.stock_movements where source_type is not null) then
    perform set_config('seva.stock_resync', 'on', true);
    update public.bills set items = items where bill_type = 'Pharmacy';
    update public.payments set payment_type = payment_type where payment_type in ('Pharmacy', 'Material');
    perform set_config('seva.stock_resync', '', true);
  end if;
end
$$;

-- Tell the API to pick up the changes straight away.
notify pgrst, 'reload schema';
