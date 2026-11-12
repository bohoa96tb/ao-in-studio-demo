// Print Production Workspace — "Xưởng chuẩn bị file in" (P4).
// Turns a customer image (upload / Studio layer / library artwork) into an
// honest print handoff: background removal (solid-colour flood fill or an
// on-device U2Netp model), colour adjustment, REAL vectorization via VTracer
// behind a fidelity gate (raster stays the master when vector loses detail),
// real print size in cm with live DPI, an on-shirt preview through the P3
// mockup engine, a DTF checklist, and verified exports: transparent PNG with
// embedded DPI, real-path SVG, and a PDF paged at the exact print size.
// Everything runs on the customer's device; originals are kept untouched in
// a separate IndexedDB (ao-in-print) and never overwritten.
import { dpiFor, maxCmForDpi, dpiRating, pngWithDpi, removeSolidBackground, applyColorAdjust, trimTransparent, fidelityScore, svgInfo, svgToPdfContent, buildPdf } from './print-core.js?v=p4print1';
import { compositeMockup, loadImage } from './mockup-engine/composite.js?v=p31vis1';
import { compositingBases, zoneFor } from './mockup-engine/engine.js?v=p31vis1';

const $ = (s, r = document) => r.querySelector(s);
const WORK_MAX = 1600;           // interactive pipeline long-edge cap
const EXPORT_MAX = 5000;         // export pipeline long-edge cap
const ZONE_CM = 28, ZONE_W = 360, ZONE_H = 560; // crew print zone: 180x280 studio units @2x = 28cm wide

