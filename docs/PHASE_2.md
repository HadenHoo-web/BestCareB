# Phase 2 — Account & Group Manager

## Hoàn thành

- CRUD tài khoản Facebook với tên, ghi chú và trạng thái kết nối do người dùng xác nhận.
- Tìm kiếm tài khoản theo tên hoặc ghi chú; chọn và xóa nhiều dòng.
- CRUD Facebook Group với URL, tên, mô tả, chủ đề, quy định, loại quảng cáo và đánh dấu yêu thích.
- Chuẩn hóa URL thành `https://www.facebook.com/groups/{id}` khi có thể; chỉ chấp nhận HTTPS Facebook Group URLs.
- Unique constraint trong SQLite và import transaction để loại URL trùng.
- Nhập CSV tối đa 1.000 dòng; các dòng URL sai, giá trị không hợp lệ hoặc đã có được báo vào số lượng bỏ qua.
- Xuất CSV cho trang nhóm đang hiển thị.
- Mở Group qua trình duyệt mặc định sau khi người dùng bấm nút mở.
- Activity log được ghi cho thêm/sửa/xóa/nhập dữ liệu.

## Mẫu CSV

Header bắt buộc: `url`. Các cột được nhận diện thêm: `name`, `description`, `topic`, `rules`, `advertising`, `favorite`.

`advertising` chỉ nhận `unknown`, `allowed`, hoặc `prohibited`; `favorite` nhận `true` hoặc `1`. CSV dùng dấu phẩy và hỗ trợ ô có dấu nháy kép theo RFC 4180 ở mức cơ bản.

## Ranh giới chức năng

- Không thu thập mật khẩu, cookie, access token hoặc mã 2FA.
- Không tự đăng, tự vào nhóm, quét group hàng loạt hay xử lý CAPTCHA/checkpoint.
- Ảnh đại diện tài khoản và liên kết account-group sẽ được bổ sung sau khi luồng quản lý file và membership được thiết kế đầy đủ.
