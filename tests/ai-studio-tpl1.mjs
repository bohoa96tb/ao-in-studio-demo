/**
 * AI Studio P4.1 browser checks — Template 1 rework (Playwright, server
 * scripts/serve.mjs :5264). Template 1 runs in DEMO mode; the ONLY network
 * mock is the AI-FAIL phase, where Pollinations Classic is forced to HTTP
 * 500 via route interception — this suite NEVER calls a real generation
 * endpoint.
 *
 * Unlike the older suites ("workflow reports 0 errors"), every case makes
 * PIXEL-LEVEL assertions on the actual output images, read back through a
 * canvas in-page:
 *  CASE 1 (1366 + 390) white crew-neck + sample design (Vietnamese text):
 *    the AI/demo garment BEFORE compositing is a plain white tee (no design
 *    colours in the chest quad); AFTER compositing the torso is white, the
 *    design colours are present INSIDE the chest quad, ABSENT outside it,
 *    and the quad content correlates with the ORIGINAL design raster (the
 *    print is the original pixels warped, not redrawn). Export = 1200x1500.
 *  CASE 2 (1366) black tee + multicolour design: torso black; every design
 *    colour found inside the quad.
 *  CASE 3 (1366) oversize + large design: garment silhouette spans a wider
 *    x-range than Case 1's regular fit; design footprint is larger.
 *  FALLBACK (1366) garmentSource='real': output IS the real hanger fixture
 *    (800x1200, garment pixels identical to the fixture) with the design in
 *    the fixture's calibrated quad.
 *  AI-FAIL (1366) Classic forced to 500: the composition node errors with a
 *    message pointing at the real-photo fallback; after switching to
 *    'real', the composition + preview succeed even though the AI node
 *    still fails (and exactly 1 classic request is made per run — retries
 *    stay suppressed for real calls).
 */
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';

const url = process.env.TEST_URL || 'http://127.0.0.1:5264';
const fail = (m) => { throw new Error('AI-STUDIO-TPL1: ' + m); };
const MULTI_SVG = readFileSync(new URL('./fixtures/design-multicolor.svg', import.meta.url), 'utf8');
// DEMO figure chest quads (src/ai-studio/core.js DEMO_FIGURE — keep in sync).
const QUAD = [[0.315, 0.375], [0.685, 0.375], [0.695, 0.6], [0.305, 0.6]];
const QUAD_OVER = [[0.29, 0.38], [0.71, 0.38], [0.73, 0.7], [0.27, 0.7]];
const FIXTURE_QUAD = [[0.315, 0.375], [0.515, 0.375], [0.52, 0.585], [0.31, 0.585]];
const SAMPLE_SVG_URL = null; // sample design text is read from the page itself

const b = await chromium.launch();
const results = [];

