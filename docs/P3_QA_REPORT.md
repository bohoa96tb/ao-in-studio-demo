# P3 QA Report — 2026-11-09 (local, branch feature/p3-automated-mockup-library)

## Kết quả kiểm thử

- **Unit: 32/32 PASS** — gồm 8 test mới `tests/mockup-engine.test.mjs` (toán quad, khóa cache, toàn vẹn garments.json, cấm 9558713, ảnh worn không bao giờ là base, khoảng thiếu polo/oversize ghi rõ, thư viện artwork phủ mọi SVG đúng một lần, manifest mockup khớp sha256 + fidelity) và bộ P0/P1/P2 cũ. Một test P2 được cập nhật có chủ đích: polo nay có ảnh worn polo đã xác minh (polo-white-worn) nên khẳng định "polo không có ảnh nào" đổi thành "polo không bao giờ nhận ảnh crew/oversize" — bất biến gốc được giữ và siết chặt.
- **Browser suites (5 viewport 360/390/430/768/1440): PASS** — `tests/browser.mjs` (detail/back/overflow/errors sạch), `tests/interaction.mjs` (không vi phạm a11y), `tests/p0.mjs` (exact product, draft, giỏ hàng, template reset + 2 ca chích lỗi), `tests/p1.mjs` (12 theme journeys ở 390px, exactArtwork=true mọi viewport — renderer cũ không bị P3 ảnh hưởng).
- **P3 browser (`tests/p3.mjs`): PASS** — AIS-001 hiện tab "Trên áo thật", ảnh mockup tải được và có chú thích mô phỏng; cá nhân hóa đổi thiết kế thì tab ẩn; AIS-003 (polo) không có tab.
- **Lint + build: PASS** (`node --check`, `scripts/build.mjs`).
- **Generator**: chạy lại `scripts/mockup/generate.mjs` cho kết quả CACHED toàn bộ (idempotent theo cache key + sha256).

## Fidelity artwork

- 8 mockup dựng sẵn: độ lệch bao phủ alpha 0,002–0,017 (ngưỡng 0,15) — đạt.
- Chữ tiếng Việt kiểm chứng riêng: "CÀ PHÊ / RỒI TÍNH" vẽ bằng fillText từ chuỗi gốc, Δ=0,002, dấu đúng khi xem phóng to. Không có bước AI tái tạo chữ.
- Hai lỗi engine phát hiện bằng QA hình ảnh và đã sửa trước khi chốt: đường kẻ lưới trên artwork (khử răng cưa clip + composite multiply làm đục vùng trong suốt) → sửa bằng overdraw tam giác ~1,8px + shading per-pixel bằng ImageData.

## Hiệu năng (Lighthouse mobile, local, máy ảo dùng chung)

- Performance 88 · Accessibility 96 · CLS 0 · TBT 304 ms · **LCP 2927 ms — mục tiêu ≤2,5s CHƯA ĐẠT** (cùng dải chưa đạt từ P1/P2: 2713–2927 ms; không tuyên bố PASS). Hai ảnh lifestyle mới tải lazy ngoài viewport đầu.

## Dữ liệu & an toàn

- Không đổi `data/products.json`, IndexedDB v1, giá hay snapshot giỏ hàng. 14 SKU, 12 theme P1, hiệu ứng AIS-M01/AIS-M02 nguyên vẹn.
- Ảnh mới (2): đều qua quy trình Agent 1 + PM xem trực tiếp; 6843269 bị loại vì len đan chunky không phải jersey; 8606514 bị loại vì tuổi người mẫu không xác minh được; 9558713 tiếp tục bị cấm (có test khóa).
- Không ghép artwork khách lên ảnh người mặc ở bất kỳ đâu; mockup dựng sẵn chỉ cho thiết kế mặc định và luôn ghi "Ảnh mô phỏng".

## Chưa đạt / còn mở (không che giấu)

- Bộ áo đầy đủ front+back cho một mẫu: **0 bộ** — mới có 1 base mặt trước (crew trắng). Base mặt sau, base polo, mọi ảnh oversize vẫn MISSING (ghi rõ trong `data/garments.json`).
- Thiết kế mới: 6/40–60 mục tiêu P3.3 (mức pilot).
- Studio chưa ghép trực tiếp thiết kế tùy chỉnh của khách lên áo thật theo thời gian thực (mới dựng sẵn cho thiết kế mặc định ở trang chi tiết).
