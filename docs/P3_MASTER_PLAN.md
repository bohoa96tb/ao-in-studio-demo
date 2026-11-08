# P3 Master Plan — Automated real garment mockup & print design library

Ngày lập: 2026-11-09 (Asia/Tokyo). Base: main `ad81b8d73aff359392b1350ab43f45ff79545ee8` (P2 đã merge qua PR #3).
Nhánh: `feature/p3-automated-mockup-library`. Không tạo repo/website mới. Không làm lại P2.

## Vai trò (3 agent nghiên cứu được spawn thật; phần triển khai do PM thực hiện tuần tự theo vai trò)

- Agent 0 PM/Orchestrator: audit, nhánh, dữ liệu, hợp nhất, checkpoint. (phiên này)
- Agent 1 Image Sourcing (spawn thật): tìm + thẩm định ảnh áo nền mới trên Pexels theo quy trình P2.
- Agent 2 Garment Library: PM thực thi — `data/garments.json`.
- Agent 3 Mockup Engine (spawn thật phần nghiên cứu 3 repo GitHub; PM thực thi engine).
- Agent 4 Artwork Library (spawn thật phần license Openclipart + taxonomy; PM thực thi thư viện + thiết kế gốc mới).
- Agent 5 Catalog/Studio UX: PM thực thi tích hợp tối thiểu, không phá P0–P2.
- Agent 6 Automation: PM thực thi workflow GitHub Actions (discovery/generation, chạy tay + lịch, không tự duyệt, không tự merge).
- Agent 7 QA độc lập: PM chạy bộ test riêng cho P3 + toàn bộ suite cũ; kết quả ở `docs/P3_QA_REPORT.md`.

## Nguyên tắc bất biến (kế thừa AGENTS.md + P2)

- Giữ 14 SKU, 12 nhóm thiết kế P1, 55 artwork gốc, hai motion Hồ núi/Lá bài, Studio 2D/3D, upload ảnh cá nhân, cart snapshot bất biến, IndexedDB v1, undo/redo.
- Không ghép artwork của khách lên ảnh người mẫu đang mặc (worn). Chỉ ghép lên ảnh áo không người mặc (móc treo/phẳng) đã APPROVED và đã hiệu chuẩn.
- Ảnh lifestyle luôn kèm chú thích; không trình bày ảnh ghép/ảnh minh họa thành ảnh sản phẩm đã sản xuất.
- Không dùng tài nguyên chưa xác minh quyền. Chỉ trạng thái APPROVED mới vào pipeline chính thức.
- Export in (print file) luôn sạch, không bóng vải — engine chỉ áp shading ở lớp xem trước.
- Không bịa chất liệu/size/tồn kho/chính sách. Giữ trạng thái demo.

## Kiến trúc dữ liệu

- `data/garments.json` — thư viện áo nền (schema v1): garmentId, type, color, source, license, views{front/back/detail/worn}, compositing{allowed, zone quad, mask}, status, missing[].
- `data/artwork-library.json` — thư viện hình in (schema v1), sinh từ `public/artwork/*.svg` bằng `scripts/mockup/build-artwork-library.mjs` + thiết kế mới vẽ tay trong repo.
- `data/mockup-manifest.json` — mockup đã dựng sẵn: garmentId + artworkId + view + rendererVersion → file, sha256, kích thước. Sinh bởi `scripts/mockup/generate.mjs`.
- `data/media-manifest.json` — giữ nguyên tương thích P2 (không sửa cấu trúc).
- `src/mockup-engine/engine.js` — logic thuần (quad, mesh warp, cache key, validate) dùng cho cả Node test và trình duyệt.
- `src/mockup-engine/composite.js` — renderer Canvas: warp artwork theo mesh, multiply shading từ chính ảnh áo, mask theo polygon thân áo.
- `public/mockups/` — WebP mockup dựng sẵn cho tổ hợp mặc định.

## Giai đoạn

- P3.0 Audit — XONG trong phiên này (xem `docs/P3_SOURCE_AUDIT.md`).
- P3.1 Pilot áo nền — một phần: bộ crew trắng (móc treo) APPROVED cho ghép mặt trước; thiếu mặt sau/oversize/polo (ghi rõ, chờ Agent 1 + duyệt).
- P3.2 Pilot engine — ghép 5 artwork độ khó khác nhau lên bộ áo đã hiệu chuẩn; test trung thực artwork; fallback renderer P2 khi lỗi.
- P3.3 Thư viện hình in — adapter 55 artwork cũ + lô thiết kế gốc mới (pilot), mục tiêu 40–60 hoàn thành ở các phiên sau.
- P3.4 Giao diện — chi tiết sản phẩm có mục mockup trên áo thật (gắn nhãn "Ảnh mô phỏng"), Studio có xem trước trên áo thật cho tổ hợp được hỗ trợ.
- P3.5 Automation — workflow discovery (báo cáo ứng viên, không tự tải/duyệt) + generation (chạy tay, xuất artifact, không tự commit/merge).
- P3.6 QA & PR — CI xanh mới mở PR; không tự merge.

## Tiêu chuẩn kết thúc của phiên này

P3.0–P3.2 có bằng chứng chạy thật; P3.3–P3.5 ở mức pilot/scaffold hoạt động được; mọi thiếu hụt ghi rõ trong CHECKPOINT.
