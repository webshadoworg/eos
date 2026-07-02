import { defineMiddleware } from 'astro:middleware';
import { readSession, type SessionPayload } from '~/lib/session';
import { fetchAllowedTeams, resolveCurrentTeam } from '~/lib/team';
import { supabase } from '~/lib/supabase';

const PUBLIC_PATHS = new Set<string>(['/login', '/auth/google', '/auth/callback']);

// In local dev, skip Google login and act as this user.
const DEV_USER_EMAIL = 'mendy@guardyoureyes.org';
let devSession: SessionPayload | null = null;
async function getDevSession(): Promise<SessionPayload | null> {
  if (devSession) return devSession;
  const { data } = await supabase
    .from('employees')
    .select('id, full_name, email')
    .eq('email', DEV_USER_EMAIL)
    .maybeSingle();
  if (data) devSession = { email: data.email, employeeId: data.id, fullName: data.full_name };
  return devSession;
}

export const onRequest = defineMiddleware(async (context, next) => {
  let session = await readSession(context.cookies);
  if (!session && import.meta.env.DEV) session = await getDevSession();
  context.locals.user = session;
  context.locals.allowedTeams = [];
  context.locals.currentTeam = null;

  const path = context.url.pathname;
  const isPublic = PUBLIC_PATHS.has(path) || path.startsWith('/_') || path.startsWith('/docs');
  // Machine API has its own Bearer-token auth; skip the cookie-based gate.
  const isMachineApi = path.startsWith('/api/v1');

  if (!session && !isPublic && !isMachineApi) {
    return context.redirect('/login');
  }
  if (session && path === '/login') {
    return context.redirect('/');
  }

  if (session) {
    const allowed = await fetchAllowedTeams(session.employeeId);
    context.locals.allowedTeams = allowed;
    context.locals.currentTeam = resolveCurrentTeam(context.cookies, allowed);
  }

  return next();
});
