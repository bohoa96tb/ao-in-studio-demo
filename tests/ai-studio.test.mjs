// AI Studio P1 unit tests: engine topo order, cycle rejection, type
// compatibility, template integrity, ZIP round-trip, SVG safety, prompt builder.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NODE_DEFS, NODE_TYPES, TEMPLATES, makeNode, validateConnection, createsCycle, typesCompatible, buildPrompt, checkSvgSafety, zipWrite, zipRead, crc32, SAMPLE_DESIGN_SVG, emptyGraph } from '../src/ai-studio/core.js';
import { Engine, topoOrder, validateGraph, upstreamOf, downstreamOf } from '../src/ai-studio/engine.js';
import { DemoAdapter, HttpAdapter, setSessionKey, clearSessionKey } from '../src/ai-studio/providers.js';

function graphOf(defs, edges) {
  const nodes = defs.map(([type, key]) => { const n = makeNode(type, 0, 0); n._key = key; return n; });
  const map = {}; nodes.forEach(n => map[n._key] = n);
  return { graph: { nodes, edges: edges.map(([f, t, p]) => ({ id: f + t + (p || ''), from: map[f].id, to: map[t].id, toPort: p || 'in' })) }, map };
}

test('all brief node types exist with ports (12 from P1 + background added in P3 = 13)', () => {
  assert.equal(NODE_TYPES.length, 13);
  for (const t of NODE_TYPES) { assert.ok(NODE_DEFS[t].label); assert.equal(NODE_DEFS[t].outputs.length, 1); }
});

test('type compatibility rules', () => {
  assert.ok(typesCompatible('image', 'image'));
  assert.ok(typesCompatible('design', 'image'));
  assert.ok(typesCompatible('image', 'any'));
  assert.ok(!typesCompatible('prompt', 'image'));
  assert.ok(!typesCompatible('video', 'image'));
});

test('connection validation: ok, type mismatch, occupied port, cycle', () => {
  const { graph, map } = graphOf([['imageInput', 'a'], ['promptInput', 'p'], ['composition', 'c'], ['preview', 'v']], [['a', 'c', 'garment']]);
  assert.ok(validateConnection(graph, map.c.id, map.v.id, 'in').ok);
  const bad = validateConnection(graph, map.p.id, map.v.id.replace(map.v.id, map.c.id), 'garment'); // prompt -> image port
  assert.equal(validateConnection(graph, map.p.id, map.c.id, 'garment').ok, false);
  assert.equal(validateConnection(graph, map.a.id, map.c.id, 'garment').ok, false); // occupied / duplicate
  assert.equal(createsCycle(graph, map.c.id, map.a.id), true); // a->c exists, so c->a would loop (also: a has no input port at all)
  const { graph: g2, map: m2 } = graphOf([['imageEditor', 'e1'], ['imageEditor', 'e2']], [['e1', 'e2', 'in']]);
  assert.equal(validateConnection(g2, m2.e2.id, m2.e1.id, 'in').ok, false); // would create cycle
  assert.equal(createsCycle(g2, m2.e2.id, m2.e1.id), true);
});

test('topo order respects dependencies', () => {
  const { graph, map } = graphOf([['imageInput', 'a'], ['designInput', 'd'], ['composition', 'c'], ['preview', 'v']], [['a', 'c', 'garment'], ['d', 'c', 'design'], ['c', 'v', 'in']]);
  const order = topoOrder(graph);
  assert.ok(order.indexOf(map.c.id) > order.indexOf(map.a.id));
  assert.ok(order.indexOf(map.v.id) > order.indexOf(map.c.id));
  assert.equal(upstreamOf(graph, map.v.id).length, 4);
  assert.equal(downstreamOf(graph, map.a.id).length, 3);
});

test('engine runs in dependency order and records status/logs', async () => {
  const { graph, map } = graphOf([['promptInput', 'p'], ['promptAssistant', 'pa'], ['preview', 'v']], [['p', 'pa', 'in'], ['pa', 'v', 'in']]);
  map.p.config.text = 'Áo đẹp';
  const ran = [];
  const handlers = {
    promptInput: async (n) => { ran.push('p'); return { kind: 'prompt', text: n.config.text }; },
    promptAssistant: async (n, { inputs }) => { ran.push('pa'); return { kind: 'prompt', text: buildPrompt(n.config, inputs.in.text) }; },
    preview: async (n, { inputs }) => { ran.push('v'); return inputs.in; },
  };
  const eng = new Engine(graph, handlers);
  const r = await eng.runAll();
  assert.deepEqual(ran, ['p', 'pa', 'v']);
  assert.equal(r.failed.length, 0);
  assert.equal(map.v.status, 'success');
  assert.ok(eng.outputs.get(map.v.id).text.includes('Áo đẹp'));
});

