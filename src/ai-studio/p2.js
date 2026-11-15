// AI Studio P2 — DOM-free helpers for the hardened workflow engine:
// stable hashing + node cache keys, a sequential run queue, the pre-run
// validation report, asset-reference computation for orphan GC, and list
// pruning for run history / project versions. No browser APIs here.
import { NODE_DEFS, AI_STUDIO_BUILD } from './core.js';
import { validateGraph } from './engine.js';

// ---------- stable stringify + FNV-1a hash ----------
export function stableStringify(v) {
  if (v === null || typeof v !== 'object') return JSON.stringify(v) ?? 'null';
  if (Array.isArray(v)) return '[' + v.map(stableStringify).join(',') + ']';
  return '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + stableStringify(v[k])).join(',') + '}';
}
export function fnv1a(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return ('0000000' + (h >>> 0).toString(16)).slice(-8);
}
export function hashOf(v) { return fnv1a(stableStringify(v)); }

// ---------- content fingerprints (P4.5) ----------
// A node's identity must include the CONTENT of the images it consumes,
// not just config strings: replacing an asset's bytes under the same
// assetId (a ZIP re-import does exactly that) or changing a fixture
// file's bytes leaves every config hash unchanged, so a config-only
// cache key silently serves the old image's results. Fingerprints are
// computed from the actual bytes — never from a filename, URL or
// assetId — so identical bytes always give the same fingerprint (even
// after a rename) and different bytes give a different one.
/** FNV-1a over raw bytes (sync, deterministic; the fallback when
 * WebCrypto is unavailable and the shape of the value in tests). */
export function fnv1aBytes(bytes) {
  let h = 0x811c9dc5;
  for (let i = 0; i < bytes.length; i++) { h ^= bytes[i] & 0xff; h = Math.imul(h, 0x01000193); }
  return ('0000000' + (h >>> 0).toString(16)).slice(-8);
}
/** SHA-256 hex of raw bytes via WebCrypto (present in browsers and
 * Node ≥ 19); falls back to the FNV-1a byte hash where subtle crypto
 * is unavailable. The prefix records which algorithm produced it, so a
 * fingerprint is never compared across algorithms. */
export async function fingerprintBytes(bytes) {
  const subtle = globalThis.crypto?.subtle;
  if (subtle) {
    try {
      const digest = await subtle.digest('SHA-256', bytes);
      return 'sha256:' + [...new Uint8Array(digest)].map(x => x.toString(16).padStart(2, '0')).join('');
    } catch { /* fall through to the deterministic byte hash */ }
  }
  return 'fnv1a:' + fnv1aBytes(bytes);
}
/** Content fingerprint of a Blob's bytes (its name/type are ignored —
 * only the bytes identify the image). */
export async function fingerprintBlob(blob) {
  if (!(blob instanceof Blob)) return null;
  return fingerprintBytes(new Uint8Array(await blob.arrayBuffer()));
}

// ---------- node output cache keys ----------
// Config fields that are derived at run time (or pure display) must not change
// a node's identity: promptAssistant writes its composed prompt back into its
// own config while running, which would otherwise invalidate itself forever.
export const VOLATILE_CONFIG_KEYS = { promptAssistant: ['composed'] };
export function configForKey(node) {
  const cfg = { ...(node.config || {}) };
  for (const k of VOLATILE_CONFIG_KEYS[node.type] || []) delete cfg[k];
  return cfg;
}
/**
 * Cache key for one node = hash of its type, its (stable) config, the
 * cache keys of everything wired into its input ports — AND the
 * behaviour build marker (P4.2 round 4, R4). The chained hash alone
 * cannot see CODE behaviour: an old draft's aiImageGen node has the
 * same config and inputs before and after the base registry /
 * calibration changed, so without the build marker its stale cached
 * output (e.g. a pre-P4.2 figure composite) would be silently reused.
 * Mixing AI_STUDIO_BUILD into every key invalidates all pre-upgrade
 * cache entries at once. Because a node's key embeds its upstream
 * keys, editing a node changes exactly its own key and the keys of
 * everything downstream of it — nothing else.
 */
export function nodeCacheKey(node, inputKeys = {}, build = AI_STUDIO_BUILD) {
  return node.type + ':' + hashOf({ t: node.type, c: configForKey(node), i: inputKeys, b: build });
}

// Node types whose execution must NOT be served from cache: they are pure
// pass-throughs or carry side effects (Save Project must actually save).
export const NON_CACHEABLE_TYPES = new Set(['preview', 'exportNode', 'saveProject']);
export function isCacheable(node) { return !NON_CACHEABLE_TYPES.has(node.type); }

// ---------- sequential run queue ----------
/** Runs tasks one at a time, in enqueue order. Extra run requests made while
 * a run is active wait in line instead of interleaving on shared state. */
