// AI Studio Template 1 browser suite — P4.1 flow (generate the PLAIN garment
// first, composite the ORIGINAL design afterwards) with the P4.2 visual
// fixes asserted at pixel level:
//   * DEMO bases are REAL studio photos (white crew 960×1200, black crew
//     800×1200, oversize reuses the white photo with a wider quad) whose
//     chest quads follow the collar rule: top edge 8–12% of image height
//     BELOW the collar's lower edge, centred on the chest;
//   * the composited design's pixel bbox respects that rule (top ≥ collar
//     + 8%, centre inside the base's chest band);
//   * the dashed red guide colour appears NOWHERE near the quad border in
//     the Preview output or the exported PNG (guide = editor only);
//   * design colours inside the quad, ZERO design leakage outside it, and
//     the composited raster still matches the original design raster
//     (correlation ≥ 0.85 despite the P4.2 fabric blending);
//   * real-photo fallback (white model photo + white hanger fixture) and
//     the AI-failure path (mocked Classic HTTP 500, zero paid calls).
// No real Pollinations traffic: the P4 suite's mocked routes pattern is
// reused for the failure case; DEMO mode makes no external requests.
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const MULTI_SVG = readFileSync(new URL('./fixtures/design-multicolor.svg', import.meta.url), 'utf8');

const BASE = process.env.TEST_URL || 'http://127.0.0.1:5264';
const results = [];
function fail(m) { console.error('FAIL:', m); process.exit(1); }

