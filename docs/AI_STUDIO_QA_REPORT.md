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

## P4.2 bổ sung — QA nội địa hóa người mẫu, logo, banner, prompt (2026-11-14)

Lệnh bổ sung của chủ shop sau khi xem ảnh vòng 1: thay toàn bộ ảnh người mẫu bằng người mẫu Việt/châu Á (kể cả ảnh trắng đã đạt vị trí), cấm áo cầm tay cho nền đen, oversize phải là áo thật, logo phải đọc được trên áo tối, banner DEMO đồng nhất, prompt mặc định người mẫu Việt.

### Ảnh nền mới và hiệu chuẩn (tự tải + tự xem từng ảnh)

| Nền | Nguồn | Kết luận sau khi XEM ảnh | Cổ áo | Quad |
|---|---|---|---|---|
| Trắng cổ tròn — **ĐẠT** | Pexels 25471921, quang vinh, Pexels License | Phụ nữ Việt trưởng thành, MẶC áo thun trắng trơn, chính diện, ngực trống, nền studio mềm | 0.64 (đo lưới trên fixture 960×1200; tâm ngực x=0.40) | [[0.27,0.725],[0.53,0.725],[0.53,0.875],[0.27,0.875]] (margin 0.085) |
| Đen cổ tròn — **CHƯA ĐẠT** | ~16 góc truy vấn Pexels | Không có ảnh đạt chuẩn (người mẫu Á + MẶC + trơn + chính diện + ngực trống). Loại: 9558583 cầm áo; 25884888 sơ mi nút; 1129019 kéo áo che mặt; 9017001 tay che ngực/cổ vỏ sò; 16701778 in "RUNNING" + không phải ĐNÁ; 19099186 nghiêng + in + tay trên ngực; 26704856 gần nghiêng + tóc phủ ngực; 9558567 không phải người Á + mất đầu; 16131006 in hiệu + tay che ngực; loạt MART gắn thẻ teen (rủi ro tuổi — không dùng) | — | figure vẽ (cổ 0.316, quad cổ tròn) |
| Oversize — **CHƯA ĐẠT** | cùng đợt rà | Không có ảnh oversize TRƠN trên người mẫu Á: ứng viên đều in statement/graphic (BANDAR BAANT, Madvortex 16155503) hoặc người mẫu không phải người Á (1926769) | — | figure vẽ oversize (cổ 0.336, quad [[0.30,0.42],[0.70,0.42],[0.70,0.62],[0.30,0.62]]) |

### Kết quả suite tests/ai-studio-tpl1.mjs (bổ sung) — PASS (3 lượt liên tiếp sau gia cố hạ tầng test)

- **WHITE-CREW @1366 + @390:** DEMO trả ảnh Việt 960×1200, nhãn "dùng ảnh chụp thật làm ảnh nền tham chiếu"; mẫu màu trong quad [911, 756, 924, 920, 53], rò rỉ **0**; bbox top **0.727** (≥ cổ 0.64 + 0.08 = 0.72 ✓), tâm **0.800** (khung chân dung gần — tâm vùng in nằm ở phần ngực hiện trong khung, đúng quy tắc cổ áo); tương quan **0.909** (≥0.85 giữ nguyên); export 1200×1500, banner: stripRows **24**, textPx **1904**.
- **BLACK-CREW (figure trung thực):** figure 768×960 + nhãn "chưa có ảnh chụp thật đã kiểm chứng"; cả 5 màu hiện diện, rò rỉ **0**, tâm bbox **0.515**, tương quan **0.88**; banner export stripRows **24**, textPx **1906**.
- **OVERSIZE (figure trung thực):** silhouette span **0.573** vs cổ tròn **0.438** (rộng hơn 1.31× — phom rộng THẬT trên figure, không phải in to trên áo thường); dấu chân hình in **1.19×** bản cổ tròn cùng figure; rò rỉ **0**; banner textPx **1906**.
- **FALLBACK:** "Ảnh mẫu thật" mặc định = ảnh người mẫu Việt (đầu ra 900×1125), mẫu thân áo kiểm chứng theo chữ ký sáng lạnh của chính ảnh (205,228,241); móc treo trắng 800×1200 giữ nguyên đạt.
- **AI-FAIL + GUIDE-REGRESSION:** không đổi kết quả — 1 request Classic/lượt; preview + export 0 pixel màu khung.
- **Logo (FIX C):** unit test mới khẳng định SVG mẫu không còn `#293e35`, cả hai dòng chữ đều trắng trong huy hiệu đất nung; kiểm chứng bằng mắt trên 3 ảnh xuất (dưới đây).
- **Prompt (FIX E):** unit test mới: lựa chọn nu-viet/nam-viet tồn tại kèm nhãn tiếng Việt; mặc định node + Mẫu 1 = nu-viet; buildPrompt EN chứa "a young Vietnamese female model wearing a PLAIN white" (và bản nam tương ứng).
- **Unit `npm test`: 107/107 PASS** (105 + 2 mới). **Hồi quy:** ai-studio.mjs PASS; ai-studio-p2.mjs PASS; ai-studio-p3.mjs PASS; ai-studio-p4.mjs PASS; lint PASS; build PASS.
- **Ghi chú độ ổn định suite:** trên VM chịu tải, suite từng fail rời rạc do ĐỌC phải ảnh lượt trước (img vừa đổi src) và do màu son của người mẫu lọt dung sai màu hình in khi không đối chiếu ảnh nền — cả hai đã sửa ở hạ tầng/điều kiện đo (ghi comment trong test), KHÔNG khẳng định nào bị nới lỏng; sau sửa: 3 lượt PASS liên tiếp.

