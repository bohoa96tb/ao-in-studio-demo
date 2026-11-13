// AI Studio — DOM-free core: node definitions, type/cycle rules, rule-based
// Vietnamese prompt builder, SVG safety check, minimal store-only ZIP writer
// + reader. Node-testable; no browser APIs used here.

export const DATA_TYPES = ['image', 'design', 'prompt', 'video', 'any'];

export function typesCompatible(outType, inType) {
  if (!outType || !inType) return false;
  if (outType === 'any' || inType === 'any') return true;
  if (outType === inType) return true;
  if (inType === 'image' && outType === 'design') return true; // a design is image-like downstream
  return false;
}

let counter = 0;
export function uid(prefix = 'n') { counter += 1; return `${prefix}-${Date.now().toString(36)}-${counter.toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`; }

export const SAMPLE_DESIGN_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600"><circle cx="300" cy="270" r="150" fill="#b6492f"/><text x="300" y="295" font-family="Arial, sans-serif" font-size="64" font-weight="bold" fill="#ffffff" text-anchor="middle">ÁO IN</text><text x="300" y="480" font-family="Arial, sans-serif" font-size="44" font-weight="bold" fill="#293e35" text-anchor="middle">STUDIO</text></svg>`;

// category: input | process | ai | output ; colour per brief §4 (colour-coded nodes)
export const NODE_DEFS = {
  imageInput: { label: 'Ảnh đầu vào', category: 'input', color: '#2f6f4f', inputs: [], outputs: [{ id: 'out', type: 'image', label: 'Ảnh' }],
    defaults: { assetId: '', assetName: '', fixture: 'public/fixtures/real-tee/crew-white-hanger.webp', width: 0, height: 0 } },
  designInput: { label: 'Hình in (thiết kế)', category: 'input', color: '#7a4a9e', inputs: [], outputs: [{ id: 'out', type: 'design', label: 'Hình in' }],
    defaults: { assetId: '', assetName: '', svgText: '', width: 0, height: 0 } },
  promptInput: { label: 'Prompt', category: 'input', color: '#38618c', inputs: [], outputs: [{ id: 'out', type: 'prompt', label: 'Prompt' }],
    defaults: { text: 'Người mẫu trẻ mặc áo thun in hình nổi bật, chụp trong studio sáng, nền kem, ánh sáng mềm, góc chụp thẳng.' } },
  promptAssistant: { label: 'Trợ lý prompt (quy tắc)', category: 'process', color: '#38618c', inputs: [{ id: 'in', type: 'prompt', label: 'Prompt gốc', required: false }], outputs: [{ id: 'out', type: 'prompt', label: 'Prompt' }],
    defaults: { style: 'studio', model: 'nu-tre', background: 'studio-kem', lighting: 'mem', angle: 'thang', extra: '', composed: '' } },
  composition: { label: 'Ghép hình in lên áo', category: 'process', color: '#b6492f', inputs: [{ id: 'garment', type: 'image', label: 'Ảnh áo', required: false }, { id: 'design', type: 'design', label: 'Hình in', required: true }], outputs: [{ id: 'out', type: 'image', label: 'Ảnh ghép' }],
    defaults: { base: 'public/fixtures/real-tee/crew-white-hanger.webp', printX: 50, printY: 42, printW: 34, rotation: 0, label: 'Ảnh ghép hậu kỳ — hình in là file gốc, không phải AI vẽ lại' } },
  imageEditor: { label: 'Chỉnh sửa ảnh', category: 'process', color: '#8c6d1f', inputs: [{ id: 'in', type: 'image', label: 'Ảnh', required: true }], outputs: [{ id: 'out', type: 'image', label: 'Ảnh' }],
    defaults: { crop: 0, rotate: 0, resizeW: 900, brightness: 100, contrast: 100 } },
  aiImageGen: { label: 'Tạo ảnh AI (DEMO)', category: 'ai', color: '#a03d63', inputs: [{ id: 'prompt', type: 'prompt', label: 'Prompt', required: false }, { id: 'image', type: 'image', label: 'Ảnh tham chiếu', required: false }], outputs: [{ id: 'out', type: 'image', label: 'Ảnh DEMO' }],
    defaults: { ratio: '4:5', count: 1 } },
  aiVariation: { label: 'Biến thể ảnh (DEMO)', category: 'ai', color: '#a03d63', inputs: [{ id: 'in', type: 'image', label: 'Ảnh', required: true }], outputs: [{ id: 'out', type: 'image', label: 'Biến thể DEMO' }],
    defaults: { variant: 'boi-canh', count: 1 } },
  aiVideoGen: { label: 'Tạo video AI (DEMO)', category: 'ai', color: '#5b4a9e', inputs: [{ id: 'in', type: 'image', label: 'Ảnh', required: true }], outputs: [{ id: 'out', type: 'video', label: 'Video DEMO (WebM)' }],
    defaults: { motion: 'Zoom chậm vào hình in, người mẫu mỉm cười', duration: 3, ratio: '9:16' } },
  preview: { label: 'Xem trước', category: 'output', color: '#4a5568', inputs: [{ id: 'in', type: 'any', label: 'Đầu vào', required: true }], outputs: [{ id: 'out', type: 'any', label: 'Qua' }],
    defaults: {} },
  exportNode: { label: 'Xuất file', category: 'output', color: '#4a5568', inputs: [{ id: 'in', type: 'any', label: 'Đầu vào', required: true }], outputs: [{ id: 'out', type: 'any', label: 'Qua' }],
    defaults: { format: 'png' } },
  saveProject: { label: 'Lưu dự án', category: 'output', color: '#4a5568', inputs: [{ id: 'in', type: 'any', label: 'Đầu vào', required: false }], outputs: [{ id: 'out', type: 'any', label: 'Qua' }],
    defaults: {} },
};
export const NODE_TYPES = Object.keys(NODE_DEFS);

