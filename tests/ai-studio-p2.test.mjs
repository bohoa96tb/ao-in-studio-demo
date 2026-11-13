// AI Studio P2 unit tests: cache keys + invalidation scope, engine caching /
// retry / timeout, run queue ordering, pre-run validator, orphan GC refs,
// history/version pruning, stable hashing.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeNode } from '../src/ai-studio/core.js';
import { Engine } from '../src/ai-studio/engine.js';
import { stableStringify, hashOf, nodeCacheKey, configForKey, isCacheable, RunQueue, validateWorkflow, assetIdsInGraph, collectReferencedAssetIds, findOrphanAssets, pruneOldest, formatDuration } from '../src/ai-studio/p2.js';

function graphOf(defs, edges) {
  const nodes = defs.map(([type, key, cfg]) => { const n = makeNode(type, 0, 0); if (cfg) Object.assign(n.config, cfg); n._key = key; return n; });
  const map = {}; nodes.forEach(n => map[n._key] = n);
  return { graph: { nodes, edges: edges.map(([f, t, p]) => ({ id: f + t + (p || ''), from: map[f].id, to: map[t].id, toPort: p || 'in' })) }, map };
}
const keyFor = (node, inputKeys) => nodeCacheKey(node, inputKeys);

test('stable hashing: key order does not matter, value change does', () => {
  assert.equal(hashOf({ a: 1, b: { c: 2, d: 3 } }), hashOf({ b: { d: 3, c: 2 }, a: 1 }));
  assert.notEqual(hashOf({ a: 1 }), hashOf({ a: 2 }));
  assert.equal(stableStringify({ b: 1, a: 2 }), '{"a":2,"b":1}');
});

test('cache key: derived promptAssistant.composed is volatile and ignored', () => {
  const n = makeNode('promptAssistant', 0, 0);
  const k1 = nodeCacheKey(n, {});
  n.config.composed = 'prompt da soan o lan chay truoc';
  assert.equal(nodeCacheKey(n, {}), k1);
  n.config.style = 'duong-pho';
  assert.notEqual(nodeCacheKey(n, {}), k1);
  assert.equal(configForKey(n).composed, undefined);
});

test('cache key chaining: editing a node changes its key and downstream keys only', () => {
  const { graph, map } = graphOf(
    [['imageInput', 'img'], ['promptInput', 'pin', { text: 'A' }], ['promptAssistant', 'pa'], ['aiImageGen', 'gen']],
    [['pin', 'pa', 'in'], ['pa', 'gen', 'prompt'], ['img', 'gen', 'image']]);
  const keys = () => {
    const imgK = nodeCacheKey(map.img, {}); const pinK = nodeCacheKey(map.pin, {});
    const paK = nodeCacheKey(map.pa, { in: pinK });
    const genK = nodeCacheKey(map.gen, { prompt: paK, image: imgK });
    return { imgK, pinK, paK, genK };
  };
  const before = keys();
  map.pin.config.text = 'B'; // edit the prompt source
  const after = keys();
  assert.notEqual(after.pinK, before.pinK);
  assert.notEqual(after.paK, before.paK);   // downstream of the edit
  assert.notEqual(after.genK, before.genK); // downstream of the edit
  assert.equal(after.imgK, before.imgK);    // unrelated branch untouched
});

