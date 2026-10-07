-- Referral fees as a percentage of what was billed. The hospital (not the patient)
-- pays the referring doctor; the fee can be a fixed amount or a percentage entered per
-- type of procedure billed. Run after 20261009000000_referral_fees.sql.
--
--   * referring_doctors.default_referral_percent: suggested % for this doctor.
--   * patients.referral_fee_basis: null for a fixed amount, or
--       {"mode": "percent", "lines": [{"key", "description", "billType", "amount", "percent", "fee"}]}
--     recording how referral_fee was worked out.

alter table public.referring_doctors
  add column if not exists default_referral_percent numeric(5, 2);

alter table public.referring_doctors drop constraint if exists referring_doctors_default_referral_percent_check;
alter table public.referring_doctors add constraint referring_doctors_default_referral_percent_check
  check (default_referral_percent is null or (default_referral_percent >= 0 and default_referral_percent <= 100));

alter table public.patients
  add column if not exists referral_fee_basis jsonb;

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

notify pgrst, 'reload schema';
