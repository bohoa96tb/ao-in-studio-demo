/**
 * AI Studio P4.6 browser checks (Playwright, server scripts/serve.mjs :5264).
 * Redesign under test (owner's brief 2026-11-15): the product reference
 * is the highest-authority data — AI may change model/scene/light/
 * camera only, never the garment. The owner's live failure: Template 1
 * with a BLACK tee in Ảnh đầu vào produced a WHITE tee (audit in
 * docs/AI_STUDIO_QA_REPORT.md: meta-less legacy projects never gained
 * the P4.5 wire, and returning phones ran STALE modules because
 * studio.html loaded studio.js?v=aistudio41 with unversioned internal
 * imports). Every provider endpoint is MOCKED — never a real call.
 *
 *  WIRE46 (430)    build p46; Mẫu 1 renders 8 edges incl. the new
 *                  imageInput -> promptAssistant analysis wire; every
 *                  loaded ai-studio module URL carries ?v=aistudio46.
 *  T1-PRODUCTS     4 products x Template 1 DEMO (black/white via the
 *    (430)         panel picker, red/printed via file upload — both
 *                  are real UI paths): the final composite's garment
 *                  region matches the product (black dark, white
 *                  light, red red-dominant); for the printed tee the
 *                  generation output's design region is PIXEL-EQUAL to
 *                  the product photo (nothing redraws it) and the
 *                  analysis detects the existing print. Plus the
 *                  swap -> re-run / unchanged -> cache contract.
 *  T2-PRODUCTS     Template 2 with black + printed: every output in
 *    (430)         the chain keeps the product's colour/pixels.
 *  CF46 (1366)     Mocked Cloudflare klein returns a WHITE garment for
 *                  a BLACK product: the request carries the reference
 *                  bytes AND a prompt whose [1] PRODUCT IDENTITY (with
 *                  "Do not replace the black T-shirt") precedes the
 *                  scene sections; QC warns and the strict composition
 *                  falls back to the ORIGINAL PRODUCT PHOTO.
 *  TEXTONLY46      Keyed flux and Classic sana with a wired reference:
 *    (1366)        clear Vietnamese text-only error, ZERO requests.
 *  LEGACY46 (430)  A meta-less pre-P4.5 project (no reference wires)
 *                  gains them on load — the owner's exact failure
 *                  shape — and then produces the BLACK product.
 *
 * Test fixtures (tests/fixtures/): tee-red.png = the white hanger
 * photo colour-shifted to red (synthetic); tee-printed.png = the
 * white hanger photo with the shop's sample design composited into
 * its calibrated quad. They are TEST fixtures only — never added to
 * the app's customer-facing fixture list.
 */
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const url = process.env.TEST_URL || 'http://127.0.0.1:5264';
const WORKER = 'https://ai-proxy.test.workers.dev';
const KLEIN = '@cf/black-forest-labs/flux-2-klein-4b';
const BLACK = 'public/fixtures/real-tee/crew-black-hanger.webp';
const WHITE = 'public/fixtures/real-tee/crew-white-hanger.webp';
const RED_FILE = fileURLToPath(new URL('./fixtures/tee-red.png', import.meta.url));
const PRINTED_FILE = fileURLToPath(new URL('./fixtures/tee-printed.png', import.meta.url));
const RESULTS_DIR = fileURLToPath(new URL('../../../p46-results/', import.meta.url));
mkdirSync(RESULTS_DIR, { recursive: true });
const fail = (m) => { throw new Error('AI-STUDIO-P46: ' + m); };
const b = await chromium.launch();
const results = [];

/** A light/white garment mock (1024x1536, passes the framing guard) —
 * deliberately the WRONG colour for a black product (CF46's QC bait). */
