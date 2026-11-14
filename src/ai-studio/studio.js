// AI Studio P1 — node editor UI (vanilla JS, Pointer Events for mouse+touch),
// workflow execution via engine.js, project persistence in IndexedDB
// `ao-in-ai-studio`. AI nodes run the DEMO adapter until a real provider is
// configured; every demo output is visibly labelled.
import { NODE_DEFS, NODE_TYPES, TEMPLATES, emptyGraph, makeNode, findNode, validateConnection, buildPrompt, garmentParams, garmentSummaryVi, GARMENT_OPTIONS, DEMO_FIGURE, PHOTO_BASES, photoBaseFor, AI_MODEL_BASES, aiModelBaseFor, refreshTpl1Graph, PROMPT_OPTIONS, PROMPT_TEMPLATES, checkSvgSafety, zipWrite, zipRead, uid, SAMPLE_DESIGN_SVG } from './core.js';
import { Engine, downstreamOf, upstreamOf } from './engine.js';
import { nodeCacheKey, isCacheable, RunQueue, validateWorkflow, collectReferencedAssetIds, findOrphanAssets, pruneOldest, formatDuration } from './p2.js';
import { DemoAdapter, HttpAdapter, PollinationsClassicAdapter, PollinationsKeyedAdapter, setSessionKey, hasSessionKey, BROWSER_KEY_WARNING, POLLINATIONS_KEY_WARNING, AUTO_TOPUP_WARNING, COMMERCIAL_USE_NOTE, PROVIDERS, providerById, modelOf, isRunnableModel, resolveGenerationMode, suppressRetryForMode, sizeForRatio, estimateGenerationCost, describePlannedCalls, describeProvider } from './providers.js';
import { solveHomography, applyHomography, UNIT_SQUARE, rectToQuad, presetQuadFor, migrateCompositionConfig, torsoQuadFor, framingAspectClass, passesHalfBodyFraming, fieldMean, displacementAt, buildWarpGrid, fitInto, channelFitMode, CHANNEL_PRESETS, channelPreset, channelFileName } from './warp.js';
import { store, storageEstimate } from './store.js';

const $ = (s) => document.querySelector(s);
const FIXTURES = [
  ['public/fixtures/real-tee/crew-white-hanger.webp', 'Áo trắng trên móc (ảnh thật)'],
  ['public/fixtures/real-tee/crew-white-flatlay.webp', 'Áo trắng trải phẳng (ảnh thật)'],
  ['public/fixtures/real-tee/crew-black-hanger.webp', 'Áo đen trên móc (ảnh thật)'],
  ['public/fixtures/real-tee/crew-white-back-worn.webp', 'Áo trắng mặt sau (ảnh thật)'],
];
let graph = emptyGraph();
let projectId = uid('project');
let selectedId = null, selectedEdgeId = null;
let propsForcedOpen = false; // P4: toolbar button opens the settings/provider sheet on mobile
let view = { x: 40, y: 30, k: 0.9 };
let history = [], historyIdx = -1;
let engine = null, outputs = new Map();
let providerKind = 'demo';
// ---- P4 state: real-AI mode. Session-only, NEVER persisted: the master
// switch defaults to OFF on every page load, and the keyed provider needs a
// session key + an explicit in-panel confirmation before it can spend. ----
const aiState = { realEnabled: false, keyedConfirmed: false, classicModel: 'sana', keyedModel: 'flux' };
let runRealCalls = []; // actual real-provider calls of the current run (for history)
const runtime = { previewValue: null };
// ---- P2 state: run queue, run settings, failure/resume, progress timer ----
const RUN_HISTORY_CAP = 50, VERSION_CAP = 20;
const runSettings = { retriesAi: 1, timeoutSec: 60 };
let lastFailedNodeId = null, lastRunProjectId = null;
let runTimer = null, runStartedAt = 0;
const runQueue = new RunQueue(({ busy, waiting }) => {
  const el = $('#ais-run-progress');
  if (el && !busy && !waiting) return;
  if (el && (busy || waiting)) el.textContent = `Hàng đợi chạy: ${busy ? 'đang chạy 1 lượt' : 'đang chờ'}${waiting ? ` · ${waiting} lượt đang chờ` : ''}`;
});

function message(msg, isError = false) { const el = $('#ais-message'); el.textContent = msg; el.classList.toggle('err', isError); logLine(msg); }
function logLine(msg) { const li = document.createElement('li'); li.textContent = `${new Date().toLocaleTimeString('vi-VN')} — ${msg}`; const ul = $('#ais-log'); ul.prepend(li); while (ul.children.length > 60) ul.lastChild.remove(); }

// ---------- image helpers ----------
const loadImg = (src) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
async function blobToImg(blob) { const url = URL.createObjectURL(blob); try { return await loadImg(url); } finally { /* keep url alive during draw; revoked by GC of blob url pool */ } }
const canvasBlob = (c, type = 'image/png', q = 0.92) => new Promise(r => c.toBlob(r, type, q));
function makeCanvas(w, h) { const c = document.createElement('canvas'); c.width = Math.max(2, Math.round(w)); c.height = Math.max(2, Math.round(h)); return c; }
function valueFromBlob(blob, kind, extra = {}) { return { kind, blob, url: URL.createObjectURL(blob), mime: blob.type, name: extra.name || 'ket-qua', demo: !!extra.demo, label: extra.label || '', svgText: extra.svgText || '', baseQuad: extra.baseQuad || null, photoBase: extra.photoBase || '', baseKind: extra.baseKind || '', garment: extra.garment || null, realAi: !!extra.realAi }; }
async function fetchBlob(url) { const r = await fetch(url); if (!r.ok) throw new Error('Không tải được file: ' + url); return r.blob(); }
function wrapText(ctx, text, x, y, maxW, lh) { const words = String(text).split(/\s+/); let line = '', yy = y; for (const w of words) { const t = line ? line + ' ' + w : w; if (ctx.measureText(t).width > maxW && line) { ctx.fillText(line, x, yy); line = w; yy += lh; } else line = t; } if (line) ctx.fillText(line, x, yy); return yy; }
function drawDemoBanner(ctx, w, text = 'ẢNH DEMO — chưa kết nối AI', h = 0) { ctx.save(); const stripH = h > 0 ? Math.max(30, Math.round(h * 0.045)) : 54; const fontPx = h > 0 ? Math.round(stripH * 0.48) : 26; ctx.fillStyle = 'rgba(32,32,32,0.88)'; ctx.fillRect(0, 0, w, stripH); ctx.fillStyle = '#ffb59d'; ctx.font = `bold ${fontPx}px Arial`; ctx.textAlign = 'center'; ctx.fillText(text, w / 2, Math.round(stripH * 0.685)); ctx.restore(); }
// P4.2 supplementary (FIX D): when h is given, the strip is 4.5% of the
// canvas height — the SAME fraction stampDemoFrame stamps onto channel
// exports — so the export stamp covers the baked strip exactly (one
// clean banner). The old fixed 54px was 5.6% of the 960px-tall figure
// canvas vs 4.5% of the 1200px photo, leaving a ghost strip under the
// stamp in figure-based exports.
/**
 * P4.2 supplementary (FIX D): the DEMO frame (dark banner strip + text +
 * terracotta border) is re-stamped on the FINAL channel image, AFTER the
 * crop/resize — sized relative to the final image so every export carries
 * the SAME treatment. (Round 1 baked the banner into the generated image
 * only: the website cover-crop then cut the black case's banner off the
 * top while white/oversize kept theirs.) Stamping the identical strip
 * over the top of an uncropped image is a no-op visually — the strip
 * height matches the generator's 54px-at-1200 ≈ 4.5% of height.
 */
/** Backdrop colour of a source image, sampled from the image itself:
 * two vertical bands at the far left/right edges, 18–34% down — pure
 * studio backdrop in a garment photo (below the baked DEMO banner,
 * outside the centred subject; edge-to-edge sampling lower down would
 * average in arms, sleeves and jeans and darken the pad). Used ONLY to
 * pad the extreme-aspect channel-export fallback (channelFitMode) so a
 * contained garment photo sits on its own studio backdrop instead of a
 * mismatched seam. */
function sampleBackdropColor(img) {
  const W = img.naturalWidth || img.width, H = img.naturalHeight || img.height;
  const pw = Math.max(8, Math.round(W * 0.03)), ph = Math.max(8, Math.round(H * 0.16));
  const sy = Math.round(H * 0.18);
  let r = 0, g = 0, b = 0, n = 0;
  for (const sx of [Math.round(W * 0.01), Math.round(W * 0.99) - pw]) {
    const c = makeCanvas(pw, ph), x = c.getContext('2d');
    x.drawImage(img, sx, sy, pw, ph, 0, 0, pw, ph);
    const d = x.getImageData(0, 0, pw, ph).data;
    for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; n++; }
  }
  return `rgb(${Math.round(r / n)}, ${Math.round(g / n)}, ${Math.round(b / n)})`;
}
function stampDemoFrame(ctx, w, h) {
  const sh = Math.max(28, Math.round(h * 0.045));
  ctx.save();
  ctx.fillStyle = 'rgba(32,32,32,0.88)'; ctx.fillRect(0, 0, w, sh);
  ctx.fillStyle = '#ffb59d'; ctx.font = `bold ${Math.round(sh * 0.48)}px Arial`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('ẢNH DEMO — chưa kết nối AI', w / 2, sh / 2 + 1);
  ctx.strokeStyle = '#b6492f'; ctx.lineWidth = Math.max(4, Math.round(w * 0.0083));
  const inset = ctx.lineWidth / 2; ctx.strokeRect(inset, inset, w - ctx.lineWidth, h - ctx.lineWidth);
  ctx.restore();
}

// ---------- demo provider implementation (canvas-derived, honestly labelled) ----------
/**
 * DEMO model figure (P4.1; redrawn in P4.2 ROUND 3 to the owner's
 * e-commerce framing): a simple stylised model in MEDIUM HALF-BODY
 * framing — top of head → past the hips, camera at chest height, plain
 * light-grey studio backdrop (#F2F2F2 family), standing upright and
 * facing the camera, arms relaxed along the body, hair NOT over the
 * chest, the ENTIRE plain t-shirt visible (collar, both shoulders, both
 * sleeves, bottom hem + trousers waistband below it). Oversize = a
 * genuinely wider + longer silhouette. Fully deterministic — geometry
 * comes from DEMO_FIGURE (core.js) landmarks, so the composition quad
 * (torsoQuadFor) matches the figure exactly. This is a DRAWING, honestly
 * labelled as such — it exists because no verified real photo currently
 * passes the owner's model-photo checklist.
 */
