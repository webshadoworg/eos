import type { APIRoute } from 'astro';
import { supabase } from '~/lib/supabase';
import { canAccessTeam } from '~/lib/team';

// PUT /api/scorecard — upsert a weekly or monthly value (+ optional note)
export const PUT: APIRoute = async ({ request, locals }) => {
  const { measurable_id, date, value, note, frequency } = await request.json();
  if (!measurable_id || !date || !frequency) return new Response('bad input', { status: 400 });

  // Verify caller has access to the measurable's team.
  const { data: m } = await supabase.from('measurables').select('team_id').eq('id', measurable_id).maybeSingle();
  if (!m) return new Response('not found', { status: 404 });
  if (!canAccessTeam(locals, m.team_id)) return new Response('Forbidden', { status: 403 });

  const table = frequency === 'monthly' ? 'monthly_values' : 'weekly_values';
  const dateCol = frequency === 'monthly' ? 'month_start_date' : 'week_start_date';
  const parsedValue = value === '' || value == null ? null : Number(value);
  const trimmedNote = typeof note === 'string' ? note.trim() : null;
  const cleanNote = trimmedNote ? trimmedNote : null;

  // Delete only if both value and note are empty.
  if (parsedValue === null && cleanNote === null) {
    const { error } = await supabase.from(table).delete().match({ measurable_id, [dateCol]: date });
    if (error) return new Response(error.message, { status: 500 });
    return new Response(null, { status: 204 });
  }

  const { error } = await supabase
    .from(table)
    .upsert(
      { measurable_id, [dateCol]: date, value: parsedValue, note: cleanNote },
      { onConflict: `measurable_id,${dateCol}` },
    );
  if (error) return new Response(error.message, { status: 500 });
  return new Response(null, { status: 204 });
};
