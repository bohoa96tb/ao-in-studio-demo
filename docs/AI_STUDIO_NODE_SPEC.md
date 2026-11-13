# AI Studio — Node Spec (P1 + bổ sung P2/P3)

Cổng vào nhận tối đa 1 dây. Tương thích kiểu: giống nhau, hoặc bất kỳ phía nào là `any`, hoặc `design → image`. Màu theo nhóm: Input xanh lá/xanh dương/tím · Processing terracotta/vàng · AI hồng/tím · Output xám.

| # | Node (type) | Vào → Ra | Cấu hình | Hành vi thật trong P1 |
|---|---|---|---|---|
| 1 | Ảnh đầu vào `imageInput` | — → image | Ảnh có sẵn (4 fixture ảnh thật của shop) hoặc tải PNG/JPG/WebP (nhiều file, lưu IndexedDB, chọn file đang dùng) | Trả blob ảnh thật |
| 2 | Hình in `designInput` | — → design | Tải PNG/SVG; nút hình in mẫu | SVG qua kiểm tra an toàn (chặn script/on*/javascript:/foreignObject/ảnh ngoài). Giữ nguyên file gốc |
| 3 | Prompt `promptInput` | — → prompt | Text tiếng Việt + 3 mẫu prompt | Trả text |
| 4 | Trợ lý prompt (quy tắc) `promptAssistant` | prompt? → prompt | Phong cách/Người mẫu/Bối cảnh/Ánh sáng/Góc chụp + bổ sung | Ghép prompt bằng **quy tắc** (không phải AI), kết quả sửa tay được, luôn kèm câu giữ nguyên hình in gốc |
| 5 | Ghép hình in lên áo `composition` | image? + design → image | Ảnh nền dự phòng; **P3:** chế độ phối cảnh (quad 4 điểm kéo-thả + ô số %, cong nếp vải %, bóng vải %) hoặc chế độ đơn giản P1 (X/Y/rộng %, xoay) | Canvas: warp **pixel hình in gốc** bằng homography thật lên quad (lưới 20×20) + dịch chuyển theo độ sáng nếp vải + nhân bóng vải; khung vùng in an toàn đứt nét theo quad. Cấu hình P1 tự di trú sang quad tương đương |
| 5b | Nền & bối cảnh `background` **(P3)** | image → image | Kiểu nền (trơn/gradient/studio/ảnh riêng), màu + preset, chân trời %, bóng %, vignette %, tỉ lệ/vị trí chủ thể, ảnh nền riêng + mờ | Canvas thủ tục hoàn toàn (không ảnh ngoài). Ảnh vào có alpha → đặt trực tiếp; không alpha → đặt dạng **khung ảnh** + nhãn ghi rõ (không tách nền giả). Giữ nguyên kích thước đầu vào |
| 6 | Chỉnh sửa ảnh `imageEditor` | image → image | Cắt %, xoay, resize px, sáng, tương phản | Canvas API + `ctx.filter` — thật |
| 7 | Tạo ảnh AI `aiImageGen` | prompt? + image? → image | Tỉ lệ 4:5/1:1/9:16/16:9, số lượng (P1 tạo 1) | **DEMO**: canvas suy biến từ ảnh tham chiếu + đóng dấu "ẢNH DEMO — chưa kết nối AI". Provider HTTP: báo lỗi cấu hình, không giả kết quả |
| 8 | Biến thể ảnh `aiVariation` | image → image | Đổi bối cảnh (tông màu)/góc (phóng 1.3×)/cận cảnh (2×) | **DEMO**: biến đổi canvas thật từ ảnh gốc, đóng dấu DEMO |
| 9 | Tạo video AI `aiVideoGen` | image → video | Mô tả chuyển động, thời lượng ≤6s, tỉ lệ | **DEMO**: WebM thật ghi bằng `canvas.captureStream` + MediaRecorder (zoom chậm). Không có MediaRecorder → lỗi rõ ràng. **Không bao giờ giả MP4** |
| 10 | Xem trước `preview` | any → any | — | Hiển thị ảnh/video/prompt + nhãn nguồn gốc trong bảng thuộc tính và thumbnail node |
| 11 | Xuất file `exportNode` | any → any | PNG/JPG/SVG/WebM; **P3:** đa chọn kênh (Website 1200×1500 + vuông 2000×2000, Facebook 1080×1080 + ngang 1200×630, TikTok 1080×1920, Shopee 1024×1024), chất lượng JPG, tiền tố tên file | Tải file thật của kết quả; SVG chỉ khi đầu vào là SVG thật (không đổi tên raster). Có chọn kênh → mỗi kênh 1 file riêng theo đúng pixel (cắt phủ khung hoặc vừa khung + nền trắng), tải từng file, ZIP chứa đủ file kênh |
| 12 | Lưu dự án `saveProject` | any? → any | — | Gọi lưu dự án vào IndexedDB khi workflow chạy tới |

Trạng thái node: `idle/running/success/error` + log tối đa 30 dòng/node + thông báo lỗi tiếng Việt.
**P2 bổ sung:** trạng thái `cached` (kết quả lấy từ bộ nhớ đệm vì cấu hình + đầu vào không đổi — mọi node trừ `preview`/`exportNode`/`saveProject`); thời lượng chạy + số lần thử ghi cho từng node; node nhóm AI được thử lại mặc định 1 lần khi lỗi; mọi node có timeout mặc định 60s (cấu hình ở "Cài đặt chạy" trong bảng thuộc tính khi chưa chọn node). Trước mỗi lượt chạy, toàn bộ workflow được kiểm tra (nối dây + nội dung) — có vấn đề thì không chạy và hiện danh sách.
Thao tác canvas: kéo node, kéo dây cổng→cổng, pan, zoom (bánh xe/nút/pinch), fit, nhân bản, xóa node/dây (phím Delete hoặc nút), undo/redo snapshot (tối đa 60).

**P3 bổ sung:** node `composition` có thêm trạng thái cấu hình `mode: perspective|simple`, `quad` (4 điểm 0..1), `wrinkle` (0–100), `shading` (0–100) — mọi trường đều vào khóa đệm P2. Tổng số loại node: **13**.
