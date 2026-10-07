# Seva

Hospital and patient care management (formerly CardioCare): registration with ID card scanning, care notes,
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
2. **Create the schema**: open *SQL Editor* and run each file in `supabase/migrations`, in
   order (paste the contents, click *Run*):
   1. `20261007000000_init.sql` (tables, security rules, photo storage)
   2. `20261007120000_upgrade_previous_schema.sql` (only changes anything on a database set up
      with the earlier version; fixes "Could not find the 'id_card_images' column")
   3. `20261008000000_departments.sql` (departments, care teams, doctor fees)
   4. `20261009000000_referral_fees.sql` (referral fees)
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
   - Optional: load sample data to try the app out (see below).
5. **Environment variables**: copy `.env.example` to `.env` (or set them in your host / Replit
   Secrets) and fill in the values from *Project Settings → API*.
   `SUPABASE_SERVICE_ROLE_KEY` and `GOOGLE_GENAI_API_KEY` are server-only secrets.

## Departments, care teams and doctor fees

- **Organization Setup → Departments** (Super Admin, Admin): create departments such as
  Cardiology or Orthopaedics, choose their doctors and nurses, and set a default doctor fee
  per case.
- **Patient page → Department & Care Team**: pick the department, then the attending doctor
  and nurse from it. The department's default fee is suggested; only Super Admin, Admin or
  Accounts can set or change it (the database enforces this).
- **Payments → Record New Payment → Doctor Fee** (Super Admin, Admin, Accounts): choose a
  doctor, tick the unpaid cases, and the amount is filled in. The cases are then marked paid.
- **Referral fees**: give each referring doctor a default referral fee (Referring Doctors).
  The patient page shows the referral fee for that patient (finance roles can change it), and
  **Payments → Referral/CC** lists the doctor's unpaid referrals, totals their fees and marks
  them paid.
- The Patient Dashboard filters by department or "My Patients", and the Financial Dashboard
  lists paid and pending doctor fees and referral fees.

## Sample data for testing

Log in as the Super Admin and open **Sample Data** in the menu (under Organization Setup).

- **Load Sample Data** adds about six months of activity: 30 patients with care notes and
  tests, bills, salary/supply/electricity payments, 6 sample staff (2 doctors, 2 nurses, a
  receptionist and an accountant), referring doctors, medications, materials, vendors and a
  test catalog. It only runs while the database has no patients.
- **Remove Sample Data** deletes everything it added and leaves records your staff entered.
- Sample staff can't log in. To see what another role sees, invite yourself on a second email
  address from Staff Management.

## Using it on phones and tablets

The app works in any browser and can be installed like an app:
- **Android (Chrome):** menu ⋮ → *Add to Home screen* / *Install app*.
- **iPhone/iPad (Safari):** Share → *Add to Home Screen*.

It then opens full screen with its own icon. It needs an internet connection; without one it
shows a "You're offline" page (no patient data is stored on the device).

## Running

```bash
npm install
npm run build && npm start   # fast, for everyday use: http://localhost:5000
npm run dev                  # while changing the code (slower, reloads on edits)
npm run typecheck
```

`src/lib/data` holds all database access, `src/lib/storage.ts` handles image upload and
download, and `src/lib/images.ts` does the compression.
