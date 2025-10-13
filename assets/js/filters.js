// assets/js/filters.js  (ES module)
// Simple film filters: live (CSS) + baked (Canvas 2D)
// ---------------------------------------------------

export const Filters = (() => {
    // state default
    const state = {
      // 0..200 (%)
      exposure: 100,     // maps to brightness
      contrast: 100,
      saturation: 110,
      // -100..+100 (shift warmth; + = lebih hangat)
      warmth: 20,        // implemented via hue-rotate & sepia mix
      // 0..100
      sepia: 10,
      // 0..100 (px)
      blur: 0,
      // 0..100 (0 none, 100 = kuat)
      vignette: 20,
      grain: 8,
      // hue shift -180..+180 (tambahan kreatif)
      hue: 0,
    };
  
    // ---------- PRESETS ----------
    const presets = {
      None:      { exposure:100, contrast:100, saturation:100, warmth:0,  sepia:0,  blur:0, vignette:0,  grain:0,  hue:0 },
      VintageWarm:{exposure:105, contrast:95,  saturation:110, warmth:25, sepia:18, blur:0, vignette:22, grain:10, hue:-5},
      CoolFilm:  { exposure:98,  contrast:108, saturation:90,  warmth:-20,sepia:6,  blur:0, vignette:18, grain:6,  hue:5 },
      BWMatte:   { exposure:102, contrast:90,  saturation:0,   warmth:0,  sepia:8,  blur:0, vignette:25, grain:8,  hue:0 },
      Pop:       { exposure:102, contrast:112, saturation:125, warmth:5,  sepia:0,  blur:0, vignette:8,  grain:0,  hue:0 },
    };
  
    // ---------- UTIL: clamp ----------
    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  
    // ---------- CSS filter string ----------
    function cssFilterString(s = state) {
      // Warmth approx: positive warmth -> slight sepia + hue shift toward red/yellow
      const hueShift = clamp(s.hue + (s.warmth * 0.6), -180, 180);
      const extraSepia = clamp(s.sepia + Math.max(0, s.warmth) * 0.1, 0, 100);
  
      return [
        `brightness(${clamp(s.exposure, 0, 200)}%)`,
        `contrast(${clamp(s.contrast, 0, 200)}%)`,
        `saturate(${clamp(s.saturation, 0, 200)}%)`,
        `hue-rotate(${hueShift}deg)`,
        `sepia(${clamp(extraSepia,0,100)}%)`,
        s.blur ? `blur(${clamp(s.blur,0,100)}px)` : null,
      ].filter(Boolean).join(' ');
    }
  
    // ---------- LIVE: apply to live elements (video/img/canvas as DOM) ----------
    function applyCSSTo(el) {
      if (!el) return;
      el.style.filter = cssFilterString();
    }
  
    // ---------- BAKE: draw with filters onto a canvas ----------
    // source: <video> / <img> / <canvas>
    function bakeToCanvas(outCanvas, source, opts = {}) {
      if (!outCanvas || !source) return;
      const w = opts.w || source.videoWidth || source.naturalWidth || source.width || outCanvas.width;
      const h = opts.h || source.videoHeight || source.naturalHeight || source.height || outCanvas.height;
      outCanvas.width = w; outCanvas.height = h;
      const ctx = outCanvas.getContext('2d');
  
      // 1) draw with ctx.filter (brightness/contrast/saturate/sepia/hue/blur)
      ctx.save();
      ctx.filter = cssFilterString();
      ctx.drawImage(source, 0, 0, w, h);
      ctx.restore();
  
      // 2) vignette overlay
      if (state.vignette > 0) {
        const g = ctx.createRadialGradient(w/2, h/2, Math.min(w,h)*0.25, w/2, h/2, Math.max(w,h)*0.7);
        const alpha = clamp(state.vignette, 0, 100) / 100 * 0.7; // max 0.7
        g.addColorStop(0, 'rgba(0,0,0,0)');
        g.addColorStop(1, `rgba(0,0,0,${alpha})`);
        ctx.fillStyle = g;
        ctx.fillRect(0,0,w,h);
      }
  
      // 3) grain overlay
      if (state.grain > 0) {
        const gAlpha = clamp(state.grain, 0, 100) / 100 * 0.25; // max 0.25
        const noiseCanvas = genNoise(w, h, gAlpha);
        ctx.globalCompositeOperation = 'overlay';
        ctx.drawImage(noiseCanvas, 0, 0);
        ctx.globalCompositeOperation = 'source-over';
      }
    }
  
    // ---------- Noise generator ----------
    function genNoise(w, h, alpha=0.2) {
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      const x = c.getContext('2d');
      const id = x.createImageData(w, h);
      const d = id.data;
      for (let i = 0; i < d.length; i += 4) {
        const v = (Math.random()*255)|0;
        d[i] = d[i+1] = d[i+2] = v;
        d[i+3] = Math.round(255*alpha);
      }
      x.putImageData(id, 0, 0);
      return c;
    }
  
    // ---------- UI builder ----------
    // container: element where the panel goes
    // onChange: callback() when params change
    function buildPanel(container, onChange) {
      if (!container) return;
      container.innerHTML = '';
      container.classList.add('filters-panel');
  
      // Preset select
      const presetRow = row();
      const sel = document.createElement('select');
      for (const k of Object.keys(presets)) {
        const o = document.createElement('option');
        o.value = k; o.textContent = k;
        sel.appendChild(o);
      }
      sel.addEventListener('change', () => {
        setPreset(sel.value);
        onChange?.();
      });
      presetRow.append(label('Preset'), sel);
      container.appendChild(presetRow);
  
      // slider helper
      const addSlider = (key, min, max, step=1, suffix='') => {
        const r = row();
        const l = label(`${title(key)}:`);
        const valEl = document.createElement('span');
        valEl.className = 'val';
        valEl.textContent = state[key] + suffix;
  
        const input = document.createElement('input');
        input.type = 'range'; input.min = min; input.max = max; input.step = step;
        input.value = state[key];
        input.addEventListener('input', () => {
          state[key] = Number(input.value);
          valEl.textContent = state[key] + suffix;
          onChange?.();
        });
        r.append(l, input, valEl);
        container.appendChild(r);
      };
  
      addSlider('exposure', 0, 200, 1, '%');
      addSlider('contrast', 0, 200, 1, '%');
      addSlider('saturation', 0, 200, 1, '%');
      addSlider('warmth', -100, 100, 1, '');
      addSlider('sepia', 0, 100, 1, '%');
      addSlider('hue', -180, 180, 1, '°');
      addSlider('blur', 0, 10, 0.5, 'px');
      addSlider('vignette', 0, 100, 1, '%');
      addSlider('grain', 0, 100, 1, '%');
  
      // reset
      const r2 = row();
      const btnReset = document.createElement('button');
      btnReset.textContent = 'Reset';
      btnReset.className = 'btn tiny secondary';
      btnReset.addEventListener('click', () => {
        setPreset('None'); sel.value = 'None'; onChange?.();
      });
  
      const btnVW = document.createElement('button');
      btnVW.textContent = 'Vintage Warm';
      btnVW.className = 'btn tiny';
      btnVW.addEventListener('click', () => {
        setPreset('VintageWarm'); sel.value = 'VintageWarm'; onChange?.();
      });
  
      r2.append(btnReset, btnVW);
      container.appendChild(r2);
    }
  
    function setPreset(name) {
      const p = presets[name] || presets.None;
      Object.assign(state, p);
    }
  
    // helpers UI
    function row(){ const d = document.createElement('div'); d.className='f-row'; return d; }
    function label(t){ const l = document.createElement('label'); l.textContent=t; return l; }
    function title(k){ return k.replace(/(^.|_.?)/g, (m,i)=> i===0? m.toUpperCase(): m.replace('_',' ').toUpperCase()); }
  
    return { state, buildPanel, applyCSSTo, bakeToCanvas, setPreset };
  })();
  