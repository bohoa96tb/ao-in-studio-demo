// AI Studio Template 1 browser suite — P4.1 flow (generate the PLAIN garment
// first, composite the ORIGINAL design afterwards) with the P4.2 fixes and
// the ROUND-4 stack asserted at pixel level:
//
// ROUND 4 (owner approval 2026-11-14 + urgent additions R1–R4):
//   * DEMO model layer = the three owner-approved AI-GENERATED model
//     images (AI_MODEL_BASES): white crew (female), black crew (MALE —
//     approved as-is), white oversize (female, genuinely wide fit).
//     They are AI-generated images, labelled as such in the app, and are
//     NEVER presented as photographs; the real-photo registry still has
//     no model base (photoBaseFor null — rounds 1–3 history in git).
//   * Print placement follows the TORSO RULE (owner, round 3): gap from
//     the collar's LOWER edge to the print's TOP = 12–15% of TOTAL TORSO
//     LENGTH (collar → hem in the image); print width = 35–45% of torso
//     width; centred on the torso centre. Landmarks are PER-IMAGE,
//     grid-measured, imported from src (AI_MODEL_LANDMARKS) — the suite
//     measures the composited design's colour bbox against them.
//   * Guide: the dashed red guide colour appears NOWHERE near the quad
//     border in the Preview output or the exported PNG (editor only) —
//     the regression the owner demanded after the live P4.1 screenshot.
//   * R1: a FRESH Template 1 instance (CASE 8) runs correctly with zero
//     manual edits — the shipped template defaults to this stack.
//   * R2 (CASE 7): a mocked Classic real-AI response with a SQUARE
//     close-up image must trigger the composition framing fallback —
//     zero composites onto the bad image; the approved AI base is used
//     and the fallback is recorded in the result label.
//   * R3 (CASE 8): the fresh run's exports are saved to
//     ~/workspace/p42-results/fresh-{white,black,oversize}.png; the
//     standard cases save white-crew.png / black-crew.png / oversize.png.
//   * R4 (CASE 9): a seeded OLD Template 1 draft (marker v1, no catalog
//     flag, retired realBase, stale quad, plus a stale cache record) is
//     refreshed on load — note shown, project cache purged — and then
//     runs on the new stack.
// No real Pollinations traffic: DEMO makes no external requests; the
// real-mode cases reuse the P4 suite's mocked-route pattern.
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { DEMO_FIGURE, AI_MODEL_BASES } from '../src/ai-studio/core.js';
import { GARMENT_QUADS, FIXTURE_LANDMARKS, AI_MODEL_LANDMARKS, AI_MODEL_QUADS, fitInto } from '../src/ai-studio/warp.js';

const MULTI_SVG = readFileSync(new URL('./fixtures/design-multicolor.svg', import.meta.url), 'utf8');
const RESULTS_DIR = fileURLToPath(new URL('../../p42-results/', import.meta.url));
mkdirSync(RESULTS_DIR, { recursive: true });

const BASE = process.env.TEST_URL || 'http://127.0.0.1:5264';
const results = [];
function fail(m) { console.error('FAIL:', m); process.exit(1); }

// Landmarks + quads come from the source registries themselves so this
// suite can never drift from the geometry the app actually uses.
const AI_WHITE = 'public/fixtures/ai-model/model-white-crew.webp';
const AI_BLACK = 'public/fixtures/ai-model/model-black-crew.webp';
const AI_OVER = 'public/fixtures/ai-model/model-white-oversize.webp';
const WHITE_LM = AI_MODEL_LANDMARKS[AI_WHITE], WHITE_QUAD = AI_MODEL_QUADS[AI_WHITE];
const BLACK_LM = AI_MODEL_LANDMARKS[AI_BLACK], BLACK_QUAD = AI_MODEL_QUADS[AI_BLACK];
const OVER_LM = AI_MODEL_LANDMARKS[AI_OVER], OVER_QUAD = AI_MODEL_QUADS[AI_OVER];
const FIG_LM = DEMO_FIGURE.landmarks.regular, FIG_QUAD = DEMO_FIGURE.chestQuad;
const HANGER_PATH = 'public/fixtures/real-tee/crew-white-hanger.webp';
const HANGER_LM = FIXTURE_LANDMARKS[HANGER_PATH], HANGER_QUAD = GARMENT_QUADS[HANGER_PATH];
const GUIDE_RGB = [182, 73, 47]; // the editor guide's dashed red (editor only!)

/** Map a relative quad from the composition output (srcW×srcH) into the
 * website channel export (1200×1500, cover fit) — the crop shifts it. */
function exportQuad(quad, srcW, srcH) {
  const f = fitInto(srcW, srcH, 1200, 1500, 'cover');
  return quad.map(([rx, ry]) => [(rx * srcW - f.sx) / f.sw, (ry * srcH - f.sy) / f.sh]);
}

