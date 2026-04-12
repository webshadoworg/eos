import type { APIRoute } from 'astro';
import { supabase } from '~/lib/supabase';

// Rocks have no team_id in the schema — they're org-wide. Authentication alone
// (via middleware) gates access.

export const POST: APIRoute = async ({ request, redirect }) => {
  const form = await request.formData();
  const action = String(form.get('_action') ?? 'create');
  const back = String(form.get('back') ?? '/rocks');

  if (action === 'create') {
    const title = String(form.get('title') ?? '').trim();
    if (!title) return redirect(back);
    const { error } = await supabase.from('rocks').insert({
      title,
      description: String(form.get('description') ?? '') || null,
      owner_employee_id: String(form.get('owner_employee_id') ?? '') || null,
      due_date: String(form.get('due_date') ?? '') || null,
      status: String(form.get('status') ?? 'on_track'),
      priority_order: Number(form.get('priority_order') ?? 0),
    });
    if (error) return new Response(`Error: ${error.message}`, { status: 500 });
    return redirect(back);
  }

  if (action === 'update') {
    const id = String(form.get('id') ?? '');
    if (!id) return new Response('id required', { status: 400 });
    const { error } = await supabase.from('rocks').update({
      title: String(form.get('title') ?? '').trim(),
      description: String(form.get('description') ?? '') || null,
      owner_employee_id: String(form.get('owner_employee_id') ?? '') || null,
      due_date: String(form.get('due_date') ?? '') || null,
      status: String(form.get('status') ?? 'on_track'),
    }).eq('id', id);
    if (error) return new Response(`Error: ${error.message}`, { status: 500 });
    return redirect(back);
  }

  if (action === 'delete') {
    const id = String(form.get('id') ?? '');
    const { error } = await supabase.from('rocks').delete().eq('id', id);
    if (error) return new Response(`Error: ${error.message}`, { status: 500 });
    return redirect(back);
  }

  return new Response('unknown action', { status: 400 });
};

const ROCK_PATCH_FIELDS = new Set(['status', 'description', 'title', 'due_date', 'owner_employee_id']);

export const PATCH: APIRoute = async ({ request }) => {
  const body = await request.json();
  const { id, ...rest } = body ?? {};
  if (!id) return new Response('id required', { status: 400 });
  const patch: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(rest)) {
    if (ROCK_PATCH_FIELDS.has(k)) patch[k] = v;
  }
  if (Object.keys(patch).length === 0) return new Response('no valid fields', { status: 400 });
  const { error } = await supabase.from('rocks').update(patch).eq('id', id);
  if (error) return new Response(error.message, { status: 500 });
  return new Response(null, { status: 204 });
};