### Tự xem 3 ảnh kết quả (bắt buộc — mắt là chính)

- `white-crew.png` — **ĐẠT:** người mẫu Việt mặc áo trắng trơn, huy hiệu giữa ngực dưới cổ áo (không chạm cổ/tóc), "ÁO IN" + "STUDIO" trắng đọc rõ, banner DEMO một dải gọn ở trên cùng, không khung đứt nét.
- `black-crew.png` — **đúng mọi tiêu chí KỸ THUẬT nhưng là FIGURE VẼ:** áo đen cổ tròn, logo giữa ngực và "STUDIO" đọc rõ hoàn toàn trên nền đen (FIX C đạt), banner một dải duy nhất (dải bóng ma của bản nháp đầu đã sửa bằng dải nướng tỉ lệ 4.5%). Vẫn **CHƯA ĐẠT** yêu cầu "ảnh người mẫu Á mặc áo đen thật" — báo trung thực, nhãn trong app cũng nói rõ chưa có ảnh đã kiểm chứng.
- `oversize.png` — **figure vẽ phom rộng thật** (vai rủ, thân rộng — span 1.31×), logo giữa ngực đọc rõ, banner đồng nhất. **CHƯA ĐẠT** yêu cầu ảnh oversize thật trên người mẫu Á.

### CHƯA đạt / chưa kiểm chứng ở P4.2 bổ sung (không báo PASS)

- **Ảnh đen người mẫu Á MẶC áo đen trơn: CHƯA CÓ** sau đợt rà kỹ (danh sách loại ở trên). Cần chủ shop: hoặc cung cấp ảnh của shop, hoặc duyệt nới tiêu chí (ví dụ chấp nhận ảnh 3/4, hoặc người mẫu châu Á ngoài Việt Nam với ngực bị tóc che một phần — 20603344 đã xem nhưng tóc phủ nửa ngực nên không tự ý dùng).
- **Ảnh oversize trơn trên người mẫu Á: CHƯA CÓ** — cùng lựa chọn như trên.
- Ảnh trắng mới là khung chân dung GẦN: vùng in nằm thấp hơn trên thân so với ảnh nửa người (đúng quy tắc cổ áo trên chính khung hình đó); nếu chủ shop muốn khung nửa người, cần một ảnh khác đạt chuẩn — ứng viên dự phòng đã xem 25471969 (cùng người mẫu, góc 3/4 nhìn xuống, tay bắt chéo thấp) chưa dùng.
- Các mục chưa đạt cũ giữ nguyên (AI thật chưa chạy end-to-end — quyết định của chủ shop; P4.2 chưa kiểm chứng trên điện thoại thật; video MP4/minimap…).

## P4.2 vòng 3 — QA chuẩn thương mại điện tử: tìm ảnh, luật torso, prompt nguyên văn (2026-11-14)

Chủ shop BÁC ảnh trắng vòng 2 (Pexels 25471921: chân dung cận đầu–vai, đầu quá to, thân áo bị cắt dưới ngực, ngả vào máy, nền phòng tối) và ban hành chuẩn TMĐT (Uniqlo/Coolmate/Printful) + luật đặt in mới + mẫu prompt nguyên văn. Mục này thay thế kết luận ảnh của hai mục P4.2 trước (luật/ảnh vòng 1–2 chỉ còn giá trị lịch sử).

### Tìm ảnh theo checklist TMĐT — 26 ứng viên tải về và XEM TỪNG ẢNH: không ảnh nào đạt trọn

Checklist: nửa người (đỉnh đầu → qua hông); áo chiếm 60–70% khung, thấy TOÀN BỘ áo (cổ, 2 vai, 2 tay áo, gấu + cạp quần); máy ngang ngực; đứng thẳng nhìn thẳng; tay thả/đút túi; không ngả/không bắt chéo/không tóc phủ ngực; nền studio sáng trung tính trơn; người mẫu Việt/châu Á trưởng thành; áo TRƠN; giấy phép rõ.

| Ứng viên (Pexels) | Hạng | Lý do loại (mục checklist trượt) |
|---|---|---|
| 25471921 (vòng 2) | trắng | Chính ảnh bị chủ shop bác: chân dung cận, thân cắt dưới ngực, ngả vào máy, nền phòng tối |
| 6310890 (+ 6310889 bản ngang) | trắng | GẦN NHẤT: mẫu Á mặc áo trắng trơn, đứng thẳng, thấy toàn bộ áo + cạp quần — NHƯNG nền tường vân đá + sàn gỗ herringbone, không phải nền studio trơn |
| 6769350 (cottonbro) | trắng | Mẫu Philippines nền studio xám đạt — nhưng góc 3/4 nhìn đi chỗ khác + áo SƠ VIN vào quần (không thấy gấu) |
| 17781161 | trắng | Tựa tường (ngả), nhìn ngang, áo sơ vin, chân bắt chéo |
| 17542870 | trắng | Người mẫu không phải người Á; tay chống hông |
| 6902761 | trắng | Áo CÓ IN (hình cờ); góc 3/4; tay vuốt tóc |
| 6786614 | trắng | Cắt mất đầu (chỉ tới cằm); khung ngang |
| 12025472 | trắng | Ảnh trải phẳng, không có người mẫu |
| 7752451 / 7752454 | trắng | Áo SƠ MI cài nút (không phải áo thun); ngồi/xoay người |
| 7665789 | trắng | Người mẫu không phải người Á; lưng góc 3/4 |
| 4066293 / 4066292 / 4066290 | đen | Cắt mất đầu hoàn toàn; nền phòng lò sưởi xanh; không xác minh được dân tộc |
| 5468621 | đen | Mẫu Á nền trắng trơn — nhưng NHÌN NGHIÊNG hẳn, khung ngang không thấy gấu, dây chuyền trên ngực |
| 13983321 | đen | Áo có CHỮ "SPORTAND" trên ngực; tựa tường; tay giữ gấu áo |
| 16103389 | đen | Nền phố đèn lồng; dây túi đeo chéo qua ngực; miếng dán nhãn trên ngực |
| 8338078 | đen | Ngoài trời (mục mô tả kết quả tìm kiếm: chụp ngoài trời, biểu cảm nghiêm) — không xem tiếp vì nền ngoài trời đã trượt |
| 39457678 | oversize (trắng) | Áo oversize trắng nền trắng, thấy toàn bộ áo + quần short — NHƯNG cắt mất đầu (khung chỉ từ mũi xuống), không xác minh được người mẫu |
| 16887185 | oversize | Áo oversize CÓ IN (graphic) + đang cầm kính xem |
| 9558588 (MART PRODUCTION) | oversize (đen) | Vùng ảnh MART gắn thẻ teen — rủi ro tuổi, cấm dùng theo luật dự án (như 9558713) |