async function makeMock() {
  const ctx = await b.newContext();
  const p = await ctx.newPage();
  const b64 = await p.evaluate(async () => {
    const c = document.createElement('canvas'); c.width = 1024; c.height = 1536;
    const x = c.getContext('2d');
    x.fillStyle = '#e8e6e1'; x.fillRect(0, 0, 1024, 1536);
    x.fillStyle = '#f7f5f0'; x.fillRect(330, 470, 364, 780);
    const blob = await new Promise(r => c.toBlob(r, 'image/png'));
    const buf = new Uint8Array(await blob.arrayBuffer()); let s = ''; for (const v of buf) s += String.fromCharCode(v);
    return btoa(s);
  });
  await ctx.close();
  return { b64, buf: Buffer.from(b64, 'base64') };
}
const MOCK = await makeMock();

async function newPage(width, mocks = {}) {
  const ctx = await b.newContext({ viewport: { width, height: 950 }, hasTouch: width < 700, acceptDownloads: true });
  const state = { worker: [], keyed: [], classic: [] };
  if (mocks.worker) await ctx.route(WORKER + '/**', (route) => {
    const req = route.request();
    state.worker.push({ url: req.url(), headers: req.headers(), body: req.postDataBuffer() || Buffer.alloc(0) });
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ result: { image: MOCK.b64 } }) });
  });
  if (mocks.keyed) await ctx.route('**://gen.pollinations.ai/**', (route) => {
    const u = route.request().url();
    if (u.includes('/image/models')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [] }) });
    state.keyed.push(u);
    return route.fulfill({ status: 200, contentType: 'image/png', body: MOCK.buf });
  });
  if (mocks.classic) await ctx.route('**://image.pollinations.ai/**', (route) => {
    state.classic.push(route.request().url());
    return route.fulfill({ status: 200, contentType: 'image/png', body: MOCK.buf });
  });
  if (!mocks.keyed) await ctx.route('**://gen.pollinations.ai/**', (route) => route.abort());
  if (!mocks.classic) await ctx.route('**://image.pollinations.ai/**', (route) => route.abort());
  const p = await ctx.newPage();
  const errors = []; p.on('pageerror', e => errors.push(e.message));
  p.on('dialog', d => d.accept());
  await p.goto(url + '/studio.html?v=aistudio46');
  await p.waitForSelector('body[data-ready=true]');
  return { ctx, p, errors, state };
}
const runBtn = (p, width) => p.click(width < 700 ? '#ais-run-mobile' : '#ais-run');
async function runAndWait(p, width, what) {
  const before = await p.locator('#ais-run-progress').textContent().catch(() => '');
  await runBtn(p, width);
  await p.waitForFunction((prev) => { const t = document.querySelector('#ais-run-progress')?.textContent || ''; return t.includes('Lượt chạy gần nhất') && t !== prev; }, before, { timeout: 120000 }).catch(() => fail(what + ': run did not finish'));
  await p.waitForTimeout(250);
}
const nodeClass = (p, label) => p.evaluate((l) => { const el = [...document.querySelectorAll('.ais-node')].find(e => e.querySelector('header strong')?.textContent === l); return el ? el.className : null; }, label);
const logTexts = (p) => p.evaluate(() => [...document.querySelectorAll('#ais-log li')].map(li => li.textContent));
const bodyText = (p) => p.evaluate(() => document.body.innerText);
/** Node thumbnail decoded: size + centre-region per-channel MEDIAN
 * (the same region the app's product analysis samples) + PNG bytes. */
