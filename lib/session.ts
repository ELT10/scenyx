import { cookies } from 'next/headers';
import { supabaseAdmin } from './supabaseAdmin';

const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

export async function createSession(userId: string) {
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  const { data, error } = await supabaseAdmin
    .from('sessions')
    .insert({ user_id: userId, expires_at: expiresAt })
    .select('id, expires_at')
    .single();
  if (error || !data) throw error || new Error('Failed to create session');
  const cookieStore = await cookies();
  cookieStore.set('scenyx_session', data.id, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    expires: new Date(data.expires_at),
  });
  return data.id;
}

export async function getSession() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get('scenyx_session')?.value;
  if (!sessionId) return null;
  const { data } = await supabaseAdmin
    .from('sessions')
    .select('id, user_id, expires_at, revoked_at')
    .eq('id', sessionId)
    .single();
  if (!data) return null;
  if (data.revoked_at || new Date(data.expires_at).getTime() < Date.now()) return null;
  return { id: data.id, userId: data.user_id };
}

export async function revokeSession() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get('scenyx_session')?.value;
  if (!sessionId) return;
  await supabaseAdmin.from('sessions').update({ revoked_at: new Date().toISOString() }).eq('id', sessionId);
  cookieStore.set('scenyx_session', '', { path: '/', expires: new Date(0) });
}


