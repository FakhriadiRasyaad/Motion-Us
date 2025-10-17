// assets/js/video.js
// Video Booth: 3:2 Output + Mirror + Filters + ZIP/PDF + GIF (FIXED)
import { Filters } from './filters.js';

(() => {
  // 📐 Konstanta - RASIO 3:2 (Landscape)
  const FRAME_W = 540;  // 3:2 ratio
  const FRAME_H = 360;
  const JPEG_QUALITY = 1;
  const PAGE_W = 595; 
  const PAGE_H = 842;
  const GIF_DELAY = 125; // 125ms = 8fps untuk GIF

  // Elemen
  const live = document.getElementById('live');
  const playback = document.getElementById('playback');
  const startRec = document.getElementById('startRec');
  const stopRec = document.getElementById('stopRec');
  const optA = document.getElementById('optA');
  const optB = document.getElementById('optB');
  const downloadZip = document.getElementById('downloadZip');
  const downloadPdf = document.getElementById('downloadPdf');
  const retakeBtn = document.getElementById('retake');
  const cameraBtns = document.getElementById('cameraBtns');
  const timerEl = document.getElementById('timer');
  const statusEl = document.getElementById('status');
  const progressWrap = document.getElementById('progressWrap');
  const progressBar = document.getElementById('progressBar');
  const progressText = document.getElementById('progressText');
  const frameInput = document.getElementById('frameInput');
  const framePreview = document.getElementById('framePreview');
  const btnFramePick = document.getElementById('btnFramePick');
  const countdownEl = document.getElementById('countdown');
  const presetWrap = document.getElementById('presetFrames');
  const btnNoFrame = document.getElementById('btnNoFrame');

  // ---- Mirror preview ----
  const mirrorBtn = document.getElementById('backTo1');

  function applyMirrorState() {
    if (isMirrored) {
      live.style.transform = 'scaleX(-1)';
      playback.style.transform = 'scaleX(-1)';
    } else {
      live.style.transform = '';
      playback.style.transform = '';
    }
  }

  if (mirrorBtn) {
    mirrorBtn.addEventListener('click', (e) => {
      e.preventDefault();
      isMirrored = !isMirrored;
      
      live.classList.toggle('mirrored', isMirrored);
      playback.classList.toggle('mirrored', isMirrored);
      
      applyMirrorState();
      
      mirrorBtn.classList.toggle('active', isMirrored);
      mirrorBtn.textContent = isMirrored ? '🪞 Mirror: ON' : '🪞 Mirror Kamera';
    });
  }

  // ===== Filters Panel
  (() => {
    const sideRight = document.querySelector('.vid-right');
    if (sideRight) {
      const panel = document.createElement('div');
      panel.id = 'filterPanel';
      panel.style.marginTop = '1rem';
      sideRight.insertBefore(panel, sideRight.firstChild);
      
      Filters.buildPanel(panel, () => {
        Filters.applyCSSTo(live);
        Filters.applyCSSTo(playback);
        applyMirrorState();
      });
      
      Filters.applyCSSTo(live);
    }
  })();

  // ==============================
  // Utils UI
  // ==============================
  const setStatus = (msg) => (statusEl.textContent = msg);
  const showProgress = (show) => {
    progressWrap.classList.toggle('hidden', !show);
    if (!show) {
      progressBar.style.width = '0%';
      progressText.textContent = '';
    }
  };
  const setProgress = (p, text = '') => {
    progressBar.style.width = `${p}%`;
    progressText.textContent = text;
  };
  const getFileName = (prefix) => {
    const d = new Date();
    const jam = String(d.getHours()).padStart(2, '0') + String(d.getMinutes()).padStart(2, '0');
    const tgl = String(d.getDate()).padStart(2, '0');
    const bln = String(d.getMonth() + 1).padStart(2, '0');
    const thn = d.getFullYear();
    return `${prefix}-${jam}-${tgl}-${bln}-${thn}`;
  };

  // ==============================
  // State
  // ==============================
  let mediaStream = null,
    mediaRecorder = null,
    recordedChunks = [],
    recordedBlob = null;
  let recordDuration = 0,
    recordFps = 3,
    timerInterval = null;
  let framesData = [];
  let frameOverlayImage = null;
  let isCountingDown = false;
  let isMirrored = false;

  // ==============================
  // Supabase helpers
  // ==============================
  async function requireAuthUser() {
    const { data: { user } } = await window.sb.auth.getUser();
    if (!user) {
      alert('Sesi habis. Silakan login lagi.');
      location.replace('../index.html');
      throw new Error('no-auth');
    }
    return user;
  }

  async function uploadFrameToBucket(file) {
    try {
      const user = await requireAuthUser();
      const safe = (file.name || 'frame.png').replace(/[^a-zA-Z0-9._-]/g, '_');
      const path = `${user.id}/${Date.now()}_${safe}`;
      const up = await window.sb.storage.from('frames').upload(path, file, {
        cacheControl: '3600',
        upsert: false
      });
      if (up.error) throw up.error;

      const pub = window.sb.storage.from('frames').getPublicUrl(path);
      const publicUrl = pub?.data?.publicUrl || null;
      setStatus(publicUrl ? 'Frame diupload ke storage ✅' : 'Frame tersimpan di storage (non-public) ✅');
      return { path, publicUrl };
    } catch (e) {
      console.error('Upload frame error:', e);
      setStatus(`Gagal upload frame ke storage: ${e.message || e}`);
      return null;
    }
  }

  // ==============================
  // Frame Preset Picker
  // ==============================
  function setOverlayFromURL(url) {
    const img = new Image();
    img.onload = () => {
      frameOverlayImage = img;
      framePreview?.classList.remove('hidden');
      if (framePreview) framePreview.src = url;
      setStatus('Frame bawaan dipilih ✅');
    };
    img.onerror = () => setStatus('Gagal memuat frame bawaan.');
    img.src = url;
  }

  async function resolveFrameBase() {
    const candidates = [
      '/assets/img/frame/',
      '../assets/img/frame/',
      './assets/img/frame/',
    ];
    for (const base of candidates) {
      const ok = await new Promise((res) => {
        const probe = new Image();
        probe.onload = () => res(true);
        probe.onerror = () => res(false);
        probe.src = base + '1.png?_=' + Date.now();
      });
      if (ok) return base;
    }
    return '/assets/img/frame/';
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
        presetWrap.querySelectorAll('.preset-thumb.selected').forEach(el => el.classList.remove('selected'));
        card.classList.add('selected');
        setOverlayFromURL(url);
      });

      presetWrap.appendChild(card);
    }
  }

  btnNoFrame?.addEventListener('click', () => {
    frameOverlayImage = null;
    framePreview?.classList.add('hidden');
    presetWrap?.querySelectorAll('.preset-thumb.selected').forEach(el => el.classList.remove('selected'));
    setStatus('Tanpa frame (polos).');
  });

  document.addEventListener('DOMContentLoaded', () => loadPresetFrames(24));

  // ==============================
  // Kamera
  // ==============================
  async function listCameras() {
    try { await navigator.mediaDevices.getUserMedia({ video: true }); } catch {}
    const devices = await navigator.mediaDevices.enumerateDevices();
    const cams = devices.filter((d) => d.kind === 'videoinput');
    cameraBtns.innerHTML = '';
    cams.forEach((cam, idx) => {
      const b = document.createElement('button');
      b.className = 'btn secondary';
      b.textContent = cam.label || `Kamera ${idx + 1}`;
      b.onclick = () => selectCamera(cam.deviceId, b.textContent);
      cameraBtns.appendChild(b);
    });
  }

  async function selectCamera(id, label) {
    if (mediaStream) mediaStream.getTracks().forEach((t) => t.stop());
    mediaStream = await navigator.mediaDevices.getUserMedia({
      video: { deviceId: { exact: id }, width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false
    });
    live.srcObject = mediaStream;
    setStatus(`Kamera aktif: ${label}`);
    startRec.disabled = false;
  }

  // ==============================
  // Opsi Rekam
  // ==============================
  optA.onclick = () => {
    recordDuration = 10; recordFps = 8;
    setStatus('Opsi A: 10s @8fps (80 foto)');
  };
  optB.onclick = () => {
    recordDuration = 20; recordFps = 4;
    setStatus('Opsi B: 20s @4fps (80 foto)');
  };

  // ==============================
  // Upload Frame
  // ==============================
  btnFramePick.onclick = () => frameInput.click();
  frameInput.onchange = async () => {
    const file = frameInput.files?.[0];
    if (!file) return;
    await uploadFrameToBucket(file);
    const img = new Image();
    img.onload = () => {
      frameOverlayImage = img;
      if (framePreview) {
        framePreview.src = img.src;
        framePreview.classList.remove('hidden');
      }
      setStatus('Frame.png dimuat ✅ (akan dioverlay ke semua foto)');
    };
    img.src = URL.createObjectURL(file);
  };

  // ==============================
  // Countdown
  // ==============================
  async function doCountdown() {
    if (isCountingDown) return;
    isCountingDown = true;
    countdownEl.classList.remove('hidden');
    for (let i = 3; i >= 1; i--) {
      countdownEl.textContent = String(i);
      await new Promise((r) => setTimeout(r, 1000));
    }
    countdownEl.classList.add('hidden');
    isCountingDown = false;
  }

  // ==============================
  // Rekam
  // ==============================
  startRec.onclick = async () => {
    if (!mediaStream || !recordDuration) {
      alert('Pilih kamera & opsi dulu');
      return;
    }

    if (window.resetDownloadCharge) window.resetDownloadCharge();

    try { if (playback.src && playback.src.startsWith('blob:')) URL.revokeObjectURL(playback.src); } catch {}
    recordedChunks = [];
    framesData = [];
    recordedBlob = null;

    playback.classList.add('hidden');
    playback.src = '';
    downloadZip.disabled = true;
    downloadPdf.disabled = true;
    retakeBtn.disabled = true;
    timerEl.textContent = 'Detik: 0 / 0';
    setStatus('Siap merekam…');

    await doCountdown();

    try {
      mediaRecorder = new MediaRecorder(mediaStream, { mimeType: 'video/webm;codecs=vp8' });
    } catch {
      mediaRecorder = new MediaRecorder(mediaStream);
    }

    mediaRecorder.ondataavailable = (e) => { if (e.data.size) recordedChunks.push(e.data); };
    mediaRecorder.onstop = () => {
      recordedBlob = new Blob(recordedChunks, { type: 'video/webm' });
      playback.src = URL.createObjectURL(recordedBlob);
      playback.classList.remove('hidden');
      downloadZip.disabled = false;
      downloadPdf.disabled = false;
      retakeBtn.disabled = false;
      setStatus('Rekaman selesai! Silakan download ZIP (include GIF) atau PDF');
      Filters.applyCSSTo(playback);
      playback.classList.toggle('mirrored', isMirrored);
    };

    mediaRecorder.start(100);
    startRec.disabled = true;
    stopRec.disabled = false;

    let elapsed = 0;
    timerEl.textContent = `Detik: ${elapsed}/${recordDuration}`;
    timerInterval = setInterval(() => {
      elapsed++;
      timerEl.textContent = `Detik: ${elapsed}/${recordDuration}`;
      if (elapsed >= recordDuration) stopRec.click();
    }, 1000);
  };

  stopRec.onclick = () => {
    if (mediaRecorder && mediaRecorder.state === 'recording') mediaRecorder.stop();
    clearInterval(timerInterval);
    startRec.disabled = false;
    stopRec.disabled = true;
  };

  retakeBtn.onclick = () => {
    recordedChunks = [];
    framesData = [];
    recordedBlob = null;
    playback.classList.add('hidden');
    playback.src = '';
    downloadZip.disabled = true;
    downloadPdf.disabled = true;
    retakeBtn.disabled = true;
    timerEl.textContent = 'Detik: 0 / 0';
    setStatus('Siap untuk rekam ulang');
    if (window.resetDownloadCharge) window.resetDownloadCharge();
  };

  // ==============================
  // Ekstrak Frame 3:2 (mirror + filters baked)
  // ==============================
  async function fastExtract(blob, fps) {
    setStatus('Mengekstrak frame dari video...');
    const video = document.createElement('video');
    video.src = URL.createObjectURL(blob);
    await new Promise((r) => (video.onloadedmetadata = r));

    let dur = video.duration;
    if (!isFinite(dur) || dur > 600) dur = recordDuration;

    const totalFrames = Math.min(Math.floor(dur * fps), fps * recordDuration);

    const canvas = document.createElement('canvas');
    canvas.width = FRAME_W; 
    canvas.height = FRAME_H;

    const frames = [];
    showProgress(true);

    for (let i = 0; i < totalFrames; i++) {
      const t = i / fps;
      video.currentTime = t;
      await new Promise((r) => (video.onseeked = r));

      const vw = video.videoWidth, vh = video.videoHeight;

      const targetRatio = FRAME_W / FRAME_H;
      const videoRatio = vw / vh;

      let sw, sh, sx, sy;
      
      if (videoRatio > targetRatio) {
        sh = vh;
        sw = vh * targetRatio;
        sx = (vw - sw) / 2;
        sy = 0;
      } else {
        sw = vw;
        sh = vw / targetRatio;
        sx = 0;
        sy = (vh - sh) / 2;
      }

      const tempSrc = document.createElement('canvas');
      tempSrc.width = FRAME_W; 
      tempSrc.height = FRAME_H;
      const sctx = tempSrc.getContext('2d');

      sctx.save();
      if (isMirrored) {
        sctx.translate(FRAME_W, 0);
        sctx.scale(-1, 1);
      }
      sctx.drawImage(video, sx, sy, sw, sh, 0, 0, FRAME_W, FRAME_H);
      sctx.restore();

      Filters.bakeToCanvas(canvas, tempSrc);

      if (frameOverlayImage) {
        const ctx = canvas.getContext('2d');
        ctx.drawImage(frameOverlayImage, 0, 0, FRAME_W, FRAME_H);
      }

      const blobFrame = await new Promise(res => canvas.toBlob(res, 'image/jpeg', JPEG_QUALITY));
      frames.push(blobFrame);

      setProgress(Math.round(((i + 1) / totalFrames) * 100), `Frame ${i + 1}/${totalFrames}`);
      await new Promise(requestAnimationFrame);
    }

    showProgress(false);
    return frames;
  }

  // ==============================
  // Generate GIF from Frames (FIXED)
  // ==============================
  async function generateGIF(frames) {
    setStatus('Membuat GIF animasi...');
    showProgress(true);
    
    try {
      // Convert blobs to base64 images
      const images = [];
      for (let i = 0; i < frames.length; i++) {
        const blob = frames[i];
        const base64 = await blobToBase64(blob);
        images.push(base64);
        
        setProgress(
          Math.round(((i + 1) / frames.length) * 50), 
          `Preparing GIF: ${i + 1}/${frames.length}`
        );
      }

      // Create GIF using gifshot
      return new Promise((resolve, reject) => {
        if (typeof gifshot === 'undefined') {
          reject(new Error('gifshot library not loaded'));
          return;
        }

        gifshot.createGIF({
          images: images,
          gifWidth: FRAME_W,
          gifHeight: FRAME_H,
          interval: GIF_DELAY / 1000, // Convert to seconds
          frameDuration: 8, // 8 frames per second
          sampleInterval: 10,
          numWorkers: 2
        }, (obj) => {
          if (!obj.error) {
            setProgress(100, 'GIF selesai!');
            // Convert base64 to blob
            fetch(obj.image)
              .then(res => res.blob())
              .then(blob => {
                showProgress(false);
                resolve(blob);
              })
              .catch(reject);
          } else {
            reject(new Error(obj.error));
          }
        });
      });
    } catch (e) {
      console.error('GIF generation error:', e);
      showProgress(false);
      throw e;
    }
  }

  // Helper: Convert Blob to Base64
  function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  // ==============================
  // Download ZIP (with GIF) - FIXED
  // ==============================
  downloadZip.onclick = async () => {
    if (!recordedBlob) return alert('Rekam video dulu');

    if (window.consumeOnFirstDownload) {
      const ok = await window.consumeOnFirstDownload('video');
      if (!ok) return;
    }

    setStatus('Membuat ZIP dengan GIF...');
    framesData = await fastExtract(recordedBlob, recordFps);

    const zip = new JSZip();
    const folderName = getFileName('MOTIONME');
    const folder = zip.folder(folderName);
    showProgress(true);

    // Add individual frames
    for (let i = 0; i < framesData.length; i++) {
      const b = framesData[i];
      const buf = await b.arrayBuffer();
      folder.file(`frame_${String(i + 1).padStart(4, '0')}.jpg`, buf);
      setProgress(Math.round(((i + 1) / framesData.length) * 40), `Frames ${i + 1}/${framesData.length}`);
    }

    // Generate and add GIF
    try {
      setStatus('Membuat GIF animasi...');
      setProgress(45, 'Memulai pembuatan GIF...');
      
      const gifBlob = await generateGIF(framesData);
      
      console.log('GIF Blob created:', gifBlob);
      console.log('GIF size:', gifBlob.size, 'bytes');
      
      if (gifBlob && gifBlob.size > 0) {
        const gifBuffer = await gifBlob.arrayBuffer();
        const gifFilename = `${folderName}-animation.gif`;
        folder.file(gifFilename, gifBuffer);
        
        console.log('GIF added to ZIP:', gifFilename);
        setStatus(`GIF ditambahkan ke ZIP! (${(gifBlob.size / 1024 / 1024).toFixed(2)} MB) ✅`);
        setProgress(90, 'GIF berhasil ditambahkan!');
      } else {
        throw new Error('GIF blob is empty');
      }
    } catch (e) {
      console.error('GIF generation error:', e);
      setStatus('⚠️ GIF gagal dibuat, melanjutkan dengan frames saja');
      setProgress(90, 'Melanjutkan tanpa GIF...');
    }

    setProgress(95, 'Mengompres ZIP...');
    const blob = await zip.generateAsync({ 
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 }
    });
    
    console.log('Final ZIP size:', blob.size, 'bytes');
    
    saveAs(blob, `${folderName}.zip`);
    showProgress(false);
    setStatus('ZIP berhasil didownload (include GIF animasi) ✅');
  };

  // ==============================
  // Download PDF (8 foto per halaman, 3:2 ratio)
  // ==============================
  downloadPdf.onclick = async () => {
    if (!recordedBlob) return alert('Rekam video dulu');

    if (window.consumeOnFirstDownload) {
      const ok = await window.consumeOnFirstDownload('video');
      if (!ok) return;
    }

    setStatus('Membuat PDF...');
    if (framesData.length === 0) framesData = await fastExtract(recordedBlob, recordFps);

    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'px', format: [PAGE_W, PAGE_H] });

    const cols = 2;
    const rows = 4;
    const photosPerPage = cols * rows;
    
    const margin = 12;
    const gapX = 8;
    const gapY = 6;
    
    const availableW = PAGE_W - (2 * margin) - (cols - 1) * gapX;
    const availableH = PAGE_H - (2 * margin) - (rows - 1) * gapY;
    
    const imgW = availableW / cols;
    const imgH = imgW / 1.5;
    
    const totalHeight = rows * imgH + (rows - 1) * gapY;
    let finalImgW = imgW;
    let finalImgH = imgH;
    
    if (totalHeight > availableH) {
      const scale = availableH / totalHeight;
      finalImgW = imgW * scale;
      finalImgH = imgH * scale;
    }

    showProgress(true);

    for (let i = 0; i < framesData.length; i++) {
      if (i > 0 && i % photosPerPage === 0) {
        pdf.addPage([PAGE_W, PAGE_H]);
      }

      const posInPage = i % photosPerPage;
      const col = posInPage % cols;
      const row = Math.floor(posInPage / cols);
      
      const x = margin + col * (finalImgW + gapX);
      const y = margin + row * (finalImgH + gapY);

      const frBlob = framesData[i];
      const frUrl = URL.createObjectURL(frBlob);

      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = FRAME_W;
      tempCanvas.height = FRAME_H;
      const tempCtx = tempCanvas.getContext('2d');

      const img = new Image();
      await new Promise((res) => { img.onload = res; img.src = frUrl; });
      tempCtx.drawImage(img, 0, 0, FRAME_W, FRAME_H);

      const frameNum = i + 1;
      tempCtx.font = 'bold 22px Arial';
      tempCtx.textAlign = 'right';
      tempCtx.textBaseline = 'bottom';
      const numText = String(frameNum);
      const metrics = tempCtx.measureText(numText);
      const pad = 6;
      const bgX = FRAME_W - metrics.width - pad * 2;
      const bgY = FRAME_H - 28;
      const bgW = metrics.width + pad * 2;
      const bgH = 24;
      
      tempCtx.fillStyle = 'rgba(0,0,0,0.75)';
      tempCtx.fillRect(bgX, bgY, bgW, bgH);
      tempCtx.fillStyle = '#ffffff';
      tempCtx.fillText(numText, FRAME_W - pad, FRAME_H - 6);

      const imgData = tempCanvas.toDataURL('image/jpeg', JPEG_QUALITY);
      pdf.addImage(imgData, 'JPEG', x, y, finalImgW, finalImgH);

      URL.revokeObjectURL(frUrl);
      
      const currentPage = Math.floor(i / photosPerPage) + 1;
      const totalPages = Math.ceil(framesData.length / photosPerPage);
      setProgress(
        Math.round(((i + 1) / framesData.length) * 100), 
        `PDF: Foto ${i + 1}/${framesData.length} | Hal ${currentPage}/${totalPages}`
      );
    }

    const pdfBlob = pdf.output('blob');
    saveAs(pdfBlob, `${getFileName('MOTIONME')}.pdf`);
    showProgress(false);
    
    const totalPages = Math.ceil(framesData.length / photosPerPage);
    setStatus(`PDF berhasil! ${framesData.length} foto dalam ${totalPages} halaman (8 foto/hal) ✅`);
  };

  // ==============================
  // Init
  // ==============================
  (async () => {
    await listCameras();
    setStatus('Pilih kamera dan opsi rekaman');
  })();
})();
