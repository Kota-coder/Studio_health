#!/usr/bin/env node
// Brings every hospital's database up to date with the scripts in supabase/migrations.
//
// Each hospital has its own Supabase project. List them in hospitals.json (never commit it;
// it holds database passwords), copying hospitals.example.json:
//   [{ "name": "Sri Ram Hospital", "databaseUrl": "postgresql://postgres.xxxx:PASSWORD@aws-0-ap-south-1.pooler.supabase.com:5432/postgres" }]
// The database URL is in Supabase: Project Settings → Database → Connection string (Session pooler).
//
//   node scripts/migrate-hospitals.mjs            update every hospital
//   node scripts/migrate-hospitals.mjs --dry-run  only show what would run
//   node scripts/migrate-hospitals.mjs --only "Sri Ram Hospital"
//
// A brand-new database (no tables yet) first gets 20261007000000_init.sql. Every other script is
// safe to run again, so all of them run each time, in order.

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const migrationsDir = join(root, 'supabase', 'migrations');
const INIT = '20261007000000_init.sql';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const onlyIndex = args.indexOf('--only');
const only = onlyIndex >= 0 ? args[onlyIndex + 1] : null;
const configIndex = args.indexOf('--config');
const configPath = configIndex >= 0 ? args[configIndex + 1] : join(root, 'hospitals.json');

let hospitals;
try {
  hospitals = JSON.parse(readFileSync(configPath, 'utf8'));
} catch (error) {
  console.error(`Could not read ${configPath}: ${error.message}\nCopy hospitals.example.json to hospitals.json and fill it in.`);
  process.exit(1);
}
if (only) hospitals = hospitals.filter(h => h.name === only);
if (!Array.isArray(hospitals) || hospitals.length === 0) {
  console.error('No hospitals to update.');
  process.exit(1);
}

const files = readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();
const repeatable = files.filter(f => f !== INIT);

let failures = 0;
for (const hospital of hospitals) {
  const label = `[${hospital.name}]`;
  const local = /sslmode=disable/.test(hospital.databaseUrl) || /@(localhost|127\.0\.0\.1)[:/]/.test(hospital.databaseUrl);
  const client = new pg.Client({
    connectionString: hospital.databaseUrl.replace(/[?&]sslmode=[^&]*/, ''),
    // Supabase requires TLS; its certificate isn't in Node's default list.
    ssl: local ? false : { rejectUnauthorized: false },
  });
  try {
    await client.connect();
    const { rows } = await client.query("select to_regclass('public.patients') is not null as ready");
    const plan = rows[0].ready ? repeatable : files;
    console.log(`${label} ${rows[0].ready ? 'existing database' : 'new database'}: ${plan.length} script(s)`);
    for (const file of plan) {
      if (dryRun) { console.log(`${label}   would run ${file}`); continue; }
      await client.query(readFileSync(join(migrationsDir, file), 'utf8'));
      console.log(`${label}   ✓ ${file}`);
    }
  } catch (error) {
    failures++;
    console.error(`${label} FAILED: ${error.message}`);
  } finally {
    await client.end().catch(() => {});
  }
}
console.log(failures ? `Done with ${failures} failure(s).` : 'All hospitals are up to date.');
process.exit(failures ? 1 : 0);
