// AI Studio P1 — node editor UI (vanilla JS, Pointer Events for mouse+touch),
// workflow execution via engine.js, project persistence in IndexedDB
// `ao-in-ai-studio`. AI nodes run the DEMO adapter until a real provider is
// configured; every demo output is visibly labelled.
import { NODE_DEFS, NODE_TYPES, TEMPLATES, emptyGraph, makeNode, findNode, validateConnection, buildPrompt, PROMPT_OPTIONS, PROMPT_TEMPLATES, checkSvgSafety, zipWrite, zipRead, uid, SAMPLE_DESIGN_SVG } from './core.js';
import { Engine } from './engine.js';
import { DemoAdapter, HttpAdapter, setSessionKey, BROWSER_KEY_WARNING, describeProvider } from './providers.js';
import { store, storageEstimate } from './store.js';

const $ = (s) => document.querySelector(s);
const FIXTURES = [
  ['public/fixtures/real-tee/crew-white-hanger.webp', 'Áo trắng trên móc (ảnh thật)'],
  ['public/fixtures/real-tee/crew-white-flatlay.webp', 'Áo trắng trải phẳng (ảnh thật)'],
  ['public/fixtures/real-tee/crew-black-hanger.webp', 'Áo đen trên móc (ảnh thật)'],
  ['public/fixtures/real-tee/crew-white-back-worn.webp', 'Áo trắng mặt sau (ảnh thật)'],
];
let graph = emptyGraph();
let projectId = uid('project');
let selectedId = null, selectedEdgeId = null;
let view = { x: 40, y: 30, k: 0.9 };
let history = [], historyIdx = -1;
let engine = null, outputs = new Map();
let providerKind = 'demo';
const runtime = { previewValue: null };

function message(msg, isError = false) { const el = $('#ais-message'); el.textContent = msg; el.classList.toggle('err', isError); logLine(msg); }
function logLine(msg) { const li = document.createElement('li'); li.textContent = `${new Date().toLocaleTimeString('vi-VN')} — ${msg}`; const ul = $('#ais-log'); ul.prepend(li); while (ul.children.length > 60) ul.lastChild.remove(); }

// ---------- image helpers ----------
const loadImg = (src) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
async function blobToImg(blob) { const url = URL.createObjectURL(blob); try { return await loadImg(url); } finally { /* keep url alive during draw; revoked by GC of blob url pool */ } }
const canvasBlob = (c, type = 'image/png') => new Promise(r => c.toBlob(r, type, 0.92));
function makeCanvas(w, h) { const c = document.createElement('canvas'); c.width = Math.max(2, Math.round(w)); c.height = Math.max(2, Math.round(h)); return c; }
function valueFromBlob(blob, kind, extra = {}) { return { kind, blob, url: URL.createObjectURL(blob), mime: blob.type, name: extra.name || 'ket-qua', demo: !!extra.demo, label: extra.label || '', svgText: extra.svgText || '' }; }
async function fetchBlob(url) { const r = await fetch(url); if (!r.ok) throw new Error('Không tải được file: ' + url); return r.blob(); }
function wrapText(ctx, text, x, y, maxW, lh) { const words = String(text).split(/\s+/); let line = '', yy = y; for (const w of words) { const t = line ? line + ' ' + w : w; if (ctx.measureText(t).width > maxW && line) { ctx.fillText(line, x, yy); line = w; yy += lh; } else line = t; } if (line) ctx.fillText(line, x, yy); return yy; }
function drawDemoBanner(ctx, w, text = 'ẢNH DEMO — chưa kết nối AI') { ctx.save(); ctx.fillStyle = 'rgba(32,32,32,0.88)'; ctx.fillRect(0, 0, w, 54); ctx.fillStyle = '#ffb59d'; ctx.font = 'bold 26px Arial'; ctx.textAlign = 'center'; ctx.fillText(text, w / 2, 37); ctx.restore(); }

