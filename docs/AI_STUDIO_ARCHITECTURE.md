# AI Studio — Architecture

## Quyết định tích hợp (quan trọng)
Brief đề xuất React + TypeScript + @xyflow/react. Repo hiện tại là **site tĩnh vanilla JS, không bundler** (Vite chỉ dùng dev; build = `node scripts/build.mjs` copy file vào `dist/` để GitHub Pages phục vụ). Thêm React/TS/@xyflow sẽ phá vỡ pipeline build/deploy đang chạy tốt và toàn bộ test hiện có. Theo đúng quy tắc của brief ("ưu tiên tận dụng công nghệ hiện tại của repository"), P1 triển khai:

- Trang độc lập **`studio.html`** ở root repo = tương đương route `/studio` trên Pages tĩnh. Chỉ thêm **1 link "AI Studio"** trong header `index.html`; không sửa hành vi trang nào khác.
- Node editor **vanilla JS tự viết**: node = thẻ HTML định vị tuyệt đối trong "world" có transform pan/zoom; dây nối = SVG bézier; tương tác bằng **Pointer Events** (chuột + cảm ứng chung một đường mã), `touch-action:none` trên canvas, pinch-zoom 2 ngón.
- `scripts/build.mjs` được bổ sung `studio.html` vào danh sách copy; `scripts/serve.mjs` (server test local) được bổ sung allowlist cho `studio.html` + `src/ai-studio/*` (vẫn chặn file nhạy cảm như cũ — test server giữ nguyên).

## Cấu trúc mã (`src/ai-studio/`)
| File | Vai trò |
|---|---|
| `core.js` | DOM-free: định nghĩa 12 node + cổng/kiểu dữ liệu, kiểm tra tương thích kiểu, chống vòng lặp, prompt builder theo quy tắc, kiểm tra an toàn SVG, ZIP writer/reader (store, CRC32), 4 template. |
| `engine.js` | DOM-free: sắp xếp topo, validate đầu vào bắt buộc, chạy all/single(from-upstream)/from-node, trạng thái + log từng node, cờ dừng giữa các node, lan truyền lỗi. |
| `providers.js` | Hợp đồng Provider Adapter + `DemoAdapter` + `HttpAdapter` (stub có cổng kiểm soát). Key chỉ ở biến bộ nhớ module. |
| `store.js` | IndexedDB riêng **`ao-in-ai-studio`** (stores: `projects`, `assets`). Không mở bất kỳ DB nào khác. |
| `studio.js` | UI + runtime handler cho từng node (Canvas API: ghép in, chỉnh ảnh, ảnh demo, video WebM qua MediaRecorder), dự án (lưu/mở/đổi tên/nhân bản/xóa/import/export). |
| `studio.css` | Theme kem/charcoal/terracotta; desktop 3 cột; mobile: library dạng ngăn kéo, thuộc tính dạng bottom sheet, canvas toàn màn hình. |

## Luồng dữ liệu
Node xuất ra "value" theo kiểu: `image | design | prompt | video | any` (blob + object URL + nhãn nguồn gốc). Engine cấp `inputs` theo đúng dây nối; cổng vào nhận tối đa 1 dây; kiểu không khớp hoặc tạo vòng lặp bị từ chối kèm thông báo tiếng Việt.

## Bảo toàn hình in
Node `designInput` giữ file gốc (blob trong IndexedDB hoặc SVG text đã qua kiểm tra an toàn). Node `composition` vẽ **chính pixel gốc** đó lên ảnh áo trong vùng in an toàn (khung đứt nét), kèm xoay/tỉ lệ — AI không tham gia vẽ lại hình in. Mọi ảnh do node AI tạo ở P1 đều đóng dấu "ẢNH DEMO — chưa kết nối AI" ngay trong pixel.

## P2 — Engine & lưu trữ nâng cao (2026-11-14)

**IndexedDB v2** (`store.js`, DB vẫn là `ao-in-ai-studio`): migration chỉ THÊM store, không đụng dữ liệu P1 — `runs` (lịch sử chạy), `versions` (phiên bản dự án), `cache` (đệm kết quả node, keyPath = khóa đệm), `drafts` (bản nháp chưa lưu, keyPath = projectId). Quy tắc đứng: mọi migration sau này cũng chỉ thêm store / thêm trường có mặc định, không bao giờ xóa hay đổi nghĩa dữ liệu cũ (có test migration v1→v2 trong `tests/ai-studio-p2.mjs` pha D).

