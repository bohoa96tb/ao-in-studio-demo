/**
 * AI Studio P4.5 browser checks (Playwright, server scripts/serve.mjs :5264).
 * Bug under test (owner report 2026-11-15): changing the Ảnh đầu vào
 * image in Mẫu 1 / Mẫu 2 did not change the result — Template 1 shipped
 * the node unwired, and cache keys hashed config strings, never image
 * content. Every provider endpoint is MOCKED — this suite never calls a
 * real Pollinations or Worker URL.
 *  WIRE (430)     Templates 1+2 ship imageInput -> aiImageGen's
 *                 'image / reference_image' port; Mẫu 1 ships with NO
 *                 image selected (its no-reference DEMO path intact).
 *  DEMO-T1 (430)  Fresh Mẫu 1: empty input -> approved AI base result;
 *                 pick black fixture A -> gen Cache MISS (reason names
 *                 the input image), composite is the DARK photo; swap
 *                 to white fixture B -> MISS again, composite LIGHT and
 *                 different; run unchanged -> gen Cache HIT; save +
 *                 reload -> the wire persisted and the reopened project
 *                 still produces the B result (no stale A/base result).
 *  DEMO-T2 (430)  Mẫu 2: A (black) vs B (white) drive the generation
 *                 preview AND the background/export chain.
 *  CF (1366)      Cloudflare klein with a wired fixture: the multipart
 *                 request's input_image_0 part, extracted byte-for-byte,
 *                 decodes to fixture B (800x1200, light); after swapping
 *                 to A the payload is A (1200x800, dark) — the request
 *                 really carries the selected image's bytes.
 *  KEYED (1366)   Pollinations kontext + a shop fixture input: the
 *                 request URL carries image=<the fixture's public URL>.
 *                 With an UPLOADED local file instead: the gen node
 *                 fails with the honest no-public-URL Vietnamese error
 *                 and ZERO generation requests are made.
 *  CLASSIC (1366) sana + a wired image: generation proceeds text-only
 *                 and the node log says plainly the reference is not
 *                 supported and was not sent anywhere.
 */
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const url = process.env.TEST_URL || 'http://127.0.0.1:5264';
const WORKER = 'https://ai-proxy.test.workers.dev';
const KLEIN = '@cf/black-forest-labs/flux-2-klein-4b';
const BLACK = 'public/fixtures/real-tee/crew-black-hanger.webp';
const WHITE = 'public/fixtures/real-tee/crew-white-hanger.webp';
const RESULTS_DIR = fileURLToPath(new URL('../../../p45-results/', import.meta.url));
mkdirSync(RESULTS_DIR, { recursive: true });
const fail = (m) => { throw new Error('AI-STUDIO-P45: ' + m); };
const b = await chromium.launch();
const results = [];

/** A plausible 1024x1536 garment PNG (passes the framing guard) used as
 * every mocked provider's return image. */
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
  // The provider NOT under test in a phase must stay silent.
  if (!mocks.keyed) await ctx.route('**://gen.pollinations.ai/**', (route) => route.abort());
  if (!mocks.classic) await ctx.route('**://image.pollinations.ai/**', (route) => route.abort());
  const p = await ctx.newPage();
  const errors = []; p.on('pageerror', e => errors.push(e.message));
  p.on('dialog', d => d.accept());
  await p.goto(url + '/studio.html?v=aistudio45');
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
async function nodeImage(p, title) {
  return p.evaluate(async (t) => {
    const el = [...document.querySelectorAll('.ais-node')].find(e => e.querySelector('header strong')?.textContent === t);
    const img = el?.querySelector('img.nthumb');
    if (!img) return null;
    await img.decode().catch(() => {});
    const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
    const x = c.getContext('2d'); x.drawImage(img, 0, 0);
    const d = x.getImageData(0, 0, c.width, c.height).data;
    let h = 0x811c9dc5, lum = 0, n = 0;
    for (let i = 0; i < d.length; i += 4) { h ^= d[i]; h = Math.imul(h, 0x01000193); h ^= d[i + 1]; h = Math.imul(h, 0x01000193); lum += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]; n++; }
    const blob = await new Promise(r => c.toBlob(r, 'image/png'));
    return { w: c.width, h: c.height, hash: (h >>> 0).toString(16), meanLum: Math.round(lum / n), bytes: Array.from(new Uint8Array(await blob.arrayBuffer())) };
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
async function measureBytes(p, buf) {
  return p.evaluate(async (b64str) => {
    const bin = atob(b64str); const arr = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    const u = URL.createObjectURL(new Blob([arr], { type: 'image/png' }));
    const img = new Image(); await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = u; });
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
    const x = c.getContext('2d'); x.drawImage(img, 0, 0);
    const d = x.getImageData(0, 0, c.width, c.height).data;
    let lum = 0, n = 0; for (let i = 0; i < d.length; i += 4) { lum += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]; n++; }
    return { w: c.width, h: c.height, meanLum: Math.round(lum / n) };
  }, buf.toString('base64'));
}

