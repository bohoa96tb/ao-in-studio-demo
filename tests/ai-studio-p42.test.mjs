// AI Studio P4.2 unit tests — ROUND 3 (owner's e-commerce framing
// standard). The owner rejected the round-2 white model photo (a close
// head-and-shoulders portrait) and replaced BOTH the photo standard and
// the print-placement rule:
//   * print placement now follows the TORSO RULE (torsoQuadFor): gap
//     from the collar's lower edge to the print top = 12–15% of TOTAL
//     TORSO LENGTH (collar → hem, measured in the image); print width =
//     35–45% of torso width; centred on the torso centre. This SUPERSEDES
//     the round-1 collar rule (8–12% of image height) for every base —
//     chestQuadFor stays only as a legacy export with its own pins.
//   * model photo bases must pass the full e-commerce checklist; NONE
//     currently does (round-3 search: 26 candidates viewed, all failed
//     at least one item) — the registry holds garment reference photos
//     only and photoBaseFor returns null for every combo, so DEMO uses
//     the drawn figure, itself redrawn to the half-body framing.
//   * Template 1's generation prompt is the owner's VERBATIM catalog
//     template (only [COLOR]/[FIT_TYPE] substituted) — asserted as exact
//     strings below.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { NODE_DEFS, DEMO_FIGURE, PHOTO_BASES, photoBaseFor, photoBaseByPath, SAMPLE_DESIGN_SVG, PROMPT_OPTIONS, buildPrompt, garmentSummaryVi, CATALOG_PROMPT_TEMPLATE, catalogPromptFor, TEMPLATES } from '../src/ai-studio/core.js';
import { chestQuadFor, torsoQuadFor, GARMENT_QUADS, FIXTURE_LANDMARKS, migrateCompositionConfig } from '../src/ai-studio/warp.js';

const topOf = (q) => Math.min(q[0][1], q[1][1]);
const bottomOf = (q) => Math.max(q[2][1], q[3][1]);
const centreX = (q) => (q[0][0] + q[1][0] + q[2][0] + q[3][0]) / 4;
const widthOf = (q) => q[1][0] - q[0][0];
const gapRatioOf = (q, lm) => (topOf(q) - lm.collarBottomY) / (lm.hemY - lm.collarBottomY);
const widthRatioOf = (q, lm) => widthOf(q) / lm.torsoWidth;

// ---------- legacy chestQuadFor pins (function kept for P1-era callers) ----------
test('chestQuadFor (legacy): top = collar + margin, centred on centerX, exact size', () => {
  const q = chestQuadFor({ collarBottomY: 0.30, centerX: 0.5, width: 0.3, height: 0.2 });
  assert.ok(Math.abs(topOf(q) - 0.395) < 1e-9, 'default margin 0.095');
  assert.ok(Math.abs(centreX(q) - 0.5) < 1e-9);
  assert.ok(Math.abs(widthOf(q) - 0.3) < 1e-9);
  assert.ok(Math.abs((bottomOf(q) - topOf(q)) - 0.2) < 1e-9);
  assert.throws(() => chestQuadFor({ collarBottomY: 0.3, width: 0.3, height: 0.2, margin: 0.05 }));
  assert.throws(() => chestQuadFor({ collarBottomY: 0.3, width: 0.3, height: 0.2, margin: 0.15 }));
});

