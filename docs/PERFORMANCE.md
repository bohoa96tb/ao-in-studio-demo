# Performance and interaction measurements

Measured on GitHub Actions Ubuntu Chromium against the local static test server. These are single laboratory navigation runs, not physical-phone measurements or field Web Vitals. Browser mobile form factor; simulated 150ms RTT, 1638.4 Kbps throughput, CPU slowdown ×4. Raw reports retained as qa-results workflow artifacts.

| Metric | Before (ac82cd4, run 42490047184) | After (9cb09dd, run 42490519486) | Goal |
|---|---:|---:|---:|
|Performance|66|92|≥85|
|Accessibility|96|96|≥90|
|LCP|3193ms|3188ms|≤2500ms — not met|
|CLS|0.2587|0.0198|≤0.1|
|Total Blocking Time|564ms|126ms|Diagnostic, not INP|
|INP|Not measured|Not measured|≤200ms field interaction goal|

Baseline largest shift (0.2434) attributed by Lighthouse to rail profile images during initialization. Changes: preload a correctly sized fixed-position static garment poster; keep unpositioned runtime garments hidden until ready; initialize mobile selected front immediately; share manifest/atlas decode promises; defer below-fold catalog rendering until intersection; optional font display. Progressive poster is real product artwork, not a measurement-only placeholder. Catalog still loads when approaching or navigating to it.

Interaction and accessibility: CI 42490519486 at 390 and 1440 confirms CDP touch circle rotation, 390px touch horizontal rail, keyboard arrows and Escape, valid/invalid pointer fitting drop and ghost cleanup. Axe returned no violations on the scanned page state at both widths. Full application browser regression passes at 360/390/430/768/1440, including previous Studio/cart/catalog/press workflows. This does not constitute comprehensive WCAG certification, physical touch QA or 60FPS proof.

Remaining: reduce LCP below 2.5s, run hosting/device and field measurements, context-loss/export QA, complete original source/media architecture requirements.


## P0 review measurement — 2026-11-08
Application commit 2e88fba68aac450aa13b7012dc03abdb3580d764.
Actions 42492802283, job 128768606285: SUCCESS. Mobile Lighthouse navigation on
localhost static server, simulated RTT150ms / throughput1638.4Kbps / CPU4x.
One recorded run, not a field or hosted-site measurement.

| Metric | perf9 | P0 review |
|---|---:|---:|
| Performance | 92 | 89 |
| Accessibility | 96 | 96 |
| LCP | 3188ms | 2448ms |
| CLS | 0.0198 | 0 |
| TBT | 126ms | 362ms |

LCP meets the 2500ms lab goal with limited margin. Score remains above85 but decreased;
TBT regressed and needs investigation in P1 (initial Studio/fitting/press DOM and canvas
work are still mounted at startup). INP and sustained FPS were not measured.
LCP element is the selected white garment's front image. Vendored media eliminate
raw.githubusercontent.com runtime dependencies; system fonts remove external font
requests. Only user interaction decodes the selected motion atlas. Circular thumbnails
are built on expanding the optional section. Poster is preloaded; secondary image or
manifest failure no longer rejects the whole rail. Production caching and physical
mobile-network validation are still pending. Do not generalise this single lab run to
all customer devices. Full lighthouse.json and performance-summary.json are in the
Actions qa-results artifact 13622650972.

## P1 feature measurement — 2026-11-09 (Asia/Tokyo)
Application cd4e1057, green run42497201781. Lighthouse mobile localhost simulation,
RTT150ms/1638.4Kbps/CPU4x: Performance98, Accessibility96, LCP2449ms, CLS0, TBT0ms.
One lab run; do not interpret zero TBT as measured real-world INP or universal smoothness.
LCP remains close to2.5s and needs device/network confirmation. P0 comparison run:
Performance89, Accessibility96,LCP2430ms,CLS0,TBT368ms.
Original SVG loads only when a catalogue card/detail/circular collection is requested.
Catalogue WebP previews use420x490 dimensions and intersection-driven loading; detail
views600x700. New content adds no WebGL loop or remote image/font service.
Further runs are attached to PR #2; use their recorded summaries rather than extrapolate.
