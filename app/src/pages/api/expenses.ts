import type { APIRoute } from 'astro';
import { supabase } from '~/lib/supabase';

const ALLOWED_STATUSES = new Set(['none', 'good', 'to_review', 'cancelled', 'to_move']);

// PATCH /api/expenses
//   single: { id, status, move_to_method? }
//   bulk:   { ids: [...], status, move_to_method? }
// move_to_method is kept when status='to_move' and cleared on any other status.
export const PATCH: APIRoute = async ({ request }) => {
  const body = await request.json();
  const { id, ids, status, move_to_method } = body ?? {};

  if (!ALLOWED_STATUSES.has(status)) return new Response('bad status', { status: 400 });

  const patch: Record<string, unknown> = { status };
  if (status === 'to_move') {
    if (typeof move_to_method !== 'string' || !move_to_method.trim()) {
      return new Response('move_to_method required when status=to_move', { status: 400 });
    }
    patch.move_to_method = move_to_method.trim();
  } else {
    patch.move_to_method = null;
  }

  if (Array.isArray(ids) && ids.length > 0) {
    const cleanIds = ids.filter((v) => Number.isInteger(v));
    if (cleanIds.length === 0) return new Response('no valid ids', { status: 400 });
    const { error } = await supabase.from('expenses').update(patch).in('expense_id', cleanIds);
    if (error) return new Response(error.message, { status: 500 });
    return new Response(null, { status: 204 });
  }

  if (id != null) {
    const { error } = await supabase.from('expenses').update(patch).eq('expense_id', id);
    if (error) return new Response(error.message, { status: 500 });
    return new Response(null, { status: 204 });
  }

  return new Response('id or ids required', { status: 400 });
};
