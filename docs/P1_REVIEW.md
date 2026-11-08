# P1 content, imagery and shopping UX — 2026-11-09 (Asia/Tokyo)
Base: P0 branch redesign/p0-product-identity at434ce99dd76b210b77738d308b255caf4876d177.
Branch feature/p1-collection-shopping. Stacked PR targets P0; neither PR may merge
without review. Main and live GitHub Pages stay unchanged.

## Implementation
- Keep all14 SKUs, P0 two-motion rail/canonical registry, stored version1 drafts and
  immutable cart snapshots. No database migration or destructive rewrite.
- Separate artwork-library.js:12 themed composition factories, theme-specific input
  schemas,35 original vector assets plus20 family count/member variants. Vietnamese cat
  for Mão. Twelve animals and12 zodiac symbol/constellation illustrations.
- Pair sun/moon and two names/date, family2–6 and member roles, group badge, three name
  layouts, calendar/vintage birth date, lunar year/animal, zodiac, fun number, Vietnamese
  slogans, original landscape, birthday cake/age/wish, genuinely blank upload product.
  Family/pair price is for one shirt; create separate cart rows for each member/partner.
- Shared layers render listing/detail/Studio/cart/3D/fitting/press. Editable text;
  original vector image layers can move/scale/delete. Snapshots store version, inputs
  and actual layers. Older saved designs are never rebuilt from changed template defaults.
- Lazy catalogue previews are WebP from the same renderer,420x490; detail
  front/back/close-up600x700. No stock photos substitute for actual chosen artwork.
  Uploaded customer SVG remains rejected; only trusted bundled SVG loads.
- Two-column mobile cards, prominent search, scrollable category chips, native modal
  filter for type/colour/all-in unit price. Removed unisex-only gender control.
  SKU remains internal; uniform design CTA. Actual product metadata remains canonical.
- Product detail has live personalised gallery, colour/size, price breakdown and Studio
  handoff. Unverified fabric/size measurements/delivery/durability explicitly unknown.
- cart-price.js computes base/template/personalisation/extra print/total. New pricing
  v2 includes front template fee30k and free field changes within that face; extra back30k.
  Blank239k has no artwork; each printed face30k. Motion base219k includes original print;
  custom added face30k. Unversioned saved designs retain original P0 face tariff.
  Removing all front layers removes the template fee.

## Limits
Original stylised vectors/mockups, not lifestyle or real product photography. No new
GLB/3D effects or production specs. Lunar-year field does not convert Gregorian dates
around Tết; UI explains manual correction. Zodiac/number themes are entertainment.
Original motion photos stay2D-locked. Physical devices, production print certification,
and field INP are outside available QA. No paid services or external model photos.
