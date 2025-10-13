// assets/js/charge-on-download.js  (module)
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

const sb = window.supabase?.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true, storage: localStorage, autoRefreshToken: true }
});

// flag state per capture (foto/rekaman). Di-reset saat user "retake".
let chargedForThisCapture = false;

/**
 * Coba charge 1 token via RPC 'use_token'. Jika RPC tidak ada,
 * fallback: kurangi 'profiles.tokens' secara aman (cek saldo dulu).
 * @param {'photo'|'video'} feature
 * @returns {Promise<boolean>} true jika berhasil charge atau sudah charged sebelumnya
 */
export async function consumeOnFirstDownload(feature) {
  if (chargedForThisCapture) return true;

  // pastikan user login
  const { data: { user } } = await sb.auth.getUser();
  if (!user) {
    alert('Sesi berakhir. Silakan login kembali.');
    location.href = '../index.html';
    return false;
  }

  // 1) Coba RPC aman (disarankan)
  try {
    const { data, error } = await sb.rpc('use_token', { _feature: feature });
    if (error) throw error;

    const res = Array.isArray(data) ? data[0] : data;
    if (res?.ok) {
      chargedForThisCapture = true;
      // refresh badge jika ada helper global
      if (typeof window.refreshTokenBadge === 'function') {
        await window.refreshTokenBadge();
      }
      return true;
    } else {
      alert(res?.message || 'Token habis. Silakan top up.');
      // opsional redirect ke halaman pembayaran
      location.href = '../Pricing/pembayaran.html';
      return false;
    }
  } catch (e) {
    // 2) Fallback manual: kurangi tokens di profiles
    try {
      const { data: cur, error: e1 } = await sb.from('profiles')
        .select('tokens').eq('id', user.id).single();
      if (e1) throw e1;

      const bal = cur?.tokens ?? 0;
      if (bal <= 0) {
        alert('Token habis. Silakan top up.');
        location.href = '../Pricing/pembayaran.html';
        return false;
      }

      const { error: e2 } = await sb.from('profiles')
        .update({ tokens: bal - 1 })
        .eq('id', user.id);
      if (e2) throw e2;

      chargedForThisCapture = true;
      if (typeof window.refreshTokenBadge === 'function') {
        await window.refreshTokenBadge();
      }
      return true;
    } catch (e2) {
      console.error('Fallback charge error:', e2);
      alert('Gagal memotong token. Coba lagi.');
      return false;
    }
  }
}

/** Reset flag saat mulai capture baru / retake */
export function resetDownloadCharge() {
  chargedForThisCapture = false;
}

// Ekspos ke window bila perlu dipanggil dari non-module
window.consumeOnFirstDownload = consumeOnFirstDownload;
window.resetDownloadCharge = resetDownloadCharge;