export function mountPrintWorkspace(studio) {
  const host = $('#print-workspace');
  if (!host) return;
  host.innerHTML = `
  <div class="effect-heading"><p class="eyebrow">XƯỞNG CHUẨN BỊ FILE IN</p><h2>Từ hình của bạn thành file in.</h2>
  <p>Chọn một hình, tách nền, kiểm tra độ nét theo kích thước in thật và tải file bàn giao cho xưởng in ép nhiệt (DTF). Mọi xử lý chạy ngay trên máy của bạn — ảnh không được gửi đi đâu. Bản gốc luôn được giữ nguyên.</p></div>
  <div class="pw-grid">
    <div class="pw-stage">
      <div class="pw-preview-wrap"><canvas id="pw-preview" width="600" height="600" aria-label="Xem trước hình in đã xử lý"></canvas></div>
      <p id="pw-preview-note" class="pw-note">Chưa có hình. Hãy chọn một hình để bắt đầu.</p>
      <div class="pw-shirt-wrap"><canvas id="pw-shirt" width="600" height="900" aria-label="Xem trước hình in trên áo thật"></canvas>
      <p class="pw-note">Xem trước trên áo cổ tròn trắng — ảnh mô phỏng bằng máy tính lên ảnh chụp áo thật (Pexels), không phải ảnh sản xuất.</p></div>
    </div>
    <div class="pw-panel">
      <fieldset class="pw-step"><legend>1 · Chọn hình</legend>
        <div class="pw-row">
          <label class="pw-file">Tải ảnh lên (JPG, PNG, SVG · tối đa 10 MB)<input id="pw-upload" type="file" accept="image/jpeg,image/png,image/svg+xml,.jpg,.jpeg,.png,.svg"></label>
          <button id="pw-from-studio" type="button">Lấy hình từ Studio</button>
        </div>
        <div class="pw-row"><label>Hoặc chọn hình in sẵn trong thư viện<select id="pw-library"><option value="">— Chọn hình thư viện —</option></select></label></div>
        <p id="pw-source-info" class="pw-note" role="status"></p>
      </fieldset>
      <fieldset class="pw-step"><legend>2 · Tách nền</legend>
        <div class="pw-row pw Radios" role="radiogroup" aria-label="Cách tách nền">
          <label><input type="radio" name="pw-bg" value="none" checked> Không tách</label>
          <label><input type="radio" name="pw-bg" value="solid"> Nền một màu (logo, hình vẽ)</label>
          <label><input type="radio" name="pw-bg" value="ml"> Ảnh chụp (AI trên máy)</label>
        </div>
        <div id="pw-bg-solid" hidden><label>Độ nhạy tách nền nền một màu<input id="pw-bg-tol" type="range" min="8" max="80" value="32"></label></div>
        <div id="pw-bg-ml" hidden><p class="pw-note">Cách này tải bộ tách nền AI (~16 MB, chỉ tải một lần) và chạy ngay trên máy của bạn.</p><button id="pw-ml-run" type="button">Tải và tách nền bằng AI</button></div>
        <p id="pw-bg-status" class="pw-note" role="status"></p>
      </fieldset>
      <fieldset class="pw-step"><legend>3 · Chỉnh màu</legend>
        <label>Độ sáng<input id="pw-bright" type="range" min="-60" max="60" value="0"></label>
        <label>Tương phản<input id="pw-contrast" type="range" min="-60" max="60" value="0"></label>
        <label>Độ tươi màu<input id="pw-sat" type="range" min="-100" max="100" value="0"></label>
        <label class="pw-check"><input id="pw-mono-on" type="checkbox"> In một màu mực duy nhất</label>
        <div id="pw-mono-row" hidden><label>Màu mực<input id="pw-mono-color" type="color" value="#293e35"></label>
        <p class="pw-note">Nếu hình chưa có nền trong suốt, phần tối sẽ thành mực in và phần sáng sẽ biến mất — xem trước để kiểm tra.</p></div>
      </fieldset>
      <fieldset class="pw-step"><legend>4 · Vector hóa (không bắt buộc)</legend>
        <p class="pw-note">Biến hình raster thành đường vector thật cho logo, chữ và hình vẽ phẳng. Ảnh chụp thường mất chi tiết khi vector hóa — xưởng sẽ tự so sánh và khuyên bạn giữ bản nào.</p>
        <div class="pw-row"><label>Loại hình<select id="pw-trace-kind"><option value="logo">Logo / chữ</option><option value="illustration" selected>Hình minh họa</option><option value="photo">Ảnh chụp</option></select></label>
        <button id="pw-trace" type="button">Thử vector hóa</button></div>
        <p id="pw-trace-status" class="pw-note" role="status"></p>
        <div id="pw-trace-choice" hidden>
          <label><input type="radio" name="pw-master" value="raster" checked> Dùng bản raster làm file chính</label>
          <label><input type="radio" name="pw-master" value="vector"> Dùng bản vector làm file chính</label>
        </div>
      </fieldset>
      <fieldset class="pw-step"><legend>5 · Kích thước in thật</legend>
        <div class="pw-row">
          <label>Rộng (cm)<input id="pw-cm-w" type="number" min="2" max="60" step="0.5" value="25"></label>
          <label>Cao (cm)<input id="pw-cm-h" type="number" min="2" max="80" step="0.5" value="25"></label>
          <label class="pw-check"><input id="pw-lock" type="checkbox" checked> Giữ tỉ lệ</label>
        </div>
        <p id="pw-dpi" class="pw-dpi" role="status"></p>
        <div class="pw-row">
          <label>Dịch ngang trên áo (cm)<input id="pw-pos-x" type="range" min="-8" max="8" step="0.5" value="0"></label>
          <label>Dịch dọc trên áo (cm)<input id="pw-pos-y" type="range" min="-10" max="10" step="0.5" value="0"></label>
        </div>
      </fieldset>
      <fieldset class="pw-step"><legend>6 · Kiểm tra in ép nhiệt (DTF)</legend>
        <ul id="pw-dtf" class="pw-dtf"></ul>
      </fieldset>
      <fieldset class="pw-step"><legend>7 · Xuất file bàn giao</legend>
        <div class="pw-row">
          <button id="pw-exp-png" type="button">Tải PNG nền trong suốt</button>
          <button id="pw-exp-svg" type="button">Tải SVG vector</button>
          <button id="pw-exp-pdf" type="button">Tải PDF đúng kích thước</button>
        </div>
        <div class="pw-row"><button id="pw-to-studio" type="button">Đưa hình đã xử lý vào Studio</button></div>
        <p id="pw-export-status" class="pw-note" role="status"></p>
        <p id="pw-summary" class="pw-note"></p>
      </fieldset>
    </div>
  </div>`;

  const S = {
    name: '', kind: null, nativeSvgText: null, nativeSvgInfo: null,
    img: null, nativeW: 0, nativeH: 0,           // raster source (image element)
    bg: 'none', tol: 32, mlMask: null, mlFor: null,
    color: { brightness: 0, contrast: 0, saturation: 0, monoOn: false, monoColor: '#293e35' },
    crop: null,                                   // fractions {x,y,w,h} of native, after bg removal
    vectorSvg: null, vectorFrom: null, fidelity: null,
    printW: 25, garmentBase: null, garmentImg: null,
  };
  let workCanvas = null;   // processed at WORK_MAX (preview/trace/fidelity)
  let busy = false;

  // ---------- IndexedDB for the untouched original ----------
  const dbPromise = new Promise((resolve) => {
    try { const req = indexedDB.open('ao-in-print', 1); req.onupgradeneeded = () => req.result.createObjectStore('originals'); req.onsuccess = () => resolve(req.result); req.onerror = () => resolve(null); }
    catch { resolve(null); }
  });
  async function saveOriginal(blob, name) {
    const db = await dbPromise; if (!db) return;
    try { await new Promise((res, rej) => { const t = db.transaction('originals', 'readwrite'); t.objectStore('originals').put({ blob, name, savedAt: Date.now() }, 'current'); t.oncomplete = res; t.onerror = rej; }); } catch { /* storage is a bonus, never a blocker */ }
  }

  // ---------- source loading ----------
  const srcInfo = $('#pw-source-info');
  function setSourceInfo(t) { srcInfo.textContent = t; }
  async function loadRasterImage(src, name) {
    const img = await loadImage(document, src);
    S.kind = 'raster'; S.nativeSvgText = null; S.nativeSvgInfo = null;
    S.img = img; S.nativeW = img.naturalWidth; S.nativeH = img.naturalHeight; S.name = name;
    resetPipeline();
    setSourceInfo(`Đã nạp “${name}” — ảnh raster ${S.nativeW}×${S.nativeH}px. Bản gốc được giữ nguyên; mọi xử lý tạo ra bản sao.`);
    refresh();
  }
  async function loadSvgText(text, name) {
    const info = svgInfo(text);
    if (info.isRealVector) {
      S.kind = 'svg'; S.nativeSvgText = text; S.nativeSvgInfo = info; S.name = name;
      const blob = new Blob([text], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);
      const img = await loadImage(document, url);
      S.img = img; S.nativeW = info.width || img.naturalWidth || 800; S.nativeH = info.height || img.naturalHeight || 800;
      resetPipeline();
      setSourceInfo(`Đã nạp “${name}” — file SVG có ${info.vectorShapes} hình vector thật${info.paths ? ` (${info.paths} đường path)` : ''}. Đây là vector gốc: xuất SVG/PDF vector trực tiếp, không cần vector hóa.`);
    } else {
      // SVG that only wraps a raster is treated as the raster it is.
      const m = /<image[^>]+(?:href|xlink:href)\s*=\s*"(data:[^"]+)"/.exec(text);
      if (m) { await loadRasterImage(m[1], name + ' (ảnh raster trong SVG)'); return; }
      const blob = new Blob([text], { type: 'image/svg+xml' });
      await loadRasterImage(URL.createObjectURL(blob), name);
      setSourceInfo(`File SVG này không chứa đường vector thật nên được xử lý như ảnh raster.`);
    }
    refresh();
  }
  function resetPipeline() {
    S.bg = 'none'; S.mlMask = null; S.mlFor = null; S.crop = null;
    S.vectorSvg = null; S.vectorFrom = null; S.fidelity = null;
    S.color = { brightness: 0, contrast: 0, saturation: 0, monoOn: false, monoColor: '#293e35' };
    for (const [id, v] of [['#pw-bright', 0], ['#pw-contrast', 0], ['#pw-sat', 0]]) $(id).value = v;
    $('#pw-mono-on').checked = false; $('#pw-mono-row').hidden = true;
    document.querySelector('input[name="pw-bg"][value="none"]').checked = true;
    $('#pw-bg-solid').hidden = true; $('#pw-bg-ml').hidden = true;
    $('#pw-trace-status').textContent = ''; $('#pw-trace-choice').hidden = true;
    // default print width keeps the aspect: set height from width 25cm
    S.printW = 25; $('#pw-cm-w').value = 25;
    syncHeightFromWidth();
  }

  $('#pw-upload').addEventListener('change', async (e) => {
    const f = e.target.files[0]; e.target.value = '';
    if (!f) return;
    if (f.size > 10 * 1024 * 1024) { setSourceInfo('Ảnh vượt quá 10 MB. Hãy chọn ảnh nhỏ hơn.'); return; }
    await saveOriginal(f, f.name);
    if (/svg/i.test(f.type) || /\.svg$/i.test(f.name)) await loadSvgText(await f.text(), f.name);
    else {
      const url = URL.createObjectURL(f);
      const img = await loadImage(document, url);
      if (img.naturalWidth * img.naturalHeight > 25e6) { setSourceInfo('Ảnh vượt quá 25 megapixel. Hãy chọn ảnh nhỏ hơn.'); return; }
      await loadRasterImage(url, f.name);
    }
  });

  $('#pw-from-studio').addEventListener('click', async () => {
    const snap = studio.snapshot();
    const layers = (snap.faces[snap.side] || []).filter(l => l.kind === 'image');
    if (!layers.length) { setSourceInfo('Thiết kế hiện tại trong Studio chưa có lớp ảnh nào. Hãy thêm ảnh trong Studio hoặc tải ảnh ở đây.'); return; }
    const layer = layers[layers.length - 1];
    try {
      if (layer.src.startsWith('public/')) {
        const text = await (await fetch(new URL('../' + layer.src, import.meta.url))).text();
        if (/\.svg$/i.test(layer.src)) await loadSvgText(text, 'Hình thư viện từ Studio');
        else await loadRasterImage(new URL('../' + layer.src, import.meta.url).href, 'Hình từ Studio');
      } else {
        await loadRasterImage(layer.src, layer.artworkId ? 'Hình in từ Studio' : 'Ảnh của bạn từ Studio');
      }
    } catch { setSourceInfo('Chưa lấy được hình từ Studio. Hãy thử tải ảnh trực tiếp tại đây.'); }
  });

  (async () => {
    try {
      const lib = await (await fetch(new URL('../data/artwork-library.json', import.meta.url))).json();
      const sel = $('#pw-library');
      for (const d of lib.designs) { const o = document.createElement('option'); o.value = d.file; o.textContent = d.name; sel.append(o); }
      sel.addEventListener('change', async () => {
        if (!sel.value) return;
        const text = await (await fetch(new URL('../' + sel.value, import.meta.url))).text();
        await loadSvgText(text, sel.selectedOptions[0].textContent);
        sel.value = '';
      });
    } catch { /* library is optional */ }
  })();

  // ---------- pipeline ----------
  const mkCanvas = (w, h) => { const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; };
  function drawSource(canvas) { const x = canvas.getContext('2d'); x.clearRect(0, 0, canvas.width, canvas.height); x.drawImage(S.img, 0, 0, canvas.width, canvas.height); return canvas; }
  function scaledDims(maxEdge) { const s = Math.min(1, maxEdge / Math.max(S.nativeW, S.nativeH)); return [Math.max(1, Math.round(S.nativeW * s)), Math.max(1, Math.round(S.nativeH * s))]; }

  async function mlMaskFor(canvas) {
    if (S.mlMask && S.mlFor === S.img) return S.mlMask;
    const status = $('#pw-bg-status');
    status.textContent = 'Đang tải bộ tách nền AI…';
    const ortBase = new URL('../public/vendor/ort/', import.meta.url).href;
    const ort = await import(ortBase + 'ort.bundle.min.mjs');
    ort.env.wasm.wasmPaths = ortBase; ort.env.wasm.numThreads = 1;
    const model = await (await fetch(new URL('../public/models/u2netp.onnx', import.meta.url))).arrayBuffer();
    const session = await ort.InferenceSession.create(model, { executionProviders: ['wasm'] });
    status.textContent = 'Đang tách nền bằng AI trên máy của bạn…';
    const SIZE = 320;
    const small = mkCanvas(SIZE, SIZE); small.getContext('2d').drawImage(S.img, 0, 0, SIZE, SIZE);
    const px = small.getContext('2d').getImageData(0, 0, SIZE, SIZE).data;
    const input = new Float32Array(3 * SIZE * SIZE);
    const mean = [0.485, 0.456, 0.406], std = [0.229, 0.224, 0.225];
    for (let i = 0; i < SIZE * SIZE; i++) for (let c = 0; c < 3; c++) input[c * SIZE * SIZE + i] = (px[i * 4 + c] / 255 - mean[c]) / std[c];
    const tensor = new ort.Tensor('float32', input, [1, 3, SIZE, SIZE]);
    const out = await session.run({ [session.inputNames[0]]: tensor });
    const raw = out[session.outputNames[0]].data;
    let mn = Infinity, mx = -Infinity; for (const v of raw) { if (v < mn) mn = v; if (v > mx) mx = v; }
    const maskSmall = mkCanvas(SIZE, SIZE); const mctx = maskSmall.getContext('2d');
    const mid = mctx.createImageData(SIZE, SIZE);
    for (let i = 0; i < SIZE * SIZE; i++) { const v = Math.round((raw[i] - mn) / (mx - mn || 1) * 255); mid.data[i * 4] = mid.data[i * 4 + 1] = mid.data[i * 4 + 2] = 255; mid.data[i * 4 + 3] = v; }
    mctx.putImageData(mid, 0, 0);
    const mask = mkCanvas(canvas.width, canvas.height);
    const mx2 = mask.getContext('2d'); mx2.imageSmoothingEnabled = true; mx2.drawImage(maskSmall, 0, 0, mask.width, mask.height);
    S.mlMask = mask; S.mlFor = S.img;
    status.textContent = 'Đã tách nền bằng AI (chạy trên máy của bạn, ảnh không rời thiết bị).';
    return mask;
  }

  async function processedCanvas(maxEdge) {
    const [w, h] = scaledDims(maxEdge);
    let canvas = drawSource(mkCanvas(w, h));
    if (S.bg === 'solid') {
      const x = canvas.getContext('2d'); const d = x.getImageData(0, 0, w, h);
      const cut = removeSolidBackground({ data: d.data, width: w, height: h }, { tolerance: S.tol });
      x.putImageData(new ImageData(cut.data, w, h), 0, 0);
    } else if (S.bg === 'ml') {
      const mask = await mlMaskFor(canvas);
      const x = canvas.getContext('2d'); x.globalCompositeOperation = 'destination-in'; x.drawImage(mask, 0, 0); x.globalCompositeOperation = 'source-over';
    }
    // crop box: computed once on the work-size pass, reused proportionally
    if (!S.crop) {
      const x = canvas.getContext('2d'); const d = x.getImageData(0, 0, w, h);
      const t = trimTransparent({ data: d.data, width: w, height: h }, 2);
      S.crop = { x: t.x / w, y: t.y / h, w: t.image.width / w, h: t.image.height / h };
    }
    const cw = Math.max(1, Math.round(w * S.crop.w)), ch = Math.max(1, Math.round(h * S.crop.h));
    const cropped = mkCanvas(cw, ch);
    cropped.getContext('2d').drawImage(canvas, Math.round(w * S.crop.x), Math.round(h * S.crop.y), cw, ch, 0, 0, cw, ch);
    const cx = cropped.getContext('2d'); const cd = cx.getImageData(0, 0, cw, ch);
    const adj = applyColorAdjust({ data: cd.data, width: cw, height: ch }, {
      brightness: S.color.brightness, contrast: S.color.contrast, saturation: S.color.saturation,
      mono: S.color.monoOn ? S.color.monoColor : null,
    });
    cx.putImageData(new ImageData(adj.data, cw, ch), 0, 0);
    return cropped;
  }

  function processedNativeDims() {
    if (!S.crop) return [S.nativeW, S.nativeH];
    const s = Math.min(1, EXPORT_MAX / Math.max(S.nativeW, S.nativeH));
    return [Math.max(1, Math.round(S.nativeW * s * S.crop.w)), Math.max(1, Math.round(S.nativeH * s * S.crop.h))];
  }
  function printHeightCm() { const [pw, ph] = processedNativeDims(); return S.printW * ph / pw; }
  function currentDpi() { const [pw] = processedNativeDims(); return dpiFor(pw, S.printW); }
  function hasTransparency(canvas) {
    const x = canvas.getContext('2d'); const d = x.getImageData(0, 0, canvas.width, canvas.height).data;
    let clear = 0; for (let i = 3; i < d.length; i += 16) if (d[i] < 250) clear++;
    return clear > (d.length / 16) * 0.01;
  }

  // ---------- rendering ----------
  async function refresh() {
    if (!S.img || busy) return;
    busy = true;
    try {
      workCanvas = await processedCanvas(WORK_MAX);
      suggestTraceKind();
      const pv = $('#pw-preview'); const px = pv.getContext('2d');
      pv.width = 600; pv.height = Math.max(60, Math.round(600 * workCanvas.height / workCanvas.width));
      px.clearRect(0, 0, pv.width, pv.height); px.drawImage(workCanvas, 0, 0, pv.width, pv.height);
      $('#pw-preview-note').textContent = S.kind === 'svg' && !editsActive()
        ? 'Hình gốc là vector thật — bản xem trước được vẽ lại từ chính file vector.'
        : `Bản đã xử lý: ${processedNativeDims().join('×')}px (gốc ${S.nativeW}×${S.nativeH}px được giữ nguyên).`;
      updateDpi(); updateDtf(); await renderShirt();
    } finally { busy = false; }
  }
  let kindSuggestedFor = null;
  function suggestTraceKind() {
    if (!workCanvas || kindSuggestedFor === S.img) return;
    kindSuggestedFor = S.img;
    const w = workCanvas.width, h = workCanvas.height;
    const d = workCanvas.getContext('2d').getImageData(0, 0, w, h).data;
    // Photo detection by colour richness: a photograph carries thousands of
    // distinct tones (fur, skin, gradients, sensor noise) while flat logos
    // and illustrations use a small palette. Count distinct colours at
    // 5 bits/channel over a sample of the opaque pixels.
    const colours = new Set();
    for (let i = 0; i < d.length; i += 12) {
      if (d[i + 3] < 200) continue;
      colours.add(((d[i] >> 3) << 10) | ((d[i + 1] >> 3) << 5) | (d[i + 2] >> 3));
      if (colours.size > 4000) break;
    }
    $('#pw-trace-kind').value = colours.size > 1500 ? 'photo' : (S.kind === 'svg' || colours.size < 250 ? 'logo' : 'illustration');
  }
  function editsActive() { return S.bg !== 'none' || S.color.brightness || S.color.contrast || S.color.saturation || S.color.monoOn; }

  function updateDpi() {
    const el = $('#pw-dpi'); if (!S.img) { el.textContent = ''; return; }
    const dpi = currentDpi(), rating = dpiRating(dpi), h = printHeightCm();
    $('#pw-cm-h').value = h.toFixed(1);
    const maxGood = maxCmForDpi(processedNativeDims()[0], 300);
    el.className = 'pw-dpi pw-dpi-' + rating;
    el.textContent = rating === 'good'
      ? `Độ nét: ${Math.round(dpi)} DPI — tốt cho in (≥300). Kích thước in ${S.printW.toFixed(1)} × ${h.toFixed(1)} cm.`
      : rating === 'ok'
        ? `Độ nét: ${Math.round(dpi)} DPI — chấp nhận được (200–299). Muốn nét hơn, giảm rộng xuống tối đa ${maxGood.toFixed(1)} cm để đạt 300 DPI.`
        : `Độ nét: ${Math.round(dpi)} DPI — THẤP, hình in có thể bị mờ. Hãy giảm kích thước in (tối đa ${maxGood.toFixed(1)} cm cho 300 DPI) hoặc dùng ảnh gốc lớn hơn.`;
  }

  function updateDtf() {
    const ul = $('#pw-dtf'); if (!S.img || !workCanvas) { ul.innerHTML = ''; return; }
    const dpi = currentDpi(), rating = dpiRating(dpi);
    const rows = [];
    const row = (ok, warn, text) => rows.push(`<li class="${ok ? 'ok' : warn ? 'warn' : 'bad'}">${ok ? '✓' : warn ? '⚠' : '✗'} ${text}</li>`);
    row(hasTransparency(workCanvas), false, hasTransparency(workCanvas) ? 'Đã có nền trong suốt — ép nhiệt không để lại mảng nền.' : 'Hình vẫn còn nền đặc. DTF in cả mảng nền này; hãy tách nền nếu bạn không muốn in nền.');
    row(rating === 'good', rating === 'ok', `Độ phân giải ${Math.round(dpi)} DPI ở khổ in đã chọn${rating === 'good' ? ' — đạt mức khuyến nghị 300.' : rating === 'ok' ? ' — in được, chi tiết nhỏ kém nét hơn mức 300.' : ' — dưới 200, nguy cơ mờ rõ rệt.'}`);
    row(S.printW >= 8, S.printW >= 5, `Khổ in rộng ${S.printW.toFixed(1)} cm${S.printW >= 8 ? ' — đủ lớn cho chi tiết.' : ' — khổ nhỏ, chi tiết mảnh (dưới ~2 mm) có thể khó ép và dễ bong.'}`);
    const vec = chosenVectorSvg();
    row(!!vec, true, vec ? 'Có file vector thật kèm theo — xưởng dễ căn chỉnh và phóng khổ.' : 'Chưa có vector — DTF vẫn in tốt từ PNG trong suốt; vector chỉ cần khi xưởng yêu cầu.');
    rows.push('<li class="warn">⚠ Màu: file dùng hệ màu RGB; khi in DTF xưởng sẽ chuyển CMYK nên một số màu tươi có thể trầm hơn một chút.</li>');
    ul.innerHTML = rows.join('');
  }

  async function renderShirt() {
    const cvs = $('#pw-shirt'); if (!workCanvas) return;
    try {
      if (!S.garmentBase) {
        const doc = await (await fetch(new URL('../data/garments.json', import.meta.url))).json();
        S.garmentBase = compositingBases(doc).find(g => g.id && g.actualPhotoFront) || compositingBases(doc)[0];
        S.garmentImg = await loadImage(document, new URL('../' + S.garmentBase.actualPhotoFront, import.meta.url).href);
      }
      const zoneRes = zoneFor(S.garmentBase, 'front'); if (!zoneRes.ok) return;
      const zc = mkCanvas(ZONE_W, ZONE_H); const zx = zc.getContext('2d');
      const pxPerCm = ZONE_W / ZONE_CM;
      const iw = S.printW * pxPerCm, ih = iw * workCanvas.height / workCanvas.width;
      zx.drawImage(workCanvas, (ZONE_W - iw) / 2 + Number($('#pw-pos-x').value) * pxPerCm, (ZONE_H - ih) / 2 + Number($('#pw-pos-y').value) * pxPerCm, iw, ih);
      const { canvas: out } = compositeMockup(document, { garmentImg: S.garmentImg, artworkImg: zc, zone: { quad: zoneRes.zone.quad }, maskPolygon: S.garmentBase.calibration?.maskPolygon || null, shadingStrength: S.garmentBase.calibration?.shadingStrength ?? 0.35 });
      cvs.width = out.width; cvs.height = out.height;
      cvs.getContext('2d').drawImage(out, 0, 0);
    } catch { /* preview is best-effort; exports never depend on it */ }
  }

  // ---------- controls ----------
  for (const radio of document.querySelectorAll('input[name="pw-bg"]')) radio.addEventListener('change', async () => {
    S.bg = radio.value; S.crop = null;
    $('#pw-bg-solid').hidden = S.bg !== 'solid'; $('#pw-bg-ml').hidden = S.bg !== 'ml';
    if (S.bg === 'ml') $('#pw-bg-status').textContent = 'Bấm “Tải và tách nền bằng AI” để bắt đầu.';
    else { $('#pw-bg-status').textContent = S.bg === 'solid' ? 'Đang tách nền một màu…' : ''; refresh(); }
  });
  $('#pw-bg-tol').addEventListener('change', (e) => { S.tol = Number(e.target.value); S.crop = null; refresh(); });
  $('#pw-ml-run').addEventListener('click', async () => {
    if (!S.img) { $('#pw-bg-status').textContent = 'Hãy chọn hình trước.'; return; }
    try { S.crop = null; await refresh(); }
    catch { $('#pw-bg-status').textContent = 'Không tải được bộ tách nền AI (kiểm tra kết nối mạng). Hãy thử cách “Nền một màu” nếu hình của bạn có nền đơn sắc.'; }
  });
  for (const [id, key] of [['#pw-bright', 'brightness'], ['#pw-contrast', 'contrast'], ['#pw-sat', 'saturation']])
    $(id).addEventListener('change', (e) => { S.color[key] = Number(e.target.value); refresh(); });
  $('#pw-mono-on').addEventListener('change', (e) => { S.color.monoOn = e.target.checked; $('#pw-mono-row').hidden = !e.target.checked; refresh(); });
  $('#pw-mono-color').addEventListener('change', (e) => { S.color.monoColor = e.target.value; if (S.color.monoOn) refresh(); });

  function syncHeightFromWidth() { if (S.img) { const h = printHeightCm(); $('#pw-cm-h').value = h.toFixed(1); } }
  $('#pw-cm-w').addEventListener('change', (e) => { S.printW = Math.max(2, Math.min(60, Number(e.target.value) || 25)); e.target.value = S.printW; refresh(); });
  $('#pw-cm-h').addEventListener('change', (e) => {
    if (!$('#pw-lock').checked || !S.img) return;
    const [pw, ph] = processedNativeDims(); const h = Math.max(2, Number(e.target.value) || 10);
    S.printW = Math.max(2, Math.min(60, h * pw / ph)); $('#pw-cm-w').value = S.printW.toFixed(1); refresh();
  });
  $('#pw-pos-x').addEventListener('input', renderShirt);
  $('#pw-pos-y').addEventListener('input', renderShirt);

  // ---------- vectorization ----------
  let tracer = null;
  async function loadTracer() {
    if (tracer) return tracer;
    const base = new URL('../public/vendor/vtracer/', import.meta.url).href;
    const glue = await import(base + 'wasm_vtracer_bg.js');
    const bytes = await (await fetch(base + 'wasm_vtracer_bg.wasm')).arrayBuffer();
    const { instance } = await WebAssembly.instantiate(bytes, { './wasm_vtracer_bg.js': glue });
    glue.__wbg_set_wasm(instance.exports);
    if (instance.exports.__wbindgen_start) instance.exports.__wbindgen_start();
    tracer = glue; return glue;
  }
  $('#pw-trace').addEventListener('click', async () => {
    const status = $('#pw-trace-status');
    if (!workCanvas) { status.textContent = 'Hãy chọn hình trước.'; return; }
    status.textContent = 'Đang vector hóa trên máy của bạn…';
    try {
      const glue = await loadTracer();
      const w = workCanvas.width, h = workCanvas.height;
      // Trace on a sentinel background: VTracer works on opaque pixels, so
      // transparent areas are composited onto a unique magenta; cutout
      // hierarchy turns holes into real cuts; sentinel paths are then
      // stripped, restoring true transparency in the vector.
      const flat = mkCanvas(w, h); const fx = flat.getContext('2d');
      fx.fillStyle = 'rgb(255,0,255)'; fx.fillRect(0, 0, w, h); fx.drawImage(workCanvas, 0, 0);
      const data = fx.getImageData(0, 0, w, h).data;
      const cfg = new glue.TracerConfig();
      cfg.setHierarchical(glue.Hierarchical.Cutout);
      const kind = $('#pw-trace-kind').value;
      if (kind === 'photo') cfg.presetPhoto();
      else if (kind === 'logo') { cfg.setColorMode(glue.ColorMode.Color); cfg.setPathSimplifyMode(glue.PathSimplifyMode.Spline); cfg.setFilterSpeckle(6); cfg.setColorPrecision(7); cfg.setLayerDifference(12); }
      else { cfg.setColorMode(glue.ColorMode.Color); cfg.setPathSimplifyMode(glue.PathSimplifyMode.Spline); cfg.setFilterSpeckle(4); cfg.setColorPrecision(6); cfg.setLayerDifference(16); }
      cfg.setHierarchical(glue.Hierarchical.Cutout);
      const traced = glue.convertImageToSvg(new Uint8Array(data.buffer.slice(0)), w, h, cfg);
      const nearSentinel = (hex) => { const n = parseInt(hex, 16); return Math.abs(((n >> 16) & 255) - 255) + Math.abs(((n >> 8) & 255) - 0) + Math.abs((n & 255) - 255) <= 36; };
      const svg = traced.replace(/<path\b[^>]*?fill="#([0-9a-fA-F]{6})"[^>]*?(?:\/>|>\s*<\/path>)/g, (m, hex) => nearSentinel(hex) ? '' : m);
      // Render the vector back and score it against the processed raster.
      const back = mkCanvas(w, h);
      const img = await loadImage(document, URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' })));
      back.getContext('2d').drawImage(img, 0, 0, w, h);
      const bd = back.getContext('2d').getImageData(0, 0, w, h);
      const score = fidelityScore({ data: workCanvas.getContext('2d').getImageData(0, 0, w, h).data, width: w, height: h }, { data: bd.data, width: w, height: h });
      // Photos are graded strictly: continuous tone flattened into regions
      // IS quality loss even when the average colour stays close, so a photo
      // must be near-lossless to earn the vector master.
      const lim = kind === 'photo' ? { mean: 8, p90: 20, cov: 0.03 } : { mean: 16, p90: 42, cov: 0.04 };
      score.pass = score.meanDelta <= lim.mean && score.p90Delta <= lim.p90 && score.coverageDiff <= lim.cov;
      S.vectorSvg = svg; S.vectorFrom = 'trace'; S.fidelity = score;
      $('#pw-trace-choice').hidden = false;
      const vecRadio = document.querySelector('input[name="pw-master"][value="vector"]');
      const rasRadio = document.querySelector('input[name="pw-master"][value="raster"]');
      if (score.pass) { vecRadio.checked = true; status.textContent = `Vector hóa ĐẠT: lệch màu trung bình ${score.meanDelta.toFixed(1)}/255 (90% số điểm lệch dưới ${score.p90Delta.toFixed(0)}), chênh diện tích ${(score.coverageDiff * 100).toFixed(1)}%. Đã chọn bản vector làm file chính — bạn có thể đổi lại nếu muốn.`; }
      else { rasRadio.checked = true; status.textContent = `Vector hóa làm mất chi tiết (lệch màu trung bình ${score.meanDelta.toFixed(1)}/255, vùng chi tiết lệch tới ${score.p90Delta.toFixed(0)}/255, chênh diện tích ${(score.coverageDiff * 100).toFixed(1)}%). Theo nguyên tắc giữ chất lượng, xưởng giữ bản RASTER làm file chính. Bạn vẫn có thể chọn vector, nhưng không khuyến nghị cho hình này.`; }
      updateDtf();
    } catch (err) { status.textContent = 'Không vector hóa được trên thiết bị này. Bản raster vẫn xuất bình thường.'; }
  });
  function chosenVectorSvg() {
    const master = document.querySelector('input[name="pw-master"]:checked')?.value;
    if (S.kind === 'svg' && !editsActive()) return S.nativeSvgText;
    if (master === 'vector' && S.vectorSvg) return S.vectorSvg;
    if (S.kind === 'svg' && editsActive()) return null;
    return null;
  }

  // ---------- exports ----------
  function download(blob, name) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); }
  const sizeTag = () => `${S.printW.toFixed(1)}x${printHeightCm().toFixed(1)}cm`;
  function svgWithPrintSize(svg) {
    return svg.replace(/<svg\b([^>]*)>/, (m, attrs) => {
      const clean = attrs.replace(/\swidth\s*=\s*"[^"]*"/, '').replace(/\sheight\s*=\s*"[^"]*"/, '');
      return `<svg${clean} width="${S.printW.toFixed(2)}cm" height="${printHeightCm().toFixed(2)}cm">`;
    });
  }
  function summary(text) { $('#pw-summary').textContent = text; }
  function productionNote() {
    const dpi = Math.round(currentDpi());
    const vec = chosenVectorSvg();
    return `Bàn giao cho xưởng in: khổ in ${sizeTag()} cm · độ nét ${dpi} DPI · nền trong suốt · ${vec ? 'có file vector thật (SVG/PDF)' : 'file raster PNG/PDF'} · tách nền: ${S.bg === 'ml' ? 'AI trên máy' : S.bg === 'solid' ? 'nền một màu' : 'không tách'}${S.color.monoOn ? ' · in 1 màu mực' : ''}.`;
  }

  $('#pw-exp-png').addEventListener('click', async () => {
    const st = $('#pw-export-status'); if (!S.img) { st.textContent = 'Hãy chọn hình trước.'; return; }
    st.textContent = 'Đang xuất PNG ở độ phân giải gốc…';
    const canvas = await processedCanvas(EXPORT_MAX);
    const blob = await new Promise(r => canvas.toBlob(r, 'image/png'));
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const dpi = currentDpi();
    download(new Blob([pngWithDpi(bytes, dpi)], { type: 'image/png' }), `ao-in-print-${sizeTag()}-${Math.round(dpi)}dpi.png`);
    st.textContent = `Đã tải PNG ${canvas.width}×${canvas.height}px, nền trong suốt, ghi kèm ${Math.round(dpi)} DPI.`; summary(productionNote());
  });
  $('#pw-exp-svg').addEventListener('click', () => {
    const st = $('#pw-export-status');
    const svg = chosenVectorSvg();
    if (!svg) { st.textContent = 'Chưa có vector thật cho hình này. Hãy bấm “Thử vector hóa” ở bước 4 (hoặc chọn hình SVG gốc). Xưởng không đổi đuôi PNG thành SVG vì đó không phải vector.'; return; }
    download(new Blob([svgWithPrintSize(svg)], { type: 'image/svg+xml' }), `ao-in-print-${sizeTag()}-vector.svg`);
    st.textContent = 'Đã tải SVG chứa đường path vector thật, khổ in ' + sizeTag() + ' cm.'; summary(productionNote());
  });
  $('#pw-exp-pdf').addEventListener('click', async () => {
    const st = $('#pw-export-status'); if (!S.img) { st.textContent = 'Hãy chọn hình trước.'; return; }
    st.textContent = 'Đang tạo PDF đúng kích thước in…';
    const svg = chosenVectorSvg();
    const vec = svg ? svgToPdfContent(svg) : null;
    let pdf, kind;
    if (vec) { pdf = await buildPdf({ widthCm: S.printW, heightCm: printHeightCm(), vector: vec }); kind = 'vector thật'; }
    else {
      const canvas = await processedCanvas(EXPORT_MAX);
      const d = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
      pdf = await buildPdf({ widthCm: S.printW, heightCm: printHeightCm(), raster: { rgba: { data: d.data, width: canvas.width, height: canvas.height } } });
      kind = 'raster (nhúng ảnh trong suốt)';
    }
    download(new Blob([pdf], { type: 'application/pdf' }), `ao-in-print-${sizeTag()}-${vec ? 'vector' : 'raster'}.pdf`);
    st.textContent = `Đã tải PDF khổ trang đúng ${sizeTag()} cm — bản ${kind}.`; summary(productionNote());
  });
  $('#pw-to-studio').addEventListener('click', async () => {
    const st = $('#pw-export-status'); if (!workCanvas) { st.textContent = 'Hãy chọn hình trước.'; return; }
    const url = workCanvas.toDataURL('image/png');
    const wUnits = 180 * (S.printW / ZONE_CM), hUnits = wUnits * workCanvas.height / workCanvas.width;
    await studio.newDesign({
      productName: 'Áo từ Xưởng in · ' + (S.name || 'hình của bạn'),
      faces: { front: [{ kind: 'image', src: url, x: 300, y: 320, width: wUnits, height: hUnits, angle: 0, naturalWidth: processedNativeDims()[0] }], back: [] },
    });
    st.textContent = 'Đã đưa hình đã xử lý vào Studio ở đúng kích thước in đã chọn. Cuộn lên để xem trong Studio.';
  });

  // Library-native vector: when the source is a real SVG with no edits, the
  // master defaults to vector (the choice radios only govern traced output).
  host.dataset.ready = 'true';
}
