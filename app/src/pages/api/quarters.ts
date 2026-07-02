import type { APIRoute } from 'astro';
import { supabase } from '~/lib/supabase';

// Quarters are org-wide (like rocks). Authentication alone (via middleware)
// gates access.

export const POST: APIRoute = async ({ request, redirect }) => {
  const form = await request.formData();
  const action = String(form.get('_action') ?? 'create');
  const back = String(form.get('back') ?? '/rocks');

  if (action === 'create') {
    const label = String(form.get('label') ?? '').trim();
    const startDate = String(form.get('start_date') ?? '');
    const endDate = String(form.get('end_date') ?? '');
    if (!label || !startDate || !endDate) return redirect(back);
    const { error } = await supabase.from('quarters').insert({
      label,
      description: String(form.get('description') ?? '').trim() || null,
      start_date: startDate,
      end_date: endDate,
    });
    if (error) return new Response(`Error: ${error.message}`, { status: 500 });
    return redirect(back);
  }

  if (action === 'update') {
    const id = String(form.get('id') ?? '');
    if (!id) return new Response('id required', { status: 400 });
    const { error } = await supabase.from('quarters').update({
      label: String(form.get('label') ?? '').trim(),
      description: String(form.get('description') ?? '').trim() || null,
      start_date: String(form.get('start_date') ?? ''),
      end_date: String(form.get('end_date') ?? ''),
    }).eq('id', id);
    if (error) return new Response(`Error: ${error.message}`, { status: 500 });
    return redirect(back);
  }

  if (action === 'delete') {
    const id = String(form.get('id') ?? '');
    // rocks.quarter_id is ON DELETE SET NULL — rocks survive, unassigned.
    const { error } = await supabase.from('quarters').delete().eq('id', id);
    if (error) return new Response(`Error: ${error.message}`, { status: 500 });
    return redirect(back);
  }

  return new Response('unknown action', { status: 400 });
};

const QUARTER_PATCH_FIELDS = new Set(['label', 'description', 'start_date', 'end_date']);

export const PATCH: APIRoute = async ({ request }) => {
  const body = await request.json();
  const { id, ...rest } = body ?? {};
  if (!id) return new Response('id required', { status: 400 });
  const patch: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(rest)) {
    if (QUARTER_PATCH_FIELDS.has(k)) patch[k] = v;
  }
  if (Object.keys(patch).length === 0) return new Response('no valid fields', { status: 400 });
  const { error } = await supabase.from('quarters').update(patch).eq('id', id);
  if (error) return new Response(error.message, { status: 500 });
  return new Response(null, { status: 204 });
};
