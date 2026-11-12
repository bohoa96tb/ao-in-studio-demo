// Print Production Workspace — pure core (no DOM): DPI maths, PNG pHYs,
// solid-background removal, colour adjustment, vector fidelity scoring,
// SVG inspection and a minimal honest PDF writer (real vector paths or an
// embedded raster, never a disguised rename). Node-testable: image data is
// plain {data:Uint8ClampedArray,width,height}.

export const CM_PER_INCH = 2.54;
export const DPI_GOOD = 300;
export const DPI_OK = 200;

export function dpiFor(px, cm) { return cm > 0 ? px / (cm / CM_PER_INCH) : 0; }
export function maxCmForDpi(px, dpi) { return px / dpi * CM_PER_INCH; }
export function dpiRating(dpi) {
  if (dpi >= DPI_GOOD) return 'good';
  if (dpi >= DPI_OK) return 'ok';
  return 'low';
}

// ---------- CRC32 + PNG pHYs ----------
const CRC_TABLE = (() => { const t = new Int32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c; } return t; })();
export function crc32(bytes) { let c = 0xFFFFFFFF; for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }

function chunk(type, data) {
  const out = new Uint8Array(12 + data.length);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, data.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);
  dv.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}

/** Insert/replace a pHYs chunk so the PNG itself carries the effective DPI
 *  for the chosen print size. Returns a new Uint8Array. */
export function pngWithDpi(pngBytes, dpi) {
  const sig = pngBytes.subarray(0, 8);
  let pos = 8; const parts = [sig]; let ihdrEnd = -1;
  const ppu = Math.max(1, Math.round(dpi / CM_PER_INCH * 100)); // pixels per metre
  const phys = new Uint8Array(9); const dv = new DataView(phys.buffer);
  dv.setUint32(0, ppu); dv.setUint32(4, ppu); phys[8] = 1;
  const physChunk = chunk('pHYs', phys);
  while (pos < pngBytes.length) {
    const len = new DataView(pngBytes.buffer, pngBytes.byteOffset + pos, 4).getUint32(0);
    const type = String.fromCharCode(...pngBytes.subarray(pos + 4, pos + 8));
    const whole = pngBytes.subarray(pos, pos + 12 + len);
    if (type === 'pHYs') { /* drop existing, replaced below */ }
    else parts.push(whole);
    pos += 12 + len;
    if (type === 'IHDR') { parts.push(physChunk); ihdrEnd = 1; }
    if (type === 'IEND') break;
  }
  if (!ihdrEnd) throw new Error('PNG không hợp lệ (thiếu IHDR).');
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total); let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

/** Read DPI back from a PNG's pHYs chunk (null when absent). */
export function readPngDpi(bytes) {
  let pos = 8;
  while (pos + 8 <= bytes.length) {
    const len = new DataView(bytes.buffer, bytes.byteOffset + pos, 4).getUint32(0);
    const type = String.fromCharCode(...bytes.subarray(pos + 4, pos + 8));
    if (type === 'pHYs') { const dv = new DataView(bytes.buffer, bytes.byteOffset + pos + 8, 9); return dv.getUint32(0) / 100 * CM_PER_INCH; }
    if (type === 'IEND') break;
    pos += 12 + len;
  }
  return null;
}

// ---------- Solid background removal (flood fill from the edges) ----------
/** Sample the dominant edge colour, flood-fill connected similar pixels from
 *  the border and make them transparent, with a small feather band. Interior
 *  regions of the same colour (e.g. a white shirt inside a logo) survive
 *  because they are not connected to the border. */
export function removeSolidBackground(img, { tolerance = 32, feather = 14 } = {}) {
  const { width: w, height: h, data } = img;
  const out = new Uint8ClampedArray(data);
  // background colour: median of the four corners (5x5 each)
  const corners = [[0, 0], [w - 5, 0], [0, h - 5], [w - 5, h - 5]];
  const samples = [];
  for (const [cx, cy] of corners) for (let y = Math.max(0, cy); y < Math.min(h, cy + 5); y++) for (let x = Math.max(0, cx); x < Math.min(w, cx + 5); x++) { const i = (y * w + x) * 4; samples.push([data[i], data[i + 1], data[i + 2]]); }
  samples.sort((a, b) => a[0] - b[0]); const bg = samples[Math.floor(samples.length / 2)];
  const dist = (i) => { const dr = data[i] - bg[0], dg = data[i + 1] - bg[1], db = data[i + 2] - bg[2]; return Math.sqrt(dr * dr + dg * dg + db * db); };
  const seen = new Uint8Array(w * h); const stack = [];
  const push = (x, y) => { if (x < 0 || y < 0 || x >= w || y >= h) return; const p = y * w + x; if (seen[p]) return; seen[p] = 1; if (dist(p * 4) <= tolerance + feather) stack.push(p); };
  for (let x = 0; x < w; x++) { push(x, 0); push(x, h - 1); }
  for (let y = 0; y < h; y++) { push(0, y); push(w - 1, y); }
  while (stack.length) {
    const p = stack.pop(); const x = p % w, y = (p - x) / w; const i = p * 4; const d = dist(i);
    if (d <= tolerance) out[i + 3] = 0;
    else { const t = 1 - (d - tolerance) / feather; out[i + 3] = Math.min(out[i + 3], Math.round(255 * (1 - t))); }
    push(x + 1, y); push(x - 1, y); push(x, y + 1); push(x, y - 1);
  }
  return { data: out, width: w, height: h };
}

