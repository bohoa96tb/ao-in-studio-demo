import {chromium} from 'playwright';import AxeBuilder from '@axe-core/playwright';import {mkdir,writeFile,readFile} from 'node:fs/promises';
const b=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
await mkdir('qa-results',{recursive:true});const url=process.env.TEST_URL||'http://127.0.0.1:5264',report=[];
for(const width of [360,390,430,768,1440]){
 const p=await b.newPage({viewport:{width,height:900},hasTouch:width<700});const errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto(url);await p.waitForSelector('html[data-ready=true]');
 await p.screenshot({path:'qa-results/p1-home-'+width+'.png'});
 await p.locator('#product-catalog').scrollIntoViewIfNeeded();await p.waitForSelector('#product-catalog[data-ready=true]');await p.locator('.catalog-card').first().scrollIntoViewIfNeeded();await p.waitForFunction(()=>document.querySelector('.catalog-card').dataset.imageReady==='true');
 if(width<700&&await p.locator('#catalog-grid').evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length)!==2)throw Error('Not two columns');
 await p.locator('#product-catalog').scrollIntoViewIfNeeded();await p.screenshot({path:'qa-results/p1-catalog-'+width+'.png'});await p.locator('.catalog-card').first().screenshot({path:'qa-results/p1-card-'+width+'.png'});
 const checks=width===390?Array.from({length:12},(_,i)=>'AIS-'+String(i+1).padStart(3,'0')):['AIS-004'];const artworkHashes=new Set();
 for(const sku of checks){
  const card=p.locator('[data-sku="'+sku+'"]');await card.locator('.catalog-design').click();await p.waitForSelector('#product-dialog[data-preview-ready=true]');
  if(await p.locator('#product-dialog').getAttribute('data-product-id')!==sku)throw Error('Wrong detail');
  const front=await p.locator('#detail-image').getAttribute('src');if(!front.startsWith('data:image/webp'))throw Error('Expected WebP mockup');artworkHashes.add(front);
  const fields={ 'AIS-001':[['name','Hà'],['secondName','Minh'],['partner','moon']], 'AIS-002':[['members','4'],['role','Con 2'],['name','Bé An']], 'AIS-003':[['group','LỚP 12A'],['yearText','2024–2027']], 'AIS-004':[['name','Nguyễn Hà'],['layout','initial']], 'AIS-005':[['date','2000-02-29'],['layout','vintage']], 'AIS-006':[['year','2023']], 'AIS-007':[['zodiac','11']], 'AIS-008':[['number','8'],['name','An']], 'AIS-009':[['slogan','shine']], 'AIS-011':[['age','25'],['name','Lan'],['wish','BÌNH AN & RỰC RỠ']] }[sku]||[];
  for(const [key,value]of fields){const el=p.locator('#personal-'+key);if(await el.evaluate(el=>el.tagName)==='SELECT')await el.selectOption(value);else await el.fill(value)}
  await p.waitForSelector('#product-dialog[data-preview-ready=true]');
  if(fields.length&&await p.locator('#detail-image').getAttribute('src')===front)throw Error('Personalisation did not change actual preview '+sku);
  if(sku==='AIS-006'&&await p.locator('#personal-animal').inputValue()!=='cat')throw Error('Vietnamese cat zodiac wrong');
  await p.locator('#view-back').click();const back=await p.locator('#detail-image').getAttribute('src');await p.locator('#view-close').click();if(await p.locator('#detail-image').getAttribute('src')===back)throw Error('Gallery not changing');await p.locator('#view-front').click();
  if(sku==='AIS-004'){await p.screenshot({path:'qa-results/p1-detail-'+width+'.png'});const axe=await new AxeBuilder({page:p}).analyze();if(axe.violations.some(v=>['serious','critical'].includes(v.impact)))throw Error('Detail accessibility '+JSON.stringify(axe.violations))}
  await p.locator('#open-studio').click();await p.waitForFunction(sku=>document.querySelector('#studio').dataset.productId===sku,sku);await p.waitForFunction(()=>document.querySelector('#studio-notice').textContent.includes('Đã lưu'));
  if(sku==='AIS-004')await p.screenshot({path:'qa-results/p1-studio-'+width+'.png'});
  // Snapshot assertion proves exact artwork/personalisation survives through the actual editor.
  await p.locator('#export-json').locator('..').locator('summary').click();
  const download=await Promise.all([p.waitForEvent('download'),p.locator('#export-json').click()]).then(x=>x[0]);const d=JSON.parse(await readFile(await download.path(),'utf8'));await p.locator('#export-json').locator('..').locator('summary').click();
  if(d.productId!==sku||d.pricing?.version!==2)throw Error('Wrong Studio snapshot');
  if(sku!=='AIS-012'&&!d.faces.front.some(l=>l.artworkId))throw Error('Artwork not restored');
  if(sku==='AIS-012'&&d.faces.front.length)throw Error('Blank shirt has unrelated artwork');
  if(sku==='AIS-006'&&!d.faces.front.some(l=>l.artworkId==='animal-cat'))throw Error('Animal image not in Studio');
  await p.locator('#add-to-cart').click();await p.waitForSelector('#cart-dialog[open]');if(!await p.locator('.cart-line').last().textContent().then(t=>t.includes(d.productName)))throw Error('Cart lost identity');await p.locator('#cart-close').click();
 }
 if(width===390&&artworkHashes.size!==12)throw Error('Duplicate theme images');
 await p.reload();await p.waitForSelector('#studio[data-ready=true]');await p.waitForSelector('#cart-dialog[data-ready=true]');await p.locator('#cart-open').click();if(await p.locator('.cart-line').count()!==checks.length)throw Error('Cart restore lost designs');await p.locator('.cart-edit').first().click();await p.waitForFunction(()=>document.querySelector('#add-to-cart').textContent.includes('Cập nhật'));await p.locator('#add-to-cart').click();if(await p.locator('.cart-line').count()!==checks.length)throw Error('Edit duplicated cart row');await p.locator('#cart-close').click();
 if(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error('Horizontal page overflow '+width);if(errors.length)throw Error(errors.join(';'));report.push({width,themeJourneys:checks.length,webp:true,gallery:true,exactArtwork:true,cartReloadEdit:true,errors});await p.close();
}
await writeFile('qa-results/p1.json',JSON.stringify(report,null,2));console.log('P1_REPORT '+JSON.stringify(report));await b.close();
