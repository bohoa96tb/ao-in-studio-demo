import test from 'node:test';import assert from 'node:assert/strict';import {filterProducts,presetDesign} from '../src/catalog-filter.js';import {readFile} from 'node:fs/promises';import {unitPrice} from '../src/cart-price.js';
const products=JSON.parse(await readFile(new URL('../data/products.json',import.meta.url)));
test('Vietnamese search, combined filters and empty states',()=>{assert.equal(products.length,14);assert.equal(new Set(products.map(p=>p.sku)).size,14);assert.equal(filterProducts(products,{q:'nha minh'})[0].sku,'AIS-002');assert.equal(filterProducts(products,{type:'polo',max:199000}).length,0);assert.equal(filterProducts(products,{category:'Áo đôi',gender:'female'}).length,1)});
test('personalization and prices agree with Studio/cart',()=>{const name=presetDesign(products.find(p=>p.sku==="AIS-004"),{name:'Minh Anh'});assert.ok(name.faces.front.some(l=>l.text==='Minh Anh'));const date=presetDesign(products.find(p=>p.sku==="AIS-005"),{date:'1996-11-08'});assert.ok(date.faces.front.some(l=>l.text==='08.11.1996'));assert.equal(unitPrice(date),249000);assert.equal(products.find(p=>p.sku==="AIS-005").basePrice,219000)});

import {contrast} from '../src/color-contrast.js';
test('every template keeps readable ink for all supported shirt overrides',()=>{for(const p of products.filter(p=>!p.photoBase))for(const color of p.colors){const d=presetDesign(p,{color});for(const l of d.faces.front.filter(l=>l.kind==='text'))assert.ok(contrast(color,l.color)>=4.5)}});

import {resolveRail} from '../src/product-store.js';
test('rail references two unique products and keeps motion artwork exact',()=>{const rail=resolveRail({productIds:['AIS-M01','AIS-M02']},products);assert.equal(rail.length,2);for(const p of rail){const d=presetDesign(p,{color:'#242424'});assert.equal(d.productId,p.sku);assert.equal(d.productName,p.name);assert.equal(d.color,p.defaultColor);assert.equal(d.basePrice,p.basePrice);assert.equal(d.baseImages.front,p.front);assert.deepEqual(d.faces,{front:[],back:[]});}assert.throws(()=>resolveRail({productIds:['AIS-M01','AIS-M01']},products));});

import {animals,zodiacs,animalForYear,normalizePersonal} from '../src/artwork-library.js';
test('twelve themes use distinct artwork with real animal and constellation alternatives',async()=>{
 const templates=products.filter(p=>p.artwork);assert.equal(new Set(templates.map(p=>p.artwork.id)).size,12);
 const srcs=new Set();for(const p of templates){const d=presetDesign(p);if(p.artwork.id==='blank'){assert.deepEqual(d.faces.front,[]);continue}const im=d.faces.front.find(l=>l.kind==='image');assert.ok(im);srcs.add(im.src);await readFile(new URL('../'+im.src,import.meta.url))}
 assert.equal(srcs.size,11);
 const animal=products.find(p=>p.sku==='AIS-006'),zodiac=products.find(p=>p.sku==='AIS-007');
 for(const [id]of animals){const d=presetDesign(animal,{animal:id});assert.ok(d.faces.front.some(l=>l.src?.endsWith('animal-'+id+'.svg')))}
 assert.equal(animals.length,12);assert.equal(zodiacs.length,12);assert.equal(animalForYear(1996),'rat');assert.equal(animalForYear(2023),'cat');
 for(let i=0;i<12;i++)assert.ok(presetDesign(zodiac,{zodiac:String(i)}).faces.front.some(l=>l.src?.endsWith('zodiac-'+i+'.svg')));
 assert.equal(normalizePersonal('birthday',{age:999}).age,120);
 assert.equal(normalizePersonal('date',{date:'2026-02-31'}).date,'1996-11-08');
});
test('theme fields change actual layers and snapshots remain self-contained',()=>{
 const p=id=>products.find(p=>p.sku===id),a=presetDesign(p('AIS-001'),{partner:'sun',name:'Hà',secondName:'An'}),b=presetDesign(p('AIS-001'),{partner:'moon',name:'Hà',secondName:'An'});
 assert.notDeepEqual(a.faces.front,b.faces.front);assert.equal(a.productId,b.productId);
 assert.notDeepEqual(presetDesign(p('AIS-004'),{name:'Hà',layout:'classic'}).faces,presetDesign(p('AIS-004'),{name:'Hà',layout:'initial'}).faces);
 assert.notDeepEqual(presetDesign(p('AIS-002'),{role:'Bố',members:3}).faces,presetDesign(p('AIS-002'),{role:'Mẹ',members:4}).faces);
 assert.equal(presetDesign(p('AIS-012')).faces.front.length,0);
});
