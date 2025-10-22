// bisnis/js/gate-bisnis.js
// Proteksi halaman di folder /bisnis dari direct URL (shortcut)

const LOGIN = '../index.html';                            // path ke halaman login di root
const ALLOWED_ROLES = ['admin', 'superadmin', 'bisnis'];  // whitelist

// Supabase harus sudah init sebelumnya (window.sb)
if (!window.sb?.auth?.getSession) {
  location.replace(LOGIN);
  throw new Error('[gate-bisnis] Supabase not initialized');
}

// kadang session belum siap; tunggu sebentar
async function waitSession(maxMs = 1500) {
  const t0 = Date.now();
  while (Date.now() - t0 < maxMs) {
    const { data: { session } } = await window.sb.auth.getSession();
    if (session) return session;
    await new Promise(r => setTimeout(r, 120));
  }
  const { data: { session } } = await window.sb.auth.getSession();
  return session;
}

try {
  const session = await waitSession();
  if (!session) {
    location.replace(LOGIN);
    throw new Error('[gate-bisnis] No session');
  }

  // cek role user dari tabel profiles
  const { data: prof, error } = await window.sb
    .from('profiles')
    .select('role')
    .eq('id', session.user.id)
    .maybeSingle();

  if (error) {
    console.error('[gate-bisnis] profiles error:', error?.message);
    await window.sb.auth.signOut({ scope: 'local' }).catch(()=>{});
    location.replace(LOGIN);
    throw new Error('[gate-bisnis] Cannot read role');
  }

  const role = prof?.role;
  if (!role || !ALLOWED_ROLES.includes(role)) {
    await window.sb.auth.signOut({ scope: 'local' }).catch(()=>{});
    location.replace(LOGIN);
    throw new Error('[gate-bisnis] Role not allowed');
  }

  // lolos gate → tampilkan halaman (kalau pakai guard CSS)
  document.body.classList.add('ready');
} catch (e) {
  console.error(e);
}