function drawDemoFigure(x, W, H, garment) {
  const fitKey = garment.style === 'oversize' ? 'oversize' : 'regular';
  const fit = DEMO_FIGURE.torso[fitKey];
  const lm = DEMO_FIGURE.landmarks[fitKey];
  const [tx0, tx1] = fit.span;
  const shY = fit.shoulderY * H, hemY = fit.hemY * H;
  const X = (f) => f * W, Y = (f) => f * H;
  // plain bright neutral studio backdrop (#F2F2F2 → slightly deeper floor)
  const bg = x.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#f4f4f2'); bg.addColorStop(0.8, '#ececea'); bg.addColorStop(1, '#dededb');
  x.fillStyle = bg; x.fillRect(0, 0, W, H);
  x.fillStyle = 'rgba(90,90,90,0.10)'; x.fillRect(0, Y(0.94), W, H - Y(0.94));
  const skin = '#eec39f', skinDark = '#c98f5f', hair = '#3a2a20';
  // arms (skin) hanging relaxed ALONGSIDE the body, below the sleeves:
  // from just under the sleeve ends down to hip level, hands included.
  x.fillStyle = skin;
  const armW = 0.042 * W, sleeveEndY = shY + 0.185 * H;
  x.fillRect(X(tx0) - armW - 0.004 * W, sleeveEndY - 0.02 * H, armW, (hemY + 0.10 * H) - sleeveEndY);
  x.fillRect(X(tx1) + 0.004 * W, sleeveEndY - 0.02 * H, armW, (hemY + 0.10 * H) - sleeveEndY);
  x.beginPath(); x.arc(X(tx0) - armW / 2 - 0.004 * W, hemY + 0.105 * H, armW * 0.55, 0, Math.PI * 2); x.fill();
  x.beginPath(); x.arc(X(tx1) + armW / 2 + 0.004 * W, hemY + 0.105 * H, armW * 0.55, 0, Math.PI * 2); x.fill();
  // trousers below the hem — with a visible WAISTBAND strip right under
  // the hem, so the garment's length can be judged (round-3 standard).
  x.fillStyle = '#45454e'; x.fillRect(X(tx0 + 0.03), hemY, X(tx1 - 0.03) - X(tx0 + 0.03), H - hemY);
  x.fillStyle = '#33333c'; x.fillRect(X(tx0 + 0.03), hemY, X(tx1 - 0.03) - X(tx0 + 0.03), 0.02 * H);
  x.fillStyle = 'rgba(255,255,255,0.20)'; x.fillRect(X(0.5) - 0.014 * W, hemY + 0.004 * H, 0.028 * W, 0.012 * H); // waistband button hint
  // neck + head + simple face — head sized for half-body framing
  // (centre 0.13, radius 0.068·H: top of head 0.062, chin ≈ 0.198; the
  // exposed neck is only ≈0.05 of height — an earlier draft put the
  // shoulders at 0.315+ with a smaller, higher head and produced a
  // giraffe neck that visual review rejected).
  x.fillStyle = skin; x.fillRect(X(0.474), Y(0.185), X(0.526) - X(0.474), shY + 0.012 * H - Y(0.185));
  x.beginPath(); x.arc(X(0.5), Y(0.13), 0.068 * H, 0, Math.PI * 2); x.fillStyle = skin; x.fill();
  x.fillStyle = '#2b2b2b';
  for (const sgn of [-1, 1]) { x.beginPath(); x.arc(X(0.5) + sgn * 0.024 * H, Y(0.132), 0.005 * H, 0, Math.PI * 2); x.fill(); }
  x.beginPath(); x.arc(X(0.5), Y(0.144), 0.018 * H, Math.PI * 0.15, Math.PI * 0.85); x.strokeStyle = skinDark; x.lineWidth = Math.max(2, 0.0035 * H); x.stroke();
  // hair: cap + SHORT side locks ending at the jaw line — nothing hangs
  // over the shoulders or the chest (round-3 standard).
  x.fillStyle = hair;
  x.beginPath(); x.arc(X(0.5), Y(0.122), 0.07 * H, Math.PI * 1.02, Math.PI * 1.98); x.lineTo(X(0.5) + 0.07 * H, Y(0.112)); x.lineTo(X(0.5) - 0.07 * H, Y(0.112)); x.closePath(); x.fill();
  x.fillRect(X(0.5) - 0.07 * H, Y(0.10), 0.016 * H, 0.088 * H);
  x.fillRect(X(0.5) + 0.054 * H, Y(0.10), 0.016 * H, 0.088 * H);
  // the PLAIN t-shirt silhouette — full garment: collar, both shoulders,
  // both sleeves, straight body down to the hem at hemY.
  const sx0 = X(tx0), sx1 = X(tx1);
  const tee = new Path2D();
  tee.moveTo(X(0.455), shY - 0.012 * H);
  tee.lineTo(sx0 + 0.028 * W, shY);
  tee.lineTo(sx0 - 0.018 * W, shY + 0.035 * H);
  tee.lineTo(sx0 + 0.018 * W, shY + 0.185 * H);
  tee.lineTo(sx0 + 0.03 * W, shY + 0.17 * H);
  tee.lineTo(sx0 + 0.005 * W, hemY);
  tee.lineTo(sx1 - 0.005 * W, hemY);
  tee.lineTo(sx1 - 0.03 * W, shY + 0.17 * H);
  tee.lineTo(sx1 - 0.018 * W, shY + 0.185 * H);
  tee.lineTo(sx1 + 0.018 * W, shY + 0.035 * H);
  tee.lineTo(sx1 - 0.028 * W, shY);
  tee.lineTo(X(0.545), shY - 0.012 * H);
  tee.quadraticCurveTo(X(0.5), shY + 0.052 * H, X(0.455), shY - 0.012 * H);
  tee.closePath();
  x.fillStyle = garment.colorHex || '#f4f4f2'; x.fill(tee);
  // soft side shading + gentle fold strokes, clipped to the tee
  x.save(); x.clip(tee);
  const sh = x.createLinearGradient(sx0, 0, sx1, 0);
  sh.addColorStop(0, 'rgba(0,0,0,0.13)'); sh.addColorStop(0.18, 'rgba(0,0,0,0)');
  sh.addColorStop(0.5, 'rgba(255,255,255,0.05)'); sh.addColorStop(0.82, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(0,0,0,0.13)');
  x.fillStyle = sh; x.fillRect(0, 0, W, H);
  x.strokeStyle = 'rgba(0,0,0,0.05)'; x.lineWidth = Math.max(2, 0.006 * H);
  const torsoLen = lm.hemY - lm.collarBottomY;
  for (const fr of [0.45, 0.72]) { const fy = lm.collarBottomY + fr * torsoLen; x.beginPath(); x.moveTo(sx0 + 0.05 * W, Y(fy)); x.quadraticCurveTo(X(0.5), Y(fy) + 0.012 * H, sx1 - 0.05 * W, Y(fy)); x.stroke(); }
  x.restore();
  // crew-neck collar band — its curve dip (0.02) + stroke place the
  // collar's lower edge at DEMO_FIGURE.landmarks collarBottomY.
  x.beginPath(); x.moveTo(X(0.455), shY - 0.012 * H); x.quadraticCurveTo(X(0.5), shY + 0.052 * H, X(0.545), shY - 0.012 * H);
  x.strokeStyle = 'rgba(0,0,0,0.28)'; x.lineWidth = Math.max(3, 0.009 * H); x.stroke();
  // hem stitch line just above the bottom hem
  x.beginPath(); x.moveTo(sx0 + 0.008 * W, hemY - 0.014 * H); x.lineTo(sx1 - 0.008 * W, hemY - 0.014 * H);
  x.strokeStyle = 'rgba(0,0,0,0.16)'; x.lineWidth = Math.max(2, 0.0035 * H); x.stroke();
}
const demoImpl = {
  async demoImage({ prompt, image }) {
    const [rw, rh] = { '4:5': [768, 960], '1:1': [864, 864], '9:16': [720, 1280], '16:9': [1280, 720] }[prompt?.ratio || '4:5'] || [768, 960];
    const c = makeCanvas(rw, rh), x = c.getContext('2d');
    // P4.1: garment params + NO reference image → a PLAIN-tee garment base.
    // A wired reference image keeps the legacy P1–P4 wash behaviour
    // (templates 2–4 unchanged).
    if (prompt?.garment && !image?.blob) {
      // P4.2 ROUND 4: when an owner-approved AI-GENERATED MODEL image
      // exists for these garment params (AI_MODEL_BASES in core.js —
      // white crew / black crew / white oversize), DEMO returns THAT
      // image as the model base with its torso-rule quad. The label
      // says plainly that the model image is AI-generated (it is NOT a
      // photograph and is never presented as one); the run itself made
      // no AI call — the images were generated once from the owner's
      // verbatim catalog prompt and approved by the owner 2026-11-14.
      const ab = aiModelBaseFor(prompt.garment);
      if (ab) {
        const photo = await blobToImg(await fetchBlob(ab.base.path));
        const pc = makeCanvas(photo.width, photo.height), px = pc.getContext('2d');
        px.drawImage(photo, 0, 0);
        drawDemoBanner(px, pc.width, 'ẢNH DEMO — chưa kết nối AI', pc.height);
        px.strokeStyle = '#b6492f'; px.lineWidth = 10; px.strokeRect(5, 5, pc.width - 10, pc.height - 10);
        return valueFromBlob(await canvasBlob(pc), 'image', { demo: true, baseQuad: ab.quad, photoBase: ab.base.id, baseKind: 'ai-model', label: `Ảnh người mẫu do AI tạo (chưa phải ảnh chụp thật) — hình in ghép hậu kỳ bằng file gốc. Người mẫu AI mặc áo thun TRƠN đúng màu/phom đã chọn, ngực trống; ảnh được tạo bằng prompt catalogue nguyên văn của chủ shop và được chủ shop duyệt 2026-11-14. Lượt chạy DEMO này chưa gọi AI.` });
      }
      // When a VERIFIED REAL MODEL PHOTO exists for these garment params
      // (kind 'model' in PHOTO_BASES — round 3: currently NONE, see
      // core.js), DEMO returns that photo as the reference base
      // (labelled — never claimed to be AI-generated) with its
      // torso-rule quad, so the composition lands centre-chest.
      const pb = photoBaseFor(prompt.garment);
      if (pb) {
        const photo = await blobToImg(await fetchBlob(pb.base.path));
        const pc = makeCanvas(photo.width, photo.height), px = pc.getContext('2d');
        px.drawImage(photo, 0, 0);
        drawDemoBanner(px, pc.width, 'ẢNH DEMO — chưa kết nối AI', pc.height);
        px.strokeStyle = '#b6492f'; px.lineWidth = 10; px.strokeRect(5, 5, pc.width - 10, pc.height - 10);
        return valueFromBlob(await canvasBlob(pc), 'image', { demo: true, baseQuad: pb.quad, photoBase: pb.base.id, baseKind: 'photo', label: `DEMO — dùng ảnh chụp thật làm ảnh nền tham chiếu, chưa gọi AI. Ảnh: ${pb.base.name} (Pexels ${pb.base.source.photoId}, tác giả ${pb.base.source.author}). Áo trong ảnh là áo TRƠN; hình in gốc được ghép hậu kỳ.` });
      }
      // No approved AI model image and no verified photo for these
      // params → the drawn figure (unmapped combos only in round 4:
      // other colours, black oversize, 3/4 view). The figure canvas is 900×1125 at the 4:5 ratio
      // so its aspect matches the photo fixtures; its quad is derived
      // from the figure landmarks via torsoQuadFor at the canvas's own
      // aspect — the same torso rule as every other base.
      const fitKey = prompt.garment.style === 'oversize' ? 'oversize' : 'regular';
      const [fw, fh] = (prompt.ratio || '4:5') === '4:5' ? [900, 1125] : [rw, rh];
      const fc = makeCanvas(fw, fh), fx = fc.getContext('2d');
      drawDemoFigure(fx, fw, fh, prompt.garment);
      drawDemoBanner(fx, fw, 'ẢNH DEMO — chưa kết nối AI', fh);
      fx.strokeStyle = '#b6492f'; fx.lineWidth = 10; fx.strokeRect(5, 5, fw - 10, fh - 10);
      const figQuad = torsoQuadFor(DEMO_FIGURE.landmarks[fitKey], { imgW: fw, imgH: fh });
      return valueFromBlob(await canvasBlob(fc), 'image', { demo: true, baseQuad: figQuad.map(p => [...p]), baseKind: 'figure', label: 'Ảnh DEMO mô phỏng — người mẫu VẼ bằng canvas (khung nửa người theo chuẩn thương mại điện tử) mặc áo thun TRƠN đúng màu/phom đã chọn; chưa có ảnh người mẫu cho thông số này (chưa có ảnh AI tạo đã duyệt, chưa có ảnh chụp thật đã kiểm chứng đạt chuẩn của chủ shop); hình in gốc được ghép hậu kỳ, đây không phải ảnh sản phẩm thật' });
    }
    const g = x.createLinearGradient(0, 0, 0, rh); g.addColorStop(0, '#f3ead9'); g.addColorStop(1, '#d9c6a5'); x.fillStyle = g; x.fillRect(0, 0, rw, rh);
    if (image?.blob) { const img = await blobToImg(image.blob); const s = Math.max(rw / img.width, rh / img.height); x.drawImage(img, (rw - img.width * s) / 2, (rh - img.height * s) / 2, img.width * s, img.height * s); x.fillStyle = 'rgba(243,234,217,0.18)'; x.fillRect(0, 0, rw, rh); }
    drawDemoBanner(x, rw, 'ẢNH DEMO — chưa kết nối AI', rh);
    x.fillStyle = 'rgba(32,32,32,0.82)'; x.fillRect(0, rh - 120, rw, 120); x.fillStyle = '#fff'; x.font = '22px Arial'; x.textAlign = 'left';
    wrapText(x, (prompt?.text || 'Không có prompt') + '', 24, rh - 82, rw - 48, 28);
    x.strokeStyle = '#b6492f'; x.lineWidth = 10; x.strokeRect(5, 5, rw - 10, rh - 10);
    return valueFromBlob(await canvasBlob(c), 'image', { demo: true, label: 'Ảnh DEMO mô phỏng — không phải ảnh sản phẩm thật, chưa kết nối AI' });
  },
  async demoVariation({ image, variant }) {
    const img = await blobToImg(image.blob); const c = makeCanvas(img.width, img.height), x = c.getContext('2d');
    if (variant === 'can-canh') { const w = img.width / 2, h = img.height / 2; x.drawImage(img, img.width / 4, img.height / 4, w, h, 0, 0, img.width, img.height); }
    else if (variant === 'goc-khac') { const s = 1.3; x.drawImage(img, (img.width - img.width * s) / 2, (img.height - img.height * s) / 2, img.width * s, img.height * s); }
    else { x.drawImage(img, 0, 0); x.fillStyle = 'rgba(182,73,47,0.16)'; x.fillRect(0, 0, img.width, img.height); x.filter = 'saturate(1.25)'; x.drawImage(img, 0, 0); x.filter = 'none'; }
    drawDemoBanner(x, img.width, 'BIẾN THỂ DEMO — chưa kết nối AI', img.height);
    return valueFromBlob(await canvasBlob(c), 'image', { demo: true, label: 'Biến thể DEMO (biến đổi canvas thật từ ảnh gốc) — không phải AI tạo' });
  },
  async demoVideo({ image, motion, duration, ratio }, onProgress) {
    if (!('MediaRecorder' in window) || !HTMLCanvasElement.prototype.captureStream) throw new Error('Trình duyệt này không hỗ trợ MediaRecorder — không tạo được video demo (không giả lập MP4).');
    const [w, h] = ratio === '16:9' ? [960, 540] : ratio === '1:1' ? [720, 720] : [540, 960];
    const img = await blobToImg(image.blob); const c = makeCanvas(w, h), x = c.getContext('2d');
    const stream = c.captureStream(30); const rec = new MediaRecorder(stream, { mimeType: MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9' : 'video/webm' });
    const chunks = []; rec.ondataavailable = e => e.data.size && chunks.push(e.data);
    const done = new Promise(r => rec.onstop = r);
    rec.start(200); const t0 = performance.now(); const total = Math.min(6, Math.max(1, duration || 3)) * 1000;
    await new Promise(res => { const tick = () => { const t = (performance.now() - t0) / total; if (t >= 1) return res(); const s = Math.max(w / img.width, h / img.height) * (1 + 0.12 * t); x.fillStyle = '#efe7d7'; x.fillRect(0, 0, w, h); x.drawImage(img, (w - img.width * s) / 2, (h - img.height * s) / 2, img.width * s, img.height * s); drawDemoBanner(x, w, 'VIDEO DEMO (WebM)', h); onProgress?.(Math.round(t * 100)); requestAnimationFrame(tick); }; tick(); });
    rec.stop(); await done;
    const blob = new Blob(chunks, { type: 'video/webm' });
    return valueFromBlob(blob, 'video', { demo: true, name: 'video-demo.webm', label: 'Video DEMO định dạng WebM (ghi từ canvas) — không phải MP4, chưa kết nối AI video' });
  },
};
// ---------- P2: node output cache (persisted in IndexedDB 'cache' store) ----------
// Cached values go through the exact same value shape as live outputs: the
// blob (or prompt text / SVG text) is stored, and a fresh object URL is made
// when the value is served back. API keys are never part of a cache record.
async function cachePutRecord(key, node, value) {
  if (!value || (value.kind !== 'prompt' && !(value.blob instanceof Blob))) return;
  await store.putCache({ key, projectId, nodeId: node.id, nodeType: node.type, createdAt: Date.now(), kind: value.kind, label: value.label || '', demo: !!value.demo, name: value.name || '', mime: value.mime || '', svgText: value.svgText || '', text: value.text || '', garment: value.garment || null, baseQuad: value.baseQuad || null, photoBase: value.photoBase || '', baseKind: value.baseKind || '', realAi: !!value.realAi, blob: value.blob instanceof Blob ? value.blob : null });
}
async function cacheGetRecord(key) {
  const r = await store.getCache(key); if (!r) return null;
  if (r.kind === 'prompt') return { kind: 'prompt', text: r.text, garment: r.garment || null };
  if (r.blob) return valueFromBlob(r.blob, r.kind, { name: r.name, demo: r.demo, label: r.label, svgText: r.svgText, baseQuad: r.baseQuad || null, photoBase: r.photoBase || '', baseKind: r.baseKind || '', garment: r.garment || null, realAi: !!r.realAi });
  return null;
}
/** Latest cached output per node id for this project (used to seed a resumed run). */
async function latestCacheByNode() {
  const byNode = new Map();
  for (const r of (await store.listCache()).filter(c => c.projectId === projectId)) {
    const cur = byNode.get(r.nodeId);
    if (!cur || (r.createdAt || 0) > (cur.createdAt || 0)) byNode.set(r.nodeId, r);
  }
  const seeds = new Map(), seedKeys = new Map();
  for (const [nodeId, r] of byNode) { const v = await cacheGetRecord(r.key); if (v) { seeds.set(nodeId, v); seedKeys.set(nodeId, r.key); } }
  return { seeds, seedKeys };
}

function currentProvider() {
  if (providerKind === 'http') return new HttpAdapter({ name: $('#ais-provider-name')?.value || 'HTTP Provider', endpoint: $('#ais-provider-endpoint')?.value.trim() || '' });
  const mode = generationMode().mode;
  if (mode === 'classic') return new PollinationsClassicAdapter();
  if (mode === 'keyed') return new PollinationsKeyedAdapter({ model: aiState.keyedModel });
  return new DemoAdapter(demoImpl);
}
/** Current generation mode from the P4 gating rules (pure logic in providers.js). */
function generationMode() {
  return resolveGenerationMode({ realEnabled: aiState.realEnabled, providerId: providerKind, hasKey: hasSessionKey(), keyedConfirmed: aiState.keyedConfirmed });
}
function selectedModel() {
  const p = providerById(providerKind);
  return modelOf(p, providerKind === 'pollinations' ? aiState.keyedModel : 'sana');
}
function modeBadgeText() {
  const m = generationMode().mode;
  if (m === 'classic') return 'AI THẬT — Classic (miễn phí)';
  if (m === 'keyed') return 'AI THẬT — Pollinations (key)';
  if (m === 'blocked') return 'AI THẬT — đang bị khóa';
  if (m === 'http') return 'AI: HTTP stub (chưa cấu hình)';
  return 'AI: DEMO';
}
function updateModeBadge() { const b = $('#ais-mode-badge'); if (b) { b.textContent = modeBadgeText(); b.classList.toggle('real', aiState.realEnabled); b.title = aiState.realEnabled ? 'Chế độ AI thật đang bật (phiên này)' : 'Chưa kết nối provider AI thật — đang chạy DEMO'; } }
/** Record one ACTUAL real-provider call of the current run (history + audit). */
function noteRealCall(res) { if (res && (res.providerId === 'pollinations-classic' || res.providerId === 'pollinations')) runRealCalls.push({ provider: res.providerId, model: res.modelId, costPollen: res.costPollen || 0 }); }
const VARIED_PROMPTS = {
  'boi-canh': 'Ảnh quảng cáo sản phẩm áo thun in theo yêu cầu, bối cảnh mới sáng sủa, ánh sáng studio mềm, chụp chính diện',
  'goc-khac': 'Ảnh quảng cáo sản phẩm áo thun in theo yêu cầu, góc chụp nghiêng khác, ánh sáng studio mềm',
  'can-canh': 'Ảnh cận cảnh hình in trên ngực áo thun, thấy rõ chi tiết vải và hình in, ánh sáng mềm',
};

// ---------- P3: perspective warp + wrinkle shading (uses warp.js geometry) ----------
/** Draw one affine-mapped triangle of `img` (src px coords) onto ctx (dst px). */
function drawTri(ctx, img, s0, s1, s2, d0, d1, d2) {
  const det = (s1[0] - s0[0]) * (s2[1] - s0[1]) - (s2[0] - s0[0]) * (s1[1] - s0[1]);
  if (!det) return;
  const a = ((d1[0] - d0[0]) * (s2[1] - s0[1]) - (d2[0] - d0[0]) * (s1[1] - s0[1])) / det;
  const b = ((d1[1] - d0[1]) * (s2[1] - s0[1]) - (d2[1] - d0[1]) * (s1[1] - s0[1])) / det;
  const c2 = ((d2[0] - d0[0]) * (s1[0] - s0[0]) - (d1[0] - d0[0]) * (s2[0] - s0[0])) / det;
  const d2v = ((d2[1] - d0[1]) * (s1[0] - s0[0]) - (d1[1] - d0[1]) * (s2[0] - s0[0])) / det;
  const e = d0[0] - a * s0[0] - c2 * s0[1], f = d0[1] - b * s0[0] - d2v * s0[1];
  ctx.save();
  ctx.beginPath(); ctx.moveTo(d0[0], d0[1]); ctx.lineTo(d1[0], d1[1]); ctx.lineTo(d2[0], d2[1]); ctx.closePath(); ctx.clip();
  ctx.transform(a, b, c2, d2v, e, f);
  ctx.drawImage(img, 0, 0);
  ctx.restore();
}
/** Sample the garment's luminance inside the quad (quad-UV space grid). */
function garmentLuminanceGrid(garmentCtx, W, H, quadPx, n = 20) {
  const data = garmentCtx.getImageData(0, 0, W, H).data;
  const Hm = solveHomography(UNIT_SQUARE, quadPx);
  const grid = [];
  for (let j = 0; j <= n; j++) {
    const row = [];
    for (let i = 0; i <= n; i++) {
      const [px, py] = applyHomography(Hm, i / n, j / n);
      const xi = Math.min(W - 1, Math.max(0, Math.round(px))), yi = Math.min(H - 1, Math.max(0, Math.round(py)));
      const o = (yi * W + xi) * 4;
      row.push((0.2126 * data[o] + 0.7152 * data[o + 1] + 0.0722 * data[o + 2]) / 255);
    }
    grid.push(row);
  }
  return grid;
}
/**
 * Render the design warped onto the garment quad on its own transparent
 * layer: homography mesh (20×20) + wrinkle displacement from garment
 * luminance + garment shading multiplied into the design pixels.
 * Returns the layer canvas (same size as the garment canvas).
 */
function renderWarpedLayer(garmentCanvas, designImg, quadRel, { wrinkle = 0, shading = 0 } = {}) {
  const W = garmentCanvas.width, H = garmentCanvas.height;
  const quadPx = quadRel.map(([qx, qy]) => [qx * W, qy * H]);
  const gtx = garmentCanvas.getContext('2d');
  const grid = garmentLuminanceGrid(gtx, W, H, quadPx, 20);
  const mean = fieldMean(grid);
  const dispFn = wrinkle > 0 ? (u, v) => displacementAt(grid, mean, u, v, wrinkle) : null;
  const verts = buildWarpGrid(quadPx, 20, 20, dispFn);
  const layer = makeCanvas(W, H), lx = layer.getContext('2d');
  const sw = designImg.width, sh = designImg.height;
  for (let j = 0; j < 20; j++) for (let i = 0; i < 20; i++) {
    const v00 = verts[j][i], v10 = verts[j][i + 1], v01 = verts[j + 1][i], v11 = verts[j + 1][i + 1];
    drawTri(lx, designImg, [v00.u * sw, v00.v * sh], [v10.u * sw, v10.v * sh], [v01.u * sw, v01.v * sh], v00.dst, v10.dst, v01.dst);
    drawTri(lx, designImg, [v10.u * sw, v10.v * sh], [v11.u * sw, v11.v * sh], [v01.u * sw, v01.v * sh], v10.dst, v11.dst, v01.dst);
  }
  if (shading > 0) {
    // P4.2 blending (was P3 shading, strengthened): modulate the design by
    // the garment's RELATIVE luminance under the print — the factor is
    // local-luminance / quad-mean, so folds darken/lighten the print while
    // the garment's absolute brightness cancels out. That is why this is
    // safe on DARK garments too: a multiply-by-absolute-luminance pass
    // would blacken the design on a black tee; the relative factor stays
    // ≈1 there. Hue is preserved by the multiply; a gentle 6% pull of each
    // channel toward the pixel's own luminance softens the print's
    // contrast so it reads as ink in fabric, not a pasted sticker.
    const sAmt = Math.min(100, shading) / 100;
    const xs = quadPx.map(p => p[0]), ys = quadPx.map(p => p[1]);
    const bx = Math.max(0, Math.floor(Math.min(...xs))), by = Math.max(0, Math.floor(Math.min(...ys)));
    const bw = Math.min(W, Math.ceil(Math.max(...xs))) - bx, bh = Math.min(H, Math.ceil(Math.max(...ys))) - by;
    if (bw > 0 && bh > 0) {
      const imgData = lx.getImageData(bx, by, bw, bh), px = imgData.data;
      const gData = gtx.getImageData(bx, by, bw, bh).data;
      for (let o = 0; o < px.length; o += 4) {
        if (px[o + 3] === 0) continue;
        const lum = (0.2126 * gData[o] + 0.7152 * gData[o + 1] + 0.0722 * gData[o + 2]) / 255;
        const f = Math.min(1.2, Math.max(0.35, lum / (mean || 0.5)));
        const m = 1 + (f - 1) * sAmt;
        let r = px[o] * m, g = px[o + 1] * m, bch = px[o + 2] * m;
        const dl = 0.2126 * r + 0.7152 * g + 0.0722 * bch;
        px[o] = r * 0.94 + dl * 0.06; px[o + 1] = g * 0.94 + dl * 0.06; px[o + 2] = bch * 0.94 + dl * 0.06;
      }
      lx.putImageData(imgData, bx, by);
    }
  }
  return { layer, quadPx };
}
/** Stroke the dashed safe-print-area quad. EDITOR ONLY (P4.2): this guide
 * may be drawn solely on the composition node's alignment-editor canvas
 * (drawQuadPreview) while the user adjusts the quad. It must NEVER be
 * drawn into a node output image — previews and exports stay guide-free. */
function strokeQuad(x, quadPx) {
  x.save(); x.strokeStyle = 'rgba(182,73,47,0.9)'; x.setLineDash([8, 6]); x.lineWidth = 2;
  x.beginPath(); quadPx.forEach(([px, py], i) => i ? x.lineTo(px, py) : x.moveTo(px, py)); x.closePath(); x.stroke(); x.restore();
}
/** Detect whether an image has any (semi-)transparent pixels. */
function imageHasAlpha(img) {
  const c = makeCanvas(img.width, img.height), x = c.getContext('2d');
  x.drawImage(img, 0, 0);
  const data = x.getImageData(0, 0, c.width, c.height).data;
  const step = Math.max(1, Math.floor((c.width * c.height) / 20000)) * 4;
  for (let o = 3; o < data.length; o += step) if (data[o] < 250) return true;
  return false;
}
/** Migrate a loaded graph's node configs to P3 shapes (P1/P2 saves keep working). */
function migrateGraph(g) {
  for (const n of g?.nodes || []) {
    if (n.type === 'composition') n.config = migrateCompositionConfig(n.config);
    if (n.type === 'exportNode') { n.config.channels ??= []; n.config.jpgQuality ??= 92; n.config.namePattern ??= ''; }
  }
  return g;
}
/**
 * P4.2 ROUND 4 (R4) — adopt a graph loaded from storage (project open,
 * version restore, draft recovery): run the config migration, then the
 * Template 1 version refresh. If the project was created under an older
 * Template 1 version, its template-owned defaults are refreshed AND
 * this project's persisted node cache is purged (on top of the global
 * build-marker in every cache key), with a user-visible note — an old
 * draft can never silently resurrect pre-P4.2 behaviour.
 */
async function adoptLoadedGraph(g) {
  migrateGraph(g);
  const oldV = g.meta?.tplVersion || 0;
  const r = refreshTpl1Graph(g);
  if (!r.refreshed) return g;
  for (const c of (await store.listCache()).filter(c => c.projectId === projectId)) await store.deleteCache(c.key);
  logLine(`Đã cập nhật dự án Mẫu 1 từ phiên bản mẫu cũ (v${oldV}) lên v${r.graph.meta.tplVersion}: ${r.notes.join('; ')}. Đã xóa toàn bộ kết quả đệm cũ của dự án để không dùng lại kết quả của bản cũ.`);
  message('Đã cập nhật dự án Mẫu 1 lên phiên bản mẫu mới nhất và xóa kết quả đệm cũ.');
  return r.graph;
}

// ---------- node handlers ----------
const handlers = {
  async imageInput(node) {
    if (node.config.assetId) { const a = await store.getAsset(node.config.assetId); if (!a) throw new Error('Không tìm thấy ảnh đã lưu trong IndexedDB.'); return valueFromBlob(a.blob, 'image', { name: a.name }); }
    const blob = await fetchBlob(node.config.fixture); return valueFromBlob(blob, 'image', { name: 'anh-ao-that', label: 'Ảnh sản phẩm thực (file có sẵn của shop)' });
  },
  async designInput(node) {
    if (node.config.svgText) { const chk = checkSvgSafety(node.config.svgText); if (!chk.ok) throw new Error(chk.reason); return { kind: 'design', svgText: node.config.svgText, blob: new Blob([node.config.svgText], { type: 'image/svg+xml' }), url: URL.createObjectURL(new Blob([node.config.svgText], { type: 'image/svg+xml' })), name: node.config.assetName || 'hinh-in.svg', label: 'Hình in vector thật (SVG)' }; }
    if (node.config.assetId) { const a = await store.getAsset(node.config.assetId); if (!a) throw new Error('Không tìm thấy file hình in trong IndexedDB.'); return valueFromBlob(a.blob, 'design', { name: a.name, label: 'Hình in gốc (giữ nguyên, không sửa)' }); }
    throw new Error('Chưa có hình in. Tải PNG trong suốt / SVG an toàn, hoặc dùng hình in mẫu.');
  },
  async promptInput(node) { if (!node.config.text.trim()) throw new Error('Prompt đang trống.'); return { kind: 'prompt', text: node.config.text.trim() }; },
  // P4.1: the prompt value carries the structured garment params alongside
  // the EN text, so aiImageGen (and the DEMO figure) get machine-readable
  // style/colour/view — not just prose. Legacy string prompts still work:
  // consumers read .text and treat a missing .garment as "no params".
  async promptAssistant(node, { inputs }) { const text = buildPrompt(node.config, inputs.in?.text || ''); node.config.composed = text; return { kind: 'prompt', text, garment: garmentParams(node.config) }; },
  async composition(node, { inputs, log, engine }) {
    const design = inputs.design; if (!design) throw new Error('Thiếu hình in.');
    const cfg = migrateCompositionConfig(node.config); node.config = cfg;
    // P4.1 garment source: 'ai' = the wired garment photo (AI plain-tee
    // photo in Template 1); 'real' = ignore that input and composite onto
    // the real fixture photo `realBase` with its calibrated preset quad —
    // the owner's fallback when the AI garment is wrong.
    const useReal = cfg.garmentSource === 'real';
    let garmentBlob, quadOverride = null;
    if (useReal) {
      const rb = cfg.realBase || cfg.base;
      garmentBlob = await fetchBlob(rb);
      quadOverride = presetQuadFor(rb);
      log(`Nguồn ảnh áo: ẢNH MẪU THẬT (${rb.split('/').pop()}) — bỏ qua ảnh AI, ghép file hình in GỐC lên ảnh áo thật bằng quad đã hiệu chuẩn của ảnh mẫu.`);
    } else {
      garmentBlob = inputs.garment?.blob;
      if (!garmentBlob) {
        const hasGarmentEdge = !!engine?.graph?.edges?.some(e => e.to === node.id && e.toPort === 'garment');
        if (hasGarmentEdge) throw new Error('Chưa có ảnh áo từ node phía trước (ảnh AI chưa tạo được hoặc chưa chạy). Nếu ảnh AI sai kiểu áo/màu áo → mở node Ghép hình in này, chuyển "Nguồn ảnh áo" sang "Ảnh mẫu thật" để ghép lên ảnh áo thật.');
        garmentBlob = await fetchBlob(cfg.base);
      }
    }
    const srcNote = useReal ? ' · ghép lên ẢNH MẪU THẬT' : '';
    let g = await blobToImg(garmentBlob);
    // P4.2 ROUND 4 (R2) — REAL-AI FRAMING GUARD. The owner's live failure
    // (2026-11-14): a real-AI (Classic sana) garment photo arrived as a
    // close-up whose framing broke compositing, and nothing checked it.
    // Rule: a garment value flagged realAi (produced by a real provider
    // in aiImageGen) is UNVALIDATED until this node checks its framing
    // class (aspect heuristic — framingAspectClass in warp.js; landmark
    // detection client-side is not reliable enough to gate on). If it
    // fails, composition NEVER composites onto it: it falls back to the
    // owner-approved AI model base for the same garment params, records
    // the fallback in this node's log (persisted in the P2 run history)
    // and in the result label. With no approved base for the params it
    // errors honestly instead of producing a wrong composite.
    let framingNote = '';
    if (!useReal && inputs.garment?.realAi) {
      if (passesHalfBodyFraming(g.width, g.height)) {
        log(`Ảnh AI thật đạt kiểm tra khung hình (chân dung nửa người, ${g.width}×${g.height}) — ghép lên chính ảnh AI này.`);
      } else {
        const ab = aiModelBaseFor(inputs.garment.garment);
        if (!ab) throw new Error(`Ảnh AI thật không đạt khung hình (${g.width}×${g.height} — lớp "${framingAspectClass(g.width, g.height)}", cần chân dung nửa người) và chưa có nền người mẫu đã duyệt cho thông số áo này. Hãy chuyển "Nguồn ảnh áo" sang "Ảnh mẫu thật", hoặc đổi tỉ lệ ảnh ở node Tạo ảnh AI rồi chạy lại.`);
        log(`Ảnh AI thật không đạt khung hình (${g.width}×${g.height} — lớp "${framingAspectClass(g.width, g.height)}", cần chân dung nửa người) — đã dùng nền người mẫu đã duyệt thay thế; KHÔNG ghép lên ảnh AI sai khung.`);
        framingNote = ' · Ảnh AI thật không đạt khung hình — đã dùng nền người mẫu đã duyệt';
        garmentBlob = await fetchBlob(ab.base.path);
        g = await blobToImg(garmentBlob);
        quadOverride = ab.quad;
        log(`Nền thay thế: ${ab.base.name} — vùng in theo mốc thân áo đã hiệu chuẩn của nền này; kết quả được đóng dấu DEMO vì lớp người mẫu là nền DEMO đã duyệt, không phải ảnh AI thật vừa tạo.`);
      }
    }
    const scale = Math.min(1, 900 / g.width); const W = Math.round(g.width * scale), H = Math.round(g.height * scale);
    const c = makeCanvas(W, H), x = c.getContext('2d'); x.drawImage(g, 0, 0, W, H);
    const dImg = await blobToImg(design.blob);
    if (cfg.mode === 'simple') {
      // P1 behaviour: rectangle + rotation. P4.2: the dashed safe-area box
      // is NO LONGER drawn into the output image (the owner saw the guide
      // baked into previews/exports) — guides live only in the editor.
      const pw = W * (cfg.printW / 100), px = W * (cfg.printX / 100) - pw / 2, py = H * (cfg.printY / 100) - pw / 2;
      x.save(); x.translate(px + pw / 2, py + pw / 2); x.rotate((cfg.rotation || 0) * Math.PI / 180); const ds = Math.min(pw / dImg.width, pw / dImg.height); x.globalAlpha = Math.min(100, Math.max(50, cfg.inkOpacity ?? 95)) / 100; x.drawImage(dImg, -dImg.width * ds / 2, -dImg.height * ds / 2, dImg.width * ds, dImg.height * ds); x.restore();
      log('Đã ghép file hình in GỐC lên ảnh áo (chế độ đơn giản P1) — nội dung hình in không bị AI vẽ lại.');
      return valueFromBlob(await canvasBlob(c), 'image', { label: cfg.label + srcNote + framingNote, demo: !useReal && (!!inputs.garment?.demo || !!framingNote) });
    }
    // P3 perspective mode: homography warp onto the 4-point quad + wrinkle
    // displacement + garment shading. The design drawn is the ORIGINAL file.
    // P4.2 quad resolution: a generated base that carries its own collar-
    // calibrated quad (photo base / demo figure from aiImageGen) wins over
    // the node's stored quad — the stored quad cannot know which base the
    // generator produced. A quad the user explicitly dragged/typed in the
    // editor (quadSource 'user') wins over the calibrated one.
    let quad;
    if (quadOverride) quad = quadOverride; // 'real' source preset — or the R2 framing-fallback base's calibrated quad
    else if (useReal) quad = cfg.quad;
    else if (cfg.quadSource === 'user' && Array.isArray(cfg.quad) && cfg.quad.length === 4) quad = cfg.quad;
    else if (Array.isArray(inputs.garment?.baseQuad) && inputs.garment.baseQuad.length === 4) {
      quad = inputs.garment.baseQuad;
      log(`Dùng quad vùng in đã hiệu chuẩn theo mốc thân áo của ảnh nền (${inputs.garment.baseKind === 'ai-model' ? 'ảnh người mẫu do AI tạo' : inputs.garment.photoBase ? 'ảnh chụp thật' : 'hình DEMO vẽ'}) — hình in nằm giữa ngực trên, cách mép dưới cổ áo 12–15% chiều dài thân áo (luật torso).`);
    }
    else quad = (Array.isArray(cfg.quad) && cfg.quad.length === 4) ? cfg.quad : (presetQuadFor(cfg.base) || rectToQuad(cfg.printX, cfg.printY, cfg.printW));
    const { layer } = renderWarpedLayer(c, dImg, quad, { wrinkle: cfg.wrinkle || 0, shading: cfg.shading || 0 });
    // P4.2 blending: draw the print layer at ink opacity (<100%) so the
    // fabric texture and folds under the print stay faintly visible — the
    // print sits IN the fabric instead of looking like a flat sticker.
    // P4.2 guide rule: NO dashed guide is drawn here — the output image
    // (preview + every export) is guide-free; the dashed quad exists only
    // as an overlay in this node's alignment editor (drawQuadPreview).
    x.save(); x.globalAlpha = Math.min(100, Math.max(50, cfg.inkOpacity ?? 95)) / 100; x.drawImage(layer, 0, 0); x.restore();
    log(`Đã ghép file hình in GỐC theo phối cảnh 4 điểm (cong nếp vải ${cfg.wrinkle || 0}%, bóng vải ${cfg.shading || 0}%, độ phủ mực ${cfg.inkOpacity ?? 95}%) — mô phỏng bằng hình học, không phải ảnh sản phẩm thật.`);
    // P4.2 supplementary (FIX D): propagate the DEMO flag from the garment
    // input so the export node can re-stamp the DEMO frame AFTER the
    // channel crop/resize (uniform banner in every exported file).
    return valueFromBlob(await canvasBlob(c), 'image', { label: cfg.label + ' · phối cảnh 4 điểm + cong theo nếp vải (mô phỏng)' + srcNote + framingNote, demo: !useReal && (!!inputs.garment?.demo || !!framingNote) });
  },
  async background(node, { inputs, log }) {
    const v = inputs.in; if (!v?.blob) throw new Error('Thiếu ảnh đầu vào.');
    const cfg = node.config;
    const img = await blobToImg(v.blob);
    const W = img.width, H = img.height;
    const c = makeCanvas(W, H), x = c.getContext('2d');
    // --- background layer (all procedural/on-device — no external images) ---
    if (cfg.mode === 'gradient') {
      const [x1, y1] = cfg.dir === 'diag' ? [W, H] : cfg.dir === 'right' ? [W, 0] : [0, H];
      const gr = x.createLinearGradient(0, 0, x1, y1); gr.addColorStop(0, cfg.color); gr.addColorStop(1, cfg.color2);
      x.fillStyle = gr; x.fillRect(0, 0, W, H);
    } else if (cfg.mode === 'scene') {
      const horizonY = H * (cfg.horizon ?? 62) / 100;
      const wall = x.createLinearGradient(0, 0, 0, horizonY); wall.addColorStop(0, cfg.color); wall.addColorStop(1, cfg.color2);
      x.fillStyle = wall; x.fillRect(0, 0, W, horizonY + 1);
      x.fillStyle = cfg.color2; x.fillRect(0, horizonY, W, H - horizonY);
      const floor = x.createLinearGradient(0, horizonY, 0, H); floor.addColorStop(0, 'rgba(0,0,0,0)'); floor.addColorStop(1, 'rgba(0,0,0,0.28)');
      x.fillStyle = floor; x.fillRect(0, horizonY, W, H - horizonY);
      x.fillStyle = 'rgba(255,255,255,0.25)'; x.fillRect(0, horizonY - 1, W, 2);
    } else if (cfg.mode === 'image') {
      const a = cfg.assetId ? await store.getAsset(cfg.assetId) : null;
      if (!a) throw new Error('Chế độ ảnh nền riêng cần tải 1 ảnh nền lên trước (mục Thuộc tính của node).');
      const bg = await blobToImg(a.blob);
      const f = fitInto(bg.width, bg.height, W, H, cfg.bgFit || 'cover');
      if ((cfg.bgBlur || 0) > 0) x.filter = `blur(${cfg.bgBlur}px)`;
      x.drawImage(bg, f.sx, f.sy, f.sw, f.sh, f.dx - (cfg.bgBlur || 0), f.dy - (cfg.bgBlur || 0), f.dw + (cfg.bgBlur || 0) * 2, f.dh + (cfg.bgBlur || 0) * 2);
      x.filter = 'none';
    } else { x.fillStyle = cfg.color; x.fillRect(0, 0, W, H); }
    // --- subject placement ---
    const hasAlpha = imageHasAlpha(img);
    const boxW = W * (cfg.scale ?? 82) / 100, boxH = H * (cfg.scale ?? 82) / 100;
    const s = Math.min(boxW / img.width, boxH / img.height);
    const dw = img.width * s, dh = img.height * s;
    const dx = W * (cfg.posX ?? 50) / 100 - dw / 2, dy = H * (cfg.posY ?? 50) / 100 - dh / 2;
    if (hasAlpha) {
      if ((cfg.shadow ?? 0) > 0) {
        x.save(); x.fillStyle = `rgba(30,25,20,${0.45 * (cfg.shadow / 100)})`;
        x.beginPath(); x.ellipse(dx + dw / 2, dy + dh * 0.98, dw * 0.42, Math.max(6, dw * 0.055), 0, 0, Math.PI * 2); x.fill(); x.restore();
      }
      x.drawImage(img, dx, dy, dw, dh);
    } else {
      // No transparency: honest framed-card placement — never a fake cutout.
      const pad = Math.max(8, W * (cfg.framePad ?? 7) / 100 * 0.35);
      x.save(); x.shadowColor = 'rgba(30,25,20,0.4)'; x.shadowBlur = Math.max(12, W * 0.03); x.shadowOffsetY = Math.max(6, H * 0.012);
      x.fillStyle = '#ffffff'; x.fillRect(dx - pad, dy - pad, dw + pad * 2, dh + pad * 2); x.restore();
      x.drawImage(img, dx, dy, dw, dh);
    }
    if ((cfg.vignette ?? 0) > 0) {
      const rg = x.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
      rg.addColorStop(0, 'rgba(0,0,0,0)'); rg.addColorStop(1, `rgba(0,0,0,${0.5 * (cfg.vignette / 100)})`);
      x.fillStyle = rg; x.fillRect(0, 0, W, H);
    }
    const label = hasAlpha
      ? 'Ảnh có nền trong suốt — đã đặt trực tiếp lên nền/bối cảnh, file gốc giữ nguyên'
      : 'Ảnh gốc KHÔNG có nền trong suốt — đặt dạng KHUNG ẢNH trên nền (không tách nền giả)';
    log(label + '.');
    return valueFromBlob(await canvasBlob(c), 'image', { label });
  },
  async imageEditor(node, { inputs }) {
    const img = await blobToImg(inputs.in.blob); const crop = Math.min(40, Math.max(0, node.config.crop || 0)) / 100;
    const sw = img.width * (1 - crop * 2), sh = img.height * (1 - crop * 2);
    const rot = (node.config.rotate || 0) % 360; const swap = Math.abs(rot) === 90 || Math.abs(rot) === 270;
    const tw = node.config.resizeW > 0 ? node.config.resizeW : sw; const th = tw * (sh / sw);
    const c = makeCanvas(swap ? th : tw, swap ? tw : th), x = c.getContext('2d');
    x.filter = `brightness(${node.config.brightness}%) contrast(${node.config.contrast}%)`;
    x.translate(c.width / 2, c.height / 2); x.rotate(rot * Math.PI / 180); x.drawImage(img, img.width * crop, img.height * crop, sw, sh, -tw / 2, -th / 2, tw, th);
    return valueFromBlob(await canvasBlob(c), 'image', { label: 'Ảnh đã chỉnh sửa bằng Canvas API' });
  },
  async aiImageGen(node, { inputs, log }) {
    const p = currentProvider();
    // P4.1: this node generates the PLAIN garment photo ONLY (garment params
    // travel with the prompt value). The customer's design is composited
    // afterwards by the composition node from the original file — the AI
    // never draws the print.
    if (inputs.prompt?.garment) { const g = inputs.prompt.garment; log(`Thông số áo: ${g.styleEn} · màu ${g.colorEn} · ${g.viewEn} — AI tạo ảnh áo TRƠN; hình in sẽ được ghép hậu kỳ bằng file gốc.`); }
    if (p.isDemo || p.kind === 'http') return p.generateImage({ prompt: { text: inputs.prompt?.text || '', ratio: node.config.ratio, garment: inputs.prompt?.garment || null }, image: inputs.image });
    // ---- P4 real generation (classic free / keyed Pollen) ----
    const gm = generationMode();
    if (gm.mode === 'blocked') throw new Error(gm.reason);
    const model = selectedModel();
    if (!isRunnableModel(model)) throw new Error(`Model "${model?.name || '?'}" tính giá theo token — P4 không cho chạy (không đoán giá). Hãy chọn model có giá cố định trong bảng Nhà cung cấp AI.`);
    const promptText = (inputs.prompt?.text || '').trim();
    if (!promptText) throw new Error('Node Tạo ảnh AI thật cần prompt: hãy nối node Prompt hoặc Trợ lý prompt vào cổng Prompt.');
    if ((node.config.count || 1) > 1) log('P4 giới hạn 1 ảnh cho mỗi lần gọi AI thật (kiểm soát chi phí) — cấu hình số lượng ' + node.config.count + ' được đưa về 1.');
    if (inputs.image?.blob) {
      if (model.supportsImg2Img) throw new Error('Model này hỗ trợ img2img NHƯNG ảnh tham chiếu đang lưu trên máy của bạn (IndexedDB), chưa có URL công khai — P4 không tự tải ảnh của bạn lên bất kỳ dịch vụ nào. Hãy bỏ dây ảnh tham chiếu, hoặc chọn model chỉ tạo từ chữ (flux / zimage).');
      log(`Model ${model.name} không hỗ trợ ảnh tham chiếu — tạo ảnh chỉ từ prompt; ảnh tham chiếu KHÔNG bị gửi đi đâu.`);
    }
    const { w, h } = sizeForRatio(node.config.ratio || '4:5', p.kind);
    log(`Đang gọi AI THẬT: ${p.name} · model ${model.name} · ${w}×${h} · chi phí ${model.pricePerImage === 0 ? '0 (miễn phí)' : '~' + model.pricePerImage + ' Pollen'}…`);
    const res = await p.generateImage({ prompt: promptText, width: w, height: h, seed: -1 });
    noteRealCall(res);
    // P4.2 ROUND 4 (R2): real-AI outputs are flagged realAi + carry the
    // garment params, so the composition node can run its framing guard
    // before compositing (an unvalidated real-AI garment photo is never
    // composited onto blindly — see the guard in the composition handler).
    return valueFromBlob(res.blob, 'image', { name: 'anh-ai-that', label: res.label, realAi: true, garment: inputs.prompt?.garment || null });
  },
  async aiVariation(node, { inputs, log }) {
    const p = currentProvider();
    if (!inputs.in) throw new Error('Thiếu ảnh đầu vào.');
    if (p.isDemo || p.kind === 'http') return p.variation({ image: inputs.in, variant: node.config.variant });
    // ---- P4 real variation ----
    const gm = generationMode();
    if (gm.mode === 'blocked') throw new Error(gm.reason);
    const model = selectedModel();
    if (!isRunnableModel(model)) throw new Error(`Model "${model?.name || '?'}" tính giá theo token — P4 không cho chạy (không đoán giá).`);
    if (model.supportsImg2Img) throw new Error('Biến thể img2img cần ảnh tham chiếu có URL công khai — ảnh của bạn đang lưu trên máy (IndexedDB) và P4 không tự tải ảnh của bạn lên dịch vụ ngoài. Hãy chọn model chỉ tạo từ chữ (flux / zimage) để tạo biến thể mới từ prompt, hoặc dùng biến thể DEMO.');
    // Text-only path (classic sana + keyed flux/zimage): a FRESH generation
    // from a variant prompt — honestly labelled, never claimed as img2img.
    const promptText = VARIED_PROMPTS[node.config.variant] || VARIED_PROMPTS['boi-canh'];
    const src = await blobToImg(inputs.in.blob);
    const ratio = src.width >= src.height ? (src.width / src.height >= 1.6 ? '16:9' : '1:1') : (src.height / src.width >= 1.6 ? '9:16' : '4:5');
    const { w, h } = sizeForRatio(ratio, p.kind);
    log(`Biến thể AI THẬT dạng tạo mới từ prompt (model ${model.name} không nhận ảnh tham chiếu trong P4) — đây KHÔNG phải img2img.`);
    const res = await p.generateImage({ prompt: promptText, width: w, height: h, seed: -1 });
    noteRealCall(res);
    return valueFromBlob(res.blob, 'image', { name: 'bien-the-ai-that', label: res.label + ' · Biến thể tạo MỚI từ prompt biến thể — không phải img2img, không giữ nguyên sản phẩm gốc' });
  },
  async aiVideoGen(node, { inputs, log }) { if (!inputs.in) throw new Error('Thiếu ảnh đầu vào.'); const demo = new DemoAdapter(demoImpl); return demo.imageToVideo({ image: inputs.in, motion: node.config.motion, duration: node.config.duration, ratio: node.config.ratio }, pct => log('Đang ghi video demo: ' + pct + '%')); },
  async preview(node, { inputs }) { const v = inputs.in; if (!v) throw new Error('Chưa có dữ liệu để xem trước.'); runtime.previewValue = v; return v; },
  async exportNode(node, { inputs, log }) {
    const v = inputs.in; if (!v) throw new Error('Chưa có dữ liệu để xuất.');
    const chans = (node.config.channels || []).map(channelPreset).filter(Boolean);
    if (!chans.length || !v.blob || v.kind === 'video' || v.kind === 'prompt') return v; // P1 behaviour
    // P3: render every selected channel size from the input image.
    const img = await blobToImg(v.blob);
    const format = node.config.format === 'jpg' ? 'jpg' : 'png';
    const files = [];
    let backdrop = null; // sampled lazily, only for the extreme-aspect fallback
    for (const p of chans) {
      // P4.2 round-4 correction: a 'cover' preset whose crop would keep
      // less than COVER_MIN_RETAINED of the source (the 1040×2352 AI
      // oversize base into website 1200×1500 kept ~55% — head AND hem
      // cut) falls back to 'contain', padded with the source's OWN
      // backdrop colour so the whole garment stays in frame. Preset
      // 'contain' channels keep their established white pad.
      const mode = channelFitMode(img.width, img.height, p);
      const padded = mode === 'contain' && p.fit === 'cover';
      const f = fitInto(img.width, img.height, p.w, p.h, mode);
      const c = makeCanvas(p.w, p.h), x = c.getContext('2d');
      if (padded && backdrop === null) backdrop = sampleBackdropColor(img);
      x.fillStyle = padded ? backdrop : '#ffffff'; x.fillRect(0, 0, p.w, p.h);
      x.drawImage(img, f.sx, f.sy, f.sw, f.sh, f.dx, f.dy, f.dw, f.dh);
      // P4.2 supplementary (FIX D): DEMO inputs get the DEMO frame stamped
      // on the FINAL channel image (after crop/resize) — identical banner
      // treatment in every case, never cropped away.
      if (v.demo) stampDemoFrame(x, p.w, p.h);
      const blob = await canvasBlob(c, format === 'jpg' ? 'image/jpeg' : 'image/png', (node.config.jpgQuality || 92) / 100);
      files.push(valueFromBlob(blob, 'image', { name: channelFileName(p, format, node.config.namePattern), label: `Kênh ${p.label} (${mode === 'cover' ? 'cắt phủ khung' : padded ? 'vừa khung, đệm màu nền của ảnh — nguồn quá cao, tránh cắt mất đầu/vạt áo' : 'vừa khung, chừa nền trắng'})` }));
    }
    log('Đã tạo ' + files.length + ' kích thước kênh: ' + files.map(f => f.name).join(', '));
    return { ...v, kind: 'image', blob: files[0].blob, url: files[0].url, mime: files[0].mime, files, label: `Đã xuất ${files.length} kích thước cho kênh bán hàng (xem danh sách file ở Thuộc tính node / trong ZIP)` };
  },
  async saveProject(node, { inputs }) { await saveProjectNow(); return inputs.in || { kind: 'any' }; },
};

// ---------- rendering ----------
const world = $('#ais-world'), svg = $('#ais-edges');
function portPos(node, kind, portId) {
  if (kind === 'out') return { x: node.x + 208, y: node.y + 52 };
  const idx = NODE_DEFS[node.type].inputs.findIndex(i => i.id === portId); return { x: node.x, y: node.y + 52 + idx * 24 };
}
function edgePath(a, b) { const dx = Math.max(40, Math.abs(b.x - a.x) / 2); return `M ${a.x} ${a.y} C ${a.x + dx} ${a.y}, ${b.x - dx} ${b.y}, ${b.x} ${b.y}`; }
let tempLine = null;
function renderEdges() {
  svg.setAttribute('viewBox', '0 0 4000 3000'); svg.innerHTML = '';
  for (const e of graph.edges) { const from = findNode(graph, e.from), to = findNode(graph, e.to); if (!from || !to) continue;
    const p = document.createElementNS('http://www.w3.org/2000/svg', 'path'); p.setAttribute('d', edgePath(portPos(from, 'out'), portPos(to, 'in', e.toPort))); p.setAttribute('class', 'ais-edge' + (e.id === selectedEdgeId ? ' sel' : '')); p.dataset.edgeId = e.id; svg.appendChild(p); }
  if (tempLine) { const p = document.createElementNS('http://www.w3.org/2000/svg', 'path'); p.setAttribute('d', edgePath(tempLine.from, tempLine.to)); p.setAttribute('class', 'ais-edge temp'); svg.appendChild(p); }
}
function applyView() { world.style.transform = `translate(${view.x}px,${view.y}px) scale(${view.k})`; $('#ais-zoom-label').textContent = Math.round(view.k * 100) + '%'; }
function renderNodes() {
  world.querySelectorAll('.ais-node').forEach(el => el.remove());
  for (const node of graph.nodes) {
    const def = NODE_DEFS[node.type]; const el = document.createElement('article');
    el.className = 'ais-node st-' + node.status + (node.id === selectedId ? ' sel' : ''); el.dataset.nodeId = node.id;
    el.style.left = node.x + 'px'; el.style.top = node.y + 'px'; el.style.setProperty('--nc', def.color);
    const out = outputs.get(node.id);
    el.innerHTML = `<header><span class="dot"></span><strong>${def.label}</strong></header>
      <div class="ais-node-body">${node.error ? `<span class="nerr">${node.error}</span>` : out?.label ? `<span class="nlab">${out.label}</span>` : `<span class="nlab">${summary(node)}</span>`}
      ${out?.kind === 'image' || out?.kind === 'design' ? `<img class="nthumb" src="${out.url}" alt="Kết quả node">` : ''}${out?.kind === 'video' ? `<video class="nthumb" src="${out.url}" muted playsinline></video>` : ''}${out?.kind === 'prompt' ? `<span class="nprompt">${out.text.slice(0, 90)}…</span>` : ''}</div>
      ${def.inputs.map(i => `<span class="ais-port in" data-port="${i.id}" title="${i.label} (${i.type})" style="top:${44 + def.inputs.indexOf(i) * 24}px"></span><span class="plabel in" style="top:${36 + def.inputs.indexOf(i) * 24}px">${i.label}</span>`).join('')}
      ${def.outputs.map(o => `<span class="ais-port out" data-port="out" title="${o.label} (${o.type})"></span><span class="plabel out">${o.label}</span>`).join('')}`;
    world.appendChild(el);
  }
  renderEdges();
}
function summary(node) { const c = node.config; return node.type === 'imageInput' ? (c.assetName || 'Ảnh áo có sẵn của shop') : node.type === 'designInput' ? (c.assetName || (c.svgText ? 'Hình in SVG' : 'Chưa chọn hình in')) : node.type === 'promptInput' ? String(c.text || '').slice(0, 60) : def0(node.type); }
function def0(t) { const gm = generationMode().mode; const aiTxt = gm === 'classic' ? 'AI THẬT — Pollinations Classic (miễn phí)' : gm === 'keyed' ? 'AI THẬT — Pollinations (key + Pollen)' : gm === 'blocked' ? 'AI thật đang BỊ KHÓA — mở bảng Nhà cung cấp AI' : gm === 'http' ? 'HTTP stub — chưa cấu hình (sẽ báo lỗi)' : 'DEMO — chưa kết nối AI'; return { promptAssistant: 'Trợ lý quy tắc — không phải AI', composition: 'Ghép hình in gốc hậu kỳ', background: 'Thêm nền / bối cảnh cho ảnh sản phẩm', imageEditor: 'Cắt / xoay / sáng / tương phản', aiImageGen: aiTxt, aiVariation: aiTxt, aiVideoGen: 'DEMO — WebM từ canvas', preview: 'Xem ảnh / video kết quả', exportNode: 'Tải PNG/JPG/SVG/ZIP + nhiều kích thước kênh', saveProject: 'Lưu vào IndexedDB' }[t] || ''; }
function aiModeHint() {
  const gm = generationMode();
  if (gm.mode === 'demo') return '<p class="hint warn">DEMO: chưa kết nối AI thật — kết quả là ảnh canvas có đóng dấu DEMO. Muốn tạo ảnh thật: bỏ chọn node để mở bảng "Nhà cung cấp AI", bật Chế độ AI thật và chọn Pollinations.</p>';
  if (gm.mode === 'blocked') return `<p class="hint warn">AI THẬT đang BỊ KHÓA: ${gm.reason}</p>`;
  if (gm.mode === 'http') return '<p class="hint warn">Đang chọn HTTP stub (P1) — node sẽ báo lỗi cấu hình rõ ràng, không tạo ảnh giả.</p>';
  const m = selectedModel();
  return `<p class="hint">AI THẬT đang bật: ${providerById(providerKind).name} · model ${m?.name || ''} · giá ${m?.pricePerImage === 0 ? '0 Pollen (miễn phí)' : '~' + m?.pricePerImage + ' Pollen/ảnh'} · P4 giới hạn 1 ảnh/lần chạy · không tự thử lại khi lỗi. Ảnh AI không phải ảnh sản phẩm thật.</p>`;
}
function renderAll() { renderNodes(); applyView(); renderProperties(); }

// ---------- history / persistence ----------
function snapshot() { return JSON.stringify({ nodes: graph.nodes.map(n => ({ id: n.id, type: n.type, x: n.x, y: n.y, config: n.config })), edges: graph.edges, meta: graph.meta || null }); }
function pushHistory() { history = history.slice(0, historyIdx + 1); history.push(snapshot()); if (history.length > 60) history.shift(); historyIdx = history.length - 1; updateUndoBtns(); }
function restore(s) { const g = JSON.parse(s); graph = { nodes: g.nodes.map(n => ({ ...n, status: 'idle', logs: [], error: '' })), edges: g.edges, meta: g.meta || null }; selectedId = null; selectedEdgeId = null; outputs = new Map(); renderAll(); scheduleSave(); }
function updateUndoBtns() { $('#ais-undo').disabled = historyIdx <= 0; $('#ais-redo').disabled = historyIdx >= history.length - 1; }
let saveTimer = null;
// P2 draft semantics: AUTOSAVE writes only a draft record (store 'drafts').
// The project record itself is written by an EXPLICIT save, which also
// creates a version snapshot and clears the draft. That split is what makes
// crash recovery detectable: a draft newer than the saved project = unsaved work.
function scheduleSave() { $('#ais-save-status').textContent = 'Có thay đổi chưa lưu…'; clearTimeout(saveTimer); saveTimer = setTimeout(() => writeDraft().catch(e => message('Lỗi tự lưu bản nháp: ' + e.message, true)), 800); }
async function writeDraft() {
  const draft = { projectId, name: $('#ais-project-name').value.trim() || 'Dự án chưa đặt tên', graph: JSON.parse(snapshot()), updatedAt: Date.now() };
  await store.saveDraft(draft);
  $('#ais-save-status').textContent = 'Đã tự lưu bản nháp ' + new Date().toLocaleTimeString('vi-VN') + ' (chưa bấm Lưu)';
}
async function createVersion(note) {
  const v = { id: uid('ver'), projectId, name: $('#ais-project-name').value.trim() || 'Dự án chưa đặt tên', graph: JSON.parse(snapshot()), note: note || 'Lưu thủ công', createdAt: Date.now() };
  await store.saveVersion(v);
  const all = await store.listVersions(projectId);
  for (const old of pruneOldest(all, VERSION_CAP, 'createdAt')) await store.deleteVersion(old.id);
  return v;
}
async function saveProjectNow(opts = {}) {
  const data = { id: projectId, name: $('#ais-project-name').value.trim() || 'Dự án chưa đặt tên', graph: JSON.parse(snapshot()), updatedAt: Date.now() };
  await store.saveProject(data);
  if (opts.version) await createVersion(opts.note);
  await store.deleteDraft(projectId).catch(() => {});
  $('#ais-save-status').textContent = 'Đã lưu ' + new Date().toLocaleTimeString('vi-VN');
  await refreshProjectList(); await refreshStorage(); await renderVersions(); await renderStoragePanel();
}
async function refreshProjectList() { const list = (await store.listProjects()).sort((a, b) => b.updatedAt - a.updatedAt); const sel = $('#ais-project-select'); sel.innerHTML = list.map(p => `<option value="${p.id}" ${p.id === projectId ? 'selected' : ''}>${p.name} — ${new Date(p.updatedAt).toLocaleDateString('vi-VN')}</option>`).join('') || '<option value="">(chưa có dự án)</option>'; }
async function refreshStorage() { const e = await storageEstimate(); const assets = await store.listAssets(); const el = $('#ais-storage-info'); if (el) el.textContent = `Dung lượng trình duyệt đã dùng: ${(e.usage / 1048576).toFixed(1)} MB${e.quota ? ' / ' + (e.quota / 1073741824).toFixed(1) + ' GB' : ''} · ${assets.length} file đã lưu trong AI Studio`; }
async function openProject(id) { const p = await store.getProject(id); if (!p) return message('Không tìm thấy dự án.', true); projectId = p.id; $('#ais-project-name').value = p.name; graph = { nodes: p.graph.nodes.map(n => ({ ...n, status: 'idle', logs: [], error: '' })), edges: p.graph.edges, meta: p.graph.meta || null }; graph = await adoptLoadedGraph(graph); outputs = new Map(); lastFailedNodeId = null; updateResumeBtn(); history = []; historyIdx = -1; pushHistory(); selectedId = null; renderAll(); await renderHistory(); await renderVersions(); await renderStoragePanel(); message('Đã mở dự án "' + p.name + '"'); }

// ---------- properties panel ----------
function field(label, inner) { return `<label class="pf"><span>${label}</span>${inner}</label>`; }
function num(id, val, attrs = '') { return `<input type="number" id="${id}" value="${val}" ${attrs}>`; }
function sel(id, opts, val) { return `<select id="${id}">${opts.map(([v, l]) => `<option value="${v}" ${v === val ? 'selected' : ''}>${l}</option>`).join('')}</select>`; }
function renderProperties() {
  const box = $('#ais-properties'); const node = findNode(graph, selectedId);
  box.classList.toggle('open', !!node || propsForcedOpen);
  if (!node) { box.innerHTML = `<h3>Thuộc tính</h3><p class="hint">Chọn một node để xem cấu hình, chạy riêng node đó và xem kết quả. Kéo từ cổng tròn bên phải của node này sang cổng bên trái của node khác để nối dây.</p>${runSettingsHtml()}${providerHtml()}${storageHtml()}`; bindProvider(box); bindRunSettings(box); return; }
  const def = NODE_DEFS[node.type]; const c = node.config; const out = outputs.get(node.id);
  let h = `<div class="ph"><h3 style="--nc:${def.color}">${def.label}</h3><button id="ais-prop-close" aria-label="Đóng">×</button></div>
  <p class="pstatus">Trạng thái: <strong>${node.status === 'cached' ? '<span class="st-cached-t">cached — dùng kết quả bộ nhớ đệm</span>' : node.status}</strong>${node.durationMs != null && node.status !== 'idle' ? ` · chạy trong ${formatDuration(node.durationMs)}` : ''}${node.error ? ` — <span class="err">${node.error}</span>` : ''}</p><div class="prow">
  <button id="ais-p-run">▶ Chạy node này</button><button id="ais-p-runfrom">Chạy từ node này</button><button id="ais-p-dup">Nhân bản</button><button id="ais-p-del">Xóa node</button></div>`;
  if (node.type === 'imageInput') { h += field('Ảnh áo có sẵn (ảnh thật)', sel('pf-fixture', FIXTURES, c.fixture)) + field('Hoặc tải ảnh lên (PNG/JPG/WebP, lưu IndexedDB)', '<input type="file" id="pf-file" accept="image/png,image/jpeg,image/webp" multiple>') + (c.assetName ? `<p class="hint">Đang dùng: ${c.assetName}${c.width ? ` (${c.width}×${c.height})` : ''}</p>` : ''); }
  if (node.type === 'designInput') { h += field('Tải hình in (PNG trong suốt / SVG an toàn)', '<input type="file" id="pf-file" accept="image/png,image/svg+xml">') + '<button id="pf-sample">Dùng hình in mẫu (SVG thật)</button>' + field('Nội dung SVG (nếu có)', `<textarea id="pf-svg" rows="4">${(c.svgText || '').replace(/</g, '&lt;')}</textarea>`) + (c.assetName ? `<p class="hint">Đang dùng: ${c.assetName}</p>` : ''); }
  if (node.type === 'promptInput') { h += field('Nội dung prompt (tiếng Việt)', `<textarea id="pf-text" rows="4">${c.text}</textarea>`) + '<p class="hint">Mẫu prompt:</p>' + PROMPT_TEMPLATES.map((t, i) => `<button class="pf-tpl" data-tpl="${i}">${t}</button>`).join(''); }
  if (node.type === 'promptAssistant') {
    h += field('Kiểu áo', sel('pf-kieuAo', Object.entries(GARMENT_OPTIONS.kieuAo).map(([v, o]) => [v, o.label]), c.kieuAo || 'co-tron'));
    h += field('Màu áo', sel('pf-mauAo', Object.entries(GARMENT_OPTIONS.mauAo).map(([v, o]) => [v, o.label]), c.mauAo || 'trang'));
    h += field('Góc chụp', sel('pf-gocChup', Object.entries(GARMENT_OPTIONS.gocChup).map(([v, o]) => [v, o.label]), c.gocChup || garmentParams(c).view));
    for (const gName of ['style', 'model', 'background', 'lighting']) h += field({ style: 'Phong cách chụp', model: 'Người mẫu', background: 'Bối cảnh', lighting: 'Ánh sáng' }[gName], sel('pf-' + gName, Object.entries(PROMPT_OPTIONS[gName]), c[gName]));
    h += field('Bổ sung', `<input type="text" id="pf-extra" value="${(c.extra || '').replace(/"/g, '&quot;')}">`);
    h += `<div class="pf-summary"><h4>Tóm tắt thông số sẽ gửi</h4><p>${garmentSummaryVi(c)}</p></div>`;
    h += field('Prompt gửi cho AI (EN)', `<textarea id="pf-composed" rows="6" readonly>${(c.composed || buildPrompt(c, '')).replace(/</g, '&lt;')}</textarea>`);
    h += '<p class="hint">Trợ lý này ghép prompt bằng QUY TẮC có sẵn — không phải AI. Prompt tạo ảnh viết bằng tiếng Anh (model theo tiếng Anh tốt hơn) và yêu cầu áo TRƠN tuyệt đối; khi chạy, câu prompt gốc của bạn được chèn thêm vào giữa. Hình in KHÔNG nằm trong prompt này.</p>';
  }
  if (node.type === 'composition') {
    const cm = migrateCompositionConfig(c);
    h += field('Nguồn ảnh áo', sel('pf-garment-source', [['ai', 'Ảnh từ node Tạo ảnh AI (áo trơn do AI tạo)'], ['real', 'Ảnh mẫu thật — bỏ qua ảnh AI']], cm.garmentSource));
    if (cm.garmentSource === 'real') h += field('Ảnh nền dùng để ghép (mẫu thật / người mẫu AI tạo)', sel('pf-real-base', [...PHOTO_BASES, ...AI_MODEL_BASES].map(b => [b.path, b.name]), cm.realBase));
    h += '<p class="hint">Nếu ảnh AI sai kiểu áo/màu áo → chuyển Nguồn ảnh áo sang \'Ảnh mẫu thật\' để ghép lên ảnh áo thật. Ở chế độ Ảnh mẫu thật, vùng in dùng quad đã hiệu chuẩn sẵn của ảnh mẫu đó và node này vẫn chạy được kể cả khi node AI bị lỗi.</p>';
    h += field('Ảnh áo nền (khi không có dây vào)', sel('pf-base', FIXTURES, c.base));
    h += field('Chế độ ghép', sel('pf-comp-mode', [['perspective', 'Phối cảnh 4 điểm (P3)'], ['simple', 'Đơn giản — chữ nhật (P1)']], cm.mode));
    if (cm.mode === 'perspective') {
      h += `<div class="pf-quad-wrap"><canvas id="ais-quad-canvas" width="300" height="380"></canvas><p class="hint">Kéo 4 núm tròn ở góc vùng in để chỉnh phối cảnh (chạm được trên điện thoại). Ô số = tọa độ % theo ảnh áo.</p></div>`;
      const names = ['Góc trên-trái (1)', 'Góc trên-phải (2)', 'Góc dưới-phải (3)', 'Góc dưới-trái (4)'];
      // P4.2: the numeric inputs show the EFFECTIVE quad (the calibrated
      // quad of the current base, or the user's edited quad) — editing one
      // materialises it as a user quad (see bindProperties).
      const effQ = effectiveQuad(node, cm) || cm.quad;
      for (let i = 0; i < 4; i++) h += `<div class="pf-quad-row"><span>${names[i]}</span><label>X% <input type="number" id="pf-q${i}x" value="${(effQ[i][0] * 100).toFixed(1)}" step="0.5" min="0" max="100"></label><label>Y% <input type="number" id="pf-q${i}y" value="${(effQ[i][1] * 100).toFixed(1)}" step="0.5" min="0" max="100"></label></div>`;
      h += '<button id="pf-quad-preset">↺ Dùng quad mẫu của ảnh áo này</button>';
      h += field('Cong theo nếp vải % (mô phỏng)', `<span class="pf-range"><input type="range" id="pf-wrinkle" min="0" max="100" value="${cm.wrinkle}"><output id="pf-wrinkle-v">${cm.wrinkle}%</output></span>`);
      h += field('Bóng vải phủ lên hình in %', `<span class="pf-range"><input type="range" id="pf-shading" min="0" max="100" value="${cm.shading}"><output id="pf-shading-v">${cm.shading}%</output></span>`);
      h += field('Độ phủ mực % (100 = đặc như sticker)', `<span class="pf-range"><input type="range" id="pf-ink" min="50" max="100" value="${cm.inkOpacity ?? 95}"><output id="pf-ink-v">${cm.inkOpacity ?? 95}%</output></span>`);
      h += '<p class="hint">Khung đứt nét đỏ = vùng in an toàn, CHỈ hiện trong khung căn chỉnh này — không bao giờ xuất hiện ở Xem trước hay file xuất ra. Vùng in mặc định nằm giữa ngực, cách mép dưới cổ áo 8–12% chiều cao ảnh (quy tắc P4.2). Cong nếp vải + bóng vải là MÔ PHỎNG thị giác theo độ sáng tương đối của ảnh áo — không phải mô hình vải vật lý; ảnh ghép không phải ảnh sản phẩm thật. File hình in gốc không bị sửa.</p>';
    } else {
      h += field('Vị trí in X %', num('pf-printX', c.printX, 'min="5" max="95"')) + field('Vị trí in Y %', num('pf-printY', c.printY, 'min="5" max="95"')) + field('Rộng vùng in %', num('pf-printW', c.printW, 'min="5" max="80"')) + field('Xoay hình in (độ)', num('pf-rotation', c.rotation, 'min="-45" max="45"')) + '<p class="hint">Vị trí Y mặc định (55%) đặt vùng in giữa ngực, dưới cổ áo — chế độ đơn giản không vẽ khung hướng dẫn vào ảnh kết quả. File hình in gốc không bị sửa.</p>';
    }
  }
  if (node.type === 'background') {
    h += field('Kiểu nền', sel('pf-bg-mode', [['solid', 'Màu trơn'], ['gradient', 'Chuyển sắc (gradient)'], ['scene', 'Bối cảnh studio (tường + sàn)'], ['image', 'Ảnh nền riêng (tải lên)']], c.mode));
    h += `<div class="pf-swatches"><span>Màu sẵn:</span>${[['#f5f1e6', 'Kem'], ['#ffffff', 'Trắng'], ['#2b2b2b', 'Charcoal'], ['#b6492f', 'Terracotta']].map(([col, nm]) => `<button class="pf-swatch" data-color="${col}" style="background:${col}" title="${nm}" aria-label="Màu ${nm}"></button>`).join('')}</div>`;
    h += field('Màu chính', `<input type="color" id="pf-bg-color" value="${c.color}">`);
    h += field('Màu phụ (gradient / tường dưới)', `<input type="color" id="pf-bg-color2" value="${c.color2}">`);
    h += field('Hướng gradient', sel('pf-bg-dir', [['down', 'Trên xuống dưới'], ['diag', 'Chéo'], ['right', 'Trái sang phải']], c.dir));
    h += field('Đường chân trời % (bối cảnh studio)', num('pf-bg-horizon', c.horizon, 'min="20" max="90"'));
    h += field('Ảnh nền riêng (kiểu "Ảnh nền riêng")', '<input type="file" id="pf-bg-file" accept="image/png,image/jpeg,image/webp">') + (c.assetName ? `<p class="hint">Đang dùng: ${c.assetName}</p>` : '');
    h += field('Ảnh nền: cách lấp khung', sel('pf-bg-fit', [['cover', 'Phủ khung (cắt)'], ['contain', 'Vừa khung (chừa trống)']], c.bgFit));
    h += field('Làm mờ ảnh nền (px)', num('pf-bg-blur', c.bgBlur, 'min="0" max="20"'));
    h += field('Kích thước chủ thể %', num('pf-bg-scale', c.scale, 'min="20" max="100"'));
    h += field('Vị trí ngang %', num('pf-bg-posX', c.posX, 'min="0" max="100"')) + field('Vị trí dọc %', num('pf-bg-posY', c.posY, 'min="0" max="100"'));
    h += field('Bóng đổ dưới chủ thể %', num('pf-bg-shadow', c.shadow, 'min="0" max="100"'));
    h += field('Tối góc ảnh (vignette) %', num('pf-bg-vignette', c.vignette, 'min="0" max="100"'));
    h += '<p class="hint">Ảnh đầu vào có nền trong suốt (PNG) sẽ được đặt trực tiếp lên nền. Ảnh KHÔNG trong suốt sẽ được đặt dạng KHUNG ẢNH — node không tách nền giả.</p>';
  }
  if (node.type === 'imageEditor') { h += field('Cắt mỗi cạnh %', num('pf-crop', c.crop, 'min="0" max="40"')) + field('Xoay (độ: 0/90/180/270)', num('pf-rotate', c.rotate)) + field('Rộng đầu ra px (0 = giữ nguyên)', num('pf-resizeW', c.resizeW, 'min="0" max="2000"')) + field('Độ sáng %', num('pf-brightness', c.brightness, 'min="20" max="200"')) + field('Tương phản %', num('pf-contrast', c.contrast, 'min="20" max="200"')); }
  if (node.type === 'aiImageGen') { h += field('Tỉ lệ ảnh', sel('pf-ratio', [['4:5', '4:5'], ['1:1', '1:1'], ['9:16', '9:16 (TikTok)'], ['16:9', '16:9']], c.ratio)) + field('Số lượng (DEMO tạo 1; AI thật P4 luôn 1)', num('pf-count', c.count, 'min="1" max="4"')) + '<p class="hint">Node này tạo ảnh người mẫu mặc áo thun TRƠN đúng kiểu/màu đã chọn ở node Trợ lý prompt. Hình in KHÔNG do AI vẽ — node "Ghép hình in lên áo" sẽ ghép file thiết kế GỐC lên ảnh này ở bước sau.</p>' + aiModeHint(); }
  if (node.type === 'aiVariation') { h += field('Kiểu biến thể', sel('pf-variant', [['boi-canh', 'Đổi bối cảnh (tông màu)'], ['goc-khac', 'Đổi góc (phóng 1.3×)'], ['can-canh', 'Cận cảnh (phóng 2×)']], c.variant)) + aiModeHint() + '<p class="hint">Ở chế độ AI thật với model chỉ-tạo-từ-chữ, biến thể = tạo ảnh MỚI từ prompt biến thể (không phải img2img); với model img2img (klein/kontext) node sẽ báo rõ giới hạn URL tham chiếu của P4.</p>'; }
  if (node.type === 'aiVideoGen') { h += field('Mô tả chuyển động', `<input type="text" id="pf-motion" value="${(c.motion || '').replace(/"/g, '&quot;')}">`) + field('Thời lượng (giây, demo tối đa 6)', num('pf-duration', c.duration, 'min="1" max="6"')) + field('Tỉ lệ', sel('pf-ratio', [['9:16', '9:16 dọc'], ['16:9', '16:9 ngang'], ['1:1', '1:1']], c.ratio)) + '<p class="hint warn">DEMO: video WebM ghi từ canvas bằng MediaRecorder — không phải MP4, không phải AI video thật.</p>'; }
  if (node.type === 'exportNode') {
    h += field('Định dạng khi tải', sel('pf-format', [['png', 'PNG'], ['jpg', 'JPG'], ['svg', 'SVG (chỉ khi đầu vào là SVG thật)'], ['webm', 'Video WebM (chỉ khi đầu vào là video)']], c.format));
    h += `<fieldset class="pf-channels"><legend>Kích thước kênh bán hàng — chọn để tạo nhiều file cùng lúc</legend>${CHANNEL_PRESETS.map(p => `<label class="pf-ch"><input type="checkbox" data-channel="${p.id}" ${(c.channels || []).includes(p.id) ? 'checked' : ''}> ${p.label} <small>(${p.fit === 'cover' ? 'cắt phủ khung' : 'vừa khung'})</small></label>`).join('')}</fieldset>`;
    h += field('Chất lượng JPG %', num('pf-jpgq', c.jpgQuality ?? 92, 'min="50" max="100"'));
    h += field('Tiền tố tên file (để trống = theo tên kênh)', `<input type="text" id="pf-namepattern" value="${(c.namePattern || '').replace(/"/g, '&quot;')}">`);
    h += '<button id="pf-download">⬇ Tải file kết quả của node này</button>';
    if (out?.files?.length) h += `<div class="pf-files"><h4>File theo kênh (${out.files.length})</h4>${out.files.map((f, i) => `<div class="pf-file-row"><span>${f.name}</span><button data-file-dl="${i}">⬇ Tải</button></div>`).join('')}</div>`;
  }
  if (out) { h += `<div class="pout" id="ais-prop-output"><h4>Kết quả</h4>${out.kind === 'image' || out.kind === 'design' ? `<img src="${out.url}" alt="Kết quả">` : ''}${out.kind === 'video' ? `<video src="${out.url}" controls playsinline></video>` : ''}${out.kind === 'prompt' ? `<p>${out.text}</p>` : ''}${out.label ? `<p class="hint">${out.label}</p>` : ''}</div>`; }
  h += `<div class="plogs"><h4>Nhật ký node</h4>${(node.logs || []).map(l => `<div>${l}</div>`).join('') || '<div>Chưa chạy.</div>'}</div>`;
  box.innerHTML = h; bindProperties(node);
}
function storageHtml() { return `<div class="psec"><h4>Lưu trữ</h4><p class="hint" id="ais-storage-info">…</p><p class="hint">Chi tiết dung lượng, dọn file rác và xóa bộ nhớ đệm: tab "Lưu trữ" ở thanh dưới cùng.</p></div>`; }
function runSettingsHtml() { return `<div class="psec"><h4>Cài đặt chạy (P2)</h4>
  ${field('Số lần thử lại cho node tạo nội dung (nhóm AI)', `<input type="number" id="ais-set-retries" min="0" max="5" value="${runSettings.retriesAi}">`)}
  ${field('Thời gian chờ tối đa mỗi node (giây)', `<input type="number" id="ais-set-timeout" min="5" max="600" value="${runSettings.timeoutSec}">`)}
  <button id="ais-clear-cache-2">Xóa bộ nhớ đệm kết quả node</button>
  <p class="hint">Node có cấu hình + đầu vào không đổi sẽ được phục vụ từ bộ nhớ đệm (trạng thái "cached") thay vì chạy lại. Sửa cấu hình 1 node chỉ làm mất hiệu lực đệm của node đó và các node phía sau nó. Cài đặt này áp dụng cho phiên làm việc hiện tại.</p></div>`; }
function bindRunSettings(scope) {
  scope.querySelector('#ais-set-retries')?.addEventListener('change', e => { runSettings.retriesAi = Math.min(5, Math.max(0, Number(e.target.value) || 0)); });
  scope.querySelector('#ais-set-timeout')?.addEventListener('change', e => { runSettings.timeoutSec = Math.min(600, Math.max(5, Number(e.target.value) || 60)); });
  scope.querySelector('#ais-clear-cache-2')?.addEventListener('click', async () => { await store.clearCache(); message('Đã xóa bộ nhớ đệm kết quả node.'); await renderStoragePanel(); });
}
function providerStatusText() {
  const gm = generationMode();
  if (providerKind === 'http') return describeProvider(currentProvider());
  if (gm.mode === 'demo') return 'Đang ở chế độ DEMO — node AI chạy ngay trên máy, KHÔNG có lệnh gọi AI thật nào được thực hiện.';
  if (gm.mode === 'classic') return 'AI THẬT đang bật: Pollinations Classic (miễn phí, model sana, tối đa 768px, ảnh có logo). Lượt chạy có node AI sẽ gọi API thật (0 chi phí) và được ghi vào Lịch sử chạy.';
  if (gm.mode === 'blocked') return 'AI THẬT đang bật nhưng provider BỊ KHÓA: ' + gm.reason;
  if (gm.mode === 'keyed') return 'AI THẬT đang bật: Pollinations (key) · model ' + aiState.keyedModel + ' · ~' + (selectedModel()?.pricePerImage ?? '?') + ' Pollen/ảnh. Mỗi lượt chạy tốn Pollen đều phải xác nhận chi phí trước khi gọi API.';
  return '';
}
function providerHtml() {
  const prov = providerById(providerKind);
  const gm = generationMode();
  const curModelId = providerKind === 'pollinations' ? aiState.keyedModel : 'sana';
  let h = `<div class="psec"><h4>Nhà cung cấp AI (P4)</h4>
  <label class="pf-switch"><input type="checkbox" id="ais-real-switch" ${aiState.realEnabled ? 'checked' : ''}> <strong>Bật chế độ AI THẬT</strong></label>
  <p class="hint">Mặc định TẮT mỗi khi mở trang: khi tắt, mọi node AI chạy DEMO trên máy và không có lệnh gọi tạo ảnh nào ra ngoài. Bật lên mới dùng được 2 provider Pollinations dưới đây. Node video luôn là DEMO (P4 chưa có provider video thật).</p>
  ${field('Nhà cung cấp', sel('ais-provider-kind', PROVIDERS.map(p => [p.id, p.name]), providerKind))}`;
  if (prov.models.length) {
    h += field('Model', `<select id="ais-provider-model">${prov.models.map(m => `<option value="${m.id}" ${m.id === curModelId ? 'selected' : ''} ${isRunnableModel(m) ? '' : 'disabled'}>${m.name} — ${m.pricePerImage === null ? 'giá theo token · P4 không cho chạy' : m.pricePerImage === 0 ? '0 Pollen (miễn phí)' : '~' + m.pricePerImage + ' Pollen/ảnh'}</option>`).join('')}</select>`);
  }
  h += `<div class="pf-provider-info" id="ais-provider-info"><p class="hint"><strong>Chi phí & hạn mức:</strong> ${prov.limits}</p><p class="hint">${COMMERCIAL_USE_NOTE}</p></div>`;
  if (providerKind === 'pollinations') {
    h += field('API key Pollinations (chỉ trong bộ nhớ phiên — KHÔNG lưu)', `<input type="password" id="ais-provider-key" autocomplete="off" placeholder="${hasSessionKey() ? 'Đã nhập key cho phiên này (gõ lại để thay)' : 'Dán key sk_… cho phiên này'}">`);
    h += `<label class="pf-switch"><input type="checkbox" id="ais-keyed-confirm" ${aiState.keyedConfirmed ? 'checked' : ''}> Tôi hiểu rủi ro bảo mật + chi phí và muốn bật provider có key trong phiên này</label>`;
    h += `<p class="hint warn">${BROWSER_KEY_WARNING}</p><p class="hint warn">${POLLINATIONS_KEY_WARNING}</p><p class="hint warn">${AUTO_TOPUP_WARNING}</p>`;
    h += `<div class="prow"><button id="ais-provider-balance">Kiểm tra số dư Pollen</button></div><p class="hint" id="ais-balance-status">Số dư: chưa kiểm tra. Kiểm tra số dư chỉ đọc thông tin tài khoản — không tạo ảnh, không tốn Pollen.</p>`;
  }
  if (providerKind === 'http') {
    h += field('Tên nhà cung cấp', '<input type="text" id="ais-provider-name" value="HTTP Provider">')
      + field('Endpoint', '<input type="url" id="ais-provider-endpoint" placeholder="https://proxy.example.com/ai">')
      + field('API key (chỉ trong bộ nhớ phiên — KHÔNG lưu)', '<input type="password" id="ais-provider-key" autocomplete="off" placeholder="Nhập key cho phiên này">')
      + `<p class="hint warn">${BROWSER_KEY_WARNING}</p>`;
  }
  h += `<div class="prow"><button id="ais-provider-test">Kiểm tra kết nối (0 chi phí)</button></div>
  <p class="hint">Nút kiểm tra chỉ gọi endpoint danh mục model công khai của Pollinations (không cần key, không tạo ảnh, không tốn chi phí)${providerKind === 'http' || providerKind === 'demo' ? ' — với loại provider đang chọn, nút này chỉ báo trạng thái cấu hình như các phiên bản trước' : ''}.</p>
  <p class="hint" id="ais-provider-status">${providerStatusText()}</p></div>`;
  return h;
}
function bindProvider(scope) {
  const rerender = () => { updateModeBadge(); renderProperties(); };
  scope.querySelector('#ais-provider-kind')?.addEventListener('change', e => { providerKind = e.target.value; rerender(); });
  scope.querySelector('#ais-real-switch')?.addEventListener('change', e => { aiState.realEnabled = e.target.checked; rerender(); logLine(e.target.checked ? 'Đã BẬT chế độ AI thật cho phiên này (tự tắt khi tải lại trang).' : 'Đã tắt chế độ AI thật — node AI chạy DEMO.'); });
  scope.querySelector('#ais-provider-model')?.addEventListener('change', e => { if (providerKind === 'pollinations') aiState.keyedModel = e.target.value; rerender(); });
  scope.querySelector('#ais-provider-key')?.addEventListener('change', e => { setSessionKey(e.target.value); rerender(); });
  scope.querySelector('#ais-keyed-confirm')?.addEventListener('change', e => { aiState.keyedConfirmed = e.target.checked; rerender(); });
  scope.querySelector('#ais-provider-test')?.addEventListener('click', async () => {
    const st = scope.querySelector('#ais-provider-status'); if (st) st.textContent = 'Đang kiểm tra kết nối (chỉ đọc danh mục model — 0 chi phí)…';
    const p = currentProvider();
    if (p.isDemo && providerKind !== 'http') { if (st) st.textContent = 'Đang ở chế độ DEMO — chưa kết nối AI thật.'; return; }
    try { const r = await p.testConnection(); if (st) st.textContent = r.message; logLine('Kiểm tra kết nối provider: ' + r.message); }
    catch (e) { if (st) st.textContent = 'Kiểm tra kết nối thất bại: ' + e.message; }
  });
  scope.querySelector('#ais-provider-balance')?.addEventListener('click', async () => {
    const st = scope.querySelector('#ais-balance-status'); if (st) st.textContent = 'Đang đọc số dư…';
    try { const r = await new PollinationsKeyedAdapter().checkBalance(); if (st) st.textContent = r.balance === null ? 'Đã kết nối được bằng key này nhưng phản hồi không có trường số dư đọc được.' : `Số dư Pollen khả dụng: ${r.balance} (≈ ${r.balance} USD) · ${new Date(r.at).toLocaleTimeString('vi-VN')}. Đây là số dư trả trước — hết số dư provider sẽ dừng cứng (402).`; }
    catch (e) { if (st) st.textContent = 'Kiểm tra số dư lỗi: ' + e.message; }
  });
  refreshStorage();
}
function bindProperties(node) {
  const c = node.config; const on = (id, ev, fn) => { const el = document.getElementById(id); el?.addEventListener(ev, fn); };
  const upd = (key, val) => { c[key] = val; renderNodes(); scheduleSave(); };
  $('#ais-prop-close')?.addEventListener('click', () => { selectedId = null; propsForcedOpen = false; renderAll(); });
  on('ais-p-run', 'click', () => runNodes('single', node.id));
  on('ais-p-runfrom', 'click', () => runNodes('from', node.id));
  on('ais-p-del', 'click', () => { graph.nodes = graph.nodes.filter(n => n.id !== node.id); graph.edges = graph.edges.filter(e => e.from !== node.id && e.to !== node.id); selectedId = null; pushHistory(); renderAll(); scheduleSave(); });
  on('ais-p-dup', 'click', () => { const n = makeNode(node.type, node.x + 36, node.y + 36); n.config = structuredClone(node.config); graph.nodes.push(n); selectedId = n.id; pushHistory(); renderAll(); scheduleSave(); });
  on('pf-file', 'change', async (e) => {
    const files = [...e.target.files]; if (!files.length) return;
    try {
      for (const f of files) {
        if (node.type === 'designInput' && /svg/i.test(f.type + f.name)) { const text = await f.text(); const chk = checkSvgSafety(text); if (!chk.ok) throw new Error(chk.reason); c.svgText = text; c.assetName = f.name; c.assetId = ''; }
        else {
          if (!/^image\/(png|jpeg|webp|svg\+xml)$/.test(f.type)) throw new Error('Định dạng không hỗ trợ: ' + f.name);
          const id = uid('asset'); const bmp = await createImageBitmap(f).catch(() => null);
          await store.saveAsset({ id, blob: f, name: f.name, mime: f.type });
          c.assetId = id; c.assetName = f.name; if (bmp) { c.width = bmp.width; c.height = bmp.height; }
          c.assetIds = [...(c.assetIds || []), id];
        }
      }
      message('Đã lưu file vào IndexedDB của AI Studio.'); pushHistory(); renderAll(); scheduleSave();
    } catch (err) { message('Tải file lỗi: ' + err.message, true); }
  });
  on('pf-sample', 'click', () => { c.svgText = SAMPLE_DESIGN_SVG; c.assetName = 'hinh-in-mau.svg'; c.assetId = ''; pushHistory(); renderAll(); scheduleSave(); });
  on('pf-text', 'input', e => upd('text', e.target.value));
  document.querySelectorAll('.pf-tpl').forEach(b => b.addEventListener('click', () => { upd('text', PROMPT_TEMPLATES[+b.dataset.tpl]); renderProperties(); }));
  for (const gName of Object.keys(PROMPT_OPTIONS)) on('pf-' + gName, 'change', e => { upd(gName, e.target.value); c.composed = buildPrompt(c, ''); renderProperties(); });
  for (const gk of ['kieuAo', 'mauAo', 'gocChup']) on('pf-' + gk, 'change', e => { upd(gk, e.target.value); c.composed = buildPrompt(c, ''); renderProperties(); });
  on('pf-extra', 'input', e => upd('extra', e.target.value));
  const numBind = (id, key) => on(id, 'change', e => upd(key, Number(e.target.value)));
  ['fixture', 'base'].forEach(k => on('pf-' + k, 'change', e => upd(k, e.target.value)));
  on('pf-svg', 'change', e => { const v = e.target.value; if (v) { const chk = checkSvgSafety(v); if (!chk.ok) return message(chk.reason, true); } upd('svgText', v); });
  numBind('pf-printX', 'printX'); numBind('pf-printY', 'printY'); numBind('pf-printW', 'printW'); numBind('pf-rotation', 'rotation');
  // ---- P3 composition: mode, quad editor, wrinkle/shading ----
  if (node.type === 'composition') {
    // NOTE: write through node.config, NOT the captured `c` — setupQuadEditor
    // (called just below) replaces node.config with a migrated copy, which
    // would orphan any writes made through the older object reference.
    on('pf-garment-source', 'change', e => { node.config.garmentSource = e.target.value; delete node.config.quadSource; node.config = migrateCompositionConfig(node.config); pushHistory(); renderAll(); scheduleSave(); });
    on('pf-real-base', 'change', e => { node.config.realBase = e.target.value; delete node.config.quadSource; renderNodes(); scheduleSave(); });
    on('pf-comp-mode', 'change', e => { c.mode = e.target.value; if (c.mode === 'perspective') node.config = migrateCompositionConfig(node.config); pushHistory(); renderAll(); scheduleSave(); });
    if (document.getElementById('ais-quad-canvas')) {
      setupQuadEditor(node);
      for (let i = 0; i < 4; i++) for (const ax of ['x', 'y']) on('pf-q' + i + ax, 'change', e => {
        node.config = migrateCompositionConfig(node.config);
        // P4.2: typing a coordinate also materialises the effective quad
        // first (same rule as dragging), then marks it user-edited.
        if (node.config.quadSource !== 'user') { node.config.quad = effectiveQuad(node, node.config).map(pt => [...pt]); node.config.quadSource = 'user'; }
        node.config.quad[i][ax === 'x' ? 0 : 1] = Math.min(100, Math.max(0, Number(e.target.value) || 0)) / 100;
        drawQuadPreview(node); scheduleSave();
      });
      on('pf-quad-preset', 'click', () => { const q = effectiveQuad(node, { ...node.config, quadSource: '' }); if (q) { node.config.quad = q.map(pt => [...pt]); delete node.config.quadSource; pushHistory(); renderAll(); scheduleSave(); } else message('Ảnh áo này chưa có quad mẫu — hãy kéo tay 4 góc.', true); });
      const range = (id, outId, key) => on(id, 'input', e => { c[key] = Number(e.target.value); const o = document.getElementById(outId); if (o) o.textContent = e.target.value + '%'; drawQuadPreview(node); scheduleSave(); });
      range('pf-wrinkle', 'pf-wrinkle-v', 'wrinkle'); range('pf-shading', 'pf-shading-v', 'shading');
      // P4.2: write ink opacity through node.config (NOT the captured `c` —
      // setupQuadEditor replaced node.config with a migrated copy, so a
      // write through `c` would be orphaned; see the P4.1 note above).
      on('pf-ink', 'input', e => { node.config = migrateCompositionConfig(node.config); node.config.inkOpacity = Number(e.target.value); const o = document.getElementById('pf-ink-v'); if (o) o.textContent = e.target.value + '%'; scheduleSave(); });
    }
  }
  // ---- P3 background node ----
  if (node.type === 'background') {
    on('pf-bg-mode', 'change', e => upd('mode', e.target.value));
    on('pf-bg-color', 'input', e => { c.color = e.target.value; scheduleSave(); });
    on('pf-bg-color2', 'input', e => { c.color2 = e.target.value; scheduleSave(); });
    on('pf-bg-dir', 'change', e => upd('dir', e.target.value));
    on('pf-bg-fit', 'change', e => upd('bgFit', e.target.value));
    numBind('pf-bg-horizon', 'horizon'); numBind('pf-bg-blur', 'bgBlur'); numBind('pf-bg-scale', 'scale');
    numBind('pf-bg-posX', 'posX'); numBind('pf-bg-posY', 'posY'); numBind('pf-bg-shadow', 'shadow'); numBind('pf-bg-vignette', 'vignette');
    document.querySelectorAll('.pf-swatch').forEach(b => b.addEventListener('click', () => { c.color = b.dataset.color; renderProperties(); scheduleSave(); }));
    on('pf-bg-file', 'change', async (e) => {
      const f = e.target.files[0]; if (!f) return;
      if (!/^image\/(png|jpeg|webp)$/.test(f.type)) return message('Ảnh nền phải là PNG/JPG/WebP.', true);
      const id = uid('asset'); await store.saveAsset({ id, blob: f, name: f.name, mime: f.type });
      c.assetId = id; c.assetName = f.name; message('Đã lưu ảnh nền vào IndexedDB.'); pushHistory(); renderAll(); scheduleSave();
    });
  }
  // ---- P3 export channels ----
  if (node.type === 'exportNode') {
    document.querySelectorAll('[data-channel]').forEach(cb => cb.addEventListener('change', () => {
      const set = new Set(c.channels || []); cb.checked ? set.add(cb.dataset.channel) : set.delete(cb.dataset.channel);
      c.channels = CHANNEL_PRESETS.map(p => p.id).filter(id => set.has(id)); scheduleSave(); renderNodes();
    }));
    numBind('pf-jpgq', 'jpgQuality');
    on('pf-namepattern', 'input', e => { c.namePattern = e.target.value; scheduleSave(); });
    document.querySelectorAll('[data-file-dl]').forEach(b => b.addEventListener('click', () => { const f = outputs.get(node.id)?.files?.[+b.dataset.fileDl]; if (f) saveBlob(f.blob, f.name); }));
  }
  numBind('pf-crop', 'crop'); numBind('pf-rotate', 'rotate'); numBind('pf-resizeW', 'resizeW'); numBind('pf-brightness', 'brightness'); numBind('pf-contrast', 'contrast');
  numBind('pf-count', 'count'); numBind('pf-duration', 'duration');
  on('pf-ratio', 'change', e => upd('ratio', e.target.value)); on('pf-variant', 'change', e => upd('variant', e.target.value)); on('pf-format', 'change', e => upd('format', e.target.value));
  on('pf-motion', 'input', e => upd('motion', e.target.value));
  on('pf-download', 'click', async () => { const v = outputs.get(node.id); if (!v) return message('Hãy chạy workflow trước khi tải.', true); await downloadValue(v, node.config.format); });
}

// ---------- P3: quad editor (draggable corner handles in properties) ----------
/** The quad the composition handler will actually use for this node right
 * now (P4.2 resolution order, mirrored from the handler): 'real' source →
 * the real base's calibrated preset; a user-edited quad (quadSource
 * 'user') → the stored quad; a generated base carrying its own collar-
 * calibrated quad → that quad; otherwise the stored quad / base preset. */
function effectiveQuad(node, cfg) {
  if (cfg.garmentSource === 'real') return presetQuadFor(cfg.realBase || cfg.base) || cfg.quad;
  if (cfg.quadSource === 'user' && Array.isArray(cfg.quad) && cfg.quad.length === 4) return cfg.quad;
  const gEdge = graph.edges.find(e => e.to === node.id && e.toPort === 'garment');
  const bq = gEdge ? outputs.get(gEdge.from)?.baseQuad : null;
  if (Array.isArray(bq) && bq.length === 4) return bq;
  return (Array.isArray(cfg.quad) && cfg.quad.length === 4) ? cfg.quad : (presetQuadFor(cfg.base) || rectToQuad(cfg.printX, cfg.printY, cfg.printW));
}
let quadDrawToken = 0;
async function drawQuadPreview(node) {
  const canvas = document.getElementById('ais-quad-canvas'); if (!canvas) return;
  const token = ++quadDrawToken;
  const cfg = migrateCompositionConfig(node.config);
  const gEdge = graph.edges.find(e => e.to === node.id && e.toPort === 'garment');
  const dEdge = graph.edges.find(e => e.to === node.id && e.toPort === 'design');
  // P4.1: in 'real' source mode the preview shows the real fixture photo and
  // its calibrated preset quad (the quad the handler will actually use).
  let gSrc;
  const quadUsed = effectiveQuad(node, cfg);
  if (cfg.garmentSource === 'real') { gSrc = cfg.realBase || cfg.base; }
  else { gSrc = gEdge ? outputs.get(gEdge.from)?.url : null; if (!gSrc) gSrc = cfg.base; }
  let dSrc = dEdge ? outputs.get(dEdge.from)?.url : null;
  if (!dSrc && dEdge) { const dn = findNode(graph, dEdge.from); if (dn?.config.svgText) dSrc = URL.createObjectURL(new Blob([dn.config.svgText], { type: 'image/svg+xml' })); }
  try {
    const g = await loadImg(gSrc); if (token !== quadDrawToken || !document.getElementById('ais-quad-canvas')) return;
    const s = Math.min(300 / g.width, 380 / g.height);
    canvas.width = Math.max(80, Math.round(g.width * s)); canvas.height = Math.max(80, Math.round(g.height * s));
    const x = canvas.getContext('2d'); x.drawImage(g, 0, 0, canvas.width, canvas.height);
    const quadPx = quadUsed.map(([qx, qy]) => [qx * canvas.width, qy * canvas.height]);
    if (dSrc) {
      const d = await loadImg(dSrc); if (token !== quadDrawToken) return;
      const { layer } = renderWarpedLayer(canvas, d, quadUsed, { wrinkle: cfg.wrinkle || 0, shading: cfg.shading || 0 });
      x.drawImage(layer, 0, 0);
    } else {
      x.save(); x.fillStyle = 'rgba(182,73,47,0.22)'; x.beginPath(); quadPx.forEach(([px, py], i) => i ? x.lineTo(px, py) : x.moveTo(px, py)); x.closePath(); x.fill(); x.restore();
    }
    strokeQuad(x, quadPx);
    quadPx.forEach(([px, py], i) => { x.save(); x.beginPath(); x.arc(px, py, 11, 0, Math.PI * 2); x.fillStyle = '#fff'; x.fill(); x.lineWidth = 3; x.strokeStyle = '#b6492f'; x.stroke(); x.fillStyle = '#b6492f'; x.font = 'bold 12px Arial'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(String(i + 1), px, py + 1); x.restore(); });
  } catch { /* the quad preview is best-effort; numeric inputs always work */ }
}
function setupQuadEditor(node) {
  const canvas = document.getElementById('ais-quad-canvas'); if (!canvas) return;
  node.config = migrateCompositionConfig(node.config);
  drawQuadPreview(node);
  let dragI = -1;
  canvas.style.touchAction = 'none';
  const pos = (e) => { const r = canvas.getBoundingClientRect(); return { x: (e.clientX - r.left) * canvas.width / r.width, y: (e.clientY - r.top) * canvas.height / r.height }; };
  canvas.addEventListener('pointerdown', (e) => {
    const p = pos(e); const quadPx = effectiveQuad(node, node.config).map(([qx, qy]) => [qx * canvas.width, qy * canvas.height]);
    dragI = quadPx.findIndex(([hx, hy]) => Math.hypot(hx - p.x, hy - p.y) <= 26); // ≥26px hit area for touch
    if (dragI >= 0) {
      // P4.2: dragging materialises the effective (calibrated) quad into
      // the node's own quad and marks it user-edited, so the handler will
      // honour the user's adjustment over the calibrated default.
      if (node.config.quadSource !== 'user') { node.config.quad = effectiveQuad(node, node.config).map(pt => [...pt]); node.config.quadSource = 'user'; }
      canvas.setPointerCapture(e.pointerId); e.preventDefault();
    }
  });
  canvas.addEventListener('pointermove', (e) => {
    if (dragI < 0) return; const p = pos(e);
    node.config.quad[dragI] = [Math.min(1, Math.max(0, p.x / canvas.width)), Math.min(1, Math.max(0, p.y / canvas.height))];
    const ix = document.getElementById('pf-q' + dragI + 'x'), iy = document.getElementById('pf-q' + dragI + 'y');
    if (ix) ix.value = (node.config.quad[dragI][0] * 100).toFixed(1);
    if (iy) iy.value = (node.config.quad[dragI][1] * 100).toFixed(1);
    drawQuadPreview(node);
  });
  const end = () => { if (dragI >= 0) { dragI = -1; pushHistory(); scheduleSave(); renderNodes(); } };
  canvas.addEventListener('pointerup', end); canvas.addEventListener('pointercancel', end);
}

// ---------- downloads / export ----------
function saveBlob(blob, name) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); }
async function downloadValue(v, format) {
  if (!v) return message('Chưa có kết quả.', true);
  if (v.kind === 'video') return saveBlob(v.blob, 'video-demo.webm');
  if (v.kind === 'prompt') return saveBlob(new Blob([v.text], { type: 'text/plain' }), 'prompt.txt');
  if (format === 'svg') { if (!v.svgText) return message('Đầu vào không phải SVG vector thật — không xuất SVG (không đổi tên PNG thành SVG).', true); return saveBlob(new Blob([v.svgText], { type: 'image/svg+xml' }), 'thiet-ke.svg'); }
  if (format === 'jpg' && v.blob) { const img = await blobToImg(v.blob); const c = makeCanvas(img.width, img.height); const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(img, 0, 0); return saveBlob(await canvasBlob(c, 'image/jpeg'), 'ket-qua.jpg'); }
  if (v.blob) return saveBlob(v.blob, 'ket-qua.' + (v.mime?.includes('webp') ? 'webp' : v.mime?.includes('jpeg') ? 'jpg' : 'png'));
  message('Kết quả này không có file để tải.', true);
}
const te = new TextEncoder();
async function exportZip() {
  const name = $('#ais-project-name').value.trim() || 'du-an';
  const entries = [];
  const wf = { app: 'AO IN STUDIO — AI CREATIVE WORKFLOW', version: 1, exportedAt: new Date().toISOString(), projectId, name, graph: JSON.parse(snapshot()) };
  entries.push({ name: 'workflow.json', data: te.encode(JSON.stringify(wf, null, 2)) });
  entries.push({ name: 'metadata.json', data: te.encode(JSON.stringify({ name, nodes: graph.nodes.length, edges: graph.edges.length, note: 'Không chứa API key. Ảnh DEMO/AI thật được ghi rõ nhãn trong workflow và lịch sử chạy.', demoMode: generationMode().mode === 'demo', aiMode: modeBadgeText() }, null, 2)) });
  entries.push({ name: 'prompts.txt', data: te.encode(graph.nodes.filter(n => ['promptInput', 'promptAssistant'].includes(n.type)).map(n => `[${NODE_DEFS[n.type].label}] ${n.config.text || n.config.composed || ''}`).join('\n\n')) });
  const assetIds = new Set(); for (const n of graph.nodes) { if (n.config.assetId) assetIds.add(n.config.assetId); for (const id of n.config.assetIds || []) assetIds.add(id); }
  for (const id of assetIds) { const a = await store.getAsset(id); if (a) entries.push({ name: `assets/${id}_${a.name}`, data: new Uint8Array(await a.blob.arrayBuffer()) }); }
  for (const n of graph.nodes) if (n.config.svgText) entries.push({ name: `designs/${n.id}.svg`, data: te.encode(n.config.svgText) });
  for (const [id, v] of outputs) {
    if (v?.files?.length) { for (const f of v.files) entries.push({ name: `results/${f.name}`, data: new Uint8Array(await f.blob.arrayBuffer()) }); }
    else if (v?.blob) entries.push({ name: `results/${id}.${v.kind === 'video' ? 'webm' : v.mime?.includes('jpeg') ? 'jpg' : v.mime?.includes('svg') ? 'svg' : 'png'}`, data: new Uint8Array(await v.blob.arrayBuffer()) });
  }
  saveBlob(new Blob([zipWrite(entries)], { type: 'application/zip' }), name.replace(/\s+/g, '-') + '.zip');
  message('Đã xuất ZIP dự án (không chứa API key).');
}
async function importFile(file) {
  try {
    if (/\.zip$/i.test(file.name)) {
      const entries = zipRead(new Uint8Array(await file.arrayBuffer()));
      const wfEntry = entries.find(e => e.name === 'workflow.json'); if (!wfEntry) throw new Error('ZIP thiếu workflow.json.');
      for (const e of entries) if (e.name.startsWith('assets/')) { const base = e.name.slice('assets/'.length); const id = base.split('_')[0]; await store.saveAsset({ id, blob: new Blob([e.data]), name: base.slice(id.length + 1) }); }
      applyImported(JSON.parse(new TextDecoder().decode(wfEntry.data)));
    } else applyImported(JSON.parse(await file.text()));
  } catch (e) { message('Nhập dự án lỗi: ' + e.message, true); }
}
function applyImported(wf) {
  const g = wf.graph || wf; if (!g.nodes || !g.edges) throw new Error('File không chứa workflow hợp lệ.');
  projectId = uid('project'); $('#ais-project-name').value = wf.name || 'Dự án nhập vào';
  graph = { nodes: g.nodes.map(n => ({ ...n, status: 'idle', logs: [], error: '' })), edges: g.edges, meta: g.meta || null };
  migrateGraph(graph);
  { const r = refreshTpl1Graph(graph); if (r.refreshed) { graph = r.graph; logLine(`Workflow nhập vào thuộc Mẫu 1 phiên bản cũ — đã tự cập nhật: ${r.notes.join('; ')}.`); } }
  outputs = new Map(); pushHistory(); renderAll(); scheduleSave(); message('Đã nhập workflow. Hãy bấm Lưu / chờ tự lưu.');
}

// ---------- run (P2: queue + validation + cache + retry/timeout + history) ----------
const TRIGGER_LABELS = { all: 'Chạy toàn bộ', single: 'Chạy 1 node', from: 'Chạy từ node', resume: 'Chạy tiếp từ node lỗi' };
function setRunProgress(text) { const el = $('#ais-run-progress'); if (el) el.textContent = text; }
function startRunTimer(total) {
  runStartedAt = Date.now(); stopRunTimer();
  runTimer = setInterval(() => { const s = ((Date.now() - runStartedAt) / 1000).toFixed(1).replace('.', ','); setRunProgress(`Đang chạy… đã ${s} s`); }, 250);
}
function stopRunTimer() { if (runTimer) { clearInterval(runTimer); runTimer = null; } }
function updateResumeBtn() { const b = $('#ais-resume'); if (b) b.hidden = !(lastFailedNodeId && lastRunProjectId === projectId); }

async function recordRun(rec) {
  try {
    await store.saveRun(rec);
    const all = await store.listRuns(projectId);
    for (const old of pruneOldest(all, RUN_HISTORY_CAP, 'startedAt')) await store.deleteRun(old.id);
  } catch { /* history is best-effort; never fail a run over it */ }
  await renderHistory(); await renderStoragePanel();
}

/**
 * P4 pre-run cost confirmation for KEYED generation. Lists every planned
 * generation call with its Pollen price and the maximum total; the run only
 * proceeds on an explicit "Chạy và chấp nhận chi phí". Classic (free) runs
 * never show this dialog because their cost is exactly 0.
 */
function confirmCostDialog(calls, totalPollen) {
  return new Promise((resolve) => {
    const dlg = document.getElementById('ais-cost-dialog');
    if (!dlg) return resolve(false);
    document.getElementById('ais-cost-list').innerHTML = calls.map(c => `<li>${esc(c.nodeLabel)} — ${esc(c.providerName)} · model ${esc(c.modelName)} · <strong>${c.costPollen === 0 ? '0 Pollen (miễn phí)' : '~' + c.costPollen + ' Pollen'}</strong></li>`).join('');
    document.getElementById('ais-cost-total').textContent = `Tổng tối đa ước tính: ~${totalPollen} Pollen (≈ ${totalPollen} USD). Đây là mức TỐI ĐA của lượt này — node nào được phục vụ từ bộ nhớ đệm sẽ không gọi API và không tốn Pollen. Pollen là trả trước: hết số dư thì provider dừng cứng (HTTP 402), không tự trừ thẻ — trừ khi bạn đã tự bật auto top-up trong dashboard Pollinations.`;
    dlg.hidden = false;
    const done = (v) => { dlg.hidden = true; document.getElementById('ais-cost-accept').onclick = null; document.getElementById('ais-cost-cancel').onclick = null; resolve(v); };
    document.getElementById('ais-cost-accept').onclick = () => done(true);
    document.getElementById('ais-cost-cancel').onclick = () => done(false);
  });
}

/** All run requests go through the queue: one active run at a time. */
function runNodes(mode, id) {
  return runQueue.enqueue(TRIGGER_LABELS[mode] || mode, () => executeRun(mode, id));
}
async function executeRun(mode, id) {
  // Pre-run validation report: block with a Vietnamese problem list.
  const problems = validateWorkflow(graph);
  if (problems.length) {
    message('Không thể chạy — workflow còn ' + problems.length + ' vấn đề cần sửa:', true);
    const ul = document.createElement('ul'); ul.className = 'validation-list';
    for (const p of problems) { const li = document.createElement('li'); li.textContent = p.message; ul.appendChild(li); logLine('⚠ ' + p.message); }
    $('#ais-message').appendChild(ul);
    return { blocked: true, problems };
  }
  // ---- P4 cost gate: real-provider planning BEFORE anything runs ----
  const gm = generationMode();
  if (gm.mode === 'blocked') { message(gm.reason, true); logLine('⚠ ' + gm.reason); return { blocked: true, problems: [{ message: gm.reason }] }; }
  const realActive = gm.mode === 'classic' || gm.mode === 'keyed';
  let runIds;
  if (mode === 'single') runIds = new Set(upstreamOf(graph, id));
  else if (mode === 'from') runIds = new Set([...upstreamOf(graph, id), ...downstreamOf(graph, id)]);
  else if (mode === 'resume') runIds = new Set([id, ...downstreamOf(graph, id)]);
  else runIds = new Set(graph.nodes.map(n => n.id));
  const genNodes = graph.nodes.filter(n => runIds.has(n.id) && (n.type === 'aiImageGen' || n.type === 'aiVariation'));
  if (realActive && genNodes.length) {
    const provider = providerById(providerKind); const model = selectedModel();
    const calls = describePlannedCalls(genNodes.map(n => ({ nodeId: n.id, label: NODE_DEFS[n.type].label })), provider, model);
    const est = estimateGenerationCost(calls.map(c => ({ providerId: c.providerId, modelId: c.modelId, count: 1 })));
    if (!est.ok) { for (const pr of est.problems) { message(pr, true); logLine('⚠ ' + pr); } return { blocked: true, problems: est.problems.map(message => ({ message })) }; }
    if (gm.mode === 'keyed') {
      const accepted = await confirmCostDialog(calls, est.totalPollen);
      if (!accepted) { message('Đã hủy lượt chạy trước khi gọi API — chưa phát sinh chi phí nào.'); return { cancelled: true }; }
      logLine(`Đã xác nhận chi phí: tối đa ~${est.totalPollen} Pollen cho ${calls.length} lệnh gọi AI thật.`);
    } else {
      logLine(`Lượt này có ${calls.length} lệnh gọi AI THẬT qua Pollinations Classic (miễn phí, 0 Pollen) — node được phục vụ từ bộ nhớ đệm sẽ không gọi API.`);
    }
    if (runSettings.retriesAi > 0) logLine('Đã tắt thử lại tự động cho các lệnh gọi AI thật ở lượt này (tránh phát sinh chi phí / trừ Pollen ngoài ý muốn).');
  }
  runRealCalls = [];
  lastFailedNodeId = null; updateResumeBtn();
  const startedAt = Date.now();
  let seedOutputs = outputs, seedKeys = new Map();
  if (mode === 'resume') {
    // Reuse successful upstream results: in-memory outputs first, and the
    // persisted cache (survives reload) for everything else.
    const { seeds, seedKeys: sk } = await latestCacheByNode();
    seedOutputs = new Map([...seeds, ...outputs]); seedKeys = sk;
  }
  engine = new Engine(graph, handlers, {
    seedOutputs, seedKeys,
    // P4.1: a composition node in 'real' garment-source mode does not
    // consume the AI photo, so an aiImageGen failure must not skip it.
    ignoreFailedUpstream: (node) => node.type === 'composition' && node.config?.garmentSource === 'real',
    keyFor: (node, inputKeys) => nodeCacheKey(node, inputKeys),
    cacheable: (node) => isCacheable(node),
    cacheGet: cacheGetRecord,
    cachePut: cachePutRecord,
    retriesFor: (node) => (realActive && suppressRetryForMode(gm.mode) && (node.type === 'aiImageGen' || node.type === 'aiVariation')) ? 0 : (NODE_DEFS[node.type]?.category === 'ai' ? runSettings.retriesAi : 0),
    timeoutFor: () => runSettings.timeoutSec * 1000,
    onNode: (n) => { renderNodes(); if (n.id === selectedId) renderProperties(); },
    onLog: (n, m) => logLine((n ? NODE_DEFS[n.type].label + ': ' : '') + m),
    onProgress: (doneCount, total) => setRunProgress(`Đang chạy: ${doneCount}/${total} node · ${formatDuration(Date.now() - startedAt)}`),
  });
  outputs = engine.outputs;
  message('Đang chạy workflow (' + modeBadgeText() + ')…');
  startRunTimer();
  let r = { done: [], failed: [], stopped: false };
  try {
    if (mode === 'all') r = await engine.runAll();
    else if (mode === 'single') r = await engine.runSingle(id);
    else if (mode === 'from') r = await engine.runFrom(id);
    else if (mode === 'resume') r = await engine.run([id, ...downstreamOf(graph, id).filter(x => x !== id)]);
    const cachedCount = [...engine.records.values()].filter(x => x.cached).length;
    // P4.1: a composition node skipped because the AI garment failed gets a
    // clear, actionable error pointing at the real-photo fallback — never a
    // silent wrong image.
    for (const n of graph.nodes) {
      if (n.type === 'composition' && n.status === 'error' && /phía trước bị lỗi/.test(n.error || '') && n.config?.garmentSource !== 'real') {
        n.error += ' Gợi ý: nếu node Tạo ảnh AI bị lỗi hoặc ảnh AI sai kiểu áo/màu áo, hãy mở node Ghép hình in và chuyển "Nguồn ảnh áo" sang "Ảnh mẫu thật" để ghép hình in lên ảnh áo thật.';
        logLine('Ghép hình in lên áo: ' + n.error);
      }
    }
    message(r.failed.length ? `Chạy xong: ${r.done.length} node xong (${cachedCount} dùng bộ nhớ đệm), ${r.failed.length} node lỗi.` : `Chạy xong: ${r.done.length} node xong (${cachedCount} dùng bộ nhớ đệm).`, r.failed.length > 0);
    lastFailedNodeId = r.failed.length ? r.failed[0] : null;
    lastRunProjectId = projectId; updateResumeBtn();
  } catch (e) { message('Lỗi workflow: ' + e.message, true); lastFailedNodeId = null; updateResumeBtn(); }
  finally { stopRunTimer(); }
  const finishedAt = Date.now();
  setRunProgress(`Lượt chạy gần nhất: ${r.done.length} node xong, ${r.failed.length} lỗi · tổng ${formatDuration(finishedAt - startedAt)}`);
  await recordRun({
    id: uid('run'), projectId, startedAt, finishedAt, trigger: mode,
    result: r.failed.length ? 'failed' : r.stopped ? 'stopped' : 'success',
    nodes: [...engine.records.entries()].map(([nodeId, rec]) => { const n = findNode(graph, nodeId); return { nodeId, type: n?.type || '', label: n ? NODE_DEFS[n.type].label : nodeId, status: rec.status, durationMs: rec.durationMs, attempts: rec.attempts, error: rec.error || '' }; }),
    aiCalls: runRealCalls,
    aiCostPollen: Math.round(runRealCalls.reduce((s, c) => s + (c.costPollen || 0), 0) * 1e6) / 1e6,
  });
  renderAll();
  return r;
}

// ---------- P2 panels: run history / versions / storage / recovery ----------
const esc = (s) => String(s ?? '').replace(/</g, '&lt;');
async function renderHistory() {
  const box = $('#ais-history-list'); if (!box) return;
  const runs = (await store.listRuns(projectId)).sort((a, b) => b.startedAt - a.startedAt);
  if (!runs.length) { box.innerHTML = '<p class="hint light">Chưa có lượt chạy nào được ghi cho dự án này.</p>'; return; }
  box.innerHTML = runs.map(r => {
    const total = r.finishedAt - r.startedAt;
    const cached = r.nodes.filter(n => n.status === 'cached').length;
    return `<details class="ais-run-item"><summary><span class="badge ${r.result}">${r.result === 'success' ? 'Thành công' : r.result === 'stopped' ? 'Đã dừng' : 'Có lỗi'}</span>
    ${new Date(r.startedAt).toLocaleString('vi-VN')} — ${esc(TRIGGER_LABELS[r.trigger] || r.trigger)} · ${r.nodes.length} node (${cached} đệm) · ${formatDuration(total)}${r.aiCalls?.length ? ` · AI thật: ${r.aiCalls.length} lệnh (${esc(r.aiCalls.map(c => c.provider + '/' + c.model).join(', '))}) · ~${r.aiCostPollen || 0} Pollen` : ''}</summary>
    <table class="ais-run-nodes"><tr><th>Node</th><th>Trạng thái</th><th>Thời gian</th><th>Lần thử</th><th>Lỗi</th></tr>
    ${r.nodes.map(n => `<tr><td>${esc(n.label)}</td><td>${n.status === 'cached' ? '<span class="st-cached-t">cached (đệm)</span>' : esc(n.status)}</td><td>${formatDuration(n.durationMs)}</td><td>${n.attempts || 1}</td><td>${esc(n.error || '')}</td></tr>`).join('')}</table></details>`;
  }).join('');
}
async function renderVersions() {
  const box = $('#ais-versions-list'); if (!box) return;
  const versions = (await store.listVersions(projectId)).sort((a, b) => b.createdAt - a.createdAt);
  if (!versions.length) { box.innerHTML = '<p class="hint light">Chưa có phiên bản nào. Bấm Lưu để tạo phiên bản đầu tiên.</p>'; return; }
  box.innerHTML = versions.map(v => `<div class="ais-ver-item"><span>🕘 ${new Date(v.createdAt).toLocaleString('vi-VN')} — ${esc(v.note || 'Lưu')} · ${v.graph.nodes.length} node</span><button data-restore-version="${v.id}">Khôi phục phiên bản này</button></div>`).join('');
  box.querySelectorAll('[data-restore-version]').forEach(b => b.addEventListener('click', async () => {
    const v = (await store.listVersions(projectId)).find(x => x.id === b.dataset.restoreVersion); if (!v) return;
    if (!confirm('Khôi phục phiên bản ' + new Date(v.createdAt).toLocaleString('vi-VN') + '? Trạng thái hiện tại sẽ được thay bằng phiên bản này (việc khôi phục cũng được ghi thành 1 phiên bản mới).')) return;
    graph = { nodes: v.graph.nodes.map(n => ({ ...n, status: 'idle', logs: [], error: '' })), edges: v.graph.edges, meta: v.graph.meta || null }; graph = await adoptLoadedGraph(graph);
    $('#ais-project-name').value = v.name || $('#ais-project-name').value;
    outputs = new Map(); selectedId = null; selectedEdgeId = null; history = []; historyIdx = -1; pushHistory(); renderAll();
    await saveProjectNow({ version: true, note: 'Khôi phục từ phiên bản ' + new Date(v.createdAt).toLocaleString('vi-VN') });
    message('Đã khôi phục phiên bản ' + new Date(v.createdAt).toLocaleString('vi-VN') + ' và ghi lại thành phiên bản mới.');
  }));
}
const fmtMB = (b) => (b / 1048576).toFixed(2) + ' MB';
async function renderStoragePanel() {
  const box = $('#ais-storage-panel'); if (!box) return;
  const [est, projects, assets, versions, runs, cache] = await Promise.all([storageEstimate(), store.listProjects(), store.listAssets(), store.listVersions(), store.listRuns(), store.listCache()]);
  const drafts = await store.listDrafts();
  const blobSize = (a) => a?.blob?.size || 0;
  const assetBytes = assets.reduce((s, a) => s + blobSize(a), 0);
  const cacheBytes = cache.reduce((s, c) => s + blobSize(c), 0);
  const runsBytes = runs.reduce((s, r) => s + JSON.stringify(r).length, 0);
  const versionsBytes = versions.reduce((s, v) => s + JSON.stringify(v).length, 0);
  const keep = collectReferencedAssetIds({ projects, versions, drafts });
  const orphans = findOrphanAssets(assets, keep);
  const orphanBytes = orphans.reduce((s, a) => s + blobSize(a), 0);
  const quotaPct = est.quota ? Math.round(est.usage / est.quota * 100) : 0;
  const perProject = projects.map(p => {
    const pAssets = assets.filter(a => [...collectReferencedAssetIds({ projects: [p] })].includes(a.id));
    const size = JSON.stringify(p).length + pAssets.reduce((s, a) => s + blobSize(a), 0);
    return { name: p.name, nodes: p.graph?.nodes?.length || 0, size, runs: runs.filter(r => r.projectId === p.id).length, versions: versions.filter(v => v.projectId === p.id).length };
  }).sort((a, b) => b.size - a.size);
  box.innerHTML = `
    ${est.quota && quotaPct >= 80 ? `<p class="ais-quota-warn">⚠ Dung lượng trình duyệt đã dùng ${quotaPct}% hạn mức — hãy dọn dẹp file rác hoặc xóa dự án cũ.</p>` : ''}
    <table class="ais-store-table">
      <tr><th>Hạng mục</th><th>Số lượng</th><th>Dung lượng</th></tr>
      <tr><td>Toàn bộ trình duyệt (ước tính${est.quota ? ', đã dùng ' + quotaPct + '% hạn mức' : ''})</td><td>—</td><td>${fmtMB(est.usage)}${est.quota ? ' / ' + fmtMB(est.quota) : ''}</td></tr>
      <tr><td>File tài sản (assets)</td><td>${assets.length} file</td><td>${fmtMB(assetBytes)}</td></tr>
      <tr><td>Bộ nhớ đệm kết quả node (cache)</td><td>${cache.length} mục</td><td>${fmtMB(cacheBytes)}</td></tr>
      <tr><td>Lịch sử chạy (mọi dự án)</td><td>${runs.length} lượt</td><td>${fmtMB(runsBytes)}</td></tr>
      <tr><td>Phiên bản dự án (mọi dự án)</td><td>${versions.length} bản</td><td>${fmtMB(versionsBytes)}</td></tr>
      <tr><td>File rác (không dự án/phiên bản/nháp nào tham chiếu)</td><td>${orphans.length} file</td><td>${fmtMB(orphanBytes)}</td></tr>
    </table>
    <h4 style="margin:10px 0 4px">Theo dự án</h4>
    ${perProject.map(p => `<div class="ais-store-row"><span>${esc(p.name)} — ${p.nodes} node · ${p.runs} lượt chạy · ${p.versions} phiên bản · ~${fmtMB(p.size)}</span></div>`).join('') || '<p class="hint light">Chưa có dự án nào được lưu.</p>'}
    <div class="ais-pane-tools" style="margin-top:8px">
      <button id="ais-gc">🧹 Dọn dẹp file rác (${orphans.length} file, ${fmtMB(orphanBytes)})</button>
      <button id="ais-clear-cache">Xóa bộ nhớ đệm kết quả</button>
      <span class="hint light" id="ais-gc-result"></span>
    </div>`;
  box.querySelector('#ais-gc')?.addEventListener('click', async () => {
    const [ps, vs, ds, as] = await Promise.all([store.listProjects(), store.listVersions(), store.listDrafts(), store.listAssets()]);
    const orph = findOrphanAssets(as, collectReferencedAssetIds({ projects: ps, versions: vs, drafts: ds }));
    let freed = 0; for (const a of orph) { freed += a?.blob?.size || 0; await store.deleteAsset(a.id); }
    await renderStoragePanel(); await refreshStorage();
    const el = $('#ais-gc-result'); if (el) el.textContent = `Đã xóa ${orph.length} file rác, giải phóng ${fmtMB(freed)}.`;
    message(`Dọn dẹp xong: đã xóa ${orph.length} file rác, giải phóng ${fmtMB(freed)}.`);
  });
  box.querySelector('#ais-clear-cache')?.addEventListener('click', async () => { await store.clearCache(); await renderStoragePanel(); message('Đã xóa toàn bộ bộ nhớ đệm kết quả node. Lần chạy tới mọi node sẽ chạy thật lại.'); });
}
let pendingDraft = null;
async function checkRecovery() {
  const drafts = (await store.listDrafts()).sort((a, b) => b.updatedAt - a.updatedAt);
  for (const d of drafts) {
    const p = await store.getProject(d.projectId);
    if (!p || d.updatedAt > (p.updatedAt || 0)) {
      pendingDraft = d;
      $('#ais-recovery-text').textContent = `Có bản nháp chưa lưu của dự án "${d.name}" (${new Date(d.updatedAt).toLocaleString('vi-VN')}) — có thể do trình duyệt đóng giữa chừng. Khôi phục?`;
      $('#ais-recovery').hidden = false;
      return;
    }
  }
}

// ---------- canvas interactions ----------
const viewport = $('#ais-canvas');
const pointers = new Map(); let drag = null; // {kind:'node'|'pan'|'connect'|'pinch', ...}
const toWorld = (cx, cy) => { const r = viewport.getBoundingClientRect(); return { x: (cx - r.left - view.x) / view.k, y: (cy - r.top - view.y) / view.k }; };
viewport.addEventListener('pointerdown', (e) => {
  viewport.setPointerCapture(e.pointerId); pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pointers.size === 2) { const [a, b] = [...pointers.values()]; drag = { kind: 'pinch', d: Math.hypot(a.x - b.x, a.y - b.y), k: view.k }; return; }
  const portEl = e.target.closest('.ais-port'); const nodeEl = e.target.closest('.ais-node');
  if (portEl && nodeEl) {
    const node = findNode(graph, nodeEl.dataset.nodeId); const w = toWorld(e.clientX, e.clientY);
    if (portEl.classList.contains('out')) drag = { kind: 'connect', fromId: node.id, fromPos: portPos(node, 'out') };
    else drag = { kind: 'connect-rev', toId: node.id, toPort: portEl.dataset.port, fromPos: { x: w.x, y: w.y } };
    return;
  }
  if (e.target.closest('.ais-edge')) { selectedEdgeId = e.target.dataset.edgeId; selectedId = null; renderAll(); return; }
  if (nodeEl) { const node = findNode(graph, nodeEl.dataset.nodeId); selectedId = node.id; selectedEdgeId = null; const w = toWorld(e.clientX, e.clientY); drag = { kind: 'node', id: node.id, dx: w.x - node.x, dy: w.y - node.y, moved: false }; renderAll(); return; }
  selectedId = null; selectedEdgeId = null; drag = { kind: 'pan', sx: e.clientX - view.x, sy: e.clientY - view.y }; renderAll();
});
viewport.addEventListener('pointermove', (e) => {
  if (!pointers.has(e.pointerId)) return; pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (!drag) return; const w = toWorld(e.clientX, e.clientY);
  if (drag.kind === 'pinch' && pointers.size === 2) { const [a, b] = [...pointers.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y); view.k = Math.min(2.5, Math.max(0.25, drag.k * d / drag.d)); applyView(); return; }
  if (drag.kind === 'pan') { view.x = e.clientX - drag.sx; view.y = e.clientY - drag.sy; applyView(); return; }
  if (drag.kind === 'node') { const node = findNode(graph, drag.id); node.x = Math.round(w.x - drag.dx); node.y = Math.round(w.y - drag.dy); drag.moved = true; const el = world.querySelector(`[data-node-id="${node.id}"]`); if (el) { el.style.left = node.x + 'px'; el.style.top = node.y + 'px'; } renderEdges(); return; }
  if (drag.kind === 'connect') { tempLine = { from: drag.fromPos, to: w }; renderEdges(); return; }
  if (drag.kind === 'connect-rev') { tempLine = { from: w, to: drag.fromPos }; renderEdges(); return; }
});
function endPointer(e) {
  pointers.delete(e.pointerId);
  if (!drag) return;
  if (drag.kind === 'connect' || drag.kind === 'connect-rev') {
    const el = document.elementFromPoint(e.clientX, e.clientY)?.closest('.ais-port'); const nodeEl = document.elementFromPoint(e.clientX, e.clientY)?.closest('.ais-node');
    tempLine = null;
    if (el && nodeEl) {
      let fromId, toId, toPort;
      if (drag.kind === 'connect' && el.classList.contains('in')) { fromId = drag.fromId; toId = nodeEl.dataset.nodeId; toPort = el.dataset.port; }
      if (drag.kind === 'connect-rev' && el.classList.contains('out')) { fromId = nodeEl.dataset.nodeId; toId = drag.toId; toPort = drag.toPort; }
      if (fromId) { const v = validateConnection(graph, fromId, toId, toPort); if (v.ok) { graph.edges.push({ id: uid('edge'), from: fromId, to: toId, toPort }); pushHistory(); scheduleSave(); message('Đã nối dây.'); } else message(v.reason, true); }
    }
    renderEdges();
  }
  if (drag.kind === 'node' && drag.moved) { pushHistory(); scheduleSave(); }
  drag = null;
}
viewport.addEventListener('pointerup', endPointer); viewport.addEventListener('pointercancel', endPointer);
viewport.addEventListener('wheel', (e) => { e.preventDefault(); const f = e.deltaY < 0 ? 1.1 : 0.9; const r = viewport.getBoundingClientRect(); const mx = e.clientX - r.left, my = e.clientY - r.top; const k2 = Math.min(2.5, Math.max(0.25, view.k * f)); view.x = mx - (mx - view.x) * (k2 / view.k); view.y = my - (my - view.y) * (k2 / view.k); view.k = k2; applyView(); }, { passive: false });
function fitView() { if (!graph.nodes.length) { view = { x: 40, y: 30, k: 0.9 }; applyView(); return; } const r = viewport.getBoundingClientRect(); const minX = Math.min(...graph.nodes.map(n => n.x)), minY = Math.min(...graph.nodes.map(n => n.y)), maxX = Math.max(...graph.nodes.map(n => n.x + 220)), maxY = Math.max(...graph.nodes.map(n => n.y + 150)); const k = Math.min(1.2, Math.min((r.width - 32) / (maxX - minX), (r.height - 32) / (maxY - minY))); view.k = Math.max(0.2, k); view.x = 16 - minX * view.k; view.y = 16 - minY * view.k; applyView(); }

