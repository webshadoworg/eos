// Import base44 CSV exports into Supabase.
// Preserves base44 IDs as text PKs. Drops created_by/is_sample/denormalized name fields.
// Renames *_person_id → *_employee_id to match the schema.
//
// Run: npm run import

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parse } from 'csv-parse/sync';
import 'dotenv/config';
import pg from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));
const exportsDir = join(__dirname, '..', 'data', 'exports');

const url = process.env.SUPABASE_DB_SESSION_POOLER_URL || process.env.SUPABASE_DB_URL;
if (!url) throw new Error('SUPABASE_DB_SESSION_POOLER_URL not set');

const client = new pg.Client({ connectionString: url });
await client.connect();

// ---------- helpers ----------
const readCsv = (file) => {
  const text = readFileSync(join(exportsDir, file), 'utf8');
  return parse(text, { columns: true, skip_empty_lines: true, trim: true });
};

const nullify = (v) => (v === '' || v == null ? null : v);
const bool = (v) => {
  const s = (v ?? '').toString().toLowerCase();
  if (s === 'true') return true;
  if (s === 'false') return false;
  return null;
};
const num = (v) => {
  const s = nullify(v);
  if (s == null) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};
const date = (v) => nullify(v); // YYYY-MM-DD already
const ts = (v) => nullify(v);
// Parse base44's array-string ("[]" or '["a","b"]') into a JS array.
const arr = (v) => {
  const s = nullify(v);
  if (s == null) return [];
  try {
    const parsed = JSON.parse(s);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
};

const insert = async (table, rows, columns) => {
  if (!rows.length) {
    console.log(`  ${table}: 0 rows`);
    return;
  }
  // Build a multi-row VALUES insert in chunks of 200.
  const chunkSize = 200;
  let inserted = 0;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const values = [];
    const placeholders = chunk
      .map((row, ri) => {
        const ph = columns.map((_, ci) => `$${ri * columns.length + ci + 1}`).join(',');
        return `(${ph})`;
      })
      .join(',');
    for (const row of chunk) {
      for (const c of columns) values.push(row[c] ?? null);
    }
    const sql = `insert into ${table} (${columns.map((c) => `"${c}"`).join(',')}) values ${placeholders} on conflict (id) do nothing`;
    const res = await client.query(sql, values);
    inserted += res.rowCount;
  }
  console.log(`  ${table}: ${inserted}/${rows.length} inserted`);
};

// ---------- ordered import ----------
// Order matters for FKs.

console.log('employees');
{
  const rows = readCsv('Person_export.csv').map((r) => ({
    id: r.id,
    full_name: r.full_name,
    email: r.email,
    created_at: ts(r.created_date),
    updated_at: ts(r.updated_date),
  }));
  await insert('employees', rows, ['id', 'full_name', 'email', 'created_at', 'updated_at']);
}

console.log('teams');
{
  const rows = readCsv('Team_export.csv').map((r) => ({
    id: r.id,
    name: r.name,
    description: nullify(r.description),
    created_at: ts(r.created_date),
    updated_at: ts(r.updated_date),
  }));
  await insert('teams', rows, ['id', 'name', 'description', 'created_at', 'updated_at']);
}

console.log('team_memberships');
{
  // Filter out memberships referencing employees we don't have.
  const employeeIds = new Set((await client.query('select id from employees')).rows.map((r) => r.id));
  const teamIds = new Set((await client.query('select id from teams')).rows.map((r) => r.id));
  const all = readCsv('TeamMembership_export.csv');
  const rows = all
    .filter((r) => employeeIds.has(r.person_id) && teamIds.has(r.team_id))
    .map((r) => ({
      id: r.id,
      team_id: r.team_id,
      employee_id: r.person_id,
      role: nullify(r.team_role) ?? 'member',
      role_description: nullify(r.role_description),
      display_order: num(r.display_order) ?? 0,
      created_at: ts(r.created_date),
      updated_at: ts(r.updated_date),
    }));
  if (all.length !== rows.length) console.log(`  (skipped ${all.length - rows.length} with missing FK)`);
  await insert('team_memberships', rows, [
    'id', 'team_id', 'employee_id', 'role', 'role_description', 'display_order', 'created_at', 'updated_at',
  ]);
}

