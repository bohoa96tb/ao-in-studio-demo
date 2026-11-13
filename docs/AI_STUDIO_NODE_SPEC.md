# AI Studio — Node Spec (P1)

Cổng vào nhận tối đa 1 dây. Tương thích kiểu: giống nhau, hoặc bất kỳ phía nào là `any`, hoặc `design → image`. Màu theo nhóm: Input xanh lá/xanh dương/tím · Processing terracotta/vàng · AI hồng/tím · Output xám.

| # | Node (type) | Vào → Ra | Cấu hình | Hành vi thật trong P1 |
|---|---|---|---|---|
| 1 | Ảnh đầu vào `imageInput` | — → image | Ảnh có sẵn (4 fixture ảnh thật của shop) hoặc tải PNG/JPG/WebP (nhiều file, lưu IndexedDB, chọn file đang dùng) | Trả blob ảnh thật |
| 2 | Hình in `designInput` | — → design | Tải PNG/SVG; nút hình in mẫu | SVG qua kiểm tra an toàn (chặn script/on*/javascript:/foreignObject/ảnh ngoài). Giữ nguyên file gốc |
| 3 | Prompt `promptInput` | — → prompt | Text tiếng Việt + 3 mẫu prompt | Trả text |
| 4 | Trợ lý prompt (quy tắc) `promptAssistant` | prompt? → prompt | Phong cách/Người mẫu/Bối cảnh/Ánh sáng/Góc chụp + bổ sung | Ghép prompt bằng **quy tắc** (không phải AI), kết quả sửa tay được, luôn kèm câu giữ nguyên hình in gốc |
| 5 | Ghép hình in lên áo `composition` | image? + design → image | Ảnh nền dự phòng, X/Y/rộng vùng in %, xoay | Canvas: vẽ ảnh áo + **pixel hình in gốc** trong khung vùng in an toàn đứt nét |
| 6 | Chỉnh sửa ảnh `imageEditor` | image → image | Cắt %, xoay, resize px, sáng, tương phản | Canvas API + `ctx.filter` — thật |
| 7 | Tạo ảnh AI `aiImageGen` | prompt? + image? → image | Tỉ lệ 4:5/1:1/9:16/16:9, số lượng (P1 tạo 1) | **DEMO**: canvas suy biến từ ảnh tham chiếu + đóng dấu "ẢNH DEMO — chưa kết nối AI". Provider HTTP: báo lỗi cấu hình, không giả kết quả |
| 8 | Biến thể ảnh `aiVariation` | image → image | Đổi bối cảnh (tông màu)/góc (phóng 1.3×)/cận cảnh (2×) | **DEMO**: biến đổi canvas thật từ ảnh gốc, đóng dấu DEMO |
| 9 | Tạo video AI `aiVideoGen` | image → video | Mô tả chuyển động, thời lượng ≤6s, tỉ lệ | **DEMO**: WebM thật ghi bằng `canvas.captureStream` + MediaRecorder (zoom chậm). Không có MediaRecorder → lỗi rõ ràng. **Không bao giờ giả MP4** |
| 10 | Xem trước `preview` | any → any | — | Hiển thị ảnh/video/prompt + nhãn nguồn gốc trong bảng thuộc tính và thumbnail node |
| 11 | Xuất file `exportNode` | any → any | PNG/JPG/SVG/WebM | Tải file thật của kết quả; SVG chỉ khi đầu vào là SVG thật (không đổi tên raster) |
| 12 | Lưu dự án `saveProject` | any? → any | — | Gọi lưu dự án vào IndexedDB khi workflow chạy tới |

Trạng thái node: `idle/running/success/error` + log tối đa 30 dòng/node + thông báo lỗi tiếng Việt.
Thao tác canvas: kéo node, kéo dây cổng→cổng, pan, zoom (bánh xe/nút/pinch), fit, nhân bản, xóa node/dây (phím Delete hoặc nút), undo/redo snapshot (tối đa 60).