export function makeNode(type, x = 80, y = 80) {
  const def = NODE_DEFS[type]; if (!def) throw new Error('Loại node không tồn tại: ' + type);
  return { id: uid('node'), type, x: Math.round(x), y: Math.round(y), config: structuredClone(def.defaults), status: 'idle', logs: [], error: '' };
}
export function outputType(node) { return NODE_DEFS[node.type]?.outputs[0]?.type || 'any'; }
export function inputDef(node, portId) { return NODE_DEFS[node.type]?.inputs.find(i => i.id === portId); }

export function findNode(graph, id) { return graph.nodes.find(n => n.id === id); }

/** Would adding edge from->to create a cycle? (to can already reach from) */
export function createsCycle(graph, fromId, toId) {
  if (fromId === toId) return true;
  const adj = new Map(); for (const e of graph.edges) { if (!adj.has(e.from)) adj.set(e.from, []); adj.get(e.from).push(e.to); }
  const seen = new Set(); const stack = [toId];
  while (stack.length) { const cur = stack.pop(); if (cur === fromId) return true; if (seen.has(cur)) continue; seen.add(cur); for (const n of adj.get(cur) || []) stack.push(n); }
  return false;
}

export function validateConnection(graph, fromId, toId, toPort) {
  const from = findNode(graph, fromId), to = findNode(graph, toId);
  if (!from || !to) return { ok: false, reason: 'Node không tồn tại.' };
  if (fromId === toId) return { ok: false, reason: 'Không thể nối node vào chính nó.' };
  const inp = inputDef(to, toPort); if (!inp) return { ok: false, reason: 'Cổng vào không tồn tại.' };
  if (!typesCompatible(outputType(from), inp.type)) return { ok: false, reason: `Kiểu dữ liệu không khớp: đầu ra "${outputType(from)}" không nối được vào cổng "${inp.type}".` };
  if (graph.edges.some(e => e.from === fromId && e.to === toId && e.toPort === toPort)) return { ok: false, reason: 'Kết nối đã tồn tại.' };
  if (graph.edges.some(e => e.to === toId && e.toPort === toPort)) return { ok: false, reason: 'Cổng vào này đã có kết nối (mỗi cổng nhận tối đa 1 dây).' };
  if (createsCycle(graph, fromId, toId)) return { ok: false, reason: 'Kết nối tạo vòng lặp — workflow không hỗ trợ vòng lặp.' };
  return { ok: true };
}