console.log('contacts');
{
  const employeeIds = new Set((await client.query('select id from employees')).rows.map((r) => r.id));
  const rows = readCsv('DirectoryPerson_export.csv').map((r) => ({
    id: r.id,
    employee_id: employeeIds.has(r.person_id) ? r.person_id : null,
    name: r.name,
    category: nullify(r.category),
    gye_username: nullify(r.gye_username),
    real_first_name: nullify(r.real_first_name),
    nicknames: nullify(r.nicknames),
    private_cell_number: nullify(r.private_cell_number),
    anonymous_number: nullify(r.anonymous_number),
    whatsapp_number: nullify(r.whatsapp_number),
    private_email: nullify(r.private_email),
    anonymous_email: nullify(r.anonymous_email),
    location: nullify(r.location),
    about: nullify(r.about),
    is_private: bool(r.is_private) ?? false,
    created_at: ts(r.created_date),
    updated_at: ts(r.updated_date),
  }));
  await insert('contacts', rows, [
    'id','employee_id','name','category','gye_username','real_first_name','nicknames',
    'private_cell_number','anonymous_number','whatsapp_number','private_email','anonymous_email',
    'location','about','is_private','created_at','updated_at',
  ]);
}

console.log('rocks');
{
  const employeeIds = new Set((await client.query('select id from employees')).rows.map((r) => r.id));
  const rows = readCsv('Rock_export.csv').map((r) => ({
    id: r.id,
    title: r.title,
    description: nullify(r.description),
    owner_employee_id: employeeIds.has(r.owner_person_id) ? r.owner_person_id : null,
    due_date: date(r.due_date),
    status: nullify(r.status) ?? 'on_track',
    priority_order: num(r.priority_order) ?? 0,
    is_archived: bool(r.is_archived) ?? false,
    created_at: ts(r.created_date),
    updated_at: ts(r.updated_date),
  }));
  await insert('rocks', rows, [
    'id','title','description','owner_employee_id','due_date','status','priority_order','is_archived','created_at','updated_at',
  ]);
}

console.log('milestones');
{
  const rockIds = new Set((await client.query('select id from rocks')).rows.map((r) => r.id));
  const employeeIds = new Set((await client.query('select id from employees')).rows.map((r) => r.id));
  const teamIds = new Set((await client.query('select id from teams')).rows.map((r) => r.id));
  const rows = readCsv('Milestone_export.csv').map((r) => ({
    id: r.id,
    rock_id: rockIds.has(r.rock_id) ? r.rock_id : null,
    title: r.title,
    description: nullify(r.description),
    owner_employee_id: employeeIds.has(r.owner_person_id) ? r.owner_person_id : null,
    team_id: teamIds.has(r.team_id) ? r.team_id : null,
    due_date: date(r.due_date),
    status: nullify(r.status) ?? 'on_track',
    priority_order: num(r.priority_order) ?? 0,
    is_archived: bool(r.is_archived) ?? false,
    created_at: ts(r.created_date),
    updated_at: ts(r.updated_date),
  }));
  await insert('milestones', rows, [
    'id','rock_id','title','description','owner_employee_id','team_id','due_date','status','priority_order','is_archived','created_at','updated_at',
  ]);
}

console.log('issues');
{
  const rockIds = new Set((await client.query('select id from rocks')).rows.map((r) => r.id));
  const milestoneIds = new Set((await client.query('select id from milestones')).rows.map((r) => r.id));
  const employeeIds = new Set((await client.query('select id from employees')).rows.map((r) => r.id));
  const teamIds = new Set((await client.query('select id from teams')).rows.map((r) => r.id));
  const rows = readCsv('Issue_export.csv').map((r) => ({
    id: r.id,
    title: r.title,
    description: nullify(r.description),
    team_id: teamIds.has(r.team_id) ? r.team_id : null,
    rock_id: rockIds.has(r.rock_id) ? r.rock_id : null,
    milestone_id: milestoneIds.has(r.milestone_id) ? r.milestone_id : null,
    owner_employee_id: employeeIds.has(r.owner_person_id) ? r.owner_person_id : null,
    relevant_people: arr(r.relevant_people),
    type: nullify(r.type),
    term_type: nullify(r.term_type) ?? 'short_term',
    priority: num(r.priority),
    priority_order: num(r.priority_order) ?? 0,
    status: nullify(r.status) ?? 'open',
    created_at: ts(r.created_date),
    updated_at: ts(r.updated_date),
  }));
  await insert('issues', rows, [
    'id','title','description','team_id','rock_id','milestone_id','owner_employee_id','relevant_people','type','term_type','priority','priority_order','status','created_at','updated_at',
  ]);
}

