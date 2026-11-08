import test from 'node:test';import assert from 'node:assert/strict';import {unitPrice,totalPrice,quantity} from '../src/cart-price.js';
test('price charges printed faces separately and preserves separate designs',()=>{const a={faces:{front:[{}],back:[]},quantity:2},b={faces:{front:[{}],back:[{}]},quantity:3};assert.equal(unitPrice(a),229000);assert.equal(unitPrice(b),259000);assert.equal(totalPrice([{design:a},{design:b}]),1235000);assert.equal(quantity(-5),1);assert.equal(quantity(120),99);assert.equal(quantity('abc'),1)});

import {priceBreakdown} from '../src/cart-price.js';
test('v2 distinguishes blank, included template, edits and additional faces without repricing old carts',()=>{
 const pricing={version:2,templateFee:30000,includedFaces:['front'],faceFee:30000,personalizationFee:0};
 const d={basePrice:219000,faces:{front:[{text:'Hà'}],back:[]},pricing,quantity:2};
 assert.deepEqual(priceBreakdown(d),{base:219000,template:30000,personalization:0,extraPrint:0,total:249000,legacy:false});
 d.faces.front.push({kind:'image'});assert.equal(unitPrice(d),249000);
 d.faces.back.push({text:'Mặt sau'});assert.equal(unitPrice(d),279000);assert.equal(totalPrice([{design:d}]),558000);
 const old={basePrice:219000,faces:{front:[{text:'old'}],back:[]}};assert.equal(unitPrice(old),249000);
 const blank={basePrice:239000,faces:{front:[],back:[]},pricing:{...pricing,templateFee:0,includedFaces:[]}};assert.equal(unitPrice(blank),239000);blank.faces.back.push({text:'Ảnh riêng'});assert.equal(unitPrice(blank),269000);
});

test('new designs do not charge an invisible empty text layer; stored legacy tariff is unchanged',()=>{
 const d={basePrice:199000,faces:{front:[{kind:'text',text:'  '}],back:[]},pricing:{version:2,templateFee:30000,includedFaces:['front'],faceFee:30000}};
 assert.equal(unitPrice(d),199000);delete d.pricing;assert.equal(unitPrice(d),229000);
});
