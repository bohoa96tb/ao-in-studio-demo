/**
 * Áo In Studio P3 — Canvas compositor (browser / Playwright page context).
 *
 * Pipeline (docs/P3_MOCKUP_STANDARD.md):
 *  1. Draw the approved blank-garment photo full-frame.
 *  2. Warp the artwork (transparent PNG/SVG raster) onto the calibrated
 *     print quad with a triangle mesh (perspective-correct enough for a
 *     hanging/flat garment; no external libraries).
 *  3. Seat the print into the fabric: a grayscale copy of the garment photo
 *     is multiplied over the artwork layer only, so folds and light falloff
 *     of the real photo shade the print. Artwork hues are preserved; only
 *     luminance follows the fabric. The print-production file is NEVER made
 *     here — exports stay shading-free (see src/studio.js export-art).
 *  4. Clip the artwork layer to the garment silhouette mask so a print can
 *     never spill outside the shirt.
 *
 * On any failure the caller must fall back to the P2 renderer.
 */
import { buildWarpMesh, quadBoundsPx } from './engine.js';

export function loadImage(doc, src) {
  return new Promise((resolve, reject) => {
    const img = doc.createElement('img');
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('image load failed: ' + src));
    img.src = src;
  });
}

function makeCanvas(doc, w, h) {
  const c = doc.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

/** Affine transform mapping source triangle -> destination triangle. */
function triangleTransform(ctx, s, d) {
  const [sx0, sy0, sx1, sy1, sx2, sy2] = [s[0][0], s[0][1], s[1][0], s[1][1], s[2][0], s[2][1]];
  const [dx0, dy0, dx1, dy1, dx2, dy2] = [d[0][0], d[0][1], d[1][0], d[1][1], d[2][0], d[2][1]];
  const denom = (sx1 - sx0) * (sy2 - sy0) - (sx2 - sx0) * (sy1 - sy0);
  if (!denom) return false;
  const a = ((dx1 - dx0) * (sy2 - sy0) - (dx2 - dx0) * (sy1 - sy0)) / denom;
  const b = ((dy1 - dy0) * (sy2 - sy0) - (dy2 - dy0) * (sy1 - sy0)) / denom;
  const c = ((dx2 - dx0) * (sx1 - sx0) - (dx1 - dx0) * (sx2 - sx0)) / denom;
  const d2 = ((dy2 - dy0) * (sx1 - sx0) - (dy1 - dy0) * (sx2 - sx0)) / denom;
  const e = dx0 - a * sx0 - c * sy0;
  const f = dy0 - b * sx0 - d2 * sy0;
  ctx.setTransform(a, b, c, d2, e, f);
  return true;
}

/** Draw `img` warped so its unit square lands on `quad` (normalised coords). */
export function warpOnto(ctx, img, quad, outW, outH, cols = 10, rows = 10) {
  const mesh = buildWarpMesh(quad, cols, rows);
  for (const tri of mesh) {
    const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
    const s = tri.uv.map(([u, v]) => [u * iw, v * ih]);
    const raw = tri.dst.map(([x, y]) => [x * outW, y * outH]);
    // Expand each destination triangle ~1.8px around its centroid so
    // neighbours overlap — antialiased clips on a transparent canvas
    // otherwise erode alpha along every mesh edge (visible grid).
    const cx = (raw[0][0] + raw[1][0] + raw[2][0]) / 3, cy = (raw[0][1] + raw[1][1] + raw[2][1]) / 3;
    const r = raw.reduce((s, [x, y]) => s + Math.hypot(x - cx, y - cy), 0) / 3 || 1;
    const f = (r + 1.8) / r;
    const d = raw.map(([x, y]) => [cx + (x - cx) * f, cy + (y - cy) * f]);
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(d[0][0], d[0][1]);
    ctx.lineTo(d[1][0], d[1][1]);
    ctx.lineTo(d[2][0], d[2][1]);
    ctx.closePath();
    ctx.clip();
    if (triangleTransform(ctx, s, raw)) ctx.drawImage(img, 0, 0);
    ctx.restore();
  }
}

/**
 * Composite one mockup. Returns { canvas, artLayer } — artLayer is the
 * shaded, masked artwork layer before blending (used by fidelity QA).
 */
export function compositeMockup(doc, { garmentImg, artworkImg, zone, maskPolygon = null, shadingStrength = 0.35 }) {
  const W = garmentImg.naturalWidth, H = garmentImg.naturalHeight;
  const out = makeCanvas(doc, W, H);
  const octx = out.getContext('2d');
  octx.drawImage(garmentImg, 0, 0);

  // Artwork layer in output coordinates.
  const art = makeCanvas(doc, W, H);
  const actx = art.getContext('2d');
  warpOnto(actx, artworkImg, zone.quad, W, H);

  // Fabric shading, per-pixel over the print zone only: each artwork pixel
  // is darkened toward the garment photo's own luminance (folds, light
  // falloff). A scalar multiply preserves artwork hue and alpha exactly —
  // a canvas 'multiply' composite would not (it turns transparent pixels
  // opaque and needs an alpha restore that re-introduces mesh seams).
  if (shadingStrength > 0) {
    const s = Math.min(1, Math.max(0, shadingStrength));
    const shade = makeCanvas(doc, W, H);
    const sctx = shade.getContext('2d');
    sctx.drawImage(garmentImg, 0, 0);
    const b = quadBoundsPx(zone.quad, W, H);
    const x0 = Math.max(0, Math.floor(b.x)), y0 = Math.max(0, Math.floor(b.y));
    const x1 = Math.min(W, Math.ceil(b.x + b.width)), y1 = Math.min(H, Math.ceil(b.y + b.height));
    const artData = actx.getImageData(x0, y0, x1 - x0, y1 - y0);
    const shadeData = sctx.getImageData(x0, y0, x1 - x0, y1 - y0);
    const a = artData.data, g = shadeData.data;
    for (let i = 0; i < a.length; i += 4) {
      if (a[i + 3] === 0) continue;
      const lum = (0.2126 * g[i] + 0.7152 * g[i + 1] + 0.0722 * g[i + 2]) / 255;
      const factor = 1 - s * (1 - lum);
      a[i] *= factor; a[i + 1] *= factor; a[i + 2] *= factor;
    }
    actx.putImageData(artData, x0, y0);
  }

  // Silhouette mask: a print must never leave the garment.
  if (maskPolygon?.length >= 3) {
    actx.save();
    actx.globalCompositeOperation = 'destination-in';
    actx.beginPath();
    maskPolygon.forEach(([x, y], i) => {
      const px = x * W, py = y * H;
      if (i === 0) actx.moveTo(px, py); else actx.lineTo(px, py);
    });
    actx.closePath();
    actx.fill();
    actx.restore();
  }

  octx.drawImage(art, 0, 0);
  return { canvas: out, artLayer: art };
}

/** Fraction of pixels with alpha > 10 — used by artwork fidelity checks. */
export function alphaCoverage(canvas) {
  const ctx = canvas.getContext('2d');
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  let n = 0;
  for (let i = 3; i < data.length; i += 4) if (data[i] > 10) n++;
  return n / (data.length / 4);
}

/** Reference render of the artwork alone inside the zone bounds. */
export function artworkReference(doc, artworkImg, zone, garmentW, garmentH) {
  const b = quadBoundsPx(zone.quad, garmentW, garmentH);
  const c = makeCanvas(doc, b.width, b.height);
  c.getContext('2d').drawImage(artworkImg, 0, 0, c.width, c.height);
  return c;
}
