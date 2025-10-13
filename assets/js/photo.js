// assets/js/photo.js  (module)
// Photobooth: Mirror + Filters panel + capture baked filter
import { Filters } from './filters.js';

const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

const step1 = $('#step1');
const step2 = $('#step2');
const step3 = $('#step3');

const goStep2Btn = $('#goStep2');
const goStep3Btn = $('#goStep3');
const backTo1Btn = $('#backTo1');
const backTo2Btn = $('#backTo2');

const video = $('#video');
const countdownEl = $('#countdown');
const hiddenCanvas = $('#hiddenCanvas');
const ctxHidden = hiddenCanvas.getContext('2d');

const thumbs = $('#thumbs');
const capInfo = $('#capInfo');
const btnCapture = $('#btnCapture');
const btnResetCap = $('#btnResetCap');

const stage = $('#stage');
const g = stage.getContext('2d');

const framePreset = $('#framePreset');
const stickerPreset = $('#stickerPreset');

const btnFrameUpload = $('#btnFrameUpload');
const inputFrameUpload = $('#uploadFrame');
const btnFrameRemove = $('#btnFrameRemove');

const selTarget = $('#selTarget');
const scaleSlider = $('#scale');
const rotateSlider = $('#rotate');
const scaleVal = $('#scaleVal');
const rotVal = $('#rotVal');
const btnCenter = $('#btnCenter');
const btnDelSticker = $('#btnDelSticker');

const btnDownloadJpg = $('#btnDownloadJpg');

let stream = null;

// ============ FILTER PANEL (dibuat di Step 2: cam-side) ============
(function addFilterPanel() {
  const camSide = document.querySelector('#step2 .cam-side');
  if (camSide) {
    const panel = document.createElement('div');
    panel.id = 'filterPanel';
    panel.style.marginTop = '1rem';
    camSide.appendChild(panel);
    Filters.buildPanel(panel, () => {
      // live preview pakai CSS filter
      Filters.applyCSSTo(video);
    });
    Filters.applyCSSTo(video);
  }
})();

// ====== Mirror Kamera di Step 2 ======
let isMirrored = false;
const mirrorBtn = [...document.querySelectorAll('#step2 .step-actions .btn')]
  .find(b => b.textContent.trim().toLowerCase().includes('mirror kamera'));

mirrorBtn?.addEventListener('click', () => {
  isMirrored = !isMirrored;
  video.classList.toggle('mirrored', isMirrored);
  mirrorBtn.classList.toggle('active', isMirrored);
  Filters.applyCSSTo(video);
});

// ====== Step 1: Layout Selection ======
let chosenLayout = '3row';
let photoCount = 3;

// Handle layout selection
$$('.layout-card').forEach(card => {
  card.addEventListener('click', () => {
    $$('.layout-card').forEach(c => c.classList.remove('selected'));
    card.classList.add('selected');
    chosenLayout = card.dataset.layout;
    photoCount = parseInt(card.dataset.count);
  });
});

goStep2Btn.addEventListener('click', () => {
  setupThumbs();
  swap(step1, step2);
  initCamera();
});

backTo1Btn.addEventListener('click', () => {
  stopCamera();
  swap(step2, step1);
});

function setupThumbs() {
  thumbs.innerHTML = '';
  thumbs.style.gridTemplateColumns = photoCount <= 3 ? `repeat(${photoCount}, 1fr)` : 'repeat(3, 1fr)';
  
  for (let i = 0; i < photoCount; i++) {
    const div = document.createElement('div');
    div.className = 'ph empty';
    div.dataset.i = i;
    div.innerHTML = `<span>${i + 1}</span>`;
    thumbs.appendChild(div);
  }
}

// ====== Step 2: Camera & capture ======
let shots = [];
let shotCount = 0;

async function initCamera() {
  shots = new Array(photoCount).fill(null);
  shotCount = 0;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 } });
    video.srcObject = stream;
  } catch (e) {
    alert('Tidak bisa mengakses kamera. Izin kamera ditolak?');
  }
  updateCapInfo();
}

function stopCamera() {
  if (stream) {
    stream.getTracks().forEach(t => t.stop());
    stream = null;
  }
}

