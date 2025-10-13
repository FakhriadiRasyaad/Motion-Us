// assets/js/admin.js
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";
export const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true, storage: localStorage, autoRefreshToken: true }
});

export async function requireAdmin() {
  const { data:{session} } = await sb.auth.getSession();
  if (!session) { location.replace('/adminungker/login.html'); return null; }
  const { data: prof } = await sb.from('profiles').select('role').eq('id', session.user.id).single();
  if (prof?.role !== 'admin' && prof?.role !== 'superadmin') {
    await sb.auth.signOut({ scope:'local' }); location.replace('/adminungker/login.html'); return null;
  }
  return { user: session.user, role: prof.role };
}
export const logout = async ()=>{ await sb.auth.signOut({ scope:'local' }); location.replace('/adminungker/login.html'); };
