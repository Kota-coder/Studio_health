# CardioCare

Patient management for a cardiology clinic: registration with ID card scanning, care notes,
tests, billing, clinic payments, financial dashboard and staff management. Works in a desktop
browser and on phones (it can be added to the home screen like an app).

Data is stored in **Supabase** (Postgres, Auth and Storage), so records are shared across
devices, protected by login and backed up.

- **Records** live in Postgres tables (`supabase/migrations`). Row level security means only
  signed-in, active staff can read or write. Deletes need a Super Admin (unpaid bills
  excepted), and payments are limited to Super Admin, Admin, Doctor and Accounts.
- **Images** (ID cards, patient photos, attachments) are shrunk in the browser to about
  1200px / JPEG quality 70 (roughly 100–150 KB) and stored in the private `patient-files`
  bucket. They are shown through signed links that expire after an hour.
- **Staff login** uses Supabase Auth (email + password). Admins add staff in the app; each
  new staff member gets an email invite to set their password. There is no self sign-up.
- **Audit trail**: patient, bill, payment and staff changes are written to an append-only
  `audit_log`. The database records who made each change.
- **Who can open what** is set in `src/config/permissions.ts` (menu and pages use the same list).

## India compliance (DPDP Act 2023, UIDAI)

- **Consent**: a patient can't be registered until staff tick the consent box. The time,
  consent text version and recording staff member are saved with the patient.
- **Aadhaar**: only the last four digits are stored (`XXXX XXXX 1234`). Aadhaar card images
  are used for extraction and then discarded, never uploaded or downloadable.
- **Data location**: create the Supabase project in `ap-south-1` (Mumbai).
- **Patient data export / erasure** is built but switched off
  (`PATIENT_DATA_REQUESTS_ENABLED` in `src/config/features.ts`).

## Supabase setup (one time)

1. **Create a project** at supabase.com in region **South Asia (Mumbai)**. The Pro plan
   (about $25/month) is recommended for daily backups and no pausing.
2. **Create the schema**: open *SQL Editor*, paste the contents of
   `supabase/migrations/20261007000000_init.sql` and run it.
3. **Auth settings** (*Authentication*):
   - *Sign In / Providers*: keep Email enabled and **turn off "Allow new users to sign up"**.
   - *URL Configuration*: set *Site URL* to your app's address (e.g. `https://clinic.example.com`)
     and add `https://clinic.example.com/**` (and `http://localhost:5000/**` for testing on
     your computer) to *Redirect URLs*.
   - *Emails → Templates* (recommended): point the links at the app's confirm route.
     - **Invite user**:
       `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite&next=/set-password`
     - **Reset password**:
       `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/set-password`
     The default templates also work; they land on the login page, which forwards to
     *Set password*.
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
   - Log in with that account and add everyone else from *Staff Management*.
   - Optional: *Sample Data* in the menu (Super Admin only) loads demo patients, bills and
     catalogs into an empty database for trying the app out.
5. **Environment variables**: copy `.env.example` to `.env` (or set them in your host / Replit
   Secrets) and fill in the values from *Project Settings → API*.
   `SUPABASE_SERVICE_ROLE_KEY` and `GOOGLE_GENAI_API_KEY` are server-only secrets.

## Running

```bash
npm install
npm run build && npm start   # fast, for everyday use: http://localhost:5000
npm run dev                  # while changing the code (slower, reloads on edits)
npm run typecheck
```

`src/lib/data` holds all database access, `src/lib/storage.ts` handles image upload and
download, and `src/lib/images.ts` does the compression.
