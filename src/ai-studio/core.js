// AI Studio — DOM-free core: node definitions, type/cycle rules, rule-based
// Vietnamese prompt builder, SVG safety check, minimal store-only ZIP writer
// + reader. Node-testable; no browser APIs used here.
import { GARMENT_QUADS, FIXTURE_LANDMARKS, AI_MODEL_LANDMARKS, AI_MODEL_QUADS, torsoQuadFor } from './warp.js';

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

// P4.2 supplementary fix (owner): the old sample logo put "STUDIO" in dark
// teal (#293e35) BELOW the badge — invisible on black tees. Both words now
// sit in WHITE inside the terracotta badge (badge grew to an ellipse), so
// every letter reads on white AND black garments.
export const SAMPLE_DESIGN_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600"><ellipse cx="300" cy="300" rx="228" ry="192" fill="#b6492f" stroke="#ffffff" stroke-opacity="0.85" stroke-width="6"/><text x="300" y="292" font-family="Arial, sans-serif" font-size="74" font-weight="bold" fill="#ffffff" text-anchor="middle">ÁO IN</text><rect x="238" y="318" width="124" height="5" fill="#ffffff" opacity="0.75"/><text x="300" y="382" font-family="Arial, sans-serif" font-size="47" font-weight="bold" letter-spacing="6" fill="#ffffff" text-anchor="middle">STUDIO</text></svg>`;

// category: input | process | ai | output ; colour per brief §4 (colour-coded nodes)
export const NODE_DEFS = {
  imageInput: { label: 'Ảnh đầu vào', category: 'input', color: '#2f6f4f', inputs: [], outputs: [{ id: 'out', type: 'image', label: 'Ảnh' }],
    defaults: { assetId: '', assetName: '', fixture: 'public/fixtures/real-tee/crew-white-hanger.webp', width: 0, height: 0 } },
  designInput: { label: 'Hình in (thiết kế)', category: 'input', color: '#7a4a9e', inputs: [], outputs: [{ id: 'out', type: 'design', label: 'Hình in' }],
    defaults: { assetId: '', assetName: '', svgText: '', width: 0, height: 0 } },
  promptInput: { label: 'Prompt', category: 'input', color: '#38618c', inputs: [], outputs: [{ id: 'out', type: 'prompt', label: 'Prompt' }],
    defaults: { text: 'Người mẫu trẻ, thần thái tự nhiên, mỉm cười nhẹ, tóc gọn gàng.' } },
  promptAssistant: { label: 'Trợ lý prompt (quy tắc)', category: 'process', color: '#38618c', inputs: [{ id: 'in', type: 'prompt', label: 'Prompt gốc', required: false }], outputs: [{ id: 'out', type: 'prompt', label: 'Prompt' }],
    defaults: { style: 'studio', model: 'nu-viet', background: 'studio-kem', lighting: 'mem', angle: 'thang', kieuAo: 'co-tron', mauAo: 'trang', gocChup: 'chinh-dien', extra: '', composed: '', catalogPrompt: false } },
  composition: { label: 'Ghép hình in lên áo', category: 'process', color: '#b6492f', inputs: [{ id: 'garment', type: 'image', label: 'Ảnh áo', required: false }, { id: 'design', type: 'design', label: 'Hình in', required: true }], outputs: [{ id: 'out', type: 'image', label: 'Ảnh ghép' }],
    defaults: { base: 'public/fixtures/real-tee/crew-white-hanger.webp', garmentSource: 'ai', realBase: 'public/fixtures/real-tee/crew-white-hanger.webp', printX: 50, printY: 55, printW: 30, rotation: 0, mode: 'perspective', quad: GARMENT_QUADS['public/fixtures/real-tee/crew-white-hanger.webp'].map(p => [...p]), wrinkle: 35, shading: 45, inkOpacity: 95, label: 'Ảnh ghép hậu kỳ — hình in là file gốc, không phải AI vẽ lại' } },
  background: { label: 'Nền & bối cảnh', category: 'process', color: '#2f6f6f', inputs: [{ id: 'in', type: 'image', label: 'Ảnh sản phẩm', required: true }], outputs: [{ id: 'out', type: 'image', label: 'Ảnh có nền' }],
    defaults: { mode: 'solid', color: '#f5f1e6', color2: '#d9c6a5', dir: 'down', horizon: 62, shadow: 55, vignette: 25, assetId: '', assetName: '', bgFit: 'cover', bgBlur: 0, scale: 82, posX: 50, posY: 50, framePad: 7 } },
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
    defaults: { format: 'png', channels: [], jpgQuality: 92, namePattern: '' } },
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

