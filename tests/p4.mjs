/**
 * P4 browser checks: Print Production Workspace — upload, solid background
 * removal, live DPI by physical size, VTracer vectorization + fidelity gate,
 * verified PNG/SVG/PDF exports, library vector source, on-device ML removal.
 * Exported files are parsed back and checked, not just downloaded.
 */
import { chromium } from 'playwright';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readPngDpi, svgInfo, parsePdfInfo } from '../src/print-core.js';

const url = process.env.TEST_URL || 'http://127.0.0.1:5264';
const fail = (msg) => { throw new Error('P4: ' + msg); };
const outDir = mkdtempSync(join(tmpdir(), 'p4-downloads-'));

const b = await chromium.launch();
const p = await (await b.newContext({ viewport: { width: 390, height: 900 }, hasTouch: true, acceptDownloads: true })).newPage();
const errors = [];
p.on('pageerror', e => errors.push(e.message));
await p.goto(url + '/?v=p4print1');
await p.waitForSelector('html[data-ready=true]');
await p.locator('#print-workspace').scrollIntoViewIfNeeded();
await p.waitForSelector('#print-workspace[data-ready=true]');

// Studio handoff button answers honestly when there is no image layer.
await p.click('#pw-from-studio');
await p.waitForFunction(() => document.querySelector('#pw-source-info').textContent.length > 10);

// Build a flat logo fixture in-page: white background, red mark, VN text.
const logoBuffer = await p.evaluate(async () => {
  const c = document.createElement('canvas'); c.width = c.height = 800;
  const x = c.getContext('2d');
  x.fillStyle = '#ffffff'; x.fillRect(0, 0, 800, 800);
  x.fillStyle = '#b3372a'; x.beginPath(); x.roundRect(200, 180, 400, 300, 40); x.fill();
  x.fillStyle = '#ffffff'; x.font = 'bold 92px Arial'; x.textAlign = 'center';
  x.fillText('ÁO IN', 400, 320); x.font = 'bold 54px Arial'; x.fillText('STUDIO', 400, 410);
  x.fillStyle = '#293e35'; x.font = 'bold 64px Arial'; x.fillText('Ép nhiệt đẹp', 400, 620);
  const blob = await new Promise(r => c.toBlob(r, 'image/png'));
  return Array.from(new Uint8Array(await blob.arrayBuffer()));
});
await p.setInputFiles('#pw-upload', { name: 'logo.png', mimeType: 'image/png', buffer: Buffer.from(logoBuffer) });
await p.waitForFunction(() => document.querySelector('#pw-source-info').textContent.includes('800×800'));

// DPI follows the physical size: 800px at 20cm is low, at 6cm is good.
await p.fill('#pw-cm-w', '20'); await p.dispatchEvent('#pw-cm-w', 'change');
await p.waitForFunction(() => document.querySelector('#pw-dpi').textContent.includes('THẤP'));
await p.fill('#pw-cm-w', '6'); await p.dispatchEvent('#pw-cm-w', 'change');
await p.waitForFunction(() => document.querySelector('#pw-dpi').classList.contains('pw-dpi-good'));

// Solid background removal -> transparency row of the DTF check turns OK.
// Trimming drops the empty margins, so the same 6cm now honestly rates low;
// shrinking the print to 3cm restores a good rating on the trimmed pixels.
await p.check('input[name="pw-bg"][value="solid"]');
await p.waitForFunction(() => document.querySelector('#pw-dtf li')?.classList.contains('ok'), null, { timeout: 15000 });
await p.fill('#pw-cm-w', '3'); await p.dispatchEvent('#pw-cm-w', 'change');
await p.waitForFunction(() => document.querySelector('#pw-dpi').classList.contains('pw-dpi-good'));

// Vectorize the flat logo: the fidelity gate must pass it.
await p.click('#pw-trace');
await p.waitForFunction(() => document.querySelector('#pw-trace-status').textContent.includes('ĐẠT'), null, { timeout: 60000 });
if (await p.evaluate(() => document.querySelector('input[name="pw-master"]:checked').value) !== 'vector') fail('passing vector was not auto-selected as master');

