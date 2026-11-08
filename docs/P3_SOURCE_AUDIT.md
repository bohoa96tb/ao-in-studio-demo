# P3 Source Audit — kiểm kê P2 trước khi xây P3

Ngày: 2026-11-09 (Asia/Tokyo). HEAD main đã xác minh: `ad81b8d73aff359392b1350ab43f45ff79545ee8` (PR #3 đã merge).
Live https://bohoa96tb.github.io/ao-in-studio-demo/ đã xác minh đang phục vụ bản P2 (`p2real1`).

## 1. Ảnh thật hiện có (4 ảnh Pexels, APPROVED ở P2)

| Ảnh | P2 ghi | P3 kiểm tra lại bằng mắt (2026-11-09) | Vai trò P3 |
|---|---|---|---|
| crew-white-hanger.webp (Steinke 20669538) | áo trắng trên móc, mặt trước | Đúng: áo cổ tròn trắng, mặt trước, treo móc, khá phẳng. Có chi tiết của áo thật: viền cổ trong màu cam, tem cổ nhỏ, tem gấu áo xanh "HOS…" — nằm ngoài vùng in ngực. | **BASE ghép mặt trước (crew, trắng)** — hiệu chuẩn zone ngực |
| crew-black-woman.webp (MART PRODUCTION 9558583) | người mặc áo đen | Đúng: người mẫu kéo áo — vùng in biến dạng. | Lifestyle only. Cấm ghép (quy tắc AGENTS.md) |
| couple-white-outdoor.webp (Torres 25462458) | đôi mặc áo trắng | Đúng: ảnh người mặc ngoài trời. | Lifestyle only (AIS-001) |
| crew-white-flatlay.webp (Snipes 37704838) | "flat lay" | **Sửa vai trò:** thực tế là ảnh CẬN CỔ/VAI của áo màu kem, gấp nếp mạnh, có tem cổ "SEVEN TITANS / XL". Không phải ảnh phẳng toàn thân áo; không có vùng ngực phẳng để ghép. | Ảnh chi tiết cổ/vải (detail), lifestyle only. Không làm base |

Kết luận P3.1: hiện chỉ có **1 base ghép hợp lệ** (crew trắng, mặt trước). Thiếu: mặt sau mọi phom, oversize, polo, cận vải riêng. Agent 1 đang khảo sát bổ sung; thiếu thì ghi thiếu, không thay bằng ảnh khác sản phẩm.

## 1b. Khảo sát nguồn P3.1 (Agent 1 + PM kiểm tra thủ công, 2026-11-09)

Agent 1 khảo sát Pexels theo đúng quy trình P2 (đọc từng trang, EXIF, tác giả). PM tải và xem trực tiếp các ứng viên quyết định:
- APPROVED mới: 17515211 (lưng áo trắng người mặc — vào garments.json + media manifest), 2096476 (polo trắng người mặc, không logo ngực — ảnh polo thật đầu tiên, chỉ lifestyle).
- REJECTED sau kiểm tra: 6843269 (len đan chunky, không phải jersey), 8606514 (tuổi người mẫu không xác minh được), cùng 5 ảnh mang in/thương hiệu sẵn.
- NEEDS_REVIEW giữ ở `data/candidates.json`: 5379277, 12025472, 6276008, 6276012, 7641303.
- Khoảng trống còn nguyên: base mặt sau phẳng/móc, base + cận cổ polo, mọi ảnh oversize trống đã xác minh, cận vải jersey. Hướng tiếp theo theo thứ tự ưu tiên của brief: ảnh do người bán/nhà cung cấp áo cung cấp.

## 2. Renderer hiện tại

- `src/studio.js`: Canvas 600×700, `drawShirt()` vẽ phom áo vector + hạt vải/nếp gấp (P2), vùng in theo phom: crew {cx210, cy200, w180, h280, 28cm}, oversize {195,195,210,300,32cm}, polo {215,250,170,230,24cm}. Export in gọi `drawArtwork` thuần (không shading) — giữ nguyên.
- `src/studio-model.js`: 3D phụ (three.js), giữ nguyên trạng thái P2.
- Hệ quả cho P3: engine ghép ảnh thật là lớp xem trước bổ sung; renderer P2 là fallback bắt buộc khi thiếu base/lỗi.

## 3. Dữ liệu hiện tại

- `data/products.json`: 14 SKU, không đổi ở P3.
- `data/media-manifest.json` + `src/media-manifest.js`: lifestyle theo SKU; test khóa đồng bộ — P3 không sửa cấu trúc này.
- `src/artwork-library.js`: 12 theme, `artworkLayers()` sinh lớp artwork + cá nhân hóa; 55 file SVG ở `public/artwork/` là tài sản gốc của dự án (MIT, tự vẽ).
- Vùng in đang được định nghĩa ở `src/studio.js` (theo phom) — P3 bổ sung vùng in theo TỪNG ẢNH ÁO trong `data/garments.json` (quad theo tỉ lệ ảnh), không thay thế vùng in của Studio.

## 4. Ba repo mockup được Agent 3 đánh giá (báo cáo 2026-11-09, đã đọc README + source chính)

- **CTDave001/automated_mockups** — MIT (có file LICENSE). Python/Pillow. Kỹ thuật: template chứa ô màu đặc làm mốc, lấy bounding box + 1 góc xoay, dán artwork phẳng — không phối cảnh, không shading. Giá trị học được: tách hiệu chuẩn thành file tham số riêng + batch mọi tổ hợp kèm kết quả từng mục (≈ cách `data/garments.json` + generator của P3 đang làm). Không chép code (Python, yếu hơn nhu cầu).
- **puhsum/shopify-mockup-generator** — README ghi MIT nhưng KHÔNG có file LICENSE → chỉ học kỹ thuật. OpenCV: phát hiện quad đỏ 4 góc, warp phối cảnh thật (homography). Bài học: lưu vùng in dạng 4 điểm góc có thứ tự, không chỉ hộp x/y/w/h — P3 đã làm đúng (quad trong garments.json).
- **osmaar/openmerch-engine** — MIT (có LICENSE). TypeScript/Konva + node-canvas. Kiến trúc tham chiếu: vùng in hiệu chuẩn theo mm/cm từng mặt; tách bạch file in (trong suốt, sạch) khỏi ảnh ghép xem trước; ghép 3 lớp base → artwork clip theo vùng → overlay; hai đòn bẩy chân thực là multiply shading và displacement map theo sản phẩm. Nền tảng quá nặng cho site tĩnh — chỉ học kiến trúc, không chép code.

Engine P3 (đã triển khai trước khi có báo cáo này) khớp các khuyến nghị độc lập của Agent 3: quad 4 điểm, warp mesh tam giác, shading theo luminance của chính ảnh áo (bản per-pixel, giữ alpha tốt hơn multiply composite), mask polygon silhouettte, khóa cache garmentId+artworkHash+rendererVersion. Khác biệt ghi nhận: warp hiện dùng nội suy song tuyến theo quad thay vì homography đầy đủ — đủ cho ảnh gần chính diện; homography là hướng nâng cấp khi có ảnh nghiêng mạnh. Không sao chép code từ cả ba repo.

## 5. Openclipart / taxonomy thiết kế (Agent 4, 2026-11-09, đã đọc FAQ + bảng usage chính thức)

- **Openclipart = CC0 1.0**: dùng thương mại kể cả in lên áo bán lại và print-on-demand được phép rõ ràng, không bắt buộc ghi công, được sửa đổi. Không có giấy phép riêng theo từng upload.
- **Điều kiện của dự án (bắt buộc)**: CC0 chỉ xử lý bản quyền, không xử lý thương hiệu và không đảm bảo người tải lên có quyền thật. Chỉ dùng Openclipart làm HỒ ỨNG VIÊN, duyệt từng mục: bỏ qua mọi mục gắn thẻ `pd_issue`/`need-review`, ảnh trace từ ảnh chụp, nhân vật/nhãn hiệu quen thuộc; không dùng làm logo/thương hiệu của shop; ghi lại URL + tác giả + ngày kiểm tra cho từng mục được duyệt. Không nhập khẩu hàng loạt tự động.
- **Xu hướng bên ngoài** (Printful/Printify 2026 — chỉ là tín hiệu thị trường ngoài, không phải bằng chứng bán hàng của shop): food art, Y2K, retro 80s–90s, tối giản, cá nhân hóa, động vật/thiên nhiên hình học, thiên văn/hoàng đạo, typography đậm, hài hước, thiết kế theo ngách/nhóm và họa tiết văn hóa vẽ gốc.
- **Taxonomy chốt cho thư viện**: 16 theme (gộp P1 + danh sách P3, `blank` giữ là tùy chọn áo trống, không phải theme thiết kế) — danh sách và 32 concept gốc vẽ bằng SVG đơn giản nằm trong báo cáo Agent 4, tóm tắt ở `docs/P3_ARTWORK_CATALOG.md`. 6 thiết kế pilot của phiên này thuộc các theme 8 (retro), 10 (minimal), 11 (pet), 13 (cafe-viet), 14 (van-hoa), 15 (astronomy).
