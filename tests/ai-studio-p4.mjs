/**
 * AI Studio P4 browser checks (Playwright, server scripts/serve.mjs :5264).
 * ALL Pollinations endpoints are MOCKED via route interception — this suite
 * never calls a real generation endpoint (and neither may CI):
 *  OFF (430)     Real switch OFF (default): Template 1 runs in DEMO and makes
 *                ZERO requests to any pollinations domain.
 *  CLASSIC (430 + 1366) Real ON + Classic: connection test hits ONLY the
 *                models endpoint; run makes exactly 1 classic request
 *                (model=sana) and history records provider/model/0 Pollen.
 *  KEYED (430 + 1366)  Keyed without a key -> run blocked with explanation,
 *                no requests. With a fake session key + explicit confirm:
 *                balance check reads the mocked balance with the Bearer
 *                header; cost dialog shows the Pollen total; CANCEL -> no
 *                generation request; ACCEPT -> exactly 1 generation request
 *                with the Authorization header; history records the cost.
 *  SMOKE (390 + 1920) Template 1 demo run, no pollinations requests, clean.
 *  HOME (390)    Homepage sections + AI Studio link intact, no page errors.
 */
import { chromium } from 'playwright';

const url = process.env.TEST_URL || 'http://127.0.0.1:5264';
const fail = (m) => { throw new Error('AI-STUDIO-P4: ' + m); };
// 1x1 transparent JPEG (valid image bytes for mocked generation responses)
const JPEG = Buffer.from('/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/xAAUAQEAAAAAAAAAAAAAAAAAAAAA/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8AvwEf/9k=', 'base64');
const b = await chromium.launch();
const results = [];

