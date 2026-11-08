# Áo In Studio
Read docs/CHECKPOINT.md, SOURCE_AUDIT.md, TECHNICAL_DESIGN.md and QA_REPORT.md. Preserve MIT attribution. Five effects, Studio/cart and catalog exist; do not regress them or claim all master-prompt requirements complete. No paid generation. One current design state feeds mockups, 3D, styling and press; cart uses immutable snapshots. Test a clean checkout through CI and five viewport suite. Do not label artwork production-ready. Physical touch/performance/export QA remain pending.

P0 and P1 have now been approved and merged. Use the latest docs/CHECKPOINT.md;
historical do-not-merge notes are superseded by that approval. Read docs/P1_REVIEW.md
before catalogue/artwork/price changes. Preserve old IndexedDB version1 snapshots and
unversioned pricing/text rendering. New artwork factories must not rebuild saved carts.

P2 (2026-11-09, branch feature/p2-real-product-visuals): read docs/P2_PLAN.md,
P2_ASSET_LICENSES.md, P2_SHOT_LIST.md and P2_QA_REPORT.md before touching imagery.
Canonical media data is data/media-manifest.json, mirrored by src/media-manifest.js;
tests/media-manifest.test.mjs enforces the mirror, file existence and the ban on
Pexels 9558713. Lifestyle photos are blank-garment Pexels photos only, always with
their caption; never composite customer artwork onto a worn-model photo and never
present them as manufactured product photos. Polo SKUs have no licensed real photo
yet — keep the labelled renderer fallback, do not substitute a crew photo.
3D stays secondary: no GLB is licensed/verified yet (BINARYCLOTH unverified,
Sketchfab oversized deleted). Print export must stay shading-free (drawArtwork only).