// ---------- demo provider implementation (canvas-derived, honestly labelled) ----------
const demoImpl = {
  async demoImage({ prompt, image }) {
    const [rw, rh] = { '4:5': [768, 960], '1:1': [864, 864], '9:16': [720, 1280], '16:9': [1280, 720] }[prompt?.ratio || '4:5'] || [768, 960];
    const c = makeCanvas(rw, rh), x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, 0, rh); g.addColorStop(0, '#f3ead9'); g.addColorStop(1, '#d9c6a5'); x.fillStyle = g; x.fillRect(0, 0, rw, rh);
    if (image?.blob) { const img = await blobToImg(image.blob); const s = Math.max(rw / img.width, rh / img.height); x.drawImage(img, (rw - img.width * s) / 2, (rh - img.height * s) / 2, img.width * s, img.height * s); x.fillStyle = 'rgba(243,234,217,0.18)'; x.fillRect(0, 0, rw, rh); }
    drawDemoBanner(x, rw);
    x.fillStyle = 'rgba(32,32,32,0.82)'; x.fillRect(0, rh - 120, rw, 120); x.fillStyle = '#fff'; x.font = '22px Arial'; x.textAlign = 'left';
    wrapText(x, (prompt?.text || 'Không có prompt') + '', 24, rh - 82, rw - 48, 28);
    x.strokeStyle = '#b6492f'; x.lineWidth = 10; x.strokeRect(5, 5, rw - 10, rh - 10);
    return valueFromBlob(await canvasBlob(c), 'image', { demo: true, label: 'Ảnh DEMO mô phỏng — không phải ảnh sản phẩm thật, chưa kết nối AI' });
  },
  async demoVariation({ image, variant }) {
    const img = await blobToImg(image.blob); const c = makeCanvas(img.width, img.height), x = c.getContext('2d');
    if (variant === 'can-canh') { const w = img.width / 2, h = img.height / 2; x.drawImage(img, img.width / 4, img.height / 4, w, h, 0, 0, img.width, img.height); }
    else if (variant === 'goc-khac') { const s = 1.3; x.drawImage(img, (img.width - img.width * s) / 2, (img.height - img.height * s) / 2, img.width * s, img.height * s); }
    else { x.drawImage(img, 0, 0); x.fillStyle = 'rgba(182,73,47,0.16)'; x.fillRect(0, 0, img.width, img.height); x.filter = 'saturate(1.25)'; x.drawImage(img, 0, 0); x.filter = 'none'; }
    drawDemoBanner(x, img.width, 'BIẾN THỂ DEMO — chưa kết nối AI');
    return valueFromBlob(await canvasBlob(c), 'image', { demo: true, label: 'Biến thể DEMO (biến đổi canvas thật từ ảnh gốc) — không phải AI tạo' });
  },
  async demoVideo({ image, motion, duration, ratio }, onProgress) {
    if (!('MediaRecorder' in window) || !HTMLCanvasElement.prototype.captureStream) throw new Error('Trình duyệt này không hỗ trợ MediaRecorder — không tạo được video demo (không giả lập MP4).');
    const [w, h] = ratio === '16:9' ? [960, 540] : ratio === '1:1' ? [720, 720] : [540, 960];
    const img = await blobToImg(image.blob); const c = makeCanvas(w, h), x = c.getContext('2d');
    const stream = c.captureStream(30); const rec = new MediaRecorder(stream, { mimeType: MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9' : 'video/webm' });
    const chunks = []; rec.ondataavailable = e => e.data.size && chunks.push(e.data);
    const done = new Promise(r => rec.onstop = r);
    rec.start(200); const t0 = performance.now(); const total = Math.min(6, Math.max(1, duration || 3)) * 1000;
    await new Promise(res => { const tick = () => { const t = (performance.now() - t0) / total; if (t >= 1) return res(); const s = Math.max(w / img.width, h / img.height) * (1 + 0.12 * t); x.fillStyle = '#efe7d7'; x.fillRect(0, 0, w, h); x.drawImage(img, (w - img.width * s) / 2, (h - img.height * s) / 2, img.width * s, img.height * s); drawDemoBanner(x, w, 'VIDEO DEMO (WebM)'); onProgress?.(Math.round(t * 100)); requestAnimationFrame(tick); }; tick(); });
    rec.stop(); await done;
    const blob = new Blob(chunks, { type: 'video/webm' });
    return valueFromBlob(blob, 'video', { demo: true, name: 'video-demo.webm', label: 'Video DEMO định dạng WebM (ghi từ canvas) — không phải MP4, chưa kết nối AI video' });
  },
};
function currentProvider() {
  if (providerKind === 'http') return new HttpAdapter({ name: $('#ais-provider-name').value || 'HTTP Provider', endpoint: $('#ais-provider-endpoint').value.trim() });
  return new DemoAdapter(demoImpl);
}

// ---------- node handlers ----------
const handlers = {
  async imageInput(node) {
    if (node.config.assetId) { const a = await store.getAsset(node.config.assetId); if (!a) throw new Error('Không tìm thấy ảnh đã lưu trong IndexedDB.'); return valueFromBlob(a.blob, 'image', { name: a.name }); }
    const blob = await fetchBlob(node.config.fixture); return valueFromBlob(blob, 'image', { name: 'anh-ao-that', label: 'Ảnh sản phẩm thực (file có sẵn của shop)' });
  },
  async designInput(node) {
    if (node.config.svgText) { const chk = checkSvgSafety(node.config.svgText); if (!chk.ok) throw new Error(chk.reason); return { kind: 'design', svgText: node.config.svgText, blob: new Blob([node.config.svgText], { type: 'image/svg+xml' }), url: URL.createObjectURL(new Blob([node.config.svgText], { type: 'image/svg+xml' })), name: node.config.assetName || 'hinh-in.svg', label: 'Hình in vector thật (SVG)' }; }
    if (node.config.assetId) { const a = await store.getAsset(node.config.assetId); if (!a) throw new Error('Không tìm thấy file hình in trong IndexedDB.'); return valueFromBlob(a.blob, 'design', { name: a.name, label: 'Hình in gốc (giữ nguyên, không sửa)' }); }
    throw new Error('Chưa có hình in. Tải PNG trong suốt / SVG an toàn, hoặc dùng hình in mẫu.');
  },
  async promptInput(node) { if (!node.config.text.trim()) throw new Error('Prompt đang trống.'); return { kind: 'prompt', text: node.config.text.trim() }; },
  async promptAssistant(node, { inputs }) { const composed = buildPrompt(node.config, inputs.in?.text || ''); node.config.composed = composed; return { kind: 'prompt', text: composed }; },
  async composition(node, { inputs, log }) {
    const design = inputs.design; if (!design) throw new Error('Thiếu hình in.');
    let garmentBlob = inputs.garment?.blob; if (!garmentBlob) garmentBlob = await fetchBlob(node.config.base);
    const g = await blobToImg(garmentBlob);
    const scale = Math.min(1, 900 / g.width); const W = g.width * scale, H = g.height * scale;
    const c = makeCanvas(W, H), x = c.getContext('2d'); x.drawImage(g, 0, 0, W, H);
    const pw = W * (node.config.printW / 100), px = W * (node.config.printX / 100) - pw / 2, py = H * (node.config.printY / 100) - pw / 2;
    x.save(); x.strokeStyle = 'rgba(182,73,47,0.9)'; x.setLineDash([8, 6]); x.lineWidth = 2; x.strokeRect(px, py, pw, pw); x.setLineDash([]); x.restore();
    let dImg; if (design.svgText) { dImg = await blobToImg(design.blob); } else dImg = await blobToImg(design.blob);
    x.save(); x.translate(px + pw / 2, py + pw / 2); x.rotate((node.config.rotation || 0) * Math.PI / 180); const ds = Math.min(pw / dImg.width, pw / dImg.height); x.drawImage(dImg, -dImg.width * ds / 2, -dImg.height * ds / 2, dImg.width * ds, dImg.height * ds); x.restore();
    log('Đã ghép file hình in GỐC lên ảnh áo (hậu kỳ) — nội dung hình in không bị AI vẽ lại.');
    return valueFromBlob(await canvasBlob(c), 'image', { label: node.config.label });
  },
  async imageEditor(node, { inputs }) {
    const img = await blobToImg(inputs.in.blob); const crop = Math.min(40, Math.max(0, node.config.crop || 0)) / 100;
    const sw = img.width * (1 - crop * 2), sh = img.height * (1 - crop * 2);
    const rot = (node.config.rotate || 0) % 360; const swap = Math.abs(rot) === 90 || Math.abs(rot) === 270;
    const tw = node.config.resizeW > 0 ? node.config.resizeW : sw; const th = tw * (sh / sw);
    const c = makeCanvas(swap ? th : tw, swap ? tw : th), x = c.getContext('2d');
    x.filter = `brightness(${node.config.brightness}%) contrast(${node.config.contrast}%)`;
    x.translate(c.width / 2, c.height / 2); x.rotate(rot * Math.PI / 180); x.drawImage(img, img.width * crop, img.height * crop, sw, sh, -tw / 2, -th / 2, tw, th);
    return valueFromBlob(await canvasBlob(c), 'image', { label: 'Ảnh đã chỉnh sửa bằng Canvas API' });
  },
  async aiImageGen(node, { inputs }) { const p = currentProvider(); const prompt = { text: inputs.prompt?.text || '', ratio: node.config.ratio }; if (p.isDemo) return p.generateImage({ prompt, image: inputs.image }); return p.generateImage({ prompt, image: inputs.image }); },
  async aiVariation(node, { inputs }) { const p = currentProvider(); if (!inputs.in) throw new Error('Thiếu ảnh đầu vào.'); if (p.isDemo) return p.variation({ image: inputs.in, variant: node.config.variant }); return p.variation({ image: inputs.in, variant: node.config.variant }); },
  async aiVideoGen(node, { inputs, log }) { const p = currentProvider(); if (!inputs.in) throw new Error('Thiếu ảnh đầu vào.'); if (p.isDemo) return p.imageToVideo({ image: inputs.in, motion: node.config.motion, duration: node.config.duration, ratio: node.config.ratio }, pct => log('Đang ghi video demo: ' + pct + '%')); return p.imageToVideo({ image: inputs.in }); },
  async preview(node, { inputs }) { const v = inputs.in; if (!v) throw new Error('Chưa có dữ liệu để xem trước.'); runtime.previewValue = v; return v; },
  async exportNode(node, { inputs }) { if (!inputs.in) throw new Error('Chưa có dữ liệu để xuất.'); return inputs.in; },
  async saveProject(node, { inputs }) { await saveProjectNow(); return inputs.in || { kind: 'any' }; },
};

// ---------- rendering ----------
const world = $('#ais-world'), svg = $('#ais-edges');
function portPos(node, kind, portId) {
  if (kind === 'out') return { x: node.x + 208, y: node.y + 52 };
  const idx = NODE_DEFS[node.type].inputs.findIndex(i => i.id === portId); return { x: node.x, y: node.y + 52 + idx * 24 };
}
function edgePath(a, b) { const dx = Math.max(40, Math.abs(b.x - a.x) / 2); return `M ${a.x} ${a.y} C ${a.x + dx} ${a.y}, ${b.x - dx} ${b.y}, ${b.x} ${b.y}`; }
let tempLine = null;
function renderEdges() {
  svg.setAttribute('viewBox', '0 0 4000 3000'); svg.innerHTML = '';
  for (const e of graph.edges) { const from = findNode(graph, e.from), to = findNode(graph, e.to); if (!from || !to) continue;
    const p = document.createElementNS('http://www.w3.org/2000/svg', 'path'); p.setAttribute('d', edgePath(portPos(from, 'out'), portPos(to, 'in', e.toPort))); p.setAttribute('class', 'ais-edge' + (e.id === selectedEdgeId ? ' sel' : '')); p.dataset.edgeId = e.id; svg.appendChild(p); }
  if (tempLine) { const p = document.createElementNS('http://www.w3.org/2000/svg', 'path'); p.setAttribute('d', edgePath(tempLine.from, tempLine.to)); p.setAttribute('class', 'ais-edge temp'); svg.appendChild(p); }
}
function applyView() { world.style.transform = `translate(${view.x}px,${view.y}px) scale(${view.k})`; $('#ais-zoom-label').textContent = Math.round(view.k * 100) + '%'; }
function renderNodes() {
  world.querySelectorAll('.ais-node').forEach(el => el.remove());
  for (const node of graph.nodes) {
    const def = NODE_DEFS[node.type]; const el = document.createElement('article');
    el.className = 'ais-node st-' + node.status + (node.id === selectedId ? ' sel' : ''); el.dataset.nodeId = node.id;
    el.style.left = node.x + 'px'; el.style.top = node.y + 'px'; el.style.setProperty('--nc', def.color);
    const out = outputs.get(node.id);
    el.innerHTML = `<header><span class="dot"></span><strong>${def.label}</strong></header>
      <div class="ais-node-body">${node.error ? `<span class="nerr">${node.error}</span>` : out?.label ? `<span class="nlab">${out.label}</span>` : `<span class="nlab">${summary(node)}</span>`}
      ${out?.kind === 'image' || out?.kind === 'design' ? `<img class="nthumb" src="${out.url}" alt="Kết quả node">` : ''}${out?.kind === 'video' ? `<video class="nthumb" src="${out.url}" muted playsinline></video>` : ''}${out?.kind === 'prompt' ? `<span class="nprompt">${out.text.slice(0, 90)}…</span>` : ''}</div>
      ${def.inputs.map(i => `<span class="ais-port in" data-port="${i.id}" title="${i.label} (${i.type})" style="top:${44 + def.inputs.indexOf(i) * 24}px"></span><span class="plabel in" style="top:${36 + def.inputs.indexOf(i) * 24}px">${i.label}</span>`).join('')}
      ${def.outputs.map(o => `<span class="ais-port out" data-port="out" title="${o.label} (${o.type})"></span><span class="plabel out">${o.label}</span>`).join('')}`;
    world.appendChild(el);
  }
  renderEdges();
}
function summary(node) { const c = node.config; return node.type === 'imageInput' ? (c.assetName || 'Ảnh áo có sẵn của shop') : node.type === 'designInput' ? (c.assetName || (c.svgText ? 'Hình in SVG' : 'Chưa chọn hình in')) : node.type === 'promptInput' ? String(c.text || '').slice(0, 60) : def0(node.type); }
function def0(t) { return { promptAssistant: 'Trợ lý quy tắc — không phải AI', composition: 'Ghép hình in gốc hậu kỳ', imageEditor: 'Cắt / xoay / sáng / tương phản', aiImageGen: 'DEMO — chưa kết nối AI', aiVariation: 'DEMO — biến đổi canvas', aiVideoGen: 'DEMO — WebM từ canvas', preview: 'Xem ảnh / video kết quả', exportNode: 'Tải PNG/JPG/SVG/ZIP', saveProject: 'Lưu vào IndexedDB' }[t] || ''; }
function renderAll() { renderNodes(); applyView(); renderProperties(); }

// ---------- history / persistence ----------
function snapshot() { return JSON.stringify({ nodes: graph.nodes.map(n => ({ id: n.id, type: n.type, x: n.x, y: n.y, config: n.config })), edges: graph.edges }); }
function pushHistory() { history = history.slice(0, historyIdx + 1); history.push(snapshot()); if (history.length > 60) history.shift(); historyIdx = history.length - 1; updateUndoBtns(); }
function restore(s) { const g = JSON.parse(s); graph = { nodes: g.nodes.map(n => ({ ...n, status: 'idle', logs: [], error: '' })), edges: g.edges }; selectedId = null; selectedEdgeId = null; outputs = new Map(); renderAll(); scheduleSave(); }
function updateUndoBtns() { $('#ais-undo').disabled = historyIdx <= 0; $('#ais-redo').disabled = historyIdx >= history.length - 1; }
let saveTimer = null;
function scheduleSave() { $('#ais-save-status').textContent = 'Có thay đổi chưa lưu…'; clearTimeout(saveTimer); saveTimer = setTimeout(() => saveProjectNow().catch(e => message('Lỗi tự lưu: ' + e.message, true)), 800); }
async function saveProjectNow() {
  const data = { id: projectId, name: $('#ais-project-name').value.trim() || 'Dự án chưa đặt tên', graph: JSON.parse(snapshot()), updatedAt: Date.now() };
  await store.saveProject(data); $('#ais-save-status').textContent = 'Đã lưu ' + new Date().toLocaleTimeString('vi-VN'); await refreshProjectList(); await refreshStorage();
}
async function refreshProjectList() { const list = (await store.listProjects()).sort((a, b) => b.updatedAt - a.updatedAt); const sel = $('#ais-project-select'); sel.innerHTML = list.map(p => `<option value="${p.id}" ${p.id === projectId ? 'selected' : ''}>${p.name} — ${new Date(p.updatedAt).toLocaleDateString('vi-VN')}</option>`).join('') || '<option value="">(chưa có dự án)</option>'; }
async function refreshStorage() { const e = await storageEstimate(); const assets = await store.listAssets(); const el = $('#ais-storage-info'); if (el) el.textContent = `Dung lượng trình duyệt đã dùng: ${(e.usage / 1048576).toFixed(1)} MB${e.quota ? ' / ' + (e.quota / 1073741824).toFixed(1) + ' GB' : ''} · ${assets.length} file đã lưu trong AI Studio`; }
async function openProject(id) { const p = await store.getProject(id); if (!p) return message('Không tìm thấy dự án.', true); projectId = p.id; $('#ais-project-name').value = p.name; graph = { nodes: p.graph.nodes.map(n => ({ ...n, status: 'idle', logs: [], error: '' })), edges: p.graph.edges }; outputs = new Map(); history = []; historyIdx = -1; pushHistory(); selectedId = null; renderAll(); message('Đã mở dự án "' + p.name + '"'); }

// ---------- properties panel ----------
function field(label, inner) { return `<label class="pf"><span>${label}</span>${inner}</label>`; }
function num(id, val, attrs = '') { return `<input type="number" id="${id}" value="${val}" ${attrs}>`; }
function sel(id, opts, val) { return `<select id="${id}">${opts.map(([v, l]) => `<option value="${v}" ${v === val ? 'selected' : ''}>${l}</option>`).join('')}</select>`; }
function renderProperties() {
  const box = $('#ais-properties'); const node = findNode(graph, selectedId);
  box.classList.toggle('open', !!node);
  if (!node) { box.innerHTML = `<h3>Thuộc tính</h3><p class="hint">Chọn một node để xem cấu hình, chạy riêng node đó và xem kết quả. Kéo từ cổng tròn bên phải của node này sang cổng bên trái của node khác để nối dây.</p>${providerHtml()}${storageHtml()}`; bindProvider(box); return; }
  const def = NODE_DEFS[node.type]; const c = node.config; const out = outputs.get(node.id);
  let h = `<div class="ph"><h3 style="--nc:${def.color}">${def.label}</h3><button id="ais-prop-close" aria-label="Đóng">×</button></div>
  <p class="pstatus">Trạng thái: <strong>${node.status}</strong>${node.error ? ` — <span class="err">${node.error}</span>` : ''}</p><div class="prow">
  <button id="ais-p-run">▶ Chạy node này</button><button id="ais-p-runfrom">Chạy từ node này</button><button id="ais-p-dup">Nhân bản</button><button id="ais-p-del">Xóa node</button></div>`;
  if (node.type === 'imageInput') { h += field('Ảnh áo có sẵn (ảnh thật)', sel('pf-fixture', FIXTURES, c.fixture)) + field('Hoặc tải ảnh lên (PNG/JPG/WebP, lưu IndexedDB)', '<input type="file" id="pf-file" accept="image/png,image/jpeg,image/webp" multiple>') + (c.assetName ? `<p class="hint">Đang dùng: ${c.assetName}${c.width ? ` (${c.width}×${c.height})` : ''}</p>` : ''); }
  if (node.type === 'designInput') { h += field('Tải hình in (PNG trong suốt / SVG an toàn)', '<input type="file" id="pf-file" accept="image/png,image/svg+xml">') + '<button id="pf-sample">Dùng hình in mẫu (SVG thật)</button>' + field('Nội dung SVG (nếu có)', `<textarea id="pf-svg" rows="4">${(c.svgText || '').replace(/</g, '&lt;')}</textarea>`) + (c.assetName ? `<p class="hint">Đang dùng: ${c.assetName}</p>` : ''); }
  if (node.type === 'promptInput') { h += field('Nội dung prompt (tiếng Việt)', `<textarea id="pf-text" rows="4">${c.text}</textarea>`) + '<p class="hint">Mẫu prompt:</p>' + PROMPT_TEMPLATES.map((t, i) => `<button class="pf-tpl" data-tpl="${i}">${t}</button>`).join(''); }
  if (node.type === 'promptAssistant') { for (const gName of Object.keys(PROMPT_OPTIONS)) h += field({ style: 'Phong cách chụp', model: 'Người mẫu', background: 'Bối cảnh', lighting: 'Ánh sáng', angle: 'Góc chụp' }[gName], sel('pf-' + gName, Object.entries(PROMPT_OPTIONS[gName]), c[gName])); h += field('Bổ sung', `<input type="text" id="pf-extra" value="${(c.extra || '').replace(/"/g, '&quot;')}">`) + field('Prompt đã soạn (sửa được)', `<textarea id="pf-composed" rows="4">${c.composed || ''}</textarea>`) + '<p class="hint">Trợ lý này ghép prompt bằng QUY TẮC có sẵn — không phải AI.</p>'; }
  if (node.type === 'composition') { h += field('Ảnh áo nền (khi không có dây vào)', sel('pf-base', FIXTURES, c.base)) + field('Vị trí in X %', num('pf-printX', c.printX, 'min="5" max="95"')) + field('Vị trí in Y %', num('pf-printY', c.printY, 'min="5" max="95"')) + field('Rộng vùng in %', num('pf-printW', c.printW, 'min="5" max="80"')) + field('Xoay hình in (độ)', num('pf-rotation', c.rotation, 'min="-45" max="45"')) + '<p class="hint">Khung đứt nét đỏ = vùng in an toàn. File hình in gốc không bị sửa.</p>'; }
  if (node.type === 'imageEditor') { h += field('Cắt mỗi cạnh %', num('pf-crop', c.crop, 'min="0" max="40"')) + field('Xoay (độ: 0/90/180/270)', num('pf-rotate', c.rotate)) + field('Rộng đầu ra px (0 = giữ nguyên)', num('pf-resizeW', c.resizeW, 'min="0" max="2000"')) + field('Độ sáng %', num('pf-brightness', c.brightness, 'min="20" max="200"')) + field('Tương phản %', num('pf-contrast', c.contrast, 'min="20" max="200"')); }
  if (node.type === 'aiImageGen') { h += field('Tỉ lệ ảnh', sel('pf-ratio', [['4:5', '4:5'], ['1:1', '1:1'], ['9:16', '9:16 (TikTok)'], ['16:9', '16:9']], c.ratio)) + field('Số lượng (P1 demo tạo 1)', num('pf-count', c.count, 'min="1" max="4"')) + '<p class="hint warn">DEMO: chưa kết nối AI thật — kết quả là ảnh canvas có đóng dấu DEMO.</p>'; }
  if (node.type === 'aiVariation') { h += field('Kiểu biến thể', sel('pf-variant', [['boi-canh', 'Đổi bối cảnh (tông màu)'], ['goc-khac', 'Đổi góc (phóng 1.3×)'], ['can-canh', 'Cận cảnh (phóng 2×)']], c.variant)); }
  if (node.type === 'aiVideoGen') { h += field('Mô tả chuyển động', `<input type="text" id="pf-motion" value="${(c.motion || '').replace(/"/g, '&quot;')}">`) + field('Thời lượng (giây, demo tối đa 6)', num('pf-duration', c.duration, 'min="1" max="6"')) + field('Tỉ lệ', sel('pf-ratio', [['9:16', '9:16 dọc'], ['16:9', '16:9 ngang'], ['1:1', '1:1']], c.ratio)) + '<p class="hint warn">DEMO: video WebM ghi từ canvas bằng MediaRecorder — không phải MP4, không phải AI video thật.</p>'; }
  if (node.type === 'exportNode') { h += field('Định dạng khi tải', sel('pf-format', [['png', 'PNG'], ['jpg', 'JPG'], ['svg', 'SVG (chỉ khi đầu vào là SVG thật)'], ['webm', 'Video WebM (chỉ khi đầu vào là video)']], c.format)) + '<button id="pf-download">⬇ Tải file kết quả của node này</button>'; }
  if (out) { h += `<div class="pout" id="ais-prop-output"><h4>Kết quả</h4>${out.kind === 'image' || out.kind === 'design' ? `<img src="${out.url}" alt="Kết quả">` : ''}${out.kind === 'video' ? `<video src="${out.url}" controls playsinline></video>` : ''}${out.kind === 'prompt' ? `<p>${out.text}</p>` : ''}${out.label ? `<p class="hint">${out.label}</p>` : ''}</div>`; }
  h += `<div class="plogs"><h4>Nhật ký node</h4>${(node.logs || []).map(l => `<div>${l}</div>`).join('') || '<div>Chưa chạy.</div>'}</div>`;
  box.innerHTML = h; bindProperties(node);
}
function storageHtml() { return `<div class="psec"><h4>Lưu trữ</h4><p class="hint" id="ais-storage-info">…</p></div>`; }
function providerHtml() { return `<div class="psec"><h4>Nhà cung cấp AI</h4>
  ${field('Loại', sel('ais-provider-kind', [['demo', 'Demo — không kết nối AI'], ['http', 'HTTP provider / proxy (nâng cao)']], providerKind))}
  ${field('Tên nhà cung cấp', '<input type="text" id="ais-provider-name" value="HTTP Provider">')}
  ${field('Endpoint', '<input type="url" id="ais-provider-endpoint" placeholder="https://proxy.example.com/ai">')}
  ${field('API key (chỉ trong bộ nhớ phiên — KHÔNG lưu)', '<input type="password" id="ais-provider-key" autocomplete="off" placeholder="Nhập key cho phiên này">')}
  <button id="ais-provider-test">Kiểm tra kết nối</button><p class="hint warn">${BROWSER_KEY_WARNING}</p><p class="hint" id="ais-provider-status">${describeProvider(currentProvider())}</p></div>`; }
function bindProvider(scope) {
  scope.querySelector('#ais-provider-kind')?.addEventListener('change', e => { providerKind = e.target.value; renderProperties(); });
  scope.querySelector('#ais-provider-key')?.addEventListener('change', e => setSessionKey(e.target.value));
  scope.querySelector('#ais-provider-test')?.addEventListener('click', async () => { const p = currentProvider(); const st = scope.querySelector('#ais-provider-status'); if (p.isDemo) { st.textContent = 'Đang ở chế độ DEMO — chưa kết nối AI thật.'; return; } const r = await p.testConnection(); st.textContent = r.message; });
  refreshStorage();
}
function bindProperties(node) {
  const c = node.config; const on = (id, ev, fn) => { const el = document.getElementById(id); el?.addEventListener(ev, fn); };
  const upd = (key, val) => { c[key] = val; renderNodes(); scheduleSave(); };
  $('#ais-prop-close')?.addEventListener('click', () => { selectedId = null; renderAll(); });
  on('ais-p-run', 'click', () => runNodes('single', node.id));
  on('ais-p-runfrom', 'click', () => runNodes('from', node.id));
  on('ais-p-del', 'click', () => { graph.nodes = graph.nodes.filter(n => n.id !== node.id); graph.edges = graph.edges.filter(e => e.from !== node.id && e.to !== node.id); selectedId = null; pushHistory(); renderAll(); scheduleSave(); });
  on('ais-p-dup', 'click', () => { const n = makeNode(node.type, node.x + 36, node.y + 36); n.config = structuredClone(node.config); graph.nodes.push(n); selectedId = n.id; pushHistory(); renderAll(); scheduleSave(); });
  on('pf-file', 'change', async (e) => {
    const files = [...e.target.files]; if (!files.length) return;
    try {
      for (const f of files) {
        if (node.type === 'designInput' && /svg/i.test(f.type + f.name)) { const text = await f.text(); const chk = checkSvgSafety(text); if (!chk.ok) throw new Error(chk.reason); c.svgText = text; c.assetName = f.name; c.assetId = ''; }
        else {
          if (!/^image\/(png|jpeg|webp|svg\+xml)$/.test(f.type)) throw new Error('Định dạng không hỗ trợ: ' + f.name);
          const id = uid('asset'); const bmp = await createImageBitmap(f).catch(() => null);
          await store.saveAsset({ id, blob: f, name: f.name, mime: f.type });
          c.assetId = id; c.assetName = f.name; if (bmp) { c.width = bmp.width; c.height = bmp.height; }
          c.assetIds = [...(c.assetIds || []), id];
        }
      }
      message('Đã lưu file vào IndexedDB của AI Studio.'); pushHistory(); renderAll(); scheduleSave();
    } catch (err) { message('Tải file lỗi: ' + err.message, true); }
  });
  on('pf-sample', 'click', () => { c.svgText = SAMPLE_DESIGN_SVG; c.assetName = 'hinh-in-mau.svg'; c.assetId = ''; pushHistory(); renderAll(); scheduleSave(); });
  on('pf-text', 'input', e => upd('text', e.target.value));
  document.querySelectorAll('.pf-tpl').forEach(b => b.addEventListener('click', () => { upd('text', PROMPT_TEMPLATES[+b.dataset.tpl]); renderProperties(); }));
  for (const gName of Object.keys(PROMPT_OPTIONS)) on('pf-' + gName, 'change', e => { upd(gName, e.target.value); c.composed = buildPrompt(c, ''); renderProperties(); });
  on('pf-extra', 'input', e => upd('extra', e.target.value));
  on('pf-composed', 'input', e => { c.composed = e.target.value; });
  const numBind = (id, key) => on(id, 'change', e => upd(key, Number(e.target.value)));
  ['fixture', 'base'].forEach(k => on('pf-' + k, 'change', e => upd(k, e.target.value)));
  on('pf-svg', 'change', e => { const v = e.target.value; if (v) { const chk = checkSvgSafety(v); if (!chk.ok) return message(chk.reason, true); } upd('svgText', v); });
  numBind('pf-printX', 'printX'); numBind('pf-printY', 'printY'); numBind('pf-printW', 'printW'); numBind('pf-rotation', 'rotation');
  numBind('pf-crop', 'crop'); numBind('pf-rotate', 'rotate'); numBind('pf-resizeW', 'resizeW'); numBind('pf-brightness', 'brightness'); numBind('pf-contrast', 'contrast');
  numBind('pf-count', 'count'); numBind('pf-duration', 'duration');
  on('pf-ratio', 'change', e => upd('ratio', e.target.value)); on('pf-variant', 'change', e => upd('variant', e.target.value)); on('pf-format', 'change', e => upd('format', e.target.value));
  on('pf-motion', 'input', e => upd('motion', e.target.value));
  on('pf-download', 'click', async () => { const v = outputs.get(node.id); if (!v) return message('Hãy chạy workflow trước khi tải.', true); await downloadValue(v, node.config.format); });
}

// ---------- downloads / export ----------
function saveBlob(blob, name) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); }
async function downloadValue(v, format) {
  if (!v) return message('Chưa có kết quả.', true);
  if (v.kind === 'video') return saveBlob(v.blob, 'video-demo.webm');
  if (v.kind === 'prompt') return saveBlob(new Blob([v.text], { type: 'text/plain' }), 'prompt.txt');
  if (format === 'svg') { if (!v.svgText) return message('Đầu vào không phải SVG vector thật — không xuất SVG (không đổi tên PNG thành SVG).', true); return saveBlob(new Blob([v.svgText], { type: 'image/svg+xml' }), 'thiet-ke.svg'); }
  if (format === 'jpg' && v.blob) { const img = await blobToImg(v.blob); const c = makeCanvas(img.width, img.height); const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(img, 0, 0); return saveBlob(await canvasBlob(c, 'image/jpeg'), 'ket-qua.jpg'); }
  if (v.blob) return saveBlob(v.blob, 'ket-qua.' + (v.mime?.includes('webp') ? 'webp' : v.mime?.includes('jpeg') ? 'jpg' : 'png'));
  message('Kết quả này không có file để tải.', true);
}
const te = new TextEncoder();
async function exportZip() {
  const name = $('#ais-project-name').value.trim() || 'du-an';
  const entries = [];
  const wf = { app: 'AO IN STUDIO — AI CREATIVE WORKFLOW', version: 1, exportedAt: new Date().toISOString(), projectId, name, graph: JSON.parse(snapshot()) };
  entries.push({ name: 'workflow.json', data: te.encode(JSON.stringify(wf, null, 2)) });
  entries.push({ name: 'metadata.json', data: te.encode(JSON.stringify({ name, nodes: graph.nodes.length, edges: graph.edges.length, note: 'Không chứa API key. Ảnh DEMO được ghi rõ trong workflow.', demoMode: providerKind === 'demo' }, null, 2)) });
  entries.push({ name: 'prompts.txt', data: te.encode(graph.nodes.filter(n => ['promptInput', 'promptAssistant'].includes(n.type)).map(n => `[${NODE_DEFS[n.type].label}] ${n.config.text || n.config.composed || ''}`).join('\n\n')) });
  const assetIds = new Set(); for (const n of graph.nodes) { if (n.config.assetId) assetIds.add(n.config.assetId); for (const id of n.config.assetIds || []) assetIds.add(id); }
  for (const id of assetIds) { const a = await store.getAsset(id); if (a) entries.push({ name: `assets/${id}_${a.name}`, data: new Uint8Array(await a.blob.arrayBuffer()) }); }
  for (const n of graph.nodes) if (n.config.svgText) entries.push({ name: `designs/${n.id}.svg`, data: te.encode(n.config.svgText) });
  for (const [id, v] of outputs) { if (v?.blob) entries.push({ name: `results/${id}.${v.kind === 'video' ? 'webm' : v.mime?.includes('jpeg') ? 'jpg' : v.mime?.includes('svg') ? 'svg' : 'png'}`, data: new Uint8Array(await v.blob.arrayBuffer()) }); }
  saveBlob(new Blob([zipWrite(entries)], { type: 'application/zip' }), name.replace(/\s+/g, '-') + '.zip');
  message('Đã xuất ZIP dự án (không chứa API key).');
}
async function importFile(file) {
  try {
    if (/\.zip$/i.test(file.name)) {
      const entries = zipRead(new Uint8Array(await file.arrayBuffer()));
      const wfEntry = entries.find(e => e.name === 'workflow.json'); if (!wfEntry) throw new Error('ZIP thiếu workflow.json.');
      for (const e of entries) if (e.name.startsWith('assets/')) { const base = e.name.slice('assets/'.length); const id = base.split('_')[0]; await store.saveAsset({ id, blob: new Blob([e.data]), name: base.slice(id.length + 1) }); }
      applyImported(JSON.parse(new TextDecoder().decode(wfEntry.data)));
    } else applyImported(JSON.parse(await file.text()));
  } catch (e) { message('Nhập dự án lỗi: ' + e.message, true); }
}
function applyImported(wf) {
  const g = wf.graph || wf; if (!g.nodes || !g.edges) throw new Error('File không chứa workflow hợp lệ.');
  projectId = uid('project'); $('#ais-project-name').value = wf.name || 'Dự án nhập vào';
  graph = { nodes: g.nodes.map(n => ({ ...n, status: 'idle', logs: [], error: '' })), edges: g.edges };
  outputs = new Map(); pushHistory(); renderAll(); scheduleSave(); message('Đã nhập workflow. Hãy bấm Lưu / chờ tự lưu.');
}

