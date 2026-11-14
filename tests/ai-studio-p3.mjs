/**
 * AI Studio P3 browser checks (Playwright, server scripts/serve.mjs :5264):
 *  A (430 + 1366) Template 1: open the Composition quad editor, drag corner
 *     handle 1 with pointer events, assert the config quad (numeric inputs)
 *     changed, run the workflow, Preview succeeds.
 *  B (430 + 1366) Template 2: background node output keeps the input's pixel
 *     size; Export with TikTok + Shopee channels (PNG) -> ZIP download
 *     contains results/tiktok-1080x1920.png and results/shopee-1024x1024.png
 *     whose IHDR dimensions are EXACTLY 1080x1920 and 1024x1024.
 *  E (390 + 1920) smoke: Template 1 runs, no page errors, no overflow.
 */
import { chromium } from 'playwright';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { zipRead } from '../src/ai-studio/core.js';

const url = process.env.TEST_URL || 'http://127.0.0.1:5264';
const fail = (m) => { throw new Error('AI-STUDIO-P3: ' + m); };
const outDir = mkdtempSync(join(tmpdir(), 'ais3-downloads-'));
const b = await chromium.launch();
const results = [];

async function newPage(width) {
  const ctx = await b.newContext({ viewport: { width, height: 900 }, hasTouch: width < 700, acceptDownloads: true });
  const p = await ctx.newPage();
  const errors = []; p.on('pageerror', e => errors.push(e.message));
  p.on('dialog', d => d.accept());
  await p.goto(url + '/studio.html?v=aistudio3');
  await p.waitForSelector('body[data-ready=true]');
  return { ctx, p, errors };
}
const runBtn = (p, width) => p.click(width < 700 ? '#ais-run-mobile' : '#ais-run');
const nodeClass = (p, label) => p.evaluate((l) => { const el = [...document.querySelectorAll('.ais-node')].find(e => e.querySelector('header strong')?.textContent === l); return el ? el.className : null; }, label);
async function waitSettled(p, label, what) {
  await p.waitForFunction((l) => { const nodes = [...document.querySelectorAll('.ais-node')]; const t = nodes.find(e => e.querySelector('header strong')?.textContent === l); return t && t.className.includes('st-success') && !nodes.some(e => e.className.includes('st-running')); }, label, { timeout: 90000 }).catch(() => fail(what + ' did not settle with success'));
}
async function checkClean(p, errors, width) {
  if (await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2)) fail('horizontal overflow @' + width);
  if (errors.length) fail('page errors @' + width + ': ' + errors.join(' | '));
}
async function closeProps(p) { if (await p.locator('#ais-prop-close').isVisible().catch(() => false)) await p.click('#ais-prop-close'); }
function pngDims(data) {
  if (data[0] !== 0x89 || data[1] !== 0x50) fail('result entry is not a PNG');
  const dv = new DataView(data.buffer, data.byteOffset, data.byteLength);
  return [dv.getUint32(16), dv.getUint32(20)];
}

// ---------- Phase A: quad editor drag + Template 1 run ----------
for (const width of [430, 1366]) {
  const { ctx, p, errors } = await newPage(width);
  await p.click('[data-template="tpl1"]');
  await p.waitForFunction(() => document.querySelectorAll('.ais-node').length === 8);
  // Open the composition node's properties -> P3 quad editor appears.
  await p.locator('.ais-node header strong:text-is("Ghép hình in lên áo")').click();
  await p.waitForSelector('#ais-quad-canvas', { timeout: 15000 }).catch(() => fail('quad editor canvas missing @' + width));
  await p.waitForFunction(() => { const cv = document.querySelector('#ais-quad-canvas'); return cv && cv.width > 100 && cv.height > 100; }, null, { timeout: 15000 }).catch(() => fail('quad preview did not draw @' + width));
  const before = parseFloat(await p.inputValue('#pf-q0x'));
  // P4.2 ROUND 3: Template 1's default quad is the DEMO figure chest quad
  // derived by the TORSO RULE (torsoQuadFor from the figure landmarks —
  // corner 1 at 41.2% x, 34.1% y: upper-mid chest, gap 13.5% of torso
  // length below the collar). Supersedes the round-1 collar-rule corner
  // (32.5%, 41.5%) pinned here before.
  if (Math.abs(before - 41.2) > 0.6) fail('unexpected initial quad corner @' + width + ': ' + before);
  // Drag corner handle 1 (at quad[0] = 41.2% x, 34.1% y of the canvas box).
  await p.locator('#ais-quad-canvas').scrollIntoViewIfNeeded();
  await p.waitForTimeout(200);
  const box = await p.locator('#ais-quad-canvas').boundingBox();
  const sx = box.x + box.width * 0.412, sy = box.y + box.height * 0.341;
  await p.mouse.move(sx, sy); await p.mouse.down();
  await p.mouse.move(sx + 26, sy + 18, { steps: 8 }); await p.mouse.up();
  await p.waitForTimeout(300);
  const after = parseFloat(await p.inputValue('#pf-q0x'));
  if (!(after > before + 2)) fail(`quad corner did not move by drag @${width}: ${before} -> ${after}`);
  // Wrinkle + shading sliders are present in perspective mode.
  if (!await p.locator('#pf-wrinkle').isVisible()) fail('wrinkle slider missing @' + width);
  if (!await p.locator('#pf-shading').isVisible()) fail('shading slider missing @' + width);
  await closeProps(p);
  await runBtn(p, width);
  await waitSettled(p, 'Xem trước', 'Template 1 (P3 perspective)');
  if (!/st-success/.test(await nodeClass(p, 'Ghép hình in lên áo'))) fail('composition not success @' + width);
  await checkClean(p, errors, width);
  results.push({ phase: 'A', width, quadDragged: `${before} -> ${after}`, template1: 'success' });
  await ctx.close();
}

