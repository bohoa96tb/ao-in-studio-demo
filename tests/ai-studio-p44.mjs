/**
 * AI Studio P4.4 browser checks (Playwright, server scripts/serve.mjs :5264).
 * The Cloudflare Worker Proxy is MOCKED via route interception — this
 * suite never calls a real Worker URL (and never a real Pollinations
 * endpoint either):
 *  PANEL (430)   Provider switching Pollinations <-> Cloudflare swaps the
 *                fields + model lists; Cloudflare without a Worker URL is
 *                blocked with an explanation; key placeholder behaviour.
 *  RUN (1366)    Template 1 with Cloudflare selected: trailing-slash URL
 *                is trimmed, the Neuron confirmation dialog appears
 *                (Cancel -> zero Worker calls), Accept -> exactly 1 POST
 *                to ${worker}/run/@cf/black-forest-labs/flux-2-klein-4b
 *                with the X-App-Key header and a multipart prompt; the
 *                run completes, history records provider/model + Neurons
 *                (never Pollen), the composite is saved as a deliverable,
 *                and a reload proves nothing was persisted.
 *  RESUME (1366) Worker 500 -> gen node fails, retries forced 0 (exactly
 *                1 call); Worker recovers -> "Chạy tiếp từ node lỗi"
 *                completes the run with exactly 1 more call.
 *  GUARD (1366)  A mocked wrong-aspect (768x1024 cyan) Cloudflare output
 *                hits the P4.3 framing guard: composition falls back to
 *                the approved AI base, zero mock pixels composited.
 *  IMG2IMG (1366) Adapter-level (in-page): klein uploads input_image_0 as
 *                a PNG via multipart; schnell + image refuses with the
 *                Vietnamese guidance error and makes no request.
 */
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const url = process.env.TEST_URL || 'http://127.0.0.1:5264';
const WORKER = 'https://ai-proxy.test.workers.dev';
const KLEIN = '@cf/black-forest-labs/flux-2-klein-4b';
const SCHNELL = '@cf/black-forest-labs/flux-1-schnell';
const RESULTS_DIR = fileURLToPath(new URL('../../../p44-results/', import.meta.url));
mkdirSync(RESULTS_DIR, { recursive: true });
const fail = (m) => { throw new Error('AI-STUDIO-P44: ' + m); };
const b = await chromium.launch();
const results = [];

/** Draw the mock "Worker outputs" in a scratch page: a plausible
 * 1024x1536 garment image (passes the framing guard) and a 768x1024
 * pure-cyan close-up (fails it — cyan occurs in no base/design). */
async function makeMocks() {
  const ctx = await b.newContext();
  const p = await ctx.newPage();
  const out = await p.evaluate(async () => {
    const toB64 = async (c) => { const blob = await new Promise(r => c.toBlob(r, 'image/png')); const buf = new Uint8Array(await blob.arrayBuffer()); let s = ''; for (const x of buf) s += String.fromCharCode(x); return btoa(s); };
    const good = document.createElement('canvas'); good.width = 1024; good.height = 1536;
    const g = good.getContext('2d');
    g.fillStyle = '#e8e6e1'; g.fillRect(0, 0, 1024, 1536);
    g.fillStyle = '#d8d4cc'; g.fillRect(0, 1150, 1024, 386);
    g.fillStyle = '#eec39f'; g.beginPath(); g.arc(512, 300, 120, 0, 7); g.fill(); // head
    g.fillStyle = '#3a2a20'; g.beginPath(); g.arc(512, 262, 122, Math.PI, 0); g.fill(); // hair cap
    g.fillStyle = '#f7f5f0'; // plain tee: shoulders, sleeves, body to hem
    g.beginPath(); g.moveTo(330, 470); g.lineTo(180, 560); g.lineTo(250, 760); g.lineTo(330, 720);
    g.lineTo(330, 1250); g.lineTo(694, 1250); g.lineTo(694, 720); g.lineTo(774, 760); g.lineTo(844, 560); g.lineTo(694, 470);
    g.quadraticCurveTo(512, 540, 330, 470); g.fill();
    g.fillStyle = '#45454e'; g.fillRect(300, 1250, 424, 200); // trousers
    const bad = document.createElement('canvas'); bad.width = 768; bad.height = 1024;
    const x = bad.getContext('2d'); x.fillStyle = '#00e5ff'; x.fillRect(0, 0, 768, 1024);
    x.fillStyle = '#00b8cc'; x.beginPath(); x.arc(384, 300, 130, 0, 7); x.fill();
    return { goodB64: await toB64(good), badB64: await toB64(bad) };
  });
  await ctx.close();
  return { goodB64: out.goodB64, badB64: out.badB64, goodBuf: Buffer.from(out.goodB64, 'base64'), badBuf: Buffer.from(out.badB64, 'base64') };
}
const MOCKS = await makeMocks();

