/**
 * Áo In Studio P3.1 — "Bộ sưu tập hình in" (visible design collection).
 *
 * Every design in data/artwork-library.json is browsable here with an
 * on-shirt preview (pre-rendered by the P3 mockup engine onto the approved
 * crew-white garment photo), theme filters, a garment-type choice and a
 * one-click path into the Studio. Zodiac and animal families collapse into
 * grouped cards with a variant selector so each design stays reachable
 * without flooding the grid.
 */
const THEME_LABELS = {
  couple: 'Áo đôi & tình bạn', family: 'Gia đình', group: 'Hội nhóm & lớp học',
  name: 'Tên cá nhân', date: 'Ngày kỷ niệm', animal: '12 con giáp', zodiac: '12 cung hoàng đạo',
  number: 'Con số', slogan: 'Slogan tiếng Việt', art: 'Phong cảnh & nghệ thuật', birthday: 'Sinh nhật',
  blank: 'Áo trống', 'cafe-viet': 'Cà phê Việt', 'van-hoa': 'Văn hóa & du lịch Việt',
  astronomy: 'Thiên văn', minimal: 'Tối giản', retro: 'Retro / Vintage', pet: 'Thú cưng',
  streetwear: 'Streetwear', nature: 'Thiên nhiên', job: 'Nghề nghiệp & thể thao',
  'y2k-geo': 'Y2K & hình học', holiday: 'Ngày lễ & quà tặng',
};
const FAMILIES = [
  { key: 'zodiac', label: '12 cung hoàng đạo', match: id => /^zodiac-\d+$/.test(id) },
  { key: 'animal', label: '12 con giáp', match: id => /^animal-[a-z]+$/.test(id) },
];

