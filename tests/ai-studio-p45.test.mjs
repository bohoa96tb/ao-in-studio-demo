// AI Studio P4.5 unit tests — "Ảnh đầu vào không ảnh hưởng kết quả"
// (owner bug report, 2026-11-15). Covers, at the DOM-free level:
//  - content fingerprints: identity comes from the BYTES, never from a
//    filename/URL/assetId (same bytes -> same fingerprint even when the
//    blob's type/name context differs; different bytes -> different);
//  - template wiring: Mẫu 1 + Mẫu 2 ship imageInput -> aiImageGen.image
//    ('image / reference_image' port), Mẫu 1 ships with NO image
//    selected so its no-reference DEMO path is untouched;
//  - refresh/migration: pre-P4.5 Mẫu 1 (v4) and Mẫu 2 (unversioned)
//    projects gain the wire without losing user content;
//  - validation: an empty imageInput blocks a run ONLY when it feeds a
//    required port (aiVariation), not when it feeds the optional
//    reference port;
//  - engine: an async keyFor + the valueFingerprint hook make a
//    downstream node's cache key follow the actual image BYTES — same
//    config + different bytes re-runs exactly the affected subtree,
//    same bytes stay cached; cache misses report a reason.
// No network: every "image" here is an in-memory Blob.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  TEMPLATES, TPL1_VERSION, TPL2_VERSION, AI_STUDIO_BUILD,
  refreshTpl1Graph, refreshTpl2Graph, validateConnection, makeNode, NODE_DEFS,
} from '../src/ai-studio/core.js';
import { nodeCacheKey, validateWorkflow, fingerprintBytes, fingerprintBlob, fnv1aBytes } from '../src/ai-studio/p2.js';
import { Engine } from '../src/ai-studio/engine.js';

const bytes = (s) => new TextEncoder().encode(s);
const blobOf = (s, type = 'image/png') => new Blob([bytes(s)], { type });

// ---------- content fingerprints ----------
test('fingerprint: same bytes -> same fingerprint regardless of name/type context', async () => {
  const a = await fingerprintBlob(blobOf('IMAGE-BYTES-A', 'image/png'));
  const b = await fingerprintBlob(blobOf('IMAGE-BYTES-A', 'image/webp')); // "renamed"/re-typed copy
  assert.equal(a, b);
  assert.match(a, /^(sha256|fnv1a):/);
  const c = await fingerprintBytes(bytes('IMAGE-BYTES-A'));
  assert.equal(a, c, 'blob and raw-bytes fingerprints agree');
});
test('fingerprint: different bytes -> different fingerprint', async () => {
  const a = await fingerprintBlob(blobOf('IMAGE-BYTES-A'));
  const b = await fingerprintBlob(blobOf('IMAGE-BYTES-B'));
  assert.notEqual(a, b);
  assert.notEqual(fnv1aBytes(bytes('x')), fnv1aBytes(bytes('y')));
  assert.equal(await fingerprintBlob(null), null);
  assert.equal(await fingerprintBlob({ not: 'a blob' }), null);
});
test('cache key: an input key carrying a different content fingerprint changes the node key', () => {
  const gen = makeNode('aiImageGen', 0, 0);
  const kA = nodeCacheKey(gen, { image: 'imageInput:abc|fp:sha256:111' });
  const kB = nodeCacheKey(gen, { image: 'imageInput:abc|fp:sha256:222' });
  assert.notEqual(kA, kB, 'only the image content fingerprint changed -> the key must change');
  assert.equal(nodeCacheKey(gen, { image: 'imageInput:abc|fp:sha256:111' }), kA, 'same fingerprint -> same key (cache stays valid)');
});