Loại ở mức mô tả (không tải): loạt MART PRODUCTION 9558xxx (teen), 9558910 (mô tả ghi "teenager"), 8217291 (nền sặc sỡ), 21300187 (nền tối, đơn sắc), 19999455 (áo có chữ đỏ), 6373454/6373449 (cầm sổ che ngực, không mặt), 9637854/9637851 (áo anime có in), 36899307 (hồng có in), 3262911/4323710 (ngoài trời), 4859722 (ngồi), 12191323 (tựa khối trắng), 6311578 (người mẫu không phải người Á), 9775824 (nam, cầm hoa, nghiêng).

**Kết luận: TRẮNG / ĐEN / OVERSIZE đều CHƯA ĐẠT ảnh thật.** 25471921 bị gỡ khỏi PHOTO_BASES, fixture đã xóa; `photoBaseFor` trả null cho mọi tổ hợp; DEMO dùng figure vẽ (đã vẽ lại theo khung nửa người, canvas 900×1125) với nhãn trung thực. Ba fixture còn lại trong PHOTO_BASES là ảnh THAM CHIẾU ÁO (móc treo/mặt sau, kind: 'garment') — không phải ảnh người mẫu.

### Landmarks đã đo (lưới trên chính file fixture / hình học figure) và quad suy ra bằng torsoQuadFor

| Nền | collarBottomY | hemY | torsoCenterX | torsoWidth | Quad (torsoQuadFor: gap 0.135, width 0.40) |
|---|---|---|---|---|---|
| Figure cổ tròn | 0.275 | 0.760 | 0.50 | 0.44 | [[0.412,0.341],[0.588,0.341],[0.588,0.481],[0.412,0.481]] |
| Figure oversize | 0.290 | 0.840 | 0.50 | 0.58 | [[0.384,0.364],[0.616,0.364],[0.616,0.550],[0.384,0.550]] |
| Móc treo trắng 800×1200 | 0.33 | 0.88 (gấu chéo — lấy điểm giữa) | 0.46 | 0.38 (thân ngang ngực ≈ x 0.27–0.65) | [[0.384,0.404],[0.536,0.404],[0.536,0.506],[0.384,0.506]] |
| Móc treo đen 1200×800 | 0.26 | 0.955 | 0.49 | 0.39 | [[0.412,0.354],[0.568,0.354],[0.568,0.588],[0.412,0.588]] |
| Mặt sau mặc 800×1200 | 0.445 | 1.00 (gấu ngoài khung — đo tới mép khung) | 0.57 | 0.70 | [[0.430,0.520],[0.710,0.520],[0.710,0.707],[0.430,0.707]] |

### Suite tests/ai-studio-tpl1.mjs (vòng 3) — PASS (2 lượt liên tiếp, số đo của lượt cuối)

Đo bằng bbox màu của hình in đa sắc (hình phủ kín raster ⇒ bbox = vùng in thật) đối chiếu landmarks của chính nền đó:

| Ca | gap đo được (chuẩn 0.12–0.15) | width đo được (chuẩn 0.35–0.45) | tâm X | Rò rỉ | Tương quan | Banner |
|---|---|---|---|---|---|---|
| Trắng cổ tròn @1366 + @390 | **0.140** | **0.394** | 0.499 (chuẩn 0.50) | 0 | 0.912 | strip 24 hàng, textPx 1904 |
| Đen cổ tròn | **0.140** | **0.394** | 0.499 | 0 | 0.910 | strip 24, textPx 1904 |
| Oversize | **0.135** | **0.391** | 0.499 | 0 | — | strip 24, textPx 1904 |
| Fallback móc treo trắng (ảnh thật) | **0.139** | **0.385** | 0.458 (chuẩn 0.46) | — | — | — |

- Oversize: span silhouette **0.564** vs cổ tròn **0.424** (rộng hơn 1.33×); dấu chân hình in **1.73×** bản cổ tròn cùng figure — phom rộng thật, không phải in to trên áo thường.
- GUIDE-REGRESSION: preview 0 pixel, export 0 pixel (quét 952 điểm quanh viền quad, hình in không đỏ).
- AI-FAIL: đúng 1 request Classic/lượt chạy (mock 500), composition báo lỗi chỉ đường "Ảnh mẫu thật" rồi hoàn thành trên ảnh móc treo thật.
- Xuất website đúng 1200×1500 ở mọi ca; DEMO figure 900×1125 kèm nhãn "chưa có ảnh chụp thật đã kiểm chứng".