function updateCapInfo() {
  capInfo.textContent = `${shotCount}/${photoCount} foto diambil`;
  goStep3Btn.disabled = shotCount < photoCount;
  btnResetCap.disabled = shotCount === 0;
}

async function doCountdown(sec = 3) {
  countdownEl.classList.remove('hidden');
  for (let s = sec; s >= 1; s--) {
    countdownEl.textContent = String(s);
    countdownEl.style.animation = 'none';
    void countdownEl.offsetWidth;
    countdownEl.style.animation = '';
    await wait(1000);
  }
  countdownEl.classList.add('hidden');
}

// CAPTURE: mirror + filter baked
btnCapture.addEventListener('click', async () => {
  if (shotCount >= photoCount) return;
  await doCountdown(3);

  const vw = video.videoWidth || 1280;
  const vh = video.videoHeight || 720;

  // 1) gambar dari video ke tempSrc (mirror jika perlu)
  const tempSrc = document.createElement('canvas');
  tempSrc.width = vw; tempSrc.height = vh;
  const sctx = tempSrc.getContext('2d');

  sctx.save();
  if (isMirrored) {
    sctx.translate(vw, 0);
    sctx.scale(-1, 1);
  }
  sctx.drawImage(video, 0, 0, vw, vh);
  sctx.restore();

  // 2) bake filter ke hiddenCanvas (hasil capture sudah final)
  Filters.bakeToCanvas(hiddenCanvas, tempSrc);

  // 3) buat blob/bitmap dari hiddenCanvas
  const blob = await new Promise(res => hiddenCanvas.toBlob(res, 'image/jpeg', 0.92));
  const bmp = await createImageBitmap(blob);
  shots[shotCount] = bmp;
  shotCount++;

  // Thumbnail
  const cell = thumbs.querySelector(`.ph[data-i="${shotCount-1}"]`);
  cell.classList.remove('empty');
  cell.innerHTML = '';
  const imgUrl = URL.createObjectURL(blob);
  const im = new Image();
  im.src = imgUrl;
  im.onload = () => URL.revokeObjectURL(imgUrl);
  cell.appendChild(im);

  updateCapInfo();
});

// ULANGI 1 FOTO TERAKHIR (bukan semua)
btnResetCap.addEventListener('click', () => {
  if (shotCount === 0) return;
  shotCount--;
  shots[shotCount] = null;

  const cell = thumbs.querySelector(`.ph[data-i="${shotCount}"]`);
  cell.classList.add('empty');
  cell.innerHTML = `<span>${shotCount + 1}</span>`;
  updateCapInfo();
});

goStep3Btn.addEventListener('click', async () => {
  if (shotCount < photoCount) return;

  if (window.consumeOnFirstDownload) {
    const ok = await window.consumeOnFirstDownload('photo');
    if (!ok) return;
  }

  stopCamera();
  swap(step2, step3);
  await initEditor();
});

backTo2Btn.addEventListener('click', () => {
  swap(step3, step2);
  initCamera();
});

// ====== Step 3: Editor ======
let objects = [];
let activeIndex = 0;
let stickerActiveIndex = -1;

async function initEditor() {
  objects = [];

  // Portrait canvas
  stage.width = 720;
  stage.height = 1080;

  // Update select options
  selTarget.innerHTML = '';
  for (let i = 0; i < photoCount; i++) {
    const opt = document.createElement('option');
    opt.value = `p${i}`;
    opt.textContent = `Foto ${i + 1}`;
    selTarget.appendChild(opt);
  }
  const frameOpt = document.createElement('option');
  frameOpt.value = 'frame';
  frameOpt.textContent = 'Frame';
  selTarget.appendChild(frameOpt);
  const stickerOpt = document.createElement('option');
  stickerOpt.value = 'sticker';
  stickerOpt.textContent = 'Sticker Aktif';
  selTarget.appendChild(stickerOpt);

  applyLayout();
  loadFramePresets();
  loadStickerPresets();

  activeIndex = 0;
  selTarget.value = 'p0';
  syncUIToActive();

  draw();
}