// ---------- template wiring ----------
const byType = (g, t) => g.nodes.find(n => n.type === t);
const edge = (g, fromType, toType, port) => g.edges.find(e => e.from === byType(g, fromType)?.id && e.to === byType(g, toType)?.id && e.toPort === port);
test('Mẫu 1 ships the imageInput -> aiImageGen.image wire and NO preselected image', () => {
  const g = TEMPLATES.find(t => t.id === 'tpl1').make();
  assert.ok(edge(g, 'imageInput', 'aiImageGen', 'image'), 'tpl1 must wire imageInput into the reference port');
  const img = byType(g, 'imageInput');
  assert.equal(img.config.fixture, '', 'tpl1 imageInput ships unselected — the no-reference DEMO path (approved bases, byte-identical exports) is untouched');
  assert.equal(img.config.assetId, '');
  assert.equal(g.meta.templateId, 'tpl1'); assert.equal(g.meta.tplVersion, TPL1_VERSION);
  assert.equal(TPL1_VERSION, 5);
  assert.equal(NODE_DEFS.aiImageGen.inputs.find(i => i.id === 'image').label, 'image / reference_image');
});
test('Mẫu 2 ships the imageInput -> aiImageGen.image wire (variation feeds the editor chain instead)', () => {
  const g = TEMPLATES.find(t => t.id === 'tpl2').make();
  assert.ok(edge(g, 'imageInput', 'aiImageGen', 'image'), 'tpl2 must wire imageInput straight into the reference port');
  assert.ok(!edge(g, 'aiVariation', 'aiImageGen', 'image'), 'the variation no longer occupies the reference port');
  assert.ok(edge(g, 'aiVariation', 'imageEditor', 'in'), 'variation still feeds the editor chain');
  assert.ok(edge(g, 'imageInput', 'aiVariation', 'in'), 'variation still derives from the input photo');
  assert.equal(g.meta.templateId, 'tpl2'); assert.equal(g.meta.tplVersion, TPL2_VERSION);
});
test('manual wiring: validateConnection accepts imageInput -> aiImageGen.image and rejects a duplicate', () => {
  const img = makeNode('imageInput', 0, 0); const gen = makeNode('aiImageGen', 300, 0);
  const g = { nodes: [img, gen], edges: [] };
  assert.equal(validateConnection(g, img.id, gen.id, 'image').ok, true);
  g.edges.push({ id: 'e1', from: img.id, to: gen.id, toPort: 'image' });
  assert.equal(validateConnection(g, img.id, gen.id, 'image').ok, false, 'second wire into the same port is rejected');
});

// ---------- refresh / migration ----------
test('refreshTpl1Graph (v4 -> v5) adds the reference wire and preserves the user image choice', () => {
  const g = TEMPLATES.find(t => t.id === 'tpl1').make();
  const img = byType(g, 'imageInput'); const gen = byType(g, 'aiImageGen');
  img.config.fixture = 'public/fixtures/real-tee/crew-black-hanger.webp'; // the user's own selection
  g.edges = g.edges.filter(e => !(e.from === img.id && e.to === gen.id));
  g.meta = { templateId: 'tpl1', tplVersion: 4 };
  const r = refreshTpl1Graph(g);
  assert.equal(r.refreshed, true);
  assert.ok(edge(r.graph, 'imageInput', 'aiImageGen', 'image'), 'wire added by the refresh');
  assert.equal(byType(r.graph, 'imageInput').config.fixture, 'public/fixtures/real-tee/crew-black-hanger.webp', 'user image untouched');
  assert.equal(r.graph.meta.tplVersion, TPL1_VERSION);
  assert.ok(r.notes.some(n => /image \/ reference_image/.test(n)));
  assert.equal(refreshTpl1Graph(r.graph).refreshed, false, 'a current project is not refreshed again');
});
test('refreshTpl2Graph rewires a pre-P4.5 Mẫu 2 (variation-fed) graph to the direct wire', () => {
  const g = TEMPLATES.find(t => t.id === 'tpl2').make();
  const img = byType(g, 'imageInput'); const gen = byType(g, 'aiImageGen'); const vr = byType(g, 'aiVariation');
  // rebuild the OLD wiring shape: gen.image fed by the variation, no meta version
  g.edges = g.edges.filter(e => !(e.from === img.id && e.to === gen.id));
  g.edges.push({ id: 'old-var-gen', from: vr.id, to: gen.id, toPort: 'image' });
  g.meta = { templateId: 'tpl2', tplVersion: 0 };
  const r = refreshTpl2Graph(g);
  assert.equal(r.refreshed, true);
  assert.ok(edge(r.graph, 'imageInput', 'aiImageGen', 'image'));
  assert.ok(!edge(r.graph, 'aiVariation', 'aiImageGen', 'image'));
  assert.ok(edge(r.graph, 'aiVariation', 'imageEditor', 'in'), 'editor chain untouched');
  assert.equal(r.graph.meta.tplVersion, TPL2_VERSION);
  assert.equal(refreshTpl2Graph(r.graph).refreshed, false);
});

