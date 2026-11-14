// AI Studio P3 unit tests: homography correctness, wrinkle displacement field,
// cover/contain fit math, channel preset table, P1->P3 composition migration,
// template upgrades (Template 1 perspective, Template 2 background + channels).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NODE_DEFS, NODE_TYPES, TEMPLATES, makeNode, DEMO_FIGURE } from '../src/ai-studio/core.js';
import {
  solveHomography, applyHomography, UNIT_SQUARE, rectToQuad, presetQuadFor,
  migrateCompositionConfig, fieldMean, sampleField, displacementAt,
  buildWarpGrid, fitInto, CHANNEL_PRESETS, channelPreset, channelFileName,
  channelFitMode, coverRetainedFraction, COVER_MIN_RETAINED,
  chestQuadFor, GARMENT_QUADS, torsoQuadFor, FIXTURE_LANDMARKS, AI_MODEL_QUADS,
} from '../src/ai-studio/warp.js';

const near = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps;

test('homography maps the 4 unit-square corners exactly onto the quad corners', () => {
  const quad = [[0.31, 0.37], [0.52, 0.35], [0.55, 0.6], [0.3, 0.62]];
  const H = solveHomography(UNIT_SQUARE, quad);
  UNIT_SQUARE.forEach(([u, v], i) => {
    const [x, y] = applyHomography(H, u, v);
    assert.ok(near(x, quad[i][0], 1e-9), `corner ${i} x: ${x} vs ${quad[i][0]}`);
    assert.ok(near(y, quad[i][1], 1e-9), `corner ${i} y: ${y} vs ${quad[i][1]}`);
  });
});

test('homography of the identity quad is (numerically) the identity', () => {
  const H = solveHomography(UNIT_SQUARE, UNIT_SQUARE);
  const I = [1, 0, 0, 0, 1, 0, 0, 0];
  H.forEach((v, i) => assert.ok(near(v, I[i], 1e-9), `H[${i}] = ${v}`));
  const [x, y] = applyHomography(H, 0.37, 0.73);
  assert.ok(near(x, 0.37) && near(y, 0.73));
});

test('projected centre lies at the intersection of the quad diagonals', () => {
  const quad = [[0.2, 0.15], [0.75, 0.25], [0.68, 0.8], [0.28, 0.66]];
  const H = solveHomography(UNIT_SQUARE, quad);
  const c = applyHomography(H, 0.5, 0.5);
  // diagonal intersection of quad (TL-BR) x (TR-BL)
  const [p, r] = [quad[0], quad[2]]; const [q, s] = [quad[1], quad[3]];
  const d = (r[0] - p[0]) * (s[1] - q[1]) - (r[1] - p[1]) * (s[0] - q[0]);
  const t = ((q[0] - p[0]) * (s[1] - q[1]) - (q[1] - p[1]) * (s[0] - q[0])) / d;
  const ix = p[0] + t * (r[0] - p[0]), iy = p[1] + t * (r[1] - p[1]);
  assert.ok(near(c[0], ix, 1e-9) && near(c[1], iy, 1e-9), `centre ${c} vs diagonal intersection ${[ix, iy]}`);
});

test('warp grid without displacement lands every vertex on the homography', () => {
  const quadPx = [[100, 80], [300, 60], [320, 300], [90, 320]];
  const H = solveHomography(UNIT_SQUARE, quadPx);
  const grid = buildWarpGrid(quadPx, 4, 4, null);
  const v = grid[2][3]; // u=0.75, v=0.5
  const [ex, ey] = applyHomography(H, 0.75, 0.5);
  assert.ok(near(v.dst[0], ex, 1e-9) && near(v.dst[1], ey, 1e-9));
});