function applyLayout() {
  const cw = stage.width;
  const ch = stage.height;

  switch (chosenLayout) {
    case '2row': {
      const cellH = ch / 2;
      for (let i = 0; i < 2; i++) {
        const bmp = shots[i];
        const fit = coverFit(bmp.width, bmp.height, cw, cellH);
        const ox = (cw - fit.w) / 2;
        const oy = i * cellH + (cellH - fit.h) / 2;
        objects.push({ kind: 'photo', img: bmp, x: ox, y: oy, w: fit.w, h: fit.h, rot: 0 });
      }
      break;
    }

    case '3row': {
      const cellH = ch / 3;
      for (let i = 0; i < 3; i++) {
        const bmp = shots[i];
        const fit = coverFit(bmp.width, bmp.height, cw, cellH);
        const ox = (cw - fit.w) / 2;
        const oy = i * cellH + (cellH - fit.h) / 2;
        objects.push({ kind: 'photo', img: bmp, x: ox, y: oy, w: fit.w, h: fit.h, rot: 0 });
      }
      break;
    }

    case '3grid': {
      const topH = ch * 0.5;
      const botH = ch * 0.5;
      const halfW = cw / 2;

      const bmp0 = shots[0];
      const fit0 = coverFit(bmp0.width, bmp0.height, cw, topH);
      objects.push({ kind: 'photo', img: bmp0, x: (cw - fit0.w) / 2, y: (topH - fit0.h) / 2, w: fit0.w, h: fit0.h, rot: 0 });

      const bmp1 = shots[1];
      const fit1 = coverFit(bmp1.width, bmp1.height, halfW, botH);
      objects.push({ kind: 'photo', img: bmp1, x: (halfW - fit1.w) / 2, y: topH + (botH - fit1.h) / 2, w: fit1.w, h: fit1.h, rot: 0 });

      const bmp2 = shots[2];
      const fit2 = coverFit(bmp2.width, bmp2.height, halfW, botH);
      objects.push({ kind: 'photo', img: bmp2, x: halfW + (halfW - fit2.w) / 2, y: topH + (botH - fit2.h) / 2, w: fit2.w, h: fit2.h, rot: 0 });
      break;
    }

    case '4grid': {
      const halfW = cw / 2;
      const halfH = ch / 2;
      const positions = [
        [0, 0], [halfW, 0],
        [0, halfH], [halfW, halfH]
      ];
      for (let i = 0; i < 4; i++) {
        const bmp = shots[i];
        const fit = coverFit(bmp.width, bmp.height, halfW, halfH);
        const [baseX, baseY] = positions[i];
        objects.push({ kind: 'photo', img: bmp, x: baseX + (halfW - fit.w) / 2, y: baseY + (halfH - fit.h) / 2, w: fit.w, h: fit.h, rot: 0 });
      }
      break;
    }

    case '5mix': {
      const topH = ch * 0.25;
      const midH = ch * 0.5;
      const botH = ch * 0.25;
      const halfW = cw / 2;

      for (let i = 0; i < 2; i++) {
        const bmp = shots[i];
        const fit = coverFit(bmp.width, bmp.height, halfW, topH);
        const ox = i * halfW + (halfW - fit.w) / 2;
        objects.push({ kind: 'photo', img: bmp, x: ox, y: (topH - fit.h) / 2, w: fit.w, h: fit.h, rot: 0 });
      }

      const bmp2 = shots[2];
      const fit2 = coverFit(bmp2.width, bmp2.height, cw, midH);
      objects.push({ kind: 'photo', img: bmp2, x: (cw - fit2.w) / 2, y: topH + (midH - fit2.h) / 2, w: fit2.w, h: fit2.h, rot: 0 });

      for (let i = 3; i < 5; i++) {
        const bmp = shots[i];
        const fit = coverFit(bmp.width, bmp.height, halfW, botH);
        const ox = (i - 3) * halfW + (halfW - fit.w) / 2;
        objects.push({ kind: 'photo', img: bmp, x: ox, y: topH + midH + (botH - fit.h) / 2, w: fit.w, h: fit.h, rot: 0 });
      }
      break;
    }
  }
}