// Calibrated quads + measured collar lower edges (P4.2, see
// docs/AI_STUDIO_QA_REPORT.md): chestQuadFor(collarBottomY + margin 8–12%).
const WHITE_QUAD = [[0.366, 0.443], [0.606, 0.443], [0.606, 0.593], [0.366, 0.593]];   // collar 0.358, margin 0.085
const OVER_QUAD = [[0.336, 0.443], [0.636, 0.443], [0.636, 0.618], [0.336, 0.618]];    // same photo, wider print
const BLACK_QUAD = [[0.43, 0.585], [0.73, 0.585], [0.73, 0.745], [0.43, 0.745]];      // collar 0.495, margin 0.09
const HANGER_QUAD = [[0.315, 0.425], [0.515, 0.425], [0.515, 0.615], [0.315, 0.615]]; // collar 0.33, margin 0.095
const WHITE_COLLAR = 0.358, BLACK_COLLAR = 0.495;
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
  return p.evaluate(async (title) => {
    const el = [...document.querySelectorAll('.ais-node')].find(e => e.querySelector('header strong')?.textContent === title);
    if (!el) return null;
    const read = (cv) => { const x = cv.getContext('2d'); const d = x.getImageData(0, 0, cv.width, cv.height).data; return { w: cv.width, h: cv.height, data: Array.from(d) }; };
    const cv = el.querySelector('canvas');
    if (cv && cv.width > 0) return read(cv);
    const img = el.querySelector('img.nthumb');
    if (!img || !img.src) return null;
    // Draw the already-decoded <img> element itself (works for PNG data
    // URLs and SVG thumbnails alike; fetch+createImageBitmap rejects some
    // SVG/blob sources).
    if (!img.complete) await img.decode().catch(() => {});
    const c2 = document.createElement('canvas'); c2.width = img.naturalWidth || 600; c2.height = img.naturalHeight || 600;
    c2.getContext('2d').drawImage(img, 0, 0, c2.width, c2.height);
    return read(c2);
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
  const px = pxReader(img); const pb = baseImg ? pxReader(baseImg) : null;
  const counts = DESIGN_COLORS.map(() => 0); let leak = 0; const total = [0, 0];
  const BAND = 0.006;
  const inBand = (rx, ry) => rx >= quad[0][0] - BAND && rx <= quad[1][0] + BAND && ry >= quad[0][1] - BAND && ry <= quad[2][1] + BAND;
  let minY = 1, maxY = 0, n = 0;
  for (let y = 2; y < img.h - 2; y += 3) for (let x = 2; x < img.w - 2; x += 3) {
    const rx = x / img.w, ry = y / img.h; const c = px(rx, ry); const inside = inQuad(rx, ry, quad);
    if (!inside && inBand(rx, ry)) continue;
    DESIGN_COLORS.forEach((dc, i) => {
      if (!near(c, dc, 46)) return;
      if (inside) { counts[i]++; if (ry < minY) minY = ry; if (ry > maxY) maxY = ry; n++; }
      else if (!pb || !near(pb(rx, ry), dc, 46)) leak++;
    });
    total[inside ? 0 : 1]++;
  }
  return { counts, leak, bbox: n ? { top: minY, bottom: maxY, centre: (minY + maxY) / 2 } : null };
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
  await p.waitForTimeout(250);
  await closeProps(p);
}
/** Inject the multicolour test design (5 colours incl. text) as the design
 * node's SVG — the same fixture the P4.1 suite used for its colour checks. */
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
function positionCheck(an, quad, collar, band, phase) {
  if (!an.bbox) fail(phase + ': no design pixels found');
  if (an.bbox.top < collar + 0.08) fail(`${phase}: design top ${an.bbox.top.toFixed(3)} is above collar+8% (${(collar + 0.08).toFixed(3)}) — print rides onto the neck`);
  const quadCentre = (quad[0][1] + quad[2][1]) / 2;
  if (Math.abs(an.bbox.centre - quadCentre) > 0.06) fail(`${phase}: design centre ${an.bbox.centre.toFixed(3)} off the quad centre ${quadCentre.toFixed(3)}`);
  if (an.bbox.centre < band[0] || an.bbox.centre > band[1]) fail(`${phase}: design centre ${an.bbox.centre.toFixed(3)} outside chest band ${band}`);
}

// ================= CASE 1: white crew — DEMO returns the REAL photo =================
for (const width of [1366, 390]) {
  const { ctx, p, errors } = await newPage(width);
  await loadTpl1(p);
  await runAll(p, width, 'white@' + width);
  await expectSuccess(p, 'white@' + width);
  const gen = await nodeCanvas(p, 'Tạo ảnh AI (DEMO)');
  if (!gen || gen.w !== 960 || gen.h !== 1200) fail(`white@${width}: DEMO base must be the real white model photo 960×1200, got ${gen && gen.w + '×' + gen.h}`);
  const bodyText = await p.textContent('body');
  if (!/dùng ảnh chụp thật làm ảnh nền tham chiếu/.test(bodyText || '')) fail(`white@${width}: DEMO photo-base label missing (must honestly say a real photo is used, not AI)`);
  const comp = await nodeCanvas(p, 'Ghép hình in lên áo');
  const an = analyse(comp, WHITE_QUAD, gen);
  if (totalOf(an.counts) < 1500) fail(`white@${width}: design barely present inside the quad: ${an.counts}`);
  if (an.counts[0] < 300) fail(`white@${width}: design red barely present inside the quad: ${an.counts}`);
  DESIGN_COLORS.forEach((dc, i) => { if (an.counts[i] < 25) fail(`white@${width}: design colour ${i} barely present: ${an.counts}`); });
  if (an.leak > 0) fail(`white@${width}: ${an.leak} design-colour samples leaked OUTSIDE the quad`);
  positionCheck(an, WHITE_QUAD, WHITE_COLLAR, [0.42, 0.58], 'white@' + width);
  const design = await nodeCanvas(p, 'Hình in (thiết kế)');
  const corr = correlate(design, comp, WHITE_QUAD);
  if (corr < 0.85) fail(`white@${width}: composited raster correlation vs original design ${corr.toFixed(3)} < 0.85 (blending must not destroy the original print)`);
  results.push({ case: 'white-crew', width, gen: 'photo 960×1200', counts: an.counts, leak: an.leak, bbox: an.bbox, correlation: Number(corr.toFixed(3)) });
  if (width === 1366) {
    // Export node output = the website channel PNG: exactly 1200×1500,
    // with the design composited (guide scan lives in CASE 6 — see why).
    const expImg = await nodeCanvas(p, 'Xuất file');
    if (!expImg || expImg.w !== 1200 || expImg.h !== 1500) fail(`white export: website PNG must be 1200×1500, got ${expImg && expImg.w + '×' + expImg.h}`);
    const anE = analyse(expImg, WHITE_QUAD);
    if (totalOf(anE.counts) < 1200) fail('white export: design missing from the exported PNG: ' + anE.counts);
    results.push({ case: 'white-export', dims: expImg.w + '×' + expImg.h, counts: anE.counts });
  }
  if (errors.length) fail('white@' + width + ': page errors: ' + errors.join(' | '));
  await ctx.close();
}

// ================= CASE 2: black crew — DEMO returns the REAL black photo =================
{
  const { ctx, p, errors } = await newPage(1366);
  await loadTpl1(p);
  await propSelect(p, 'Trợ lý prompt (quy tắc)', '#pf-mauAo', 'den');
  await runAll(p, 1366, 'black');
  await expectSuccess(p, 'black');
  const gen = await nodeCanvas(p, 'Tạo ảnh AI (DEMO)');
  if (!gen || gen.w !== 800 || gen.h !== 1200) fail(`black: DEMO base must be the real black model photo 800×1200, got ${gen && gen.w + '×' + gen.h}`);
  const comp = await nodeCanvas(p, 'Ghép hình in lên áo');
  const an = analyse(comp, BLACK_QUAD, gen);
  DESIGN_COLORS.forEach((dc, i) => { if (an.counts[i] < 10) fail(`black: design colour ${i} barely present inside the quad: ${an.counts}`); });
  if (an.leak > 0) fail('black: design leaked outside the quad: ' + an.leak);
  positionCheck(an, BLACK_QUAD, BLACK_COLLAR, [0.58, 0.74], 'black');
  const design = await nodeCanvas(p, 'Hình in (thiết kế)');
  const corr = correlate(design, comp, BLACK_QUAD);
  if (corr < 0.85) fail(`black: correlation vs original design ${corr.toFixed(3)} < 0.85`);
  results.push({ case: 'black-crew', counts: an.counts, leak: an.leak, bbox: an.bbox, correlation: Number(corr.toFixed(3)) });
  if (errors.length) fail('black: page errors: ' + errors.join(' | '));
  await ctx.close();
}

// ================= CASE 3: oversize — white photo + wider calibrated quad =================
{
  const { ctx, p, errors } = await newPage(1366);
  await loadTpl1(p);
  await propSelect(p, 'Trợ lý prompt (quy tắc)', '#pf-kieuAo', 'oversize');
  await runAll(p, 1366, 'oversize');
  await expectSuccess(p, 'oversize');
  const gen = await nodeCanvas(p, 'Tạo ảnh AI (DEMO)');
  if (!gen || gen.w !== 960 || gen.h !== 1200) fail('oversize: DEMO base must be the white model photo 960×1200');
  const comp = await nodeCanvas(p, 'Ghép hình in lên áo');
  const an = analyse(comp, OVER_QUAD, gen);
  const total = an.counts.reduce((a, b) => a + b, 0);
  const whiteTotal = results.find(r => r.case === 'white-crew' && r.width === 1366).counts.reduce((a, b) => a + b, 0);
  if (!(total > whiteTotal * 1.2)) fail(`oversize: design footprint ${total} not clearly larger than regular ${whiteTotal}`);
  if (an.leak > 0) fail('oversize: design leaked outside the quad: ' + an.leak);
  positionCheck(an, OVER_QUAD, WHITE_COLLAR, [0.42, 0.58], 'oversize');
  results.push({ case: 'oversize', counts: an.counts, footprintVsRegular: Number((total / whiteTotal).toFixed(2)), bbox: an.bbox });
  if (errors.length) fail('oversize: page errors: ' + errors.join(' | '));
  await ctx.close();
}

// ================= CASE 4: real-photo fallback (model photo, then hanger fixture) =================
{
  const { ctx, p, errors } = await newPage(1366);
  await loadTpl1(p);
  await propSelect(p, 'Ghép hình in lên áo', '#pf-garment-source', 'real');
  await runAll(p, 1366, 'fallback-model');
  await expectSuccess(p, 'fallback-model');
  const comp = await nodeCanvas(p, 'Ghép hình in lên áo');
  // The composition handler caps its output at 900px wide (pre-existing
  // behaviour): the 960×1200 model photo composites at 900×1125.
  if (!comp || comp.w !== 900 || comp.h !== 1125) fail(`fallback-model: composition output must be the white model photo at 900×1125, got ${comp && comp.w + '×' + comp.h}`);
  const px = pxReader(comp);
  // Plain-tee sample above the print area (the centre chest at y≈0.40 is in
  // the model's chin shadow on this photo, so sample the lit right chest).
  const torso = px(0.58, 0.42);
  if (!(torso[0] > 200 && torso[1] > 200 && torso[2] > 200)) fail('fallback-model: torso sample is not the white tee: ' + torso);
  const an = analyse(comp, WHITE_QUAD);
  if (totalOf(an.counts) < 1200) fail('fallback-model: design not composited: ' + an.counts);
  positionCheck(an, WHITE_QUAD, WHITE_COLLAR, [0.42, 0.58], 'fallback-model');
  // Switch the real base to the white hanger fixture → its own calibrated quad.
  await propSelect(p, 'Ghép hình in lên áo', '#pf-real-base', 'public/fixtures/real-tee/crew-white-hanger.webp');
  await runAll(p, 1366, 'fallback-hanger');
  await expectSuccess(p, 'fallback-hanger');
  const comp2 = await nodeCanvas(p, 'Ghép hình in lên áo');
  if (!comp2 || comp2.w !== 800 || comp2.h !== 1200) fail('fallback-hanger: output must be the hanger fixture 800×1200');
  const px2 = pxReader(comp2);
  const garment = px2(0.415, 0.30);
  if (!(Math.abs(garment[0] - 226) < 42 && Math.abs(garment[1] - 221) < 42)) fail('fallback-hanger: garment sample off: ' + garment);
  const an2 = analyse(comp2, HANGER_QUAD);
  if (totalOf(an2.counts) < 600) fail('fallback-hanger: design not composited on the hanger quad: ' + an2.counts);
  positionCheck(an2, HANGER_QUAD, 0.33, [0.42, 0.58], 'fallback-hanger');
  results.push({ case: 'fallback', modelPhoto: '900×1125 OK (900px cap)', hanger: '800×1200 OK', counts: an.counts, hangerCounts: an2.counts });
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
  results.push({ case: 'ai-fail', classicCallsPerRun: 1, fallback: 'completed on the real photo' });
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
  const gsP = guideScan(prev, WHITE_QUAD);
  if (gsP.hits > 0) fail(`guide: preview contains ${gsP.hits} guide-red pixels near the quad border (guide must be editor-only)`);
  const expImg = await nodeCanvas(p, 'Xuất file');
  if (!expImg || expImg.w !== 1200 || expImg.h !== 1500) fail(`guide: export PNG must be 1200×1500, got ${expImg && expImg.w + '×' + expImg.h}`);
  const gsE = guideScan(expImg, WHITE_QUAD); // uniform 1.25× scale; relative quad unchanged
  if (gsE.hits > 0) fail(`guide: exported PNG contains ${gsE.hits} guide-red pixels near the quad border`);
  results.push({ case: 'guide-regression', previewGuideHits: gsP.hits, exportGuideHits: gsE.hits, scanned: gsP.scanned });
  if (errors.length) fail('guide: page errors: ' + errors.join(' | '));
  await ctx.close();
}

await browser.close();
console.log(JSON.stringify({ suite: 'ai-studio-tpl1 (P4.2)', pass: true, results }, null, 1));
