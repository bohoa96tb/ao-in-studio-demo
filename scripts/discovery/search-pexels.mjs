#!/usr/bin/env node
/**
 * Áo In Studio P3.1 — SOURCE DISCOVERY (stage B), kept strictly separate
 * from the Inventory Scan (stage A, scripts/discovery/scan.mjs).
 *
 * This is the only step that looks OUTSIDE the repository: it queries the
 * official Pexels API for new blank-garment candidates matching the gaps
 * recorded in data/garments.json. It requires a Pexels API key provided as
 * the PEXELS_API_KEY environment variable (GitHub Actions Secret in CI).
 *
 * Without a key it reports NOT CONFIGURED and invents nothing — source
 * discovery is then simply not implemented yet, by design.
 *
 * It never downloads photos and never approves anything: results are
 * written as status=CANDIDATE rows for the human verification pipeline
 * (stage C: per-photo page + EXIF + visual check, as in P2/P3).
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(fileURLToPath(new URL('../../', import.meta.url)));
const key = process.env.PEXELS_API_KEY;
const QUERIES = [
  'blank t-shirt back view',
  'blank oversized t-shirt',
  'blank polo shirt product',
  'white t-shirt flat lay back',
  't-shirt fabric texture close up',
];

async function main() {
  await mkdir(path.join(root, 'qa-results'), { recursive: true });
  if (!key) {
    const msg = [
      '# P3 Source Discovery — NOT CONFIGURED',
      '',
      'PEXELS_API_KEY is not set, so no external search was performed.',
      'Add the key as a GitHub Actions Secret (repo Settings → Secrets) to enable stage B.',
      'Nothing was downloaded, approved or fabricated by this run.',
      '',
    ].join('\n');
    await writeFile(path.join(root, 'qa-results/p3-source-discovery.md'), msg);
    console.log('SOURCE DISCOVERY: NOT CONFIGURED (PEXELS_API_KEY missing) — no search performed.');
    return;
  }
  const found = [];
  for (const q of QUERIES) {
    const res = await fetch('https://api.pexels.com/v1/search?per_page=15&query=' + encodeURIComponent(q), {
      headers: { Authorization: key },
    });
    if (!res.ok) throw new Error(`Pexels API ${res.status} for query "${q}"`);
    const data = await res.json();
    for (const ph of data.photos || []) {
      found.push({
        id: `pexels-${ph.id}`, platform: 'Pexels', sourceUrl: ph.url,
        author: ph.photographer || '', width: ph.width, height: ph.height,
        query: q, status: 'CANDIDATE',
        note: 'Từ Source Discovery tự động — CHƯA thẩm định. Phải qua stage C: đọc trang nguồn, kiểm tra EXIF, xem ảnh trực tiếp, đối chiếu danh sách REJECTED trước khi dùng.',
      });
    }
  }
  const out = { generatedAt: new Date().toISOString(), stage: 'B-source-discovery', count: found.length, candidates: found };
  await writeFile(path.join(root, 'qa-results/p3-source-candidates.json'), JSON.stringify(out, null, 1) + '\n');
  console.log(`SOURCE DISCOVERY: ${found.length} CANDIDATE rows written to qa-results/p3-source-candidates.json (unverified — stage C required).`);
}
await main();
