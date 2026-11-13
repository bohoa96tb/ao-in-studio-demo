// AI Studio — Provider Adapter architecture (brief §9).
// Contract: an adapter exposes {id, name, kind, isDemo, capabilities(),
// generateImage(), imageToVideo()}. The Workflow Engine only knows this
// contract, never a vendor: adding a provider (e.g. Gemini later) means
// adding ONE adapter + ONE descriptor below — no engine changes.
//
// SECURITY: API keys are held ONLY in a module-level in-memory variable for
// the current page session (set via setSessionKey). They are NEVER written to
// IndexedDB, localStorage, git, project files or ZIP exports. Calling a
// provider directly from the browser exposes the key to anyone inspecting
// the page — a backend proxy/serverless endpoint is the recommended route.
//
// P4 (2026-11-14) — Pollinations, cost-controlled. Verified facts (official
// Pollinations docs/catalog, researched 2026-11-13/14 — see
// docs/AI_STUDIO_PROVIDER_GUIDE.md):
//  - Unified API gen.pollinations.ai: API key + prepaid Pollen for every
//    uncached generation (~$1 ≈ 1 Pollen). NO recurring free tier.
//    Exhausted balance/key budget hard-stops with HTTP 402 (no card charge),
//    UNLESS the account holder enabled auto top-up in their dashboard.
//  - Legacy Classic API image.pollinations.ai: anonymous, deducts nothing,
//    model `sana` ONLY, ≤768×768, JPEG with a Pollinations logo, roughly
//    1 request / 45 s per IP; over the limit → HTTP 402 + Retry-After.
//  - Zero-cost connection test: GET gen.pollinations.ai/image/models needs
//    NO auth and returns the live model catalog. Never test by generating.
//  - Token-priced models (GPT Image, Nano Banana) publish NO fixed
//    per-image price → they are listed but NOT runnable in P4.

// Default fetch MUST stay bound to the global object: passing bare `fetch`
// around and calling it as a method throws 'Illegal invocation' in browsers.
const defaultFetch = (url, opts) => fetch(url, opts);

let sessionKey = ''; // memory only, cleared on reload
export function setSessionKey(k) { sessionKey = String(k || ''); }
export function hasSessionKey() { return sessionKey.length > 0; }
export function getSessionKey() { return sessionKey; }
export function clearSessionKey() { sessionKey = ''; }

export const BROWSER_KEY_WARNING = 'Cảnh báo: gọi API trực tiếp từ trình duyệt sẽ lộ API key cho bất kỳ ai xem mã trang. Chỉ dùng key giới hạn (quota thấp) để thử nghiệm; khi vận hành thật hãy dùng backend proxy/serverless. Key chỉ giữ trong bộ nhớ phiên này, không lưu vào IndexedDB/localStorage/file xuất.';
export const POLLINATIONS_KEY_WARNING = 'Key Pollinations dạng sk_ vốn là thông tin xác thực PHÍA SERVER — nhà cung cấp khuyến cáo không nhúng vào mã trình duyệt. Nếu vẫn dùng ở đây: chỉ dùng key có ngân sách Pollen thấp + hạn chế model, và thu hồi ngay khi nghi ngờ lộ. Studio không lưu key này ở bất cứ đâu ngoài bộ nhớ của tab hiện tại.';
export const AUTO_TOPUP_WARNING = 'Lưu ý chi phí: Pollen là trả trước — hết số dư thì Pollinations dừng cứng (HTTP 402), KHÔNG tự trừ thẻ. NGOẠI LỆ duy nhất: nếu chính bạn đã bật "auto top-up" (tự nạp) trong dashboard Pollinations thì tài khoản có thể bị trừ tiền qua thẻ đã lưu khi số dư thấp. Muốn an toàn tuyệt đối: tắt auto top-up trong dashboard.';
export const COMMERCIAL_USE_NOTE = 'Quyền dùng thương mại ảnh AI: Điều khoản hiện tại của Pollinations KHÔNG tự cấp quyền — quyền sử dụng tùy thuộc giấy phép của từng model. Kiểm tra giấy phép model trước khi dùng ảnh vào quảng cáo/bán hàng. Ảnh AI luôn giữ nhãn "Ảnh AI", không trình bày là ảnh sản phẩm thật.';

