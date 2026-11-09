import {readableInk} from './color-contrast.js?v=p31vis1';
import {artworkLayers} from './artwork-library.js?v=p31vis1';
import {unitPrice} from './cart-price.js?v=p31vis1';
export const normalize=text=>String(text||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').replace(/Đ/g,'D').toLowerCase().trim();
export function filterProducts(products,f){const q=normalize(f.q);return products.filter(p=>(!q||normalize(p.name+' '+p.category+' '+p.sku).includes(q))&&(!f.category||p.category===f.category)&&(!f.type||p.type===f.type)&&(!f.color||p.colors.includes(f.color))&&(!f.gender||p.gender===f.gender||p.gender==='unisex')&&unitPrice(presetDesign(p))<=Number(f.max||1000000))}
export function presetDesign(p,input={}){
 const color=p.photoBase?p.defaultColor:p.colors.includes(input.color)?input.color:p.defaultColor;
 const artwork=p.artwork?artworkLayers(p,input,readableInk(color,p.print.color)):null;
 const layers=p.photoBase?[]:artwork?.layers??[{kind:'text',text:p.print.text,x:300,y:320,width:p.print.width,height:100,angle:0,color:readableInk(color,p.print.color),font:p.print.font}];
 return {productId:p.sku,productName:p.name,type:p.type,basePrice:p.basePrice,color,size:p.sizes.includes(input.size)?input.size:'M',quantity:1,side:'front',
 baseImages:p.photoBase?{front:p.front,back:p.back}:null,lockedBase:!!p.photoBase,
 ...(p.pricing?{pricing:structuredClone(p.pricing)}:{}),
 ...(artwork?{artwork:{...p.artwork},personalization:artwork.personalization}:{}),faces:{front:layers,back:[]}};
}
