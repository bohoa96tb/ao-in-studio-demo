# P3.6 — Visible worn-photo preview

Owner accepts approximate placement and non-identical garments. White crew front/back now compose CURRENT artwork on real people, using separate crops from Pexels 6787008 by Artem Podrez. Two people, not one SKU. Other variants retain existing behavior.

Source: https://www.pexels.com/photo/fashion-man-person-woman-6787008/
License: https://www.pexels.com/license/ — checked 2026-11-09; modification and website usage allowed; no implied endorsement.

Photo is stored as a lazy-loaded JPEG data module (70,295 image bytes), enabling a text-only connector commit without an Android binary handoff. No external photo requests/CORS required. Original supplied/downloaded image remains unchanged; runtime crops and quads are in studio-live.js. Replace module and quads when supplier photos arrive.

Face buttons share Studio state. Blank back stays blank; front artwork is never silently copied. Current artwork and user uploads pass through existing drawLayers. Print export, cart snapshots and garment-generation manifests remain unchanged.
