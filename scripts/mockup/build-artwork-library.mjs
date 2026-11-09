#!/usr/bin/env node
/**
 * Áo In Studio P3 — build data/artwork-library.json from public/artwork/*.svg.
 *
 * The 55 P1 artworks are original project files (MIT). Names/themes are
 * derived from src/artwork-library.js data so the library can never drift
 * from the Studio's own personalisation schemas. New hand-drawn designs
 * (public/artwork/p3-*.svg) are added through EXTRA below with their own
 * license/source records.
 */
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { animals, zodiacs, schemas } from '../../src/artwork-library.js';
import { artworkHash } from '../../src/mockup-engine/engine.js';

const root = path.resolve(fileURLToPath(new URL('../../', import.meta.url)));

const SINGLE = {
  'birthday': { name: 'Bánh sinh nhật', theme: 'birthday' },
  'calendar': { name: 'Tờ lịch kỷ niệm', theme: 'date' },
  'vintage': { name: 'Huy hiệu năm sinh', theme: 'date' },
  'coffee': { name: 'Cà phê rồi tính', theme: 'slogan' },
  'couple-sun': { name: 'Mặt trời · áo đôi', theme: 'couple' },
  'couple-moon': { name: 'Mặt trăng · áo đôi', theme: 'couple' },
  'family': { name: 'Gia đình · khung chung', theme: 'family' },
  'group': { name: 'Hội nhóm · cùng một đội', theme: 'group' },
  'landscape': { name: 'Nắng trên vai · phong cảnh', theme: 'art' },
  'name': { name: 'Khung tên cá nhân', theme: 'name' },
  'number': { name: 'Con số yêu thích', theme: 'number' },
};
const ROLES = ['Bố', 'Mẹ', 'Con 1', 'Con 2', 'Con 3', 'Con 4'];
/** New P3 original designs (drawn for this project, same SVG house style). */
const EXTRA = {
  'p3-cafe-phin': { name: 'Phin cà phê Việt', theme: 'cafe-viet', tags: ['cà phê', 'phin', 'việt nam'] },
  'p3-xe-dap-pho': { name: 'Xe đạp phố cổ', theme: 'van-hoa', tags: ['phố cổ', 'xe đạp', 'việt nam'] },
  'p3-trang-tuan-hoan': { name: 'Tuần hoàn mặt trăng', theme: 'astronomy', tags: ['mặt trăng', 'sao', 'vũ trụ'] },
  'p3-la-nho-nguc': { name: 'Lá nhỏ trên ngực', theme: 'minimal', tags: ['tối giản', 'lá', 'ngực trái'] },
  'p3-retro-sun': { name: 'Mặt trời retro', theme: 'retro', tags: ['retro', 'mặt trời', 'sọc'] },
  'p3-meo-tim': { name: 'Mèo và trái tim', theme: 'pet', tags: ['mèo', 'thú cưng', 'tim'] },
  // P3.1 batch — original designs drawn for the visible design collection.
  'p31-song-am': { name: 'Sóng âm thành phố', theme: 'streetwear', tags: ['streetwear', 'sóng âm', 'thành phố'], desc: 'Vòng sóng âm đồng tâm trên silhouette phố — in lớn mặt sau rất hợp.' },
  'p31-chibi-non-la': { name: 'Chibi đội nón lá', theme: 'streetwear', tags: ['chibi', 'nón lá', 'gốc', 'dễ thương'], desc: 'Nhân vật chibi do studio tự sáng tác, đội nón lá Việt Nam.' },
  'p31-bang-cassette': { name: 'Băng cassette hoàng hôn', theme: 'retro', tags: ['retro', 'cassette', 'thập niên 80'], desc: 'Băng cát-xét nét line-art trên dải sọc hoàng hôn.' },
  'p31-cung-hoang-hon': { name: 'Cầu vồng hoàng hôn retro', theme: 'retro', tags: ['retro', 'hoàng hôn', 'vòng cung'], desc: 'Ba vòng cung màu hoàng hôn — nền đẹp cho dòng chữ cong của bạn.' },
  'p31-mot-net-song': { name: 'Một nét sóng', theme: 'minimal', tags: ['tối giản', 'sóng', 'một nét'], desc: 'Một đường sóng liền nét duy nhất. Ít mà chất.' },
  'p31-mat-troi-bien': { name: 'Mặt trời trên biển', theme: 'minimal', tags: ['tối giản', 'biển', 'mặt trời'], desc: 'Nửa mặt trời và ba vạch sóng — khổ nhỏ ở ngực trái.' },
  'p31-dau-chan-tim': { name: 'Dấu chân boss', theme: 'pet', tags: ['thú cưng', 'dấu chân', 'tim'], desc: 'Dấu chân thú cưng với trái tim ở đệm chân — thêm tên boss bên dưới.' },
  'p31-meo-cuon': { name: 'Mèo cuộn tròn ngủ', theme: 'pet', tags: ['mèo', 'ngủ', 'tròn'], desc: 'Mèo cuộn thành vòng tròn ngủ say, nét liền mềm mại.' },
  'p31-ruong-bac-thang': { name: 'Ruộng bậc thang', theme: 'van-hoa', tags: ['ruộng bậc thang', 'việt nam', 'phong cảnh'], desc: 'Đường cong đồng mức ruộng bậc thang và mặt trời nhỏ.' },
  'p31-den-long': { name: 'Đèn lồng dưới trăng', theme: 'van-hoa', tags: ['đèn lồng', 'trung thu', 'trăng'], desc: 'Đèn lồng đỏ treo dưới trăng khuyết — hợp mùa lễ hội.' },
  'p31-phin-nho-giot': { name: 'Phin nhỏ giọt', theme: 'cafe-viet', tags: ['cà phê', 'phin', 'nhỏ giọt'], desc: 'Phin đang nhỏ giọt xuống ly — khoảnh khắc cà phê Việt kinh điển.' },
  'p31-cafe-sua-da': { name: 'Cà phê sữa đá', theme: 'cafe-viet', tags: ['cà phê', 'sữa đá', 'ly cao'], desc: 'Ly cà phê đá hai lớp rõ rệt, đá viên và ống hút.' },
  'p31-nua-troi': { name: 'Nửa mặt trời · nửa mặt trăng', theme: 'couple', tags: ['áo đôi', 'mặt trời', 'mặt trăng'], desc: 'Một hình tròn hai nửa ngày/đêm — in giống nhau cho hai chiếc áo đôi.' },
  'p31-cay-gia-dinh': { name: 'Cây gia đình', theme: 'family', tags: ['gia đình', 'cây', 'thành viên'], desc: 'Thân cây và năm tán lá tròn — mỗi lá là một thành viên.' },
  'p31-huy-hieu-nghe': { name: 'Huy hiệu nghề của tôi', theme: 'job', tags: ['nghề nghiệp', 'huy hiệu', 'cờ lê'], desc: 'Khung huy hiệu và cờ lê — thêm tên nghề của bạn ở Studio.' },
  'p31-duong-chay': { name: 'Đường chạy của tôi', theme: 'job', tags: ['chạy bộ', 'thể thao', 'về đích'], desc: 'Một đường chạy liền nét tới lá cờ đích — ghi tên giải chạy của bạn.' },
  'p31-nui-hinh-hoc': { name: 'Dãy núi hình học', theme: 'nature', tags: ['núi', 'hình học', 'thiên nhiên'], desc: 'Ba lớp núi tam giác và mặt trời — bản tĩnh của tinh thần Hồ núi.' },
  'p31-vong-la': { name: 'Vòng lá và trái tim', theme: 'nature', tags: ['vòng lá', 'thiên nhiên', 'tim'], desc: 'Vòng nguyệt quế lá ôm trái tim nhỏ ở giữa.' },
  'p31-cua-so-pixel': { name: 'Cửa sổ pixel', theme: 'y2k-geo', tags: ['y2k', 'pixel', 'máy tính'], desc: 'Cửa sổ trình duyệt đời đầu và con trỏ sao — chất Y2K.' },
  'p31-banh-sinh-nhat': { name: 'Bánh sinh nhật tối giản', theme: 'birthday', tags: ['sinh nhật', 'bánh', 'quà tặng'], desc: 'Bánh hai tầng, một ngọn nến — thêm tuổi và tên ở Studio.' },
  'p31-doi-hinh': { name: 'Đội hình ra sân', theme: 'group', tags: ['hội nhóm', 'đội', 'đồng phục'], desc: 'Ba chiếc áo xếp hàng với huy hiệu số — cho team và lớp học.' },
  'p31-canh-mai-tet': { name: 'Cành mai ngày Tết', theme: 'holiday', tags: ['tết', 'hoa mai', 'ngày lễ'], desc: 'Cành mai năm cánh trong khung tròn huy hiệu — quà Tết ý nghĩa.' },
};

