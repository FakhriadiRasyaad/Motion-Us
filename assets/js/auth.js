import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';
export const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
auth: { persistSession: true, storage: window.localStorage, autoRefreshToken: true }
});


export async function requireAuth() {
const { data: { session } } = await supabase.auth.getSession();
if (!session) {
location.replace('/index.html');
return null;
}
return session.user;
}


export async function logout() {
await supabase.auth.signOut();
location.replace('/index.html');
}