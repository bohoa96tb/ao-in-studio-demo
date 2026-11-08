let pending;
export const typeLabel=type=>({crew:'Cổ tròn',oversize:'Dáng rộng',polo:'Áo cổ bẻ'}[type]||'Áo thun');
export function getProducts(){return pending||=(fetch(new URL('../data/products.json',import.meta.url)).then(r=>{if(!r.ok)throw Error('Chưa tải được sản phẩm');return r.json()}))}
export async function getProduct(id){const p=(await getProducts()).find(p=>p.sku===id);if(!p)throw Error('Không tìm thấy mẫu áo');return p}
export function resolveRail(config,products){const ids=config.productIds||[];if(new Set(ids).size!==ids.length)throw Error('Trùng sản phẩm trong tủ áo');return ids.map(id=>{const p=products.find(p=>p.sku===id);if(!p?.motion)throw Error('Sản phẩm thiếu chuyển động');return {...p,id:p.sku,color:p.colorName||p.defaultColor}})}

export const colorLabel=color=>({'#f8f6ee':'Trắng kem','#242424':'Đen','#dfd0b4':'Kem cát','#a9aaa7':'Xám','#23334d':'Xanh đậm','#e8b8ca':'Hồng phấn'}[color]||color);