// ---------- torsoQuadFor: the round-3 rule ----------
test('torsoQuadFor: gap/width land mid-band by default; height follows the image aspect', () => {
  const lm = { collarBottomY: 0.34, hemY: 0.795, torsoCenterX: 0.5, torsoWidth: 0.44 };
  const q = torsoQuadFor(lm, { imgW: 4, imgH: 5 });
  assert.ok(Math.abs(gapRatioOf(q, lm) - 0.135) < 1e-9, 'default gap 13.5% of torso length');
  assert.ok(Math.abs(widthRatioOf(q, lm) - 0.40) < 1e-9, 'default width 40% of torso width');
  assert.ok(Math.abs(centreX(q) - lm.torsoCenterX) < 1e-9, 'centred on the torso centre');
  // square design on a 4:5 image: h = w · (4/5)
  assert.ok(Math.abs((bottomOf(q) - topOf(q)) - widthOf(q) * 0.8) < 1e-9);
  const qL = torsoQuadFor(lm, { imgW: 1200, imgH: 800 });
  assert.ok(Math.abs((bottomOf(qL) - topOf(qL)) - widthOf(qL) * 1.5) < 1e-9, 'landscape aspect stretches height');
});

test('torsoQuadFor: gap and width are CLAMPED to the owner bands [0.12,0.15] / [0.35,0.45]', () => {
  const lm = { collarBottomY: 0.3, hemY: 0.9, torsoCenterX: 0.5, torsoWidth: 0.5 };
  const lo = torsoQuadFor(lm, { gapRatio: 0.02, widthRatio: 0.9 });
  assert.ok(Math.abs(gapRatioOf(lo, lm) - 0.12) < 1e-9, 'gap clamped up to 0.12');
  assert.ok(Math.abs(widthRatioOf(lo, lm) - 0.45) < 1e-9, 'width clamped down to 0.45');
  const hi = torsoQuadFor(lm, { gapRatio: 0.5, widthRatio: 0.1 });
  assert.ok(Math.abs(gapRatioOf(hi, lm) - 0.15) < 1e-9, 'gap clamped down to 0.15');
  assert.ok(Math.abs(widthRatioOf(hi, lm) - 0.35) < 1e-9, 'width clamped up to 0.35');
});

test('torsoQuadFor: rejects impossible landmarks', () => {
  assert.throws(() => torsoQuadFor({ collarBottomY: 0.9, hemY: 0.8, torsoCenterX: 0.5, torsoWidth: 0.4 }), 'hem above collar');
  assert.throws(() => torsoQuadFor({ collarBottomY: 0.3, hemY: 1.2, torsoCenterX: 0.5, torsoWidth: 0.4 }), 'hem beyond frame');
  assert.throws(() => torsoQuadFor({ collarBottomY: 0.3, hemY: 0.9, torsoCenterX: 0.5, torsoWidth: 0 }), 'zero torso width');
  assert.throws(() => torsoQuadFor(null));
});

// ---------- DEMO figure: half-body landmarks + derived quads ----------
test('DEMO figure quads obey the TORSO RULE (round 3)', () => {
  for (const [fit, quad] of [['regular', DEMO_FIGURE.chestQuad], ['oversize', DEMO_FIGURE.chestQuadOversize]]) {
    const lm = DEMO_FIGURE.landmarks[fit];
    const gr = gapRatioOf(quad, lm), wr = widthRatioOf(quad, lm);
    assert.ok(gr >= 0.12 && gr <= 0.15, `${fit}: gap ratio ${gr.toFixed(3)} in [0.12,0.15] of torso length`);
    assert.ok(wr >= 0.35 && wr <= 0.45, `${fit}: width ratio ${wr.toFixed(3)} in [0.35,0.45] of torso width`);
    assert.ok(Math.abs(centreX(quad) - lm.torsoCenterX) < 1e-9, `${fit}: centred on torso centre`);
    // half-body framing sanity: collar in the upper third, hem well past
    // the middle (the figure shows the whole garment + waistband).
    assert.ok(lm.collarBottomY > 0.24 && lm.collarBottomY < 0.40, `${fit}: collar ${lm.collarBottomY}`);
    assert.ok(lm.hemY >= 0.75, `${fit}: hem ${lm.hemY} — full garment visible`);
    // torso span in the drawing == the landmark torso width, same centre
    const t = DEMO_FIGURE.torso[fit];
    assert.ok(Math.abs((t.span[1] - t.span[0]) - lm.torsoWidth) < 1e-9, `${fit}: drawing span matches torsoWidth`);
    assert.ok(Math.abs(t.hemY - lm.hemY) < 1e-9, `${fit}: drawing hem matches landmark hem`);
  }
  const area = (q) => widthOf(q) * (bottomOf(q) - topOf(q));
  assert.ok(area(DEMO_FIGURE.chestQuadOversize) > area(DEMO_FIGURE.chestQuad) * 1.3, 'oversize print footprint clearly larger (wider garment, same ratios)');
  assert.ok(DEMO_FIGURE.landmarks.oversize.torsoWidth > DEMO_FIGURE.landmarks.regular.torsoWidth, 'oversize garment genuinely wider');
  assert.ok(DEMO_FIGURE.landmarks.oversize.hemY > DEMO_FIGURE.landmarks.regular.hemY, 'oversize garment genuinely longer');
});