test('wrinkle displacement: zero at strength 0, grows monotonically with strength and deviation', () => {
  // synthetic luminance grid: dark at top (0.2), bright at bottom (0.9)
  const grid = Array.from({ length: 5 }, (_, j) => Array.from({ length: 5 }, () => 0.2 + 0.7 * (j / 4)));
  const mean = fieldMean(grid);
  assert.ok(near(mean, 0.55, 1e-9));
  assert.ok(near(sampleField(grid, 0.5, 1), 0.9, 1e-9));
  const at = (s) => displacementAt(grid, mean, 0.5, 1, s);
  assert.deepEqual(at(0), [0, 0]);
  const d30 = at(30), d60 = at(60), d100 = at(100);
  assert.ok(d30[1] > 0 && d60[1] > d30[1] && d100[1] > d60[1], 'vertical displacement grows with strength');
  assert.ok(near(d100[1], (0.9 - 0.55) * 0.10, 1e-9), 'amplitude = deviation x strength x AMP_V');
  // a point at the mean luminance does not move
  const mid = displacementAt(grid, mean, 0.5, 0.5, 100);
  assert.ok(near(mid[0], 0, 1e-9) && near(mid[1], 0, 1e-9));
  // flat field (no folds) never displaces
  const flat = Array.from({ length: 3 }, () => [0.5, 0.5, 0.5]);
  assert.deepEqual(displacementAt(flat, fieldMean(flat), 0.2, 0.8, 100), [0, 0]);
});

test('fitInto cover: 800x600 into 1080x1920 crops the source width, fills the frame', () => {
  const f = fitInto(800, 600, 1080, 1920, 'cover');
  assert.equal(f.dw, 1080); assert.equal(f.dh, 1920); assert.equal(f.dx, 0); assert.equal(f.dy, 0);
  // scale = max(1080/800, 1920/600) = 3.2 -> visible source width 1080/3.2
  assert.ok(near(f.sw, 337.5) && near(f.sh, 600));
  assert.ok(near(f.sx, (800 - 337.5) / 2) && near(f.sy, 0));
});

test('fitInto contain: 800x600 into 1080x1920 letterboxes top/bottom', () => {
  const f = fitInto(800, 600, 1080, 1920, 'contain');
  assert.ok(near(f.sw, 800) && near(f.sh, 600) && near(f.sx, 0) && near(f.sy, 0));
  assert.ok(near(f.dw, 1080) && near(f.dh, 810));
  assert.ok(near(f.dx, 0) && near(f.dy, (1920 - 810) / 2));
});

test('channel presets: the 6 sales channels, unique ids, positive dims', () => {
  assert.equal(CHANNEL_PRESETS.length, 6);
  assert.equal(new Set(CHANNEL_PRESETS.map(c => c.id)).size, 6);
  for (const c of CHANNEL_PRESETS) assert.ok(c.w > 0 && c.h > 0 && c.label && (c.fit === 'cover' || c.fit === 'contain'));
  assert.deepEqual([channelPreset('tiktok').w, channelPreset('tiktok').h], [1080, 1920]);
  assert.deepEqual([channelPreset('shopee').w, channelPreset('shopee').h], [1024, 1024]);
  assert.deepEqual([channelPreset('website').w, channelPreset('website').h], [1200, 1500]);
  assert.equal(channelPreset('khong-co'), null);
  assert.equal(channelFileName(channelPreset('tiktok'), 'jpg'), 'tiktok-1080x1920.jpg');
  assert.equal(channelFileName(channelPreset('shopee'), 'png', 'ao-xuan'), 'ao-xuan-shopee-1024x1024.png');
});

test('channelFitMode (P4.2 round-4 correction): extreme-aspect cover falls back to contain', () => {
  const website = channelPreset('website'); // 1200x1500 cover
  // The AI oversize base 1040x2352: cover would keep 1500/2714 ≈ 55% of
  // the height — head and hem cut — so it must fall back to contain.
  assert.ok(coverRetainedFraction(1040, 2352, website.w, website.h) < COVER_MIN_RETAINED);
  assert.equal(channelFitMode(1040, 2352, website), 'contain');
  // The crew bases 1280x1920 keep 83% under website cover — unchanged.
  assert.ok(near(coverRetainedFraction(1280, 1920, website.w, website.h), 1500 / 1800, 1e-9));
  assert.equal(channelFitMode(1280, 1920, website), 'cover');
  // Ordinary sources on other cover channels stay cover.
  assert.equal(channelFitMode(900, 1125, channelPreset('tiktok')), 'cover');
  assert.equal(channelFitMode(900, 1125, channelPreset('facebook')), 'cover');
  assert.equal(channelFitMode(800, 1200, channelPreset('shopee')), 'cover');
  // Preset contain channels are never rewritten.
  assert.equal(channelFitMode(1040, 2352, channelPreset('website-vuong')), 'contain');
  assert.equal(channelFitMode(1040, 2352, channelPreset('facebook-ngang')), 'contain');
});

