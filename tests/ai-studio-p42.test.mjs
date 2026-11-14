// AI Studio P4.2 unit tests: the collar-margin quad rule (chestQuadFor),
// recalibrated demo-figure + preset quads, the real photo-base registry and
// its DEMO mapping, ink-opacity migration, and the fixed simple-mode
// defaults. The owner rejected P4.1 because the print area sat on the
// model's neck — these tests pin the geometry so it cannot regress.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { NODE_DEFS, DEMO_FIGURE, PHOTO_BASES, photoBaseFor, photoBaseByPath } from '../src/ai-studio/core.js';
import { chestQuadFor, GARMENT_QUADS, migrateCompositionConfig } from '../src/ai-studio/warp.js';

const topOf = (q) => Math.min(q[0][1], q[1][1]);
const bottomOf = (q) => Math.max(q[2][1], q[3][1]);
const centreY = (q) => (topOf(q) + bottomOf(q)) / 2;
const centreX = (q) => (q[0][0] + q[1][0] + q[2][0] + q[3][0]) / 4;
const widthOf = (q) => q[1][0] - q[0][0];

test('chestQuadFor: top = collar + margin, centred on centerX, exact size', () => {
  const q = chestQuadFor({ collarBottomY: 0.30, centerX: 0.5, width: 0.3, height: 0.2 });
  assert.ok(Math.abs(topOf(q) - 0.395) < 1e-9, 'default margin 0.095');
  assert.ok(Math.abs(centreX(q) - 0.5) < 1e-9);
  assert.ok(Math.abs(widthOf(q) - 0.3) < 1e-9);
  assert.ok(Math.abs((bottomOf(q) - topOf(q)) - 0.2) < 1e-9);
  const q2 = chestQuadFor({ collarBottomY: 0.3, centerX: 0.4, width: 0.2, height: 0.1, margin: 0.08 });
  assert.ok(Math.abs(topOf(q2) - 0.38) < 1e-9);
  assert.ok(Math.abs(centreX(q2) - 0.4) < 1e-9);
});

test('chestQuadFor: rejects margins outside the owner rule (8–12%)', () => {
  assert.throws(() => chestQuadFor({ collarBottomY: 0.3, width: 0.3, height: 0.2, margin: 0.05 }));
  assert.throws(() => chestQuadFor({ collarBottomY: 0.3, width: 0.3, height: 0.2, margin: 0.15 }));
  assert.throws(() => chestQuadFor({ collarBottomY: 1.2, width: 0.3, height: 0.2 }));
});

test('DEMO figure quads obey the collar rule (P4.2 fix)', () => {
  for (const [fit, quad] of [['regular', DEMO_FIGURE.chestQuad], ['oversize', DEMO_FIGURE.chestQuadOversize]]) {
    const collar = DEMO_FIGURE.collarBottomY[fit];
    const margin = topOf(quad) - collar;
    assert.ok(margin >= 0.08 && margin <= 0.12, `${fit}: margin ${margin.toFixed(3)} must be 8–12% below the collar`);
    assert.ok(centreY(quad) >= 0.42 && centreY(quad) <= 0.52, `${fit}: centre ${centreY(quad).toFixed(3)} must sit in the chest band 42–52%`);
    assert.ok(Math.abs(centreX(quad) - 0.5) < 1e-9, `${fit}: horizontally centred`);
    // never reaches the neck: the figure's neck rect ends at y=0.30 and the
    // chin at ~0.22 — the quad top must stay well below both.
    assert.ok(topOf(quad) > 0.40, `${fit}: quad top ${topOf(quad)} must clear neck/chin`);
  }
  assert.ok(widthOf(DEMO_FIGURE.chestQuadOversize) > widthOf(DEMO_FIGURE.chestQuad), 'oversize quad wider than regular');
});

