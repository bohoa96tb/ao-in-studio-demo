// AI Studio P4 unit tests — Provider Adapter + Pollinations (cost-controlled).
// NO test in this file calls a real generation endpoint: every network call
// goes through an injected mock fetch. The only real endpoint shape used is
// the zero-cost model catalog / balance JSON, also mocked here.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PROVIDERS, providerById, modelOf, isRunnableModel,
  resolveGenerationMode, suppressRetryForMode,
  clampClassicSize, sizeForRatio, buildClassicUrl, buildKeyedImageUrl, keyedHeaders,
  pollinationsErrorMessage, estimateGenerationCost, describePlannedCalls,
  fetchModelCatalog, fetchBalance,
  PollinationsClassicAdapter, PollinationsKeyedAdapter,
  setSessionKey, clearSessionKey,
} from '../src/ai-studio/providers.js';

test('P4 descriptors: unique provider ids, sane prices, classic free + keyless, keyed requires key', () => {
  const ids = PROVIDERS.map(p => p.id);
  assert.equal(new Set(ids).size, ids.length, 'provider ids unique');
  for (const p of PROVIDERS) {
    const mids = p.models.map(m => m.id);
    assert.equal(new Set(mids).size, mids.length, `${p.id} model ids unique`);
    for (const m of p.models) assert.ok(m.pricePerImage === null || m.pricePerImage >= 0, `${p.id}/${m.id} price >= 0 or null`);
  }
  const classic = providerById('pollinations-classic');
  assert.equal(classic.kind, 'free'); assert.equal(classic.requiresKey, false);
  assert.equal(classic.models.length, 1); assert.equal(classic.models[0].id, 'sana');
  assert.equal(classic.models[0].pricePerImage, 0, 'classic price exactly 0');
  const keyed = providerById('pollinations');
  assert.equal(keyed.kind, 'keyed'); assert.equal(keyed.requiresKey, true);
});

test('P4 descriptors: flat-rate keyed models runnable; token-priced models NOT runnable', () => {
  const keyed = providerById('pollinations');
  for (const [id, price] of [['flux', 0.002], ['zimage', 0.004], ['klein', 0.005], ['kontext', 0.03]]) {
    const m = modelOf(keyed, id);
    assert.ok(m, id); assert.equal(m.pricePerImage, price, id); assert.equal(isRunnableModel(m), true, id);
  }
  for (const id of ['gptimage', 'nanobanana']) {
    const m = modelOf(keyed, id);
    assert.ok(m, id); assert.equal(m.pricePerImage, null, id); assert.equal(m.tokenPriced, true, id);
    assert.equal(isRunnableModel(m), false, id + ' must not be runnable in P4');
  }
  assert.equal(modelOf(keyed, 'klein').supportsImg2Img, true);
  assert.equal(modelOf(keyed, 'flux').supportsImg2Img, false);
});

test('P4 classic URL builder: encodes prompt, forces model=sana, clamps to 768', () => {
  const u = buildClassicUrl({ prompt: 'áo thun đẹp & rẻ', width: 1024, height: 1024, seed: 7 });
  assert.ok(u.startsWith('https://image.pollinations.ai/prompt/'), u);
  assert.ok(u.includes(encodeURIComponent('áo thun đẹp & rẻ')), 'prompt url-encoded');
  assert.ok(u.includes('model=sana')); assert.ok(u.includes('width=768')); assert.ok(u.includes('height=768')); assert.ok(u.includes('seed=7'));
  assert.deepEqual(clampClassicSize(1024, 512), { w: 768, h: 384 });
  assert.deepEqual(clampClassicSize(400, 300), { w: 400, h: 300 });
  assert.deepEqual(sizeForRatio('9:16', 'free'), { w: 432, h: 768 });
});

test('P4 keyed URL + headers builders', () => {
  const u = buildKeyedImageUrl({ prompt: 'a cat', model: 'klein', width: 1024, height: 1280, seed: -1 });
  assert.ok(u.startsWith('https://gen.pollinations.ai/image/a%20cat'), u);
  assert.ok(u.includes('model=klein')); assert.ok(u.includes('width=1024')); assert.ok(u.includes('height=1280'));
  assert.ok(!u.includes('key='), 'secret key must never be put in a URL');
  assert.deepEqual(keyedHeaders('sk_test'), { Authorization: 'Bearer sk_test' });
});

test('P4 gating: master switch off -> demo; classic free; keyed needs key + explicit confirmation; http stays the legacy stub', () => {
  assert.equal(resolveGenerationMode({}).mode, 'demo');
  assert.equal(resolveGenerationMode({ realEnabled: false, providerId: 'pollinations-classic' }).mode, 'demo');
  assert.equal(resolveGenerationMode({ realEnabled: true, providerId: 'demo' }).mode, 'demo');
  assert.equal(resolveGenerationMode({ realEnabled: true, providerId: 'pollinations-classic' }).mode, 'classic');
  const noKey = resolveGenerationMode({ realEnabled: true, providerId: 'pollinations', hasKey: false, keyedConfirmed: true });
  assert.equal(noKey.mode, 'blocked'); assert.match(noKey.reason, /chưa nhập API key/i);
  const noConfirm = resolveGenerationMode({ realEnabled: true, providerId: 'pollinations', hasKey: true, keyedConfirmed: false });
  assert.equal(noConfirm.mode, 'blocked'); assert.match(noConfirm.reason, /xác nhận/i);
  assert.equal(resolveGenerationMode({ realEnabled: true, providerId: 'pollinations', hasKey: true, keyedConfirmed: true }).mode, 'keyed');
  assert.equal(resolveGenerationMode({ realEnabled: false, providerId: 'http' }).mode, 'http');
});

