// Register page logic
// Assumes: window.sb sudah diinisialisasi oleh assets/js/supabaseClient.js

const $ = (s) => document.querySelector(s);
const show = (el, txt) => { el.textContent = txt; el.style.display = 'block'; };
const hideAll = () => { $('#err').style.display = 'none'; $('#ok').style.display = 'none'; };

// Auto-redirect jika sudah login
(async () => {
  const { data: { session } } = await window.sb.auth.getSession();
  if (session) location.replace('./Motion-US.html');
})();

$('#f')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  hideAll();

  const full_name = $('#name').value.trim();
  const email     = $('#email').value.trim();
  const password  = $('#pw').value;
  const password2 = $('#pw2').value;

  if (!full_name) return show($('#err'), 'Nama wajib diisi.');
  if (password !== password2) return show($('#err'), 'Kata sandi tidak sama.');

  // Daftar akun
  const { data, error } = await window.sb.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${location.origin}/Motion-US.html`,
      data: { full_name, app: 'motion-us' }
    }
  });

  if (error) return show($('#err'), error.message || 'Pendaftaran gagal.');

  // Upsert profile (aman jika row sudah ada)
  try {
    const userId = data?.user?.id;
    if (userId) {
      await window.sb.from('profiles').upsert(
        { id: userId, email, full_name, tokens: 0 },
        { onConflict: 'id' }
      );
    }
  } catch (e) {
    // tidak fatal, hanya log
    console.warn('upsert profile:', e?.message || e);
  }

  // Jika email confirmation aktif, session akan null
  if (data.user && !data.session) {
    show($('#ok'), 'Akun dibuat. Cek email untuk verifikasi sebelum login.');
  } else {
    show($('#ok'), 'Akun dibuat & login. Mengalihkan…');
    location.replace('./Motion-US.html');
  }
});
