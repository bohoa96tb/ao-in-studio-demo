// AI Studio Template 1 browser suite — P4.1 flow (generate the PLAIN garment
// first, composite the ORIGINAL design afterwards) with the P4.2 fixes and
// the ROUND-3 e-commerce standard asserted at pixel level:
//
// ROUND 3 (owner's e-commerce framing standard — supersedes rounds 1–2):
//   * The round-2 white MODEL photo (Pexels 25471921) was REJECTED by the
//     owner: close head-and-shoulders portrait, torso cut off below the
//     chest, model leaning in, dark room background. A fresh search (8
//     query angles, 26 candidates downloaded and viewed) found NO photo
//     passing the full checklist (medium half-body, ENTIRE plain garment
//     visible incl. hem + waistband, upright facing camera, plain bright
//     studio background, Vietnamese/Asian adult model) for white, black
//     or oversize. So DEMO uses the drawn figure for EVERY combo — the
//     figure itself redrawn to the half-body framing (900×1125) — with
//     its honest "chưa có ảnh chụp thật đã kiểm chứng" label. These tests
//     pin that: no photo base may silently return.
//   * Print placement follows the TORSO RULE (owner, round 3 — replaces
//     the round-1 collar rule): gap from the collar's LOWER edge to the
//     print's TOP = 12–15% of TOTAL TORSO LENGTH (collar → hem in the
//     image); print width = 35–45% of torso width; centred on the torso
//     centre. The multicolour test design fills its whole raster, so the
//     composited design's measured colour bbox IS the print area: the
//     suite measures gap/width ratios against each base's landmarks
//     (imported from src — no copied constants) and records them.
//   * Guide: the dashed red guide colour appears NOWHERE near the quad
//     border in the Preview output or the exported PNG (editor only).
//   * Design colours inside the quad, ZERO design leakage outside it,
//     and the composited raster still matches the original design raster
//     (correlation ≥ 0.85 despite the fabric blending).
//   * DEMO banner uniform in every export (stamped after channel crop).
//   * Real-photo fallback = the white HANGER garment fixture with its
//     torso-rule quad; AI-failure path (mocked Classic HTTP 500, zero
//     paid calls) still completes on it.
// No real Pollinations traffic: the P4 suite's mocked routes pattern is
// reused for the failure case; DEMO mode makes no external requests.
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { DEMO_FIGURE } from '../src/ai-studio/core.js';
import { GARMENT_QUADS, FIXTURE_LANDMARKS } from '../src/ai-studio/warp.js';

const MULTI_SVG = readFileSync(new URL('./fixtures/design-multicolor.svg', import.meta.url), 'utf8');

const BASE = process.env.TEST_URL || 'http://127.0.0.1:5264';
const results = [];
function fail(m) { console.error('FAIL:', m); process.exit(1); }

// Landmarks + quads come from the source registry itself (DEMO_FIGURE /
// FIXTURE_LANDMARKS / GARMENT_QUADS) so this suite can never drift from
// the geometry the app actually uses.
const FIG_LM = DEMO_FIGURE.landmarks.regular, FIG_QUAD = DEMO_FIGURE.chestQuad;
const OVER_LM = DEMO_FIGURE.landmarks.oversize, OVER_QUAD = DEMO_FIGURE.chestQuadOversize;
const HANGER_PATH = 'public/fixtures/real-tee/crew-white-hanger.webp';
const HANGER_LM = FIXTURE_LANDMARKS[HANGER_PATH], HANGER_QUAD = GARMENT_QUADS[HANGER_PATH];
const GUIDE_RGB = [182, 73, 47]; // the editor guide's dashed red (editor only!)

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
  // still attached (src updated, resource not yet replaced) — two suite
  // runs read the prior run's canvas that way (identical silhouette spans
  // / phantom leaks). Only read once the src is unchanged across two
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
      // Draw the already-decoded <img> element itself (works for PNG data
      // URLs and SVG thumbnails alike; fetch+createImageBitmap rejects
      // some SVG/blob sources).
      const c2 = document.createElement('canvas'); c2.width = img.naturalWidth || 600; c2.height = img.naturalHeight || 600;
      c2.getContext('2d').drawImage(img, 0, 0, c2.width, c2.height);
      return read(c2);
    }
    return null;
  }, t);
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
      // Leak = the COMPOSITING introduced the colour: the base must not
      // already carry it AND the output pixel must actually differ from
      // the base pixel there.
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
 * node's SVG — the same fixture the P4.1 suite used for its colour checks.
 * Its artwork fills the ENTIRE raster, so the composited colour bbox is
 * the print area itself (what the torso-rule measurements need). */
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
  // Settle detection must not be fooled by the PREVIOUS run's final state
  // (all nodes already st-success): poll until the preview is successful
  // and nothing is running AND this run was actually observed in flight —
  // either a node showed st-running or the run-bar summary text changed
  // (a finished run rewrites it to "Lượt chạy gần nhất: …").
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
/** Horizontal span (fraction of width) of the figure's tee colour on one
 * row — the oversize silhouette must be visibly WIDER than regular. The
 * case uses the GREY garment (#8f959b), which contrasts with the figure's
 * light-grey backdrop, skin and trousers alike. The row sits just above
 * each fit's hem (per-fit row passed in from the landmarks). */