async function nodeImage(p, title) {
  return p.evaluate(async (t) => {
    const el = [...document.querySelectorAll('.ais-node')].find(e => e.querySelector('header strong')?.textContent === t);
    const img = el?.querySelector('img.nthumb');
    if (!img) return null;
    await img.decode().catch(() => {});
    const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
    const x = c.getContext('2d'); x.drawImage(img, 0, 0);
    const S = 96, t2 = document.createElement('canvas'); t2.width = S; t2.height = S;
    const tx = t2.getContext('2d'); tx.drawImage(c, 0, 0, S, S);
    const d = tx.getImageData(0, 0, S, S).data, rs = [], gs = [], bs = [];
    for (let yy = Math.floor(S * 0.30); yy < S * 0.70; yy++) for (let xx = Math.floor(S * 0.30); xx < S * 0.70; xx++) { const i = (yy * S + xx) * 4; rs.push(d[i]); gs.push(d[i + 1]); bs.push(d[i + 2]); }
    const med = (a) => { const s = [...a].sort((a, b2) => a - b2); return s[Math.floor(s.length / 2)]; };
    const blob = await new Promise(r => c.toBlob(r, 'image/png'));
    return { w: c.width, h: c.height, median: [med(rs), med(gs), med(bs)], bytes: Array.from(new Uint8Array(await blob.arrayBuffer())) };
  }, title);
}
async function checkClean(p, errors, width) {
  if (await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2)) fail('horizontal overflow @' + width);
  if (errors.length) fail('page errors @' + width + ': ' + errors.join(' | '));
}
async function setFixture(p, fixture) {
  const el = p.locator('.ais-node', { hasText: 'Ảnh đầu vào' }).first();
  await el.click();
  await p.waitForSelector('#pf-fixture', { state: 'visible' });
  await p.selectOption('#pf-fixture', fixture);
  await p.waitForTimeout(300);
}
async function uploadImage(p, filePath, nameHint) {
  const el = p.locator('.ais-node', { hasText: 'Ảnh đầu vào' }).first();
  await el.click();
  await p.waitForSelector('#pf-file', { state: 'visible' });
  await p.setInputFiles('#pf-file', filePath);
  await p.waitForFunction((n) => document.querySelector('#ais-properties')?.textContent.includes(n), nameHint, { timeout: 15000 }).catch(() => fail('upload did not register: ' + nameHint));
  await p.waitForTimeout(300);
}
async function openProvider(p) { await p.click('#ais-toggle-props'); await p.waitForSelector('#ais-real-switch', { state: 'visible' }); }
async function closeProvider(p) { await p.click('#ais-toggle-props'); }
async function checkId(p, id) { const l = p.locator(id); await l.scrollIntoViewIfNeeded(); await l.check(); }
async function fillChange(p, id, value) { const l = p.locator(id); await l.scrollIntoViewIfNeeded(); await l.fill(value); await l.dispatchEvent('change'); }
function extractPart(buf, contentType, fieldName) {
  const boundary = /boundary=(.+)$/.exec(contentType || '')?.[1];
  if (!boundary) return null;
  const delim = Buffer.from('--' + boundary);
  let start = buf.indexOf(delim);
  while (start !== -1) {
    const next = buf.indexOf(delim, start + delim.length);
    if (next === -1) break;
    const part = buf.subarray(start + delim.length, next);
    const headEnd = part.indexOf('\r\n\r\n');
    if (headEnd !== -1 && part.subarray(0, headEnd).toString('latin1').includes(`name="${fieldName}"`)) {
      let body = part.subarray(headEnd + 4);
      if (body.length >= 2 && body[body.length - 2] === 13 && body[body.length - 1] === 10) body = body.subarray(0, body.length - 2);
      return Buffer.from(body);
    }
    start = next;
  }
  return null;
}
/** Compare the design-region pixels of a node thumbnail against a
 * reference image supplied as base64 — the printed-tee guarantee:
 * the generation step must not redraw what is already printed. */
