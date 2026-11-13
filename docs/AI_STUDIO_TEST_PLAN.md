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

## P2 (bổ sung)
### Unit (`tests/ai-studio-p2.test.mjs`, chạy trong `npm test`)
- Hash ổn định (thứ tự khóa không ảnh hưởng); khóa đệm bỏ qua trường suy biến `composed`; sửa 1 node → khóa của node đó + phía sau đổi, nhánh không liên quan giữ nguyên.
- Engine: lần chạy 2 phục vụ từ đệm (handler không bị gọi lại); thử lại tới khi thành công / cạn lượt; node treo bị timeout với thông báo rõ ràng; ghi thời lượng + callback tiến trình; seed outputs cho chạy tiếp.
- Hàng đợi: chạy tuần tự, đúng thứ tự enqueue, tối đa 1 tác vụ đồng thời.
- Validator: báo cáo cả lỗi nối dây lẫn lỗi nội dung (chưa có hình in, prompt trống); đồ thị hợp lệ không có vấn đề.
- GC: asset được dự án / phiên bản / bản nháp tham chiếu đều được giữ; chỉ asset không ai tham chiếu là rác. Cắt danh sách lịch sử/phiên bản theo cap giữ bản mới nhất.

### Browser (`tests/ai-studio-p2.mjs`, Playwright, server :5264)
- Pha A (430 + 1366): lịch sử chạy ghi + còn sau reload; chạy lại không đổi → node `cached`; sửa prompt → chỉ chuỗi prompt chạy lại; 2 lần Lưu → 2 phiên bản, khôi phục về trạng thái cũ; tab Lưu trữ + dọn file rác.
- Pha B (430): lỗi runtime (provider stub) → lịch sử "Có lỗi" → nút chạy tiếp → chạy tiếp thành công từ node lỗi.
- Pha C (430): bản nháp chưa lưu → reload → đề nghị khôi phục → khôi phục đúng workflow + tên.
- Pha D (1366): DB v1 (kiểu P1, tạo tay) → migration lên v2, dự án cũ mở đúng.
- Pha E (390 + 1920): khói — Mẫu 1 chạy + lịch sử + không tràn ngang/lỗi trang.

## Chưa kiểm tra (không được báo PASS)
- Cảm ứng kéo/nối trên **điện thoại Android thật** (mới kiểm bằng Playwright hasTouch + Pointer Events).
- Pinch-zoom 2 ngón thật (có code, chưa có thiết bị kiểm chứng).
- Provider AI thật (chưa tồn tại ở P1).
- Xuất MP4 (không hỗ trợ; chỉ WebM demo).
