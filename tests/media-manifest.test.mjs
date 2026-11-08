import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';
import {LIFESTYLE_PHOTOS,LIFESTYLE_BY_ID,lifestyleFor} from '../src/media-manifest.js';

const root=new URL('../',import.meta.url);
const manifest=JSON.parse(await readFile(new URL('data/media-manifest.json',root),'utf8'));
const products=JSON.parse(await readFile(new URL('data/products.json',root),'utf8'));

test('P2 manifest covers every SKU exactly once and keeps P1 catalogue intact',()=>{
 assert.equal(products.length,14);
 assert.deepEqual(Object.keys(manifest.bySku).sort(),products.map(p=>p.sku).sort());
 for(const p of products){const m=manifest.bySku[p.sku];assert.ok(m&&typeof m.mockup==='string');if(p.type==='polo')assert.ok(m.missing||m.lifestyle.length,'polo gaps must be explicit');}
});

test('every lifestyle photo in code mirrors the JSON manifest, is licensed and exists on disk',async()=>{
 assert.equal(LIFESTYLE_PHOTOS.length,manifest.lifestyle.length);
 for(const photo of manifest.lifestyle){
  const mirror=LIFESTYLE_BY_ID[photo.id];assert.ok(mirror,`missing code mirror ${photo.id}`);
  assert.equal(mirror.file,photo.file);assert.equal(mirror.author,photo.author);assert.equal(mirror.sourceUrl,photo.sourceUrl);
  assert.equal(photo.provider,'Pexels');assert.match(photo.license,/Pexels License/);assert.equal(photo.kind,'photograph');
  assert.equal(photo.containsCustomerArtwork,false);
  assert.ok(photo.verified>='2026-11-09');
  await access(new URL(photo.file.replace(/^public\//,'public/'),root));
 }
 // The rejected under-age-ambiguous Pexels photo must never come back.
 assert.ok(!JSON.stringify(manifest).includes('9558713'));
 assert.ok(!JSON.stringify(LIFESTYLE_PHOTOS).includes('9558713'));
});

test('lifestyle matching never shows a polo customer a crew photo as its garment',()=>{
 for(const p of products.filter(p=>p.type==='polo'))assert.deepEqual(lifestyleFor(p,p.defaultColor),[]);
 const couple=products.find(p=>p.sku==='AIS-001');
 assert.ok(lifestyleFor(couple,'#f8f6ee').some(x=>x.id==='couple-white-outdoor'));
 const black=products.find(p=>p.sku==='AIS-007');
 assert.ok(lifestyleFor(black,'#242424').some(x=>x.id==='crew-black-woman'));
});

test('print zones in the manifest match the Studio zones contract',()=>{
 assert.deepEqual(manifest.printZones.crew,{x:210,y:200,w:180,h:280,cm:28});
 assert.deepEqual(manifest.printZones.oversize,{x:195,y:195,w:210,h:300,cm:32});
 assert.deepEqual(manifest.printZones.polo,{x:215,y:250,w:170,h:230,cm:24});
});