export class RunQueue {
  constructor(onChange = null) { this.pending = []; this.active = null; this.onChange = onChange; this.seq = 0; }
  get waiting() { return this.pending.length; }
  get busy() { return this.active !== null; }
  _notify() { this.onChange?.({ busy: this.busy, waiting: this.waiting }); }
  enqueue(label, task) {
    return new Promise((resolve, reject) => {
      this.pending.push({ id: ++this.seq, label, task, resolve, reject });
      this._notify(); this._pump();
    });
  }
  async _pump() {
    if (this.active || !this.pending.length) return;
    const job = this.pending.shift(); this.active = job; this._notify();
    try { job.resolve(await job.task()); } catch (e) { job.reject(e); }
    finally { this.active = null; this._notify(); this._pump(); }
  }
}

// ---------- pre-run validation report ----------
/**
 * Full pre-run validation: wiring problems from the engine's validateGraph
 * PLUS content problems the wiring check cannot see (a design node with no
 * design loaded, an empty prompt, …). Returns [{nodeId, nodeLabel, message}]
 * with Vietnamese messages; an empty list means the run may start.
 */
export function validateWorkflow(graph) {
  const problems = validateGraph(graph).map(p => {
    const n = graph.nodes.find(x => x.id === p.nodeId);
    return { nodeId: p.nodeId, nodeLabel: n ? NODE_DEFS[n.type]?.label || n.type : '', message: p.message };
  });
  for (const n of graph.nodes) {
    const label = NODE_DEFS[n.type]?.label || n.type;
    const c = n.config || {};
    const add = (message) => problems.push({ nodeId: n.id, nodeLabel: label, message });
    if (n.type === 'designInput' && !c.assetId && !c.svgText) add(`Node "${label}" chưa có hình in: hãy tải PNG/SVG hoặc dùng hình in mẫu.`);
    // P4.5: an imageInput with NO image selected is only a problem when
    // its output feeds a REQUIRED input port (e.g. aiVariation). When it
    // feeds only optional ports (aiImageGen's reference image), an empty
    // selection is a legitimate state — the consumer runs without a
    // reference (Template 1 then uses its approved model bases).
    if (n.type === 'imageInput' && !c.assetId && !c.fixture) {
      const feedsRequired = graph.edges.some(e => {
        if (e.from !== n.id) return false;
        const target = graph.nodes.find(x => x.id === e.to);
        return NODE_DEFS[target?.type]?.inputs?.find(i => i.id === e.toPort)?.required;
      });
      if (feedsRequired) add(`Node "${label}" chưa có ảnh: hãy chọn ảnh có sẵn hoặc tải ảnh lên.`);
    }
    if (n.type === 'promptInput' && !String(c.text || '').trim()) add(`Node "${label}" đang để trống nội dung prompt.`);
    if (n.type === 'composition' && !graph.edges.some(e => e.to === n.id && e.toPort === 'garment') && !c.base) add(`Node "${label}" không có ảnh áo nền (chưa nối dây và chưa chọn ảnh dự phòng).`);
  }
  return problems;
}

// ---------- orphan-asset garbage collection ----------
/** Every asset id referenced by a workflow graph (node configs). */
export function assetIdsInGraph(graph) {
  const ids = new Set();
  for (const n of graph?.nodes || []) {
    if (n.config?.assetId) ids.add(n.config.assetId);
    for (const id of n.config?.assetIds || []) ids.add(id);
  }
  return ids;
}
/**
 * Asset ids that must be kept: referenced by ANY project, version snapshot or
 * unsaved draft. Anything in the assets store outside this set is an orphan.
 * (Cache records keep their own output blobs inside the cache store, so they
 * never keep an input asset alive on their own.)
 */
export function collectReferencedAssetIds({ projects = [], versions = [], drafts = [] } = {}) {
  const keep = new Set();
  for (const p of projects) for (const id of assetIdsInGraph(p.graph)) keep.add(id);
  for (const v of versions) for (const id of assetIdsInGraph(v.graph)) keep.add(id);
  for (const d of drafts) for (const id of assetIdsInGraph(d.graph)) keep.add(id);
  return keep;
}
export function findOrphanAssets(allAssets, keepIds) {
  return allAssets.filter(a => !keepIds.has(a.id));
}

// ---------- pruning (run history / versions caps) ----------
/** Keep the newest `cap` items (by the given timestamp field); return the rest. */
export function pruneOldest(items, cap, tsField = 'startedAt') {
  if (items.length <= cap) return [];
  return [...items].sort((a, b) => (b[tsField] || 0) - (a[tsField] || 0)).slice(cap);
}

export function formatDuration(ms) {
  if (ms == null || isNaN(ms)) return '—';
  if (ms < 1000) return Math.round(ms) + ' ms';
  return (ms / 1000).toFixed(1).replace('.', ',') + ' s';
}