export const GEN_BASE = 'https://gen.pollinations.ai';
export const CLASSIC_BASE = 'https://image.pollinations.ai';
export const MODELS_ENDPOINT = GEN_BASE + '/image/models';
export const BALANCE_ENDPOINT = GEN_BASE + '/account/balance';

// ---------- provider descriptors (single source of truth for UI + gating) ----------
export const PROVIDERS = [
  {
    id: 'demo', name: 'Demo — không kết nối AI', kind: 'demo', requiresKey: false,
    models: [{ id: 'demo', name: 'Demo (vẽ bằng canvas trên máy)', pricePerImage: 0, supportsImg2Img: false }],
    limits: 'Không gọi bất kỳ API nào ra ngoài. Kết quả là ảnh canvas có đóng dấu DEMO trong pixel.',
  },
  {
    id: 'pollinations-classic', name: 'Pollinations Classic — miễn phí, không cần key', kind: 'free', requiresKey: false,
    models: [{ id: 'sana', name: 'Sana (model duy nhất của Classic)', pricePerImage: 0, supportsImg2Img: false, maxWidth: 768, maxHeight: 768, logo: true }],
    limits: 'Chỉ model sana · tối đa 768×768 · ảnh JPEG có logo Pollinations ở góc · khoảng 1 yêu cầu / 45 giây cho mỗi IP, vượt hạn mức → HTTP 402 · ẩn danh, không trừ gì cả, không cần tài khoản/key.',
  },
  {
    id: 'pollinations', name: 'Pollinations — API key + Pollen trả trước', kind: 'keyed', requiresKey: true,
    models: [
      { id: 'flux', name: 'FLUX.1-schnell (flux) — chỉ tạo từ chữ', pricePerImage: 0.002, supportsImg2Img: false },
      { id: 'zimage', name: 'Z-Image Turbo (zimage) — chỉ tạo từ chữ', pricePerImage: 0.004, supportsImg2Img: false },
      { id: 'klein', name: 'FLUX.2 Klein (klein) — hỗ trợ img2img', pricePerImage: 0.005, supportsImg2Img: true },
      { id: 'kontext', name: 'FLUX.1 Kontext Pro (kontext) — chỉnh sửa / img2img', pricePerImage: 0.03, supportsImg2Img: true },
      { id: 'gptimage', name: 'GPT Image (gptimage) — giá theo token', pricePerImage: null, tokenPriced: true, supportsImg2Img: true },
      { id: 'nanobanana', name: 'Nano Banana · Gemini Flash Image (nanobanana) — giá theo token', pricePerImage: null, tokenPriced: true, supportsImg2Img: true },
    ],
    limits: 'Trả trước bằng Pollen (1 Pollen ≈ 1 USD). Hết số dư / ngân sách của key → HTTP 402 dừng cứng, không tự trừ thẻ (trừ khi chủ tài khoản tự bật auto top-up trong dashboard). Model giá token (GPT Image, Nano Banana) không có giá cố định mỗi ảnh nên P4 KHÔNG cho chạy — không đoán giá.',
  },
  {
    id: 'http', name: 'HTTP provider / proxy (nâng cao — stub từ P1)', kind: 'http', requiresKey: true,
    models: [],
    limits: 'Stub có cổng giữ từ P1: chưa ánh xạ payload của nhà cung cấp cụ thể. Chọn loại này thì node AI báo lỗi cấu hình rõ ràng — không tạo ảnh giả, không gọi tạo ảnh.',
  },
];
export function providerById(id) { return PROVIDERS.find(p => p.id === id) || PROVIDERS[0]; }
export function modelOf(provider, modelId) { return (provider?.models || []).find(m => m.id === modelId) || null; }
/** Runnable in P4 = has a fixed per-image price (0 for free paths). */
export function isRunnableModel(model) { return !!model && typeof model.pricePerImage === 'number'; }