let browser;
try { browser = await chromium.launch(); }
catch { browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium' }); }

async function newPage(width) {
  const ctx = await browser.newContext({ viewport: { width, height: width >= 1000 ? 950 : 844 }, acceptDownloads: true });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', e => errors.push(String(e)));
  p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await p.goto(BASE + '/studio.html?v=aistudio42', { waitUntil: 'domcontentloaded' });
  await p.waitForSelector('body[data-ready="true"]', { timeout: 30000 });
  return { ctx, p, errors };
}
const nodeByTitle = (p, t) => p.locator('.ais-node').filter({ has: p.locator('header strong:text-is("' + t + '")') }).first();
async function nodeClass(p, t) { return (await nodeByTitle(p, t).getAttribute('class')) || ''; }
async function nodeCanvas(p, t) {
  // Node outputs render as <img class="nthumb"> thumbnails (or a canvas);
  // decode whichever is present at full resolution inside the page.
  // STABILITY WAIT (P4.2 supplementary): under CPU load a just-swapped
  // blob <img> can briefly report complete with the PREVIOUS run's image
  // still attached — only read once the src is unchanged across two
  // checks 150ms apart and the image is fully decoded.
  return p.evaluate(async (title) => {
    const findEl = () => [...document.querySelectorAll('.ais-node')].find(e => e.querySelector('header strong')?.textContent === title);
    const read = (cv) => { const x = cv.getContext('2d'); const d = x.getImageData(0, 0, cv.width, cv.height).data; return { w: cv.width, h: cv.height, data: Array.from(d) }; };
    let el = findEl();
    if (!el) return null;
    const cv = el.querySelector('canvas');
    if (cv && cv.width > 0) return read(cv);
    let lastSrc = null;
    for (let tries = 0; tries < 24; tries++) {
      el = findEl(); if (!el) return null;
      const img = el.querySelector('img.nthumb');
      if (!img || !img.src) { lastSrc = null; await new Promise(r => setTimeout(r, 150)); continue; }
      if (img.src !== lastSrc) { lastSrc = img.src; await img.decode().catch(() => {}); await new Promise(r => setTimeout(r, 150)); continue; }
      if (!img.complete || !img.naturalWidth) { await img.decode().catch(() => {}); await new Promise(r => setTimeout(r, 150)); continue; }
      const c2 = document.createElement('canvas'); c2.width = img.naturalWidth || 600; c2.height = img.naturalHeight || 600;
      c2.getContext('2d').drawImage(img, 0, 0, c2.width, c2.height);
      return read(c2);
    }
    return null;
  }, t);
}
/** Save a node's current output image (natural size) as a PNG file —
 * used for the owner-facing result images (R3 + standard previews). */
async function saveNodeImage(p, title, file) {
  const dataUrl = await p.evaluate(async (t) => {
    const el = [...document.querySelectorAll('.ais-node')].find(e => e.querySelector('header strong')?.textContent === t);
    const img = el?.querySelector('img.nthumb'); if (!img) return null;
    await img.decode().catch(() => {});
    const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
    c.getContext('2d').drawImage(img, 0, 0);
    return c.toDataURL('image/png');
  }, title);
  if (!dataUrl) fail('saveNodeImage: no output image on node ' + title);
  writeFileSync(file, Buffer.from(dataUrl.split(',')[1], 'base64'));
}
function pxReader(img) { const { w, data } = img; return (rx, ry) => { const xi = Math.min(w - 1, Math.max(0, Math.round(rx * w))), yi = Math.min(img.h - 1, Math.max(0, Math.round(ry * img.h))); const i = (yi * w + xi) * 4; return [data[i], data[i + 1], data[i + 2], data[i + 3]]; }; }
const near = (a, b, t) => Math.abs(a[0] - b[0]) <= t && Math.abs(a[1] - b[1]) <= t && Math.abs(a[2] - b[2]) <= t;
function inQuad(rx, ry, q) { // axis-aligned quads in this suite
  return rx >= Math.min(q[0][0], q[3][0]) && rx <= Math.max(q[1][0], q[2][0]) && ry >= q[0][1] && ry <= q[2][1];
}
// The multicolour fixture's actual palette (tests/fixtures/design-multicolor.svg).
const DESIGN_COLORS = [[229, 57, 53], [242, 183, 5], [31, 170, 77], [36, 86, 224], [122, 63, 209]];
const totalOf = (counts) => counts.reduce((a, b) => a + b, 0);
function analyse(img, quad, baseImg = null) {
  // Leak = a design colour OUTSIDE the quad that the compositing introduced:
  // when the base image is known, a pixel only counts as leaked if the base
  // did not already carry that colour there (real photos contain lipstick /
  // skin tones that can sit within tolerance of a design colour — those are
  // the photo, not leaked print). A ±0.6% border band around the quad is
  // ignored entirely: anti-aliased edge pixels land exactly on the border.
  // The bbox tracks the design colours' full extent (x AND y) so the
  // torso-rule ratios can be measured from it.
  const px = pxReader(img); const pb = baseImg ? pxReader(baseImg) : null;
  const counts = DESIGN_COLORS.map(() => 0); let leak = 0; const leakPts = []; const total = [0, 0];
  const BAND = 0.006;
  const inBand = (rx, ry) => rx >= quad[0][0] - BAND && rx <= quad[1][0] + BAND && ry >= quad[0][1] - BAND && ry <= quad[2][1] + BAND;
  let minY = 1, maxY = 0, minX = 1, maxX = 0, n = 0;
  for (let y = 2; y < img.h - 2; y += 3) for (let x = 2; x < img.w - 2; x += 3) {
    const rx = x / img.w, ry = y / img.h; const c = px(rx, ry); const inside = inQuad(rx, ry, quad);
    if (!inside && inBand(rx, ry)) continue;
    DESIGN_COLORS.forEach((dc, i) => {
      if (!near(c, dc, 46)) return;
      if (inside) { counts[i]++; if (ry < minY) minY = ry; if (ry > maxY) maxY = ry; if (rx < minX) minX = rx; if (rx > maxX) maxX = rx; n++; }
      else if (!pb || (!near(pb(rx, ry), dc, 46) && !near(c, pb(rx, ry), 46))) { leak++; if (leakPts.length < 8) leakPts.push([+rx.toFixed(3), +ry.toFixed(3), i]); }
    });
    total[inside ? 0 : 1]++;
  }
  return { counts, leak, leakPts, bbox: n ? { top: minY, bottom: maxY, centre: (minY + maxY) / 2, left: minX, right: maxX, centreX: (minX + maxX) / 2 } : null };
}
function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay; const L2 = dx * dx + dy * dy;
  let t = L2 ? ((px - ax) * dx + (py - ay) * dy) / L2 : 0; t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}
/** Guide regression scan: pixels within 3px of the quad border whose colour
 * matches the editor guide's dashed red (tol 26 — the design's own red
 * #e53935 is ~50 away, so it cannot false-positive). */
