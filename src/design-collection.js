/** Curated artwork: source art is displayed directly, not disguised as a product photo. */
const designs = [
  { id:'zodiac-wheel', name:'Vòng tròn hoàng đạo', theme:'zodiac', file:'public/curated/zodiac.png', width:1400, height:1400, source:'https://openclipart.org/detail/307964/signs-of-the-zodiacs', author:'DG-RA / Openclipart' },
  { id:'vintage-tulip', name:'Hoa tulip cổ điển', theme:'nature', file:'public/curated/tulip.png', width:800, height:1809, source:'https://openclipart.org/detail/302629/early-dwarf-tulip', author:'Openclipart' },
  { id:'song-phu-si-retro', name:'Sóng Phú Sĩ Retro', theme:'retro', file:'public/curated/song-phu-si-retro.webp', width:512, height:496, source:'Áo In Studio AI', author:'Áo In Studio' },
  { id:'shiba-cyberpunk', name:'Shiba Cyberpunk', theme:'retro', file:'public/curated/shiba-cyberpunk.webp', width:328, height:481, source:'Áo In Studio AI', author:'Áo In Studio' },
  { id:'meo-ca-phe', name:'Mèo Cà Phê', theme:'pet', file:'public/curated/meo-ca-phe.webp', width:393, height:401, source:'Áo In Studio AI', author:'Áo In Studio' },
];

export async function mountDesignCollection(studio) {
  const host = document.querySelector('#design-collection');
  if (!host) return;
  host.innerHTML = `<div class="effect-heading"><p class="eyebrow">KHÁM PHÁ HÌNH IN</p><h2>Chọn hình bạn yêu thích</h2><p>Các hình được tuyển chọn để bạn thử thiết kế. Bạn cũng có thể sử dụng hình ảnh của riêng mình.</p></div>
  <div class="curated-actions">
    <label>Danh mục hình in <select id="collection-theme"><option value="all">Tất cả hình tuyển chọn</option><option value="zodiac">Cung hoàng đạo</option><option value="nature">Hoa & thiên nhiên</option><option value="retro">Retro & Cyberpunk</option><option value="pet">Thú cưng</option></select></label>
    <div class="collection-color-picker">
      <span class="collection-color-label">Màu áo xem trước</span>
      <div class="collection-swatches" id="collection-swatches">
        <button type="button" class="collection-swatch active" data-color="#f8f6ee" style="background:#f8f6ee" title="Trắng"></button>
        <button type="button" class="collection-swatch" data-color="#1f1f23" style="background:#1f1f23" title="Đen than"></button>
        <button type="button" class="collection-swatch" data-color="#e6dccf" style="background:#e6dccf" title="Be cát"></button>
        <button type="button" class="collection-swatch" data-color="#9ca3af" style="background:#9ca3af" title="Xám tiêu"></button>
      </div>
    </div>
    <button id="collection-custom" class="inspect-button">Tự thiết kế với ảnh của bạn</button>
  </div>
  <div id="collection-grid" class="curated-grid"></div><p class="curated-note">Đây là hình in tham khảo, chưa phải ảnh áo đã sản xuất. Bạn có thể tìm hình trên Google, tải về thiết bị rồi chọn ảnh trong Studio. Chỉ sử dụng hình mà bạn có quyền in và sử dụng.</p>`;
  const grid = host.querySelector('#collection-grid');
  const select = host.querySelector('#collection-theme');
  let currentColor = '#f8f6ee';

  host.querySelectorAll('.collection-swatch').forEach(btn => {
    btn.onclick = () => {
      host.querySelectorAll('.collection-swatch').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentColor = btn.dataset.color;
      host.querySelectorAll('.curated-img-wrap').forEach(wrap => {
        wrap.style.backgroundColor = currentColor;
      });
    };
  });

  function createDesign(d) {
    studio.newDesign({productId:null, productName:'Áo tự thiết kế · '+d.name, type:'crew', color:currentColor, faces:{front:[{kind:'image',src:d.file,artworkId:d.id,naturalWidth:d.width,x:300,y:320,width:175,height: d.theme === 'nature' ? 220 : 175,angle:0}],back:[]}});
  }
  function render() {
    grid.replaceChildren();
    for (const d of designs.filter(d => select.value === 'all' || select.value === d.theme)) {
      const card = document.createElement('article'); card.className='curated-card'; card.dataset.designId=d.id;
      const imgWrap = document.createElement('div'); imgWrap.className = 'curated-img-wrap';
      imgWrap.style.backgroundColor = currentColor;
      const img=document.createElement('img'); img.src=d.file; img.alt='Hình in '+d.name; img.loading='lazy';
      imgWrap.append(img);
      const title=document.createElement('h3'); title.textContent=d.name;
      const source=document.createElement('a'); source.href=d.source; source.textContent='Nguồn: '+d.author; source.target='_blank'; source.rel='noopener';
      const button=document.createElement('button'); button.className='collection-use'; button.textContent='Thử hình này'; button.onclick=()=>createDesign(d);
      card.append(imgWrap,title,source,button); grid.append(card);
    }
  }
  select.onchange=render;
  host.querySelector('#collection-custom').onclick=()=>studio.newDesign({productId:null,productName:'Áo tự thiết kế',type:'crew',color:currentColor,faces:{front:[],back:[]}});
  render(); host.dataset.ready='true';
}