**Hàng đợi chạy** (`RunQueue` trong `p2.js`, DOM-free): mọi yêu cầu chạy (toàn bộ / 1 node / từ node / chạy tiếp) đều qua 1 hàng đợi tuần tự — tối đa 1 lượt chạy tại 1 thời điểm, các yêu cầu sau xếp hàng và hiển thị trạng thái ở thanh tiến trình. Không chạy chồng vì các lượt chạy dùng chung state đồ thị/outputs.

**Đệm kết quả node** (`p2.js` + hook của `engine.js`): khóa đệm = `loại node + hash(cấu hình ổn định + khóa đệm của mọi đầu vào)`. Hash lồng nhau nên sửa 1 node chỉ làm mất hiệu lực đệm của chính node đó và các node phía sau nó; node không đổi được phục vụ từ store `cache` với trạng thái riêng **`cached`** (hiện trong UI + lịch sử chạy). Trường cấu hình suy biến khi chạy (`promptAssistant.composed`) bị loại khỏi khóa. Node qua đường (preview/export) và node có tác dụng phụ (saveProject) không bao giờ phục vụ từ đệm — nhưng vẫn tính khóa để chuỗi phía sau ổn định. Giá trị đệm đi qua đúng cùng pipeline giá trị như kết quả chạy thật (blob/text được lưu, object URL được tạo lại khi dùng). Nút "Xóa bộ nhớ đệm" ở tab Lưu trữ + bảng thuộc tính.

**Thử lại + giới hạn thời gian + chạy tiếp**: node nhóm AI mặc định thử lại 1 lần (cấu hình được trong "Cài đặt chạy", áp cho phiên làm việc); mỗi node có timeout mặc định 60s — quá hạn thì node lỗi với thông báo rõ ràng thay vì treo. Khi 1 lượt chạy lỗi giữa chừng, nút **"Chạy tiếp từ node lỗi"** xuất hiện: chỉ chạy lại node lỗi + phía sau nó, tái dùng kết quả phía trước từ outputs trong phiên hoặc từ đệm đã lưu (kể cả sau khi tải lại trang). Kết quả từng phần của lượt lỗi vẫn xem được (Preview giữ kết quả thành công gần nhất).

**Kiểm tra trước khi chạy** (`validateWorkflow` trong `p2.js`): kiểm tra nối dây bắt buộc (của P1) + kiểm tra nội dung (designInput chưa có hình in, promptInput trống, imageInput chưa có ảnh, composition không có nền). Có vấn đề → không chạy, hiện danh sách tiếng Việt.

**Phiên bản dự án & bản nháp**: TỰ LƯU chỉ ghi **bản nháp** (store `drafts`). Nút **Lưu** ghi bản chính thức + tạo 1 **phiên bản** (tối đa 20/dự án, cắt cũ nhất; snapshot chỉ chứa workflow JSON + metadata, tham chiếu asset id — không nhân bản blob). Khôi phục 1 phiên bản = thay trạng thái hiện tại + tự ghi thành 1 phiên bản mới. Khi mở trang, nếu có bản nháp mới hơn bản đã lưu (hoặc dự án chưa từng lưu) → banner **"Khôi phục bản nháp chưa lưu"** (khôi phục / bỏ qua). Đây là lựa chọn đã ghi rõ: autosave KHÔNG tạo phiên bản.

**Quản lý lưu trữ** (tab "Lưu trữ"): ước tính dung lượng trình duyệt (`navigator.storage.estimate` + dự phòng), số file/dung lượng assets, đệm, lịch sử chạy, phiên bản; dung lượng theo từng dự án; cảnh báo khi dùng ≥80% hạn mức; **dọn file rác**: asset không còn được bất kỳ dự án / phiên bản / bản nháp nào tham chiếu sẽ bị xóa kèm báo cáo số file + dung lượng giải phóng. Lịch sử chạy: tối đa 50 lượt/dự án, xem chi tiết từng node (trạng thái/thời lượng/số lần thử/lỗi), xóa được; còn nguyên sau khi tải lại trang. Thanh tiến trình hiện số node xong/tổng + thời gian đã chạy; thời lượng từng node hiện ở bảng thuộc tính + lịch sử.

