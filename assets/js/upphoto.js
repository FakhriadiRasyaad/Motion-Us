// assets/js/upphoto.js (module) - Upload Version
// Photobooth: Upload Foto + Vertical Layout + Frame + Sticker + Layer Control

console.log('upphoto.js LOADED');

const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

// === DOM refs ===
const step1 = $('#step1');
const step2 = $('#step2');
const step3 = $('#step3');

const goStep2Btn = $('#goStep2');
const goStep3Btn = $('#goStep3');
const backTo1Btn = $('#backTo1');
const backTo2Btn = $('#backTo2');

const fileInput = $('#fileInput');
const btnSelectFiles = $('#btnSelectFiles');
const uploadedGrid = $('#uploadedGrid');
const uploadCount = $('#uploadCount');
const photoCountText = $('#photoCountText');
const maxCount = $('#maxCount');
const uploadBox = document.querySelector('.upload-box');

const hiddenCanvas = $('#hiddenCanvas');
const stage = $('#stage');
const g = stage.getContext('2d');

const framePreset = $('#framePreset');
const stickerPreset = $('#stickerPreset');
const framePhotoCount = $('#framePhotoCount');

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

const scaleUp = $('#scaleUp');
const scaleDown = $('#scaleDown');
const rotateLeft = $('#rotateLeft');
const rotateRight = $('#rotateRight');
const moveUp = $('#moveUp');
const moveDown = $('#moveDown');
const moveLeft = $('#moveLeft');
const moveRight = $('#moveRight');

const btnBringFront = $('#btnBringFront');
const btnSendBack = $('#btnSendBack');
const btnDownloadJpg = $('#btnDownloadJpg');

// === Config path gambar (HALAMAN di subfolder) ===
const IMG_BASE = '../assets/img';

// ====== Step 1: Layout Selection ======
let chosenLayout = '3row';
let photoCount = 3;
let uploadedPhotos = [];

$$('.layout-card').forEach(card => {
  card.addEventListener('click', () => {
    $$('.layout-card').forEach(c => c.classList.remove('selected'));
    card.classList.add('selected');
    chosenLayout = card.dataset.layout;
    photoCount = parseInt(card.dataset.count, 10);
  });
});

goStep2Btn?.addEventListener('click', () => {
  uploadedPhotos = [];
  uploadedGrid.innerHTML = '';
  photoCountText.textContent = photoCount;
  maxCount.textContent = photoCount;
  updateUploadCount();
  swap(step1, step2);
});

backTo1Btn?.addEventListener('click', () => {
  uploadedPhotos = [];
  uploadedGrid.innerHTML = '';
  swap(step2, step1);
});

// ====== Step 2: Upload Photos ======
btnSelectFiles?.addEventListener('click', () => fileInput.click());

fileInput?.addEventListener('change', async (e) => {
  const files = Array.from(e.target.files || []);
  await handleFiles(files);
  fileInput.value = ''; // reset
});

// Drag & Drop
uploadBox?.addEventListener('dragover', (e) => {
  e.preventDefault();
  uploadBox.classList.add('drag-over');
});
uploadBox?.addEventListener('dragleave', () => {
  uploadBox.classList.remove('drag-over');
});
uploadBox?.addEventListener('drop', async (e) => {
  e.preventDefault();
  uploadBox.classList.remove('drag-over');
  const files = Array.from(e.dataTransfer.files || []).filter(f => f.type.startsWith('image/'));
  await handleFiles(files);
});

async function handleFiles(files) {
  const validFiles = files.filter(f => {
    if (!f.type.match(/^image\/(jpeg|jpg|png)$/)) {
      alert(`File ${f.name} bukan format yang didukung (JPG/PNG)`);
      return false;
    }
    if (f.size > 10 * 1024 * 1024) {
      alert(`File ${f.name} terlalu besar (maks 10MB)`);
      return false;
    }
    return true;
  });

  const remaining = photoCount - uploadedPhotos.length;
  const toProcess = validFiles.slice(0, remaining);

  for (const file of toProcess) {
    await processFile(file);
  }

  updateUploadCount();
}

async function processFile(file) {
  // Bitmap dari file
  const bitmap = await createImageBitmap(file);

  // Crop ke 1:1 & resize ke 1080x1080
  const size = Math.min(bitmap.width, bitmap.height);
  const offsetX = (bitmap.width - size) / 2;
  const offsetY = (bitmap.height - size) / 2;

  hiddenCanvas.width = 1080;
  hiddenCanvas.height = 1080;
  const ctx = hiddenCanvas.getContext('2d');

  ctx.drawImage(bitmap, offsetX, offsetY, size, size, 0, 0, 1080, 1080);

  const blob = await new Promise(res => hiddenCanvas.toBlob(res, 'image/jpeg', 0.92));
  const processedBitmap = await createImageBitmap(blob);

  uploadedPhotos.push(processedBitmap);

  // Thumbnail
  displayThumbnail(processedBitmap, uploadedPhotos.length - 1, blob);
}