// ---------- Rule-based Vietnamese prompt assistant (NOT AI) ----------
export const PROMPT_OPTIONS = {
  style: { 'studio': 'chụp studio chuyên nghiệp', 'duong-pho': 'phong cách đường phố năng động', 'thien-nhien': 'ngoài trời tự nhiên', 'toi-gian': 'tối giản, nền trơn' },
  model: { 'nu-tre': 'người mẫu nữ trẻ', 'nam-tre': 'người mẫu nam trẻ', 'cap-doi': 'cặp đôi trẻ', 'khong-nguoi': 'không người mẫu, chỉ sản phẩm áo' },
  background: { 'studio-kem': 'nền studio màu kem', 'quan-cafe': 'quán cà phê ấm cúng', 'pho-co': 'phố cổ Việt Nam', 'bien': 'bãi biển nắng nhẹ' },
  lighting: { 'mem': 'ánh sáng mềm dịu', 'nang': 'ánh nắng tự nhiên rực rỡ', 'toi-am': 'ánh sáng ấm, hơi tối' },
  angle: { 'thang': 'góc chụp thẳng chính diện', 'nghieng': 'góc chụp nghiêng 45 độ', 'can-canh': 'cận cảnh hình in trên ngực áo', 'toan-than': 'chụp toàn thân' },
};
export const PROMPT_TEMPLATES = [
  'Người mẫu mặc áo thun in hình của tôi, chụp quảng cáo cho shop online.',
  'Ảnh sản phẩm áo thun trắng, nền sạch, dùng cho trang bán hàng.',
  'Video ngắn giới thiệu áo in mới cho TikTok, trẻ trung, năng động.',
];
export function buildPrompt(cfg = {}, basePrompt = '') {
  const pick = (group, key) => PROMPT_OPTIONS[group]?.[key] || '';
  const parts = [basePrompt?.trim(), pick('model', cfg.model), 'mặc áo thun in theo yêu cầu', pick('style', cfg.style), pick('background', cfg.background), pick('lighting', cfg.lighting), pick('angle', cfg.angle), cfg.extra?.trim()].filter(Boolean);
  let text = parts.join(', ');
  text = text.charAt(0).toUpperCase() + text.slice(1);
  if (!/[.!?]$/.test(text)) text += '.';
  return text + ' Giữ nguyên chính xác hình in gốc trên áo (chữ, logo, màu sắc) — hình in sẽ được ghép hậu kỳ bằng file gốc.';
}