## P3 — Xử lý ảnh & ghép hình in nâng cao (2026-11-14)

**Module hình học `warp.js`** (DOM-free, unit-test đầy đủ; AI Studio tự chứa, không import module của shop): bộ giải homography 8 tham số (khử Gauss) ánh xạ hình vuông đơn vị → quad 4 điểm bất kỳ trên ảnh áo; lưới warp 20×20 (mỗi ô vẽ bằng 2 tam giác affine + clip trong `studio.js`); trường dịch chuyển nếp vải; toán phủ/vừa khung (`fitInto`); bảng kênh xuất; di trú cấu hình.

**Ghép phối cảnh 4 điểm** (node `composition`, chế độ `perspective` — mặc định mới): hình in GỐC được warp bằng homography thật lên quad người dùng định nghĩa. Trình chỉnh quad trong bảng thuộc tính: canvas xem trước (ảnh áo + hình in đã warp) với 4 núm kéo bằng Pointer Events (vùng chạm ≥26px) + 8 ô số tọa độ %. Quad mẫu: 2 ảnh móc treo lấy từ hiệu chuẩn thủ công của shop (`data/garments.json`), ảnh trải phẳng/mặt sau là quad vùng ngực đặt tay — tất cả chỉnh tay được. Chế độ `simple` giữ nguyên hành vi P1 (chữ nhật + xoay). **Di trú**: cấu hình P1 không có `mode` → tự chuyển thành `perspective` + quad tương đương hình chữ nhật cũ (`migrateCompositionConfig`, áp dụng ở mọi điểm nạp đồ thị: mở dự án / nhập / khôi phục phiên bản / khôi phục nháp); riêng cấu hình có `rotation ≠ 0` giữ `simple` để bảo toàn đúng kết quả P1. Không đổi version IndexedDB: trường mới chỉ nằm trong config node, khóa đệm P2 (hash toàn bộ config) tự bao hàm — dự án P1/P2 mở nguyên trạng.

**Cong theo nếp vải (mô phỏng thị giác — KHÔNG phải mô hình vải vật lý)**: lấy mẫu độ sáng của ảnh áo trong quad (lưới 21×21 theo tọa độ quad) → độ lệch so với trung bình dịch chuyển đỉnh lưới dọc trục quad (chủ yếu theo chiều dọc), biên độ tỉ lệ với slider 0–100 (`displacementAt`, kiểm thử đơn vị trên trường tổng hợp). Sau khi warp, **bóng vải** được nhân vào pixel hình in: hệ số theo độ sáng cục bộ so với trung bình quad (kẹp 0,4–1,15), mức pha trộn = slider `shading` — nếp gấp tối làm hình in tối theo, giữ nguyên sắc độ. Nhãn kết quả + tài liệu đều ghi rõ đây là mô phỏng.

**Node `background` — Nền & bối cảnh** (loại node thứ 13): 4 kiểu nền tạo ngay trên canvas, không ảnh ngoài — màu trơn (+4 preset thương hiệu), gradient 3 hướng, bối cảnh studio thủ tục (tường gradient + sàn tối dần + vạch chân trời theo slider + bóng elip dưới chủ thể + vignette), ảnh nền riêng tải lên (lưu IndexedDB như asset, phủ/vừa khung + làm mờ). Xử lý chủ thể TRUNG THỰC: node tự phát hiện alpha của ảnh đầu vào — có trong suốt → đặt trực tiếp theo tỉ lệ/vị trí; KHÔNG trong suốt → đặt dạng **khung ảnh** (viền trắng + bóng đổ) và nhãn kết quả ghi rõ "không tách nền giả". Đầu ra giữ nguyên kích thước pixel của đầu vào, nối tiếp được vào Preview/Export.

**Xuất đa kích thước theo kênh** (node `exportNode`): 6 preset trong `CHANNEL_PRESETS` (Website 1200×1500 phủ khung, Website vuông 2000×2000 vừa khung, Facebook 1080×1080, Facebook ngang 1200×630 vừa khung, TikTok 1080×1920, Shopee 1024×1024) — toán cắt phủ/chừa nền dùng `fitInto` (unit-test). Chọn kênh nào thì mỗi kênh thành 1 file kết quả riêng (tên `kenh-WxH.ext`, có tiền tố tùy chọn), tải từng file trong bảng thuộc tính, và ZIP dự án chứa mọi file kênh trong `results/`. Không chọn kênh → hành vi P1 nguyên vẹn. `exportNode` vẫn nằm trong nhóm không-phục-vụ-từ-đệm của P2 nên file kênh luôn được tạo thật mỗi lượt chạy.

