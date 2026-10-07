-- The hospital's own name, logo, colour and contact details. Each hospital runs its own
-- copy of Seva (its own Supabase project and web address), so this is a single row.
-- Shown on the login page, header, browser tab, installed-app icon and printouts.
-- Run after 20261014000000_payment_methods.sql. Safe to run again.

create table if not exists public.hospital_profile (
  id                  smallint primary key default 1,
  name                text not null default 'Seva',
  short_name          text,             -- shown in the header and under the app icon
  tagline             text,
  address             text,
  phone               text,
  email               text,
  website             text,
  registration_number text,             -- e.g. clinical establishment registration, for printouts
  brand_color         text not null default '#2563eb',
  -- Folder in the public "branding" bucket holding logo.png and the app icons; a new folder
  -- is used for every change so browsers and the CDN never show an old logo.
  logo_folder         text,
  configured_at       timestamptz,      -- set the first time the Super Admin saves the profile
  updated_at          timestamptz not null default now(),
  constraint hospital_profile_single_row check (id = 1),
  constraint hospital_profile_name_check check (length(trim(name)) > 0),
  constraint hospital_profile_color_check check (brand_color ~ '^#[0-9a-fA-F]{6}$')
);

insert into public.hospital_profile (id) values (1) on conflict (id) do nothing;

-- Anyone may read it (the login page shows it before sign-in); only the Super Admin edits it.
alter table public.hospital_profile enable row level security;
drop policy if exists hospital_profile_select on public.hospital_profile;
drop policy if exists hospital_profile_update on public.hospital_profile;
create policy hospital_profile_select on public.hospital_profile for select to anon, authenticated
  using (true);
create policy hospital_profile_update on public.hospital_profile for update to authenticated
  using (public.has_role(array['Super Admin']))
  with check (public.has_role(array['Super Admin']));
grant select on public.hospital_profile to anon, authenticated;
grant update on public.hospital_profile to authenticated;

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

-- Public bucket for the logo and app icons (PNG only; the app converts uploads to PNG).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('branding', 'branding', true, 1048576, array['image/png'])
on conflict (id) do update set public = true, file_size_limit = 1048576, allowed_mime_types = array['image/png'];

drop policy if exists branding_insert on storage.objects;
drop policy if exists branding_update on storage.objects;
drop policy if exists branding_delete on storage.objects;
create policy branding_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'branding' and public.has_role(array['Super Admin']));
create policy branding_update on storage.objects for update to authenticated
  using (bucket_id = 'branding' and public.has_role(array['Super Admin']));
create policy branding_delete on storage.objects for delete to authenticated
  using (bucket_id = 'branding' and public.has_role(array['Super Admin']));

notify pgrst, 'reload schema';