function loadFramePresets(max = 12) {
  framePreset.innerHTML = '';
  for (let i = 1; i <= max; i++) {
    const src = `../assets/img/frames/${i}.png`;
    const div = document.createElement('button');
    div.className = 'thumb';
    const img = document.createElement('img');
    img.src = src;
    div.appendChild(img);
    div.addEventListener('click', async () => {
      const el = await loadImage(src);
      let idx = objects.findIndex(o => o.kind === 'frame');
      if (idx === -1) {
        objects.push({ kind: 'frame', img: el, x: 0, y: 0, w: stage.width, h: stage.height, rot: 0 });
        idx = objects.length - 1;
      } else {
        objects[idx].img = el;
      }
      activeIndex = idx;
      selTarget.value = 'frame';
      syncUIToActive();
      draw();
    });
    framePreset.appendChild(div);
  }
}

function loadStickerPresets(max = 20) {
  stickerPreset.innerHTML = '';
  for (let i = 1; i <= max; i++) {
    const src = `../assets/img/aksesoris/${i}.png`;
    const div = document.createElement('button');
    div.className = 'thumb';
    const img = document.createElement('img');
    img.src = src;
    div.appendChild(img);
    div.addEventListener('click', async () => {
      const el = await loadImage(src);
      const w = 200, h = 200;
      objects.push({ kind: 'sticker', img: el, x: (stage.width - w)/2, y: (stage.height - h)/2, w, h, rot: 0 });
      activeIndex = objects.length - 1;
      selTarget.value = 'sticker';
      stickerActiveIndex = activeIndex;
      syncUIToActive();
      draw();
    });
    stickerPreset.appendChild(div);
  }
}

btnFrameUpload.addEventListener('click', () => inputFrameUpload.click());
inputFrameUpload.addEventListener('change', async () => {
  const f = inputFrameUpload.files?.[0];
  if (!f) return;
  const url = URL.createObjectURL(f);
  const el = await loadImage(url);
  URL.revokeObjectURL(url);

  let idx = objects.findIndex(o => o.kind === 'frame');
  if (idx === -1) {
    objects.push({ kind: 'frame', img: el, x: 0, y: 0, w: stage.width, h: stage.height, rot: 0 });
    idx = objects.length - 1;
  } else {
    objects[idx].img = el;
  }
  activeIndex = idx;
  selTarget.value = 'frame';
  syncUIToActive();
  draw();
});

btnFrameRemove.addEventListener('click', () => {
  const idx = objects.findIndex(o => o.kind === 'frame');
  if (idx !== -1) {
    objects.splice(idx, 1);
    activeIndex = 0;
    selTarget.value = 'p0';
    syncUIToActive();
    draw();
  }
});

// ===== Controls =====
selTarget.addEventListener('change', () => {
  const v = selTarget.value;
  if (v === 'frame') {
    const idx = objects.findIndex(o => o.kind === 'frame');
    if (idx !== -1) activeIndex = idx;
  } else if (v === 'sticker') {
    const idx = [...objects].reverse().findIndex(o => o.kind === 'sticker');
    activeIndex = idx === -1 ? 0 : objects.length - 1 - idx;
    stickerActiveIndex = activeIndex;
  } else {
    activeIndex = Number(v.slice(1));
  }
  syncUIToActive();
});

scaleSlider.addEventListener('input', () => {
  const o = objects[activeIndex];
  if (!o) return;
  const scale = Number(scaleSlider.value) / 100;
  const cx = o.x + o.w / 2, cy = o.y + o.h / 2;
  o.w = o.w0 * scale;
  o.h = o.h0 * scale;
  o.x = cx - o.w / 2; 
  o.y = cy - o.h / 2;
  scaleVal.textContent = `${Math.round(scale*100)}%`;
  draw();
});

rotateSlider.addEventListener('input', () => {
  const o = objects[activeIndex];
  if (!o) return;
  o.rot = Number(rotateSlider.value);
  rotVal.textContent = `${o.rot}°`;
  draw();
});

btnCenter.addEventListener('click', () => {
  const o = objects[activeIndex];
  if (!o) return;
  o.x = (stage.width - o.w) / 2;
  o.y = (stage.height - o.h) / 2;
  draw();
});