// ---------- SVG safety ----------
export function checkSvgSafety(text) {
  if (typeof text !== 'string' || !/<svg[\s>]/i.test(text)) return { ok: false, reason: 'Không phải file SVG hợp lệ.' };
  if (/<script[\s>]/i.test(text)) return { ok: false, reason: 'SVG chứa <script> — bị từ chối.' };
  if (/<foreignObject[\s>]/i.test(text)) return { ok: false, reason: 'SVG chứa <foreignObject> — bị từ chối.' };
  if (/\son[a-z]+\s*=/i.test(text)) return { ok: false, reason: 'SVG chứa thuộc tính sự kiện (on*) — bị từ chối.' };
  if (/javascript\s*:/i.test(text)) return { ok: false, reason: 'SVG chứa liên kết javascript: — bị từ chối.' };
  if (/<image[^>]+href\s*=\s*"https?:/i.test(text)) return { ok: false, reason: 'SVG nhúng ảnh từ URL ngoài — bị từ chối.' };
  if (!/(<path|<circle|<rect|<text|<polygon|<ellipse|<line|<polyline|<g[\s>])/i.test(text)) return { ok: false, reason: 'SVG không có phần tử vẽ nào.' };
  return { ok: true };
}

// ---------- Minimal ZIP (store method, no compression) ----------
const CRC_TABLE = (() => { const t = new Int32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c; } return t; })();
export function crc32(bytes) { let c = 0xFFFFFFFF; for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
const enc = new TextEncoder();
export function zipWrite(entries) {
  // entries: [{name, data:Uint8Array}]
  const chunks = []; const central = []; let offset = 0;
  for (const e of entries) {
    const nameB = enc.encode(e.name); const crc = crc32(e.data);
    const lh = new DataView(new ArrayBuffer(30));
    lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true);
    lh.setUint16(8, 0, true); lh.setUint32(14, crc, true); lh.setUint32(18, e.data.length, true); lh.setUint32(22, e.data.length, true); lh.setUint16(26, nameB.length, true);
    chunks.push(new Uint8Array(lh.buffer), nameB, e.data);
    const ch = new DataView(new ArrayBuffer(46));
    ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true);
    ch.setUint16(10, 0, true); ch.setUint32(16, crc, true); ch.setUint32(20, e.data.length, true); ch.setUint32(24, e.data.length, true);
    ch.setUint16(28, nameB.length, true); ch.setUint32(42, offset, true);
    central.push(new Uint8Array(ch.buffer), nameB);
    offset += 30 + nameB.length + e.data.length;
  }
  const cdSize = central.reduce((n, c) => n + c.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true); end.setUint16(8, entries.length, true); end.setUint16(10, entries.length, true); end.setUint32(12, cdSize, true); end.setUint32(16, offset, true);
  const all = [...chunks, ...central, new Uint8Array(end.buffer)];
  const out = new Uint8Array(all.reduce((n, c) => n + c.length, 0)); let o = 0; for (const c of all) { out.set(c, o); o += c.length; }
  return out;
}
export function zipRead(bytes) {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength); const dec = new TextDecoder();
  const entries = []; let pos = 0;
  while (pos + 30 <= bytes.length && dv.getUint32(pos, true) === 0x04034b50) {
    const method = dv.getUint16(pos + 8, true); const size = dv.getUint32(pos + 18, true); const nameLen = dv.getUint16(pos + 26, true); const extraLen = dv.getUint16(pos + 28, true);
    const name = dec.decode(bytes.subarray(pos + 30, pos + 30 + nameLen));
    const dataStart = pos + 30 + nameLen + extraLen;
    if (method !== 0) throw new Error('ZIP dùng phương thức nén không hỗ trợ trong bộ đọc tối giản: ' + name);
    entries.push({ name, data: bytes.slice(dataStart, dataStart + size) });
    pos = dataStart + size;
  }
  if (!entries.length) throw new Error('Không đọc được mục nào trong ZIP.');
  return entries;
}