// ---------- Phase WIRE: shipped wiring + port label + empty Mẫu 1 input ----------
{
  const width = 430; const { ctx, p, errors } = await newPage(width);
  const core = await p.evaluate(async () => {
    const m = await import('/src/ai-studio/core.js');
    const shape = (id) => {
      const g = m.TEMPLATES.find(t => t.id === id).make();
      const by = (t) => g.nodes.find(n => n.type === t);
      return {
        wire: g.edges.some(e => e.from === by('imageInput').id && e.to === by('aiImageGen').id && e.toPort === 'image'),
        fixture: by('imageInput').config.fixture, edges: g.edges.length, nodes: g.nodes.length,
        portLabel: m.NODE_DEFS.aiImageGen.inputs.find(i => i.id === 'image').label,
      };
    };
    return { tpl1: shape('tpl1'), tpl2: shape('tpl2'), build: m.AI_STUDIO_BUILD };
  });
  if (!core.tpl1.wire || !core.tpl2.wire) fail('WIRE: both templates must ship imageInput -> aiImageGen.image: ' + JSON.stringify(core));
  if (core.tpl1.fixture !== '') fail('WIRE: Mẫu 1 must ship with NO image selected, got fixture ' + core.tpl1.fixture);
  if (core.tpl1.portLabel !== 'image / reference_image') fail('WIRE: port label wrong: ' + core.tpl1.portLabel);
  if (core.build !== 'p45') fail('WIRE: AI_STUDIO_BUILD must be p45, got ' + core.build);
  await p.click('[data-template="tpl1"]');
  await p.waitForFunction(() => document.querySelectorAll('.ais-node').length === 8);
  const domEdges1 = await p.evaluate(() => document.querySelectorAll('.ais-edge').length);
  if (domEdges1 !== 7) fail('WIRE: Mẫu 1 must render 7 edges (incl. the reference wire), got ' + domEdges1);
  const portLabelDom = await p.evaluate(() => { const el = [...document.querySelectorAll('.ais-node')].find(e => e.querySelector('header strong')?.textContent === 'Tạo ảnh AI (DEMO)'); return [...el.querySelectorAll('.plabel.in')].map(s => s.textContent); });
  if (!portLabelDom.some(t => t.includes('image / reference_image'))) fail('WIRE: reference port label not rendered on the node: ' + JSON.stringify(portLabelDom));
  await p.click('[data-template="tpl2"]');
  await p.waitForFunction(() => document.querySelectorAll('.ais-node').length === 7);
  const domEdges2 = await p.evaluate(() => document.querySelectorAll('.ais-edge').length);
  if (domEdges2 !== 6) fail('WIRE: Mẫu 2 must render 6 edges, got ' + domEdges2);
  await checkClean(p, errors, width);
  results.push({ phase: 'WIRE', width, tpl1Wire: true, tpl2Wire: true, tpl1ShipsEmpty: true });
  await ctx.close();
}

