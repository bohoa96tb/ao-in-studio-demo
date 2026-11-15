// AI Studio P4.4 unit tests — Cloudflare Workers AI via the owner's
// Worker Proxy (owner spec 2026-11-15). NO test in this file calls a
// real Worker: every network call goes through an injected mock fetch.
// The App Key (X-App-Key) is a session-memory secret, separate from the
// Pollinations key, and must never reach any persisted/exported shape.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  PROVIDERS, providerById, modelOf, isRunnableModel, isQuotaModel,
  resolveGenerationMode, suppressRetryForMode,
  estimateGenerationCost, describePlannedCalls,
  normalizeWorkerUrl, buildCfRunUrl, cloudflareErrorMessage, base64ToBlob, buildCfRequest,
  CloudflareAdapter, CF_MODEL_KLEIN, CF_MODEL_SCHNELL,
  setSessionKey, getSessionKey, clearSessionKey,
  setCfSessionKey, getCfSessionKey, hasCfSessionKey, clearCfSessionKey,
} from '../src/ai-studio/providers.js';
import { AI_STUDIO_BUILD, TEMPLATES } from '../src/ai-studio/core.js';

const WORKER = 'https://ai-proxy.test.workers.dev';
const PNG_B64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const PNG_BYTES = Buffer.from(PNG_B64, 'base64');
const pngBlob = () => new Blob([PNG_BYTES], { type: 'image/png' });
const jsonRes = (obj, status = 200) => ({ ok: status < 300, status, headers: { get: (h) => /content-type/i.test(h) ? 'application/json' : null }, json: async () => obj, text: async () => JSON.stringify(obj), blob: async () => { throw new Error('not binary'); } });
const binRes = (blob, ct = 'image/png', status = 200) => ({ ok: status < 300, status, headers: { get: (h) => /content-type/i.test(h) ? ct : null }, blob: async () => blob, text: async () => '', json: async () => { throw new Error('not json'); } });
const errRes = (status, bodyText) => ({ ok: false, status, headers: { get: () => 'application/json' }, text: async () => bodyText, blob: async () => new Blob([]), json: async () => { throw new Error('no json'); } });

// ---------- descriptor ----------
test('P4.4 descriptor: owner label, klein default first, quota-priced (NO invented money price)', () => {
  const cf = providerById('cloudflare');
  assert.ok(cf, 'cloudflare provider exists');
  assert.equal(cf.name, 'Cloudflare Workers AI — qua Worker Proxy (10.000 Neurons/ngày miễn phí)', 'owner-mandated panel label');
  assert.equal(cf.requiresKey, true);
  assert.equal(cf.models.length, 2);
  assert.equal(cf.models[0].id, CF_MODEL_KLEIN, 'klein is the default (first) model — recommended for the composition/img2img flow');
  assert.equal(cf.models[1].id, CF_MODEL_SCHNELL);
  const klein = modelOf(cf, CF_MODEL_KLEIN), schnell = modelOf(cf, CF_MODEL_SCHNELL);
  assert.equal(klein.supportsImg2Img, true);
  assert.equal(schnell.supportsImg2Img, false);
  for (const m of cf.models) {
    assert.equal(m.pricePerImage, null, m.id + ': no fabricated per-image money price');
    assert.equal(isQuotaModel(m), true, m.id + ' is quota-priced');
    assert.equal(isRunnableModel(m), false, m.id + ' must stay OUT of the Pollen runnable/cost machinery');
  }
  const ids = PROVIDERS.map(p => p.id);
  assert.equal(new Set(ids).size, ids.length, 'provider ids still unique with cloudflare added');
});