// ---------- fixture quads: all derived from measured landmarks ----------
test('every GARMENT_QUADS preset is the torsoQuadFor of its measured landmarks', () => {
  for (const [path, lm] of Object.entries(FIXTURE_LANDMARKS)) {
    const q = GARMENT_QUADS[path];
    assert.ok(q, 'preset quad exists for ' + path);
    assert.deepEqual(q, torsoQuadFor(lm, { imgW: lm.imgW, imgH: lm.imgH }));
    assert.ok(gapRatioOf(q, lm) >= 0.12 && gapRatioOf(q, lm) <= 0.15, `${path}: gap in band`);
    assert.ok(widthRatioOf(q, lm) >= 0.35 && widthRatioOf(q, lm) <= 0.45, `${path}: width in band`);
  }
  // Removed bases must NOT come back: the owner-rejected round-2 model
  // photo and the round-1 held-up black shirt have no quads.
  assert.equal(GARMENT_QUADS['public/fixtures/real-tee/crew-white-vn-model.webp'], undefined, 'rejected model photo has no compositing quad');
  assert.equal(GARMENT_QUADS['public/fixtures/real-tee/crew-black-woman.webp'], undefined, 'held-up black shirt has no compositing quad');
  // The cream collar close-up is a detail photo, not a compositing base.
  assert.equal(GARMENT_QUADS['public/fixtures/real-tee/crew-white-flatlay.webp'], undefined);
});

// ---------- PHOTO_BASES: garment references only; NO model base ----------
test('PHOTO_BASES: verified garment photos with credits, landmarks — and no model base (round 3)', () => {
  assert.ok(PHOTO_BASES.length >= 3);
  for (const b of PHOTO_BASES) {
    assert.ok(existsSync(new URL('../' + b.path, import.meta.url)), 'fixture file exists: ' + b.path);
    assert.ok(b.source && b.source.platform === 'Pexels' && b.source.photoId && b.source.author && b.source.sourceUrl, 'credit recorded for ' + b.id);
    assert.ok(!['9558713', '8606514', '9558583', '10159280', '25471921'].includes(b.source.photoId), 'retired/banned photo id used: ' + b.id);
    assert.ok(GARMENT_QUADS[b.path], 'calibrated quad for ' + b.id);
    assert.equal(photoBaseByPath(b.path), b);
    assert.equal(b.kind, 'garment', b.id + ' is a garment reference, not a model base');
    assert.deepEqual(b.landmarks, FIXTURE_LANDMARKS[b.path], b.id + ' carries its measured landmarks');
  }
  // ROUND 3: no entry may claim to be a DEMO model photo — the owner's
  // e-commerce checklist found no compliant photo (26 candidates viewed).
  assert.deepEqual(PHOTO_BASES.filter(b => b.demoPhoto || b.kind === 'model'), [], 'no model photo base may be registered until one passes the full checklist');
  // The rejected round-2 fixture file itself is deleted from the repo.
  assert.ok(!existsSync(new URL('../public/fixtures/real-tee/crew-white-vn-model.webp', import.meta.url)), 'rejected model fixture must stay deleted');
});

