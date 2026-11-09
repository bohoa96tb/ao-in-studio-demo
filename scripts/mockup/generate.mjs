#!/usr/bin/env node
/**
 * Áo In Studio P3 — batch mockup generator (Agent 6, GENERATION flow).
 *
 * Renders pre-baked catalog mockups for APPROVED garment bases × APPROVED
 * artwork, using the same engine code the browser uses (Playwright page
 * context), writes public/mockups/*.webp and data/mockup-manifest.json with
 * sha256 checksums and per-mockup artwork-fidelity measurements.
 *
 * Idempotent: a combo whose cache key already matches the manifest and whose
 * file checksum still verifies is skipped. Failures abort the run — a stale
 * manifest is safer than a wrong one. Nothing here approves new assets.
 */
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { makeServer } from '../serve.mjs';
import { compositingBases, zoneFor, mockupCacheKey, RENDERER_VERSION } from '../../src/mockup-engine/engine.js';
import { buildArtworkLibrary } from './build-artwork-library.mjs';

const root = path.resolve(fileURLToPath(new URL('../../', import.meta.url)));
const sha256 = buf => createHash('sha256').update(buf).digest('hex');

/** Generation matrix is built after the library loads (see PILOT below). */
let PILOT = [];
const COVERAGE_TOLERANCE = 0.15;

const garmentsDoc = JSON.parse(await readFile(path.join(root, 'data/garments.json'), 'utf8'));
const library = await buildArtworkLibrary();
/**
 * P3.1 matrix: EVERY approved design on every approved base, so the design
 * collection and product cards can show each design on a real garment —
 * plus one large-print variant kept from the P3 pilot.
 */
PILOT = [
  ...library.designs.filter(d => d.status === 'APPROVED').map(d => ({ artworkId: d.designId, note: 'toàn thư viện P3.1' })),
  { artworkId: 'landscape', variant: 'large', scaleFactor: 1.35, note: 'bản in lớn' },
];
/**
 * Non-primary bases get a deliberately small matrix: the black crew base
 * serves the black-default SKU (AIS-007, zodiac) — rendering all 83 dark-ink
 * designs on a black shirt would be near-invisible and misleading. The
 * primary (white) base carries the full library.
 */
const SECONDARY_BASE_ARTWORKS = ['zodiac-0', 'zodiac-3'];
const byId = Object.fromEntries(library.designs.map(d => [d.designId, d]));
const bases = compositingBases(garmentsDoc);
if (!bases.length) throw new Error('No APPROVED compositing base garments — nothing to generate.');

const manifestPath = path.join(root, 'data/mockup-manifest.json');
let previous = { entries: [] };
try { previous = JSON.parse(await readFile(manifestPath, 'utf8')); } catch { /* first run */ }
const prevByKey = new Map((previous.entries || []).map(e => [e.cacheKey, e]));

const server = makeServer();
await new Promise(r => server.listen(0, '127.0.0.1', r));
const port = server.address().port;
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(`http://127.0.0.1:${port}/scripts/mockup/harness.html`);
await page.waitForFunction(() => window.__p3ready === true);

