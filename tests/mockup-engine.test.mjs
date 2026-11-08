/**
 * P3 mockup engine + data integrity tests.
 * Guards: quad maths, cache keys, garment/artwork/mockup manifests,
 * the compositing rules (APPROVED only, never on worn photos), and the
 * standing ban on Pexels 9558713.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  RENDERER_VERSION, validateQuad, buildWarpMesh, quadPoint, scaleQuad,
  mockupCacheKey, artworkHash, compositingBases, zoneFor,
} from '../src/mockup-engine/engine.js';

const root = path.resolve(fileURLToPath(new URL('../', import.meta.url)));
const readJson = async rel => JSON.parse(await readFile(path.join(root, rel), 'utf8'));
const QUAD = [[0.315, 0.375], [0.515, 0.375], [0.52, 0.585], [0.31, 0.585]];

test('validateQuad accepts a convex in-range quad and rejects bad ones', () => {
  assert.equal(validateQuad(QUAD).ok, true);
  assert.equal(validateQuad([[0, 0], [1.2, 0], [1, 1], [0, 1]]).ok, false);
  assert.equal(validateQuad([[0.1, 0.1], [0.9, 0.9], [0.9, 0.1], [0.1, 0.9]]).ok, false); // bow-tie
  assert.equal(validateQuad([[0, 0], [1, 0]]).ok, false);
});

test('warp mesh covers the quad and quadPoint hits the corners', () => {
  const mesh = buildWarpMesh(QUAD, 4, 3);
  assert.equal(mesh.length, 4 * 3 * 2);
  assert.deepEqual(quadPoint(QUAD, 0, 0), QUAD[0]);
  assert.deepEqual(quadPoint(QUAD, 1, 1), QUAD[2]);
});

test('scaleQuad grows the zone around its centre and stays in bounds', () => {
  const big = scaleQuad(QUAD, 1.35);
  assert.ok(big[1][0] > QUAD[1][0] && big[0][1] < QUAD[0][1]);
  for (const [x, y] of big) assert.ok(x >= 0 && x <= 1 && y >= 0 && y <= 1);
});

test('cache key is stable, versioned and artwork-sensitive', () => {
  const a = mockupCacheKey({ garmentId: 'G1', artworkHash: 'abc', view: 'front' });
  assert.equal(a, mockupCacheKey({ garmentId: 'G1', artworkHash: 'abc', view: 'front' }));
  assert.ok(a.startsWith(RENDERER_VERSION));
  assert.notEqual(a, mockupCacheKey({ garmentId: 'G1', artworkHash: 'abd', view: 'front' }));
  assert.notEqual(artworkHash('<svg/>'), artworkHash('<svg />'));
});

test('garments.json: compositing only on APPROVED non-worn bases with valid zones', async () => {
  const doc = await readJson('data/garments.json');
  assert.ok(doc.garments.length >= 4);
  const raw = await readFile(path.join(root, 'data/garments.json'), 'utf8');
  assert.ok(!raw.includes('9558713'), 'banned Pexels photo must never enter the garment library');
  for (const g of doc.garments) {
    for (const k of ['garmentId', 'type', 'color', 'sourceStatus', 'verifiedLicense', 'printableZones'])
      assert.ok(k in g, `${g.garmentId} missing ${k}`);
    if (g.wornPhoto) assert.equal(g.compositing.allowed, false, `${g.garmentId}: worn photo must not be a base`);
    if (g.compositing.allowed) {
      assert.equal(g.status, 'APPROVED');
      assert.equal(g.sourceStatus, 'APPROVED');
      const z = zoneFor(g, 'front');
      assert.ok(z.ok, `${g.garmentId}: ${z.reason || 'zone'}`);
      await readFile(path.join(root, g.actualPhotoFront)); // exists
      assert.ok(g.calibration?.maskPolygon?.length >= 3, `${g.garmentId}: mask required`);
    }
  }
  const bases = compositingBases(doc);
  assert.ok(bases.length >= 1, 'pilot needs at least one approved base');
  assert.ok(doc.missingSets.some(s => s.type === 'polo' && s.status === 'MISSING'), 'polo gap must stay explicit');
  assert.ok(doc.missingSets.some(s => s.type === 'oversize' && s.status === 'MISSING'), 'oversize gap must stay explicit');
});

test('zoneFor refuses worn and unapproved garments', async () => {
  const doc = await readJson('data/garments.json');
  const worn = doc.garments.find(g => g.wornPhoto);
  assert.equal(zoneFor(worn, 'front').ok, false);
  assert.equal(zoneFor(null, 'front').ok, false);
});

test('artwork-library.json covers every SVG file exactly once, all licensed', async () => {
  const lib = await readJson('data/artwork-library.json');
  const files = (await readdir(path.join(root, 'public/artwork'))).filter(f => f.endsWith('.svg'));
  assert.equal(lib.designs.length, files.length);
  assert.equal(new Set(lib.designs.map(d => d.designId)).size, lib.designs.length);
  for (const d of lib.designs) {
    assert.equal(d.status, 'APPROVED');
    assert.ok(d.license.length > 10, `${d.designId}: license record required`);
    assert.equal(d.transparent, true);
    await readFile(path.join(root, d.file));
  }
});

test('mockup-manifest.json entries verify against files and libraries', async () => {
  const man = await readJson('data/mockup-manifest.json');
  const garments = await readJson('data/garments.json');
  const lib = await readJson('data/artwork-library.json');
  assert.equal(man.rendererVersion, RENDERER_VERSION);
  assert.ok(man.entries.length >= 6);
  for (const e of man.entries) {
    const buf = await readFile(path.join(root, e.file));
    assert.equal(createHash('sha256').update(buf).digest('hex'), e.sha256, `${e.id}: checksum drift`);
    assert.equal(buf.length, e.bytes);
    assert.ok(garments.garments.some(g => g.garmentId === e.garmentId), `${e.id}: unknown garment`);
    assert.ok(lib.designs.some(d => d.designId === e.artworkId), `${e.id}: unknown artwork`);
    assert.ok(e.fidelity.coverageDelta <= 0.15, `${e.id}: fidelity out of tolerance`);
  }
});
