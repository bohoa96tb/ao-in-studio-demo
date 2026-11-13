// AI Studio — Workflow Engine (DOM-free). Executes handlers in topological
// dependency order, tracks per-node status/logs, supports run-all,
// run-single (with upstream), run-from-node (downstream), stop flag and retry.
//
// P2 additions: per-node output caching (hooks.cacheGet/cachePut/keyFor —
// unchanged upstream nodes are skipped and marked 'cached'), per-node retry
// (hooks.retriesFor), per-node timeout (hooks.timeoutFor), per-node duration
// + attempt records (engine.records), run progress (hooks.onProgress) and
// seeded outputs/keys (hooks.seedOutputs/seedKeys) so a resumed run can
// reuse upstream results without re-running them.
import { NODE_DEFS, findNode } from './core.js';

export function topoOrder(graph, subsetIds = null) {
  const ids = subsetIds ? new Set(subsetIds) : new Set(graph.nodes.map(n => n.id));
  const indeg = new Map([...ids].map(id => [id, 0]));
  const adj = new Map([...ids].map(id => [id, []]));
  for (const e of graph.edges) {
    if (ids.has(e.from) && ids.has(e.to)) { indeg.set(e.to, indeg.get(e.to) + 1); adj.get(e.from).push(e.to); }
  }
  const queue = graph.nodes.filter(n => ids.has(n.id) && indeg.get(n.id) === 0).map(n => n.id);
  const order = [];
  while (queue.length) {
    const id = queue.shift(); order.push(id);
    for (const nxt of adj.get(id)) { indeg.set(nxt, indeg.get(nxt) - 1); if (indeg.get(nxt) === 0) queue.push(nxt); }
  }
  if (order.length !== ids.size) throw new Error('Workflow có vòng lặp — không thể xác định thứ tự chạy.');
  return order;
}
export function upstreamOf(graph, id) { const set = new Set([id]); let grew = true; while (grew) { grew = false; for (const e of graph.edges) if (set.has(e.to) && !set.has(e.from)) { set.add(e.from); grew = true; } } return [...set]; }
export function downstreamOf(graph, id) { const set = new Set([id]); let grew = true; while (grew) { grew = false; for (const e of graph.edges) if (set.has(e.from) && !set.has(e.to)) { set.add(e.to); grew = true; } } return [...set]; }

export function validateGraph(graph) {
  const problems = [];
  for (const n of graph.nodes) {
    for (const inp of NODE_DEFS[n.type]?.inputs || []) {
      if (inp.required && !graph.edges.some(e => e.to === n.id && e.toPort === inp.id)) problems.push({ nodeId: n.id, message: `Node "${NODE_DEFS[n.type].label}" thiếu đầu vào bắt buộc: ${inp.label}.` });
    }
  }
  try { topoOrder(graph); } catch (e) { problems.push({ nodeId: '', message: e.message }); }
  return problems;
}

function withTimeout(promise, ms, label) {
  if (!ms || ms <= 0) return promise;
  let timer;
  const timeout = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`Quá thời gian chờ (${Math.round(ms / 1000)}s) — node "${label}" bị hủy chờ. Tăng thời gian chờ trong Cài đặt chạy nếu tác vụ thật sự cần lâu hơn.`)), ms); });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

