-- Managed payment methods, who processed each bill and payment, and Financial Dashboard
-- totals for a chosen period. Run after 20261013000000_date_columns.sql. Safe to run again.
--
--   * payment_methods: the choices offered for bills (money received) and payments (money
--     paid out). The Super Admin adds, renames, reorders and switches them off. Renaming
--     one updates the bills and payments that used the old name.
--   * bills.processed_by_staff_id / _name: who processed the bill. Payments already have
--     recorded_by_staff_id / _name for the same purpose.
--     Everyone is recorded as themselves; only the Super Admin can record or change it to
--     someone else. The name is always taken from the staff table.
--   * financial_summary(tz, from_date, to_date): the dashboard totals for a period, with
--     amounts by payment method.

-- ---------------------------------------------------------------------------
-- Payment methods
-- ---------------------------------------------------------------------------

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

alter table public.payment_methods enable row level security;
drop policy if exists payment_methods_select on public.payment_methods;
drop policy if exists payment_methods_write on public.payment_methods;
create policy payment_methods_select on public.payment_methods for select to authenticated
  using (public.is_active_staff());
create policy payment_methods_write on public.payment_methods for all to authenticated
  using (public.has_role(array['Super Admin']))
  with check (public.has_role(array['Super Admin']));

-- Renaming a method renames it on the bills and payments that used it.
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

-- ---------------------------------------------------------------------------
-- Who processed each bill and payment
-- ---------------------------------------------------------------------------

alter table public.bills
  add column if not exists processed_by_staff_id   bigint references public.staff (id) on delete set null,
  add column if not exists processed_by_staff_name text;
create index if not exists bills_processed_by_idx on public.bills (processed_by_staff_id);
create index if not exists payments_recorded_by_idx on public.payments (recorded_by_staff_id);
create index if not exists bills_payment_method_idx on public.bills (payment_method);
create index if not exists payments_payment_method_idx on public.payments (payment_method);

-- Existing bills: whoever created them, from the audit trail.
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

-- Shared check for both tables: staff are recorded as themselves unless a Super Admin
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

-- ---------------------------------------------------------------------------
-- Financial Dashboard totals for a period
-- ---------------------------------------------------------------------------

drop function if exists public.financial_summary(text);

-- from_date / to_date (inclusive) filter bills by billed_on and payments by paid_on; leave
-- them null for all time. The monthly series covers the period's months (at most 24), or
-- the last 6 months for all time. Doctor and referral fee tables are what is owed now, so
-- they are not limited by the period.
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
    -- Money received on bills (paid in full, or half of partly paid) by method.
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

revoke all on function public.financial_summary(text, date, date) from public;
grant execute on function public.financial_summary(text, date, date) to authenticated;

notify pgrst, 'reload schema';
