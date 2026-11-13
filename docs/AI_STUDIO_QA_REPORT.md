# AI Studio — QA Report

## P2 — Workflow Engine & lưu trữ nâng cao (2026-11-14)

### Kết quả đã chạy thật
| Kiểm tra | Lệnh / cách chạy | Kết quả |
|---|---|---|
| Unit toàn repo | `npm test` | **64/64 PASS** (50 cũ + 14 mới của P2: hash ổn định, khóa đệm + phạm vi mất hiệu lực, engine đệm/thử lại/timeout/ghi thời lượng/tiến trình/seed chạy tiếp, hàng đợi tuần tự, validator, tham chiếu GC, cắt danh sách theo cap) |
| Browser P2 | `node tests/ai-studio-p2.mjs` (server :5264) | **PASS toàn bộ**: Pha A (430 + 1366): chạy Mẫu 1 → lịch sử có lượt "Thành công"; chạy lại không đổi → **6/6 node có thể đệm ở trạng thái `cached`** (đúng các node preview/export không đệm); sửa prompt → promptAssistant + aiImageGen chạy lại, composition + imageInput vẫn `cached`; Lưu 2 lần → 2 phiên bản, thêm node (9) rồi khôi phục → về 8 node; tab Lưu trữ + nút dọn file rác chạy và báo cáo; reload → lịch sử còn nguyên, không hiện banner nháp (đã lưu chính thức). Pha B (430): chuyển provider HTTP (stub) → aiImageGen lỗi thật, lịch sử ghi "Có lỗi", nút "Chạy tiếp từ node lỗi" hiện; về DEMO + chạy tiếp → thành công, Preview có ảnh, lịch sử ghi lượt "Chạy tiếp — Thành công". Pha C (430): sửa mà không Lưu → reload → banner khôi phục bản nháp hiện → khôi phục đủ 8 node + đúng tên. Pha D (1366): tạo tay DB **v1 kiểu P1** (chỉ 2 store) có dự án cũ → mở studio → dự án cũ tải đúng, DB lên **v2** đủ 4 store mới. Pha E (390 + 1920): khói — chạy Mẫu 1 + lịch sử + không tràn ngang |
| Browser P1 (hồi quy) | `node tests/ai-studio.mjs` | **PASS ở 390, 430, 1366, 1920** (kéo node, nối dây, Mẫu 1, ZIP 10 entries, lưu → reload) |
| Hồi quy trang chủ | Smoke Playwright 390px | `#product-catalog`, `#design-collection`, `#studio`, `#print-workspace` còn đủ; link "AI Studio" có mặt; **0 lỗi trang** |
| Build | `npm run build` | PASS — `dist/studio.html` + `dist/src/ai-studio/*` (gồm `p2.js`) có trong bản dựng Pages |

### Lỗi đã tìm và sửa trong QA P2
1. Test P2 pha A đọc trạng thái node quá sớm: ở lần chạy lại, Preview vẫn giữ `st-success` của lượt trước nên điều kiện chờ thỏa ngay trước khi lượt mới bắt đầu → đổi điều kiện chờ sang **số lượt trong lịch sử chạy** (chỉ tăng sau khi lượt chạy kết thúc và đã ghi).
2. Test pha A/B ở mobile: bảng thuộc tính dạng bottom sheet phủ lên thanh dưới cùng, chặn click nút khôi phục phiên bản / tab lịch sử → đóng sheet trước các click đó (đúng thao tác người dùng thật).
3. Test pha C đọc IndexedDB thô từ bên ngoài để chờ bản nháp — đua với chính cơ chế mở/đóng connection của store → đổi sang chờ **chính dòng trạng thái "Đã tự lưu bản nháp" của trang** (chỉ hiện sau khi giao dịch ghi nháp hoàn tất).

### CHƯA đạt / chưa kiểm chứng ở P2 (không báo PASS)
- **Điện thoại Android thật:** vẫn chưa kiểm chứng cảm ứng trên thiết bị thật (kể cả các panel/tab mới) — việc của chủ repo trên máy thật.
- Timeout hủy việc *chờ* node, nhưng tác vụ nền của handler (ví dụ MediaRecorder đang ghi) có thể chạy nốt ở nền; kết quả của nó bị bỏ qua, không ghi vào outputs.
- Cài đặt chạy (số lần thử lại / timeout) chỉ áp cho phiên làm việc hiện tại, chưa lưu theo dự án.
- Dung lượng "theo dự án" là ước tính từ kích thước JSON + blob tham chiếu trực tiếp, không phải số đo vật lý của IndexedDB.
- Provider AI thật: vẫn chưa kết nối (như P1) — pha B dùng stub HTTP có cổng để tạo lỗi thật có kiểm soát, không phải provider thật.

## P1 — 2026-11-13

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
