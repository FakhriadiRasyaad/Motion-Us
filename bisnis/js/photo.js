// assets/js/photo.js  (module) — No token version
// Photobooth: Vertical Layout + Frame Wrap + Mirror + Filters + Enhanced Controls + Upload Sticker + Layer Control
import { Filters } from '../../assets/js/filters.js';

const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

/* ===============================
   BRAND (welcomeTarget-aware)
   =============================== */
function getBrand() {
  // 1) dari elemen di halaman (kalau ada)
  const el = document.getElementById('welcomeTarget');
  const t = el?.textContent?.trim();
  if (t) return t;

  // 2) dari localStorage
  const ls = localStorage.getItem('appName');
  if (ls && ls.trim()) return ls.trim();

  // 3) default
  return 'Motion-US';
}
const BRAND = getBrand();
const wmEl = document.querySelector('.wm');
if (wmEl) wmEl.textContent = BRAND;

/* ===============================
   DOM
   =============================== */
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
const btnMirror = $('#btnMirror');

const stage = $('#stage');
const g = stage.getContext('2d');

const framePreset = $('#framePreset');
const stickerPreset = $('#stickerPreset');

const btnFrameUpload = $('#btnFrameUpload');
const inputFrameUpload = $('#uploadFrame');
const btnFrameRemove = $('#btnFrameRemove');

const btnStickerUpload = $('#btnStickerUpload');
const inputStickerUpload = $('#uploadSticker');

const selTarget = $('#selTarget');
const scaleSlider = $('#scale');
const rotateSlider = $('#rotate');
const scaleVal = $('#scaleVal');
const rotVal = $('#rotVal');
const btnCenter = $('#btnCenter');
const btnDelSticker = $('#btnDelSticker');

// Control buttons
const scaleUp = $('#scaleUp');
const scaleDown = $('#scaleDown');
const rotateLeft = $('#rotateLeft');
const rotateRight = $('#rotateRight');
const moveUp = $('#moveUp');
const moveDown = $('#moveDown');
const moveLeft = $('#moveLeft');
const moveRight = $('#moveRight');

// Layer control buttons
const btnBringFront = $('#btnBringFront');
const btnSendBack = $('#btnSendBack');

const btnDownloadJpg = $('#btnDownloadJpg');

let stream = null;

/* ===============================
   FILTER PANEL
   =============================== */
(function addFilterPanel() {
  const filterPanelEl = $('#filterPanel');
  if (filterPanelEl) {
    Filters.buildPanel(filterPanelEl, () => {
      Filters.applyCSSTo(video);
    });
    Filters.applyCSSTo(video);
  }
})();

/* ===============================
   Mirror Kamera
   =============================== */
let isMirrored = false;
btnMirror?.addEventListener('click', () => {
  isMirrored = !isMirrored;
  video.classList.toggle('mirrored', isMirrored);
  btnMirror.classList.toggle('active', isMirrored);
  btnMirror.textContent = isMirrored ? '🪞 Mirror: ON' : '🪞 Mirror Kamera';
  Filters.applyCSSTo(video);
});

/* ===============================
   Step 1: Layout Selection
   =============================== */
let chosenLayout = '3row';
let photoCount = 3;

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

/* ===============================
   Step 2: Camera & capture
   =============================== */
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

btnCapture.addEventListener('click', async () => {
  if (shotCount >= photoCount) return;
  await doCountdown(3);

  const vw = video.videoWidth || 1280;
  const vh = video.videoHeight || 720;

  // Step 1: Draw video with mirror
  const tempSrc = document.createElement('canvas');
  tempSrc.width = vw; 
  tempSrc.height = vh;
  const sctx = tempSrc.getContext('2d');

  sctx.save();
  if (isMirrored) {
    sctx.translate(vw, 0);
    sctx.scale(-1, 1);
  }
  sctx.drawImage(video, 0, 0, vw, vh);
  sctx.restore();

  // Step 2: Crop to 1:1 square (center crop)
  const size = Math.min(vw, vh);
  const offsetX = (vw - size) / 2;
  const offsetY = (vh - size) / 2;

  const squareCanvas = document.createElement('canvas');
  squareCanvas.width = size;
  squareCanvas.height = size;
  const sqCtx = squareCanvas.getContext('2d');
  sqCtx.drawImage(tempSrc, offsetX, offsetY, size, size, 0, 0, size, size);

  // Step 3: Apply filters
  const finalSize = 1080;
  hiddenCanvas.width = finalSize;
  hiddenCanvas.height = finalSize;
  Filters.bakeToCanvas(hiddenCanvas, squareCanvas);

  // Step 4: Save as bitmap
  const blob = await new Promise(res => hiddenCanvas.toBlob(res, 'image/jpeg', 0.92));
  const bmp = await createImageBitmap(blob);
  shots[shotCount] = bmp;
  shotCount++;

  // Step 5: Update thumbnail
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

  // ——— Token logic removed ———

  stopCamera();
  swap(step2, step3);
  await initEditor();
});

