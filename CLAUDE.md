# CLAUDE & ANTIGRAVITY - GLOBAL AUTOMATION & QA AGENT RULES

> **Scope:** Áp dụng cho mọi tác vụ Khảo sát Hệ thống, Phân tích Yêu cầu, Manual Testing (AI-RBT) và Test Automation trên cả **Claude Code** (`CLAUDE.md`, `.claude/`) và **Antigravity** (`AGENTS.md`, `.agents/` — đồng bộ qua `node scripts/sync-antigravity.mjs`).
> **Ngôn ngữ:** Giao tiếp, giải thích và báo cáo bằng **Tiếng Việt** ngắn gọn, rõ ràng, có căn cứ thực tế.

---

## 1. Git Read-Only Safety Rule

- Chỉ sử dụng các lệnh git **read-only**: `git status`, `git diff`, `git log`.
- **Không** chạy lệnh làm thay đổi trạng thái code hoặc nhánh (`git pull`, `git checkout`, `git merge`, `git rebase`, `git reset`, `git push`) để bảo vệ code local đang chỉnh sửa.

---

## 2. Browser Execution Mode (Mặc Định Headless & Công Tắc Chuyển Đổi)

- **Headless Mode (Mặc định — `1920×1080`):** Bật `--headless`, `--disable-gpu`, `--disable-dev-shm-usage`, `--no-sandbox` cho mọi tác vụ (Playwright MCP recon, manual execution, locator healing, UI debug & test suite) để tiết kiệm GPU/RAM và không bị cắt bởi khung cửa sổ OS.
- **Headed Mode (Opt-in — `1600×750`):** Chỉ bật khi **người dùng yêu cầu xem trực tiếp** (*"mở browser"*, *"chạy headed"*, *"bật UI"*) hoặc cần đăng nhập thủ công qua **CAPTCHA / OTP / MFA** (lưu `.auth/user_state.json` rồi chuyển lại về Headless).
- **Browser Mode Switch:** Chạy `/browser-mode` hoặc `node scripts/browser-mode.mjs <status|headless|headed> [--video=on|off]`; với CLI test runner dùng `HEADLESS=false` và `VIDEO_MODE=retain-on-failure|on|off`.
- **Tương tác Browser MCP (`@playwright/mcp` & fallback `chrome-devtools-mcp`):** Tuân thủ `navigate → wait_for → snapshot → interact → screenshot(pass_viewport / fail_fullpage)`; không gọi `browser_resize`, không đoán locator, không dùng `Read` đọc lại ảnh `.png` vào context khi `snapshot` + `browser_evaluate` đã xác nhận DOM. Chi tiết: [`.claude/rules/playwright_rules.md`](.claude/rules/playwright_rules.md).

---

## 3. Quy Trình 4 Bước & Chất Lượng Automation

1. **Recon:** Inspect DOM/UI thực tế hoặc spec trước khi sinh tài liệu/code. Hệ thống mới chưa có tài liệu → chạy `/discover-system` trước tiên để chốt `docs/requirements/README.md` (prefix, tiền tố TC ID, môi trường dùng chung, **Năng lực kiểm thử của QA** cho Vòng 3) và `_discovery/system_map.md`.
2. **Implementation:** Tuân thủ **Page Object Model (POM)**, **Smart Waits** (`expect().toBeVisible()`, `WebDriverWait` — không dùng `waitForTimeout`/`Thread.sleep`), và **Traceable Dynamic Data** (`[prefix]_[testName]_[timestamp]`).
3. **Execution & Self-fix:** Chạy test ngay sau khi viết; nếu fail do script/locator thì tự phân tích và sửa đến khi PASS ổn định $\ge 2$ lần liên tiếp. Nếu fail do **App Bug** → giữ nguyên trạng thái đỏ và chuyển sang `/create-bug-report` (không sửa test để né bug).
4. **Cleanup & Definition of Done (DoD):** Xoá log tạm/unused code, đảm bảo đủ 5 Allure metadata + step `Arrange:`/`Act:`/`Assert:` Tiếng Việt + screenshot cuối mọi test (PASS & FAIL) + video theo `VIDEO_MODE`. Chi tiết đầy đủ tại [`.claude/rules/automation_rules.md`](.claude/rules/automation_rules.md) và [`.claude/rules/reporting_rules.md`](.claude/rules/reporting_rules.md).

