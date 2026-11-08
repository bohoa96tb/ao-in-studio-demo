# Checkpoint — QA and performance milestone
Code 9cb09dd3f690cf284ca8427763caf9834ffdf0a1; CI 42490519486 green. Preview https://bohoa96tb.github.io/ao-in-studio-demo/?v=perf9 .

15 tests + five-width application browser suite pass. tests/interaction.mjs adds CDP touch rail(390)/circle(390,1440), keyboard arrows/Escape, valid and rejected fitting drops and Axe scans. No violations in scanned states. color-contrast.js ensures template ink ≥4.5 against shirt overrides; custom Studio text color preserved with low-contrast warning. Semantic region names and focus indicators improved.

Performance: scripts/performance.mjs runs Lighthouse mobile and stores qa-results artifact. Performance66→92, Accessibility96→96, CLS0.2587→0.0198,TBT564→126ms. LCP3188ms remains above2.5s; INP/FPS/physical-phone unmeasured. See PERFORMANCE.md. Stabilized initial rail via sized/preloaded poster and hidden runtime initialization, immediate mobile front state, cached manifest/atlas promises; catalog lazy mounts near viewport; tests explicitly reveal lazy section.

Next: LCP/hosting and physical-device QA, forced WebGL context loss and mockup/artwork export checks; JSON import and remaining architecture/media consistency. Still vanilla modules, not requested full React/TypeScript architecture. Rail repeats two licensed samples and catalog has12 separate original typographic presets; not unified motion assets. Models remain schematic; no production artwork or fit certification. Do not claim full master prompt complete.