backTo2Btn.addEventListener('click', () => {
  swap(step3, step2);
  initCamera();
});

/* ===============================
   Step 3: Editor
   =============================== */
let objects = [];
let activeIndex = 0;

async function initEditor() {
  objects = [];

  // DYNAMIC HEIGHT Canvas - Width 1080, height sesuai foto count
  const canvasWidth = 1080;
  const canvasHeight = 1080 * photoCount;
  stage.width = canvasWidth;
  stage.height = canvasHeight;

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
  const cellSize = 1080;      // Each photo is 1080x1080 (1:1)

  // VERTICAL STACK
  for (let i = 0; i < photoCount; i++) {
    const bmp = shots[i];
    const y = i * cellSize; 
    const fit = coverFit(bmp.width, bmp.height, cellSize, cellSize);
    const ox = (cellSize - fit.w) / 2;
    const oy = (cellSize - fit.h) / 2;
    objects.push({ kind:'photo', img:bmp, x:ox, y:y+oy, w:fit.w, h:fit.h, rot:0 });
  }
}

// LOAD FRAME by count (buttons + selected state)
function loadFramePresets(max = 5) {
  framePreset.innerHTML = '';
  const folderPath = `../assets/img/frames/${photoCount}_Foto`;
  for (let i = 1; i <= max; i++) {
    const src = `${folderPath}/${i}.png`;
    const btn = document.createElement('button');
    btn.className = 'thumb';
    const img = document.createElement('img');
    img.src = src;
    img.onerror = () => btn.style.display = 'none';
    btn.appendChild(img);

    btn.addEventListener('click', async () => {
      // visual state
      framePreset.querySelectorAll('.thumb.selected').forEach(el => el.classList.remove('selected'));
      btn.classList.add('selected');

      // apply frame
      const el = await loadImage(src);
      let idx = objects.findIndex(o => o.kind === 'frame');
      if (idx === -1) {
        objects.push({ kind:'frame', img:el, x:0, y:0, w:stage.width, h:stage.height, rot:0 });
        idx = objects.length - 1;
      } else {
        objects[idx].img = el;
        objects[idx].w = stage.width;
        objects[idx].h = stage.height;
      }
      activeIndex = idx;
      selTarget.value = 'frame';
      syncUIToActive();
      draw();
    });

    framePreset.appendChild(btn);
  }
}

// Stickers (buttons + selected state; default size slightly smaller)
function loadStickerPresets(max = 50) {
  stickerPreset.innerHTML = '';
  for (let i = 1; i <= max; i++) {
    const src = `../assets/img/aksesoris/${i}.png`;
    const btn = document.createElement('button');
    btn.className = 'thumb';
    const img = document.createElement('img');
    img.src = src;
    img.onerror = () => btn.style.display = 'none';
    btn.appendChild(img);

    btn.addEventListener('click', async () => {
      stickerPreset.querySelectorAll('.thumb.selected').forEach(el => el.classList.remove('selected'));
      btn.classList.add('selected');

      const el = await loadImage(src);
      const w = 180, h = 180; // lebih kecil biar gampang diatur
      objects.push({ kind:'sticker', img:el, x:(stage.width - w)/2, y:(stage.height/2 - h/2), w, h, rot:0 });
      activeIndex = objects.length - 1;
      selTarget.value = 'sticker';
      syncUIToActive();
      draw();
    });

    stickerPreset.appendChild(btn);
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
    objects.push({ kind:'frame', img:el, x:0, y:0, w:stage.width, h:stage.height, rot:0 });
    idx = objects.length - 1;
  } else {
    objects[idx].img = el;
    objects[idx].w = stage.width;
    objects[idx].h = stage.height;
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

// ===== Upload Sticker Custom =====
btnStickerUpload.addEventListener('click', () => inputStickerUpload.click());
inputStickerUpload.addEventListener('change', async () => {
  const f = inputStickerUpload.files?.[0];
  if (!f) return;
  const url = URL.createObjectURL(f);
  const el = await loadImage(url);
  URL.revokeObjectURL(url);

  const w = 180, h = 180;
  objects.push({ kind:'sticker', img:el, x:(stage.width - w)/2, y:(stage.height/2 - h/2), w, h, rot:0 });
  activeIndex = objects.length - 1;
  selTarget.value = 'sticker';
  syncUIToActive();
  draw();
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
  } else {
    activeIndex = Number(v.slice(1));
  }
  syncUIToActive();
});

// Scale slider
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

scaleUp.addEventListener('click', () => {
  let val = Number(scaleSlider.value);
  val = Math.min(300, val + 5);
  scaleSlider.value = val;
  scaleSlider.dispatchEvent(new Event('input'));
});

scaleDown.addEventListener('click', () => {
  let val = Number(scaleSlider.value);
  val = Math.max(10, val - 5);
  scaleSlider.value = val;
  scaleSlider.dispatchEvent(new Event('input'));
});

// Rotate slider
rotateSlider.addEventListener('input', () => {
  const o = objects[activeIndex];
  if (!o) return;
  o.rot = Number(rotateSlider.value);
  rotVal.textContent = `${o.rot}°`;
  draw();
});

rotateRight.addEventListener('click', () => {
  let val = Number(rotateSlider.value);
  val = Math.min(180, val + 5);
  rotateSlider.value = val;
  rotateSlider.dispatchEvent(new Event('input'));
});

rotateLeft.addEventListener('click', () => {
  let val = Number(rotateSlider.value);
  val = Math.max(-180, val - 5);
  rotateSlider.value = val;
  rotateSlider.dispatchEvent(new Event('input'));
});

// Position controls (joystick)
const moveStep = 10;

moveUp.addEventListener('click', () => {
  const o = objects[activeIndex];
  if (!o) return;
  o.y -= moveStep;
  draw();
});

moveDown.addEventListener('click', () => {
  const o = objects[activeIndex];
  if (!o) return;
  o.y += moveStep;
  draw();
});

moveLeft.addEventListener('click', () => {
  const o = objects[activeIndex];
  if (!o) return;
  o.x -= moveStep;
  draw();
});

moveRight.addEventListener('click', () => {
  const o = objects[activeIndex];
  if (!o) return;
  o.x += moveStep;
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
    activeIndex = 0; selTarget.value = 'p0';
    syncUIToActive();
    draw();
  }
});