---

## 4. Kiến Trúc `docs/`, Chuỗi Đọc 3 Tầng & Bất Biến Truy Vết (RTM)

### Chuỗi đọc 3 tầng (Three-Tier Read Ladder)
| Tầng | File cần đọc | Mục đích & Khi nào đọc |
|---|---|---|
| **1** | `docs/requirements/README.md` *(hoặc `README.md` của nhánh `testcases/`, `bugs/`, `user-guides/`)* | **Luôn đọc đầu tiên:** biết danh sách module, prefix đã chiếm, dải mã kế tiếp, năng lực QA, `AMB` 🔴 còn treo |
| **2** | `docs/requirements/_discovery/system_map.md` *(hoặc `api_map.md`)* | Khi cần bối cảnh cấp hệ thống, phụ thuộc liên module, hoặc chuẩn bị recon module mới |
| **3** | `docs/<nhánh>/<module>/<file index>` | **Chỉ mở đúng 1–2 file của module đang làm** (`requirements_<module>.md`, `test_cases_<module>.md`, `execution_report.md`, `BUG_<module>_<ts>_<TC_ID>.md`, `user_guide_<module>.md`) |

### Quy tắc bất biến `docs/`
- **Tên file index cố định:** `requirements_<module>.md` · `test_cases_<module>.md` · `user_guide_<module>.md` (bản cũ lưu vào `archive/`).
- **Bất biến mã định danh:** `_discovery/` chỉ cấp **prefix** (`LOGIN`, `CUST`…), không cấp mã `REQ-XXX-NN`. Giữ nguyên mã `REQ ID` và `TC ID` xuyên suốt vòng đời; tính năng gỡ bỏ chuyển trạng thái sang `🔴 Deprecated` / `🗑️ Deprecated` kèm **Nhật ký thay đổi**.
- **Bảo mật & Vệ sinh Evidence:** Lưu mật khẩu/token/secret thật tại `.env`. Ảnh chụp đúng phạm vi đối tượng cần chứng minh; xác nhận hiển thị bằng `browser_snapshot` + `browser_evaluate` (chỉ đọc `.png` khi kiểm tra lỗi bố cục CSS). Bug report tại `docs/bugs/<module>/` link trực tiếp tới ảnh trong `docs/executions/`.
- **Đa hệ thống & Đa đặc vụ:** Hệ thống thứ hai trong cùng repo đặt dưới namespace `docs/<nhánh>/_<hệ-thống>/` (mã `REQ-<HỆ_THỐNG>-<MODULE>-<nn>`). Dự án $\ge 3$ modules dùng **Orchestrator Agent** chạy `/discover-system` rồi phân bổ từng module cho các **Worker Subagents** độc lập.
- **Dọn dự án mới:** `rm -rf docs .playwright-mcp task.md .claude/settings.local.json`.
- **Web Viewers offline:** `scripts/testcases-viewer/bundle.html` · `scripts/execution-viewer/bundle.html` · `scripts/bugs-viewer/bundle.html`.

---

## 5. Context Pointers — Rules & Skills

### Rules (`.claude/rules/`)
- [Automation Rules & DoD](.claude/rules/automation_rules.md) · [Playwright Rules](.claude/rules/playwright_rules.md) · [Locator Strategy](.claude/rules/locator_strategy.md) · [Reporting Rules (Allure)](.claude/rules/reporting_rules.md) · [Selenium Rules](.claude/rules/selenium_rules.md) · [Appium Rules](.claude/rules/appium_rules.md)