// ---------- Rule-based prompt assistant (NOT AI) ----------
// P4.1 redesign: the assistant now carries structured GARMENT parameters and
// builds the GENERATION prompt in ENGLISH (sana/flux follow English far
// better than Vietnamese). The generation prompt asks for a PLAIN t-shirt
// only — the customer's design is NEVER part of it: compositing the original
// design file onto the generated photo is the composition node's job. (The
// pre-P4.1 builder did the opposite — it told the model to draw a printed
// tee and "keep the original print", which a text-to-image model cannot do;
// that was root cause #3 of the wrong Template 1 output.)
export const PROMPT_OPTIONS = {
  style: { 'studio': 'chụp studio chuyên nghiệp', 'duong-pho': 'phong cách đường phố năng động', 'thien-nhien': 'ngoài trời tự nhiên', 'toi-gian': 'tối giản, nền trơn' },
  model: { 'nu-viet': 'người mẫu Việt Nam (nữ)', 'nam-viet': 'người mẫu Việt Nam (nam)', 'nu-tre': 'người mẫu nữ trẻ', 'nam-tre': 'người mẫu nam trẻ', 'cap-doi': 'cặp đôi trẻ', 'khong-nguoi': 'không người mẫu, chỉ sản phẩm áo' },
  background: { 'studio-kem': 'nền studio màu kem', 'quan-cafe': 'quán cà phê ấm cúng', 'pho-co': 'phố cổ Việt Nam', 'bien': 'bãi biển nắng nhẹ' },
  lighting: { 'mem': 'ánh sáng mềm dịu', 'nang': 'ánh nắng tự nhiên rực rỡ', 'toi-am': 'ánh sáng ấm, hơi tối' },
  angle: { 'thang': 'góc chụp thẳng chính diện', 'nghieng': 'góc chụp nghiêng 45 độ', 'can-canh': 'cận cảnh hình in trên ngực áo', 'toan-than': 'chụp toàn thân' },
};
const PROMPT_OPTIONS_EN = {
  style: { 'studio': 'professional studio photoshoot', 'duong-pho': 'dynamic street-style look', 'thien-nhien': 'natural outdoor setting', 'toi-gian': 'minimalist plain backdrop' },
  model: { 'nu-viet': 'a young Vietnamese female model', 'nam-viet': 'a young Vietnamese male model', 'nu-tre': 'a young female model', 'nam-tre': 'a young male model', 'cap-doi': 'a young couple, both wearing the same plain t-shirt', 'khong-nguoi': '' },
  background: { 'studio-kem': 'clean light-cream studio background', 'quan-cafe': 'warm cosy café background', 'pho-co': 'Vietnamese old-town street background', 'bien': 'soft sunny beach background' },
  lighting: { 'mem': 'soft diffused studio lighting', 'nang': 'bright natural sunlight', 'toi-am': 'warm, slightly dim lighting' },
};
export const PROMPT_TEMPLATES = [
  'Người mẫu mặc áo thun in hình của tôi, chụp quảng cáo cho shop online.',
  'Ảnh sản phẩm áo thun trắng, nền sạch, dùng cho trang bán hàng.',
  'Video ngắn giới thiệu áo in mới cho TikTok, trẻ trung, năng động.',
];
// ---------- Garment parameters (P4.1) ----------
// kieuAo: garment style/fit. mauAo: preset tee colours (hex drives the DEMO
// figure). gocChup: camera view — supersedes the legacy free-text `angle`
// field (an old config with angle='nghieng' migrates to the 3/4 view).
export const GARMENT_OPTIONS = {
  kieuAo: {
    'co-tron': { label: 'Cổ tròn — regular fit', en: 'classic crew-neck regular-fit', fitEn: 'regular-fit' },
    'oversize': { label: 'Oversize — phom rộng boxy', en: 'oversized boxy-fit with dropped shoulders', fitEn: 'oversized boxy-fit' },
  },
  mauAo: {
    'trang': { label: 'Trắng', en: 'white', hex: '#f4f4f2' },
    'den': { label: 'Đen', en: 'black', hex: '#232326' },
    'be': { label: 'Be', en: 'beige', hex: '#d8c3a5' },
    'xam': { label: 'Xám', en: 'grey', hex: '#8f959b' },
    'navy': { label: 'Xanh navy', en: 'navy blue', hex: '#2b3a55' },
  },
  gocChup: {
    'chinh-dien': { label: 'Chính diện', en: 'front view' },
    'ba-phan-tu': { label: 'Góc 3/4', en: 'three-quarter view' },
  },
};
/** Structured garment params for a promptAssistant config (defaults +
 * legacy `angle` migration applied). Consumed by aiImageGen (DEMO figure +
 * real-mode logging), the cache/payload round-trip and the UI summary. */
