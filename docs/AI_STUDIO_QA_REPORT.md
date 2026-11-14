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

## P4 — Provider Adapter & AI thật (2026-11-14)

Kết quả kiểm chứng trên nhánh `feature/ai-studio-p4` (base `aabf024`), máy local:

- **Unit:** `npm test` **89/89 PASS** (78 baseline P1–P3 + 11 test P4 mới trong `tests/ai-studio-p4.test.mjs`: toàn vẹn bảng mô tả provider/giá, URL Classic + kẹp 768, URL/header keyed không lộ key vào URL, ma trận cổng chế độ, ép retry, ước tính chi phí + từ chối model giá token, ánh xạ lỗi 401/402/429, 2 adapter chạy với fetch giả lập, endpoint 0 chi phí giả lập).
- **Playwright P4** (`tests/ai-studio-p4.mjs`, vào CI; **toàn bộ endpoint Pollinations bị mock bằng route interception** — không một request tạo ảnh thật nào được thực hiện): PASS mọi pha —
  - OFF @430: công tắc mặc định TẮT, huy hiệu "AI: DEMO"; chạy Mẫu 1 → **0 request** tới mọi miền pollinations, kết quả demo bình thường.
  - CLASSIC @430 + @1366: nút Kiểm tra kết nối chỉ gọi `/image/models` (1 lần); chạy → **đúng 1 request** Classic chứa `model=sana`; lịch sử chạy ghi `pollinations-classic/sana` + `0 Pollen`.
  - KEYED @430 + @1366: chưa có key → lượt chạy bị chặn kèm giải thích, **0 request**; bộ chọn model hiển thị giá 0.002 của flux; nhập key giả + tick xác nhận → Kiểm tra số dư đọc được 7.5 (mock) với header `Authorization: Bearer …`; chạy → hộp thoại chi phí hiện tổng 0.002 Pollen → **Hủy: 0 request tạo ảnh**; chạy lại → **Chấp nhận: đúng 1 request** tạo ảnh có header Authorization + `model=flux`; lịch sử ghi `pollinations/flux` + `0.002 Pollen`.
  - SMOKE @390 + @1920 (Mẫu 1 demo, 0 request pollinations) + HOME @390 (đủ 4 section trang chủ + link studio.html, 0 lỗi trang). Mọi pha: không tràn ngang, không lỗi trang.
- **Hồi quy:** `tests/ai-studio.mjs` (P1), `tests/ai-studio-p2.mjs` (P2, gồm cả kiểm tra di trú DB v1→v2), `tests/ai-studio-p3.mjs` (P3) đều **PASS**; `npm run build` PASS (dist chứa studio.html nhãn (P4) + đủ file ai-studio). Suite P2 đã bắt được 1 lỗi thật của P4 (thiếu import `describeProvider` làm panel Provider sập khi chọn stub HTTP) — đã sửa và chạy lại PASS. Suite P4 bắt được lỗi `fetch` mất receiver ("Illegal invocation") khiến mọi lệnh gọi thật sẽ hỏng trên trình duyệt thật — đã sửa bằng wrapper `defaultFetch`.
- **Kiểm chứng trực tiếp 0 chi phí (duy nhất được phép gọi thật):** `GET https://gen.pollinations.ai/image/models` trả về danh mục model thật **không cần key**; giá spot-check khớp bảng P4 (z-image-turbo: 0.004 Pollen/ảnh phẳng; dòng GPT Image: giá theo token ở cả prompt/completion).

### CHƯA đạt / chưa kiểm chứng ở P4 (không báo PASS)

