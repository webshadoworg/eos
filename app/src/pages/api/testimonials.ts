import type { APIRoute } from 'astro';
import { supabase } from '~/lib/supabase';

// Shared CRUD for both updates and testimonials (same table, different type).

export const POST: APIRoute = async ({ request, redirect }) => {
  const form = await request.formData();
  const action = String(form.get('_action') ?? 'create');
  const back = String(form.get('back') ?? '/updates');

  if (action === 'create') {
    const type = String(form.get('type') ?? 'Update');
    const headline = String(form.get('headline') ?? '').trim();
    if (!headline && type === 'Update') return redirect(back);
    const { error } = await supabase.from('testimonials').insert({
      type,
      headline: headline || null,
      notes: String(form.get('notes') ?? '') || null,
      rich_text: String(form.get('rich_text') ?? '') || null,
      category: String(form.get('category') ?? '') || null,
      source: String(form.get('source') ?? '') || null,
      source_link: String(form.get('source_link') ?? '') || null,
      from_username: String(form.get('from_username') ?? '') || null,
      image_url: String(form.get('image_url') ?? '') || null,
      video_url: String(form.get('video_url') ?? '') || null,
      screenshot_url: String(form.get('screenshot_url') ?? '') || null,
      date: String(form.get('date') ?? '') || null,
      featured_in_newsletter: form.get('featured_in_newsletter') === 'on',
    });
    if (error) return new Response(`Error: ${error.message}`, { status: 500 });
    return redirect(back);
  }

  if (action === 'update') {
    const id = String(form.get('id') ?? '');
    if (!id) return new Response('id required', { status: 400 });
    const { error } = await supabase.from('testimonials').update({
      headline: String(form.get('headline') ?? '') || null,
      notes: String(form.get('notes') ?? '') || null,
      rich_text: String(form.get('rich_text') ?? '') || null,
      category: String(form.get('category') ?? '') || null,
      source: String(form.get('source') ?? '') || null,
      source_link: String(form.get('source_link') ?? '') || null,
      from_username: String(form.get('from_username') ?? '') || null,
      image_url: String(form.get('image_url') ?? '') || null,
      video_url: String(form.get('video_url') ?? '') || null,
      screenshot_url: String(form.get('screenshot_url') ?? '') || null,
      date: String(form.get('date') ?? '') || null,
      featured_in_newsletter: form.get('featured_in_newsletter') === 'on',
    }).eq('id', id);
    if (error) return new Response(`Error: ${error.message}`, { status: 500 });
    return redirect(back);
  }

  if (action === 'delete') {
    const id = String(form.get('id') ?? '');
    const { error } = await supabase.from('testimonials').delete().eq('id', id);
    if (error) return new Response(`Error: ${error.message}`, { status: 500 });
    return redirect(back);
  }

  return new Response('unknown action', { status: 400 });
};

// PATCH for rich_text autosave from the editor.
const PATCH_FIELDS = new Set(['rich_text', 'notes', 'headline']);

export const PATCH: APIRoute = async ({ request }) => {
  const body = await request.json();
  const { id, ...rest } = body ?? {};
  if (!id) return new Response('id required', { status: 400 });
  const patch: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(rest)) {
    if (PATCH_FIELDS.has(k)) patch[k] = v;
  }
  if (Object.keys(patch).length === 0) return new Response('no valid fields', { status: 400 });
  const { error } = await supabase.from('testimonials').update(patch).eq('id', id);
  if (error) return new Response(error.message, { status: 500 });
  return new Response(null, { status: 204 });
};
