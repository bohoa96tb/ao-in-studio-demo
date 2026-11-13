# AI Studio — Checkpoint

**P1 — 2026-11-13 (Asia/Tokyo)**
- HEAD trước: remote main `b015f4ef89b1854cd5821e631c8df49fc65ab3c2` (merge PR #12, P4). Local base: commit `e437f38` trên `feature/p4-print-production-workspace` (chính commit đã được merge vào main đó — tương thích base).
- Nhánh mới: `feature/ai-studio-p1` từ `e437f38`. HEAD sau: xem commit cuối của nhánh (ghi trong báo cáo bàn giao kèm bundle).
- Đã triển khai: `studio.html` + `src/ai-studio/{core,engine,providers,store,studio}.js` + `studio.css`; link "AI Studio" ở header `index.html`; `scripts/build.mjs` copy thêm `studio.html`; `scripts/serve.mjs` allowlist thêm studio; test `tests/ai-studio.test.mjs` (vào `npm test`) + `tests/ai-studio.mjs` (Playwright); 7 tài liệu AI_STUDIO_*; mục AI Studio trong AGENTS.md.
- Trạng thái: P1 đạt tiêu chí §15 của brief ở mức kiểm chứng bằng Playwright (xem AI_STUDIO_QA_REPORT.md). AI = DEMO. Chưa push/PR — bàn giao bằng git bundle để chủ repo tự đẩy từ Termux theo quy trình repo.
- Việc tiếp theo (P2): engine nâng cao (cache kết quả, chạy nhánh song song), rồi P4 provider thật qua proxy khi chủ shop chọn nhà cung cấp + cấp key phía server. Không bắt đầu P4 khi chưa có quyết định provider.
