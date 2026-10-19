# Cài đặt trên macOS

1. Cài Xcode Command Line Tools: `xcode-select --install`.
2. Cài Node.js 22 LTS và Rust stable từ https://rustup.rs. Mở terminal mới sau khi cài.
3. Kiểm tra `node --version`, `npm --version`, `rustc --version`, `cargo --version`.
4. Trong thư mục dự án: `npm ci`, sau đó `npm run tauri dev`.

## Máy đang phát triển

Rust đã được cài riêng ở `.toolchain` để không thay đổi PATH toàn hệ thống. Mỗi terminal mới cần:

```sh
cd /Users/hoquochuy/Desktop/BestCareB
export CARGO_HOME="$PWD/.toolchain/cargo"
export RUSTUP_HOME="$PWD/.toolchain/rustup"
export PATH="$CARGO_HOME/bin:$PATH"
npm run tauri dev
```

## Dữ liệu

SQLite được tạo ở thư mục app data của Tauri cho identifier `com.fbmanagerai.desktop`, thông thường `~/Library/Application Support/com.fbmanagerai.desktop/fb-manager-ai.sqlite`. Đường dẫn chính xác hiển thị trong Cài đặt. Không sửa/xóa database khi ứng dụng đang chạy. Không có chức năng backup/restore tự động ở Phase 1.

Đổi giao diện, đóng ứng dụng rồi mở lại để kiểm tra lưu thiết lập. Bản trình duyệt không kiểm tra được SQLite.

## Build

```sh
rustup target add aarch64-apple-darwin x86_64-apple-darwin
npm run tauri build -- --target aarch64-apple-darwin --bundles app,dmg
npm run tauri build -- --target x86_64-apple-darwin --bundles app,dmg
```

Bản phát hành công khai cần cấu hình chứng chỉ Apple và notarization ở Phase 4. Không bỏ qua cơ chế bảo vệ hệ điều hành.
