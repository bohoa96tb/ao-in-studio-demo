// AI Studio P3 — DOM-free geometry for print compositing and channel export:
//  - true projective transform (homography) from a unit square onto a
//    user-defined 4-point quad on the garment photo,
//  - a fabric-wrinkle displacement field derived from garment luminance
//    (a VISUAL simulation — not a physical fabric model),
//  - cover/contain fit math + the multi-size channel export preset table,
//  - migration of P1 composition configs (rectangle) to an equivalent quad.
// Pure math only — no browser APIs — so everything here is unit-testable.
// The canvas mesh renderer lives in studio.js and consumes buildWarpGrid().

// ---------- homography (8-parameter projective transform) ----------
/**
 * Solve the homography H mapping the 4 source points onto the 4 destination
 * points (both arrays of [x,y], same order). Returns [a,b,c,d,e,f,g,h] with
 *   x' = (a·x + b·y + c) / (g·x + h·y + 1)
 *   y' = (d·x + e·y + f) / (g·x + h·y + 1)
 * Gaussian elimination with partial pivoting on the 8×8 DLT system.
 */
export function solveHomography(src, dst) {
  const A = [], b = [];
  for (let i = 0; i < 4; i++) {
    const [x, y] = src[i]; const [X, Y] = dst[i];
    A.push([x, y, 1, 0, 0, 0, -X * x, -X * y]); b.push(X);
    A.push([0, 0, 0, x, y, 1, -Y * x, -Y * y]); b.push(Y);
  }
  const n = 8;
  for (let col = 0, row = 0; col < n && row < n; col++, row++) {
    let piv = row;
    for (let r = row + 1; r < n; r++) if (Math.abs(A[r][col]) > Math.abs(A[piv][col])) piv = r;
    if (Math.abs(A[piv][col]) < 1e-12) throw new Error('Không giải được phép biến đổi phối cảnh (4 điểm suy biến).');
    [A[row], A[piv]] = [A[piv], A[row]]; [b[row], b[piv]] = [b[piv], b[row]];
    for (let r = 0; r < n; r++) {
      if (r === row) continue;
      const f = A[r][col] / A[row][col];
      for (let c = col; c < n; c++) A[r][c] -= f * A[row][c];
      b[r] -= f * b[row];
    }
  }
  return A.map((rowArr, i) => b[i] / rowArr[i]);
}
export function applyHomography(H, x, y) {
  const w = H[6] * x + H[7] * y + 1;
  return [(H[0] * x + H[1] * y + H[2]) / w, (H[3] * x + H[4] * y + H[5]) / w];
}
export const UNIT_SQUARE = [[0, 0], [1, 0], [1, 1], [0, 1]]; // TL, TR, BR, BL

// ---------- quads ----------
const clamp01 = (v) => Math.min(1, Math.max(0, v));
export function clampQuad(quad) { return quad.map(([x, y]) => [clamp01(x), clamp01(y)]); }
/** P1 rectangle config (centre % + width %) → equivalent quad in 0..1 coords. */
export function rectToQuad(printX = 50, printY = 42, printW = 34) {
  const x0 = (printX - printW / 2) / 100, x1 = (printX + printW / 2) / 100;
  const y0 = (printY - printW / 2) / 100, y1 = (printY + printW / 2) / 100;
  return clampQuad([[x0, y0], [x1, y0], [x1, y1], [x0, y1]]);
}
/** Calibrated/sensible preset quads for the built-in garment fixtures.
 * Hanger quads come from the shop's manual calibration (data/garments.json);
 * flatlay/back are hand-set chest-area defaults — all user-adjustable. */
export const GARMENT_QUADS = {
  'public/fixtures/real-tee/crew-white-hanger.webp': [[0.315, 0.375], [0.515, 0.375], [0.52, 0.585], [0.31, 0.585]],
  'public/fixtures/real-tee/crew-black-hanger.webp': [[0.335, 0.33], [0.603, 0.33], [0.608, 0.86], [0.33, 0.86]],
  'public/fixtures/real-tee/crew-white-flatlay.webp': [[0.36, 0.30], [0.62, 0.30], [0.62, 0.62], [0.36, 0.62]],
  'public/fixtures/real-tee/crew-white-back-worn.webp': [[0.35, 0.28], [0.63, 0.28], [0.64, 0.58], [0.34, 0.58]],
};
export function presetQuadFor(fixturePath) {
  const q = GARMENT_QUADS[fixturePath];
  return q ? q.map(p => [...p]) : null;
}
/**
 * Migrate a composition node config in place-ish (returns a new object):
 * P1 configs (no `mode`) become perspective mode with the equivalent quad;
 * configs already carrying P3 fields are returned with defaults filled.
 * Rotation is a simple-mode-only concept: a rotated rectangle cannot be a
 * plain quad migration, so a non-zero P1 rotation keeps simple mode (the
 * user's exact P1 rendering is preserved rather than approximated).
 */
export function migrateCompositionConfig(cfg = {}) {
  const out = { ...cfg };
  if (out.wrinkle === undefined) out.wrinkle = 35;
  if (out.shading === undefined) out.shading = 45;
  if (out.mode === undefined) {
    if ((out.rotation || 0) !== 0) { out.mode = 'simple'; return out; }
    out.mode = 'perspective';
    out.quad = rectToQuad(out.printX ?? 50, out.printY ?? 42, out.printW ?? 34);
  }
  if (out.mode === 'perspective' && !Array.isArray(out.quad)) out.quad = rectToQuad(out.printX ?? 50, out.printY ?? 42, out.printW ?? 34);
  return out;
}