async function mockWorker(ctx, state) {
  await ctx.route(WORKER + '/**', (route) => {
    const req = route.request();
    state.calls.push({ url: req.url(), method: req.method(), headers: req.headers(), postData: (req.postDataBuffer() || Buffer.alloc(0)).toString('latin1') });
    if (state.mode === 'error') return route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ errors: [{ message: 'mock worker boom' }] }) });
    if (state.mode === 'bad34') return route.fulfill({ status: 200, contentType: 'image/png', body: MOCKS.badBuf });
    if (state.mode === 'binary') return route.fulfill({ status: 200, contentType: 'image/png', body: MOCKS.goodBuf });
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ result: { image: MOCKS.goodB64 } }) });
  });
  // No Pollinations traffic may occur in this suite at all.
  await ctx.route('**://*.pollinations.ai/**', (route) => { state.pollinations.push(route.request().url()); return route.abort(); });
}
async function newPage(width) {
  const ctx = await b.newContext({ viewport: { width, height: 950 }, hasTouch: width < 700, acceptDownloads: true });
  const state = { calls: [], pollinations: [], mode: 'json' };
  await mockWorker(ctx, state);
  const p = await ctx.newPage();
  const errors = []; p.on('pageerror', e => errors.push(e.message));
  p.on('dialog', d => d.accept());
  await p.goto(url + '/studio.html?v=aistudio44');
  await p.waitForSelector('body[data-ready=true]');
  return { ctx, p, errors, state };
}
const runBtn = (p, width) => p.click(width < 700 ? '#ais-run-mobile' : '#ais-run');
const nodeClass = (p, label) => p.evaluate((l) => { const el = [...document.querySelectorAll('.ais-node')].find(e => e.querySelector('header strong')?.textContent === l); return el ? el.className : null; }, label);
async function waitSettled(p, what) {
  await p.waitForFunction(() => { const nodes = [...document.querySelectorAll('.ais-node')]; const t = nodes.find(e => e.querySelector('header strong')?.textContent === 'Xem trước'); return t && t.className.includes('st-success') && !nodes.some(e => e.className.includes('st-running')); }, null, { timeout: 90000 }).catch(() => fail(what + ': Preview did not settle with success'));
}
async function checkClean(p, errors, width) {
  if (await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2)) fail('horizontal overflow @' + width);
  if (errors.length) fail('page errors @' + width + ': ' + errors.join(' | '));
}
async function loadTpl1(p, name) {
  await p.click('[data-template="tpl1"]');
  await p.waitForFunction(() => document.querySelectorAll('.ais-node').length === 8);
  await p.fill('#ais-project-name', name);
  await p.locator('#ais-project-name').dispatchEvent('change');
}
const openTab = (p, name) => p.click('.ais-tabs [data-tab="' + name + '"]');
async function openProvider(p) { await p.click('#ais-toggle-props'); await p.waitForSelector('#ais-real-switch', { state: 'visible' }); }
async function closeProvider(p) { await p.click('#ais-toggle-props'); }
async function checkId(p, id) { const l = p.locator(id); await l.scrollIntoViewIfNeeded(); await l.check(); }
async function fillChange(p, id, value) { const l = p.locator(id); await l.scrollIntoViewIfNeeded(); await l.fill(value); await l.dispatchEvent('change'); }
async function historyFirstText(p) {
  await openTab(p, 'history');
  await p.waitForFunction(() => document.querySelectorAll('#ais-history-list .ais-run-item').length >= 1, null, { timeout: 15000 }).catch(() => fail('no run history entry'));
  return p.locator('#ais-history-list .ais-run-item').first().textContent();
}
/** Configure the Cloudflare provider in the panel (switch + provider +
 * Worker URL + App Key + risk confirmation), the way a user does. */
