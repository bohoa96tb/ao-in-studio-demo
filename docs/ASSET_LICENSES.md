# Asset licenses
Two source motion studies by Amir Mušić, MIT, see LICENSE-ASSETS.md and vendor/GARMENT-LICENSE. Model provenance: white LTX-2.5 Pro; pink Kling 3.0 through Pika, prepared upstream; zero generation requested by this project. Font Manrope OFL 1.1, upstream notices retained. No assets from other three repos reused.

Studio shirt shape and procedural material created for this project. Three.js 0.170.0 loaded from jsDelivr; MIT copyright three.js authors, full license at https://github.com/mrdoob/three.js/blob/r170/LICENSE . System fonts Arial/Georgia are browser font selections, no font binaries distributed. Customer files stay local.

Styling SVG model and heat press geometry/CSS authored originally for this project. No external model photos, styling repo assets or machinery models reused. Shirt previews are generated locally from customer design state.

12 catalog templates: original typographic compositions authored for this demo, drawn locally by shared Studio renderer. No external product photos, logos or copyrighted character art. Template quote text is short generic wording. System fonts only.

## P0 review — 2026-11-08
Bundled upstream lake-white-v3 and cards-pink-v3 motion atlases plus front/back/profile
and manifests are now served locally in public/fixtures. Upstream commit
574299fecfe9e1af5eea92c345b10e59e207fd18; MIT asset permission explicitly covers these
bundled demonstration media (see root LICENSE-ASSETS.md). public/hero.webp is a resized
derivative of lake-white-v3/front.webp. Attribution retained in footer and information
dialog. These are generated concept garments, not photographs of manufactured stock.
No paid generation service was used. Original upstream font files are no longer requested;
the UI uses system fonts. Existing notices are retained.

## P1 artwork and imagery — 2026-11-09 (Asia/Tokyo)
public/artwork/*.svg:55 original project vector illustrations authored for this demo
with AI-assisted code; no image tracing or copied character/logo/font artwork.
Covered by project MIT. Inventory:11 core decorations (including legacy family graphic),
12 animal portraits,12 zodiac diagrams,20 count/member family portraits.
Vietnamese layouts in artwork-library.js are original compositions. Zodiac diagrams
are decorative, not scientific star charts. User-uploaded SVG remains disallowed.

The12 themed front/back/close views are generated locally by the same Studio renderer
using these assets and actual text layers. WebP420x490 catalogue and600x700 detail
previews; no external uploads or paid API. Labelled mockups, not product photos.
Back is blank until customer adds layers; blank close-up is labelled print area.
No lifestyle photos added without matching print/verified rights. P0 MIT media and
attribution remain intact.

## P2 real photos — 2026-11-09 (Asia/Tokyo)
Four Pexels photographs of blank garments added in public/fixtures/real-tee/
(hanger white tee — Dmitriy Steinke; black crew worn — MART PRODUCTION; couple in
white tees — Israel Torres; white flat lay — Daniel & Hannah Snipes). Pexels License:
free commercial use and editing, attribution not required but given in captions,
footer docs and docs/P2_ASSET_LICENSES.md. Models do not endorse this demo.
These photos never contain customer artwork and are never presented as photographs
of this shop's manufactured products. Pexels photo 9558713 was evaluated and
REJECTED (source page teen tagging; model age unverifiable) and is not used.
No Sketchfab GLB, PSD mockup pack or Unsplash image was downloaded or used in P2;
see docs/P2_ASSET_LICENSES.md for the full audit trail.

## P3 garment library additions — 2026-11-09 (Asia/Tokyo)

- Pexels 17515211 — NJH STUDIO — man wearing blank white crew tee, BACK view, EXIF Sony ILCE-6000 on page; page description states "adult". File `public/fixtures/real-tee/crew-white-back-worn.webp`. Lifestyle only; never composited. PM visually verified 2026-11-09: blank back, no logo/print/watermark.
- Pexels 2096476 — Mwabonje Ringa — man wearing blank white polo, EXIF Nikon D3000 on page. File `public/fixtures/real-tee/polo-white-worn.webp`. Lifestyle only; never composited. PM visually verified 2026-11-09: no chest logo; collar/placket visible. First verified polo photograph in the library (still no polo compositing base).
- Licence for both: Pexels License — free use including commercial/e-commerce, attribution not required (given voluntarily), no sale of unaltered copies as stock, no implied endorsement by depicted people. Re-verified by Agent 1 on 2026-11-09.
- Rejected after PM visual check: Pexels 6843269 (chunky sweater knit, not T-shirt jersey — would misdescribe the fabric) and 8606514 (model age unverifiable). Full candidate queue with reasons: `data/candidates.json`. Pexels 9558713 remains banned.
- The 8 pre-rendered mockups in `public/mockups/` are computer composites of the project's own MIT artwork over Pexels 20669538 (Dmitriy Steinke, Pexels License) and are labelled "Ảnh mô phỏng" wherever shown.

## P4 Print Production Workspace — vendored libraries & model — 2026-11-12

All processing runs on the customer's device; nothing below is a hosted
service and no customer image ever leaves the browser.

- **ONNX Runtime Web 1.20.1** — MIT License (Microsoft). Files:
  `public/vendor/ort/ort.bundle.min.mjs`, `ort-wasm-simd-threaded.mjs`,
  `ort-wasm-simd-threaded.wasm`, `LICENSE`. Lazy-loaded only when the customer
  picks AI background removal (~11,7 MB one-time, browser-cached).
- **U2Netp model** (`public/models/u2netp.onnx`, 4,6 MB) — from the U-2-Net
  project by Xuebin Qin et al., **Apache License 2.0** (full text at
  `public/models/U2NET-LICENSE`); ONNX build distributed via the rembg
  project's release assets. Lazy-loaded with the runtime above.
- **VTracer** (visioncortex VTracer 0.6.5 core) via the `wasm_vtracer` 0.2.0
  WebAssembly binding — **MIT License** (binding metadata + upstream licence
  text at `public/vendor/vtracer/LICENSE`). Files:
  `public/vendor/vtracer/wasm_vtracer.js`, `wasm_vtracer_bg.js`,
  `wasm_vtracer_bg.wasm` (0,14 MB). Lazy-loaded only for vectorization.
- Considered and rejected for licensing: `@imgly/background-removal`
  (AGPL-3.0) and BRIA RMBG-1.4 weights (CC BY-NC, non-commercial).
- QA-only photos (NOT shipped in this repo or on the site; local QA records
  in docs/P4_QA_REPORT.md): Pexels 8628173 (Luis Canelón, dog studio
  portrait) and Pexels 9775318 (SHVETS production, woman's studio portrait),
  Pexels License, downloaded 2026-11-12 solely to test background removal
  and the photo fidelity gate.
