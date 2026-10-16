---
name: skills-framework-architect
description: "Scaffold, design, or standardize test automation frameworks (Playwright TS/Java/Python, Selenium Java/Python, Appium Java/Python, REST Assured) with POM, parallel execution, local Allure reporting, and CI/CD."
---

# Framework Architect

Thiết kế, scaffold và chuẩn hóa Test Automation Framework hoàn chỉnh cho Web, Mobile và API theo kiến trúc Page Object Model (POM), chạy song song mặc định 5 luồng, mặc định **Headless Mode** (`1920x1080`), tích hợp Allure CLI cục bộ và GitHub Actions CI/CD.

---

## 1. Context Pointers — Tra Cứu Cấu Trúc & Code Mẫu Theo Stack

Chỉ đọc đúng 1 file `TEMPLATES_*.md` tương ứng với stack mà người dùng yêu cầu (mỗi file đã tích hợp sẵn **Mục 0: Cấu trúc thư mục chuẩn** và trọn bộ code mẫu):

| Tech Stack | Kiến trúc chung | Cây thư mục & Code Templates (Base / Config / Report / Parallel) |
|---|---|---|
| **Playwright + TypeScript** (Web / API) | [`references/PROJECT_STRUCTURE.md`](references/PROJECT_STRUCTURE.md) | [`references/TEMPLATES_PLAYWRIGHT_TS.md`](references/TEMPLATES_PLAYWRIGHT_TS.md) |
| **Playwright + Java** (Maven + TestNG) | [`references/PROJECT_STRUCTURE.md`](references/PROJECT_STRUCTURE.md) | [`references/TEMPLATES_PLAYWRIGHT_JAVA.md`](references/TEMPLATES_PLAYWRIGHT_JAVA.md) |
| **Playwright / Selenium + Python** (Pytest) | [`references/PROJECT_STRUCTURE.md`](references/PROJECT_STRUCTURE.md) | [`references/TEMPLATES_PYTEST_AND_CICD.md`](references/TEMPLATES_PYTEST_AND_CICD.md) |
| **Selenium / REST Assured + Java** (TestNG) | [`references/PROJECT_STRUCTURE.md`](references/PROJECT_STRUCTURE.md) | [`references/TEMPLATES_SELENIUM_JAVA.md`](references/TEMPLATES_SELENIUM_JAVA.md) |
| **Appium + Java / Python** (Android · iOS · Flutter) | [`references/PROJECT_STRUCTURE.md`](references/PROJECT_STRUCTURE.md) | [`references/TEMPLATES_APPIUM_JAVA.md`](references/TEMPLATES_APPIUM_JAVA.md) |
| **Chỉ mục tổng hợp & CI/CD Workflows** | [`references/CODE_TEMPLATES.md`](references/CODE_TEMPLATES.md) | [`references/TEMPLATES_PYTEST_AND_CICD.md`](references/TEMPLATES_PYTEST_AND_CICD.md) § 4 |

---

## 2. 10 Thành Phần Bắt Buộc Khi Scaffold Framework

1. **Project Structure:** Phân tách `pages/` (`screens/` hoặc `api/`), `tests/`, `utils/`, `config/`, `test-data/`, kèm `README.md` và `.gitignore`.
2. **Configuration Management:** Quản lý đa môi trường qua `.env` / `config.properties`; cung cấp `.env.example`, tuyệt đối không hardcode credentials.
3. **Browser / Driver Factory:** Playwright TS/Python dùng fixture đọc `HEADLESS`; Java (Playwright/Selenium/Appium) quản lý qua `ThreadLocal` và gọi `.remove()` trong teardown.
4. **Base Classes:** `BasePage` / `BaseScreen` đóng gói smart waits (`expect()`, `WebDriverWait`); `BaseTest` quản lý setup/teardown.
5. **Page Object Model (POM):** Mỗi màn hình 1 class; khai báo locator ở đầu class; bọc Allure step (`test.step`, `@Step`, `@allure.step`).
6. **Test Data Management:** Sinh dữ liệu unique có dấu vết (`auto_<test>_<timestamp>`) và tách dữ liệu tĩnh ra `test-data/`.
7. **Utilities:** Smart wait helpers, Screenshot helper, Structured Logger (Log4j2 / winston / Python `logging` ghi vào `reports/logs/`).
8. **Allure Reporting Cục Bộ:**
   - Đủ 5 metadata (Tên Tiếng Việt, Description, Severity, Tags, `testId`) + step `Arrange:` / `Act:` / `Assert:`.
   - Đính kèm screenshot cuối **mọi** test (`trang_thai_cuoi_cua_test` khi PASS, `trang_thai_khi_that_bai` khi FAIL) + video theo `VIDEO_MODE`; tắt capture `stdout`/`stderr`; gom mọi output vào `reports/`.
   - Cài Allure CLI ngay trong project (`devDependency "allure"` cho Node/Python; `.allure/` cho Java). Chi tiết: [`.claude/rules/reporting_rules.md`](../../rules/reporting_rules.md).
9. **Parallel Execution (Mặc định 5 luồng):** `WORKERS=5` + `fullyParallel: true` (Playwright TS), `-n 5` (Pytest), `thread-count="5"` (TestNG). Riêng Appium: `thread-count` = số device thật đang kết nối (`udid` + `systemPort`/`wdaLocalPort` riêng).
10. **CI/CD Pipeline:** Sinh sẵn `.github/workflows/<framework>.yml` chạy headless + parallel và upload `reports/` (`if: always()`).

---

## 3. Browser Execution Mode — Mặc Định Headless & Chuyển Đổi Nhanh

| Thuộc tính | Mặc định (Headless Mode) | Chế độ quan sát trực tiếp (Headed Mode — Opt-in) |
|---|---|---|
| **Biến & Viewport** | `HEADLESS=true` · `1920 x 1080` | `HEADLESS=false` · `1600 x 750` (cửa sổ trình duyệt thực tế) |
| **Cờ tối ưu GPU** | `--disable-gpu`, `--disable-dev-shm-usage`, `--no-sandbox` | Bỏ cờ tắt GPU để hiển thị cửa sổ trình duyệt |
| **Lệnh bật Headed** | — | Playwright TS: `HEADLESS=false npx playwright test`<br>Java Maven: `mvn test -Dheadless=false` · Pytest: `HEADLESS=false pytest` |

> Khi dùng **Playwright MCP** khảo sát DOM, trình duyệt mặc định chạy **Headless Mode** (`1920x1080`). Chuyển sang Headed bằng `node scripts/browser-mode.mjs headed` (hoặc `/browser-mode headed`).

---

## 4. Rules Tham Chiếu Theo Tầng Kỹ Thuật

- [`.claude/rules/automation_rules.md`](../../rules/automation_rules.md) · [`.claude/rules/reporting_rules.md`](../../rules/reporting_rules.md) · [`.claude/rules/locator_strategy.md`](../../rules/locator_strategy.md)
- [`.claude/rules/playwright_rules.md`](../../rules/playwright_rules.md) · [`.claude/rules/selenium_rules.md`](../../rules/selenium_rules.md) · [`.claude/rules/appium_rules.md`](../../rules/appium_rules.md)