test('P4 retry suppression: real calls never auto-retry, demo/http unchanged', () => {
  assert.equal(suppressRetryForMode('classic'), true);
  assert.equal(suppressRetryForMode('keyed'), true);
  assert.equal(suppressRetryForMode('demo'), false);
  assert.equal(suppressRetryForMode('http'), false);
  assert.equal(suppressRetryForMode('blocked'), false);
});

test('P4 cost estimator: sums flat prices, classic is 0, token-priced and unknown are rejected (never guessed)', () => {
  const ok = estimateGenerationCost([
    { providerId: 'pollinations', modelId: 'flux', count: 2 },
    { providerId: 'pollinations', modelId: 'kontext', count: 1 },
    { providerId: 'pollinations-classic', modelId: 'sana', count: 3 },
  ]);
  assert.equal(ok.ok, true); assert.equal(ok.totalPollen, 0.034);
  const token = estimateGenerationCost([{ providerId: 'pollinations', modelId: 'gptimage', count: 1 }]);
  assert.equal(token.ok, false); assert.match(token.problems[0], /theo token/);
  const unknown = estimateGenerationCost([{ providerId: 'pollinations', modelId: 'khong-co', count: 1 }]);
  assert.equal(unknown.ok, false);
  const plan = describePlannedCalls([{ nodeId: 'n1', label: 'Tạo ảnh AI (DEMO)' }], providerById('pollinations'), modelOf(providerById('pollinations'), 'flux'));
  assert.equal(plan.length, 1); assert.equal(plan[0].costPollen, 0.002); assert.equal(plan[0].providerId, 'pollinations');
});

test('P4 error mapping: 401 key, 402 balance/limit, 429 overload — Vietnamese and honest', () => {
  assert.match(pollinationsErrorMessage(401, 'keyed'), /401/);
  assert.match(pollinationsErrorMessage(402, 'keyed'), /Hết Pollen/);
  assert.match(pollinationsErrorMessage(402, 'free'), /hạn mức miễn phí/);
  assert.match(pollinationsErrorMessage(429, 'free'), /429/);
});

const jpegBlob = () => new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], { type: 'image/jpeg' });

test('P4 classic adapter (mocked fetch): returns image blob at cost 0; 402 surfaces the limit, no silent fallback', async () => {
  let seenUrl = '';
  const okFetch = async (url) => { seenUrl = url; return { ok: true, status: 200, blob: async () => jpegBlob() }; };
  const a = new PollinationsClassicAdapter({ fetchFn: okFetch });
  const r = await a.generateImage({ prompt: 'áo thun', width: 2000, height: 2000 });
  assert.equal(r.costPollen, 0); assert.equal(r.modelId, 'sana'); assert.match(r.label, /AI THẬT/);
  assert.ok(seenUrl.includes('width=768'), 'request clamped to 768: ' + seenUrl);
  const limited = new PollinationsClassicAdapter({ fetchFn: async () => ({ ok: false, status: 402, blob: async () => new Blob([]) }) });
  await assert.rejects(() => limited.generateImage({ prompt: 'x' }), /402/);
});

test('P4 keyed adapter (mocked fetch): no key -> refuse; token model -> refuse; flux sends Authorization header and reports its price', async () => {
  clearSessionKey();
  const noKey = new PollinationsKeyedAdapter({ model: 'flux', fetchFn: async () => { throw new Error('must not be called'); } });
  await assert.rejects(() => noKey.generateImage({ prompt: 'x' }), /chưa nhập API key/i);
  setSessionKey('sk_unit_test');
  const tokenModel = new PollinationsKeyedAdapter({ model: 'nanobanana', fetchFn: async () => { throw new Error('must not be called'); } });
  await assert.rejects(() => tokenModel.generateImage({ prompt: 'x' }), /theo token/);
  let seenHeaders = null;
  const flux = new PollinationsKeyedAdapter({ model: 'flux', fetchFn: async (url, opts) => { seenHeaders = opts.headers; return { ok: true, status: 200, blob: async () => jpegBlob() }; } });
  const r = await flux.generateImage({ prompt: 'áo thun trắng', width: 1024, height: 1280 });
  assert.equal(seenHeaders.Authorization, 'Bearer sk_unit_test');
  assert.equal(r.costPollen, 0.002); assert.equal(r.providerId, 'pollinations');
  const broke = new PollinationsKeyedAdapter({ model: 'flux', fetchFn: async () => ({ ok: false, status: 402, blob: async () => new Blob([]) }) });
  await assert.rejects(() => broke.generateImage({ prompt: 'x' }), /Hết Pollen/);
  clearSessionKey();
});

test('P4 zero-cost endpoints (mocked): catalog counts models without auth; balance parses the balance field', async () => {
  const cat = await fetchModelCatalog(async (url, opts) => {
    assert.ok(url.endsWith('/image/models')); assert.ok(!opts?.headers?.Authorization, 'catalog needs no auth header');
    return { ok: true, status: 200, json: async () => [{ id: 'a' }, { id: 'b' }, { id: 'c' }] };
  });
  assert.equal(cat.count, 3);
  const bal = await fetchBalance('sk_unit_test', async (url, opts) => {
    assert.equal(opts.headers.Authorization, 'Bearer sk_unit_test');
    return { ok: true, status: 200, json: async () => ({ balance: 12.5 }) };
  });
  assert.equal(bal.balance, 12.5);
  await assert.rejects(() => fetchBalance('', async () => ({ ok: true })), /chưa nhập API key/i);
});
