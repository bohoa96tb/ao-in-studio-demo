
import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
const url=process.env.TEST_URL||'http://127.0.0.1:5264';const report=[];
for(const width of [360,390,430,768,1440]){
 const page=await browser.newPage({viewport:{width,height:900},hasTouch:width<700});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(url);await page.waitForSelector('html[data-ready=true]');await page.waitForSelector('#studio[data-ready=true]');
 if(await page.locator('.garment').count()!==2)throw Error('Rail must contain exactly two real designs');
 await page.screenshot({path:'qa-results/p0-home-'+width+'.png'});
 await page.locator('#text-value').fill('Bản nháp cũ KHÔNG ĐƯỢC LẪN');await page.locator('#add-text').click();
 await page.locator('#next').click();await page.locator('#inspect').click();await page.locator('#open-studio').click();
 await page.waitForFunction(()=>document.querySelector('#studio').dataset.productId==='AIS-M02');
 if(await page.locator('#shirt-color').inputValue()!=='#e8b8ca'||await page.locator('#shirt-type').inputValue()!=='oversize'||await page.locator('#layer-select option').count()!==0)throw Error('Wrong pink product or stale draft');
 if(!await page.locator('#studio-price').textContent().then(x=>x.includes('219.000')))throw Error('Wrong base price');
 await page.locator('#text-value').fill('Tên riêng tiếng Việt');await page.locator('#add-text').click();await page.waitForFunction(()=>document.querySelector('#studio-notice').textContent.includes('Đã lưu'));await page.waitForTimeout(150);await page.reload();await page.waitForSelector('#studio[data-ready=true]');
 if(await page.locator('#studio').getAttribute('data-product-id')!=='AIS-M02'||await page.locator('#layer-select option').count()!==1)throw Error('Photo draft restoration lost');
 await page.locator('#add-to-cart').click();await page.waitForSelector('#cart-dialog[open]');if(!await page.locator('.cart-line').textContent().then(x=>x.includes('Lá bài')))throw Error('Cart identity lost');await page.locator('#cart-close').click();
 await page.locator('#product-catalog').scrollIntoViewIfNeeded();await page.waitForSelector('#product-catalog[data-ready=true]');
 await page.locator('[data-sku="AIS-004"] .catalog-design').click();await page.locator('#open-studio').click();
 await page.waitForFunction(()=>document.querySelector('#studio').dataset.productId==='AIS-004');
 if(!await page.locator('#shirt-color').isEnabled()||await page.locator('#layer-select option').count()<2)throw Error('Template failed to clear photo state');
 if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error('Overflow');if(errors.length)throw Error(errors.join(';'));
 report.push({width,exactProduct:true,noStaleDraft:true,photoDraft:true,cartIdentity:true,templateReset:true,errors});await page.close();
}
for(const failure of ['atlas','manifest']){
 const page=await browser.newPage({viewport:{width:390,height:900},hasTouch:true});await page.route('**/fixtures/lake-white-v3/'+(failure==='atlas'?'atlas.webp':'manifest.json'),r=>r.abort());
 await page.goto(url);await page.waitForSelector('html[data-ready=true]');await page.locator('#inspect').click();await page.locator('#open-studio').click();await page.waitForFunction(()=>document.querySelector('#studio').dataset.productId==='AIS-M01');
 report.push({failure,railStillUsable:true,productStillCorrect:true});await page.close();
}
await browser.close();await mkdir('qa-results',{recursive:true});await writeFile('qa-results/p0.json',JSON.stringify(report,null,2));console.log('P0_REPORT '+JSON.stringify(report));
