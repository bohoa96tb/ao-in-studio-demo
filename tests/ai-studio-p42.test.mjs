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
// ROUND 4 (owner approval 2026-11-14): the DEMO model layer is now the
// three owner-approved AI-GENERATED model images (AI_MODEL_BASES — a
// separate registry, honestly labelled, never in PHOTO_BASES). Their
// landmarks were grid-measured per image; aiModelBaseFor maps exactly
// white crew / black crew / white oversize; everything else still
// falls back to the drawn figure.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { NODE_DEFS, DEMO_FIGURE, PHOTO_BASES, photoBaseFor, photoBaseByPath, AI_MODEL_BASES, aiModelBaseFor, aiModelBaseByPath, SAMPLE_DESIGN_SVG, PROMPT_OPTIONS, buildPrompt, garmentParams, garmentSummaryVi, CATALOG_PROMPT_TEMPLATE, catalogPromptFor, TEMPLATES, TPL1_VERSION, AI_STUDIO_BUILD, refreshTpl1Graph, cloneGraph } from '../src/ai-studio/core.js';
import { chestQuadFor, torsoQuadFor, GARMENT_QUADS, FIXTURE_LANDMARKS, AI_MODEL_LANDMARKS, AI_MODEL_QUADS, presetQuadFor, migrateCompositionConfig, framingAspectClass, passesHalfBodyFraming } from '../src/ai-studio/warp.js';

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

test('photoBaseFor: null for EVERY garment combo (real-photo registry unchanged in round 4)', () => {
  // Round 4 did NOT add photos: the DEMO model layer moved to the
  // separate AI-generated registry (AI_MODEL_BASES below). photoBaseFor
  // stays real-photos-only and still finds no model photo — a real
  // photo and an AI image must never be confused.
  assert.equal(photoBaseFor({ style: 'co-tron', colorKey: 'trang', view: 'chinh-dien' }), null, 'white: round-2 photo rejected, no compliant replacement');
  assert.equal(photoBaseFor({ style: 'co-tron', colorKey: 'den', view: 'chinh-dien' }), null, 'black: no Asian model WEARING a plain black crew tee verified');
  assert.equal(photoBaseFor({ style: 'oversize', colorKey: 'trang', view: 'chinh-dien' }), null, 'oversize: a regular tee + bigger print must never fake the fit');
  assert.equal(photoBaseFor({ style: 'oversize', colorKey: 'den', view: 'chinh-dien' }), null);
  assert.equal(photoBaseFor({ style: 'co-tron', colorKey: 'be', view: 'chinh-dien' }), null);
  assert.equal(photoBaseFor({ style: 'co-tron', colorKey: 'trang', view: 'ba-phan-tu' }), null);
  assert.equal(photoBaseFor(null), null);
});

// ---------- ROUND 4: owner-approved AI-GENERATED model bases ----------
test('AI_MODEL_BASES: 3 owner-approved AI-generated bases, honestly labelled, NOT photos', () => {
  assert.equal(AI_MODEL_BASES.length, 3);
  for (const b of AI_MODEL_BASES) {
    assert.equal(b.kind, 'ai-model', b.id + ' is an AI-model base');
    assert.ok(existsSync(new URL('../' + b.path, import.meta.url)), 'fixture file exists: ' + b.path);
    assert.ok(b.path.startsWith('public/fixtures/ai-model/'), 'AI bases live apart from the real-photo fixtures: ' + b.path);
    assert.ok(/AI tạo/.test(b.name) && /KHÔNG phải ảnh chụp thật/.test(b.name), 'name must say AI-generated, not a photo: ' + b.id);
    // provenance: generated + owner-approved, never a photo licence
    assert.equal(b.source.platform, 'AI-generated', b.id + ' provenance is AI generation, not a photo platform');
    assert.equal(b.source.approvedBy, 'Chủ shop Van');
    assert.equal(b.source.approvedDate, '2026-11-14');
    assert.ok(/AI TẠO/.test(b.source.note), 'source note states AI-generated: ' + b.id);
    // per-image landmarks, grid-measured on the actual pixels
    assert.deepEqual(b.landmarks, AI_MODEL_LANDMARKS[b.path], b.id + ' carries its measured landmarks');
    assert.equal(b.collarBottomY, b.landmarks.collarBottomY, b.id + ' collar pin matches landmarks');
    assert.equal(aiModelBaseByPath(b.path), b);
    // its quad is the torsoQuadFor of its own landmarks (one rule)
    assert.deepEqual(AI_MODEL_QUADS[b.path], torsoQuadFor(b.landmarks, { imgW: b.landmarks.imgW, imgH: b.landmarks.imgH }), b.id + ' quad derived via the torso rule');
    const gr = gapRatioOf(AI_MODEL_QUADS[b.path], b.landmarks), wr = widthRatioOf(AI_MODEL_QUADS[b.path], b.landmarks);
    assert.ok(gr >= 0.12 && gr <= 0.15, `${b.id}: gap ratio ${gr.toFixed(3)} in [0.12,0.15]`);
    assert.ok(wr >= 0.35 && wr <= 0.45, `${b.id}: width ratio ${wr.toFixed(3)} in [0.35,0.45]`);
    // half-body framing sanity: full garment visible in frame
    assert.ok(b.landmarks.hemY > 0.9, `${b.id}: hem ${b.landmarks.hemY} — whole garment + waistband in frame`);
    // presetQuadFor serves the AI bases too (composition 'real' source)
    assert.deepEqual(presetQuadFor(b.path), AI_MODEL_QUADS[b.path], b.id + ' preset quad available');
  }
  // the AI bases are NOT in the real-photo registry (no licence confusion)
  for (const b of AI_MODEL_BASES) assert.equal(photoBaseByPath(b.path), null, b.id + ' must not appear in PHOTO_BASES');
  // the oversize garment is genuinely wider than the crew garments
  const over = AI_MODEL_BASES.find(b => b.style === 'oversize');
  const crew = AI_MODEL_BASES.find(b => b.style === 'co-tron' && b.colorKey === 'trang');
  assert.ok(over.landmarks.torsoWidth > crew.landmarks.torsoWidth * 1.3, 'oversize torso genuinely wider than crew');
});

