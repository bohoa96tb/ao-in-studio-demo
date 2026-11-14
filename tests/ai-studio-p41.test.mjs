// AI Studio P4.1 unit tests — Template 1 rework:
//  - buildPrompt: ENGLISH plain-garment generation prompt driven by the
//    garment params (style/colour/view terms + strict prohibitions), with
//    the pre-P4.1 print-drawing instructions REMOVED.
//  - garmentParams: defaults + legacy `angle` migration + hex colours.
//  - Template 1 structure: AI generates the plain garment FIRST, the
//    composition composites the original design AFTER (gen -> comp.garment,
//    des -> comp.design, comp -> preview -> export); no comp -> gen edge.
//  - Prompt payload {text, garment} round-trips through the engine and the
//    P2 cache hashing/serving unchanged (object values, not just strings).
//  - Composition migration: garmentSource/realBase defaults (P4.1 fallback).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NODE_DEFS, TEMPLATES, makeNode, buildPrompt, garmentParams, garmentSummaryVi, GARMENT_OPTIONS, DEMO_FIGURE } from '../src/ai-studio/core.js';
import { Engine } from '../src/ai-studio/engine.js';
import { nodeCacheKey, stableStringify, hashOf } from '../src/ai-studio/p2.js';
import { migrateCompositionConfig, presetQuadFor, AI_MODEL_QUADS } from '../src/ai-studio/warp.js';

test('P4.1 buildPrompt: white crew-neck front view — exact garment terms + prohibitions', () => {
  const out = buildPrompt({ kieuAo: 'co-tron', mauAo: 'trang', gocChup: 'chinh-dien', style: 'studio', model: 'nu-tre', background: 'studio-kem', lighting: 'mem' }, '');
  assert.match(out, /Professional commercial fashion photography/);
  assert.match(out, /PLAIN white classic crew-neck regular-fit cotton t-shirt/);
  assert.match(out, /Front view/);
  assert.match(out, /chest area of the t-shirt is clearly visible/);
  assert.match(out, /NO print, NO logo, NO text, NO letters and NO graphics/);
  assert.match(out, /Do NOT change the garment into a jacket, coat, hoodie, traditional clothing, dress/);
  assert.match(out, /NO accessories \(necklace, bag, strap, scarf, open jacket\) may cover the chest\/print area/);
  assert.match(out, /Realistic cotton fabric texture/);
});

test('P4.1 buildPrompt: oversize black 3/4 — params drive the wording', () => {
  const out = buildPrompt({ kieuAo: 'oversize', mauAo: 'den', gocChup: 'ba-phan-tu' }, '');
  assert.match(out, /PLAIN black oversized boxy-fit with dropped shoulders cotton t-shirt/);
  assert.match(out, /Three-quarter view/);
  for (const [key, en] of [['be', 'beige'], ['xam', 'grey'], ['navy', 'navy blue']]) {
    assert.ok(buildPrompt({ mauAo: key }, '').includes(`PLAIN ${en} `), 'colour ' + key);
  }
});

test('P4.1 buildPrompt: the old print-drawing instructions are GONE', () => {
  const out = buildPrompt({ kieuAo: 'co-tron', mauAo: 'trang' }, 'Người mẫu mặc áo in hình con mèo');
  assert.ok(!out.includes('mặc áo thun in theo yêu cầu'));
  assert.ok(!out.includes('Giữ nguyên chính xác hình in gốc'));
  assert.ok(!/printed (tee|t-shirt)/i.test(out), 'must never ask for a printed tee');
});

test('P4.1 garmentParams: defaults, hex colours, legacy angle migration', () => {
  const d = garmentParams({});
  assert.deepEqual([d.style, d.colorKey, d.view], ['co-tron', 'trang', 'chinh-dien']);
  assert.equal(d.colorHex, '#f4f4f2');
  assert.equal(garmentParams({ mauAo: 'den' }).colorHex, '#232326');
  assert.equal(garmentParams({ angle: 'nghieng' }).view, 'ba-phan-tu', 'P1-P4 angle=nghieng migrates to 3/4 view');
  assert.equal(garmentParams({ angle: 'thang' }).view, 'chinh-dien');
  assert.equal(garmentParams({ gocChup: 'ba-phan-tu', angle: 'thang' }).view, 'ba-phan-tu', 'explicit gocChup wins over legacy angle');
  assert.equal(garmentParams({ kieuAo: 'polo' }).style, 'co-tron', 'unknown style falls back to crew-neck');
  const sum = garmentSummaryVi({ kieuAo: 'oversize', mauAo: 'den' });
  assert.match(sum, /oversize/); assert.match(sum, /đen/); assert.match(sum, /TRƠN/);
});

