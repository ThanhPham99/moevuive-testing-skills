---
description: Sinh bug report chuẩn từ test FAIL — thu thập evidence, viết steps to reproduce, phân loại severity/priority, cập nhật docs/bugs/README.md và tùy chọn đẩy lên Jira.
skills:
  - skills-bug-reporter
---

# Workflow: Tạo Bug Report Từ Test FAIL (`/create-bug-report`)

> **Context Pointer:** Nạp và thực thi theo [`.claude/skills/skills-bug-reporter/SKILL.md`](../skills/skills-bug-reporter/SKILL.md). Khi user yêu cầu đẩy bug lên Jira, nạp thêm [`skills-jira-integration`](../skills/skills-jira-integration/SKILL.md).

## 1. Input Cần Thu Thập

| Input | Bắt buộc? | Ghi chú |
|---|---|---|
| **Thông tin Test FAIL** | ⭐ Bắt buộc | File test + error log, báo cáo `execution_report.md`, hoặc mô tả lỗi manual TC |
| **Requirement (`REQ ID`)** | Khuyến nghị | Căn cứ xác định Expected Result và khoanh vùng regression khi retest |
| **Môi trường & Build/Version** | ⭐ Bắt buộc | Env, trình duyệt, tài khoản test, và `Build / Version` phát hiện lỗi |

## 2. Các Bước Thực Hiện

### Bước 1: Thu thập bằng chứng & Tái hiện lỗi
1. Đọc log lỗi, screenshot có sẵn và dữ liệu test đã dùng.
2. Tái hiện lỗi ít nhất 1 lần (chạy lại test hoặc thao tác qua Playwright MCP ở **Headless Mode** `1920x1080` mặc định; nếu cần quan sát trực tiếp thì bật `/browser-mode headed`).
3. Nếu lỗi không tái hiện được và có dấu hiệu chập chờn → dừng báo bug, đề xuất chạy `/analyze-flaky-tests`.

### Bước 2: Cô lập Steps & Phân loại Severity / Priority
1. Rút gọn `Steps to Reproduce` về các bước tối giản, rõ ràng.
2. Đối chiếu `Expected Result` (theo `REQ ID`) và `Actual Result` (quan sát thực tế).
3. Phân loại `Severity` (`🔴 Critical` / `🟠 Major` / `🟡 Minor` / `🟢 Trivial`) và `Priority` (`P1` / `P2` / `P3`) theo bảng chuẩn trong `skills-bug-reporter`.

### Bước 3: Xuất File Bug & Cập Nhật Danh Mục (⏸️ HITL Checkpoint)
1. Ghi file `docs/bugs/<module>/BUG_<module>_<timestamp>_<TC_ID>.md` theo đúng **Bug Report Template** trong `skills-bug-reporter` (bao gồm đường dẫn ảnh Markdown `[tên.png](path)` cho `bugs-viewer` và bảng `## Lịch sử retest` rỗng ở cuối file).
2. Cập nhật hoặc khởi tạo `docs/bugs/README.md` theo đúng **Template Danh Mục** (giữ nguyên hai cột bắt buộc `Mã bug` và `Trạng thái`).
3. **⏸️ DỪNG LẠI** trình bày cho user xác nhận nội dung và hỏi xem có cần đẩy ticket lên Jira không.

### Bước 4: Đồng bộ lên Jira (Tùy chọn khi user xác nhận)
- Sử dụng `skills-jira-integration` để tạo issue Jira kèm đính kèm evidence.