async function newPage(width, mockClassic500 = false) {
  const ctx = await b.newContext({ viewport: { width, height: 900 }, hasTouch: width < 700, acceptDownloads: true });
  const state = { classic: 0 };
  if (mockClassic500) {
    await ctx.route('**://image.pollinations.ai/**', (route) => { state.classic++; return route.fulfill({ status: 500, body: 'mock failure' }); });
    await ctx.route('**://gen.pollinations.ai/**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  }
  const p = await ctx.newPage();
  const errors = []; p.on('pageerror', e => errors.push(e.message));
  p.on('dialog', d => d.accept());
  await p.goto(url + '/studio.html?v=aistudio41');
  await p.waitForSelector('body[data-ready=true]');
  return { ctx, p, errors, state };
}
async function loadTpl1(p, name) {
  await p.click('[data-template="tpl1"]');
  await p.waitForFunction(() => document.querySelectorAll('.ais-node').length === 8);
  await p.fill('#ais-project-name', name);
  await p.locator('#ais-project-name').dispatchEvent('change');
}
const nodeClass = (p, label) => p.evaluate((l) => { const el = [...document.querySelectorAll('.ais-node')].find(e => e.querySelector('header strong')?.textContent === l); return el ? el.className : null; }, label);
const nodeImgSrc = (p, label) => p.evaluate((l) => { const el = [...document.querySelectorAll('.ais-node')].find(e => e.querySelector('header strong')?.textContent === l); const img = el?.querySelector('img.nthumb'); return img ? img.src : null; }, label);
async function clickNode(p, label) { await p.locator('.ais-node header strong:text-is("' + label + '")').click(); }
async function setVal(p, selector, value) {
  await p.evaluate(([s, v]) => { const el = document.querySelector(s); if (!el) throw new Error('missing element ' + s); el.value = v; el.dispatchEvent(new Event('change', { bubbles: true })); }, [selector, String(value)]);
}
async function closeProps(p) { if (await p.locator('#ais-prop-close').isVisible().catch(() => false)) await p.click('#ais-prop-close'); }
async function runAndSettle(p, width) {
  await p.click(width < 700 ? '#ais-run-mobile' : '#ais-run');
  await p.waitForFunction(() => { const nodes = [...document.querySelectorAll('.ais-node')]; const t = nodes.find(e => e.querySelector('header strong')?.textContent === 'Xem trước'); return t && t.className.includes('st-success') && !nodes.some(e => e.className.includes('st-running')); }, null, { timeout: 90000 })
    .catch(() => fail('preview did not settle with success'));
  const errs = await p.evaluate(() => [...document.querySelectorAll('.ais-node.st-error')].map(e => e.querySelector('header strong')?.textContent + ': ' + (e.querySelector('.nerr')?.textContent || '')));
  if (errs.length) fail('error nodes after run: ' + errs.join(' | '));
}
async function checkClean(p, errors, width) {
  if (await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2)) fail('horizontal overflow @' + width);
  if (errors.length) fail('page errors @' + width + ': ' + errors.join(' | '));
}

/** Pixel analysis of an image (blob URL or path) inside the page. */
async function analyse(p, src, spec) {
  return p.evaluate(async ({ src, spec }) => {
    const img = new Image();
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = src; });
    const W = img.naturalWidth, H = img.naturalHeight;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const x = c.getContext('2d'); x.drawImage(img, 0, 0);
    const d = x.getImageData(0, 0, W, H).data;
    const at = (xi, yi) => { const o = (yi * W + xi) * 4; return [d[o], d[o + 1], d[o + 2]]; };
    const hexRgb = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
    const dist = (a, bq) => Math.hypot(a[0] - bq[0], a[1] - bq[1], a[2] - bq[2]);
    const inPoly = (fx, fy, poly) => { let ins = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, yi] = poly[i], [xj, yj] = poly[j]; if (((yi > fy) !== (yj > fy)) && (fx < (xj - xi) * (fy - yi) / (yj - yi) + xi)) ins = !ins; } return ins; };
    const expand = (poly, m) => { const cx = poly.reduce((s, q) => s + q[0], 0) / poly.length, cy = poly.reduce((s, q) => s + q[1], 0) / poly.length; return poly.map(([qx, qy]) => [cx + (qx - cx) * (1 + m), cy + (qy - cy) * (1 + m)]); };
    const isWhite = (px) => Math.min(...px) > 195 && Math.max(...px) - Math.min(...px) < 30;
    const isBlack = (px) => Math.max(...px) < 78;
    const out = { W, H };
    if (spec.torsoRect) {
      const [x0, y0, x1, y1] = spec.torsoRect; let n = 0, wHit = 0, bHit = 0;
      for (let yi = Math.round(y0 * H); yi < y1 * H; yi += 2) for (let xi = Math.round(x0 * W); xi < x1 * W; xi += 2) { const px = at(xi, yi); n++; if (isWhite(px)) wHit++; if (isBlack(px)) bHit++; }
      out.whiteFrac = wHit / n; out.blackFrac = bHit / n;
    }
    if (spec.quadColours) {
      const { quad, colours, tol } = spec.quadColours;
      const counts = colours.map(() => 0); let total = 0;
      for (let yi = 0; yi < H; yi += 2) for (let xi = 0; xi < W; xi += 2) {
        if (!inPoly(xi / W, yi / H, quad)) continue; total++;
        const px = at(xi, yi);
        colours.forEach((h, i) => { if (dist(px, hexRgb(h)) < tol) counts[i]++; });
      }
      out.quadCounts = counts; out.quadTotal = total;
    }
    if (spec.outside) {
      const { rect, quad, expandBy, colour, tol } = spec.outside;
      const ex = expand(quad, expandBy); let n = 0, hit = 0;
      const [x0, y0, x1, y1] = rect;
      for (let yi = Math.round(y0 * H); yi < y1 * H; yi += 2) for (let xi = Math.round(x0 * W); xi < x1 * W; xi += 2) {
        const fx = xi / W, fy = yi / H; if (inPoly(fx, fy, ex)) continue; n++;
        if (dist(at(xi, yi), hexRgb(colour)) < tol) hit++;
      }
      out.outsideCount = hit; out.outsideTotal = n;
    }
    if (spec.rowSpan) {
      const yi = Math.round(spec.rowSpan.y * H); let mn = null, mx = null;
      for (let xi = 0; xi < W; xi++) { const px = at(xi, yi); if (spec.rowSpan.pred === 'white' ? isWhite(px) : isBlack(px)) { if (mn === null) mn = xi; mx = xi; } }
      out.rowSpan = mn === null ? 0 : (mx - mn) / W;
    }
    if (spec.points) out.pointSamples = spec.points.map(([fx, fy]) => at(Math.min(W - 1, Math.floor(fx * W)), Math.min(H - 1, Math.floor(fy * H))));
    return out;
  }, { src, spec });
}