function guideScan(img, quad) {
  const px = pxReader(img); const corners = quad.map(([x, y]) => [x * img.w, y * img.h]);
  let hits = 0, scanned = 0;
  for (let y = 0; y < img.h; y += 2) for (let x = 0; x < img.w; x += 2) {
    let d = 1e9; for (let i = 0; i < 4; i++) { const [ax, ay] = corners[i], [bx, by] = corners[(i + 1) % 4]; d = Math.min(d, segDist(x, y, ax, ay, bx, by)); }
    if (d > 3) continue; scanned++;
    const c = px(x / img.w, y / img.h);
    if (Math.abs(c[0] - GUIDE_RGB[0]) <= 26 && Math.abs(c[1] - GUIDE_RGB[1]) <= 26 && Math.abs(c[2] - GUIDE_RGB[2]) <= 26) hits++;
  }
  return { hits, scanned };
}
function correlate(orig, comp, quad) {
  // Sample the ORIGINAL design raster on a grid, map each sample into the
  // quad, and measure the fraction whose composited colour still matches
  // the original pixel (the blending may shade it; tolerance 115 as P4.1).
  const po = pxReader(orig), pc = pxReader(comp);
  const x0 = quad[0][0], x1 = quad[1][0], y0 = quad[0][1], y1 = quad[2][1];
  let tot = 0, ok = 0;
  for (let gy = 0; gy <= 24; gy++) for (let gx = 0; gx <= 24; gx++) {
    const u = gx / 24, v = gy / 24; const a = po(u, v); if (a[3] < 200) continue;
    const b = pc(x0 + (x1 - x0) * u, y0 + (y1 - y0) * v);
    tot++; const dist = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]); if (dist < 115) ok++;
  }
  return tot ? ok / tot : 0;
}
async function closeProps(p) { const c = p.locator('#ais-prop-close'); if (await c.isVisible().catch(() => false)) await c.click(); }
async function propSelect(p, nodeTitle, selId, value) {
  await nodeByTitle(p, nodeTitle).locator('header strong').click();
  await p.waitForSelector(selId, { timeout: 10000 });
  await p.selectOption(selId, value);
  // Under heavy host load a panel re-render can swallow the change; verify
  // the value stuck and re-apply once if not (test-infra hardening only —
  // the assertions below still judge the real outputs).
  const stuck = await p.evaluate((s) => document.querySelector(s)?.value, selId).catch(() => null);
  if (stuck !== value) { await p.selectOption(selId, value); }
  await p.waitForTimeout(250);
  await closeProps(p);
}
/** Inject the multicolour test design (5 colours incl. text) as the design
 * node's SVG — its artwork fills the ENTIRE raster, so the composited
 * colour bbox is the print area itself (what the torso-rule needs). */
async function setDesign(p, svg = MULTI_SVG) {
  await nodeByTitle(p, 'Hình in (thiết kế)').locator('header strong').click();
  await p.waitForSelector('#pf-svg', { timeout: 10000 });
  await p.evaluate((v) => { const el = document.querySelector('#pf-svg'); el.value = v; el.dispatchEvent(new Event('change', { bubbles: true })); }, svg);
  await p.waitForTimeout(250);
  await closeProps(p);
}
async function loadTpl1(p, svg = MULTI_SVG) {
  await p.click('[data-template="tpl1"]');
  await p.waitForFunction(() => document.querySelectorAll('.ais-node').length === 8);
  await setDesign(p, svg);
}
async function runAll(p, width, phase) {
  // Settle detection must not be fooled by the PREVIOUS run's final state:
  // poll until the preview is successful and nothing is running AND this
  // run was actually observed in flight.
  const prevText = await p.textContent('#ais-run-progress');
  await p.click(width < 700 ? '#ais-run-mobile' : '#ais-run');
  const deadline = Date.now() + 120000;
  let seenActive = false;
  for (;;) {
    const st = await p.evaluate((prev) => {
      const txt = document.getElementById('ais-run-progress')?.textContent || '';
      const nodes = [...document.querySelectorAll('.ais-node')];
      const t = nodes.find(e => e.querySelector('header strong')?.textContent === 'Xem trước');
      return {
        active: nodes.some(e => e.className.includes('st-running')) || txt.startsWith('Đang chạy'),
        changed: txt !== prev && txt.startsWith('Lượt chạy gần nhất'),
        settled: !!t && t.className.includes('st-success') && !nodes.some(e => e.className.includes('st-running')),
      };
    }, prevText);
    if (st.active) seenActive = true;
    if (st.settled && (seenActive || st.changed)) return;
    if (Date.now() > deadline) fail(phase + ': run did not settle with preview success');
    await p.waitForTimeout(300);
  }
}
async function expectSuccess(p, phase) {
  const errs = await p.evaluate(() => [...document.querySelectorAll('.ais-node.st-error')].map(e => (e.querySelector('header strong')?.textContent || '?') + ': ' + (e.querySelector('.nerr')?.textContent || '')));
  if (errs.length) fail(phase + ': error nodes after run: ' + errs.join(' | '));
  for (const t of ['Ghép hình in lên áo', 'Xem trước', 'Xuất file']) {
    if (!/st-success/.test(await nodeClass(p, t))) fail(phase + ': node not success: ' + t);
  }
}
/** DEMO banner check: the exported PNG must carry the DEMO banner at the
 * very top — a dark strip spanning the width with light (peach) text
 * pixels inside it. Pixel-level, not a screenshot guess. */
