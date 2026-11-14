/**
 * AI Studio P2 browser checks (Playwright, server scripts/serve.mjs :5264):
 *  A (430 + 1366) run history persists, cache hits on re-run, downstream-only
 *     invalidation after a config edit, project versions + restore, GC button.
 *  B (430) runtime failure -> run history 'failed' -> resume from failed node.
 *  C (430) unsaved draft -> reload -> recovery offer -> restore.
 *  D (1366) P1-shaped IndexedDB (v1) migrates to v2, legacy project loads.
 *  E (390 + 1920) smoke: template run + history entry + no overflow/errors.
 */
import { chromium } from 'playwright';

const url = process.env.TEST_URL || 'http://127.0.0.1:5264';
const fail = (m) => { throw new Error('AI-STUDIO-P2: ' + m); };
const b = await chromium.launch();
const results = [];

async function newPage(width) {
  const ctx = await b.newContext({ viewport: { width, height: 900 }, hasTouch: width < 700 });
  const p = await ctx.newPage();
  const errors = []; p.on('pageerror', e => errors.push(e.message));
  p.on('dialog', d => d.accept());
  await p.goto(url + '/studio.html?v=aistudio2');
  await p.waitForSelector('body[data-ready=true]');
  return { ctx, p, errors };
}
const runBtn = (p, width) => p.click(width < 700 ? '#ais-run-mobile' : '#ais-run');
const nodeClass = (p, label) => p.evaluate((l) => { const el = [...document.querySelectorAll('.ais-node')].find(e => e.querySelector('header strong')?.textContent === l); return el ? el.className : null; }, label);
const nodeCount = (p) => p.evaluate(() => document.querySelectorAll('.ais-node').length);
const cachedCount = (p) => p.evaluate(() => document.querySelectorAll('.ais-node.st-cached').length);
async function waitPreviewSuccess(p) {
  await p.waitForFunction(() => { const nodes = [...document.querySelectorAll('.ais-node')]; const prev = nodes.find(e => e.querySelector('header strong')?.textContent === 'Xem trước'); return prev && prev.className.includes('st-success') && !nodes.some(e => e.className.includes('st-running')); }, null, { timeout: 60000 }).catch(() => fail('workflow did not settle with Preview success'));
}
async function loadTpl1(p, name) {
  await p.click('[data-template="tpl1"]');
  await p.waitForFunction(() => document.querySelectorAll('.ais-node').length === 8);
  if (name) { await p.fill('#ais-project-name', name); await p.dispatchEvent('#ais-project-name', 'change'); }
}
async function openTab(p, tab) { await p.click(`.ais-tabs [data-tab="${tab}"]`); await p.waitForSelector(`#ais-pane-${tab}:not([hidden])`); }
/** A run is only fully done (statuses final) once its history record exists. */
async function waitHistoryCount(p, n) {
  await p.waitForFunction((count) => document.querySelectorAll('#ais-history-list .ais-run-item').length >= count && ![...document.querySelectorAll('.ais-node')].some(e => e.className.includes('st-running')), n, { timeout: 60000 }).catch(() => fail('run #' + n + ' did not finish/record history'));
}
async function checkClean(p, errors, width) {
  if (await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2)) fail('horizontal overflow @' + width);
  if (errors.length) fail('page errors @' + width + ': ' + errors.join(' | '));
}