function displayThumbnail(bitmap, index, blob) {
  const div = document.createElement('div');
  div.className = 'uploaded-item';
  div.dataset.index = index;

  const img = document.createElement('img');
  img.src = URL.createObjectURL(blob);
  img.onload = () => URL.revokeObjectURL(img.src);

  const numBadge = document.createElement('div');
  numBadge.className = 'item-number';
  numBadge.textContent = index + 1;

  const removeBtn = document.createElement('button');
  removeBtn.className = 'remove-btn';
  removeBtn.textContent = '×';
  removeBtn.onclick = () => removePhoto(index);

  div.appendChild(img);
  div.appendChild(numBadge);
  div.appendChild(removeBtn);
  uploadedGrid.appendChild(div);
}

function removePhoto(index) {
  uploadedPhotos.splice(index, 1);
  uploadedGrid.innerHTML = '';

  uploadedPhotos.forEach((bitmap, i) => {
    hiddenCanvas.width = 1080;
    hiddenCanvas.height = 1080;
    const ctx = hiddenCanvas.getContext('2d');
    ctx.drawImage(bitmap, 0, 0);
    hiddenCanvas.toBlob(blob => displayThumbnail(bitmap, i, blob), 'image/jpeg', 0.92);
  });

  updateUploadCount();
}

function updateUploadCount() {
  uploadCount.innerHTML = `(${uploadedPhotos.length}/<span id="maxCount">${photoCount}</span>)`;
  goStep3Btn.disabled = uploadedPhotos.length !== photoCount;
}

goStep3Btn?.addEventListener('click', async () => {
  if (uploadedPhotos.length !== photoCount) return;

  // Gate token pertama (opsional)
  if (window.consumeOnFirstDownload) {
    const ok = await window.consumeOnFirstDownload('photo');
    if (!ok) return;
  }

  swap(step2, step3);
  await initEditor();
});

// Back ke halaman upload (file ini)
backTo2Btn?.addEventListener('click', (e) => {
  e.preventDefault();
  window.location.href = 'UpPhoto.html';
});

// ====== Step 3: Editor ======
let objects = [];
let activeIndex = 0;

async function initEditor() {
  objects = [];

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

  if (framePhotoCount) framePhotoCount.textContent = photoCount;

  applyLayout();
  loadFramePresets();
  loadStickerPresets();

  activeIndex = 0;
  selTarget.value = 'p0';
  syncUIToActive();

  draw();
}

function applyLayout() {
  const cellSize = 1080;

  for (let i = 0; i < photoCount; i++) {
    const bmp = uploadedPhotos[i];
    const y = i * cellSize;

    const fit = coverFit(bmp.width, bmp.height, cellSize, cellSize);
    const ox = (cellSize - fit.w) / 2;
    const oy = (cellSize - fit.h) / 2;

    objects.push({
      kind: 'photo',
      img: bmp,
      x: ox,
      y: y + oy,
      w: fit.w,
      h: fit.h,
      rot: 0
    });
  }
}

