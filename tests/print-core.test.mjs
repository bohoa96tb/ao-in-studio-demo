// P4 print-core unit tests (node --test).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dpiFor, maxCmForDpi, dpiRating, pngWithDpi, readPngDpi, crc32, removeSolidBackground, applyColorAdjust, trimTransparent, fidelityScore, svgInfo, svgToPdfContent, buildPdf, parsePdfInfo } from '../src/print-core.js';

const img = (w, h, fn) => { const d = new Uint8ClampedArray(w * h * 4); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = (y * w + x) * 4; const [r, g, b, a] = fn(x, y); d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = a; } return { data: d, width: w, height: h }; };

test('DPI maths follows the physical print size', () => {
  assert.equal(Math.round(dpiFor(3000, 25.4)), 300);
  assert.equal(dpiRating(300), 'good');
  assert.equal(dpiRating(250), 'ok');
  assert.equal(dpiRating(150), 'low');
  assert.ok(Math.abs(maxCmForDpi(3000, 300) - 25.4) < 0.01);
});

test('PNG pHYs round-trip carries the effective DPI', () => {
  const ihdrData = new Uint8Array(13);
  const ihdr = new Uint8Array(25); const dv = new DataView(ihdr.buffer);
  dv.setUint32(0, 13); ihdr.set([73, 72, 68, 82], 4); ihdr.set(ihdrData, 8); dv.setUint32(21, crc32(ihdr.subarray(4, 21)));
  const iend = new Uint8Array(12); new DataView(iend.buffer).setUint32(0, 0); iend.set([73, 69, 78, 68], 4); new DataView(iend.buffer).setUint32(8, crc32(iend.subarray(4, 8)));
  const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, ...ihdr, ...iend]);
  const out = pngWithDpi(png, 300);
  assert.equal(Math.round(readPngDpi(out)), 300);
});

test('solid background removal only eats border-connected colour', () => {
  const src = img(12, 12, (x, y) => (x > 3 && x < 8 && y > 3 && y < 8) ? [200, 30, 30, 255] : [255, 255, 255, 255]);
  const cut = removeSolidBackground(src, { tolerance: 30 });
  assert.equal(cut.data[3], 0);                                  // corner transparent
  assert.equal(cut.data[(6 * 12 + 6) * 4 + 3], 255);             // interior kept
  const t = trimTransparent(cut);
  assert.equal(t.image.width, 4); assert.equal(t.image.height, 4);
});

test('mono conversion keeps alpha shape, opaque photos use luminance', () => {
  const withAlpha = img(2, 1, (x) => x ? [10, 20, 30, 0] : [10, 20, 30, 255]);
  const a = applyColorAdjust(withAlpha, { mono: '#ff0000' });
  assert.deepEqual([...a.data.subarray(0, 4)], [255, 0, 0, 255]);
  const opaque = img(2, 1, (x) => x ? [255, 255, 255, 255] : [0, 0, 0, 255]);
  const b = applyColorAdjust(opaque, { mono: '#00ff00' });
  assert.equal(b.data[3], 255);       // black becomes full ink
  assert.equal(b.data[7], 0);         // white becomes transparent
});

test('fidelity gate passes identical and rejects different coverage', () => {
  const a = img(8, 8, () => [120, 60, 30, 255]);
  assert.equal(fidelityScore(a, a).pass, true);
  const b = img(8, 8, (x) => x < 4 ? [120, 60, 30, 255] : [0, 0, 0, 0]);
  assert.equal(fidelityScore(a, b).pass, false);
});

test('library artwork is real vector; traced-style SVG converts to PDF paths', async () => {
  const lib = JSON.parse(readFileSync(new URL('../data/artwork-library.json', import.meta.url), 'utf8'));
  const file = lib.designs[0].file.split('/').pop();
  const svg = readFileSync(new URL('../public/artwork/' + file, import.meta.url), 'utf8');
  const info = svgInfo(svg);
  assert.equal(info.isRealVector, true);
  const conv = svgToPdfContent(svg);
  assert.ok(conv && conv.content.includes(' rg'));
  const pdf = await buildPdf({ widthCm: 20, heightCm: 20, vector: conv });
  const parsed = parsePdfInfo(pdf);
  assert.ok(Math.abs(parsed.mediaBoxPt[0] - 20 / 2.54 * 72) < 0.1);
  assert.equal(parsed.hasImageXObject, false);
  assert.equal(parsed.hasPathOps, true);
});

test('raster PDF embeds an image at the exact page size; fake-vector SVG is refused', async () => {
  const raster = img(4, 4, () => [200, 0, 0, 255]);
  const pdf = await buildPdf({ widthCm: 10, heightCm: 10, raster: { rgba: raster } });
  const parsed = parsePdfInfo(pdf);
  assert.equal(parsed.hasImageXObject, true);
  assert.ok(Math.abs(parsed.mediaBoxPt[1] - 10 / 2.54 * 72) < 0.1);
  const fake = '<svg xmlns="http://www.w3.org/2000/svg"><image href="data:image/png;base64,AAAA"/></svg>';
  assert.equal(svgInfo(fake).isRealVector, false);
  assert.equal(svgToPdfContent(fake), null);
});
