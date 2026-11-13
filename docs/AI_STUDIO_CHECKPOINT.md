# AI Studio — Checkpoint

**P1 — 2026-11-13 (Asia/Tokyo)**
- HEAD trước: remote main `b015f4ef89b1854cd5821e631c8df49fc65ab3c2` (merge PR #12, P4). Local base: commit `e437f38` trên `feature/p4-print-production-workspace` (chính commit đã được merge vào main đó — tương thích base).
- Nhánh mới: `feature/ai-studio-p1` từ `e437f38`. HEAD sau: xem commit cuối của nhánh (ghi trong báo cáo bàn giao kèm bundle).
- Đã triển khai: `studio.html` + `src/ai-studio/{core,engine,providers,store,studio}.js` + `studio.css`; link "AI Studio" ở header `index.html`; `scripts/build.mjs` copy thêm `studio.html`; `scripts/serve.mjs` allowlist thêm studio; test `tests/ai-studio.test.mjs` (vào `npm test`) + `tests/ai-studio.mjs` (Playwright); 7 tài liệu AI_STUDIO_*; mục AI Studio trong AGENTS.md.
- Trạng thái: P1 đạt tiêu chí §15 của brief ở mức kiểm chứng bằng Playwright (xem AI_STUDIO_QA_REPORT.md). AI = DEMO. Chưa push/PR — bàn giao bằng git bundle để chủ repo tự đẩy từ Termux theo quy trình repo.
- Việc tiếp theo (P2): engine nâng cao (cache kết quả, chạy nhánh song song), rồi P4 provider thật qua proxy khi chủ shop chọn nhà cung cấp + cấp key phía server. Không bắt đầu P4 khi chưa có quyết định provider.

**P2 — Workflow Engine & lưu trữ nâng cao — 2026-11-14 (Asia/Tokyo)**
- HEAD trước: remote main `1b7d20c832631fcab55fdb0c4d1bc1fcbccb4a4c` (merge PR #13, AI Studio P1). Local base: commit `c9eba1c` trên `feature/ai-studio-p1` (chính commit đã merge vào main đó — tương thích base).
- Nhánh mới: `feature/ai-studio-p2` từ `c9eba1c`. HEAD sau: xem commit cuối của nhánh (ghi trong báo cáo bàn giao kèm bundle).
- Đã triển khai: hàng đợi chạy tuần tự + lịch sử chạy lưu IndexedDB (tối đa 50/dự án, chi tiết từng node); đệm kết quả node theo khóa hash lồng (trạng thái `cached`, chỉ mất hiệu lực ở node sửa + phía sau); thử lại cho node AI (mặc định 1) + timeout mỗi node (mặc định 60s) + "Chạy tiếp từ node lỗi"; báo cáo kiểm tra trước khi chạy (chặn + danh sách tiếng Việt); phiên bản dự án khi bấm Lưu (tối đa 20, khôi phục có ghi lại) — tự lưu chuyển thành BẢN NHÁP riêng; khôi phục bản nháp chưa lưu khi mở trang; tab Lưu trữ (dung lượng theo hạng mục/dự án, cảnh báo 80% hạn mức, dọn file rác theo tham chiếu, xóa đệm); tiến trình chạy (node xong/tổng + thời gian) + thời lượng từng node. IndexedDB nâng v1→v2 (chỉ thêm store `runs`/`versions`/`cache`/`drafts`, có test migration với DB v1 thật). CI (`check.yml`) bổ sung 2 suite browser của AI Studio.
- File mới: `src/ai-studio/p2.js`, `tests/ai-studio-p2.test.mjs` (vào `npm test`), `tests/ai-studio-p2.mjs`. File sửa: `engine.js`, `store.js`, `studio.js`, `studio.css`, `studio.html`, `package.json`, `.github/workflows/check.yml`, tài liệu AI_STUDIO_*.
- Trạng thái: P2 đạt kiểm chứng Playwright + unit (xem AI_STUDIO_QA_REPORT.md mục P2). AI vẫn DEMO. Chưa push/PR — bàn giao bằng git bundle như P1.
- Việc tiếp theo (P3 của brief AI Studio): xử lý hình ảnh & ghép hình in nâng cao. Provider thật (P4) chỉ khi chủ shop chọn nhà cung cấp + cấp key phía server/proxy.
