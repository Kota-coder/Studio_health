-- Real date columns for filtering payments and bills by date. Their dates are stored as
-- dd/MM/yyyy text, which the database can't compare as a range; paid_on / billed_on are
-- worked out from that text automatically (falling back to the day the record was created)
-- and indexed. Run after 20261012000000_dashboard_summary.sql. Safe to run again.

-- dd/MM/yyyy text -> date; null when the text isn't a valid date in that format.
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

alter table public.payments
  add column if not exists paid_on date
  generated always as (coalesce(public.parse_dmy(payment_date), (created_at at time zone 'Asia/Kolkata')::date)) stored;
alter table public.bills
  add column if not exists billed_on date
  generated always as (coalesce(public.parse_dmy(bill_date), (created_at at time zone 'Asia/Kolkata')::date)) stored;

create index if not exists payments_paid_on_idx on public.payments (paid_on);
create index if not exists bills_billed_on_idx on public.bills (billed_on);

notify pgrst, 'reload schema';
