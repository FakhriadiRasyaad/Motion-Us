const $ = (s) => document.querySelector(s);
const show = (el, txt) => { el.textContent = txt; el.style.display = "block"; };
const hideAll = () => { $("#err").style.display = "none"; $("#ok").style.display = "none"; };

// Auto-redirect jika sudah login
(async () => {
  const { data: { session } } = await window.sb.auth.getSession();
  if (session) location.replace("./Motion-US.html");
})();

// Submit login
$("#f").addEventListener("submit", async (e) => {
  e.preventDefault(); hideAll();
  const email = $("#email").value.trim();
  const password = $("#pw").value;

  const { data, error } = await window.sb.auth.signInWithPassword({ email, password });
  if (error) return show($("#err"), error.message || "Gagal masuk");

  show($("#ok"), "Berhasil masuk. Mengalihkan…");

  // opsional: simpan last_login ke profiles
  try {
    await window.sb
      .from("profiles")
      .upsert({ id: data.user.id, email, last_login: new Date().toISOString() }, { onConflict: "id" });
  } catch {}

  location.replace("./Motion-US.html");
});
