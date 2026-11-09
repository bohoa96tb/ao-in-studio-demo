/**
 * P3.1 browser checks: visible design collection, catalog main-image swap,
 * and Studio LIVE compositing on the calibrated crew-white garment photo.
 */
import { chromium } from 'playwright';

const url = process.env.TEST_URL || 'http://127.0.0.1:5264';
const fail = msg => { throw new Error('P3.1: ' + msg) };

const b = await chromium.launch();
const p = await (await b.newContext({ viewport: { width: 390, height: 900 }, hasTouch: true })).newPage();
const errors = [];
p.on('pageerror', e => errors.push(e.message));
await p.goto(url + '/?v=p31vis1');
await p.waitForSelector('html[data-ready=true]');

// Curated collection is short, filterable and can send a selected design to Studio.
await p.locator('#design-collection').scrollIntoViewIfNeeded();
await p.waitForSelector('#design-collection[data-ready=true]');
if (await p.locator('.curated-card').count() !== 2) fail('expected two curated artworks');
await p.locator('#collection-theme').selectOption('zodiac');
if (await p.locator('.curated-card').count() !== 1) fail('category filter did not narrow the results');
await p.locator('.curated-card[data-design-id="zodiac-wheel"] .collection-use').click();
await p.waitForFunction(() => (document.querySelector('#studio-product')?.textContent || '').includes('Vòng tròn hoàng đạo'), null, {timeout:8000});

// 4) Studio live composite: real mode for crew/white/front, and it CHANGES
//    when the user adds Vietnamese text.
await p.locator('.studio-live').scrollIntoViewIfNeeded();
await p.waitForFunction(() => document.querySelector('.studio-live')?.dataset.mode === 'real', null, { timeout: 10000 })
  .catch(() => fail('studio live preview did not enter real-composite mode'));
const hash1 = await p.evaluate(() => document.querySelector('#studio-live-canvas').toDataURL().length);
await p.locator('#text-value').fill('MÈO CỦA TÔI');
await p.locator('#add-text').click();
await p.waitForTimeout(900);
const hash2 = await p.evaluate(() => document.querySelector('#studio-live-canvas').toDataURL().length);
if (hash1 === hash2) fail('live composite did not change after adding text');

// 5) Honest fallback: switching to polo leaves real mode.
await p.locator('#shirt-type').selectOption('polo');
await p.waitForFunction(() => document.querySelector('.studio-live')?.dataset.mode === 'fallback', null, { timeout: 8000 })
  .catch(() => fail('polo must fall back from real compositing'));
await p.locator('#shirt-type').selectOption('crew');

// 5b) Studio live composite also works on the black crew base (P3.1 round 2).
await p.locator('#shirt-color').selectOption('#242424');
await p.waitForFunction(() => document.querySelector('.studio-live')?.dataset.mode === 'real', null, { timeout: 10000 })
  .catch(() => fail('studio live preview did not enter real mode for the black crew base'));
const blackBadge = await p.locator('#studio-live-badge').textContent();
if (!blackBadge.includes('đen')) fail('black-base badge should name the black shirt, got: ' + blackBadge);
await p.locator('#shirt-color').selectOption('#f8f6ee');
await p.waitForTimeout(600);

// 6) Catalog: AIS-001 card uses the real-garment mockup as its main image.
await p.locator('#product-catalog').scrollIntoViewIfNeeded();
await p.waitForSelector('#product-catalog[data-ready=true]');
const card1 = p.locator('[data-sku="AIS-001"]');
await card1.scrollIntoViewIfNeeded();
await p.waitForFunction(() => {
  const img = document.querySelector('[data-sku="AIS-001"] .catalog-image-button img');
  return img && img.src.includes('/public/mockups/');
}, null, { timeout: 10000 }).catch(() => fail('AIS-001 card did not switch to the real-garment mockup'));
// AIS-003 (polo) must NOT use a crew mockup.
const card3src = await p.evaluate(async () => {
  const card = document.querySelector('[data-sku="AIS-003"]');
  card.scrollIntoView({ block: 'center' });
  await new Promise(r => setTimeout(r, 1500));
  return document.querySelector('[data-sku="AIS-003"] .catalog-image-button img')?.src || '';
});
if (card3src.includes('/public/mockups/')) fail('AIS-003 (polo) must not show a crew-garment mockup');
// AIS-007 (crew, black default, zodiac) uses the BLACK-garment mockup.
const card7 = p.locator('[data-sku="AIS-007"]');
await card7.scrollIntoViewIfNeeded();
await p.waitForFunction(() => {
  const img = document.querySelector('[data-sku="AIS-007"] .catalog-image-button img');
  return img && img.src.includes('gar-crew-blk-hanger-01');
}, null, { timeout: 10000 }).catch(() => fail('AIS-007 card did not switch to the black-garment mockup'));

if (errors.length) fail('page errors: ' + errors.join(' | '));
await b.close();
console.log('P3.1 browser checks passed');
