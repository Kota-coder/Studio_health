# Studio Health Cardio Care App

Patient management for a cardiology clinic: intake with ID card scanning, care notes,
tests, billing, clinic expenses and staff management.

Data is stored in **Supabase** (Postgres, Auth and Storage), hosted in the Mumbai region
for Indian patient data.

- **Records** live in Postgres tables (`supabase/migrations`). Row level security means
  only signed-in, active staff can read or write. Deletes need a Super Admin (unpaid
  bills excepted), and payments/expenses are limited to Super Admin, Admin and Doctor.
- **Images** (ID cards, patient photos, attachments) are shrunk in the browser to about
  1200px / JPEG quality 70 (roughly 100–150 KB). They go to the private `patient-files`
  bucket and are shown through signed links that expire after an hour.
- **Staff login** uses Supabase Auth (email + password). Admins add staff in the app;
  each new staff member gets an email invite to set their password.
- **Audit trail**: patient, bill, payment and staff changes are written to an
  append-only `audit_log`. The database records who made each change.

## India compliance (DPDP Act 2023, UIDAI)

- **Consent**: a patient can't be registered until staff tick the consent box. The
  time, consent text version and recording staff member are saved with the patient.
- **Aadhaar**: only the last four digits are stored (`XXXX XXXX 1234`). Aadhaar card
  images are used for extraction and then discarded, never uploaded or downloadable.
- **Data location**: create the Supabase project in `ap-south-1` (Mumbai).

Still to do before going live: a way for patients to export or delete their data
on request, and a written breach-response process.

## Supabase setup (one time)

1. **Create a project** at supabase.com in region **South Asia (Mumbai)**. The Pro plan
   (about $25/month) is recommended for daily backups and no pausing.
2. **Create the schema**: open *SQL Editor*, paste the contents of
   `supabase/migrations/20261007000000_init.sql` and run it. (Or, with the Supabase CLI:
   `supabase link` then `supabase db push`.)
3. **Auth settings** (*Authentication*):
   - *Sign In / Providers*: keep Email enabled and **turn off "Allow new users to sign
     up"**, since staff are invited by admins.
   - *URL Configuration*: set *Site URL* to your app's URL (e.g. `https://clinic.example.com`),
     and add `https://clinic.example.com/**` (and `http://localhost:9002/**` for
     development) to *Redirect URLs*.
   - *Emails → Templates*: point the links at the app's confirm route.
     - **Invite user**:
       `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite&next=/set-password`
     - **Reset password**:
       `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/set-password`
   - Supabase's built-in email sender is rate-limited. Set up custom SMTP
     (*Authentication → SMTP*) before inviting many staff.
4. **Create the first Super Admin**:
   - *Authentication → Users → Add user → Create new user*: enter their email and a
     password, and tick *Auto Confirm User*.
   - Then in the SQL Editor:
     ```sql
     insert into public.staff (auth_user_id, name, email, phone_number, role)
     select id, 'Your Name', email, '9999999999', 'Super Admin'
     from auth.users where email = 'you@example.com';
     ```
   - Log in with that account. Add everyone else from *Staff Management*.
5. **Environment variables**: copy `.env.example` to `.env.local` (or set them in your
   host) and fill in the values from *Project Settings → API*.
   `SUPABASE_SERVICE_ROLE_KEY` and `GOOGLE_GENAI_API_KEY` are server-only secrets.

## Development

```bash
npm install
npm run dev        # http://localhost:9002
npm run typecheck
npm run build
```

`src/lib/data` holds all database access, `src/lib/storage.ts` handles image
upload and download, and `src/lib/images.ts` does the compression.