// ---------- Phase DEMO-T1: the input image drives Mẫu 1 in DEMO ----------
{
  const width = 430; const { ctx, p, errors } = await newPage(width);
  await p.click('[data-template="tpl1"]');
  await p.waitForFunction(() => document.querySelectorAll('.ais-node').length === 8);
  await p.fill('#ais-project-name', 'P4.5 Mẫu 1 DEMO');
  await p.locator('#ais-project-name').dispatchEvent('change');
  // Run 0 — NO image selected: the approved AI-model base path, unchanged.
  await runAndWait(p, width, 'DEMO-T1 run0');
  const base = await nodeImage(p, 'Ghép hình in lên áo');
  if (!base || base.w !== 900 || base.h !== 1350) fail(`DEMO-T1: empty-input composite must stay on the approved AI base (900x1350), got ${base && base.w + 'x' + base.h}`);
  // Run A — black fixture: gen must MISS (input-image reason) and the
  // composite must BE the black photo (dark), not the approved base.
  await setFixture(p, BLACK);
  await runAndWait(p, width, 'DEMO-T1 runA');
  if (!/st-success/.test(await nodeClass(p, 'Tạo ảnh AI (DEMO)'))) fail('DEMO-T1: gen must succeed (not cached) after picking image A');
  const logsA = await logTexts(p);
  if (!logsA.some(t => t.includes('Tạo ảnh AI') && t.includes('Cache MISS') && t.includes('ảnh đầu vào'))) fail('DEMO-T1: gen miss log must name the input image as the reason: ' + logsA.slice(0, 6).join(' || '));
  const compA = await nodeImage(p, 'Ghép hình in lên áo');
  if (!compA || compA.w !== 900 || compA.h !== 600) fail(`DEMO-T1: composite with A must be built on the black hanger photo (900x600), got ${compA && compA.w + 'x' + compA.h}`);
  if (compA.meanLum > 150) fail('DEMO-T1: composite with the BLACK input must be dark-dominant, meanLum ' + compA.meanLum);
  writeFileSync(RESULTS_DIR + 'tpl1-demo-A.png', Buffer.from(compA.bytes));
  // Run B — white fixture: MISS again, light result, different hash.
  await setFixture(p, WHITE);
  await runAndWait(p, width, 'DEMO-T1 runB');
  if (!/st-success/.test(await nodeClass(p, 'Tạo ảnh AI (DEMO)'))) fail('DEMO-T1: gen must re-run after swapping A -> B');
  const compB = await nodeImage(p, 'Ghép hình in lên áo');
  if (!compB || compB.w !== 800 || compB.h !== 1200) fail(`DEMO-T1: composite with B must be built on the white hanger photo (800x1200), got ${compB && compB.w + 'x' + compB.h}`);
  if (compB.meanLum < 180) fail('DEMO-T1: composite with the WHITE input must be light-dominant, meanLum ' + compB.meanLum);
  if (compB.hash === compA.hash) fail('DEMO-T1: swapping the input image did not change the composite');
  writeFileSync(RESULTS_DIR + 'tpl1-demo-B.png', Buffer.from(compB.bytes));
  // Run B again, unchanged: valid cache — gen HIT, no regeneration.
  await runAndWait(p, width, 'DEMO-T1 runB2');
  if (!/st-cached/.test(await nodeClass(p, 'Tạo ảnh AI (DEMO)'))) fail('DEMO-T1: unchanged re-run must serve aiImageGen from cache');
  const logsB2 = await logTexts(p);
  if (!logsB2.some(t => t.includes('Tạo ảnh AI') && t.includes('Cache HIT'))) fail('DEMO-T1: unchanged re-run must log a Cache HIT for gen');
  // Save + reload: the wire persists in the project JSON and the
  // reopened project still yields the B result — never a stale one.
  await p.waitForTimeout(1200); // let the autosave draft settle before the explicit save
  await p.click('#ais-save');
  await p.waitForFunction(() => document.querySelector('#ais-save-status')?.textContent.includes('Đã lưu'), null, { timeout: 15000 }).catch(() => fail('DEMO-T1: save did not complete'));
  await p.reload();
  await p.waitForSelector('body[data-ready=true]');
  await p.waitForFunction(() => document.querySelectorAll('.ais-node').length === 8, null, { timeout: 20000 }).catch(() => fail('DEMO-T1: saved project did not reopen after reload'));
  const domEdges = await p.evaluate(() => document.querySelectorAll('.ais-edge').length);
  if (domEdges !== 7) fail('DEMO-T1: the reference wire must survive save + reload, edges ' + domEdges);
  await runAndWait(p, width, 'DEMO-T1 runReload');
  const compR = await nodeImage(p, 'Ghép hình in lên áo');
  if (!compR || compR.hash !== compB.hash) fail(`DEMO-T1: after reload the result must be the B result (${compB.hash}), got ${compR && compR.hash}`);
  await checkClean(p, errors, width);
  results.push({ phase: 'DEMO-T1', width, emptyBase: '900x1350', compA: compA.w + 'x' + compA.h + ' lum' + compA.meanLum, compB: compB.w + 'x' + compB.h + ' lum' + compB.meanLum, cacheHitOnUnchanged: true, wirePersisted: true });
  await ctx.close();
}

