import {getProducts,typeLabel,colorLabel} from './product-store.js?v=p1content1';
import {filterProducts,presetDesign} from './catalog-filter.js?v=p1content1';
import {unitPrice,money} from './cart-price.js?v=p1content1';
export async function mountCatalog(studio,detail){
 const host=document.querySelector('#product-catalog');
 await new Promise(resolve=>{const o=new IntersectionObserver(([e])=>{if(e.isIntersecting){o.disconnect();resolve()}},{rootMargin:'120px'});o.observe(host)});
 host.innerHTML=`<div class="catalog-heading"><div><p class="eyebrow">BỘ SƯU TẬP</p><h2>Mặc điều bạn yêu.</h2><p>Chọn một hình in. Viết tiếp câu chuyện của bạn.</p></div><span class="catalog-note">Giá cho một áo, theo mẫu đang xem.<br>Hình dựng minh họa · Chưa nhận đơn thật.</span></div>
 <div class="catalog-searchbar"><label class="catalog-search-label"><span class="sr-only">Tìm mẫu</span><input id="catalog-search" type="search" placeholder="Tìm áo gia đình, tên, ngày sinh…" autocomplete="off"></label><button id="catalog-filter-open">Bộ lọc</button></div>
 <div id="catalog-chips" class="catalog-chips" role="group" aria-label="Chủ đề thiết kế"></div>
 <div class="catalog-results"><p id="catalog-count" role="status"></p><button id="catalog-reset" class="text-button">Xóa bộ lọc</button></div>
 <div id="catalog-grid" class="catalog-grid"></div>
 <dialog id="catalog-filter-dialog" aria-labelledby="filter-title"><div class="dialog-header"><h2 id="filter-title">Chọn chiếc áo phù hợp</h2><button id="catalog-filter-close" aria-label="Đóng bộ lọc">Đóng ×</button></div><div class="catalog-filter-panel">
 <p>Chủ đề hình in được chọn ở dãy phía trên. Bộ lọc này dành cho chiếc áo nền và giá trọn mẫu.</p>
 <label>Kiểu áo<select id="catalog-type"><option value="">Tất cả kiểu áo</option><option value="crew">Cổ tròn</option><option value="oversize">Dáng rộng</option><option value="polo">Cổ bẻ</option></select></label>
 <label>Màu áo<select id="catalog-color"><option value="">Tất cả màu</option></select></label>
 <label>Giá trọn mẫu tối đa<select id="catalog-price"><option value="1000000">Mọi mức giá</option><option value="199000">199.000đ</option><option value="249000">249.000đ</option><option value="269000">269.000đ</option></select></label><button id="catalog-filter-apply" class="inspect-button">Xem các mẫu phù hợp</button></div></dialog>`;
 try{
 const products=[...await getProducts()].sort((a,b)=>Number(!!a.photoBase)-Number(!!b.photoBase));let category='';const $=s=>host.querySelector(s),chips=$('#catalog-chips'),grid=$('#catalog-grid');
 const imageObserver=new IntersectionObserver(entries=>{for(const e of entries){if(e.isIntersecting){imageObserver.unobserve(e.target);e.target.loadPreview?.()}}},{rootMargin:'160px'});
 const cache=new Map();function preview(p,color){const key=p.sku+':'+color;if(!cache.has(key))cache.set(key,studio.gallery(presetDesign(p,{color}),{thumbnail:true}));return cache.get(key)}
 function filters(){return {q:$('#catalog-search').value,category,type:$('#catalog-type').value,color:$('#catalog-color').value,max:$('#catalog-price').value}}
 function render(){
  const f=filters(),list=filterProducts(products,f);$('#catalog-count').textContent=list.length+' mẫu';$('#catalog-reset').hidden=!(f.q||f.category||f.type||f.color||f.max!=='1000000');
  imageObserver.disconnect();grid.replaceChildren();
  for(const b of chips.querySelectorAll('button'))b.setAttribute('aria-pressed',String(b.dataset.category===category));
  $('#catalog-filter-open').textContent='Bộ lọc'+([f.type,f.color,f.max!=='1000000'].filter(Boolean).length?' · '+[f.type,f.color,f.max!=='1000000'].filter(Boolean).length:'');
  if(!list.length){const p=document.createElement('p');p.className='catalog-empty';p.textContent='Chưa có mẫu phù hợp. Hãy đổi chủ đề hoặc xóa bộ lọc.';grid.append(p)}
  for(const p of list){
   const card=document.createElement('article');card.className='catalog-card';card.dataset.sku=p.sku;
   const picture=document.createElement('button');picture.className='catalog-image-button';picture.setAttribute('aria-label','Xem '+p.name);
   const img=new Image();img.alt=p.name+' — mặt trước, ảnh dựng minh họa';img.width=420;img.height=490;img.loading='lazy';img.decoding='async';picture.append(img);
   card.loadPreview=async()=>{try{const gallery=await preview(p,f.color);if(card.isConnected){img.src=gallery.front;card.dataset.imageReady='true'}}catch{if(card.isConnected){img.alt='Chưa tải được ảnh '+p.name;const retry=document.createElement('button');retry.textContent='Tải lại ảnh';retry.onclick=()=>{cache.delete(p.sku+':'+f.color);retry.remove();card.loadPreview()};card.append(retry)}}};
   const tag=document.createElement('small');tag.textContent=p.category+' · '+typeLabel(p.type);
   const h=document.createElement('h3');h.textContent=p.name;
   const price=document.createElement('p');price.className='catalog-price';price.textContent=money(unitPrice(presetDesign(p)));
   const hint=document.createElement('span');hint.className='catalog-price-hint';hint.textContent=p.photoBase?'Gồm hình in tuyển chọn':p.artwork?.id==='blank'?'Áo trống · chưa gồm phí in':'Gồm hình in mặt trước';
   const swatches=document.createElement('div');swatches.className='catalog-swatches';swatches.setAttribute('aria-label','Màu áo có thể chọn');for(const c of p.colors){const dot=document.createElement('span');dot.style.backgroundColor=c;dot.title=colorLabel(c);const name=document.createElement('span');name.className='sr-only';name.textContent=colorLabel(c);dot.append(name);swatches.append(dot)}
   const btn=document.createElement('button');btn.className='catalog-design';btn.textContent='Thiết kế mẫu này';picture.onclick=btn.onclick=()=>detail.open(p,f.color?{color:f.color}:{});
   card.append(picture,tag,h,price,hint,swatches,btn);grid.append(card);imageObserver.observe(card);
  }
 }
 for(const c of ['',...new Set(products.map(p=>p.category))]){const b=document.createElement('button');b.type='button';b.dataset.category=c;b.textContent=c||'Tất cả';b.onclick=()=>{category=c;render()};chips.append(b)}
 for(const c of new Set(products.flatMap(p=>p.colors)))$('#catalog-color').append(new Option(colorLabel(c),c));
 $('#catalog-search').oninput=render;for(const id of ['type','color','price'])$('#catalog-'+id).onchange=render;
 $('#catalog-reset').onclick=()=>{category='';$('#catalog-search').value='';$('#catalog-type').value='';$('#catalog-color').value='';$('#catalog-price').value='1000000';render()};
 $('#catalog-filter-open').onclick=()=>$('#catalog-filter-dialog').showModal();$('#catalog-filter-close').onclick=$('#catalog-filter-apply').onclick=()=>$('#catalog-filter-dialog').close();
 render();host.dataset.ready='true';
 }catch{host.querySelector('#catalog-count').textContent='Bộ sưu tập chưa tải được. Bạn có thể tải lại trang hoặc mở Studio phía dưới.'}
}