test('engine cache: second run serves unchanged nodes from cache, handlers not re-called', async () => {
  const { graph, map } = graphOf([['promptInput', 'p', { text: 'Xin chào' }], ['promptAssistant', 'pa'], ['preview', 'v']], [['p', 'pa', 'in'], ['pa', 'v', 'in']]);
  const cache = new Map(); let calls = 0;
  const handlers = {
    promptInput: async (n) => { calls++; return { kind: 'prompt', text: n.config.text }; },
    promptAssistant: async (n, { inputs }) => { calls++; return { kind: 'prompt', text: inputs.in.text + '!' }; },
    preview: async (n, { inputs }) => inputs.in,
  };
  const hooks = { keyFor, cacheable: isCacheable, cacheGet: async (k) => cache.get(k) ?? null, cachePut: async (k, n, v) => cache.set(k, v) };
  const e1 = new Engine(graph, handlers, hooks); await e1.runAll();
  assert.equal(calls, 2);
  const e2 = new Engine(graph, handlers, hooks); const r2 = await e2.runAll();
  assert.equal(calls, 2, 'no handler should run again');
  assert.equal(map.p.status, 'cached');
  assert.equal(map.pa.status, 'cached');
  assert.equal(e2.records.get(map.pa.id).cached, true);
  assert.equal(r2.failed.length, 0);
  assert.equal(e2.outputs.get(map.v.id).text, 'Xin chào!');
  // Edit the source config -> source + downstream re-run, nothing else exists to stay cached
  map.p.config.text = 'Khác';
  const e3 = new Engine(graph, handlers, hooks); await e3.runAll();
  assert.equal(calls, 4);
  assert.equal(map.p.status, 'success');
});

test('engine retry: flaky generator node succeeds on retry; attempts recorded', async () => {
  const { graph, map } = graphOf([['aiImageGen', 'g']], []);
  let tries = 0;
  const eng = new Engine(graph, { aiImageGen: async () => { tries++; if (tries < 3) throw new Error('provider bận'); return { kind: 'image' }; } },
    { retriesFor: () => 2, timeoutFor: () => 0 });
  const r = await eng.runAll();
  assert.equal(r.failed.length, 0);
  assert.equal(tries, 3);
  assert.equal(eng.records.get(map.g.id).attempts, 3);
  assert.equal(map.g.status, 'success');
});

test('engine retry exhausted: node fails with the last error', async () => {
  const { graph, map } = graphOf([['aiImageGen', 'g']], []);
  const eng = new Engine(graph, { aiImageGen: async () => { throw new Error('luôn lỗi'); } }, { retriesFor: () => 1 });
  const r = await eng.runAll();
  assert.equal(r.failed.length, 1);
  assert.equal(eng.records.get(map.g.id).attempts, 2);
  assert.match(map.g.error, /luôn lỗi/);
});

test('engine timeout: a hanging node fails with a clear timeout error instead of hanging', async () => {
  const { graph, map } = graphOf([['aiImageGen', 'g']], []);
  const eng = new Engine(graph, { aiImageGen: () => new Promise(() => {}) }, { timeoutFor: () => 60, retriesFor: () => 0 });
  const t0 = Date.now(); const r = await eng.runAll();
  assert.ok(Date.now() - t0 < 5000, 'run must finish promptly');
  assert.equal(r.failed.length, 1);
  assert.match(map.g.error, /Quá thời gian chờ/);
});

test('engine records durations and progress callbacks', async () => {
  const { graph } = graphOf([['promptInput', 'p', { text: 'x' }], ['preview', 'v']], [['p', 'v', 'in']]);
  const progress = [];
  const eng = new Engine(graph, { promptInput: async (n) => ({ kind: 'prompt', text: n.config.text }), preview: async (n, { inputs }) => inputs.in },
    { onProgress: (d, t) => progress.push([d, t]) });
  await eng.runAll();
  assert.deepEqual(progress, [[1, 2], [2, 2]]);
  for (const rec of eng.records.values()) { assert.equal(typeof rec.durationMs, 'number'); assert.equal(rec.status, 'success'); }
});

test('engine resume seeding: seeded upstream outputs feed a downstream-only run', async () => {
  const { graph, map } = graphOf([['promptInput', 'p', { text: 'goc' }], ['imageEditor', 'e'], ['preview', 'v']], [['p', 'v', 'in']]);
  // 'e' is unconnected on purpose in this mini-graph; use p -> v only.
  const seeded = new Map([[map.p.id, { kind: 'prompt', text: 'da chay' }]]);
  let pRan = false;
  const eng = new Engine(graph, { promptInput: async () => { pRan = true; return { kind: 'prompt', text: 'moi' }; }, preview: async (n, { inputs }) => inputs.in, imageEditor: async () => ({}) },
    { seedOutputs: seeded });
  await eng.run([map.v.id]);
  assert.equal(pRan, false);
  assert.equal(eng.outputs.get(map.v.id).text, 'da chay');
});

