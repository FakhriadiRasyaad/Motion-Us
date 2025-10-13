
// assets/js/token.js
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

const tokenEl = () => document.getElementById('tokenDisplay');

// Pakai client global (window.sb) kalau sudah ada, kalau belum buat di sini
function getClient() {
  if (window.sb) return window.sb;
  window.sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: true, storage: localStorage, autoRefreshToken: true }
  });
  return window.sb;
}

// Ambil token user saat ini
export async function fetchMyTokens() {
  const sb = getClient();
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return null;
  const { data, error } = await sb
    .from('profiles')
    .select('tokens')
    .eq('id', session.user.id)
    .maybeSingle();
  if (error) throw error;
  return data?.tokens ?? 0;
}

// Update angka di badge
export async function refreshTokenBadge() {
  try {
    const t = await fetchMyTokens();
    if (tokenEl()) tokenEl().textContent = t ?? 0;
  } catch (e) {
    console.warn('refreshTokenBadge error:', e.message || e);
  }
}

// Inisialisasi: set badge + pasang realtime listener
export async function initTokenBadge() {
  const sb = getClient();

  // kalau belum login, sembunyikan angka (opsional)
  const { data: { session } } = await sb.auth.getSession();
  if (!session) { if (tokenEl()) tokenEl().textContent = '0'; return; }

  await refreshTokenBadge();

  // Realtime: update otomatis saat kolom tokens user berubah
  const channel = sb
    .channel('tokens-self')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'profiles', filter: `id=eq.${session.user.id}` },
      async (payload) => {
        if (payload?.new?.tokens != null && tokenEl()) {
          tokenEl().textContent = payload.new.tokens;
        } else {
          await refreshTokenBadge();
        }
      }
    )
    .subscribe();

  // Kalau user sign out, reset badge
  sb.auth.onAuthStateChange(async (ev) => {
    if (ev === 'SIGNED_OUT') {
      if (tokenEl()) tokenEl().textContent = '0';
      try { sb.removeChannel?.(channel); } catch {}
    }
    if (ev === 'SIGNED_IN' || ev === 'TOKEN_REFRESHED') {
      await refreshTokenBadge();
    }
  });

  // expose helper global (opsional) agar file lain bisa memaksa refresh
  window.refreshTokenBadge = refreshTokenBadge;
}

// Helper opsional: kurangi token dan langsung refresh badge
// (Kalau sudah ada logic pemotongan token di video.js, tak wajib dipakai.)
export async function consumeToken(amount = 1) {
  const sb = getClient();
  const { data: { session } } = await sb.auth.getSession();
  if (!session) throw new Error('Not signed in');

  const { data: cur } = await sb.from('profiles').select('tokens').eq('id', session.user.id).single();
  const newBal = Math.max(0, (cur?.tokens || 0) - amount);
  const { error } = await sb.from('profiles').update({ tokens: newBal }).eq('id', session.user.id);
  if (error) throw error;
  await refreshTokenBadge();
  return newBal;
}



// // ===============================
// // SISTEM TOKEN
// // ===============================

// function getCurrentUser() {
//     return JSON.parse(localStorage.getItem('currentUser')) || null;
//   }
  
//   function saveCurrentUser(user) {
//     localStorage.setItem('currentUser', JSON.stringify(user));
//   }
  
//   // Ambil jumlah token user saat ini
//   function getUserToken() {
//     const user = getCurrentUser();
//     return user ? user.token : 0;
//   }
  
//   // Tambah token (misalnya setelah pembayaran)
//   function addToken(amount) {
//     const user = getCurrentUser();
//     if (user) {
//       user.token += amount;
//       saveCurrentUser(user);
//       alert(`✅ Token berhasil ditambahkan (+${amount}). Total sekarang: ${user.token}`);
//     }
//   }
  
//   // Kurangi token saat akses fitur
//   function useToken(amount) {
//     const user = getCurrentUser();
//     if (user) {
//       if (user.token >= amount) {
//         user.token -= amount;
//         saveCurrentUser(user);
//         return true;
//       } else {
//         alert('❌ Token tidak cukup. Silakan isi token di halaman Pricing.');
//         window.location.href = '/Pricing.html';
//         return false;
//       }
//     } else {
//       alert('⚠️ Anda belum login');
//       window.location.href = '/index.html';
//       return false;
//     }
//   }
  
//   // Proteksi fitur yang butuh token minimal
//   function protectTokenPage(required = 1) {
//     protectPage(); // pastikan sudah login dulu
//     const token = getUserToken();
//     if (token < required) {
//       alert('🚫 Token tidak cukup untuk mengakses halaman ini.');
//       window.location.href = '/Pricing.html';
//     }
//   }
//   // token.js
// function getToken() {
//     return parseInt(localStorage.getItem('token') || '0');
//   }
  
//   function setToken(value) {
//     localStorage.setItem('token', value);
//     const el = document.getElementById('tokenCount');
//     if (el) el.textContent = value;
//   }
  
//   function checkAndUseToken() {
//     const current = getToken();
//     if (current <= 0) return false;
//     setToken(current - 1);
//     return true;
//   }
  

//   // assets/js/token.js
// document.addEventListener('DOMContentLoaded', () => {
//     const tokenCountEl = document.getElementById('tokenCount');
//     let user = JSON.parse(localStorage.getItem('loggedInUser'));
  
//     if (!user) return;
  
//     // Tampilkan jumlah token
//     tokenCountEl.textContent = user.token ?? 0;
  
//     // Jika halaman ini adalah Photo.html atau Video.html → kurangi token 1
//     const path = window.location.pathname;
//     if (path.includes('/MOTION-US/Video.html') || path.includes('/MOTION-US/Photo.html')) {
//       if (!user.token || user.token <= 0) {
//         alert('Token kamu habis! Silakan beli token dulu.');
//         window.location.href = '../Pricing.html';
//         return;
//       }
  
//       // Kurangi token
//       user.token -= 1;
//       localStorage.setItem('loggedInUser', JSON.stringify(user));
//       tokenCountEl.textContent = user.token;
  
//       // Optional: update data ke server/local json
//       console.log(`Token dikurangi 1. Sisa token: ${user.token}`);
//     }
//   });
  
//   const user = JSON.parse(localStorage.getItem('currentUser'));
//     if (user) {
//       document.getElementById('tokenDisplay').textContent = user.token;
//     } else {
//       window.location.href = 'index.html';
//     }

//     function goProfile() {
//       window.location.href = 'Profil.html';
//     }

//     function goToFeature(url) {
//       if (user.token > 0) {
//         window.location.href = url;
//       } else {
//         alert('Token habis! Silakan top up.');
//         window.location.href = 'Pricing.html';
//       }
//     }



    