async function mockPollinations(ctx) {
  const state = { classic: [], keyedGen: [], models: 0, balance: 0, lastBalanceAuth: '', lastGenAuth: '' };
  await ctx.route('**://image.pollinations.ai/**', (route) => {
    state.classic.push(route.request().url());
    route.fulfill({ status: 200, contentType: 'image/jpeg', body: JPEG });
  });
  await ctx.route('**://gen.pollinations.ai/**', (route) => {
    const u = route.request().url();
    const auth = route.request().headers()['authorization'] || '';
    if (u.includes('/image/models')) { state.models++; return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ id: 'm1' }, { id: 'm2' }, { id: 'm3' }]) }); }
    if (u.includes('/account/balance')) { state.balance++; state.lastBalanceAuth = auth; return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ balance: 7.5 }) }); }
    if (u.includes('/image/')) { state.keyedGen.push(u); state.lastGenAuth = auth; return route.fulfill({ status: 200, contentType: 'image/jpeg', body: JPEG }); }
    return route.abort();
  });
  return state;
}
async function newPage(width) {
  const ctx = await b.newContext({ viewport: { width, height: 900 }, hasTouch: width < 700, acceptDownloads: true });
  const state = await mockPollinations(ctx);
  const p = await ctx.newPage();
  const errors = []; p.on('pageerror', e => errors.push(e.message));
  p.on('dialog', d => d.accept());
  await p.goto(url + '/studio.html?v=aistudio4');
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
/** Open the settings/provider panel the way a user does (toolbar button —
 * on mobile the panel is a bottom sheet that only opens on demand), then
 * scroll the target control into view inside the sheet. */
async function openProvider(p) { await p.click('#ais-toggle-props'); await p.waitForSelector('#ais-real-switch', { state: 'visible' }); }
async function closeProvider(p) { await p.click('#ais-toggle-props'); }
async function checkId(p, id) { const l = p.locator(id); await l.scrollIntoViewIfNeeded(); await l.check(); }
async function clickId(p, id) { const l = p.locator(id); await l.scrollIntoViewIfNeeded(); await l.click(); }
async function historyFirstText(p) {
  await openTab(p, 'history');
  await p.waitForFunction(() => document.querySelectorAll('#ais-history-list .ais-run-item').length >= 1, null, { timeout: 15000 }).catch(() => fail('no run history entry'));
  return p.locator('#ais-history-list .ais-run-item').first().textContent();
}
const noCalls = (state) => state.classic.length === 0 && state.keyedGen.length === 0 && state.models === 0 && state.balance === 0;

// ---------- Phase OFF: real switch OFF -> demo only, zero pollinations calls ----------
{
  const width = 430; const { ctx, p, errors, state } = await newPage(width);
  if ((await p.locator('#ais-mode-badge').textContent()) !== 'AI: DEMO') fail('badge should read AI: DEMO by default');
  if (await p.locator('#ais-real-switch').isChecked()) fail('real switch must default to OFF');
  await loadTpl1(p, 'P4 mac dinh DEMO');
  await runBtn(p, width);
  await waitSettled(p, 'OFF');
  if (!noCalls(state)) fail('OFF phase made pollinations requests: ' + JSON.stringify(state));
  if (!/st-success/.test(await nodeClass(p, 'Tạo ảnh AI (DEMO)'))) fail('gen node not success in demo mode');
  await checkClean(p, errors, width);
  results.push({ phase: 'OFF', width, demoRun: true, pollinationsCalls: 0 });
  await ctx.close();
}

// ---------- Phase CLASSIC: free real path, exactly 1 sana request ----------
for (const width of [430, 1366]) {
  const { ctx, p, errors, state } = await newPage(width);
  await loadTpl1(p, 'P4 Classic that');
  await openProvider(p);
  await checkId(p, '#ais-real-switch');
  await p.selectOption('#ais-provider-kind', 'pollinations-classic');
  await p.waitForFunction(() => document.querySelector('#ais-mode-badge')?.textContent.includes('AI THẬT'), null, { timeout: 10000 }).catch(() => fail('badge did not switch to real mode @' + width));
  // Connection test: ONLY the zero-cost models endpoint may be hit.
  await clickId(p, '#ais-provider-test');
  await p.waitForFunction(() => document.querySelector('#ais-provider-status')?.textContent.includes('Kết nối được'), null, { timeout: 15000 }).catch(() => fail('connection test did not report success @' + width));
  if (state.models !== 1 || state.classic.length || state.keyedGen.length) fail('connection test must hit only /image/models @' + width + ': ' + JSON.stringify(state));
  await closeProvider(p);
  await runBtn(p, width);
  await waitSettled(p, 'CLASSIC @' + width);
  if (state.classic.length !== 1) fail('expected exactly 1 classic generation request @' + width + ', got ' + state.classic.length);
  if (!state.classic[0].includes('model=sana')) fail('classic request must use model=sana: ' + state.classic[0]);
  if (state.keyedGen.length) fail('keyed endpoint must not be called in classic mode @' + width);
  if (!/st-success/.test(await nodeClass(p, 'Tạo ảnh AI (DEMO)'))) fail('gen node not success in classic mode @' + width);
  const h = await historyFirstText(p);
  if (!/AI thật/.test(h) || !/pollinations-classic\/sana/.test(h) || !/0 Pollen/.test(h)) fail('history does not record classic call + 0 Pollen @' + width + ': ' + h);
  await checkClean(p, errors, width);
  results.push({ phase: 'CLASSIC', width, classicCalls: 1, modelsCalls: state.models, historyRecorded: true });
  await ctx.close();
}

// ---------- Phase KEYED: gating, balance, cost confirmation ----------
for (const width of [430, 1366]) {
  const { ctx, p, errors, state } = await newPage(width);
  await loadTpl1(p, 'P4 Keyed Pollen');
  await openProvider(p);
  await checkId(p, '#ais-real-switch');
  await p.selectOption('#ais-provider-kind', 'pollinations');
  // Blocked without a key: status explains, and a run is refused pre-flight.
  await p.waitForFunction(() => document.querySelector('#ais-provider-status')?.textContent.includes('BỊ KHÓA'), null, { timeout: 10000 }).catch(() => fail('keyed provider should show blocked state without key @' + width));
  const optText = await p.evaluate(() => document.querySelector('#ais-provider-model')?.selectedOptions[0]?.textContent || '');
  if (!/0\.002/.test(optText)) fail('model picker should show the flux price 0.002 @' + width + ': ' + optText);
  await runBtn(p, width);
  await p.waitForFunction(() => document.querySelector('#ais-message')?.textContent.includes('Chưa nhập API key'), null, { timeout: 15000 }).catch(() => fail('blocked run did not explain the missing key @' + width));
  if (!noCalls(state)) fail('blocked keyed run made requests @' + width + ': ' + JSON.stringify(state));
  // Give it a session key + explicit in-panel confirmation.
  await p.locator('#ais-provider-key').scrollIntoViewIfNeeded();
  await p.fill('#ais-provider-key', 'sk_test_p4');
  await p.locator('#ais-provider-key').dispatchEvent('change');
  await checkId(p, '#ais-keyed-confirm');
  await p.waitForFunction(() => document.querySelector('#ais-provider-status')?.textContent.includes('AI THẬT đang bật: Pollinations (key)'), null, { timeout: 10000 }).catch(() => fail('keyed provider did not activate after key + confirm @' + width));
  // Balance check: mocked, must carry the Bearer header, must not generate.
  await clickId(p, '#ais-provider-balance');
  await p.waitForFunction(() => document.querySelector('#ais-balance-status')?.textContent.includes('7.5'), null, { timeout: 15000 }).catch(() => fail('balance not shown @' + width));
  if (state.balance !== 1 || state.lastBalanceAuth !== 'Bearer sk_test_p4') fail('balance call missing/wrong auth @' + width);
  if (state.keyedGen.length || state.classic.length) fail('balance check must not generate @' + width);
  await closeProvider(p);
  // Run 1: cost dialog appears with the Pollen total -> CANCEL -> no call.
  await runBtn(p, width);
  await p.waitForSelector('#ais-cost-dialog', { state: 'visible', timeout: 15000 }).catch(() => fail('cost dialog did not appear @' + width));
  const dlgText = await p.locator('#ais-cost-dialog').textContent();
  if (!/0\.002/.test(dlgText) || !/flux/i.test(dlgText)) fail('cost dialog should list the flux call + price @' + width + ': ' + dlgText);
  await p.click('#ais-cost-cancel');
  await p.waitForSelector('#ais-cost-dialog', { state: 'hidden', timeout: 10000 });
  if (state.keyedGen.length) fail('cancelled run must not call generation @' + width);
  // Run 2: ACCEPT -> exactly 1 authenticated generation request.
  await runBtn(p, width);
  await p.waitForSelector('#ais-cost-dialog', { state: 'visible', timeout: 15000 }).catch(() => fail('cost dialog did not re-appear @' + width));
  await p.click('#ais-cost-accept');
  await waitSettled(p, 'KEYED @' + width);
  if (state.keyedGen.length !== 1) fail('expected exactly 1 keyed generation request @' + width + ', got ' + state.keyedGen.length);
  if (state.lastGenAuth !== 'Bearer sk_test_p4') fail('generation request missing Authorization header @' + width);
  if (!state.keyedGen[0].includes('model=flux')) fail('generation request should use model=flux: ' + state.keyedGen[0]);
  const h = await historyFirstText(p);
  if (!/AI thật/.test(h) || !/pollinations\/flux/.test(h) || !/0\.002 Pollen/.test(h)) fail('history does not record keyed cost @' + width + ': ' + h);
  await checkClean(p, errors, width);
  results.push({ phase: 'KEYED', width, blockedWithoutKey: true, balanceChecked: true, cancelNoCall: true, acceptedCalls: 1, historyCost: true });
  await ctx.close();
}

// ---------- Phase SMOKE: 390 + 1920 demo run, clean ----------
for (const width of [390, 1920]) {
  const { ctx, p, errors, state } = await newPage(width);
  await loadTpl1(p, 'P4 khoi');
  await runBtn(p, width);
  await waitSettled(p, 'SMOKE @' + width);
  if (!noCalls(state)) fail('smoke run made pollinations requests @' + width);
  await checkClean(p, errors, width);
  results.push({ phase: 'SMOKE', width, smoke: true });
  await ctx.close();
}

// ---------- Phase HOME: homepage intact ----------
{
  const ctx = await b.newContext({ viewport: { width: 390, height: 900 }, hasTouch: true });
  const p = await ctx.newPage();
  const errors = []; p.on('pageerror', e => errors.push(e.message));
  await p.goto(url + '/');
  for (const sel of ['#product-catalog', '#design-collection', '#studio', '#print-workspace']) {
    if (!await p.locator(sel).count()) fail('homepage missing section ' + sel);
  }
  if (!await p.locator('a[href="studio.html"], a[href$="studio.html"]').count()) fail('homepage missing AI Studio link');
  if (errors.length) fail('homepage errors: ' + errors.join(' | '));
  results.push({ phase: 'HOME', width: 390, sectionsIntact: true });
  await ctx.close();
}

console.log(JSON.stringify(results, null, 2));
console.log('AI-STUDIO-P4: PASS');
await b.close();