// ---------- Phase DEMO-T2: the input image drives Mẫu 2 in DEMO ----------
{
  const width = 430; const { ctx, p, errors } = await newPage(width);
  await p.click('[data-template="tpl2"]');
  await p.waitForFunction(() => document.querySelectorAll('.ais-node').length === 7);
  await setFixture(p, BLACK);
  await runAndWait(p, width, 'DEMO-T2 runA');
  const genA = await nodeImage(p, 'Tạo ảnh AI (DEMO)');
  const bgA = await nodeImage(p, 'Nền & bối cảnh');
  if (!genA || !bgA) fail('DEMO-T2: gen/background outputs missing with A');
  if (genA.meanLum > 150) fail('DEMO-T2: gen output with the BLACK input must be dark-dominant, meanLum ' + genA.meanLum);
  writeFileSync(RESULTS_DIR + 'tpl2-demo-A.png', Buffer.from(bgA.bytes));
  await setFixture(p, WHITE);
  await runAndWait(p, width, 'DEMO-T2 runB');
  if (!/st-success/.test(await nodeClass(p, 'Tạo ảnh AI (DEMO)'))) fail('DEMO-T2: gen must re-run after swapping A -> B');
  const logs = await logTexts(p);
  if (!logs.some(t => t.includes('Tạo ảnh AI') && t.includes('Cache MISS') && t.includes('ảnh đầu vào'))) fail('DEMO-T2: gen miss log must name the input image: ' + logs.slice(0, 6).join(' || '));
  const genB = await nodeImage(p, 'Tạo ảnh AI (DEMO)');
  const bgB = await nodeImage(p, 'Nền & bối cảnh');
  if (!genB || !bgB) fail('DEMO-T2: gen/background outputs missing with B');
  if (genB.meanLum < 170) fail('DEMO-T2: gen output with the WHITE input must be light-dominant, meanLum ' + genB.meanLum);
  if (genB.hash === genA.hash) fail('DEMO-T2: gen output did not change when the input image changed');
  if (bgB.hash === bgA.hash) fail('DEMO-T2: the background/export chain did not update when the input image changed');
  writeFileSync(RESULTS_DIR + 'tpl2-demo-B.png', Buffer.from(bgB.bytes));
  await runAndWait(p, width, 'DEMO-T2 runB2');
  if (!/st-cached/.test(await nodeClass(p, 'Tạo ảnh AI (DEMO)'))) fail('DEMO-T2: unchanged re-run must serve aiImageGen from cache');
  await checkClean(p, errors, width);
  results.push({ phase: 'DEMO-T2', width, genA: 'lum' + genA.meanLum, genB: 'lum' + genB.meanLum, bgChainUpdated: true, cacheHitOnUnchanged: true });
  await ctx.close();
}