console.log('todos');
{
  const employeeIds = new Set((await client.query('select id from employees')).rows.map((r) => r.id));
  const teamIds = new Set((await client.query('select id from teams')).rows.map((r) => r.id));
  const rows = readCsv('ToDo_export.csv').map((r) => ({
    id: r.id,
    title: r.title,
    description: nullify(r.description),
    team_id: teamIds.has(r.team_id) ? r.team_id : null,
    assignee_employee_id: employeeIds.has(r.assignee_person_id) ? r.assignee_person_id : null,
    due_date: date(r.due_date),
    is_urgent: bool(r.is_urgent) ?? false,
    status: nullify(r.status) ?? 'open',
    display_order: 0,
    created_at: ts(r.created_date),
    updated_at: ts(r.updated_date),
  }));
  await insert('todos', rows, [
    'id','title','description','team_id','assignee_employee_id','due_date','is_urgent','status','display_order','created_at','updated_at',
  ]);
}

console.log('measurables');
{
  const employeeIds = new Set((await client.query('select id from employees')).rows.map((r) => r.id));
  const teamIds = new Set((await client.query('select id from teams')).rows.map((r) => r.id));
  const rows = readCsv('Measurable_export.csv').map((r) => ({
    id: r.id,
    name: r.name,
    description: nullify(r.description),
    team_id: teamIds.has(r.team_id) ? r.team_id : null,
    owner_employee_id: employeeIds.has(r.owner_person_id) ? r.owner_person_id : null,
    frequency: nullify(r.frequency) ?? 'weekly',
    goal: num(r.goal),
    value_type: nullify(r.value_type) ?? 'number',
    threshold_type: nullify(r.threshold_type) ?? 'minimum',
    group: nullify(r.group),
    subgroup: nullify(r.subgroup),
    display_order: num(r.display_order) ?? 0,
    show_average: bool(r.show_average) ?? false,
    is_archived: bool(r.is_archived) ?? false,
    created_at: ts(r.created_date),
    updated_at: ts(r.updated_date),
  }));
  await insert('measurables', rows, [
    'id','name','description','team_id','owner_employee_id','frequency','goal','value_type','threshold_type','group','subgroup','display_order','show_average','is_archived','created_at','updated_at',
  ]);
}

console.log('weekly_values');
{
  const measurableIds = new Set((await client.query('select id from measurables')).rows.map((r) => r.id));
  const all = readCsv('WeeklyValue_export.csv');
  const rows = all
    .filter((r) => measurableIds.has(r.measurable_id))
    .map((r) => ({
      id: r.id,
      measurable_id: r.measurable_id,
      week_start_date: date(r.week_start_date),
      value: num(r.value),
      note: nullify(r.note),
      created_at: ts(r.created_date),
      updated_at: ts(r.updated_date),
    }));
  if (all.length !== rows.length) console.log(`  (skipped ${all.length - rows.length} with missing FK)`);
  await insert('weekly_values', rows, ['id','measurable_id','week_start_date','value','note','created_at','updated_at']);
}

console.log('monthly_values');
{
  const measurableIds = new Set((await client.query('select id from measurables')).rows.map((r) => r.id));
  const all = readCsv('MonthlyValue_export.csv');
  const rows = all
    .filter((r) => measurableIds.has(r.measurable_id))
    .map((r) => ({
      id: r.id,
      measurable_id: r.measurable_id,
      month_start_date: date(r.month_start_date),
      value: num(r.value),
      note: nullify(r.note),
      created_at: ts(r.created_date),
      updated_at: ts(r.updated_date),
    }));
  if (all.length !== rows.length) console.log(`  (skipped ${all.length - rows.length} with missing FK)`);
  await insert('monthly_values', rows, ['id','measurable_id','month_start_date','value','note','created_at','updated_at']);
}

console.log('scorecard_group_orders');
{
  const teamIds = new Set((await client.query('select id from teams')).rows.map((r) => r.id));
  const rows = readCsv('ScorecardGroupOrder_export.csv').map((r) => ({
    id: r.id,
    team_id: teamIds.has(r.team_id) ? r.team_id : null,
    group_name: r.group_name,
    subgroup_name: nullify(r.subgroup_name),
    display_order: num(r.order) ?? 0,
    created_at: ts(r.created_date),
    updated_at: ts(r.updated_date),
  }));
  await insert('scorecard_group_orders', rows, ['id','team_id','group_name','subgroup_name','display_order','created_at','updated_at']);
}

