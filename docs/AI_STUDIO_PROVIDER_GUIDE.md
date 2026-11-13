# AI Studio — Provider Guide

## Trạng thái P1
**Chưa có provider AI thật nào được kết nối.** Mọi node AI chạy `DemoAdapter` và kết quả luôn mang nhãn DEMO. Không có API giả nào được dùng để tuyên bố "AI đã hoạt động".

## Hợp đồng Adapter (`src/ai-studio/providers.js`)
```js
adapter = {
  name, kind: 'demo' | 'http', isDemo,
  capabilities(),            // {imageGeneration, imageVariation, imageToVideo, real}
  generateImage({prompt, image}),
  variation({image, variant}),
  imageToVideo({image, motion, duration, ratio}, onProgress),
}
```
Workflow Engine chỉ biết hợp đồng này — đổi nhà cung cấp không sửa engine.

## Bảo mật API key (bắt buộc)
- Key chỉ nhập vào ô password trong bảng Provider; code giữ ở **biến bộ nhớ module** (`setSessionKey`), mất khi tải lại trang.
- **Không** ghi key vào Git, IndexedDB, localStorage, `workflow.json`, ZIP xuất hay bất kỳ file nào.
- Cảnh báo hiển thị ngay trong UI: gọi API trực tiếp từ trình duyệt **lộ key** cho bất kỳ ai xem mã trang. Chỉ dùng key giới hạn quota để thử.
- Đường vận hành đúng: **backend proxy/serverless** giữ key phía server; trình duyệt gọi proxy. `HttpAdapter` trong P1 là stub có cổng: thiếu endpoint/key thì từ chối chạy; đủ cả hai vẫn báo rõ là ánh xạ payload của nhà cung cấp cụ thể chưa được cấu hình trong P1 (không tạo kết quả giả, `testConnection` không giả vờ thành công).

## Kết nối provider thật (việc của P4/P5)
1. Chọn nhà cung cấp có free tier; tự kiểm tra tài liệu, giới hạn, chi phí và quyền dùng thương mại ảnh đầu ra tại thời điểm tích hợp (không ghi sẵn con số chưa kiểm chứng ở đây).
2. Dựng proxy (ví dụ Cloudflare Worker/Vercel Function) giữ key, chuyển tiếp đúng payload của nhà cung cấp.
3. Hoàn thiện ánh xạ trong `HttpAdapter` (endpoint, định dạng trả về: URL ảnh → tải về blob, hoặc base64 → blob; job id + polling cho video).
4. Kiểm thử thật: tạo 1 ảnh + 1 video, ghi kết quả vào QA report; chỉ khi đó mới gỡ nhãn DEMO khỏi các node tương ứng.
