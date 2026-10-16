# Master Framework for E2E Automation — Project Structure & Architecture Index

> **📍 NGUỒN DUY NHẤT** của quy chuẩn kiến trúc framework. Cây thư mục chi tiết và code mẫu của từng stack được đặt cùng nhau trong các file `TEMPLATES_*.md` bên dưới để Agent chỉ nạp đúng 1 stack cần thiết.

**Skill:** [`skills-framework-architect`](../SKILL.md)
**Workflow dùng file này:** `/generate-automation-framework` · `/generate-automation-from-testcases` · `/generate-automation-from-ui-flow`

---

## 1. Cách sử dụng

Agent xác định cấu trúc thư mục **trước khi sinh file mã nguồn đầu tiên**:
- **Project mới:** đọc bảng định tuyến mục 2, mở **đúng 1 file** `TEMPLATES_<STACK>.md` tương ứng để lấy cây thư mục chuẩn (`## 0. Cấu trúc thư mục chuẩn`) và bộ code mẫu.
- **Project có sẵn:** đọc cấu trúc hiện tại của repo và tuân theo, **KHÔNG** áp template đè lên.

---

## 2. Supported Stacks & Bảng Định Tuyến Cây Thư Mục + Code Mẫu

| Nhóm | Stack | Ngôn ngữ & Runner | Report & Build | Cây thư mục & Code mẫu (Đọc đúng 1 file) |
|---|---|---|---|---|
| 🌐 **Web** | **Playwright + TypeScript** | TS · Playwright Test | Allure + HTML · npm | [`TEMPLATES_PLAYWRIGHT_TS.md`](TEMPLATES_PLAYWRIGHT_TS.md) |
| 🌐 **Web** | **Playwright + Java** | Java · TestNG / JUnit5 | Allure · Maven / Gradle | [`TEMPLATES_PLAYWRIGHT_JAVA.md`](TEMPLATES_PLAYWRIGHT_JAVA.md) |
| 🌐 **Web** | **Playwright + Python** | Python · Pytest | Allure + pytest-html · pip | [`TEMPLATES_PYTEST_AND_CICD.md`](TEMPLATES_PYTEST_AND_CICD.md) |
| 🌐 **Web** | **Selenium + Java** | Java · TestNG | Allure · Maven / Gradle | [`TEMPLATES_SELENIUM_JAVA.md`](TEMPLATES_SELENIUM_JAVA.md) |
| 🌐 **Web** | **Selenium + Python** | Python · Pytest | Allure + pytest-html · pip | [`TEMPLATES_PYTEST_AND_CICD.md`](TEMPLATES_PYTEST_AND_CICD.md) |
| 📱 **Mobile** | **Appium + Java** | Java · TestNG (`parallel="tests"`) | Allure · Maven / Gradle | [`TEMPLATES_APPIUM_JAVA.md`](TEMPLATES_APPIUM_JAVA.md) |
| 📱 **Mobile** | **Appium + Python** | Python · Pytest | Allure + pytest-html · pip | [`TEMPLATES_PYTEST_AND_CICD.md`](TEMPLATES_PYTEST_AND_CICD.md) |
| 🔌 **API** | **REST Assured + Java** | Java · TestNG | Allure · Maven / Gradle | [`TEMPLATES_SELENIUM_JAVA.md`](TEMPLATES_SELENIUM_JAVA.md) |
| 🔌 **API** | **Playwright API / Pytest API** | TS / Python | Allure + HTML | [`TEMPLATES_PLAYWRIGHT_TS.md`](TEMPLATES_PLAYWRIGHT_TS.md) / [`TEMPLATES_PYTEST_AND_CICD.md`](TEMPLATES_PYTEST_AND_CICD.md) |

> Chỉ mục code mẫu tổng quát: [`CODE_TEMPLATES.md`](CODE_TEMPLATES.md).

---

## 3. Thư Mục Output Chuẩn — `reports/` (Giống Nhau Cho Cả 8 Stacks)

Mọi sản phẩm sinh ra khi chạy test gom vào **một** thư mục `reports/` ở gốc project:

```text
reports/
├── allure-results/           # Raw results (JSON) — input cho allure generate
├── allure-report/            # HTML report nhiều file
├── allure-report-single/     # Report gộp 1 file — tiện gửi qua chat/email
├── html/                     # HTML report của runner (pytest-html / Playwright HTML)
├── logs/                     # Log file thực thi
├── screenshots/              # Ảnh chụp lưu ra đĩa
└── videos/                   # Video bằng chứng (retain-on-failure / on)
```

- **`.gitignore` phải có `reports/`** — không commit output test.
- **KHÔNG** để thư mục mặc định của tool nằm ở root (`allure-results/`, `test-results/`, `playwright-report/`, `target/surefire-reports/`) — bắt buộc trỏ về `reports/`.
- CI upload **1 artifact duy nhất** là `reports/`. Chi tiết: [`.claude/rules/reporting_rules.md`](../../../rules/reporting_rules.md).

---

## 4. Component Checklist (9 Thành Phần Bắt Buộc)

| # | Component | Bắt buộc | Mô tả |
|---|---|---|---|
| 1 | **Project Structure** | ✅ | Thư mục rõ ràng, phân tách `pages/` (`screens/`), `tests/`, `utils/`, `config/` |
| 2 | **Config Management** | ✅ | Environment qua `.env` + config reader — **KHÔNG** hardcode |
| 3 | **Browser / Driver Factory** | ✅ | Factory pattern (`ThreadLocal` cho Java/TestNG; isolated fixture cho Playwright/Pytest) |
| 4 | **Base Classes** | ✅ | `BasePage` / `BaseScreen` / `BaseTest` chứa smart waits, screenshot & teardown hooks |
| 5 | **Page Object Model** | ✅ | Mỗi page → 1 class, locators khai báo ở đầu class theo [`locator_strategy.md`](../../../rules/locator_strategy.md) |
| 6 | **Test Data Management** | ✅ | Data factory + external data (`test-data/`) + unique/traceable (`[prefix]_[name]_[ts]`) |
| 7 | **Utilities** | ✅ | Wait helpers, screenshot utils, logger, string generators |
| 8 | **Reporting** | ✅ | Allure CLI cục bộ + 5 metadata + step Tiếng Việt + screenshot cuối MỌI test (PASS & FAIL) |
| 9 | **CI/CD Pipeline** | 🟡 Khuyến khích | GitHub Actions / GitLab CI template trong [`TEMPLATES_PYTEST_AND_CICD.md`](TEMPLATES_PYTEST_AND_CICD.md) |

---

## 5. Design Principles & Anti-Patterns (CẤM)

1. **DRY & Single Responsibility:** Page chỉ chứa UI interaction; Test chỉ chứa kịch bản và `expect`/`Assert`.
2. **Open/Closed & Config over Code:** Env, browser mode (`HEADLESS`), `VIDEO_MODE`, timeout quản lý qua `.env`/CLI.
3. **Fail Fast, Log Rich:** Screenshot cuối mọi test (PASS & FAIL), video theo `VIDEO_MODE`, structured logging.

| ❌ Anti-Pattern (CẤM) | ✅ Đúng chuẩn |
|---|---|
| Hardcode URL/credentials trong code | Đọc từ `.env` hoặc config file |
| Locator inline trong file test | Khai báo tập trung trong Page / Screen class |
| `Thread.sleep()` / `waitForTimeout()` | Smart waits (`expect().toBeVisible()`, `WebDriverWait`) |
| Global mutable state giữa các test | Isolated fixtures / `ThreadLocal` per test |
| Monolithic test file (500+ dòng) | Tách theo module/feature |
| Đoán locator không inspect DOM | Mở browser inspect DOM thực tế qua Playwright/Appium MCP |

---

## 6. Tham chiếu

- **Skill chính:** [`SKILL.md`](../SKILL.md) · **Chỉ mục mẫu code:** [`CODE_TEMPLATES.md`](CODE_TEMPLATES.md)
- **Rules:** [`automation_rules.md`](../../../rules/automation_rules.md) · [`locator_strategy.md`](../../../rules/locator_strategy.md) · [`reporting_rules.md`](../../../rules/reporting_rules.md)