export function garmentParams(cfg = {}) {
  const style = GARMENT_OPTIONS.kieuAo[cfg.kieuAo] ? cfg.kieuAo : 'co-tron';
  const colorKey = GARMENT_OPTIONS.mauAo[cfg.mauAo] ? cfg.mauAo : 'trang';
  let view = GARMENT_OPTIONS.gocChup[cfg.gocChup] ? cfg.gocChup : null;
  if (!view) view = cfg.angle === 'nghieng' ? 'ba-phan-tu' : 'chinh-dien';
  return {
    style, styleEn: GARMENT_OPTIONS.kieuAo[style].en, fitEn: GARMENT_OPTIONS.kieuAo[style].fitEn,
    colorKey, colorEn: GARMENT_OPTIONS.mauAo[colorKey].en, colorHex: GARMENT_OPTIONS.mauAo[colorKey].hex,
    view, viewEn: GARMENT_OPTIONS.gocChup[view].en,
  };
}
/** Read-only Vietnamese summary of what will be sent (shown in the panel). */
export function garmentSummaryVi(cfg = {}) {
  const g = garmentParams(cfg);
  // P4.2 round 3: Template 1 sends the owner's VERBATIM e-commerce catalog
  // template (see CATALOG_PROMPT_TEMPLATE) — the summary must describe
  // THAT framing, not the legacy composed prompt.
  if (cfg.catalogPrompt) {
    return `Ảnh catalogue thương mại điện tử (mẫu prompt chuẩn của chủ shop): mẫu Việt Nam trẻ, chụp NỬA NGƯỜI từ đầu tới hông, đứng thẳng nhìn thẳng vào máy ảnh, tay đút túi thư giãn; mặc áo thun cotton cổ tròn TRƠN màu ${GARMENT_OPTIONS.mauAo[g.colorKey].label.toLowerCase()}, phom ${g.fitEn === 'oversized boxy-fit' ? 'oversize rộng boxy' : 'regular-fit'} — thấy TOÀN BỘ áo: cổ, hai vai, hai tay áo và gấu áo; vùng ngực phẳng, TUYỆT ĐỐI không hình in/logo/chữ; nền studio xám sáng liền mạch, ánh sáng thương mại đều, chất vải cotton sắc nét. Hình in của khách được ghép HẬU KỲ bằng file gốc ở node Ghép hình in — AI không vẽ hình in.`;
  }
  const pick = (group, key) => PROMPT_OPTIONS[group]?.[key] || '';
  const who = cfg.model === 'khong-nguoi' ? 'chỉ áo (không người mẫu)' : (pick('model', cfg.model) || 'người mẫu');
  const parts = [
    who + ` mặc áo thun ${cfg.kieuAo === 'oversize' ? 'oversize phom rộng boxy' : 'cổ tròn regular-fit'} màu ${GARMENT_OPTIONS.mauAo[g.colorKey].label.toLowerCase()} — áo TRƠN, tuyệt đối không hình in/logo/chữ`,
    g.view === 'ba-phan-tu' ? 'góc chụp 3/4' : 'chụp chính diện, vùng ngực rõ và không bị che',
    pick('style', cfg.style), pick('background', cfg.background), pick('lighting', cfg.lighting),
  ].filter(Boolean);
  return parts.join(', ') + '. Hình in của khách được ghép HẬU KỲ bằng file gốc ở node Ghép hình in — AI không vẽ hình in.';
}
/**
 * P4.2 ROUND 3 — the owner's VERBATIM e-commerce catalog prompt template
 * (Uniqlo / Coolmate / Printful mockup style), ordered word-for-word.
 * Only [COLOR] (the garment colour's EN name) and [FIT_TYPE] ('regular-fit'
 * / 'oversized boxy-fit') are substituted from the garment params. Used
 * ONLY when the promptAssistant config carries catalogPrompt: true —
 * which only Template 1 sets. Every other config keeps the composed
 * legacy prompt below, so Templates 2–4 and old projects are untouched.
 */
export const CATALOG_PROMPT_TEMPLATE = 'Commercial e-commerce apparel catalog photo, medium half-body shot from head to hip of a young Vietnamese model standing upright facing camera, wearing a PLAIN [COLOR] [FIT_TYPE] cotton crew-neck t-shirt, full t-shirt torso, sleeves and bottom hem clearly visible in frame, hands relaxed in pockets, flat smooth chest fabric area, NO print, NO logo, NO text, clean light grey seamless studio backdrop, soft even commercial studio lighting, sharp fabric texture, 85mm lens, photorealistic lookbook quality.';
export function catalogPromptFor(cfg = {}) {
  const g = garmentParams(cfg);
  return CATALOG_PROMPT_TEMPLATE.replace('[COLOR]', g.colorEn).replace('[FIT_TYPE]', g.fitEn);
}
/**
 * Build the ENGLISH generation prompt for a PLAIN garment photo.
 * Driven by the garment params; ends with the strict prohibitions (no
 * print/logo/text, garment-type lock, no accessory over the chest).
 * Template 1 (catalogPrompt: true) returns the owner's verbatim catalog
 * template instead — see CATALOG_PROMPT_TEMPLATE.
 */