/** Correlation between the design raster and the output inside the quad:
 * for grid points where the design is opaque, how often does the output
 * pixel match the ORIGINAL design colour (within shading tolerance)? A
 * redrawn/AI-invented print would score low; the warped original scores high. */
async function correlate(p, outSrc, svgText, quad) {
  return p.evaluate(async ({ outSrc, svgText, quad }) => {
    const load = (src) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
    const out = await load(outSrc);
    const dUrl = URL.createObjectURL(new Blob([svgText], { type: 'image/svg+xml' }));
    const dImg = await load(dUrl);
    const W = out.naturalWidth, H = out.naturalHeight;
    const oc = document.createElement('canvas'); oc.width = W; oc.height = H;
    const ox = oc.getContext('2d'); ox.drawImage(out, 0, 0);
    const od = ox.getImageData(0, 0, W, H).data;
    const xs = quad.map(q => q[0]), ys = quad.map(q => q[1]);
    const bx = Math.min(...xs), by = Math.min(...ys), bw = Math.max(...xs) - bx, bh = Math.max(...ys) - by;
    const dc = document.createElement('canvas'); dc.width = Math.max(2, Math.round(bw * W)); dc.height = Math.max(2, Math.round(bh * H));
    const dx = dc.getContext('2d'); dx.drawImage(dImg, 0, 0, dc.width, dc.height);
    const dd = dx.getImageData(0, 0, dc.width, dc.height).data;
    const bilin = (u, v) => {
      const top = [quad[0][0] + (quad[1][0] - quad[0][0]) * u, quad[0][1] + (quad[1][1] - quad[0][1]) * u];
      const bot = [quad[3][0] + (quad[2][0] - quad[3][0]) * u, quad[3][1] + (quad[2][1] - quad[3][1]) * u];
      return [top[0] + (bot[0] - top[0]) * v, top[1] + (bot[1] - top[1]) * v];
    };
    let samples = 0, match = 0;
    const N = 24;
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const u = 0.08 + 0.84 * (i / (N - 1)), v = 0.08 + 0.84 * (j / (N - 1));
      const dxi = Math.min(dc.width - 1, Math.floor(u * dc.width)), dyi = Math.min(dc.height - 1, Math.floor(v * dc.height));
      const dq = (dyi * dc.width + dxi) * 4;
      if (dd[dq + 3] < 200) continue;
      const [fx, fy] = bilin(u, v);
      const oo = (Math.min(H - 1, Math.floor(fy * H)) * W + Math.min(W - 1, Math.floor(fx * W))) * 4;
      const dv = Math.hypot(od[oo] - dd[dq], od[oo + 1] - dd[dq + 1], od[oo + 2] - dd[dq + 2]);
      samples++; if (dv < 115) match++;
    }
    return { samples, matchFrac: samples ? match / samples : 0 };
  }, { outSrc, svgText, quad });
}

let case1Span = 0, case1Footprint = 0;

