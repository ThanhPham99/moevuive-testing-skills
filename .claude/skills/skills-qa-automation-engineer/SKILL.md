---
name: skills-qa-automation-engineer
description: "Generate automation scripts from test cases or UI/mobile/API flows, create test plans, run and fix test suites, and route QA engineering tasks across Playwright, Selenium, Appium, and REST Assured."
---

# QA Automation Engineer — Skill Router & Automation Lifecycle

Điều phối các tác vụ kỹ thuật QA Automation (Web, Mobile, API) và thực thi chu trình viết/chạy/sửa code kiểm thử tự động theo kiến trúc Page Object Model (POM).

---

## 1. Vòng Đời Thực Thi Automation 4 Pha (Core 4-Phase Lifecycle)

Mọi tác vụ sinh mới hoặc cập nhật script automation đều tuân thủ 4 pha tuần tự:

1. **Pha 1 — Recon & Khám Phá Ngữ Cảnh (DOM / Mobile / Spec Recon):**
   - **Web UI:** Mở trang đích qua Playwright MCP (mặc định **Headless Mode** `1920x1080`), tuân thủ chuỗi `browser_navigate` → `browser_wait_for` → `browser_snapshot` để lấy DOM thật trước khi chọn locator.
   - **Mobile App:** Thu page source thật từ thiết bị/emulator qua `skills-mobile-debug-agent`.
   - **API:** Đọc OpenAPI/Swagger spec hoặc bắt network request thực tế (`browser_network_requests`).
   - Đọc `docs/requirements/README.md` và `docs/testcases/README.md` để ánh xạ đúng `REQ ID` / `TC ID`.
2. **Pha 2 — POM / Client Implementation:**
   - Tách bạch **Page Object / Screen Object / API Client** (chứa locators + hành vi người dùng bọc `@Step` / `test.step`) và **Test Spec** (chứa luồng `Arrange` → `Act` → `Assert` + Allure metadata Tiếng Việt + label `testId`).
   - Chỉ dùng smart waits (`expect()`, `WebDriverWait`), tạo dữ liệu test unique theo timestamp (`auto_<test>_<stamp>`).
3. **Pha 3 — Execution & Self-Fix Triage:**
   - Chạy thử nghiệm ngay sau khi sinh code (mặc định **Headless Mode** `1920x1080`, song song 5 luồng).
   - Nếu đỏ: phân loại theo `skills-test-report-analyzer`. Chỉ tự sửa lỗi thuộc script/locator/wait (`🔧`/`⏱️`/`📦`); **giữ nguyên màu đỏ** và tạo bug report (`skills-bug-reporter`) nếu là lỗi sản phẩm (`🐛`).
4. **Pha 4 — Definition of Done (DoD) & Cleanup:**
   - Xác nhận screenshot được đính kèm cuối **mọi** test (cả PASS lẫn FAIL), không đính kèm `stdout`/`stderr`, gom toàn bộ output vào `reports/`.
   - Xoá file nháp, console.log/debug code, kiểm tra `.gitignore` không lọt `.env`, `reports/`, `.allure/`.

---

## 2. Browser Execution Mode — Mặc Định Headless & Chuyển Đổi Nhanh

| Tầng Thực Thi | Mặc định (Headless Mode) | Chế độ quan sát trực tiếp (Headed Mode — Opt-in) |
|---|---|---|
| **Playwright MCP (Recon / Debug)** | `1920x1080`, tắt GPU (`--headless`, `--disable-gpu`) | `1600x750`, cửa sổ tại `0,0` — bật qua `/browser-mode headed` (`node scripts/browser-mode.mjs headed`) khi user yêu cầu xem trực tiếp hoặc cần qua CAPTCHA/OTP/MFA |
| **Automation Test Runner** | `HEADLESS=true`, viewport `1920x1080` | Bật tức thì trên CLI: `HEADLESS=false npx playwright test` (`--headed`), `mvn test -Dheadless=false`, hoặc `HEADLESS=false pytest` |

---

## 3. Stack Mặc Định Theo Nền Tảng (Khi User Chưa Chỉ Định)

| Nền tảng | Framework mặc định | Ngôn ngữ | Runner | Report |
|---|---|---|---|---|
| **🌐 Web** | **Playwright** | TypeScript | Playwright Test | HTML Report + Allure 3 CLI cục bộ |
| **📱 Mobile** | **Appium** | Java | TestNG | Allure 2 CLI cục bộ (`.allure/`) |
| **🔌 API** | **REST Assured** | Java | TestNG | Allure 2 CLI cục bộ (`.allure/`) |

> Nếu dự án đã có sẵn repo hoặc user nêu ràng buộc (Selenium Java, Playwright Python/Java...), giữ nguyên stack của dự án và nạp template tương ứng từ [`skills-framework-architect`](../skills-framework-architect/SKILL.md).

---

## 4. Bảng Định Tuyến Tác Vụ (Skill & Workflow Routing Table)

Khi yêu cầu thuộc lĩnh vực chuyên sâu, nạp đúng **Skill đích** hoặc điều hướng sang **Workflow Dispatcher** tương ứng:

