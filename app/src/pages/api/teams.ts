import type { APIRoute } from 'astro';
import { supabase } from '~/lib/supabase';
import { canAccessTeam } from '~/lib/team';

export const POST: APIRoute = async ({ request, locals, redirect }) => {
  const form = await request.formData();
  const action = String(form.get('_action') ?? 'create');
  const back = String(form.get('back') ?? '/teams');

  if (action === 'create') {
    const name = String(form.get('name') ?? '').trim();
    if (!name) return redirect(back);
    const description = String(form.get('description') ?? '') || null;

    // Insert team + creating employee as admin member in one go.
    const { data: team, error } = await supabase
      .from('teams')
      .insert({ name, description })
      .select('id')
      .single();
    if (error) return new Response(`Error: ${error.message}`, { status: 500 });

    if (locals.user) {
      await supabase.from('team_memberships').insert({
        team_id: team.id,
        employee_id: locals.user.employeeId,
        role: 'admin',
      });
    }
    return redirect(`/teams?edit=${team.id}`);
  }

  if (action === 'update') {
    const id = String(form.get('id') ?? '');
    if (!id) return new Response('id required', { status: 400 });
    if (!canAccessTeam(locals, id)) return new Response('Forbidden', { status: 403 });
    const { error } = await supabase
      .from('teams')
      .update({
        name: String(form.get('name') ?? '').trim(),
        description: String(form.get('description') ?? '') || null,
      })
      .eq('id', id);
    if (error) return new Response(`Error: ${error.message}`, { status: 500 });
    return redirect(back);
  }

  if (action === 'delete') {
    const id = String(form.get('id') ?? '');
    if (!canAccessTeam(locals, id)) return new Response('Forbidden', { status: 403 });
    const { error } = await supabase.from('teams').delete().eq('id', id);
    if (error) return new Response(`Error: ${error.message}`, { status: 500 });
    return redirect('/teams');
  }

  return new Response('unknown action', { status: 400 });
};