// ---------- CASE 1: white crew-neck + sample design ----------
for (const width of [1366, 390]) {
  const { ctx, p, errors } = await newPage(width);
  await loadTpl1(p, 'P4.1 Case 1 ao trang ' + width);
  // The prompt that will be sent is the EN plain-garment prompt.
  await clickNode(p, 'Trợ lý prompt (quy tắc)');
  const composed = await p.inputValue('#pf-composed');
  if (!/PLAIN white classic crew-neck/.test(composed)) fail('EN prompt missing plain white crew-neck @' + width + ': ' + composed.slice(0, 120));
  if (/Giữ nguyên chính xác|in theo yêu cầu/.test(composed)) fail('old print instructions still in prompt @' + width);
  const summary = await p.locator('.pf-summary p').textContent();
  if (!/TRƠN/.test(summary || '')) fail('VI summary missing plain-tee note @' + width);
  await closeProps(p);
  await runAndSettle(p, width);
  // (a) the generated garment BEFORE compositing: plain white, no design colours in the quad.
  const genSrc = await nodeImgSrc(p, 'Tạo ảnh AI (DEMO)');
  if (!genSrc) fail('gen node has no image @' + width);
  const genA = await analyse(p, genSrc, { torsoRect: [0.36, 0.66, 0.64, 0.84], quadColours: { quad: QUAD, colours: ['#b6492f', '#293e35'], tol: 70 } });
  if (genA.W !== 768 || genA.H !== 960) fail(`demo garment size ${genA.W}x${genA.H}, expected 768x960 @` + width);
  if (genA.whiteFrac < 0.8) fail('demo torso not dominantly white before compositing: ' + genA.whiteFrac + ' @' + width);
  if (genA.quadCounts[0] > 5 || genA.quadCounts[1] > 5) fail('design colours present in the PLAIN garment — compositing order broken: ' + genA.quadCounts.join(',') + ' @' + width);
  // (b) the composed result on the preview node.
  const prevSrc = await nodeImgSrc(p, 'Xem trước');
  const a = await analyse(p, prevSrc, {
    torsoRect: [0.36, 0.66, 0.64, 0.84],
    quadColours: { quad: QUAD, colours: ['#b6492f', '#293e35'], tol: 70 },
    outside: { rect: [0.27, 0.3, 0.73, 0.88], quad: QUAD, expandBy: 0.12, colour: '#b6492f', tol: 60 },
    rowSpan: { y: 0.55, pred: 'white' },
  });
  if (a.W !== 768 || a.H !== 960) fail(`composed size ${a.W}x${a.H}, expected 768x960 @` + width);
  if (a.whiteFrac < 0.8) fail('composed torso not dominantly white: ' + a.whiteFrac + ' @' + width);
  if (a.quadCounts[0] < 400) fail('terracotta design colour missing inside the quad: ' + a.quadCounts[0] + ' @' + width);
  if (a.quadCounts[1] < 80) fail('dark-green design colour missing inside the quad: ' + a.quadCounts[1] + ' @' + width);
  if (a.outsideCount > Math.max(10, a.outsideTotal * 0.005)) fail(`design colour leaked outside the quad: ${a.outsideCount}/${a.outsideTotal} @` + width);
  // (c) correlation with the ORIGINAL design raster (text not redrawn).
  const sampleSvg = await p.evaluate(() => { const el = [...document.querySelectorAll('.ais-node')].find(e => e.querySelector('header strong')?.textContent === 'Hình in (thiết kế)'); return el ? 'has-node' : null; });
  if (!sampleSvg) fail('design node missing @' + width);
  const svgText = await p.evaluate(async () => {
    // read the design node's SVG from the (already-run) project draft in IndexedDB is overkill;
    // the template sample is a module constant — fetch it from the page's own module graph instead:
    const mod = await import('./src/ai-studio/core.js');
    return mod.SAMPLE_DESIGN_SVG;
  });
  const corr = await correlate(p, prevSrc, svgText, QUAD);
  if (corr.samples < 60) fail('too few opaque design samples for correlation: ' + corr.samples + ' @' + width);
  if (corr.matchFrac < 0.65) fail('quad content does not match the original design raster: ' + corr.matchFrac + ' @' + width);
  // (d) export: website channel = 1200x1500 exactly.
  const expSrc = await nodeImgSrc(p, 'Xuất file');
  const ea = await analyse(p, expSrc, {});
  if (ea.W !== 1200 || ea.H !== 1500) fail(`export size ${ea.W}x${ea.H}, expected 1200x1500 @` + width);
  if (width === 1366) { case1Span = a.rowSpan; case1Footprint = a.quadCounts[0] + a.quadCounts[1]; }
  await checkClean(p, errors, width);
  results.push({ case: 'CASE1', width, genPlainWhiteFrac: +genA.whiteFrac.toFixed(3), torsoWhiteFrac: +a.whiteFrac.toFixed(3), quadTerracotta: a.quadCounts[0], quadDarkGreen: a.quadCounts[1], outsideLeak: a.outsideCount, corrSamples: corr.samples, corrMatchFrac: +corr.matchFrac.toFixed(3), rowSpan: +a.rowSpan.toFixed(3), export: ea.W + 'x' + ea.H });
  await ctx.close();
}