// ---------- toolbar wiring ----------
$('#ais-node-library').innerHTML = NODE_TYPES.map(t => `<button data-add-node="${t}"><span style="background:${NODE_DEFS[t].color}"></span>${NODE_DEFS[t].label}</button>`).join('');
$('#ais-node-library').addEventListener('click', (e) => { const b = e.target.closest('[data-add-node]'); if (!b) return; const n = makeNode(b.dataset.addNode, 90 - view.x / view.k + graph.nodes.length * 14 % 160, 70 - view.y / view.k + graph.nodes.length * 12 % 120); graph.nodes.push(n); selectedId = n.id; pushHistory(); renderAll(); scheduleSave(); $('#ais-library').classList.remove('open'); });
$('#ais-templates').innerHTML = TEMPLATES.map(t => `<button data-template="${t.id}">${t.name}</button>`).join('');
$('#ais-templates').addEventListener('click', (e) => { const b = e.target.closest('[data-template]'); if (!b) return; const t = TEMPLATES.find(x => x.id === b.dataset.template); graph = t.make(); outputs = new Map(); selectedId = null; pushHistory(); renderAll(); scheduleSave(); fitView(); message('Đã tải ' + t.name + '. Bấm "Chạy workflow" để chạy ở chế độ DEMO.'); });
$('#ais-run').addEventListener('click', () => runNodes('all'));
$('#ais-stop').addEventListener('click', () => { engine?.stop(); message('Đã yêu cầu dừng — workflow sẽ dừng giữa các node.'); });
$('#ais-undo').addEventListener('click', () => { if (historyIdx > 0) { historyIdx--; restore(history[historyIdx]); updateUndoBtns(); } });
$('#ais-redo').addEventListener('click', () => { if (historyIdx < history.length - 1) { historyIdx++; restore(history[historyIdx]); updateUndoBtns(); } });
$('#ais-zoom-in').addEventListener('click', () => { view.k = Math.min(2.5, view.k * 1.2); applyView(); });
$('#ais-zoom-out').addEventListener('click', () => { view.k = Math.max(0.25, view.k / 1.2); applyView(); });
$('#ais-fit').addEventListener('click', fitView);
$('#ais-delete-edge').addEventListener('click', () => { if (!selectedEdgeId) return message('Hãy bấm vào một đường dây trên canvas trước.', true); graph.edges = graph.edges.filter(e => e.id !== selectedEdgeId); selectedEdgeId = null; pushHistory(); renderAll(); scheduleSave(); });
document.addEventListener('keydown', (e) => { if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) { graph.nodes = graph.nodes.filter(n => n.id !== selectedId); graph.edges = graph.edges.filter(x => x.from !== selectedId && x.to !== selectedId); selectedId = null; pushHistory(); renderAll(); scheduleSave(); } });
$('#ais-save').addEventListener('click', () => saveProjectNow({ version: true, note: 'Lưu thủ công' }).then(() => message('Đã lưu dự án vào IndexedDB và tạo 1 phiên bản mới.')));
$('#ais-new').addEventListener('click', async () => { if (!confirm('Tạo dự án mới? Thay đổi chưa bấm Lưu của dự án hiện tại vẫn còn trong bản nháp và sẽ được đề nghị khôi phục.')) return; projectId = uid('project'); $('#ais-project-name').value = 'Dự án mới'; graph = emptyGraph(); outputs = new Map(); lastFailedNodeId = null; updateResumeBtn(); history = []; historyIdx = -1; pushHistory(); renderAll(); scheduleSave(); await renderHistory(); await renderVersions(); });
$('#ais-project-select').addEventListener('change', (e) => { if (e.target.value) openProject(e.target.value); });
$('#ais-project-name').addEventListener('change', scheduleSave);
$('#ais-duplicate').addEventListener('click', async () => { await saveProjectNow(); const p = await store.getProject(projectId); const copy = { ...p, id: uid('project'), name: p.name + ' (bản sao)', updatedAt: Date.now() }; await store.saveProject(copy); projectId = copy.id; $('#ais-project-name').value = copy.name; await refreshProjectList(); message('Đã nhân bản dự án.'); });
$('#ais-delete-project').addEventListener('click', async () => { if (!confirm('Xóa dự án hiện tại khỏi IndexedDB (kèm lịch sử chạy, phiên bản và bộ nhớ đệm của dự án)? Không thể hoàn tác.')) return; await store.deleteProjectCascade(projectId); projectId = uid('project'); $('#ais-project-name').value = 'Dự án mới'; graph = emptyGraph(); outputs = new Map(); lastFailedNodeId = null; updateResumeBtn(); pushHistory(); renderAll(); await refreshProjectList(); await renderHistory(); await renderVersions(); await renderStoragePanel(); message('Đã xóa dự án.'); });
$('#ais-resume').addEventListener('click', () => { if (lastFailedNodeId) runNodes('resume', lastFailedNodeId); });
$('#ais-clear-history').addEventListener('click', async () => { if (!confirm('Xóa toàn bộ lịch sử chạy của dự án hiện tại?')) return; await store.clearRuns(projectId); await renderHistory(); await renderStoragePanel(); message('Đã xóa lịch sử chạy của dự án.'); });
document.querySelectorAll('.ais-tabs [data-tab]').forEach(b => b.addEventListener('click', () => {
  document.querySelectorAll('.ais-tabs [data-tab]').forEach(x => x.classList.toggle('active', x === b));
  for (const name of ['log', 'history', 'versions', 'storage']) { const pane = $('#ais-pane-' + name); if (pane) pane.hidden = name !== b.dataset.tab; }
  if (b.dataset.tab === 'history') renderHistory();
  if (b.dataset.tab === 'versions') renderVersions();
  if (b.dataset.tab === 'storage') renderStoragePanel();
}));
$('#ais-recovery-restore').addEventListener('click', async () => {
  if (!pendingDraft) return;
  projectId = pendingDraft.projectId; $('#ais-project-name').value = pendingDraft.name;
  graph = { nodes: pendingDraft.graph.nodes.map(n => ({ ...n, status: 'idle', logs: [], error: '' })), edges: pendingDraft.graph.edges, meta: pendingDraft.graph.meta || null }; graph = await adoptLoadedGraph(graph);
  outputs = new Map(); selectedId = null; history = []; historyIdx = -1; pushHistory(); renderAll();
  $('#ais-recovery').hidden = true; const d = pendingDraft; pendingDraft = null;
  await refreshProjectList(); await renderHistory(); await renderVersions();
  message('Đã khôi phục bản nháp chưa lưu của "' + d.name + '". Bấm Lưu để biến thành bản chính thức + phiên bản.');
});
$('#ais-recovery-discard').addEventListener('click', async () => { if (pendingDraft) await store.deleteDraft(pendingDraft.projectId); pendingDraft = null; $('#ais-recovery').hidden = true; message('Đã bỏ qua bản nháp chưa lưu.'); });
$('#ais-export-zip-btn').addEventListener('click', exportZip);
$('#ais-export-workflow-btn').addEventListener('click', () => { saveBlob(new Blob([JSON.stringify({ app: 'AO IN STUDIO — AI CREATIVE WORKFLOW', version: 1, name: $('#ais-project-name').value, graph: JSON.parse(snapshot()) }, null, 2)], { type: 'application/json' }), 'workflow.json'); message('Đã xuất workflow.json (chỉ cấu trúc, không kèm ảnh, không API key).'); });
$('#ais-import').addEventListener('change', (e) => { if (e.target.files[0]) importFile(e.target.files[0]); });
$('#ais-toggle-library').addEventListener('click', () => $('#ais-library').classList.toggle('open'));
$('#ais-toggle-props').addEventListener('click', () => { selectedId = null; selectedEdgeId = null; propsForcedOpen = !propsForcedOpen; renderAll(); });
$('#ais-run-mobile')?.addEventListener('click', () => runNodes('all'));

