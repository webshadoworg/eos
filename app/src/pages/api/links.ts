import type { APIRoute } from 'astro';
import { supabase } from '~/lib/supabase';
import { canAccessTeam } from '~/lib/team';

// Links are org-wide (team_id null) or scoped to one team. Team-scoped
// writes require membership of that team.

export const POST: APIRoute = async ({ request, locals, redirect }) => {
  const form = await request.formData();
  const action = String(form.get('_action') ?? 'create');
  const back = String(form.get('back') ?? '/links');

  if (action === 'create') {
    const title = String(form.get('title') ?? '').trim();
    const url = String(form.get('url') ?? '').trim();
    if (!title || !url) return redirect(back);
    const team_id = String(form.get('team_id') ?? '') || null;
    if (!canAccessTeam(locals, team_id)) return new Response('Forbidden', { status: 403 });
    const { error } = await supabase.from('links').insert({
      title,
      url,
      team_id,
      description: String(form.get('description') ?? '') || null,
      category: String(form.get('category') ?? '') || null,
      is_private: form.get('is_private') === 'on',
    });
    if (error) return new Response(`Error: ${error.message}`, { status: 500 });
    return redirect(back);
  }

  if (action === 'update') {
    const id = String(form.get('id') ?? '');
    if (!id) return new Response('id required', { status: 400 });
    const { data: existing } = await supabase.from('links').select('team_id').eq('id', id).maybeSingle();
    if (!canAccessTeam(locals, existing?.team_id)) return new Response('Forbidden', { status: 403 });
    const team_id = String(form.get('team_id') ?? '') || null;
    if (!canAccessTeam(locals, team_id)) return new Response('Forbidden', { status: 403 });
    const { error } = await supabase.from('links').update({
      title: String(form.get('title') ?? '').trim(),
      url: String(form.get('url') ?? '').trim(),
      team_id,
      description: String(form.get('description') ?? '') || null,
      category: String(form.get('category') ?? '') || null,
      is_private: form.get('is_private') === 'on',
    }).eq('id', id);
    if (error) return new Response(`Error: ${error.message}`, { status: 500 });
    return redirect(back);
  }

  if (action === 'delete') {
    const id = String(form.get('id') ?? '');
    const { data: existing } = await supabase.from('links').select('team_id').eq('id', id).maybeSingle();
    if (!canAccessTeam(locals, existing?.team_id)) return new Response('Forbidden', { status: 403 });
    const { error } = await supabase.from('links').delete().eq('id', id);
    if (error) return new Response(`Error: ${error.message}`, { status: 500 });
    return redirect(back);
  }

  return new Response('unknown action', { status: 400 });
};
