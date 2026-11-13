# AI Studio — Architecture

## Quyết định tích hợp (quan trọng)
Brief đề xuất React + TypeScript + @xyflow/react. Repo hiện tại là **site tĩnh vanilla JS, không bundler** (Vite chỉ dùng dev; build = `node scripts/build.mjs` copy file vào `dist/` để GitHub Pages phục vụ). Thêm React/TS/@xyflow sẽ phá vỡ pipeline build/deploy đang chạy tốt và toàn bộ test hiện có. Theo đúng quy tắc của brief ("ưu tiên tận dụng công nghệ hiện tại của repository"), P1 triển khai:

- Trang độc lập **`studio.html`** ở root repo = tương đương route `/studio` trên Pages tĩnh. Chỉ thêm **1 link "AI Studio"** trong header `index.html`; không sửa hành vi trang nào khác.
- Node editor **vanilla JS tự viết**: node = thẻ HTML định vị tuyệt đối trong "world" có transform pan/zoom; dây nối = SVG bézier; tương tác bằng **Pointer Events** (chuột + cảm ứng chung một đường mã), `touch-action:none` trên canvas, pinch-zoom 2 ngón.
- `scripts/build.mjs` được bổ sung `studio.html` vào danh sách copy; `scripts/serve.mjs` (server test local) được bổ sung allowlist cho `studio.html` + `src/ai-studio/*` (vẫn chặn file nhạy cảm như cũ — test server giữ nguyên).

## Cấu trúc mã (`src/ai-studio/`)
| File | Vai trò |
|---|---|
| `core.js` | DOM-free: định nghĩa 12 node + cổng/kiểu dữ liệu, kiểm tra tương thích kiểu, chống vòng lặp, prompt builder theo quy tắc, kiểm tra an toàn SVG, ZIP writer/reader (store, CRC32), 4 template. |
| `engine.js` | DOM-free: sắp xếp topo, validate đầu vào bắt buộc, chạy all/single(from-upstream)/from-node, trạng thái + log từng node, cờ dừng giữa các node, lan truyền lỗi. |
| `providers.js` | Hợp đồng Provider Adapter + `DemoAdapter` + `HttpAdapter` (stub có cổng kiểm soát). Key chỉ ở biến bộ nhớ module. |
| `store.js` | IndexedDB riêng **`ao-in-ai-studio`** (stores: `projects`, `assets`). Không mở bất kỳ DB nào khác. |
| `studio.js` | UI + runtime handler cho từng node (Canvas API: ghép in, chỉnh ảnh, ảnh demo, video WebM qua MediaRecorder), dự án (lưu/mở/đổi tên/nhân bản/xóa/import/export). |
| `studio.css` | Theme kem/charcoal/terracotta; desktop 3 cột; mobile: library dạng ngăn kéo, thuộc tính dạng bottom sheet, canvas toàn màn hình. |

## Luồng dữ liệu
Node xuất ra "value" theo kiểu: `image | design | prompt | video | any` (blob + object URL + nhãn nguồn gốc). Engine cấp `inputs` theo đúng dây nối; cổng vào nhận tối đa 1 dây; kiểu không khớp hoặc tạo vòng lặp bị từ chối kèm thông báo tiếng Việt.

## Bảo toàn hình in
Node `designInput` giữ file gốc (blob trong IndexedDB hoặc SVG text đã qua kiểm tra an toàn). Node `composition` vẽ **chính pixel gốc** đó lên ảnh áo trong vùng in an toàn (khung đứt nét), kèm xoay/tỉ lệ — AI không tham gia vẽ lại hình in. Mọi ảnh do node AI tạo ở P1 đều đóng dấu "ẢNH DEMO — chưa kết nối AI" ngay trong pixel.

## Lưu trữ & xuất
- Tự lưu (debounce 800 ms) + nút Lưu; mở lại dự án mới nhất khi vào trang.
- Xuất ZIP (store, tự viết): `workflow.json`, `metadata.json`, `prompts.txt`, `assets/…` (file gốc), `designs/…svg`, `results/…` (kết quả đã chạy). **Không chứa API key.** Xuất riêng `workflow.json` khi chỉ cần cấu trúc. Nhập lại từ JSON/ZIP (ZIP đọc được bởi chính reader tối giản; chỉ hỗ trợ store-method).