- **Tạo ảnh thật end-to-end với Pollinations: CHƯA kiểm thử — có chủ đích.** Không test nào (kể cả thủ công) được gọi endpoint tạo ảnh thật, vì mọi lần tạo đều có thể trừ Pollen hoặc vướng hạn mức ẩn danh. Đường thật mới chỉ được kiểm chứng bằng mock ở tầng route + endpoint danh mục model 0 chi phí ở trên. Lần chạy thật đầu tiên phải do chủ shop tự bật công tắc và tự chịu quyết định chi phí.
- **Img2Img thật: chưa hỗ trợ ở P4** — ảnh người dùng là blob nội bộ không có URL công khai; app báo lỗi trung thực thay vì tải ảnh lên dịch vụ ngoài.
- **Điện thoại Android thật:** chưa kiểm chứng P4 trên thiết bị thật (mới qua Playwright hasTouch @430/390). Chủ shop cần kiểm tra: mở panel bằng nút "⚙ AI / Cài đặt", bật công tắc, hộp thoại chi phí.
- Model giá theo token (GPT Image, Nano Banana) **không chạy được ở P4** theo thiết kế (không có giá cố định để xác nhận trước).
- Các mục chưa đạt từ P1–P3 vẫn giữ nguyên (MP4, minimap, LCP studio.html chưa đo, quad mặt phẳng/mặt sau chưa hiệu chuẩn tay).

## P4.1 — Thiết kế lại Mẫu 1 (2026-11-14)

Kết quả kiểm chứng trên nhánh `feature/ai-studio-p41` (base `34f3c28`), máy local. Điểm khác biệt của vòng QA này: **không coi "workflow báo 0 lỗi" là đạt** — suite mới `tests/ai-studio-tpl1.mjs` khẳng định ở mức PIXEL trên ảnh đầu ra thật (đọc pixel qua canvas trong trang).

- **Kiểm toán (tự xác minh trong code):** 3 nguyên nhân gốc đã ghi trong `AI_STUDIO_CHECKPOINT.md` mục P4.1 — (1) composition chạy trước aiImageGen và kết quả ghép chính xác bị text-to-image ghi đè/vứt bỏ; (2) aiImageGen là text-to-image ở mọi chế độ thật nên không thể tôn trọng ảnh đầu vào; (3) buildPrompt cũ ra lệnh model tự vẽ áo đã in + "giữ nguyên hình in gốc", không có thông số áo, toàn tiếng Việt.
- **Unit:** `npm test` **98/98 PASS** (89 baseline P1–P4 + 9 test P4.1 mới: buildPrompt EN đúng thuật ngữ phom/màu/góc theo thông số + đủ cấm đoán + đã xóa 2 câu lệnh sai; garmentParams mặc định + di trú `angle`; cấu trúc Mẫu 1 — thứ tự dây gen→comp.garment, des→comp.design, comp→preview→export, KHÔNG còn dây comp→gen, imageInput độc lập; payload {text, garment} đi qua engine + hash/cache P2 nguyên vẹn ở cả lượt chạy thật và lượt phục vụ từ cache; migrate garmentSource/realBase; Mẫu 2–4 giữ nguyên luồng).
- **Playwright tpl1** (`tests/ai-studio-tpl1.mjs`, vào CI; DEMO mode, endpoint Pollinations chỉ bị mock ở pha AI-FAIL — **không một request tạo ảnh thật nào**):
  - **Case 1 @1366 + @390** (áo trắng cổ tròn + hình in mẫu có chữ Việt): ảnh áo TRƯỚC khi ghép là áo trơn trắng (phần thân trắng 1,000; màu hình in trong quad = 0). Sau ghép: thân áo trắng 1,000; màu đất nung của hình in trong quad **2.986** điểm mẫu, xanh đậm **94**; rò rỉ màu hình in ra ngoài quad **0**; **tương quan với raster hình in GỐC 0,892** (148 điểm mẫu đục — hình in là pixel gốc bị warp, không phải vẽ lại); file xuất kênh website đúng **1200×1500**.
  - **Case 2 @1366** (áo đen + hình in đa màu `tests/fixtures/design-multicolor.svg`): thân áo đen 1,000; cả 5 màu hình in đều có trong quad (đỏ 3.376 · xanh dương 3.255 · xanh lá 3.519 · vàng 3.542 · tím 256 điểm mẫu).
  - **Case 3 @1366** (oversize + hình in lớn): bề ngang silhouette áo ở giữa thân **0,546** so với 0,408 của regular fit (+0,138); diện tích dấu hình in gấp **1,58×** Case 1.
  - **FALLBACK @1366** (garmentSource='real'): đầu ra đúng **800×1200** của ảnh fixture; pixel áo tại điểm kiểm khớp fixture với **khoảng cách màu 0** (trùng hệt); hình in nằm trong quad hiệu chuẩn của fixture (điểm mẫu đất nung trong quad: 1.952).
  - **AI-FAIL @1366** (Classic bị mock thành HTTP 500): mỗi lượt chạy đúng **1 request** Classic (retry vẫn bị ép 0 cho lệnh thật); node composition báo lỗi kèm gợi ý chuyển sang "Ảnh mẫu thật"; sau khi chuyển nguồn và chạy lại, composition + preview **thành công dù node AI vẫn lỗi** (engine bỏ qua upstream lỗi cho riêng trường hợp này).
  - Mọi pha: không tràn ngang, không lỗi trang.