// ---------- URL hygiene ----------
test('P4.4 URL: trailing slashes + whitespace trimmed; run URL composes ${worker}/run/${model}', () => {
  assert.equal(normalizeWorkerUrl('https://ai-proxy.x.workers.dev/'), 'https://ai-proxy.x.workers.dev');
  assert.equal(normalizeWorkerUrl('https://ai-proxy.x.workers.dev///'), 'https://ai-proxy.x.workers.dev');
  assert.equal(normalizeWorkerUrl('  https://ai-proxy.x.workers.dev//  '), 'https://ai-proxy.x.workers.dev');
  assert.equal(normalizeWorkerUrl(''), '');
  assert.equal(buildCfRunUrl(WORKER + '///', CF_MODEL_KLEIN), WORKER + '/run/' + CF_MODEL_KLEIN);
  assert.equal(buildCfRunUrl(WORKER, CF_MODEL_SCHNELL), WORKER + '/run/' + CF_MODEL_SCHNELL);
});

// ---------- gating ----------
test('P4.4 gating: cloudflare needs switch + URL + App Key + risk confirmation; retries suppressed', () => {
  const base = { realEnabled: true, providerId: 'cloudflare', cfWorkerUrl: WORKER, hasCfKey: true, cfConfirmed: true };
  assert.equal(resolveGenerationMode(base).mode, 'cloudflare');
  assert.equal(resolveGenerationMode({ ...base, realEnabled: false }).mode, 'demo', 'master switch off -> demo');
  const noUrl = resolveGenerationMode({ ...base, cfWorkerUrl: '' });
  assert.equal(noUrl.mode, 'blocked'); assert.match(noUrl.reason, /Worker Proxy URL/);
  const noKey = resolveGenerationMode({ ...base, hasCfKey: false });
  assert.equal(noKey.mode, 'blocked'); assert.match(noKey.reason, /App Key \(X-App-Key\)/);
  const noConfirm = resolveGenerationMode({ ...base, cfConfirmed: false });
  assert.equal(noConfirm.mode, 'blocked'); assert.match(noConfirm.reason, /xác nhận/i);
  assert.equal(suppressRetryForMode('cloudflare'), true, 'real Cloudflare calls never auto-retry');
  // Pollinations gating is untouched by the new branch
  assert.equal(resolveGenerationMode({ realEnabled: true, providerId: 'pollinations-classic' }).mode, 'classic');
  assert.equal(resolveGenerationMode({ realEnabled: true, providerId: 'pollinations', hasKey: true, keyedConfirmed: true }).mode, 'keyed');
});

// ---------- cost planning: quota calls are 0 Pollen and never a "problem" ----------
test('P4.4 cost plan: Cloudflare calls contribute 0 Pollen, costPollen null in the plan (Neurons, not money)', () => {
  const est = estimateGenerationCost([{ providerId: 'cloudflare', modelId: CF_MODEL_KLEIN, count: 1 }, { providerId: 'pollinations', modelId: 'flux', count: 1 }]);
  assert.equal(est.ok, true, 'quota model must not be rejected as token-priced: ' + est.problems.join(' | '));
  assert.equal(est.totalPollen, 0.002, 'only the Pollinations call counts Pollen');
  const plan = describePlannedCalls([{ nodeId: 'n1', label: 'Tạo ảnh AI (DEMO)' }], providerById('cloudflare'), modelOf(providerById('cloudflare'), CF_MODEL_KLEIN));
  assert.equal(plan[0].costPollen, null, 'plan records NO Pollen figure for a Cloudflare call');
  assert.equal(plan[0].providerId, 'cloudflare'); assert.equal(plan[0].modelId, CF_MODEL_KLEIN);
});

// ---------- request shapes ----------
test('P4.4 schnell request: POST JSON {prompt, steps:4}, X-App-Key header only when a key exists', async () => {
  const withKey = await buildCfRequest({ workerUrl: WORKER + '/', model: CF_MODEL_SCHNELL, prompt: 'áo thun trơn', appKey: 'app_secret_1' });
  assert.equal(withKey.url, WORKER + '/run/' + CF_MODEL_SCHNELL);
  assert.equal(withKey.options.method, 'POST');
  assert.equal(withKey.options.headers['Content-Type'], 'application/json');
  assert.equal(withKey.options.headers['X-App-Key'], 'app_secret_1');
  assert.deepEqual(JSON.parse(withKey.options.body), { prompt: 'áo thun trơn', steps: 4 });
  const noKey = await buildCfRequest({ workerUrl: WORKER, model: CF_MODEL_SCHNELL, prompt: 'x', appKey: '' });
  assert.ok(!('X-App-Key' in noKey.options.headers), 'no key in session -> no X-App-Key header');
  assert.ok(!withKey.url.includes('app_secret_1'), 'the App Key must never appear in the URL');
});

