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
   order (paste the contents, click *Run*). Files 2–8 are safe to run again, so when you
   update the app you can simply run them all again in order; never run file 1 a second time.
   1. `20261007000000_init.sql` (tables, security rules, photo storage)
   2. `20261007120000_upgrade_previous_schema.sql` (only changes anything on a database set up
      with the earlier version; fixes "Could not find the 'id_card_images' column")
   3. `20261008000000_departments.sql` (departments, care teams, doctor fees)
   4. `20261009000000_referral_fees.sql` (referral fees)
   5. `20261010000000_referral_percent.sql` (referral fees as a % of billed procedures)
   6. `20261011000000_staff_duty.sql` (duty roster and attendance)
   7. `20261012000000_dashboard_summary.sql` (Financial Dashboard totals worked out in the database)
   8. `20261013000000_date_columns.sql` (date filters on the Payments and Billing lists)
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
5. **Environment variables**: copy `.env.example` to `.env` (or set them in your hosting
   provider's settings) and fill in the values from *Project Settings → API*.
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
- **Referral fees** are paid by the hospital to the referring doctor; they are never added to
  the patient's bill. Give each referring doctor a default fixed fee and/or a default % (Referring
  Doctors). On the patient page, finance roles choose **Fixed amount** or **% of procedures**;
  with a percentage, every procedure type billed to the patient is listed with its own % box
  (prefilled from the doctor's default, pharmacy items at 0%) and the fee is the total.
  **Payments → Referral/CC** lists the doctor's unpaid referrals, totals their fees and marks
  them paid.
- **Treatment Summary** (button on the patient page): a printable summary for the patient of
  key procedures and tests, medications prescribed and dispensed, recent care notes and billing
  totals. Use *Print / Save as PDF* to hand it over.
- The Patient Dashboard filters by department or "My Patients", and the Financial Dashboard
  lists paid and pending doctor fees and referral fees.

## Duty roster and attendance

**Duty Roster & Attendance** in the menu (every role):

- **My Duty**: everyone clocks in when they start work and clocks out when they leave. The
  server's clock is used, so a phone with the wrong time can't change the record. It also shows
  your current or next shift.
- **Schedule**: a weekly roster of doctors, nurses and other staff, filterable by role and
  department. Super Admin and Admin add shifts with **+** (Morning, Evening, Night, Day, On Call
  or custom times, optionally repeated on other days that week), click a shift to change or
  remove it, and **Copy last week** to roll the roster forward. Overlapping shifts for the same
  person are refused. A shift whose end time is earlier than its start ends the next day. On a
  phone the roster shows one day at a time.
- **Who was on duty**: pick a date and time (or *Now*) to see who was on the roster and who was
  clocked in, flagging people on the roster who hadn't clocked in and people clocked in without
  a shift.
- **Attendance**: for a date range, hours planned vs worked per person, each shift's status
  (On time, Late, Left early, Absent, On duty) and every time record. Admins can add or correct
  entries for someone who forgot to clock in or out; these are marked *Manual* with the admin's
  name. Super Admin, Admin and Accounts see everyone; other staff see only their own.

## Keeping Supabase usage low

Supabase bills mainly for data transferred out (egress) and the database's size and compute,
not per request; the included quota is generous for one hospital. The app still keeps
downloads small so it stays fast and cheap as records pile up:

- **Totals in the database**: the Financial Dashboard calls `financial_summary()` and gets one
  small summary (about 2 KB) instead of every bill, payment and patient.
- **Date filters on growing lists**: Payments and Billing load only the chosen period (default:
  last 30 days; also this month, last month, last 3 months, this year, all time or custom
  dates). The database does the filtering on indexed date columns, and Billing's status filter
  too, so choose *All time* + *Unpaid* to find every outstanding bill. CSV downloads export the
  chosen period.
- **Only what a screen shows**: the Patient Dashboard loads each patient's name, condition,
  care team and *latest* note only; payment and bill screens load patient names only.
- **Short-lived cache in the open tab** (`src/lib/data/cache.ts`): staff, departments, referring
  doctors and catalogs are kept for 10 minutes, dashboards for 1 minute, so moving between pages
  doesn't download them again. Saving anything clears the related entries, so your own changes
  show straight away; other people's appear within a minute or with **Refresh** on the
  dashboards. Nothing is stored on the device.
- **Session checks without a network call**: page loads verify the login token locally
  (`getClaims`) when the project uses asymmetric JWT signing keys, the default for new
  projects. Older projects can switch under *Project Settings → JWT Keys*.

In a test session (log in, open the dashboards, a patient, the duty roster and payments), this
cut traffic from 50 requests / 666 KB plus 32 session checks to 25 requests / 85 KB plus 1.

## Sample data for testing

Log in as the Super Admin and open **Sample Data** in the menu (under Organization Setup).

- **Load Sample Data** adds about six months of activity:
  - 8 sample staff (3 doctors, 3 nurses, a receptionist and an accountant) in three
    departments (Cardiology, General Medicine, Orthopaedics)
  - 30 patients with care teams, care notes, tests, bills, and doctor fees (older ones paid,
    recent ones pending)
  - referring doctors on different terms (fixed fee, % of procedures, or none agreed), with
    older referrals paid and recent ones pending
  - salary, supply, electricity, doctor-fee and referral payments
  - a duty roster: three weeks of past shifts with clock-ins (including a few late arrivals,
    early departures and absences) and two weeks planned ahead
  - medications, materials, vendors and a test catalog

  It only runs while the database has no patients.
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
