/**
 * Áo In Studio P3 — mockup engine core (pure logic, no DOM).
 *
 * Used by the browser compositor (composite.js), the batch generator
 * (scripts/mockup/generate.mjs) and Node unit tests. Nothing here renders;
 * it only validates print zones, plans the warp mesh and builds cache keys.
 *
 * Rules (docs/P3_MOCKUP_STANDARD.md):
 * - Only garments with status APPROVED and compositing.allowed may render.
 * - Worn photos are never compositing bases.
 * - The print file is never produced here; shading belongs to previews only.
 */
export const RENDERER_VERSION = 'p3-engine-1';

/** Bilinear interpolation of a quad [[x,y]x4] in TL,TR,BR,BL order. */
export function quadPoint(quad, u, v) {
  const [tl, tr, br, bl] = quad;
  const top = [tl[0] + (tr[0] - tl[0]) * u, tl[1] + (tr[1] - tl[1]) * u];
  const bot = [bl[0] + (br[0] - bl[0]) * u, bl[1] + (br[1] - bl[1]) * u];
  return [top[0] + (bot[0] - top[0]) * v, top[1] + (bot[1] - top[1]) * v];
}

/**
 * Plan a triangle mesh that warps a source rectangle (0..1 UV) onto a
 * destination quad. Returns triangles with uv[] and dst[] in the caller's
 * coordinate spaces; the compositor scales them to pixels.
 */
export function buildWarpMesh(quad, cols = 8, rows = 8) {
  if (!validateQuad(quad).ok) throw new Error('invalid quad');
  const tris = [];
  const pt = (i, j) => quadPoint(quad, i / cols, j / rows);
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const uv00 = [i / cols, j / rows], uv10 = [(i + 1) / cols, j / rows];
      const uv01 = [i / cols, (j + 1) / rows], uv11 = [(i + 1) / cols, (j + 1) / rows];
      const d00 = pt(i, j), d10 = pt(i + 1, j), d01 = pt(i, j + 1), d11 = pt(i + 1, j + 1);
      tris.push({ uv: [uv00, uv10, uv01], dst: [d00, d10, d01] });
      tris.push({ uv: [uv10, uv11, uv01], dst: [d10, d11, d01] });
    }
  }
  return tris;
}

/** A usable print quad: 4 points inside the unit square, roughly convex. */
export function validateQuad(quad) {
  if (!Array.isArray(quad) || quad.length !== 4) return { ok: false, reason: 'quad must have 4 points' };
  for (const p of quad) {
    if (!Array.isArray(p) || p.length !== 2 || p.some(n => typeof n !== 'number' || !Number.isFinite(n)))
      return { ok: false, reason: 'quad points must be [x,y] numbers' };
    if (p[0] < 0 || p[0] > 1 || p[1] < 0 || p[1] > 1) return { ok: false, reason: 'quad points must be within 0..1' };
  }
  // Signed cross products of consecutive edges must share a sign (convex, no bow-tie).
  let sign = 0;
  for (let i = 0; i < 4; i++) {
    const a = quad[i], b = quad[(i + 1) % 4], c = quad[(i + 2) % 4];
    const cross = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
    if (cross === 0) return { ok: false, reason: 'quad has a degenerate edge' };
    const s = Math.sign(cross);
    if (sign === 0) sign = s; else if (s !== sign) return { ok: false, reason: 'quad is not convex' };
  }
  return { ok: true };
}

/** Pixel-space bounding box of a normalised quad on a WxH canvas. */
export function quadBoundsPx(quad, width, height) {
  const xs = quad.map(p => p[0] * width), ys = quad.map(p => p[1] * height);
  const x = Math.min(...xs), y = Math.min(...ys);
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
}

/** Scale a quad around its own centre (for large-print variants). */
export function scaleQuad(quad, factor) {
  const cx = quad.reduce((s, p) => s + p[0], 0) / 4, cy = quad.reduce((s, p) => s + p[1], 0) / 4;
  return quad.map(([x, y]) => [
    Math.min(1, Math.max(0, cx + (x - cx) * factor)),
    Math.min(1, Math.max(0, cy + (y - cy) * factor)),
  ]);
}

/** Stable cache key: a mockup is reused unless one of these inputs changes. */
export function mockupCacheKey({ garmentId, artworkHash, view = 'front', variant = 'std' }) {
  return `${RENDERER_VERSION}:${garmentId}:${view}:${variant}:${artworkHash}`;
}

/** FNV-1a hash of artwork source text — cheap change detection for SVG files. */
export function artworkHash(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

/** Garments that may legally and technically receive composited artwork. */
export function compositingBases(garmentsDoc) {
  return (garmentsDoc?.garments || []).filter(g =>
    g.status === 'APPROVED' && g.sourceStatus === 'APPROVED' &&
    g.compositing?.allowed === true && g.actualPhotoFront);
}

/** Resolve the calibrated zone for a garment + view, or explain why not. */
export function zoneFor(garment, view = 'front') {
  if (!garment) return { ok: false, reason: 'garment not found' };
  if (garment.status !== 'APPROVED') return { ok: false, reason: 'garment not APPROVED' };
  if (!garment.compositing?.allowed) return { ok: false, reason: garment.compositing?.reason || 'compositing not allowed' };
  if (!garment.compositing.views?.includes(view)) return { ok: false, reason: `view ${view} not calibrated` };
  const zone = garment.printableZones?.[view];
  if (!zone?.quad) return { ok: false, reason: `no printable zone for ${view}` };
  const v = validateQuad(zone.quad);
  if (!v.ok) return { ok: false, reason: v.reason };
  return { ok: true, zone };
}
