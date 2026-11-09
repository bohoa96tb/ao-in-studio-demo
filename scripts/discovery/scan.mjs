#!/usr/bin/env node
/**
 * Áo In Studio P3.1 — INVENTORY SCAN (stage A only).
 *
 * This step inspects data the project ALREADY has. It is NOT internet
 * source discovery — that is stage B, scripts/discovery/search-pexels.mjs.
 *
 * Reads the garment library + candidate queue and writes a gap report.
 * It never downloads images and never approves anything: sources without a
 * lawful API or with unclear terms stay as human-review queue entries.
 * Output: qa-results/p3-discovery-report.md (CI artifact) or stdout.
 */
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(fileURLToPath(new URL('../../', import.meta.url)));
const garments = JSON.parse(await readFile(path.join(root, 'data/garments.json'), 'utf8'));
const candidates = JSON.parse(await readFile(path.join(root, 'data/candidates.json'), 'utf8'));
const library = JSON.parse(await readFile(path.join(root, 'data/artwork-library.json'), 'utf8'));

const lines = [];
lines.push('# P3 Inventory Scan (stage A — internal data only)');
lines.push('');
lines.push(`Generated: ${new Date().toISOString()}`);
lines.push('');
lines.push('## Garment library coverage');
for (const type of ['crew', 'oversize', 'polo']) {
  const sets = garments.garments.filter(g => g.type === type);
  const bases = sets.filter(g => g.compositing?.allowed);
  lines.push(`- ${type}: ${sets.length} record(s), ${bases.length} compositing base(s)`);
}
lines.push('');
lines.push('## Missing sets (must stay explicit until a verified source is approved)');
for (const m of garments.missingSets || []) lines.push(`- [${m.status}] ${m.type}: ${m.need}`);
for (const g of garments.garments)
  if (g.missing?.length) lines.push(`- ${g.garmentId} missing: ${g.missing.join(', ')}`);
lines.push('');
lines.push('## Candidate queue');
const byStatus = {};
for (const c of candidates.candidates) (byStatus[c.status] ||= []).push(c);
for (const [status, list] of Object.entries(byStatus))
  lines.push(`- ${status}: ${list.length} (${list.map(c => c.id).join(', ')})`);
if (!candidates.candidates.length) lines.push('- (empty)');
lines.push('');
lines.push(`## Artwork library: ${library.count} designs (${library.designs.filter(d => d.status === 'APPROVED').length} APPROVED)`);
lines.push('');
lines.push('Next human step: review CANDIDATE entries in data/candidates.json; approved garments move into data/garments.json with calibration before any compositing.');

const report = lines.join('\n') + '\n';
if (process.argv.includes('--write')) {
  await mkdir(path.join(root, 'qa-results'), { recursive: true });
  await writeFile(path.join(root, 'qa-results/p3-discovery-report.md'), report);
  console.log('wrote qa-results/p3-discovery-report.md');
} else console.log(report);