// ---------- Colour adjustment ----------
/** brightness/contrast/saturation in [-100,100]. Optional mono ink colour:
 *  recolours to a single ink. When the image already has real transparency
 *  the alpha shape is kept; for an opaque photo the luminance becomes the
 *  alpha (dark areas print, light areas vanish) — the classic 1-colour
 *  conversion, and the UI says so before it happens. */
export function applyColorAdjust(img, { brightness = 0, contrast = 0, saturation = 0, mono = null } = {}) {
  const { width: w, height: h, data } = img;
  const out = new Uint8ClampedArray(data);
  const b = brightness * 2.55, cf = (259 * (contrast * 2.55 + 255)) / (255 * (259 - contrast * 2.55)) || 1;
  const s = 1 + saturation / 100;
  let transparentPixels = 0;
  for (let i = 3; i < data.length; i += 4) if (data[i] < 250) transparentPixels++;
  const hasAlpha = transparentPixels > data.length / 400;
  const ink = mono ? [parseInt(mono.slice(1, 3), 16), parseInt(mono.slice(3, 5), 16), parseInt(mono.slice(5, 7), 16)] : null;
  for (let i = 0; i < data.length; i += 4) {
    let r = data[i], g = data[i + 1], bl = data[i + 2]; const a = data[i + 3];
    r = cf * (r + b - 128) + 128; g = cf * (g + b - 128) + 128; bl = cf * (bl + b - 128) + 128;
    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * bl;
    r = lum + (r - lum) * s; g = lum + (g - lum) * s; bl = lum + (bl - lum) * s;
    if (ink) {
      if (hasAlpha) { out[i] = ink[0]; out[i + 1] = ink[1]; out[i + 2] = ink[2]; out[i + 3] = a; }
      else { out[i] = ink[0]; out[i + 1] = ink[1]; out[i + 2] = ink[2]; out[i + 3] = Math.round(255 - Math.max(0, Math.min(255, lum))); }
    } else { out[i] = r; out[i + 1] = g; out[i + 2] = bl; out[i + 3] = a; }
  }
  return { data: out, width: w, height: h };
}

/** Trim fully transparent margins; returns the cropped image + offsets. */
export function trimTransparent(img, pad = 0) {
  const { width: w, height: h, data } = img;
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (data[(y * w + x) * 4 + 3] > 8) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  if (x1 < 0) return { image: img, x: 0, y: 0 };
  x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad); x1 = Math.min(w - 1, x1 + pad); y1 = Math.min(h - 1, y1 + pad);
  const nw = x1 - x0 + 1, nh = y1 - y0 + 1, out = new Uint8ClampedArray(nw * nh * 4);
  for (let y = 0; y < nh; y++) out.set(data.subarray(((y0 + y) * w + x0) * 4, ((y0 + y) * w + x0 + nw) * 4), y * nw * 4);
  return { image: { data: out, width: nw, height: nh }, x: x0, y: y0 };
}

// ---------- Vector fidelity gate ----------
/** Compare the processed raster with the vectorization rendered back to the
 *  same size. pass = the vector keeps the artwork faithfully enough that
 *  offering it as the print master is honest. */
