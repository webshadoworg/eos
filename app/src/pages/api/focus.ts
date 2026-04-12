import type { APIRoute } from 'astro';
import { supabase } from '~/lib/supabase';
import { canAccessTeam } from '~/lib/team';

export const POST: APIRoute = async ({ request, locals, redirect }) => {
  const form = await request.formData();
  const action = String(form.get('_action') ?? 'upsert');
  const back = String(form.get('back') ?? '/focus');

  if (action === 'upsert') {
    const team_id = String(form.get('team_id') ?? '');
    const employee_id = String(form.get('employee_id') ?? '');
    const focus_text = String(form.get('focus_text') ?? '').trim();
    const existingId = String(form.get('existing_id') ?? '');

    if (!team_id || !employee_id) return new Response('team_id + employee_id required', { status: 400 });
    if (!canAccessTeam(locals, team_id)) return new Response('Forbidden', { status: 403 });

    if (!focus_text) {
      if (existingId) {
        await supabase.from('current_focuses').delete().eq('id', existingId);
      }
      return redirect(back);
    }

    if (existingId) {
      const { error } = await supabase.from('current_focuses').update({ focus_text }).eq('id', existingId);
      if (error) return new Response(error.message, { status: 500 });
    } else {
      const { error } = await supabase.from('current_focuses').insert({ team_id, employee_id, focus_text });
      if (error) return new Response(error.message, { status: 500 });
    }
    return redirect(back);
  }

  return new Response('unknown action', { status: 400 });
};