### Skills (`.claude/skills/`) & Slash Commands (`.claude/commands/` & `.agents/skills/`)
- **Requirements & Discovery:** [`skills-requirements-analyzer`](.claude/skills/skills-requirements-analyzer/SKILL.md) (`/discover-system`, `/generate-requirements-from-website`, `/analyze-requirement-document`, `/update-requirements-from-ticket`, `/generate-cross-module-test-plan`)
- **Manual Testing (AI-RBT 4 Modes × 4 Rings):** [`skills-rbt-manual-testing`](.claude/skills/skills-rbt-manual-testing/SKILL.md) (`/generate-testcases-manual-rbt`, `/generate-testcases-from-requirements`, `/generate-checklist-test`, `/update-testcases-from-impact`, `/generate-application-test-plan`, `/generate-api-tests-from-swagger`)
- **Manual Execution, Bug & Reporting:** [`skills-manual-test-executor`](.claude/skills/skills-manual-test-executor/SKILL.md) (`/execute-test-cases`, `/retest-fixed-bugs`) · [`skills-bug-reporter`](.claude/skills/skills-bug-reporter/SKILL.md) (`/create-bug-report`) · [`skills-test-report-analyzer`](.claude/skills/skills-test-report-analyzer/SKILL.md) (`/analyze-test-report`, `/run-and-fix-tests`) · [`skills-test-summary-reporter`](.claude/skills/skills-test-summary-reporter/SKILL.md) (`/generate-master-test-plan`, `/generate-test-summary-report`) · [`skills-user-guide-writer`](.claude/skills/skills-user-guide-writer/SKILL.md) (`/generate-user-guide`)
- **Automation, Framework & Maintenance:** [`skills-qa-automation-engineer`](.claude/skills/skills-qa-automation-engineer/SKILL.md) (`/generate-automation-from-testcases`, `/generate-automation-from-ui-flow`, `/generate-automation-from-mobile-flow`, `/update-automation-from-impact`) · [`skills-framework-architect`](.claude/skills/skills-framework-architect/SKILL.md) (`/generate-automation-framework`) · [`skills-ui-debug-agent`](.claude/skills/skills-ui-debug-agent/SKILL.md) (`/browser-mode`) · [`skills-mobile-debug-agent`](.claude/skills/skills-mobile-debug-agent/SKILL.md) · [`skills-smart-locator-agent`](.claude/skills/skills-smart-locator-agent/SKILL.md) (`/generate-locator`) · [`skills-locator-healer-agent`](.claude/skills/skills-locator-healer-agent/SKILL.md) (`/heal-locators`) · [`skills-flaky-test-analyzer`](.claude/skills/skills-flaky-test-analyzer/SKILL.md) (`/analyze-flaky-tests`) · [`skills-automation-code-reviewer`](.claude/skills/skills-automation-code-reviewer/SKILL.md) (`/review-automation-code`) · [`skills-testcase-reviewer`](.claude/skills/skills-testcase-reviewer/SKILL.md) (`/review-testcases`) · [`skills-coverage-traceability`](.claude/skills/skills-coverage-traceability/SKILL.md) (`/generate-traceability-matrix`) · [`skills-test-data-generator`](.claude/skills/skills-test-data-generator/SKILL.md) (`/generate-test-data`, `/generate-combinatorial-test-data`) · [`skills-api-mocking`](.claude/skills/skills-api-mocking/SKILL.md) (`/generate-api-mocks`) · [`skills-jira-integration`](.claude/skills/skills-jira-integration/SKILL.md) (`/fetch-jira-requirements`, `/import-test-results-xray`)

---

## Agent skills

### Issue tracker
Local markdown files under `.scratch/<feature-slug>/`. See [`docs/agents/issue-tracker.md`](docs/agents/issue-tracker.md).

### Triage labels
Default five canonical triage roles (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See [`docs/agents/triage-labels.md`](docs/agents/triage-labels.md).

### Domain docs
Single-context domain glossary at [`GLOSSARY.md`](GLOSSARY.md). See [`docs/agents/domain.md`](docs/agents/domain.md).