// ===== Layer Control (Front/Back) =====
btnBringFront?.addEventListener('click', () => {
  const o = objects[activeIndex];
  if (!o || activeIndex === objects.length - 1) return;
  objects.splice(activeIndex, 1);
  objects.push(o);
  activeIndex = objects.length - 1;
  updateSelectorAfterLayerChange(o);
  draw();
});

btnSendBack?.addEventListener('click', () => {
  const o = objects[activeIndex];
  if (!o || activeIndex === 0) return;
  objects.splice(activeIndex, 1);
  objects.unshift(o);
  activeIndex = 0;
  updateSelectorAfterLayerChange(o);
  draw();
});

function updateSelectorAfterLayerChange(obj) {
  if (obj.kind === 'photo') {
    let photoIdx = 0;
    for (let i = 0; i <= activeIndex; i++) {
      if (objects[i].kind === 'photo' && objects[i] === obj) break;
      if (objects[i].kind === 'photo') photoIdx++;
    }
    selTarget.value = `p${photoIdx}`;
  } else if (obj.kind === 'frame') {
    selTarget.value = 'frame';
  } else if (obj.kind === 'sticker') {
    selTarget.value = 'sticker';
  }
  syncUIToActive();
}

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

/* ===============================
   Download JPG (Dynamic Height)
   =============================== */
btnDownloadJpg.addEventListener('click', async ()=>{
  const out = document.createElement('canvas');
  out.width = stage.width;
  out.height = stage.height + 40;
  const c = out.getContext('2d');
  c.fillStyle = '#fff';
  c.fillRect(0,0,out.width,out.height);
  c.drawImage(stage, 0, 0);

  // Watermark pakai BRAND
  c.save();
  c.fillStyle = '#0b1020';
  c.globalAlpha = 0.6;
  c.font = 'bold 18px system-ui,Segoe UI,Roboto,Arial';
  c.textAlign = 'center';
  c.fillText(BRAND, out.width / 2, out.height - 15);
  c.restore();

  out.toBlob((blob)=>{
    const filename = `${fileName(BRAND)}-${photoCount}Foto.jpg`;
    saveAs(blob, filename);
  }, 'image/jpeg', 0.92);
});

/* ===============================
   Helpers
   =============================== */
function swap(a, b){ a.classList.remove('active'); b.classList.add('active'); }
function wait(ms){ return new Promise(r => setTimeout(r, ms)); }

function fileName(prefix){
  const safe = String(prefix || 'Motion-US').replace(/[^a-zA-Z0-9._-]/g, '_');
  const d=new Date();
  const hh = String(d.getHours()).padStart(2,'0');
  const mm = String(d.getMinutes()).padStart(2,'0');
  const dd = String(d.getDate()).padStart(2,'0');
  const mo = String(d.getMonth()+1).padStart(2,'0');
  const yy = d.getFullYear();
  return `${safe}-${hh}${mm}-${dd}${mo}-${yy}`;
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
  objects.forEach(o => drawObject(o));
}

function drawObject(o){
  g.save();
  g.translate(o.x + o.w/2, o.y + o.h/2);
  g.rotate(o.rot * Math.PI/180);
  g.drawImage(o.img, -o.w/2, -o.h/2, o.w, o.h);
  g.restore();
}

// ——— Token badge & logout bindings removed ———
// import { initTokenBadge, logoutUser } from './badge.js';
// initTokenBadge();
// $('#btnLogout')?.addEventListener('click', logoutUser);
