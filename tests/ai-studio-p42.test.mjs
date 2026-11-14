// AI Studio P4.2 unit tests: the collar-margin quad rule (chestQuadFor),
// recalibrated demo-figure + preset quads, the real photo-base registry and
// its DEMO mapping, ink-opacity migration, and the fixed simple-mode
// defaults. The owner rejected P4.1 because the print area sat on the
// model's neck — these tests pin the geometry so it cannot regress.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { NODE_DEFS, DEMO_FIGURE, PHOTO_BASES, photoBaseFor, photoBaseByPath, SAMPLE_DESIGN_SVG, PROMPT_OPTIONS, buildPrompt, TEMPLATES } from '../src/ai-studio/core.js';
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
    'public/fixtures/real-tee/crew-white-vn-model.webp': 0.64,
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
  assert.ok(PHOTO_BASES.length >= 4);
  for (const b of PHOTO_BASES) {
    assert.ok(existsSync(new URL('../' + b.path, import.meta.url)), 'fixture file exists: ' + b.path);
    assert.ok(b.source && b.source.platform === 'Pexels' && b.source.photoId && b.source.author && b.source.sourceUrl, 'credit recorded for ' + b.id);
    assert.ok(!['9558713', '8606514'].includes(b.source.photoId), 'banned photo id used: ' + b.id);
    assert.ok(GARMENT_QUADS[b.path], 'calibrated quad for ' + b.id);
    assert.equal(photoBaseByPath(b.path), b);
  }
  // P4.2 supplementary (owner's localisation order): the ONLY demo photo
  // base is the Vietnamese-model white crew photo. The round-1 black base
  // (9558583, held-up shirt) and the non-Asian white base (10159280) are
  // gone — neither may ever come back as a compositing base.
  const demos = PHOTO_BASES.filter(b => b.demoPhoto);
  assert.deepEqual(demos.map(b => b.id), ['model-white-crew']);
  assert.ok(!PHOTO_BASES.some(b => b.source.photoId === '9558583' || b.source.photoId === '10159280'), 'retired photo bases must not return');
  assert.equal(GARMENT_QUADS['public/fixtures/real-tee/crew-black-woman.webp'], undefined, 'held-up black shirt has no compositing quad');
});

test('photoBaseFor: DEMO mapping by garment params (front view only)', () => {
  const white = photoBaseFor({ style: 'co-tron', colorKey: 'trang', view: 'chinh-dien' });
  assert.equal(white.base.id, 'model-white-crew');
  assert.equal(white.base.source.photoId, '25471921');
  assert.deepEqual(white.quad, GARMENT_QUADS['public/fixtures/real-tee/crew-white-vn-model.webp']);
  // No verified photo → null (caller falls back to the drawn figure).
  // Black: no Asian model WEARING a plain black crew tee exists verified
  // (the held-up 9558583 is forbidden). Oversize: no verified Asian-model
  // oversize photo — a regular tee + bigger print must never fake the fit.
  assert.equal(photoBaseFor({ style: 'co-tron', colorKey: 'den', view: 'chinh-dien' }), null);
  assert.equal(photoBaseFor({ style: 'oversize', colorKey: 'trang', view: 'chinh-dien' }), null);
  assert.equal(photoBaseFor({ style: 'oversize', colorKey: 'den', view: 'chinh-dien' }), null);
  assert.equal(photoBaseFor({ style: 'co-tron', colorKey: 'be', view: 'chinh-dien' }), null);
  assert.equal(photoBaseFor({ style: 'co-tron', colorKey: 'trang', view: 'ba-phan-tu' }), null);
  assert.equal(photoBaseFor(null), null);
});

test('FIX C — sample logo: every text is WHITE inside the badge (readable on black tees)', () => {
  // Owner: the old logo's "STUDIO" was dark teal (#293e35) below the badge
  // and vanished on black garments. The redesign keeps the terracotta
  // badge + ÁO IN STUDIO wording, but ALL text is white and inside it.
  assert.ok(!/#293e35/i.test(SAMPLE_DESIGN_SVG), 'dark teal must be gone from the sample logo');
  const texts = [...SAMPLE_DESIGN_SVG.matchAll(/<text[^>]*fill="([^"]+)"[^>]*>([^<]+)<\/text>/g)].map(m => ({ fill: m[1], word: m[2] }));
  assert.deepEqual(texts.map(t => t.word), ['ÁO IN', 'STUDIO']);
  for (const t of texts) assert.equal(t.fill.toLowerCase(), '#ffffff', `text "${t.word}" must be white`);
  assert.ok(/<ellipse[^>]*fill="#b6492f"/.test(SAMPLE_DESIGN_SVG), 'terracotta badge kept');
});

test('FIX E — promptAssistant: Vietnamese model options; Template 1 defaults to one', () => {
  assert.equal(PROMPT_OPTIONS.model['nu-viet'], 'người mẫu Việt Nam (nữ)');
  assert.equal(PROMPT_OPTIONS.model['nam-viet'], 'người mẫu Việt Nam (nam)');
  assert.equal(NODE_DEFS.promptAssistant.defaults.model, 'nu-viet', 'new promptAssistant nodes default to the Vietnamese model');
  const tpl1 = TEMPLATES.find(t => t.id === 'tpl1').make();
  const pa = tpl1.nodes.find(n => n.type === 'promptAssistant');
  assert.equal(pa.config.model, 'nu-viet', 'Template 1 promptAssistant model = Vietnamese');
  const out = buildPrompt(pa.config, '');
  assert.ok(out.includes('a young Vietnamese female model wearing a PLAIN white'), 'EN prompt names the Vietnamese model: ' + out.slice(0, 140));
  const outM = buildPrompt({ ...pa.config, model: 'nam-viet' }, '');
  assert.ok(outM.includes('a young Vietnamese male model'), 'male Vietnamese option builds too');
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
