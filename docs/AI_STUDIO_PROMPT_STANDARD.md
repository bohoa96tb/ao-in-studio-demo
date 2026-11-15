# AI Studio — Chuẩn prompt (P4.6)

Tài liệu này là chuẩn prompt chính thức của AI Studio từ P4.6. Nó thay thế cách ghép prompt tự do trước đây. Nguyên tắc nền (chủ shop, 2026-11-15): **ảnh sản phẩm tham chiếu là dữ kiện có thẩm quyền cao nhất** — AI chỉ được thay đổi người mẫu, bối cảnh, ánh sáng và góc máy; không bao giờ thay đổi màu áo, cổ áo, tay áo, phom, chất vải hay hình in sẵn có của sản phẩm. Mọi prompt tạo ảnh do hệ thống sinh ra đều phải tuân theo cấu trúc 7 phần dưới đây; một prompt chung chung kiểu "Create a beautiful fashion model wearing a T-shirt" không còn có thể được tạo ra.

Mã nguồn: `buildPromptSections` / `assemblePromptText` / `productIdentityText` / `productNegativeText` trong `src/ai-studio/core.js` (thuần, có unit test trong `tests/ai-studio-p46.test.mjs`).

## Cấu trúc 7 phần (đúng thứ tự)

Prompt gửi đi mở đầu bằng một dòng khẳng định thứ bậc ("The PRODUCT IDENTITY section below is mandatory and outranks every other instruction in this prompt."), sau đó là 7 phần đánh số:

| # | Phần | Nội dung |
|---|---|---|
| 1 | **PRODUCT IDENTITY** | Định danh sản phẩm — dữ kiện bắt buộc, đứng đầu. Có ảnh tham chiếu: lệnh giữ nguyên nguyên văn (xem dưới) điền màu/cổ/tay/phom/hình in từ phân tích sản phẩm. Không có tham chiếu: định danh áo trơn theo thông số áo (PLAIN + màu + kiểu) kèm các cấm tuyệt đối về hình in/logo/chữ và khóa loại trang phục của P4.1. |
| 2 | **MODEL** | Người mẫu (tùy chọn người mẫu của Trợ lý prompt). Có tham chiếu: người mẫu mặc "the exact reference garment from the Product Identity section" — không mô tả lại áo theo tham số. Mẫu 1: khung nửa người theo chuẩn thương mại điện tử của chủ shop. |
| 3 | **SCENE** | Phong cách chụp + bối cảnh + prompt gốc của người dùng + bổ sung. Đây là nơi DUY NHẤT mô tả của người dùng được chèn vào — nó không bao giờ ghi đè được phần 1. |
| 4 | **LIGHTING** | Ánh sáng theo tùy chọn (mềm / nắng tự nhiên / ấm). |
| 5 | **CAMERA** | Góc chụp (chính diện / 3/4), vùng ngực rõ và không bị che; Mẫu 1: máy ở tầm ngực, ống 85mm. |
| 6 | **AVOID (negative prompt)** | Phần phủ định — aware theo màu sản phẩm (xem dưới). |
| 7 | **QUALITY CONTROL** | Lệnh tự kiểm: kết quả phải vẫn là đúng chiếc áo ở phần 1 (cùng màu/cổ/tay/phom); khác đi là SAI. Kèm yêu cầu chất vải/sắc nét. |

### Phần 1 khi có ảnh tham chiếu (nguyên văn khung câu)

> Use the supplied product reference image as the mandatory garment reference. Preserve the exact original garment color, shape, collar, sleeves, fabric appearance and design. Do not replace the **\<colour\>** T-shirt with any other garment. The product is a **\<colour\>** T-shirt (measured dominant garment colour **\<hex\>**) with **\<collar\>**, **\<sleeves\>** and **\<fit\>**. **\<print clause\>** You may change ONLY the model, the scene, the lighting and the camera angle — never the garment itself.

- `<colour>` / `<hex>`: màu đã ĐO từ ảnh (trung vị vùng giữa) hoặc màu người dùng sửa tay trong panel.
- `<collar>` / `<sleeves>` / `<fit>`: từ dữ kiện fixture đã ghi hoặc ô sửa tay; khi chưa xác định → điền đúng cụm **"as shown in the reference image"** — không bao giờ bịa một giá trị cụ thể.
- `<print clause>`: sản phẩm có hình in sẵn → "The reference garment carries an EXISTING print — preserve that print exactly as it is; do not redraw, move, resize or remove it." Áo trơn → "The reference garment is PLAIN — do not add any print, logo, text or graphic to it."

