---
name: generate-automation-from-ui-flow
description: "Luồng tự động hóa E2E: Mở trình duyệt thực tế -> Thăm dò UI Flow & lấy DOM thật -> Sinh Page Object & Code Automation chính xác 100%."
skills:
  - skills-ui-debug-agent
  - skills-qa-automation-engineer
---

# Generate Automation from UI Flow (Workflow Dispatcher)

Tự động hóa nhanh một luồng nghiệp vụ Web E2E ngay cả khi chưa có sẵn tài liệu Test Cases chi tiết: trực tiếp điều khiển trình duyệt đi qua luồng người dùng, trích xuất DOM thật ở từng bước, sinh Page Objects + Test Scripts và chạy kiểm chứng.

## Inputs & Modes
- **Target URL & Credentials**: Đường dẫn trang web bắt đầu và thông tin đăng nhập (nếu luồng yêu cầu xác thực).
- **UI Flow Description**: Mô tả ngắn gọn luồng thao tác cần tự động hóa (VD: *"Đăng nhập -> Tìm sản phẩm -> Thêm vào giỏ -> Thanh toán COD"*).
- **Mode**:
  - `PIPELINE` (Mặc định): Khám phá luồng trên trình duyệt thật -> Trích xuất Locators từ DOM -> Sinh code POM + E2E Test -> Chạy kiểm chứng & tự sửa lỗi (Self-Healing).
  - `GENERATE`: Chỉ khám phá DOM + sinh code POM + E2E Test (bỏ qua bước chạy kiểm chứng lặp).

## Context Pointers (Lazy-Load On Demand)
- **Browser Exploration & DOM Inspection**: `.claude/skills/skills-ui-debug-agent/SKILL.md`
- **Resilient Locator Strategy**: `.claude/skills/skills-smart-locator-agent/SKILL.md`
- **Automation Coding Standards & Lifecycle**: `.claude/skills/skills-qa-automation-engineer/SKILL.md`
- **Stack Templates (Chỉ đọc đúng 1 file khớp với stack dự án)**:
  - Playwright TS: `.claude/skills/skills-framework-architect/references/TEMPLATES_PLAYWRIGHT_TS.md`
  - Playwright Java: `.claude/skills/skills-framework-architect/references/TEMPLATES_PLAYWRIGHT_JAVA.md`
  - Selenium Java: `.claude/skills/skills-framework-architect/references/TEMPLATES_SELENIUM_JAVA.md`
  - Pytest: `.claude/skills/skills-framework-architect/references/TEMPLATES_PYTEST_AND_CICD.md`

## Browser Mode Standard
- **Default Headless Mode (`1920x1080`)**: Mặc định khởi chạy trình duyệt ở chế độ **Headless (`1920x1080`, tắt GPU)** theo chuẩn của `skills-ui-debug-agent` để khám phá DOM và chạy test với tốc độ cao nhất.
- **Opt-in Headed Mode (`1600x750`)**: Nếu người dùng muốn xem trực tiếp quá trình duyệt trang hoặc cần vượt qua CAPTCHA/2FA thủ công, chuyển sang Headed bằng `/browser-mode` (`node scripts/browser-mode.mjs headed`).

## Execution Steps

### Bước 1: Nhận diện Codebase & Khởi tạo Phiên Trình duyệt
1. Quét dự án hiện tại để xác định Tech Stack (`Playwright TS/Java`, `Selenium Java`, `Pytest`) và các Page Objects / Fixtures có thể tái sử dụng.
2. Đọc cấu hình browser mode (`node scripts/browser-mode.mjs status` hoặc mặc định **Headless `1920x1080`**) và mở Target URL.

### Bước 2: Thăm dò Luồng Giao diện & Trích xuất DOM Thật (Live Flow Walkthrough)
Thực hiện từng bước theo mô tả UI Flow:
1. Tại mỗi màn hình/trạng thái (kể cả Modal, Drawer, Toast, Dropdown động), trích xuất các phần tử tương tác trực tiếp từ DOM thật.
2. Chọn bộ định vị theo thứ tự ưu tiên của `skills-smart-locator-agent`: `getByRole` / `getByLabel` / `getByPlaceholder` -> `data-testid` -> CSS selector ngữ nghĩa; đảm bảo mỗi locator định danh duy nhất `1` phần tử (`count() === 1`).
3. Ghi nhận luôn các API requests ngầm (`XHR`/`Fetch`) quan trọng cần chờ (`waitForResponse`) và các URL/tiêu đề/thông báo dùng làm điểm Assert.

⏸️ **DỪNG LẠI (HITL Checkpoint)**: Trình bày sơ đồ các bước trong UI Flow đã đi qua, bảng ánh xạ Màn hình -> Page Objects -> Locators thật từ DOM, và danh sách Assertions dự kiến để người dùng duyệt trước khi sinh code.

### Bước 3: Sinh Page Objects & E2E Test Scripts
1. Tạo mới hoặc mở rộng các class **Page Object** tương ứng với từng màn hình trong luồng, đóng gói gọn các thao tác và cơ chế Auto-Wait / Network-Wait.
2. Sinh file **E2E Test Spec** bao phủ luồng chính (Happy Path) và các kiểm tra xác nhận trạng thái giao diện / dữ liệu ở từng chặng quan trọng.

### Bước 4: Thực thi Kiểm chứng & Tự động Sửa lỗi (`PIPELINE` Mode)
- Chạy trực tiếp file test vừa sinh bằng test runner của dự án (mặc định Headless `1920x1080`).
- Nếu gặp lỗi đồng bộ (race condition, animation, lazy-load) hoặc lệch selector: cập nhật Page Object/Test Script và chạy lại (tối đa 3 vòng) cho đến khi test chạy **PASS ổn định**.

## Output
- Các file Page Objects (`pages/*`) và E2E Test Spec (`tests/*`) sử dụng 100% locators thật từ DOM, đã được kiểm chứng thực thi thành công.