async function configureCloudflare(p, workerUrl) {
  await openProvider(p);
  await checkId(p, '#ais-real-switch');
  await p.selectOption('#ais-provider-kind', 'cloudflare');
  await p.waitForSelector('#ais-cf-url', { state: 'visible', timeout: 10000 });
  await fillChange(p, '#ais-cf-url', workerUrl);
  await fillChange(p, '#ais-cf-key', 'app_key_test_p44');
  await checkId(p, '#ais-cf-confirm');
  await p.waitForFunction(() => document.querySelector('#ais-provider-status')?.textContent.includes('AI THẬT đang bật: Cloudflare'), null, { timeout: 10000 }).catch(() => fail('cloudflare provider did not activate after URL + key + confirm'));
  await closeProvider(p);
}
async function nodeImage(p, title) {
  return p.evaluate(async (t) => {
    const el = [...document.querySelectorAll('.ais-node')].find(e => e.querySelector('header strong')?.textContent === t);
    const img = el?.querySelector('img.nthumb');
    if (!img) return null;
    await img.decode().catch(() => {});
    const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
    const x = c.getContext('2d'); x.drawImage(img, 0, 0);
    const d = x.getImageData(0, 0, c.width, c.height).data;
    const blob = await new Promise(r => c.toBlob(r, 'image/png'));
    return { w: c.width, h: c.height, data: Array.from(d), bytes: Array.from(new Uint8Array(await blob.arrayBuffer())) };
  }, title);
}
function countCyan(img) {
  let n = 0;
  for (let i = 0; i < img.data.length; i += 16) { const r = img.data[i], g = img.data[i + 1], bl = img.data[i + 2]; if (Math.abs(r - 0) < 40 && Math.abs(g - 229) < 40 && Math.abs(bl - 255) < 40) n++; }
  return n;
}

// ---------- Phase PANEL: switching swaps fields + models; blocked states ----------
{
  const width = 430; const { ctx, p, errors, state } = await newPage(width);
  if ((await p.locator('#ais-mode-badge').textContent()) !== 'AI: DEMO') fail('badge should read AI: DEMO by default');
  await openProvider(p);
  await p.selectOption('#ais-provider-kind', 'cloudflare');
  await p.waitForSelector('#ais-cf-url', { state: 'visible', timeout: 10000 });
  const urlPh = await p.locator('#ais-cf-url').getAttribute('placeholder');
  if (urlPh !== 'https://ai-proxy.<subdomain>.workers.dev') fail('Worker URL placeholder wrong: ' + urlPh);
  const keyPh = await p.locator('#ais-cf-key').getAttribute('placeholder');
  if (keyPh !== 'Nhập APP_KEY bảo vệ Worker cho phiên này') fail('App Key placeholder wrong: ' + keyPh);
  const cfOpts = await p.evaluate(() => [...document.querySelectorAll('#ais-provider-model option')].map(o => ({ v: o.value, t: o.textContent, d: o.disabled })));
  if (cfOpts.length !== 2 || cfOpts[0].v !== KLEIN || cfOpts[1].v !== SCHNELL) fail('cloudflare model list wrong: ' + JSON.stringify(cfOpts));
  if (cfOpts.some(o => o.d)) fail('cloudflare models must be selectable (quota-priced, not token-blocked)');
  if (!/img2img/.test(cfOpts[0].t) || !/chỉ tạo ảnh từ chữ/.test(cfOpts[1].t)) fail('cloudflare model descriptions wrong: ' + JSON.stringify(cfOpts.map(o => o.t)));
  const selVal = await p.evaluate(() => document.querySelector('#ais-provider-model').value);
  if (selVal !== KLEIN) fail('klein must be the default selected model, got ' + selVal);
  // Blocked without a Worker URL once the master switch is on.
  await checkId(p, '#ais-real-switch');
  await p.waitForFunction(() => document.querySelector('#ais-provider-status')?.textContent.includes('BỊ KHÓA') && document.querySelector('#ais-provider-status')?.textContent.includes('Worker Proxy URL'), null, { timeout: 10000 }).catch(() => fail('cloudflare without URL should show the blocked explanation'));
  // Switch to Pollinations: CF fields disappear, Pollinations fields + models appear.
  await p.selectOption('#ais-provider-kind', 'pollinations');
  await p.waitForSelector('#ais-provider-key', { state: 'visible', timeout: 10000 });
  if (await p.locator('#ais-cf-url').count()) fail('CF URL field must disappear when Pollinations is selected');
  const poOpts = await p.evaluate(() => [...document.querySelectorAll('#ais-provider-model option')].map(o => o.textContent));
  if (!poOpts.some(t => /FLUX\.1-schnell \(flux\)/.test(t))) fail('pollinations model list did not come back: ' + poOpts.join(' | '));
  // Switch back: CF fields + CF models return.
  await p.selectOption('#ais-provider-kind', 'cloudflare');
  await p.waitForSelector('#ais-cf-url', { state: 'visible', timeout: 10000 });
  const backVal = await p.evaluate(() => document.querySelector('#ais-provider-model').value);
  if (backVal !== KLEIN) fail('switching back must restore the cloudflare model list, got ' + backVal);
  if (state.calls.length || state.pollinations.length) fail('panel phase must not call any provider');
  await checkClean(p, errors, width);
  results.push({ phase: 'PANEL', width, switching: true, blockedNoUrl: true, placeholders: true });
  await ctx.close();
}

