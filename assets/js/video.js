// assets/js/video.js
// Video Booth: Mirror + Filters + ZIP/PDF
// Pastikan file ini di-load sebagai type="module" di HTML
import { Filters } from './filters.js';

(() => {
  // 📐 Konstanta
  const FRAME_W = 360;
  const FRAME_H = 270;
  const JPEG_QUALITY = 0.92;
  const PAGE_W = 595; // A4 px (portrait)
  const PAGE_H = 842;

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
  const mirrorBtn =
    document.querySelector('.vid-left #backTo1') ||
    [...document.querySelectorAll('.vid-left .btn')].find(b =>
      b.textContent.trim().toLowerCase().includes('mirror kamera')
    );

  let isMirrored = false;

  mirrorBtn?.addEventListener('click', () => {
    isMirrored = !isMirrored;
    live.classList.toggle('mirrored', isMirrored);
    playback.classList.toggle('mirrored', isMirrored);
    mirrorBtn.classList.toggle('active', isMirrored);
    // apply ulang CSS filter biar konsisten
    Filters.applyCSSTo(live);
    Filters.applyCSSTo(playback);
  });

  // ===== Filters Panel (dibuat otomatis di sisi kanan)
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

  // ==============================
  // Supabase helpers (optional upload frame)
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
    recordDuration = 10; recordFps = 6;
    setStatus('Opsi A: 10s @6fps (60 foto)');
  };
  optB.onclick = () => {
    recordDuration = 20; recordFps = 3;
    setStatus('Opsi B: 20s @3fps (60 foto)');
  };

  // ==============================
  // Upload Frame
  // ==============================
  btnFramePick.onclick = () => frameInput.click();
  frameInput.onchange = async () => {
    const file = frameInput.files?.[0];
    if (!file) return;
    await uploadFrameToBucket(file); // optional
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
      setStatus('Rekaman selesai! Silakan download ZIP atau PDF');
      // Tampilkan filter di playback juga
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
  // Ekstrak Frame (mirror + filters baked)
  // ==============================
  async function fastExtract(blob, fps) {
    setStatus('Mengekstrak frame dari video...');
    const video = document.createElement('video');
    video.src = URL.createObjectURL(blob);
    await new Promise((r) => (video.onloadedmetadata = r));

    let dur = video.duration;
    if (!isFinite(dur) || dur > 600) dur = recordDuration;

    const totalFrames = Math.min(Math.floor(dur * fps), fps * recordDuration);

    // canvas output final
    const canvas = document.createElement('canvas');
    canvas.width = FRAME_W; canvas.height = FRAME_H;

    const frames = [];
    showProgress(true);

    for (let i = 0; i < totalFrames; i++) {
      const t = i / fps;
      video.currentTime = t;
      await new Promise((r) => (video.onseeked = r));

      const vw = video.videoWidth, vh = video.videoHeight;

      // 1) crop ke tempSrc (FRAME_W x FRAME_H), sekaligus mirror bila perlu
      const tempSrc = document.createElement('canvas');
      tempSrc.width = FRAME_W; tempSrc.height = FRAME_H;
      const sctx = tempSrc.getContext('2d');

      const s = Math.max(FRAME_W / vw, FRAME_H / vh);
      const sw = FRAME_W / s, sh = FRAME_H / s;
      const sx = (vw - sw) / 2, sy = (vh - sh) / 2;

      sctx.save();
      if (isMirrored) {
        sctx.translate(FRAME_W, 0);
        sctx.scale(-1, 1);
      }
      sctx.drawImage(video, sx, sy, sw, sh, 0, 0, FRAME_W, FRAME_H);
      sctx.restore();

      // 2) bake filter + vignette/grain ke canvas output
      Filters.bakeToCanvas(canvas, tempSrc);

      // 3) overlay frame png jika ada
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
  // Download ZIP
  // ==============================
  downloadZip.onclick = async () => {
    if (!recordedBlob) return alert('Rekam video dulu');

    if (window.consumeOnFirstDownload) {
      const ok = await window.consumeOnFirstDownload('video');
      if (!ok) return;
    }

    setStatus('Membuat ZIP...');
    framesData = await fastExtract(recordedBlob, recordFps);

    const zip = new JSZip();
    const folder = zip.folder(getFileName('MOTIONME'));
    showProgress(true);

    for (let i = 0; i < framesData.length; i++) {
      const b = framesData[i];
      const buf = await b.arrayBuffer();
      folder.file(`frame_${String(i + 1).padStart(4, '0')}.jpg`, buf);
      setProgress(Math.round(((i + 1) / framesData.length) * 100), `ZIP ${i + 1}/${framesData.length}`);
    }

    const blob = await zip.generateAsync({ type: 'blob' });
    saveAs(blob, `${getFileName('MOTIONME')}.zip`);
    showProgress(false);
    setStatus('ZIP berhasil didownload ✅');
  };

  // ==============================
  // Download PDF (6 per halaman)
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

    const cols = 2, rows = 3;
    const margin = 15, gapX = 10, gapY = 10;
    const availableW = PAGE_W - 2 * margin - gapX;
    const availableH = PAGE_H - 2 * margin - 2 * gapY;
    const imgW = availableW / cols;
    const imgH = availableH / rows;

    showProgress(true);

    for (let i = 0; i < framesData.length; i++) {
      if (i > 0 && i % 6 === 0) pdf.addPage([PAGE_W, PAGE_H]);

      const posInPage = i % 6;
      const col = posInPage % 2;
      const row = Math.floor(posInPage / 2);
      const x = margin + col * (imgW + gapX);
      const y = margin + row * (imgH + gapY);

      const frBlob = framesData[i];
      const frUrl = URL.createObjectURL(frBlob);

      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = FRAME_W;
      tempCanvas.height = FRAME_H;
      const tempCtx = tempCanvas.getContext('2d');

      const img = new Image();
      await new Promise((res) => { img.onload = res; img.src = frUrl; });
      tempCtx.drawImage(img, 0, 0, FRAME_W, FRAME_H);

      // nomor kecil
      const frameNum = i + 1;
      tempCtx.font = 'bold px Arial';
      tempCtx.textAlign = 'right';
      tempCtx.textBaseline = 'bottom';
      const numText = String(frameNum);
      const metrics = tempCtx.measureText(numText);
      const pad = 1;
      const bgX = FRAME_W - metrics.width - pad * 2;
      const bgY = FRAME_H - 30;
      const bgW = metrics.width + pad * 2;
      const bgH = 26;
      tempCtx.fillStyle = 'rgba(0,0,0,0.7)';
      tempCtx.fillRect(bgX, bgY, bgW, bgH);
      tempCtx.fillStyle = '#fff';
      tempCtx.fillText(numText, FRAME_W - pad, FRAME_H - 8);

      const imgData = tempCanvas.toDataURL('image/jpeg', JPEG_QUALITY);
      pdf.addImage(imgData, 'JPEG', x, y, imgW, imgH);

      URL.revokeObjectURL(frUrl);
      setProgress(Math.round(((i + 1) / framesData.length) * 100), `PDF ${i + 1}/${framesData.length}`);
    }

    const pdfBlob = pdf.output('blob');
    saveAs(pdfBlob, `${getFileName('MOTIONME')}.pdf`);
    showProgress(false);
    setStatus('PDF berhasil didownload ✅');
  };

  // ==============================
  // Init
  // ==============================
  (async () => {
    await listCameras();
    setStatus('Pilih kamera dan opsi rekaman');
  })();
})();









// (async function(){
//   // 📸 Ukuran untuk A4 landscape dengan 6 foto
//   const FRAME_W = 360;
//   const FRAME_H = 270;
//   const JPEG_QUALITY = 0.92;

//   // A4 dalam pixel (portrait)
//   const PAGE_W = 595;
//   const PAGE_H = 842;

//   const live = document.getElementById('live');
//   const playback = document.getElementById('playback');
//   const startRec = document.getElementById('startRec');
//   const stopRec = document.getElementById('stopRec');
//   const optA = document.getElementById('optA');
//   const optB = document.getElementById('optB');
//   const downloadZip = document.getElementById('downloadZip');
//   const downloadPdf = document.getElementById('downloadPdf');
//   const retakeBtn = document.getElementById('retake');
//   const cameraBtns = document.getElementById('cameraBtns');
//   const timerEl = document.getElementById('timer');
//   const statusEl = document.getElementById('status');
//   const progressWrap = document.getElementById('progressWrap');
//   const progressBar = document.getElementById('progressBar');
//   const progressText = document.getElementById('progressText');
//   const frameInput = document.getElementById('frameInput');
//   const framePreview = document.getElementById('framePreview');

//   let mediaStream=null, mediaRecorder=null, recordedChunks=[], recordedBlob=null;
//   let recordDuration=0, recordFps=3, elapsed=0, timerInterval=null;
//   let framesData=[];
//   let frameOverlayImage=null;

//   function setStatus(msg){ statusEl.textContent = msg; }
//   function showProgress(show){
//     progressWrap.style.display = show ? 'block' : 'none';
//     if(!show){
//       progressBar.style.width='0%';
//       progressText.textContent='';
//     }
//   }
//   function setProgress(p,text=''){
//     progressBar.style.width = `${p}%`;
//     progressText.textContent = text;
//   }

//   // ⏰ Nama file MOTIONME-JAM-TANGGAL-BULAN-TAHUN
//   function getFileName(prefix){
//     const d=new Date();
//     const jam=String(d.getHours()).padStart(2,'0')+String(d.getMinutes()).padStart(2,'0');
//     const tgl=String(d.getDate()).padStart(2,'0');
//     const bln=String(d.getMonth()+1).padStart(2,'0');
//     const thn=d.getFullYear();
//     return `${prefix}-${jam}-${tgl}-${bln}-${thn}`;
//   }

//   // 🎥 List kamera
//   async function listCameras(){
//     try{
//       await navigator.mediaDevices.getUserMedia({video:true});
//     }catch(e){
//       console.log('Permission request:', e);
//     }
//     const devices=await navigator.mediaDevices.enumerateDevices();
//     const cams=devices.filter(d=>d.kind==='videoinput');
//     cameraBtns.innerHTML='';
//     cams.forEach((cam,idx)=>{
//       const btn=document.createElement('button');
//       btn.textContent=cam.label||`Kamera ${idx+1}`;
//       btn.className='secondary';
//       btn.onclick=()=>selectCamera(cam.deviceId,btn.textContent);
//       cameraBtns.appendChild(btn);
//     });
//   }

//   async function selectCamera(id,label){
//     if(mediaStream) mediaStream.getTracks().forEach(t=>t.stop());
//     mediaStream=await navigator.mediaDevices.getUserMedia({
//       video:{
//         deviceId:{exact:id},
//         width:{ideal:1280},
//         height:{ideal:720}
//       }
//     });
//     live.srcObject=mediaStream;
//     setStatus(`Kamera aktif: ${label}`);
//     startRec.disabled=false;
//   }

//   optA.onclick=()=>{
//     recordDuration=10;
//     recordFps=6;
//     setStatus('Opsi A: 10s @6fps (60 foto)');
//   }

//   optB.onclick=()=>{
//     recordDuration=20;
//     recordFps=3;
//     setStatus('Opsi B: 20s @3fps (60 foto)');
//   }

//   // ⏺️ Rekam
//   startRec.onclick=()=>{
//     if(!mediaStream||!recordDuration){
//       alert('Pilih kamera & opsi dulu');
//       return;
//     }
//     recordedChunks=[];
//     framesData=[];

//     try{
//       mediaRecorder=new MediaRecorder(mediaStream,{mimeType:'video/webm;codecs=vp8'});
//     }catch(e){
//       mediaRecorder=new MediaRecorder(mediaStream);
//     }

//     mediaRecorder.ondataavailable=e=>{
//       if(e.data.size) recordedChunks.push(e.data);
//     }

//     mediaRecorder.onstop=()=>{
//       recordedBlob=new Blob(recordedChunks,{type:'video/webm'});
//       playback.src=URL.createObjectURL(recordedBlob);
//       playback.style.display='block';
//       downloadZip.disabled=false;
//       downloadPdf.disabled=false;
//       retakeBtn.disabled=false;
//       setStatus('Rekaman selesai! Silakan download ZIP atau PDF');
//     };

//     mediaRecorder.start(100);
//     startRec.disabled=true;
//     stopRec.disabled=false;
//     elapsed=0;
//     timerEl.textContent=`Detik: ${elapsed}/${recordDuration}`;

//     timerInterval=setInterval(()=>{
//       elapsed++;
//       timerEl.textContent=`Detik: ${elapsed}/${recordDuration}`;
//       if(elapsed>=recordDuration){
//         stopRec.click();
//       }
//     },1000);
//   };

//   stopRec.onclick=()=>{
//     if(mediaRecorder&&mediaRecorder.state==='recording') mediaRecorder.stop();
//     clearInterval(timerInterval);
//     startRec.disabled=false;
//     stopRec.disabled=true;
//   };

//   retakeBtn.onclick=()=>{
//     recordedChunks=[];
//     framesData=[];
//     recordedBlob=null;
//     playback.style.display='none';
//     playback.src='';
//     downloadZip.disabled=true;
//     downloadPdf.disabled=true;
//     retakeBtn.disabled=true;
//     timerEl.textContent='Detik: 0 / 0';
//     setStatus('Siap untuk rekam ulang');

//     // ADDED: reset flag charge agar sesi rekam berikutnya memotong token lagi
//     if (window.resetDownloadCharge) window.resetDownloadCharge();
//   };

//   // 📥 Load frame.png
//   frameInput.onchange=()=>{
//     const file=frameInput.files[0];
//     if(file){
//       const img=new Image();
//       img.onload=()=>{
//         frameOverlayImage=img;
//         framePreview.src=img.src;
//         framePreview.style.display='block';
//         setStatus('Frame.png dimuat ✅ (akan dioverlay ke semua foto)');
//       };
//       img.src=URL.createObjectURL(file);
//     }
//   };

//   // 🖼️ Ekstraksi frame dari video
//   async function fastExtract(blob,fps){
//     setStatus('Mengekstrak frame dari video...');
//     const video=document.createElement('video');
//     video.src=URL.createObjectURL(blob);

//     await new Promise(r=>video.onloadedmetadata=r);

//     let dur=video.duration;
//     if(!isFinite(dur)||dur>600){
//       dur=recordDuration;
//     }

//     const totalFrames=Math.min(Math.floor(dur*fps), fps*recordDuration);
//     const canvas=document.createElement('canvas');
//     canvas.width=FRAME_W;
//     canvas.height=FRAME_H;
//     const ctx=canvas.getContext('2d');
//     const frames=[];

//     showProgress(true);

//     for(let i=0;i<totalFrames;i++){
//       const t=i/fps;
//       video.currentTime=t;
//       await new Promise(r=>video.onseeked=r);

//       ctx.clearRect(0,0,FRAME_W,FRAME_H);

//       // Draw video dengan crop center
//       const vw=video.videoWidth, vh=video.videoHeight;
//       const s=Math.max(FRAME_W/vw,FRAME_H/vh);
//       const sw=FRAME_W/s, sh=FRAME_H/s;
//       const sx=(vw-sw)/2, sy=(vh-sh)/2;
//       ctx.drawImage(video,sx,sy,sw,sh,0,0,FRAME_W,FRAME_H);

//       // Jika ada frame overlay, gambar di atas foto
//       if(frameOverlayImage){
//         ctx.drawImage(frameOverlayImage,0,0,FRAME_W,FRAME_H);
//       }

//       const blobFrame=await new Promise(res=>canvas.toBlob(res,'image/jpeg',JPEG_QUALITY));
//       frames.push(blobFrame);

//       setProgress(Math.round(((i+1)/totalFrames)*100),`Frame ${i+1}/${totalFrames}`);
//       await new Promise(requestAnimationFrame);
//     }

//     showProgress(false);
//     return frames;
//   }

//   // ZIP download
//   downloadZip.onclick=async()=>{
//     if(!recordedBlob){
//       alert('Rekam video dulu');
//       return;
//     }

//     // ADDED: potong token sekali saat download pertama pada sesi rekam ini
//     if (window.consumeOnFirstDownload) {
//       const ok = await window.consumeOnFirstDownload('video');
//       if (!ok) return; // batal jika token habis / gagal charge
//     }

//     setStatus('Membuat ZIP...');
//     framesData=await fastExtract(recordedBlob,recordFps);

//     const zip=new JSZip();
//     const folder=zip.folder(getFileName('MOTIONME'));

//     showProgress(true);
//     for(let i=0;i<framesData.length;i++){
//       const b=framesData[i];
//       const buf=await b.arrayBuffer();
//       folder.file(`frame_${String(i+1).padStart(4,'0')}.jpg`,buf);
//       setProgress(Math.round(((i+1)/framesData.length)*100),`ZIP ${i+1}/${framesData.length}`);
//     }

//     const blob=await zip.generateAsync({type:'blob'});
//     saveAs(blob,`${getFileName('MOTIONME')}.zip`);
//     showProgress(false);
//     setStatus('ZIP berhasil didownload ✅');
//   };

//   // PDF download (6 foto per halaman, 2 kolom x 3 baris)
//   downloadPdf.onclick=async()=>{
//     if(!recordedBlob){
//       alert('Rekam video dulu');
//       return;
//     }

//     // ADDED: potong token sekali saat download pertama pada sesi rekam ini
//     if (window.consumeOnFirstDownload) {
//       const ok = await window.consumeOnFirstDownload('video');
//       if (!ok) return; // batal jika token habis / gagal charge
//     }

//     setStatus('Membuat PDF...');

//     if(framesData.length===0){
//       framesData=await fastExtract(recordedBlob,recordFps);
//     }

//     const { jsPDF } = window.jspdf;
//     const pdf=new jsPDF({
//       orientation: 'portrait',
//       unit:'px',
//       format:[PAGE_W,PAGE_H]
//     });

//     const cols=2, rows=3;
//     const margin=15;
//     const gapX=10;
//     const gapY=10;

//     const availableW = PAGE_W - (2*margin) - gapX;
//     const availableH = PAGE_H - (2*margin) - (2*gapY);

//     const imgW = availableW / cols;
//     const imgH = availableH / rows;

//     const total=framesData.length;

//     showProgress(true);

//     for(let i=0;i<total;i++){
//       // Tambah halaman baru setiap 6 foto
//       if(i>0 && i%6===0){
//         pdf.addPage([PAGE_W,PAGE_H]);
//       }

//       const posInPage = i % 6;
//       const col = posInPage % 2;
//       const row = Math.floor(posInPage / 2);

//       const x = margin + col * (imgW + gapX);
//       const y = margin + row * (imgH + gapY);

//       const frBlob=framesData[i];
//       const frUrl=URL.createObjectURL(frBlob);

//       // Convert blob ke base64 untuk jsPDF + nomor urut
//       const tempCanvas = document.createElement('canvas');
//       tempCanvas.width = FRAME_W;
//       tempCanvas.height = FRAME_H;
//       const tempCtx = tempCanvas.getContext('2d');

//       // Gambar foto
//       const img = new Image();
//       await new Promise((resolve)=>{
//         img.onload = resolve;
//         img.src = frUrl;
//       });
//       tempCtx.drawImage(img, 0, 0, FRAME_W, FRAME_H);

//       // Tambahkan nomor urut
//       const frameNum = i + 1;
//       tempCtx.font = 'bold 20px Arial';
//       tempCtx.textAlign = 'right';
//       tempCtx.textBaseline = 'bottom';

//       // Background hitam semi-transparan untuk nomor
//       const numText = String(frameNum);
//       const textMetrics = tempCtx.measureText(numText);
//       const padding = 8;
//       const bgX = FRAME_W - textMetrics.width - padding * 2;
//       const bgY = FRAME_H - 30;
//       const bgW = textMetrics.width + padding * 2;
//       const bgH = 26;

//       tempCtx.fillStyle = 'rgba(0, 0, 0, 0.7)';
//       tempCtx.fillRect(bgX, bgY, bgW, bgH);

//       // Teks putih untuk nomor
//       tempCtx.fillStyle = '#ffffff';
//       tempCtx.fillText(numText, FRAME_W - padding, FRAME_H - 8);

//       const imgData = tempCanvas.toDataURL('image/jpeg', JPEG_QUALITY);
//       pdf.addImage(imgData,'JPEG',x,y,imgW,imgH);

//       URL.revokeObjectURL(frUrl);
//       setProgress(Math.round(((i+1)/total)*100),`PDF ${i+1}/${total}`);
//     }

//     const pdfBlob=pdf.output('blob');
//     saveAs(pdfBlob,`${getFileName('MOTIONME')}.pdf`);
//     showProgress(false);
//     setStatus('PDF berhasil didownload ✅');
//   };

//   // Initialize
//   await listCameras();
//   setStatus('Pilih kamera dan opsi rekaman');
// })();