## Lưu trữ & xuất
- Tự lưu (debounce 800 ms) + nút Lưu; mở lại dự án mới nhất khi vào trang.
- Xuất ZIP (store, tự viết): `workflow.json`, `metadata.json`, `prompts.txt`, `assets/…` (file gốc), `designs/…svg`, `results/…` (kết quả đã chạy). **Không chứa API key.** Xuất riêng `workflow.json` khi chỉ cần cấu trúc. Nhập lại từ JSON/ZIP (ZIP đọc được bởi chính reader tối giản; chỉ hỗ trợ store-method).

## P4 — Provider Adapter & AI thật (2026-11-14)

- **Engine vẫn không biết provider.** Toàn bộ đặc thù nhà cung cấp nằm trong `src/ai-studio/providers.js`: bảng mô tả `PROVIDERS` (id, tên, `kind: demo|free|keyed|http`, `requiresKey`, danh sách model kèm `pricePerImage` bằng Pollen — `null` nghĩa là giá theo token, `supportsImg2Img`, văn bản `limits`) + các adapter `DemoAdapter`, `PollinationsClassicAdapter`, `PollinationsKeyedAdapter`, `HttpAdapter` (stub proxy giữ từ P1). Thêm Gemini sau này = 1 adapter + 1 mục mô tả; engine/node không đổi. Chi tiết vận hành + giá đã kiểm chứng: `docs/AI_STUDIO_PROVIDER_GUIDE.md`.
- **Cổng chế độ là hàm thuần** `resolveGenerationMode({realEnabled, providerId, hasKey, keyedConfirmed})` → `demo | classic | keyed | http | blocked` (kèm lý do tiếng Việt). `studio.js` chỉ tiêu thụ kết quả: công tắc AI thật là state **chỉ trong phiên** (`aiState`), mặc định tắt mỗi lần tải trang, không ghi IndexedDB/localStorage. Huy hiệu trên thanh công cụ (`#ais-mode-badge`) luôn cho biết đang DEMO hay AI THẬT + provider/model.
- **An toàn chi phí nằm ở đường chạy, không chỉ ở UI:** trước khi engine chạy, `executeRun` tính tập node thực sự sẽ chạy (theo chế độ run/resume), lọc node tạo ảnh, dựng kế hoạch lệnh gọi bằng `describePlannedCalls` + `estimateGenerationCost` (model giá token/không rõ giá → chặn, không đoán). Chế độ keyed bắt buộc qua hộp thoại xác nhận chi phí (`#ais-cost-dialog`) — hủy = không tạo engine, 0 request. Hook `retriesFor` ép retry = 0 cho node tạo ảnh khi đang ở chế độ thật (`suppressRetryForMode`). Đệm P2 không đổi: trúng đệm thì handler không chạy → không gọi API. Sau lượt chạy, `recordRun` ghi thêm `aiCalls` + `aiCostPollen` vào bản ghi lịch sử (store `runs`, **không đổi version IndexedDB — vẫn v2**).
- **Fetch phải giữ receiver:** adapter nhận `fetchFn` tiêm vào (để test); giá trị mặc định là wrapper `defaultFetch = (u, o) => fetch(u, o)` — truyền `fetch` trần rồi gọi như method sẽ ném "Illegal invocation" trên trình duyệt (đã gặp và đã sửa ở P4; unit test Node không bắt được lỗi này, suite Playwright bắt được).
- **Không tải ảnh người dùng đi đâu:** tài sản là blob nội bộ, không có URL công khai → img2img ở P4 báo lỗi trung thực; model text-only bỏ qua ảnh tham chiếu kèm log cảnh báo. Node video luôn dùng `DemoAdapter` ở P4.
- Trên mobile, panel thuộc tính là bottom-sheet chỉ mở khi chọn node; P4 thêm nút thanh công cụ `#ais-toggle-props` ("⚙ AI / Cài đặt") mở sheet ở chế độ mặc định (chứa Cài đặt chạy + Provider + Lưu trữ) để người dùng điện thoại với tới được panel Provider.
