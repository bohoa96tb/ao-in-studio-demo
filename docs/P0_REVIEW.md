# P0 review — 2026-11-08
Baseline main: 4eaed7d286c314b8e806e10caf4b180837ae1e39, perf9.
Review branch: redesign/p0-product-identity. Do not merge without review.

## Kept
Vanilla modules, twelve personalisation themes and filters, local IndexedDB drafts,
front/back editing, undo/redo, file validation, mockup/artwork/JSON exports, fitting,
heat press, immutable cart rows, demo checkout, reduced motion and 2D fallback.

## Changed
One canonical product registry for rail, circle, catalogue and Studio. Two real motion
products AIS-M01/M02 alongside twelve original text templates, fourteen catalogue entries.
Explicit product selection resets to that product's metadata/preset, checkpoints previous
state in undo, awaits initial draft restoration, loads exact base photographs into Studio.
The embedded graphic in these two images is retained as base media; it is not passed off
as an editable vector or attached to the unrelated procedural 3D mesh. Their type/colour
are locked; the twelve templates retain colour/type editing and 3D.
Hero has larger garments, concise Vietnamese purchase copy, primary design CTA, deeper
rail, and system typography. Circle is an optional expandable experience.
Licensed media are local; atlases load on interaction, one missing manifest/atlas cannot
disable the other product or all rail controls. Hero poster is preloaded.

## Removed from customer interface
Four duplicate motion slots; outdated stage labels, duplicate introduction/CTA block,
technical fixture/development copy and external font requests. Attribution moved to
footer/information dialog and preserved in docs. No design records or commerce removed.

## Deliberate limits
P1 Studio tool grouping, new GLB, richer twelve-theme artwork, optional fitting and shorter
heat-press flow are not claimed complete. Existing procedural 3D remains for templates;
motion-photo designs use accurate 2D front/back. No physical Android/iPhone available.
No production artwork certification. No real order/payment/backend.
Validation and measured performance are recorded separately after CI finishes.