// ---------- validation: empty imageInput ----------
test('validateWorkflow: empty imageInput is fine for the optional reference port, blocking for a required port', () => {
  const t1 = TEMPLATES.find(t => t.id === 'tpl1').make();
  const p1 = validateWorkflow(t1).filter(p => /Ảnh đầu vào/.test(p.nodeLabel));
  assert.equal(p1.length, 0, 'fresh Mẫu 1 (empty reference, optional port) must validate clean');
  const t2 = TEMPLATES.find(t => t.id === 'tpl2').make();
  byType(t2, 'imageInput').config.fixture = '';
  const p2 = validateWorkflow(t2).filter(p => /Ảnh đầu vào/.test(p.nodeLabel));
  assert.equal(p2.length, 1, 'Mẫu 2 with an empty input feeding aiVariation (required) must be flagged');
});

// ---------- engine: content-fingerprinted cache invalidation ----------
function graphOf(defs, edges) {
  const nodes = defs.map(([type, key, cfg]) => { const n = makeNode(type, 0, 0); if (cfg) Object.assign(n.config, cfg); n.__key = key; return n; });
  const map = {}; defs.forEach((d, i) => { map[d[1]] = nodes[i]; });
  return { graph: { nodes, edges: edges.map(([f, t, port]) => ({ id: 'e-' + f + '-' + t + '-' + port, from: map[f].id, to: map[t].id, toPort: port })) }, map };
}
test('engine: same config + different image BYTES re-runs exactly the affected subtree; same bytes stay cached', async () => {
  const { graph, map } = graphOf(
    [['imageInput', 'img'], ['aiImageGen', 'gen'], ['promptInput', 'pin', { text: 'xin chào' }]],
    [['img', 'gen', 'image'], ['pin', 'gen', 'prompt']]);
  const cache = new Map(); const calls = { img: 0, gen: 0, pin: 0 }; const missReasons = [];
  let currentBytes = 'IMAGE-A';
  const handlers = {
    imageInput: async () => { calls.img++; return { kind: 'image', blob: blobOf(currentBytes) }; },
    aiImageGen: async (n, { inputs }) => { calls.gen++; return { kind: 'image', blob: inputs.image.blob }; },
    promptInput: async (n) => { calls.pin++; return { kind: 'prompt', text: n.config.text }; },
  };
  const hooks = {
    // Mirrors studio.js's P4.5 keyFor: the plain chained key PLUS, for
    // the source node, a mix-in of the fingerprint of the bytes it is
    // about to read (async keyFor must be awaited by the engine).
    keyFor: async (node, inputKeys) => {
      let k = nodeCacheKey(node, inputKeys);
      if (node.type === 'imageInput') k += '|src:' + (await fingerprintBytes(bytes(currentBytes)));
      return k;
    },
    valueFingerprint: async (v) => fingerprintBlob(v?.blob),
    missReasonFor: (node) => { missReasons.push(node.type); return 'lý do kiểm thử'; },
    cacheable: (n) => n.type !== 'preview',
    cacheGet: async (k) => cache.get(k) ?? null,
    cachePut: async (k, n, v) => cache.set(k, v),
  };
  const run = async () => { const e = new Engine(graph, handlers, hooks); await e.runAll(); return e; };
  await run();
  assert.deepEqual(calls, { img: 1, gen: 1, pin: 1 });
  assert.ok(missReasons.includes('aiImageGen'), 'a first-run miss reports a reason');
  const e2 = await run();
  assert.deepEqual(calls, { img: 1, gen: 1, pin: 1 }, 'unchanged run: everything served from cache');
  assert.equal(map.gen.status, 'cached');
  assert.equal(e2.records.get(map.gen.id).cached, true);
  // THE P4.5 CASE: the image bytes change while every config string
  // stays identical (an asset replaced under the same id). The source
  // node's src-fingerprint changes its key -> it re-reads; its output
  // fingerprint changes -> aiImageGen re-runs; the unrelated prompt
  // branch stays cached.
  currentBytes = 'IMAGE-B-DIFFERENT';
  const e3 = await run();
  assert.equal(calls.img, 2, 'imageInput re-read on new source bytes');
  assert.equal(calls.gen, 2, 'aiImageGen re-ran on new image bytes');
  assert.equal(map.gen.status, 'success');
  assert.equal(calls.pin, 1, 'the unrelated prompt branch stayed cached');
  assert.equal(map.pin.status, 'cached');
  assert.ok(e3.outputs.get(map.gen.id).blob instanceof Blob);
});
test('build marker is p45 (every pre-P4.5 cache entry is invalidated by the build mix-in)', () => {
  assert.equal(AI_STUDIO_BUILD, 'p45');
});