// ---------- mode gating (pure — unit-tested) ----------
/**
 * Decide what an AI generation node may do, given the UI state.
 * Returns {mode:'demo'|'classic'|'keyed'|'http'|'blocked', reason}.
 * The master switch defaults OFF → 'demo'. The keyed provider is usable
 * only with a session key AND the user's explicit in-panel confirmation.
 */
export function resolveGenerationMode({ realEnabled = false, providerId = 'demo', hasKey = false, keyedConfirmed = false } = {}) {
  if (providerId === 'http') return { mode: 'http', reason: '' }; // legacy gated stub — it can only error, never generate
  if (!realEnabled || providerId === 'demo') return { mode: 'demo', reason: '' };
  if (providerId === 'pollinations-classic') return { mode: 'classic', reason: '' };
  if (providerId === 'pollinations') {
    if (!hasKey) return { mode: 'blocked', reason: 'Chưa nhập API key Pollinations cho phiên này — provider có key đang bị khóa. Nhập key (chỉ giữ trong bộ nhớ phiên) trong bảng Nhà cung cấp AI, hoặc tắt chế độ AI thật để chạy DEMO.' };
    if (!keyedConfirmed) return { mode: 'blocked', reason: 'Chưa xác nhận bật provider Pollinations (key) trong bảng Nhà cung cấp AI — vì lý do an toàn chi phí, provider này chỉ chạy khi bạn tích "Tôi hiểu rủi ro…" và mỗi lượt chạy tốn Pollen đều phải xác nhận chi phí trước.' };
    return { mode: 'keyed', reason: '' };
  }
  return { mode: 'demo', reason: '' };
}
/** Real-provider calls must NEVER auto-retry (a retry could double-spend). */
export function suppressRetryForMode(mode) { return mode === 'classic' || mode === 'keyed'; }

// ---------- size mapping (pure) ----------
export function clampClassicSize(w, h) {
  w = Math.max(64, Math.round(w) || 768); h = Math.max(64, Math.round(h) || 768);
  const s = Math.min(1, 768 / w, 768 / h);
  return { w: Math.max(64, Math.floor(w * s)), h: Math.max(64, Math.floor(h * s)) };
}
export function sizeForRatio(ratio, kind) {
  const table = kind === 'free'
    ? { '4:5': [614, 768], '1:1': [768, 768], '9:16': [432, 768], '16:9': [768, 432] }
    : { '4:5': [1024, 1280], '1:1': [1024, 1024], '9:16': [720, 1280], '16:9': [1280, 720] };
  const [w, h] = table[ratio] || table['4:5'];
  return { w, h };
}

// ---------- URL builders (pure) ----------
export function buildClassicUrl({ prompt, width = 768, height = 768, seed = -1 } = {}) {
  const { w, h } = clampClassicSize(width, height);
  const q = new URLSearchParams({ model: 'sana', width: String(w), height: String(h), seed: String(seed) });
  return `${CLASSIC_BASE}/prompt/${encodeURIComponent(String(prompt || ''))}?${q.toString()}`;
}
export function buildKeyedImageUrl({ prompt, model, width = 1024, height = 1024, seed = -1, imageUrl = '' } = {}) {
  const q = new URLSearchParams({ model: String(model || 'flux'), width: String(Math.round(width)), height: String(Math.round(height)), seed: String(seed) });
  if (imageUrl) q.set('image', imageUrl);
  return `${GEN_BASE}/image/${encodeURIComponent(String(prompt || ''))}?${q.toString()}`;
}
export function keyedHeaders(key) { return { 'Authorization': 'Bearer ' + String(key || '') }; }

