import type { APIRoute } from 'astro';
import { supabase } from '~/lib/supabase';
import { requireApiKey, json } from '~/lib/api-auth';

// ---------- helpers ----------
async function resolveEmployeeByEmail(email: string): Promise<string | null> {
  const { data } = await supabase.from('employees').select('id').ilike('email', email).maybeSingle();
  return data?.id ?? null;
}
async function resolveTeam(teamId: string | null, teamName: string | null): Promise<string | null> {
  if (teamId) return teamId;
  if (!teamName) return null;
  const { data } = await supabase.from('teams').select('id').ilike('name', teamName).maybeSingle();
  return data?.id ?? null;
}

function startOfWeekUTC(d: Date): Date {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() - x.getUTCDay());
  x.setUTCHours(0, 0, 0, 0);
  return x;
}
function startOfMonthUTC(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}
function addDaysUTC(d: Date, n: number): Date {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + n);
  return x;
}
function addMonthsUTC(d: Date, n: number): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1));
}
function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function isYmd(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

// ============================================================
// GET /api/v1/measurables
// query: ?team_id= | ?team_name= , ?owner=<email>, ?frequency=weekly|monthly,
//        ?group=<name>, ?include_archived=1,
//        ?include_values=1, ?weeks=N (default 13), ?months=N (default 6),
//        ?from=YYYY-MM-DD, ?to=YYYY-MM-DD (overrides weeks/months window)
// ============================================================
export const GET: APIRoute = async ({ request, url }) => {
  const unauth = requireApiKey(request);
  if (unauth) return unauth;

  const teamIdParam = url.searchParams.get('team_id');
  const teamNameParam = url.searchParams.get('team_name');
  const ownerEmail = url.searchParams.get('owner') ?? url.searchParams.get('assignee');
  const frequency = url.searchParams.get('frequency');
  const group = url.searchParams.get('group');
  const includeArchived = url.searchParams.get('include_archived') === '1';
  const includeValues = url.searchParams.get('include_values') === '1';
  const fromParam = url.searchParams.get('from');
  const toParam = url.searchParams.get('to');
  const weeksParam = url.searchParams.get('weeks');
  const monthsParam = url.searchParams.get('months');

  if (frequency && frequency !== 'weekly' && frequency !== 'monthly') {
    return json({ error: "frequency must be 'weekly' or 'monthly'" }, 400);
  }
  for (const [name, val] of [['from', fromParam], ['to', toParam]] as const) {
    if (val && !isYmd(val)) return json({ error: `${name} must be YYYY-MM-DD` }, 400);
  }

  let teamId: string | null = null;
  if (teamIdParam || teamNameParam) {
    teamId = await resolveTeam(teamIdParam, teamNameParam);
    if (!teamId) return json({ measurables: [], count: 0, note: 'team not found' });
  }

  let ownerId: string | null = null;
  if (ownerEmail) {
    ownerId = await resolveEmployeeByEmail(ownerEmail);
    if (!ownerId) return json({ measurables: [], count: 0, note: `no employee with email '${ownerEmail}'` });
  }

  let q = supabase
    .from('measurables')
    .select(`
      id, name, description,
      frequency, goal, value_type, threshold_type,
      "group", subgroup, display_order, show_average, is_archived,
      created_at, updated_at,
      team:teams(id, name),
      owner:employees!measurables_owner_employee_id_fkey(id, full_name, email)
    `)
    .order('display_order');
  if (!includeArchived) q = q.eq('is_archived', false);
  if (teamId) q = q.eq('team_id', teamId);
  if (ownerId) q = q.eq('owner_employee_id', ownerId);
  if (frequency) q = q.eq('frequency', frequency);
  if (group) q = q.eq('group', group);

  const { data, error } = await q;
  if (error) return json({ error: error.message }, 500);

  const rows = (data ?? []) as any[];

  // Optionally fetch recent values per row, batched by frequency.
  const valuesByMeasurable = new Map<string, { date: string; value: number | null; note: string | null }[]>();
  if (includeValues && rows.length) {
    const now = new Date();
    const weeklyIds = rows.filter((r) => r.frequency === 'weekly').map((r) => r.id);
    const monthlyIds = rows.filter((r) => r.frequency === 'monthly').map((r) => r.id);

    // weekly window
    if (weeklyIds.length) {
      const weeks = Math.max(1, Math.min(parseInt(weeksParam ?? '13', 10) || 13, 260));
      let from = fromParam || ymd(addDaysUTC(startOfWeekUTC(now), -7 * (weeks - 1)));
      let to = toParam || ymd(startOfWeekUTC(now));
      const { data: wv, error: wErr } = await supabase
        .from('weekly_values')
        .select('measurable_id, week_start_date, value, note')
        .in('measurable_id', weeklyIds)
        .gte('week_start_date', from)
        .lte('week_start_date', to)
        .order('week_start_date', { ascending: false });
      if (wErr) return json({ error: wErr.message }, 500);
      for (const v of wv ?? []) {
        const list = valuesByMeasurable.get((v as any).measurable_id) ?? [];
        list.push({
          date: (v as any).week_start_date,
          value: (v as any).value == null ? null : Number((v as any).value),
          note: (v as any).note ?? null,
        });
        valuesByMeasurable.set((v as any).measurable_id, list);
      }
    }

    // monthly window
    if (monthlyIds.length) {
      const months = Math.max(1, Math.min(parseInt(monthsParam ?? '6', 10) || 6, 60));
      let from = fromParam || ymd(addMonthsUTC(startOfMonthUTC(now), -(months - 1)));
      let to = toParam || ymd(startOfMonthUTC(now));
      const { data: mv, error: mErr } = await supabase
        .from('monthly_values')
        .select('measurable_id, month_start_date, value, note')
        .in('measurable_id', monthlyIds)
        .gte('month_start_date', from)
        .lte('month_start_date', to)
        .order('month_start_date', { ascending: false });
      if (mErr) return json({ error: mErr.message }, 500);
      for (const v of mv ?? []) {
        const list = valuesByMeasurable.get((v as any).measurable_id) ?? [];
        list.push({
          date: (v as any).month_start_date,
          value: (v as any).value == null ? null : Number((v as any).value),
          note: (v as any).note ?? null,
        });
        valuesByMeasurable.set((v as any).measurable_id, list);
      }
    }
  }

  const measurables = rows.map((m) => {
    const out: any = {
      id: m.id,
      name: m.name,
      description: m.description,
      frequency: m.frequency,
      goal: m.goal == null ? null : Number(m.goal),
      value_type: m.value_type,
      threshold_type: m.threshold_type,
      group: m.group,
      subgroup: m.subgroup,
      display_order: m.display_order,
      show_average: m.show_average,
      is_archived: m.is_archived,
      created_at: m.created_at,
      updated_at: m.updated_at,
      team: m.team ? { id: m.team.id, name: m.team.name } : null,
      owner: m.owner ? { id: m.owner.id, name: m.owner.full_name, email: m.owner.email } : null,
    };
    if (includeValues) out.values = valuesByMeasurable.get(m.id) ?? [];
    return out;
  });

  return json({ measurables, count: measurables.length });
};

// ============================================================
// PUT /api/v1/measurables — upsert a weekly or monthly value
// body: { measurable_id (required), date 'YYYY-MM-DD' (required),
//         value? (number|null), note? (string),
//         frequency? ('weekly'|'monthly' — defaults to the measurable's frequency) }
// If both value and note are empty/null, the entry is deleted.
// Returns { measurable_id, date, frequency, value, note } on upsert,
// or { measurable_id, date, frequency, deleted: true } on delete.
// ============================================================
export const PUT: APIRoute = async ({ request }) => {
  const unauth = requireApiKey(request);
  if (unauth) return unauth;

  let body: any;
  try { body = await request.json(); } catch { return json({ error: 'body must be JSON' }, 400); }

  const measurable_id = body?.measurable_id ? String(body.measurable_id) : '';
  if (!measurable_id) return json({ error: 'measurable_id is required' }, 400);

  const date = body?.date ? String(body.date) : '';
  if (!date || !isYmd(date)) return json({ error: 'date must be YYYY-MM-DD' }, 400);

  // Look up the measurable to default the frequency and verify it exists.
  const { data: m, error: mErr } = await supabase
    .from('measurables')
    .select('id, frequency')
    .eq('id', measurable_id)
    .maybeSingle();
  if (mErr) return json({ error: mErr.message }, 500);
  if (!m) return json({ error: `no measurable with id '${measurable_id}'` }, 404);

  let frequency = body?.frequency ? String(body.frequency) : m.frequency;
  if (frequency !== 'weekly' && frequency !== 'monthly') {
    return json({ error: "frequency must be 'weekly' or 'monthly'" }, 400);
  }

  const table = frequency === 'monthly' ? 'monthly_values' : 'weekly_values';
  const dateCol = frequency === 'monthly' ? 'month_start_date' : 'week_start_date';

  let parsedValue: number | null = null;
  if (body.value !== undefined && body.value !== null && body.value !== '') {
    const n = Number(body.value);
    if (!Number.isFinite(n)) return json({ error: 'value must be a number' }, 400);
    parsedValue = n;
  }
  const trimmedNote = typeof body.note === 'string' ? body.note.trim() : '';
  const cleanNote = trimmedNote ? trimmedNote : null;

  if (parsedValue === null && cleanNote === null) {
    const { error } = await supabase.from(table).delete().match({ measurable_id, [dateCol]: date });
    if (error) return json({ error: error.message }, 500);
    return json({ measurable_id, date, frequency, deleted: true });
  }

  const { error } = await supabase
    .from(table)
    .upsert(
      { measurable_id, [dateCol]: date, value: parsedValue, note: cleanNote },
      { onConflict: `measurable_id,${dateCol}` },
    );
  if (error) return json({ error: error.message }, 500);
  return json({ measurable_id, date, frequency, value: parsedValue, note: cleanNote });
};
