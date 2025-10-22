// Script khusus halaman Home: murni navigasi (tanpa charge token)
const $ = (s) => document.querySelector(s);

function gotoPhoto() { location.href = './MOTION-US/Photo.html'; }
function gotoVideo() { location.href = './MOTION-US/Video.html'; }
function gotoUPPhoto() { location.href = './MOTION-US/UpPhoto.html'; }
function gotoUPVideo() { location.href = './MOTION-US/UpVideo.html'; }

$('#btnPhoto')?.addEventListener('click', gotoPhoto);
$('#btnVideo')?.addEventListener('click', gotoVideo);
$('#updPhoto')?.addEventListener('click', gotoUPPhoto);
$('#updVideo')?.addEventListener('click', gotoUPVideo);




  // Halaman ini diasumsikan hanya bisa dibuka setelah login (via requireAuth di badge.js/supabaseClient.js).
  // Kita tetap cek role di sini untuk menampilkan tombol & membatasi akses.
  const ALLOWED_ROLES = ['admin','superadmin','bisnis'];
  const BISNIS_URL = './bisnis/index.html'; // ganti jika halamanmu berbeda (mis. './bisnis/index.html')
  const btn = document.getElementById('btnBisnis');

  // Pastikan Supabase client sudah siap
  if (window.sb?.auth?.getSession) {
    (async () => {
      const { data:{ session } } = await window.sb.auth.getSession();
      if (!session) return; // jika belum login, tombol tetap hidden

      // (Opsional) pastikan profile dibuat
      try { await window.sb.rpc('ensure_self_profile'); } catch(_) {}

      // Ambil role user
      const { data: prof, error } = await window.sb
        .from('profiles').select('role').eq('id', session.user.id).maybeSingle();

      if (error) return; // gagal baca profile -> biarkan hidden

      const role = prof?.role || '';
      const allowed = ALLOWED_ROLES.includes(role);

      // Tampilkan tombol hanya untuk role yang diizinkan
      if (allowed) btn.hidden = false;

      // Proteksi akses saat klik (role gate di sisi client)
      btn.addEventListener('click', async (e) => {
        e.preventDefault();
        // Re-check singkat sebelum navigate (menghindari manipulasi DOM)
        const { data: freshProf } = await window.sb
          .from('profiles').select('role').eq('id', session.user.id).maybeSingle();

        if (freshProf?.role && ALLOWED_ROLES.includes(freshProf.role)) {
          location.href = BISNIS_URL;
        } else {
          alert('Akses ditolak.');
        }
      });
    })();
  }
