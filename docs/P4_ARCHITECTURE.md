# P4 — Xưởng chuẩn bị file in (Print Production Workspace): nghiên cứu thư viện & kiến trúc

Ngày: 2026-11-12. Nhánh: `feature/p4-print-production-workspace`, base main `c6eb16d` (P3.7).
Tài liệu này là bước "đề xuất kiến trúc" trong quy trình chủ repo đặt ra — viết
trước khi triển khai, và bản triển khai phải khớp với nó.

## 1. Ràng buộc nền

- Site là **static GitHub Pages, không backend** → mọi xử lý ảnh phải chạy
  **ngay trên trình duyệt của khách**, không tải ảnh lên máy chủ nào. Đây cũng
  là cam kết riêng tư: ảnh của khách không rời thiết bị.
- Không phá vỡ chức năng hiện có: Studio/cart/IndexedDB v1 (`ao-in-studio`),
  bộ sưu tập, mockup engine P3, các suite P0/P1/P3/P3.1/P3.6 phải xanh nguyên.
- Trung thực kỹ thuật (chuẩn của dự án): không "vector giả" (đổi đuôi/nhúng
  raster vào SVG rồi gọi là vector), không phóng đại độ phân giải giả, không
  ghi đè file gốc, không gắn nhãn "production-ready" khi chưa đạt.

## 2. Nghiên cứu thư viện (đã kiểm chứng giấy phép 2026-11-12)

| Nhu cầu | Chọn | Giấy phép | Ghi chú |
|---|---|---|---|
| Tách nền bằng ML | **ONNX Runtime Web 1.20.1** + model **U2Netp** (U-2-Net) | MIT / **Apache-2.0** | Chạy WASM trên máy khách; model 4,6 MB + runtime ~11,7 MB, **chỉ tải khi khách chọn** cách này. U2Netp là bản nhỏ của U-2-Net, hợp vật thể nổi bật (thú cưng, chân dung, sản phẩm). |
| Vector hóa raster | **VTracer** (binding `wasm_vtracer` 0.2.0 cho visioncortex VTracer 0.6.5, wasm) | **MIT** | Vector hóa màu thật (path + fill), preset line-art/photo/pixel-art, lọc nhiễu, độ chính xác màu/đường. WASM chỉ 0,14 MB, tải khi cần. (Bản `@visioncortex/vtracer` trên npm là bản đóng gói cho Node — không nạp được trực tiếp trên trình duyệt không bundler — nên dùng binding web này; đã kiểm chứng chạy thật.) |
| Xuất PDF | **Tự viết** (PDF 1.4 tối thiểu, ~150 dòng trong `print-core.js`) | — | Kiểm soát tuyệt đối: trang đúng kích thước cm; vector → toán tử vẽ path thật; raster → nhúng PNG (Flate + SMask alpha). Không phụ thuộc thư viện nặng. |
| Ghi DPI vào PNG | **Tự chèn chunk pHYs** sau IHDR + CRC32 | — | Canvas `toBlob` không ghi DPI; chèn thủ công để file mang đúng DPI hiệu dụng theo kích thước in đã chọn. |

Đã xét và **loại**:

- `@imgly/background-removal` — giấy phép **AGPL-3.0**, không phù hợp.
- Model RMBG-1.4 (BRIA) — trọng số **CC BY-NC** (phi thương mại), loại.
- `rembg` — chạy phía server (Python), site không có backend, loại.
- Potrace — chỉ đơn sắc và bản JS port dính GPL, VTracer tốt hơn, loại.
- ImageTracerJS (Unlicense) — dùng được nhưng chất lượng đường cong/màu kém
  hơn VTracer; giữ làm phương án dự phòng nếu VTracer wasm lỗi trên máy khách
  (chưa tích hợp ở P4 — ghi nhận để sau).

## 3. Kiến trúc phân hệ

