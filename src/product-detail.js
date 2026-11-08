import {presetDesign} from './catalog-filter.js?v=p1content1';
import {schemas,defaults,animalForYear} from './artwork-library.js?v=p1content1';
import {priceBreakdown,money,unitPrice} from './cart-price.js?v=p1content1';
import {typeLabel,colorLabel} from './product-store.js?v=p1content1';
/** Single shopping detail/personalisation entry for rail, circle and catalogue. */
export function mountProductDetail(studio){
 const dialog=document.querySelector('#product-dialog');
 dialog.innerHTML=`<div class="dialog-header"><span class="eyebrow">MẪU ÁO CỦA BẠN</span><button class="close-button" data-close="product-dialog" aria-label="Đóng chi tiết">Đóng ×</button></div>
 <div class="product-layout"><div class="product-gallery"><div class="detail-stage" id="detail-stage"><img id="detail-image" alt="" width="600" height="700"></div><div class="view-tabs" role="group" aria-label="Góc xem sản phẩm"><button id="view-front" aria-pressed="true">Mặt trước</button><button id="view-back" aria-pressed="false">Mặt sau</button><button id="view-close" aria-pressed="false">Cận hình in</button><button id="detail-zoom" aria-pressed="false">Phóng to</button></div><p id="media-note" class="media-note"></p></div>
 <div class="product-copy"><p class="eyebrow" id="product-type"></p><h2 id="product-title"></h2><p id="product-description"></p><div class="detail-price"><strong id="detail-price"></strong><span> / một áo · giá minh họa</span></div>
 <label>Màu áo<select id="detail-color"></select></label><label>Cỡ áo<select id="detail-size"></select></label>
 <form id="product-personal" class="personal-panel" novalidate><h3>Thêm dấu ấn của bạn</h3><div id="personal-fields"></div></form><p id="personal-help" class="price-explanation"></p>
 <details class="product-facts"><summary>Giá, hình in và thông tin áo</summary><dl id="detail-breakdown"></dl><p id="detail-fee-note"></p><p>Chưa có dữ liệu xác minh về chất liệu, số đo từng cỡ, độ bền hoặc giao hàng. Các cỡ S–XXL đang dùng để trải nghiệm chọn mua; vui lòng đối chiếu thông tin thực tế trước khi sản xuất.</p></details>
 <p id="detail-error" role="status"></p><button id="open-studio" class="inspect-button">Mở Studio với mẫu này</button><p class="price-explanation">Bạn vẫn có thể sửa chữ, tải ảnh và thêm mặt in trong Studio. Chưa đặt hàng thật.</p>
 </div></div>`;
 let product,values={},design,gallery,side='front',generation=0,inputTimer;const saved=new Map();
 const $=s=>dialog.querySelector(s);
 function view(face){side=face;for(const [id,key]of [['view-front','front'],['view-back','back'],['view-close','close']])$('#'+id).setAttribute('aria-pressed',String(face===key));if(gallery){$('#detail-image').src=gallery[face];$('#detail-image').alt=product.name+' — '+({front:'mặt trước',back:'mặt sau',close:'cận hình in'})[face]}}
 function fields(){
  const root=$('#personal-fields');root.replaceChildren();const theme=product.artwork?.id,fields=schemas[theme]||[];
  $('#product-personal').hidden=!fields.length;
  for(const f of fields){const label=document.createElement('label');label.textContent=f.label;const control=document.createElement(f.type==='select'?'select':'input');control.id='personal-'+f.key;control.name=f.key;if(f.type==='select'){for(const [value,title]of f.options){if(theme==='family'&&f.key==='role'&&title.startsWith('Con')&&Number(title.split(' ')[1])>Number(values.members)-2)continue;const o=new Option(title,value);control.append(o)}}else{control.type=f.type;for(const k of ['min','max','maxLength'])if(f[k]!==undefined)control[k]=f[k]}control.value=values[f.key];label.append(control);root.append(label)}
  $('#personal-help').textContent=theme==='animal'?'Chọn theo năm âm lịch. Nếu sinh trước Tết, hãy kiểm tra năm âm và chỉnh con giáp tương ứng; đây không phải công cụ đổi lịch.':theme==='couple'?'Giá cho một chiếc. Chọn mặt trời hoặc mặt trăng, rồi thêm từng chiếc vào giỏ.':theme==='family'?'Bạn đang thiết kế một áo cho thành viên được chọn. Đổi vai trò và thêm từng chiếc vào giỏ để tạo bộ gia đình.':theme==='zodiac'||theme==='number'?'Biểu tượng trang trí, mang tính giải trí; không dự đoán tính cách hay vận mệnh.':theme==='blank'?'Áo trống chưa gồm phí in. Tải ảnh trong Studio; giá sẽ cập nhật theo số mặt có nội dung.':'';
 }
 function price(){const p=priceBreakdown(design);$('#detail-price').textContent=money(unitPrice(design));const dl=$('#detail-breakdown');dl.replaceChildren();for(const [label,value]of [['Áo nền',p.base],['Hình in mẫu',p.template],['Cá nhân hóa trong mẫu',p.personalization],['Mặt in thêm',p.extraPrint]]){const row=document.createElement('div'),dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;dd.textContent=money(value);row.append(dt,dd);dl.append(row)}$('#detail-fee-note').textContent=product.photoBase?'Giá áo nền đã gồm hình in tuyển chọn có sẵn. Thêm nội dung mới: 30.000đ cho mỗi mặt có lớp in mới.':product.artwork?.id==='blank'?'Thêm nội dung vào mặt trước hoặc sau: 30.000đ mỗi mặt.':'Hình in mẫu mặt trước: 30.000đ, đã tính trong giá hiển thị. Đổi tên/nội dung trên mặt này không thêm phí. Thêm hình hoặc chữ mặt sau: 30.000đ.'}
 async function refresh(){
  const token=++generation;$('#open-studio').disabled=true;dialog.dataset.previewReady='false';$('#detail-error').textContent='';
  design=presetDesign(product,values);saved.set(product.sku,{...values});price();
  try{const next=await studio.gallery(design);if(token!==generation)return;gallery=next;view(side);dialog.dataset.previewReady='true';$('#open-studio').disabled=false}
  catch{if(token===generation)$('#detail-error').textContent='Chưa tải đủ hình xem trước. Vui lòng thử chọn lại mẫu.'}
 }
 $('#product-personal').onsubmit=e=>e.preventDefault();
 $('#product-personal').oninput=e=>{
  const theme=product.artwork?.id;values[e.target.name]=e.target.value;
  if(theme==='animal'&&e.target.name==='year'){values.animal=animalForYear(e.target.value);$('#personal-animal').value=values.animal}
  if(theme==='family'&&e.target.name==='members'){if(values.role.startsWith('Con')&&Number(values.role.split(' ')[1])>Number(values.members)-2)values.role='Bố';fields()}
  $('#open-studio').disabled=true;dialog.dataset.previewReady='false';clearTimeout(inputTimer);inputTimer=setTimeout(refresh,140);
 };
 $('#detail-color').onchange=e=>{values.color=e.target.value;refresh()};
 $('#detail-size').onchange=e=>{values.size=e.target.value;refresh()};
 $('#view-front').onclick=()=>view('front');$('#view-back').onclick=()=>view('back');$('#view-close').onclick=()=>view('close');
 $('#detail-zoom').onclick=()=>{const zoom=$('#detail-stage').classList.toggle('zoomed');$('#detail-zoom').setAttribute('aria-pressed',String(zoom));$('#detail-zoom').textContent=zoom?'Thu nhỏ':'Phóng to'};
 $('#open-studio').onclick=async()=>{const selected=structuredClone(design);dialog.close();await studio.newDesign(selected)};
 return {async open(p,initial={}){
  clearTimeout(inputTimer);product=p;values={...defaults(p.artwork?.id),...saved.get(p.sku),...initial};side='front';gallery=null;
  dialog.dataset.productId=p.sku;$('#product-title').textContent=p.name;$('#product-type').textContent=p.category+' · '+typeLabel(p.type);
  $('#product-description').textContent=p.description||'Thêm một chút của riêng bạn vào chiếc áo.';
  $('#detail-color').replaceChildren(...p.colors.map(c=>new Option(colorLabel(c),c)));$('#detail-color').value=values.color||p.defaultColor;
  values.color=$('#detail-color').value;$('#detail-color').disabled=!!p.photoBase;
  $('#detail-size').replaceChildren(...p.sizes.map(s=>new Option(s,s)));$('#detail-size').value=values.size||'M';values.size=$('#detail-size').value;
  $('#media-note').textContent=p.photoBase?'Hình ý tưởng có giấy phép MIT; không phải ảnh áo đã sản xuất.':'Ảnh dựng từ đúng artwork gốc. Mặt sau chưa in; không phải ảnh chụp sản phẩm.';
  $('#detail-stage').classList.remove('zoomed');$('#detail-zoom').setAttribute('aria-pressed','false');$('#detail-zoom').textContent='Phóng to';$('#detail-image').removeAttribute('src');
  $('#view-close').textContent=p.artwork?.id==='blank'?'Cận vùng in':'Cận hình in';fields();if(!dialog.open)dialog.showModal();await refresh();
 }};
}
