# P3 Automation — năm giai đoạn, gọi đúng tên

Nguyên tắc: GitHub Pages là hosting tĩnh — tự động hóa chạy qua GitHub Actions. Không khóa API nào nằm trong frontend hay trong repo (chỉ ở GitHub Secrets). Không giai đoạn nào tự duyệt tài nguyên, tự mua ảnh hay tự merge.

## A. INVENTORY SCAN — kiểm kê nội bộ (ĐÃ TRIỂN KHAI)

- Script: `scripts/discovery/scan.mjs` — đọc `data/garments.json` + `data/candidates.json` + `data/artwork-library.json`, xuất báo cáo khoảng thiếu và hàng chờ.
- Đây CHỈ là kiểm tra dữ liệu dự án đã có. Không gọi nó là "tự động tìm ảnh trên Internet".

## B. SOURCE DISCOVERY — tìm ứng viên mới bên ngoài (ĐÃ CÓ MÃ, CHƯA KÍCH HOẠT)

- Script: `scripts/discovery/search-pexels.mjs` — truy vấn API chính thức của Pexels theo các khoảng thiếu (mặt sau, oversize, polo, cận vải) và xuất danh sách `CANDIDATE` chưa thẩm định.
- Điều kiện: biến môi trường `PEXELS_API_KEY`. **Repo hiện chưa có khóa này** (cần chủ repo thêm vào GitHub Secrets) nên khi chạy, script báo rõ `NOT CONFIGURED` và không tìm kiếm gì — không giả lập kết quả. Khi có khóa, kết quả vẫn chỉ là ứng viên thô cho giai đoạn C.
- Workflow: `.github/workflows/p3-discovery.yml` chạy A+B mỗi thứ Hai 02:00 UTC + `workflow_dispatch`, kết quả dạng artifact để người duyệt.

## C. ASSET APPROVAL — kiểm duyệt (THỦ CÔNG, có chủ đích)

Quy trình P2/P3 giữ nguyên: đọc trang nguồn từng ảnh, kiểm tra EXIF/tác giả/giấy phép, tải về xem trực tiếp, đối chiếu danh sách REJECTED (ví dụ 9558713 bị cấm vĩnh viễn), rồi mới ghi `APPROVED` vào `data/garments.json` hoặc `data/candidates.json`. Không có đường tắt tự động cho bước này.

## D. MOCKUP GENERATION — tạo tổ hợp từ tài nguyên APPROVED (ĐÃ TRIỂN KHAI)

- Script: `scripts/mockup/generate.mjs` — dựng mockup cho mọi áo APPROVED × artwork APPROVED, kiểm tra fidelity (Δcoverage ≤ 0,15), ghi `data/mockup-manifest.json` kèm sha256; chạy lại không tạo trùng (cache key).
- Workflow: `.github/workflows/p3-generate.yml` — chỉ `workflow_dispatch`, xuất artifact, KHÔNG commit.

## E. RELEASE — phát hành có kiểm duyệt (QUY TRÌNH CHUẨN)

Nhánh feature → PR → CI (`check.yml`: unit + browser + interaction + P0 + P1 + P3 + P3.1) → merge theo phê duyệt áp dụng cho PR đó → kiểm tra GitHub Pages thực tế. Tự động hóa dừng ở việc chuẩn bị; quyết định merge không tự động hóa ngoài phê duyệt của chủ repo.