test('every GARMENT_QUADS preset obeys the collar rule for its measured collar', () => {
  // Collar lower edges measured on the actual photos (P4.2 calibration,
  // docs/AI_STUDIO_QA_REPORT.md). If a quad is ever re-tuned, its top must
  // stay 8–12% of height below the collar.
  const collars = {
    'public/fixtures/real-tee/crew-white-hanger.webp': 0.33,
    'public/fixtures/real-tee/crew-black-hanger.webp': 0.26,
    'public/fixtures/real-tee/crew-white-model.webp': 0.358,
    'public/fixtures/real-tee/crew-black-woman.webp': 0.495,
    'public/fixtures/real-tee/crew-white-back-worn.webp': 0.445,
  };
  for (const [path, collar] of Object.entries(collars)) {
    const q = GARMENT_QUADS[path];
    assert.ok(q, 'preset quad exists for ' + path);
    const margin = topOf(q) - collar;
    assert.ok(margin >= 0.08 && margin <= 0.12, `${path}: margin ${margin.toFixed(3)}`);
  }
  // The cream collar close-up is a detail photo, not a compositing base.
  assert.equal(GARMENT_QUADS['public/fixtures/real-tee/crew-white-flatlay.webp'], undefined);
});

test('PHOTO_BASES: verified real photos with credits, files and quads', () => {
  assert.ok(PHOTO_BASES.length >= 5);
  for (const b of PHOTO_BASES) {
    assert.ok(existsSync(new URL('../' + b.path, import.meta.url)), 'fixture file exists: ' + b.path);
    assert.ok(b.source && b.source.platform === 'Pexels' && b.source.photoId && b.source.author && b.source.sourceUrl, 'credit recorded for ' + b.id);
    assert.ok(!['9558713', '8606514'].includes(b.source.photoId), 'banned photo id used: ' + b.id);
    assert.ok(GARMENT_QUADS[b.path], 'calibrated quad for ' + b.id);
    assert.equal(photoBaseByPath(b.path), b);
  }
  const demos = PHOTO_BASES.filter(b => b.demoPhoto);
  assert.deepEqual(demos.map(b => b.id).sort(), ['model-black-crew', 'model-white-crew']);
});

test('photoBaseFor: DEMO mapping by garment params (front view only)', () => {
  const white = photoBaseFor({ style: 'co-tron', colorKey: 'trang', view: 'chinh-dien' });
  assert.equal(white.base.id, 'model-white-crew');
  assert.deepEqual(white.quad, GARMENT_QUADS['public/fixtures/real-tee/crew-white-model.webp']);
  const black = photoBaseFor({ style: 'co-tron', colorKey: 'den', view: 'chinh-dien' });
  assert.equal(black.base.id, 'model-black-crew');
  const over = photoBaseFor({ style: 'oversize', colorKey: 'trang', view: 'chinh-dien' });
  assert.equal(over.base.id, 'model-white-crew');
  assert.ok(widthOf(over.quad) > widthOf(white.quad), 'oversize quad wider than the regular quad on the same photo');
  // No verified photo → null (caller falls back to the drawn figure).
  assert.equal(photoBaseFor({ style: 'oversize', colorKey: 'den', view: 'chinh-dien' }), null);
  assert.equal(photoBaseFor({ style: 'co-tron', colorKey: 'be', view: 'chinh-dien' }), null);
  assert.equal(photoBaseFor({ style: 'co-tron', colorKey: 'trang', view: 'ba-phan-tu' }), null);
  assert.equal(photoBaseFor(null), null);
});

test('composition defaults: simple-mode box clears the collar; ink opacity migrates', () => {
  const d = NODE_DEFS.composition.defaults;
  // Simple mode draws the design inside a printW-square centred at printY:
  // its top edge must sit at/below demo collar (0.316) + 8%.
  const boxTop = (d.printY - d.printW / 2) / 100;
  assert.ok(boxTop >= 0.316 + 0.08, `simple-mode default box top ${boxTop} clears the collar rule`);
  const hq = GARMENT_QUADS['public/fixtures/real-tee/crew-white-hanger.webp'];
  assert.ok(d.quad.every((pt, i) => Math.abs(pt[0] - hq[i][0]) < 1e-9 && Math.abs(pt[1] - hq[i][1]) < 1e-9), 'default quad = white-hanger calibrated quad');
  assert.equal(d.inkOpacity, 95);
  const m = migrateCompositionConfig({ wrinkle: 10 });
  assert.equal(m.inkOpacity, 95, 'migration adds inkOpacity default');
  assert.equal(migrateCompositionConfig({ inkOpacity: 88 }).inkOpacity, 88, 'migration preserves a set inkOpacity');
});
