import type { APIRoute } from 'astro';
import { supabase } from '~/lib/supabase';
import { canAccessTeam } from '~/lib/team';

const FREQS = new Set(['weekly', 'monthly']);
const VTYPES = new Set(['number', 'currency']);
const THRESHOLDS = new Set(['minimum', 'maximum']);

function num(v: FormDataEntryValue | null): number | null {
  const s = v == null ? '' : String(v).trim();
  if (s === '') return null;
  const n = Number(s.replace(/[$,]/g, ''));
  return Number.isFinite(n) ? n : null;
}

export const POST: APIRoute = async ({ request, redirect, locals }) => {
  const form = await request.formData();
  const action = String(form.get('_action') ?? 'create');
  const back = String(form.get('back') ?? '/scorecard');

  if (action === 'create') {
    const name = String(form.get('name') ?? '').trim();
    if (!name) return redirect(back);

    const team_id = String(form.get('team_id') ?? '') || locals.currentTeam?.id || null;
    if (!canAccessTeam(locals, team_id)) return new Response('Forbidden', { status: 403 });

    const frequency = String(form.get('frequency') ?? 'weekly');
    const value_type = String(form.get('value_type') ?? 'number');
    const threshold_type = String(form.get('threshold_type') ?? 'minimum');
    if (!FREQS.has(frequency) || !VTYPES.has(value_type) || !THRESHOLDS.has(threshold_type)) {
      return new Response('bad input', { status: 400 });
    }

    const { error } = await supabase.from('measurables').insert({
      name,
      team_id,
      frequency,
      value_type,
      threshold_type,
      goal: num(form.get('goal')),
      owner_employee_id: String(form.get('owner_employee_id') ?? '') || null,
      group: String(form.get('group') ?? '').trim() || null,
      subgroup: String(form.get('subgroup') ?? '').trim() || null,
      show_average: form.get('show_average') === 'on',
      display_order: Number(form.get('display_order') ?? 0) || 0,
    });
    if (error) return new Response(`Error: ${error.message}`, { status: 500 });
    return redirect(back);
  }

  if (action === 'update') {
    const id = String(form.get('id') ?? '');
    if (!id) return new Response('id required', { status: 400 });

    const { data: existing } = await supabase.from('measurables').select('team_id').eq('id', id).maybeSingle();
    if (!existing) return new Response('not found', { status: 404 });
    if (!canAccessTeam(locals, existing.team_id)) return new Response('Forbidden', { status: 403 });

    const frequency = String(form.get('frequency') ?? 'weekly');
    const value_type = String(form.get('value_type') ?? 'number');
    const threshold_type = String(form.get('threshold_type') ?? 'minimum');
    if (!FREQS.has(frequency) || !VTYPES.has(value_type) || !THRESHOLDS.has(threshold_type)) {
      return new Response('bad input', { status: 400 });
    }

    const team_id = String(form.get('team_id') ?? '') || existing.team_id;
    if (team_id !== existing.team_id && !canAccessTeam(locals, team_id)) {
      return new Response('Forbidden', { status: 403 });
    }

    const { error } = await supabase.from('measurables').update({
      name: String(form.get('name') ?? '').trim(),
      team_id,
      frequency,
      value_type,
      threshold_type,
      goal: num(form.get('goal')),
      owner_employee_id: String(form.get('owner_employee_id') ?? '') || null,
      group: String(form.get('group') ?? '').trim() || null,
      subgroup: String(form.get('subgroup') ?? '').trim() || null,
      show_average: form.get('show_average') === 'on',
    }).eq('id', id);
    if (error) return new Response(`Error: ${error.message}`, { status: 500 });
    return redirect(back);
  }

  if (action === 'delete') {
    const id = String(form.get('id') ?? '');
    if (!id) return new Response('id required', { status: 400 });

    const { data: existing } = await supabase.from('measurables').select('team_id').eq('id', id).maybeSingle();
    if (!existing) return new Response('not found', { status: 404 });
    if (!canAccessTeam(locals, existing.team_id)) return new Response('Forbidden', { status: 403 });

    const { error } = await supabase.from('measurables').delete().eq('id', id);
    if (error) return new Response(`Error: ${error.message}`, { status: 500 });
    return redirect(back);
  }

  if (action === 'archive') {
    const id = String(form.get('id') ?? '');
    if (!id) return new Response('id required', { status: 400 });

    const { data: existing } = await supabase.from('measurables').select('team_id').eq('id', id).maybeSingle();
    if (!existing) return new Response('not found', { status: 404 });
    if (!canAccessTeam(locals, existing.team_id)) return new Response('Forbidden', { status: 403 });

    const { error } = await supabase.from('measurables').update({ is_archived: true }).eq('id', id);
    if (error) return new Response(`Error: ${error.message}`, { status: 500 });
    return redirect(back);
  }

  return new Response('unknown action', { status: 400 });
};
