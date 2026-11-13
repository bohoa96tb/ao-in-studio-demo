// AI Studio — Workflow Engine (DOM-free). Executes handlers in topological
// dependency order, tracks per-node status/logs, supports run-all,
// run-single (with upstream), run-from-node (downstream), stop flag and retry.
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

export class Engine {
  constructor(graph, handlers, hooks = {}) { this.graph = graph; this.handlers = handlers; this.hooks = hooks; this.outputs = new Map(); this.stopped = false; this.running = false; }
  stop() { this.stopped = true; }
  log(node, msg) { node.logs = [...(node.logs || []), msg].slice(-30); this.hooks.onNode?.(node); this.hooks.onLog?.(node, msg); }
  inputsFor(node) {
    const inputs = {};
    for (const e of this.graph.edges.filter(e => e.to === node.id)) {
      const src = findNode(this.graph, e.from); const out = this.outputs.get(e.from);
      if (out !== undefined) inputs[e.toPort] = out;
    }
    return inputs;
  }
  async runNode(node) {
    const handler = this.handlers[node.type];
    node.status = 'running'; node.error = ''; this.log(node, 'Đang chạy…'); this.hooks.onNode?.(node);
    if (!handler) { node.status = 'error'; node.error = 'Chưa có bộ xử lý cho loại node này.'; this.hooks.onNode?.(node); throw new Error(node.error); }
    for (const inp of NODE_DEFS[node.type]?.inputs || []) {
      if (inp.required && this.inputsFor(node)[inp.id] === undefined && this.graph.edges.some(e => e.to === node.id && e.toPort === inp.id) === false)
        { node.status = 'error'; node.error = `Thiếu đầu vào bắt buộc: ${inp.label}`; this.hooks.onNode?.(node); throw new Error(node.error); }
    }
    try {
      const out = await handler(node, { inputs: this.inputsFor(node), log: (m) => this.log(node, m), engine: this });
      this.outputs.set(node.id, out);
      node.status = 'success'; this.log(node, 'Hoàn thành.'); this.hooks.onNode?.(node);
      return out;
    } catch (err) {
      node.status = 'error'; node.error = String(err?.message || err); this.log(node, 'Lỗi: ' + node.error); this.hooks.onNode?.(node); throw err;
    }
  }
  async run(ids = null) {
    const order = topoOrder(this.graph, ids ? new Set(ids) : null);
    this.stopped = false; this.running = true;
    const done = [], failed = [];
    try {
      for (const id of order) {
        if (this.stopped) { this.hooks.onLog?.(null, 'Đã dừng theo yêu cầu người dùng.'); break; }
        const node = findNode(this.graph, id);
        // skip nodes whose required upstream (inside this run) failed
        const upstreamFailed = this.graph.edges.some(e => e.to === id && failed.includes(e.from));
        if (upstreamFailed) { node.status = 'error'; node.error = 'Bỏ qua vì node phía trước bị lỗi.'; failed.push(id); this.hooks.onNode?.(node); continue; }
        try { await this.runNode(node); done.push(id); } catch { failed.push(id); }
      }
    } finally { this.running = false; }
    return { done, failed, stopped: this.stopped };
  }
  runAll() { return this.run(null); }
  runSingle(id) { return this.run(upstreamOf(this.graph, id)); }
  runFrom(id) { const up = upstreamOf(this.graph, id).filter(x => x !== id); const down = downstreamOf(this.graph, id); return (async () => { if (up.length) await this.run(up); if (!this.stopped) return this.run(down); })(); }
}
