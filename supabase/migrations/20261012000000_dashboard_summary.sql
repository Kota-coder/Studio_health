-- Financial dashboard totals worked out in the database, so the app downloads one small
-- summary instead of every bill, payment and patient. Run after 20261011000000_staff_duty.sql.
-- Safe to run again.
--
-- SECURITY INVOKER: row level security still applies, so a caller only gets totals over
-- the rows they are allowed to read (payments are limited to finance roles).

create or replace function public.financial_summary(tz text default 'Asia/Kolkata')
returns jsonb
language sql stable security invoker set search_path = public as $$
  with
  months as (
    select generate_series(
      date_trunc('month', now() at time zone tz) - interval '5 months',
      date_trunc('month', now() at time zone tz),
      interval '1 month') as month
  ),
  bill_months as (
    select date_trunc('month', created_at at time zone tz) as month,
           sum(total_amount) as billed,
           sum(case when payment_status = 'Paid' and coalesce(payment_date, '') <> '' then total_amount else 0 end) as collected
    from public.bills group by 1
  ),
  payment_months as (
    select date_trunc('month', created_at at time zone tz) as month, sum(amount) as spent
    from public.payments group by 1
  ),
  doctor_fees as (
    select p.attending_doctor_id as "doctorId",
           coalesce(s.name, 'Staff #' || p.attending_doctor_id) as doctor,
           coalesce(array_agg(distinct d.name) filter (where d.name is not null), '{}') as departments,
           count(*) as cases,
           coalesce(sum(p.doctor_fee) filter (where p.doctor_fee_status = 'Paid'), 0) as paid,
           coalesce(sum(p.doctor_fee) filter (where p.doctor_fee_status is distinct from 'Paid'), 0) as pending
    from public.patients p
    left join public.staff s on s.id = p.attending_doctor_id
    left join public.departments d on d.id = p.department_id
    where p.attending_doctor_id is not null and p.doctor_fee is not null
    group by p.attending_doctor_id, s.name
  ),
  -- Unpaid referrals without their own fee count at the doctor's default fixed fee.
  referral_fees as (
    select p.referred_doctor_id as "doctorId",
           coalesce(r.name, 'Referring doctor #' || p.referred_doctor_id) as doctor,
           count(*) as referrals,
           coalesce(sum(p.referral_fee) filter (where p.referral_fee_status = 'Paid'), 0) as paid,
           coalesce(sum(coalesce(p.referral_fee, r.default_referral_fee))
             filter (where p.referral_fee_status is distinct from 'Paid'), 0) as pending,
           count(*) filter (where p.referral_fee_status is distinct from 'Paid'
                              and coalesce(p.referral_fee, r.default_referral_fee) is null) as unpriced
    from public.patients p
    left join public.referring_doctors r on r.id = p.referred_doctor_id
    where p.referred_doctor_id is not null
    group by p.referred_doctor_id, r.name
  )
  select jsonb_build_object(
    'billCount', (select count(*) from public.bills),
    'paymentCount', (select count(*) from public.payments),
    'totalBilled', (select coalesce(sum(total_amount), 0) from public.bills),
    -- "Partially Paid" bills count as half collected (partial amounts aren't recorded).
    'totalCollected', (select coalesce(sum(case payment_status when 'Paid' then total_amount
                                                               when 'Partially Paid' then total_amount / 2
                                                               else 0 end), 0) from public.bills),
    'totalSpent', (select coalesce(sum(amount), 0) from public.payments),
    'billStatusCounts', (select coalesce(jsonb_object_agg(status, n), '{}') from
                           (select coalesce(nullif(payment_status, ''), 'Unknown') as status, count(*) as n from public.bills group by 1) x),
    'billTypeAmounts', (select coalesce(jsonb_object_agg(type, total), '{}') from
                          (select coalesce(nullif(bill_type, ''), 'Unknown') as type, sum(total_amount) as total from public.bills group by 1) x),
    'paymentTypeAmounts', (select coalesce(jsonb_object_agg(type, total), '{}') from
                             (select coalesce(nullif(payment_type, ''), 'Unknown') as type, sum(amount) as total from public.payments group by 1) x),
    'monthly', (select jsonb_agg(jsonb_build_object(
                  'month', to_char(m.month, 'YYYY-MM'),
                  'billed', coalesce(b.billed, 0),
                  'collected', coalesce(b.collected, 0),
                  'spent', coalesce(pm.spent, 0)) order by m.month)
                from months m
                left join bill_months b on b.month = m.month
                left join payment_months pm on pm.month = m.month),
    'doctorFees', (select coalesce(jsonb_agg(to_jsonb(f) order by f.pending desc, f.doctor), '[]') from doctor_fees f),
    'referralFees', (select coalesce(jsonb_agg(to_jsonb(f) order by f.pending desc, f.doctor), '[]') from referral_fees f)
  )
$$;

revoke all on function public.financial_summary(text) from public;
grant execute on function public.financial_summary(text) to authenticated;

notify pgrst, 'reload schema';