// ---------- run ----------
async function runNodes(mode, id) {
  engine = new Engine(graph, handlers, { onNode: (n) => { renderNodes(); if (n.id === selectedId) renderProperties(); }, onLog: (n, m) => logLine((n ? NODE_DEFS[n.type].label + ': ' : '') + m) });
  outputs = engine.outputs;
  message('Đang chạy workflow (chế độ ' + (providerKind === 'demo' ? 'DEMO' : 'HTTP') + ')…');
  try { const r = mode === 'all' ? await engine.runAll() : mode === 'single' ? await engine.runSingle(id) : await engine.runFrom(id);
    message(r.failed.length ? `Chạy xong: ${r.done.length} node thành công, ${r.failed.length} node lỗi.` : `Chạy xong: ${r.done.length} node thành công.`, r.failed.length > 0);
  } catch (e) { message('Lỗi workflow: ' + e.message, true); }
  renderAll();
}

// ---------- canvas interactions ----------
const viewport = $('#ais-canvas');
const pointers = new Map(); let drag = null; // {kind:'node'|'pan'|'connect'|'pinch', ...}
const toWorld = (cx, cy) => { const r = viewport.getBoundingClientRect(); return { x: (cx - r.left - view.x) / view.k, y: (cy - r.top - view.y) / view.k }; };
viewport.addEventListener('pointerdown', (e) => {
  viewport.setPointerCapture(e.pointerId); pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pointers.size === 2) { const [a, b] = [...pointers.values()]; drag = { kind: 'pinch', d: Math.hypot(a.x - b.x, a.y - b.y), k: view.k }; return; }
  const portEl = e.target.closest('.ais-port'); const nodeEl = e.target.closest('.ais-node');
  if (portEl && nodeEl) {
    const node = findNode(graph, nodeEl.dataset.nodeId); const w = toWorld(e.clientX, e.clientY);
    if (portEl.classList.contains('out')) drag = { kind: 'connect', fromId: node.id, fromPos: portPos(node, 'out') };
    else drag = { kind: 'connect-rev', toId: node.id, toPort: portEl.dataset.port, fromPos: { x: w.x, y: w.y } };
    return;
  }
  if (e.target.closest('.ais-edge')) { selectedEdgeId = e.target.dataset.edgeId; selectedId = null; renderAll(); return; }
  if (nodeEl) { const node = findNode(graph, nodeEl.dataset.nodeId); selectedId = node.id; selectedEdgeId = null; const w = toWorld(e.clientX, e.clientY); drag = { kind: 'node', id: node.id, dx: w.x - node.x, dy: w.y - node.y, moved: false }; renderAll(); return; }
  selectedId = null; selectedEdgeId = null; drag = { kind: 'pan', sx: e.clientX - view.x, sy: e.clientY - view.y }; renderAll();
});
viewport.addEventListener('pointermove', (e) => {
  if (!pointers.has(e.pointerId)) return; pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (!drag) return; const w = toWorld(e.clientX, e.clientY);
  if (drag.kind === 'pinch' && pointers.size === 2) { const [a, b] = [...pointers.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y); view.k = Math.min(2.5, Math.max(0.25, drag.k * d / drag.d)); applyView(); return; }
  if (drag.kind === 'pan') { view.x = e.clientX - drag.sx; view.y = e.clientY - drag.sy; applyView(); return; }
  if (drag.kind === 'node') { const node = findNode(graph, drag.id); node.x = Math.round(w.x - drag.dx); node.y = Math.round(w.y - drag.dy); drag.moved = true; const el = world.querySelector(`[data-node-id="${node.id}"]`); if (el) { el.style.left = node.x + 'px'; el.style.top = node.y + 'px'; } renderEdges(); return; }
  if (drag.kind === 'connect') { tempLine = { from: drag.fromPos, to: w }; renderEdges(); return; }
  if (drag.kind === 'connect-rev') { tempLine = { from: w, to: drag.fromPos }; renderEdges(); return; }
});
function endPointer(e) {
  pointers.delete(e.pointerId);
  if (!drag) return;
  if (drag.kind === 'connect' || drag.kind === 'connect-rev') {
    const el = document.elementFromPoint(e.clientX, e.clientY)?.closest('.ais-port'); const nodeEl = document.elementFromPoint(e.clientX, e.clientY)?.closest('.ais-node');
    tempLine = null;
    if (el && nodeEl) {
      let fromId, toId, toPort;
      if (drag.kind === 'connect' && el.classList.contains('in')) { fromId = drag.fromId; toId = nodeEl.dataset.nodeId; toPort = el.dataset.port; }
      if (drag.kind === 'connect-rev' && el.classList.contains('out')) { fromId = nodeEl.dataset.nodeId; toId = drag.toId; toPort = drag.toPort; }
      if (fromId) { const v = validateConnection(graph, fromId, toId, toPort); if (v.ok) { graph.edges.push({ id: uid('edge'), from: fromId, to: toId, toPort }); pushHistory(); scheduleSave(); message('Đã nối dây.'); } else message(v.reason, true); }
    }
    renderEdges();
  }
  if (drag.kind === 'node' && drag.moved) { pushHistory(); scheduleSave(); }
  drag = null;
}
viewport.addEventListener('pointerup', endPointer); viewport.addEventListener('pointercancel', endPointer);
viewport.addEventListener('wheel', (e) => { e.preventDefault(); const f = e.deltaY < 0 ? 1.1 : 0.9; const r = viewport.getBoundingClientRect(); const mx = e.clientX - r.left, my = e.clientY - r.top; const k2 = Math.min(2.5, Math.max(0.25, view.k * f)); view.x = mx - (mx - view.x) * (k2 / view.k); view.y = my - (my - view.y) * (k2 / view.k); view.k = k2; applyView(); }, { passive: false });
function fitView() { if (!graph.nodes.length) { view = { x: 40, y: 30, k: 0.9 }; applyView(); return; } const r = viewport.getBoundingClientRect(); const minX = Math.min(...graph.nodes.map(n => n.x)), minY = Math.min(...graph.nodes.map(n => n.y)), maxX = Math.max(...graph.nodes.map(n => n.x + 220)), maxY = Math.max(...graph.nodes.map(n => n.y + 150)); const k = Math.min(1.2, Math.min((r.width - 32) / (maxX - minX), (r.height - 32) / (maxY - minY))); view.k = Math.max(0.2, k); view.x = 16 - minX * view.k; view.y = 16 - minY * view.k; applyView(); }