// ---------- Phase B: background sizing + multi-size channel export ZIP ----------
for (const width of [430, 1366]) {
  const { ctx, p, errors } = await newPage(width);
  await p.click('[data-template="tpl2"]');
  await p.waitForFunction(() => document.querySelectorAll('.ais-node').length === 7);
  // Export node: PNG + add the TikTok channel (tpl2 already has website-vuong + shopee).
  await p.locator('.ais-node header strong:text-is("Xuất file")').click();
  await p.waitForSelector('[data-channel="tiktok"]');
  await p.selectOption('#pf-format', 'png');
  if (!await p.locator('[data-channel="shopee"]').isChecked()) fail('tpl2 export should pre-check shopee @' + width);
  await p.check('[data-channel="tiktok"]');
  await closeProps(p);
  await runBtn(p, width);
  await waitSettled(p, 'Xuất file', 'Template 2 export');
  // Background output must keep its input's exact pixel size (editor output).
  const dimsOf = async (label) => {
    await p.locator(`.ais-node header strong:text-is("${label}")`).click();
    await p.waitForSelector('#ais-prop-output img', { timeout: 15000 }).catch(() => fail('no output image for ' + label + ' @' + width));
    return p.evaluate(() => { const img = document.querySelector('#ais-prop-output img'); return [img.naturalWidth, img.naturalHeight]; });
  };
  const editDims = await dimsOf('Chỉnh sửa ảnh');
  const bgDims = await dimsOf('Nền & bối cảnh');
  if (editDims[0] !== 900) fail('editor output width should be 900 @' + width + ': ' + editDims);
  if (bgDims[0] !== editDims[0] || bgDims[1] !== editDims[1]) fail(`background changed the image size @${width}: in ${editDims} -> out ${bgDims}`);
  await closeProps(p);
  // ZIP export contains the channel files at EXACT pixel sizes.
  const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 30000 }), p.click('#ais-export-zip-btn')]);
  const zipPath = join(outDir, 'p3-' + width + '.zip');
  await dl.saveAs(zipPath);
  const entries = zipRead(new Uint8Array(readFileSync(zipPath)));
  const names = entries.map(e => e.name);
  for (const want of ['results/tiktok-1080x1920.png', 'results/shopee-1024x1024.png', 'results/website-vuong-2000x2000.png']) {
    if (!names.includes(want)) fail('ZIP missing ' + want + ' @' + width + ' — has: ' + names.join(', '));
  }
  const tk = entries.find(e => e.name === 'results/tiktok-1080x1920.png');
  const sp = entries.find(e => e.name === 'results/shopee-1024x1024.png');
  const [tw, th] = pngDims(tk.data); const [sw2, sh2] = pngDims(sp.data);
  if (tw !== 1080 || th !== 1920) fail(`tiktok file is ${tw}x${th}, expected 1080x1920`);
  if (sw2 !== 1024 || sh2 !== 1024) fail(`shopee file is ${sw2}x${sh2}, expected 1024x1024`);
  await checkClean(p, errors, width);
  results.push({ phase: 'B', width, bgSizeKept: bgDims.join('x'), zipChannels: ['tiktok 1080x1920', 'shopee 1024x1024', 'website-vuong 2000x2000'] });
  await ctx.close();
}

// ---------- Phase E: smoke ----------
for (const width of [390, 1920]) {
  const { ctx, p, errors } = await newPage(width);
  await p.click('[data-template="tpl1"]');
  await p.waitForFunction(() => document.querySelectorAll('.ais-node').length === 8);
  await runBtn(p, width);
  await waitSettled(p, 'Xem trước', 'smoke Template 1');
  await checkClean(p, errors, width);
  results.push({ phase: 'E', width, smoke: true });
  await ctx.close();
}

await b.close();
console.log(JSON.stringify(results, null, 2));
console.log('AI-STUDIO-P3: PASS');
