# Checkpoint — Studio first milestone
Code: dae6d9e0cb5ff37dc7f69620c813c1365c0dde60. CI run 42487521313 green across five widths. Preview https://bohoa96tb.github.io/ao-in-studio-demo/?v=studio3#studio .

Implemented: original 2D canvas layer editor, separate front/back, Vietnamese text and font/color/position/rotation controls, raster upload, scale, duplicate/delete/center, undo/redo, IndexedDB local draft, mockup/JSON and check-art exports. Original procedural Three.js extruded-shirt preview loaded on demand, front/back canvas textures and 2D fallback. Product identity links from detail to current draft; drafts are one local working design, not one per catalog product. Do not imply prepared footage contains custom artwork.

Limits: model is stylized extrusion, not production garment or physical cloth. Type changes print zone and polo 2D placket; distinct fit models pending. Export quality not production certified. Artwork warning uses conservative geometric bounds and demo 150 DPI threshold, not seller-configurable yet. JSON export exists, JSON import pending. Restored layers are present but no layer auto-selected; select from dropdown. No cart or multi-design persistence yet. React/TypeScript integration remains pending.

Next: complete Studio usability and export/pointer/context-loss QA, real front/back garment assets, per-design IDs and cart snapshots before stages 4 styling and 5 heat-press. Preserve source license notices; no paid API authorization.
