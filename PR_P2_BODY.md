# P2 — Realistic product imagery & professional e-commerce

Base: main `b15dedc` · Branch: `feature/p2-real-product-visuals` · Commit: `a82124d`

## Thay đổi chính
- **Ảnh chụp thật đã thẩm định**: 4 ảnh Pexels (áo trống) — Steinke (hanger), MART PRODUCTION (đen), Torres (đôi), Snipes (flat-lay). Đầy đủ URL gốc/tác giả/giấy phép/ngày xác minh trong `docs/P2_ASSET_LICENSES.md`. Pexels 9558713 bị loại (tuổi người mẫu không xác minh được). Không dùng Unsplash/PSD mockup (điều khoản mâu thuẫn/không rõ) hay Sketchfab oversized (đã bị xoá).
- **Media manifest**: `data/media-manifest.json` + `src/media-manifest.js`, test khóa đồng bộ, cấm ảnh đã loại, cấm gán ảnh crew cho polo.
- **Renderer thực hơn**: hạt vải, nếp gấp, cổ theo kiểu áo, bóng vải phủ nhẹ lên hình in ở bản xem trước; export in vẫn sạch. `products.json`, giá, IndexedDB v1 không đổi.
- **UX**: hero 2 CTA, badge loại ảnh ở catalog, tab "Người mặc" trong chi tiết (khớp SKU/kiểu/màu), ảnh thật tải hoãn để bảo vệ LCP.
- **3D**: giữ phụ, thêm rim/fill light + sRGB. GLB BINARYCLOTH đã xác minh **CC BY 4.0** qua Sketchfab API nhưng chưa nhúng — UV toàn thân không khớp canvas trước/sau của Studio, cần pilot riêng (decal/planar projection + nén Draco/KTX2 + QA artwork).

## Kiểm thử
- Unit 24/24 (thêm 4 test P2). Browser + interaction + P0 + P1 suite đạt ở 360/390/430/768/1440, axe 0 vi phạm.
- Lighthouse mobile (localhost): Perf 89, A11y 96, CLS 0, LCP 2713–2859 ms — LCP ≤2,5 s **chưa đạt** như P1, không hồi quy.
- Chi tiết: `docs/P2_QA_REPORT.md`; trước/sau: `docs/P2_REVIEW.md`; shot list: `docs/P2_SHOT_LIST.md`.

## Chưa làm / còn thiếu
Ảnh lifestyle cho 4 SKU polo + AIS-M02; kiểm thử điện thoại thật; force-test WebGL context-loss.
**Không tự merge** — chờ CI xanh và chủ repo duyệt.

## Cách tạo PR khi có quyền push
```
git push -u origin feature/p2-real-product-visuals
```
Rồi mở: https://github.com/bohoa96tb/ao-in-studio-demo/compare/main...feature/p2-real-product-visuals?expand=1
