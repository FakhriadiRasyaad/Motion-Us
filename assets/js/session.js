// Inisialisasi client & helper umum
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

export const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true, storage: localStorage, autoRefreshToken: true }
});

export async function requireAuth() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) {
    location.replace('/index.html');   // ganti path bila projectmu bukan di root
    return null;
  }
  return session.user;
}

// Hapus sesi di browser INI saja
export async function logoutLocal() {
  await sb.auth.signOut({ scope: 'local' });
  location.replace('/index.html');
}

// Hapus sesi di SEMUA device/browser (revoke refresh token)
export async function logoutGlobal() {
  await sb.auth.signOut({ scope: 'global' });
  location.replace('/index.html');
}
