// Badge token + navbar helpers untuk semua halaman yang butuh login
const $ = (s) => document.querySelector(s);

async function requireAuth() {
  const { data: { session } } = await window.sb.auth.getSession();
  if (!session) { location.replace('./index.html'); return null; }
  return session.user;
}

async function getMyProfile() {
  const { data: { user } } = await window.sb.auth.getUser();
  if (!user) return null;
  const { data } = await window.sb
    .from('profiles')
    .select('tokens, full_name, email')
    .eq('id', user.id)
    .maybeSingle();
  return data ?? { tokens: 0 };
}

export async function refreshTokenBadge() {
  try {
    const prof = await getMyProfile();
    const t = prof?.tokens ?? 0;
    const el = $('#tokenDisplay');
    if (el) el.textContent = t;
    return t;
  } catch (e) {
    console.warn('refreshTokenBadge:', e?.message || e);
    const el = $('#tokenDisplay');
    if (el) el.textContent = '0';
    return 0;
  }
}

export async function logoutUser() {
  await window.sb.auth.signOut({ scope: 'local' });
  location.replace('./index.html');
}


export async function initTokenBadge() {
  const user = await requireAuth();
  if (!user) return;

  await refreshTokenBadge();

  // navbar buttons
  $('#btnLogout')?.addEventListener('click', logoutUser);
  $('#btnProfile')?.addEventListener('click', goProfile);

  // realtime badge update bila token berubah
  window.sb
    .channel('tokens-self')
    .on('postgres_changes', {
      event: '*', schema: 'public', table: 'profiles', filter: `id=eq.${user.id}`
    }, (payload) => {
      const t = payload?.new?.tokens;
      if (t != null) { $('#tokenDisplay').textContent = t; }
    })
    .subscribe();

  // auto-redirect jika logout dari tab lain
  window.sb.auth.onAuthStateChange((ev) => {
    if (ev === 'SIGNED_OUT') location.replace('./index.html');
  });

  // ekspos agar bisa dipanggil modul lain (mis. charge-on-download)
  window.refreshTokenBadge = refreshTokenBadge;
  window.logoutUser = logoutUser;
  window.goProfile = goProfile;
}

// auto-run di halaman yang mengimport badge.js
initTokenBadge();
