# AI Studio — QA Report

## P3 — Xử lý ảnh & ghép hình in nâng cao (2026-11-14)

### Kết quả đã chạy thật
- `npm test`: **78/78 PASS** (64 baseline P1+P2 + 14 test P3 mới): homography ánh xạ đúng 4 góc (sai số ≤1e-9) + tâm chiếu trùng giao điểm 2 đường chéo của quad; homography quad đơn vị ≈ ma trận đơn vị; trường cong nếp vải: bằng 0 ở strength 0, tăng đơn điệu theo strength, biên độ = độ lệch sáng × strength × hệ số, trường phẳng không dịch chuyển; toán cover/contain (800×600 → 1080×1920); bảng 6 kênh xuất (id duy nhất, kích thước đúng); `rectToQuad` bằng đúng hình chữ nhật P1; di trú cấu hình P1 → chế độ phối cảnh + quad tương đương (cấu hình có xoay → giữ chế độ đơn giản); quad mẫu khớp dữ liệu hiệu chuẩn `data/garments.json`; đăng ký 13 loại node; Mẫu 1 dùng phối cảnh, Mẫu 2 có node nền + xuất kênh.
- `node tests/ai-studio-p3.mjs` (Playwright, server :5264): **PASS toàn bộ** —
  - Pha A @430/1366: mở Thuộc tính node Ghép hình in → trình chỉnh quad hiện; **kéo núm góc 1 bằng pointer** → tọa độ X của góc đổi 31,5% → 40,7% (đọc từ ô số cấu hình); có đủ slider cong nếp vải + bóng vải; chạy Mẫu 1 → Preview thành công, node Ghép hình in thành công.
  - Pha B @430/1366: Mẫu 2 chạy xong; đầu ra node Nền & bối cảnh giữ **đúng kích thước pixel** của đầu vào (900×1350); xuất ZIP → có `results/tiktok-1080x1920.png`, `results/shopee-1024x1024.png`, `results/website-vuong-2000x2000.png` và **đọc IHDR cho kích thước chính xác 1080×1920 và 1024×1024**.
  - Pha E @390/1920: smoke Mẫu 1 thành công. Mọi pha: 0 lỗi trang, không tràn ngang.
- Hồi quy: `node tests/ai-studio.mjs` **PASS** (exit 0, 4 viewport); `node tests/ai-studio-p2.mjs` **PASS** (exit 0, đủ 7 mục pha A×2/B/C/D/E×2 — gồm migration DB v1→v2 và đệm/chạy tiếp của P2 trên code P3); `npm run build` PASS, `dist/src/ai-studio/warp.js` có mặt; smoke trang chủ 390px: đủ #product-catalog/#design-collection/#studio/#print-workspace + link AI Studio, 0 lỗi trang.

### Lỗi đã tìm và sửa trong QA P3
- Test (không phải lỗi sản phẩm): lần chạy đầu suite P3 thất bại ở pha A — canvas quad nằm dưới nếp gấp của bottom-sheet thuộc tính trên mobile (y ≈ 947 > viewport 900) nên cú kéo chuột rơi ngoài màn hình. Đã sửa test bằng `scrollIntoViewIfNeeded()` trước khi kéo (đúng thao tác người dùng thật). Sau sửa: PASS ở cả 430 và 1366.
- Đặc tả thay đổi có chủ đích: test P1 "đúng 12 loại node" được cập nhật thành 13 (P3 thêm node Nền & bối cảnh theo yêu cầu chủ shop) — ghi rõ trong test.

### CHƯA đạt / chưa kiểm chứng ở P3 (không báo PASS)
- Chưa kiểm chứng trên điện thoại Android thật (kéo núm quad bằng cảm ứng thật, hiệu năng warp trên máy yếu) — mới kiểm bằng Playwright (hasTouch + Pointer Events).
- Hiệu ứng cong nếp vải là MÔ PHỎNG thị giác theo độ sáng (đã ghi rõ trong UI + tài liệu) — không phải mô hình vải vật lý; bóng vải dùng hệ số theo độ sáng trung bình của quad.
- Quad mẫu cho ảnh trải phẳng + ảnh mặt sau là quad đặt tay theo vùng ngực hợp lý (chưa hiệu chuẩn thủ công như 2 ảnh móc treo trong `data/garments.json`) — người dùng kéo chỉnh được.
- Ảnh nền riêng ở chế độ "vừa khung (contain)" có thể để lộ mép khi dùng kèm làm mờ (đã nới khung vẽ theo mức mờ, vẫn nên kiểm thực tế khi dùng).
- AI vẫn DEMO (không đổi ở P3). Chưa đo Lighthouse cho studio.html.


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
