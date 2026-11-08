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
