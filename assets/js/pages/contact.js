// assets/js/pages/contact.js
const form = document.getElementById("contactForm");
const btnSend = document.getElementById("btnSend");
const ok = document.getElementById("formOk");
const err = document.getElementById("formErr");
// (opsional) tampilkan/hidden alert
const show = (el) => { el.style.display = "block"; };
const hide = (el) => { el.style.display = "none"; };

// Helper: fallback mailto jika server belum siap
function fallbackMailto({ name, email, message }) {
  const subject = `Kontak Motion-US - ${name}`;
  const body =
    `Nama: ${name}\nEmail: ${email}\n\nPesan:\n${message}\n\n— dikirim dari halaman Contact Motion-US`;
  window.location.href =
    `mailto:motionusflipbook@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  hide(ok); hide(err);

  const name = document.getElementById("name")?.value?.trim();
  const email = document.getElementById("email")?.value?.trim();
  const message = document.getElementById("message")?.value?.trim();

  if (!name || !email || !message) {
    show(err);
    err.textContent = "Semua field wajib diisi.";
    return;
  }

  // Nonaktifkan tombol selama proses
  const oldLabel = btnSend.textContent;
  btnSend.disabled = true;
  btnSend.textContent = "Mengirim…";

  // URL edge function kamu (setelah deploy)
  // Contoh: https://<PROJECT-REF>.functions.supabase.co/send-contact-email
  // Lebih aman: rakit dari window.sb (client Supabase) bila sudah diekspor di supabaseClient.js
  const supaBaseUrl = window?.sb?.supabaseUrl || ""; // pastikan supabaseClient.js mengekspor window.sb
  const functionsBase =
    supaBaseUrl ? `${supaBaseUrl.replace(/\/+$/, "")}/functions/v1` : "";
  const endpoint = `${functionsBase}/send-contact-email`;

  try {
    if (!functionsBase) throw new Error("Supabase Functions URL tidak tersedia.");

    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      // Tidak perlu kirim API key ke function publik; gunakan CORS + secret di server
      body: JSON.stringify({
        name,
        email,
        message,
        metadata: {
          ua: navigator.userAgent,
          url: location.href,
        },
      }),
    });

    const data = await res.json().catch(() => ({}));

    if (res.ok && data?.ok) {
      show(ok);
      ok.textContent = "Pesan terkirim ✅ Kami akan membalas melalui email.";
      form.reset();
    } else {
      // Jika function belum aktif, pakai fallback mailto biar user tetap bisa kirim
      fallbackMailto({ name, email, message });
    }
  } catch (e2) {
    // Fallback mailto jika jaringan/error lain
    fallbackMailto({ name, email, message });
  } finally {
    btnSend.disabled = false;
    btnSend.textContent = oldLabel;
  }
});
