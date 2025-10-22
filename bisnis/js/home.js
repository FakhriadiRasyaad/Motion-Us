// bisnis/js/home.js
const $ = (s) => document.querySelector(s);
const welcomeEl = $('#welcomeTarget');

function setWelcome(text) {
  if (!welcomeEl) return;
  const v = (text && String(text).trim()) ? String(text).trim() : 'ctrl+alt+w to change';
  welcomeEl.textContent = v;
}

// Urutan prioritas:
// 1) URL (?welcome= / ?app=) → 2) localStorage('appName') → 3) user_metadata → 4) default
async function computeWelcome() {
  try {
    const params = new URLSearchParams(location.search);
    const fromUrl = params.get('welcome') || params.get('app');
    if (fromUrl && fromUrl.trim()) return fromUrl.trim();

    const fromLS = localStorage.getItem('appName');
    if (fromLS && fromLS.trim()) return fromLS.trim();

    if (window.sb?.auth?.getUser) {
      const { data: { user } } = await window.sb.auth.getUser();
      const meta = user?.user_metadata || {};
      const fromMeta = meta.welcome || meta.appName || meta.full_name;
      if (fromMeta && String(fromMeta).trim()) return String(fromMeta).trim();
    }
  } catch {}
  return 'Motion-US';
}

// Rahasia: Ctrl+Alt+W untuk ubah cepat (simpan ke localStorage + metadata)
function bindQuickEdit() {
  window.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.altKey && (e.key === 'w' || e.key === 'W')) {
      const current = welcomeEl?.textContent || 'Motion-US';
      const v = prompt('Ubah teks "Selamat Datang di":', current);
      if (v !== null) {
        const cleaned = (v || '').trim();
        localStorage.setItem('appName', cleaned);
        setWelcome(cleaned);
        try { window.sb?.auth?.updateUser?.({ data: { welcome: cleaned } }); } catch {}
      }
    }
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  setWelcome('Motion-US');
  const finalText = await computeWelcome();
  setWelcome(finalText);
  bindQuickEdit();

  // tombol navigasi
  $('#btnPhoto')?.addEventListener('click', () => location.href = './photo.html');
  $('#btnVideo')?.addEventListener('click', () => location.href = './video.html');
});