// ---------- Phase RUN: mocked Cloudflare Template-1 run ----------
{
  const width = 1366; const { ctx, p, errors, state } = await newPage(width);
  await loadTpl1(p, 'P4.4 Cloudflare that');
  // Configure with a trailing-slash URL on purpose: the run must hit the trimmed URL.
  await openProvider(p);
  await checkId(p, '#ais-real-switch');
  await p.selectOption('#ais-provider-kind', 'cloudflare');
  await p.waitForSelector('#ais-cf-url', { state: 'visible', timeout: 10000 });
  await fillChange(p, '#ais-cf-url', WORKER + '///');
  await fillChange(p, '#ais-cf-key', 'app_key_test_p44');
  await checkId(p, '#ais-cf-confirm');
  await p.waitForFunction(() => document.querySelector('#ais-provider-status')?.textContent.includes('AI THẬT đang bật: Cloudflare'), null, { timeout: 10000 }).catch(() => fail('cloudflare did not activate'));
  // Deliverable (a): panel screenshot with Cloudflare selected + fields shown.
  const sec = p.locator('.psec:has(h4:text-is("Nhà cung cấp AI (P4.4)"))').first();
  await sec.scrollIntoViewIfNeeded();
  await sec.screenshot({ path: RESULTS_DIR + 'panel-cloudflare.png' });
  await closeProvider(p);
  // Run 1: Neuron confirmation dialog -> CANCEL -> zero Worker calls.
  await runBtn(p, width);
  await p.waitForSelector('#ais-cost-dialog', { state: 'visible', timeout: 15000 }).catch(() => fail('cloudflare confirmation dialog did not appear'));
  const dlgText = await p.locator('#ais-cost-dialog').textContent();
  if (!/Neurons/.test(dlgText) || !/10\.000/.test(dlgText) || !/KHÔNG phải chi phí Pollen/.test(dlgText)) fail('dialog must describe the Neuron quota honestly: ' + dlgText);
  await p.click('#ais-cost-cancel');
  await p.waitForSelector('#ais-cost-dialog', { state: 'hidden', timeout: 10000 });
  if (state.calls.length) fail('cancelled cloudflare run must not call the Worker');
  // Run 2: ACCEPT -> exactly 1 authenticated multipart POST, trimmed URL.
  await runBtn(p, width);
  await p.waitForSelector('#ais-cost-dialog', { state: 'visible', timeout: 15000 }).catch(() => fail('cloudflare dialog did not re-appear'));
  await p.click('#ais-cost-accept');
  await waitSettled(p, 'RUN');
  if (state.calls.length !== 1) fail('expected exactly 1 Worker call, got ' + state.calls.length);
  const call = state.calls[0];
  if (call.url !== WORKER + '/run/' + KLEIN) fail('Worker URL wrong (trailing slash not trimmed?): ' + call.url);
  if (call.method !== 'POST') fail('Worker call must be POST');
  if (call.headers['x-app-key'] !== 'app_key_test_p44') fail('X-App-Key header missing/wrong: ' + JSON.stringify(call.headers));
  if (!/^multipart\/form-data/.test(call.headers['content-type'] || '')) fail('klein call must be multipart/form-data: ' + call.headers['content-type']);
  if (!call.postData.includes('name="prompt"') || !call.postData.includes('Commercial e-commerce apparel catalog photo')) fail('multipart body must carry the catalog prompt');
  if (call.postData.includes('input_image_0')) fail('Template 1 gen has no image input — no input_image_0 expected');
  if (!/st-success/.test(await nodeClass(p, 'Tạo ảnh AI (DEMO)'))) fail('gen node not success in cloudflare mode');
  const comp = await nodeImage(p, 'Ghép hình in lên áo');
  if (!comp || comp.w !== 900 || comp.h !== 1350) fail(`RUN: composite must be built on the 1024x1536 mock at 900x1350, got ${comp && comp.w + 'x' + comp.h}`);
  writeFileSync(RESULTS_DIR + 'cloudflare-run-result.png', Buffer.from(comp.bytes));
  const h = await historyFirstText(p);
  if (!/AI thật/.test(h) || !/cloudflare\/@cf\/black-forest-labs\/flux-2-klein-4b/.test(h) || !/Neurons/.test(h)) fail('history does not record the cloudflare call + Neurons: ' + h);
  if (/~[\d.]+ Pollen/.test(h)) fail('history for a cloudflare-only run must not record a Pollen amount: ' + h);
  if (state.pollinations.length) fail('pollinations must not be called in cloudflare mode');
  // Nothing persisted: reload -> DEMO default, key + URL fields empty again.
  await p.reload();
  await p.waitForSelector('body[data-ready=true]');
  if ((await p.locator('#ais-mode-badge').textContent()) !== 'AI: DEMO') fail('after reload the badge must be back to DEMO');
  await openProvider(p);
  await p.selectOption('#ais-provider-kind', 'cloudflare');
  await p.waitForSelector('#ais-cf-url', { state: 'visible', timeout: 10000 });
  const urlVal = await p.locator('#ais-cf-url').inputValue();
  const keyPh2 = await p.locator('#ais-cf-key').getAttribute('placeholder');
  if (urlVal !== '') fail('Worker URL must not persist across reload, got: ' + urlVal);
  if (keyPh2 !== 'Nhập APP_KEY bảo vệ Worker cho phiên này') fail('App Key must not persist across reload (placeholder shows a stored key state): ' + keyPh2);
  await checkClean(p, errors, width);
  results.push({ phase: 'RUN', width, workerCalls: 1, dialogCancelNoCall: true, historyRecorded: true, persistedNothing: true });
  await ctx.close();
}