// ---------- Phase A: history + cache + invalidation + versions + GC ----------
for (const width of [430, 1366]) {
  const { ctx, p, errors } = await newPage(width);
  await loadTpl1(p, 'P2 kiem thu ' + width);
  await runBtn(p, width); await waitPreviewSuccess(p); await waitHistoryCount(p, 1);
  // Run history recorded
  await openTab(p, 'history');
  const h1 = await p.locator('#ais-history-list .ais-run-item').first().textContent();
  if (!/Thành công/.test(h1)) fail('first history entry not success @' + width + ': ' + h1);
  // Re-run unchanged -> cacheable nodes served from cache
  await runBtn(p, width); await waitHistoryCount(p, 2);
  const cc = await cachedCount(p);
  if (cc < 5) fail('expected >=5 cached nodes on unchanged re-run @' + width + ', got ' + cc);
  if (!/st-cached/.test(await nodeClass(p, 'Ghép hình in lên áo'))) fail('composition not cached @' + width);
  // Edit the prompt -> the prompt chain re-runs. P4.1 topology note: the
  // composition node now sits DOWNSTREAM of aiImageGen (gen -> comp.garment),
  // so a prompt edit correctly invalidates promptAssistant + aiImageGen +
  // composition (the plain-garment photo is regenerated and the design is
  // re-composited onto it). In the pre-P4.1 topology composition was upstream
  // of the generator and stayed cached here; that assertion encoded the old
  // (buggy) flow the owner ordered removed. The truly unrelated inputs
  // (reference photo, design file) must stay cached.
  await p.locator('.ais-node header strong:text-is("Prompt")').click();
  await p.fill('#pf-text', 'Prompt da sua cho kiem thu P2');
  if (width < 700) await p.click('#ais-prop-close');
  await runBtn(p, width); await waitHistoryCount(p, 3);
  if (/st-cached/.test(await nodeClass(p, 'Trợ lý prompt (quy tắc)'))) fail('promptAssistant should have re-run after prompt edit @' + width);
  if (!/st-success/.test(await nodeClass(p, 'Trợ lý prompt (quy tắc)'))) fail('promptAssistant not success after re-run @' + width);
  if (/st-cached/.test(await nodeClass(p, 'Tạo ảnh AI (DEMO)'))) fail('aiImageGen should have re-run after prompt edit @' + width);
  if (/st-cached/.test(await nodeClass(p, 'Ghép hình in lên áo'))) fail('composition should re-run after prompt edit (P4.1: it composites onto the regenerated AI garment) @' + width);
  if (!/st-success/.test(await nodeClass(p, 'Ghép hình in lên áo'))) fail('composition not success after prompt edit @' + width);
  if (!/st-cached/.test(await nodeClass(p, 'Ảnh đầu vào'))) fail('imageInput should stay cached @' + width);
  if (!/st-cached/.test(await nodeClass(p, 'Hình in (thiết kế)'))) fail('designInput should stay cached @' + width);
  // Versions: two explicit saves -> two versions; add a node; restore v1 -> back to 8 nodes
  await p.click('#ais-save'); await p.waitForFunction(() => document.querySelector('#ais-save-status').textContent.includes('Đã lưu'));
  await p.click('#ais-save');
  await openTab(p, 'versions');
  await p.waitForFunction(() => document.querySelectorAll('#ais-versions-list .ais-ver-item').length >= 2, null, { timeout: 10000 }).catch(() => fail('two versions not listed @' + width));
  if (width < 700) await p.click('#ais-toggle-library');
  await p.click('[data-add-node="preview"]');
  await p.waitForFunction(() => document.querySelectorAll('.ais-node').length === 9);
  if (await p.locator('#ais-prop-close').isVisible().catch(() => false)) await p.click('#ais-prop-close'); // close the properties sheet so the footer is clickable
  await p.locator('#ais-versions-list [data-restore-version]').last().click();
  await p.waitForFunction(() => document.querySelectorAll('.ais-node').length === 8, null, { timeout: 10000 }).catch(() => fail('restore did not bring back 8 nodes @' + width));
  // Storage tab + GC
  await openTab(p, 'storage');
  await p.waitForSelector('#ais-gc');
  await p.click('#ais-gc');
  await p.waitForFunction(() => document.querySelector('#ais-gc-result')?.textContent.includes('Đã xóa'), null, { timeout: 10000 }).catch(() => fail('GC did not report @' + width));
  await p.click('#ais-clear-cache');
  // Reload -> history persists, no recovery banner (explicitly saved, draft cleared)
  await p.reload(); await p.waitForSelector('body[data-ready=true]');
  await p.waitForFunction(() => document.querySelectorAll('.ais-node').length === 8, null, { timeout: 10000 });
  if (!await p.locator('#ais-recovery').isHidden()) fail('recovery banner should be hidden after explicit save @' + width);
  await openTab(p, 'history');
  await p.waitForFunction(() => document.querySelectorAll('#ais-history-list .ais-run-item').length >= 1, null, { timeout: 10000 }).catch(() => fail('run history did not persist after reload @' + width));
  await checkClean(p, errors, width);
  results.push({ phase: 'A', width, cachedOnRerun: cc, versions: 2, restored: true, historyPersisted: true });
  await ctx.close();
}

