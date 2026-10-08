# Seva

Hospital and patient care management: patient registration with ID-card scanning, care notes
and tests, departments and care teams, billing and payments, doctor and referral fees, a
financial dashboard, a duty roster with attendance, and staff management. It works in a desktop
browser and on phones, where it can be installed like an app.

Each hospital runs **its own copy**: its own Supabase project (database, logins, files) and its
own web address, all built from this repository. Nothing is shared between hospitals.

**Contents:** [Going live](#going-live-with-a-hospital) ·
[More hospitals and updates](#more-hospitals-and-updates) · [Features](#features) ·
[Online payments](#online-payment-providers-future) · [Performance and data use](#performance-and-data-use) ·
[Security and compliance](#security-and-compliance) · [Sample data](#sample-data) ·
[Development](#development)

## Going live with a hospital

About an hour. Expected cost at small volumes (around 10 new patients a day): about
**$45/month** for the first hospital (Supabase Pro $25, which includes the first database, plus
Vercel Pro about $20) and about **$10/month** for each further hospital. Check current prices.

1. **Supabase** (supabase.com): an organization on the **Pro** plan, and a project for the
   hospital in region **South Asia (Mumbai)**.
   - **Database:** open *SQL Editor*, paste the whole of
     `supabase/migrations/20261016000000_seva_schema.sql` (on GitHub: *Raw*, then Ctrl+A, Ctrl+C),
     make sure nothing is highlighted, and *Run*. It should say "Success". It is safe to run
     again, including after an attempt that stopped half way. (Or use `npm run migrate:hospitals`,
     below.)
   - **Authentication → Sign In / Providers:** keep Email on and **turn off "Allow new users to
     sign up"** (staff are invited from the app).
   - **Authentication → SMTP:** add an email service (e.g. Brevo or Resend); Supabase's built-in
     sender only allows a few emails an hour.
   - **Authentication → Emails → Templates** (recommended):
     - *Invite user:* `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite&next=/set-password`
     - *Reset password:* `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/set-password`
   - **Project Settings → JWT Keys:** use the asymmetric signing keys (the default for new
     projects), so page loads check logins without calling Supabase.
2. **The first Super Admin:** *Authentication → Users → Add user → Create new user* (tick
   *Auto Confirm User*), then in the SQL Editor:
   ```sql
   insert into public.staff (auth_user_id, name, email, phone_number, role)
   select id, 'Your Name', email, '9999999999', 'Super Admin'
   from auth.users where email = 'you@example.com';
   ```
3. **Vercel** (vercel.com, **Pro** plan): *Add New → Project*, import this repository (branch
   `main`), and add the environment variables from `.env.example`:

   | Variable | Where |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API |
   | `SUPABASE_SERVICE_ROLE_KEY` | same place; secret, server only |
   | `GOOGLE_GENAI_API_KEY` | aistudio.google.com/apikey (ID-card scanning); can be shared |

   Deploy, then add the hospital's web address under *Settings → Domains*. `vercel.json` already
   runs the app's server code in Mumbai (`bom1`), next to the database.
4. **Connect them:** Supabase *Authentication → URL Configuration*: *Site URL* = the web address,
   and add `https://<address>/**` to *Redirect URLs*.
5. **In the app**, as the Super Admin: **Setup → Hospital Profile** (name, logo,
   colour, contact details, and which menus to show), then check **Payment Methods** and **Departments**, and invite staff
   from **Staff Management**. Don't load sample data on a live hospital.

## More hospitals and updates

**Another hospital:** repeat *Going live* with a new Supabase project (same organization) and a
new Vercel project from the same repository with that hospital's keys and address. No code
changes.

**Updates:** merging to `main` redeploys every hospital's app automatically. When an update
changes the database it adds or updates a file in `supabase/migrations`; every file there is safe
to run again. Run them on every hospital at once:

```bash
cp hospitals.example.json hospitals.json   # once: each hospital's database URL (never commit it)
npm run migrate:hospitals -- --dry-run     # see what would run
npm run migrate:hospitals                  # run it
```

The database URL is under *Project Settings → Database → Connection string* (session pooler).
A hospital that fails (e.g. wrong password) is reported and the others still update.

## Features

The menu is grouped into **Patients**, **Money**, **Pharmacy & Stock**, **Staff** and **Setup**,
and shows each person only the screens their role may open (`src/config/permissions.ts`); the
database enforces the same rules with row level security.

- **Home dashboard by role:** "today at a glance" tiles show only what the person's role may see,
  worked out by the database (`home_summary()`, one ~1 KB call): patients in care and critical
  ones (doctors and nurses also see *their* patients, and start on "My Patients"), their duty and
  next shift, bills today and unpaid (billing roles), money in and out (finance roles), fees owed
  (Super Admin, Admin, Accounts), a doctor's own pending fees, and stock needing a refill.
- **English / తెలుగు:** the EN/తె switch in the header (also on the login page) changes the menu,
  page titles, main buttons, statuses and the dashboard tiles to Telugu; details stay in English.
  The choice is saved to the person's profile, so it follows them to any device. The Telugu text
  is only downloaded when Telugu is chosen, and the device's own Telugu font is used. Translations are in `src/lib/i18n/te/` (one file per
  area); have a Telugu-speaking colleague review them.

- **Patients:** registration (with consent capture and ID-card scanning), care notes with
  treatment templates, tests, attachments, conditions, and a printable **Treatment Summary** on
  the hospital's letterhead.
- **Departments and care teams** (Staff → Departments): each department's doctors
  and nurses and a default doctor fee per case. On a patient, choose the department, attending
  doctor and nurse; the dashboard filters by department or "My Patients".
- **Doctor fees:** set per case (Super Admin, Admin, Accounts) and paid through
  **Payments → Doctor Fee**.
- **Referral fees** (paid by the hospital, never billed to the patient): a fixed amount or a %
  per type of procedure billed, defaulting from the referring doctor; paid through
  **Payments → Referral/CC**.
- **Billing and payments:** filter by period, status/type, payment method and who processed it,
  with totals per method and CSV export. **Payment Methods** (Super Admin) are managed in
  Setup; renaming one renames it on existing records. Every bill and payment records
  who processed it; only the Super Admin can record or change it to someone else.
- **Printing bills:** every bill prints on the hospital's letterhead (Print / Save as PDF) with its
  items, total in words, payment method and who received it. Once paid it prints as a **Payment
  Receipt**; saving a bill as Paid opens the receipt straight away. Print buttons are on the bill,
  the Billing list and the patient's bills.
- **Pharmacy and Inventory:** the Pharmacy list (Pharmacy & Stock → Pharmacy) holds what the
  pharmacy sells; Materials holds consumables. **Inventory** shows the stock on hand of both, its
  value at average purchase cost, what came in and went out in any period, and a **Needs refill**
  list (items at or below their refill level, with a suggested order and its cost). Stock updates
  itself: a Pharmacy or Material purchase recorded under Payments adds stock, and a pharmacy bill
  takes it out (editing, cancelling or deleting either corrects it). Anything else is recorded on the
  Inventory page: items used on wards, expired or damaged stock, opening stock and stock counts.
  Each item's history shows every change and who made it. Pharmacy bills pick items from the list
  and show the stock while billing. Download the stock list as CSV for the accounts.
- **Financial Dashboard:** totals and charts for any period, money in and out by method, and the
  doctor and referral fees owed.
- **Duty Roster & Attendance:** clock in/out (server time), a weekly roster (Super Admin and
  Admin plan it; copy last week), "who was on duty" at any moment, and an attendance report
  (planned vs worked, late, absent) with manual corrections recorded.
- **Hospital Profile** (Super Admin): name, logo (upload, or design one from the initials),
  brand colour and contact details, used on the login page, header, browser tab, phone app icon
  and printouts, with a small "Powered by Seva".
- **Menus and features** (Hospital Profile → Menus, Super Admin): switch off what a hospital
  doesn't use: Billing, Payments, Doctor Fees, Referrals, Referral Fees, Financial Dashboard,
  Duty Roster, Departments, catalogs and more. A switched-off feature disappears everywhere, not
  just from the menu: e.g. Billing off removes the bills card and "Bill Test"/"Bill Meds" from the
  patient page and the billing totals from the Financial Dashboard; Doctor Fees off removes the
  fee from the care team, departments and payments. Features that depend on another switch off
  with it (fees need Payments; the Financial Dashboard needs Billing or Payments). No data is
  deleted. The list is in `src/config/modules.ts`; screens check it with `useFeatures()`.

## Online payment providers (future)

The app is ready for an online payment provider such as Razorpay, PhonePe or Cashfree, so bills
can be paid by UPI or card and marked Paid automatically. None is connected yet. To connect one
(`src/lib/payments/gateways.server.ts` explains it in detail):

1. Implement the `PaymentGateway` interface for the provider (create an order; check the
   signature on its webhook) and add it to `GATEWAYS`. Its keys go in environment variables.
2. In the provider's dashboard, set the webhook to
   `https://<address>/api/payment-gateways/<provider>/webhook`.
3. Add a "Pay online" button where bills are shown that calls
   `POST /api/payment-gateways/<provider>/orders` with the bill id and opens the provider's
   checkout with the reply. `GET /api/payment-gateways` lists the connected providers.

Each attempt is recorded in `payment_transactions`; when the provider confirms a payment, the
bill is marked Paid with the payment method and an audit entry. A **test provider** lets you try
the flow without an account: set `SEVA_TEST_GATEWAY_SECRET` in development only.

## Performance and data use

Supabase and Vercel bill mainly for data transferred and compute, not per request, and the
included amounts are generous for a hospital. The app still keeps traffic small:

- **Pages are static:** built once and served from Vercel's CDN, rebuilt when the hospital profile
  is saved (and otherwise once a day). Logins are checked locally from the session token
  (`getClaims`), not with a call to Supabase on each page.
- **No prefetching of unopened pages:** links fetch a page only when hovered or touched, just
  before the click (`src/components/app-link.tsx`), instead of every link on screen; patient pages
  are the only server-rendered pages, so this also avoids server calls on Vercel.
- **Lists that stay small as records grow:** the Patient Dashboard loads patients in care and those
  discharged in the last 30 days (older ones on request, or found by name); the bill form offers
  the same patients; the payment form lists only fee cases still to pay; Billing loads only the
  columns a row shows; Payments looks up only the patients it names.
- **Loaded when opened:** charts, the ID-card scanner, sample data, stock dialogs, a patient's
  audit trail and the patient page's catalogs (tests, templates, medicines).
- **No web fonts:** the device's own fonts (Telugu included); the header logo uses a 96 px copy.
- **Totals in the database:** the Financial Dashboard calls `financial_summary()` and receives a
  2 KB summary instead of every bill and payment.
- **Only what each screen shows:** the Patient Dashboard loads names, care teams and the latest
  note; lists load the chosen period only (Billing and Payments default to the last 30 days, with
  status, method and staff filters applied by the database on indexed columns).
- **In-tab cache** (`src/lib/data/cache.ts`, memory only): staff, departments and catalogs for 10
  minutes, dashboards for 1 minute, image links for 50 minutes so photos come from the browser's
  cache. Saving clears the related entries; dashboards have a Refresh button.
- **Database rules run once per query:** the row level security policies call their helper
  functions as `(select …)`, so Postgres evaluates them once instead of once per row.
- **Images** are shrunk in the browser to about 100–150 KB before upload.

## Security and compliance

- **Salaries** are readable only by the roles that manage staff (`staff_salaries()`); other
  staff can see colleagues' names and roles but not their pay.
- **Logins:** Supabase Auth (email and password). Staff are invited from the app; there is no
  public sign-up. Roles: Super Admin, Admin, Doctor, Nurse, Receptionist, Accounts.
- **Row level security** on every table: only signed-in, active staff can read or write; deletes
  need a Super Admin (unpaid bills excepted); payments, fees, attendance and settings are limited
  to the roles that manage them.
- **Files:** patient images are in a private bucket and shown through links that expire after an
  hour. Logos are in a public bucket that only the Super Admin can change.
- **Audit trail:** patient, bill, payment and staff changes go to an append-only `audit_log`; the
  database records who made each change.
- **DPDP Act 2023:** a patient can't be registered without consent; the time, consent text
  version and staff member are saved. Patient data export and erasure are built but off
  (`PATIENT_DATA_REQUESTS_ENABLED` in `src/config/features.ts`).
- **Aadhaar:** only the last four digits are stored (`XXXX XXXX 1234`); Aadhaar card images are
  used for extraction and then discarded.

## Sample data

For trying the app out (never on a live hospital): log in as the Super Admin and open
**Setup → Sample Data**. **Load Sample Data** adds about six months of activity:
8 staff in 3 departments, 30 patients with notes, tests, bills and fees, referring doctors on
fixed and percentage terms, payments, and a duty roster with clock-ins. It only loads into a
database with no patients. **Remove Sample Data** deletes all of it and nothing else. Sample
staff can't log in.

## Using it on phones and tablets

- **Android (Chrome):** menu ⋮ → *Add to Home screen* / *Install app*.
- **iPhone/iPad (Safari):** Share → *Add to Home Screen*.

It opens full screen with the hospital's icon. Without internet it shows a "You're offline" page;
no patient data is stored on the device.

## Development

```bash
npm install
cp .env.example .env.local   # your Supabase project's URL and keys
npm run build && npm start   # http://localhost:5000
npm run dev                  # while changing code (reloads on edits)
npm run typecheck
```

| Where | What |
|---|---|
| `supabase/migrations/` | The database: tables, security rules, functions, storage (safe to re-run) |
| `src/app/` | Pages and API routes (Next.js App Router) |
| `src/lib/data/` | All database access, and the in-tab cache |
| `src/lib/payments/` | Online payment provider interface |
| `src/lib/branding.ts`, `src/components/branding-provider.tsx` | Hospital name, logo and colour |
| `src/lib/storage.ts`, `src/lib/images.ts` | Image upload, signed links and compression |
| `src/config/navigation.ts` | Every page: menu section, label, icon, roles and feature (drives the menu and the page guard) |
| `src/config/permissions.ts` | Role lists per screen and action (mirrored by the database rules) |
| `src/components/page-guard.tsx`, `src/components/page.tsx` | Sign-in, role and feature check for every page; page header and layout |
| `src/lib/i18n/`, `src/components/language-provider.tsx` | English/Telugu: `t('text')`, translations per area |
| `src/lib/format.ts`, `src/lib/csv.ts`, `src/components/date-field.tsx`, `src/components/csv-import.tsx` | Shared money/date formatting, CSV export/import, date input |
| `src/config/modules.ts`, `src/hooks/use-features.ts` | Features a hospital can switch off |
| `src/lib/inventory.ts`, `src/app/inventory/` | Stock status, value and refill suggestions |
| `scripts/migrate-hospitals.mjs` | Applies the database files to every hospital |

Adding a page: create it under `src/app/`, add it to `NAV_ITEMS` in `src/config/navigation.ts`
(section, roles, feature) and start it with `PageBody` and `PageHeader`; the guard handles sign-in,
roles and switched-off features, so the page itself has no access checks. Wrap its title and main
buttons in `t()` and add the Telugu to `src/lib/i18n/te/`.

Database changes: edit `supabase/migrations/20261016000000_seva_schema.sql` (or add a file) so it can be re-run (`if not
exists`, `create or replace`, drop-then-create for policies and triggers), and keep column names
the snake_case form of the TypeScript fields in `src/types`.