// ---------- Phase RESUME: failure then "Chạy tiếp từ node lỗi" ----------
{
  const width = 1366; const { ctx, p, errors, state } = await newPage(width);
  state.mode = 'error';
  await loadTpl1(p, 'P4.4 Cloudflare resume');
  await configureCloudflare(p, WORKER);
  await runBtn(p, width);
  await p.waitForSelector('#ais-cost-dialog', { state: 'visible', timeout: 15000 }).catch(() => fail('resume phase: dialog did not appear'));
  await p.click('#ais-cost-accept');
  await p.waitForFunction(() => { const el = [...document.querySelectorAll('.ais-node')].find(e => e.querySelector('header strong')?.textContent === 'Tạo ảnh AI (DEMO)'); return el && el.className.includes('st-error') && !document.querySelector('.ais-node.st-running'); }, null, { timeout: 90000 }).catch(() => fail('resume phase: gen node did not end in error'));
  if (state.calls.length !== 1) fail('failed cloudflare run must make exactly 1 call (retries forced 0), got ' + state.calls.length);
  const errText = await p.evaluate(() => [...document.querySelectorAll('.ais-node')].find(e => e.querySelector('header strong')?.textContent === 'Tạo ảnh AI (DEMO)')?.querySelector('.nerr')?.textContent || '');
  if (!/HTTP 500/.test(errText)) fail('gen node error should surface the Worker HTTP 500, got: ' + errText);
  if (await p.locator('#ais-resume').isHidden()) fail('resume button must be visible after a failed run');
  // Worker recovers -> resume from the failed node completes the workflow.
  state.mode = 'json';
  await p.click('#ais-resume');
  await p.waitForSelector('#ais-cost-dialog', { state: 'visible', timeout: 15000 }).catch(() => fail('resume phase: confirmation dialog did not appear for the resumed run'));
  await p.click('#ais-cost-accept');
  await waitSettled(p, 'RESUME');
  if (state.calls.length !== 2) fail('resume must add exactly 1 more Worker call, total ' + state.calls.length);
  if (!/st-success/.test(await nodeClass(p, 'Tạo ảnh AI (DEMO)'))) fail('gen node not success after resume');
  await checkClean(p, errors, width);
  results.push({ phase: 'RESUME', width, failedCalls: 1, resumeCalls: 1, completed: true });
  await ctx.close();
}