export function fidelityScore(original, rendered) {
  const n = original.width * original.height;
  if (rendered.width !== original.width || rendered.height !== original.height) return { meanDelta: 255, coverageDiff: 1, pass: false };
  let sum = 0, covA = 0, covB = 0, both = 0;
  const deltas = [];
  for (let i = 0; i < n * 4; i += 4) {
    const a1 = original.data[i + 3], a2 = rendered.data[i + 3];
    if (a1 > 24) covA++;
    if (a2 > 24) covB++;
    if (a1 > 24 && a2 > 24) { both++; const d = (Math.abs(original.data[i] - rendered.data[i]) + Math.abs(original.data[i + 1] - rendered.data[i + 1]) + Math.abs(original.data[i + 2] - rendered.data[i + 2])) / 3; sum += d; deltas.push(d); }
  }
  const meanDelta = both ? sum / both : 255;
  deltas.sort((a, b) => a - b);
  // p90 catches LOCAL detail loss (fur, gradients, small text) that a mean
  // can hide: a posterized photo averages well yet destroys texture.
  const p90Delta = deltas.length ? deltas[Math.floor(deltas.length * 0.9)] : 255;
  const coverageDiff = Math.abs(covA - covB) / n;
  return { meanDelta, p90Delta, coverageDiff, pass: meanDelta <= 16 && p90Delta <= 42 && coverageDiff <= 0.04 };
}

// ---------- SVG inspection ----------
export function svgInfo(svgText) {
  const paths = (svgText.match(/<path\b/g) || []).length;
  const shapes = (svgText.match(/<(rect|circle|ellipse|polygon|polyline|line)\b/g) || []).length;
  const hasImage = /<image\b/.test(svgText);
  const vb = /viewBox\s*=\s*"([\d.\s-]+)"/.exec(svgText);
  const parts = vb ? vb[1].trim().split(/\s+/).map(Number) : null;
  const w = /<svg[^>]*\bwidth\s*=\s*"([\d.]+)"/.exec(svgText), h = /<svg[^>]*\bheight\s*=\s*"([\d.]+)"/.exec(svgText);
  return {
    paths, shapes, hasImage,
    vectorShapes: paths + shapes,
    isRealVector: (paths + shapes) > 0 && !hasImage,
    viewBox: parts && parts.length === 4 ? parts : null,
    width: parts ? parts[2] : (w ? Number(w[1]) : null),
    height: parts ? parts[3] : (h ? Number(h[1]) : null),
    hasTransform: /transform\s*=/.test(svgText), hasGradient: /<(linear|radial)Gradient/.test(svgText),
  };
}

// ---------- SVG paths -> PDF content stream ----------
const PATH_TOKEN = /([MmLlHhVvCcSsQqTtAaZz])|(-?\d*\.?\d+(?:e[-+]?\d+)?)/g;
function parsePathD(d) {
  const tokens = []; let m; PATH_TOKEN.lastIndex = 0;
  while ((m = PATH_TOKEN.exec(d))) tokens.push(m[1] ? { cmd: m[1] } : { num: parseFloat(m[2]) });
  const ops = []; let cmd = null, i = 0, cx = 0, cy = 0, sx = 0, sy = 0, pcx = 0, pcy = 0, prevC = false;
  const nums = (k) => { const out = []; while (out.length < k && i < tokens.length && tokens[i].num !== undefined) out.push(tokens[i++].num); return out; };
  while (i < tokens.length) {
    if (tokens[i].cmd) { cmd = tokens[i++].cmd; if (cmd === 'Z' || cmd === 'z') { ops.push({ t: 'Z' }); cx = sx; cy = sy; prevC = false; continue; } }
    if (!cmd) break;
    const rel = cmd === cmd.toLowerCase(); const C = cmd.toUpperCase();
    if (C === 'M') { const [x, y] = nums(2); cx = rel ? cx + x : x; cy = rel ? cy + y : y; sx = cx; sy = cy; ops.push({ t: 'M', x: cx, y: cy }); cmd = rel ? 'l' : 'L'; prevC = false; }
    else if (C === 'L') { const [x, y] = nums(2); cx = rel ? cx + x : x; cy = rel ? cy + y : y; ops.push({ t: 'L', x: cx, y: cy }); prevC = false; }
    else if (C === 'H') { const [x] = nums(1); cx = rel ? cx + x : x; ops.push({ t: 'L', x: cx, y: cy }); prevC = false; }
    else if (C === 'V') { const [y] = nums(1); cy = rel ? cy + y : y; ops.push({ t: 'L', x: cx, y: cy }); prevC = false; }
    else if (C === 'C') { const [a, b, c2, d2, x, y] = nums(6); const X1 = rel ? cx + a : a, Y1 = rel ? cy + b : b, X2 = rel ? cx + c2 : c2, Y2 = rel ? cy + d2 : d2; cx = rel ? cx + x : x; cy = rel ? cy + y : y; ops.push({ t: 'C', x1: X1, y1: Y1, x2: X2, y2: Y2, x: cx, y: cy }); pcx = X2; pcy = Y2; prevC = true; }
    else if (C === 'S') { const [c2, d2, x, y] = nums(4); const X1 = prevC ? 2 * cx - pcx : cx, Y1 = prevC ? 2 * cy - pcy : cy, X2 = rel ? cx + c2 : c2, Y2 = rel ? cy + d2 : d2; cx = rel ? cx + x : x; cy = rel ? cy + y : y; ops.push({ t: 'C', x1: X1, y1: Y1, x2: X2, y2: Y2, x: cx, y: cy }); pcx = X2; pcy = Y2; prevC = true; }
    else if (C === 'Q') { const [a, b, x, y] = nums(4); const QX = rel ? cx + a : a, QY = rel ? cy + b : b; const X = rel ? cx + x : x, Y = rel ? cy + y : y; ops.push({ t: 'C', x1: cx + 2 / 3 * (QX - cx), y1: cy + 2 / 3 * (QY - cy), x2: X + 2 / 3 * (QX - X), y2: Y + 2 / 3 * (QY - Y), x: X, y: Y }); cx = X; cy = Y; prevC = false; }
    else if (C === 'A') { return null; } // arcs: unsupported -> caller falls back honestly
    else break;
  }
  return ops;
}

