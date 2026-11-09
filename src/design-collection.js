/** Curated artwork: source art is displayed directly, not disguised as a product photo. */
const designs = [
  { id:'zodiac-wheel', name:'Vòng tròn hoàng đạo', theme:'zodiac', file:'public/curated/zodiac.png', width:1400, height:1400, source:'https://openclipart.org/detail/307964/signs-of-the-zodiacs', author:'DG-RA / Openclipart' },
  { id:'vintage-tulip', name:'Hoa tulip cổ điển', theme:'nature', file:'public/curated/tulip.png', width:800, height:1809, source:'https://openclipart.org/detail/302629/early-dwarf-tulip', author:'Openclipart' },
];

export async function mountDesignCollection(studio) {
  const host = document.querySelector('#design-collection');
  if (!host) return;
  host.innerHTML = `<div class="effect-heading"><p class="eyebrow">KHÁM PHÁ HÌNH IN</p><h2>Chọn hình bạn yêu thích</h2><p>Hai hình được tuyển chọn để bạn thử thiết kế. Bạn cũng có thể sử dụng hình ảnh của riêng mình.</p></div>
  <div class="curated-actions"><label>Danh mục hình in <select id="collection-theme"><option value="all">Tất cả hình tuyển chọn</option><option value="zodiac">Cung hoàng đạo</option><option value="nature">Hoa & thiên nhiên</option></select></label><button id="collection-custom" class="inspect-button">Tự thiết kế với ảnh của bạn</button></div>
  <div id="collection-grid" class="curated-grid"></div><p class="curated-note">Đây là hình in tham khảo, chưa phải ảnh áo đã sản xuất. Bạn có thể tìm hình trên Google, tải về thiết bị rồi chọn ảnh trong Studio. Chỉ sử dụng hình mà bạn có quyền in và sử dụng.</p>`;
  const grid = host.querySelector('#collection-grid');
  const select = host.querySelector('#collection-theme');
  function createDesign(d) {
    studio.newDesign({productId:null, productName:'Áo tự thiết kế · '+d.name, type:'crew', color:'#f8f6ee', faces:{front:[{kind:'image',src:d.file,artworkId:d.id,naturalWidth:d.width,x:300,y:320,width:175,height: d.theme === 'nature' ? 220 : 175,angle:0}],back:[]}});
  }
  function render() {
    grid.replaceChildren();
    for (const d of designs.filter(d => select.value === 'all' || select.value === d.theme)) {
      const card = document.createElement('article'); card.className='curated-card'; card.dataset.designId=d.id;
      const img=document.createElement('img'); img.src=d.file; img.alt='Hình in '+d.name; img.loading='lazy';
      const title=document.createElement('h3'); title.textContent=d.name;
      const source=document.createElement('a'); source.href=d.source; source.textContent='Nguồn: '+d.author; source.target='_blank'; source.rel='noopener';
      const button=document.createElement('button'); button.className='collection-use'; button.textContent='Thử hình này'; button.onclick=()=>createDesign(d);
      card.append(img,title,source,button); grid.append(card);
    }
  }
  select.onchange=render;
  host.querySelector('#collection-custom').onclick=()=>studio.newDesign({productId:null,productName:'Áo tự thiết kế',type:'crew',color:'#f8f6ee',faces:{front:[],back:[]}});
  render(); host.dataset.ready='true';
}
