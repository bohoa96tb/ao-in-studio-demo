# P2 Plan — Realistic product imagery & professional e-commerce

Ngày lập: 2026-11-09 (Asia/Tokyo). Base: main `b15dedcba9bc4b12984b6c32c0fff8707b5127ea`.
Nhánh: `feature/p2-real-product-visuals`. Không tạo repo/website mới.

## Vai trò (thực hiện tuần tự theo vai trò, có spawn agent nghiên cứu độc lập)

- Agent 0 PM/Orchestrator: audit, nhánh, phụ thuộc, hợp nhất, checkpoint. (phiên này)
- Agent 1 Image/License: thẩm định Pexels/Unsplash/mockup/3D — xem `P2_ASSET_LICENSES.md`.
- Agent 2 Photo/Mockup: media manifest + compositing trong Studio renderer.
- Agent 3 3D/Motion: đánh giá BINARYCLOTH/Sketchfab; giữ 3D phụ nếu chưa đạt.
- Agent 4 UI/UX: hero, catalog, detail, Studio, cart (không phá logic P1).
- Agent 5 Content: chuẩn hoá tiếng Việt, không bịa thông số — `products.json` giữ nguyên.
- Agent 6 QA độc lập: unit/browser/axe/Lighthouse, báo cáo riêng `P2_QA_REPORT.md`.

Quyền sở hữu module (tránh ghi đè): studio.js = Agent 2; product-detail/catalog/index/style = Agent 4;
studio-model.js = Agent 3; data/media-manifest.json + src/media-manifest.js = Agent 2/5;
docs P2_* = Agent tương ứng, PM chốt.

## Giai đoạn

- P2.0 Audit ✅: HEAD main b15dedc; 14 SKU (2 motion photoBase + 12 vector-mockup);
  12 chủ đề; CI workflow `.github/workflows/check.yml` (lint+unit+build+browser 5 viewport+Lighthouse).
  Ảnh hiện tại phân loại: 2 motion = concept có MIT; 12 SKU còn lại = renderer đa giác Canvas
  (`drawShirt` trong `src/studio.js`); chưa có ảnh chụp thật nào.
- P2.1 Ảnh thật cho catalog ✅ pilot: 4 ảnh Pexels đã thẩm định (áo trống) vào
  `public/fixtures/real-tee/` + mục ảnh thật + tab "Người mặc" ở chi tiết.
  Catalog chính vẫn dùng đúng artwork của mẫu (không thay bằng ảnh mẫu không liên quan) —
  nay renderer có nếp vải/bóng phủ lên hình in. SKU polo chưa có ảnh chụp phù hợp: ghi thiếu, không thay bằng ảnh crew.
  Ảnh 9558713 (nam áo trắng, MART PRODUCTION) **bị loại** vì trang nguồn gắn thẻ teen/thiếu niên — tuổi người mẫu không xác minh được.
- P2.2 Artwork vào ảnh ✅: cùng `drawArtwork()` cho catalog/detail/Studio/cart;
  lớp bóng/nếp vải chỉ ở bản xem trước, alpha thấp, không đổi toạ độ/chữ/màu artwork;
  export in (`export-art`) vẫn gọi `drawArtwork` thuần trên nền trong suốt.
- P2.3 3D ⚠️ giữ phụ: BINARYCLOTH GLB 2K = 4,44 MB, giấy phép tải không hiển thị đủ trên trang công khai;
  model oversized Sketchfab đã bị xoá. Không tải/không nhúng. Chỉ tinh chỉnh ánh sáng/sRGB cho model hiện tại;
  fallback 2D đã có sẵn khi WebGL/context-loss (đã xử lý ở P0/P1, chưa force-test — ghi rõ trong QA).
- P2.4 Mua sắm ✅: hero 2 CTA; badge loại ảnh trên thẻ; gallery thêm "Người mặc" khi có ảnh khớp SKU/kiểu/màu;
  nhãn minh họa rõ; ảnh phụ lazy-load; `prefers-reduced-motion` đã có ở CSS/JS từ P1, giữ nguyên.
- P2.5 QA/PR: chạy unit + build + browser suite cục bộ; PR vào main; **không tự merge** — chờ QA CI + duyệt của chủ repo.

## Không thay đổi (hard constraints)

14 SKU, giá, pricing v2 + legacy unversioned, IndexedDB v1 (`ao-in-studio`, store `drafts`),
undo/redo, draft, cart snapshot bất biến, 2 motion Hồ núi/Lá bài, 55 SVG artwork gốc.
Không bịa chất liệu/size/tồn kho/bảo hành/giao hàng/đánh giá. Giữ trạng thái demo (chưa backend/thanh toán thật).