function hexRgb(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || ''); if (!m) return null;
  const n = parseInt(m[1], 16); return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

/** Convert an SVG of filled <path> elements (VTracer output, library art)
 *  into a PDF content stream with REAL path operators. Returns null when the
 *  SVG uses constructs this converter cannot honour (arcs, transforms,
 *  gradients, embedded images) so the caller can fall back transparently. */
export function svgToPdfContent(svgText) {
  const info = svgInfo(svgText);
  if (!info.isRealVector || info.hasGradient || !info.width || !info.height) return null;
  const out = [];
  const pathRe = /<path\b([^>]*?)>/g; let pm;
  const f = (v) => Math.round(v * 100) / 100;
  while ((pm = pathRe.exec(svgText))) {
    const attrs = pm[1];
    const dM = /\bd\s*=\s*"([^"]+)"/.exec(attrs); if (!dM) continue;
    const fillM = /\bfill\s*=\s*"([^"]+)"/.exec(attrs);
    const rgb = hexRgb(fillM ? fillM[1] : '#000000'); if (!rgb) continue;
    const ops = parsePathD(dM[1]); if (!ops) return null;
    // VTracer decorates paths with transform="translate(x,y)": honour pure
    // translations exactly; any other transform bails out honestly.
    const trM = /\btransform\s*=\s*"([^"]+)"/.exec(attrs);
    if (trM) {
      const t = /^translate\(\s*(-?[\d.]+)(?:[ ,]+(-?[\d.]+))?\s*\)$/.exec(trM[1].trim());
      if (!t) return null;
      const tx = parseFloat(t[1]), ty = t[2] !== undefined ? parseFloat(t[2]) : 0;
      for (const op of ops) { for (const k of ['x', 'x1', 'x2']) if (op[k] !== undefined) op[k] += tx; for (const k of ['y', 'y1', 'y2']) if (op[k] !== undefined) op[k] += ty; }
    }
    // PDF y-axis is bottom-up; SVG is top-down. Caller scales; here we flip.
    out.push(`${rgb.map(v => v.toFixed(3)).join(' ')} rg`);
    for (const op of ops) {
      if (op.t === 'M') out.push(`${f(op.x)} ${f(info.height - op.y)} m`);
      else if (op.t === 'L') out.push(`${f(op.x)} ${f(info.height - op.y)} l`);
      else if (op.t === 'C') out.push(`${f(op.x1)} ${f(info.height - op.y1)} ${f(op.x2)} ${f(info.height - op.y2)} ${f(op.x)} ${f(info.height - op.y)} c`);
      else if (op.t === 'Z') out.push('h');
    }
    out.push(/fill-rule\s*=\s*"evenodd"/.test(attrs) ? 'f*' : 'f');
  }
  if (!out.length) return null;
  return { content: out.join('\n'), srcWidth: info.width, srcHeight: info.height };
}

// ---------- Minimal PDF 1.4 writer ----------
async function deflate(bytes) {
  if (typeof CompressionStream !== 'undefined') {
    const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }
  const { deflateSync } = await import('node:zlib');
  return new Uint8Array(deflateSync(bytes));
}
const enc = (s) => new TextEncoder().encode(s);

/** Build a print PDF whose page is EXACTLY the chosen print size.
 *  Object ids are fixed: 1 Catalog, 2 Info, 3 Pages, 4 Page, 5 Contents,
 *  6 Image (raster only), 7 SMask (raster only).
 *  vector: {content, srcWidth, srcHeight} from svgToPdfContent -> real paths.
 *  raster: {rgba:{data,width,height}} -> embedded image + alpha SMask. */
