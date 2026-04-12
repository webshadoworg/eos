import type { APIRoute } from 'astro';
import { supabase } from '~/lib/supabase';
import { canAccessExpenses } from '~/lib/permissions';

export const POST: APIRoute = async ({ request, locals, redirect }) => {
  if (!canAccessExpenses(locals)) return new Response('Forbidden', { status: 403 });
  const form = await request.formData();
  const action = String(form.get('_action') ?? 'create');
  const back = String(form.get('back') ?? '/expenses/methods');

  if (action === 'create') {
    const name = String(form.get('name') ?? '').trim();
    if (!name) return redirect(back);
    const { error } = await supabase.from('expense_methods').insert({
      name,
      label: String(form.get('label') ?? '') || null,
      employee_id: String(form.get('employee_id') ?? '') || null,
      notes: String(form.get('notes') ?? '') || null,
    });
    if (error) return new Response(`Error: ${error.message}`, { status: 500 });
    return redirect(back);
  }

  if (action === 'update') {
    const id = String(form.get('id') ?? '');
    if (!id) return new Response('id required', { status: 400 });
    const { error } = await supabase.from('expense_methods').update({
      name: String(form.get('name') ?? '').trim(),
      label: String(form.get('label') ?? '') || null,
      employee_id: String(form.get('employee_id') ?? '') || null,
      notes: String(form.get('notes') ?? '') || null,
    }).eq('id', id);
    if (error) return new Response(`Error: ${error.message}`, { status: 500 });
    return redirect(back);
  }

  if (action === 'delete') {
    const id = String(form.get('id') ?? '');
    const { error } = await supabase.from('expense_methods').delete().eq('id', id);
    if (error) return new Response(`Error: ${error.message}`, { status: 500 });
    return redirect(back);
  }

  return new Response('unknown action', { status: 400 });
};
