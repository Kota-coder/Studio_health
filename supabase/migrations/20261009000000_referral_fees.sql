-- Referral fees: what the clinic owes a referring doctor for each patient they referred.
-- Run after 20261008000000_departments.sql.
--
--   * referring_doctors.default_referral_fee: suggested fee per referred patient.
--   * patients.referral_fee / referral_fee_status / referral_fee_payment_id: the fee for
--     this patient's referral and whether a Referral/CC payment has settled it.

alter table public.referring_doctors
  add column if not exists default_referral_fee numeric(12, 2);

alter table public.patients
  add column if not exists referral_fee            numeric(12, 2),
  add column if not exists referral_fee_status     text not null default 'Pending',
  add column if not exists referral_fee_payment_id text references public.payments (id) on delete set null;

alter table public.patients drop constraint if exists patients_referral_fee_status_check;
alter table public.patients add constraint patients_referral_fee_status_check
  check (referral_fee_status in ('Pending', 'Paid'));

-- Only finance roles may set or settle doctor and referral fees (extends the guards
-- from the departments migration).
create or replace function public.guard_doctor_fee() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.role() is distinct from 'service_role'
     and (new.doctor_fee is distinct from old.doctor_fee
          or new.doctor_fee_status is distinct from old.doctor_fee_status
          or new.doctor_fee_payment_id is distinct from old.doctor_fee_payment_id
          or new.referral_fee is distinct from old.referral_fee
          or new.referral_fee_status is distinct from old.referral_fee_status
          or new.referral_fee_payment_id is distinct from old.referral_fee_payment_id)
     and not public.has_role(array['Super Admin', 'Admin', 'Accounts']) then
    raise exception 'Only Super Admin, Admin or Accounts staff can change doctor or referral fees.';
  end if;
  return new;
end
$$;

create or replace function public.guard_doctor_fee_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.role() is distinct from 'service_role'
     and (new.doctor_fee is not null or new.doctor_fee_status = 'Paid' or new.doctor_fee_payment_id is not null
          or new.referral_fee is not null or new.referral_fee_status = 'Paid' or new.referral_fee_payment_id is not null)
     and not public.has_role(array['Super Admin', 'Admin', 'Accounts']) then
    raise exception 'Only Super Admin, Admin or Accounts staff can set doctor or referral fees.';
  end if;
  return new;
end
$$;

notify pgrst, 'reload schema';