```
Nguồn ảnh ──► Bản gốc (IndexedDB riêng ao-in-print/originals, KHÔNG ghi đè)
   │            ├─ Tải lên: JPG / JPEG / PNG / SVG (tối đa 10 MB, 25 MP)
   │            ├─ Từ Studio: lớp ảnh đang chọn (ảnh khách tải / hình thư viện)
   │            └─ Từ thư viện: 83 hình SVG (vector sẵn)
   ▼
Pipeline trên canvas (theo thứ tự, xem trước trực tiếp sau mỗi bước)
   1. Tách nền: Không / Nền đơn sắc (flood-fill từ mép + ngưỡng màu, có thanh
      trượt độ nhạy + khử viền) / AI trên máy (U2Netp qua ONNX, tải lười)
   2. Chỉnh màu: sáng · tương phản · bão hòa · (tùy chọn) ép về 1 màu mực
   3. Vector hóa (tùy chọn): VTracer theo preset gợi ý theo loại ảnh
      → CỔNG TRUNG THỰC: raster hóa lại SVG, so với bản raster đã xử lý
        (Δ màu trung bình trên pixel đặc + chênh độ bao phủ alpha).
        Đạt → cho xuất vector. Không đạt → MẶC ĐỊNH GIỮ RASTER, vector vẫn
        chọn được nhưng kèm cảnh báo rõ số liệu.
   4. Kích thước in thật (cm, khóa tỉ lệ) → DPI hiệu dụng trực tiếp:
      ≥300 tốt · 200–299 chấp nhận được, cảnh báo nhẹ · <200 cảnh báo mờ.
      Giảm kích thước in là cách tăng DPI — gợi ý kích thước tối đa ở 300 DPI.
   5. Xem trước trên áo: ghép bằng mockup engine P3 lên áo cổ tròn trắng
      (base đã hiệu chuẩn trong data/garments.json), nhãn "Ảnh mô phỏng".
   6. Kiểm tra DTF (tham khảo, liệt kê đạt/chưa): nền trong suốt · DPI ·
      khổ in ≥ 5 cm (chi tiết quá nhỏ khó ép) · còn nền đặc chưa tách ·
      lưu ý RGB→CMYK màu có thể lệch ở xưởng.
   ▼
Xuất file (tải về máy khách, tên file ghi rõ loại + kích thước + DPI)
   - PNG nền trong suốt ở độ phân giải GỐC đã xử lý (không nội suy phóng to),
     có chunk pHYs = DPI hiệu dụng.
   - SVG: CHỈ khi có vector thật (VTracer đạt cổng, hoặc file gốc là SVG có
     path thật). SVG chỉ chứa <path>, không nhúng raster.
   - PDF trang đúng kích thước in (cm→pt): có vector → path vector thật;
     chỉ raster → nhúng PNG toàn trang, tên/ghi chú nói rõ là PDF raster.
```

## 4. Mô-đun code

- `src/print-workspace.js` — UI mobile-first (mount trong `app.js`), section
  `#print-workspace` đặt sau Studio; nút "Chuẩn bị file in" trong Studio mở
  xưởng kèm lớp ảnh hiện tại.
- `src/print-core.js` — hàm thuần, test được bằng node: tính DPI/kích thước,
  chèn pHYs + CRC32, viết PDF (raster & vector), chuyển path SVG→PDF, chấm
  điểm trung thực, flood-fill tách nền đơn sắc.
- `public/vendor/ort/`, `public/vendor/vtracer/`, `public/models/` — thư viện
  + model tự chứa (kèm LICENSE), tải lười bằng dynamic import/fetch;
  `scripts/serve.mjs` mở allowlist + MIME `.wasm`/`.onnx` cho môi trường dev/test
  (build Pages vốn phục vụ mọi file trong dist).
- SVG đầu vào: kiểm tra có `<path>` thật hay chỉ nhúng `<image>` — trường hợp
  sau đối xử như raster (trung thực).

## 5. Kiểm thử (theo yêu cầu)

- Tự động: unit cho print-core (DPI, pHYs đọc lại được, PDF parse lại:
  MediaBox == cm, bản vector có toán tử path & không có XObject ảnh; SVG xuất
  có path & không có <image>); suite trình duyệt `tests/p4.mjs` chạy pipeline
  với ảnh fixture tổng hợp (logo, chữ Việt, minh họa) ở 5 viewport; hồi quy
  toàn bộ suite cũ.
- Thủ công có hồ sơ (docs/P4_QA_REPORT.md): ảnh logo, chữ, minh họa bằng
  fixture; **ảnh thú cưng + chân dung** bằng ảnh Pexels có giấy phép đã kiểm
  chứng (chỉ để QA cục bộ, không đưa vào repo/site) chạy tách nền AI + cổng
  vector; mở file xuất bằng parser SVG/PDF độc lập để xác minh.
- Android: kiểm ở viewport/touch mô phỏng điện thoại trong suite; kiểm trên
  máy thật do chủ repo thực hiện sau khi lên live (ghi rõ trong báo cáo).