test('P4.4 klein request (text only): multipart FormData with prompt, NO manual Content-Type, NO image fields', async () => {
  const r = await buildCfRequest({ workerUrl: WORKER, model: CF_MODEL_KLEIN, prompt: 'mẫu mặc áo trơn', appKey: 'k' });
  assert.equal(r.url, WORKER + '/run/' + CF_MODEL_KLEIN);
  assert.ok(r.options.body instanceof FormData, 'klein body is FormData');
  assert.equal(r.options.body.get('prompt'), 'mẫu mặc áo trơn');
  assert.equal(r.options.body.get('input_image_0'), null);
  assert.ok(!('Content-Type' in r.options.headers), 'browser must generate the multipart boundary — no manual Content-Type');
  assert.equal(r.options.headers['X-App-Key'], 'k');
});

test('P4.4 klein request (img2img): input_image_0 is a PNG named input_0.png; a second reference goes to input_image_1', async () => {
  const jpeg = new Blob([new Uint8Array([0xff, 0xd8, 0xff])], { type: 'image/jpeg' });
  const seen = [];
  const toPng = async (b) => { seen.push(b.type); return pngBlob(); };
  const r = await buildCfRequest({ workerUrl: WORKER, model: CF_MODEL_KLEIN, prompt: 'ghép hình', imageBlob: jpeg, imageBlob2: jpeg, appKey: 'k', toPng });
  assert.deepEqual(seen, ['image/jpeg', 'image/jpeg'], 'both inputs pass through the PNG converter');
  const f0 = r.options.body.get('input_image_0');
  assert.ok(f0, 'input_image_0 present');
  assert.equal(f0.name, 'input_0.png'); assert.equal(f0.type, 'image/png');
  const f1 = r.options.body.get('input_image_1');
  assert.ok(f1, 'input_image_1 present for the second reference');
  assert.equal(f1.name, 'input_1.png');
});

test('P4.4 schnell + image input -> Vietnamese guidance error, at BOTH builder and adapter level (fetch never called)', async () => {
  await assert.rejects(
    () => buildCfRequest({ workerUrl: WORKER, model: CF_MODEL_SCHNELL, prompt: 'x', imageBlob: pngBlob() }),
    (e) => /chỉ hỗ trợ tạo ảnh từ chữ/.test(e.message) && e.message.includes(CF_MODEL_KLEIN),
  );
  clearCfSessionKey(); setCfSessionKey('k');
  let calls = 0;
  const a = new CloudflareAdapter({ model: CF_MODEL_SCHNELL, workerUrl: WORKER, fetchFn: async () => { calls++; return binRes(pngBlob()); } });
  await assert.rejects(() => a.generateImage({ prompt: 'x', imageBlob: pngBlob() }), /chỉ hỗ trợ tạo ảnh từ chữ/);
  assert.equal(calls, 0, 'the guidance refusal happens BEFORE any request');
  clearCfSessionKey();
});

