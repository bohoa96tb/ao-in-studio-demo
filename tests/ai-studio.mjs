/**
 * AI Studio P1 browser checks: load studio.html, add nodes, drag a node,
 * connect two nodes by ports, load Template 1, run workflow in Demo Mode,
 * preview image appears, project persists across reload, ZIP export downloads
 * and parses as a real ZIP containing workflow.json.
 * Run with the static server on TEST_URL (default http://127.0.0.1:5264).
 */
import { chromium } from 'playwright';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { zipRead } from '../src/ai-studio/core.js';

const url = process.env.TEST_URL || 'http://127.0.0.1:5264';
const fail = (m) => { throw new Error('AI-STUDIO: ' + m); };
const outDir = mkdtempSync(join(tmpdir(), 'ais-downloads-'));
const b = await chromium.launch();
const results = [];

for (const width of [390, 430, 1366, 1920]) {
  const ctx = await b.newContext({ viewport: { width, height: 900 }, hasTouch: width < 700, acceptDownloads: true });
  const p = await ctx.newPage();
  const errors = []; p.on('pageerror', e => errors.push(e.message));
  await p.goto(url + '/studio.html?v=aistudio1');
  await p.waitForSelector('body[data-ready=true]');
  if (!await p.locator('#ais-canvas').isVisible()) fail('canvas not visible @' + width);

  // Add two nodes from the library and connect them by dragging port -> port.
  if (width < 700) await p.click('#ais-toggle-library');
  await p.click('[data-add-node="imageInput"]');
  if (width < 700) { await p.click('#ais-prop-close'); await p.click('#ais-toggle-library'); }
  await p.click('[data-add-node="preview"]');
  await p.waitForFunction(() => document.querySelectorAll('.ais-node').length >= 2);
  if (width < 700) await p.click('#ais-prop-close'); // close the bottom sheet so ports are reachable
  // Nodes are added in a cascade and overlap: drag the second one clear first.
  const head2 = await p.locator('.ais-node').nth(1).locator('header').boundingBox();
  await p.mouse.move(head2.x + 30, head2.y + 10); await p.mouse.down();
  await p.mouse.move(head2.x + 150, head2.y + 260, { steps: 10 }); await p.mouse.up();
  const outBox = await p.locator('.ais-node').first().locator('.ais-port.out').boundingBox();
  const inBox = await p.locator('.ais-node').nth(1).locator('.ais-port.in').boundingBox();
  if (!outBox || !inBox) fail('ports missing @' + width);
  await p.mouse.move(outBox.x + outBox.width / 2, outBox.y + outBox.height / 2);
  await p.mouse.down();
  await p.mouse.move(inBox.x + inBox.width / 2, inBox.y + inBox.height / 2, { steps: 12 });
  await p.mouse.up();
  await p.waitForFunction(() => document.querySelectorAll('.ais-edge').length >= 1, null, { timeout: 5000 }).catch(() => fail('edge was not created by port drag @' + width));

  // Drag the first node and confirm it moved.
  const before = await p.locator('.ais-node').first().evaluate(el => el.style.left);
  const head = await p.locator('.ais-node').first().locator('header').boundingBox();
  await p.mouse.move(head.x + 40, head.y + 10); await p.mouse.down();
  await p.mouse.move(head.x + 110, head.y + 70, { steps: 10 }); await p.mouse.up();
  const after = await p.locator('.ais-node').first().evaluate(el => el.style.left);
  if (before === after) fail('node drag did not move node @' + width);

  // Template 1 end-to-end (fresh project state replaces nodes).
  await p.click('[data-template="tpl1"]');
  await p.waitForFunction(() => document.querySelectorAll('.ais-node').length === 8);
  await p.fill('#ais-project-name', 'Du an kiem thu ' + width);
  await p.dispatchEvent('#ais-project-name', 'change');
  await p.click(width < 700 ? '#ais-run-mobile' : '#ais-run');
  await p.waitForFunction(() => [...document.querySelectorAll('.ais-node')].some(el => el.textContent.includes('Xem trước') && el.className.includes('st-success')), null, { timeout: 60000 });
  const failedNodes = await p.evaluate(() => [...document.querySelectorAll('.ais-node.st-error')].length);
  if (failedNodes) fail('template 1 had error nodes @' + width + ': ' + await p.evaluate(() => [...document.querySelectorAll('.ais-node.st-error .nerr')].map(e => e.textContent).join(' | ')));

  // Select the Preview node: its properties must show a real result image.
  await p.locator('.ais-node', { hasText: 'Xem trước' }).first().locator('header').click();
  await p.waitForSelector('#ais-prop-output img', { timeout: 10000 });
  const label = await p.locator('#ais-prop-output .hint').textContent().catch(() => '');
  if (!/DEMO|mô phỏng/.test(label || '')) fail('preview result missing honest DEMO label @' + width + ': ' + label);

  // Export ZIP: real ZIP with workflow.json inside.
  const dlP = p.waitForEvent('download');
  await p.click('#ais-export-zip-btn');
  const zipPath = join(outDir, 'proj-' + width + '.zip'); await (await dlP).saveAs(zipPath);
  const entries = zipRead(new Uint8Array(readFileSync(zipPath)));
  if (!entries.find(e => e.name === 'workflow.json')) fail('ZIP lacks workflow.json @' + width);
  const wf = JSON.parse(new TextDecoder().decode(entries.find(e => e.name === 'workflow.json').data));
  if (wf.graph.nodes.length !== 8) fail('ZIP workflow node count wrong @' + width);
  if (JSON.stringify(wf).includes('apiKey') || JSON.stringify(wf).includes('api_key')) fail('ZIP leaked an api key field @' + width);

  // Persistence: save, reload, project reopens with nodes intact.
  await p.click('#ais-save');
  await p.waitForFunction(() => document.querySelector('#ais-save-status').textContent.includes('Đã lưu'));
  await p.reload();
  await p.waitForSelector('body[data-ready=true]');
  await p.waitForFunction(() => document.querySelectorAll('.ais-node').length === 8, null, { timeout: 10000 });
  const nameBack = await p.inputValue('#ais-project-name');
  if (!nameBack.includes('kiem thu')) fail('project name not restored @' + width + ': ' + nameBack);
  if (await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2)) fail('horizontal overflow @' + width);
  if (errors.length) fail('page errors @' + width + ': ' + errors.join(' | '));
  results.push({ width, nodes: 8, template1: 'success', zip: entries.length + ' entries', persisted: true });
  await ctx.close();
}
console.log(JSON.stringify(results, null, 2));
await b.close();