function describe(id, svgText) {
  if (EXTRA[id]) return { ...EXTRA[id], license: 'Original project artwork (MIT) — drawn for Áo In Studio', source: id.startsWith('p31-') ? 'project-p31' : 'project-p3' };
  let m;
  if ((m = id.match(/^animal-([a-z]+)$/))) {
    const a = animals.find(([k]) => k === m[1]);
    return { name: `Con giáp ${a ? a[1] : m[1]}`, theme: 'animal', license: 'Original project artwork (MIT) — drawn for Áo In Studio', source: 'project-p1' };
  }
  if ((m = id.match(/^zodiac-(\d+)$/))) {
    return { name: `Cung ${zodiacs[Number(m[1])] || m[1]}`, theme: 'zodiac', license: 'Original project artwork (MIT) — drawn for Áo In Studio', source: 'project-p1' };
  }
  if ((m = id.match(/^family-(\d+)-(\d+)$/))) {
    return { name: `Gia đình ${m[1]} thành viên · ${ROLES[Number(m[2])] || 'thành viên'}`, theme: 'family', license: 'Original project artwork (MIT) — drawn for Áo In Studio', source: 'project-p1' };
  }
  if (SINGLE[id]) return { ...SINGLE[id], license: 'Original project artwork (MIT) — drawn for Áo In Studio', source: 'project-p1' };
  return { name: id, theme: 'art', license: 'Original project artwork (MIT) — drawn for Áo In Studio', source: 'project-p1' };
}

