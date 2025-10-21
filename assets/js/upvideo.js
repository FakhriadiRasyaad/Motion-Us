// assets/js/video.js - Upload Version - FULL CODE
// Video Booth: Upload Video + Extract Frames + 3:2 Output + ZIP/PDF

(() => {
    // ========================================
    // CONSTANTS - 3:2 RATIO (Landscape)
    // ========================================
    const FRAME_W = 540;
    const FRAME_H = 360;
    const JPEG_QUALITY = 0.95;
    const PAGE_W = 595;
    const PAGE_H = 842;
    const MAX_VIDEO_SIZE = 100 * 1024 * 1024; // 100MB
  
    // ========================================
    // DOM ELEMENTS
    // ========================================
    const optA = document.getElementById('optA');
    const optB = document.getElementById('optB');
    const selectedDurationEl = document.getElementById('selectedDuration');
    const videoInput = document.getElementById('videoInput');
    const videoUploadBox = document.getElementById('videoUploadBox');
    const videoPreviewWrap = document.getElementById('videoPreviewWrap');
    const videoPreview = document.getElementById('videoPreview');
    const videoName = document.getElementById('videoName');
    const videoDuration = document.getElementById('videoDuration');
    const btnRemoveVideo = document.getElementById('btnRemoveVideo');
    const btnProcess = document.getElementById('btnProcess');
    const resultPreview = document.getElementById('resultPreview');
    const processedPreview = document.getElementById('processedPreview');
    const frameCount = document.getElementById('frameCount');
    const downloadZip = document.getElementById('downloadZip');
    const downloadPdf = document.getElementById('downloadPdf');
    const retakeBtn = document.getElementById('retake');
    const statusEl = document.getElementById('status');
    const progressWrap = document.getElementById('progressWrap');
    const progressBar = document.getElementById('progressBar');
    const progressText = document.getElementById('progressText');
    const frameInput = document.getElementById('frameInput');
    const framePreview = document.getElementById('framePreview');
    const btnFramePick = document.getElementById('btnFramePick');
    const presetWrap = document.getElementById('presetFrames');
    const btnNoFrame = document.getElementById('btnNoFrame');
    const frameUploadArea = document.getElementById('frameUploadArea');
  
    // ========================================
    // TOKEN CONSUMPTION FUNCTION
    // ========================================
    async function consumeTokenManual(amount = 1, reason = '') {
      try {
        // Get current user
        const { data: { user } } = await window.sb.auth.getUser();
        if (!user) {
          alert('❌ Sesi habis. Silakan login lagi.');
          location.replace('../index.html');
          return false;
        }
  
        // Get current tokens
        const { data: profile, error: fetchError } = await window.sb
          .from('profiles')
          .select('tokens')
          .eq('id', user.id)
          .single();
  
        if (fetchError) {
          console.error('Error fetching tokens:', fetchError);
          throw fetchError;
        }
  
        const currentTokens = profile?.tokens || 0;
        
        console.log(`[Token] Current: ${currentTokens}, Need: ${amount}, Reason: ${reason}`);
        
        if (currentTokens < amount) {
          alert(`❌ Token tidak cukup!\nAnda memiliki ${currentTokens} token, butuh ${amount} token.\n\nBeli token di halaman Pricing.`);
          return false;
        }
  
        // Deduct tokens
        const newTokens = currentTokens - amount;
        const { error: updateError } = await window.sb
          .from('profiles')
          .update({ tokens: newTokens })
          .eq('id', user.id);
  
        if (updateError) {
          console.error('Error updating tokens:', updateError);
          throw updateError;
        }
  
        console.log(`[Token] Success! New balance: ${newTokens}`);
  
        // Update token display badge
        const tokenDisplay = document.getElementById('tokenDisplay');
        if (tokenDisplay) {
          tokenDisplay.textContent = newTokens;
        }
  
        return true;
      } catch (e) {
        console.error('Token consumption error:', e);
        alert('❌ Gagal mengurangi token: ' + e.message);
        return false;
      }
    }
    let selectedDuration = 10;
    let selectedFps = 8;
    let uploadedVideoBlob = null;
    let framesData = [];
    let frameOverlayImage = null;
    let hasDownloaded = false; // Track if user already downloaded once
  
    // ========================================
    // UTILITY FUNCTIONS
    // ========================================
    const setStatus = (msg) => {
      if (statusEl) statusEl.textContent = msg;
    };
  
    const showProgress = (show) => {
      if (!progressWrap) return;
      progressWrap.classList.toggle('hidden', !show);
      if (!show) {
        if (progressBar) progressBar.style.width = '0%';
        if (progressText) progressText.textContent = '';
      }
    };
  
    const setProgress = (p, text = '') => {
      if (progressBar) progressBar.style.width = `${p}%`;
      if (progressText) progressText.textContent = text;
    };
  
    const getFileName = (prefix) => {
      const d = new Date();
      const jam = String(d.getHours()).padStart(2, '0') + String(d.getMinutes()).padStart(2, '0');
      const tgl = String(d.getDate()).padStart(2, '0');
      const bln = String(d.getMonth() + 1).padStart(2, '0');
      const thn = d.getFullYear();
      return `${prefix}-${jam}-${tgl}-${bln}-${thn}`;
    };
  
    const formatDuration = (seconds) => {
      const mins = Math.floor(seconds / 60);
      const secs = Math.floor(seconds % 60);
      return `${mins}:${String(secs).padStart(2, '0')}`;
    };
  
    // ========================================
    // STEP 1: DURATION SELECTION
    // ========================================
    if (optA) {
      optA.addEventListener('click', () => {
        document.querySelectorAll('.duration-btn').forEach(b => b.classList.remove('selected'));
        optA.classList.add('selected');
        selectedDuration = 10;
        selectedFps = 8;
        if (selectedDurationEl) selectedDurationEl.textContent = '10';
        setStatus('✅ Durasi dipilih: 10 detik @8fps (80 foto)');
      });
    }
  
    if (optB) {
      optB.addEventListener('click', () => {
        document.querySelectorAll('.duration-btn').forEach(b => b.classList.remove('selected'));
        optB.classList.add('selected');
        selectedDuration = 20;
        selectedFps = 4;
        if (selectedDurationEl) selectedDurationEl.textContent = '20';
        setStatus('✅ Durasi dipilih: 20 detik @4fps (80 foto)');
      });
    }
  
    // ========================================
    // STEP 2: VIDEO UPLOAD
    // ========================================
    
    // Click to upload
    if (videoUploadBox) {
      videoUploadBox.addEventListener('click', () => {
        if (videoInput) videoInput.click();
      });
    }
  
    // File input change
    if (videoInput) {
      videoInput.addEventListener('change', async (e) => {
        const file = e.target.files?.[0];
        if (file) await handleVideoFile(file);
      });
    }
  
    // Drag & Drop
    if (videoUploadBox) {
      videoUploadBox.addEventListener('dragover', (e) => {
        e.preventDefault();
        videoUploadBox.classList.add('drag-over');
      });
  
      videoUploadBox.addEventListener('dragleave', () => {
        videoUploadBox.classList.remove('drag-over');
      });
  
      videoUploadBox.addEventListener('drop', async (e) => {
        e.preventDefault();
        videoUploadBox.classList.remove('drag-over');
        const file = e.dataTransfer.files[0];
        if (file && file.type.startsWith('video/')) {
          await handleVideoFile(file);
        } else {
          alert('❌ Hanya file video yang diperbolehkan!');
        }
      });
    }
  
    // Handle video file upload
    async function handleVideoFile(file) {
      // Validate video type
      if (!file.type.startsWith('video/')) {
        alert('❌ File harus berupa video (MP4, WebM, MOV)!');
        return;
      }
  
      // Validate file size
      if (file.size > MAX_VIDEO_SIZE) {
        alert('❌ Ukuran video maksimal 100MB!');
        return;
      }
  
      try {
        // Store blob
        uploadedVideoBlob = file;
        
        // Create object URL
        const url = URL.createObjectURL(file);
        
        // Load video
        if (videoPreview) {
          videoPreview.src = url;
          await new Promise((resolve, reject) => {
            videoPreview.onloadedmetadata = resolve;
            videoPreview.onerror = reject;
          });
  
          const duration = videoPreview.duration;
          
          // Show preview
          if (videoPreviewWrap) videoPreviewWrap.classList.remove('hidden');
          if (videoName) videoName.textContent = file.name;
          if (videoDuration) videoDuration.textContent = formatDuration(duration);
          
          // Enable process button
          if (btnProcess) btnProcess.disabled = false;
          
          // Status message
          if (duration < selectedDuration) {
            setStatus(`⚠️ Video hanya ${formatDuration(duration)}, akan digunakan semua durasi`);
          } else {
            setStatus(`✅ Video diupload! Durasi: ${formatDuration(duration)} (akan diambil ${selectedDuration}s dari awal)`);
          }
        }
      } catch (e) {
        console.error('Error loading video:', e);
        alert('❌ Gagal memuat video. Pastikan format video didukung.');
        resetVideoUpload();
      }
    }
  
    // Remove video
    if (btnRemoveVideo) {
      btnRemoveVideo.addEventListener('click', () => {
        resetVideoUpload();
        setStatus('Video dihapus. Upload video baru.');
      });
    }
  
    function resetVideoUpload() {
      if (videoPreview) videoPreview.src = '';
      if (videoPreviewWrap) videoPreviewWrap.classList.add('hidden');
      uploadedVideoBlob = null;
      if (videoInput) videoInput.value = '';
      if (btnProcess) btnProcess.disabled = true;
      if (resultPreview) resultPreview.classList.add('hidden');
      if (downloadZip) downloadZip.disabled = true;
      if (downloadPdf) downloadPdf.disabled = true;
      if (retakeBtn) retakeBtn.disabled = true;
      framesData = [];
      hasDownloaded = false; // Reset download flag
    }
  
    // ========================================
    // STEP 3: PROCESS VIDEO
    // ========================================
    if (btnProcess) {
      btnProcess.addEventListener('click', async () => {
        if (!uploadedVideoBlob) {
          alert('❌ Upload video terlebih dahulu!');
          return;
        }
  
        // ✅ Token consumption saat proses video
        console.log('[Process] Checking token...');
        const ok = await consumeTokenManual(1, 'Proses Video');
        if (!ok) return;
  
        btnProcess.disabled = true;
        btnProcess.textContent = '⏳ Memproses...';
        setStatus('🔄 Memproses video...');
        
        try {
          framesData = await extractFrames(uploadedVideoBlob, selectedDuration, selectedFps);
          
          // Show result
          if (resultPreview) resultPreview.classList.remove('hidden');
          if (processedPreview && videoPreview) processedPreview.src = videoPreview.src;
          if (frameCount) frameCount.textContent = `${framesData.length} frame berhasil diekstrak`;
          
          // Enable download buttons
          if (downloadZip) downloadZip.disabled = false;
          if (downloadPdf) downloadPdf.disabled = false;
          if (retakeBtn) retakeBtn.disabled = false;
          
          setStatus(`✅ Proses selesai! ${framesData.length} frame siap didownload`);
          btnProcess.textContent = '✅ Proses Selesai';
        } catch (e) {
          console.error('Process error:', e);
          setStatus(`❌ Gagal memproses video: ${e.message}`);
          btnProcess.disabled = false;
          btnProcess.textContent = '⚡ Proses Video (Token -1)';
        }
      });
    }
  
    // ========================================
    // EXTRACT FRAMES FROM VIDEO
    // ========================================
    async function extractFrames(videoBlob, maxDuration, fps) {
      setStatus('🎬 Mengekstrak frame dari video...');
      showProgress(true);
  
      const video = document.createElement('video');
      video.src = URL.createObjectURL(videoBlob);
      
      await new Promise((resolve, reject) => {
        video.onloadedmetadata = resolve;
        video.onerror = reject;
      });
  
      // Determine actual duration to use
      const videoDuration = video.duration;
      const duration = Math.min(videoDuration, maxDuration);
      const totalFrames = Math.floor(duration * fps);
  
      setStatus(`📊 Mengekstrak ${totalFrames} frame...`);
  
      const canvas = document.createElement('canvas');
      canvas.width = FRAME_W;
      canvas.height = FRAME_H;
      const ctx = canvas.getContext('2d');
  
      const frames = [];
  
      for (let i = 0; i < totalFrames; i++) {
        const time = (i / fps);
        video.currentTime = time;
        
        await new Promise((resolve) => {
          video.onseeked = resolve;
        });
  
        // Get video dimensions
        const vw = video.videoWidth;
        const vh = video.videoHeight;
  
        // Calculate crop for 3:2 ratio
        const targetRatio = FRAME_W / FRAME_H; // 1.5
        const videoRatio = vw / vh;
  
        let sw, sh, sx, sy;
        
        if (videoRatio > targetRatio) {
          // Video wider than target - crop sides
          sh = vh;
          sw = vh * targetRatio;
          sx = (vw - sw) / 2;
          sy = 0;
        } else {
          // Video taller than target - crop top/bottom
          sw = vw;
          sh = vw / targetRatio;
          sx = 0;
          sy = (vh - sh) / 2;
        }
  
        // Clear canvas
        ctx.clearRect(0, 0, FRAME_W, FRAME_H);
        
        // Draw cropped video frame
        ctx.drawImage(video, sx, sy, sw, sh, 0, 0, FRAME_W, FRAME_H);
  
        // Apply frame overlay if exists
        if (frameOverlayImage) {
          ctx.drawImage(frameOverlayImage, 0, 0, FRAME_W, FRAME_H);
        }
  
        // Convert to blob
        const blob = await new Promise((resolve) => {
          canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY);
        });
        
        frames.push(blob);
  
        // Update progress
        const progress = Math.round(((i + 1) / totalFrames) * 100);
        setProgress(progress, `Frame ${i + 1}/${totalFrames} (${progress}%)`);
        
        // Allow UI to update
        await new Promise(requestAnimationFrame);
      }
  
      showProgress(false);
      URL.revokeObjectURL(video.src);
      return frames;
    }
  
    // ========================================
    // FRAME OVERLAY UPLOAD
    // ========================================
    if (btnFramePick) {
      btnFramePick.addEventListener('click', () => {
        if (frameInput) frameInput.click();
      });
    }
    
    if (frameInput) {
      frameInput.addEventListener('change', async () => {
        const file = frameInput.files?.[0];
        if (!file) return;
  
        if (file.size > 5 * 1024 * 1024) {
          alert('❌ Ukuran frame maksimal 5MB!');
          frameInput.value = '';
          return;
        }
  
        const img = new Image();
        img.onload = () => {
          frameOverlayImage = img;
          if (framePreview) {
            framePreview.src = img.src;
            framePreview.classList.remove('hidden');
          }
          if (frameUploadArea) {
            frameUploadArea.classList.add('has-file');
          }
          setStatus('✅ Frame custom dimuat (akan dioverlay ke semua foto)');
        };
        img.onerror = () => {
          alert('❌ Gagal memuat frame!');
          frameInput.value = '';
        };
        img.src = URL.createObjectURL(file);
      });
    }
  
    // Frame upload area drag & drop
    if (frameUploadArea) {
      frameUploadArea.addEventListener('click', () => {
        if (frameInput) frameInput.click();
      });
  
      frameUploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        frameUploadArea.style.borderColor = '#667eea';
        frameUploadArea.style.background = '#f0f4ff';
      });
  
      frameUploadArea.addEventListener('dragleave', () => {
        frameUploadArea.style.borderColor = '#cbd5e0';
        frameUploadArea.style.background = '';
      });
  
      frameUploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        frameUploadArea.style.borderColor = '#cbd5e0';
        frameUploadArea.style.background = '';
        
        const file = e.dataTransfer.files[0];
        if (file && file.type.startsWith('image/')) {
          const dataTransfer = new DataTransfer();
          dataTransfer.items.add(file);
          if (frameInput) {
            frameInput.files = dataTransfer.files;
            frameInput.dispatchEvent(new Event('change'));
          }
        } else {
          alert('❌ Hanya file gambar yang diperbolehkan!');
        }
      });
    }
  
    // ========================================
    // FRAME PRESETS
    // ========================================
    function setOverlayFromURL(url) {
      const img = new Image();
      img.onload = () => {
        frameOverlayImage = img;
        if (framePreview) {
          framePreview.classList.remove('hidden');
          framePreview.src = url;
        }
        setStatus('✅ Frame preset dipilih');
      };
      img.onerror = () => setStatus('❌ Gagal memuat frame preset');
      img.src = url;
    }
  
    async function resolveFrameBase() {
      const candidates = [
        '../assets/img/frame/',
        './assets/img/frame/',
        '/assets/img/frame/',
      ];
      
      for (const base of candidates) {
        const testUrl = base + '1.png?_=' + Date.now();
        const ok = await new Promise((resolve) => {
          const probe = new Image();
          probe.onload = () => resolve(true);
          probe.onerror = () => resolve(false);
          probe.src = testUrl;
        });
        if (ok) return base;
      }
      
      return '../assets/img/frame/';
    }
  
    async function loadPresetFrames(maxCount = 24) {
      if (!presetWrap) return;
      presetWrap.innerHTML = '';
  
      const base = await resolveFrameBase();
      
      for (let i = 1; i <= maxCount; i++) {
        const url = base + i + '.png';
        const card = document.createElement('button');
        card.type = 'button';
        card.className = 'preset-thumb';
        card.title = `Frame ${i}`;
        card.setAttribute('aria-label', `Pilih frame ${i}`);
  
        const img = document.createElement('img');
        img.alt = `Frame ${i}`;
        img.loading = 'lazy';
        img.decoding = 'async';
        img.src = url;
        img.onerror = () => card.remove();
  
        card.appendChild(img);
        card.addEventListener('click', () => {
          presetWrap.querySelectorAll('.preset-thumb.selected').forEach(el => 
            el.classList.remove('selected')
          );
          card.classList.add('selected');
          setOverlayFromURL(url);
        });
  
        presetWrap.appendChild(card);
      }
    }
  
    if (btnNoFrame) {
      btnNoFrame.addEventListener('click', () => {
        frameOverlayImage = null;
        if (framePreview) framePreview.classList.add('hidden');
        if (presetWrap) {
          presetWrap.querySelectorAll('.preset-thumb.selected').forEach(el => 
            el.classList.remove('selected')
          );
        }
        setStatus('Tanpa frame (polos)');
      });
    }
  
    // ========================================
    // DOWNLOAD ZIP
    // ========================================
    if (downloadZip) {
      downloadZip.addEventListener('click', async () => {
        if (framesData.length === 0) {
          alert('❌ Proses video terlebih dahulu!');
          return;
        }
  
        // ✅ Token consumption hanya pada download pertama
        if (!hasDownloaded) {
          console.log('[Download ZIP] Checking token...');
          const ok = await consumeTokenManual(1, 'Download ZIP');
          if (!ok) return;
          hasDownloaded = true; // Mark as downloaded
          console.log('[Download] Token consumed, hasDownloaded = true');
        } else {
          console.log('[Download ZIP] Already downloaded before, skipping token consumption');
        }
  
        setStatus('📦 Membuat ZIP...');
        showProgress(true);
  
        const zip = new JSZip();
        const folderName = getFileName('MOTIONME');
        const folder = zip.folder(folderName);
  
        for (let i = 0; i < framesData.length; i++) {
          const blob = framesData[i];
          const buffer = await blob.arrayBuffer();
          folder.file(`frame_${String(i + 1).padStart(4, '0')}.jpg`, buffer);
          
          const progress = Math.round(((i + 1) / framesData.length) * 100);
          setProgress(progress, `ZIP: ${i + 1}/${framesData.length}`);
        }
  
        const zipBlob = await zip.generateAsync({ 
          type: 'blob',
          compression: 'DEFLATE',
          compressionOptions: { level: 6 }
        });
        
        saveAs(zipBlob, `${folderName}.zip`);
        showProgress(false);
        setStatus('✅ ZIP berhasil didownload! (PDF download gratis)');
      });
    }
  
    // ========================================
    // DOWNLOAD PDF
    // ========================================
    if (downloadPdf) {
      downloadPdf.addEventListener('click', async () => {
        if (framesData.length === 0) {
          alert('❌ Proses video terlebih dahulu!');
          return;
        }
  
        // ✅ Token consumption hanya pada download pertama
        if (!hasDownloaded) {
          console.log('[Download PDF] Checking token...');
          const ok = await consumeTokenManual(1, 'Download PDF');
          if (!ok) return;
          hasDownloaded = true; // Mark as downloaded
          console.log('[Download] Token consumed, hasDownloaded = true');
        } else {
          console.log('[Download PDF] Already downloaded before, skipping token consumption');
        }
  
        setStatus('📄 Membuat PDF...');
        showProgress(true);
  
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF({ 
          orientation: 'portrait', 
          unit: 'px', 
          format: [PAGE_W, PAGE_H] 
        });
  
        const cols = 2;
        const rows = 4;
        const photosPerPage = cols * rows; // 8 photos per page
        
        const margin = 12;
        const gapX = 8;
        const gapY = 6;
        
        const availableW = PAGE_W - (2 * margin) - (cols - 1) * gapX;
        const availableH = PAGE_H - (2 * margin) - (rows - 1) * gapY;
        
        const imgW = availableW / cols;
        const imgH = imgW / 1.5; // 3:2 ratio
        
        const totalHeight = rows * imgH + (rows - 1) * gapY;
        let finalImgW = imgW;
        let finalImgH = imgH;
        
        if (totalHeight > availableH) {
          const scale = availableH / totalHeight;
          finalImgW = imgW * scale;
          finalImgH = imgH * scale;
        }
  
        for (let i = 0; i < framesData.length; i++) {
          if (i > 0 && i % photosPerPage === 0) {
            pdf.addPage([PAGE_W, PAGE_H]);
          }
  
          const posInPage = i % photosPerPage;
          const col = posInPage % cols;
          const row = Math.floor(posInPage / cols);
          
          const x = margin + col * (finalImgW + gapX);
          const y = margin + row * (finalImgH + gapY);
  
          const blob = framesData[i];
          const url = URL.createObjectURL(blob);
  
          const canvas = document.createElement('canvas');
          canvas.width = FRAME_W;
          canvas.height = FRAME_H;
          const ctx = canvas.getContext('2d');
  
          const img = new Image();
          await new Promise((resolve) => {
            img.onload = resolve;
            img.src = url;
          });
          
          ctx.drawImage(img, 0, 0, FRAME_W, FRAME_H);
  
          // Add frame number overlay
          const frameNum = i + 1;
          ctx.font = 'bold 22px Arial';
          ctx.textAlign = 'right';
          ctx.textBaseline = 'bottom';
          const numText = String(frameNum);
          const metrics = ctx.measureText(numText);
          const pad = 6;
          const bgX = FRAME_W - metrics.width - pad * 2;
          const bgY = FRAME_H - 28;
          const bgW = metrics.width + pad * 2;
          const bgH = 24;
          
          ctx.fillStyle = 'rgba(0,0,0,0.75)';
          ctx.fillRect(bgX, bgY, bgW, bgH);
          ctx.fillStyle = '#ffffff';
          ctx.fillText(numText, FRAME_W - pad, FRAME_H - 6);
  
          const imgData = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
          pdf.addImage(imgData, 'JPEG', x, y, finalImgW, finalImgH);
  
          URL.revokeObjectURL(url);
          
          const currentPage = Math.floor(i / photosPerPage) + 1;
          const totalPages = Math.ceil(framesData.length / photosPerPage);
          const progress = Math.round(((i + 1) / framesData.length) * 100);
          setProgress(
            progress,
            `PDF: ${i + 1}/${framesData.length} | Hal ${currentPage}/${totalPages}`
          );
        }
  
        const pdfBlob = pdf.output('blob');
        saveAs(pdfBlob, `${getFileName('MOTIONME')}.pdf`);
        showProgress(false);
        
        const totalPages = Math.ceil(framesData.length / photosPerPage);
        setStatus(`✅ PDF berhasil! ${framesData.length} foto dalam ${totalPages} halaman (ZIP download gratis)`);
      });
    }
  
    // ========================================
    // RESET / RETAKE
    // ========================================
    if (retakeBtn) {
      retakeBtn.addEventListener('click', () => {
        resetVideoUpload();
        hasDownloaded = false; // Reset download tracking
        if (btnProcess) {
          btnProcess.disabled = true;
          btnProcess.textContent = '⚡ Proses Video (Token -1)';
        }
        setStatus('Reset selesai. Upload video baru untuk memulai lagi.');
        
        if (window.resetDownloadCharge) {
          window.resetDownloadCharge();
        }
      });
    }
  
    // ========================================
    // INITIALIZATION
    // ========================================
    (async () => {
      console.log('[Video Upload] Initializing...');
      console.log('[Video Upload] Supabase client:', window.sb ? 'Available' : 'Not available');
      
      await loadPresetFrames(24);
      setStatus('📋 Pilih durasi dan upload video untuk memulai');
      
      console.log('[Video Upload] Ready!');
    })();
  
  })();