// ---------- provider error → honest Vietnamese message (pure) ----------
export function pollinationsErrorMessage(status, kind) {
  if (status === 401) return 'Provider từ chối xác thực (HTTP 401) — API key không hợp lệ, đã hết hạn hoặc đã bị thu hồi. Kiểm tra lại key trong bảng Nhà cung cấp AI.';
  if (status === 402) return kind === 'keyed'
    ? 'Hết Pollen hoặc vượt ngân sách của API key (HTTP 402) — Pollinations dừng cứng tại đây, không trừ thêm. Kiểm tra số dư trong bảng Nhà cung cấp AI trước khi chạy lại.'
    : 'Pollinations Classic báo hết hạn mức miễn phí tạm thời (HTTP 402) — giới hạn khoảng 1 ảnh / 45 giây cho mỗi IP. Đợi một lúc rồi chạy lại. Hệ thống không tự thử lại lệnh gọi AI thật.';
  if (status === 403) return 'API key không có quyền dùng model này (HTTP 403) — kiểm tra giới hạn model của key hoặc chọn model khác.';
  if (status === 429) return 'Provider báo quá tải / vượt tốc độ cho phép (HTTP 429). Đợi một lúc rồi chạy lại — hệ thống không tự thử lại lệnh gọi AI thật.';
  return `Provider trả lỗi HTTP ${status}.`;
}

// ---------- cost planning (pure) ----------
/**
 * calls: [{providerId, modelId, count}] → {ok, totalPollen, problems[]}.
 * Any token-priced / unknown model makes the plan NOT ok (never guessed).
 */
export function estimateGenerationCost(calls) {
  let totalPollen = 0; const problems = [];
  for (const c of calls || []) {
    const p = providerById(c.providerId); const m = modelOf(p, c.modelId);
    if (!m) { problems.push(`Không rõ model "${c.modelId}" của provider "${c.providerId}".`); continue; }
    if (!isRunnableModel(m)) { problems.push(`Model "${m.name}" tính giá theo token — không có giá cố định mỗi ảnh nên P4 không cho chạy (không đoán giá).`); continue; }
    totalPollen += m.pricePerImage * Math.max(1, c.count || 1);
  }
  return { ok: problems.length === 0, totalPollen: Math.round(totalPollen * 1e6) / 1e6, problems };
}
/**
 * Build the per-call plan shown in the pre-run confirmation + recorded in
 * run history. genNodes: [{nodeId, label}] of AI generation nodes in the run.
 */
export function describePlannedCalls(genNodes, provider, model) {
  return (genNodes || []).map(n => ({
    nodeId: n.nodeId, nodeLabel: n.label,
    providerId: provider.id, providerName: provider.name,
    modelId: model?.id || '', modelName: model?.name || '',
    costPollen: isRunnableModel(model) ? model.pricePerImage : null,
  }));
}

// ---------- zero-cost endpoints (connection test + balance; NO generation) ----------
export async function fetchModelCatalog(fetchFn = defaultFetch) {
  const res = await fetchFn(MODELS_ENDPOINT, { method: 'GET' });
  if (!res.ok) throw new Error('Không kết nối được tới Pollinations (HTTP ' + res.status + ') khi lấy danh mục model.');
  const data = await res.json();
  const list = Array.isArray(data) ? data : (data?.data || data?.models || []);
  return { ok: true, count: list.length, at: Date.now() };
}
export async function fetchBalance(key, fetchFn = defaultFetch) {
  if (!key) throw new Error('Chưa nhập API key cho phiên này.');
  const res = await fetchFn(BALANCE_ENDPOINT, { method: 'GET', headers: keyedHeaders(key) });
  if (!res.ok) throw new Error(pollinationsErrorMessage(res.status, 'keyed'));
  const data = await res.json().catch(() => ({}));
  const balance = typeof data?.balance === 'number' ? data.balance : (typeof data?.accountBalance?.total === 'number' ? data.accountBalance.total : null);
  return { ok: true, balance, raw: data, at: Date.now() };
}

