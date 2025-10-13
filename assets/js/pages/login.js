
const $ = (s) => document.querySelector(s);
const show = (el, txt) => { el.textContent = txt; el.style.display = "block"; };
const hideAll = () => { $("#err").style.display = "none"; $("#ok").style.display = "none"; };

// Auto-redirect jika sudah login
(async () => {
    const { data: { session } } = await window.sb.auth.getSession();
    if (session) {
        // ✅ FIX 1: Pakai absolute path dengan '/'
        window.location.href = '/Motion-US.html';
    }
})();

// Submit login
$("#f").addEventListener("submit", async (e) => {
    e.preventDefault(); 
    hideAll();
    
    const email = $("#email").value.trim();
    const password = $("#pw").value;

    try {
        const { data, error } = await window.sb.auth.signInWithPassword({ 
            email, 
            password 
        });
        
        if (error) throw error;

        show($("#ok"), "Berhasil masuk. Mengalihkan…");

        // Opsional: simpan last_login ke profiles
        try {
            await window.sb
                .from("profiles")
                .upsert({ 
                    id: data.user.id, 
                    email, 
                    last_login: new Date().toISOString() 
                }, { onConflict: "id" });
        } catch (e) {
            console.log('Update profile error:', e);
        }

        // ✅ FIX 2: Pakai absolute path dengan '/' dan case yang benar
        setTimeout(() => {
            window.location.href = '/Motion-US.html';
        }, 500);

    } catch (error) {
        show($("#err"), error.message || "Gagal masuk");
    }
});
