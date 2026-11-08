# P3 Artwork Catalog — thư viện hình in

Dữ liệu chuẩn: `data/artwork-library.json`, sinh tự động bởi `scripts/mockup/build-artwork-library.mjs` từ `public/artwork/*.svg` — không sửa tay file JSON.

## Số lượng

- 55 thiết kế P1 (12 theme: couple, family, group, name, date, animal, zodiac, number, slogan, art, birthday, blank) — tác phẩm gốc của dự án (MIT).
- 6 thiết kế P3 vẽ mới trong phiên này (cùng phong cách SVG của dự án, viewBox 200, nét #293e35):
  - `p3-cafe-phin` — Phin cà phê Việt (theme cafe-viet)
  - `p3-xe-dap-pho` — Xe đạp phố cổ (theme van-hoa)
  - `p3-trang-tuan-hoan` — Tuần hoàn mặt trăng (theme astronomy)
  - `p3-la-nho-nguc` — Lá nhỏ trên ngực (theme minimal)
  - `p3-retro-sun` — Mặt trời retro (theme retro)
  - `p3-meo-tim` — Mèo và trái tim (theme pet)
- Tổng: **61 thiết kế APPROVED**. Mục tiêu P3.3 là 40–60 thiết kế MỚI chất lượng — hiện đạt 6 ở mức pilot; phần còn lại tiếp tục ở các phiên sau, ưu tiên chất lượng hơn số lượng. Không thiết kế nào được gọi là bestseller/hot khi chưa có bằng chứng bán hàng.

## Taxonomy đích (16 theme, Agent 4 đề xuất và PM chốt)

1 Áo đôi & Tình bạn · 2 Gia đình, Hội nhóm & Lớp học · 3 Tên & Con số cá nhân hóa · 4 Sinh nhật & Kỷ niệm cá nhân · 5 Ngày lễ & Quà tặng · 6 Slogan tiếng Việt · 7 Streetwear & Anime-inspired gốc · 8 Retro / Vintage · 9 Y2K & Hình học số · 10 Tối giản · 11 Thú cưng · 12 Thiên nhiên & Động vật · 13 Cà phê Việt · 14 Văn hóa & Du lịch Việt · 15 Thiên văn & Hoàng đạo · 16 Nghề nghiệp & Thể thao. Mỗi theme có 2 concept gốc trong báo cáo Agent 4 (lưu ở `docs/P3_SOURCE_AUDIT.md` mục 5). 12 theme P1 ánh xạ vào taxonomy này qua adapter thư viện; `blank` là tùy chọn áo trống.

## Quy tắc

- Chỉ dùng tác phẩm gốc của dự án hoặc nguồn đã thẩm định quyền in + bán sản phẩm vật lý. Openclipart (CC0) chỉ là hồ ứng viên duyệt từng mục theo điều kiện ở `docs/P3_SOURCE_AUDIT.md` mục 5 — không nhập hàng loạt.
- Không sao chép hình in của thương hiệu khác, không nhân vật/logo có bản quyền.
- Mỗi thiết kế: designId duy nhất, tên tiếng Việt, theme, tags, nền trong suốt, placements, garmentTypes, license, artworkHash, status.
