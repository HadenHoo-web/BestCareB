# Phase 3 — AI Content & Campaign Manager

## Hoàn thành

- Tạo nội dung tiếng Việt theo chủ đề, sản phẩm/dịch vụ, giọng văn và độ dài.
- Chế độ demo cục bộ hoạt động khi chưa cấu hình OpenAI; không dùng dữ liệu mẫu để mô tả dữ liệu đã lưu.
- Lưu API key vào credential store/keychain của hệ điều hành. API key không vào SQLite, frontend storage hoặc log.
- Request OpenAI chỉ được gửi từ backend native khi người dùng chủ động tạo nội dung sau khi đã cấu hình key.
- Tạo, lưu, xem và xóa nội dung trong thư viện.
- Tạo chiến dịch từ nhóm và nội dung đã chọn; mỗi Group được tạo một campaign post ở trạng thái `DRAFT`.
- Luồng trạng thái được backend bắt buộc: `DRAFT → READY → REVIEWED → OPENED → USER_CONFIRMED → COMPLETED`.
- Group chỉ được mở trong trình duyệt khi người dùng bấm nút ở bước `REVIEWED`; mở Group không tự đánh dấu là đăng thành công.

## Giới hạn hiện tại

- Tích hợp OpenAI trả về một bản văn bản cho mỗi lần gọi API; giao diện không tự động đăng lên Facebook.
- Upload/quản lý file media và PublishProvider OAuth cho Fanpage thuộc phần mở rộng tiếp theo.
- Giao diện có thể chuyển trạng thái tuần tự, nhưng chưa có trường nhập URL bài đã đăng hoặc ghi chú riêng cho từng campaign post.

## Nguồn kỹ thuật

Tích hợp dùng Responses API từ backend native. Theo [API Overview của OpenAI](https://developers.openai.com/api/reference/overview), Responses API dùng cho yêu cầu model trực tiếp và API key là bí mật, không được đặt trong code phía client; vì vậy khóa chỉ nằm trong kho bảo mật của hệ điều hành và không được ghi ra database hay log.