### Prompt nguyên văn (Task 3) — bằng chứng unit test

- Chuỗi CHÍNH XÁC cho trắng/regular và đen/oversize được khẳng định ký tự-từng-ký tự trong `tests/ai-studio-p42.test.mjs` (mục "ROUND 3 — Template 1 prompt is the owner verbatim catalog template"). Template: "Commercial e-commerce apparel catalog photo, medium half-body shot from head to hip of a young Vietnamese model standing upright facing camera, wearing a PLAIN [COLOR] [FIT_TYPE] cotton crew-neck t-shirt, …" — chỉ thay [COLOR] = white/black, [FIT_TYPE] = regular-fit / oversized boxy-fit.
- Cổng áp dụng: `catalogPrompt: true` CHỈ có trên promptAssistant của Mẫu 1 (mặc định của node là false) — test khẳng định đường legacy (không cờ) vẫn ghép prompt cũ và vẫn nêu "a young Vietnamese female/male model"; Mẫu 2–4 không đổi hành vi (hồi quy P1–P4 PASS).

### Hồi quy đầy đủ

- Unit `npm test`: **110/110 PASS** (107 vòng 2 + pins torsoQuadFor/registry/prompt mới, trừ các pins vòng 2 đã thay thế).
- Browser: ai-studio.mjs PASS; ai-studio-p2.mjs PASS; ai-studio-p3.mjs PASS (điểm kéo quad trong suite được cập nhật theo góc quad torso mới 41.2%/34.1% kèm chú thích); ai-studio-p4.mjs PASS; ai-studio-tpl1.mjs PASS. Lint PASS; build PASS.
- Không có bất kỳ lượt gọi Pollinations thật nào (DEMO + mock).

### Tự xem 3 ảnh kết quả (bắt buộc — mắt là chính)

- Cả 3 ảnh (`~/workspace/p42-results/white-crew.png`, `black-crew.png`, `oversize.png`, 1200×1500) là FIGURE VẼ nửa người trên nền xám sáng: banner DEMO một dải đồng nhất trên cùng; huy hiệu "ÁO IN STUDIO" nằm giữa ngực trên, dưới cổ áo một khoảng rõ, chữ trắng đọc rõ trên cả áo đen; thấy toàn bộ áo (cổ, 2 vai, 2 tay áo, gấu) + cạp quần ngay dưới gấu; không khung đứt nét; oversize rộng + dài hơn hẳn bản cổ tròn khi đặt cạnh nhau.
- **Sự cố tự phát hiện khi xem ảnh nháp đầu:** bản vẽ đầu của vòng 3 bị CỔ QUÁ DÀI (đầu nhỏ + đặt cao, vai thấp) — số đo vẫn PASS vì landmarks tự nhất quán, nhưng mắt thấy sai tỉ lệ người. Đã sửa tỉ lệ đầu/vai (đầu to + thấp hơn, vai cao lên; landmarks suy ra lại: cổ 0.275/0.29) và chạy lại toàn bộ suite + xuất lại ảnh trước khi chốt — ảnh ở trên là bản đã sửa.
- Đánh giá trung thực: figure vẫn là hình vẽ cách điệu (tay thẳng, mặt tối giản) với nhãn DEMO rõ ràng — ĐẠT vai trò nền DEMO trung thực + đúng luật đặt in, NHƯNG vẫn **CHƯA ĐẠT** yêu cầu "ảnh người mẫu thật đạt chuẩn TMĐT" của chủ shop ở cả 3 hạng mục.

### CHƯA đạt / chưa kiểm chứng ở P4.2 vòng 3 (không báo PASS)

- **Ảnh người mẫu thật đạt chuẩn TMĐT cho trắng, đen, oversize: CHƯA CÓ** sau đợt rà 8 góc truy vấn / 26 ảnh xem trực tiếp (bảng loại ở trên). Cần chủ shop quyết: (a) cung cấp ảnh của shop, hoặc (b) duyệt nới 1 mục checklist (ứng viên gần nhất: 6310890 — chỉ trượt mục nền studio trơn), hoặc (c) giữ figure vẽ như hiện tại.
- P4.2 vòng 3 chưa kiểm chứng trên điện thoại thật của chủ shop; chưa push/PR/bundle (chờ duyệt ảnh kết quả vòng 3).
- Các mục cũ giữ nguyên: AI thật chưa chạy end-to-end (quyết định của chủ shop — không tự gọi), P5 chưa bắt đầu.


## P4.2 VÒNG 4 — QA (2026-11-14): nền người mẫu AI đã duyệt + R1–R4

### Tích hợp + provenance
- 3 file nguồn do chủ shop duyệt được chép vào `public/fixtures/ai-model/`: `model-white-crew.webp` (1280×1920, nữ), `model-black-crew.webp` (1280×1920, **nam** — duyệt nguyên trạng), `model-white-oversize.webp` (1040×2352, nữ). Registry `AI_MODEL_BASES` (core.js, kind 'ai-model') + `aiModelBaseFor` ánh xạ (trang,co-tron)/(đen,co-tron)/(trang,oversize), chỉ mặt trước. DEMO aiImageGen dùng các nền này trước figure; composition fallback/realBase chọn được trong panel. Tổ hợp chưa ánh xạ → figure vẽ (nhãn trung thực). PHOTO_BASES không đổi (garment-only).
- Provenance đầy đủ: `docs/AI_MODEL_ASSETS.md` — tạo bởi pipeline ảnh của Muse từ prompt catalogue nguyên văn của chủ shop ngày 2026-11-14, chủ shop duyệt cùng ngày, mục đích duy nhất: nền DEMO Mẫu 1. **Không** ghi vào P2_ASSET_LICENSES.md (không phải ảnh chụp, không có giấy phép ảnh). Nhãn "do AI tạo" xuất hiện ở: đầu ra node aiImageGen (label + log), tên registry, mục chọn trong panel composition, tài liệu này + checkpoint + AGENTS.md.