console.log('current_focuses');
{
  const employeeIds = new Set((await client.query('select id from employees')).rows.map((r) => r.id));
  const teamIds = new Set((await client.query('select id from teams')).rows.map((r) => r.id));
  const rows = readCsv('CurrentFocus_export.csv').map((r) => ({
    id: r.id,
    employee_id: employeeIds.has(r.person_id) ? r.person_id : null,
    team_id: teamIds.has(r.team_id) ? r.team_id : null,
    focus_text: r.focus_text,
    created_at: ts(r.created_date),
    updated_at: ts(r.updated_date),
  }));
  await insert('current_focuses', rows, ['id','employee_id','team_id','focus_text','created_at','updated_at']);
}

console.log('processes');
{
  const teamIds = new Set((await client.query('select id from teams')).rows.map((r) => r.id));
  const rows = readCsv('Process_export.csv').map((r) => ({
    id: r.id,
    name: r.name,
    details: nullify(r.details),
    team_id: teamIds.has(r.team_id) ? r.team_id : null,
    is_archived: bool(r.is_archived) ?? false,
    created_at: ts(r.created_date),
    updated_at: ts(r.updated_date),
  }));
  await insert('processes', rows, ['id','name','details','team_id','is_archived','created_at','updated_at']);
}

console.log('links');
{
  const rows = readCsv('Link_export.csv').map((r) => ({
    id: r.id,
    title: r.title,
    url: r.url,
    description: nullify(r.description),
    category: nullify(r.category),
    is_private: bool(r.is_private) ?? false,
    created_at: ts(r.created_date),
    updated_at: ts(r.updated_date),
  }));
  await insert('links', rows, ['id','title','url','description','category','is_private','created_at','updated_at']);
}

console.log('testimonials');
{
  const rows = readCsv('Testimonial_export.csv').map((r) => ({
    id: r.id,
    headline: nullify(r.headline),
    notes: nullify(r.notes),
    rich_text: nullify(r.rich_text),
    category: nullify(r.category),
    type: nullify(r.type),
    source: nullify(r.source),
    source_link: nullify(r.source_link),
    from_username: nullify(r.from_username),
    image_url: nullify(r.image_url),
    video_url: nullify(r.video_url),
    screenshot_url: nullify(r.screenshot_url),
    date: date(r.date),
    featured_in_newsletter: bool(r.featured_in_newsletter) ?? false,
    created_at: ts(r.created_date),
    updated_at: ts(r.updated_date),
  }));
  await insert('testimonials', rows, [
    'id','headline','notes','rich_text','category','type','source','source_link','from_username','image_url','video_url','screenshot_url','date','featured_in_newsletter','created_at','updated_at',
  ]);
}

console.log('trips');
{
  const rows = readCsv('Trip_export.csv').map((r) => ({
    id: r.id,
    city: r.city,
    people: arr(r.people),
    start_date: date(r.start_date),
    end_date: date(r.end_date),
    notes: nullify(r.notes),
    created_at: ts(r.created_date),
    updated_at: ts(r.updated_date),
  }));
  await insert('trips', rows, ['id','city','people','start_date','end_date','notes','created_at','updated_at']);
}

console.log('personal_shortcuts');
{
  const employeesByEmail = new Map(
    (await client.query('select id, email from employees')).rows.map((r) => [r.email.toLowerCase(), r.id]),
  );
  const all = readCsv('PersonalShortcut_export.csv');
  const rows = all
    .map((r) => {
      const ownerId = employeesByEmail.get((r.created_by || '').toLowerCase());
      if (!ownerId) return null;
      return {
        id: r.id,
        owner_employee_id: ownerId,
        name: r.name,
        url: r.url,
        display_order: num(r.order) ?? 0,
        created_at: ts(r.created_date),
        updated_at: ts(r.updated_date),
      };
    })
    .filter(Boolean);
  if (all.length !== rows.length) console.log(`  (skipped ${all.length - rows.length} with unknown owner email)`);
  await insert('personal_shortcuts', rows, [
    'id','owner_employee_id','name','url','display_order','created_at','updated_at',
  ]);
}

await client.end();
console.log('\ndone');
