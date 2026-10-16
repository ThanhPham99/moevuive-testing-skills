---
description: "Luồng tự động hóa Mobile E2E (Android/iOS): Kết nối thiết bị thật/Emulator qua ADB & Appium -> Thăm dò UI Hierarchy (XML) thực tế -> Sinh Page Object & Code Automation."
skills:
  - skills-mobile-debug-agent
  - skills-qa-automation-engineer
---

# Generate Automation from Mobile Flow (Workflow Dispatcher)

Tự động hóa luồng kiểm thử Mobile App (Android / iOS) bằng cách kết nối trực tiếp với thiết bị thật hoặc Emulator/Simulator, trích xuất cây giao diện gốc (Native XML Hierarchy) ở từng màn hình để lấy locator chính xác 100%, sau đó sinh Screen Objects và Test Scripts.

## Inputs & Modes
- **Mobile Flow / Test Cases**: Mô tả luồng thao tác trên app hoặc đường dẫn file test cases Markdown (`docs/testcases/_<hệ-thống>/<module>/test_cases_<module>.md`).
- **Device & App Info**: `platformName` (`Android`/`iOS`), `deviceName`/`udid`, `appPackage` + `appActivity` (Android) hoặc `bundleId` (iOS), hoặc đường dẫn file `.apk`/`.ipa`/`.app`.
- **Mode**:
  - `GENERATE`: Đã có sẵn XML dump hoặc Page Objects, sinh trực tiếp code Screen Object + Test Script.
  - `PIPELINE` (Khuyên dùng): Kết nối thiết bị -> Đi qua từng bước trên app -> Dump XML Hierarchy thật -> Sinh Screen Object + Test Script -> Chạy kiểm증 & tự sửa lỗi (Self-Healing).

## Context Pointers (Lazy-Load On Demand)
- **Mobile ADB / Appium Exploration & XML Dump**: `.claude/skills/skills-mobile-debug-agent/SKILL.md`
- **Appium Java Architecture & Screen Templates**: `.claude/skills/skills-framework-architect/references/TEMPLATES_APPIUM_JAVA.md`
- **Locator Strategy (Accessibility ID / Android UIAutomator / iOS Class Chain)**: `.claude/skills/skills-smart-locator-agent/SKILL.md`
- **Automation Coding Standards**: `.claude/skills/skills-qa-automation-engineer/SKILL.md`

## Execution Steps

### Bước 1: Kiểm tra Kết nối Thiết bị & Khởi tạo Phiên (Pre-flight Check)
1. Kiểm tra danh sách thiết bị đang kết nối (`adb devices` cho Android hoặc `xcrun simctl list devices booted` cho iOS) và trạng thái Appium Server.
2. Quét cấu trúc dự án hiện tại để nhận diện framework Mobile đang dùng (mặc định ưu tiên **Appium 2 + Java + Maven + TestNG** nếu tạo mới).
3. Nếu chưa có khung dự án, đọc `.claude/skills/skills-framework-architect/references/TEMPLATES_APPIUM_JAVA.md` để tạo `BaseScreen`, `AppiumDriverManager` (`ThreadLocal`) và `BaseMobileTest`.

### Bước 2: Thăm dò Luồng Mobile & Trích xuất Native XML (`PIPELINE` Mode)
Thực hiện tuần tự theo quy trình trong `.claude/skills/skills-mobile-debug-agent/SKILL.md`:
1. Mở ứng dụng trên thiết bị (`adb shell monkey` / `am start` hoặc Appium session).
2. Ở **mỗi màn hình** trong luồng kiểm thử:
   - Chờ giao diện ổn định, trích xuất cây XML thật (`adb exec-out uiautomator dump /dev/tty` hoặc `driver.getPageSource()`) và chụp ảnh màn hình đối chiếu.
   - Thu thập các phần tử tương tác theo thứ tự ưu tiên độ bền: `accessibility id` (`content-desc` / `label`) -> `id` (`resource-id` / `name`) -> `-android uiautomator` / `-ios predicate string` -> `xpath` (chỉ dùng khi không còn lựa chọn khác).
   - Thực hiện thao tác chuyển bước (tap, input text, swipe/scroll tìm phần tử khuất màn hình, xử lý system permission dialog) để sang màn hình tiếp theo.

⏸️ **DỪNG LẠI (HITL Checkpoint)**: Trình bày danh sách các Màn hình (Screens) đã quét, bảng ánh xạ Element -> Mobile Locator thật trích từ XML, và danh sách kịch bản kiểm thử sẽ sinh code để người dùng duyệt.

### Bước 3: Sinh Screen Objects & Mobile Test Scripts
1. **Screen Objects (`*Screen.java`)**:
   - Kế thừa `BaseScreen`, sử dụng `@AndroidFindBy` / `@iOSXCUITFindBy` hoặc `AppiumBy.accessibilityId(...)` / `AppiumBy.id(...)`.
   - Đóng gói các hành vi đặc thù Mobile: ẩn bàn phím an toàn, swipe-to-element, xử lý popup xin quyền hệ thống, và explicit wait (`WebDriverWait`) thay vì `Thread.sleep()`.
2. **Test Scripts (`*Test.java`)**:
   - Mỗi kịch bản độc lập trạng thái, rõ 3 bước Arrange - Act - Assert, kiểm tra rõ phần tử đích xuất hiện hoặc thông báo lỗi tương ứng.

### Bước 4: Thực thi Kiểm chứng & Tự động Sửa lỗi (`PIPELINE` Mode)
- Chạy thực tế bộ test vừa sinh trên thiết bị/Emulator (`mvn test -Dtest=<TestClass>`).
- Nếu test fail do lệch timing, bàn phím che phần tử, cần cuộn màn hình hoặc sai trạng thái app: phân tích log + XML dump tại thời điểm lỗi, cập nhật Screen Object và chạy lại (tối đa 3 vòng) cho đến khi **100% PASS**.

## Output
- Các class Screen Object (`src/main/java/.../screens/*Screen.java`) với Mobile Locators trích xuất từ XML thật.
- Các class Test (`src/test/java/.../tests/*Test.java`) đã kiểm chứng chạy thực tế trên thiết bị/Emulator.
