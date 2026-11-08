# P2 QA Report — kiểm thử độc lập (Agent 6)

Ngày: 2026-11-09 (Asia/Tokyo). Môi trường: Chromium Playwright (headless shell) trên VM,
server cục bộ `scripts/serve.mjs` cổng 5264. **Không phải điện thoại thật** — không suy diễn kết quả máy thật từ giả lập này.
Mã kiểm thử: nhánh `feature/p2-real-product-visuals` (trước commit chốt phiên).

## Kết quả tự động

| Hạng mục | Kết quả |
|---|---|
| Lint (`node --check src/app.js`) + check các module đã sửa | ĐẠT |
| Unit tests | **24/24 ĐẠT** (20 test P0/P1 cũ + 4 test P2 media-manifest: bao phủ 14 SKU, mirror JSON↔code, file tồn tại, cấm 9558713, polo không nhận ảnh crew, print zones khớp Studio) |
| Build (`scripts/build.mjs`) | ĐẠT; `dist/` chứa đủ `data/media-manifest.json` và 4 ảnh `real-tee/` |
| Browser regression `tests/browser.mjs` | ĐẠT cả 5 viewport 360/390/430/768/1440: detail/back/overflow=false, errors=[] |
| Interaction `tests/interaction.mjs` | ĐẠT 390/1440: touch rail/circle, keyboard/Escape, fitting drop hợp lệ/không hợp lệ, errors=[], axe violations=[] (railTouch=false ở 1440 là hành vi desktop như P1) |
| P0 suite `tests/p0.mjs` | ĐẠT 5 viewport: đúng SKU/giá, photo draft, cart identity, template reset; atlas/manifest bị abort vẫn dùng được rail và mở đúng sản phẩm |
| P1 suite `tests/p1.mjs` | ĐẠT: 12 chủ đề tại 390 + hành trình tại 4 viewport còn lại; webp/gallery/**exactArtwork=true**/cart reload-edit; errors=[] |

## Kiểm chứng riêng cho P2 (script Playwright riêng, 390px)

- Mục ảnh thật: 4/4 ảnh **không** tải trước khi cuộn tới (src rỗng), tải đủ 4/4 sau khi vào tầm nhìn, không pageerror.
- Chi tiết AIS-004 (crew): tab "Người mặc" hiện; bấm vào đổi ảnh sang `crew-white-hanger.webp` và ghi chú hiện đúng caption + tác giả Dmitriy Steinke / Pexels.
- Chi tiết AIS-003 (polo): tab "Người mặc" **ẩn** (không dùng ảnh crew thay polo). ĐẠT theo nguyên tắc.
- Thẻ catalog: 14 thẻ, badge loại ảnh hiển thị đúng.
- Kiểm tra bằng mắt (ảnh chụp 390px): catalog có chiều sâu vải hơn P1; mục ảnh thật và tab Người mặc hiển thị đúng, caption đọc rõ.

## Hình ảnh / artwork

- Không ảnh hỏng, không watermark trong 4 ảnh Pexels đã dùng (kiểm tra bằng mắt + EXIF JPEG gốc).
- Artwork trong mockup khớp thiết kế đã chọn (P1 suite `exactArtwork`, hashes 12 chủ đề phân biệt).
- Ảnh lifestyle không được giới thiệu là ảnh sản phẩm sản xuất (caption + ghi chú trên trang).
- Không SKU nào hiển thị ảnh của SKU/kiểu áo khác (test media-manifest + kiểm chứng polo ở trên).

## Hiệu năng (Lighthouse mobile, localhost, throttling mẫu của dự án)

| Lần đo | Performance | Accessibility | LCP | CLS | TBT |
|---|---|---|---|---|---|
| P1 base, cùng máy, cùng điều kiện | 94 | 96 | 2710 ms | 0 | 155 ms |
| P2 trước khi hoãn tải ảnh thật | 88–90 | 96 | 3089–3259 ms | 0 | 231–401 ms |
| P2 bản cuối (IntersectionObserver + fetchpriority=low) | 89 / 89 | 96 / 96 | **2713 / 2859 ms** | **0 / 0** | 289–332 ms |

- Mục tiêu: Performance ≥85 **ĐẠT**; Accessibility ≥95 **ĐẠT**; CLS ≤0,1 **ĐẠT**;
  LCP ≤2,5 s **CHƯA ĐẠT** — ngang mức P1 (vốn cũng chưa đạt: CI P1 2630 ms, dao động 2447–2780 ms), không còn hồi quy do ảnh thật.
- TBT cục bộ dao động lớn trên VM đang chạy song song nhiều tác vụ; cần số CI trên PR để kết luận.
- INP thực tế: **không đo** (Lighthouse lab không phải field INP) — không suy diễn.
- Ảnh chính (Hero/motion) tải sớm như P1; toàn bộ ảnh thật P2 tải hoãn; 3D chỉ tải khi mở chế độ 3D (giữ nguyên cơ chế P1).

## Chưa kiểm chứng (không báo đạt)

- Điện thoại Android/iPhone thật.
- Force WebGL context-loss / tắt WebGL bằng tiêm lỗi: chưa làm. Quan sát phụ: ở headless không WebGL,
  Studio tự rơi về 2D kèm thông báo — đây là bằng chứng hành vi fallback, không phải force-test.
- Lỗi tải từng file ảnh front/back của motion (suite P0 chỉ abort atlas + manifest).
- Browser regression gieo sẵn (pre-seed) giỏ/draft legacy unversioned trong IndexedDB v1 rồi tải bản P2: pricing legacy đã có unit test ở `cart.test.mjs`, nhưng chưa có test trình duyệt dạng gieo sẵn này (đề xuất của Agent 4/6).
- CI trên GitHub Actions cho PR P2: chờ khi PR được tạo; merge chỉ khi CI xanh.
