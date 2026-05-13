import type { APIRoute } from 'astro';
import { supabase } from '~/lib/supabase';
import { canMutateExpenses } from '~/lib/permissions';

const ALLOWED_STATUSES = new Set(['none', 'good', 'to_review', 'cancelled', 'to_move']);

// PATCH /api/expenses
//   single: { id, status?, move_to_method?, potentially_reducible? }
//   bulk:   { ids: [...], status?, move_to_method?, potentially_reducible? }
// move_to_method is kept when status='to_move' and cleared on any other status.
// potentially_reducible is an independent boolean flag; omit to leave unchanged.
export const PATCH: APIRoute = async ({ request, locals }) => {
  const body = await request.json();
  const { id, ids, status, move_to_method, potentially_reducible } = body ?? {};

  const patch: Record<string, unknown> = {};

  if (status !== undefined) {
    if (!ALLOWED_STATUSES.has(status)) return new Response('bad status', { status: 400 });
    patch.status = status;
    if (status === 'to_move') {
      if (typeof move_to_method !== 'string' || !move_to_method.trim()) {
        return new Response('move_to_method required when status=to_move', { status: 400 });
      }
      patch.move_to_method = move_to_method.trim();
    } else {
      patch.move_to_method = null;
    }
  }

  if (potentially_reducible !== undefined) {
    if (typeof potentially_reducible !== 'boolean') return new Response('potentially_reducible must be boolean', { status: 400 });
    patch.potentially_reducible = potentially_reducible;
  }

  if (Object.keys(patch).length === 0) return new Response('nothing to update', { status: 400 });

  if (Array.isArray(ids) && ids.length > 0) {
    const cleanIds = ids.filter((v) => Number.isInteger(v));
    if (cleanIds.length === 0) return new Response('no valid ids', { status: 400 });
    if (!(await canMutateExpenses(locals, cleanIds))) return new Response('Forbidden', { status: 403 });
    const { error } = await supabase.from('expenses').update(patch).in('expense_id', cleanIds);
    if (error) return new Response(error.message, { status: 500 });
    return new Response(null, { status: 204 });
  }

  if (id != null) {
    const numId = Number(id);
    if (!Number.isInteger(numId)) return new Response('bad id', { status: 400 });
    if (!(await canMutateExpenses(locals, [numId]))) return new Response('Forbidden', { status: 403 });
    const { error } = await supabase.from('expenses').update(patch).eq('expense_id', numId);
    if (error) return new Response(error.message, { status: 500 });
    return new Response(null, { status: 204 });
  }

  return new Response('id or ids required', { status: 400 });
};
