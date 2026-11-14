# P2 Asset Licenses — nguồn hình/3D đã thẩm định

Ngày xác minh: 2026-11-09 (Asia/Tokyo). Người xác minh: Agent 1 (độc lập) + PM đối chiếu trực tiếp trang nguồn.
Giấy phép Pexels: https://www.pexels.com/license/ — dùng miễn phí kể cả thương mại, được chỉnh sửa,
không bắt buộc ghi công (dự án vẫn ghi công tự nguyện), không được hàm ý người mẫu/thương hiệu xác nhận sản phẩm,
không bán lại ảnh gốc nguyên trạng như stock.

## ĐÃ DÙNG (ảnh chụp thật, áo trống — blank garment)

| File nội bộ | Nguồn gốc | Tác giả | Giấy phép | Kiểm chứng ảnh thật | Cách dùng |
|---|---|---|---|---|---|
| public/fixtures/real-tee/crew-white-hanger.webp (800×1200, 14 KB) | https://www.pexels.com/photo/hand-holds-hanger-with-t-shirt-20669538/ | Dmitriy Steinke | Pexels License | JPEG gốc 4000×6000, EXIF, 2024-03-17; áo trắng trên móc, nền trắng, không người | Ảnh phẳng minh họa + lifestyle AIS-010/001/004/007 |
| public/fixtures/real-tee/crew-black-woman.webp (800×1200, 20 KB) | https://www.pexels.com/photo/woman-in-black-crew-neck-t-shirt-9558583/ | MART PRODUCTION | Pexels License | JPEG gốc 4000×6000, 2021-09-14; nữ mặc áo đen cổ tròn, nền studio. Agent 1 xếp NEEDS MANUAL CHECK (trang trích xuất không có EXIF, hồ sơ tác giả nhắc dataset AI) — PM đã kiểm tra thủ công: file tải về có EXIF TIFF, xem trực tiếp ảnh ở độ phân giải đầy đủ và trên bản dựng 390px: tay/nếp vải/ánh sáng là ảnh chụp thật. Người mẫu đang giữ/kéo nhẹ áo nên vùng in bị biến dạng — **chỉ dùng lifestyle, tuyệt đối không làm nền ghép hình in** | Lifestyle phụ, tab Người mặc (crew, đen). Không làm ảnh chính, không ghép hình in lên người |
| public/fixtures/real-tee/couple-white-outdoor.webp (720×900, 110 KB) | https://www.pexels.com/photo/woman-and-man-in-white-t-shirts-25462458/ | Israel Torres (EXIF: Irvin Israel Marin Torres) | Pexels License | JPEG gốc 4018×5022, 2024-06-01, Mexico City; đôi mặc áo trắng | Chỉ lifestyle cho áo đôi AIS-001 |
| public/fixtures/real-tee/crew-white-flatlay.webp (800×1200, 46 KB) | https://www.pexels.com/photo/minimalist-fashion-flat-lay-of-white-t-shirt-37704838/ | Daniel & Hannah Snipes | Pexels License | JPEG, EXIF trên trang nguồn: Canon EOS 5D Mark IV, 32mm f/2.0 ISO 100, chụp 2026-05-20, chỉnh Lightroom — Agent 1 xếp APPROVED, bằng chứng ảnh chụp mạnh nhất trong bộ | Flat-lay minh họa vải/ánh sáng. Giữ vai trò phụ (không làm hero chính) theo lựa chọn biên tập, không phải vì giấy phép |

Tất cả ảnh trên là áo **trống gốc** trong ảnh; caption trên web ghi rõ "không chứa hình in của bạn,
không phải ảnh sản phẩm đã sản xuất, người mẫu không xác nhận thương hiệu".

## BỊ LOẠI / KHÔNG DÙNG

