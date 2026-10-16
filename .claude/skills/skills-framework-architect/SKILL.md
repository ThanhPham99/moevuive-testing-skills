---
name: skills-framework-architect
description: "Scaffold, design, or standardize test automation frameworks (Playwright TS/Java/Python, Selenium Java/Python, Appium Java/Python, REST Assured) with POM, parallel execution, local Allure reporting, and CI/CD."
---

# Framework Architect

Thiết kế, scaffold và chuẩn hóa automation framework hoàn chỉnh cho Web, Mobile và API theo kiến trúc Page Object Model (POM), chạy song song mặc định 5 luồng, mặc định **Headless Mode** (`1920x1080`), tích hợp Allure CLI cục bộ và GitHub Actions CI/CD.

---

## 1. Context Pointers — Tra Cứu Cấu Trúc & Code Mẫu Theo Stack

Chỉ đọc file reference tương ứng với stack mà user yêu cầu:

| Tech Stack | Cấu trúc thư mục | Code Templates (Base / Config / Report / Parallel) |
|---|---|---|
| **Playwright + TypeScript** (Web / API) | [`references/PROJECT_STRUCTURE.md`](references/PROJECT_STRUCTURE.md) § 1 | [`references/TEMPLATES_PLAYWRIGHT_TS.md`](references/TEMPLATES_PLAYWRIGHT_TS.md) |
| **Playwright + Java** (Maven + TestNG) | [`references/PROJECT_STRUCTURE.md`](references/PROJECT_STRUCTURE.md) § 2 | [`references/TEMPLATES_PLAYWRIGHT_JAVA.md`](references/TEMPLATES_PLAYWRIGHT_JAVA.md) |
| **Playwright + Python** (Pytest) | [`references/PROJECT_STRUCTURE.md`](references/PROJECT_STRUCTURE.md) § 3 | [`references/TEMPLATES_PYTEST_AND_CICD.md`](references/TEMPLATES_PYTEST_AND_CICD.md) § 1–3 |
| **Selenium + Java** (Maven + TestNG) | [`references/PROJECT_STRUCTURE.md`](references/PROJECT_STRUCTURE.md) § 4 | [`references/TEMPLATES_SELENIUM_JAVA.md`](references/TEMPLATES_SELENIUM_JAVA.md) |
| **Selenium + Python** (Pytest) | [`references/PROJECT_STRUCTURE.md`](references/PROJECT_STRUCTURE.md) § 5 | [`references/TEMPLATES_PYTEST_AND_CICD.md`](references/TEMPLATES_PYTEST_AND_CICD.md) |
| **Appium + Java** (Android / iOS / Flutter) | [`references/PROJECT_STRUCTURE.md`](references/PROJECT_STRUCTURE.md) § 6 | [`references/TEMPLATES_APPIUM_JAVA.md`](references/TEMPLATES_APPIUM_JAVA.md) |
| **Appium + Python** (Pytest) | [`references/PROJECT_STRUCTURE.md`](references/PROJECT_STRUCTURE.md) § 7 | [`references/TEMPLATES_APPIUM_JAVA.md`](references/TEMPLATES_APPIUM_JAVA.md) & [`references/TEMPLATES_PYTEST_AND_CICD.md`](references/TEMPLATES_PYTEST_AND_CICD.md) |
| **REST Assured + Java** (API) | [`references/PROJECT_STRUCTURE.md`](references/PROJECT_STRUCTURE.md) § 8 | [`references/TEMPLATES_PLAYWRIGHT_JAVA.md`](references/TEMPLATES_PLAYWRIGHT_JAVA.md) § 5 (Maven/Allure) |
| **GitHub Actions CI/CD Workflows** | `.github/workflows/` | [`references/TEMPLATES_PYTEST_AND_CICD.md`](references/TEMPLATES_PYTEST_AND_CICD.md) § 4 |
| **Index tổng hợp Code Templates** | — | [`references/CODE_TEMPLATES.md`](references/CODE_TEMPLATES.md) |

---

## 2. 10 Thành Phần Bắt Buộc Khi Scaffold Framework

1. **Project Structure:** Phân tách `pages/` (`screens/` hoặc `api/`), `tests/`, `utils/`, `config/`, `test-data/`, kèm `README.md` và `.gitignore`.
2. **Configuration Management:** Tập trung cấu hình dev/staging/prod qua `.env` hoặc `config.properties`; truyền credentials qua biến môi trường và cung cấp `.env.example`.
3. **Browser / Driver Management:**
   - Playwright TS/Python: browser fixture đọc `HEADLESS` từ env.
   - Playwright Java / Selenium Java / Appium Java: quản lý qua `ThreadLocal` và gọi `.remove()` trong teardown.