btnDelSticker.addEventListener('click', () => {
  const idx = objects.findIndex((o, i) => o.kind === 'sticker' && i === activeIndex);
  if (idx !== -1) {
    objects.splice(idx, 1);
    stickerActiveIndex = -1;
    activeIndex = 0; selTarget.value = 'p0';
    syncUIToActive();
    draw();
  }
});

// ===== Drag mouse/touch =====
let drag = { on:false, dx:0, dy:0 };

stage.addEventListener('mousedown', (e) => {
  const p = getPointer(e);
  const hit = hitTest(p.x, p.y);
  if (hit >= 0) {
    activeIndex = hit;
    selTarget.value = (objects[hit].kind === 'photo') ? `p${photoIndex(hit)}` :
                      (objects[hit].kind === 'frame') ? 'frame' : 'sticker';
    syncUIToActive();
    drag.on = true;
    drag.dx = p.x - objects[hit].x;
    drag.dy = p.y - objects[hit].y;
  }
});
window.addEventListener('mousemove', (e) => {
  if (!drag.on) return;
  const p = getPointer(e);
  const o = objects[activeIndex];
  o.x = p.x - drag.dx;
  o.y = p.y - drag.dy;
  draw();
});
window.addEventListener('mouseup', ()=> drag.on=false);

stage.addEventListener('touchstart', (e)=>{
  const t = e.touches[0];
  const rect = stage.getBoundingClientRect();
  const p = { x: (t.clientX-rect.left)*stage.width/rect.width, y: (t.clientY-rect.top)*stage.height/rect.height };
  const hit = hitTest(p.x, p.y);
  if (hit >= 0) {
    activeIndex = hit;
    selTarget.value = (objects[hit].kind === 'photo') ? `p${photoIndex(hit)}` :
                      (objects[hit].kind === 'frame') ? 'frame' : 'sticker';
    syncUIToActive();
    drag.on=true;
    drag.dx = p.x - objects[hit].x;
    drag.dy = p.y - objects[hit].y;
  }
}, {passive:true});
stage.addEventListener('touchmove', (e)=>{
  if (!drag.on) return;
  const t = e.touches[0];
  const rect = stage.getBoundingClientRect();
  const p = { x: (t.clientX-rect.left)*stage.width/rect.width, y: (t.clientY-rect.top)*stage.height/rect.height };
  const o = objects[activeIndex];
  o.x = p.x - drag.dx;
  o.y = p.y - drag.dy;
  draw();
}, {passive:true});
stage.addEventListener('touchend', ()=> drag.on=false);

// ===== Download JPG (bake watermark saja; foto sudah terfilter saat capture) =====
btnDownloadJpg.addEventListener('click', async ()=>{
  const out = document.createElement('canvas');
  out.width = stage.width;
  out.height = stage.height + 40;
  const c = out.getContext('2d');
  c.fillStyle = '#fff';
  c.fillRect(0,0,out.width,out.height);
  c.drawImage(stage, 0, 0);
  
  // Watermark
  c.fillStyle = '#0b1020';
  c.globalAlpha = 0.6;
  c.font = 'bold 18px system-ui,Segoe UI,Roboto,Arial';
  c.textAlign = 'center';
  c.fillText('Motion-US', out.width / 2, out.height - 15);
  c.globalAlpha = 1;

  out.toBlob((blob)=>{
    saveAs(blob, fileName('Photobooth') + '.jpg');
  }, 'image/jpeg', 0.92);
});

// ===== Helpers =====
function swap(a, b){ a.classList.remove('active'); b.classList.add('active'); }

function wait(ms){ return new Promise(r => setTimeout(r, ms)); }

function fileName(prefix){
  const d=new Date();
  const hh = String(d.getHours()).padStart(2,'0');
  const mm = String(d.getMinutes()).padStart(2,'0');
  const dd = String(d.getDate()).padStart(2,'0');
  const mo = String(d.getMonth()+1).padStart(2,'0');
  const yy = d.getFullYear();
  return `${prefix}-${hh}${mm}-${dd}${mo}-${yy}`;
}

function coverFit(srcW, srcH, dstW, dstH) {
  const s = Math.max(dstW/srcW, dstH/srcH);
  return { w: srcW*s, h: srcH*s };
}

