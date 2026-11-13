# AI Studio — QA Report (P1, độc lập, 2026-11-13)

## Kết quả đã chạy thật
| Kiểm tra | Lệnh / cách chạy | Kết quả |
|---|---|---|
| Unit toàn repo | `npm test` | **50/50 PASS** (39 cũ + 11 mới của AI Studio), 0 fail |
| Browser AI Studio | `node tests/ai-studio.mjs` (server `scripts/serve.mjs` :5264) | **PASS ở 390, 430, 1366, 1920**: thêm node từ thư viện, kéo node đổi vị trí, kéo dây cổng→cổng tạo edge, Mẫu 1 chạy DEMO trọn (Preview success, ảnh kết quả có nhãn DEMO/mô phỏng), xuất ZIP tải xuống và parse được (10 entries, `workflow.json` đủ 8 node, không trường api key), lưu → reload → dự án mở lại đúng tên + đủ node, không tràn ngang, 0 lỗi trang |
| Video demo (Mẫu 4) | Script Playwright riêng, 430px | **7/7 node success** kể cả node video — WebM ghi thật bằng MediaRecorder (Chromium headless có hỗ trợ), 0 lỗi trang |
| Hồi quy trang chủ | Smoke Playwright 390px sau thay đổi | `#product-catalog`, `#design-collection`, `#studio`, `#print-workspace` còn đủ; link "AI Studio" (`studio.html`) có mặt; **0 lỗi trang** |
| Build | `npm run build` | PASS — `dist/studio.html` + `dist/src/ai-studio/*` có trong bản dựng Pages |

## Lỗi đã tìm và sửa trong QA
1. Server test local chặn `studio.html` (allowlist) → bổ sung allowlist cho studio + `src/ai-studio/*` (test server cũ vẫn PASS trong `npm test`).
2. `scripts/build.mjs` chưa copy `studio.html` → trang sẽ 404 trên Pages; đã bổ sung.
3. Mobile: thanh dự án/công cụ quấn nhiều dòng ăn hết chiều cao canvas → chuyển thành 1 dòng cuộn ngang ở ≤760px; bottom sheet thuộc tính che cổng nối → đóng sheet là thao tác chuẩn, thư viện node nâng z-index lên trên sheet.
4. Race khi render lại bảng thuộc tính: `refreshStorage` ghi vào phần tử đã bị thay → thêm guard null.

## CHƯA đạt / chưa kiểm chứng (không báo PASS)
- **Provider AI thật: chưa kết nối.** Ảnh/biến thể/video của node AI đều là DEMO (canvas + MediaRecorder), đóng dấu DEMO trong pixel/giao diện.
- **MP4: không có.** Chỉ WebM demo; không giả định dạng.
- **Điện thoại Android thật:** chưa kiểm chứng cảm ứng kéo/nối/pinch trên thiết bị thật (mới qua Playwright hasTouch + Pointer Events). Chủ repo cần kiểm tra trên Android.
- Số lượng ảnh tạo mỗi lần ở node AI Image = 1 trong P1 (cấu hình count chưa nhân bản kết quả).
- ZIP import chỉ đọc được ZIP dạng store (đúng định dạng ZIP xuất của chính app); ZIP nén deflate từ công cụ khác sẽ báo lỗi rõ ràng.
- Minimap: chưa làm (brief cho phép tùy chọn).
- Lighthouse/LCP cho `studio.html`: chưa đo.
