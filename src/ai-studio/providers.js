// AI Studio — Provider Adapter architecture (brief §9).
// Contract: an adapter exposes {name, kind, isDemo, capabilities(), generateImage(),
// imageToVideo()}. Workflow Engine only knows this contract, never a vendor.
//
// SECURITY: API keys are held ONLY in a module-level in-memory variable for the
// current page session (set via setSessionKey). They are NEVER written to
// IndexedDB, localStorage, git, project files or ZIP exports. Calling a provider
// directly from the browser exposes the key to anyone inspecting the page —
// a backend proxy/serverless endpoint is the recommended production route.

let sessionKey = ''; // memory only, cleared on reload
export function setSessionKey(k) { sessionKey = String(k || ''); }
export function hasSessionKey() { return sessionKey.length > 0; }
export function clearSessionKey() { sessionKey = ''; }

export const BROWSER_KEY_WARNING = 'Cảnh báo: gọi API trực tiếp từ trình duyệt sẽ lộ API key cho bất kỳ ai xem mã trang. Chỉ dùng key giới hạn (quota thấp) để thử nghiệm; khi vận hành thật hãy dùng backend proxy/serverless. Key chỉ giữ trong bộ nhớ phiên này, không lưu vào IndexedDB/localStorage/file xuất.';

export class DemoAdapter {
  constructor(impl) { this.name = 'Demo (không kết nối AI)'; this.kind = 'demo'; this.isDemo = true; this.impl = impl; }
  capabilities() { return { imageGeneration: 'demo', imageVariation: 'demo', imageToVideo: 'demo-webm', real: false }; }
  async generateImage(req) { return this.impl.demoImage(req); }
  async variation(req) { return this.impl.demoVariation(req); }
  async imageToVideo(req, onProgress) { return this.impl.demoVideo(req, onProgress); }
}

export class HttpAdapter {
  // Gated stub for a real provider / proxy endpoint. Without endpoint + session
  // key it refuses to run — it never fabricates a result.
  constructor({ name = 'HTTP Provider', endpoint = '' } = {}) { this.name = name; this.kind = 'http'; this.isDemo = false; this.endpoint = endpoint; }
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