function teeSpan(img, hex, ry) {
  const px = pxReader(img);
  let first = -1, last = -1;
  for (let x = 0; x < img.w; x += 2) {
    const c = px(x / img.w, ry);
    if (near(c, hex, 48)) { if (first < 0) first = x / img.w; last = x / img.w; }
  }
  return first < 0 ? 0 : last - first;
}
/** ROUND-3 TORSO RULE, measured on the composited design's colour bbox
 * (the multicolour design fills its raster, so bbox = print area):
 *   gapRatio   = (bbox.top − collarBottomY) / (hemY − collarBottomY)
 *   widthRatio = (bbox.right − bbox.left) / torsoWidth
 * must sit in the owner's bands [0.12, 0.15] / [0.35, 0.45], and the print
 * must be centred on torsoCenterX. Tolerances: samples land on a 3px
 * grid and the warped design's edge pixels are fabric-blended toward the
 * garment colour, so the detected bbox can shrink ~2 samples inside the
 * true quad (≈0.007 of height; ≈0.01–0.02 of torso width) — ±0.03 on the
 * gap and ±0.045 on the width absorb that, while any placement from the
 * rejected geometries (round-1 collar rule, P4.1 quad) lands 5–10 points
 * OUTSIDE the bands and still fails. Returns the measured numbers for
 * the QA report. */
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

// ================= CASE 1: white crew — DEMO = drawn figure (no compliant photo exists) =================
for (const width of [1366, 390]) {
  const { ctx, p, errors } = await newPage(width);
  await loadTpl1(p);
  await runAll(p, width, 'white@' + width);
  await expectSuccess(p, 'white@' + width);
  const gen = await nodeCanvas(p, 'Tạo ảnh AI (DEMO)');
  if (!gen || gen.w !== 900 || gen.h !== 1125) fail(`white@${width}: DEMO base must be the drawn half-body figure 900×1125 (round 3: no compliant model photo), got ${gen && gen.w + '×' + gen.h}`);
  const bodyText = await p.textContent('body');
  if (!/chưa có ảnh chụp thật đã kiểm chứng/.test(bodyText || '')) fail(`white@${width}: honest figure-fallback label missing (must say no verified real photo exists)`);
  const comp = await nodeCanvas(p, 'Ghép hình in lên áo');
  const an = analyse(comp, FIG_QUAD, gen);
  if (totalOf(an.counts) < 800) fail(`white@${width}: design barely present inside the quad: ${an.counts}`);
  DESIGN_COLORS.forEach((dc, i) => { if (an.counts[i] < 20) fail(`white@${width}: design colour ${i} barely present: ${an.counts}`); });
  if (an.leak > 0) fail(`white@${width}: ${an.leak} design-colour samples leaked OUTSIDE the quad`);
  const measured = torsoCheck(an, FIG_LM, 'white@' + width);
  const design = await nodeCanvas(p, 'Hình in (thiết kế)');
  const corr = correlate(design, comp, FIG_QUAD);
  if (corr < 0.85) fail(`white@${width}: composited raster correlation vs original design ${corr.toFixed(3)} < 0.85 (blending must not destroy the original print)`);
  results.push({ case: 'white-crew', width, gen: 'drawn figure 900×1125 (no compliant photo — UNMET, reported)', counts: an.counts, leak: an.leak, measured, correlation: Number(corr.toFixed(3)) });
  if (width === 1366) {
    // Export node output = the website channel PNG: exactly 1200×1500,
    // design composited, DEMO banner present at the top.
    const expImg = await nodeCanvas(p, 'Xuất file');
    if (!expImg || expImg.w !== 1200 || expImg.h !== 1500) fail(`white export: website PNG must be 1200×1500, got ${expImg && expImg.w + '×' + expImg.h}`);
    const anE = analyse(expImg, FIG_QUAD);
    if (totalOf(anE.counts) < 900) fail('white export: design missing from the exported PNG: ' + anE.counts);
    const banner = bannerCheck(expImg, 'white export');
    results.push({ case: 'white-export', dims: expImg.w + '×' + expImg.h, counts: anE.counts, banner });
  }
  if (errors.length) fail('white@' + width + ': page errors: ' + errors.join(' | '));
  await ctx.close();
}