function bannerCheck(img, phase) {
  const px = pxReader(img);
  const stripH = Math.round(img.h * 0.045);
  let stripRows = 0;
  for (let y = 1; y < stripH; y += 2) {
    let dark = 0, n = 0;
    for (let x = 0; x < img.w; x += 4) { const c = px(x / img.w, y / img.h); n++; if (c[0] < 90 && c[1] < 90 && c[2] < 90) dark++; }
    if (dark / n > 0.8) stripRows++;
  }
  if (stripRows < stripH / 4) fail(`${phase}: DEMO banner strip missing at the top of the export (only ${stripRows} dark rows)`);
  let textPx = 0;
  for (let y = 1; y < stripH; y++) for (let x = 0; x < img.w; x += 2) {
    const c = px(x / img.w, y / img.h);
    if (c[0] > 200 && c[1] > 130 && c[1] < 215 && c[2] > 100 && c[2] < 180) textPx++;
  }
  if (textPx < 30) fail(`${phase}: DEMO banner text pixels missing at the top of the export (${textPx})`);
  return { stripRows, textPx };
}
/** TORSO RULE, measured on the composited design's colour bbox (the
 * multicolour design fills its raster, so bbox = print area):
 *   gapRatio   = (bbox.top − collarBottomY) / (hemY − collarBottomY)
 *   widthRatio = (bbox.right − bbox.left) / torsoWidth
 * must sit in the owner's bands [0.12, 0.15] / [0.35, 0.45], centred on
 * torsoCenterX. Tolerances: 3px sampling grid + fabric blending shrink
 * the detected bbox slightly — ±0.03 gap / ±0.045 width absorb that,
 * while any placement from the rejected geometries lands far outside. */
function torsoCheck(an, lm, phase) {
  if (!an.bbox) fail(phase + ': no design pixels found');
  const torsoLen = lm.hemY - lm.collarBottomY;
  const gap = (an.bbox.top - lm.collarBottomY) / torsoLen;
  const wr = (an.bbox.right - an.bbox.left) / lm.torsoWidth;
  if (gap < 0.12 - 0.03 || gap > 0.15 + 0.03) fail(`${phase}: measured print gap ${gap.toFixed(3)} of torso length outside [0.12, 0.15] ± 0.03 — print rides to the neck or drops to the belly`);
  if (wr < 0.35 - 0.045 || wr > 0.45 + 0.045) fail(`${phase}: measured print width ${wr.toFixed(3)} of torso width outside [0.35, 0.45] ± 0.045`);
  if (Math.abs(an.bbox.centreX - lm.torsoCenterX) > 0.02) fail(`${phase}: print centre x ${an.bbox.centreX.toFixed(3)} off the torso centre ${lm.torsoCenterX}`);
  return { gapRatio: Number(gap.toFixed(3)), widthRatio: Number(wr.toFixed(3)), centreX: Number(an.bbox.centreX.toFixed(3)) };
}

// ================= CASE 1: white crew — DEMO = approved AI model base (female) =================
for (const width of [1366, 390]) {
  const { ctx, p, errors } = await newPage(width);
  await loadTpl1(p);
  await runAll(p, width, 'white@' + width);
  await expectSuccess(p, 'white@' + width);
  const gen = await nodeCanvas(p, 'Tạo ảnh AI (DEMO)');
  if (!gen || gen.w !== WHITE_LM.imgW || gen.h !== WHITE_LM.imgH) fail(`white@${width}: DEMO base must be the approved AI model image ${WHITE_LM.imgW}×${WHITE_LM.imgH}, got ${gen && gen.w + '×' + gen.h}`);
  const bodyText = await p.textContent('body');
  if (!/người mẫu do AI tạo/.test(bodyText || '')) fail(`white@${width}: honest AI-generated label missing (the base must be labelled AI-generated, never a photo)`);
  if (/người mẫu VẼ bằng canvas/.test(bodyText || '')) fail(`white@${width}: drawn figure label present — the AI base was not used`);
  const comp = await nodeCanvas(p, 'Ghép hình in lên áo');
  const an = analyse(comp, WHITE_QUAD, gen);
  if (totalOf(an.counts) < 800) fail(`white@${width}: design barely present inside the quad: ${an.counts}`);
  DESIGN_COLORS.forEach((dc, i) => { if (an.counts[i] < 20) fail(`white@${width}: design colour ${i} barely present: ${an.counts}`); });
  if (an.leak > 0) fail(`white@${width}: ${an.leak} design-colour samples leaked OUTSIDE the quad`);
  const measured = torsoCheck(an, WHITE_LM, 'white@' + width);
  const design = await nodeCanvas(p, 'Hình in (thiết kế)');
  const corr = correlate(design, comp, WHITE_QUAD);
  if (corr < 0.85) fail(`white@${width}: composited raster correlation vs original design ${corr.toFixed(3)} < 0.85 (blending must not destroy the original print)`);
  results.push({ case: 'white-crew', width, gen: `AI model base ${WHITE_LM.imgW}×${WHITE_LM.imgH} (AI-generated, owner-approved)`, counts: an.counts, leak: an.leak, measured, correlation: Number(corr.toFixed(3)) });
  if (width === 1366) {
    const expImg = await nodeCanvas(p, 'Xuất file');
    if (!expImg || expImg.w !== 1200 || expImg.h !== 1500) fail(`white export: website PNG must be 1200×1500, got ${expImg && expImg.w + '×' + expImg.h}`);
    const anE = analyse(expImg, exportQuad(WHITE_QUAD, comp.w, comp.h));
    if (totalOf(anE.counts) < 900) fail('white export: design missing from the exported PNG: ' + anE.counts);
    const banner = bannerCheck(expImg, 'white export');
    await saveNodeImage(p, 'Xuất file', RESULTS_DIR + 'white-crew.png');
    results.push({ case: 'white-export', dims: expImg.w + '×' + expImg.h, counts: anE.counts, banner, saved: 'white-crew.png' });
  }
  if (errors.length) fail('white@' + width + ': page errors: ' + errors.join(' | '));
  await ctx.close();
}