// ---------- Phase GUARD: wrong-aspect Cloudflare output -> P4.3 framing fallback ----------
{
  const width = 1366; const { ctx, p, errors, state } = await newPage(width);
  state.mode = 'bad34';
  await loadTpl1(p, 'P4.4 Cloudflare guard');
  await configureCloudflare(p, WORKER);
  await runBtn(p, width);
  await p.waitForSelector('#ais-cost-dialog', { state: 'visible', timeout: 15000 }).catch(() => fail('guard phase: dialog did not appear'));
  await p.click('#ais-cost-accept');
  await waitSettled(p, 'GUARD');
  if (state.calls.length !== 1) fail('guard phase: expected exactly 1 Worker call, got ' + state.calls.length);
  const gen = await nodeImage(p, 'Tạo ảnh AI (DEMO)');
  if (!gen || gen.w !== 768 || gen.h !== 1024) fail(`GUARD: the mocked 3:4 image must be the gen output (768x1024), got ${gen && gen.w + 'x' + gen.h}`);
  const comp = await nodeImage(p, 'Ghép hình in lên áo');
  if (!comp || comp.w !== 900 || comp.h !== 1350) fail(`GUARD: composite must fall back to the approved AI base (900x1350), got ${comp && comp.w + 'x' + comp.h}`);
  const cyan = countCyan(comp);
  if (cyan > 0) fail(`GUARD: ${cyan} cyan samples of the wrong-aspect Cloudflare image found in the composite — strict guard must refuse it`);
  const bodyText = await p.textContent('body');
  if (!/Ảnh AI thật không đạt khung hình — đã dùng nền người mẫu đã duyệt/.test(bodyText || '')) fail('GUARD: strict fallback wording missing for the Cloudflare output');
  await checkClean(p, errors, width);
  results.push({ phase: 'GUARD', width, workerCalls: 1, fallbackBase: '900x1350', cyanInComposite: 0 });
  await ctx.close();
}

// ---------- Phase IMG2IMG: adapter-level multipart upload + schnell guidance ----------
{
  const width = 1366; const { ctx, p, errors, state } = await newPage(width);
  const out = await p.evaluate(async ({ worker, klein, schnell }) => {
    const m = await import('/src/ai-studio/providers.js');
    m.setCfSessionKey('app_key_test_p44');
    const c = document.createElement('canvas'); c.width = 64; c.height = 64;
    const x = c.getContext('2d'); x.fillStyle = '#ffffff'; x.fillRect(0, 0, 64, 64);
    const jpeg = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.9));
    const kleinAdapter = new m.CloudflareAdapter({ model: klein, workerUrl: worker });
    const r = await kleinAdapter.generateImage({ prompt: 'ghép hình in lên áo này', imageBlob: jpeg });
    let schnellError = '';
    try {
      const sch = new m.CloudflareAdapter({ model: schnell, workerUrl: worker });
      await sch.generateImage({ prompt: 'x', imageBlob: jpeg });
    } catch (e) { schnellError = e.message; }
    m.clearCfSessionKey();
    return { mime: r.blob.type, providerId: r.providerId, modelId: r.modelId, label: r.label, schnellError };
  }, { worker: WORKER, klein: KLEIN, schnell: SCHNELL });
  if (state.calls.length !== 1) fail('IMG2IMG: exactly 1 Worker call expected (schnell must refuse pre-flight), got ' + state.calls.length);
  const call = state.calls[0];
  if (call.url !== WORKER + '/run/' + KLEIN) fail('IMG2IMG: wrong URL ' + call.url);
  if (call.headers['x-app-key'] !== 'app_key_test_p44') fail('IMG2IMG: X-App-Key header missing');
  if (!call.postData.includes('name="input_image_0"') || !call.postData.includes('filename="input_0.png"')) fail('IMG2IMG: multipart must carry input_image_0 as input_0.png');
  if (!call.postData.includes('name="prompt"')) fail('IMG2IMG: multipart must carry the prompt field');
  if (out.providerId !== 'cloudflare' || out.modelId !== KLEIN || out.mime !== 'image/png') fail('IMG2IMG: adapter result contract wrong: ' + JSON.stringify(out));
  if (!/chỉ hỗ trợ tạo ảnh từ chữ/.test(out.schnellError) || !out.schnellError.includes(KLEIN)) fail('IMG2IMG: schnell guidance error wrong: ' + out.schnellError);
  await checkClean(p, errors, width);
  results.push({ phase: 'IMG2IMG', width, multipartUpload: true, schnellGuidance: true });
  await ctx.close();
}

console.log(JSON.stringify(results, null, 2));
console.log('AI-STUDIO-P44: PASS');
await b.close();