| Nguồn | Lý do |
|---|---|
| Pexels 9558713 — nam áo trắng, MART PRODUCTION | Trang nguồn gắn thẻ teen/thiếu niên; không xác minh được người mẫu đã trưởng thành → loại khỏi mọi vị trí thương mại. Agent 1 cũng chỉ xếp NEEDS MANUAL CHECK (cùng caveat EXIF/hồ sơ tác giả như 9558583) — quyết định của PM là loại hẳn, thận trọng hơn khuyến nghị tối thiểu |
| Unsplash search `blank-t--shirt` | Trang tìm kiếm không phải giấy phép cho từng ảnh (trộn cả Unsplash+, render 3D và iStock premium); trang license của Unsplash cũng không fetch trực tiếp được trong môi trường kiểm chứng của Agent 1, chỉ đọc qua nguồn thứ cấp → không tải bất kỳ ảnh Unsplash nào trong P2 |
| Sketchfab oversized t-shirt `3b6e78d6...` | Trang báo "Model deleted" khi truy cập 2026-11-09 → không có nguồn hợp lệ |
| Sketchfab BINARYCLOTH men regular `4d055bb8...` | **Giấy phép ĐÃ xác minh qua Sketchfab API v3 (Agent 3, 2026-11-09): CC BY 4.0** — credit BINARYCLOTH (@binaryclothofficial), thương mại được phép, downloadable, GLB 2K 4,44 MB / 4K 20,4 MB, 15k verts, PBR + normal map. **Vẫn chưa nhúng trong P2** vì lý do kỹ thuật (không phải giấy phép): UV toàn thân 1 material không khớp 2 canvas trước/sau của Studio — cần decal/planar projection riêng + nén Draco/KTX2 về ~0,9–1,5 MB + QA vị trí artwork. Là ứng viên pilot P2.3 đợt sau; khi tải phải lưu trữ bằng chứng license API tại thời điểm tải (tác giả có thể đổi license sau, bản đã nhận vẫn có hiệu lực theo Sketchfab Help). Chỉ hợp phom nam regular — không đại diện oversize/polo. |
| MediaLoot free tee PSD | Loại: Free License mâu thuẫn nội bộ — một bản giới hạn single-application, cấm dùng cho thiết kế phân phối nhiều người và cấm phân phối lại; bản khác lại nói khác khi có attribution. Không rõ ràng = không dùng cho e-commerce phục vụ nhiều khách |
| FreeMockupWorld PSD | Loại: trang ghi free commercial nhưng Terms lại cấm khai thác thương mại khi chưa có đồng ý văn bản, kèm disclaimer tài liệu 'được cho là public domain' — nguồn gốc không xác minh được |
| MockupWorld.co | Chỉ là aggregator, tự nó không cấp phép; FAQ yêu cầu kiểm tra license của từng creator ở link ngoài — không trích dẫn làm nguồn license |
| github.com/EdgeXGroups/EDGE-Website | Repo không có LICENSE → all rights reserved: không copy code/GLB. Ghi nhận lead: tee.glb của họ suy từ 'fish t-shirt' của Gleb Gubkin (Sketchfab, CC BY 4.0 theo ghi chú của họ) và nén Draco 30 MB → ~0,9 MB — ứng viên tương lai, phải tự xác minh qua Sketchfab API trước khi dùng, ghi công Gleb Gubkin |
| github.com/FrancescoCastaldi/mini-jersey-studio | MIT (ghi nhận), nhưng là áo đua xe đạp, tạo 2026-08; chỉ tham khảo ý tưởng planar UV projection, **không copy code/model/asset** |

## Vẫn giữ từ P0/P1

- 2 motion Hồ núi / Lá bài: MIT của Amir Mušić, xem `LICENSE-ASSETS.md` — giữ nguyên, vẫn ghi "concept, không phải ảnh sản phẩm đã sản xuất".
- 55 SVG artwork gốc của dự án: MIT dự án, xem `docs/ASSET_LICENSES.md`.
- Renderer mockup (P2 nâng cấp): tự biên soạn, không asset ngoài.

## P3.1 additions (2026-11-09, PM-verified visually)

| File | Source | Author | Role |
|---|---|---|---|
| public/fixtures/real-tee/crew-black-hanger.webp | Pexels photo 8532616 | Hanna Pad | Crew black FRONT hanger — compositing base GAR-CREW-BLK-HANGER-01 (calibrated) |
| public/fixtures/real-tee/crew-black-collar-detail.webp | Pexels photo 8532638 | Hanna Pad | Crew black collar close-up — detail only (same shoot as 8532616; NOT a back view) |
| public/fixtures/real-tee/crew-white-shoulder-detail.webp | Pexels photo 30710033 | Luis Quintero | Worn white jersey shoulder close-up — detail only, not a flat fabric swatch |