export async function buildArtworkLibrary() {
  const dir = path.join(root, 'public/artwork');
  const files = (await readdir(dir)).filter(f => f.endsWith('.svg')).sort();
  const designs = [];
  for (const file of files) {
    const id = file.replace(/\.svg$/, '');
    const text = await readFile(path.join(dir, file), 'utf8');
    const d = describe(id, text);
    designs.push({
      designId: id,
      name: d.name,
      theme: d.theme,
      tags: d.tags || [d.theme, id],
      file: `public/artwork/${file}`,
      format: 'svg',
      transparent: true,
      personalisable: (schemas[d.theme]?.length || 0) > 0,
      placements: ['front', 'back'],
      garmentTypes: ['crew', 'oversize', 'polo'],
      license: d.license,
      source: d.source,
      description: d.desc || '',
      addedIn: d.source === 'project-p1' ? 'P1' : d.source === 'project-p31' ? 'P3.1' : 'P3',
      artworkHash: artworkHash(text),
      status: 'APPROVED',
    });
  }
  const doc = {
    version: 1,
    updated: '2026-11-09',
    note: 'Thư viện hình in Áo In Studio. Sinh bởi scripts/mockup/build-artwork-library.mjs từ public/artwork/*.svg — sửa file SVG rồi chạy lại script, không sửa tay JSON này. Chỉ thiết kế status=APPROVED mới được phát hành.',
    count: designs.length,
    designs,
  };
  await writeFile(path.join(root, 'data/artwork-library.json'), JSON.stringify(doc, null, 1) + '\n');
  return doc;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const doc = await buildArtworkLibrary();
  console.log(`artwork-library: ${doc.count} designs written`);
}
