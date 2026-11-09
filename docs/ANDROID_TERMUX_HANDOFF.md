# BÀN GIAO GIT BUNDLE QUA ANDROID TERMUX — QUY TẮC BẮT BUỘC

Áp dụng cho mọi giai đoạn (P3.1, P3.2, P4, …) của repository
`https://github.com/bohoa96tb/ao-in-studio-demo`.

Môi trường của chủ repo: điện thoại Android + Termux (đã cài Git, GitHub CLI,
đã đăng nhập GitHub). Repo đã clone tại `~/ao-in-studio-demo`. Bundle tải về
`~/storage/downloads/`. **Không bao giờ yêu cầu PAT/mật khẩu/token trong chat.**
Muse trên VM không push được file nhị phân qua connector GitHub (chỉ nhận
file văn bản UTF-8, không giữ lịch sử Git) — vì vậy bàn giao bằng Git bundle.

## 1. Tên file bundle chuẩn

`ao-in-pXX.bundle` — không dấu tiếng Việt, không khoảng trắng, không ký tự
đặc biệt. Ví dụ: P3.1 → `ao-in-p31.bundle`, P3.2 → `ao-in-p32.bundle`,
P4 → `ao-in-p4.bundle`, P4.1 → `ao-in-p41.bundle`.
Tên file tải xuống phải trùng **chính xác** tên file trong lệnh Termux.

## 2. Khối lệnh Termux hoàn chỉnh (một khối Bash duy nhất)

Tự thay đúng tên bundle và tên nhánh thực tế. Không placeholder, không chú
thích trong khối lệnh. Người dùng sao chép một lần, dán, Enter:

```
cd ~/ao-in-studio-demo

git fetch origin main

git fetch ~/storage/downloads/<TÊN-BUNDLE> "refs/heads/<TÊN-NHÁNH>:refs/heads/<TÊN-NHÁNH>"

git push -u origin <TÊN-NHÁNH>
```

## 3. Kiểm tra bắt buộc trước khi bàn giao

1. Bundle chứa đầy đủ commit + file nhị phân của nhánh.
2. `git bundle verify` phải OK.
3. Xác minh commit cuối, commit gốc (base) và lịch sử Git của nhánh.
4. Tính SHA-256 và dung lượng bundle; ghi vào báo cáo.
5. Tên file khớp tuyệt đối với lệnh Termux.
6. Kiểm tra `main` hiện tại trên GitHub: nếu `main` đã đổi sau khi tạo
   bundle, phải cảnh báo và kiểm tra tương thích (base còn là ancestor?)
   trước khi hướng dẫn push. Không force-push, không tự rebase làm mất commit.
7. Không yêu cầu người dùng chạy thêm lệnh Git không cần thiết.

## 4. Định dạng báo cáo bàn giao (đúng các mục)

- **A. Đã hoàn thành** — nội dung thay đổi, chức năng mới, kết quả QA,
  những phần chưa đạt.
- **B. Thông tin Git** — repository, tên nhánh, commit cuối, commit gốc,
  tên bundle, dung lượng + SHA-256.
- **C. Tải file** — đính kèm file `.bundle` đúng tên chuẩn, tải trực tiếp
  được về điện thoại.
- **D. LỆNH TERMUX — SAO CHÉP MỘT LẦN** — một khối Bash duy nhất, không
  chia nhỏ, không chú thích, không placeholder.
- **E. Sau khi push** — hướng dẫn người dùng gửi lại kết quả `git push`;
  Muse dùng connector tạo PR, theo dõi GitHub Actions, báo lỗi nếu có;
  **không tự merge PR khi chưa có phê duyệt áp dụng cho PR đó.**

## 5. Mục tiêu

Người dùng chỉ cần: tải bundle về thư mục Download → mở Termux → sao chép
một khối lệnh → dán → Enter. Không đổi tên file thủ công, không sửa đường
dẫn, không tự thay tên nhánh.
