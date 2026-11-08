# P2 Review — so sánh trước / sau

Ngày: 2026-11-09 (Asia/Tokyo). Base main: `b15dedc`. Nhánh: `feature/p2-real-product-visuals`.

## Trước (P1)

- 12/14 SKU dùng hình áo đa giác Canvas phẳng: fill một màu + gradient ngang nhẹ + vài đường may.
  Hình in nằm phẳng trên nền áo, không có nếp vải phủ lên, nhìn như sticker.
- Không có bất kỳ ảnh chụp thật nào; chi tiết sản phẩm chỉ có trước/sau/cận từ renderer.
- Hero chỉ có 1 CTA ("Tự thiết kế ngay"); thẻ catalog không ghi loại hình ảnh.
- 3D: ExtrudeGeometry phẳng, 1 đèn chính + hemisphere, roughness .9.

## Sau (P2)

- **Renderer thực hơn (mọi SKU, pilot crew/oversize/polo cùng lúc vì dùng chung `drawShirt`):**
  hạt vải (fabric grain, pattern xác định bằng seed — không nhấp nháy giữa các lần vẽ),
  nếp gấp dọc hai bên thân, nếp nách, nếp ngang trên gấu, falloff sáng dọc,
  cổ áo theo kiểu (crew 3 đường gân; oversize vai trễ + cổ rộng; polo cổ bẻ hình V, nẹp và 2 nút),
  gấu/tay áo may hai đường. Cùng trường sáng/nếp được phủ **lại lên trên hình in** ở alpha thấp
  (0,03–0,08) nên mực in "ăn" vào vải thay vì nổi phẳng.
  Toạ độ, chính tả tiếng Việt, màu và bố cục artwork **không đổi** — bộ test P1 `exactArtwork` vẫn đạt.
  File in xuất ra (`export-art`) vẫn là `drawArtwork` thuần, nền trong suốt, không chứa bóng vải.
- **Ảnh chụp thật (áo trống, Pexels):** 4 ảnh đã thẩm định giấy phép, tổng 168 KB WebP,
  ở mục "Phom áo ngoài đời" và tab "Người mặc" trong chi tiết (chỉ hiện khi khớp SKU/kiểu/màu;
  polo tự ẩn). Caption luôn ghi: áo trống, không chứa hình in của bạn, không phải ảnh sản phẩm
  đã sản xuất, người mẫu không xác nhận thương hiệu, kèm tác giả + link nguồn.
  Ảnh tải hoãn bằng IntersectionObserver (chỉ tải khi gần tới) + `fetchpriority=low` để không tranh LCP với Hero.
- **UX:** Hero thêm CTA "Khám phá bộ sưu tập"; thẻ catalog có badge loại ảnh
  ("Mockup minh họa · đúng artwork của mẫu" / "Ảnh ý tưởng · có giấy phép MIT");
  ghi chú catalog nói rõ nơi xem ảnh người mặc thật.
- **3D:** giữ vai trò phụ như P1; thêm đèn rim/fill, sRGB output, bevel mượt hơn, roughness .86.
  Không nhúng GLB mới (xem lý do trong P2_ASSET_LICENSES.md). Fallback 2D hoạt động:
  ở môi trường kiểm thử headless không WebGL, Studio báo "3D không khả dụng" và dùng 2D bình thường.
- **Dữ liệu:** `data/products.json` **không đổi một byte** (14 SKU, giá, pricing giữ nguyên).
  Media mới nằm ở `data/media-manifest.json` + `src/media-manifest.js` (test khóa tính đồng bộ).

## Chưa đạt / còn thiếu (nói thẳng)

- Catalog vẫn là mockup renderer — đã thực hơn nhưng **không phải ảnh chụp sản phẩm**; nhãn trên web nói đúng điều này.
- 5 SKU chưa có lifestyle phù hợp (4 polo + AIS-M02 hồng). Cần ảnh polo chụp thật có phép hoặc ảnh shop tự chụp.
- LCP ≤2,5 s: **chưa đạt** (kế thừa từ P1). Đo cục bộ cùng máy: P1 base 2710 ms; P2 2713/2859 ms sau khi hoãn tải ảnh thật (trước khi hoãn: ~3,1–3,3 s — đã sửa).
- Chưa kiểm thử trên điện thoại thật; chưa force-test WebGL context-loss bằng cách tiêm lỗi (fallback đã quan sát được ở headless, nhưng không thay thế force-test).