### Landmarks đo trên pixel thật + quad suy ra (torsoQuadFor, gap 0.135 / width 0.40)
| Nền | collarBottomY | hemY | torsoCenterX | torsoWidth | Quad vùng in (chuẩn hoá) |
|---|---|---|---|---|---|
| white crew | 0.383 | 0.952 | 0.500 | 0.49 | [[0.402,0.460],[0.598,0.460],[0.598,0.590],[0.402,0.590]] |
| black crew | 0.363 | 0.966 | 0.505 | 0.51 | [[0.403,0.444],[0.607,0.444],[0.607,0.580],[0.403,0.580]] |
| white oversize | 0.328 | 0.919* | 0.505 | 0.72 | [[0.361,0.408],[0.649,0.408],[0.649,0.535],[0.361,0.535]] |

\* Oversize: vạt cong/rủ — hemY = điểm thấp nhất của vạt ở chính giữa mặt trước.

### Số đo in thực tế (bbox màu hình in trên file xuất 1200×1500 cuối cùng, đối chiếu landmarks nền)
| Ca | gap / chiều dài thân (luật: 0.12–0.15) | bề rộng in / bề rộng thân (luật: 0.35–0.45) | tâm X | Rò rỉ ngoài quad | Tương quan vs hình gốc | Guide (preview + export) | Banner DEMO |
|---|---|---|---|---|---|---|---|
| white crew | **0.136** | **0.395** | 0.499 | 0 | ≥ 0.85 (suite, trên composite) | 0 + 0 | có, đồng nhất |
| black crew | **0.136** | **0.395** | 0.504 | 0 | ≥ 0.85 (suite) | — | có, đồng nhất |
| white oversize | **0.135** | **0.396** | 0.505 | 0 | — | — | có, đồng nhất |

(Suite tpl1 khẳng định cùng các tỉ lệ trên canvas composite trong dung sai đã biện minh ±0.03/±0.045; footprint in oversize > crew ×1.15 trên cùng suite; figure fallback cho tổ hợp be: đo đạt luật torso trên landmarks figure.)

### R1–R4 — bằng chứng
- **R1:** Template 1 đóng dấu meta tplVersion 4 + catalogPrompt mặc định + quad mặc định = quad AI white-crew. CASE 8 (IndexedDB trắng, xác nhận 0 dự án/0 bản nháp, không banner khôi phục): tạo Mẫu 1 → chạy 3 ca → `fresh-white.png` / `fresh-black.png` / `fresh-oversize.png` **trùng SHA-256 từng byte** với 3 ảnh chuẩn (white `b4fba643…`, black `780fab10…`, oversize `c0bf2303…`).
- **R2:** mock Classic trả ảnh VUÔNG 512×512 (xanh lá thuần): đúng 1 request; gen nhận ảnh xấu nhưng composite bị chặn — composite xây trên nền AI đã duyệt (900×1350), **0 pixel** của ảnh xấu trong composite, nhãn kết quả chứa "Ảnh AI thật không đạt khung hình — đã dùng nền người mẫu đã duyệt", xuất có banner DEMO (đầu ra fallback là DEMO). Guide: quét trên node XEM TRƯỚC và PNG xuất đều 0 pixel (CASE 6, hình in không đỏ). Giới hạn đã ghi rõ: guard theo lớp tỉ lệ khung (h/w ∈ [1.10, 2.05]) — ảnh cận cảnh tỉ lệ dọc vẫn có thể qua; không khẳng định có nhận diện landmarks.
- **R4:** kết luận kiểm toán — hash cache chuỗi (config + đầu vào) KHÔNG bao phủ thay đổi hành vi (registry/hiệu chuẩn/template) → đã thêm `AI_STUDIO_BUILD` vào khóa cache + marker tplVersion. CASE 9: dự án marker v1 (catalogPrompt bị xóa, realBase trỏ nền đã gỡ `crew-white-vn-model.webp`, quad cũ, 1 bản ghi cache cũ) → mở + khôi phục bản nháp: thông báo làm mới xuất hiện, cache của dự án = 0, panel promptAssistant hiện tóm tắt catalogue, chạy ra nền AI 1280×1920. Quad người dùng tự sửa (quadSource 'user') được giữ — có unit test riêng.
- **Giải thích sự cố site live 19:27 (giờ Nhật) 2026-11-14:** site live lúc đó vẫn là bản **P4.1** (P4.2 chưa ship) và trình duyệt khôi phục một **bản nháp tự lưu từ bản cũ** — kết quả hỏng là của P4.1 + dữ liệu cũ, không phải mã vòng 4. Sau khi P4.2 ship: bản nháp Mẫu 1 cũ sẽ được tự làm mới khi mở (R4, có thông báo); khuyến nghị chủ shop **tạo dự án MỚI từ Mẫu 1** để có đường sạch nhất.

