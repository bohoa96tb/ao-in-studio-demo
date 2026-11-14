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

// P4.4 — the Cloudflare Worker Proxy App Key (header X-App-Key) is a
// SEPARATE session secret from the Pollinations key: same rule (module
// memory only, cleared on reload, NEVER persisted or exported), never
// mixed — a Pollinations key must never leak into an X-App-Key header
// or vice versa.
let sessionCfKey = ''; // memory only, cleared on reload
export function setCfSessionKey(k) { sessionCfKey = String(k || ''); }
export function hasCfSessionKey() { return sessionCfKey.length > 0; }
export function getCfSessionKey() { return sessionCfKey; }
export function clearCfSessionKey() { sessionCfKey = ''; }

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
    // P4.4 — Cloudflare Workers AI via the owner's OWN Worker Proxy. The
    // models publish NO per-image money price: they consume the Cloudflare
    // account's Neuron quota (free tier 10,000 Neurons/day), so they are
    // `quotaPriced` (pricePerImage stays null — never invent a price) and
    // are gated separately from the Pollen machinery.
    id: 'cloudflare', name: 'Cloudflare Workers AI — qua Worker Proxy (10.000 Neurons/ngày miễn phí)', kind: 'cloudflare', requiresKey: true,
    models: [
      { id: '@cf/black-forest-labs/flux-2-klein-4b', name: 'FLUX.2 Klein 4B — ghép/sửa ảnh (img2img) & tạo từ chữ · khuyên dùng cho node ghép hình', pricePerImage: null, quotaPriced: true, supportsImg2Img: true },
      { id: '@cf/black-forest-labs/flux-1-schnell', name: 'FLUX.1 Schnell — chỉ tạo ảnh từ chữ (text2img), nhanh, 4 bước', pricePerImage: null, quotaPriced: true, supportsImg2Img: false },
    ],
    limits: 'Gọi qua Worker Proxy của CHÍNH BẠN (Worker kiểm tra header X-App-Key). Mỗi lệnh gọi trừ vào hạn mức Neurons của tài khoản Cloudflare gắn với Worker — gói miễn phí 10.000 Neurons/ngày; Studio không biết số Neurons chính xác mỗi model trừ (tùy model + kích thước ảnh) nên KHÔNG hiển thị giá tiền. FLUX.2 Klein nhận ảnh đầu vào tải trực tiếp lên Worker của bạn (img2img); FLUX.1 Schnell chỉ tạo từ chữ.',
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
/** P4.4: Cloudflare models are quota-priced (Neurons), not Pollen-priced —
 * selectable and runnable, but they must never enter the Pollen cost math. */
export function isQuotaModel(model) { return !!model && model.quotaPriced === true; }

// ---------- mode gating (pure — unit-tested) ----------
/**
 * Decide what an AI generation node may do, given the UI state.
 * Returns {mode:'demo'|'classic'|'keyed'|'http'|'blocked', reason}.
 * The master switch defaults OFF → 'demo'. The keyed provider is usable
 * only with a session key AND the user's explicit in-panel confirmation.
 */
