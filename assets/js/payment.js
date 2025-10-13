async function uploadPaymentProof(file) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return alert('User belum login');
  
    const fileName = `${user.id}_${Date.now()}_${file.name}`;
  
    const { data: uploadData, error: uploadError } = await supabase
      .storage
      .from('payment-proofs')
      .upload(fileName, file);
  
    if (uploadError) return alert('Upload gagal: ' + uploadError.message);
  
    const { data: publicUrl } = supabase.storage.from('payment-proofs').getPublicUrl(fileName);
  
    // Simpan URL ke tabel payment_proofs
    await supabase.from('payment_proofs').insert([{ user_id: user.id, file_url: publicUrl.publicUrl }]);
  
    alert('Bukti pembayaran berhasil diupload!');
  }
  window.uploadPaymentProof = uploadPaymentProof;
  