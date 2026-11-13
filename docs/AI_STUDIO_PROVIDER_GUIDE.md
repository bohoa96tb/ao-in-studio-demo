# AI Studio — Provider Guide

## Trạng thái P4 (2026-11-14)

AI Studio có **hai chế độ tách bạch**:

- **DEMO (mặc định):** công tắc "Bật chế độ AI THẬT" **tự TẮT mỗi lần mở trang**. Khi tắt, mọi node AI chạy `DemoAdapter` trên máy như P1–P3 và **không có bất kỳ lệnh gọi tạo ảnh nào ra ngoài** (đã kiểm chứng bằng Playwright chặn route: 0 request tới miền pollinations).
- **AI THẬT:** chỉ khi người dùng tự bật công tắc trong phiên. Hai provider Pollinations (xem dưới). Node **video vẫn luôn là DEMO** ở P4 — chưa có provider video thật.

Giá và giới hạn dưới đây được **kiểm chứng từ nguồn chính thức của Pollinations ngày 2026-11-14** (docs/FAQ tại pollinations.ai + báo cáo nghiên cứu `~/workspace/research_notes/pollinations-api-pricing-20261113-2304/report.md`; kiểm tra trực tiếp không tốn chi phí: `GET https://gen.pollinations.ai/image/models` trả về danh mục model thật không cần key — giá spot-check khớp bảng dưới, ví dụ z-image-turbo 0.004 Pollen/ảnh; các model GPT Image hiển thị giá theo token). Giá có thể thay đổi — luôn xem lại trong panel Provider (nút "Kiểm tra kết nối" đọc danh mục model thật) trước khi chạy.

## Hợp đồng Adapter (`src/ai-studio/providers.js`)

Workflow Engine **không biết gì về từng nhà cung cấp**. Mọi đặc thù nằm sau hợp đồng adapter + **bảng mô tả provider** (`PROVIDERS`) — nguồn sự thật duy nhất cho UI (bộ chọn provider/model, giá, giới hạn):

```js
PROVIDERS = [{
  id, name, kind: 'demo' | 'free' | 'keyed' | 'http', requiresKey,
  models: [{ id, name, pricePerImage /* Pollen, null = giá theo token */, tokenPriced, supportsImg2Img }],
  limits,                       // văn bản chi phí & hạn mức hiển thị trong UI
}]
adapter = {
  id, name, kind, isDemo,
  capabilities(),               // {imageGeneration, imageVariation, imageToVideo, real}
  generateImage({prompt, image}) -> {blob, mime, providerId, modelId, costPollen, label},
  variation({image, variant}),
  imageToVideo({image, motion, duration, ratio}, onProgress),
  testConnection(),             // CHỈ đọc danh mục model — không bao giờ tạo ảnh để "test"
}
```

Thêm nhà cung cấp mới (ví dụ Gemini) = **một adapter + một mục trong `PROVIDERS`**; không sửa engine, không sửa node. Các hàm thuần (không DOM, có unit test): `resolveGenerationMode` (cổng chế độ), `estimateGenerationCost` / `describePlannedCalls` (ước tính chi phí trước khi chạy), `suppressRetryForMode`, `buildClassicUrl` / `buildKeyedImageUrl` / `keyedHeaders`, `pollinationsErrorMessage`, `fetchModelCatalog` / `fetchBalance`.

## Provider 1 — Pollinations Classic (miễn phí, `pollinations-classic`)

- Đường duy nhất **không cần key và tốn đúng 0**: API legacy `GET https://image.pollinations.ai/prompt/{prompt đã mã hoá}?model=sana&width=&height=&seed=` → ảnh JPEG.
- Giới hạn ẩn danh (chính thức): **chỉ model `sana`**, **tối đa 768×768** (app tự kẹp kích thước giữ tỉ lệ), ảnh có **logo Pollinations**, khoảng **1 request / 45 giây / IP**; vượt hạn mức trả **402 + Retry-After**.
- App **không tự thử lại** lệnh gọi thật (retry bị ép về 0): gặp 402/429 thì node báo lỗi tiếng Việt rõ ràng, người dùng tự chạy lại sau.
- Nhãn kết quả: "AI THẬT — Pollinations Classic (miễn phí, có logo, tối đa 768px)".
- Node Biến thể ảnh ở chế độ Classic: sana **không hỗ trợ img2img** → app tạo ảnh MỚI từ prompt biến thể và ghi nhãn đúng như vậy (không giả là img2img). Ảnh tham chiếu không bao giờ bị gửi đi.

## Provider 2 — Pollinations có key (`pollinations`)

- API hợp nhất `https://gen.pollinations.ai` — **mọi lần tạo ảnh đều trừ Pollen trả trước** (~1 Pollen ≈ 1 USD). **Không còn free tier định kỳ.** Key dạng `sk_…`, gửi qua header `Authorization: Bearer` (không bao giờ đặt key vào URL).
- Chỉ các model **giá cố định theo ảnh** mới được chạy ở P4:

| Model id | Model gốc | Pollen/ảnh | Img2Img |
|---|---|---|---|
| `flux` | FLUX.1 Schnell | 0.002 | Không |
| `zimage` | Z-Image Turbo | 0.004 | Không |
| `klein` | FLUX.2 Klein | 0.005 | Có* |
| `kontext` | FLUX.1 Kontext Pro | 0.03 | Có* |

  \* Img2Img cần URL ảnh công khai — xem mục "Ảnh tham chiếu" dưới đây: ở P4 đường này báo lỗi trung thực, text-to-image là đường chạy trọn vẹn.
- Model **giá theo token** (GPT Image, Nano Banana…) **không có giá cố định cho mỗi ảnh → P4 KHÔNG cho chạy**: hiển thị trong bộ chọn ở trạng thái tắt kèm ghi chú "giá theo token · P4 không cho chạy". Không đoán giá.
- Số dư: `GET https://gen.pollinations.ai/account/balance` bằng key phiên (nút "Kiểm tra số dư") — chỉ đọc, không tạo ảnh.
- Pollen là **trả trước**: hết số dư/key hết ngân sách thì provider **dừng cứng bằng lỗi 402**, không tự trừ thẻ. **Ngoại lệ ngoài tầm kiểm soát của app:** nếu chủ tài khoản đã bật *auto top-up* trong dashboard Pollinations thì tài khoản có thể tự nạp — cảnh báo này hiển thị ngay trong panel Provider.

## Cổng an toàn chi phí (bắt buộc, đã có test)

1. Công tắc AI thật **mặc định TẮT** mỗi lần tải trang; không lưu vào đâu.
2. Provider có key chỉ hoạt động khi: đã dán key vào ô password (chỉ bộ nhớ phiên) **VÀ** tick ô xác nhận hiểu rủi ro trong panel. Thiếu một trong hai → lượt chạy bị chặn trước khi gọi bất cứ thứ gì, kèm giải thích.
3. Trước **mọi** lượt chạy có lệnh tạo ảnh bằng key, hộp thoại xác nhận liệt kê **từng lệnh gọi + giá Pollen + tổng (≈ USD)**; chỉ khi bấm "Chạy và chấp nhận chi phí" mới gọi API. Bấm Hủy = **0 request**.
4. **Retry bị ép về 0** cho mọi lệnh gọi provider thật, bất kể "Cài đặt chạy" của P2 đặt bao nhiêu (có ghi log việc ép này). Bộ nhớ đệm P2 giữ nguyên: **trúng đệm = không gọi API**.
5. Số ảnh mỗi lệnh tạo (`count`) bị ép về **1** ở chế độ thật trong P4.
6. **Lịch sử chạy (P2) ghi lại** provider + model + chi phí ước tính của từng lệnh gọi thật (0 với Classic) để đối soát.
7. Lỗi HTTP từ provider thật hiển thị tiếng Việt kèm mã trạng thái (402 = hết Pollen/hạn mức, 401 = key không hợp lệ, 403 = key không có quyền dùng model, 429 = quá tải). **Không bao giờ** âm thầm thay bằng ảnh demo khi node đang ở chế độ thật.

## Bảo mật API key (bắt buộc)

- Key chỉ nhập vào ô password trong panel Provider; code giữ ở **biến bộ nhớ module** (`setSessionKey`), mất khi tải lại trang. **Không** ghi key vào Git, IndexedDB, localStorage, `workflow.json`, ZIP xuất hay bất kỳ file nào.
- Cảnh báo hiển thị ngay trong UI: key `sk_` vốn là thông tin xác thực phía máy chủ; dùng trực tiếp từ trình duyệt là **tự chịu rủi ro** (ai xem mã trang/Network đều thấy key). Chỉ dùng key có ngân sách giới hạn để thử.
- Đường vận hành lâu dài đúng đắn vẫn là **backend proxy/serverless** giữ key phía server (stub `HttpAdapter` giữ lại cho hướng này: thiếu endpoint/key thì từ chối; đủ cả hai vẫn báo rõ ánh xạ payload chưa cấu hình — không tạo kết quả giả).

## Ảnh tham chiếu (giới hạn trung thực của P4)

Ảnh của người dùng nằm trong IndexedDB dạng blob trên máy — **không có URL công khai**, mà img2img của Pollinations cần URL. App **không tải ảnh của người dùng lên bất kỳ dịch vụ nào**. Vì vậy khi node AI nhận ảnh tham chiếu ở chế độ thật:

- Model hỗ trợ img2img (klein/kontext): node báo lỗi rõ "ảnh tham chiếu đang lưu trên máy, chưa có URL công khai — P4 chưa hỗ trợ img2img với ảnh nội bộ".
- Model chỉ text-to-image (flux/zimage/sana): ảnh tham chiếu **không được gửi đi**; app tạo ảnh chỉ từ prompt và ghi log cảnh báo điều đó.

## Quyền dùng thương mại

Điều khoản hiện tại của Pollinations **không tự cấp quyền thương mại** cho ảnh đầu ra — quyền phụ thuộc **giấy phép của từng model**. Ảnh AI luôn giữ nhãn "Ảnh AI", không bao giờ được trình bày là ảnh sản phẩm thật.