const entries = [];
const results = [];
try {
  for (const [baseIndex, garment] of bases.entries()) {
    const z = zoneFor(garment, 'front');
    if (!z.ok) { results.push(`SKIP ${garment.garmentId}: ${z.reason}`); continue; }
    const combos = baseIndex === 0 ? PILOT : PILOT.filter(c => SECONDARY_BASE_ARTWORKS.includes(c.artworkId) && !c.variant);
    for (const combo of combos) {
      const design = byId[combo.artworkId];
      if (!design || design.status !== 'APPROVED') { results.push(`SKIP ${combo.artworkId}: not APPROVED`); continue; }
      const variant = combo.variant || 'std';
      const cacheKey = mockupCacheKey({ garmentId: garment.garmentId, artworkHash: design.artworkHash, view: 'front', variant });
      const file = `public/mockups/${garment.garmentId.toLowerCase()}__${combo.artworkId}__front${variant === 'std' ? '' : '--' + variant}.webp`;
      const prev = prevByKey.get(cacheKey);
      if (prev && prev.file === file) {
        try {
          const buf = await readFile(path.join(root, file));
          if (sha256(buf) === prev.sha256) { entries.push(prev); results.push(`CACHED ${file}`); continue; }
        } catch { /* regenerate */ }
      }
      const out = await page.evaluate(spec => window.__renderCombo(spec), {
        garmentFile: garment.actualPhotoFront,
        artworkFile: design.file,
        zoneQuad: z.zone.quad,
        maskPolygon: garment.calibration?.maskPolygon || null,
        shadingStrength: garment.calibration?.shadingStrength ?? 0.35,
        scaleFactor: combo.scaleFactor || 1,
      });
      if (out.coverageDelta > COVERAGE_TOLERANCE)
        throw new Error(`Fidelity FAIL ${file}: coverage delta ${out.coverageDelta.toFixed(3)} > ${COVERAGE_TOLERANCE} (ref ${out.coverageRef.toFixed(3)} vs mock ${out.coverageMock.toFixed(3)})`);
      const buf = Buffer.from(out.webpBase64, 'base64');
      await mkdir(path.join(root, 'public/mockups'), { recursive: true });
      await writeFile(path.join(root, file), buf);
      entries.push({
        id: `${garment.garmentId}/${combo.artworkId}/front/${variant}`,
        cacheKey, garmentId: garment.garmentId, artworkId: combo.artworkId,
        view: 'front', variant, file,
        width: out.width, height: out.height, bytes: buf.length,
        sha256: sha256(buf), rendererVersion: RENDERER_VERSION,
        fidelity: { coverageRef: +out.coverageRef.toFixed(3), coverageMock: +out.coverageMock.toFixed(3), coverageDelta: +out.coverageDelta.toFixed(3) },
        note: combo.note, generatedAt: new Date().toISOString(),
      });
      results.push(`MADE ${file} (${buf.length} B, Δcoverage ${out.coverageDelta.toFixed(3)})`);
    }
  }

  // Vietnamese text fidelity: text is drawn by Canvas fillText from the exact
  // string — never re-generated by AI. Assert its alpha coverage survives the
  // warp within tolerance and keep a QA PNG outside the repo.
  const garment = bases[0];
  const z = zoneFor(garment, 'front');
  const t = await page.evaluate(spec => window.__renderCombo(spec), {
    garmentFile: garment.actualPhotoFront, textLines: ['CÀ PHÊ', 'RỒI TÍNH'],
    zoneQuad: z.zone.quad, maskPolygon: garment.calibration?.maskPolygon || null,
    shadingStrength: garment.calibration?.shadingStrength ?? 0.35, scaleFactor: 1,
  });
  if (t.coverageDelta > COVERAGE_TOLERANCE)
    throw new Error(`Text fidelity FAIL: coverage delta ${t.coverageDelta.toFixed(3)}`);
  await writeFile('/tmp/p3-text-fidelity.webp', Buffer.from(t.webpBase64, 'base64'));
  results.push(`TEXT-TEST ok (Δcoverage ${t.coverageDelta.toFixed(3)}), QA image at /tmp/p3-text-fidelity.webp`);
} finally {
  await browser.close();
  server.close();
}

const doc = {
  version: 1, rendererVersion: RENDERER_VERSION, updated: new Date().toISOString(),
  note: 'Mockup dựng sẵn bởi scripts/mockup/generate.mjs. Chỉ tổ hợp áo APPROVED + artwork APPROVED. Ảnh là ẢNH MÔ PHỎNG trên ảnh áo trống thật — luôn gắn nhãn khi hiển thị.',
  count: entries.length, entries,
};
await writeFile(manifestPath, JSON.stringify(doc, null, 1) + '\n');
console.log(results.join('\n'));
console.log(`mockup-manifest: ${entries.length} entries`);