test('aiModelBaseFor: maps exactly the 3 approved combos; unmapped combos fall back honestly', () => {
  const w = aiModelBaseFor({ style: 'co-tron', colorKey: 'trang', view: 'chinh-dien' });
  assert.equal(w.base.id, 'ai-model-white-crew');
  assert.deepEqual(w.quad, AI_MODEL_QUADS[w.base.path]);
  const bk = aiModelBaseFor({ style: 'co-tron', colorKey: 'den', view: 'chinh-dien' });
  assert.equal(bk.base.id, 'ai-model-black-crew', 'black crew = the owner-approved MALE model image');
  const ov = aiModelBaseFor({ style: 'oversize', colorKey: 'trang', view: 'chinh-dien' });
  assert.equal(ov.base.id, 'ai-model-white-oversize', 'white oversize IS mapped in round 4');
  // unmapped → null (the caller uses the drawn figure, honestly labelled)
  assert.equal(aiModelBaseFor({ style: 'oversize', colorKey: 'den', view: 'chinh-dien' }), null, 'black oversize has no approved AI base');
  assert.equal(aiModelBaseFor({ style: 'co-tron', colorKey: 'be', view: 'chinh-dien' }), null);
  assert.equal(aiModelBaseFor({ style: 'co-tron', colorKey: 'xam', view: 'chinh-dien' }), null);
  assert.equal(aiModelBaseFor({ style: 'co-tron', colorKey: 'trang', view: 'ba-phan-tu' }), null, 'front view only');
  assert.equal(aiModelBaseFor(null), null);
  // a fresh quad copy every call (callers may mutate)
  assert.notEqual(aiModelBaseFor({ style: 'co-tron', colorKey: 'trang', view: 'chinh-dien' }).quad, w.quad);
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

// ---------- ROUND 4 R1: the SHIPPED Template 1 defaults to the new stack ----------
test('R1 — Template 1 factory: stamped meta, catalog prompt, AI-base default quad, auto resolution', () => {
  const t1 = TEMPLATES.find(t => t.id === 'tpl1').make();
  assert.deepEqual(t1.meta, { templateId: 'tpl1', tplVersion: TPL1_VERSION }, 'the factory stamps the template version marker (R4 hook)');
  const pa = t1.nodes.find(n => n.type === 'promptAssistant');
  const comp = t1.nodes.find(n => n.type === 'composition');
  assert.equal(pa.config.catalogPrompt, true, 'catalog prompt on by default');
  // A fresh instance resolves the approved AI base + its landmarks from
  // the template's OWN default garment params — zero manual edits.
  const g = garmentParams(pa.config);
  const ab = aiModelBaseFor(g);
  assert.equal(ab.base.id, 'ai-model-white-crew', 'default params resolve the white-crew AI base');
  assert.deepEqual(comp.config.quad, ab.quad, 'composition default quad = that base torso-rule quad');
  assert.deepEqual(ab.base.landmarks, AI_MODEL_LANDMARKS[ab.base.path], 'landmarks travel with the base');
  // the other two standard cases resolve too
  assert.equal(aiModelBaseFor(garmentParams({ ...pa.config, mauAo: 'den' })).base.id, 'ai-model-black-crew');
  assert.equal(aiModelBaseFor(garmentParams({ ...pa.config, kieuAo: 'oversize' })).base.id, 'ai-model-white-oversize');
  // meta survives the graph clone used by save/draft/version snapshots
  assert.deepEqual(cloneGraph(t1).meta, t1.meta, 'cloneGraph threads meta');
  assert.ok(AI_STUDIO_BUILD.length > 0, 'build marker present for the cache key');
});

// ---------- ROUND 4 R2: real-AI framing guard classes ----------
test('R2 — framingAspectClass: square/landscape/extreme fail, half-body portraits pass', () => {
  assert.equal(framingAspectClass(512, 512), 'square', 'the mocked sana close-up class');
  assert.equal(framingAspectClass(768, 768), 'square');
  assert.equal(framingAspectClass(1280, 720), 'landscape');
  assert.equal(framingAspectClass(300, 900), 'extreme-portrait');
  assert.equal(framingAspectClass(614, 768), 'portrait-half-body', 'Classic 4:5 output passes the aspect gate');
  assert.equal(framingAspectClass(1024, 1280), 'portrait-half-body');
  assert.equal(framingAspectClass(1280, 1920), 'portrait-half-body', 'the approved AI bases’ own aspect');
  assert.equal(framingAspectClass(720, 1280), 'portrait-half-body', '9:16');
  assert.equal(framingAspectClass(0, 100), 'invalid');
  assert.equal(passesHalfBodyFraming(512, 512), false);
  assert.equal(passesHalfBodyFraming(1024, 1280), true);
});

// ---------- ROUND 4 R4: old Template 1 projects are refreshed on load ----------
test('R4 — refreshTpl1Graph: old marker → defaults refreshed, user quad preserved, input untouched', () => {
  const old = TEMPLATES.find(t => t.id === 'tpl1').make();
  old.meta = { templateId: 'tpl1', tplVersion: 1 };
  const pa = old.nodes.find(n => n.type === 'promptAssistant'); delete pa.config.catalogPrompt;
  const comp = old.nodes.find(n => n.type === 'composition');
  comp.config.realBase = 'public/fixtures/real-tee/crew-white-vn-model.webp'; // retired round-2 base
  comp.config.quad = [[0.1, 0.1], [0.4, 0.1], [0.4, 0.4], [0.1, 0.4]];         // stale quad, not user-set
  const before = JSON.stringify(old);
  const r = refreshTpl1Graph(old);
  assert.equal(r.refreshed, true);
  assert.equal(JSON.stringify(old), before, 'refresh never mutates the loaded graph in place');
  assert.equal(r.graph.meta.tplVersion, TPL1_VERSION, 'marker bumped to current');
  assert.equal(r.graph.nodes.find(n => n.type === 'promptAssistant').config.catalogPrompt, true, 'catalog flag refreshed on');
  const c2 = r.graph.nodes.find(n => n.type === 'composition').config;
  assert.equal(c2.realBase, 'public/fixtures/real-tee/crew-white-hanger.webp', 'retired base replaced by the current hanger base');
  assert.deepEqual(c2.quad, AI_MODEL_QUADS['public/fixtures/ai-model/model-white-crew.webp'], 'default quad refreshed to the AI-base torso quad');
  assert.ok(r.notes.length >= 3, 'user-visible notes produced: ' + r.notes.join(' | '));
  // a user-edited quad is NEVER overwritten
  const userOld = TEMPLATES.find(t => t.id === 'tpl1').make();
  userOld.meta = { templateId: 'tpl1', tplVersion: 2 };
  const uc = userOld.nodes.find(n => n.type === 'composition');
  uc.config.quadSource = 'user'; const uq = [[0.2, 0.2], [0.5, 0.2], [0.5, 0.5], [0.2, 0.5]]; uc.config.quad = uq;
  const r2 = refreshTpl1Graph(userOld);
  assert.equal(r2.refreshed, true);
  assert.deepEqual(r2.graph.nodes.find(n => n.type === 'composition').config.quad, uq, 'user quad preserved');
  // current-version and non-Template-1 graphs pass through untouched
  const cur = TEMPLATES.find(t => t.id === 'tpl1').make();
  assert.equal(refreshTpl1Graph(cur).refreshed, false, 'current template needs no refresh');
  assert.equal(refreshTpl1Graph({ nodes: [], edges: [] }).refreshed, false, 'no marker → not a Template 1 project');
  assert.equal(refreshTpl1Graph(null).refreshed, false);
});