| Nhóm Tác Vụ | Tình Huống Kích Hoạt | Skill Đích (Context Pointer) | Slash Workflow (`.claude/commands/`) |
|---|---|---|---|
| **Khảo sát & Requirements** | Khám phá hệ thống, phân tích tài liệu/website, cập nhật delta từ ticket | [`skills-requirements-analyzer`](../skills-requirements-analyzer/SKILL.md) | `/discover-system`, `/generate-requirements-from-website`, `/analyze-requirement-document`, `/update-requirements-from-ticket` |
| **Manual Test Cases (RBT)** | Sinh TC nhanh (QUICK), đầy đủ 6 bước (FULL RBT), checklist, hoặc delta update | [`skills-rbt-manual-testing`](../skills-rbt-manual-testing/SKILL.md) | `/generate-testcases-from-requirements`, `/generate-testcases-manual-rbt`, `/generate-checklist-test`, `/update-testcases-from-impact` |
| **Review & Chạy Manual TC** | Đánh giá chất lượng bộ TC; chạy manual TC trên browser & retest bug | [`skills-testcase-reviewer`](../skills-testcase-reviewer/SKILL.md) · [`skills-manual-test-executor`](../skills-manual-test-executor/SKILL.md) | `/review-testcases`, `/execute-test-cases`, `/retest-fixed-bugs` |
| **Test Plan & Cross-Module** | Lập Master Test Plan, Application Test Plan, ma trận kết hợp liên module | `skills-qa-automation-engineer` + [`skills-rbt-manual-testing`](../skills-rbt-manual-testing/SKILL.md) | `/generate-master-test-plan`, `/generate-application-test-plan`, `/generate-cross-module-test-plan` |
| **Scaffold Framework** | Khởi tạo/chuẩn hóa cấu trúc dự án automation, CI/CD, Allure cục bộ | [`skills-framework-architect`](../skills-framework-architect/SKILL.md) | `/generate-automation-framework` |
| **Sinh Script Automation** | Chuyển manual TC, UI flow, Mobile flow hoặc Swagger thành code test | `skills-qa-automation-engineer` + [`skills-smart-locator-agent`](../skills-smart-locator-agent/SKILL.md) | `/generate-automation-from-testcases`, `/generate-automation-from-ui-flow`, `/generate-automation-from-mobile-flow`, `/generate-api-tests-from-swagger` |
| **Đồng Bộ & Review Code** | Cập nhật script theo Impact Report; review chất lượng code automation | [`skills-coverage-traceability`](../skills-coverage-traceability/SKILL.md) · [`skills-automation-code-reviewer`](../skills-automation-code-reviewer/SKILL.md) | `/update-automation-from-impact`, `/review-automation-code` |
| **Locator & Tự Chữa Lành** | Sinh locator bền vững từ DOM; quét & sửa locator gãy sau khi UI đổi | [`skills-smart-locator-agent`](../skills-smart-locator-agent/SKILL.md) · [`skills-locator-healer-agent`](../skills-locator-healer-agent/SKILL.md) | `/generate-locator`, `/heal-locators` |
| **Chạy Suite, Triage & Flaky** | Chạy regression, sửa lỗi test, phân tích report, chẩn đoán flaky test | [`skills-test-report-analyzer`](../skills-test-report-analyzer/SKILL.md) · [`skills-flaky-test-analyzer`](../skills-flaky-test-analyzer/SKILL.md) | `/run-and-fix-tests`, `/analyze-test-report`, `/analyze-flaky-tests` |
| **Test Data & API Mocking** | Sinh dữ liệu biên/combinatorial pipeline; giả lập API response/lỗi | [`skills-test-data-generator`](../skills-test-data-generator/SKILL.md) · [`skills-api-mocking`](../skills-api-mocking/SKILL.md) | `/generate-test-data`, `/generate-combinatorial-test-data`, `/generate-api-mocks` |
| **Bug, RTM, Summary, Jira** | Lập bug report, ma trận RTM, báo cáo Go/No-Go, đồng bộ Jira/Xray, User Guide | [`skills-bug-reporter`](../skills-bug-reporter/SKILL.md) · [`skills-test-summary-reporter`](../skills-test-summary-reporter/SKILL.md) · [`skills-jira-integration`](../skills-jira-integration/SKILL.md) · [`skills-user-guide-writer`](../skills-user-guide-writer/SKILL.md) | `/create-bug-report`, `/generate-traceability-matrix`, `/generate-test-summary-report`, `/fetch-jira-requirements`, `/import-test-results-xray`, `/generate-user-guide` |

---

## 5. Rules Kỹ Thuật Tham Chiếu (Context Pointers)

Chỉ nạp file rule tương ứng với công nghệ đang thao tác:
- **Quy tắc chung & POM:** [`.claude/rules/automation_rules.md`](../../rules/automation_rules.md)
- **Chiến lược chọn Locator:** [`.claude/rules/locator_strategy.md`](../../rules/locator_strategy.md)
- **Chuẩn Allure Report & Screenshot:** [`.claude/rules/reporting_rules.md`](../../rules/reporting_rules.md)
- **Playwright & Browser Mode:** [`.claude/rules/playwright_rules.md`](../../rules/playwright_rules.md)
- **Selenium WebDriver:** [`.claude/rules/selenium_rules.md`](../../rules/selenium_rules.md)
- **Appium Mobile (Android/iOS/Flutter):** [`.claude/rules/appium_rules.md`](../../rules/appium_rules.md)