// ================= CASE 2: black crew — approved AI model base (MALE model) =================
{
  const { ctx, p, errors } = await newPage(1366);
  await loadTpl1(p);
  await propSelect(p, 'Trợ lý prompt (quy tắc)', '#pf-mauAo', 'den');
  await runAll(p, 1366, 'black');
  await expectSuccess(p, 'black');
  const gen = await nodeCanvas(p, 'Tạo ảnh AI (DEMO)');
  if (!gen || gen.w !== BLACK_LM.imgW || gen.h !== BLACK_LM.imgH) fail(`black: DEMO base must be the approved AI black-crew image ${BLACK_LM.imgW}×${BLACK_LM.imgH}, got ${gen && gen.w + '×' + gen.h}`);
  const bodyText = await p.textContent('body');
  if (!/người mẫu do AI tạo/.test(bodyText || '')) fail('black: honest AI-generated label missing');
  const comp = await nodeCanvas(p, 'Ghép hình in lên áo');
  const an = analyse(comp, BLACK_QUAD, gen);
  DESIGN_COLORS.forEach((dc, i) => { if (an.counts[i] < 10) fail(`black: design colour ${i} barely present inside the quad: ${an.counts}`); });
  if (an.leak > 0) fail('black: design leaked outside the quad: ' + an.leak);
  const measured = torsoCheck(an, BLACK_LM, 'black');
  const design = await nodeCanvas(p, 'Hình in (thiết kế)');
  const corr = correlate(design, comp, BLACK_QUAD);
  if (corr < 0.85) fail(`black: correlation vs original design ${corr.toFixed(3)} < 0.85`);
  const expImg = await nodeCanvas(p, 'Xuất file');
  if (!expImg || expImg.w !== 1200 || expImg.h !== 1500) fail(`black export: website PNG must be 1200×1500, got ${expImg && expImg.w + '×' + expImg.h}`);
  const banner = bannerCheck(expImg, 'black export');
  await saveNodeImage(p, 'Xuất file', RESULTS_DIR + 'black-crew.png');
  results.push({ case: 'black-crew', gen: `AI model base ${BLACK_LM.imgW}×${BLACK_LM.imgH} (AI-generated, MALE model — owner-approved)`, counts: an.counts, leak: an.leak, measured, correlation: Number(corr.toFixed(3)), banner, saved: 'black-crew.png' });
  if (errors.length) fail('black: page errors: ' + errors.join(' | '));
  await ctx.close();
}

// ================= CASE 3: white oversize — approved AI oversize base + figure fallback =================
// The oversize base is a genuinely wider AND longer garment (landmarks:
// torsoWidth 0.72 vs 0.49 crew, hem lower on a taller frame). This case
// proves the torso-rule placement on it, the larger print footprint vs
// the SAME suite's white-crew run, and — for an UNMAPPED combo (beige)
// — the honest drawn-figure fallback.
{
  const { ctx, p, errors } = await newPage(1366);
  await loadTpl1(p);
  await propSelect(p, 'Trợ lý prompt (quy tắc)', '#pf-kieuAo', 'oversize');
  await runAll(p, 1366, 'oversize');
  await expectSuccess(p, 'oversize');
  const genO = await nodeCanvas(p, 'Tạo ảnh AI (DEMO)');
  if (!genO || genO.w !== OVER_LM.imgW || genO.h !== OVER_LM.imgH) fail(`oversize: DEMO base must be the approved AI oversize image ${OVER_LM.imgW}×${OVER_LM.imgH}, got ${genO && genO.w + '×' + genO.h}`);
  const compO = await nodeCanvas(p, 'Ghép hình in lên áo');
  const anO = analyse(compO, OVER_QUAD, genO);
  if (anO.leak > 0) fail('oversize: design leaked outside the quad: ' + anO.leak + ' at ' + JSON.stringify(anO.leakPts));
  const measured = torsoCheck(anO, OVER_LM, 'oversize');
  const expImg = await nodeCanvas(p, 'Xuất file');
  if (!expImg || expImg.w !== 1200 || expImg.h !== 1500) fail(`oversize export: website PNG must be 1200×1500, got ${expImg && expImg.w + '×' + expImg.h}`);
  const banner = bannerCheck(expImg, 'oversize export');
  await saveNodeImage(p, 'Xuất file', RESULTS_DIR + 'oversize.png');
  // White CREW run in the same project for the footprint comparison.
  await propSelect(p, 'Trợ lý prompt (quy tắc)', '#pf-kieuAo', 'co-tron');
  await runAll(p, 1366, 'oversize-baseline-crew');
  await expectSuccess(p, 'oversize-baseline-crew');
  const compR = await nodeCanvas(p, 'Ghép hình in lên áo');
  const genR = await nodeCanvas(p, 'Tạo ảnh AI (DEMO)');
  const anR = analyse(compR, WHITE_QUAD, genR);
  const totalO = totalOf(anO.counts), totalR = totalOf(anR.counts);
  if (!(totalO > totalR * 1.15)) fail(`oversize: design footprint ${totalO} not clearly larger than crew ${totalR} (wider garment must carry a larger print)`);
  results.push({ case: 'oversize', gen: `AI model base ${OVER_LM.imgW}×${OVER_LM.imgH} (AI-generated, owner-approved)`, torsoWidth: { oversize: OVER_LM.torsoWidth, crew: WHITE_LM.torsoWidth }, counts: anO.counts, footprintVsCrew: Number((totalO / totalR).toFixed(2)), measured, banner, saved: 'oversize.png' });
  // UNMAPPED combo (beige crew): no approved AI base → drawn figure,
  // honestly labelled, still torso-calibrated.
  await propSelect(p, 'Trợ lý prompt (quy tắc)', '#pf-mauAo', 'be');
  await runAll(p, 1366, 'figure-fallback');
  await expectSuccess(p, 'figure-fallback');
  const genF = await nodeCanvas(p, 'Tạo ảnh AI (DEMO)');
  if (!genF || genF.w !== 900 || genF.h !== 1125) fail(`figure-fallback: DEMO base must be the drawn figure 900×1125 for unmapped combos, got ${genF && genF.w + '×' + genF.h}`);
  const bodyF = await p.textContent('body');
  if (!/người mẫu VẼ bằng canvas/.test(bodyF || '')) fail('figure-fallback: honest drawn-figure label missing');
  const compF = await nodeCanvas(p, 'Ghép hình in lên áo');
  const anF = analyse(compF, FIG_QUAD, genF);
  if (anF.leak > 0) fail('figure-fallback: design leaked outside the figure quad: ' + anF.leak);
  const measuredF = torsoCheck(anF, FIG_LM, 'figure-fallback');
  results.push({ case: 'figure-fallback (beige, unmapped)', gen: 'drawn figure 900×1125 — honest fallback', counts: anF.counts, measured: measuredF });
  if (errors.length) fail('oversize: page errors: ' + errors.join(' | '));
  await ctx.close();
}

