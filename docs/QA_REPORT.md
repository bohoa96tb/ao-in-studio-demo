# QA — interaction, contrast and performance milestone
Verified code 9cb09dd3f690cf284ca8427763caf9834ffdf0a1. Actions run 42490519486, job 128761654112 SUCCESS. 15 logic tests; full browser regression 360/390/430/768/1440. Extended interaction scan 390/1440: touch circle, mobile rail touch, keyboard and Escape, valid/invalid fitting pointer drops, zero pageerrors and zero Axe violations in scanned states. Template contrast tested for all 12 × 5 shirt colors at ≥4.5:1; user-selected text colors retained with warning when lower. Live manual black-shirt catalog check confirmed light template ink.

Lighthouse mobile after optimization: Performance92, Accessibility96, LCP3188ms, CLS0.0198, TBT126ms. Before:66/96, LCP3193ms, CLS0.2587,TBT564ms. LCP goal unmet, INP not measured. See PERFORMANCE.md for conditions/limitations. Artifacts include full reports. Physical phone, FPS, production print export, forced WebGL context loss and complete conformance audit pending.


## P0 review — 2026-11-08
Application commit 2e88fba68aac450aa13b7012dc03abdb3580d764; PR #1.
Verified green Actions 42492802283, job128768606285, artifact13622650972.
- Lint/build and16 unit tests pass.
- Full purchase/editor regression passes at360/390/430/768/1440: front/back, Vietnamese
  text, valid PNG and rejected SVG, duplicate/undo, reload/draft, 2D/3D opening, cart
  separate rows/quantity/price/edit/reload/demo checkout, fitting, matching heat-press
  artwork, skip/reduced motion and catalogue search/filter/date preset.
- New P0 suite at all5 widths: exactly2 real motion products, pink AIS-M02 opens with
  correct SKU/type/colour/219000 base price and no old layers; photo draft restores;
  cart identity matches; AIS-004 template clears photographic state and unlocks colour.
- Aborted white atlas and manifest independently: rail remains usable and opens AIS-M01
  accurately. No uncaught pageerrors in scanned normal application states.
- CDP touch rail390, touch circle390/1440, keyboard/Escape and valid/invalid fitting drops
  pass. Axe returns zero violations in scanned390/1440 states after fixing secondary-text
  contrast. First CI failed contrast; this was fixed, not waived.
- CI saved home screenshots for all5 widths. Manual desktop check via internal preview
  confirmed exact white/pink artwork and absence of previous text after product change.
- Mobile Lighthouse89/96, LCP2448ms, CLS0, TBT362ms; see PERFORMANCE.md.

Limits: desktop Chromium touch emulation, NOT physical Android/iPhone. Forced WebGL
context loss/no-WebGL and missing front/back base photographs were not injected in this
P0 suite. No measured field INP/FPS; no production print certification. Existing2D
fallback remains, but do not claim these untested failure paths passed. Full P1 not done.
Private preview is a separate deployment of this same application build; main unchanged.

## P1 implementation — validation in progress
Local lint/build and19 unit tests pass: legacy/v2 price compatibility, template fees,
blank/extra faces, SKU uniqueness, text contrast,12 distinct themes, animal/zodiac
alternatives, invalid date/age handling and couple/family/name compositions.
Manual internal desktop preview verified original animal artwork and theme-specific
fields. Full CI browser/Lighthouse/screenshot comparison pending.

## P1 verified feature checkpoint — 2026-11-09 (Asia/Tokyo)
Feature application cd4e10570996d589a3ec22cfce4cd4453d54a16e:
Actions42497201781 / job128781996768 SUCCESS, artifact13623184423.
- Lint/build and20 logic tests pass, including frozen legacy fee policy and empty-text
  fee handling for new designs.
- Complete P0 regression at360/390/430/768/1440 still passes: Studio/upload/front/back,
  undo/reload, cart/quantity/edit/demo checkout, fitting/heat press and matching artwork,
  reduced motion, rail/circle and catalogue filters. P0 missing atlas/manifest cases pass.
- P1 suite:12 distinct theme journeys at390; name-layout journey at360/430/768/1440.
  All verify WebP/front/back/close gallery, actual changed image after personalisation,
  exported JSON artwork/snapshot, Studio handoff, cart identity/reload/edit. Vietnamese
  year2023 produces cat artwork, not rabbit. Blank product starts without unrelated art.
  Changing a new design to polo and back updates base/total through shared pricing.
- Mobile catalogue is two columns at360/390/430. No page horizontal overflow or uncaught
  pageerrors. Detail Axe scan has no serious/critical violations; extended page scans
  at390/1440 have zero violations. Keyboard/touch/fitting valid/invalid drops pass.
- Before screenshots from pinned P0 at434ce99d: home/catalogue/card/detail/Studio390.
  After screenshots at all5 widths for the same five interface areas. Stored in artifact.
- Lighthouse mobile navigation (localhost, simulated RTT150ms/1638.4Kbps/CPU4x):
  Performance98, Accessibility96, LCP2449ms, CLS0, TBT0ms. Single lab sample, not field INP,
  hardware FPS or real-network Android evidence. P0 sample89/96, LCP2430ms,TBT368ms.
- Visual inspection found P0 inherited290px gallery height and generic button padding
  shrinking product thumbnails. Candidate44ad4b9d fixes full6:7 framing/thumbnail padding,
  and adds a framing assertion to the browser suite. The PR carries the candidate CI gate.

Limits: original stylised vectors and 2D mockups; no real lifestyle/product photographs,
verified fabric/size measurements/delivery/durability, new GLB, physical Android/iPhone,
forced WebGL context-loss/no-WebGL or certified production exports. No payment/backend.

## P0 + P1 release authorised — 2026-11-09 (Asia/Tokyo)
User explicitly authorised main release. PR1 merge deb00e9a, PR2 merge6d301ed7.
Final application161406f7, Actions42498554194/job128786089607 SUCCESS.
20 unit tests; five-width regression; all12 P1 themes at390 plus four other widths;
native modal accessibility, non-cropped gallery geometry, matching artwork snapshots,
cart reload/edit and legacy fee/text rendering preserved.
Latest Lighthouse mobile97/96,LCP2630ms,CLS0,TBT0ms. LCP≤2500ms remains UNMET.
Earlier runs2447–2780ms demonstrate variance; do not select only the fastest sample.
Hero now preloads the full displayed image. Additional real-host/device optimisation
and forced WebGL/base-photo failure QA remain. All production specifications unknown
stay labelled unknown. See latest CHECKPOINT as authoritative resume state.