export function buildPrompt(cfg = {}, basePrompt = '') {
  const g = garmentParams(cfg);
  if (cfg.catalogPrompt) return catalogPromptFor(cfg);
  const pickEn = (group, key) => PROMPT_OPTIONS_EN[group]?.[key] || '';
  const garmentSentence = cfg.model === 'khong-nguoi'
    ? `a PLAIN ${g.colorEn} ${g.styleEn} cotton t-shirt on a clean display, completely blank`
    : `${pickEn('model', cfg.model) || 'a young model'} wearing a PLAIN ${g.colorEn} ${g.styleEn} cotton t-shirt, completely blank`;
  const parts = [
    'Professional commercial fashion photography',
    garmentSentence,
    `${g.view === 'ba-phan-tu' ? 'Three-quarter view' : 'Front view'} — the chest area of the t-shirt is clearly visible, large, flat and completely unobstructed`,
    pickEn('style', cfg.style), pickEn('background', cfg.background), pickEn('lighting', cfg.lighting),
    String(basePrompt || '').trim(), String(cfg.extra || '').trim(),
    'Strict requirements: the t-shirt has absolutely NO print, NO logo, NO text, NO letters and NO graphics anywhere on it. Do NOT change the garment into a jacket, coat, hoodie, traditional clothing, dress or any other type of clothing — it must remain a plain cotton t-shirt. NO accessories (necklace, bag, strap, scarf, open jacket) may cover the chest/print area. Realistic cotton fabric texture, sharp focus',
  ].filter(Boolean).map(s => s.replace(/[.\s]+$/, ''));
  return parts.join('. ') + '.';
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

// ---------- DEMO model figure geometry (P4.1 → P4.2 → P4.2 round 3) ----------
// Deterministic geometry of the canvas-drawn DEMO model figure (drawn in
// studio.js). Template 1's composition node defaults to `chestQuad`, so
// in DEMO mode the original design lands exactly on the figure's chest.
//
// ROUND 3 (owner's e-commerce framing standard): the figure is redrawn
// as a MEDIUM HALF-BODY (top of head → past the hips, camera at chest
// height, light-grey studio backdrop) — the same framing the owner
// mandates for real model photos — and its geometry is expressed as
// LANDMARKS, with the print quads DERIVED via torsoQuadFor (warp.js):
// gap 13.5% of torso length below the collar's lower edge, print width
// 40% of torso width, centred on the torso. ONE rule for every base.
// The collar lower edge follows from the drawing: shoulderY + neckline
// curve dip 0.02 + collar stroke ≈ +0.025 (see drawDemoFigure).
//   regular:  collar 0.275, hem 0.760 → torso 0.485; quad top 0.341,
//             width 0.176 (= 40% of torso width 0.44), height 0.141.
//   oversize: collar 0.290, hem 0.840 → torso 0.550; quad top 0.364,
//             width 0.232 (= 40% of torso width 0.58), height 0.186 —
//             a genuinely wider AND longer garment, never a regular tee
//             with a bigger print.
// (History: P4.1's quad top sat at y=0.375 with the collar at 0.316 — the
// print rode onto the neck; round 1 fixed it with the collar rule, which
// round 3's torso rule now supersedes.)
export const DEMO_FIGURE = {
  landmarks: {
    regular: { collarBottomY: 0.275, hemY: 0.76, torsoCenterX: 0.5, torsoWidth: 0.44 },
    oversize: { collarBottomY: 0.29, hemY: 0.84, torsoCenterX: 0.5, torsoWidth: 0.58 },
  },
  collarBottomY: { regular: 0.275, oversize: 0.29 },
  chestQuad: torsoQuadFor({ collarBottomY: 0.275, hemY: 0.76, torsoCenterX: 0.5, torsoWidth: 0.44 }, { imgW: 4, imgH: 5 }),
  chestQuadOversize: torsoQuadFor({ collarBottomY: 0.29, hemY: 0.84, torsoCenterX: 0.5, torsoWidth: 0.58 }, { imgW: 4, imgH: 5 }),
  torso: {
    regular: { span: [0.28, 0.72], shoulderY: 0.25, hemY: 0.76 },
    oversize: { span: [0.21, 0.79], shoulderY: 0.265, hemY: 0.84 },
  },
};

// ---------- Real photo bases (P4.2 → round 3) ----------
// ROUND 3 STATE (owner's e-commerce framing standard): there is NO model
// photo base at all. A model base must now pass the FULL commercial
// checklist — medium half-body (top of head → past hips), the ENTIRE
// plain garment visible (collar, both shoulders, both sleeves, bottom
// hem + trousers waistband), camera at chest height, model upright and
// facing camera, arms relaxed or hands in pockets, no leaning / crossed
// arms / hair over the chest, plain bright neutral studio background,
// Vietnamese/Asian adult model, verified licence. The round-2 white base
// (Pexels 25471921) was REJECTED by the owner under this standard (close
// head-and-shoulders portrait, torso cut off, leaning in, dark room) and
// is REMOVED as a base (fixture deleted; licence record kept in
// docs/P2_ASSET_LICENSES.md, marked superseded). A fresh round-3 search
// (8 query angles, 26 candidates downloaded and viewed — rejection list
// in docs/AI_STUDIO_QA_REPORT.md) found NO compliant photo for white,
// black or oversize, so photoBaseFor returns null for every garment
// combo and DEMO honestly uses the drawn figure (itself redrawn to the
// half-body framing) with the "chưa có ảnh chụp thật đã kiểm chứng"
// label. NEVER relax a checklist item to fill a slot (owner's rule).
// What remains below are GARMENT reference photos (kind: 'garment') —
// hanger / back-view shots used by the composition node's "Ảnh mẫu thật"
// source and the AI-failure fallback. They are not model bases and are
// never presented as models. Every entry carries its measured landmarks
// (FIXTURE_LANDMARKS in warp.js); quads come from GARMENT_QUADS, derived
// via torsoQuadFor — one placement rule for all bases.
export const PHOTO_BASES = [
  {
    id: 'hanger-white', name: 'Áo trắng trên móc (ảnh chụp thật)',
    path: 'public/fixtures/real-tee/crew-white-hanger.webp', style: 'co-tron', colorKey: 'trang', demoPhoto: false, kind: 'garment',
    collarBottomY: 0.33, landmarks: FIXTURE_LANDMARKS['public/fixtures/real-tee/crew-white-hanger.webp'],
    source: { platform: 'Pexels', photoId: '20669538', author: 'Dmitriy Steinke', sourceUrl: 'https://www.pexels.com/photo/hand-holds-hanger-with-t-shirt-20669538/', license: 'Pexels License — free commercial use, attribution not required (given anyway)', note: 'Ảnh có sẵn trong repo từ P2 (GAR-CREW-WHT-HANGER-01).' },
  },
  {
    id: 'hanger-black', name: 'Áo đen trên móc (ảnh chụp thật)',
    path: 'public/fixtures/real-tee/crew-black-hanger.webp', style: 'co-tron', colorKey: 'den', demoPhoto: false, kind: 'garment',
    collarBottomY: 0.26, landmarks: FIXTURE_LANDMARKS['public/fixtures/real-tee/crew-black-hanger.webp'],
    source: { platform: 'Pexels', photoId: '8532616', author: 'Hanna Pad', sourceUrl: 'https://www.pexels.com/photo/a-black-shirt-hanging-on-the-wall-8532616/', license: 'Pexels License — free commercial use, attribution not required (given anyway)', note: 'Ảnh có sẵn trong repo từ P3 (GAR-CREW-BLK-HANGER-01).' },
  },
  {
    id: 'back-white', name: 'Áo trắng mặt sau, người mẫu mặc (ảnh chụp thật)',
    path: 'public/fixtures/real-tee/crew-white-back-worn.webp', style: 'co-tron', colorKey: 'trang', demoPhoto: false, kind: 'garment',
    collarBottomY: 0.445, landmarks: FIXTURE_LANDMARKS['public/fixtures/real-tee/crew-white-back-worn.webp'],
    source: { platform: 'Pexels', photoId: '17515211', author: 'NJH STUDIO', sourceUrl: 'https://www.pexels.com/photo/back-view-of-man-in-t-shirt-and-hat-17515211/', license: 'Pexels License — free commercial use, attribution not required (given anyway)', note: 'Ảnh có sẵn trong repo từ P2 (GAR-CREW-WHT-BACKWORN-01) — chỉ dùng cho hình in mặt sau.' },
  },
];
export function photoBaseByPath(path) { return PHOTO_BASES.find(b => b.path === path) || null; }
/**
 * The DEMO MODEL photo base for structured garment params, or null when
 * no verified photo exists for them (caller falls back to the drawn
 * figure). Only entries with kind: 'model' qualify — garment reference
 * photos (hangers) NEVER pose as model bases. ROUND 3: the registry
 * currently holds NO model entry (the round-2 white model photo was
 * rejected by the owner under the e-commerce standard and no compliant
 * replacement was found), so this returns null for every combo; the
 * lookup stays so a future verified model photo only needs a registry
 * entry. Front view only. Returns { base, quad } with a fresh quad copy.
 * ROUND 4: the DEMO model layer is now AI-GENERATED imagery in a
 * SEPARATE registry (AI_MODEL_BASES / aiModelBaseFor below) — this
 * function stays real-photos-only on purpose, so a photo can never be
 * confused with an AI image or vice versa.
 */
export function photoBaseFor(garment) {
  if (!garment || garment.view !== 'chinh-dien') return null;
  if (garment.style === 'oversize') return null;
  const b = PHOTO_BASES.find(x => x.kind === 'model' && x.demoPhoto && x.style === garment.style && x.colorKey === garment.colorKey);
  if (!b) return null;
  const q = GARMENT_QUADS[b.path];
  return q ? { base: b, quad: q.map(p => [...p]) } : null;
}

// ---------- AI-GENERATED model bases (P4.2 ROUND 4) ----------
// ROUND 4 (owner directive + approval, 2026-11-14): after three rounds
// found NO real photograph passing the owner's e-commerce checklist, the
// owner ordered the Template 1 model layer to be AI-GENERATED imagery
// instead — a realistic AI model WEARING the correct garment style,
// colour and pose, the shirt PLAIN (the design is still composited
// afterwards from the original file, never drawn by AI). The three
// images below were generated with the owner's verbatim catalog prompt
// template (CATALOG_PROMPT_TEMPLATE), were VIEWED and APPROVED by the
// owner on 2026-11-14 (the black-crew MALE model approved as-is), and
// are the DEMO model bases for their (colour, fit) combos.
// HONEST LABELLING (hard rule): these are AI-GENERATED images — NOT
// photographs. They are therefore NOT recorded in
// docs/P2_ASSET_LICENSES.md (that file is for real-photo licences);
// their provenance lives in docs/AI_MODEL_ASSETS.md, and every name /
// label in the app says "do AI tạo". They must never be presented as
// real photography. Combos without an approved AI base (other colours,
// black oversize, 3/4 view) keep the drawn-figure fallback, honestly
// labelled. Landmarks are grid-measured per image (AI_MODEL_LANDMARKS
// in warp.js); quads derive via torsoQuadFor — one rule for all bases.
export const AI_MODEL_BASES = [
  {
    id: 'ai-model-white-crew', name: 'Người mẫu do AI tạo — áo trắng cổ tròn, mẫu nữ (KHÔNG phải ảnh chụp thật)',
    path: 'public/fixtures/ai-model/model-white-crew.webp', style: 'co-tron', colorKey: 'trang', demoPhoto: true, kind: 'ai-model',
    collarBottomY: 0.383, landmarks: AI_MODEL_LANDMARKS['public/fixtures/ai-model/model-white-crew.webp'],
    source: { platform: 'AI-generated', generator: 'Muse — pipeline tạo ảnh (media generation)', prompt: 'CATALOG_PROMPT_TEMPLATE nguyên văn của chủ shop, [COLOR]=white, [FIT_TYPE]=regular-fit', approvedBy: 'Chủ shop Van', approvedDate: '2026-11-14', note: 'Ảnh người mẫu DO AI TẠO — không phải ảnh chụp thật; người mẫu nữ Việt Nam, áo trắng trơn cổ tròn, nửa người đầu→hông, thấy toàn bộ áo + cạp quần jean, tay đút túi, nền xám sáng.' },
  },
  {
    id: 'ai-model-black-crew', name: 'Người mẫu do AI tạo — áo đen cổ tròn, mẫu NAM (KHÔNG phải ảnh chụp thật)',
    path: 'public/fixtures/ai-model/model-black-crew.webp', style: 'co-tron', colorKey: 'den', demoPhoto: true, kind: 'ai-model',
    collarBottomY: 0.363, landmarks: AI_MODEL_LANDMARKS['public/fixtures/ai-model/model-black-crew.webp'],
    source: { platform: 'AI-generated', generator: 'Muse — pipeline tạo ảnh (media generation)', prompt: 'CATALOG_PROMPT_TEMPLATE nguyên văn của chủ shop, [COLOR]=black, [FIT_TYPE]=regular-fit', approvedBy: 'Chủ shop Van', approvedDate: '2026-11-14', note: 'Ảnh người mẫu DO AI TẠO — không phải ảnh chụp thật; người mẫu NAM Việt Nam (chủ shop duyệt giữ nguyên như vậy), áo đen trơn cổ tròn, nửa người đầu→hông, thấy toàn bộ áo + cạp quần jean, tay đút túi, nền xám sáng.' },
  },
  {
    id: 'ai-model-white-oversize', name: 'Người mẫu do AI tạo — áo trắng OVERSIZE phom rộng, mẫu nữ (KHÔNG phải ảnh chụp thật)',
    path: 'public/fixtures/ai-model/model-white-oversize.webp', style: 'oversize', colorKey: 'trang', demoPhoto: true, kind: 'ai-model',
    collarBottomY: 0.328, landmarks: AI_MODEL_LANDMARKS['public/fixtures/ai-model/model-white-oversize.webp'],
    source: { platform: 'AI-generated', generator: 'Muse — pipeline tạo ảnh (media generation)', prompt: 'CATALOG_PROMPT_TEMPLATE nguyên văn của chủ shop, [COLOR]=white, [FIT_TYPE]=oversized boxy-fit', approvedBy: 'Chủ shop Van', approvedDate: '2026-11-14', note: 'Ảnh người mẫu DO AI TẠO — không phải ảnh chụp thật; người mẫu nữ Việt Nam, áo trắng oversize phom rộng THẬT (vai trễ, thân rộng, vạt dài cong), nửa người đầu→hông, thấy toàn bộ áo + cạp quần jean, tay đút túi, nền xám sáng.' },
  },
];
export function aiModelBaseByPath(path) { return AI_MODEL_BASES.find(b => b.path === path) || null; }
/**
 * The DEMO AI-MODEL base for structured garment params (ROUND 4), or
 * null when no owner-approved AI image exists for them (caller falls
 * back to the drawn figure, honestly labelled). Front view only; both
 * regular and oversize fits can be mapped (white oversize is). Returns
 * { base, quad } with a fresh quad copy.
 */
export function aiModelBaseFor(garment) {
  if (!garment || garment.view !== 'chinh-dien') return null;
  const b = AI_MODEL_BASES.find(x => x.style === garment.style && x.colorKey === garment.colorKey);
  if (!b) return null;
  const q = AI_MODEL_QUADS[b.path];
  return q ? { base: b, quad: q.map(p => [...p]) } : null;
}

// ---------- Template/build versioning (P4.2 ROUND 4, R1 + R4) ----------
/** Behaviour build marker. It is mixed into every P2 node cache key
 * (p2.js nodeCacheKey), so cached outputs produced by an older build's
 * behaviour (older base registry / calibration / template wiring) can
 * NEVER be silently reused after an upgrade — the chained config/input
 * hash alone does not cover code behaviour. Bump on any behaviour
 * change that alters node outputs for identical configs/inputs. */
export const AI_STUDIO_BUILD = 'p42-r4';
/** Template 1's own version. Template-1-derived projects carry
 * meta {templateId:'tpl1', tplVersion} (stamped by the template factory
 * and threaded through save/draft/version snapshots). On load, a
 * project whose marker is older is refreshed by refreshTpl1Graph. */
export const TPL1_VERSION = 4;
/** The current Template 1 default print quad = the torso-rule quad of
 * the default garment case (white crew → the approved AI model base). */
export const TPL1_DEFAULT_QUAD_PATH = 'public/fixtures/ai-model/model-white-crew.webp';
const TPL1_RETIRED_BASES = [
  'public/fixtures/real-tee/crew-white-vn-model.webp', // round-2 model photo — owner-rejected, fixture deleted (round 3)
  'public/fixtures/real-tee/crew-black-woman.webp',    // held-up shirt — removed as a base in the supplementary round
  'public/fixtures/real-tee/crew-white-model.webp',    // round-1 white model photo — superseded, fixture deleted
];
/**
 * R4 — refresh a Template-1-derived project created under an older
 * template version: template-owned defaults are brought current
 * (promptAssistant catalog flag, composition's retired bases, the
 * composition default quad from the current AI model landmarks), while
 * anything the user explicitly set (a user-edited quad, quadSource
 * 'user') is preserved. Pure + non-mutating: returns
 * {graph, refreshed, notes} — notes are Vietnamese, user-visible.
 */
export function refreshTpl1Graph(graph) {
  if (!graph || graph.meta?.templateId !== 'tpl1' || (graph.meta.tplVersion || 0) >= TPL1_VERSION) {
    return { graph, refreshed: false, notes: [] };
  }
  const g = JSON.parse(JSON.stringify(graph));
  const notes = [];
  for (const n of g.nodes || []) {
    if (n.type === 'promptAssistant' && !(n.config || {}).catalogPrompt) {
      n.config = { ...(n.config || {}), catalogPrompt: true };
      notes.push('Trợ lý prompt: bật prompt catalogue thương mại điện tử nguyên văn của chủ shop');
    }
    if (n.type === 'composition') {
      const c = n.config = { ...(n.config || {}) };
      let baseFixed = false;
      if (TPL1_RETIRED_BASES.includes(c.realBase)) { c.realBase = 'public/fixtures/real-tee/crew-white-hanger.webp'; baseFixed = true; }
      if (TPL1_RETIRED_BASES.includes(c.base)) { c.base = 'public/fixtures/real-tee/crew-white-hanger.webp'; baseFixed = true; }
      if (baseFixed) notes.push('Ghép hình in: thay ảnh nền mẫu đã bị gỡ khỏi thư viện bằng ảnh áo trắng trên móc hiện hành');
      if (c.quadSource !== 'user') {
        c.quad = AI_MODEL_QUADS[TPL1_DEFAULT_QUAD_PATH].map(p => [...p]);
        notes.push('Ghép hình in: vùng in đặt lại theo mốc thân áo của nền người mẫu AI đã duyệt');
      }
    }
  }
  g.meta = { ...g.meta, tplVersion: TPL1_VERSION };
  return { graph: g, refreshed: true, notes };
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
  // P4.1 flow (owner's order): reference photo + customer design + garment
  // params/prompt → aiImageGen creates a model wearing a PLAIN t-shirt →
  // composition composites the EXACT original design onto that photo →
  // preview → export. (Pre-P4.1 the composition ran BEFORE aiImageGen and
  // its pixel-accurate result was fed into a text-to-image node and thrown
  // away — root cause #1 of the wrong output.)
  // The imageInput node is a standalone reference/sample photo: it is NOT
  // wired into aiImageGen, because every real generation mode here is
  // text-to-image and cannot use a reference photo. To composite onto a
  // real photo instead of the AI photo, set the composition node's
  // garmentSource to 'real' — its realBase defaults to the white hanger
  // garment photo (PHOTO_BASES), selectable per base in the panel.
  // P4.2 round 3: this template's promptAssistant carries
  // catalogPrompt: true, so its generation prompt is the owner's VERBATIM
  // e-commerce catalog template (CATALOG_PROMPT_TEMPLATE).
  // P4.2 ROUND 4 (R1): the shipped template itself defaults to the new
  // stack — DEMO generation resolves the owner-approved AI MODEL base
  // for the garment params (aiModelBaseFor) and the composition node's
  // stored default quad is that base's torso-rule quad (the generated
  // value's own calibrated baseQuad still wins at run time). The graph
  // is stamped meta {templateId:'tpl1', tplVersion} so older copies can
  // be detected and refreshed on load ( refreshTpl1Graph, R4 ). A fresh
  // instance therefore runs correctly with ZERO manual edits.
  { id: 'tpl1', name: 'Mẫu 1 — Ảnh người mẫu mặc áo', make() { const g = tpl([
    ['imageInput', 40, 60, { fixture: 'public/fixtures/real-tee/crew-white-hanger.webp' }, 'img'],
    ['designInput', 40, 300, { svgText: SAMPLE_DESIGN_SVG, assetName: 'hinh-in-mau.svg' }, 'des'],
    ['promptInput', 40, 520, {}, 'pin'],
    ['promptAssistant', 330, 520, { model: 'nu-viet', kieuAo: 'co-tron', mauAo: 'trang', gocChup: 'chinh-dien', catalogPrompt: true }, 'pa'],
    ['aiImageGen', 620, 430, { ratio: '4:5' }, 'gen'],
    ['composition', 620, 140, { mode: 'perspective', quad: AI_MODEL_QUADS[TPL1_DEFAULT_QUAD_PATH].map(p => [...p]), wrinkle: 35, shading: 45, garmentSource: 'ai', realBase: 'public/fixtures/real-tee/crew-white-hanger.webp' }, 'comp'],
    ['preview', 900, 140, {}, 'prev'],
    ['exportNode', 1160, 140, { format: 'png', channels: ['website'] }, 'exp'],
  ], [['pin', 'pa', 'in'], ['pa', 'gen', 'prompt'], ['gen', 'comp', 'garment'], ['des', 'comp', 'design'], ['comp', 'prev', 'in'], ['prev', 'exp', 'in']]); g.meta = { templateId: 'tpl1', tplVersion: TPL1_VERSION }; return g; } },
  { id: 'tpl2', name: 'Mẫu 2 — Bộ ảnh sản phẩm', make() { return tpl([
    ['imageInput', 40, 200, { fixture: 'public/fixtures/real-tee/crew-white-flatlay.webp' }, 'img'],
    ['aiVariation', 320, 200, { variant: 'boi-canh' }, 'var'],
    ['aiImageGen', 580, 60, { ratio: '4:5' }, 'front'],
    ['imageEditor', 580, 320, { resizeW: 900 }, 'edit'],
    ['background', 840, 320, { mode: 'scene' }, 'bg'],
    ['preview', 860, 60, {}, 'prev'],
    ['exportNode', 1120, 320, { format: 'jpg', channels: ['website-vuong', 'shopee'] }, 'exp'],
  ], [['img', 'var', 'in'], ['var', 'front', 'image'], ['var', 'edit', 'in'], ['edit', 'bg', 'in'], ['front', 'prev', 'in'], ['bg', 'exp', 'in']]); } },
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
export function cloneGraph(g) { const c = JSON.parse(JSON.stringify({ nodes: g.nodes.map(n => ({ ...n, logs: [...(n.logs || [])] })), edges: g.edges })); if (g.meta) c.meta = JSON.parse(JSON.stringify(g.meta)); return c; }