function getPointer(e){
  const rect = stage.getBoundingClientRect();
  const x = (e.clientX-rect.left) * stage.width / rect.width;
  const y = (e.clientY-rect.top) * stage.height / rect.height;
  return {x,y};
}

function photoIndex(objIdx){
  let k = -1;
  for (let i=0, p=0; i<objects.length; i++){
    if (objects[i].kind === 'photo'){
      if (i === objIdx) { k = p; break; }
      p++;
    }
  }
  return k < 0 ? 0 : k;
}

function hitTest(px, py){
  for (let i = objects.length - 1; i >= 0; i--) {
    const o = objects[i];
    if (px >= o.x && px <= o.x + o.w && py >= o.y && py <= o.y + o.h) return i;
  }
  return -1;
}

function loadImage(src){
  return new Promise((resolve, reject)=>{
    const im = new Image();
    im.crossOrigin = 'anonymous';
    im.onload = ()=> resolve(im);
    im.onerror = reject;
    im.src = src;
  });
}

function syncUIToActive(){
  const o = objects[activeIndex];
  if (!o) return;

  if (o.w0 == null || o.h0 == null) { o.w0 = o.w; o.h0 = o.h; }

  const scale = Math.max(10, Math.round((o.w / o.w0) * 100));
  scaleSlider.value = String(scale);
  scaleVal.textContent = `${scale}%`;
  rotateSlider.value = String(Math.round(o.rot));
  rotVal.textContent = `${Math.round(o.rot)}°`;
}

function draw(){
  g.fillStyle = '#fff';
  g.fillRect(0,0,stage.width,stage.height);

  const photos = objects.filter(o=>o.kind==='photo');
  const stickers = objects.filter(o=>o.kind==='sticker');
  const frames = objects.filter(o=>o.kind==='frame');

  [...photos, ...stickers, ...frames].forEach(o => drawObject(o));
}

function drawObject(o){
  g.save();
  g.translate(o.x + o.w/2, o.y + o.h/2);
  g.rotate(o.rot * Math.PI/180);
  g.drawImage(o.img, -o.w/2, -o.h/2, o.w, o.h);
  g.restore();
}

// ===== init badge + logout button =====
import { initTokenBadge, logoutUser } from './badge.js';
initTokenBadge();
$('#btnLogout')?.addEventListener('click', logoutUser);




// // assets/js/photo.js
// import { consumeOnFirstDownload, resetDownloadCharge } from './charge-on-download.js';

// let selectedFrame = null;
// let capturedPhotos = [];
// let photoCount = 0;
// let stream = null;
// let selectedPhotoIndex = 0;
// let isDragging = false, dragOffset = { x: 0, y: 0 };

// const photoTransforms = [
//   { x: 100, y: 100, scale: 1, rotation: 0 },
//   { x: 300, y: 100, scale: 1, rotation: 0 },
//   { x: 500, y: 100, scale: 1, rotation: 0 }
// ];

// const defaultFrames = [
//   {
//     name: "Frame Classic",
//     data: 'data:image/svg+xml;base64,' + btoa(
//       `<svg width="800" height="600" xmlns="http://www.w3.org/2000/svg">
//         <rect width="800" height="600" fill="white"/>
//         <rect x="50" y="50" width="200" height="150" fill="none" stroke="#667eea" stroke-width="8" rx="10"/>
//         <rect x="300" y="50" width="200" height="150" fill="none" stroke="#667eea" stroke-width="8" rx="10"/>
//         <rect x="550" y="50" width="200" height="150" fill="none" stroke="#667eea" stroke-width="8" rx="10"/>
//         <text x="400" y="280" font-family="Arial" font-size="48" fill="#667eea" text-anchor="middle" font-weight="bold">MOTION-US</text>
//       </svg>`
//     )
//   },
//   {
//     name: "Frame Gradient",
//     data: 'data:image/svg+xml;base64,' + btoa(
//       `<svg width="800" height="600" xmlns="http://www.w3.org/2000/svg">
//         <defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
//           <stop offset="0%" style="stop-color:#667eea;"/><stop offset="100%" style="stop-color:#764ba2;"/>
//         </linearGradient></defs>
//         <rect width="800" height="600" fill="url(#g)"/>
//         <circle cx="150" cy="125" r="80" fill="white" opacity="0.9"/>
//         <circle cx="400" cy="125" r="80" fill="white" opacity="0.9"/>
//         <circle cx="650" cy="125" r="80" fill="white" opacity="0.9"/>
//       </svg>`
//     )
//   }
// ];

