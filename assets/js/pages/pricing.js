// assets/js/pages/pricing.js
// Asumsi: window.sb sudah ada dari supabaseClient.js
// badge.js sudah auto-run untuk requireAuth + token badge.

const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

// Pastikan user login dulu (jaga2 jika badge.js belum sempat redirect)
async function ensureAuth() {
  const { data: { session } } = await window.sb.auth.getSession();
  if (!session) location.replace('./index.html');
}

function goToPayment(token, price) {
  localStorage.setItem('selectedPackage', JSON.stringify({ token, price }));
  location.href = 'Pricing/pembayaran.html';
}

(async function init() {
  await ensureAuth();

  // Bind kartu harga
  $$('.price-card').forEach(card => {
    card.addEventListener('click', () => {
      const token = Number(card.getAttribute('data-token'));
      const price = Number(card.getAttribute('data-price'));
      goToPayment(token, price);
    });
  });

  // Extra: tombol navbar kalau belum dibind (fallback)
  $('#btnProfile')?.addEventListener('click', () => (location.href = './Profil.html'));
  $('#btnLogout')?.addEventListener('click', async () => {
    await window.sb.auth.signOut({ scope: 'local' });
    location.replace('./index.html');
  });
})();
// Pasang handler di kartu harga → simpan pilihan & pindah ke halaman pembayaran
document.querySelectorAll('.price-card').forEach(card => {
    card.addEventListener('click', () => {
      const token = Number(card.getAttribute('data-token') || '0');
      const price = Number(card.getAttribute('data-price') || '0');
  
      // Simpan paket terpilih (dipakai di pembayaran.js)
      localStorage.setItem('selectedPackage', JSON.stringify({ token, price }));
  
      // Arahkan ke halaman pembayaran
      location.href = 'Pricing/pembayaran.html';
    });
  });