### Phần 6 — negative aware theo màu

Khung cố định: "No color change, …, No garment replacement, No different collar, No different sleeve design, No invented garment graphics, No alteration of original product identity, No print added, removed or redrawn, No watermark" — và hai màu trong bảng màu ở XA màu sản phẩm nhất được nêu đích danh dạng "No \<colour\> shirt" (áo đen → "No white shirt, No yellow shirt"; áo trắng → "No black shirt", …). Mục đích: cấm đúng lỗi hoán đổi màu có khả năng xảy ra nhất, không chỉ cấm chung chung.

## Xử lý negative theo từng API (trung thực)

| API | Cơ chế negative riêng? | Cách hệ thống xử lý |
|---|---|---|
| Pollinations (unified, tham số URL) | KHÔNG có tham số negative | Phần 6 đi trong CHÍNH văn bản prompt dưới nhãn `[6] AVOID (negative prompt):` — model đọc nó như một phần của prompt, không phải một kênh phủ định riêng. |
| Pollinations Classic (legacy) | KHÔNG | Như trên (và Classic là text-only: có ảnh tham chiếu nối vào thì node báo lỗi thay vì chạy). |
| Cloudflare Workers AI (qua Worker Proxy) | KHÔNG có trường negative trong hợp đồng Worker hiện tại | Phần 6 đi trong trường `prompt` của multipart/JSON, cùng nhãn AVOID như trên. |
| DEMO | Không áp dụng | DEMO không gọi model: có tham chiếu thì đầu ra là chính ảnh tham chiếu. |

## Ngoại lệ duy nhất: đường catalogue không có tham chiếu của Mẫu 1

Khi Trợ lý prompt của Mẫu 1 chạy KHÔNG có ảnh sản phẩm (không có product), prompt gửi đi vẫn là **mẫu catalogue nguyên văn của chủ shop** (`CATALOG_PROMPT_TEMPLATE`, P4.2) — đây là đường đã được chủ shop duyệt bằng mắt và các export DEMO của nó là bất biến từng byte. Ngay khi có ảnh tham chiếu, đường sectioned ở trên thay thế: định danh sản phẩm thật quan trọng hơn mẫu câu cố định. `finalizePromptForReference` (node Tạo ảnh AI) là lưới an toàn cuối: prompt nào tới node gen mà chưa mang product trong khi node có ảnh tham chiếu, sẽ được tự chèn phần 1 + phần 6 từ product lên đầu trước khi gọi.

## Bảng năng lực img2img / giữ nguyên sản phẩm theo model

| Model / đường | Nhận ảnh tham chiếu | Cách nhận | Mức giữ nguyên sản phẩm |
|---|---|---|---|
| DEMO (mọi "model") | Có | Dùng trực tiếp làm nền áo | Tuyệt đối (cùng pixel) |
| Cloudflare `@cf/black-forest-labs/flux-2-klein-4b` | Có — img2img thật | Bytes tải thẳng lên Worker của chủ shop (`input_image_0`) | Tái tạo — không bảo đảm; dựa vào prompt identity + QC hậu kiểm |
| Cloudflare `@cf/black-forest-labs/flux-1-schnell` | Không (text-only) | — (adapter từ chối trước khi gọi khi có ảnh) | — |
| Pollinations `klein` / `kontext` (keyed) | Có — qua URL | Tham số `image=<URL công khai>`; chỉ fixture của shop có URL — ảnh local báo lỗi trung thực | Tái tạo — không bảo đảm |
| Pollinations `flux` / `zimage` (keyed) | Không (text-only) | — (node báo lỗi khi có ảnh nối vào) | — |
| Pollinations Classic `sana` | Không (text-only) | — (node báo lỗi khi có ảnh nối vào) | — |

## QC hậu kiểm (đi cùng chuẩn prompt)

Prompt là lớp bảo vệ TRƯỚC; bước QC là lớp SAU: sau khi có ảnh ra, hệ thống so màu áo chủ đạo (đo ở vùng giữa ảnh) với màu sản phẩm đã đo — lệch quá ngưỡng (khoảng cách RGB có trọng số > 90) thì verdict `warn` được ghi vào kết quả, hiện ở Xem trước / Xuất file / Lịch sử chạy, và ở node Ghép hình chế độ Nghiêm ngặt sẽ kích hoạt fallback về chính ảnh sản phẩm gốc (hoặc nền đã duyệt đúng màu). QC là heuristic cảnh báo, không phải chứng nhận — xem giới hạn trong `docs/AI_STUDIO_QA_REPORT.md` mục P4.6.