// ---------- init ----------
(async function init() {
  pushHistory(); renderAll(); await refreshProjectList(); await refreshStorage();
  const list = (await store.listProjects()).sort((a, b) => b.updatedAt - a.updatedAt);
  if (list.length) await openProject(list[0].id);
  await renderHistory(); await renderVersions(); await renderStoragePanel();
  await checkRecovery();
  updateModeBadge();
  document.body.dataset.ready = 'true'; document.documentElement.dataset.ready = 'true';
  logLine('AI Studio P4.2 sẵn sàng: vùng in hiệu chuẩn theo mốc thân áo (giữa ngực trên, cách mép dưới cổ 12–15% chiều dài thân áo, rộng 35–45% bề ngang thân), khung đứt nét CHỈ còn trong trình căn chỉnh (không dính vào Xem trước/file xuất), hòa trộn mực theo bóng vải + độ phủ mực 95%. DEMO dùng ẢNH NGƯỜI MẪU DO AI TẠO đã được chủ shop duyệt cho áo trắng/đen cổ tròn và áo trắng oversize (nhãn node ghi rõ "do AI tạo", không phải ảnh chụp thật); thông số chưa có ảnh người mẫu thì dùng hình vẽ DEMO. Nếu ảnh AI sai kiểu/màu, chuyển node Ghép hình sang nguồn "Ảnh mẫu thật". AI thật qua Pollinations (P4) sau công tắc "Chế độ AI thật" — mặc định TẮT, đang ở DEMO.');
})();
