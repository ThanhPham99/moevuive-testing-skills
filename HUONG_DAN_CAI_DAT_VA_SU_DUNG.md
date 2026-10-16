# Hướng Dẫn Cài Đặt & Sử Dụng Chi Tiết — Claude & Antigravity Testing Skills

> **Phiên bản:** Dual-Harness Edition (Hỗ trợ song song **Google Antigravity** & **Claude Code**)
> **Đối tượng:** Manual QA, Automation QA Engineer, Test Lead, BA và Developer.
> **Mục tiêu:** Giúp bạn cài đặt hoàn chỉnh trong **5 phút** và nắm vững cách vận hành **36 Slash Commands + 20 Core Skills + 3 Offline Web Viewers** thông qua **5 kịch bản thực chiến từ đầu đến cuối**.

---

## Mục Lục

1. [Tổng Quan Kiến Trúc Dual-Harness](#1-tổng-quan-kiến-trúc-dual-harness)
2. [Phần 1: Hướng Dẫn Cài Đặt Chi Tiết (Step-by-Step)](#2-phần-1-hướng-dẫn-cài-đặt-chi-tiết-step-by-step)
   - [2.1. Yêu cầu môi trường](#21-yêu-cầu-môi-trường)
   - [2.2. Cài đặt trên Google Antigravity (Tự động 100%)](#22-cài-đặt-trên-google-antigravity-tự-động-100)
   - [2.3. Cài đặt trên Claude Code (CLI / VS Code / Desktop)](#23-cài-đặt-trên-claude-code-cli--vs-code--desktop)
   - [2.4. Công tắc Chế độ Trình duyệt (`Browser Mode Switch`)](#24-công-tắc-chế-độ-trình-duyệt-browser-mode-switch)
   - [2.5. Kiểm tra sức khỏe bộ Kit & Đồng bộ Dual-Harness](#25-kiểm-tra-sức-khỏe-bộ-kit--đồng-bộ-dual-harness)
   - [2.6. Tích hợp vào dự án có sẵn hoặc dọn sạch khi sang dự án mới](#26-tích-hợp-vào-dự-án-có-sẵn-hoặc-dọn-sạch-khi-sang-dự-án-mới)
3. [Phần 2: Bản Đồ Chọn Nhanh 36 Slash Commands Theo Nhu Cầu](#3-phần-2-bản-đồ-chọn-nhanh-36-slash-commands-theo-nhu-cầu)
4. [Phần 3: 5 Ví Dụ Thực Chiến Từ Đầu Đến Cuối (Copy & Chạy Ngay)](#4-phần-3-5-ví-dụ-thực-chiến-từ-đầu-đến-cuối-copy--chạy-ngay)
   - [Ví dụ 1: Hệ thống chỉ có giao diện Web — Khám phá, sinh Requirements & Manual Test Cases (AI-RBT)](#ví-dụ-1-hệ-thống-chỉ-có-giao-diện-web--khám-phá-sinh-requirements--manual-test-cases-ai-rbt)
   - [Ví dụ 2: Thực thi Manual Test Cases tự động trên Browser thật, bắt Bug & Retest](#ví-dụ-2-thực-thi-manual-test-cases-tự-động-trên-browser-thật-bắt-bug--retest)
   - [Ví dụ 3: Cập nhật Requirements & Test Cases khi có Ticket thay đổi (`DELTA Mode`)](#ví-dụ-3-cập-nhật-requirements--test-cases-khi-có-ticket-thay-đổi-delta-mode)
   - [Ví dụ 4: Dựng khung Automation Playwright & Chuyển Manual TC thành Code chạy xanh](#ví-dụ-4-dựng-khung-automation-playwright--chuyển-manual-tc-thành-code-chạy-xanh)
   - [Ví dụ 5: Kiểm thử API từ Swagger, Lập Ma trận Truy vết (RTM) & Báo cáo Release GO/NO-GO](#ví-dụ-5-kiểm-thử-api-từ-swagger-lập-ma-trận-truy-vết-rtm--báo-cáo-release-gono-go)
5. [Phần 4: Hướng Dẫn Sử Dụng 3 Công Cụ Offline Report Viewer (`bundle.html`)](#5-phần-4-hướng-dẫn-sử-dụng-3-công-cụ-offline-report-viewer-bundlehtml)
6. [Phần 5: Xử Lý Nhanh Các Tình Huống Thường Gặp (Troubleshooting)](#6-phần-5-xử-lý-nhanh-các-tình-huống-thường-gặp-troubleshooting)

---

## 1. Tổng Quan Kiến Trúc Dual-Harness

Bộ kit được thiết kế theo kiến trúc **Single Source of Truth + Dual-Harness Sync**, cho phép cùng một kho kỹ năng hoạt động đồng nhất trên cả **Claude Code** và **Google Antigravity**:

| Thành phần | Trên Claude Code | Trên Google Antigravity | Vai trò |
|---|---|---|---|
| **Always-Loaded Context** | [`CLAUDE.md`](CLAUDE.md) | [`AGENTS.md`](AGENTS.md) | Quy tắc toàn cục luôn nạp sẵn (Git Read-Only, Headless `1920×1080`, 3-Tier Read Ladder, RTM Invariants) |
| **Workflow Dispatchers (36 lệnh)** | [`.claude/commands/*.md`](.claude/commands/) | [`.agents/skills/<cmd>/SKILL.md`](.agents/skills/) | 36 lệnh `/command` điều phối quy trình kiểm thử theo từng chặng |
| **Core Skills (20 kỹ năng)** | [`.claude/skills/*/SKILL.md`](.claude/skills/) | Nạp qua [`.agents/skills.json`](.agents/skills.json) | 20 bộ kỹ năng chuyên sâu (AI-RBT, Requirements, Automation, API, Locator, Review...) |
| **Engineering Rules (6 chuẩn)** | [`.claude/rules/*.md`](.claude/rules/) | Tham chiếu trực tiếp từ `.claude/rules/` | Chuẩn POM, Smart Waits, Allure Reporting, Playwright, Selenium, Appium |
| **Playwright MCP Server** | [`.mcp.json`](.mcp.json) | [`.agents/plugins/claude-testing-skills/mcp_config.json`](.agents/plugins/claude-testing-skills/mcp_config.json) | Điều khiển trình duyệt thật (dùng chung [`.claude/playwright-mcp-config.json`](.claude/playwright-mcp-config.json)) |

---

## 2. Phần 1: Hướng Dẫn Cài Đặt Chi Tiết (Step-by-Step)

### 2.1. Yêu cầu môi trường

Mở Terminal (hoặc PowerShell trên Windows) và kiểm tra:

```bash
node -v   # Yêu cầu Node.js >= 20 LTS (khuyến nghị Node 20 hoặc 22/24)
npx -v    # Đi kèm Node.js, dùng để khởi chạy @playwright/mcp
```

Nếu máy chưa từng tải trình duyệt Chromium cho Playwright, chạy 1 lần lệnh sau:

```bash
npx playwright install chromium
```

---

### 2.2. Cài đặt trên Google Antigravity (Tự động 100%)

Khi mở thư mục gốc của repo này trong **Google Antigravity IDE** hoặc chạy `agy` CLI:

1. **Mở Workspace:** Chọn **File → Open Folder** và trỏ vào thư mục `claude-testing-skills-main`.
2. **Tự động nhận diện:**
   - Antigravity tự động nạp [`AGENTS.md`](AGENTS.md) làm quy tắc hệ thống.
   - Tự động nạp **36 lệnh điều phối** từ `.agents/skills/` và **20 kỹ năng lõi** qua [`.agents/skills.json`](.agents/skills.json) (đảm bảo không trùng lặp).
   - Tự động cấu hình **Playwright MCP** ở chế độ **Headless `1920×1080`** qua plugin [`.agents/plugins/claude-testing-skills/mcp_config.json`](.agents/plugins/claude-testing-skills/mcp_config.json).
3. **Bắt đầu sử dụng ngay:** Mở khung chat Agent và gõ trực tiếp tên lệnh (ví dụ `/discover-system`, `/generate-testcases-manual-rbt`, `/browser-mode`) hoặc mô tả yêu cầu bằng Tiếng Việt.

---

### 2.3. Cài đặt trên Claude Code (CLI / VS Code / Desktop)

#### Cách A: Claude Code CLI hoặc VS Code Extension (Khuyến nghị)
1. Mở Terminal tại thư mục gốc của dự án (hoặc mở thư mục trong VS Code đã cài extension **Claude Code**).
2. Chạy lệnh khởi động:
   ```bash
   claude
   ```
3. Claude Code tự động đọc [`CLAUDE.md`](CLAUDE.md), `.claude/commands/`, `.claude/skills/`, `.claude/rules/` và kết nối trình duyệt qua [`.mcp.json`](.mcp.json).
4. Kiểm tra kết nối MCP trong phiên chat bằng cách gõ:
   ```text
   /mcp
   ```
   Đảm bảo server `playwright` hiển thị trạng thái **connected**.

#### Cách B: Claude Desktop App
Nếu dùng ứng dụng **Claude Desktop**, vào **Settings → Developer → Local MCP servers → Edit Config** để mở `claude_desktop_config.json` và thêm khối `playwright` (chi tiết kèm cách kết nối Jira/Slack/GitHub xem tại [`SETUP_CLAUDE.md`](SETUP_CLAUDE.md)).

---

### 2.4. Công tắc Chế độ Trình duyệt (`Browser Mode Switch`)

Mặc định, bộ kit chạy trình duyệt ở chế độ **Headless Mode (`1920×1080`, tắt GPU)** để tiết kiệm RAM/GPU và chụp ảnh bằng chứng không bị thanh tác vụ của hệ điều hành che khuất. Khi bạn muốn **nhìn trực tiếp trình duyệt thao tác** hoặc cần **tự tay nhập CAPTCHA / OTP / 2FA**, hãy chuyển sang **Headed Mode (`1600×750`)**:

| Thao tác | Lệnh NPM (ngắn gọn) | Lệnh Node CLI đầy đủ | Trong khung Chat AI |
|---|---|---|---|
| **Xem trạng thái hiện tại** | `npm run browser:status` | `node scripts/browser-mode.mjs status` | `/browser-mode status` |
| **Chuyển sang Headless (`1920×1080`)** | `npm run browser:headless` | `node scripts/browser-mode.mjs headless` | `/browser-mode headless` |
| **Chuyển sang Headed (`1600×750`, hiện UI)** | `npm run browser:headed` | `node scripts/browser-mode.mjs headed` | `/browser-mode headed` |
| **Bật quay video phiên MCP** | — | `node scripts/browser-mode.mjs headless --video=on` | `/browser-mode headless --video=on` |
| **Tắt quay video phiên MCP** | — | `node scripts/browser-mode.mjs headless --video=off` | `/browser-mode --video=off` |

> 💡 **Lưu ý:** Công tắc `browser-mode.mjs` tự động cập nhật đồng thời cả `.mcp.json` (Claude Code), `.agents/plugins/claude-testing-skills/mcp_config.json` (Antigravity) và `.claude/playwright-mcp-config.json`.

---

### 2.5. Kiểm tra sức khỏe bộ Kit & Đồng bộ Dual-Harness

Bất kỳ lúc nào bạn chỉnh sửa nội dung trong `.claude/` hoặc `CLAUDE.md`, hãy chạy 2 lệnh sau để đồng bộ sang `.agents/` và kiểm tra toàn vẹn hệ thống:

```bash
# 1. Đồng bộ từ .claude/ & CLAUDE.md sang .agents/ & AGENTS.md
npm run sync

# 2. Chạy bộ kiểm thử 9 cổng (kiểm tra đồng bộ, token budget, 346+ liên kết & parser)
npm run check
```

Kết quả mong đợi khi mọi thứ chuẩn 100%:
```text
Antigravity customizations are 100% in sync (36 slash commands + 20 core skills + AGENTS.md + Playwright MCP).
ℹ tests 9
ℹ pass 9
ℹ fail 0
```

---

### 2.6. Tích hợp vào dự án có sẵn hoặc dọn sạch khi sang dự án mới

- **Trường hợp 1 — Bắt đầu kiểm thử một dự án mới ngay trong repo này:**
  Xoá dữ liệu đầu ra của dự án cũ bằng lệnh:
  ```bash
  rm -rf docs .playwright-mcp task.md .claude/settings.local.json
  ```
  Các thư mục khung (`.claude/`, `.agents/`, `scripts/`, `CLAUDE.md`, `AGENTS.md`) được giữ nguyên.

- **Trường hợp 2 — Copy bộ Kit sang một repo dự án phần mềm có sẵn:**
  Copy các thành phần khung sang thư mục gốc của dự án đích:
  ```bash
  cp -R .claude .agents scripts CLAUDE.md AGENTS.md .mcp.json package.json /duong-dan/du-an-cua-ban/
  ```

---

## 3. Phần 2: Bản Đồ Chọn Nhanh 36 Slash Commands Theo Nhu Cầu

Bạn không cần nhớ hết 36 lệnh. Chỉ cần đối chiếu **"Đầu vào đang có"** và **"Kết quả mong muốn"** trong bảng dưới đây:

### Nhóm A — Khảo sát Hệ thống & Phân tích Yêu cầu (`docs/requirements/`)
| Tình huống của bạn | Lệnh cần gõ | Kết quả đầu ra |
|---|---|---|
| Hệ thống mới tinh, chưa có tài liệu, cần lập bản đồ các module & cấp mã prefix | `/discover-system` | `docs/requirements/README.md` + `_discovery/system_map.md` |
| Có URL trang web/app, muốn AI tự mở trình duyệt dò form, bắt lỗi validation & viết Requirement | `/generate-requirements-from-website` | `docs/requirements/<module>/requirements_<module>.md` + ảnh `evidence/` |
| Có tài liệu `.docx`/`.pdf`/`.xlsx` hoặc Jira ticket, muốn phân tích điểm mờ (`AMB`) & rủi ro (`RISK`) | `/analyze-requirement-document` | `docs/requirements/<module>/analysis/<slug>_analysis.md` |
| Cần kéo trực tiếp mô tả & bình luận từ Jira (theo Issue Key, Epic, JQL) về máy | `/fetch-jira-requirements` | File Markdown/JSON requirement từ Jira |
| Module **đã có** `requirements_<module>.md`, nay có ticket thay đổi/bổ sung tính năng | `/update-requirements-from-ticket` | Cập nhật tại chỗ `requirements_<module>.md` (giữ `REQ ID`) + `impact_<ticket>.md` |

### Nhóm B — Thiết kế & Review Manual Test Cases (`docs/testcases/`)
| Tình huống của bạn | Lệnh cần gõ | Kết quả đầu ra |
|---|---|---|
| Hệ thống quan trọng/phức tạp, cần sinh TC bài bản qua **6 bước AI-RBT** (có Q&A & duyệt 4 Vòng) | `/generate-testcases-manual-rbt` | `docs/testcases/<module>/test_cases_<module>.md` (Bảng 13 cột chuẩn) |
| Requirements đã rõ, phạm vi 1 module, muốn sinh nhanh bộ TC 4 Vòng trong **1 lượt duy nhất** | `/generate-testcases-from-requirements` | `docs/testcases/<module>/test_cases_<module>.md` (`QUICK Mode`) |
| Cần danh sách kiểm tra ngắn gọn (`☐`) để tick tay cho Smoke / Hotfix / trước giờ Release | `/generate-checklist-test` | Checklist ngắn gọn (`≤ 2 phút/mục`) |
| Module **đã có** bộ TC, vừa chạy `/update-requirements-from-ticket`, cần cập nhật TC mà **không làm đổi mã `TC ID` cũ** | `/update-testcases-from-impact` | Cập nhật TC tại chỗ (`PLAN` / `APPLY`) + xuất `Delta TC List` |
| Đã có bộ TC (do người hoặc AI viết), muốn chấm điểm chất lượng (thang 12) & tìm lỗ hổng độ phủ | `/review-testcases` | Báo cáo Review (`REVIEW Mode`) hoặc tự sửa lấp gap (`FIX Mode`) |
| Tính năng đi xuyên qua nhiều module nối tiếp (VD: Đặt hàng → Thanh toán → Kho → Hoá đơn) | `/generate-cross-module-test-plan` | Bản đồ liên module + Ma trận kết hợp (Pairwise / Output-Class) |
| Cần lập chiến lược điều phối thứ tự kiểm thử toàn ứng dụng đa module | `/generate-application-test-plan` | Chiến lược kiểm thử tổng thể cấp ứng dụng |

### Nhóm C — Thực thi Manual Test, Báo cáo Bug & Nghiệm thu (`docs/executions/` & `docs/bugs/`)
| Tình huống của bạn | Lệnh cần gõ | Kết quả đầu ra |
|---|---|---|
| Muốn AI mở trình duyệt thật chạy từng TC trong `test_cases_<module>.md`, tự chấm `PASS`/`FAIL` & chụp ảnh | `/execute-test-cases` | `docs/executions/<module>/run_<ts>/execution_report.md` + `evidence/` |
| Có TC bị `FAIL` (khi chạy tay hoặc chạy automation), cần tạo Bug Report chuẩn kèm ảnh chứng cứ | `/create-bug-report` | `docs/bugs/<module>/BUG_<module>_<ts>_<TC_ID>.md` + cập nhật `docs/bugs/README.md` |
| Dev báo đã sửa xong bug, cần kiểm tra lại bug đó + chạy regression các case xung quanh | `/retest-fixed-bugs` | Chấm `FIXED` / `NOT_FIXED` / `PARTIAL`, cập nhật bảng `## Lịch sử retest` |
| Cần phân tích báo cáo chạy test (Manual hoặc Automation), gom nhóm lỗi theo nguyên nhân gốc rễ | `/analyze-test-report` | Báo cáo gom nhóm Root Cause & thứ tự ưu tiên xử lý |

### Nhóm D — Xây dựng, Chạy & Bảo trì Test Automation
| Tình huống của bạn | Lệnh cần gõ | Kết quả đầu ra |
|---|---|---|
| Dự án chưa có khung code Automation, cần dựng mới chuẩn POM + Parallel 5 luồng + Allure + CI/CD | `/generate-automation-framework` | Khung project hoàn chỉnh (Playwright TS/Java, Selenium Java, Pytest, Appium...) |
| Đã có bộ Manual TC đã duyệt, muốn chuyển thành code Automation chuẩn POM chạy PASS $\ge 2$ lần | `/generate-automation-from-testcases` | Page Objects + Test Scripts gắn `allure.label('testId', '<TC_ID>')` |
| Chưa có TC, muốn AI tự mở web dò một luồng thao tác rồi viết thẳng thành code Automation E2E | `/generate-automation-from-ui-flow` | Page Objects + E2E Test Script từ DOM thực tế |
| Muốn tự động hóa luồng ứng dụng Mobile (Android/iOS Native, Flutter, Hybrid) qua ADB & Appium | `/generate-automation-from-mobile-flow` | Mobile Page Objects + Appium Test Script |
| Có file Swagger / OpenAPI (`.json`/`.yaml` hoặc URL), muốn sinh TC + code API Automation (12 mã HTTP & OWASP) | `/generate-api-tests-from-swagger` | Bộ tài liệu TC API và/hoặc API Automation Scripts |
| Cần trích xuất bộ định vị phần tử (Primary + Fallback Locator) bền vững từ màn hình đang mở | `/generate-locator` | Bảng Locator đã kiểm chứng độ duy nhất (`count === 1`) |
| Giao diện web mới thay đổi làm gãy test, cần quét và tự động hàn gắn lại Locator trong Page Object | `/heal-locators` | Cập nhật Locator mới (`SCAN` / `HEAL`) |
| Cần chạy bộ Automation hiện có, phân loại lỗi và tự sửa các lỗi thuộc phạm vi script/locator | `/run-and-fix-tests` | Test chạy xanh ổn định; giữ đỏ nếu phát hiện App Bug thật |
| Có các bài test lúc PASS lúc FAIL (flaky), cần chẩn đoán race condition / hard sleep và khử flaky | `/analyze-flaky-tests` | Báo cáo nguyên nhân Flaky & sửa code (`ANALYZE` / `FIX`) |
| Muốn kiểm định chất lượng code Automation theo Rubric 6 nhóm (12 điểm) & Definition of Done | `/review-automation-code` | Báo cáo Review code (phát hiện pass giả, hard sleep, inline locator) |
| Bộ Manual TC vừa cập nhật theo `Delta TC List`, cần đồng bộ sang script Automation tương ứng | `/update-automation-from-impact` | Cập nhật đúng test method bị ảnh hưởng (`PLAN` / `APPLY`) |
| Cần sinh bộ dữ liệu test (Test Data) đa dạng cho Form/API hoặc theo ma trận kết hợp đa chiều | `/generate-test-data` · `/generate-combinatorial-test-data` | File JSON / CSV / TypeScript factory có tiền tố truy vết |
| Backend chưa làm xong hoặc cần giả lập lỗi `500`, `401`, timeout, danh sách rỗng/lớn | `/generate-api-mocks` | Code攔 bắt route (Playwright `page.route` / WireMock) kèm test |
| Cần đẩy kết quả chạy Automation (Playwright JSON / JUnit XML) lên Jira Xray | `/import-test-results-xray` | Đồng bộ Test Execution lên Xray Cloud/Server |

### Nhóm E — Quản lý Dự án, Truy vết RTM & Tài liệu Người dùng cuối
| Tình huống của bạn | Lệnh cần gõ | Kết quả đầu ra |
|---|---|---|
| Cần lập kế hoạch kiểm thử tổng thể cấp quản lý (ISO/IEC/IEEE 29119-3) để trình PM/Khách hàng ký duyệt | `/generate-master-test-plan` | Tài liệu Master Test Plan (phạm vi, tiêu chí vào/ra, nhân sự, rủi ro) |
| Cần chứng minh độ phủ 3 tầng `Requirement ↔ Manual TC ↔ Automation Script`, tìm REQ bị bỏ sót | `/generate-traceability-matrix` | Ma trận truy vết RTM (`docs/traceability_matrix.md`) |
| Cuối Sprint / trước giờ Release, cần tổng hợp kết quả chạy test + bug còn mở để đề xuất **GO / NO-GO** | `/generate-test-summary-report` | Báo cáo tổng kết kiểm thử kèm khuyến nghị GO / NO-GO có căn cứ |
| Cần viết tài liệu Hướng dẫn sử dụng (User Guide) có ảnh minh họa cho người dùng cuối | `/generate-user-guide` | `docs/user-guides/<module>/user_guide_<module>.md` |

---

## 4. Phần 3: 5 Ví Dụ Thực Chiến Từ Đầu Đến Cuối (Copy & Chạy Ngay)

Dưới đây là 5 kịch bản thực tế hoàn chỉnh. Bạn có thể copy trực tiếp các khối lệnh mẫu vào khung chat của **Antigravity** hoặc **Claude Code** để trải nghiệm.

---

### Ví dụ 1: Hệ thống chỉ có giao diện Web — Khám phá, sinh Requirements & Manual Test Cases (AI-RBT)

**🎯 Bối cảnh thực tế:**
Bạn vừa nhận dự án kiểm thử website thương mại điện tử mẫu `https://www.saucedemo.com` (hoặc trang quản trị nội bộ của công ty). Dự án **chưa có tài liệu SRS**, **chưa có bất kỳ test case nào**.

#### Bước 1.1 — Khám phá toàn hệ thống (`/discover-system`)
Gõ vào khung chat AI:

```text
/discover-system
URL: https://www.saucedemo.com
Tài khoản:
- Standard User: standard_user / secret_sauce
- Locked Out User: locked_out_user / secret_sauce
Môi trường: Dùng riêng cho QA
Năng lực kiểm thử của QA: Có quyền dùng DevTools (Network/Storage), không có quyền truy cập trực tiếp DB.
```

**AI sẽ thực hiện:**
1. Mở trình duyệt ở chế độ **Headless `1920×1080`**, đăng nhập và quét toàn bộ cấu trúc điều hướng.
2. Đề xuất danh sách module kèm **Tiền tố (Prefix)** bất biến:
   - `LOGIN` (Đăng nhập & Phiên làm việc)
   - `INV` (Danh mục sản phẩm & Bộ lọc)
   - `CART` (Giỏ hàng)
   - `CHK` (Thanh toán Checkout)
3. **Dừng tại Checkpoint** hỏi bạn xác nhận danh sách module và thứ tự ưu tiên trước khi ghi:
   - `docs/requirements/README.md` (Danh mục module + thông tin môi trường + năng lực QA cho Vòng 3)
   - `docs/requirements/_discovery/system_map.md` (Sơ đồ luồng liên kết giữa các màn hình)

#### Bước 1.2 — Phân tích & Sinh tài liệu Requirements từ giao diện thật (`/generate-requirements-from-website`)
Sau khi chốt bản đồ hệ thống, yêu cầu AI khảo sát sâu module `login`:

```text
/generate-requirements-from-website
Module: login (Prefix: LOGIN)
URL: https://www.saucedemo.com
Hãy kiểm tra đầy đủ trạng thái mặc định, thử bỏ trống từng trường, nhập sai mật khẩu, và đăng nhập bằng locked_out_user để bắt chính xác thông báo lỗi nguyên văn.
```

**AI sẽ thực hiện:**
1. Đọc `docs/requirements/README.md` và `_discovery/system_map.md` theo **Chuỗi đọc 3 tầng**.
2. Dùng Playwright MCP trích xuất thuộc tính DOM thật (`placeholder`, `type="password"`, `maxlength`, `required`), chủ động kích hoạt từng lỗi validation để lấy câu thông báo nguyên văn (ví dụ: `"Epic sadface: Username is required"`, `"Epic sadface: Sorry, this user has been locked out."`).
3. Chụp ảnh bằng chứng lưu vào `docs/requirements/login/evidence/` và xuất file `docs/requirements/login/requirements_login.md` với các mã yêu cầu chuẩn (`REQ-LOGIN-01`, `REQ-LOGIN-02`...), danh mục điểm mờ (`AMB-LOGIN-01`) và rủi ro (`RISK-LOGIN-01`).

#### Bước 1.3 — Sinh bộ Manual Test Cases theo quy trình AI-RBT (`/generate-testcases-manual-rbt`)
Tiếp tục gõ vào khung chat:

```text
/generate-testcases-manual-rbt
Module: login
Tài liệu đầu vào: docs/requirements/login/requirements_login.md
Chế độ độ hạt: GỘP (mặc định)
```

*(Mẹo: Nếu muốn AI chạy thẳng 1 lượt không dừng hỏi qua 6 bước, bạn có thể dùng lệnh `/generate-testcases-from-requirements` thay cho `/generate-testcases-manual-rbt`).*

**AI sẽ thực hiện:**
1. Mở và đối chiếu **100% ảnh chụp màn hình** trong `docs/requirements/login/evidence/`.
2. Thiết kế Test Cases đi lần lượt qua **4 Vòng Kiểm Thử (`Test Rings`)**:
   - **Vòng 1 (`V1 Smoke`):** Kiểm tra giao diện cơ bản (`UI cơ bản`), đăng nhập thành công với `standard_user`, đăng xuất.
   - **Vòng 2 (`V2 Functional`):** Bỏ trống từng trường (`Required`), validation dữ liệu sai, tài khoản bị khoá (`locked_out_user`), nút đóng thông báo lỗi `[x]`.
   - **Vòng 3 (`V3 Technical`):** Kiểm tra truy cập trực tiếp `/inventory.html` khi chưa đăng nhập (Permission/Session), kiểm tra lưu trữ cookie/localStorage bằng DevTools (gắn tag `@TechCheck`), SQLi/XSS cơ bản trên ô Username.
   - **Vòng 4 (`V4 Non-functional`):** Điều hướng bằng bàn phím (`Tab` / `Enter`), hiển thị responsive, nhấn đúp nút Login liên tiếp (Double Submit).
3. Tự kiểm định qua **11 tiêu chí AI Self-Quality Gate** và ghi ra file `docs/testcases/login/test_cases_login.md` theo đúng **chuẩn bảng 13 cột**:

```markdown
| TC ID | REQ ID | Module | Risk Level | Test Title | Pre-Condition | Test Steps | Expected Result | Priority | Test Data | Automatable | Auto Type | Tags |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| TC_LOGIN_001 | REQ-LOGIN-01 | Login | Cao | Kiểm tra bố cục và trạng thái mặc định màn hình Đăng nhập | Người dùng chưa đăng nhập | 1. Mở trang `https://www.saucedemo.com`<br>2. Quan sát các thành phần trên form đăng nhập | 1. Hiển thị tiêu đề `Swag Labs`<br>2. Ô `Username` và `Password` trống, nút `Login` hiển thị rõ và cho phép bấm | High | URL: `https://www.saucedemo.com` | Yes | UI | `@Smoke, @UI` |
```

---

### Ví dụ 2: Thực thi Manual Test Cases tự động trên Browser thật, bắt Bug & Retest

**🎯 Bối cảnh thực tế:**
Bạn đã có file `docs/testcases/login/test_cases_login.md`. Thay vì tự tay ngồi bấm từng case và chụp ảnh màn hình dán vào báo cáo, bạn giao cho AI thực thi trên trình duyệt thật.

#### Bước 2.1 — Chạy kiểm thử và chấm kết quả (`/execute-test-cases`)
Gõ vào khung chat:

```text
/execute-test-cases
File test cases: docs/testcases/login/test_cases_login.md
Phạm vi chạy: Chỉ chạy các test case có tag @Smoke và @Security
Môi trường: https://www.saucedemo.com
```

**AI sẽ thực hiện:**
1. Mở trình duyệt qua Playwright MCP, thực hiện tuần tự từng bước trong cột `Test Steps` với dữ liệu trong cột `Test Data`.
2. Đối chiếu kết quả thực tế trên màn hình với cột `Expected Result`:
   - Nếu khớp hoàn toàn → chấm **`PASS`**, chụp ảnh viewport lưu vào `docs/executions/login/run_<timestamp>/evidence/`.
   - Nếu sai khác → chấm **`FAIL`**, chụp ảnh toàn trang (`fullPage: true`), thu thập Console/Network error.
3. Xuất báo cáo `docs/executions/login/run_<timestamp>/execution_report.md`.

#### Bước 2.2 — Tạo Bug Report chuẩn từ Test Case bị FAIL (`/create-bug-report`)
Giả sử `TC_LOGIN_005` bị `FAIL`, bạn gõ:

```text
/create-bug-report
Từ kết quả chạy tại: docs/executions/login/run_20261014_1730/execution_report.md
Tạo bug report cho TC_LOGIN_005.
```

**AI sẽ thực hiện:**
1. Tạo file `docs/bugs/login/BUG_login_20261014_TC_LOGIN_005.md` có đầy đủ: Mức độ nghiêm trọng (`Severity` / `Priority`), Các bước tái hiện (`Steps to Reproduce`), Kết quả thực tế vs Kết quả mong đợi, link trực tiếp tới ảnh chụp lỗi trong `docs/executions/`, và bảng `## Lịch sử retest` ở cuối file.
2. Cập nhật danh mục tổng hợp tại `docs/bugs/README.md`.

#### Bước 2.3 — Kiểm tra lại sau khi Dev sửa lỗi (`/retest-fixed-bugs`)
Khi Developer báo đã fix xong `BUG_login_20261014_TC_LOGIN_005`, bạn gõ:

```text
/retest-fixed-bugs
File bug: docs/bugs/login/BUG_login_20261014_TC_LOGIN_005.md
Chế độ: FULL (chạy lại kịch bản tái hiện bug + chạy regression các TC liên cùng nhóm REQ-LOGIN-02)
```

---

### Ví dụ 3: Cập nhật Requirements & Test Cases khi có Ticket thay đổi (`DELTA Mode`)

**🎯 Bối cảnh thực tế:**
Dự án đang chạy ổn định, mã `REQ-LOGIN-01..05` và `TC_LOGIN_001..015` đã được gắn vào code Automation và báo cáo RTM. Nay BA đưa ticket mới `CR-108` yêu cầu thay đổi nghiệp vụ. **Tuyệt đối không được chạy lại `/generate-testcases-manual-rbt` từ đầu** vì sẽ đánh lại số `TC ID` làm gãy toàn bộ liên kết!

#### Bước 3.1 — Cập nhật Requirements theo chế độ Delta (`/update-requirements-from-ticket`)
Gõ vào khung chat:

```text
/update-requirements-from-ticket
Module: login
Tài liệu hiện tại: docs/requirements/login/requirements_login.md
Mã ticket: CR-108
Nội dung thay đổi:
1. Sửa quy tắc khoá tài khoản (REQ-LOGIN-03): Khoá sau 3 lần nhập sai liên tiếp thay vì 5 lần.
2. Thêm mới tính năng: Hiển thị link "Quên mật khẩu?" bên dưới nút Login.
3. Bỏ tính năng: Gỡ bỏ checkbox "Ghi nhớ đăng nhập 30 ngày".
```

**AI sẽ thực hiện:**
1. Phân loại thay đổi thành **THÊM / SỬA / BỎ**:
   - **SỬA** trực tiếp nội dung `REQ-LOGIN-03` (giữ nguyên mã `REQ-LOGIN-03`, tăng version).
   - **THÊM** mã mới tiếp nối ở cuối dải số (`REQ-LOGIN-06` cho link Quên mật khẩu).
   - **BỎ** bằng cách chuyển trạng thái `REQ-LOGIN-04` sang `🔴 Deprecated` (không xoá dòng để giữ lịch sử).
2. Ghi nhận vào bảng **Nhật ký thay đổi** và xuất báo cáo tác động `docs/requirements/login/analysis/impact_CR-108.md`.

#### Bước 3.2 — Đồng bộ sang bộ Manual Test Cases (`/update-testcases-from-impact`)
Tiếp tục gõ:

```text
/update-testcases-from-impact
Module: login
Impact Report: docs/requirements/login/analysis/impact_CR-108.md
Chế độ: PLAN
```

Sau khi xem bảng kế hoạch AI đề xuất (TC nào sẽ sửa, TC nào đánh dấu `🗑️ Deprecated`, TC nào thêm mới từ `TC_LOGIN_016`), bạn gõ `APPLY` để AI cập nhật trực tiếp vào `docs/testcases/login/test_cases_login.md` và xuất `Delta TC List` cho đội Automation.

---

### Ví dụ 4: Dựng khung Automation Playwright & Chuyển Manual TC thành Code chạy xanh

**🎯 Bối cảnh thực tế:**
Bạn muốn tự động hóa bộ Test Cases `docs/testcases/login/test_cases_login.md` bằng **Playwright + TypeScript + Allure Report**.

#### Bước 4.1 — Khởi tạo khung dự án Automation (`/generate-automation-framework`)
Gõ vào khung chat:

```text
/generate-automation-framework
Nền tảng: Web
Framework: Playwright
Ngôn ngữ: TypeScript
Báo cáo: Allure Report (cài local trong project)
URL mặc định: https://www.saucedemo.com
```

**AI sẽ thực hiện:**
Dựng khung dự án chuẩn Page Object Model (`BasePage`, fixtures, `TestDataGenerator`, cấu hình chạy song song 5 workers, tự động đính kèm ảnh chụp màn hình cuối mỗi test cho cả PASS & FAIL, và file GitHub Actions CI/CD).

#### Bước 4.2 — Sinh script Automation từ danh sách Manual Test Cases (`/generate-automation-from-testcases`)
Gõ vào khung chat:

```text
/generate-automation-from-testcases
File test cases: docs/testcases/login/test_cases_login.md
Phạm vi: Các test case có Automatable = Yes và tag @Smoke
```

**AI sẽ thực hiện:**
1. **Recon:** Mở trình duyệt thật đến `https://www.saucedemo.com`, đọc DOM thực tế để lấy các bộ định vị bền vững (`getByTestId`, `getByRole`, `getByLabel` — tuyệt đối không đoán mò selector).
2. **Implementation:** Tạo `pages/LoginPage.ts` và `tests/login.spec.ts` với đầy đủ 5 nhãn Allure (`feature`, `story`, `severity`, `owner`, và `allure.label('testId', 'TC_LOGIN_001')`) cùng các bước `Arrange:` / `Act:` / `Assert:` bằng Tiếng Việt.
3. **Execution & Self-fix:** Tự chạy `npx playwright test` ngay lập tức; nếu có lỗi locator/wait thì tự sửa đến khi chạy **PASS ổn định $\ge 2$ lần liên tiếp**.

#### Bước 4.3 — Kiểm định chất lượng Code Automation (`/review-automation-code`)
Gõ vào khung chat:

```text
/review-automation-code
Thư mục cần review: tests/ và pages/
Chế độ: REVIEW
```

AI sẽ chấm điểm trên thang **12 điểm (6 nhóm tiêu chí Definition of Done)**, chỉ rõ từng dòng nếu có lỗi "pass giả" (`expect(true).toBe(true)`), `waitForTimeout` cứng, hoặc locator bị viết trực tiếp trong file test.

---

### Ví dụ 5: Kiểm thử API từ Swagger, Lập Ma trận Truy vết (RTM) & Báo cáo Release GO/NO-GO

#### Bước 5.1 — Sinh kiểm thử API toàn diện từ Swagger (`/generate-api-tests-from-swagger`)
Gõ vào khung chat:

```text
/generate-api-tests-from-swagger
Nguồn Swagger: https://petstore3.swagger.io/api/v3/openapi.json
Endpoints cần viết: POST /pet, GET /pet/{petId}, PUT /pet, DELETE /pet/{petId}
Chế độ: FULL (Sinh cả tài liệu Markdown Test Cases và code Playwright APIRequestContext)
```

AI sẽ tự động thiết kế kịch bản bao phủ **12 mã HTTP Status Codes** (`200`, `201`, `400`, `401`, `403`, `404`, `406`, `409`, `413`, `415`, `429`, `500`), kiểm tra **OWASP API Security** (BOLA/IDOR, Mass Assignment, SQLi/XSS), kiểm tra SLA thời gian phản hồi `< 2000ms` và tự động dọn dữ liệu (`DELETE`) trong `afterEach`.

#### Bước 5.2 — Lập Ma trận Truy vết 3 tầng (`/generate-traceability-matrix`)
Trước khi họp chốt Release, gõ:

```text
/generate-traceability-matrix
```

AI sẽ quét toàn bộ `docs/requirements/`, `docs/testcases/`, và thư mục `tests/` để lập bảng đối chiếu `REQ ID ↔ TC ID ↔ Automation Script`, chỉ rõ tỷ lệ bao phủ (%) và cảnh báo ngay nếu có Requirement nào chưa có Test Case (`🔴 Uncovered`).

#### Bước 5.3 — Xuất Báo cáo Tổng kết Kiểm thử & Khuyến nghị GO/NO-GO (`/generate-test-summary-report`)
Gõ vào khung chat:

```text
/generate-test-summary-report
Mốc báo cáo: Release v1.2.0
```

AI sẽ tổng hợp toàn bộ kết quả từ `docs/executions/`, danh sách bug còn mở trong `docs/bugs/`, và độ phủ từ RTM để xuất báo cáo chuẩn ISO/IEC/IEEE 29119-3 kèm đề xuất **GO** hoặc **NO-GO** có số liệu chứng minh.

---

## 5. Phần 4: Hướng Dẫn Sử Dụng 3 Công Cụ Offline Report Viewer (`bundle.html`)

Bộ kit đi kèm **3 ứng dụng Web Viewer độc lập** được đóng gói sẵn thành 1 file HTML duy nhất (`bundle.html`). Bạn **không cần cài đặt web server hay mạng Internet** — chỉ cần nhấp đúp chuột mở trực tiếp trên trình duyệt:

| Công cụ | Đường dẫn file mở trực tiếp | File đầu vào (Kéo & Thả vào giao diện) | Tính năng chính |
|---|---|---|---|
| **1. Test Cases Viewer** | [`scripts/testcases-viewer/bundle.html`](scripts/testcases-viewer/bundle.html) | Một hoặc nhiều file `test_cases_<module>.md` (hoặc `part_*.md`) | Tìm kiếm toàn văn, lọc theo Module / Nhóm chức năng / Priority (`Critical`, `High`, `Medium`, `Low`) / Automatable / Tags (`@Smoke`...), sắp xếp tự nhiên theo `TC ID` và `Risk Level` (`Cao`/`Trung bình`/`Thấp`), **xuất thẳng ra file Excel (`.xlsx` chia sheet theo nhóm) hoặc `.csv`** |
| **2. Execution Viewer** | [`scripts/execution-viewer/bundle.html`](scripts/execution-viewer/bundle.html) | Các file `execution_report.md` từ `docs/executions/` | Xem biểu đồ tỷ lệ `PASS` / `FAIL` / `BLOCKED` / `SKIPPED`, so sánh xu hướng giữa các lần chạy (Run Comparison), xem ảnh chụp bằng chứng trực quan |
| **3. Bugs Viewer** | [`scripts/bugs-viewer/bundle.html`](scripts/bugs-viewer/bundle.html) | File `docs/bugs/README.md` và các file `BUG_*.md` | Tra cứu danh sách Bug theo mức độ nghiêm trọng (`Severity`/`Priority`), trạng thái (`Open`, `Fixed`, `Retested`), xem bước tái hiện và lịch sử retest |

**Cách sử dụng nhanh:**
1. Mở file `bundle.html` tương ứng trên Chrome / Edge / Firefox / Safari.
2. Bấm nút **+ Import file .md** ở góc phải trên cùng (hoặc **kéo-thả trực tiếp các file `.md`** từ thư mục `docs/` vào giữa màn hình).
3. Dữ liệu được lưu tự động trong `localStorage` của trình duyệt để bạn làm việc tiếp ngay cả khi F5 hoặc đóng tab.

---

## 6. Phần 5: Xử Lý Nhanh Các Tình Huống Thường Gặp (Troubleshooting)

| Triệu chứng / Lỗi gặp phải | Nguyên nhân | Cách khắc phục triệt để |
|---|---|---|
| AI báo không tìm thấy công cụ mở trình duyệt (`browser_navigate` không tồn tại) | Chưa bật Playwright MCP hoặc chưa nạp lại MCP sau khi đổi cấu hình | - Kiểm tra trạng thái bằng `npm run browser:status`<br>- Trong Claude Code CLI: gõ `/mcp` → chọn Reconnect<br>- Trong Antigravity: mở bảng **MCP Servers** → bấm Reload |
| Trang web cần đăng nhập qua **CAPTCHA / OTP / Google OAuth** làm chế độ Headless bị chặn | Chế độ Headless không có cửa sổ để người dùng tự nhập mã xác thực | 1. Chạy `npm run browser:headed` (hoặc gõ `/browser-mode headed`)<br>2. Để trình duyệt mở cửa sổ `1600×750`, đăng nhập thủ công qua CAPTCHA/OTP và yêu cầu AI lưu phiên vào `.auth/user_state.json`<br>3. Chuyển lại về Headless bằng `npm run browser:headless` |
| Trên Windows, Claude Desktop báo lỗi `spawn npx ENOENT` | Electron trên một số bản Windows không gọi trực tiếp được file `npx.cmd` | Mở file cấu hình MCP, đổi `"command": "npx", "args": ["-y", "@playwright/mcp"]` thành `"command": "cmd", "args": ["/c", "npx", "-y", "@playwright/mcp"]` (Xem chi tiết tại [`SETUP_CLAUDE.md`](SETUP_CLAUDE.md)) |
| Sửa file trong `.claude/commands/` hoặc `CLAUDE.md` nhưng bên Antigravity chưa cập nhật | Chưa chạy lệnh đồng bộ Dual-Harness | Chạy `npm run sync` để cập nhật `.agents/` và `AGENTS.md`, sau đó chạy `npm run check` để kiểm chứng |
| Import file `test_cases_<module>.md` vào `testcases-viewer/bundle.html` nhưng không hiện dòng nào | Bảng Markdown trong file thiếu cột bắt buộc (`TC ID`) hoặc mã TC không chứa chữ `TC` | Đảm bảo bảng dùng đúng dòng tiêu đề 13 cột chuẩn trong [`.claude/skills/skills-rbt-manual-testing/SKILL.md`](.claude/skills/skills-rbt-manual-testing/SKILL.md) và cột đầu tiên có dạng `TC_<MODULE>_<NNN>` |

---

## Tài Liệu Tham Chiếu Chuyên Sâu Trong Repo

- **Cài đặt nâng cao (Connectors Jira/Slack/GitHub & Lập lịch Cowork Schedule):** [`SETUP_CLAUDE.md`](SETUP_CLAUDE.md)
- **Quy trình 8 chặng Manual Testing chi tiết:** [`AI_FULL_FLOW_MANUAL.md`](AI_FULL_FLOW_MANUAL.md)
- **Quy trình 8 chặng Automation Testing chi tiết:** [`AI_FULL_FLOW_AUTOMATION.md`](AI_FULL_FLOW_AUTOMATION.md)
- **Từ điển thuật ngữ chuẩn của hệ thống (Domain Glossary):** [`GLOSSARY.md`](GLOSSARY.md)
- **32 Prompt mẫu điền sẵn dùng ngay:** [`prompts/README.md`](prompts/README.md)