// ---------- Templates (brief §7) ----------
function tpl(defs, edges) {
  const nodes = defs.map(([type, x, y, cfg]) => { const n = makeNode(type, x, y); if (cfg) Object.assign(n.config, cfg); return n; });
  const byKey = {}; defs.forEach((d, i) => { byKey[d[3 + 1] || i] = nodes[i]; });
  // defs entries: [type,x,y,cfg,key]
  const map = {}; defs.forEach((d, i) => { if (d[4]) map[d[4]] = nodes[i]; });
  const es = edges.map(([f, t, port]) => ({ id: uid('edge'), from: map[f].id, to: map[t].id, toPort: port || 'in' }));
  return { nodes, edges: es };
}
export const TEMPLATES = [
  { id: 'tpl1', name: 'Mẫu 1 — Ảnh người mẫu mặc áo', make() { return tpl([
    ['imageInput', 40, 60, { fixture: 'public/fixtures/real-tee/crew-white-hanger.webp' }, 'img'],
    ['designInput', 40, 300, { svgText: SAMPLE_DESIGN_SVG, assetName: 'hinh-in-mau.svg' }, 'des'],
    ['promptInput', 40, 520, {}, 'pin'],
    ['promptAssistant', 330, 520, {}, 'pa'],
    ['composition', 330, 140, {}, 'comp'],
    ['aiImageGen', 620, 300, {}, 'gen'],
    ['preview', 900, 300, {}, 'prev'],
    ['exportNode', 1150, 300, {}, 'exp'],
  ], [['img', 'comp', 'garment'], ['des', 'comp', 'design'], ['pin', 'pa', 'in'], ['pa', 'gen', 'prompt'], ['comp', 'gen', 'image'], ['gen', 'prev', 'in'], ['prev', 'exp', 'in']]); } },
  { id: 'tpl2', name: 'Mẫu 2 — Bộ ảnh sản phẩm', make() { return tpl([
    ['imageInput', 40, 200, { fixture: 'public/fixtures/real-tee/crew-white-flatlay.webp' }, 'img'],
    ['aiVariation', 320, 200, { variant: 'boi-canh' }, 'var'],
    ['aiImageGen', 580, 60, { ratio: '4:5' }, 'front'],
    ['imageEditor', 580, 300, { resizeW: 900 }, 'edit'],
    ['preview', 860, 180, {}, 'prev'],
    ['exportNode', 1120, 180, { format: 'jpg' }, 'exp'],
  ], [['img', 'var', 'in'], ['var', 'front', 'image'], ['var', 'edit', 'in'], ['front', 'prev', 'in'], ['prev', 'exp', 'in']]); } },
  { id: 'tpl3', name: 'Mẫu 3 — Video quảng cáo', make() { return tpl([
    ['imageInput', 40, 120, { fixture: 'public/fixtures/real-tee/crew-white-hanger.webp' }, 'img'],
    ['promptInput', 40, 360, {}, 'pin'],
    ['promptAssistant', 320, 360, {}, 'pa'],
    ['aiImageGen', 320, 120, {}, 'gen'],
    ['aiVideoGen', 600, 120, { ratio: '16:9', duration: 3 }, 'vid'],
    ['preview', 880, 120, {}, 'prev'],
    ['exportNode', 1140, 120, {}, 'exp'],
  ], [['pin', 'pa', 'in'], ['pa', 'gen', 'prompt'], ['img', 'gen', 'image'], ['gen', 'vid', 'in'], ['vid', 'prev', 'in'], ['prev', 'exp', 'in']]); } },
  { id: 'tpl4', name: 'Mẫu 4 — Nội dung TikTok 9:16', make() { return tpl([
    ['imageInput', 40, 100, { fixture: 'public/fixtures/real-tee/crew-white-hanger.webp' }, 'img'],
    ['designInput', 40, 340, { svgText: SAMPLE_DESIGN_SVG, assetName: 'hinh-in-mau.svg' }, 'des'],
    ['composition', 320, 200, {}, 'comp'],
    ['aiImageGen', 600, 200, { ratio: '9:16' }, 'gen'],
    ['aiVideoGen', 880, 200, { ratio: '9:16', duration: 3 }, 'vid'],
    ['preview', 1160, 60, {}, 'prev'],
    ['exportNode', 1160, 300, {}, 'exp'],
  ], [['img', 'comp', 'garment'], ['des', 'comp', 'design'], ['comp', 'gen', 'image'], ['gen', 'vid', 'in'], ['vid', 'prev', 'in'], ['vid', 'exp', 'in']]); } },
];
export function emptyGraph() { return { nodes: [], edges: [] }; }
export function cloneGraph(g) { return JSON.parse(JSON.stringify({ nodes: g.nodes.map(n => ({ ...n, logs: [...(n.logs || [])] })), edges: g.edges })); }