test('run queue: tasks run one at a time, in enqueue order', async () => {
  const order = []; let concurrent = 0, maxConcurrent = 0;
  const q = new RunQueue();
  const mk = (name, delay) => async () => { concurrent++; maxConcurrent = Math.max(maxConcurrent, concurrent); await new Promise(r => setTimeout(r, delay)); order.push(name); concurrent--; return name; };
  const results = await Promise.all([q.enqueue('a', mk('a', 30)), q.enqueue('b', mk('b', 5)), q.enqueue('c', mk('c', 1))]);
  assert.deepEqual(results, ['a', 'b', 'c']);
  assert.deepEqual(order, ['a', 'b', 'c']);
  assert.equal(maxConcurrent, 1);
  assert.equal(q.busy, false); assert.equal(q.waiting, 0);
});

test('validator: wiring + content problems are reported in Vietnamese, valid graph passes', () => {
  const { graph } = graphOf([['designInput', 'd'], ['composition', 'c'], ['promptInput', 'p', { text: '  ' }]], [['d', 'c', 'design']]);
  const problems = validateWorkflow(graph);
  assert.ok(problems.some(p => /chưa có hình in/.test(p.message)), JSON.stringify(problems));
  assert.ok(problems.some(p => /để trống/.test(p.message)));
  const { graph: ok } = graphOf([['designInput', 'd', { svgText: '<svg><rect width="1" height="1"/></svg>' }], ['composition', 'c']], [['d', 'c', 'design']]);
  assert.deepEqual(validateWorkflow(ok), []);
  const { graph: unwired } = graphOf([['imageEditor', 'e']], []);
  assert.ok(validateWorkflow(unwired).some(p => /thiếu đầu vào bắt buộc/.test(p.message)));
});

test('orphan GC: references from projects, versions and drafts all keep assets alive', () => {
  const gA = { nodes: [{ type: 'imageInput', config: { assetId: 'a1', assetIds: ['a2'] } }] };
  const gB = { nodes: [{ type: 'designInput', config: { assetId: 'a3' } }] };
  const gC = { nodes: [{ type: 'imageInput', config: { assetId: 'a4' } }] };
  assert.deepEqual([...assetIdsInGraph(gA)].sort(), ['a1', 'a2']);
  const keep = collectReferencedAssetIds({ projects: [{ graph: gA }], versions: [{ graph: gB }], drafts: [{ graph: gC }] });
  assert.deepEqual([...keep].sort(), ['a1', 'a2', 'a3', 'a4']);
  const orphans = findOrphanAssets([{ id: 'a1' }, { id: 'a3' }, { id: 'zz' }], keep);
  assert.deepEqual(orphans.map(o => o.id), ['zz']);
});

test('pruneOldest keeps the newest N by timestamp', () => {
  const items = Array.from({ length: 30 }, (_, i) => ({ id: 'r' + i, startedAt: i }));
  const drop = pruneOldest(items, 50); assert.deepEqual(drop, []);
  const drop2 = pruneOldest(items, 20, 'startedAt');
  assert.equal(drop2.length, 10);
  assert.ok(drop2.every(x => x.startedAt < 10));
  const vItems = Array.from({ length: 25 }, (_, i) => ({ id: 'v' + i, createdAt: i * 2 }));
  assert.equal(pruneOldest(vItems, 20, 'createdAt').length, 5);
});

test('formatDuration renders Vietnamese-friendly durations', () => {
  assert.equal(formatDuration(250), '250 ms');
  assert.equal(formatDuration(1500), '1,5 s');
  assert.equal(formatDuration(null), '—');
});
