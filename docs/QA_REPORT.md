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
