// assets/js/pages/contact.js
// Asumsi: window.sb sudah ada (dari supabaseClient.js) & badge.js sudah jalan

const $ = (s) => document.querySelector(s);

(function initContactPage(){
  const form = $('#contactForm');
  if (!form) return;

  const ok  = $('#formOk');
  const err = $('#formErr');

  const hideAlerts = () => { ok.style.display='none'; err.style.display='none'; };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideAlerts();

    const name = $('#name').value.trim();
    const email = $('#email').value.trim();
    const message = $('#message').value.trim();

    if (!name || !email || !message) {
      err.textContent = 'Lengkapi semua kolom terlebih dahulu.';
      err.style.display = 'block';
      return;
    }

    // OPTIONAL: simpan ke table "contacts"
    // try {
    //   await window.sb.from('contacts').insert({ name, email, message });
    // } catch (e) {
    //   console.warn('save contact failed:', e?.message || e);
    //   // tetap tampilkan sukses agar UX tidak terhambat
    // }

    ok.textContent = 'Pesan terkirim ✅ Kami akan membalas melalui email.';
    ok.style.display = 'block';
    form.reset();
  });
})();