### Kết quả test vòng 4
- Unit: **116/116 PASS** (thêm: registry AI-model + tính trung thực, landmarks/quads, mapping aiModelBaseFor, R1 audit Mẫu 1, framing classes, refreshTpl1Graph, build-marker trong khóa cache).
- Suite trình duyệt: **ai-studio-tpl1 PASS** (9 case như trên); **ai-studio (P1) PASS**, **ai-studio-p2 PASS**, **ai-studio-p3 PASS** (pin góc quad mặc định cập nhật 41.2% → 40.2% theo quad AI white-crew, có chú thích vòng 4), **ai-studio-p4 PASS**. Lint PASS, build PASS. Không gọi Pollinations thật (mọi traffic AI thật đều mock).
- **Kiểm tra bằng mắt của Muse trên 3 ảnh xuất:** trắng — in giữa ngực trên, khoảng cổ sạch, chữ rõ; đen — người mẫu nam, màu in nổi trên nền đen, "ÁO ĐẸP" đọc rõ; oversize — áo rộng thật, in lớn cân giữa. Cả 3: không guide, có banner. Ảnh fresh giống hệt (cùng SHA-256). **[ĐÍNH CHÍNH cùng ngày: chữ "ÁO ĐẸP" trong câu này là chữ của FIXTURE ĐO LƯỜNG, không phải hình in sản phẩm — đoạn này đã mô tả nhầm bộ ảnh fixture như thể là ảnh bàn giao thật. Xem mục "ĐÍNH CHÍNH vòng 4" ở cuối báo cáo này: bộ ảnh đã được tạo lại bằng hình in mẫu thật và xem lại.]**

### CHƯA đạt / chưa kiểm chứng ở P4.2 vòng 4 (không báo PASS)
- Vòng 4 chưa kiểm chứng trên điện thoại thật của chủ shop; chưa đóng bundle/push/PR (chờ chủ shop duyệt 6 ảnh kết quả vòng 4).
- Guard khung hình R2 chỉ theo tỉ lệ khung — ảnh AI thật cận cảnh nhưng tỉ lệ dọc vẫn có thể lọt (giới hạn đã công khai ở trên và trong mã).
- Tổ hợp chưa có nền AI đã duyệt (màu khác ngoài trắng/đen, oversize đen, góc 3/4) vẫn dùng figure vẽ — đúng nhãn, đúng luật torso, nhưng không phải ảnh người mẫu AI.
- Các mục cũ giữ nguyên: AI thật chưa chạy end-to-end (quyết định của chủ shop — không tự gọi), P5 chưa bắt đầu, LCP trang chủ theo lịch sử chưa đạt ≤2.5s.

### ĐÍNH CHÍNH vòng 4 (cùng ngày — ảnh bàn giao mang nhầm hình in fixture, đã tạo lại bằng hình in thật)

- **Lỗi, nói thẳng:** bộ 6 ảnh bàn giao vòng 4 ở bản đầu (`white-crew.png`, `black-crew.png`, `oversize.png`, `fresh-*.png` trong `~/workspace/p42-results/`) mang hình in **fixture đo lường của suite** (`tests/fixtures/design-multicolor.svg` — bốn ô màu + chữ "ÁO ĐẸP") thay vì hình in mẫu thật của sản phẩm. Đó KHÔNG phải thứ người dùng nhận được và KHÔNG phải thứ chủ shop có thể duyệt. Nguyên nhân gốc: suite `tests/ai-studio-tpl1.mjs` vừa là bộ đo pixel (bắt buộc dùng fixture vì artwork phủ kín raster → bbox màu = vùng in) vừa là nơi lưu ảnh bàn giao — CASE 1/2/3/8 gọi `loadTpl1()` → `setDesign(MULTI_SVG)` ghi đè hình in, rồi lưu output của chính các lượt đo đó ra thư mục kết quả. Mục "kiểm tra bằng mắt" vòng 4 ở trên còn trích chữ "ÁO ĐẸP" như thể là hình in thật — đã gắn dấu đính chính ngay tại mục đó.
- **Đường người dùng thật (không dính fixture):** Mẫu 1 xuất xưởng mang sẵn `SAMPLE_DESIGN_SVG` — huy hiệu đất nung "ÁO IN / STUDIO" — làm hình in mặc định trong template factory (core.js). Người dùng tạo dự án từ Mẫu 1 và bấm Chạy là nhận huy hiệu đó; fixture chỉ tồn tại bên trong các lượt chạy của suite.
- **Đã tạo lại từ đường thật:** một driver Playwright riêng đi đúng đường người dùng: tạo Mẫu 1 → **GIỮ NGUYÊN hình in mặc định** (có khẳng định giá trị ô nhập SVG của node hình in === `SAMPLE_DESIGN_SVG` trước khi chạy) → chỉ đổi thông số áo (đen / oversize) → chạy → lưu export kênh website 1200×1500. Ba ảnh fresh-* đi qua profile IndexedDB trắng (khẳng định 0 dự án / 0 bản nháp, không banner khôi phục) như R3. **Lưu ý quy trình:** suite tpl1 mỗi lần chạy lại sẽ GHI ĐÈ thư mục kết quả bằng ảnh fixture (đúng vai trò đo lường của nó) — bộ ảnh bàn giao dưới đây được tạo SAU lần chạy suite cuối cùng và đối chiếu hash sau khi tạo.
- **Hash mới (3 cặp standard/fresh trùng từng byte — bằng chứng R1 giữ nguyên với hình in thật):** trắng `7ef6a2fb…`, đen `6fc84d80…`, oversize `045f9dc4…`. (Các hash `b4fba643…` / `780fab10…` / `c0bf2303…` trích ở mục R1 phía trên thuộc bộ ảnh fixture cũ, nay thay bằng các hash này.)
- **Sửa framing oversize (kèm theo, vì ảnh thật làm lộ rõ):** nguồn oversize 1040×2352 (composite 900×2035, tỉ lệ ≈ 2.26) bị export website 'cover' cắt gần nửa chiều cao — mất đỉnh đầu VÀ vạt áo. Thêm quy tắc thuần `channelFitMode` (warp.js, có unit test): kênh preset 'cover' mà phần nguồn giữ lại < 60% (`COVER_MIN_RETAINED`) thì chuyển 'contain' và **đệm bằng màu nền lấy mẫu từ chính ảnh** (`sampleBackdropColor` trong studio.js — hai dải biên ở 18–34% chiều cao, vùng nền studio thuần; bản lấy mẫu đầu tiên quét cả tay áo/da nên đệm tối hơn nền thật, đã sửa và xuất lại). Oversize → contain: thấy TRỌN áo (đầu, vai trễ, hai tay áo, vạt cong + cạp quần jean), màu đệm đo trên file xuất ≈ RGB(211, 209, 208), tiệp nền xám sáng của ảnh. Hai ca crew giữ 'cover' (giữ 83% nguồn) — **file xuất của chúng không đổi từng byte** sau thay đổi này. Nhãn file xuất ghi đúng chế độ thực dùng ("vừa khung, đệm màu nền của ảnh — nguồn quá cao, tránh cắt mất đầu/vạt áo"). Vị trí hình in đo trên composite KHÔNG đổi. Viền DEMO mảnh bao quanh ảnh oversize là viền nung đã nấu sẵn trong ảnh áo của node tạo ảnh DEMO (có ở mọi composite; các ca cover cắt mất hai cạnh dọc nên trước nay không thấy) — là dấu DEMO, không phải guide.
- **Số đo MỚI trên bộ ảnh bàn giao thật** (đo bbox pixel của huy hiệu trên chính file xuất 1200×1500; landmarks của nền ánh xạ qua đúng phép fit mà export đã dùng — `channelFitMode` + `fitInto`. Huy hiệu là elip chiếm x [0.12, 0.88] × y [0.18, 0.82] của raster hình in, căn giữa, nên bbox VÙNG IN (raster) được khôi phục từ bbox + tâm của huy hiệu):

