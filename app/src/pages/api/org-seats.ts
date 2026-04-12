import type { APIRoute } from 'astro';
import { supabase } from '~/lib/supabase';

function parseResponsibilities(raw: string | null): string[] {
  if (!raw) return [];
  return raw.split('\n').map((s) => s.trim()).filter(Boolean);
}

export const POST: APIRoute = async ({ request, redirect }) => {
  const form = await request.formData();
  const action = String(form.get('_action') ?? 'create');
  const back = String(form.get('back') ?? '/chart');

  if (action === 'create') {
    const title = String(form.get('title') ?? '').trim();
    const parent_id = String(form.get('parent_id') ?? '') || null;
    if (!title) return redirect(back);
    const { error } = await supabase.from('org_seats').insert({
      title,
      parent_id,
      employee_id: String(form.get('employee_id') ?? '') || null,
      person_name: String(form.get('person_name') ?? '') || null,
      responsibilities: parseResponsibilities(String(form.get('responsibilities') ?? '')),
    });
    if (error) return new Response(`Error: ${error.message}`, { status: 500 });
    return redirect(back);
  }

  if (action === 'update') {
    const id = String(form.get('id') ?? '');
    if (!id) return new Response('id required', { status: 400 });
    const { error } = await supabase.from('org_seats').update({
      title: String(form.get('title') ?? '').trim(),
      employee_id: String(form.get('employee_id') ?? '') || null,
      person_name: String(form.get('person_name') ?? '') || null,
      responsibilities: parseResponsibilities(String(form.get('responsibilities') ?? '')),
    }).eq('id', id);
    if (error) return new Response(`Error: ${error.message}`, { status: 500 });
    return redirect(back);
  }

  if (action === 'delete') {
    const id = String(form.get('id') ?? '');
    const { error } = await supabase.from('org_seats').delete().eq('id', id);
    if (error) return new Response(`Error: ${error.message}`, { status: 500 });
    return redirect(back);
  }

  return new Response('unknown action', { status: 400 });
};