export async function mountDesignCollection(studio) {
  const host = document.querySelector('#design-collection');
  if (!host) return;
  // Perf: the grid is heavy (90+ preview images). Build it when the section
  // approaches the viewport, like the product catalog does — initial page
  // load (and LCP) must not pay for it.
  await new Promise(resolve => {
    const o = new IntersectionObserver(([e]) => { if (e.isIntersecting) { o.disconnect(); resolve(); } }, { rootMargin: '0px' });
    o.observe(host);
  });
  host.innerHTML = `
  <div class="collection-new"><h3>Thiết kế mới</h3><div id="collection-new-row" class="collection-new-row"></div></div>
  <div class="collection-controls">
    <div id="collection-chips" class="catalog-chips" role="group" aria-label="Lọc theo chủ đề"></div>
    <label>Kiểu áo khi dùng hình này<select id="collection-type"><option value="crew">Cổ tròn</option><option value="oversize">Dáng rộng (oversize)</option><option value="polo">Cổ bẻ (polo)</option></select></label>
    <label class="collection-search"><span class="sr-only">Tìm hình in</span><input id="collection-search" type="search" placeholder="Tìm mèo, cà phê, cung hoàng đạo…" autocomplete="off"></label>
    <button id="collection-custom" class="inspect-button">Tự thiết kế từ áo trống</button>
  </div>
  <p id="collection-count" role="status"></p>
  <div id="collection-grid" class="collection-grid"></div>
  <p class="media-note">Ảnh xem trước là ảnh mô phỏng trên áo cổ tròn trắng. Với phom oversize/polo, Studio hiển thị mockup minh họa tương ứng — không dùng ảnh phom khác giả làm phom bạn chọn.</p>`;

  const $ = s => host.querySelector(s);
  let library, previews;
  try {
    const [lib, man, gar] = await Promise.all([
      fetch(new URL('../data/artwork-library.json', import.meta.url)).then(r => r.json()),
      fetch(new URL('../data/mockup-manifest.json', import.meta.url)).then(r => r.json()),
      fetch(new URL('../data/garments.json', import.meta.url)).then(r => r.json()),
    ]);
    library = lib.designs.filter(d => d.status === 'APPROVED');
    // Previews always depict the primary (crew white) base — labelled as such.
    const primaryBase = gar.garments.find(g => g.compositing?.allowed && g.color === '#f8f6ee');
    previews = new Map(man.entries.filter(e => e.view === 'front' && e.variant === 'std' && (!primaryBase || e.garmentId === primaryBase.garmentId)).map(e => [e.artworkId, e.file]));
  } catch {
    $('#collection-count').textContent = 'Chưa tải được thư viện hình in. Bạn vẫn có thể mở Studio phía dưới để tự thiết kế.';
    return;
  }
  // Cards use the 400x600 thumbnails (public/mockups/thumbs/<id>.webp,
  // derived from the full renders); the detail/catalog views keep full size.
  const previewUrl = id => previews.has(id) ? new URL('../public/mockups/thumbs/' + id + '.webp', import.meta.url).href : null;
  const svgUrl = file => new URL('../' + file, import.meta.url).href;

  function useDesign(design) {
    const type = $('#collection-type').value;
    studio.newDesign({
      productId: null, productName: 'Áo tự thiết kế · ' + design.name, type, color: '#f8f6ee',
      faces: {
        front: [{ kind: 'image', src: design.file, artworkId: design.designId, vector: true, naturalWidth: 4000, x: 300, y: 320, width: 175, height: 175, angle: 0 }],
        back: [],
      },
    });
  }

  function card(design, family) {
    const el = document.createElement('article');
    el.className = 'collection-card';
    el.dataset.designId = design.designId;
    const img = new Image();
    img.loading = 'lazy'; img.decoding = 'async'; img.width = 400; img.height = 600;
    const variants = family ? family.members : null;
    const setPreview = d => {
      const p = previewUrl(d.designId);
      img.src = p || svgUrl(d.file);
      img.alt = p ? d.name + ' — xem trước trên áo cổ tròn trắng thật (mô phỏng)' : d.name + ' — hình in gốc';
      img.classList.toggle('is-svg', !p);
    };
    setPreview(design);
    const theme = document.createElement('small');
    theme.textContent = (THEME_LABELS[design.theme] || design.theme) + (design.addedIn !== 'P1' ? ' · Mới' : '');
    const h = document.createElement('h3'); h.textContent = family ? family.label : design.name;
    const desc = document.createElement('p');
    desc.textContent = family ? 'Chọn biến thể bên dưới — mỗi biến thể là một thiết kế riêng.' : (design.description || design.name);
    el.append(img, theme, h, desc);
    let current = design;
    if (family) {
      const sel = document.createElement('select');
      sel.setAttribute('aria-label', 'Chọn biến thể ' + family.label);
      for (const m of family.members) { const o = new Option(m.name, m.designId); sel.append(o); }
      sel.onchange = () => { current = family.members.find(m => m.designId === sel.value) || current; setPreview(current); };
      el.append(sel);
    }
    const btn = document.createElement('button');
    btn.className = 'collection-use inspect-button';
    btn.textContent = 'Dùng hình này';
    btn.onclick = () => useDesign(current);
    el.append(btn);
    return el;
  }

  // "Thiết kế mới" strip: every non-P1 design (P3 + P3.1), newest first.
  const newRow = $('#collection-new-row');
  for (const d of library.filter(d => d.addedIn !== 'P1').reverse()) {
    const item = document.createElement('button');
    item.className = 'collection-new-item';
    item.dataset.designId = d.designId;
    const img = new Image(); img.loading = 'lazy'; img.decoding = 'async'; img.width = 200; img.height = 300;
    img.src = previewUrl(d.designId) || svgUrl(d.file);
    img.alt = d.name + ' — thiết kế mới, xem trước trên áo thật';
    const cap = document.createElement('span'); cap.textContent = d.name;
    item.append(img, cap);
    item.onclick = () => useDesign(d);
    newRow.append(item);
  }

  // Grid items: families collapse; everything else stands alone.
  const grouped = new Set();
  const items = [];
  for (const fam of FAMILIES) {
    const members = library.filter(d => fam.match(d.designId));
    if (members.length) { members.forEach(m => grouped.add(m.designId)); items.push({ design: members[0], family: { ...fam, members } }); }
  }
  for (const d of library) if (!grouped.has(d.designId)) items.push({ design: d, family: null });

  let theme = '';
  const chips = $('#collection-chips');
  const themes = ['', ...new Set(library.map(d => d.theme))];
  for (const t of themes) {
    const b = document.createElement('button');
    b.type = 'button'; b.dataset.theme = t; b.textContent = t ? (THEME_LABELS[t] || t) : 'Tất cả';
    b.onclick = () => { theme = t; render(); };
    chips.append(b);
  }
  function render() {
    const q = $('#collection-search').value.trim().toLowerCase();
    for (const b of chips.querySelectorAll('button')) b.setAttribute('aria-pressed', String(b.dataset.theme === theme));
    const grid = $('#collection-grid');
    grid.replaceChildren();
    let shown = 0;
    for (const it of items) {
      const d = it.design;
      if (theme && d.theme !== theme && !it.family) continue;
      if (theme && it.family && it.family.key !== theme) continue;
      if (q) {
        const hay = (it.family ? it.family.members : [d]).map(m => (m.name + ' ' + (m.tags || []).join(' ') + ' ' + (THEME_LABELS[m.theme] || ''))).join(' ').toLowerCase();
        if (!hay.includes(q)) continue;
      }
      grid.append(card(d, it.family)); shown++;
    }
    $('#collection-count').textContent = shown + ' nhóm/thiết kế · tổng ' + library.length + ' thiết kế trong thư viện';
    if (!shown) { const p = document.createElement('p'); p.className = 'catalog-empty'; p.textContent = 'Chưa có hình in phù hợp. Hãy đổi chủ đề hoặc từ khóa.'; grid.append(p); }
  }
  $('#collection-search').oninput = render;
  $('#collection-custom').onclick = () => studio.newDesign({ productId: null, productName: 'Áo tự thiết kế', type: $('#collection-type').value, color: '#f8f6ee', faces: { front: [], back: [] } });
  render();
  host.dataset.ready = 'true';
}
