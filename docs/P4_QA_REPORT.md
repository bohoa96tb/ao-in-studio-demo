# P4 — QA Report: Xưởng chuẩn bị file in (Print Production Workspace)

Ngày: 2026-11-12 (Asia/Tokyo). Nhánh: `feature/p4-print-production-workspace`,
base main `c6eb16d` (P3.7). Kiến trúc: `docs/P4_ARCHITECTURE.md`.

## Đã triển khai

- Section `#print-workspace` (mobile-first) + `src/print-workspace.js` +
  `src/print-core.js` (hàm thuần, unit-test được). Nạp JPG/JPEG/PNG/SVG
  (≤10 MB/25 MP), lấy lớp ảnh từ Studio, chọn 83 hình thư viện; bản gốc lưu
  nguyên ở IndexedDB riêng `ao-in-print` (không đụng DB v1 của Studio).
- Tách nền: (a) flood-fill nền đơn sắc từ mép ảnh (giữ vùng cùng màu bên
  trong hình), thanh trượt độ nhạy; (b) AI U2Netp qua ONNX Runtime Web —
  chạy trên máy khách, tải lười ~16 MB một lần, ảnh không rời thiết bị.
- Chỉnh màu: sáng/tương phản/bão hòa + chế độ 1 màu mực (giữ hình alpha;
  ảnh đục thì lấy độ sáng làm alpha — có cảnh báo trước trong giao diện).
- Vector hóa VTracer (wasm, tải lười) với 3 lớp bảo vệ trung thực:
  nền sentinel magenta + hierarchy cutout để giữ lỗ trong suốt thật;
  cổng điểm số (lệch màu trung bình + p90 vùng chi tiết + chênh diện tích);
  loại "Ảnh chụp" (tự nhận diện theo độ giàu màu) bị chấm khắt khe hơn hẳn.
  Không đạt → mặc định giữ RASTER, ghi rõ số liệu.
- Kích thước in cm (khóa tỉ lệ), DPI hiệu dụng trực tiếp theo pixel sau cắt
  viền, cảnh báo 3 mức + gợi ý khổ tối đa cho 300 DPI; dịch vị trí trên áo.
- Xem trước trên áo bằng mockup engine P3 (áo cổ tròn trắng, ảnh Pexels,
  nhãn mô phỏng). Kiểm tra DTF dạng checklist ✓/⚠/✗ có giải thích.
- Xuất: PNG trong suốt ở độ phân giải gốc đã xử lý + chunk pHYs mang đúng
  DPI hiệu dụng; SVG chỉ khi có vector thật (path thật, khổ cm); PDF trang
  đúng kích thước cm — vector → toán tử path thật, raster → nhúng PNG +
  SMask, tên file ghi rõ loại. Nút đưa hình đã xử lý vào Studio đúng cm.

## Kiểm chứng file xuất (độc lập)

- Unit `tests/print-core.test.mjs`: 7 test (DPI, pHYs đọc lại = 300, flood
  fill, mono, cổng trung thực, SVG thư viện → PDF, chống vector giả).
- `pdfinfo` (Poppler) trên PDF do print-core sinh: trang vector 566,93 ×
  566,93 pt = đúng 20 cm; trang raster 283,46 pt = đúng 10 cm; `pdftoppm`
  render thành công. PDF vector không chứa XObject ảnh; PDF raster có.
- Suite trình duyệt `tests/p4.mjs` (đã thêm vào CI): tải logo tổng hợp có
  chữ Việt "ÁO IN / Ép nhiệt đẹp" → tách nền đơn sắc → DPI đổi đúng theo
  cm (sau cắt viền, 3 cm = 342 DPI đọc lại từ pHYs của chính file PNG tải
  về) → vector hóa ĐẠT (33 path, 0 `<image>`) → SVG xuất có width cm →
  PDF vector khổ đúng, không nhúng raster → hình thư viện xuất SVG vector
  thật → ảnh tổng hợp kiểu ảnh chụp tách nền AI thành công. 0 lỗi trang.

## Kiểm thử theo loại hình (yêu cầu mục 5)

- Logo + chữ Việt: fixture tổng hợp (suite p4) — ĐẠT vector, xuất đủ 3 dạng.
- Minh họa phẳng: cùng cơ chế logo (preset minh họa) — ĐẠT trong suite.
- Thú cưng: Pexels 8628173 (Luis Canelón, chó đen studio nền trắng,
  1200×1337 bản QA) — tách nền AI: góc alpha 0, tâm alpha 255, cắt viền
  còn 1080×956; xem trước trên áo sạch. Vector hóa: cổng loại Ảnh chụp
  TỪ CHỐI (trung bình 14,2/255, chi tiết 31/255) → giữ raster như yêu cầu.
- Chân dung: Pexels 9775318 (SHVETS production, 1200×1800 bản QA) — tách
  nền AI: góc alpha 0, tâm alpha 255, còn 1200×1644 sau cắt viền.
- Ảnh QA chỉ lưu cục bộ (~/workspace/p4-qa/), không đưa vào repo/site.

## Hồi quy & hiệu năng

- Unit 39/39; lint OK; build OK; browser + interaction (0 vi phạm a11y —
  đã sửa 1 lỗi contrast của chính P4) + P0 + P1 + P3 + P3.1 + P3.6: PASS.
- Lighthouse mobile cục bộ: Perf 90 / A11y 96 / LCP 3179 ms / TBT 197 ms /
  CLS 0 (P3.1: 92 / 3013 ms). **Mục tiêu LCP ≤2,5 s vẫn CHƯA ĐẠT** như các
  phase trước; payload nặng (AI ~16 MB, VTracer 0,14 MB) chỉ tải khi dùng.

## Chưa đạt / giới hạn nói rõ

- Chưa kiểm trên điện thoại Android thật — đã kiểm viewport mobile 390px
  + cảm ứng trong suite; chủ repo kiểm trên máy thật sau khi lên live.
- U2Netp là model nhỏ: viền lông/tóc rất mịn có thể chưa hoàn hảo; giao
  diện không hứa hẹn "tách nền hoàn hảo".
- SVG đầu vào chứa transform phức tạp/gradient/arc: bộ chuyển PDF từ chối
  trung thực và PDF chuyển sang bản raster (ghi rõ trong tên file/trạng thái).
- PDF/PNG là file bàn giao demo: chưa phải chứng nhận sản xuất; xưởng in
  vẫn cần kiểm tra lại theo máy ép và mực của họ.
