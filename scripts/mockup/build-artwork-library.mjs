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
};

function describe(id, svgText) {
  if (EXTRA[id]) return { ...EXTRA[id], license: 'Original project artwork (MIT) — drawn for Áo In Studio P3', source: 'project-p3' };
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
