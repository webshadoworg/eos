import type { APIRoute } from 'astro';
import { supabase } from '~/lib/supabase';
import { requireApiKey, json } from '~/lib/api-auth';

// Milestones: under a rock (standard teams) or standing alone under a
// project team (rock_id null). Project plans are seeded through here:
// one milestone per phase, then to-dos with milestone_id.

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
const STATUSES = new Set(['on_track', 'off_track', 'done']);

const shape = (m: any, counts?: { open: number; total: number }) => ({
  id: m.id,
  title: m.title,
  description: m.description,
  status: m.status,
  due_date: m.due_date,
  priority_order: m.priority_order,
  is_archived: m.is_archived,
  rock_id: m.rock_id,
  created_at: m.created_at,
  team: m.team ? { id: m.team.id, name: m.team.name } : null,
  owner: m.owner ? { id: m.owner.id, name: m.owner.full_name, email: m.owner.email } : null,
  todo_counts: counts ?? { open: 0, total: 0 },
});

// GET /api/v1/milestones?team_id=|team_name=&include_archived=1
export const GET: APIRoute = async ({ request, url }) => {
  const unauth = requireApiKey(request);
  if (unauth) return unauth;

  const teamId = await resolveTeam(url.searchParams.get('team_id'), url.searchParams.get('team_name'));
  if ((url.searchParams.get('team_id') || url.searchParams.get('team_name')) && !teamId) {
    return json({ milestones: [], count: 0, note: 'team not found' });
  }
  const includeArchived = url.searchParams.get('include_archived') === '1';

  let q = supabase
    .from('milestones')
    .select(`
      id, title, description, status, due_date, priority_order, is_archived, rock_id, created_at,
      team:teams(id, name),
      owner:employees!milestones_owner_employee_id_fkey(id, full_name, email)
    `)
    .order('due_date', { ascending: true, nullsFirst: false })
    .order('priority_order');
  if (teamId) q = q.eq('team_id', teamId);
  if (!includeArchived) q = q.eq('is_archived', false);

  const { data, error } = await q;
  if (error) return json({ error: error.message }, 500);

  const ids = (data ?? []).map((m: any) => m.id);
  const counts = new Map<string, { open: number; total: number }>();
  if (ids.length) {
    const { data: todos } = await supabase.from('todos').select('milestone_id, status').in('milestone_id', ids).neq('status', 'archived');
    for (const t of todos ?? []) {
      const c = counts.get(t.milestone_id) ?? { open: 0, total: 0 };
      c.total += 1;
      if (t.status === 'open' || t.status === 'in_progress') c.open += 1;
      counts.set(t.milestone_id, c);
    }
  }

  const milestones = (data ?? []).map((m: any) => shape(m, counts.get(m.id)));
  return json({ milestones, count: milestones.length });
};

// POST /api/v1/milestones
// body: { title (required), team_id? | team_name?, description?, owner_email?,
//         due_date? (YYYY-MM-DD), status?, rock_id?, priority_order? }
export const POST: APIRoute = async ({ request }) => {
  const unauth = requireApiKey(request);
  if (unauth) return unauth;

  let body: any;
  try { body = await request.json(); } catch { return json({ error: 'body must be JSON' }, 400); }

  const title = typeof body?.title === 'string' ? body.title.trim() : '';
  if (!title) return json({ error: 'title is required' }, 400);

  const teamId = await resolveTeam(
    body.team_id ? String(body.team_id) : null,
    body.team_name ? String(body.team_name) : null,
  );
  if ((body.team_id || body.team_name) && !teamId) return json({ error: 'team not found' }, 400);

  const ownerId = body.owner_email ? await resolveEmployeeByEmail(String(body.owner_email)) : null;
  if (body.owner_email && !ownerId) return json({ error: `no employee with email '${body.owner_email}'` }, 400);

  const status = body.status ? String(body.status) : 'on_track';
  if (!STATUSES.has(status)) return json({ error: 'status must be on_track | off_track | done' }, 400);

  const { data, error } = await supabase
    .from('milestones')
    .insert({
      title,
      description: body.description ? String(body.description) : null,
      team_id: teamId,
      owner_employee_id: ownerId,
      due_date: body.due_date ? String(body.due_date) : null,
      status,
      rock_id: body.rock_id ? String(body.rock_id) : null,
      priority_order: Number.isFinite(Number(body.priority_order)) ? Number(body.priority_order) : 0,
    })
    .select('id')
    .single();
  if (error) return json({ error: error.message }, 500);
  return json({ id: data.id }, 201);
};

// PATCH /api/v1/milestones
// body: { id (required), title?, description?, owner_email?, due_date?, status?, is_archived?, priority_order? }
export const PATCH: APIRoute = async ({ request }) => {
  const unauth = requireApiKey(request);
  if (unauth) return unauth;

  let body: any;
  try { body = await request.json(); } catch { return json({ error: 'body must be JSON' }, 400); }

  const id = body?.id ? String(body.id) : '';
  if (!id) return json({ error: 'id is required' }, 400);

  const patch: Record<string, unknown> = {};
  if (typeof body.title === 'string' && body.title.trim()) patch.title = body.title.trim();
  if (body.description !== undefined) patch.description = body.description ? String(body.description) : null;
  if (body.due_date !== undefined) patch.due_date = body.due_date ? String(body.due_date) : null;
  if (body.status !== undefined) {
    if (!STATUSES.has(String(body.status))) return json({ error: 'status must be on_track | off_track | done' }, 400);
    patch.status = String(body.status);
  }
  if (body.is_archived !== undefined) patch.is_archived = Boolean(body.is_archived);
  if (body.priority_order !== undefined) patch.priority_order = Number(body.priority_order);
  if (body.owner_email !== undefined) {
    if (!body.owner_email) patch.owner_employee_id = null;
    else {
      const ownerId = await resolveEmployeeByEmail(String(body.owner_email));
      if (!ownerId) return json({ error: `no employee with email '${body.owner_email}'` }, 400);
      patch.owner_employee_id = ownerId;
    }
  }
  if (Object.keys(patch).length === 0) return json({ error: 'no updatable fields provided' }, 400);

  const { error } = await supabase.from('milestones').update(patch).eq('id', id);
  if (error) return json({ error: error.message }, 500);
  return json({ id, ...patch });
};