// ---------- adapter: response handling ----------
test('P4.4 adapter klein: JSON base64 at data.result.image AND data.image both decode to the image blob', async () => {
  setCfSessionKey('app_key_x');
  for (const shape of [{ result: { image: PNG_B64 } }, { image: PNG_B64 }]) {
    const a = new CloudflareAdapter({ model: CF_MODEL_KLEIN, workerUrl: WORKER, fetchFn: async () => jsonRes(shape) });
    const r = await a.generateImage({ prompt: 'áo trơn' });
    assert.equal(r.providerId, 'cloudflare'); assert.equal(r.modelId, CF_MODEL_KLEIN);
    assert.equal(r.costPollen, null, 'Cloudflare results carry NO Pollen figure');
    assert.equal(r.quota, 'neurons');
    assert.match(r.label, /AI THẬT — Cloudflare Workers AI/);
    assert.match(r.label, /Neurons/);
    assert.deepEqual(Buffer.from(await r.blob.arrayBuffer()), PNG_BYTES, 'base64 decoded byte-exact');
  }
  const noImg = new CloudflareAdapter({ model: CF_MODEL_KLEIN, workerUrl: WORKER, fetchFn: async () => jsonRes({ result: {} }) });
  await assert.rejects(() => noImg.generateImage({ prompt: 'x' }), /không thấy trường ảnh/);
  clearCfSessionKey();
});

test('P4.4 adapter: binary image + octet-stream responses pass through as blobs; schnell happy path works', async () => {
  setCfSessionKey('app_key_x');
  const bin = new CloudflareAdapter({ model: CF_MODEL_KLEIN, workerUrl: WORKER, fetchFn: async () => binRes(pngBlob(), 'image/png') });
  const r1 = await bin.generateImage({ prompt: 'x' });
  assert.deepEqual(Buffer.from(await r1.blob.arrayBuffer()), PNG_BYTES);
  const oct = new CloudflareAdapter({ model: CF_MODEL_KLEIN, workerUrl: WORKER, fetchFn: async () => binRes(pngBlob(), 'application/octet-stream') });
  const r2 = await oct.generateImage({ prompt: 'x', imageBlob: pngBlob() });
  assert.match(r2.label, /img2img/);
  let seen = null;
  const sch = new CloudflareAdapter({ model: CF_MODEL_SCHNELL, workerUrl: WORKER, fetchFn: async (url, opts) => { seen = { url, opts }; return binRes(pngBlob(), 'image/png'); } });
  const r3 = await sch.generateImage({ prompt: 'áo trơn trắng' });
  assert.equal(r3.modelId, CF_MODEL_SCHNELL);
  assert.deepEqual(JSON.parse(seen.opts.body), { prompt: 'áo trơn trắng', steps: 4 });
  assert.equal(seen.opts.headers['X-App-Key'], 'app_key_x');
  clearCfSessionKey();
});

test('P4.4 adapter guards: no URL / no App Key refuse before any request', async () => {
  clearCfSessionKey();
  let calls = 0; const fetchFn = async () => { calls++; return binRes(pngBlob()); };
  const noUrl = new CloudflareAdapter({ model: CF_MODEL_KLEIN, workerUrl: '', fetchFn });
  await assert.rejects(() => noUrl.generateImage({ prompt: 'x' }), /Worker Proxy URL/);
  const noKey = new CloudflareAdapter({ model: CF_MODEL_KLEIN, workerUrl: WORKER, fetchFn });
  await assert.rejects(() => noKey.generateImage({ prompt: 'x' }), /App Key \(X-App-Key\)/);
  assert.equal(calls, 0);
});

