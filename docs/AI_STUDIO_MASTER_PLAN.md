# AI ST STUDIO — AI CREATIVE WORKFLOW — Master Plan

Công cụ workflow dạng node (kéo–nối–chạy) để tạo ảnh/video quảng cáo cho shop áo thun in, tích hợp vào repo `ao-in-studio-demo` tại trang độc lập `studio.html` (tương đương route `/studio` trên GitHub Pages tĩnh), không phá vỡ website bán hàng.

## Giai đoạn
- **P1 — UI + Node Editor + Engine + lưu dự án + Demo Mode: ĐÃ TRIỂN KHAI (2026-11-13, branch `feature/ai-studio-p1`).** Canvas kéo/thả/phóng, 12 loại node, kết nối kiểm tra kiểu + chống vòng lặp, engine chạy theo topo, 4 mẫu workflow, xuất ZIP/JSON, IndexedDB riêng `ao-in-ai-studio`. AI ở chế độ DEMO (ghi rõ trên từng kết quả) — chưa kết nối provider thật.
- P2 — Workflow Engine nâng cao (chạy song song theo nhánh, cache kết quả node, versioning dự án).
- P3 — Xử lý ảnh nâng cao (phối cảnh/độ cong vùng in theo quad đã hiệu chuẩn của P3 mockup engine; tách nền dùng lại pipeline P4 khi phù hợp).
- P4 — Provider Adapter + AI Image THẬT (cần backend proxy/serverless + key của chủ shop; xem AI_STUDIO_PROVIDER_GUIDE.md). Chỉ đánh dấu hoàn thành khi đã tạo ảnh thật thành công qua provider.
- P5 — AI Video THẬT (image-to-video qua provider; hiện chỉ có video DEMO WebM ghi từ canvas).
- P6 — Export nâng cao, tối ưu hiệu năng, phát hành.

## Nguyên tắc bất biến
1. Không coi AI là công cụ bảo toàn hình in: file thiết kế gốc luôn giữ riêng, ghép hậu kỳ bằng chính pixel gốc (node Ghép hình in).
2. Phân biệt rõ "Ảnh DEMO/AI mô phỏng" vs "Ảnh sản phẩm thực" trên mọi kết quả.
3. API key không bao giờ vào Git/IndexedDB/localStorage/file xuất; chỉ giữ trong bộ nhớ phiên (xem Provider Guide).
4. Không thư viện trả phí cho chức năng cơ bản; không thêm dependency npm mới trong P1 (ZIP viết tay dạng store).
5. Không đụng vào dữ liệu/IndexedDB hiện có của shop (`ao-in-*` khác), catalog, giỏ hàng, P4 Print Workspace.
