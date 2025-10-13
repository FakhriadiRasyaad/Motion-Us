// Init Supabase client → window.sb
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

if (!window.supabase) {
  console.error('Supabase UMD belum dimuat.');
}

window.sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true, storage: localStorage, autoRefreshToken: true },
});