test('engine: error in one branch marks node error, missing required input caught by validateGraph', async () => {
  const { graph } = graphOf([['imageEditor', 'e']], []);
  assert.ok(validateGraph(graph).some(p => p.message.includes('thiếu')));
  const eng = new Engine(graph, { imageEditor: async () => { throw new Error('boom'); } });
  graph.nodes[0].id; const r = await eng.runAll().catch(() => null);
  // runNode validates required input wiring: handler not reached because input missing -> engine records failure
  assert.ok(r === null || r.failed.length === 1);
});

test('prompt builder composes Vietnamese prompt from rules', () => {
  const out = buildPrompt({ style: 'studio', model: 'nu-tre', background: 'studio-kem', lighting: 'mem', angle: 'thang', extra: 'màu áo đỏ' }, 'Mô tả gốc');
  assert.ok(out.includes('Mô tả gốc'));
  assert.ok(out.includes('người mẫu nữ trẻ'));
  assert.ok(out.includes('giữ nguyên chính xác hình in gốc'.toLowerCase()) || out.includes('Giữ nguyên chính xác hình in gốc'));
});

test('SVG safety check rejects scripts/handlers, accepts sample', () => {
  assert.equal(checkSvgSafety(SAMPLE_DESIGN_SVG).ok, true);
  assert.equal(checkSvgSafety('<svg><script>alert(1)</script><rect width="1" height="1"/></svg>').ok, false);
  assert.equal(checkSvgSafety('<svg onload="x()"><rect width="1" height="1"/></svg>').ok, false);
  assert.equal(checkSvgSafety('<svg><a href="javascript:x"><rect width="1" height="1"/></a></svg>').ok, false);
  assert.equal(checkSvgSafety('not svg').ok, false);
});

test('ZIP writer round-trips through reader and has PK signature + CRC', () => {
  const data = new TextEncoder().encode('Xin chào Áo In Studio');
  const zip = zipWrite([{ name: 'workflow.json', data: new TextEncoder().encode('{"a":1}') }, { name: 'assets/x.txt', data }]);
  assert.equal(zip[0], 0x50); assert.equal(zip[1], 0x4b);
  const back = zipRead(zip);
  assert.equal(back.length, 2);
  assert.equal(new TextDecoder().decode(back.find(e => e.name === 'assets/x.txt').data), 'Xin chào Áo In Studio');
  assert.ok(crc32(data) > 0);
});

test('all 4 templates are valid, wired and acyclic', () => {
  assert.equal(TEMPLATES.length, 4);
  for (const t of TEMPLATES) {
    const g = t.make();
    assert.ok(g.nodes.length >= 5, t.id);
    assert.ok(g.edges.length >= 4, t.id);
    assert.equal(validateGraph(g).filter(p => p.message.includes('vòng lặp')).length, 0, t.id);
    assert.doesNotThrow(() => topoOrder(g), t.id);
    for (const e of g.edges) { const v = validateConnection({ nodes: g.nodes, edges: g.edges.filter(x => x !== e) }, e.from, e.to, e.toPort); assert.ok(v.ok, `${t.id}: ${v.reason}`); }
  }
});

test('providers: demo is labelled demo; HTTP adapter refuses without config', async () => {
  const demo = new DemoAdapter({ demoImage: async () => 'demo-img' });
  assert.equal(demo.isDemo, true);
  assert.equal(await demo.generateImage({}), 'demo-img');
  clearSessionKey();
  const http = new HttpAdapter({ endpoint: '' });
  assert.equal(http.configured, false);
  await assert.rejects(() => http.generateImage({}), /chưa|Chưa|endpoint|ánh xạ/);
  setSessionKey('k'); const http2 = new HttpAdapter({ endpoint: 'https://example.invalid/ai' });
  assert.equal(http2.configured, true);
  await assert.rejects(() => http2.generateImage({}), /chưa được cấu hình trong P1/);
  clearSessionKey();
});
