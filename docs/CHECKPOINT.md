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
