// Who can edit the V/TO. Keep this short and explicit — if it grows, move to a DB flag.
export const VTO_EDITOR_EMAILS = new Set<string>([
  'mendy@guardyoureyes.org',
  'ceo2.gye@gmail.com',
]);

export function canEditVto(email: string | undefined | null): boolean {
  if (!email) return false;
  return VTO_EDITOR_EMAILS.has(email.toLowerCase());
}

// Access to all /expenses routes (pages + API) is gated to members of the
// "Finance" team. Membership is the single source of truth — add/remove people
// via /teams to change who can review spend.
export function canAccessExpenses(locals: App.Locals): boolean {
  return locals.allowedTeams.some((t) => t.name.trim().toLowerCase() === 'finance');
}