| Ca | Export | gap vùng in / thân (luật 0.12–0.15) | rộng vùng in / thân (luật 0.35–0.45) | lệch tâm X | pixel huy hiệu | (tham khảo) gap / rộng của riêng artwork huy hiệu | Guide | Banner (px chữ) |
|---|---|---|---|---|---|---|---|---|
| white crew | cover | **0.136** | **0.394** | 0.000 | 18 069 | 0.177 / 0.299 | 0 | 1 894 |
| black crew | cover | **0.136** | **0.391** | 0.000 | 19 961 | 0.177 / 0.297 | 0 | 1 893 |
| white oversize | contain (mới) | **0.136** | **0.394** | 0.000 | 12 116 | 0.175 / 0.299 | 0 | 1 904 |

  Số đo vùng in khớp bộ số vòng 4 đã báo (gap 0.136/0.136/0.135; width 0.395/0.395/0.396) trong ±0.004 — hình học không đổi, chỉ artwork nay là hình in thật. Cột tham khảo: artwork huy hiệu nằm lọt trong raster (phần trong suốt ở mép file SVG) nên tỉ lệ tính trên riêng artwork nằm ngoài dải luật — luật torso áp cho VÙNG IN (toàn raster), đúng như quy cách vùng in tại xưởng; mọi hình in thật của khách cũng có mép trong suốt tương tự.
- **Tự xem lại cả 3 ảnh chuẩn (mắt là chính, sau khi tạo lại):** trắng — huy hiệu đất nung "ÁO IN / STUDIO" giữa ngực trên, khoảng cổ sạch, chữ trắng sắc nét không méo; đen — người mẫu NAM như đã duyệt, cả hai dòng chữ đọc rõ trên nền đen; oversize — áo rộng thật thấy trọn thân + đầu + vạt trên nền đệm xám tiệp ảnh, huy hiệu cân giữa ngực trên. Cả 3: không guide, banner DEMO đồng nhất. ĐẠT để trình chủ shop duyệt.
- **Chạy lại sau thay đổi export:** unit **117/117 PASS** (thêm test `channelFitMode`); suite trình duyệt **ai-studio-tpl1 PASS** (9 case; số đo trên composite của suite: gap 0.138/0.138/0.135, width 0.395/0.392/0.394), **ai-studio (P1) PASS**, **ai-studio-p3 PASS** (suite kênh xuất — không đổi hành vi với nguồn thông thường); lint PASS, build PASS. Không gọi Pollinations thật.

### SỬA KHUNG ĐÔI OVERSIZE (2026-11-14 — chủ shop duyệt trắng + đen, chỉ oversize bị trả lại)