// ---------- DEMO adapter (P1, unchanged contract) ----------
export class DemoAdapter {
  constructor(impl) { this.id = 'demo'; this.name = 'Demo (không kết nối AI)'; this.kind = 'demo'; this.isDemo = true; this.impl = impl; }
  capabilities() { return { imageGeneration: 'demo', imageVariation: 'demo', imageToVideo: 'demo-webm', real: false }; }
  async generateImage(req) { return this.impl.demoImage(req); }
  async variation(req) { return this.impl.demoVariation(req); }
  async imageToVideo(req, onProgress) { return this.impl.demoVideo(req, onProgress); }
}

// ---------- Pollinations Classic adapter (free, anonymous, zero-cost) ----------
export class PollinationsClassicAdapter {
  constructor({ fetchFn = defaultFetch } = {}) { this.id = 'pollinations-classic'; this.name = 'Pollinations Classic (miễn phí)'; this.kind = 'free'; this.isDemo = false; this.fetchFn = fetchFn; }
  capabilities() { return { imageGeneration: 'real', imageVariation: 'real-text-only', imageToVideo: 'demo-only', real: true }; }
  get configured() { return true; }
  async generateImage({ prompt, width = 768, height = 768, seed = -1 } = {}) {
    const url = buildClassicUrl({ prompt, width, height, seed });
    const res = await this.fetchFn(url, { method: 'GET' });
    if (!res.ok) throw new Error(pollinationsErrorMessage(res.status, 'free'));
    const blob = await res.blob();
    if (!blob || !/^image\//.test(blob.type || '')) throw new Error('Pollinations Classic không trả về file ảnh hợp lệ.');
    return { blob, mime: blob.type || 'image/jpeg', providerId: this.id, modelId: 'sana', costPollen: 0, label: 'AI THẬT — Pollinations Classic (miễn phí, model sana, ảnh có logo Pollinations) — ảnh do AI tạo, không phải ảnh sản phẩm thật' };
  }
  async imageToVideo() { throw new Error('P4 chưa hỗ trợ tạo video bằng AI thật — node video vẫn chạy chế độ DEMO (WebM từ canvas).'); }
  async testConnection() {
    try { const r = await fetchModelCatalog(this.fetchFn); return { ok: true, message: `Kết nối được tới Pollinations (kiểm tra 0 chi phí qua danh mục model): ${r.count} model đang được công bố · ${new Date(r.at).toLocaleTimeString('vi-VN')}.` }; }
    catch (e) { return { ok: false, message: 'Kiểm tra kết nối thất bại: ' + e.message }; }
  }
}

// ---------- Pollinations keyed adapter (unified API, prepaid Pollen) ----------
export class PollinationsKeyedAdapter {
  constructor({ model = 'flux', fetchFn = defaultFetch } = {}) { this.id = 'pollinations'; this.name = 'Pollinations (API key)'; this.kind = 'keyed'; this.isDemo = false; this.model = model; this.fetchFn = fetchFn; }
  capabilities() { return { imageGeneration: 'real', imageVariation: 'real', imageToVideo: 'demo-only', real: true }; }
  get configured() { return hasSessionKey(); }
  async generateImage({ prompt, width = 1024, height = 1024, seed = -1, imageUrl = '' } = {}) {
    const provider = providerById('pollinations'); const model = modelOf(provider, this.model);
    if (!model) throw new Error('Chưa chọn model Pollinations hợp lệ.');
    if (!isRunnableModel(model)) throw new Error(`Model "${model.name}" tính giá theo token — không có giá cố định mỗi ảnh nên P4 không cho chạy (không đoán giá). Hãy chọn flux / zimage / klein / kontext.`);
    if (!hasSessionKey()) throw new Error('Chưa nhập API key Pollinations cho phiên này (key chỉ giữ trong bộ nhớ, không lưu trữ).');
    if (imageUrl && !model.supportsImg2Img) throw new Error(`Model "${model.name}" không hỗ trợ ảnh tham chiếu (img2img). Hãy chọn klein/kontext hoặc bỏ ảnh tham chiếu.`);
    const url = buildKeyedImageUrl({ prompt, model: this.model, width, height, seed, imageUrl });
    const res = await this.fetchFn(url, { method: 'GET', headers: keyedHeaders(getSessionKey()) });
    if (!res.ok) throw new Error(pollinationsErrorMessage(res.status, 'keyed'));
    const blob = await res.blob();
    if (!blob || !/^image\//.test(blob.type || '')) throw new Error('Pollinations không trả về file ảnh hợp lệ.');
    return { blob, mime: blob.type || 'image/jpeg', providerId: this.id, modelId: this.model, costPollen: model.pricePerImage, label: `AI THẬT — Pollinations · model ${model.name} · ~${model.pricePerImage} Pollen/ảnh — ảnh do AI tạo, không phải ảnh sản phẩm thật` };
  }
  async imageToVideo() { throw new Error('P4 chưa hỗ trợ tạo video bằng AI thật — node video vẫn chạy chế độ DEMO (WebM từ canvas).'); }
  async testConnection() {
    try { const r = await fetchModelCatalog(this.fetchFn); return { ok: true, message: `Kết nối được tới Pollinations (kiểm tra 0 chi phí qua danh mục model): ${r.count} model đang được công bố · ${new Date(r.at).toLocaleTimeString('vi-VN')}. Kiểm tra này không kiểm chứng key — dùng nút "Kiểm tra số dư" để kiểm chứng key.` }; }
    catch (e) { return { ok: false, message: 'Kiểm tra kết nối thất bại: ' + e.message }; }
  }
  async checkBalance() { return fetchBalance(getSessionKey(), this.fetchFn); }
}

// ---------- Legacy HTTP/proxy stub (P1 behaviour preserved) ----------
export class HttpAdapter {
  // Gated stub for a real provider / proxy endpoint. Without endpoint + session
  // key it refuses to run — it never fabricates a result.
  constructor({ name = 'HTTP Provider', endpoint = '' } = {}) { this.id = 'http'; this.name = name; this.kind = 'http'; this.isDemo = false; this.endpoint = endpoint; }
  capabilities() { return { imageGeneration: 'http', imageVariation: 'http', imageToVideo: 'http', real: true }; }
  get configured() { return Boolean(this.endpoint && hasSessionKey()); }
  async request(path, body) {
    if (!this.endpoint) throw new Error('Chưa cấu hình endpoint cho provider. Xem docs/AI_STUDIO_PROVIDER_GUIDE.md.');
    if (!hasSessionKey()) throw new Error('Chưa nhập API key cho phiên này (key chỉ giữ trong bộ nhớ, không lưu trữ).');
    const res = await fetch(this.endpoint.replace(/\/$/, '') + path, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + sessionKey }, body: JSON.stringify(body) });
    if (!res.ok) throw new Error(`Provider trả lỗi HTTP ${res.status}.`);
    return res;
  }
  async generateImage() { throw new Error('Adapter HTTP đã sẵn sàng về hợp đồng nhưng ánh xạ payload của nhà cung cấp cụ thể chưa được cấu hình trong P1 — không có ảnh AI thật nào được tạo. Cấu hình proxy theo docs/AI_STUDIO_PROVIDER_GUIDE.md.'); }
  async variation() { throw new Error('Chưa cấu hình ánh xạ variation cho provider này (P1).'); }
  async imageToVideo() { throw new Error('Chưa cấu hình ánh xạ image-to-video cho provider này (P1).'); }
  async testConnection() {
    if (!this.endpoint) return { ok: false, message: 'Chưa nhập endpoint.' };
    if (!hasSessionKey()) return { ok: false, message: 'Chưa nhập API key cho phiên này.' };
    return { ok: false, message: 'P1 chưa gửi yêu cầu kiểm tra tới provider thật; adapter đã đủ điều kiện cấu hình (có endpoint + key phiên). Việc kiểm tra thật cần proxy/backend theo hướng dẫn.' };
  }
}
export function describeProvider(p) { return p.isDemo ? 'DEMO — chưa kết nối AI thật' : (p.configured ? 'Đã cấu hình endpoint + key phiên (chưa kiểm chứng với provider)' : 'Chưa cấu hình đầy đủ'); }