// ---------- toolbar wiring ----------
$('#ais-node-library').innerHTML = NODE_TYPES.map(t => `<button data-add-node="${t}"><span style="background:${NODE_DEFS[t].color}"></span>${NODE_DEFS[t].label}</button>`).join('');
$('#ais-node-library').addEventListener('click', (e) => { const b = e.target.closest('[data-add-node]'); if (!b) return; const n = makeNode(b.dataset.addNode, 90 - view.x / view.k + graph.nodes.length * 14 % 160, 70 - view.y / view.k + graph.nodes.length * 12 % 120); graph.nodes.push(n); selectedId = n.id; pushHistory(); renderAll(); scheduleSave(); $('#ais-library').classList.remove('open'); });
$('#ais-templates').innerHTML = TEMPLATES.map(t => `<button data-template="${t.id}">${t.name}</button>`).join('');
$('#ais-templates').addEventListener('click', (e) => { const b = e.target.closest('[data-template]'); if (!b) return; const t = TEMPLATES.find(x => x.id === b.dataset.template); graph = t.make(); outputs = new Map(); selectedId = null; pushHistory(); renderAll(); scheduleSave(); fitView(); message('Đã tải ' + t.name + '. Bấm "Chạy workflow" để chạy ở chế độ DEMO.'); });
$('#ais-run').addEventListener('click', () => runNodes('all'));
$('#ais-stop').addEventListener('click', () => { engine?.stop(); message('Đã yêu cầu dừng — workflow sẽ dừng giữa các node.'); });
$('#ais-undo').addEventListener('click', () => { if (historyIdx > 0) { historyIdx--; restore(history[historyIdx]); updateUndoBtns(); } });
$('#ais-redo').addEventListener('click', () => { if (historyIdx < history.length - 1) { historyIdx++; restore(history[historyIdx]); updateUndoBtns(); } });
$('#ais-zoom-in').addEventListener('click', () => { view.k = Math.min(2.5, view.k * 1.2); applyView(); });
$('#ais-zoom-out').addEventListener('click', () => { view.k = Math.max(0.25, view.k / 1.2); applyView(); });
$('#ais-fit').addEventListener('click', fitView);
$('#ais-delete-edge').addEventListener('click', () => { if (!selectedEdgeId) return message('Hãy bấm vào một đường dây trên canvas trước.', true); graph.edges = graph.edges.filter(e => e.id !== selectedEdgeId); selectedEdgeId = null; pushHistory(); renderAll(); scheduleSave(); });
document.addEventListener('keydown', (e) => { if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) { graph.nodes = graph.nodes.filter(n => n.id !== selectedId); graph.edges = graph.edges.filter(x => x.from !== selectedId && x.to !== selectedId); selectedId = null; pushHistory(); renderAll(); scheduleSave(); } });
$('#ais-save').addEventListener('click', () => saveProjectNow().then(() => message('Đã lưu dự án vào IndexedDB.')));
$('#ais-new').addEventListener('click', () => { if (!confirm('Tạo dự án mới? Dự án hiện tại đã được tự lưu trong danh sách dự án.')) return; projectId = uid('project'); $('#ais-project-name').value = 'Dự án mới'; graph = emptyGraph(); outputs = new Map(); history = []; historyIdx = -1; pushHistory(); renderAll(); scheduleSave(); });
$('#ais-project-select').addEventListener('change', (e) => { if (e.target.value) openProject(e.target.value); });
$('#ais-project-name').addEventListener('change', scheduleSave);
$('#ais-duplicate').addEventListener('click', async () => { await saveProjectNow(); const p = await store.getProject(projectId); const copy = { ...p, id: uid('project'), name: p.name + ' (bản sao)', updatedAt: Date.now() }; await store.saveProject(copy); projectId = copy.id; $('#ais-project-name').value = copy.name; await refreshProjectList(); message('Đã nhân bản dự án.'); });
$('#ais-delete-project').addEventListener('click', async () => { if (!confirm('Xóa dự án hiện tại khỏi IndexedDB? Không thể hoàn tác.')) return; await store.deleteProject(projectId); projectId = uid('project'); $('#ais-project-name').value = 'Dự án mới'; graph = emptyGraph(); outputs = new Map(); pushHistory(); renderAll(); await refreshProjectList(); message('Đã xóa dự án.'); });
$('#ais-export-zip-btn').addEventListener('click', exportZip);
$('#ais-export-workflow-btn').addEventListener('click', () => { saveBlob(new Blob([JSON.stringify({ app: 'AO IN STUDIO — AI CREATIVE WORKFLOW', version: 1, name: $('#ais-project-name').value, graph: JSON.parse(snapshot()) }, null, 2)], { type: 'application/json' }), 'workflow.json'); message('Đã xuất workflow.json (chỉ cấu trúc, không kèm ảnh, không API key).'); });
$('#ais-import').addEventListener('change', (e) => { if (e.target.files[0]) importFile(e.target.files[0]); });
$('#ais-toggle-library').addEventListener('click', () => $('#ais-library').classList.toggle('open'));
$('#ais-run-mobile')?.addEventListener('click', () => runNodes('all'));

// ---------- init ----------
(async function init() {
  pushHistory(); renderAll(); await refreshProjectList(); await refreshStorage();
  const list = (await store.listProjects()).sort((a, b) => b.updatedAt - a.updatedAt);
  if (list.length) await openProject(list[0].id);
  document.body.dataset.ready = 'true'; document.documentElement.dataset.ready = 'true';
  logLine('AI Studio P1 sẵn sàng. Chế độ AI: DEMO (chưa kết nối provider thật).');
})();