// ---------- Phase CF: klein's multipart really carries the wired image bytes ----------
{
  const width = 1366; const { ctx, p, errors, state } = await newPage(width, { worker: true });
  await p.click('[data-template="tpl1"]');
  await p.waitForFunction(() => document.querySelectorAll('.ais-node').length === 8);
  await openProvider(p);
  await checkId(p, '#ais-real-switch');
  await p.selectOption('#ais-provider-kind', 'cloudflare');
  await p.waitForSelector('#ais-cf-url', { state: 'visible', timeout: 10000 });
  await fillChange(p, '#ais-cf-url', WORKER);
  await fillChange(p, '#ais-cf-key', 'app_key_test_p45');
  await checkId(p, '#ais-cf-confirm');
  await p.waitForFunction(() => document.querySelector('#ais-provider-status')?.textContent.includes('AI THẬT đang bật: Cloudflare'), null, { timeout: 10000 }).catch(() => fail('CF: provider did not activate'));
  await closeProvider(p);
  // B (white, 800x1200) wired -> the request payload must decode to B.
  await setFixture(p, WHITE);
  await runBtn(p, width);
  await p.waitForSelector('#ais-cost-dialog', { state: 'visible', timeout: 15000 }).catch(() => fail('CF: Neuron dialog did not appear'));
  await p.click('#ais-cost-accept');
  await p.waitForFunction((prev) => { const t = document.querySelector('#ais-run-progress')?.textContent || ''; return t.includes('Lượt chạy gần nhất'); }, null, { timeout: 120000 }).catch(() => fail('CF: run B did not finish'));
  if (state.worker.length !== 1) fail('CF: expected exactly 1 Worker call, got ' + state.worker.length);
  const callB = state.worker[0];
  if (callB.url !== WORKER + '/run/' + KLEIN) fail('CF: wrong Worker URL ' + callB.url);
  const partB = extractPart(callB.body, callB.headers['content-type'], 'input_image_0');
  if (!partB) fail('CF: multipart body has no input_image_0 part — the wired image was not uploaded');
  const measB = await measureBytes(p, partB);
  if (measB.w !== 800 || measB.h !== 1200) fail(`CF: input_image_0 must be fixture B at 800x1200, got ${measB.w}x${measB.h}`);
  if (measB.meanLum < 180) fail('CF: input_image_0 must be the WHITE fixture (light), meanLum ' + measB.meanLum);
  // A (black, 1200x800) wired -> the payload must become A, byte-different.
  await setFixture(p, BLACK);
  await runBtn(p, width);
  await p.waitForSelector('#ais-cost-dialog', { state: 'visible', timeout: 15000 }).catch(() => fail('CF: Neuron dialog did not re-appear'));
  await p.click('#ais-cost-accept');
  await p.waitForFunction(() => document.querySelectorAll('#ais-log li').length > 0 && /Lượt chạy gần nhất/.test(document.querySelector('#ais-run-progress')?.textContent || ''), null, { timeout: 120000 }).catch(() => fail('CF: run A did not finish'));
  if (state.worker.length !== 2) fail('CF: expected exactly 2 Worker calls total, got ' + state.worker.length);
  const partA = extractPart(state.worker[1].body, state.worker[1].headers['content-type'], 'input_image_0');
  if (!partA) fail('CF: second call has no input_image_0 part');
  if (partA.equals(partB)) fail('CF: the uploaded bytes did not change when the input image changed');
  const measA = await measureBytes(p, partA);
  if (measA.w !== 1200 || measA.h !== 800) fail(`CF: input_image_0 after the swap must be fixture A at 1200x800, got ${measA.w}x${measA.h}`);
  if (measA.meanLum > 150) fail('CF: input_image_0 after the swap must be the BLACK fixture (dark), meanLum ' + measA.meanLum);
  await checkClean(p, errors, width);
  results.push({ phase: 'CF', width, payloadB: measB.w + 'x' + measB.h + ' lum' + measB.meanLum, payloadA: measA.w + 'x' + measA.h + ' lum' + measA.meanLum, bytesChangedOnSwap: true });
  await ctx.close();
}