- **Hồi quy:** `tests/ai-studio.mjs` (P1), `tests/ai-studio-p2.mjs` (P2), `tests/ai-studio-p3.mjs` (P3), `tests/ai-studio-p4.mjs` (P4) đều **PASS**; toàn bộ suite shop của CI (browser, interaction, p0, p1, p3, p31, p36, p4-shop) **PASS**; `npm run lint` + `npm run build` PASS; `scripts/performance.mjs` PASS (Lighthouse Performance 99, LCP 2265 ms — trang chủ shop). Suite baseline-screenshots của CI cần worktree commit baseline P0 nên để CI chạy.
- **Lỗi thật bắt và sửa trong QA P4.1:** handler đổi nguồn ảnh áo ghi cấu hình qua biến `c` đã bị `setupQuadEditor` (P3) thay `node.config` làm mồ côi ngay trong lúc bind → chọn "Ảnh mẫu thật" không có tác dụng. Đã sửa ghi qua `node.config` trực tiếp + comment cảnh báo. (Hành vi tương tự tiềm ẩn ở vài handler P3 dùng `c` sau setupQuadEditor — ghi nhận, ngoài phạm vi P4.1.)
- **3 khẳng định test cũ được cập nhật theo lệnh của chủ shop** (chi tiết trong checkpoint): test unit P1 về buildPrompt, test unit P3 về quad Mẫu 1, 2 khẳng định của suite P2 mã hóa topology cũ. Không khẳng định nào bị nới lỏng về mặt bảo vệ người dùng — chúng được viết lại theo ngữ nghĩa đúng của topology mới và có comment giải thích trong test.

### CHƯA đạt / chưa kiểm chứng ở P4.1 (không báo PASS)

- **Độ bám thông số áo của AI THẬT (sana/flux): CHƯA kiểm chứng — có chủ đích.** Mọi kiểm chứng trên chạy ở DEMO (figure canvas xác định) + mock route. Prompt EN + thông số áo đã đúng cấu trúc, nhưng model thật có nghe lời tuyệt đối (đúng màu/phom, không tự in hình) hay không chỉ biết khi chạy thật — lần chạy Classic đầu tiên (0 Pollen) là quyết định của chủ shop sau khi P4.1 lên live. Nếu ảnh AI sai, đường fallback "Ảnh mẫu thật" đã sẵn sàng và đã được kiểm chứng ở mức pixel.
- **Điện thoại Android thật:** chưa kiểm chứng P4.1 trên thiết bị thật (mới qua Playwright hasTouch @390/430). Chủ shop cần kiểm tra: đổi Kiểu áo/Màu áo trong panel Trợ lý prompt, chuyển Nguồn ảnh áo trong panel Ghép hình in.
- Các mục chưa đạt từ P1–P4 vẫn giữ nguyên (video MP4, minimap, LCP của riêng studio.html chưa đo, quad mặt phẳng/mặt sau chưa hiệu chuẩn tay, img2img thật chưa hỗ trợ).

## P4.2 — QA sửa vị trí vùng in, khung hướng dẫn, hòa trộn và ảnh nền thật (2026-11-14)

Chủ shop bác bỏ P4.1 vì đầu ra không dùng để bán hàng được dù workflow báo 0 lỗi. P4.2 kiểm chứng bằng khẳng định MỨC PIXEL về VỊ TRÍ so với cơ thể (không chỉ "trong quad") + quét màu khung hướng dẫn, và xuất ảnh kết quả thật để duyệt bằng mắt.

### Số đo cổ áo và quad đã hiệu chuẩn (đo trên ảnh/figure thật)

