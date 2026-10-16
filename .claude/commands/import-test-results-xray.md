---
description: "Đẩy kết quả chạy Test Automation (Playwright JSON / JUnit XML / Xray JSON) lên Jira Xray Test Management."
skills:
  - skills-jira-integration
---

# Import Test Results to Xray (Workflow Dispatcher)

Tự động đồng bộ kết quả thực thi Test Automation (Playwright, TestNG/Maven JUnit XML, Pytest JUnit XML hoặc Xray JSON) lên **Jira Xray (Cloud hoặc Server/Data Center)** để tạo mới hoặc cập nhật Test Execution.

## Inputs
- **Report File Path**: Đường dẫn file kết quả chạy test (`test-results.json`, `junit-results.xml`, hoặc `xray-payload.json`).
- **Report Format**: `playwright`, `junit`, hoặc `xray`.
- **Jira Project Key**: Mã dự án trên Jira (VD: `PROJ` — đọc từ `.env` hoặc tham số `--project`).

## Context Pointers (Lazy-Load On Demand)
- **Jira & Xray CLI Scripts Guide**: `.claude/skills/skills-jira-integration/SKILL.md`

## Execution Steps

### Bước 1: Kiểm tra Cấu hình Môi trường & Xác thực Xray
1. Đọc `.claude/skills/skills-jira-integration/SKILL.md` để nắm cách gọi bộ script trong `scripts/integrations/jira/`.
2. Kiểm tra sự tồn tại của các biến môi trường trong `.env` (không in giá trị secret ra màn hình):
   - `XRAY_PLATFORM` (`cloud` hoặc `server`)
   - **Xray Cloud**: `XRAY_CLIENT_ID`, `XRAY_CLIENT_SECRET`
   - **Xray Server / Data Center**: `JIRA_PAT` hoặc `JIRA_EMAIL` + `JIRA_API_TOKEN`
3. Nếu thư mục `scripts/integrations/node_modules` chưa tồn tại, chạy `npm --prefix scripts/integrations install`.
4. Kiểm tra kết nối xác thực:
   ```bash
   node scripts/integrations/jira/xray_auth.js --verify
   ```

### Bước 2: Kiểm tra Định dạng File Report & Quy ước Mã Test Case
1. Xác nhận file report đầu vào tồn tại và không rỗng.
2. Kiểm tra xem tiêu đề các bài test trong report đã gắn mã Jira Test Issue Key theo quy ước `[PROJ-123] Tên bài test` hay chưa để Xray ánh xạ tự động vào đúng Test Issue.

### Bước 3: Thực thi Đẩy Kết quả lên Xray
Chạy lệnh import tương ứng với định dạng báo cáo:
```bash
# Playwright JSON Report
node scripts/integrations/jira/xray_importer.js --format playwright --file <path-to-results.json> --project <PROJECT_KEY>

# JUnit XML Report (Maven Surefire / TestNG / Pytest)
node scripts/integrations/jira/xray_importer.js --format junit --file <path-to-junit.xml> --project <PROJECT_KEY>

# Xray Native JSON Payload
node scripts/integrations/jira/xray_importer.js --format xray --file <path-to-xray.json>
```

### Bước 4: Xác nhận Test Execution Key & Bàn giao
- Đọc kết quả trả về từ script để lấy mã **Test Execution Key** vừa được tạo/cập nhật trên Jira (VD: `PROJ-456`).
- Nếu gặp lỗi ánh xạ mã Test Key hoặc lỗi quyền truy cập dự án trên Xray: phân tích thông báo lỗi từ API response và hướng dẫn người dùng khắc phục cụ thể.

## Output
- Mã **Test Execution Issue Key** trên Jira Xray cùng thống kê số lượng bài test đã đồng bộ (`PASS` / `FAIL` / `SKIPPED`).