// ---------- adapter: error mapping ----------
test('P4.4 error mapping: 401 key, 400 bad request, network/CORS, other statuses — Vietnamese, with Worker detail', async () => {
  assert.match(cloudflareErrorMessage(401), /^Sai khóa X-App-Key trên Worker/);
  assert.match(cloudflareErrorMessage(400), /^Dữ liệu gửi lên hoặc đường dẫn model không hợp lệ/);
  assert.match(cloudflareErrorMessage(0), /^Không kết nối được Worker URL, kiểm tra lại đường dẫn \.workers\.dev/);
  setCfSessionKey('k');
  const a401 = new CloudflareAdapter({ model: CF_MODEL_KLEIN, workerUrl: WORKER, fetchFn: async () => errRes(401, JSON.stringify({ errors: [{ message: 'bad app key' }] })) });
  await assert.rejects(() => a401.generateImage({ prompt: 'x' }), (e) => /Sai khóa X-App-Key trên Worker/.test(e.message) && e.message.includes('bad app key'));
  const a400 = new CloudflareAdapter({ model: CF_MODEL_KLEIN, workerUrl: WORKER, fetchFn: async () => errRes(400, 'unknown model route') });
  await assert.rejects(() => a400.generateImage({ prompt: 'x' }), (e) => /Dữ liệu gửi lên hoặc đường dẫn model không hợp lệ/.test(e.message) && e.message.includes('unknown model route'));
  const aNet = new CloudflareAdapter({ model: CF_MODEL_KLEIN, workerUrl: WORKER, fetchFn: async () => { throw new TypeError('Failed to fetch'); } });
  await assert.rejects(() => aNet.generateImage({ prompt: 'x' }), /Không kết nối được Worker URL, kiểm tra lại đường dẫn \.workers\.dev/);
  const a500 = new CloudflareAdapter({ model: CF_MODEL_KLEIN, workerUrl: WORKER, fetchFn: async () => errRes(500, 'boom') });
  await assert.rejects(() => a500.generateImage({ prompt: 'x' }), /HTTP 500/);
  clearCfSessionKey();
});

test('P4.4 base64ToBlob: whitespace-tolerant, empty/invalid base64 errors honestly', async () => {
  const b = base64ToBlob('  ' + PNG_B64.slice(0, 20) + '\n' + PNG_B64.slice(20));
  assert.deepEqual(Buffer.from(await b.arrayBuffer()), PNG_BYTES);
  assert.throws(() => base64ToBlob(''), /rỗng/);
  assert.throws(() => base64ToBlob('%%%not-base64%%%'), /không hợp lệ/);
});

// ---------- key hygiene ----------
test('P4.4 key hygiene: the two session keys are independent module-memory secrets', () => {
  clearSessionKey(); clearCfSessionKey();
  setSessionKey('sk_pollinations_secret');
  setCfSessionKey('cf_app_secret');
  assert.equal(getSessionKey(), 'sk_pollinations_secret');
  assert.equal(getCfSessionKey(), 'cf_app_secret');
  clearSessionKey();
  assert.equal(hasCfSessionKey(), true, 'clearing the Pollinations key must not clear the Cloudflare key');
  clearCfSessionKey();
  assert.equal(hasCfSessionKey(), false);
});

test('P4.4 key hygiene: keys cannot leak into a serialised project, and no persistence API touches them', () => {
  setSessionKey('sk_pollinations_secret'); setCfSessionKey('cf_app_secret');
  const tpl1 = TEMPLATES.find(t => t.id === 'tpl1').make();
  const serialised = JSON.stringify(tpl1);
  assert.ok(!serialised.includes('cf_app_secret') && !serialised.includes('sk_pollinations_secret'), 'project/template JSON contains no session key');
  // Source-level guard: the persistence layer never imports the provider
  // secrets, and no ai-studio source writes to localStorage at all.
  const storeSrc = readFileSync(new URL('../src/ai-studio/store.js', import.meta.url), 'utf8');
  assert.ok(!/providers\.js/.test(storeSrc), 'store.js (IndexedDB) must not import providers.js');
  for (const f of ['providers.js', 'studio.js', 'store.js', 'core.js', 'p2.js', 'engine.js', 'warp.js']) {
    const src = readFileSync(new URL('../src/ai-studio/' + f, import.meta.url), 'utf8');
    assert.ok(!/localStorage\.setItem/.test(src), f + ' must never write localStorage');
  }
  clearSessionKey(); clearCfSessionKey();
});

// ---------- build marker ----------
test('P4.4 build marker — AI_STUDIO_BUILD is p44 (or a later bump)', () => {
  assert.ok(AI_STUDIO_BUILD === 'p44' || AI_STUDIO_BUILD === 'p45', 'marker is p44 or a later bump, got ' + AI_STUDIO_BUILD);
});
