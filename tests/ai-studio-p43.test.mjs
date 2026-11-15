// AI Studio P4.3 unit tests — tighten the real-AI framing path (owner
// order 2026-11-15). The owner's FIRST real Pollinations Classic run on
// the live site returned a sana CLOSE-UP (768×1024-class, h/w ≈ 1.33,
// watermark, blurry) that PASSED the P4.2 framing guard (band
// [1.10, 2.05]) and was composited — not the approved half-body
// framing. P4.3 changes exactly three behaviours:
//   1. The guard's pass band is now h/w ∈ [1.45, 2.10] ('portrait-short'
//      is the new fail class for 4:5 / 3:4 outputs). The guard stays
//      aspect-only — NO pseudo landmark/face detection is claimed.
//   2. The catalog garment prompt (Template 1) requests the 2:3 size
//      class on the real path — the tallest portrait each adapter
//      legitimately supports (keyed 1024×1536; Classic 512×768, inside
//      its ≤768 cap).
//   3. The composition node gains framingGuard: 'strict' (default —
//      fail → approved-base fallback) | 'allow' (user's explicit choice
//      to composite onto the off-standard AI image, honestly labelled).
// Plus the cache-safety build bump: AI_STUDIO_BUILD === 'p43' at P4.3
// (P4.4 bumps it again to 'p44' — the marker assertion below follows).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AI_STUDIO_BUILD, TEMPLATES, NODE_DEFS } from '../src/ai-studio/core.js';
import { framingAspectClass, passesHalfBodyFraming, migrateCompositionConfig } from '../src/ai-studio/warp.js';
import { sizeForRatio, clampClassicSize } from '../src/ai-studio/providers.js';

// ---------- 1. the tightened band: exact edge matrix ----------
test('P4.3 band — the owner’s live failure class now fails: 3:4 (1.33) and 4:5 (1.25)', () => {
  assert.equal(framingAspectClass(768, 1024), 'portrait-short', '768×1024 — the actual sana output class from the live run');
  assert.equal(passesHalfBodyFraming(768, 1024), false, 'h/w 1.33 must FAIL');
  assert.equal(framingAspectClass(1024, 1280), 'portrait-short');
  assert.equal(passesHalfBodyFraming(1024, 1280), false, 'h/w 1.25 (4:5) must FAIL');
  assert.equal(passesHalfBodyFraming(614, 768), false, 'the old Classic 4:5 request size fails too');
});

test('P4.3 band — half-body portraits pass: 2:3 (1.50) and 9:16 (1.78)', () => {
  assert.equal(framingAspectClass(1024, 1536), 'portrait-half-body');
  assert.equal(passesHalfBodyFraming(1024, 1536), true, 'h/w 1.50 (2:3) must PASS');
  assert.equal(passesHalfBodyFraming(1280, 1920), true, 'the approved AI bases’ own aspect (1.50)');
  assert.equal(passesHalfBodyFraming(512, 768), true, 'the Classic 2:3 request size class passes');
  assert.equal(framingAspectClass(720, 1280), 'portrait-half-body');
  assert.equal(passesHalfBodyFraming(720, 1280), true, 'h/w 1.78 (9:16) must PASS');
});

test('P4.3 band — too tall fails (2.20), and the exact edges behave', () => {
  assert.equal(framingAspectClass(1000, 2200), 'extreme-portrait');
  assert.equal(passesHalfBodyFraming(1000, 2200), false, 'h/w 2.20 must FAIL');
  assert.equal(passesHalfBodyFraming(1000, 1450), true, 'h/w exactly 1.45 passes (lower edge inclusive)');
  assert.equal(passesHalfBodyFraming(1000, 1449), false, 'h/w 1.449 fails');
  assert.equal(passesHalfBodyFraming(1000, 2100), true, 'h/w exactly 2.10 passes (upper edge inclusive)');
  assert.equal(passesHalfBodyFraming(1000, 2101), false, 'h/w 2.101 fails');
  // the pre-existing fail classes are untouched
  assert.equal(framingAspectClass(512, 512), 'square');
  assert.equal(framingAspectClass(1280, 720), 'landscape');
  assert.equal(framingAspectClass(0, 100), 'invalid');
});