// ---------- Phase B: failure -> resume (430) ----------
{
  const width = 430; const { ctx, p, errors } = await newPage(width);
  await loadTpl1(p, 'P2 loi va chay tiep');
  // Switch provider to the gated HTTP stub -> aiImageGen fails at runtime.
  await p.selectOption('#ais-provider-kind', 'http');
  await p.fill('#ais-provider-endpoint', 'https://example.invalid/ai');
  await runBtn(p, width);
  await p.waitForFunction(() => { const nodes = [...document.querySelectorAll('.ais-node')]; const gen = nodes.find(e => e.querySelector('header strong')?.textContent === 'Tạo ảnh AI (DEMO)'); return gen && gen.className.includes('st-error') && !nodes.some(e => e.className.includes('st-running')); }, null, { timeout: 60000 }).catch(() => fail('aiImageGen did not fail as expected'));
  // P4.1 topology: composition is DOWNSTREAM of aiImageGen now, so when the
  // generator fails the composition is skipped (error) — the nodes that must
  // have succeeded before the failure are the generator's own upstream
  // (prompt chain + design). (Pre-P4.1 the composition ran before the
  // generator and was already successful at this point.)
  if (!/st-success|st-cached/.test(await nodeClass(p, 'Trợ lý prompt (quy tắc)'))) fail('promptAssistant should have succeeded before the failure');
  if (!/st-success|st-cached/.test(await nodeClass(p, 'Hình in (thiết kế)'))) fail('designInput should have succeeded before the failure');
  if (!/st-error/.test(await nodeClass(p, 'Ghép hình in lên áo'))) fail('composition should be skipped (error) downstream of the failed generator (P4.1 topology)');
  if (await p.locator('#ais-resume').isHidden()) fail('resume button not offered after failure');
  await openTab(p, 'history');
  const hb = await p.locator('#ais-history-list .ais-run-item').first().textContent();
  if (!/Có lỗi/.test(hb)) fail('failed run not recorded in history: ' + hb);
  // Back to DEMO and resume from the failed node only.
  await p.selectOption('#ais-provider-kind', 'demo');
  await p.click('#ais-resume');
  await waitPreviewSuccess(p); await waitHistoryCount(p, 2);
  if (!/st-success/.test(await nodeClass(p, 'Tạo ảnh AI (DEMO)'))) fail('aiImageGen not success after resume');
  await p.locator('.ais-node header strong:text-is("Xem trước")').click();
  await p.waitForSelector('#ais-prop-output img', { timeout: 10000 });
  if (await p.locator('#ais-prop-close').isVisible().catch(() => false)) await p.click('#ais-prop-close');
  await openTab(p, 'history');
  const hr = await p.locator('#ais-history-list .ais-run-item').first().textContent();
  if (!/Chạy tiếp/.test(hr) || !/Thành công/.test(hr)) fail('resume run not recorded as successful resume: ' + hr);
  await checkClean(p, errors, width);
  results.push({ phase: 'B', width, failedThenResumed: true });
  await ctx.close();
}