// ---------- fabric-wrinkle displacement field (visual simulation) ----------
/**
 * Luminance grid: rows×cols array of 0..1 samples of the GARMENT inside the
 * quad (sampled in quad UV space). The displacement model: at (u,v) the
 * local luminance deviation from the field mean shifts the mesh vertex along
 * the quad's local axes — mostly vertically (folds are mostly horizontal on a
 * hanging shirt), partly horizontally. Amplitude scales linearly with the
 * strength slider (0–100); strength 0 ⇒ no displacement.
 */
export function fieldMean(grid) {
  let s = 0, n = 0;
  for (const row of grid) for (const v of row) { s += v; n++; }
  return n ? s / n : 0.5;
}
export function sampleField(grid, u, v) {
  const rows = grid.length, cols = grid[0].length;
  const x = Math.min(cols - 1, Math.max(0, u * (cols - 1))), y = Math.min(rows - 1, Math.max(0, v * (rows - 1)));
  const x0 = Math.floor(x), y0 = Math.floor(y), x1 = Math.min(cols - 1, x0 + 1), y1 = Math.min(rows - 1, y0 + 1);
  const fx = x - x0, fy = y - y0;
  const top = grid[y0][x0] * (1 - fx) + grid[y0][x1] * fx;
  const bot = grid[y1][x0] * (1 - fx) + grid[y1][x1] * fx;
  return top * (1 - fy) + bot * fy;
}
export const WRINKLE_AMP_V = 0.10; // max vertical shift, in UV units at strength 100, deviation ±1
export const WRINKLE_AMP_U = 0.035;
export function displacementAt(grid, mean, u, v, strength) {
  const s = Math.min(100, Math.max(0, strength || 0)) / 100;
  if (!s) return [0, 0];
  const dev = sampleField(grid, u, v) - mean;
  return [dev * s * WRINKLE_AMP_U, dev * s * WRINKLE_AMP_V];
}
/**
 * Build the render mesh: a (cols+1)×(rows+1) vertex grid. Each vertex has
 * uv (design space), displaced uv (where its garment anchor sits) and dst
 * (pixel position on the garment canvas = homography of displaced uv scaled
 * by the garment size). Displacement bends the DESIGN with the folds: the
 * design texel drawn at a garment point is pulled from the displaced uv.
 */
export function buildWarpGrid(quadPx, cols = 20, rows = 20, dispFn = null) {
  const H = solveHomography(UNIT_SQUARE, quadPx);
  const verts = [];
  for (let j = 0; j <= rows; j++) {
    const row = [];
    for (let i = 0; i <= cols; i++) {
      const u = i / cols, v = j / rows;
      const [du, dv] = dispFn ? dispFn(u, v) : [0, 0];
      const dst = applyHomography(H, u + du, v + dv);
      row.push({ u, v, dst });
    }
    verts.push(row);
  }
  return verts;
}

// ---------- cover / contain fit math ----------
/**
 * Fit a srcW×srcH image into dstW×dstH.
 * cover:  scale to fill, centre-crop the source → {sx,sy,sw,sh} source rect,
 *         destination is the full frame {dx:0,dy:0,dw:dstW,dh:dstH}.
 * contain: scale to fit inside, letterbox → full source, destination rect
 *         {dx,dy,dw,dh} centred; caller fills the frame background first.
 */
export function fitInto(srcW, srcH, dstW, dstH, mode = 'cover') {
  if (!(srcW > 0 && srcH > 0 && dstW > 0 && dstH > 0)) throw new Error('Kích thước ảnh không hợp lệ.');
  if (mode === 'contain') {
    const s = Math.min(dstW / srcW, dstH / srcH);
    const dw = srcW * s, dh = srcH * s;
    return { sx: 0, sy: 0, sw: srcW, sh: srcH, dx: (dstW - dw) / 2, dy: (dstH - dh) / 2, dw, dh };
  }
  const s = Math.max(dstW / srcW, dstH / srcH);
  const sw = dstW / s, sh = dstH / s;
  return { sx: (srcW - sw) / 2, sy: (srcH - sh) / 2, sw, sh, dx: 0, dy: 0, dw: dstW, dh: dstH };
}

// ---------- multi-size channel export presets (brief P3 priority 4) ----------
export const CHANNEL_PRESETS = [
  { id: 'website', label: 'Website 4:5 — 1200×1500', w: 1200, h: 1500, fit: 'cover' },
  { id: 'website-vuong', label: 'Website vuông — 2000×2000', w: 2000, h: 2000, fit: 'contain' },
  { id: 'facebook', label: 'Facebook — 1080×1080', w: 1080, h: 1080, fit: 'cover' },
  { id: 'facebook-ngang', label: 'Facebook ngang — 1200×630', w: 1200, h: 630, fit: 'contain' },
  { id: 'tiktok', label: 'TikTok — 1080×1920', w: 1080, h: 1920, fit: 'cover' },
  { id: 'shopee', label: 'Shopee — 1024×1024', w: 1024, h: 1024, fit: 'cover' },
];
export function channelPreset(id) { return CHANNEL_PRESETS.find(c => c.id === id) || null; }
export function channelFileName(preset, format, pattern = '') {
  const ext = format === 'jpg' ? 'jpg' : 'png';
  const base = `${preset.id}-${preset.w}x${preset.h}.${ext}`;
  const p = String(pattern || '').trim().replace(/[^\p{L}\p{N}-]+/gu, '-').replace(/^-+|-+$/g, '');
  return p ? `${p}-${base}` : base;
}
