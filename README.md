# CardioCare

Patient management app (Next.js). Data is stored in the browser's local storage.

## Setup

1. Install Node.js 20 or newer.
2. Copy `.env.example` to `.env` and add your `GOOGLE_GENAI_API_KEY` (used to read ID cards).
3. Run `npm install`.

## Running

- **Everyday use (fast):** `npm run build` once, then `npm start`. Rebuild after updating the code.
- **While changing the code:** `npm run dev` (slower, reloads on every edit).

Both open the app at http://localhost:5000. Log in with `admin@clinic.com`, then use
**Sample Data & Reset** in the menu to load demo patients, staff and bills.

## Checks

- `npm run typecheck` checks the code for errors (the build also runs this).