export class Engine {
  constructor(graph, handlers, hooks = {}) {
    this.graph = graph; this.handlers = handlers; this.hooks = hooks;
    this.outputs = new Map(hooks.seedOutputs || []);
    this.keys = new Map(hooks.seedKeys || []);
    this.records = new Map(); // nodeId -> {status, durationMs, attempts, error, cached}
    this.stopped = false; this.running = false;
  }
  stop() { this.stopped = true; }
  log(node, msg) { node.logs = [...(node.logs || []), msg].slice(-30); this.hooks.onNode?.(node); this.hooks.onLog?.(node, msg); }
  inputsFor(node) {
    const inputs = {};
    for (const e of this.graph.edges.filter(e => e.to === node.id)) {
      const out = this.outputs.get(e.from);
      if (out !== undefined) inputs[e.toPort] = out;
    }
    return inputs;
  }
  inputKeysFor(node) {
    const keys = {};
    for (const e of this.graph.edges.filter(e => e.to === node.id)) {
      const k = this.keys.get(e.from);
      if (k !== undefined) keys[e.toPort] = k;
    }
    return keys;
  }
  async runNode(node) {
    const handler = this.handlers[node.type];
    const label = NODE_DEFS[node.type]?.label || node.type;
    const t0 = Date.now();
    node.error = ''; node.cached = false;
    // Cache key first: it chains upstream keys, so it is computed for every
    // node (even pass-through ones) before deciding whether to serve cache.
    let key = null;
    if (this.hooks.keyFor) { key = this.hooks.keyFor(node, this.inputKeysFor(node)); if (key) this.keys.set(node.id, key); }
    const cacheable = key && this.hooks.cacheGet && (this.hooks.cacheable ? this.hooks.cacheable(node) : true);
    if (cacheable) {
      try {
        const hit = await this.hooks.cacheGet(key);
        if (hit !== null && hit !== undefined) {
          this.outputs.set(node.id, hit);
          node.status = 'cached'; node.cached = true; node.durationMs = 0;
          this.records.set(node.id, { status: 'cached', durationMs: 0, attempts: 0, error: '', cached: true });
          this.log(node, 'Dùng kết quả trong bộ nhớ đệm (cấu hình và đầu vào không đổi — không chạy lại).');
          this.hooks.onNode?.(node);
          return hit;
        }
      } catch { /* a broken cache must never break a run: fall through and execute */ }
    }
    node.status = 'running'; this.log(node, 'Đang chạy…'); this.hooks.onNode?.(node);
    const fail = (msg) => { node.status = 'error'; node.error = msg; node.durationMs = Date.now() - t0; this.records.set(node.id, { status: 'error', durationMs: node.durationMs, attempts: node.attempts || 1, error: msg, cached: false }); this.log(node, 'Lỗi: ' + msg); this.hooks.onNode?.(node); throw new Error(msg); };
    if (!handler) fail('Chưa có bộ xử lý cho loại node này.');
    for (const inp of NODE_DEFS[node.type]?.inputs || []) {
      if (inp.required && this.inputsFor(node)[inp.id] === undefined && this.graph.edges.some(e => e.to === node.id && e.toPort === inp.id) === false)
        fail(`Thiếu đầu vào bắt buộc: ${inp.label}`);
    }
    const retries = Math.max(0, this.hooks.retriesFor ? this.hooks.retriesFor(node) : 0);
    const timeoutMs = Math.max(0, this.hooks.timeoutFor ? this.hooks.timeoutFor(node) : 0);
    let lastErr = null;
    for (let attempt = 1; attempt <= retries + 1; attempt++) {
      node.attempts = attempt;
      try {
        const out = await withTimeout(Promise.resolve().then(() => handler(node, { inputs: this.inputsFor(node), log: (m) => this.log(node, m), engine: this })), timeoutMs, label);
        this.outputs.set(node.id, out);
        node.status = 'success'; node.durationMs = Date.now() - t0;
        this.records.set(node.id, { status: 'success', durationMs: node.durationMs, attempts: attempt, error: '', cached: false });
        this.log(node, attempt > 1 ? `Hoàn thành (sau ${attempt} lần thử).` : 'Hoàn thành.');
        this.hooks.onNode?.(node);
        if (cacheable && this.hooks.cachePut) { try { await this.hooks.cachePut(key, node, out); } catch { /* cache write failure is not a run failure */ } }
        return out;
      } catch (err) {
        lastErr = err;
        if (attempt <= retries) this.log(node, `Lỗi: ${String(err?.message || err)} — đang thử lại (${attempt}/${retries})…`);
      }
    }
    fail(String(lastErr?.message || lastErr));
  }
  async run(ids = null) {
    const order = topoOrder(this.graph, ids ? new Set(ids) : null);
    this.stopped = false; this.running = true;
    const done = [], failed = [];
    let settled = 0;
    try {
      for (const id of order) {
        if (this.stopped) { this.hooks.onLog?.(null, 'Đã dừng theo yêu cầu người dùng.'); break; }
        const node = findNode(this.graph, id);
        // skip nodes whose required upstream (inside this run) failed
        const upstreamFailed = this.graph.edges.some(e => e.to === id && failed.includes(e.from));
        if (upstreamFailed) {
          node.status = 'error'; node.error = 'Bỏ qua vì node phía trước bị lỗi.';
          this.records.set(id, { status: 'error', durationMs: 0, attempts: 0, error: node.error, cached: false });
          failed.push(id); this.hooks.onNode?.(node);
        } else {
          try { await this.runNode(node); done.push(id); } catch { failed.push(id); }
        }
        settled += 1; this.hooks.onProgress?.(settled, order.length, node);
      }
    } finally { this.running = false; }
    return { done, failed, stopped: this.stopped };
  }
  runAll() { return this.run(null); }
  runSingle(id) { return this.run(upstreamOf(this.graph, id)); }
  runFrom(id) { const up = upstreamOf(this.graph, id).filter(x => x !== id); const down = downstreamOf(this.graph, id); return (async () => { if (up.length) await this.run(up); if (!this.stopped) return this.run(down); })(); }
}
