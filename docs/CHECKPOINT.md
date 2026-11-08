# ÁO IN STUDIO — checkpoint P3 (mới nhất)

Ngày: 2026-11-09 (Asia/Tokyo). Nhánh: `feature/p3-automated-mockup-library`, base main `ad81b8d` (P2 đã merge qua PR #3, bản live là P2).
**P3 chờ PR**: không tự merge — cần CI xanh + chủ repo duyệt như P2.

## P3 đã làm (pilot P3.0–P3.2 + tích hợp, chi tiết: docs/P3_QA_REPORT.md)
- Thư viện áo nền có cấu trúc: `data/garments.json` — 6 bản ghi (1 base ghép được: crew trắng mặt trước trên móc; 3 worn crew; 1 detail; 1 worn polo trắng — ảnh polo thật đầu tiên, chỉ lifestyle). Base mặt sau, base polo, oversize vẫn MISSING, ghi rõ trong file. Hàng chờ ứng viên: `data/candidates.json` (15 mục có trạng thái + lý do).
- Engine ghép mockup `src/mockup-engine/` (quad phối cảnh dạng mesh tam giác, shading luminance per-pixel theo chính ảnh áo, mask silhouettte) + generator hàng loạt `scripts/mockup/generate.mjs` (idempotent theo cache key + sha256, kiểm tra fidelity ≤0,15). 8 mockup dựng sẵn trong `public/mockups/` + `data/mockup-manifest.json`.
- Thư viện hình in: `data/artwork-library.json` sinh tự động — 61 thiết kế (55 P1 + 6 vẽ mới pilot). Mục tiêu 40–60 thiết kế mới của P3.3 mới đạt 6.
- Giao diện: tab "Trên áo thật" ở chi tiết mẫu (chỉ hiện khi có mockup dựng sẵn cho đúng thiết kế mặc định + màu; cá nhân hóa thì ẩn, quay về renderer P2) + 2 ảnh lifestyle mới trong mục "Phom áo ngoài đời".
- Tự động hóa: `scripts/discovery/scan.mjs` + workflow discovery hằng tuần (chỉ báo cáo) và workflow generate thủ công (chỉ artifact) — không luồng nào tự duyệt/tự merge.
- QA local: unit 32/32, browser + interaction + P0 + P1 + P3 PASS ở 5 viewport; Lighthouse Perf 88/A11y 96, **LCP 2927 ms — mục tiêu ≤2,5s vẫn CHƯA ĐẠT** như P1/P2.
- Ba agent nghiên cứu đã chạy thật: Agent 1 (nguồn ảnh), Agent 3 (3 repo engine — không chép code), Agent 4 (Openclipart CC0 có điều kiện + taxonomy 16 theme). Tổng hợp: docs/P3_SOURCE_AUDIT.md.

---

# ÁO IN STUDIO — checkpoint P2

Ngày: 2026-11-09 (Asia/Tokyo). Nhánh: `feature/p2-real-product-visuals`, base main `b15dedc`.
(P2 đã merge vào main ngày 2026-11-09 qua PR #3, commit `ad81b8d`; bản live là P2.)

## P2 đã làm
- Media manifest: `data/media-manifest.json` (canonical) + `src/media-manifest.js` (mirror, test khóa).
- 4 ảnh Pexels áo trống đã thẩm định (hanger/Steinke, đen/MART, đôi/Torres, flat-lay/Snipes) —
  mục "Phom áo ngoài đời" + tab "Người mặc" ở chi tiết (khớp SKU/kiểu/màu; polo tự ẩn).
  Loại Pexels 9558713 (tuổi người mẫu không xác minh được). Chi tiết: docs/P2_ASSET_LICENSES.md.
- `drawShirt` thực hơn: hạt vải, nếp gấp, cổ theo kiểu, bóng phủ nhẹ lên hình in ở bản xem trước;
  export in vẫn sạch (drawArtwork thuần). products.json không đổi; IndexedDB v1/pricing không đổi.
- Hero thêm CTA bộ sưu tập; badge loại ảnh trên thẻ catalog; 3D thêm đèn rim/fill + sRGB, vẫn là tính năng phụ. GLB BINARYCLOTH đã xác minh CC BY 4.0 qua Sketchfab API (Agent 3) nhưng chưa nhúng: UV toàn thân không khớp canvas Studio, cần nén + QA artwork ở pilot riêng. Model oversized Sketchfab đã bị xoá.
- Ảnh thật tải hoãn (IntersectionObserver + fetchpriority=low) để không tranh LCP.

## QA P2 (chi tiết: docs/P2_QA_REPORT.md)
Unit 24/24; browser + interaction + P0 + P1 suite đạt ở 360/390/430/768/1440, axe 0 vi phạm ở các trạng thái đã quét.
Lighthouse mobile cục bộ: Perf 89, A11y 96, CLS 0, LCP 2713–2859 ms — **LCP ≤2,5 s vẫn CHƯA ĐẠT** (P1 cũng chưa đạt).
Chưa kiểm: điện thoại thật, force WebGL context-loss, CI của PR.

## Việc tiếp theo
1. Chủ repo duyệt PR P2; theo dõi GitHub Actions; chỉ merge khi CI xanh, rồi xác nhận GitHub Pages đã cập nhật bản mới.
2. Bổ sung ảnh polo chụp thật + ảnh gia đình + mặt sau người mặc khi có nguồn có phép (qua quy trình Agent 1).
3. Tối ưu LCP về ≤2,5 s ổn định trên hosting thật; force-test WebGL/ảnh lỗi.
4. Chỉ thêm chất liệu/bảng size/chính sách khi người bán cung cấp số liệu xác minh. Giữ trạng thái demo.

## Cách tiếp tục nhanh
Đọc AGENTS.md, checkpoint này, docs/P2_PLAN.md, P2_ASSET_LICENSES.md, P2_QA_REPORT.md và đúng module định sửa.
Giữ SKU/giá/snapshot/IndexedDB/attribution. Không dùng lại Pexels 9558713.

---
# ÁO IN STUDIO — checkpoint phát hành P0 + P1

Ngày: 2026-11-09 (Asia/Tokyo).
Người dùng đã phê duyệt đưa lên main trong phiên này; yêu cầu chờ review trước merge
ở các mục lịch sử đã được thay thế bằng phê duyệt này.

## Trạng thái
- P0 PR #1 đã merge: deb00e9aacf6e2a98fa58a33cd739d253aaead92.
- P1 PR #2 đã merge: 6d301ed7a98ba94d65d4ef6341a89c27d39da408.
- Mã ứng dụng đã QA:161406f7855d104ff6c7250b673bc6da15fd31b4.
- Website chính: https://bohoa96tb.github.io/ao-in-studio-demo/?v=p1content1
- Bản preview phụ vẫn là P0, chưa triển khai các version P1 đã lưu lên hosting phụ:
  https://ao-in-studio-p0-review.bohoa1996tb.chatgpt.site/
  Không nhầm preview phụ với bản main mới.
- Không làm thêm 3D/GLB hoặc backend trong đợt này.

## Đã làm
- Tủ áo còn đúng2 motion gốc;14 SKU thống nhất giữa rail/circle/catalogue/Studio.
- Giữ12 chủ đề, thêm55 SVG gốc:12 con giáp Việt Nam (Mão là mèo),12 cung,
  áo đôi sun/moon,20 biến thể số người/vai trò gia đình và các hình in theo chủ đề.
- Form riêng: hai tên/kỷ niệm, thành viên/role, lớp/niên khóa, bố cục tên,
  lịch/vintage ngày sinh, năm âm/con giáp, cung, số giải trí, slogan, sinh nhật.
  Áo tự tải ảnh thật sự trống. Không chuyển đổi ngày dương sang âm quanh Tết.
- Danh mục2 cột mobile, tìm kiếm, chip chủ đề, panel lọc kiểu/màu/giá trọn mẫu.
  SKU ẩn khỏi thẻ chính; CTA nhất quán. Gallery trước/sau/cận và phóng to.
- WebP preview dựng từ cùng layer/renderer với Studio; không thay artwork bằng ảnh khác.
- Một nguồn tính giá: áo nền, hình mẫu, cá nhân hóa, mặt in thêm, số lượng.
  Dữ liệu cũ không tự đổi tariff hoặc bố cục chữ. Giữ DB version1, undo/redo,
  draft, export, cart snapshots/edit, thử phối và ép nhiệt.
- Bỏ lỗi chiều cao290px cắt áo ở chi tiết; thumbnail không còn padding thu nhỏ.
  Hero preload đúng ảnh thật đang hiển thị, thay cho ảnh nhỏ rồi tải ảnh đầy đủ.
- Giấy phép/ghi công còn đầy đủ; không mua/tạo video trả phí.

## QA thực tế
Actions42498554194 / job128786089607 SUCCESS.
Lint/build +20 unit tests; hồi quy5 viewport360/390/430/768/1440.
P1:12 chủ đề đi hết shopping flow tại390;4 viewport còn lại kiểm tra tên/bố cục,
gallery, snapshot JSON, đổi kiểu/giá, cart reload/edit;16 hành trình tổng cộng.
Touch/keyboard/fitting/drop, reduced motion, ảnh atlas/manifest lỗi và axe đạt trong
các trạng thái đã quét. Có ảnh trước/sau5 khu vực trong Actions artifacts.
Lighthouse mobile lab cuối: Performance97,Accessibility96,LCP2630ms,CLS0,TBT0ms.
LCP mục tiêu2500ms CHƯA ĐẠT; các phép đo trước dao động2447–2780ms.
Không suy ra field INP/FPS hay kết quả điện thoại thật từ Lighthouse này.

## Việc tiếp theo, theo thứ tự
1. Nghiệm thu bản main trên điện thoại thật; hiện chỉ có Chromium/touch emulation.
2. Tối ưu LCP cho ổn định≤2.5s; đo trace resource/render của Hero trên hosting thật,
   không chỉ dùng điểm số localhost. Giữ Performance≥85, CLS≤0.1.
3. Kiểm tra forced no-WebGL/context loss và lỗi file ảnh front/back (chưa kiểm chứng).
4. Hoàn thiện artwork/Studio UX theo phản hồi người dùng; xem P1_REVIEW và QA_REPORT.
5. Chỉ thêm chất liệu/bảng size/chính sách khi người bán cung cấp số liệu xác minh.
   Lifestyle photos phải có quyền và khớp artwork. Chưa có ảnh đời thực.
6. GLB tự nhiên/Studio grouping/đổi luồng thử phối và ép nhiệt thuộc phạm vi tiếp theo;
   không báo đã hoàn thành toàn bộ master prompt.

## Cách tiếp tục nhanh
Đọc AGENTS, checkpoint này, P1_REVIEW, QA_REPORT và đúng module định sửa.
Chỉ kiểm tra HEAD/chênh lệch mới; không khảo sát lại toàn repo/4 nguồn từ đầu.
Giữ SKU, snapshot design/pricing, local IndexedDB và attribution. Tạo feature branch,
test phần thay đổi cùng hồi quy quan trọng, đo thật rồi mới báo đạt.
