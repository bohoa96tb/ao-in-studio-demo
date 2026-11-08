# Checkpoint — QA and performance milestone
Code 9cb09dd3f690cf284ca8427763caf9834ffdf0a1; CI 42490519486 green. Preview https://bohoa96tb.github.io/ao-in-studio-demo/?v=perf9 .

15 tests + five-width application browser suite pass. tests/interaction.mjs adds CDP touch rail(390)/circle(390,1440), keyboard arrows/Escape, valid and rejected fitting drops and Axe scans. No violations in scanned states. color-contrast.js ensures template ink ≥4.5 against shirt overrides; custom Studio text color preserved with low-contrast warning. Semantic region names and focus indicators improved.

Performance: scripts/performance.mjs runs Lighthouse mobile and stores qa-results artifact. Performance66→92, Accessibility96→96, CLS0.2587→0.0198,TBT564→126ms. LCP3188ms remains above2.5s; INP/FPS/physical-phone unmeasured. See PERFORMANCE.md. Stabilized initial rail via sized/preloaded poster and hidden runtime initialization, immediate mobile front state, cached manifest/atlas promises; catalog lazy mounts near viewport; tests explicitly reveal lazy section.

Next: LCP/hosting and physical-device QA, forced WebGL context loss and mockup/artwork export checks; JSON import and remaining architecture/media consistency. Still vanilla modules, not requested full React/TypeScript architecture. Rail repeats two licensed samples and catalog has12 separate original typographic presets; not unified motion assets. Models remain schematic; no production artwork or fit certification. Do not claim full master prompt complete.


## Active P0 review — 2026-11-08
Branch redesign/p0-product-identity from main 4eaed7d. See docs/P0_REVIEW.md.
Two genuine motion products share canonical SKUs with circle/catalogue/Studio; previous
draft cannot silently replace explicit product selection. Local media, interaction-only
atlas decoding and redesigned Hero. Local lint/build and 16 unit tests pass.
Browser regression, new product-identity/failure-injection tests and Lighthouse pending
GitHub Actions; do not claim CI or performance passed before observing results.
Do not merge this review branch or alter production until the user reviews the PR.


### P0 validated checkpoint
Reviewed application commit2e88fba68aac450aa13b7012dc03abdb3580d764.
PR https://github.com/bohoa96tb/ao-in-studio-demo/pull/1 — not merged.
Actions42492802283 SUCCESS: lint/build,16 unit tests,5-width full regression,
5-width identity/draft tests and two motion-failure injections; touch/keyboard/axe pass.
Lighthouse89/96,LCP2448ms,CLS0,TBT362ms (single simulated mobile lab run).
Preview: https://ao-in-studio-p0-review.bohoa1996tb.chatgpt.site (owner-private; deployment status must be checked before handoff).
Next: user reviews P0; keep main unchanged. Then P1 Studio grouping, licensed3D asset
quality/performance evaluation, fitting/heat-press flow, differentiated template artwork.
Outstanding QA: physical devices, forced no-WebGL/context loss, failed base photos,
hosted-site/field performance. See P0_REVIEW, QA_REPORT and PERFORMANCE for exact scope.

## Active P1 — 2026-11-09 (Asia/Tokyo)
Branch feature/p1-collection-shopping based on434ce99d from P0. Do not merge P0 or P1.
See P1_REVIEW.md for scope/data/fee compatibility. Original artwork, themed forms,
mobile catalogue, live detail gallery and shared price breakdown implemented.
Local lint/build and19 unit tests pass. Browser/Lighthouse and before/after screenshots
pending CI; do not claim they passed before observing workflow results.

## P1 review candidate — 2026-11-09 (Asia/Tokyo)
PR https://github.com/bohoa96tb/ao-in-studio-demo/pull/2
Base redesign/p0-product-identity; head feature/p1-collection-shopping.
Do not merge either PR without user approval. Main/Pages unchanged.
Feature code cd4e1057 validated in green Actions42497201781:20 unit tests, P0 five-width
regression, P1 all12 themes at390 plus other four widths, matching snapshots/cart,
touch/keyboard/axe. Lighthouse98/96,LCP2449ms,CLS0,TBT0ms in a single mobile lab run.
Candidate44ad4b9d adds the image-framing fix found by visual QA and an automated check;
consult the latest PR check for that candidate's final status. No other feature changes.
55 original SVGs,14 unchanged SKUs, theme-specific forms, consistent WebP previews,
native filter panel and shared fee breakdown. Old drafts/cart keep original snapshots
and legacy tariff; new type changes update base price via cart-price.js.
Review preview reuses existing hosting project appgprj_6af08f4c98c8819188c52cb0da13822f:
https://ao-in-studio-p0-review.bohoa1996tb.chatgpt.site/
Existing audience was public at start of P1; do not change access or create another Site.
Publish only the candidate that passes QA; deployment status must be verified.
Next: user reviews artwork/catalogue/detail/mobile; then address real materials/sizes,
matching licensed lifestyle photos and physical-device QA. No new3D scope this phase.
