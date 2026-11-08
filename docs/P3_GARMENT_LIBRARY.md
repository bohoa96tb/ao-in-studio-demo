# P3 Garment Library — thư viện áo nền

Dữ liệu chuẩn: `data/garments.json` (schema v1). Cập nhật: 2026-11-09.

## Trạng thái theo phom

| Phom | Bản ghi | Base ghép được | Thiếu |
|---|---|---|---|
| Crew (cổ tròn) | 5 (1 base + 3 worn + 1 detail) | **1** — GAR-CREW-WHT-HANGER-01 (trắng, mặt trước) | base mặt sau (phẳng/móc), cận vải jersey riêng |
| Oversize | 0 | 0 | toàn bộ: trước/sau/cận vải/người mặc — MISSING |
| Polo | 1 (worn) | 0 | base trước/sau, cận cổ/placket — MISSING (đã có ảnh worn thật) |

## Các bản ghi hiện có

- `GAR-CREW-WHT-HANGER-01` — Pexels 20669538 (Dmitriy Steinke), áo cổ tròn trắng trên móc, mặt trước. APPROVED, ghép mặt trước, đã hiệu chuẩn (quad + mask + shading 0,35). Áo trong ảnh có viền cổ cam, tem cổ và tem gấu — ngoài vùng in, giữ nguyên khi trình bày.
- `GAR-CREW-BLK-WORN-01` — Pexels 9558583 (MART PRODUCTION), người mặc áo đen. Lifestyle only — người mẫu kéo áo, cấm ghép.
- `GAR-CREW-WHT-WORNCOUPLE-01` — Pexels 25462458 (Israel Torres), đôi mặc áo trắng (AIS-001). Lifestyle only.
- `GAR-CREW-CRM-DETAIL-01` — Pexels 37704838 (Daniel & Hannah Snipes), cận cổ/vai áo kem, tem cổ "SEVEN TITANS / XL". Vai trò đúng là ảnh chi tiết cổ/vải (P3 sửa ghi chú "flat lay" của P2 sau khi xem lại ảnh). Không ghép.
- `GAR-CREW-WHT-BACKWORN-01` — Pexels 17515211 (NJH STUDIO), người mặc mặt sau áo trắng; Agent 1 thẩm định (EXIF Sony ILCE-6000, mô tả trang ghi rõ "adult") + PM xem ảnh: lưng áo trống, không logo/watermark. Lifestyle only. Thêm ở P3.
- `GAR-POLO-WHT-WORN-01` — Pexels 2096476 (Mwabonje Ringa), người mặc polo trắng; EXIF Nikon D3000 + PM xem ảnh: không logo ngực, thấy rõ cổ bẻ và hàng nút. Ảnh polo thật đầu tiên — lifestyle only, polo vẫn chưa có base ghép.

Ứng viên bị loại đáng chú ý (chi tiết ở `data/candidates.json`): ảnh cận vải 6843269 (Antoni Shkraba) bị PM loại vì là len đan chunky kiểu áo len, không phải jersey áo thun — dùng sẽ mô tả sai chất vải; 8606514 loại vì tuổi người mẫu không xác minh được; các ảnh oversize thật trên Pexels đều mang hình in sẵn.

## Quy tắc

- Chỉ `status=APPROVED` + `compositing.allowed=true` mới vào engine; hàng chờ ở `data/candidates.json`.
- Ảnh trước/sau của cùng một mẫu phải chứng minh được là cùng kiểu áo nền; không ghép bộ từ nhiều nhà cung cấp khác nhau.
- Không dùng ảnh crew thay cho polo, không dùng áo regular giả oversize.
- Thiếu thì ghi MISSING trong `missingSets` và giữ fallback renderer P2.