| Nền | Mép dưới cổ áo (y) | Margin quad | Quad (tương đối) | Tâm dọc quad |
|---|---|---|---|---|
| Figure DEMO cổ tròn (vẽ trong studio.js) | 0.316 (điểm thấp nhất đường cong cổ + nét viền) | 0.099 | [[0.325,0.415],[0.675,0.415],[0.675,0.615],[0.325,0.615]] | 0.515 |
| Figure DEMO oversize | 0.336 | 0.084 | [[0.30,0.42],[0.70,0.42],[0.70,0.62],[0.30,0.62]] | 0.52 |
| Người mẫu trắng (Pexels 10159280) | 0.358 (điểm thấp nhất cổ áo trên ảnh 960×1200; tâm ngực x=0.486) | 0.085 | [[0.366,0.443],[0.606,0.443],[0.606,0.593],[0.366,0.593]] | 0.518 |
| Người mẫu trắng — biến thể oversize | 0.358 | 0.085 | [[0.336,0.443],[0.636,0.443],[0.636,0.618],[0.336,0.618]] | 0.531 |
| Người mẫu đen (Pexels 9558583) | 0.495 (áo được cầm căng, cổ áo ở giữa khung hình; tâm áo x=0.58) | 0.09 | [[0.43,0.585],[0.73,0.585],[0.73,0.745],[0.43,0.745]] | 0.665 (ngoài dải 42–52% vì khung hình chụp áo ở nửa dưới — đã ghi nhận) |
| Móc treo trắng (Pexels 20669538) | 0.33 (quét dải cổ trong + đường cổ trên ảnh) | 0.095 | [[0.315,0.425],[0.515,0.425],[0.515,0.615],[0.315,0.615]] | 0.52 |
| Móc treo đen (Pexels 8532616) | 0.26 (đáy tem size ở cổ) | 0.095 | [[0.36,0.355],[0.63,0.355],[0.63,0.635],[0.36,0.635]] | 0.495 |
| Mặt sau trắng (Pexels 17515211) | 0.445 (mép dưới cổ sau) | 0.09 | [[0.36,0.535],[0.68,0.535],[0.68,0.735],[0.36,0.735]] | 0.635 |

### Kết quả suite tests/ai-studio-tpl1.mjs (P4.2) — PASS toàn bộ

