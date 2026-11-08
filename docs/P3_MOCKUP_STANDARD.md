# P3 Mockup Standard — chuẩn ghép artwork lên ảnh áo thật

Phiên bản renderer: `p3-engine-1` (`src/mockup-engine/engine.js`).

## Pipeline

1. **Base**: chỉ ảnh áo KHÔNG người mặc (móc treo/phẳng) có `status=APPROVED`, `sourceStatus=APPROVED`, `compositing.allowed=true` trong `data/garments.json`. Ảnh người mặc không bao giờ là base (AGENTS.md).
2. **Vùng in theo từng ảnh**: quad 4 điểm theo tỉ lệ ảnh (TL, TR, BR, BL), hiệu chuẩn thủ công bằng mắt + kiểm chứng bằng ảnh render thử. Quad phải lồi và nằm trong khung (test `validateQuad`).
3. **Warp**: mesh tam giác 10×10, biến đổi affine từng tam giác; clip từng tam giác được mở rộng ~1,8px quanh trọng tâm để khử đường kẻ lưới do khử răng cưa trên canvas trong suốt.
4. **Shading**: nhân vô hướng theo độ sáng (luminance) của chính ảnh áo lên từng pixel artwork trong vùng in (`shadingStrength` theo hiệu chuẩn từng áo, mặc định 0,35). Giữ nguyên hue và alpha của artwork; KHÔNG dùng composite `multiply` của canvas (làm đục vùng trong suốt).
5. **Mask**: clip artwork theo polygon silhouettte thân áo — hình in không được tràn khỏi áo.
6. **Xuất**: WebP 0,85 cho web; manifest ghi sha256, kích thước, độ lệch bao phủ (fidelity) cho từng mockup.
7. **Cache**: khóa = rendererVersion + garmentId + view + variant + artworkHash (FNV-1a của file SVG). Tổ hợp chưa đổi thì không dựng lại (đã kiểm chứng: chạy lại generator cho kết quả CACHED).

## Fidelity (trung thực artwork)

- Đo: tỉ lệ pixel có alpha>10 của artwork gốc (render trong khung vùng in) so với lớp artwork sau warp trong cùng khung. Ngưỡng đạt: độ lệch ≤ 0,15. Lô pilot: 0,002–0,017.
- Chữ tiếng Việt: chữ được vẽ bằng Canvas `fillText` từ đúng chuỗi gốc — không có bước AI tái tạo, nên không thể sai chính tả/dấu. Test chữ "CÀ PHÊ RỒI TÍNH" đạt Δcoverage 0,002 và kiểm tra bằng mắt: dấu đúng.
- File in sản xuất (print export) không đi qua engine này: Studio vẫn xuất artwork sạch, không shading (quy tắc P2 giữ nguyên).

## Giới hạn đã biết

- Warp là phối cảnh hai tuyến tính theo quad + shading theo luminance; chưa có displacement map theo nếp vải thực (đánh dấu là hướng nâng cấp khi có dữ liệu độ sâu/nếp gấp đáng tin cậy).
- Hiện mới hiệu chuẩn mặt trước cho 1 base (crew trắng). Mặt sau và các phom khác chờ ảnh nguồn APPROVED.
- Mockup dựng sẵn chỉ mô tả THIẾT KẾ MẶC ĐỊNH của mẫu; khi khách cá nhân hóa, giao diện quay về renderer P2 (đã có test khóa hành vi này).
