# AI Studio — Test Plan

## Unit (`tests/ai-studio.test.mjs`, chạy trong `npm test`)
- 12 loại node tồn tại, cổng đúng.
- Tương thích kiểu (gồm `design → image`, chặn `prompt → image`).
- Validate kết nối: hợp lệ / sai kiểu / cổng đã có dây / tạo vòng lặp.
- Thứ tự topo tôn trọng phụ thuộc; upstream/downstream.
- Engine chạy đúng thứ tự, ghi status/log/output; lỗi node được ghi nhận.
- Prompt builder ghép đúng cụm tiếng Việt + câu bảo toàn hình in.
- SVG safety: nhận mẫu an toàn, chặn script/on*/javascript:.
- ZIP writer: có chữ ký PK, round-trip qua reader, CRC đúng.
- 4 template: hợp lệ, không vòng lặp, mọi dây đều qua được validate.
- Providers: DemoAdapter gắn nhãn demo; HttpAdapter từ chối khi thiếu cấu hình và khi đủ cấu hình ở P1 vẫn báo chưa ánh xạ (không giả kết quả).

## Browser (`tests/ai-studio.mjs`, Playwright, server `scripts/serve.mjs` cổng 5264)
Ở mỗi bề rộng **390 / 430 / 1366 / 1920**:
1. Mở `studio.html`, canvas hiển thị, không lỗi trang.
2. Thêm ImageInput + Preview từ thư viện node (mobile: mở ngăn kéo node, đóng bottom sheet).
3. Kéo node thứ hai ra khỏi vùng chồng lấp; kéo dây cổng-ra → cổng-vào tạo được edge; kéo node đầu đổi vị trí thật.
4. Tải **Mẫu 1**, đặt tên dự án, Chạy workflow → mọi node `success`, Preview có ảnh kết quả kèm nhãn DEMO/mô phỏng.
5. Xuất ZIP → tải xuống, parse bằng reader: có `workflow.json` với 8 node, không có trường api key.
6. Lưu → reload → dự án tự mở lại đủ 8 node + đúng tên; không tràn ngang.

## Kiểm tra tay bổ sung đã làm trong P1
- Template 4 (TikTok) chạy trọn ở 430px kể cả node video: 7/7 node success, video WebM ghi thật bằng MediaRecorder của Chromium headless.
- Smoke trang chủ sau thay đổi: `#product-catalog`, `#design-collection`, `#studio`, `#print-workspace` còn đủ, link "AI Studio" có mặt, 0 lỗi trang.
- `npm run build`: `dist/studio.html` + `dist/src/ai-studio/*` có mặt.

## Chưa kiểm tra (không được báo PASS)
- Cảm ứng kéo/nối trên **điện thoại Android thật** (mới kiểm bằng Playwright hasTouch + Pointer Events).
- Pinch-zoom 2 ngón thật (có code, chưa có thiết bị kiểm chứng).
- Provider AI thật (chưa tồn tại ở P1).
- Xuất MP4 (không hỗ trợ; chỉ WebM demo).