// ---------- Phase C: draft recovery (430) ----------
{
  const width = 430; const { ctx, p, errors } = await newPage(width);
  await loadTpl1(p, 'Nhap chua luu P2');
  // Wait until the page itself reports the autosave draft as written (the
  // status text is set only after the draft transaction resolves — polling
  // raw IndexedDB from outside races the page's own connections).
  await p.waitForFunction(() => document.querySelector('#ais-save-status').textContent.includes('bản nháp'), null, { timeout: 15000 }).catch(() => fail('autosave draft was not written'));
  await p.reload(); await p.waitForSelector('body[data-ready=true]');
  if (await p.locator('#ais-recovery').isHidden()) fail('recovery offer not shown for unsaved draft');
  await p.click('#ais-recovery-restore');
  await p.waitForFunction(() => document.querySelectorAll('.ais-node').length === 8, null, { timeout: 10000 }).catch(() => fail('draft restore did not rebuild the workflow'));
  const nameBack = await p.inputValue('#ais-project-name');
  if (nameBack !== 'Nhap chua luu P2') fail('draft name not restored: ' + nameBack);
  if (!await p.locator('#ais-recovery').isHidden()) fail('recovery banner should hide after restore');
  await checkClean(p, errors, width);
  results.push({ phase: 'C', width, draftRecovered: true });
  await ctx.close();
}

// ---------- Phase D: P1 (v1) database migration (1366) ----------
{
  const width = 1366;
  const ctx = await b.newContext({ viewport: { width, height: 900 } });
  const p = await ctx.newPage();
  const errors = []; p.on('pageerror', e => errors.push(e.message));
  await p.goto(url + '/index.html');
  await p.evaluate(async () => {
    const db = await new Promise((res, rej) => { const r = indexedDB.open('ao-in-ai-studio', 1); r.onupgradeneeded = () => { const d = r.result; d.createObjectStore('projects', { keyPath: 'id' }); d.createObjectStore('assets', { keyPath: 'id' }); }; r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    await new Promise((res, rej) => { const t = db.transaction('projects', 'readwrite'); t.objectStore('projects').put({ id: 'legacy-p1', name: 'Du an P1 cu', graph: { nodes: [{ id: 'n1', type: 'promptInput', x: 10, y: 10, config: { text: 'chao tu P1' } }], edges: [] }, updatedAt: Date.now() }); t.oncomplete = res; t.onerror = () => rej(t.error); });
    db.close();
  });
  await p.goto(url + '/studio.html?v=aistudio2');
  await p.waitForSelector('body[data-ready=true]');
  await p.waitForFunction(() => document.querySelectorAll('.ais-node').length === 1, null, { timeout: 10000 }).catch(() => fail('legacy P1 project did not load after migration'));
  const legacyName = await p.inputValue('#ais-project-name');
  if (legacyName !== 'Du an P1 cu') fail('legacy project name wrong: ' + legacyName);
  const dbInfo = await p.evaluate(() => new Promise((res) => { const r = indexedDB.open('ao-in-ai-studio'); r.onsuccess = () => { const d = r.result; const info = { version: d.version, stores: [...d.objectStoreNames] }; d.close(); res(info); }; r.onerror = () => res(null); }));
  if (!dbInfo || dbInfo.version !== 2) fail('database not upgraded to v2: ' + JSON.stringify(dbInfo));
  for (const s of ['runs', 'versions', 'cache', 'drafts']) if (!dbInfo.stores.includes(s)) fail('missing v2 store: ' + s);
  await checkClean(p, errors, width);
  results.push({ phase: 'D', width, migratedFromV1: true, dbVersion: dbInfo.version });
  await ctx.close();
}

// ---------- Phase E: smoke (390 + 1920) ----------
for (const width of [390, 1920]) {
  const { ctx, p, errors } = await newPage(width);
  await loadTpl1(p, 'P2 smoke ' + width);
  await runBtn(p, width); await waitPreviewSuccess(p);
  await openTab(p, 'history');
  await p.waitForFunction(() => document.querySelectorAll('#ais-history-list .ais-run-item').length >= 1);
  await checkClean(p, errors, width);
  results.push({ phase: 'E', width, smoke: true });
  await ctx.close();
}

console.log(JSON.stringify(results, null, 2));
await b.close();
