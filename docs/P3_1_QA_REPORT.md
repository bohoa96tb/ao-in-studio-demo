# P3.1 QA Report — Visual Completion & Automation Fix

Ngày: 2026-11-09 · Nhánh: `feature/p31-visual-completion` (base main `4efb522`)
Phạm vi: biến P3 từ "có engine/dữ liệu" thành thay đổi NHÌN THẤY ĐƯỢC trên website.

## 1. Điều kiện PASS của brief — đối chiếu

| # | Tiêu chí | Kết quả |
|---|---|---|
| 1 | Mở trang thấy ngay bộ sưu tập hình in mới | ✅ Section "BỘ SƯU TẬP HÌNH IN" nằm ngay sau khu vực khám phá, trước catalog sản phẩm; tiêu đề tĩnh trong HTML, lưới dựng khi cuộn tới |
| 2 | Ít nhất 6 thiết kế P3 mới truy cập được | ✅ Dải "Thiết kế mới" có 28 mẫu (6 của P3 + 22 của P3.1), bấm là vào Studio |
| 3 | Mockup đã tạo dùng ở vị trí dễ nhìn khi đúng sản phẩm/màu | ✅ Thẻ catalog: AIS-001 + AIS-004 (crew trắng) và AIS-007 (crew đen) dùng ảnh mô phỏng trên áo thật làm ảnh chính, kèm nhãn riêng; chi tiết sản phẩm giữ tab "Trên áo thật" |
| 4 | Chọn thiết kế → chuyển vào Studio | ✅ Nút "Dùng hình này" (kèm chọn kiểu áo), test p31 kiểm chứng lớp hình in xuất hiện trong Studio |
| 5 | Chỉnh hình trong Studio tạo bản xem trước mới trên ảnh áo thật | ✅ Panel "Xem trước trên áo thật" ghép TRỰC TIẾP bằng engine P3: sửa chữ/kéo/đổi hình đều cập nhật (test p31: thêm chữ tiếng Việt có dấu → ảnh ghép thay đổi). Hỗ trợ pilot: cổ tròn trắng + cổ tròn đen, mặt trước |
| 6 | Ảnh không đúng phom/màu phải fallback | ✅ Polo/oversize/mặt sau/màu khác → panel hiển thị mockup minh họa + ghi rõ lý do; test p31 kiểm chứng polo rời chế độ real |
| 7 | Không còn lỗi cache | ✅ Toàn bộ asset JS/CSS đổi version `?v=p31vis1` (không còn p2real1/p3mock1 trong code) |
| 8 | P0–P3 không mất | ✅ Unit 32/32; browser + interaction + P0 + P1 (12 theme journeys, exactArtwork) + P3 + P3.1 PASS ở 5 viewport |
| 9 | Ảnh chụp trước/sau | ✅ Bộ ảnh trong `~/workspace/p31-qa/` (home/catalog/detail/studio ở 390px, home 1440px) — đính kèm trong báo cáo PR |
| 10 | CI xanh + kiểm tra live sau phát hành | ⏳ Chờ PR/CI; kiểm tra live thực hiện sau merge theo quy trình chuẩn |

**LCP ≤ 2,5s: VẪN CHƯA ĐẠT** — Lighthouse mobile local: Perf 92, LCP 3013 ms, TBT 173 ms, CLS 0, A11y 96 (cùng điều kiện đo, bản P3 main: Perf 90, LCP 2949 ms, TBT 246 ms). P3.1 từng tụt xuống Perf 63/LCP 4993 ms do dựng lưới + ghép ảnh ngay khi tải trang; đã khắc phục bằng dựng-lười theo viewport, ảnh thumb 400×600 cho thẻ thư viện và fetch-lười dữ liệu mockup → hiệu năng quay về ngang P3, TBT còn tốt hơn. Mục tiêu 2,5s chưa đạt như mọi phase trước; nút thắt còn lại là hero dưới mạng Slow 4G mô phỏng.

## 2. Số liệu bàn giao

- **Thiết kế mới hiển thị:** thư viện 83 thiết kế (55 P1 + 6 P3 + 22 P3.1). 22 mẫu P3.1 phủ 12 nhóm brief yêu cầu: streetwear (sóng âm, chibi nón lá), retro (cassette, cầu vồng hoàng hôn), tối giản (một nét sóng, mặt trời biển), thú cưng (dấu chân tim, mèo cuộn), văn hóa Việt (ruộng bậc thang, đèn lồng), cà phê Việt (phin nhỏ giọt, sữa đá), áo đôi/gia đình (nửa trời, cây gia đình), nghề nghiệp/thể thao (huy hiệu nghề, đường chạy), thiên nhiên (núi hình học, vòng lá), hình học/Y2K (cửa sổ pixel), sinh nhật (bánh tối giản), hội nhóm (đội hình). Mục tiêu 40–60 mẫu mới: hiện 28 — CHƯA ĐẠT, tiếp tục ở phase sau.
- **SKU dùng mockup ảnh thật làm ảnh chính:** 3/14 (AIS-001, AIS-004 — crew trắng; AIS-007 — crew đen). 11 SKU còn lại giữ renderer P2 + nhãn "Mockup minh họa" vì chưa có base đúng phom/màu.
- **Ảnh áo nguồn hợp lệ:** 8 bản ghi garments (2 base ghép được: crew trắng trước, crew ĐEN trước — mới; 3 lifestyle; 3 detail). Sourcing vòng 2 (Agent 1b + PM xem ảnh trực tiếp): tích hợp 8532616 (base đen, Hanna Pad), 8532638 (cận cổ đen), 30710033 (cận vai/jersey trắng, Luis Quintero). Loại 8148576 (phom crop, tay cầm móc), 19041040 (ảnh đen trắng, chủ thể quá xa). Hàng chờ NEEDS_REVIEW thêm: 18257675, 11871836, 5531610.
- **Studio ghép trực tiếp:** hoạt động với áo cổ tròn + trắng kem hoặc đen + mặt trước (2 base đã hiệu chuẩn). Mọi tổ hợp khác fallback trung thực.
- **Mockup dựng sẵn:** 86 bản (83 thiết kế × base trắng + biến thể lớn + 2 bản zodiac trên base đen), fidelity Δcoverage ≤ 0,017.

## 3. Vẫn thiếu (nói thẳng)

- Chưa có cặp ảnh trước/sau CÙNG một sản phẩm cho bất kỳ phom nào; back base, oversize (mọi vai trò), polo base: vẫn MISSING sau 2 vòng tìm kiếm Pexels có kiểm chứng. Nguồn nhà cung cấp có giấy phép mở, dùng được ngay: không tìm thấy (Printful API chỉ hợp lệ khi bán đúng sản phẩm Printful).
- Source Discovery (stage B) đã có mã thật gọi Pexels API nhưng CHƯA kích hoạt vì repo chưa có `PEXELS_API_KEY` trong GitHub Secrets — chạy là báo NOT CONFIGURED, không giả lập.
- Thiết kế mới 28/40–60.
- LCP ≤ 2,5s chưa đạt (xem mục 1).
