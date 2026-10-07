-- Upgrades a database created from the earlier CardioCare schema (the one from the
-- Supabase pull request: one image path per record, no Accounts role) to the current one.
--
-- Fixes errors like: Could not find the 'id_card_images' column of 'patients' in the schema cache
--
-- Safe to run more than once. On a database created from the current
-- 20261007000000_init.sql it changes nothing.

-- Image lists (several photos/attachments per record).
alter table public.patients   add column if not exists id_card_images                  text[] not null default '{}';
alter table public.patients   add column if not exists patient_photos                  text[] not null default '{}';
alter table public.patients   add column if not exists initial_observation_attachments text[] not null default '{}';
alter table public.care_notes add column if not exists attachments                     text[] not null default '{}';
alter table public.patient_tests add column if not exists attachments                  text[] not null default '{}';
alter table public.bills      add column if not exists attachments                     text[] not null default '{}';

-- Move any images saved in the old single-path columns into the new lists, then drop
-- the old columns.
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

-- Accounts role.
alter table public.staff drop constraint if exists staff_role_check;
alter table public.staff add constraint staff_role_check
  check (role in ('Super Admin', 'Admin', 'Doctor', 'Nurse', 'Receptionist', 'Accounts'));

-- Accounts staff can work with payments, like the Payments screen allows.
drop policy if exists payments_select on public.payments;
drop policy if exists payments_insert on public.payments;
drop policy if exists payments_update on public.payments;
create policy payments_select on public.payments for select to authenticated
  using (public.has_role(array['Super Admin', 'Admin', 'Doctor', 'Accounts']));
create policy payments_insert on public.payments for insert to authenticated
  with check (public.has_role(array['Super Admin', 'Admin', 'Doctor', 'Accounts']));
create policy payments_update on public.payments for update to authenticated
  using (public.has_role(array['Super Admin', 'Admin', 'Doctor', 'Accounts']))
  with check (public.has_role(array['Super Admin', 'Admin', 'Doctor', 'Accounts']));

-- Tell the API to pick up the new columns straight away.
notify pgrst, 'reload schema';
