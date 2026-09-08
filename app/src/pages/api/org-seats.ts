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

    const patch: Record<string, unknown> = {
      title: String(form.get('title') ?? '').trim(),
      employee_id: String(form.get('employee_id') ?? '') || null,
      person_name: String(form.get('person_name') ?? '') || null,
      responsibilities: parseResponsibilities(String(form.get('responsibilities') ?? '')),
    };

    // Optional re-parent. Only allowed for non-root seats, and the new parent
    // must not be the seat itself or one of its descendants.
    if (form.has('parent_id')) {
      const newParent = String(form.get('parent_id') ?? '');
      if (!newParent || newParent === id) return new Response('invalid parent', { status: 400 });
      const { data: all, error: loadErr } = await supabase.from('org_seats').select('id, parent_id');
      if (loadErr) return new Response(`Error: ${loadErr.message}`, { status: 500 });
      const current = all?.find((s) => s.id === id);
      if (!current) return new Response('seat not found', { status: 404 });
      if (!current.parent_id) return new Response('cannot re-parent the root seat', { status: 400 });
      if (!all?.some((s) => s.id === newParent)) return new Response('parent not found', { status: 400 });
      // Walk up from the proposed parent; if we hit `id`, it is a descendant.
      const parentOf = new Map(all.map((s) => [s.id, s.parent_id]));
      for (let cur: string | null = newParent; cur; cur = parentOf.get(cur) ?? null) {
        if (cur === id) return new Response('cannot move a seat under its own descendant', { status: 400 });
      }
      patch.parent_id = newParent;
    }

    const { error } = await supabase.from('org_seats').update(patch).eq('id', id);
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