// document.addEventListener('DOMContentLoaded', () => {
//   loadFrames();

//   document.getElementById('frameUpload').addEventListener('change', handleFrameUpload);
//   document.getElementById('btnToStep2').addEventListener('click', goToStep2);
//   document.getElementById('captureBtn').addEventListener('click', capturePhoto);
//   document.getElementById('resetBtn').addEventListener('click', resetPhotos);
//   document.getElementById('btnToStep3').addEventListener('click', goToStep3);
//   document.getElementById('backToStep2').addEventListener('click', () => showStep(2));
//   document.getElementById('downloadBtn').addEventListener('click', downloadResult);

//   document.getElementById('scaleSlider').addEventListener('input', (e) => updatePhotoScale(e.target.value));
//   document.getElementById('rotationSlider').addEventListener('input', (e) => updatePhotoRotation(e.target.value));
// });

// function loadFrames() {
//   const frameOptions = document.getElementById('frameOptions');
//   defaultFrames.forEach(frame => {
//     const div = document.createElement('div');
//     div.className = 'frame-option';
//     div.onclick = () => selectFrame(frame.data, div);
//     div.innerHTML = `<img src="${frame.data}" alt="${frame.name}"><p>${frame.name}</p>`;
//     frameOptions.appendChild(div);
//   });
// }

// function selectFrame(frameData, element) {
//   document.querySelectorAll('.frame-option').forEach(el => el.classList.remove('selected'));
//   element.classList.add('selected');
//   selectedFrame = frameData;
// }

// function handleFrameUpload(e) {
//   const file = e.target.files[0];
//   if (file) {
//     const reader = new FileReader();
//     reader.onload = ev => selectedFrame = ev.target.result;
//     reader.readAsDataURL(file);
//   }
// }

// function showStep(step) {
//   document.querySelectorAll('.step').forEach(el => el.classList.remove('active'));
//   document.getElementById('step' + step).classList.add('active');
// }

// async function goToStep2() {
//   if (!selectedFrame) return alert('Pilih frame terlebih dahulu!');
//   showStep(2);

//   // ✅ mulai sesi baru → reset flag charge
//   resetDownloadCharge();

//   try {
//     stream = await navigator.mediaDevices.getUserMedia({ video: true });
//     document.getElementById('video').srcObject = stream;
//   } catch (err) {
//     alert('Tidak dapat akses kamera: ' + err.message);
//   }
// }

// function goToStep3() {
//   stopCamera();
//   showStep(3);
//   initPreview();
// }

// function stopCamera() {
//   if (stream) stream.getTracks().forEach(t => t.stop());
// }

// function capturePhoto() {
//   if (photoCount >= 3) return;
//   const video = document.getElementById('video');
//   const canvas = document.getElementById('canvas');
//   const countdown = document.getElementById('countdown');

//   let count = 3;
//   countdown.style.display = 'block';
//   countdown.textContent = count;

//   const timer = setInterval(() => {
//     count--;
//     countdown.textContent = count > 0 ? count : '📸';
//     if (count <= 0) {
//       clearInterval(timer);
//       setTimeout(() => {
//         canvas.width = video.videoWidth;
//         canvas.height = video.videoHeight;
//         canvas.getContext('2d').drawImage(video, 0, 0);
//         const photoData = canvas.toDataURL('image/png');
//         capturedPhotos.push(photoData);
//         photoCount++;
//         const slot = document.getElementById('photo' + photoCount);
//         slot.innerHTML = `<img src="${photoData}">`;
//         slot.classList.remove('empty');
//         document.getElementById('photoCount').textContent = photoCount;
//         countdown.style.display = 'none';
//         if (photoCount === 3) document.getElementById('btnToStep3').style.display = 'inline-block';
//       }, 500);
//     }
//   }, 1000);
// }

