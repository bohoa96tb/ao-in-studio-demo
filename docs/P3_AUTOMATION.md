# P3 Automation — ba luồng vận hành

Nguyên tắc: GitHub Pages là hosting tĩnh — mọi tự động hóa chạy qua GitHub Actions/jobs, không có server nền trong trang web. Không khóa API nào nằm trong frontend hay repo. Không luồng nào tự duyệt tài nguyên hoặc tự merge.

## A. DISCOVERY — tìm & kiểm kê nguồn

- Script: `scripts/discovery/scan.mjs` — đọc `data/garments.json` + `data/candidates.json` + `data/artwork-library.json`, xuất báo cáo khoảng thiếu và hàng chờ.
- Workflow: `.github/workflows/p3-discovery.yml` — chạy thứ Hai hằng tuần 02:00 UTC + `workflow_dispatch`; kết quả là artifact báo cáo để người duyệt.
- Giới hạn có chủ đích: script KHÔNG tải ảnh và KHÔNG tự duyệt giấy phép. Nguồn không có API hợp lệ hoặc cấm thu thập tự động chỉ được ghi vào hàng chờ `data/candidates.json` (trạng thái CANDIDATE/NEEDS_REVIEW) để con người thẩm định theo quy trình P2/P3. Ứng viên REJECTED (ví dụ Pexels 9558713) được giữ trong hàng chờ để chống trùng lặp.

## B. GENERATION — tạo mockup tự động

- Script: `scripts/mockup/generate.mjs` — dựng mockup cho mọi tổ hợp áo APPROVED × artwork APPROVED trong ma trận cấu hình, kiểm tra fidelity (Δcoverage ≤ 0,15, sai là dừng), ghi `data/mockup-manifest.json` kèm sha256. Chạy lại không tạo trùng (cache theo khóa tổ hợp + checksum).
- Workflow: `.github/workflows/p3-generate.yml` — chỉ `workflow_dispatch`; xuất artifact (mockups + manifests), KHÔNG commit.

## C. RELEASE — phát hành có kiểm duyệt

- Quy trình chuẩn của dự án: nhánh feature → PR → CI (`check.yml`, gồm unit + browser + interaction + P0 + P1 + P3) → chủ repo duyệt → merge → kiểm tra GitHub Pages thực tế.
- Tự động hóa dừng ở việc chuẩn bị artifact/báo cáo; quyết định phát hành thuộc về chủ repository.