// ================= CASE 4: real-photo fallback (white hanger garment fixture) =================
{
  const { ctx, p, errors } = await newPage(1366);
  await loadTpl1(p);
  await propSelect(p, 'Ghép hình in lên áo', '#pf-garment-source', 'real');
  await runAll(p, 1366, 'fallback-hanger');
  await expectSuccess(p, 'fallback-hanger');
  const comp = await nodeCanvas(p, 'Ghép hình in lên áo');
  if (!comp || comp.w !== 800 || comp.h !== 1200) fail(`fallback-hanger: output must be the hanger fixture 800×1200, got ${comp && comp.w + '×' + comp.h}`);
  const px = pxReader(comp);
  const garment = px(0.415, 0.30);
  if (!(Math.abs(garment[0] - 226) < 42 && Math.abs(garment[1] - 221) < 42)) fail('fallback-hanger: garment sample off: ' + garment);
  const an = analyse(comp, HANGER_QUAD);
  if (totalOf(an.counts) < 600) fail('fallback-hanger: design not composited on the hanger quad: ' + an.counts);
  const measured = torsoCheck(an, HANGER_LM, 'fallback-hanger');
  results.push({ case: 'fallback', hanger: '800×1200 OK', counts: an.counts, measured });
  if (errors.length) fail('fallback: page errors: ' + errors.join(' | '));
  await ctx.close();
}

// ================= CASE 5: AI failure (mocked Classic 500) — error guides to the fallback =================
{
  const { ctx, p, errors } = await newPage(1366);
  let classicCalls = 0;
  await p.route('https://image.pollinations.ai/**', r => { classicCalls++; r.fulfill({ status: 500, body: 'mock failure' }); });
  await p.route('https://gen.pollinations.ai/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"data":[]}' }));
  await loadTpl1(p);
  await p.click('#ais-toggle-props');
  await p.waitForSelector('#ais-real-switch', { state: 'visible', timeout: 10000 });
  const sw = p.locator('#ais-real-switch'); await sw.scrollIntoViewIfNeeded(); await sw.check();
  await p.selectOption('#ais-provider-kind', 'pollinations-classic');
  await p.click('#ais-toggle-props');
  await p.click('#ais-run');
  // The run settles with the composition node erroring AND pointing at the
  // real-photo fallback (the P4.1 contract).
  await p.waitForFunction(() => { const el = [...document.querySelectorAll('.ais-node')].find(e => e.querySelector('header strong')?.textContent === 'Ghép hình in lên áo'); return (el?.querySelector('.nerr')?.textContent || '').includes('Ảnh mẫu thật') && !document.querySelector('.ais-node.st-running'); }, null, { timeout: 60000 })
    .catch(() => fail('ai-fail: composition error does not suggest the real-photo fallback after the run settled'));
  if (classicCalls !== 1) fail('ai-fail: expected exactly 1 Classic request (retries forced 0), got ' + classicCalls);
  await propSelect(p, 'Ghép hình in lên áo', '#pf-garment-source', 'real');
  await runAll(p, 1366, 'ai-fail-fallback');
  // The AI node itself stays in error (mocked 500) — that is the point of
  // the fallback: composition/preview/export must succeed DESPITE it
  // (engine ignoreFailedUpstream), and it must be the ONLY error node.
  {
    const errs = await p.evaluate(() => [...document.querySelectorAll('.ais-node.st-error')].map(e => e.querySelector('header strong')?.textContent || '?'));
    if (!(errs.length === 1 && errs[0] === 'Tạo ảnh AI (DEMO)')) fail('ai-fail-fallback: expected only the AI node in error, got: ' + errs.join(' | '));
    for (const t of ['Ghép hình in lên áo', 'Xem trước', 'Xuất file']) {
      if (!/st-success/.test(await nodeClass(p, t))) fail('ai-fail-fallback: node not success: ' + t);
    }
  }
  if (classicCalls !== 2) fail('ai-fail: expected exactly 1 Classic request per run (2 runs), got ' + classicCalls);
  results.push({ case: 'ai-fail', classicCallsPerRun: 1, fallback: 'completed on the real hanger photo' });
  // The mocked HTTP 500 responses surface as console resource errors — they
  // are the intended mock, not page errors; anything else still fails.
  const realErrors = errors.filter(e => !/Failed to load resource.*500/.test(e));
  if (realErrors.length) fail('ai-fail: page errors: ' + realErrors.join(' | '));
  await ctx.close();
}