// --- Frames (pakai path dari IMG_BASE) ---
function loadFramePresets(max = 5) {
  framePreset.innerHTML = '';
  const folderPath = `${IMG_BASE}/frames/${photoCount}_Foto`;

  for (let i = 1; i <= max; i++) {
    const src = `${folderPath}/${i}.png`;
    const div = document.createElement('button');
    div.className = 'thumb';
    const img = document.createElement('img');
    img.src = src;
    img.onerror = () => {
      div.style.display = 'none';
      console.warn('Gagal load frame:', src);
    };
    div.appendChild(img);
    div.addEventListener('click', async () => {
      const el = await loadImage(src);
      let idx = objects.findIndex(o => o.kind === 'frame');
      if (idx === -1) {
        objects.push({
          kind: 'frame',
          img: el,
          x: 0,
          y: 0,
          w: stage.width,
          h: stage.height,
          rot: 0
        });
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
    framePreset.appendChild(div);
  }
}

// --- Stickers (pakai path dari IMG_BASE) ---
function loadStickerPresets(max = 50) {
  stickerPreset.innerHTML = '';
  for (let i = 1; i <= max; i++) {
    const src = `${IMG_BASE}/aksesoris/${i}.png`;
    const div = document.createElement('button');
    div.className = 'thumb';
    const img = document.createElement('img');
    img.src = src;
    img.onerror = () => {
      div.style.display = 'none';
      console.warn('Gagal load sticker:', src);
    };
    div.appendChild(img);
    div.addEventListener('click', async () => {
      const el = await loadImage(src);
      const w = 200, h = 200;
      objects.push({ kind: 'sticker', img: el, x: (stage.width - w)/2, y: (stage.height/2 - h/2), w, h, rot: 0 });
      activeIndex = objects.length - 1;
      selTarget.value = 'sticker';
      syncUIToActive();
      draw();
    });
    stickerPreset.appendChild(div);
  }
}

// Upload frame custom
btnFrameUpload?.addEventListener('click', () => inputFrameUpload.click());
inputFrameUpload?.addEventListener('change', async () => {
  const f = inputFrameUpload.files?.[0];
  if (!f) return;
  const url = URL.createObjectURL(f);
  const el = await loadImage(url);
  URL.revokeObjectURL(url);

  let idx = objects.findIndex(o => o.kind === 'frame');
  if (idx === -1) {
    objects.push({
      kind: 'frame',
      img: el,
      x: 0,
      y: 0,
      w: stage.width,
      h: stage.height,
      rot: 0
    });
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

btnFrameRemove?.addEventListener('click', () => {
  const idx = objects.findIndex(o => o.kind === 'frame');
  if (idx !== -1) {
    objects.splice(idx, 1);
    activeIndex = 0;
    selTarget.value = 'p0';
    syncUIToActive();
    draw();
  }
});

// Upload sticker custom
btnStickerUpload?.addEventListener('click', () => inputStickerUpload.click());
inputStickerUpload?.addEventListener('change', async () => {
  const f = inputStickerUpload.files?.[0];
  if (!f) return;
  const url = URL.createObjectURL(f);
  const el = await loadImage(url);
  URL.revokeObjectURL(url);

  const w = 200, h = 200;
  objects.push({ kind: 'sticker', img: el, x: (stage.width - w)/2, y: (stage.height/2 - h/2), w, h, rot: 0 });
  activeIndex = objects.length - 1;
  selTarget.value = 'sticker';
  syncUIToActive();
  draw();
});

// ===== Controls =====
selTarget?.addEventListener('change', () => {
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

scaleSlider?.addEventListener('input', () => {
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

scaleUp?.addEventListener('click', () => {
  let val = Number(scaleSlider.value);
  val = Math.min(300, val + 5);
  scaleSlider.value = val;
  scaleSlider.dispatchEvent(new Event('input'));
});

scaleDown?.addEventListener('click', () => {
  let val = Number(scaleSlider.value);
  val = Math.max(10, val - 5);
  scaleSlider.value = val;
  scaleSlider.dispatchEvent(new Event('input'));
});

rotateSlider?.addEventListener('input', () => {
  const o = objects[activeIndex];
  if (!o) return;
  o.rot = Number(rotateSlider.value);
  rotVal.textContent = `${o.rot}°`;
  draw();
});

rotateRight?.addEventListener('click', () => {
  let val = Number(rotateSlider.value);
  val = Math.min(180, val + 5);
  rotateSlider.value = val;
  rotateSlider.dispatchEvent(new Event('input'));
});

rotateLeft?.addEventListener('click', () => {
  let val = Number(rotateSlider.value);
  val = Math.max(-180, val - 5);
  rotateSlider.value = val;
  rotateSlider.dispatchEvent(new Event('input'));
});

const moveStep = 10;

moveUp?.addEventListener('click', () => {
  const o = objects[activeIndex];
  if (!o) return;
  o.y -= moveStep;
  draw();
});

moveDown?.addEventListener('click', () => {
  const o = objects[activeIndex];
  if (!o) return;
  o.y += moveStep;
  draw();
});

moveLeft?.addEventListener('click', () => {
  const o = objects[activeIndex];
  if (!o) return;
  o.x -= moveStep;
  draw();
});

moveRight?.addEventListener('click', () => {
  const o = objects[activeIndex];
  if (!o) return;
  o.x += moveStep;
  draw();
});

btnCenter?.addEventListener('click', () => {
  const o = objects[activeIndex];
  if (!o) return;
  o.x = (stage.width - o.w) / 2;
  o.y = (stage.height - o.h) / 2;
  draw();
});

btnDelSticker?.addEventListener('click', () => {
  const idx = objects.findIndex((o, i) => o.kind === 'sticker' && i === activeIndex);
  if (idx !== -1) {
    objects.splice(idx, 1);
    activeIndex = 0;
    selTarget.value = 'p0';
    syncUIToActive();
    draw();
  }
});

// ===== Layer Control =====
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

// ===== Drag & Drop di Canvas =====
let drag = { on: false, dx: 0, dy: 0 };

stage?.addEventListener('mousedown', (e) => {
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
window.addEventListener('mouseup', () => drag.on = false);

stage?.addEventListener('touchstart', (e) => {
  const t = e.touches[0];
  const rect = stage.getBoundingClientRect();
  const p = {
    x: (t.clientX - rect.left) * stage.width / rect.width,
    y: (t.clientY - rect.top) * stage.height / rect.height
  };
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
}, { passive: true });

stage?.addEventListener('touchmove', (e) => {
  if (!drag.on) return;
  const t = e.touches[0];
  const rect = stage.getBoundingClientRect();
  const p = {
    x: (t.clientX - rect.left) * stage.width / rect.width,
    y: (t.clientY - rect.top) * stage.height / rect.height
  };
  const o = objects[activeIndex];
  o.x = p.x - drag.dx;
  o.y = p.y - drag.dy;
  draw();
}, { passive: true });

stage?.addEventListener('touchend', () => drag.on = false);

// ===== Download JPG =====
btnDownloadJpg?.addEventListener('click', async () => {
  // Optional: gate token per download
  // if (window.consumeOnFirstDownload) {
  //   const ok = await window.consumeOnFirstDownload('photo');
  //   if (!ok) return;
  // }

  const out = document.createElement('canvas');
  out.width = stage.width;
  out.height = stage.height + 40;
  const c = out.getContext('2d');
  c.fillStyle = '#fff';
  c.fillRect(0, 0, out.width, out.height);
  c.drawImage(stage, 0, 0);

  // Watermark
  c.fillStyle = '#0b1020';
  c.globalAlpha = 0.6;
  c.font = 'bold 18px system-ui,Segoe UI,Roboto,Arial';
  c.textAlign = 'center';
  c.fillText('Motion-US', out.width / 2, out.height - 15);
  c.globalAlpha = 1;

  out.toBlob((blob) => {
    const filename = `${fileName('Motion-Us')}-${photoCount}Foto.jpg`;
    saveAs(blob, filename);
  }, 'image/jpeg', 0.92);
});

// ===== Helper Functions =====
function swap(a, b) {
  a.classList.remove('active');
  b.classList.add('active');
}

function fileName(prefix) {
  const d = new Date();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const yy = d.getFullYear();
  return `${prefix}-${hh}${mm}-${dd}${mo}-${yy}`;
}

function coverFit(srcW, srcH, dstW, dstH) {
  const s = Math.max(dstW / srcW, dstH / srcH);
  return { w: srcW * s, h: srcH * s };
}

function getPointer(e) {
  const rect = stage.getBoundingClientRect();
  const x = (e.clientX - rect.left) * stage.width / rect.width;
  const y = (e.clientY - rect.top) * stage.height / rect.height;
  return { x, y };
}

function photoIndex(objIdx) {
  let k = -1;
  for (let i = 0, p = 0; i < objects.length; i++) {
    if (objects[i].kind === 'photo') {
      if (i === objIdx) { k = p; break; }
      p++;
    }
  }
  return k < 0 ? 0 : k;
}

function hitTest(px, py) {
  for (let i = objects.length - 1; i >= 0; i--) {
    const o = objects[i];
    if (px >= o.x && px <= o.x + o.w && py >= o.y && py <= o.y + o.h) return i;
  }
  return -1;
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const im = new Image();
    im.crossOrigin = 'anonymous';
    im.onload = () => resolve(im);
    im.onerror = (err) => {
      console.warn('Gagal load gambar:', src, err);
      reject(err);
    };
    im.src = src;
  });
}

function syncUIToActive() {
  const o = objects[activeIndex];
  if (!o) return;

  if (o.w0 == null || o.h0 == null) {
    o.w0 = o.w;
    o.h0 = o.h;
  }

  const scale = Math.max(10, Math.round((o.w / o.w0) * 100));
  scaleSlider.value = String(scale);
  scaleVal.textContent = `${scale}%`;
  rotateSlider.value = String(Math.round(o.rot));
  rotVal.textContent = `${Math.round(o.rot)}°`;
}

function draw() {
  g.fillStyle = '#fff';
  g.fillRect(0, 0, stage.width, stage.height);
  objects.forEach(o => drawObject(o));
}

function drawObject(o) {
  g.save();
  g.translate(o.x + o.w / 2, o.y + o.h / 2);
  g.rotate(o.rot * Math.PI / 180);
  g.drawImage(o.img, -o.w / 2, -o.h / 2, o.w, o.h);
  g.restore();
}

// ===== Init Badge + Logout (opsional) =====
import { initTokenBadge, logoutUser } from './badge.js';
initTokenBadge();
$('#btnLogout')?.addEventListener('click', logoutUser);
