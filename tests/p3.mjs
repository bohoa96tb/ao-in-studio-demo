/**
 * P3 browser checks: the "Trên áo thật" (on real garment) detail view.
 * - AIS-001 (crew, white, default couple design) must offer the mockup view
 *   and load the pre-rendered mockup with its simulation caption.
 * - Changing the personalisation must hide it (pre-rendered mockups only
 *   depict the default design).
 * - AIS-003 (polo) must NOT offer it (no approved polo base exists).
 */
import { chromium } from 'playwright';

const url = process.env.TEST_URL || 'http://127.0.0.1:5264';
const fail = msg => { throw new Error('P3: ' + msg); };

const b = await chromium.launch();
const p = await (await b.newContext({ viewport: { width: 390, height: 900 }, hasTouch: true })).newPage();
const errors = [];
p.on('pageerror', e => errors.push(e.message));
await p.goto(url);
await p.waitForSelector('html[data-ready=true]');
await p.locator('#product-catalog').scrollIntoViewIfNeeded();
await p.waitForSelector('#product-catalog[data-ready=true]');

async function openDetail(sku) {
  const card = p.locator('[data-sku="' + sku + '"]');
  await card.scrollIntoViewIfNeeded();
  await card.locator('.catalog-design').click();
  await p.waitForSelector('#product-dialog[data-preview-ready=true]');
  if (await p.locator('#product-dialog').getAttribute('data-product-id') !== sku) fail('wrong detail for ' + sku);
}

// AIS-001: mockup view available, loads, captioned.
await openDetail('AIS-001');
if (await p.locator('#view-mock').isHidden()) fail('AIS-001 should offer the real-garment mockup view');
await p.locator('#view-mock').click();
await p.waitForFunction(() => (document.querySelector('#detail-image')?.src || '').includes('/public/mockups/'));
const note = await p.locator('#media-note').textContent();
if (!note.includes('Ảnh mô phỏng')) fail('mockup view must carry the simulation caption, got: ' + note);
await p.waitForFunction(() => document.querySelector('#detail-image').naturalWidth > 0, null, { timeout: 8000 })
  .catch(() => fail('mockup image is broken'));

// Personalisation change (partner sun -> moon) hides the mockup view.
await p.locator('#personal-partner').selectOption('moon');
await p.waitForSelector('#product-dialog[data-preview-ready=true]');
await p.waitForFunction(() => document.querySelector('#view-mock').hidden === true);
await p.keyboard.press('Escape');

// AIS-003 polo: no approved polo base -> no mockup view.
await openDetail('AIS-003');
if (!(await p.locator('#view-mock').isHidden())) fail('AIS-003 (polo) must not offer a crew-garment mockup');
await p.keyboard.press('Escape');

if (errors.length) fail('page errors: ' + errors.join(' | '));
await b.close();
console.log('P3 browser checks passed');