// ================= CASE 2: black crew — drawn figure, logo-readable geometry =================
// Round 3: black is in the same honest state as white — no verified photo
// of an Asian model WEARING a plain black crew tee exists (round-1's
// 9558583 was a held-up shirt; round-3 search found prints, straps,
// outdoor shots and gaze-away portraits only). DEMO returns the drawn
// figure (900×1125) with the honest label.
{
  const { ctx, p, errors } = await newPage(1366);
  await loadTpl1(p);
  await propSelect(p, 'Trợ lý prompt (quy tắc)', '#pf-mauAo', 'den');
  await runAll(p, 1366, 'black');
  await expectSuccess(p, 'black');
  const gen = await nodeCanvas(p, 'Tạo ảnh AI (DEMO)');
  if (!gen || gen.w !== 900 || gen.h !== 1125) fail(`black: DEMO base must be the drawn figure 900×1125, got ${gen && gen.w + '×' + gen.h}`);
  const bodyText = await p.textContent('body');
  if (!/chưa có ảnh chụp thật đã kiểm chứng/.test(bodyText || '')) fail('black: figure fallback label missing (must honestly say no verified real photo exists for these params)');
  const comp = await nodeCanvas(p, 'Ghép hình in lên áo');
  const an = analyse(comp, FIG_QUAD, gen);
  DESIGN_COLORS.forEach((dc, i) => { if (an.counts[i] < 10) fail(`black: design colour ${i} barely present inside the quad: ${an.counts}`); });
  if (an.leak > 0) fail('black: design leaked outside the quad: ' + an.leak);
  const measured = torsoCheck(an, FIG_LM, 'black');
  const design = await nodeCanvas(p, 'Hình in (thiết kế)');
  const corr = correlate(design, comp, FIG_QUAD);
  if (corr < 0.85) fail(`black: correlation vs original design ${corr.toFixed(3)} < 0.85`);
  const expImg = await nodeCanvas(p, 'Xuất file');
  if (!expImg || expImg.w !== 1200 || expImg.h !== 1500) fail(`black export: website PNG must be 1200×1500, got ${expImg && expImg.w + '×' + expImg.h}`);
  const banner = bannerCheck(expImg, 'black export');
  results.push({ case: 'black-crew', gen: 'drawn figure 900×1125 (no compliant photo — UNMET, reported)', counts: an.counts, leak: an.leak, measured, correlation: Number(corr.toFixed(3)), banner });
  if (errors.length) fail('black: page errors: ' + errors.join(' | '));
  await ctx.close();
}

