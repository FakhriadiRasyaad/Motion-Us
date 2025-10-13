// assets/js/pages/payment.js
// Asumsi: window.sb sudah ada dari assets/js/supabaseClient.js
const $ = (s) => document.querySelector(s);

// Map harga → file QRIS (poster)
const QRIS_MAP = {
  5000: 'qris1.png',
  25000: 'qris2.png',
  50000: 'qris3.png',
  100000: 'qris4.png',
};

function rupiah(n) {
  try { return new Intl.NumberFormat('id-ID').format(n); }
  catch { return String(n); }
}

async function requireAuth() {
  const { data: { session } } = await window.sb.auth.getSession();
  if (!session) { location.replace('../index.html'); return null; }
  return session.user;
}

function getSelectedPackage() {
  const saved = localStorage.getItem('selectedPackage');
  let token = 1, price = 5000; // default bila user masuk langsung ke halaman ini
  if (saved) {
    try {
      const obj = JSON.parse(saved);
      if (obj && obj.price) {
        token = Number(obj.token || 1);
        price = Number(obj.price);
      }
    } catch {}
  }
  return { token, price };
}

function hydratePoster() {
  const { token, price } = getSelectedPackage();

  // Ganti poster QRIS sesuai paket
  const imgFile = QRIS_MAP[price] || 'qris1.png';
  const img = document.querySelector('.qris-img');
  if (img) img.src = `../assets/img/${imgFile}`;

  // Info paket (tampilan saja; tidak disimpan)
  const head = document.querySelector('.qris-head');
  if (head) {
    let info = head.querySelector('.qris-paket');
    if (!info) {
      info = document.createElement('div');
      info.className = 'qris-paket';
      info.style.marginTop = '6px';
      info.style.color = 'var(--muted)';
      info.style.fontSize = '14px';
      head.appendChild(info);
    }
    info.textContent = `Paket terpilih: ${token} token • Rp ${rupiah(price)} (QRIS : MOTION-US)`;
  }

  return { token, price, imgFile };
}

function show(el, txt) { el.textContent = txt; el.style.display = 'block'; }
function hideMsgs() {
  const ok = document.getElementById('mOk');
  const err = document.getElementById('mErr');
  if (ok) ok.style.display = 'none';
  if (err) err.style.display = 'none';
}

(async () => {
  const user = await requireAuth();
  if (!user) return;

  // Poster QRIS sesuai paket (info tampilan doang)
  hydratePoster();

  document.getElementById('btn')?.addEventListener('click', async () => {
    hideMsgs();
    const ok  = document.getElementById('mOk');
    const err = document.getElementById('mErr');

    // User WAJIB ketik nominal/kode redeem manual
    const redeemText = (document.getElementById('amount')?.value || '').trim();
    const file       = document.getElementById('file')?.files?.[0];

    if (!redeemText) return show(err, 'Isi kolom "Kode Redeem" / nominal terlebih dahulu.');
    if (!file)       return show(err, 'Pilih file bukti pembayaran.');

    // Ambil nominal angka dari input user (hanya digit)
    const parsedAmount = Number(redeemText.replace(/[^\d]/g, ''));
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      return show(err, 'Kode tidak valid. Masukkan kode yang benar.');
    }

    // Upload bukti ke bucket
    const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `${user.id}/${Date.now()}_${safe}`;
    const BUCKET = 'payment_proofs';

    const up = await window.sb.storage.from(BUCKET)
      .upload(path, file, { cacheControl: '3600', upsert: false });
    if (up.error) return show(err, `Gagal upload bukti: ${up.error.message}`);

    // Insert payment
    // - method HARUS 'qris' (taati constraint)
    // - amount dari input user
    // - status 'pending'
    // - check_list = NULL (sesuai permintaan)
    const payload = {
      user_id: user.id,
      method: 'qris',
      amount: parsedAmount,
      proof_url: path,
      status: 'pending',
      check_list: null, // << kosong/NULL
    };

    const ins = await window.sb.from('payments').insert(payload);
    if (ins.error) return show(err, `Gagal simpan data: ${ins.error.message}`);

    show(ok, 'Bukti terkirim. Menunggu 1-15 Menit & Refresh.');
    const f = document.getElementById('file'); if (f) f.value = '';
    // document.getElementById('amount').value = '';
  });
})();
