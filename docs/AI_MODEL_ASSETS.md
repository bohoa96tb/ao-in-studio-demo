# AI Studio — Hồ sơ ảnh người mẫu do AI tạo (AI Model Assets)

**Đây KHÔNG phải hồ sơ giấy phép ảnh chụp.** Các ảnh trong tài liệu này là
**ảnh do AI tạo** — chúng không phải ảnh chụp thật, không có nhiếp ảnh gia,
và **không thuộc** `docs/P2_ASSET_LICENSES.md` (tài liệu đó chỉ dành cho ảnh
chụp có giấy phép đã kiểm chứng). Mọi tên gọi trong ứng dụng và tài liệu đều
ghi rõ "do AI tạo"; **tuyệt đối không trình bày các ảnh này là ảnh chụp thật**
hay ảnh sản phẩm thật.

## Nguồn gốc (provenance)

- **Công cụ tạo:** Muse — pipeline tạo ảnh (media generation), 2026-11-14.
- **Prompt:** `CATALOG_PROMPT_TEMPLATE` trong `src/ai-studio/core.js` — mẫu
  prompt catalogue thương mại điện tử **nguyên văn của chủ shop**, chỉ thay
  `[COLOR]` / `[FIT_TYPE]` theo thông số áo.
- **Duyệt:** Chủ shop (Van) đã xem từng ảnh và duyệt cả 3 vào 2026-11-14
  ("Duyệt cả 3 ảnh, tích hợp vào P4.2") — gồm cả ảnh áo đen dùng **người mẫu
  nam**, giữ nguyên như đã duyệt.
- **Mục đích sử dụng duy nhất:** nền người Mẫu 1 (Template 1) của AI Studio ở
  chế độ DEMO — người mẫu mặc áo **TRƠN**; hình in của khách được ghép **hậu
  kỳ bằng file gốc** ở node Ghép hình in, AI không vẽ hình in. Ảnh xuất ra vẫn
  mang banner DEMO như mọi đầu ra DEMO khác.
- **Bối cảnh:** P4.2 vòng 1–3 đã rà soát ảnh chụp thật (Pexels) theo chuẩn
  khung hình thương mại điện tử của chủ shop (nửa người, thấy toàn bộ áo, nền
  studio sáng, người mẫu Việt/châu Á) — không ảnh nào đạt trọn checklist cho
  trắng/đen/oversize. Chủ shop quyết định chuyển lớp người mẫu sang ảnh AI
  tạo thay vì hạ chuẩn hoặc dùng ảnh sai.

## Danh sách ảnh

| File | Tổ hợp áo | Người mẫu | Kích thước | Mốc thân áo đã đo (collarBottomY / hemY / torsoCenterX / torsoWidth) |
|---|---|---|---|---|
| `public/fixtures/ai-model/model-white-crew.webp` | Trắng · cổ tròn regular (`trang`/`co-tron`) | Nữ, Việt Nam | 1280×1920 | 0.383 / 0.952 / 0.50 / 0.49 |
| `public/fixtures/ai-model/model-black-crew.webp` | Đen · cổ tròn regular (`den`/`co-tron`) | **Nam**, Việt Nam | 1280×1920 | 0.363 / 0.966 / 0.505 / 0.51 |
| `public/fixtures/ai-model/model-white-oversize.webp` | Trắng · oversize (`trang`/`oversize`) | Nữ, Việt Nam | 1040×2352 | 0.328 / 0.919* / 0.505 / 0.72 |

\* Oversize: vạt áo cong/rủ — hemY là điểm thấp nhất của vạt ở chính giữa mặt
trước, đo trên chính ảnh.

Cả 3 ảnh: khung nửa người từ đỉnh đầu qua hông, thấy **toàn bộ** áo (cổ, hai
vai, hai ống tay trọn, vạt áo + cạp quần jean), người mẫu đứng thẳng nhìn
thẳng, hai tay đút túi, tóc không che ngực, ngực áo trống trơn, nền xám sáng
liền mạch, ánh sáng studio đều.

Mốc thân áo được đo bằng lưới + quét pixel trên chính file ảnh (chi tiết
phương pháp và số đo trong `docs/AI_STUDIO_QA_REPORT.md`, mục P4.2 vòng 4);
vùng in suy ra bằng `torsoQuadFor` (khoảng cách cổ→mép in = 12–15% chiều dài
thân áo, bề rộng in = 35–45% bề ngang thân áo) — cùng một luật cho mọi nền.

## Quy tắc sử dụng

1. Chỉ dùng làm nền DEMO cho Mẫu 1 (và chọn thủ công trong node Ghép hình in
   qua danh sách ảnh nền — tên ảnh luôn kèm "(KHÔNG phải ảnh chụp thật)").
2. Nhãn "Ảnh người mẫu do AI tạo" phải đi kèm ở node/log/label kết quả;
   không gỡ nhãn, không gọi là "ảnh chụp thật" trong bất kỳ tài liệu hay
   giao diện nào.
3. Tổ hợp chưa có ảnh AI đã duyệt (màu khác, oversize đen, góc 3/4) dùng
   hình vẽ DEMO với nhãn trung thực — không tự tạo thêm ảnh AI mới khi chưa
   có duyệt của chủ shop cho từng ảnh.
4. Muốn thay/thêm ảnh: tạo bằng đúng prompt catalogue của chủ shop, trình
   chủ shop duyệt từng ảnh, rồi cập nhật bảng trên + đo lại mốc thân áo +
   cập nhật `AI_MODEL_LANDMARKS` trong `src/ai-studio/warp.js`.