// ---------- CASE 2: black tee + multicolour design ----------
{
  const width = 1366; const { ctx, p, errors } = await newPage(width);
  await loadTpl1(p, 'P4.1 Case 2 ao den');
  await clickNode(p, 'Trợ lý prompt (quy tắc)');
  await p.selectOption('#pf-mauAo', 'den');
  await closeProps(p);
  await clickNode(p, 'Hình in (thiết kế)');
  await p.waitForSelector('#pf-svg');
  await setVal(p, '#pf-svg', MULTI_SVG);
  await closeProps(p);
  await runAndSettle(p, width);
  const prevSrc = await nodeImgSrc(p, 'Xem trước');
  const colours = ['#e53935', '#2456e0', '#1faa4d', '#f2b705', '#7a3fd1'];
  const a = await analyse(p, prevSrc, { torsoRect: [0.36, 0.66, 0.64, 0.84], quadColours: { quad: QUAD, colours, tol: 80 } });
  if (a.blackFrac < 0.8) fail('torso not dominantly black: ' + a.blackFrac);
  colours.forEach((c, i) => { if (a.quadCounts[i] < 150) fail(`design colour ${c} missing inside quad: ${a.quadCounts[i]}`); });
  await checkClean(p, errors, width);
  results.push({ case: 'CASE2', width, torsoBlackFrac: +a.blackFrac.toFixed(3), quadCounts: a.quadCounts });
  await ctx.close();
}

// ---------- CASE 3: oversize + large design ----------
{
  const width = 1366; const { ctx, p, errors } = await newPage(width);
  await loadTpl1(p, 'P4.1 Case 3 oversize');
  await clickNode(p, 'Trợ lý prompt (quy tắc)');
  await p.selectOption('#pf-kieuAo', 'oversize');
  await closeProps(p);
  await clickNode(p, 'Ghép hình in lên áo');
  await p.waitForSelector('#ais-quad-canvas');
  for (let i = 0; i < 4; i++) { await setVal(p, '#pf-q' + i + 'x', QUAD_OVER[i][0] * 100); await setVal(p, '#pf-q' + i + 'y', QUAD_OVER[i][1] * 100); }
  await closeProps(p);
  await runAndSettle(p, width);
  const prevSrc = await nodeImgSrc(p, 'Xem trước');
  const a = await analyse(p, prevSrc, { quadColours: { quad: QUAD_OVER, colours: ['#b6492f', '#293e35'], tol: 70 }, rowSpan: { y: 0.55, pred: 'white' } });
  const footprint = a.quadCounts[0] + a.quadCounts[1];
  if (!(a.rowSpan > case1Span + 0.08)) fail(`oversize silhouette not wider: span ${a.rowSpan} vs case1 ${case1Span}`);
  if (!(footprint > case1Footprint * 1.3)) fail(`oversize design footprint not larger: ${footprint} vs case1 ${case1Footprint}`);
  await checkClean(p, errors, width);
  results.push({ case: 'CASE3', width, rowSpan: +a.rowSpan.toFixed(3), case1Span: +case1Span.toFixed(3), footprint, case1Footprint, footprintRatio: +(footprint / case1Footprint).toFixed(2) });
  await ctx.close();
}

// ---------- FALLBACK: garmentSource='real' composites onto the real fixture ----------
{
  const width = 1366; const { ctx, p, errors } = await newPage(width);
  await loadTpl1(p, 'P4.1 Fallback anh that');
  await clickNode(p, 'Ghép hình in lên áo');
  await p.waitForSelector('#pf-garment-source');
  await p.selectOption('#pf-garment-source', 'real');
  await closeProps(p);
  await runAndSettle(p, width);
  const prevSrc = await nodeImgSrc(p, 'Xem trước');
  const a = await analyse(p, prevSrc, { points: [[0.415, 0.3]], quadColours: { quad: FIXTURE_QUAD, colours: ['#b6492f'], tol: 70 } });
  if (a.W !== 800 || a.H !== 1200) fail(`fallback output ${a.W}x${a.H}, expected the 800x1200 fixture`);
  const fx = await analyse(p, '/public/fixtures/real-tee/crew-white-hanger.webp', { points: [[0.415, 0.3]] });
  const d = Math.hypot(a.pointSamples[0][0] - fx.pointSamples[0][0], a.pointSamples[0][1] - fx.pointSamples[0][1], a.pointSamples[0][2] - fx.pointSamples[0][2]);
  if (d > 60) fail('fallback garment pixel differs from the real fixture (dist ' + d.toFixed(1) + ')');
  if (a.quadCounts[0] < 300) fail('design missing inside the fixture quad: ' + a.quadCounts[0]);
  await checkClean(p, errors, width);
  results.push({ case: 'FALLBACK', width, size: a.W + 'x' + a.H, fixturePixelDist: +d.toFixed(1), quadTerracotta: a.quadCounts[0] });
  await ctx.close();
}