// ---------- 2. catalog 2:3 request sizes per adapter ----------
test('P4.3 sizes — sizeForRatio 2:3: keyed 1024×1536, Classic 512×768 within its cap', () => {
  assert.deepEqual(sizeForRatio('2:3', 'keyed'), { w: 1024, h: 1536 });
  assert.deepEqual(sizeForRatio('2:3', 'free'), { w: 512, h: 768 });
  const c = sizeForRatio('2:3', 'free');
  assert.ok(c.w <= 768 && c.h <= 768, 'Classic request never exceeds the ≤768 cap');
  assert.deepEqual(clampClassicSize(c.w, c.h), c, 'the 2:3 Classic size survives the adapter clamp unchanged');
  // existing ratio entries are unchanged (no silent size drift elsewhere)
  assert.deepEqual(sizeForRatio('4:5', 'free'), { w: 614, h: 768 });
  assert.deepEqual(sizeForRatio('4:5', 'keyed'), { w: 1024, h: 1280 });
  assert.deepEqual(sizeForRatio('9:16', 'free'), { w: 432, h: 768 });
  assert.deepEqual(sizeForRatio('9:16', 'keyed'), { w: 720, h: 1280 });
});

// ---------- 3. framingGuard config: default + migration ----------
test('P4.3 framingGuard — missing/invalid migrates to strict, allow survives', () => {
  assert.equal(migrateCompositionConfig({}).framingGuard, 'strict', 'missing → strict (P4.2-and-older configs)');
  assert.equal(migrateCompositionConfig({ framingGuard: 'allow' }).framingGuard, 'allow', 'explicit user choice preserved');
  assert.equal(migrateCompositionConfig({ framingGuard: 'strict' }).framingGuard, 'strict');
  assert.equal(migrateCompositionConfig({ framingGuard: 'bogus' }).framingGuard, 'strict', 'invalid value normalises to strict');
  assert.equal(migrateCompositionConfig({ framingGuard: undefined }).framingGuard, 'strict');
  // the rotated-P1 early-return path also receives the default
  const rot = migrateCompositionConfig({ rotation: 12 });
  assert.equal(rot.mode, 'simple');
  assert.equal(rot.framingGuard, 'strict', 'rotated P1 config still gets the strict default');
  // a fresh Template 1 composition node migrates to strict
  const t1 = TEMPLATES.find(t => t.id === 'tpl1').make();
  const comp = t1.nodes.find(n => n.type === 'composition');
  assert.equal(migrateCompositionConfig(comp.config).framingGuard, 'strict', 'Template 1 ships strict by default');
  // Cache-key stability invariant (the P2 suite's contract): the field
  // must be in the node-type defaults, like inkOpacity — a field that
  // only appears via handler-time migration would change the node's
  // config between run 1 and run 2 and silently defeat its cache key.
  assert.equal(NODE_DEFS.composition.defaults.framingGuard, 'strict', 'framingGuard ships in the composition defaults (cache-key stability)');
  assert.equal(comp.config.framingGuard, 'strict', 'fresh Template 1 nodes carry the default from birth');
});

// ---------- 4. cache safety ----------
test('P4.3 build marker — AI_STUDIO_BUILD was bumped to p43 at P4.3 (stale compositions can never be served)', () => {
  // P4.4 bumped the marker again to 'p44'; the invariant this test guards
  // is that the P4.3 bump happened and the marker never went back.
  assert.ok(AI_STUDIO_BUILD === 'p43' || AI_STUDIO_BUILD === 'p44' || AI_STUDIO_BUILD === 'p45' || AI_STUDIO_BUILD === 'p46', 'marker is p43 or a later bump, got ' + AI_STUDIO_BUILD);
});
