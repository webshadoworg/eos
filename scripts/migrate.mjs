import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import 'dotenv/config';
import pg from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(__dirname, '..', 'supabase', 'migrations');

const url = process.env.SUPABASE_DB_SESSION_POOLER_URL || process.env.SUPABASE_DB_URL;
if (!url) throw new Error('SUPABASE_DB_SESSION_POOLER_URL not set');

const client = new pg.Client({ connectionString: url });
await client.connect();

// Track applied migrations.
await client.query(`
  create table if not exists _migrations (
    name text primary key,
    applied_at timestamptz not null default now()
  )
`);
const { rows: applied } = await client.query('select name from _migrations');
const appliedSet = new Set(applied.map((r) => r.name));

const files = readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();
for (const f of files) {
  if (appliedSet.has(f)) {
    console.log(`⋯ skipping ${f} (already applied)`);
    continue;
  }
  const sql = readFileSync(join(migrationsDir, f), 'utf8');
  console.log(`→ applying ${f} (${sql.length} chars)`);
  await client.query(sql);
  await client.query('insert into _migrations (name) values ($1)', [f]);
  console.log(`✓ ${f}`);
}

await client.end();
console.log('done');