export function resolveGenerationMode({ realEnabled = false, providerId = 'demo', hasKey = false, keyedConfirmed = false, cfWorkerUrl = '', hasCfKey = false, cfConfirmed = false } = {}) {
  if (providerId === 'http') return { mode: 'http', reason: '' }; // legacy gated stub — it can only error, never generate
  if (!realEnabled || providerId === 'demo') return { mode: 'demo', reason: '' };
  if (providerId === 'pollinations-classic') return { mode: 'classic', reason: '' };
  if (providerId === 'pollinations') {
    if (!hasKey) return { mode: 'blocked', reason: 'Chưa nhập API key Pollinations cho phiên này — provider có key đang bị khóa. Nhập key (chỉ giữ trong bộ nhớ phiên) trong bảng Nhà cung cấp AI, hoặc tắt chế độ AI thật để chạy DEMO.' };
    if (!keyedConfirmed) return { mode: 'blocked', reason: 'Chưa xác nhận bật provider Pollinations (key) trong bảng Nhà cung cấp AI — vì lý do an toàn chi phí, provider này chỉ chạy khi bạn tích "Tôi hiểu rủi ro…" và mỗi lượt chạy tốn Pollen đều phải xác nhận chi phí trước.' };
    return { mode: 'keyed', reason: '' };
  }
  if (providerId === 'cloudflare') {
    // P4.4 — mirrors the keyed Pollinations gate, with the Worker URL as
    // an extra required piece of session configuration.
    if (!normalizeWorkerUrl(cfWorkerUrl)) return { mode: 'blocked', reason: 'Chưa nhập Worker Proxy URL cho provider Cloudflare — nhập địa chỉ Worker của bạn (dạng https://ai-proxy.<subdomain>.workers.dev) trong bảng Nhà cung cấp AI, hoặc tắt chế độ AI thật để chạy DEMO.' };
    if (!hasCfKey) return { mode: 'blocked', reason: 'Chưa nhập App Key (X-App-Key) cho phiên này — provider Cloudflare đang bị khóa. Nhập App Key (chỉ giữ trong bộ nhớ phiên) trong bảng Nhà cung cấp AI, hoặc tắt chế độ AI thật để chạy DEMO.' };
    if (!cfConfirmed) return { mode: 'blocked', reason: 'Chưa xác nhận bật provider Cloudflare trong bảng Nhà cung cấp AI — provider này chỉ chạy khi bạn tích "Tôi hiểu rủi ro…" và mỗi lượt chạy dùng hạn mức Neurons đều phải xác nhận trước.' };
    return { mode: 'cloudflare', reason: '' };
  }
  return { mode: 'demo', reason: '' };
}
/** Real-provider calls must NEVER auto-retry (a retry could double-spend). */
export function suppressRetryForMode(mode) { return mode === 'classic' || mode === 'keyed' || mode === 'cloudflare'; }