4. **Base Classes:** `BasePage` / `BaseScreen` đóng gói thao tác chờ thông minh (`expect()`, `WebDriverWait`); `BaseTest` quản lý lifecycle setup/teardown.
5. **Page Object Model (POM):** Mỗi màn hình 1 class; khai báo locator ở đầu class; đặt tên method theo hành vi người dùng và bọc Allure step (`test.step`, `@Step`, `@allure.step`).
6. **Test Data Management:** Sinh dữ liệu unique có dấu vết (`auto_<test>_<timestamp>`) và tách dữ liệu tĩnh ra JSON/CSV/YAML.
7. **Utilities:** Smart wait helpers, Screenshot helper đính ảnh cuối mọi test, Structured Logger (Log4j2 / winston / Python logging).
8. **Allure Reporting Cục Bộ:**
   - Mỗi test có tên Tiếng Việt, Description, Severity, Tags, label `testId` và các bước `Arrange:` / `Act:` / `Assert:`.
   - Đính kèm screenshot ở cuối **mọi** test (`trang_thai_cuoi_cua_test` khi PASS, `trang_thai_khi_that_bai` khi FAIL); tắt capture `stdout`/`stderr`; gom mọi output vào `reports/`.
   - Cài Allure CLI ngay trong project (`devDependency "allure"` cho Node/Python; `maven-dependency-plugin` giải nén `allure-commandline` vào `.allure/` cho Java). Chi tiết: [`.claude/rules/reporting_rules.md`](../../rules/reporting_rules.md).
9. **Parallel Execution (Mặc định 5 luồng):**
   - Khai báo số luồng tại đúng 1 nơi: `WORKERS=5` + `fullyParallel: true` (Playwright TS), `-n 5` (Pytest `addopts`), `thread-count="5"` (TestNG `testng.xml`).
   - Ngoại lệ Appium: `thread-count` = số device thật đang kết nối, mỗi device có `udid` và `systemPort` (Android) / `wdaLocalPort` (iOS) riêng.
10. **CI/CD Pipeline:** Sinh sẵn `.github/workflows/<framework>.yml` kích hoạt trên `push`, `pull_request`, `workflow_dispatch`; chạy headless + parallel, sinh Allure report bằng CLI trong project và upload `reports/` với `if: always()`.

---

## 3. Browser Execution Mode — Mặc Định Headless & Chuyển Đổi Nhanh

Áp dụng cho mọi Web Automation Framework sinh từ skill này (kế thừa từ `CLAUDE.md` và [`.claude/rules/playwright_rules.md`](../../rules/playwright_rules.md)):

| Thuộc tính | Mặc định (Headless Mode) | Chế độ quan sát trực tiếp (Headed Mode — Opt-in) |
|---|---|---|
| **Biến điều khiển** | `HEADLESS=true` (mặc định trong code/config) | Truyền khi chạy lệnh mà không cần sửa file cấu hình |
| **Viewport của test runner** | `1920 x 1080` | `1920 x 1080` (hoặc cửa sổ thực tế khi debug local) |
| **Cờ tối ưu GPU** | `--disable-gpu`, `--disable-dev-shm-usage`, `--no-sandbox` | Bỏ cờ tắt GPU để hiển thị cửa sổ trình duyệt |
| **Lệnh bật Headed tức thì** | — | Playwright TS: `HEADLESS=false npx playwright test` hoặc `npx playwright test --headed`<br>Java Maven: `mvn test -Dheadless=false`<br>Pytest: `HEADLESS=false pytest` |

> Khi dùng **Playwright MCP** để khảo sát DOM tạo Page Object, trình duyệt MCP mặc định chạy **Headless Mode** (`1920x1080`). Nếu cần mở cửa sổ trình duyệt MCP để quan sát hoặc đăng nhập CAPTCHA/OTP/MFA, chạy `node scripts/browser-mode.mjs headed` (hoặc `/browser-mode headed`).

---

## 4. Quy Chuẩn Thiết Kế & Rules Tham Chiếu

| Chuẩn thiết kế | Thực hành bắt buộc |
|---|---|
| **Configuration over Code** | Đọc URL, credentials, timeout, `HEADLESS`, `WORKERS` từ `.env` / `config.properties` |
| **Strict POM Encapsulation** | Khai báo toàn bộ locator trong Page/Screen class; Test class chỉ gọi business methods và assertions |
| **Deterministic Synchronization** | Sử dụng Playwright auto-waiting hoặc `WebDriverWait` + `ExpectedConditions` |
| **Thread Isolation** | Khởi tạo fixture/driver độc lập cho từng test; dữ liệu tạo mới có prefix định danh riêng |
| **Structured Logging** | Ghi log qua Logger framework vào `reports/logs/` |

### Rules chi tiết theo tầng kỹ thuật
- [`.claude/rules/automation_rules.md`](../../rules/automation_rules.md) — Quy tắc thiết kế POM, test structure, retry và параллеl.
- [`.claude/rules/reporting_rules.md`](../../rules/reporting_rules.md) — Quy tắc Allure report, metadata Tiếng Việt, screenshot mọi test, CLI cục bộ.
- [`.claude/rules/locator_strategy.md`](../../rules/locator_strategy.md) — Thứ tự ưu tiên chọn locator bền vững.
- [`.claude/rules/playwright_rules.md`](../../rules/playwright_rules.md) — Quy tắc Playwright & Browser Execution Mode.
- [`.claude/rules/selenium_rules.md`](../../rules/selenium_rules.md) — Quy tắc Selenium WebDriver & ThreadLocal.
- [`.claude/rules/appium_rules.md`](../../rules/appium_rules.md) — Quy tắc Appium Native Android/iOS & Flutter Semantics.
