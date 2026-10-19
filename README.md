# FB Manager AI

Ứng dụng desktop local-first cho macOS và Windows. **Bản Foundation / Phase 1**; chưa phải sản phẩm đầy đủ.

## Chạy development

Yêu cầu Node.js 20.19+ (khuyến nghị Node 22 LTS), npm, Rust stable và công cụ build hệ điều hành. Xem [macOS](SETUP_MAC.md) hoặc [Windows](SETUP_WINDOWS.md).

```sh
npm ci
npm run tauri dev
```

Máy hiện tại dùng Rust cài riêng trong dự án. Trước lệnh Tauri, chạy:

```sh
export CARGO_HOME="$PWD/.toolchain/cargo"
export RUSTUP_HOME="$PWD/.toolchain/rustup"
export PATH="$CARGO_HOME/bin:$PATH"
npm run tauri dev
```

`npm run dev` chỉ mở bản xem trước web ở http://localhost:1420. Bản web không có SQLite, không có số liệu giả và không lưu thiết lập giao diện.

## Phạm vi đã triển khai

- Tauri 2, React + TypeScript + Vite, Tailwind, button theo kiến trúc shadcn/ui, Zustand và HashRouter.
- Sidebar 8 mục, dashboard, cài đặt, lịch sử và màn hình chờ cho các module tương lai.
- Giao diện sáng/tối, trạng thái loading/error/empty, toast; lưu theme qua SQLite trong bản desktop.
- Backend Rust sử dụng rusqlite bundled: database tại app data directory; migration version 1 trong transaction, khóa ngoại và constraints.
- 10 bảng theo yêu cầu. Frontend chỉ được gọi ba command cụ thể, không chạy SQL tự do.
- Dashboard đọc số liệu thật từ database; không seed dữ liệu mẫu.

## Chưa triển khai

Phase 2: CRUD tài khoản/nhóm, CSV, chuẩn hóa URL, tìm kiếm/lọc, bảng lớn.
Phase 3: OpenAI và kho API key của hệ điều hành, AI demo, media, nội dung, chiến dịch, PublishProvider và luồng xác nhận đăng.
Phase 4: backup/restore, updater, GitHub Actions/Release, ký mã, notarization và installer được kiểm chứng đa nền tảng.

Không có tự động đăng Facebook, thu thập thông tin đăng nhập hoặc đọc phiên trình duyệt. Các nút tính năng chưa hỗ trợ bị vô hiệu hóa hoặc màn hình ghi rõ phase dự kiến.

## Kiểm tra

```sh
npm run typecheck
npm run lint
npm test
npm run build
python3 tests/test_schema.py
cargo test --manifest-path src-tauri/Cargo.toml
```

Các bài test frontend dùng service giả để kiểm tra xử lý lỗi; không được coi là bằng chứng SQLite desktop. Tests Python kiểm tra schema SQLite thật, còn Rust test kiểm tra migration và đọc lại thiết lập từ file.

## Build

Trên macOS:

```sh
rustup target add aarch64-apple-darwin x86_64-apple-darwin
npm run tauri build -- --target aarch64-apple-darwin --bundles app,dmg
npm run tauri build -- --target x86_64-apple-darwin --bundles app,dmg
```

Trên Windows (Visual Studio Build Tools C++, Windows SDK, WebView2):

```powershell
npm run tauri build -- --target x86_64-pc-windows-msvc --bundles nsis
# MSI cần đầy đủ môi trường WiX trên Windows
npm run tauri build -- --target x86_64-pc-windows-msvc --bundles msi
```

Đây là lệnh build mục tiêu, không phải khẳng định installer Windows/Intel đã được kiểm chứng. Không build MSI từ macOS.

## Cấu trúc

`src/app` routing và theme; `src/layouts` desktop shell; `src/modules` màn hình nghiệp vụ; `src/components/ui` primitive UI; `src/services` IPC; `src/stores` Zustand; `src/types` hợp đồng dữ liệu; `src-tauri/src` Rust; `src-tauri/migrations` SQL; `tests` kiểm thử; `docs` tiến độ và danh sách file.

Xem [báo cáo Phase 1](docs/PHASE_1.md) và [danh sách file](docs/FILES.md).
# BestCareB