// ================= CASE 6: guide regression — red-free design, PREVIEW + export =================
// The multicolour design's own red, once fabric-shaded, can fall within
// tolerance of the guide colour, so the guide scan runs on a design with NO
// red-family colour at all: any guide-red pixel near the quad border in the
// PREVIEW node output or the exported PNG can then only be the editor guide
// leaking into an output (the P4.1 live screenshot bug the owner caught).
{
  const { ctx, p, errors } = await newPage(1366);
  const noRed = MULTI_SVG.replaceAll('#e53935', '#00838f').replaceAll('#f2b705', '#2456e0').replaceAll('#7a3fd1', '#1faa4d');
  await loadTpl1(p, noRed);
  await runAll(p, 1366, 'guide');
  await expectSuccess(p, 'guide');
  const prev = await nodeCanvas(p, 'Xem trước'); if (!prev) fail('guide: no preview canvas');
  const gsP = guideScan(prev, WHITE_QUAD);
  if (gsP.hits > 0) fail(`guide: PREVIEW contains ${gsP.hits} guide-red pixels near the quad border (guide must be editor-only)`);
  const expImg = await nodeCanvas(p, 'Xuất file');
  if (!expImg || expImg.w !== 1200 || expImg.h !== 1500) fail(`guide: export PNG must be 1200×1500, got ${expImg && expImg.w + '×' + expImg.h}`);
  const gsE = guideScan(expImg, exportQuad(WHITE_QUAD, prev.w, prev.h));
  if (gsE.hits > 0) fail(`guide: exported PNG contains ${gsE.hits} guide-red pixels near the quad border`);
  results.push({ case: 'guide-regression', previewGuideHits: gsP.hits, exportGuideHits: gsE.hits, scanned: gsP.scanned });
  if (errors.length) fail('guide: page errors: ' + errors.join(' | '));
  await ctx.close();
}

// ================= CASE 7 (R2): real-AI SQUARE close-up → framing fallback =================
// Mocked Classic returns a 512×512 solid-GREEN "close-up" (aspect class
// 'square'; pure green cannot occur in the AI photo or the design, so
// any hit is unambiguous). The composition node must REFUSE it (framing
// guard), fall back to the approved AI white-crew base, record the
// fallback in the result label, and produce ZERO composites onto the
// bad image (proven by: comp canvas = the AI base's composite size, and
// not one pixel of the bad image's colour anywhere in the composite).
{
  const { ctx, p, errors } = await newPage(1366);
  const bad = await p.evaluate(async () => {
    const c = document.createElement('canvas'); c.width = 512; c.height = 512;
    const x = c.getContext('2d'); x.fillStyle = '#00ff00'; x.fillRect(0, 0, 512, 512);
    x.fillStyle = '#00b400'; x.beginPath(); x.arc(256, 200, 90, 0, 7); x.fill(); // face-like blob
    const blob = await new Promise(r => c.toBlob(r, 'image/png'));
    return Array.from(new Uint8Array(await blob.arrayBuffer()));
  });
  let classicCalls = 0;
  await p.route('https://image.pollinations.ai/**', r => { classicCalls++; r.fulfill({ status: 200, contentType: 'image/png', body: Buffer.from(bad) }); });
  await p.route('https://gen.pollinations.ai/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"data":[]}' }));
  await loadTpl1(p);
  await p.click('#ais-toggle-props');
  await p.waitForSelector('#ais-real-switch', { state: 'visible', timeout: 10000 });
  const sw = p.locator('#ais-real-switch'); await sw.scrollIntoViewIfNeeded(); await sw.check();
  await p.selectOption('#ais-provider-kind', 'pollinations-classic');
  await p.click('#ais-toggle-props');
  await runAll(p, 1366, 'framing-fallback');
  await expectSuccess(p, 'framing-fallback');
  if (classicCalls !== 1) fail('framing-fallback: expected exactly 1 Classic request, got ' + classicCalls);
  const gen = await nodeCanvas(p, 'Tạo ảnh AI (DEMO)');
  if (!gen || gen.w !== 512 || gen.h !== 512) fail(`framing-fallback: the mocked bad image must be the gen output (512×512), got ${gen && gen.w + '×' + gen.h}`);
  const comp = await nodeCanvas(p, 'Ghép hình in lên áo');
  if (!comp || comp.w !== 900 || comp.h !== 1350) fail(`framing-fallback: composite must be built on the approved AI base (900×1350), got ${comp && comp.w + '×' + comp.h} — a 512-derived size would mean the bad image was composited`);
  const px = pxReader(comp); let badPx = 0;
  for (let y = 0; y < comp.h; y += 2) for (let x = 0; x < comp.w; x += 2) { const c = px(x / comp.w, y / comp.h); if (near(c, [0, 255, 0], 40) || near(c, [0, 180, 0], 40)) badPx++; }
  if (badPx > 0) fail(`framing-fallback: ${badPx} pixels of the BAD square image found in the composite — it must never be composited onto`);
  const an = analyse(comp, WHITE_QUAD, null);
  if (totalOf(an.counts) < 500) fail('framing-fallback: design missing on the fallback base composite: ' + an.counts);
  const bodyText = await p.textContent('body');
  if (!/Ảnh AI thật không đạt khung hình — đã dùng nền người mẫu đã duyệt/.test(bodyText || '')) fail('framing-fallback: fallback wording missing from the result label/log');
  const expImg = await nodeCanvas(p, 'Xuất file');
  const banner = bannerCheck(expImg, 'framing-fallback export');
  results.push({ case: 'framing-fallback (R2)', classicCalls, badImagePxInComposite: badPx, compDims: comp.w + '×' + comp.h, counts: an.counts, banner });
  const realErrors = errors.filter(e => !/Failed to load resource/.test(e));
  if (realErrors.length) fail('framing-fallback: page errors: ' + realErrors.join(' | '));
  await ctx.close();
}