// ================= CASE 3: oversize — drawn figure with a REAL oversize silhouette =================
// No compliant oversize PHOTO exists either, so DEMO uses the drawn
// figure — whose oversize torso is drawn wider AND longer (landmarks:
// torsoWidth 0.58 vs 0.44, hem 0.87 vs 0.795) — and this case proves BOTH
// the wider silhouette AND the larger print footprint against the SAME
// figure in regular fit (colour 'xam' has no photo base; its grey
// contrasts with the figure's light backdrop, unlike beige).
{
  const { ctx, p, errors } = await newPage(1366);
  await loadTpl1(p);
  await propSelect(p, 'Trợ lý prompt (quy tắc)', '#pf-mauAo', 'xam');
  await propSelect(p, 'Trợ lý prompt (quy tắc)', '#pf-kieuAo', 'oversize');
  await runAll(p, 1366, 'oversize');
  await expectSuccess(p, 'oversize');
  const genO = await nodeCanvas(p, 'Tạo ảnh AI (DEMO)');
  if (!genO || genO.w !== 900 || genO.h !== 1125) fail(`oversize: DEMO base must be the drawn figure 900×1125, got ${genO && genO.w + '×' + genO.h}`);
  const spanO = teeSpan(genO, [143, 149, 155], OVER_LM.hemY - 0.03);
  const compO = await nodeCanvas(p, 'Ghép hình in lên áo');
  const anO = analyse(compO, OVER_QUAD, genO);
  if (anO.leak > 0) fail('oversize: design leaked outside the quad: ' + anO.leak + ' at ' + JSON.stringify(anO.leakPts));
  const measured = torsoCheck(anO, OVER_LM, 'oversize');
  const expImg = await nodeCanvas(p, 'Xuất file');
  if (!expImg || expImg.w !== 1200 || expImg.h !== 1500) fail(`oversize export: website PNG must be 1200×1500, got ${expImg && expImg.w + '×' + expImg.h}`);
  const banner = bannerCheck(expImg, 'oversize export');
  // Regular fit of the SAME figure for an apples-to-apples comparison.
  await propSelect(p, 'Trợ lý prompt (quy tắc)', '#pf-kieuAo', 'co-tron');
  await runAll(p, 1366, 'oversize-baseline-regular');
  await expectSuccess(p, 'oversize-baseline-regular');
  const genR = await nodeCanvas(p, 'Tạo ảnh AI (DEMO)');
  const spanR = teeSpan(genR, [143, 149, 155], FIG_LM.hemY - 0.03);
  const compR = await nodeCanvas(p, 'Ghép hình in lên áo');
  const anR = analyse(compR, FIG_QUAD, genR);
  const totalO = totalOf(anO.counts), totalR = totalOf(anR.counts);
  if (!(spanO > spanR * 1.18)) fail(`oversize: garment silhouette span ${spanO.toFixed(3)} not clearly wider than regular ${spanR.toFixed(3)}`);
  if (!(totalO > totalR * 1.08)) fail(`oversize: design footprint ${totalO} not larger than regular ${totalR}`);
  results.push({ case: 'oversize', gen: 'drawn figure 900×1125 (no compliant photo — UNMET, reported)', silhouetteSpan: { oversize: Number(spanO.toFixed(3)), regular: Number(spanR.toFixed(3)) }, counts: anO.counts, footprintVsRegularFigure: Number((totalO / totalR).toFixed(2)), measured, banner });
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

// ================= CASE 6: guide regression — red-free design =================
// The multicolour design's own red, once fabric-shaded, can fall within
// tolerance of the guide colour, so the guide scan runs on a design with NO
// red-family colour at all: any guide-red pixel near the quad border in the
// preview or the exported PNG can then only be the editor guide leaking
// into an output (the P4.2 bug the owner saw on the live site).
{
  const { ctx, p, errors } = await newPage(1366);
  const noRed = MULTI_SVG.replaceAll('#e53935', '#00838f').replaceAll('#f2b705', '#2456e0').replaceAll('#7a3fd1', '#1faa4d');
  await loadTpl1(p, noRed);
  await runAll(p, 1366, 'guide');
  await expectSuccess(p, 'guide');
  const prev = await nodeCanvas(p, 'Xem trước'); if (!prev) fail('guide: no preview canvas');
  const gsP = guideScan(prev, FIG_QUAD);
  if (gsP.hits > 0) fail(`guide: preview contains ${gsP.hits} guide-red pixels near the quad border (guide must be editor-only)`);
  const expImg = await nodeCanvas(p, 'Xuất file');
  if (!expImg || expImg.w !== 1200 || expImg.h !== 1500) fail(`guide: export PNG must be 1200×1500, got ${expImg && expImg.w + '×' + expImg.h}`);
  const gsE = guideScan(expImg, FIG_QUAD); // uniform 1.333× scale; relative quad unchanged
  if (gsE.hits > 0) fail(`guide: exported PNG contains ${gsE.hits} guide-red pixels near the quad border`);
  results.push({ case: 'guide-regression', previewGuideHits: gsP.hits, exportGuideHits: gsE.hits, scanned: gsP.scanned });
  if (errors.length) fail('guide: page errors: ' + errors.join(' | '));
  await ctx.close();
}

await browser.close();
console.log(JSON.stringify({ suite: 'ai-studio-tpl1 (P4.2 round 3)', pass: true, results }, null, 1));
