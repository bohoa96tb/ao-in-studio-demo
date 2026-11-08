/**
 * P2 media manifest — canonical data lives in data/media-manifest.json.
 * This module mirrors the lifestyle entries so detail/catalog code can run
 * without an extra fetch; tests/media-manifest.test.mjs fails if the two
 * drift apart or if a referenced file is missing.
 *
 * Lifestyle photos are photographs of BLANK garments (Pexels License).
 * They never contain the customer's artwork and must always be shown with
 * their labelVi caption. They are illustration, not shop product photos.
 */
export const LIFESTYLE_PHOTOS=[
 {id:'crew-white-hanger',file:'public/fixtures/real-tee/crew-white-hanger.webp',garmentType:'crew',color:'#f8f6ee',view:'front',author:'Dmitriy Steinke',sourceUrl:'https://www.pexels.com/photo/hand-holds-hanger-with-t-shirt-20669538/',labelVi:'Ảnh chụp áo trắng trống trên móc — Pexels / Dmitriy Steinke. Minh họa phom áo, không chứa hình in của bạn.'},
 {id:'crew-black-woman',file:'public/fixtures/real-tee/crew-black-woman.webp',garmentType:'crew',color:'#242424',view:'front-worn',author:'MART PRODUCTION',sourceUrl:'https://www.pexels.com/photo/woman-in-black-crew-neck-t-shirt-9558583/',labelVi:'Ảnh người mặc áo đen cổ tròn trống — Pexels / MART PRODUCTION. Người mẫu không xác nhận thương hiệu; ảnh minh họa, không chứa hình in của bạn.'},
 {id:'couple-white-outdoor',file:'public/fixtures/real-tee/couple-white-outdoor.webp',garmentType:'crew',color:'#f8f6ee',view:'front-worn-couple',skus:['AIS-001'],author:'Israel Torres',sourceUrl:'https://www.pexels.com/photo/woman-and-man-in-white-t-shirts-25462458/',labelVi:'Ảnh đôi mặc áo trắng trống ngoài trời — Pexels / Israel Torres. Người mẫu không xác nhận thương hiệu; ảnh minh họa, không chứa hình in của bạn.'},
 {id:'crew-white-flatlay',file:'public/fixtures/real-tee/crew-white-flatlay.webp',garmentType:'crew',color:'#f8f6ee',view:'front-flatlay',author:'Daniel & Hannah Snipes',sourceUrl:'https://www.pexels.com/photo/minimalist-fashion-flat-lay-of-white-t-shirt-37704838/',labelVi:'Ảnh phẳng áo trắng trống trên sàn gỗ — Pexels / Daniel & Hannah Snipes. Minh họa vải và ánh sáng, không chứa hình in của bạn. Không dùng làm ảnh hero chính.'},
];
export const LIFESTYLE_BY_ID=Object.fromEntries(LIFESTYLE_PHOTOS.map(p=>[p.id,p]));
/** Photos relevant to a product: explicit SKU match wins, then type+colour. */
export function lifestyleFor(product,color){
 const wanted=color||product?.defaultColor;
 return LIFESTYLE_PHOTOS.filter(p=>(!p.skus||p.skus.includes(product?.sku))&&(p.garmentType===product?.type||p.skus?.includes(product?.sku))&&(!wanted||p.color===wanted||p.skus?.includes(product?.sku)));
}
export async function getMediaManifest(){
 try{const r=await fetch(new URL('../data/media-manifest.json',import.meta.url));if(!r.ok)throw Error('manifest');return await r.json()}catch{return null}
}
