---
description: "Chuyển đổi danh sách Test Cases thủ công (Markdown/Excel/CSV) thành mã nguồn kiểm thử tự động hóa (Automation Test Scripts) theo chuẩn POM."
skills:
  - skills-qa-automation-engineer
  - skills-smart-locator-agent
---

# Generate Automation from Test Cases (Workflow Dispatcher)

Chuyển đổi bộ Test Cases thủ công (`test_cases_<module>.md` hoặc CSV/Excel) thành code Automation chuẩn Page Object Model (POM) — kết hợp quét DOM thực tế để lấy locator chính xác và chạy kiểm chứng tự động.

## Inputs & Modes
- **Test Cases Source**: Đường dẫn file `docs/testcases/_<hệ-thống>/<module>/test_cases_<module>.md` (hoặc danh sách ID cụ thể: `TC_AUTH_001..TC_AUTH_010`, hoặc theo độ ưu tiên `High`/`Critical`).
- **Target URL / Environment** *(Khuyên dùng)*: URL ứng dụng + tài khoản test để lấy DOM thật và chạy kiểm chứng.
- **Mode**:
  - `GENERATE`: Sinh code Page Objects, Test Data và Test Scripts từ tài liệu test cases + DOM/Page Objects sẵn có.
  - `PIPELINE` (Mặc định khi có Target URL): Quét DOM thật lấy locators -> Sinh code POM + Tests -> Chạy thực thi kiểm chứng -> Tự động sửa lỗi (Self-Healing tối đa 3 vòng).

## Context Pointers (Lazy-Load On Demand)
- **4-Phase Automation Lifecycle & Coding Standards**: `.claude/skills/skills-qa-automation-engineer/SKILL.md`
- **Resilient Locator Hierarchy**: `.claude/skills/skills-smart-locator-agent/SKILL.md`
- **Browser DOM Inspection**: `.claude/skills/skills-ui-debug-agent/SKILL.md`
- **Stack Templates (Chỉ đọc đúng 1 file khớp với stack dự án)**:
  - Playwright TS: `.claude/skills/skills-framework-architect/references/TEMPLATES_PLAYWRIGHT_TS.md`
  - Playwright Java: `.claude/skills/skills-framework-architect/references/TEMPLATES_PLAYWRIGHT_JAVA.md`
  - Selenium Java: `.claude/skills/skills-framework-architect/references/TEMPLATES_SELENIUM_JAVA.md`
  - Pytest: `.claude/skills/skills-framework-architect/references/TEMPLATES_PYTEST_AND_CICD.md`

## Browser Mode Standard
- **Default Headless Mode (`1920x1080`)**: Toàn bộ quá trình quét DOM và chạy kiểm chứng test mặc định dùng **Headless Mode (`1920x1080`)** để tối ưu tốc độ.
- **Opt-in Headed Mode**: Nếu cần quan sát trình duyệt trực tiếp hoặc xử lý bước đăng nhập thủ công/CAPTCHA, chuyển sang Headed bằng `/browser-mode` (`node scripts/browser-mode.mjs headed`) hoặc cờ `--headed` / `HEADLESS=false` / `-Dheadless=false`.

## Execution Steps

### Bước 1: Phân tích Test Cases & Kiểm kê Codebase Hiện tại
1. Đọc file Test Cases, lọc các kịch bản trong phạm vi (ưu tiên `Critical`/`High`, luồng Happy Path + Validation/Negative ổn định) và gom nhóm các kịch bản có cùng luồng thao tác nhưng khác bộ dữ liệu để thiết kế **Data-Driven Test (`test.each` / `@DataProvider` / `@pytest.mark.parametrize`)**.
2. Quét thư mục dự án để xác định Tech Stack và tái sử dụng tối đa các `BasePage`, `Fixtures`, `Page Objects`, `API Helpers` đã có. Nếu chưa có framework, đọc file template tương ứng trong `Context Pointers`.

### Bước 2: Thu thập Locators Thực tế từ DOM (DOM Discovery)
- Nếu có Target URL: Mở trang bằng **Headless Mode (`1920x1080`)**, đi qua các màn hình liên quan để trích xuất locators thật từ DOM theo thang ưu tiên của `skills-smart-locator-agent` (`getByRole` / `getByLabel` / `getByTestId` -> CSS ổn định). Tuyệt đối không tự đoán selector.
- Nếu không có URL: Đối chiếu với kho Page Objects hiện có và đánh dấu rõ `// TODO: Verify locator on live DOM` tại các phần tử chưa có thông tin DOM.

⏸️ **DỪNG LẠI (HITL Checkpoint)**: Trình bày bảng ánh xạ Test Cases -> Test Methods (kèm các nhóm gộp Data-Driven), danh sách Page Objects sẽ tạo mới/cập nhật, và danh sách Locators đã trích xuất để người dùng xác nhận trước khi sinh code.

### Bước 3: Sinh Page Objects, Test Data & Test Scripts
1. **Page Objects**: Đóng gói locators (`private`/`readonly`) và các action methods có ngữ nghĩa nghiệp vụ, sử dụng Auto-Wait / Explicit Wait chuẩn (cấm dùng `waitForTimeout` / `Thread.sleep` cố định).
2. **Test Data**: Tách dữ liệu đầu vào ra file JSON/fixture hoặc hằng số có cấu trúc, gắn prefix `auto_` cho dữ liệu tạo mới.
3. **Test Scripts**: Ghi chú rõ mã `TC_ID` trong tên bài test hoặc `@Title`/`test.describe`, tuân thủ cấu trúc **Arrange – Act – Assert** và sử dụng Web-First Assertions (`await expect(locator).toBeVisible()`).

### Bước 4: Thực thi Kiểm chứng & Self-Healing (`PIPELINE` Mode)
- Chạy bộ test vừa sinh ở chế độ Headless (`1920x1080`).
- Nếu có test fail: Phân tích trace/log/DOM snapshot để phân biệt lỗi **Automation Script** (sai locator, thiếu wait, sai trạng thái tiền điều kiện -> tự động sửa code và chạy lại tối đa 3 lần) với **Real Application Bug** (ứng dụng trả lỗi 500 hoặc sai nghiệp vụ -> giữ nguyên assertion và báo cáo bug).

## Output
- Các file Page Objects, Test Data và Test Specs hoàn chỉnh trong codebase dự án, kèm kết quả chạy kiểm chứng Pass/Fail theo từng `TC_ID`.