// PNG export: transparent, embedded DPI matches the readout.
let dl = p.waitForEvent('download');
await p.click('#pw-exp-png');
const pngPath = join(outDir, 'export.png'); await (await dl).saveAs(pngPath);
const pngBytes = readFileSync(pngPath);
if (pngBytes[0] !== 0x89 || pngBytes[1] !== 0x50) fail('PNG signature missing');
const pngDpi = readPngDpi(pngBytes);
const pngWidth = pngBytes.readUInt32BE(16);
if (pngWidth >= 800) fail('exported PNG was not trimmed: ' + pngWidth);
if (!pngDpi || Math.abs(pngDpi - pngWidth / (3 / 2.54)) > 12) fail('PNG embedded DPI wrong: ' + pngDpi);

// SVG export: real paths, no embedded raster, physical cm size present.
dl = p.waitForEvent('download');
await p.click('#pw-exp-svg');
const svgPath = join(outDir, 'export.svg'); await (await dl).saveAs(svgPath);
const svgText = readFileSync(svgPath, 'utf8');
const info = svgInfo(svgText);
if (!info.isRealVector || info.hasImage) fail('exported SVG is not a real vector');
if (!/width="3\.00cm"/.test(svgText)) fail('exported SVG lacks the physical print width');

// PDF export (vector master): page is exactly 6cm wide, paths not an image.
dl = p.waitForEvent('download');
await p.click('#pw-exp-pdf');
const pdfPath = join(outDir, 'export.pdf'); await (await dl).saveAs(pdfPath);
const pdfInfo = parsePdfInfo(readFileSync(pdfPath));
if (!pdfInfo.mediaBoxPt || Math.abs(pdfInfo.mediaBoxPt[0] - 3 / 2.54 * 72) > 0.6) fail('PDF page width is not 3cm: ' + JSON.stringify(pdfInfo.mediaBoxPt));
if (pdfInfo.hasImageXObject) fail('vector PDF must not embed a raster image');
if (!pdfInfo.hasPathOps) fail('vector PDF has no path operators');

// Library source: a real library SVG enables vector export without tracing.
const libValue = await p.evaluate(() => document.querySelector('#pw-library option:nth-child(2)').value);
await p.selectOption('#pw-library', libValue);
await p.waitForFunction(() => document.querySelector('#pw-source-info').textContent.includes('vector thật'));
dl = p.waitForEvent('download');
await p.click('#pw-exp-svg');
const libSvgPath = join(outDir, 'library.svg'); await (await dl).saveAs(libSvgPath);
if (!svgInfo(readFileSync(libSvgPath, 'utf8')).isRealVector) fail('library SVG export lost its vector paths');

// ML background removal on a photo-like fixture (on-device U2Netp).
const photoBuffer = await p.evaluate(async () => {
  const c = document.createElement('canvas'); c.width = c.height = 400;
  const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, 400); g.addColorStop(0, '#9db8d6'); g.addColorStop(1, '#5d7a4e');
  x.fillStyle = g; x.fillRect(0, 0, 400, 400);
  x.fillStyle = '#7a4a21'; x.beginPath(); x.arc(200, 210, 110, 0, Math.PI * 2); x.fill();
  x.fillStyle = '#96682f'; x.beginPath(); x.arc(200, 190, 78, 0, Math.PI * 2); x.fill();
  x.fillStyle = '#20242a'; x.beginPath(); x.arc(172, 175, 10, 0, Math.PI * 2); x.arc(228, 175, 10, 0, Math.PI * 2); x.fill();
  const blob = await new Promise(r => c.toBlob(r, 'image/png'));
  return Array.from(new Uint8Array(await blob.arrayBuffer()));
});
await p.setInputFiles('#pw-upload', { name: 'pet.png', mimeType: 'image/png', buffer: Buffer.from(photoBuffer) });
await p.waitForFunction(() => document.querySelector('#pw-source-info').textContent.includes('400×400'));
await p.check('input[name="pw-bg"][value="ml"]');
await p.click('#pw-ml-run');
await p.waitForFunction(() => document.querySelector('#pw-bg-status').textContent.includes('Đã tách nền bằng AI'), null, { timeout: 180000 });

if (errors.length) fail('page errors: ' + errors.join(' | '));
console.log('P4_REPORT ' + JSON.stringify({ logoDpi: Math.round(pngDpi), svgPaths: info.paths, pdfPt: pdfInfo.mediaBoxPt, mlRemoval: true, errors }));
await b.close();
