/**
 * Áo In Studio P3.1 — LIVE compositing preview inside the Studio.
 *
 * Renders the customer's CURRENT design (text, artwork, uploaded photo,
 * transforms) onto the calibrated real garment photo with the P3 mockup
 * engine, updating on every 'studio-change'. Pilot support: crew + white
 * (#f8f6ee) + front — the one APPROVED calibrated base. Anything else
 * falls back, honestly labelled, to the P2 illustrated preview.
 *
 * The production print export is untouched: it still uses drawArtwork()
 * alone (no shading, no perspective) from studio.js.
 */
import { compositeMockup, loadImage } from './mockup-engine/composite.js?v=p31vis1';
import { compositingBases, zoneFor } from './mockup-engine/engine.js?v=p31vis1';

const ZONE = { x: 210, y: 200, w: 180, h: 280 }; // Studio crew print zone, 600x700 space (src/studio.js)

export async function mountStudioLive(studio) {
  const host = document.querySelector('#studio');
  if (!host) return;
  const panel = document.createElement('div');
  panel.className = 'studio-live';
  panel.innerHTML = `<div class="studio-live-head"><h3>Xem trước trên áo thật</h3><span id="studio-live-badge" class="studio-live-badge">Đang tải ảnh áo nền…</span></div>
  <div class="studio-live-stage"><canvas id="studio-live-canvas" width="800" height="1200" hidden></canvas><img id="studio-live-fallback" alt="Ảnh áo trống mặc trên người để tham khảo" hidden></div>
  <p id="studio-live-note" class="media-note" role="status"></p>`;
  host.querySelector('.studio-layout').before(panel);

  const canvas = panel.querySelector('#studio-live-canvas');
  const ctx = canvas.getContext('2d');
  const fallbackImg = panel.querySelector('#studio-live-fallback');
  const badge = panel.querySelector('#studio-live-badge');
  const note = panel.querySelector('#studio-live-note');

  let bases = null, visible = true;
  const garmentImgs = new Map();
  // Lazy: the garments data is fetched only when the Studio is first
  // approached, keeping it out of the initial page-load window.
  async function ensureBases() {
    if (bases) return bases;
    try {
      const garments = await fetch(new URL('../data/garments.json', import.meta.url)).then(r => r.json());
      bases = compositingBases(garments);
    } catch { bases = []; }
    if (!bases.length) { badge.textContent = 'Chưa có ảnh áo nền đã duyệt'; note.textContent = 'Ghép trực tiếp chưa khả dụng: chưa có ảnh áo nền thật nào được duyệt để ghép.'; }
    return bases;
  }
  async function imgFor(base) {
    if (!garmentImgs.has(base.garmentId)) garmentImgs.set(base.garmentId, await loadImage(document, new URL('../' + base.actualPhotoFront, import.meta.url).href));
    return garmentImgs.get(base.garmentId);
  }

  let timer = null, rendering = false, dirty = false;

  /** The calibrated base matching this design state, or null (honest fallback). */
  function supported(snap) {
    if (!bases || snap.side !== 'front' || snap.lockedBase || snap.baseImages) return null;
    return bases.find(b => b.type === snap.type && b.color === snap.color && zoneFor(b, 'front').ok) || null;
  }

  async function render() {
    if (rendering) { dirty = true; return; }
    rendering = true;
    try {
      await ensureBases();
      const snap = studio.snapshot();
      const base = supported(snap);
      if (base) {
        const garmentImg = await imgFor(base);
        const zoneResult = zoneFor(base, 'front');
        // Render the current face's layers into a print-zone canvas
        // (Studio space 600x700 -> zone sub-rect at 2x), then composite.
        const zc = document.createElement('canvas');
        zc.width = ZONE.w * 2; zc.height = ZONE.h * 2;
        const zx = zc.getContext('2d');
        zx.setTransform(2, 0, 0, 2, -ZONE.x * 2, -ZONE.y * 2);
        studio.drawLayers(zx, snap.side, snap);
        const { canvas: out } = compositeMockup(document, {
          garmentImg, artworkImg: zc,
          zone: { quad: zoneResult.zone.quad },
          maskPolygon: base.calibration?.maskPolygon || null,
          shadingStrength: base.calibration?.shadingStrength ?? 0.35,
        });
        canvas.width = out.width; canvas.height = out.height;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(out, 0, 0);
        canvas.hidden = false; fallbackImg.hidden = true;
        panel.dataset.mode = 'real';
        const author = base.source?.author || '';
        badge.textContent = 'Ảnh mô phỏng trực tiếp · ' + (base.type === 'crew' ? 'áo cổ tròn' : base.type) + ' ' + (base.colorName || '').toLowerCase();
        note.textContent = 'Thiết kế hiện tại của bạn được ghép trực tiếp lên ảnh chụp ' + (base.type === 'crew' ? 'áo cổ tròn' : 'áo') + ' ' + (base.colorName || '').toLowerCase() + ' trống thật (Pexels' + (author ? ' / ' + author : '') + '). Kéo, sửa chữ hay đổi hình ở trên — bản xem này cập nhật theo. File in xuất ra vẫn sạch, không bóng vải.';
      } else {
        const isPolo = snap.type === 'polo';
        const isBack = snap.side === 'back';
        const isBlack = snap.color === '#242424';
        let file, caption;
        if (isPolo) {
          file = 'polo-white-worn.webp';
          caption = 'Ảnh người mặc áo polo trắng trống, mặt trước · Mwabonje Ringa / Pexels';
        } else if (isBack) {
          file = 'crew-white-back-worn.webp';
          caption = 'Ảnh người mặc áo thun trắng trống, mặt sau · NJH STUDIO / Pexels';
        } else if (isBlack) {
          file = 'crew-black-woman.webp';
          caption = 'Ảnh người mặc áo thun đen trống · MART PRODUCTION / Pexels';
        } else {
          file = 'couple-white-outdoor.webp';
          caption = 'Ảnh người mặc áo thun trắng trống · Israel Torres / Pexels';
        }
        fallbackImg.src = new URL('../public/fixtures/real-tee/' + file, import.meta.url).href;
        fallbackImg.alt = caption;
        fallbackImg.hidden = false; canvas.hidden = true;
        panel.dataset.mode = 'fallback';
        badge.textContent = 'Ảnh người thật · tham khảo';
        note.textContent = caption + '. Ảnh tham khảo áo trống, không có hình in của bạn; phom, màu hoặc góc nhìn có thể khác lựa chọn. Chỉnh và xem thiết kế tại khung phía trên.';
      }
    } catch {
      panel.dataset.mode = 'fallback';
      badge.textContent = 'Mockup minh họa';
      note.textContent = 'Chưa ghép được lên ảnh áo thật lúc này — đang hiển thị mockup minh họa.';
      try { fallbackImg.src = studio.preview(studio.snapshot().side); fallbackImg.hidden = false; canvas.hidden = true; } catch { /* keep last frame */ }
    } finally {
      rendering = false;
      if (dirty) { dirty = false; schedule(); }
    }
  }
  // Perf: compositing is CPU-heavy — never run it while the panel is
  // off-screen (it would tax initial page load for nothing). The first
  // render happens when the panel approaches the viewport.
  let pendingRender = true;
  function schedule() {
    if (!visible) { pendingRender = true; return; }
    clearTimeout(timer); timer = setTimeout(render, 160);
  }

  // Gate on the whole Studio section: while the customer is anywhere in
  // the Studio, edits must update the preview live; far away, skip the work.
  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    if (visible && pendingRender) { pendingRender = false; schedule(); }
  }, { rootMargin: '200px' }).observe(host);
  document.addEventListener('studio-change', schedule);
}