test('P4.1 Template 1 structure: generate plain garment FIRST, composite original design AFTER', () => {
  const t1 = TEMPLATES.find(t => t.id === 'tpl1').make();
  const byType = (ty) => t1.nodes.find(n => n.type === ty);
  const img = byType('imageInput'), des = byType('designInput'), pa = byType('promptAssistant');
  const gen = byType('aiImageGen'), comp = byType('composition'), prev = byType('preview'), exp = byType('exportNode');
  const has = (f, t, port) => t1.edges.some(e => e.from === f.id && e.to === t.id && e.toPort === port);
  assert.ok(has(pa, gen, 'prompt'), 'promptAssistant -> aiImageGen.prompt');
  assert.ok(has(gen, comp, 'garment'), 'aiImageGen -> composition.garment (AI photo is the base)');
  assert.ok(has(des, comp, 'design'), 'designInput -> composition.design (original file)');
  assert.ok(has(comp, prev, 'in'), 'composition -> preview');
  assert.ok(has(prev, exp, 'in'), 'preview -> export');
  assert.ok(!t1.edges.some(e => e.from === comp.id && e.to === gen.id), 'NO composition -> aiImageGen edge (the P4.1 root-cause fix)');
  assert.ok(!t1.edges.some(e => e.from === img.id), 'reference photo is standalone — NOT wired into the text-to-image node');
  // garment params present on the assistant; the real-photo fallback
  // defaults to a real photo base (P4.1: the crew-white hanger; P4.2
  // round 2: the white crew MODEL photo; P4.2 ROUND 3: back to the
  // crew-white HANGER garment photo — the owner rejected the model
  // photo under the e-commerce standard and removed it as a base).
  // P4.2 ROUND 4 (R1): the composition's stored default quad is the
  // torso-rule quad of the owner-approved AI model base for the
  // template's default garment case (white crew); at run time the
  // generated base's own calibrated quad wins over the stored one.
  assert.equal(pa.config.kieuAo, 'co-tron'); assert.equal(pa.config.mauAo, 'trang'); assert.equal(pa.config.gocChup, 'chinh-dien');
  assert.deepEqual(comp.config.quad, AI_MODEL_QUADS['public/fixtures/ai-model/model-white-crew.webp']);
  assert.equal(comp.config.garmentSource, 'ai');
  assert.equal(comp.config.realBase, 'public/fixtures/real-tee/crew-white-hanger.webp');
  assert.deepEqual(exp.config.channels, ['website'], 'website channel preset = 1200x1500 export');
});

test('P4.1 templates 2-4 unchanged in flow (tpl4 keeps its comp -> gen chain)', () => {
  const t4 = TEMPLATES.find(t => t.id === 'tpl4').make();
  const comp = t4.nodes.find(n => n.type === 'composition'), gen = t4.nodes.find(n => n.type === 'aiImageGen');
  assert.ok(t4.edges.some(e => e.from === comp.id && e.to === gen.id && e.toPort === 'image'), 'tpl4 behaviour preserved');
  for (const id of ['tpl2', 'tpl3']) assert.ok(TEMPLATES.find(t => t.id === id).make().nodes.length >= 5, id + ' builds');
});

test('P4.1 composition migration: garmentSource/realBase defaults, explicit values preserved', () => {
  const m = migrateCompositionConfig({ printX: 50, printY: 42, printW: 34, rotation: 0 });
  assert.equal(m.garmentSource, 'ai'); assert.equal(m.realBase, 'public/fixtures/real-tee/crew-white-hanger.webp'); // P4.2 round 3 default real base (hanger garment photo)
  const r = migrateCompositionConfig({ garmentSource: 'real', realBase: 'public/fixtures/real-tee/crew-black-hanger.webp' });
  assert.equal(r.garmentSource, 'real'); assert.equal(r.realBase, 'public/fixtures/real-tee/crew-black-hanger.webp');
  assert.ok(presetQuadFor(r.realBase), 'real fallback base has a calibrated preset quad');
  assert.equal(NODE_DEFS.composition.defaults.garmentSource, 'ai');
});