All three: Pexels License (free commercial use, attribution not required, given anyway). PM viewed the actual images on 2026-11-09: blank garments, no logos/prints. Rejected in the same round: 8148576 (boxy cropped fit, hand in frame), 19041040 (black-and-white, subject too distant). Generated thumbnails in public/mockups/thumbs/ are derivatives of the project's own mockup renders.

## P3.2 ảnh mở đầu

- `public/fixtures/real-tee/rack-neutral-ron-lach.webp`: ảnh giá áo trơn của Ron Lach, [Pexels 9594682](https://www.pexels.com/photo/white-and-brown-clothes-hanging-on-gray-metal-rack-9594682/), Pexels License, tải và xem ảnh 2026-11-09. Dùng làm ảnh không khí tham khảo, không đại diện sản phẩm thực tế hoặc dùng làm nền in.

## AI Studio P4.2 additions (2026-11-14)

| File | Nguồn | Tác giả | Giấy phép | Ghi chú |
|---|---|---|---|---|
| public/fixtures/real-tee/crew-white-vn-model.webp (960×1200, ~33 KB) | https://www.pexels.com/photo/portrait-of-asian-woman-25471921/ | quang vinh | Pexels License | **Ảnh nền người mẫu DUY NHẤT của AI Studio sau đợt bổ sung P4.2.** Tải bản 1600×2400 qua images.pexels.com (gốc 2000×3000), crop 4:5 từ phía trên (1600×2000), resize 960×1200 WebP. Người mẫu nữ VIỆT NAM trưởng thành rõ ràng (tác giả Việt Nam, thẻ nguồn "Vietnamese Girl"), MẶC áo thun trắng cổ tròn TRƠN (không in/logo/chữ), chụp chính diện nhìn thẳng camera, ngực trống hoàn toàn không bị tóc/tay che (đã tải về và xem trực tiếp từng pixel trước khi nhận). Dùng làm ảnh nền tham chiếu DEMO + nền ghép "Ảnh mẫu thật" trong AI Studio (PHOTO_BASES trong src/ai-studio/core.js; quad ngực hiệu chuẩn theo cổ áo đo trên ảnh fixture: mép dưới cổ y≈0.64, tâm ngực x≈0.40). |

Ảnh Pexels 10159280 (ROMAN ODINTSOV, file cũ `crew-white-model.webp`): đã dùng làm nền người mẫu trắng ở P4.2 vòng 1, nhưng người mẫu KHÔNG phải người châu Á — theo lệnh bản địa hoá của chủ dự án (mọi ảnh người mẫu trong AI Studio phải là người Việt Nam/châu Á) ảnh đã bị GỠ khỏi PHOTO_BASES/GARMENT_QUADS và file fixture đã xoá khỏi repo ở đợt bổ sung P4.2. Không dùng lại làm nền người mẫu.

Ảnh Pexels 9558583 (crew-black-woman.webp, MART PRODUCTION — đã ghi ở bảng P2 phía trên): **ngoại lệ AI Studio của vòng 1 bị THU HỒI.** Ở vòng 1 ảnh từng được dùng làm nền tham chiếu DEMO cho áo đen với lý do "người mẫu cầm áo căng phẳng"; chủ dự án đã bác bỏ (áo cầm tay ≠ áo đang mặc) và ghi chú P2 gốc của ảnh vốn là "chỉ dùng lifestyle, tuyệt đối không làm nền ghép hình in". Từ đợt bổ sung P4.2: ảnh KHÔNG còn là nền ghép trong AI Studio (đã gỡ khỏi PHOTO_BASES và GARMENT_QUADS); phía CỬA HÀNG vẫn giữ nguyên cách dùng lifestyle như ghi chú P2. Sau tìm kiếm Pexels diện rộng (16+ góc truy vấn, xem trực tiếp mọi ứng viên), KHÔNG tìm được ảnh đã thẩm định của người mẫu châu Á MẶC áo thun đen cổ tròn trơn chính diện — DEMO áo đen dùng hình vẽ canvas với nhãn trung thực "chưa có ảnh chụp thật đã kiểm chứng", nền ghép thật cho áo đen là ảnh móc treo đen đã hiệu chuẩn (8532616). Tương tự, KHÔNG tìm được ảnh oversize trơn trên người mẫu châu Á đã thẩm định — DEMO oversize dùng hình vẽ phom rộng, tuyệt đối không lấy áo thường + in to hơn giả làm oversize.