test('rectToQuad equals the P1 rectangle corners', () => {
  assert.deepEqual(rectToQuad(50, 42, 34), [[0.33, 0.25], [0.67, 0.25], [0.67, 0.59], [0.33, 0.59]]);
  assert.deepEqual(rectToQuad(), rectToQuad(50, 42, 34)); // P1 defaults
});

test('P1 composition config migrates to perspective mode with the equivalent quad', () => {
  const p1 = { base: 'x.webp', printX: 50, printY: 42, printW: 34, rotation: 0, label: 'L' };
  const m = migrateCompositionConfig(p1);
  assert.equal(m.mode, 'perspective');
  assert.deepEqual(m.quad, rectToQuad(50, 42, 34));
  assert.equal(m.wrinkle, 35); assert.equal(m.shading, 45);
  // quad corners equal the old rectangle's corners (x from printX±printW/2, y likewise)
  assert.deepEqual(m.quad[0], [(50 - 17) / 100, (42 - 17) / 100]);
  assert.deepEqual(m.quad[2], [(50 + 17) / 100, (42 + 17) / 100]);
});

test('P1 config with a rotation keeps simple mode (exact P1 rendering preserved)', () => {
  const m = migrateCompositionConfig({ printX: 50, printY: 42, printW: 34, rotation: 15 });
  assert.equal(m.mode, 'simple');
});

test('garment preset quads exist for the calibrated hanger fixtures', () => {
  // P4.2 round 3: preset quads are derived with torsoQuadFor from the
  // fixtures' measured LANDMARKS (owner's torso rule — gap 12–15% of
  // torso length below the collar, width 35–45% of torso width). This
  // supersedes the round-1 chestQuadFor collar calibration (whose
  // white-hanger quad the owner still found wrongly placed) and the
  // P3-era quad (top 0.375, ~4.5% below the collar — print on the neck).
  const hp = 'public/fixtures/real-tee/crew-white-hanger.webp';
  assert.deepEqual(presetQuadFor(hp), torsoQuadFor(FIXTURE_LANDMARKS[hp], { imgW: 800, imgH: 1200 }));
  assert.ok(presetQuadFor('public/fixtures/real-tee/crew-black-hanger.webp'));
  assert.equal(presetQuadFor('khong-co.webp'), null);
  assert.ok(chestQuadFor, 'legacy chestQuadFor remains exported for P1-era callers');
});

test('node registry: 13 node types including background; defaults carry P3 fields', () => {
  assert.equal(NODE_TYPES.length, 13);
  assert.ok(NODE_DEFS.background, 'background node exists');
  assert.equal(NODE_DEFS.background.inputs[0].type, 'image');
  assert.equal(NODE_DEFS.background.outputs[0].type, 'image');
  const comp = makeNode('composition', 0, 0);
  assert.equal(comp.config.mode, 'perspective');
  assert.ok(Array.isArray(comp.config.quad) && comp.config.quad.length === 4);
  const exp = makeNode('exportNode', 0, 0);
  assert.deepEqual(exp.config.channels, []);
});

test('templates: T1 uses perspective composition; T2 has background + channel export', () => {
  const t1 = TEMPLATES.find(t => t.id === 'tpl1').make();
  const comp = t1.nodes.find(n => n.type === 'composition');
  assert.equal(comp.config.mode, 'perspective');
  // P4.1 (owner-mandated): Template 1's composition targets the AI/demo
  // model photo. P4.2 ROUND 4 (R1): its stored default quad is the
  // torso-rule quad of the DEFAULT garment case's base — white crew →
  // the owner-approved AI model base (AI_MODEL_QUADS) — while the
  // generated value's own calibrated baseQuad still wins at run time,
  // and the hanger preset quad remains the calibrated quad of the
  // real-photo fallback (garmentSource 'real').
  assert.deepEqual(comp.config.quad, AI_MODEL_QUADS['public/fixtures/ai-model/model-white-crew.webp']);
  const t2 = TEMPLATES.find(t => t.id === 'tpl2').make();
  const bg = t2.nodes.find(n => n.type === 'background');
  assert.ok(bg, 'tpl2 contains the background node');
  assert.ok(t2.edges.some(e => e.to === bg.id), 'background node is wired in');
  const exp = t2.nodes.find(n => n.type === 'exportNode');
  assert.ok(exp.config.channels.length >= 2 && exp.config.channels.includes('shopee'));
  assert.ok(t2.edges.some(e => e.from === bg.id && e.to === exp.id), 'background feeds the export node');
});