- **Quyết định của chủ shop:** `fresh-white.png` (`7ef6a2fb…`) và `fresh-black.png` (`6fc84d80…`) ĐÃ DUYỆT NGUYÊN TRẠNG — không xuất lại, không chỉnh (kể cả vân lưới warp mờ trên huy hiệu — giữ nguyên theo lời chủ shop). Oversize bị trả lại vì MỘT lỗi duy nhất: khung DEMO bị đóng HAI LẦN.
- **Nguyên nhân gốc (đã kiểm chứng trong mã + đo pixel):** đầu ra của node tạo ảnh DEMO mang sẵn MỘT khung đã "nướng" vào ảnh — `demoImage` trong studio.js gọi `drawDemoBanner` (dải `rgba(32,32,32,0.88)`) + `strokeRect` viền đất nung `#b6492f` trên CẢ 4 đường ra (nền AI-model, nền ảnh chụp, figure vẽ, đường rửa ảnh legacy). Node xuất đóng THÊM khung thứ hai (`stampDemoFrame`) lên ảnh kênh cuối. Các ca 'cover' tình cờ cắt bỏ dải nướng (cắt giữa khung: dải nằm trọn trong phần bị cắt) và viền đóng dấu (rộng 10px) phủ trọn viền nướng (≤9,4px sau các phép co) nên trông như một khung. Ca oversize đi đường 'contain' (sửa framing ở mục ĐÍNH CHÍNH): TOÀN BỘ ảnh ghép — gồm cả khung nướng — lọt vào trong khung xuất: dải banner nướng chỉ phủ cột ảnh ở giữa (tông đo được ở cột [97,51,40] so với [109,62,51] ở hai dải đệm → banner hai tông), và hai cạnh dọc của viền nướng sống sót thành **hai vạch đất nung chạy suốt chiều cao tại mép cột contain** (đo trên file bị trả: **12 600 pixel** đất nung trong hai dải mép cột; 17 019 pixel đất nung lạc ngoài viền xuất + huy hiệu).
- **Cách sửa (studio.js, đúng một file):** gỡ `drawDemoBanner` + viền nướng khỏi cả 4 đường ra của `demoImage` — ảnh trung gian (gen → ghép → xem trước) từ nay KHÔNG mang khung nào; tính trung thực trong app đi theo cờ `demo` + nhãn chữ của node như cũ. `stampDemoFrame` ở node xuất là nơi đóng khung DUY NHẤT, đúng một lần, trên ảnh kênh cuối sau cắt/fit. `drawDemoBanner` chỉ còn dùng cho node biến thể DEMO và video DEMO (đầu ra cuối của chính các node đó, không phải ảnh trung gian để ghép). Khối chú thích prompt ở cuối đường legacy được giữ (đó là nội dung mô phỏng P1, không phải khung). Cập nhật luôn các chú thích FIX D liên quan + câu gợi ý ở panel nhà cung cấp ("file xuất được đóng khung DEMO").
- **Giữ nguyên những gì đã đạt ở oversize:** contain giữ TRỌN áo (đầu, vai trễ, vạt cong, cạp quần jean); màu đệm lấy mẫu từ ảnh ≈ RGB(211, 209, 208) như trước. Số đo trên file xuất MỚI (cùng script đo như mục ĐÍNH CHÍNH): **gap vùng in 0.136, bề rộng vùng in 0.394, lệch tâm 0.000**, guide 0, banner 1 910 px chữ. Probe khung đôi trên file mới: pixel đất nung ở hai dải mép cột contain = **0** (file cũ: 12 600); pixel đất nung lạc ngoài viền xuất + huy hiệu = **3** (file cũ: 17 019); tông dải banner đo ở 5 lát cắt ngang (đệm trái / trong cột trái / giữa / trong cột phải / đệm phải) đều ≈ [109, 62, 51] — MỘT tông duy nhất (file cũ lệch [97, 51, 40] trong cột).
- **Trắng/đen không đổi — bằng chứng cứng:** sau khi suite tpl1 ghi đè thư mục kết quả bằng ảnh fixture (hành vi đã biết), bản bàn giao trắng/đen được khôi phục từ bản sao lưu trước khi chạy; đồng thời chạy lại driver đường-thật cho hai ca crew vào thư mục tạm: file tạo ra trùng SHA-256 TỪNG BYTE với bản đã duyệt (trắng `7ef6a2fb…`, đen `6fc84d80…`) — tức mã mới tái tạo đúng hệt hai ảnh đã duyệt, vì ở đường 'cover' phần nướng vốn bị cắt/phủ hoàn toàn. Sáu file bàn giao cuối: trắng + fresh-trắng `7ef6a2fb…` (không đổi), đen + fresh-đen `6fc84d80…` (không đổi), oversize + fresh-oversize **`cc4f49f1…`** (MỚI — cặp standard/fresh vẫn trùng từng byte, bằng chứng R1 giữ nguyên).
- **Hồi quy đầy đủ sau sửa:** unit **117/117 PASS**; suite trình duyệt **ai-studio (P1) PASS**, **ai-studio-p2 PASS**, **ai-studio-p3 PASS**, **ai-studio-p4 PASS**, **ai-studio-tpl1 PASS** (9 case — gồm bannerCheck trên mọi export và quét guide trên preview + export); lint PASS; build PASS. Không gọi Pollinations thật. (Thứ tự bắt buộc đã tuân thủ: chạy MỌI suite trước → tạo lại cặp oversize bằng driver đường-thật sau cùng → khôi phục + đối chiếu hash trắng/đen.)
- **Tự xem ảnh oversize mới (mắt là chính):** ĐÚNG MỘT banner — một dải tối một tông chạy hết bề ngang trên cùng, chữ "ẢNH DEMO — chưa kết nối AI" sắc nét; ĐÚNG MỘT viền đất nung bao quanh mép ngoài canvas; KHÔNG còn vạch dọc ở mép cột contain, KHÔNG khung lồng nhau; thấy trọn áo (đầu + tóc, vai trễ, ống tay rộng, vạt cong, cạp quần jean, tay đút túi); huy hiệu "ÁO IN / STUDIO" giữa ngực trên, khoảng cổ sạch, chữ trắng rõ, vân lưới warp mờ trên huy hiệu giữ nguyên như bản chủ shop đã duyệt ở hai ca kia. ĐẠT để trình chủ shop duyệt riêng ca oversize.
- **Ghi chú phạm vi:** node biến thể DEMO (`demoVariation`) vẫn nướng dải banner của riêng nó ("BIẾN THỂ DEMO") vào đầu ra — đó là đầu ra cuối của node biến thể, ngoài phạm vi lỗi khung đôi của đường tạo ảnh → ghép của Mẫu 1; không đổi ở đợt này.