// ---------- size mapping (pure) ----------
export function clampClassicSize(w, h) {
  w = Math.max(64, Math.round(w) || 768); h = Math.max(64, Math.round(h) || 768);
  const s = Math.min(1, 768 / w, 768 / h);
  return { w: Math.max(64, Math.floor(w * s)), h: Math.max(64, Math.floor(h * s)) };
}
export function sizeForRatio(ratio, kind) {
  // P4.3: '2:3' is the catalog (Template 1) request class — the tallest
  // portrait each adapter legitimately supports at its quality tier:
  // keyed 1024×1536; Classic 512×768 (2:3 inside its ≤768 cap, never
  // above it — sana often ignores the requested size anyway, and the
  // tightened framing guard in warp.js is what judges the OUTPUT).
  const table = kind === 'free'
    ? { '4:5': [614, 768], '2:3': [512, 768], '1:1': [768, 768], '9:16': [432, 768], '16:9': [768, 432] }
    : { '4:5': [1024, 1280], '2:3': [1024, 1536], '1:1': [1024, 1024], '9:16': [720, 1280], '16:9': [1280, 720] };
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
    if (isQuotaModel(m)) continue; // P4.4: Cloudflare consumes Neuron quota, not Pollen — 0 Pollen, never a problem, never a guessed price
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

// ---------- Cloudflare Workers AI via Worker Proxy (P4.4) ----------
// The owner's Worker Proxy is pre-configured at `${workerUrl}/run/${model}`
// (POST, checks the X-App-Key header). Workers AI answers either JSON with
// a base64 image (data.result.image or data.image) or the image binary
// directly, depending on the model — both shapes are handled. Unlike
// Pollinations, img2img uploads the input image DIRECTLY to the owner's
// own Worker (multipart form) — that direct-upload capability is
// Cloudflare-only here; the Pollinations honest img2img error is unchanged.
export const CF_MODEL_KLEIN = '@cf/black-forest-labs/flux-2-klein-4b';
export const CF_MODEL_SCHNELL = '@cf/black-forest-labs/flux-1-schnell';

/** Worker URL hygiene (owner spec): trim whitespace and trailing slashes. */
export function normalizeWorkerUrl(u) { return String(u || '').trim().replace(/\/+$/, ''); }
export function buildCfRunUrl(workerUrl, model) { return `${normalizeWorkerUrl(workerUrl)}/run/${model}`; }

/** Cloudflare/Worker error → honest Vietnamese message (pure). `status` 0
 * means the request never reached the Worker (network/CORS failure). */
export function cloudflareErrorMessage(status, detail = '') {
  const d = detail ? ` Chi tiết từ Worker: ${detail}` : '';
  if (status === 0) return 'Không kết nối được Worker URL, kiểm tra lại đường dẫn .workers.dev (lỗi mạng hoặc CORS — Worker chưa nhận được yêu cầu).';
  if (status === 401 || status === 403) return `Sai khóa X-App-Key trên Worker (HTTP ${status}) — App Key đã nhập cho phiên này không khớp APP_KEY bảo vệ Worker.${d}`;
  if (status === 400) return `Dữ liệu gửi lên hoặc đường dẫn model không hợp lệ (HTTP 400).${d}`;
  if (status === 429) return `Worker/Cloudflare báo vượt hạn mức tạm thời (HTTP 429) — hạn mức miễn phí là 10.000 Neurons/ngày. Đợi rồi chạy lại; hệ thống không tự thử lại lệnh gọi AI thật.${d}`;
  return `Worker Proxy trả lỗi HTTP ${status}.${d}`;
}

/** Base64 (possibly whitespace-wrapped) → image Blob (pure). */
export function base64ToBlob(b64, mime = 'image/png') {
  const clean = String(b64 || '').replace(/\s/g, '');
  if (!clean) throw new Error('Worker trả chuỗi base64 rỗng — không có dữ liệu ảnh.');
  let bin;
  try { bin = atob(clean); } catch { throw new Error('Worker trả base64 không hợp lệ — không giải mã được ảnh.'); }
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

/**
 * Build the Worker Proxy request for one generation (pure — unit-tested).
 * schnell: JSON {prompt, steps:4} + Content-Type application/json; having
 * an input image is an honest Vietnamese guidance error (never a silent
 * downgrade). klein: multipart FormData (prompt, input_image_0 as PNG,
 * optional input_image_1) and NO manual Content-Type — the browser must
 * generate the multipart boundary itself.
 */
export async function buildCfRequest({ workerUrl, model, prompt, imageBlob = null, imageBlob2 = null, appKey = '', toPng = null } = {}) {
  const url = buildCfRunUrl(workerUrl, model);
  const headers = {};
  if (appKey) headers['X-App-Key'] = appKey;
  if (model === CF_MODEL_SCHNELL) {
    if (imageBlob) throw new Error(`Model ${CF_MODEL_SCHNELL} chỉ hỗ trợ tạo ảnh từ chữ (text-to-image), không nhận ảnh đầu vào (img2img). Hãy chuyển model sang ${CF_MODEL_KLEIN} trong bảng Nhà cung cấp AI để ghép/sửa ảnh với ảnh đầu vào.`);
    headers['Content-Type'] = 'application/json';
    return { url, options: { method: 'POST', headers, body: JSON.stringify({ prompt: String(prompt || ''), steps: 4 }) } };
  }
  // FLUX.2 Klein (and any future CF model): multipart/form-data.
  const form = new FormData();
  form.append('prompt', String(prompt || ''));
  if (imageBlob) {
    const png = toPng ? await toPng(imageBlob) : imageBlob;
    form.append('input_image_0', png, 'input_0.png');
    if (imageBlob2) {
      const png2 = toPng ? await toPng(imageBlob2) : imageBlob2;
      form.append('input_image_1', png2, 'input_1.png');
    }
  }
  return { url, options: { method: 'POST', headers, body: form } };
}

/** Read a Worker error body (JSON or text) into a short detail string. */
async function cfErrorDetail(res) {
  try {
    const t = await res.text();
    if (!t) return '';
    try { const j = JSON.parse(t); const s = j?.errors?.[0]?.message || j?.error?.message || j?.message || j?.error || ''; return String(s || t).slice(0, 300); }
    catch { return t.slice(0, 300); }
  } catch { return ''; }
}

export class CloudflareAdapter {
  constructor({ model = CF_MODEL_KLEIN, workerUrl = '', fetchFn = defaultFetch, toPng = null } = {}) {
    this.id = 'cloudflare'; this.name = 'Cloudflare Workers AI (Worker Proxy)'; this.kind = 'cloudflare'; this.isDemo = false;
    this.model = model; this.workerUrl = workerUrl; this.fetchFn = fetchFn; this.toPng = toPng;
  }
  capabilities() { return { imageGeneration: 'real', imageVariation: 'real', imageToVideo: 'demo-only', real: true }; }
  get configured() { return Boolean(normalizeWorkerUrl(this.workerUrl) && hasCfSessionKey()); }
  async generateImage({ prompt, imageBlob = null, imageBlob2 = null } = {}) {
    const provider = providerById('cloudflare'); const model = modelOf(provider, this.model);
    if (!model) throw new Error('Chưa chọn model Cloudflare hợp lệ.');
    if (!normalizeWorkerUrl(this.workerUrl)) throw new Error('Chưa nhập Worker Proxy URL cho provider Cloudflare (bảng Nhà cung cấp AI).');
    if (!hasCfSessionKey()) throw new Error('Chưa nhập App Key (X-App-Key) cho phiên này (key chỉ giữ trong bộ nhớ, không lưu trữ).');
    if (imageBlob && !model.supportsImg2Img) {
      // Schnell + an input image: fail BEFORE any request, with guidance.
      throw new Error(`Model ${this.model} chỉ hỗ trợ tạo ảnh từ chữ (text-to-image), không nhận ảnh đầu vào (img2img). Hãy chuyển model sang ${CF_MODEL_KLEIN} trong bảng Nhà cung cấp AI để ghép/sửa ảnh với ảnh đầu vào.`);
    }
    const { url, options } = await buildCfRequest({ workerUrl: this.workerUrl, model: this.model, prompt, imageBlob, imageBlob2, appKey: getCfSessionKey(), toPng: this.toPng });
    let res;
    try { res = await this.fetchFn(url, options); }
    catch { throw new Error(cloudflareErrorMessage(0)); }
    if (!res.ok) throw new Error(cloudflareErrorMessage(res.status, await cfErrorDetail(res)));
    const ct = (res.headers?.get?.('content-type') || '').toLowerCase();
    let blob;
    if (ct.includes('application/json')) {
      const data = await res.json().catch(() => null);
      const b64 = data?.result?.image || data?.image;
      if (!b64) throw new Error('Worker trả JSON nhưng không thấy trường ảnh (result.image hoặc image) — kiểm tra lại Worker Proxy, Studio không đoán định dạng khác.');
      blob = base64ToBlob(b64, 'image/png');
    } else if (ct.startsWith('image/') || ct.includes('application/octet-stream')) {
      blob = await res.blob();
    } else {
      throw new Error(`Worker trả định dạng không nhận dạng được (Content-Type: ${ct || 'trống'}) — Studio chỉ nhận JSON chứa base64 hoặc file ảnh trực tiếp.`);
    }
    if (!blob || !blob.size) throw new Error('Worker không trả về dữ liệu ảnh hợp lệ (rỗng).');
    const img2img = Boolean(imageBlob);
    return {
      blob, mime: blob.type || 'image/png', providerId: this.id, modelId: this.model, costPollen: null, quota: 'neurons',
      label: `AI THẬT — Cloudflare Workers AI · model ${this.model}${img2img ? ' · img2img (ảnh đầu vào tải thẳng lên Worker Proxy của bạn)' : ''} · dùng hạn mức Neurons của tài khoản Cloudflare (miễn phí 10.000 Neurons/ngày) — ảnh do AI tạo, không phải ảnh sản phẩm thật`,
    };
  }
  async imageToVideo() { throw new Error('Chưa hỗ trợ tạo video bằng AI thật — node video vẫn chạy chế độ DEMO (WebM từ canvas).'); }
  async testConnection() {
    // There is NO zero-cost check endpoint on the Worker Proxy — every
    // call to /run/ is a real generation. Report configuration state
    // honestly WITHOUT sending anything.
    if (!normalizeWorkerUrl(this.workerUrl)) return { ok: false, message: 'Chưa nhập Worker Proxy URL — chưa kiểm tra được gì, và Studio không gọi thử (mọi lệnh gọi tới Worker đều là tạo ảnh thật).' };
    if (!hasCfSessionKey()) return { ok: false, message: 'Đã có Worker URL nhưng chưa nhập App Key (X-App-Key) cho phiên này — Studio không gọi thử Worker (mọi lệnh gọi đều là tạo ảnh thật, không có endpoint kiểm tra 0 chi phí).' };
    return { ok: true, message: 'Đã đủ cấu hình trong phiên (Worker URL + App Key). Studio KHÔNG gọi thử Worker để kiểm tra vì mọi lệnh gọi /run/ đều là tạo ảnh thật trừ hạn mức Neurons — hãy chạy 1 node AI để kiểm chứng thật.' };
  }
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