// function resetPhotos() {
//   if (!confirm('Hapus semua foto?')) return;
//   capturedPhotos = [];
//   photoCount = 0;
//   document.getElementById('photoCount').textContent = 0;
//   document.getElementById('btnToStep3').style.display = 'none';
//   for (let i = 1; i <= 3; i++) {
//     const el = document.getElementById('photo' + i);
//     el.innerHTML = '';
//     el.classList.add('empty');
//   }
//   // ✅ reset flag charge karena user mulai ulang
//   resetDownloadCharge();
// }

// // ================= Preview & Editing =================
// function initPreview() {
//   const canvas = document.getElementById('previewCanvas');
//   canvas.width = 800;
//   canvas.height = 600;
//   canvas.addEventListener('mousedown', startDrag);
//   canvas.addEventListener('mousemove', drag);
//   canvas.addEventListener('mouseup', endDrag);
//   drawPreview();
// }

// function drawPreview() {
//   const canvas = document.getElementById('previewCanvas');
//   const ctx = canvas.getContext('2d');
//   ctx.clearRect(0, 0, canvas.width, canvas.height);

//   const frameImg = new Image();
//   frameImg.onload = () => {
//     ctx.drawImage(frameImg, 0, 0, canvas.width, canvas.height);
//     capturedPhotos.forEach((p, i) => {
//       const img = new Image();
//       img.onload = () => {
//         const t = photoTransforms[i];
//         ctx.save();
//         ctx.translate(t.x, t.y);
//         ctx.rotate(t.rotation * Math.PI / 180);
//         ctx.scale(t.scale, t.scale);
//         const size = 150;
//         ctx.drawImage(img, -size / 2, -size / 2, size, size);
//         if (i === selectedPhotoIndex) {
//           ctx.strokeStyle = '#667eea'; ctx.lineWidth = 3;
//           ctx.strokeRect(-size / 2, -size / 2, size, size);
//         }
//         ctx.restore();
//       };
//       img.src = p;
//     });
//   };
//   frameImg.src = selectedFrame;
// }

// function startDrag(e) {
//   const rect = e.target.getBoundingClientRect();
//   const x = e.clientX - rect.left, y = e.clientY - rect.top;
//   const t = photoTransforms[selectedPhotoIndex];
//   const size = 150 * t.scale;
//   if (Math.abs(x - t.x) < size / 2 && Math.abs(y - t.y) < size / 2) {
//     isDragging = true;
//     dragOffset.x = x - t.x;
//     dragOffset.y = y - t.y;
//   }
// }

// function drag(e) {
//   if (!isDragging) return;
//   const rect = e.target.getBoundingClientRect();
//   const x = e.clientX - rect.left, y = e.clientY - rect.top;
//   photoTransforms[selectedPhotoIndex].x = x - dragOffset.x;
//   photoTransforms[selectedPhotoIndex].y = y - dragOffset.y;
//   drawPreview();
// }

// function endDrag() { isDragging = false; }

// window.selectPhoto = function(i) {
//   selectedPhotoIndex = i;
//   document.getElementById('scaleSlider').value = photoTransforms[i].scale * 100;
//   document.getElementById('rotationSlider').value = photoTransforms[i].rotation;
//   document.getElementById('scaleValue').textContent = Math.round(photoTransforms[i].scale * 100) + '%';
//   document.getElementById('rotationValue').textContent = photoTransforms[i].rotation + '°';
//   drawPreview();
// };

// function updatePhotoScale(val) {
//   const scale = val / 100;
//   photoTransforms[selectedPhotoIndex].scale = scale;
//   document.getElementById('scaleValue').textContent = val + '%';
//   drawPreview();
// }

// function updatePhotoRotation(val) {
//   const rotation = parseInt(val);
//   photoTransforms[selectedPhotoIndex].rotation = rotation;
//   document.getElementById('rotationValue').textContent = rotation + '°';
//   drawPreview();
// }

// async function downloadResult() {
//   // ✅ Potong token hanya saat klik download pertama
//   const ok = await consumeOnFirstDownload('photo');
//   if (!ok) return;

//   // Pastikan preview terbaru tergambar
//   drawPreview();

//   const canvas = document.getElementById('previewCanvas');
//   const link = document.createElement('a');
//   link.download = 'photobooth.png';
//   link.href = canvas.toDataURL('image/png');
//   link.click();
// }