// ---------- AI-FAIL: AI error -> clear fallback error; 'real' still completes ----------
{
  const width = 1366; const { ctx, p, errors, state } = await newPage(width, true);
  await loadTpl1(p, 'P4.1 AI fail fallback');
  await p.click('#ais-toggle-props');
  await p.waitForSelector('#ais-real-switch', { state: 'visible' });
  const sw = p.locator('#ais-real-switch'); await sw.scrollIntoViewIfNeeded(); await sw.check();
  await p.selectOption('#ais-provider-kind', 'pollinations-classic');
  await p.click('#ais-toggle-props');
  await p.click('#ais-run');
  await p.waitForFunction(() => { const el = [...document.querySelectorAll('.ais-node')].find(e => e.querySelector('header strong')?.textContent === 'Tạo ảnh AI (DEMO)'); return el && el.className.includes('st-error'); }, null, { timeout: 90000 }).catch(() => fail('gen node did not error on mocked 500'));
  if (state.classic !== 1) fail('expected exactly 1 classic request (retries suppressed), got ' + state.classic);
  const compCls = await nodeClass(p, 'Ghép hình in lên áo');
  if (!/st-error/.test(compCls || '')) fail('composition should be error when the AI garment fails (source=ai)');
  // The fallback suggestion is appended to the composition error when the
  // run settles — wait for the settled error text, not the mid-run one.
  await p.waitForFunction(() => { const el = [...document.querySelectorAll('.ais-node')].find(e => e.querySelector('header strong')?.textContent === 'Ghép hình in lên áo'); return (el?.querySelector('.nerr')?.textContent || '').includes('Ảnh mẫu thật') && !document.querySelector('.ais-node.st-running'); }, null, { timeout: 30000 })
    .catch(() => fail('composition error does not suggest the real-photo fallback after the run settled'));
  const compErr = await p.evaluate(() => { const el = [...document.querySelectorAll('.ais-node')].find(e => e.querySelector('header strong')?.textContent === 'Ghép hình in lên áo'); return el?.querySelector('.nerr')?.textContent || ''; });
  // Switch to the real-photo fallback and re-run: comp + preview succeed
  // even though the AI node fails again.
  await clickNode(p, 'Ghép hình in lên áo');
  await p.waitForSelector('#pf-garment-source');
  await p.selectOption('#pf-garment-source', 'real');
  await closeProps(p);
  await p.click('#ais-run');
  await p.waitForFunction(() => { const nodes = [...document.querySelectorAll('.ais-node')]; const t = nodes.find(e => e.querySelector('header strong')?.textContent === 'Xem trước'); return t && t.className.includes('st-success') && !nodes.some(e => e.className.includes('st-running')); }, null, { timeout: 90000 }).catch(() => fail('fallback re-run did not settle'));
  if (!/st-success/.test(await nodeClass(p, 'Ghép hình in lên áo'))) fail('composition not success in real mode despite AI failure');
  if (!/st-error/.test(await nodeClass(p, 'Tạo ảnh AI (DEMO)'))) fail('gen node should still be error (mocked 500)');
  if (state.classic !== 2) fail('expected exactly 1 classic request per run, total 2, got ' + state.classic);
  await checkClean(p, errors, width);
  results.push({ case: 'AI-FAIL', width, classicCallsPerRun: 1, compErrorSuggestsFallback: true, fallbackCompletesDespiteAiError: true });
  await ctx.close();
}

console.log(JSON.stringify(results, null, 2));
console.log('AI-STUDIO-TPL1: PASS');
await b.close();