test('P4.1 prompt payload {text, garment} round-trips through engine + P2 cache hashing', async () => {
  // Hashing must be deterministic for object payloads regardless of key order.
  const g1 = { style: 'co-tron', colorKey: 'den', colorHex: '#232326', view: 'chinh-dien' };
  const g2 = { view: 'chinh-dien', colorHex: '#232326', colorKey: 'den', style: 'co-tron' };
  assert.equal(hashOf({ text: 'x', garment: g1 }), hashOf({ garment: g2, text: 'x' }));
  assert.deepEqual(JSON.parse(JSON.stringify({ text: 'x', garment: g1 })), { text: 'x', garment: g1 }, 'structured-clone/JSON safe');
  assert.equal(stableStringify({ garment: g1 }).includes('"colorKey":"den"'), true);

  // Engine pass-through with a Map-backed cache: run 1 executes the
  // assistant; run 2 serves it from cache — the garment object must reach
  // the generation node intact BOTH times. (aiImageGen is marked
  // non-cacheable here, like preview/export in the real app, so it
  // re-executes and we can observe what it received.)
  const pa = makeNode('promptAssistant', 0, 0); Object.assign(pa.config, { kieuAo: 'oversize', mauAo: 'den', gocChup: 'ba-phan-tu' });
  const gen = makeNode('aiImageGen', 0, 0);
  const graph = { nodes: [pa, gen], edges: [{ id: 'e1', from: pa.id, to: gen.id, toPort: 'prompt' }] };
  const cache = new Map();
  const seen = [];
  const handlers = {
    promptAssistant: async (n) => ({ kind: 'prompt', text: buildPrompt(n.config, ''), garment: garmentParams(n.config) }),
    aiImageGen: async (n, { inputs }) => { seen.push(inputs.prompt); return { kind: 'image' }; },
  };
  const hooks = {
    keyFor: (node, inputKeys) => nodeCacheKey(node, inputKeys),
    cacheable: (node) => node.type !== 'aiImageGen',
    cacheGet: async (k) => cache.get(k) ?? null,
    cachePut: async (k, node, v) => { cache.set(k, v); },
  };
  const e1 = new Engine(graph, handlers, hooks); await e1.runAll();
  const e2 = new Engine(graph, handlers, hooks); await e2.runAll();
  assert.equal(seen.length, 2, 'gen ran in both runs (it is downstream; its own cache key differs only if inputs differ)');
  for (const p of seen) {
    assert.equal(p.garment.colorKey, 'den'); assert.equal(p.garment.style, 'oversize'); assert.equal(p.garment.view, 'ba-phan-tu');
    assert.match(p.text, /PLAIN black oversized boxy-fit/);
  }
  assert.equal(pa.status, 'cached', 'second run serves the assistant from cache');
  // Editing the garment colour changes the assistant key (and only downstream).
  const paKeyBefore = nodeCacheKey(pa, {});
  pa.config.mauAo = 'trang';
  assert.notEqual(nodeCacheKey(pa, {}), paKeyBefore, 'garment colour is part of the cache identity');
});

test('P4.1 GARMENT_OPTIONS sanity: every colour has label/en/hex; styles + views complete', () => {
  for (const [k, v] of Object.entries(GARMENT_OPTIONS.mauAo)) { assert.ok(v.label && v.en && /^#[0-9a-f]{6}$/i.test(v.hex), k); }
  assert.deepEqual(Object.keys(GARMENT_OPTIONS.kieuAo), ['co-tron', 'oversize']);
  assert.deepEqual(Object.keys(GARMENT_OPTIONS.gocChup), ['chinh-dien', 'ba-phan-tu']);
  // DEMO figure geometry sanity: quads inside the canvas, oversize torso wider.
  for (const q of [DEMO_FIGURE.chestQuad, DEMO_FIGURE.chestQuadOversize]) for (const [px, py] of q) assert.ok(px > 0 && px < 1 && py > 0 && py < 1);
  const rw = DEMO_FIGURE.torso.regular.span[1] - DEMO_FIGURE.torso.regular.span[0];
  const ow = DEMO_FIGURE.torso.oversize.span[1] - DEMO_FIGURE.torso.oversize.span[0];
  assert.ok(ow > rw + 0.08, 'oversize torso visibly wider than regular');
});