export async function buildPdf({ widthCm, heightCm, vector = null, raster = null, title = 'Ao In Studio — print file' }) {
  const W = widthCm / CM_PER_INCH * 72, H = heightCm / CM_PER_INCH * 72;
  const objects = new Array(7).fill(null);
  let content, xobject = '';
  if (vector) {
    const sx = W / vector.srcWidth, sy = H / vector.srcHeight;
    content = `q ${sx.toFixed(5)} 0 0 ${sy.toFixed(5)} 0 0 cm\n${vector.content}\nQ`;
  } else if (raster) {
    const { data, width: iw, height: ih } = raster.rgba;
    const rgb = new Uint8Array(iw * ih * 3), alpha = new Uint8Array(iw * ih);
    for (let p = 0, q = 0; p < data.length; p += 4, q += 3) { rgb[q] = data[p]; rgb[q + 1] = data[p + 1]; rgb[q + 2] = data[p + 2]; alpha[q / 3] = data[p + 3]; }
    const rgbZ = await deflate(rgb), alphaZ = await deflate(alpha);
    content = `q ${W.toFixed(2)} 0 0 ${H.toFixed(2)} 0 0 cm /Im0 Do Q`;
    xobject = '/XObject << /Im0 6 0 R >>';
    objects[5] = { stream: rgbZ, dict: `<< /Type /XObject /Subtype /Image /Width ${iw} /Height ${ih} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode /SMask 7 0 R /Length ${rgbZ.length} >>` };
    objects[6] = { stream: alphaZ, dict: `<< /Type /XObject /Subtype /Image /Width ${iw} /Height ${ih} /ColorSpace /DeviceGray /BitsPerComponent 8 /Filter /FlateDecode /Length ${alphaZ.length} >>` };
  } else throw new Error('buildPdf needs vector or raster');
  objects[0] = '<< /Type /Catalog /Pages 3 0 R >>';
  objects[1] = `<< /Title (${title.replace(/[()\\]/g, '')}) /Creator (Ao In Studio Print Workspace) >>`;
  objects[2] = '<< /Type /Pages /Kids [4 0 R] /Count 1 >>';
  objects[3] = `<< /Type /Page /Parent 3 0 R /MediaBox [0 0 ${W.toFixed(2)} ${H.toFixed(2)}] /Resources << ${xobject} >> /Contents 5 0 R >>`;
  objects[4] = { stream: enc(content), dict: `<< /Length ${enc(content).length} >>` };
  const used = objects.map((o, i) => (o ? i + 1 : 0)).filter(Boolean);
  const maxId = Math.max(...used);
  const parts = [enc('%PDF-1.4\n')]; const offsets = new Array(maxId + 1).fill(0); let size = parts[0].length;
  for (let id = 1; id <= maxId; id++) {
    const body = objects[id - 1]; if (!body) continue;
    offsets[id] = size;
    const head = enc(`${id} 0 obj\n`);
    if (typeof body === 'object') { const h = enc(body.dict + '\nstream\n'); const e = enc('\nendstream'); const tail = enc('\nendobj\n'); parts.push(head, h, body.stream, e, tail); size += head.length + h.length + body.stream.length + e.length + tail.length; }
    else { const b = enc(String(body) + '\nendobj\n'); parts.push(head, b); size += head.length + b.length; }
  }
  const xrefAt = size;
  let xref = `xref\n0 ${maxId + 1}\n0000000000 65535 f \n`;
  for (let id = 1; id <= maxId; id++) xref += String(offsets[id]).padStart(10, '0') + ' 00000 n \n';
  parts.push(enc(xref + `trailer\n<< /Size ${maxId + 1} /Root 1 0 R /Info 2 0 R >>\nstartxref\n${xrefAt}\n%%EOF`));
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total); let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

/** Verification helper: read back MediaBox (points) and content markers. */
export function parsePdfInfo(bytes) {
  const text = new TextDecoder('latin1').decode(bytes);
  const mb = /\/MediaBox \[0 0 ([\d.]+) ([\d.]+)\]/.exec(text);
  return {
    mediaBoxPt: mb ? [parseFloat(mb[1]), parseFloat(mb[2])] : null,
    hasImageXObject: /\/Subtype \/Image/.test(text),
    hasPathOps: /\n[-\d. ]+ (m|l|c)\n|\s(m|l|c)\s/.test(text) || / rg\n/.test(text),
    pages: (text.match(/\/Type \/Page[^s]/g) || []).length,
  };
}
