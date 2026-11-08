export const basePriceForType=type=>({crew:199000,oversize:219000,polo:239000}[type]||199000);
/** One pricing source. Unversioned saved designs keep their original P0 tariff. */
export function priceBreakdown(design){
 const base=[199000,219000,239000].includes(design.basePrice)?design.basePrice:199000;
 const visible=layers=>layers?.some(l=>l.kind==='image'||(typeof l.text==='string'&&l.text.trim()));const legacy=design.pricing?.version!==2;const front=legacy?!!design.faces?.front?.length:!!visible(design.faces?.front),back=legacy?!!design.faces?.back?.length:!!visible(design.faces?.back);
 if(design.pricing?.version!==2){const template=front?30000:0,extraPrint=back?30000:0;return {base,template,personalization:0,extraPrint,total:base+template+extraPrint,legacy:true}}
 const p=design.pricing,template=front?Math.max(0,Number(p.templateFee)||0):0;
 const included=new Set(Array.isArray(p.includedFaces)?p.includedFaces:[]);
 const faceFee=Math.max(0,Number(p.faceFee)||0);
 const extraPrint=((front&&!included.has('front')?1:0)+(back&&!included.has('back')?1:0))*faceFee;
 const personalization=(front||back)?Math.max(0,Number(p.personalizationFee)||0):0;
 return {base,template,personalization,extraPrint,total:base+template+personalization+extraPrint,legacy:false};
}
export const unitPrice=design=>priceBreakdown(design).total;
export const money=n=>Number(n).toLocaleString('vi-VN')+'đ';
export function quantity(value){return Math.max(1,Math.min(99,Math.trunc(Number(value))||1))}
export function totalPrice(rows){return rows.reduce((total,row)=>total+unitPrice(row.design)*quantity(row.design.quantity),0)}
export function priceSummary(d){const p=priceBreakdown(d);return 'Áo nền '+money(p.base)+' · hình in mẫu '+money(p.template)+' · cá nhân hóa '+money(p.personalization)+' · mặt in thêm '+money(p.extraPrint)}