- **WHITE-CREW @1366 và @390:** DEMO trả đúng ảnh người mẫu trắng 960×1200 (không phải figure vẽ), nhãn "dùng ảnh chụp thật làm ảnh nền tham chiếu" xuất hiện; mẫu màu hình in trong quad [793, 710, 807, 811, 57], rò rỉ ngoài quad **0**; bbox hình in: top **0.444** (≥ cổ 0.358 + 0.08 = 0.438 ✓), tâm **0.518** (trùng tâm quad); tương quan raster với hình in gốc **0.899** (ngưỡng giữ nguyên ≥0.85; số đo dao động nhẹ theo lượt chạy do lấy mẫu trên lưới warp, các lượt đo đều 0.90–0.99); export website đúng **1200×1500** với hình in hiện diện (tổng mẫu 5985).
- **BLACK-CREW @1366:** DEMO trả ảnh đen 800×1200; cả 5 màu hình in hiện diện (tổng 4033), rò rỉ **0**; bbox top **0.587** (≥ 0.495 + 0.08 = 0.575 ✓), tâm **0.665** (trùng tâm quad, trong dải ngực của nền này [0.58, 0.74]); tương quan **0.92**.
- **OVERSIZE @1366:** dùng ảnh trắng + quad rộng tự động; dấu chân hình in **1.48×** bản cổ tròn; rò rỉ **0**; tâm bbox 0.531 trong dải [0.42, 0.58].
- **FALLBACK:** nguồn "Ảnh mẫu thật" mặc định → ảnh người mẫu trắng (đầu ra ghép 900×1125 — handler giới hạn bề ngang 900px từ trước), hình in đúng quad + đúng vị trí; đổi sang móc treo trắng → đầu ra 800×1200, pixel áo khớp fixture, hình in trong quad móc treo (tổng mẫu 3117), vị trí đạt quy tắc cổ áo.
- **AI-FAIL:** Classic bị mock HTTP 500 — đúng **1 request mỗi lượt chạy** (retry ép 0); lỗi composition gợi ý chuyển "Ảnh mẫu thật"; chuyển nguồn → chạy hoàn tất trên ảnh thật.
- **GUIDE-REGRESSION (case riêng, hình in KHÔNG chứa màu đỏ):** quét màu đỏ đứt nét của khung (182,73,47) quanh biên quad trên **1155** điểm mẫu — Xem trước: **0** pixel; file PNG xuất ra: **0** pixel. (Case riêng là bắt buộc: màu đỏ của chính hình in sau khi phủ bóng vải có thể lọt vào dung sai của màu khung — ghi rõ trong test.)
- **Unit `npm test`: 105/105 PASS** (98 cũ + 7 test P4.2 mới: chestQuadFor + kiểm chứng margin, registry PHOTO_BASES + ánh xạ photoBaseFor, mặc định đơn giản, migrate inkOpacity). Hai khẳng định P4.1 về realBase mặc định được cập nhật theo quyết định P4.2 (mặc định = ảnh người mẫu trắng thay cho móc treo), có comment trong test.
- **Hồi quy:** ai-studio.mjs (P1) PASS; ai-studio-p2.mjs PASS (chạy đơn lẻ — một lần chạy song song 3 suite trên VM nhỏ bị timeout do tranh CPU, chạy lại riêng PASS toàn bộ phase A–E); ai-studio-p3.mjs PASS; ai-studio-p4.mjs PASS; toàn bộ suite shop của CI (browser 5 viewport, interaction, p0, p1, p3, p31, p36, p4-shop) PASS; lint + build PASS; scripts/performance.mjs PASS theo tiêu chí của script (Performance 79 / LCP 3165 ms đo trên VM đang tải nặng — số đo môi trường, trang chủ shop; lần đo P4.1 trên máy yên tĩnh là 99 / 2265 ms). Baseline-screenshots để CI chạy (cần worktree commit P0).
- **Ảnh kết quả cho chủ shop duyệt (bắt buộc ở P4.2):** chạy Mẫu 1 ở DEMO với hình in mẫu mặc định, xuất kênh website 1200×1500: `white-crew.png`, `black-crew.png`, `oversize.png` — hình in giữa ngực, dưới cổ áo, không khung đứt nét. Kèm trong báo cáo bàn giao.

### CHƯA đạt / chưa kiểm chứng ở P4.2 (không báo PASS)

- **Ảnh oversize người mẫu thật: CHƯA có.** Đã rà Pexels theo đúng kỷ luật thẩm định — không có ảnh oversize trơn chính diện đạt chuẩn (ứng viên đều có in/logo hoặc là áo sơ mi nút). Oversize tạm dùng ảnh trắng phom rộng + quad rộng hơn; khi có ảnh đạt chuẩn sẽ bổ sung vào PHOTO_BASES.
- **Ảnh nền đen là áo được CẦM căng, không phải mặc:** mặt trước phẳng và trống nên ghép đúng, nhưng mép áo ngoài vùng in có biến dạng nhẹ; tâm vùng in 0.665 nằm ngoài dải ngực 42–52% của ảnh chân dung thông thường vì khung hình chụp áo ở nửa dưới — đúng với chính ảnh đó, đã ghi nhận thay vì giấu.
- **Độ bám thông số áo của AI THẬT (sana/flux): vẫn CHƯA kiểm chứng** (giữ nguyên từ P4/P4.1 — không gọi API tạo ảnh thật theo quy định chi phí). P4.2 chỉ sửa đường DEMO + ghép; lần chạy thật đầu tiên vẫn là quyết định của chủ shop.
- **Điện thoại Android thật:** P4.2 mới kiểm chứng qua Playwright (kèm viewport 390px trong suite tpl1). Chủ shop cần duyệt trực tiếp 3 ảnh kết quả và kiểm tra trên điện thoại: kéo quad trong trình căn chỉnh, trượt "Độ phủ mực", đổi "Ảnh mẫu thật".
- Các mục chưa đạt từ P1–P4.1 giữ nguyên (video MP4, minimap, quad mặt phẳng chưa hiệu chuẩn tay cho shop, img2img thật chưa hỗ trợ).
