# Phase 1 — Foundation

## Đã hoàn thành

- Ứng dụng desktop Tauri 2 dùng React, TypeScript, Vite, Tailwind và Zustand.
- Layout desktop tiếng Việt với sidebar 8 khu vực, breadcrumb, trạng thái tải/lỗi/trống và giao diện sáng/tối.
- Dashboard chỉ đọc số liệu thật từ SQLite; không chèn dữ liệu minh hoạ.
- SQLite cục bộ, migration có version, 10 bảng yêu cầu, foreign keys, unique constraints và indexes.
- IPC chỉ cung cấp các thao tác đọc tổng quan, đọc activity log và lưu giao diện; giao diện không thể thực thi SQL tuỳ ý.
- Capability Tauri chỉ cấp quyền lõi cho cửa sổ chính. Không cấp quyền file, shell, HTTP hay browser plugin.
- Icon ứng dụng macOS/Windows, README và hướng dẫn cài đặt macOS/Windows.

## Xác minh trong phiên phát triển

- `npm run typecheck`, `npm run lint`, `npm test` và `npm run build` đều hoàn tất thành công.
- Kiểm thử schema SQLite: 4 bài kiểm tra thành công.
- Kiểm thử Rust migration/persistence: 2 bài kiểm tra thành công.
- Ứng dụng desktop đã khởi tạo database thật ở app data directory: schema version 1, 10 bảng, theme `light`.

## Chưa hoàn thành

- CRUD tài khoản/nhóm; import/export CSV; tìm kiếm, lọc và bảng virtualized.
- AI/OpenAI, kho khoá hệ điều hành, nội dung/media, campaign và luồng xác nhận đăng.
- Backup/restore, updater, CI GitHub Actions, release, code signing và notarization.
- Build và kiểm chứng installer Windows/Intel macOS.

Các mục chưa hoàn thành đều được ghi rõ trong giao diện; ứng dụng không mô tả chúng là đã hoạt động.