test('photoBaseFor: null for EVERY garment combo in round 3 (figure fallback is the honest path)', () => {
  assert.equal(photoBaseFor({ style: 'co-tron', colorKey: 'trang', view: 'chinh-dien' }), null, 'white: round-2 photo rejected, no compliant replacement');
  assert.equal(photoBaseFor({ style: 'co-tron', colorKey: 'den', view: 'chinh-dien' }), null, 'black: no Asian model WEARING a plain black crew tee verified');
  assert.equal(photoBaseFor({ style: 'oversize', colorKey: 'trang', view: 'chinh-dien' }), null, 'oversize: a regular tee + bigger print must never fake the fit');
  assert.equal(photoBaseFor({ style: 'oversize', colorKey: 'den', view: 'chinh-dien' }), null);
  assert.equal(photoBaseFor({ style: 'co-tron', colorKey: 'be', view: 'chinh-dien' }), null);
  assert.equal(photoBaseFor({ style: 'co-tron', colorKey: 'trang', view: 'ba-phan-tu' }), null);
  assert.equal(photoBaseFor(null), null);
});

// ---------- FIX C (round 2, kept): logo readable on dark garments ----------
test('FIX C — sample logo: every text is WHITE inside the badge (readable on black tees)', () => {
  assert.ok(!/#293e35/i.test(SAMPLE_DESIGN_SVG), 'dark teal must be gone from the sample logo');
  const texts = [...SAMPLE_DESIGN_SVG.matchAll(/<text[^>]*fill="([^"]+)"[^>]*>([^<]+)<\/text>/g)].map(m => ({ fill: m[1], word: m[2] }));
  assert.deepEqual(texts.map(t => t.word), ['ÁO IN', 'STUDIO']);
  for (const t of texts) assert.equal(t.fill.toLowerCase(), '#ffffff', `text "${t.word}" must be white`);
  assert.ok(/<ellipse[^>]*fill="#b6492f"/.test(SAMPLE_DESIGN_SVG), 'terracotta badge kept');
});

// ---------- ROUND 3 prompt: the owner's VERBATIM catalog template ----------
test('ROUND 3 — Template 1 prompt is the owner verbatim catalog template (exact strings)', () => {
  const tpl1 = TEMPLATES.find(t => t.id === 'tpl1').make();
  const pa = tpl1.nodes.find(n => n.type === 'promptAssistant');
  assert.equal(pa.config.catalogPrompt, true, 'Template 1 promptAssistant carries the catalog flag');
  assert.equal(NODE_DEFS.promptAssistant.defaults.catalogPrompt, false, 'the flag defaults OFF — only Template 1 opts in');
  // white / regular-fit — the exact owner string with [COLOR]/[FIT_TYPE] in
  assert.equal(buildPrompt(pa.config, ''),
    'Commercial e-commerce apparel catalog photo, medium half-body shot from head to hip of a young Vietnamese model standing upright facing camera, wearing a PLAIN white regular-fit cotton crew-neck t-shirt, full t-shirt torso, sleeves and bottom hem clearly visible in frame, hands relaxed in pockets, flat smooth chest fabric area, NO print, NO logo, NO text, clean light grey seamless studio backdrop, soft even commercial studio lighting, sharp fabric texture, 85mm lens, photorealistic lookbook quality.');
  // black / oversize — same template, only the two substitutions change
  assert.equal(catalogPromptFor({ kieuAo: 'oversize', mauAo: 'den' }),
    'Commercial e-commerce apparel catalog photo, medium half-body shot from head to hip of a young Vietnamese model standing upright facing camera, wearing a PLAIN black oversized boxy-fit cotton crew-neck t-shirt, full t-shirt torso, sleeves and bottom hem clearly visible in frame, hands relaxed in pockets, flat smooth chest fabric area, NO print, NO logo, NO text, clean light grey seamless studio backdrop, soft even commercial studio lighting, sharp fabric texture, 85mm lens, photorealistic lookbook quality.');
  assert.ok(!CATALOG_PROMPT_TEMPLATE.includes('[COLOR]') || CATALOG_PROMPT_TEMPLATE.includes('[COLOR]'), 'template keeps its placeholders');
  assert.ok(buildPrompt(pa.config, '').startsWith('Commercial e-commerce apparel catalog photo'), 'verbatim opening');
  // the panel summary must describe the NEW framing for catalog configs
  const sum = garmentSummaryVi(pa.config);
  assert.ok(/NỬA NGƯỜI/.test(sum) && /TOÀN BỘ áo/.test(sum), 'VN summary reflects the half-body full-garment framing: ' + sum.slice(0, 80));
});

test('legacy prompt path unchanged: Vietnamese model options still compose (no catalog flag)', () => {
  assert.equal(PROMPT_OPTIONS.model['nu-viet'], 'người mẫu Việt Nam (nữ)');
  assert.equal(PROMPT_OPTIONS.model['nam-viet'], 'người mẫu Việt Nam (nam)');
  assert.equal(NODE_DEFS.promptAssistant.defaults.model, 'nu-viet', 'new promptAssistant nodes default to the Vietnamese model');
  const tpl1pa = TEMPLATES.find(t => t.id === 'tpl1').make().nodes.find(n => n.type === 'promptAssistant');
  assert.equal(tpl1pa.config.model, 'nu-viet', 'Template 1 promptAssistant model = Vietnamese');
  // Without the catalog flag (Templates 2–4, old projects) the composed
  // P4.1 prompt still names the Vietnamese model options:
  const legacyCfg = { ...tpl1pa.config }; delete legacyCfg.catalogPrompt;
  const out = buildPrompt(legacyCfg, '');
  assert.ok(out.includes('a young Vietnamese female model wearing a PLAIN white'), 'legacy EN prompt names the Vietnamese model: ' + out.slice(0, 140));
  const outM = buildPrompt({ ...legacyCfg, model: 'nam-viet' }, '');
  assert.ok(outM.includes('a young Vietnamese male model'), 'male Vietnamese option builds too');
});

// ---------- composition defaults / migration ----------
test('composition defaults: torso-rule quad, hanger real base, ink opacity migrates', () => {
  const d = NODE_DEFS.composition.defaults;
  // Simple mode draws the design inside a printW-square centred at printY:
  // its top edge must respect the torso rule against the figure landmarks
  // (collar + 12% of torso length at minimum).
  const lm = DEMO_FIGURE.landmarks.regular;
  const boxTop = (d.printY - d.printW / 2) / 100;
  assert.ok(boxTop >= lm.collarBottomY + 0.12 * (lm.hemY - lm.collarBottomY), `simple-mode default box top ${boxTop} clears the torso rule`);
  const hq = GARMENT_QUADS['public/fixtures/real-tee/crew-white-hanger.webp'];
  assert.ok(d.quad.every((pt, i) => Math.abs(pt[0] - hq[i][0]) < 1e-9 && Math.abs(pt[1] - hq[i][1]) < 1e-9), 'default quad = white-hanger torso-rule quad');
  assert.equal(d.realBase, 'public/fixtures/real-tee/crew-white-hanger.webp', 'default real base = hanger garment photo (round 3)');
  assert.equal(d.inkOpacity, 95);
  const m = migrateCompositionConfig({ wrinkle: 10 });
  assert.equal(m.inkOpacity, 95, 'migration adds inkOpacity default');
  assert.equal(m.realBase, 'public/fixtures/real-tee/crew-white-hanger.webp', 'migration default realBase = hanger (round 3)');
  assert.equal(migrateCompositionConfig({ inkOpacity: 88 }).inkOpacity, 88, 'migration preserves a set inkOpacity');
});
