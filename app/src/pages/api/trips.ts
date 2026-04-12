import type { APIRoute } from 'astro';
import { supabase } from '~/lib/supabase';

export const POST: APIRoute = async ({ request, redirect }) => {
  const form = await request.formData();
  const action = String(form.get('_action') ?? 'create');
  const back = String(form.get('back') ?? '/trips');

  if (action === 'create') {
    const city = String(form.get('city') ?? '').trim();
    const start_date = String(form.get('start_date') ?? '') || null;
    const end_date = String(form.get('end_date') ?? '') || null;
    const notes = String(form.get('notes') ?? '') || null;
    const peopleRaw = String(form.get('people') ?? '').trim();
    const people = peopleRaw ? peopleRaw.split(',').map((s) => s.trim()).filter(Boolean) : [];

    if (!city) return redirect(back);

    const { error } = await supabase.from('trips').insert({ city, start_date, end_date, notes, people });
    if (error) return new Response(`Error: ${error.message}`, { status: 500 });
    return redirect(back);
  }

  if (action === 'delete') {
    const id = String(form.get('id') ?? '');
    const { error } = await supabase.from('trips').delete().eq('id', id);
    if (error) return new Response(`Error: ${error.message}`, { status: 500 });
    return redirect(back);
  }

  return new Response('unknown action', { status: 400 });
};