async function designRegionEqual(p, title, refB64) {
  return p.evaluate(async ({ t, b64 }) => {
    const el = [...document.querySelectorAll('.ais-node')].find(e => e.querySelector('header strong')?.textContent === t);
    const img = el?.querySelector('img.nthumb');
    if (!img) return { ok: false, why: 'no thumbnail' };
    await img.decode().catch(() => {});
    const bin = atob(b64); const arr = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    const ref = new Image(); const ru = URL.createObjectURL(new Blob([arr], { type: 'image/png' }));
    await new Promise((res, rej) => { ref.onload = res; ref.onerror = rej; ref.src = ru; });
    if (img.naturalWidth !== ref.naturalWidth || img.naturalHeight !== ref.naturalHeight) return { ok: false, why: `size ${img.naturalWidth}x${img.naturalHeight} vs ref ${ref.naturalWidth}x${ref.naturalHeight}` };
    const W = img.naturalWidth, H = img.naturalHeight;
    const draw = (im) => { const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d'); x.drawImage(im, 0, 0); return x.getImageData(0, 0, W, H).data; };
    const a = draw(img), b2 = draw(ref);
    // the calibrated print quad of the white hanger photo (fractions)
    const [qx0, qy0, qx1, qy1] = [0.384, 0.40425, 0.536, 0.5055833333333334];
    let diff = 0, n = 0;
    for (let yy = Math.floor(qy0 * H); yy < qy1 * H; yy += 3) for (let xx = Math.floor(qx0 * W); xx < qx1 * W; xx += 3) {
      const i = (yy * W + xx) * 4; n++;
      if (Math.abs(a[i] - b2[i]) > 4 || Math.abs(a[i + 1] - b2[i + 1]) > 4 || Math.abs(a[i + 2] - b2[i + 2]) > 4) diff++;
    }
    return { ok: diff === 0, diff, n };
  }, { t: title, b64: refB64 });
}
const PRINTED_B64 = readFileSync(PRINTED_FILE).toString('base64');

// ---------- Phase WIRE46: build, analysis wire, versioned modules ----------
{
  const width = 430; const { ctx, p, errors } = await newPage(width);
  const core = await p.evaluate(async () => {
    const m = await import('/src/ai-studio/core.js?v=aistudio46');
    const g = m.TEMPLATES.find(t => t.id === 'tpl1').make();
    const by = (t) => g.nodes.find(n => n.type === t);
    return {
      build: m.AI_STUDIO_BUILD,
      paWire: g.edges.some(e => e.from === by('imageInput').id && e.to === by('promptAssistant').id && e.toPort === 'image'),
      genWire: g.edges.some(e => e.from === by('imageInput').id && e.to === by('aiImageGen').id && e.toPort === 'image'),
      edges: g.edges.length,
      paPort: m.NODE_DEFS.promptAssistant.inputs.find(i => i.id === 'image').label,
    };
  });
  if (core.build !== 'p46') fail('WIRE46: AI_STUDIO_BUILD must be p46, got ' + core.build);
  if (!core.paWire || !core.genWire || core.edges !== 8) fail('WIRE46: Mẫu 1 must ship BOTH reference wires (8 edges): ' + JSON.stringify(core));
  if (core.paPort !== 'Ảnh sản phẩm (phân tích)') fail('WIRE46: promptAssistant analysis port label wrong: ' + core.paPort);
  await p.click('[data-template="tpl1"]');
  await p.waitForFunction(() => document.querySelectorAll('.ais-node').length === 8);
  const domEdges = await p.evaluate(() => document.querySelectorAll('.ais-edge').length);
  if (domEdges !== 8) fail('WIRE46: Mẫu 1 must render 8 edges, got ' + domEdges);
  // The stale-module fix: every ai-studio JS module the page actually
  // loaded must carry the build version in its URL.
  const mods = await p.evaluate(() => performance.getEntriesByType('resource').map(r => r.name).filter(n => n.includes('/src/ai-studio/') && n.endsWith('.js') || n.includes('/src/ai-studio/') && n.includes('.js?')));
  const unversioned = mods.filter(n => !n.includes('v=aistudio46'));
  if (unversioned.length) fail('WIRE46: unversioned ai-studio modules loaded (stale-module risk): ' + unversioned.join(' | '));
  if (!mods.some(n => n.includes('studio.js'))) fail('WIRE46: studio.js not in the resource list');
  await checkClean(p, errors, width);
  results.push({ phase: 'WIRE46', width, modulesVersioned: mods.length });
  await ctx.close();
}

// ---------- Phase T1-PRODUCTS: 4 products x Template 1 DEMO ----------
const T1_CASES = [
  { id: 'black', via: 'panel', fixture: BLACK, expect: (m) => m[0] < 95 && m[1] < 95 && m[2] < 95, desc: 'dark' },
  { id: 'white', via: 'panel', fixture: WHITE, expect: (m) => m[0] > 195 && m[1] > 195 && m[2] > 195, desc: 'light' },
  { id: 'red', via: 'upload', file: RED_FILE, name: 'tee-red.png', expect: (m) => m[0] > 130 && m[0] > m[1] + 70 && m[0] > m[2] + 60, desc: 'red-dominant' },
  { id: 'printed', via: 'upload', file: PRINTED_FILE, name: 'tee-printed.png', expect: (m) => m[0] > 180 && m[1] > 180 && m[2] > 170, desc: 'light (white garment)' },
];
for (const tc of T1_CASES) {
  const width = 430; const { ctx, p, errors } = await newPage(width);
  await p.click('[data-template="tpl1"]');
  await p.waitForFunction(() => document.querySelectorAll('.ais-node').length === 8);
  if (tc.via === 'panel') await setFixture(p, tc.fixture); else await uploadImage(p, tc.file, tc.name);
  await runAndWait(p, width, 'T1-' + tc.id);
  if (!/st-success/.test(await nodeClass(p, 'Ghép hình in lên áo'))) fail(`T1-${tc.id}: composition must succeed`);
  const comp = await nodeImage(p, 'Ghép hình in lên áo');
  if (!comp) fail(`T1-${tc.id}: no composite image`);
  if (!tc.expect(comp.median)) fail(`T1-${tc.id}: composite garment region must be ${tc.desc}, median RGB ${comp.median.join(',')}`);
  writeFileSync(RESULTS_DIR + `tpl1-${tc.id}.png`, Buffer.from(comp.bytes));
  if (tc.id === 'printed') {
    const eq = await designRegionEqual(p, 'Tạo ảnh AI (DEMO)', PRINTED_B64);
    if (!eq.ok) fail(`T1-printed: the generation output's design region must be PIXEL-EQUAL to the product photo (AI must not redraw the existing print): ${JSON.stringify(eq)}`);
    const logs = await logTexts(p);
    if (!logs.some(t => t.includes('Ảnh đầu vào') && t.includes('phát hiện có hình in sẵn'))) fail('T1-printed: the product analysis must detect the existing print (heuristic) in the imageInput log: ' + logs.slice(0, 6).join(' || '));
  }
  if (tc.id === 'red') {
    // the panel analysis box names the measured colour
    const el = p.locator('.ais-node', { hasText: 'Ảnh đầu vào' }).first();
    await el.click();
    await p.waitForFunction(() => document.querySelector('#pf-product-info')?.textContent.includes('Đỏ'), null, { timeout: 15000 }).catch(() => fail('T1-red: the panel product analysis must name the measured colour Đỏ'));
  }
  if (tc.id === 'black') {
    const logs = await logTexts(p);
    if (!logs.some(t => t.includes('Tạo ảnh AI') && t.includes('Sản phẩm tham chiếu là dữ kiện BẮT BUỘC') && t.includes('Đen'))) fail('T1-black: the gen log must state the product is mandatory data (black): ' + logs.slice(0, 8).join(' || '));
    // swap -> downstream re-runs; unchanged -> cache allowed
    await setFixture(p, WHITE);
    await runAndWait(p, width, 'T1-black swap');
    if (!/st-success/.test(await nodeClass(p, 'Tạo ảnh AI (DEMO)'))) fail('T1-swap: gen must RE-RUN after swapping the product');
    const compW = await nodeImage(p, 'Ghép hình in lên áo');
    if (!compW || !(compW.median[0] > 195)) fail('T1-swap: after swapping to the white product the composite must be light, median ' + (compW && compW.median.join(',')));
    await runAndWait(p, width, 'T1-black cache');
    if (!/st-cached/.test(await nodeClass(p, 'Tạo ảnh AI (DEMO)'))) fail('T1-cache: an unchanged re-run must serve the gen node from cache');
  }
  await checkClean(p, errors, width);
  results.push({ phase: 'T1-' + tc.id, width, median: comp.median.join(',') });
  await ctx.close();
}

// ---------- Phase T2-PRODUCTS: Template 2 keeps the product ----------
for (const tc of [{ id: 'black', via: 'panel', fixture: BLACK, dark: true }, { id: 'printed', via: 'upload', file: PRINTED_FILE, name: 'tee-printed.png', dark: false }]) {
  const width = 430; const { ctx, p, errors } = await newPage(width);
  await p.click('[data-template="tpl2"]');
  await p.waitForFunction(() => document.querySelectorAll('.ais-node').length === 7);
  if (tc.via === 'panel') await setFixture(p, tc.fixture); else await uploadImage(p, tc.file, tc.name);
  await runAndWait(p, width, 'T2-' + tc.id);
  const gen = await nodeImage(p, 'Tạo ảnh AI (DEMO)');
  const bg = await nodeImage(p, 'Nền & bối cảnh');
  if (!gen || !bg) fail(`T2-${tc.id}: gen/background outputs missing`);
  const isDark = gen.median[0] < 110 && gen.median[1] < 110;
  if (tc.dark && !isDark) fail(`T2-${tc.id}: gen output must stay the DARK product, median ${gen.median.join(',')}`);
  if (!tc.dark && isDark) fail(`T2-${tc.id}: gen output must stay the LIGHT product, median ${gen.median.join(',')}`);
  const bgDark = bg.median[0] < 120 && bg.median[1] < 120;
  if (tc.dark !== bgDark) fail(`T2-${tc.id}: background-chain output must keep the product colour, median ${bg.median.join(',')}`);
  writeFileSync(RESULTS_DIR + `tpl2-${tc.id}.png`, Buffer.from(bg.bytes));
  if (tc.id === 'printed') {
    const eq = await designRegionEqual(p, 'Tạo ảnh AI (DEMO)', PRINTED_B64);
    if (!eq.ok) fail(`T2-printed: Template 2's gen output must be the product photo itself in the design region: ${JSON.stringify(eq)}`);
  }
  await checkClean(p, errors, width);
  results.push({ phase: 'T2-' + tc.id, width, genMedian: gen.median.join(','), bgMedian: bg.median.join(',') });
  await ctx.close();
}

// ---------- Phase CF46: identity-first prompt + QC fallback ----------
{
  const width = 1366; const { ctx, p, errors, state } = await newPage(width, { worker: true });
  await p.click('[data-template="tpl1"]');
  await p.waitForFunction(() => document.querySelectorAll('.ais-node').length === 8);
  await openProvider(p);
  await checkId(p, '#ais-real-switch');
  await p.selectOption('#ais-provider-kind', 'cloudflare');
  await p.waitForSelector('#ais-cf-url', { state: 'visible', timeout: 10000 });
  await fillChange(p, '#ais-cf-url', WORKER);
  await fillChange(p, '#ais-cf-key', 'app_key_test_p46');
  await checkId(p, '#ais-cf-confirm');
  await p.waitForFunction(() => document.querySelector('#ais-provider-status')?.textContent.includes('AI THẬT đang bật: Cloudflare'), null, { timeout: 10000 }).catch(() => fail('CF46: provider did not activate'));
  await closeProvider(p);
  await setFixture(p, BLACK);
  await runBtn(p, width);
  await p.waitForSelector('#ais-cost-dialog', { state: 'visible', timeout: 15000 }).catch(() => fail('CF46: Neuron dialog did not appear'));
  await p.click('#ais-cost-accept');
  await p.waitForFunction(() => /Lượt chạy gần nhất/.test(document.querySelector('#ais-run-progress')?.textContent || ''), null, { timeout: 120000 }).catch(() => fail('CF46: run did not finish'));
  if (state.worker.length !== 1) fail('CF46: expected exactly 1 Worker call, got ' + state.worker.length);
  const call = state.worker[0];
  if (call.url !== WORKER + '/run/' + KLEIN) fail('CF46: wrong Worker URL ' + call.url);
  const promptPart = extractPart(call.body, call.headers['content-type'], 'prompt');
  if (!promptPart) fail('CF46: multipart body has no prompt part');
  const promptText = promptPart.toString('utf8');
  const iIdentity = promptText.indexOf('[1] PRODUCT IDENTITY');
  const iScene = promptText.indexOf('[3] SCENE');
  if (iIdentity === -1 || iScene === -1 || iIdentity > iScene) fail('CF46: the sent prompt must open with [1] PRODUCT IDENTITY before [3] SCENE: ' + promptText.slice(0, 300));
  if (!promptText.includes('Do not replace the black T-shirt with any other garment')) fail('CF46: the sent prompt must forbid replacing the black product: ' + promptText.slice(0, 400));
  if (!promptText.includes('No white shirt')) fail('CF46: the negative section must be colour-aware (No white shirt for a black product)');
  const imgPart = extractPart(call.body, call.headers['content-type'], 'input_image_0');
  if (!imgPart) fail('CF46: multipart body has no input_image_0 part — the reference bytes were not uploaded');
  // QC: the mock returned a WHITE garment for the BLACK product -> the
  // strict composition must refuse it and composite onto the ORIGINAL
  // product photo instead.
  const comp = await nodeImage(p, 'Ghép hình in lên áo');
  if (!comp || !(comp.median[0] < 95 && comp.median[1] < 95)) fail('CF46: after the QC fallback the composite must be built on the DARK product photo, median ' + (comp && comp.median.join(',')));
  const text = await bodyText(p);
  if (!text.includes('lệch màu sản phẩm (QC) — đã ghép lên CHÍNH ẢNH SẢN PHẨM GỐC')) fail('CF46: the composition label must state the QC fallback to the original product photo');
  const hist = await p.evaluate(() => document.querySelector('#ais-history-list')?.innerText || '');
  if (!hist.includes('QC') || !hist.includes('LỆCH MÀU')) fail('CF46: the run history must record the QC colour warning: ' + hist.slice(0, 300));
  await checkClean(p, errors, width);
  results.push({ phase: 'CF46', width, promptIdentityFirst: true, qcFallback: 'original-photo', compMedian: comp.median.join(',') });
  await ctx.close();
}

// ---------- Phase TEXTONLY46: text-only models refuse a wired reference ----------
{
  const width = 1366;
  { // keyed flux (text-only) + black fixture
    const { ctx, p, errors, state } = await newPage(width, { keyed: true });
    await p.click('[data-template="tpl1"]');
    await p.waitForFunction(() => document.querySelectorAll('.ais-node').length === 8);
    await openProvider(p);
    await checkId(p, '#ais-real-switch');
    await p.selectOption('#ais-provider-kind', 'pollinations');
    await p.waitForSelector('#ais-provider-key', { state: 'visible', timeout: 10000 });
    await fillChange(p, '#ais-provider-key', 'sk_test_p46');
    await checkId(p, '#ais-keyed-confirm');
    await p.selectOption('#ais-provider-model', 'flux');
    await p.waitForFunction(() => document.querySelector('#ais-provider-status')?.textContent.includes('AI THẬT đang bật: Pollinations'), null, { timeout: 10000 }).catch(() => fail('TEXTONLY46: keyed provider did not activate'));
    await closeProvider(p);
    await setFixture(p, BLACK);
    await runBtn(p, width);
    // the cost dialog still lists the planned call; accepting it must
    // not produce a request — the node refuses before calling.
    await p.waitForSelector('#ais-cost-dialog', { state: 'visible', timeout: 15000 }).catch(() => fail('TEXTONLY46: cost dialog did not appear'));
    await p.click('#ais-cost-accept');
    await p.waitForFunction(() => /Lượt chạy gần nhất/.test(document.querySelector('#ais-run-progress')?.textContent || ''), null, { timeout: 120000 }).catch(() => fail('TEXTONLY46: run did not finish'));
    if (state.keyed.length !== 0) fail('TEXTONLY46: flux with a wired reference must send ZERO generation requests, got ' + state.keyed.length);
    if (!/st-error/.test(await nodeClass(p, 'Tạo ảnh AI (DEMO)'))) fail('TEXTONLY46: gen must ERROR for a text-only model with a wired reference');
    const errText = await p.evaluate(() => [...document.querySelectorAll('.ais-node')].find(e => e.querySelector('header strong')?.textContent === 'Tạo ảnh AI (DEMO)')?.querySelector('.nerr')?.textContent || '');
    if (!/chỉ tạo ảnh từ chữ/.test(errText)) fail('TEXTONLY46: the error must explain the model is text-only: ' + errText);
    await checkClean(p, errors, width);
    results.push({ phase: 'TEXTONLY46-keyed-flux', width, generationRequests: 0 });
    await ctx.close();
  }
  { // Classic sana (text-only) + black fixture
    const { ctx, p, errors, state } = await newPage(width, { classic: true });
    await p.click('[data-template="tpl1"]');
    await p.waitForFunction(() => document.querySelectorAll('.ais-node').length === 8);
    await openProvider(p);
    await checkId(p, '#ais-real-switch');
    await p.selectOption('#ais-provider-kind', 'pollinations-classic');
    await p.waitForFunction(() => document.querySelector('#ais-provider-status')?.textContent.includes('Pollinations Classic'), null, { timeout: 10000 }).catch(() => fail('TEXTONLY46: classic provider did not activate'));
    await closeProvider(p);
    await setFixture(p, BLACK);
    await runAndWait(p, width, 'TEXTONLY46-classic');
    if (state.classic.length !== 0) fail('TEXTONLY46: sana with a wired reference must send ZERO requests, got ' + state.classic.length);
    if (!/st-error/.test(await nodeClass(p, 'Tạo ảnh AI (DEMO)'))) fail('TEXTONLY46: sana gen must ERROR with a wired reference');
    await checkClean(p, errors, width);
    results.push({ phase: 'TEXTONLY46-classic', width, generationRequests: 0 });
    await ctx.close();
  }
}

// ---------- Phase LEGACY46: a meta-less old project gains the wires ----------
{
  const width = 430; const { ctx, p, errors } = await newPage(width);
  await p.evaluate(async () => {
    const core = await import('/src/ai-studio/core.js');
    const st = await import('/src/ai-studio/store.js');
    const g = core.TEMPLATES.find(t => t.id === 'tpl1').make();
    const by = (t) => g.nodes.find(n => n.type === t);
    // Strip to the pre-P4.5 shape: NO meta stamp, NO img->gen wire,
    // NO img->pa wire, the white hanger pre-selected — the exact graph
    // shape behind the owner's black-in/white-out report.
    g.edges = g.edges.filter(e => !(e.from === by('imageInput').id && (e.to === by('aiImageGen').id || e.to === by('promptAssistant').id)));
    delete g.meta;
    by('imageInput').config.fixture = 'public/fixtures/real-tee/crew-white-hanger.webp';
    await st.store.saveProject({ id: 'legacy-p46', name: 'Dự án cũ không dấu mẫu (P4.6)', graph: g, updatedAt: Date.now() + 5000 });
  });
  await p.reload();
  await p.waitForSelector('body[data-ready=true]');
  await p.waitForFunction(() => document.querySelectorAll('.ais-node').length === 8, null, { timeout: 20000 }).catch(() => fail('LEGACY46: the seeded legacy project did not reopen'));
  const domEdges = await p.evaluate(() => document.querySelectorAll('.ais-edge').length);
  if (domEdges !== 8) fail('LEGACY46: the meta-less project must GAIN both reference wires on load (8 edges), got ' + domEdges);
  await setFixture(p, BLACK);
  await runAndWait(p, width, 'LEGACY46');
  const comp = await nodeImage(p, 'Ghép hình in lên áo');
  if (!comp || !(comp.median[0] < 95 && comp.median[1] < 95)) fail('LEGACY46: the legacy project with a BLACK product must now produce the DARK composite (the owner bug), median ' + (comp && comp.median.join(',')));
  await checkClean(p, errors, width);
  results.push({ phase: 'LEGACY46', width, wiresAddedOnLoad: true, compMedian: comp.median.join(',') });
  await ctx.close();
}

console.log(JSON.stringify(results, null, 2));
console.log('AI-STUDIO-P46: PASS');
await b.close();