// ---------- Phase KEYED: kontext gets the fixture URL; an upload errors honestly ----------
{
  const width = 1366;
  const configureKeyed = async (p, model) => {
    await openProvider(p);
    await checkId(p, '#ais-real-switch');
    await p.selectOption('#ais-provider-kind', 'pollinations');
    await p.waitForSelector('#ais-provider-key', { state: 'visible', timeout: 10000 });
    await fillChange(p, '#ais-provider-key', 'sk_test_p45');
    await checkId(p, '#ais-keyed-confirm');
    await p.selectOption('#ais-provider-model', model);
    await p.waitForFunction(() => document.querySelector('#ais-provider-status')?.textContent.includes('AI THẬT đang bật: Pollinations'), null, { timeout: 10000 }).catch(() => fail('KEYED: provider did not activate'));
    await closeProvider(p);
  };
  { // fixture input -> image= URL parameter on the real request
    const { ctx, p, errors, state } = await newPage(width, { keyed: true });
    await p.click('[data-template="tpl1"]');
    await p.waitForFunction(() => document.querySelectorAll('.ais-node').length === 8);
    await configureKeyed(p, 'kontext');
    await setFixture(p, WHITE);
    await runBtn(p, width);
    await p.waitForSelector('#ais-cost-dialog', { state: 'visible', timeout: 15000 }).catch(() => fail('KEYED: cost dialog did not appear'));
    await p.click('#ais-cost-accept');
    await p.waitForFunction(() => /Lượt chạy gần nhất/.test(document.querySelector('#ais-run-progress')?.textContent || ''), null, { timeout: 120000 }).catch(() => fail('KEYED: run did not finish'));
    if (state.keyed.length !== 1) fail('KEYED: expected exactly 1 generation request, got ' + state.keyed.length + ': ' + state.keyed.join(' | '));
    const u = new URL(state.keyed[0]);
    if (u.searchParams.get('model') !== 'kontext') fail('KEYED: request must target kontext: ' + state.keyed[0]);
    const imgParam = u.searchParams.get('image');
    const expected = url + '/' + WHITE;
    if (imgParam !== expected) fail(`KEYED: image parameter must be the fixture's public URL (${expected}), got ${imgParam}`);
    if (!/st-success/.test(await nodeClass(p, 'Tạo ảnh AI (DEMO)'))) fail('KEYED: gen must succeed with a public-URL reference');
    await checkClean(p, errors, width);
    results.push({ phase: 'KEYED-FIXTURE', width, imageParamPassed: true });
    await ctx.close();
  }
  { // uploaded local file -> honest error, zero generation requests
    const { ctx, p, errors, state } = await newPage(width, { keyed: true });
    await p.click('[data-template="tpl1"]');
    await p.waitForFunction(() => document.querySelectorAll('.ais-node').length === 8);
    await configureKeyed(p, 'kontext');
    const node = p.locator('.ais-node', { hasText: 'Ảnh đầu vào' }).first();
    await node.click();
    await p.waitForSelector('#pf-file', { state: 'visible' });
    const fixturePath = fileURLToPath(new URL('../public/fixtures/real-tee/crew-black-hanger.webp', import.meta.url));
    await p.setInputFiles('#pf-file', fixturePath);
    await p.waitForFunction(() => document.querySelector('#ais-properties')?.textContent.includes('crew-black-hanger.webp'), null, { timeout: 15000 }).catch(() => fail('KEYED-UPLOAD: upload did not register'));
    await runBtn(p, width);
    await p.waitForSelector('#ais-cost-dialog', { state: 'visible', timeout: 15000 }).catch(() => fail('KEYED-UPLOAD: cost dialog did not appear'));
    await p.click('#ais-cost-accept');
    await p.waitForFunction(() => /Lượt chạy gần nhất/.test(document.querySelector('#ais-run-progress')?.textContent || ''), null, { timeout: 120000 }).catch(() => fail('KEYED-UPLOAD: run did not finish'));
    if (!/st-error/.test(await nodeClass(p, 'Tạo ảnh AI (DEMO)'))) fail('KEYED-UPLOAD: gen must ERROR honestly for a local-blob reference');
    const errText = await p.evaluate(() => [...document.querySelectorAll('.ais-node')].find(e => e.querySelector('header strong')?.textContent === 'Tạo ảnh AI (DEMO)')?.querySelector('.nerr')?.textContent || '');
    if (!/chưa có URL công khai/.test(errText)) fail('KEYED-UPLOAD: error must state the missing public URL: ' + errText);
    if (state.keyed.length !== 0) fail('KEYED-UPLOAD: zero generation requests allowed, got ' + state.keyed.length);
    await checkClean(p, errors, width);
    results.push({ phase: 'KEYED-UPLOAD', width, honestError: true, generationRequests: 0 });
    await ctx.close();
  }
}

// ---------- Phase CLASSIC: sana ignores the reference — and says so ----------
{
  const width = 1366; const { ctx, p, errors, state } = await newPage(width, { classic: true });
  await p.click('[data-template="tpl1"]');
  await p.waitForFunction(() => document.querySelectorAll('.ais-node').length === 8);
  await openProvider(p);
  await checkId(p, '#ais-real-switch');
  await p.selectOption('#ais-provider-kind', 'pollinations-classic');
  await p.waitForFunction(() => document.querySelector('#ais-provider-status')?.textContent.includes('Pollinations Classic'), null, { timeout: 10000 }).catch(() => fail('CLASSIC: provider did not activate'));
  await closeProvider(p);
  await setFixture(p, WHITE);
  await runAndWait(p, width, 'CLASSIC');
  if (state.classic.length !== 1) fail('CLASSIC: expected exactly 1 Classic request, got ' + state.classic.length);
  if (/[?&]image=/.test(state.classic[0])) fail('CLASSIC: sana must never receive an image parameter: ' + state.classic[0]);
  if (!/st-success/.test(await nodeClass(p, 'Tạo ảnh AI (DEMO)'))) fail('CLASSIC: gen must succeed text-only');
  const logs = await logTexts(p);
  if (!logs.some(t => t.includes('Tạo ảnh AI') && t.includes('không hỗ trợ ảnh tham chiếu') && t.includes('KHÔNG bị gửi đi đâu'))) fail('CLASSIC: the node log must state plainly that the reference is unsupported and was not sent: ' + logs.slice(0, 8).join(' || '));
  await checkClean(p, errors, width);
  results.push({ phase: 'CLASSIC', width, textOnly: true, plainlyLogged: true });
  await ctx.close();
}

console.log(JSON.stringify(results, null, 2));
console.log('AI-STUDIO-P45: PASS');
await b.close();