// ================= CASE 8 (R3): FRESH project from Template 1 — zero manual edits =================
// A completely new browser profile (fresh IndexedDB: assert no projects,
// no drafts exist), instantiate Template 1, run the 3 standard cases and
// save THIS run's exports as fresh-*.png.
{
  const { ctx, p, errors } = await newPage(1366);
  const fresh = await p.evaluate(async () => {
    const { store } = await import('/src/ai-studio/store.js');
    return { projects: (await store.listProjects()).length, drafts: (await store.listDrafts()).length, recoveryShown: !document.querySelector('#ais-recovery').hidden };
  });
  if (fresh.projects !== 0 || fresh.drafts !== 0) fail(`fresh: expected a virgin IndexedDB, got ${JSON.stringify(fresh)}`);
  if (fresh.recoveryShown) fail('fresh: a draft-recovery banner must not appear on a fresh profile');
  await loadTpl1(p);
  await runAll(p, 1366, 'fresh-white');
  await expectSuccess(p, 'fresh-white');
  await saveNodeImage(p, 'Xuất file', RESULTS_DIR + 'fresh-white.png');
  await propSelect(p, 'Trợ lý prompt (quy tắc)', '#pf-mauAo', 'den');
  await runAll(p, 1366, 'fresh-black');
  await expectSuccess(p, 'fresh-black');
  await saveNodeImage(p, 'Xuất file', RESULTS_DIR + 'fresh-black.png');
  await propSelect(p, 'Trợ lý prompt (quy tắc)', '#pf-mauAo', 'trang');
  await propSelect(p, 'Trợ lý prompt (quy tắc)', '#pf-kieuAo', 'oversize');
  await runAll(p, 1366, 'fresh-oversize');
  await expectSuccess(p, 'fresh-oversize');
  await saveNodeImage(p, 'Xuất file', RESULTS_DIR + 'fresh-oversize.png');
  results.push({ case: 'fresh-project (R1+R3)', produced: ['fresh-white.png (trắng crew, nền AI nữ)', 'fresh-black.png (đen crew, nền AI nam)', 'fresh-oversize.png (trắng oversize, nền AI nữ)'], note: 'fresh IndexedDB, Template 1 instantiated, zero manual edits beyond garment params' });
  if (errors.length) fail('fresh: page errors: ' + errors.join(' | '));
  await ctx.close();
}

// ================= CASE 9 (R4): OLD Template 1 draft → refresh + cache purge on load =================
{
  const { ctx, p, errors } = await newPage(1366);
  await p.evaluate(async () => {
    const { store } = await import('/src/ai-studio/store.js');
    const { TEMPLATES } = await import('/src/ai-studio/core.js');
    const g = TEMPLATES.find(t => t.id === 'tpl1').make();
    g.meta = { templateId: 'tpl1', tplVersion: 1 }; // OLD marker
    const pa = g.nodes.find(n => n.type === 'promptAssistant'); delete pa.config.catalogPrompt; // pre-catalog wiring
    const comp = g.nodes.find(n => n.type === 'composition');
    comp.config.realBase = 'public/fixtures/real-tee/crew-white-vn-model.webp'; // retired round-2 base
    comp.config.quad = [[0.30, 0.40], [0.55, 0.40], [0.55, 0.60], [0.30, 0.60]];  // stale quad
    const saved = JSON.parse(JSON.stringify({ nodes: g.nodes.map(n => ({ id: n.id, type: n.type, x: n.x, y: n.y, config: n.config })), edges: g.edges, meta: g.meta }));
    await store.saveProject({ id: 'r4-old-project', name: 'Dự án Mẫu 1 cũ', graph: saved, updatedAt: Date.now() - 10000 });
    await store.saveDraft({ projectId: 'r4-old-project', name: 'Dự án Mẫu 1 cũ', graph: JSON.parse(JSON.stringify(saved)), updatedAt: Date.now() });
    await store.putCache({ key: 'aiImageGen:deadbeef', projectId: 'r4-old-project', nodeId: 'stale-node', nodeType: 'aiImageGen', createdAt: Date.now(), kind: 'image', blob: new Blob(['stale'], { type: 'image/png' }) });
  });
  await p.reload({ waitUntil: 'domcontentloaded' });
  await p.waitForSelector('body[data-ready="true"]', { timeout: 30000 });
  // init auto-opens the project (refresh path #1); the recovery banner
  // offers the draft (refresh path #2) — restore it.
  await p.waitForSelector('#ais-recovery:not([hidden])', { timeout: 15000 });
  await p.click('#ais-recovery-restore');
  await p.waitForTimeout(600);
  const bodyText = await p.textContent('body');
  if (!/Đã cập nhật dự án Mẫu 1 từ phiên bản mẫu cũ/.test(bodyText || '')) fail('old-draft: user-visible refresh note missing after loading an old Template 1 project/draft');
  const cacheLeft = await p.evaluate(async () => {
    const { store } = await import('/src/ai-studio/store.js');
    return (await store.listCache()).filter(c => c.projectId === 'r4-old-project').length;
  });
  if (cacheLeft !== 0) fail(`old-draft: stale cache records for the old project must be purged on refresh, ${cacheLeft} left`);
  // The refreshed promptAssistant must now describe the catalog framing.
  await nodeByTitle(p, 'Trợ lý prompt (quy tắc)').locator('header strong').click();
  await p.waitForTimeout(400);
  const body2 = await p.textContent('body');
  if (!/NỬA NGƯỜI/.test(body2 || '')) fail('old-draft: catalog prompt summary missing after refresh (catalogPrompt was not refreshed on)');
  await closeProps(p);
  // And the refreshed project RUNS on the new stack: AI base, not stale output.
  await setDesign(p);
  await runAll(p, 1366, 'old-draft-run');
  await expectSuccess(p, 'old-draft-run');
  const gen = await nodeCanvas(p, 'Tạo ảnh AI (DEMO)');
  if (!gen || gen.w !== WHITE_LM.imgW || gen.h !== WHITE_LM.imgH) fail(`old-draft: refreshed project must generate on the AI base ${WHITE_LM.imgW}×${WHITE_LM.imgH}, got ${gen && gen.w + '×' + gen.h}`);
  results.push({ case: 'old-draft-refresh (R4)', refreshNote: 'shown', cachePurged: true, runGen: gen.w + '×' + gen.h + ' AI base' });
  if (errors.length) fail('old-draft: page errors: ' + errors.join(' | '));
  await ctx.close();
}

await browser.close();
console.log(JSON.stringify({ suite: 'ai-studio-tpl1 (P4.2 round 4)', pass: true, results }, null, 1));
