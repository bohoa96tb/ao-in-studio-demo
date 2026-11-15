/**
 * AI Studio P4.6 unit tests — product reference as first-class data +
 * the structured 7-section prompt system.
 *
 * The redesign (owner's brief 2026-11-15): the product reference is
 * the highest-authority data; AI may change model/scene/light/camera
 * only. These tests pin the DOM-free halves of that contract:
 * the named-colour palette + product merge, the seven prompt sections
 * (identity FIRST, colour-aware negative), the generation-node safety
 * net (finalizePromptForReference), the QC colour gate, the template
 * wiring/versions, and the module-version stamping that fixes the
 * stale-module mechanism found in the P4.6 audit (studio.html used to
 * load studio.js?v=aistudio41 while every internal import was
 * unversioned — a returning phone ran the previous build's modules
 * under the new title).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import {
  NAMED_COLORS, PRODUCT_OPTIONS, FIXTURE_PRODUCT, mergeProduct, nearestNamedColor,
  rgbToHex, hexToRgb, colourDistanceRgb, qcColourVerdict, QC_COLOR_WARN_DISTANCE,
  productIdentityText, productNegativeText, buildPromptSections, assemblePromptText,
  buildPrompt, finalizePromptForReference, garmentParams,
  TEMPLATES, TPL1_VERSION, TPL2_VERSION, AI_STUDIO_BUILD, refreshTpl1Graph, NODE_DEFS, GARMENT_OPTIONS,
} from '../src/ai-studio/core.js';

const BLACK_PRODUCT = { colorKey: 'den', colorVi: 'Đen', colorEn: 'black', colorHex: '#232326', measuredHex: '#26262a', collar: 'co-tron', sleeve: 'tay-ngan', fit: 'regular', hasPrint: false, width: 1200, height: 800, source: 'fixture' };
const PRINTED_PRODUCT = { ...BLACK_PRODUCT, colorKey: 'trang', colorVi: 'Trắng', colorEn: 'white', colorHex: '#f4f4f2', measuredHex: '#e7e1d9', hasPrint: true };

// ---------- palette / colour math ----------
test('P4.6 palette: nearest named colour names black / white / red correctly', () => {
  assert.equal(nearestNamedColor(35, 35, 38).key, 'den');
  assert.equal(nearestNamedColor(244, 244, 242).key, 'trang');
  assert.equal(nearestNamedColor(255, 68, 72).key, 'do', 'the red test-fixture median must name red');
  assert.equal(nearestNamedColor(176, 32, 40).key, 'do');
  assert.equal(rgbToHex(176, 32, 40), '#b02028');
  assert.deepEqual(hexToRgb('#b02028'), [176, 32, 40]);
  assert.equal(hexToRgb('not-a-colour'), null);
});

test('P4.6 QC colour gate: same colour passes, a different garment colour warns', () => {
  assert.ok(qcColourVerdict('#232326', '#2e2e33').pass, 'black vs near-black passes');
  assert.ok(qcColourVerdict('#f4f4f2', '#e9e6df').pass, 'white vs warm off-white passes');
  assert.ok(!qcColourVerdict('#232326', '#f4f4f2').pass, 'black product vs white output MUST warn');
  assert.ok(!qcColourVerdict('#b02028', '#f4f4f2').pass, 'red product vs white output MUST warn');
  assert.ok(qcColourVerdict('#232326', '#f4f4f2').distance > QC_COLOR_WARN_DISTANCE);
  assert.equal(qcColourVerdict('junk', '#ffffff'), null);
});

// ---------- product merge: measured + registry + user, nothing invented ----------
test('P4.6 mergeProduct: measurement names the colour; fixture metadata fills collar/sleeve/fit', () => {
  const p = mergeProduct({ measured: { hex: '#26262a', colorKey: 'den', colorVi: 'Đen', hasPrint: false, width: 1200, height: 800 }, fixturePath: 'public/fixtures/real-tee/crew-black-hanger.webp', user: {} });
  assert.equal(p.colorEn, 'black'); assert.equal(p.measuredHex, '#26262a');
  assert.equal(p.collar, 'co-tron'); assert.equal(p.sleeve, 'tay-ngan'); assert.equal(p.fit, 'regular');
  assert.equal(p.hasPrint, false);
});

test('P4.6 mergeProduct: an upload has NO invented attributes; user corrections win', () => {
  const up = mergeProduct({ measured: { hex: '#b8b0a4', colorKey: 'be', colorVi: 'Be', hasPrint: true, width: 900, height: 900 }, fixturePath: '', user: {} });
  assert.equal(up.collar, ''); assert.equal(up.sleeve, ''); assert.equal(up.fit, '');
  assert.equal(up.source, 'upload'); assert.equal(up.hasPrint, true);
  const fixed = mergeProduct({ measured: { hex: '#26262a', colorKey: 'den', colorVi: 'Đen', hasPrint: false, width: 10, height: 10 }, fixturePath: '', user: { colorKey: 'xam', collar: 'polo', hasPrint: 'true' } });
  assert.equal(fixed.colorEn, 'grey', 'user colour correction wins for the NAME');
  assert.equal(fixed.measuredHex, '#26262a', 'the measured hex stays the pixel truth');
  assert.equal(fixed.collar, 'polo'); assert.equal(fixed.hasPrint, true, "panel 'true' parses to boolean true");
  assert.ok(FIXTURE_PRODUCT['public/fixtures/real-tee/crew-white-hanger.webp'], 'registry covers the shop fixtures');
});

// ---------- the seven sections ----------
test('P4.6 sections: all seven exist; Product Identity is FIRST in the assembled text', () => {
  const s = buildPromptSections({ kieuAo: 'co-tron', mauAo: 'trang' }, '', null);
  for (const k of ['identity', 'model', 'scene', 'lighting', 'camera', 'negative', 'qc']) assert.ok(typeof s[k] === 'string' && s[k].length > 0, 'section ' + k);
  const text = assemblePromptText(s);
  const order = ['[1] PRODUCT IDENTITY', '[2] MODEL', '[3] SCENE', '[4] LIGHTING', '[5] CAMERA', '[6] AVOID (negative prompt)', '[7] QUALITY CONTROL'].map(m => text.indexOf(m));
  assert.ok(order.every(i => i >= 0), 'all markers present');
  assert.ok(order.every((v, i) => i === 0 || v > order[i - 1]), 'sections are in the mandated order');
});

test('P4.6 identity WITH a product: mandatory-preservation language, product-filled, nothing invented', () => {
  const id = productIdentityText(BLACK_PRODUCT);
  assert.match(id, /Use the supplied product reference image as the mandatory garment reference/);
  assert.match(id, /Preserve the exact original garment color, shape, collar, sleeves, fabric appearance and design/);
  assert.match(id, /Do not replace the black T-shirt with any other garment/);
  assert.match(id, /a round crew-neck collar/);
  assert.match(id, /PLAIN — do not add any print/);
  const bare = productIdentityText({ ...BLACK_PRODUCT, collar: '', sleeve: '', fit: '' });
  assert.equal((bare.match(/as shown in the reference image/g) || []).length, 3, 'unspecified attributes defer to the reference image, never an invented value');
  const printed = productIdentityText(PRINTED_PRODUCT);
  assert.match(printed, /EXISTING print — preserve that print exactly/);
});

test('P4.6 negative is colour-aware: a black product explicitly forbids a white shirt', () => {
  const neg = productNegativeText(BLACK_PRODUCT);
  assert.match(neg, /No color change/);
  assert.match(neg, /No white shirt/);
  assert.match(neg, /No garment replacement/);
  assert.match(neg, /No different collar/);
  assert.match(neg, /No different sleeve design/);
  assert.match(neg, /No invented garment graphics/);
  assert.match(neg, /No alteration of original product identity/);
  const negW = productNegativeText(PRINTED_PRODUCT);
  assert.match(negW, /No black shirt/, 'a white product forbids the opposite error');
});

test('P4.6 buildPrompt with a product: identity precedes scene; the verbatim catalog path is NOT used', () => {
  const text = buildPrompt({ catalogPrompt: true, kieuAo: 'co-tron', mauAo: 'trang' }, '', BLACK_PRODUCT);
  assert.ok(text.indexOf('PRODUCT IDENTITY') < text.indexOf('[3] SCENE'), 'identity before scene in the sent prompt');
  assert.match(text, /Do not replace the black T-shirt/);
  assert.ok(!text.startsWith('Commercial e-commerce apparel catalog photo, medium half-body'), 'with a reference the sectioned prompt replaces the verbatim template');
});

test('P4.6 finalizePromptForReference: a product-less prompt gains the product identity FIRST', () => {
  const plain = { kind: 'prompt', text: 'Người mẫu cười nhẹ, nền quán cà phê.', garment: garmentParams({}) };
  const fin = finalizePromptForReference(plain, BLACK_PRODUCT);
  assert.equal(fin.product, BLACK_PRODUCT);
  assert.ok(fin.text.indexOf('[1] PRODUCT IDENTITY') < fin.text.indexOf('Người mẫu cười nhẹ'), 'identity is prepended before the user text');
  assert.match(fin.text, /Do not replace the black T-shirt/);
  assert.match(fin.text, /\[6\] AVOID \(negative prompt\): No color change, No white shirt/);
  const already = { kind: 'prompt', text: fin.text, product: BLACK_PRODUCT, sections: fin.sections };
  assert.equal(finalizePromptForReference(already, BLACK_PRODUCT), already, 'an already product-aware value passes through untouched');
  assert.equal(finalizePromptForReference(plain, null), plain, 'no product -> no change');
});

// ---------- templates / versions / defs ----------
test('P4.6 templates: Mẫu 1 wires imageInput into BOTH aiImageGen.image and promptAssistant.image', () => {
  const g = TEMPLATES.find(t => t.id === 'tpl1').make();
  const by = (t) => g.nodes.find(n => n.type === t);
  assert.ok(g.edges.some(e => e.from === by('imageInput').id && e.to === by('aiImageGen').id && e.toPort === 'image'));
  assert.ok(g.edges.some(e => e.from === by('imageInput').id && e.to === by('promptAssistant').id && e.toPort === 'image'), 'the analysis wire feeds the prompt');
  assert.equal(g.edges.length, 8);
  assert.equal(TPL1_VERSION, 6); assert.equal(TPL2_VERSION, 2);
  assert.equal(NODE_DEFS.promptAssistant.inputs.find(i => i.id === 'image').label, 'Ảnh sản phẩm (phân tích)');
  assert.ok(GARMENT_OPTIONS.mauAo.do, 'the garment colour presets gained red');
});

test('P4.6 refreshTpl1Graph v5 -> v6 adds the promptAssistant analysis wire, keeps the user image', () => {
  const g = TEMPLATES.find(t => t.id === 'tpl1').make();
  const by = (t) => g.nodes.find(n => n.type === t);
  g.edges = g.edges.filter(e => !(e.to === by('promptAssistant').id && e.toPort === 'image'));
  by('imageInput').config.fixture = 'public/fixtures/real-tee/crew-black-hanger.webp';
  g.meta = { templateId: 'tpl1', tplVersion: 5 };
  const r = refreshTpl1Graph(g);
  assert.equal(r.refreshed, true);
  const by2 = (t) => r.graph.nodes.find(n => n.type === t);
  assert.ok(r.graph.edges.some(e => e.from === by2('imageInput').id && e.to === by2('promptAssistant').id && e.toPort === 'image'));
  assert.equal(by2('imageInput').config.fixture, 'public/fixtures/real-tee/crew-black-hanger.webp', 'the user-chosen image is never touched');
  assert.equal(r.graph.meta.tplVersion, 6);
});

// ---------- module version stamping (the stale-module fix) ----------
test('P4.6 module stamping: studio.html + EVERY internal import carry ?v=aistudio46', () => {
  const html = readFileSync(new URL('../studio.html', import.meta.url), 'utf8');
  assert.match(html, /studio\.js\?v=aistudio46/);
  assert.match(html, /studio\.css\?v=aistudio46/);
  assert.match(html, /\(P4\.6\)/);
  assert.equal(AI_STUDIO_BUILD, 'p46');
  const dir = new URL('../src/ai-studio/', import.meta.url);
  for (const f of readdirSync(dir).filter(x => x.endsWith('.js'))) {
    const src = readFileSync(new URL(f, dir), 'utf8');
    for (const m of src.matchAll(/from\s+'(\.\/[^']+)'/g)) {
      assert.ok(m[1].includes('?v=aistudio46'), `${f}: import "${m[1]}" must carry the build version or a returning phone can run a stale module`);
    }
  }
});
