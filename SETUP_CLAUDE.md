# SETUP CLAUDE & ANTIGRAVITY — Hướng Dẫn Cài Đặt MCP, Connectors & Schedule

> **Đối tượng:** Tester dùng bộ Kit `claude-testing-skills` trên **Claude Code** hoặc **Google Antigravity**.
> **Mục tiêu:** Cài đủ 3 mảng — **Playwright MCP** (điều khiển browser thật), **Connectors** (Atlassian / Slack / GitHub / Claude in Chrome), và **Cowork Schedule** (tự động chạy task theo lịch).

> ⚡ **Sử dụng trên Google Antigravity (Workspace Dual-Harness — Tự động 100%):**
> Khi bạn mở trực tiếp thư mục dự án này trong **Antigravity**, hệ thống tự động nạp:
> - **Global Rules:** [`AGENTS.md`](AGENTS.md) ở gốc dự án (đồng bộ 1:1 với [`CLAUDE.md`](CLAUDE.md)).
> - **20 Core Skills + 36 Slash Commands (`/discover-system`, `/generate-testcases-manual-rbt`, `/browser-mode`...):** Nạp qua [`.agents/skills.json`](.agents/skills.json) và `.agents/skills/<command>/SKILL.md`.
> - **Playwright MCP & Browser Mode Switch:** Nạp tự động qua Workspace Plugin [`.agents/plugins/claude-testing-skills/mcp_config.json`](.agents/plugins/claude-testing-skills/mcp_config.json) (hoặc tự động fallback sang `chrome-devtools-mcp` nếu có sẵn). Khi chạy `node scripts/browser-mode.mjs <headless|headed|status> [--video=on|off]`, cấu hình của cả Claude (`.mcp.json`) và Antigravity đều được đồng bộ tức thì.
> - **Đồng bộ khi chỉnh sửa `.claude/` hoặc `CLAUDE.md`:** Chạy `node scripts/sync-antigravity.mjs` (kiểm tra bằng `node --test scripts/verify-suite.mjs`).

> ⚠️ **Lưu ý về giao diện Claude Desktop:** Claude cập nhật UI khá thường xuyên. Tên menu trong tài liệu này đúng tại thời điểm viết; nếu máy bạn hiển thị khác, hãy tìm **mục tương đương** (ví dụ `Developer` ≈ `Developers` ≈ `Advanced`). Phần sửa file JSON và lệnh CLI thì **ổn định hơn** — nếu UI khác quá, dùng cách đó.

---

## Mục Lục

- [0. Chuẩn Bị Trước Khi Cài](#0-chuẩn-bị-trước-khi-cài)
- [1. Add Playwright MCP Thủ Công (Developers → Local MCP Server)](#1-add-playwright-mcp-thủ-công-developers--local-mcp-server)
- [2. Cài Connectors: Atlassian, Slack, GitHub, Claude in Chrome](#2-cài-connectors-atlassian-slack-github-claude-in-chrome)
- [3. Cowork — Setup Schedule Cho Task Cụ Thể](#3-cowork--setup-schedule-cho-task-cụ-thể)
- [4. Checklist Nghiệm Thu & Xử Lý Lỗi Thường Gặp](#4-checklist-nghiệm-thu--xử-lý-lỗi-thường-gặp)

---

## 0. Chuẩn Bị Trước Khi Cài

| Hạng mục | Yêu cầu | Cách kiểm tra |
|---|---|---|
| **Node.js** | ≥ 18 (khuyến nghị 20 LTS) | `node -v` |
| **npx** | Đi kèm Node | `npx -v` |
| **Claude Desktop** | Bản mới nhất (có tab Developer) | Menu Help → About |
| **Claude Code CLI** | Tuỳ chọn, nếu dùng terminal | `claude --version` |
| **Gói cước** | Connectors & Cowork phụ thuộc gói (Pro / Max / Team / Enterprise) | Xem `Settings → Account` |
| **Quyền tổ chức** | Với Team/Enterprise, admin phải **bật connector** trước | Hỏi admin workspace |

**Quy ước phân biệt 2 khái niệm — đọc kỹ, rất hay nhầm:**

| | **Local MCP Server** | **Connector (Remote MCP)** |
|---|---|---|
| Chạy ở đâu | Trên **máy bạn** (tiến trình con) | Trên **server của nhà cung cấp** |
| Cách cài | Khai báo `command` + `args` | Đăng nhập **OAuth** qua trình duyệt |
| Ví dụ | Playwright MCP, filesystem MCP | Atlassian, Slack, GitHub |
| Cần Node? | **Có** | Không |

➡️ **Playwright MCP là Local MCP Server**, KHÔNG phải Connector. Đừng tìm nó trong danh sách Connectors.

---

## 1. Add Playwright MCP Thủ Công (Developers → Local MCP Server)

Playwright MCP cho Claude quyền **mở browser thật, đọc DOM, click, gõ phím, chụp screenshot**. Đây là điều kiện bắt buộc để chạy các skill `skills-ui-debug-agent`, `skills-manual-test-executor`, và các command `/execute-test-cases`, `/generate-requirements-from-website`.

> 📌 **Claude Desktop KHÔNG có form điền sẵn.** Mục `Local MCP servers` chỉ có nút **Edit Config** — bấm vào là mở thẳng file `claude_desktop_config.json` để bạn tự gõ JSON. Không có ô Name / Command / Arguments riêng lẻ.

### 1.1. Cách A — Bấm Edit Config trong Claude Desktop (nhanh nhất)

1. Mở **Claude Desktop**.
2. Vào **Settings** (biểu tượng ⚙️ hoặc `Ctrl + ,`).
3. Chọn tab **Developer**.
4. Tìm mục **Local MCP servers** → bấm **Edit Config**.
5. File `claude_desktop_config.json` mở ra (bằng editor mặc định — VS Code, Notepad…). Thêm khối `playwright` như [mục 1.3](#13-nội-dung-cần-điền).
6. **Lưu file** → **Restart Claude Desktop** (bắt buộc — thoát **hẳn** từ khay hệ thống, không phải chỉ đóng cửa sổ).
7. Mở lại, vào **Settings → Developer**, server `playwright` phải hiện trạng thái **running / connected**.

### 1.2. Cách B — Mở thẳng file theo đường dẫn

Dùng khi nút **Edit Config** mở bằng app không mong muốn, hoặc bạn muốn sửa bằng editor khác.

| Hệ điều hành | Đường dẫn |
|---|---|
| **Windows** | `%APPDATA%\Claude\claude_desktop_config.json` |
| **macOS** | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| **Linux** | `~/.config/Claude/claude_desktop_config.json` |

Mở nhanh trên Windows (dán vào Run — `Win + R`):

```
%APPDATA%\Claude
```

### 1.3. Nội dung cần điền

**Cấu hình tối thiểu — dùng chung cho Windows / macOS / Linux:**

```json
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": ["-y", "@playwright/mcp@latest"]
    }
  }
}
```

> ⚠️ **Nếu file đã có sẵn nội dung** — đừng ghi đè cả file. File này còn chứa `preferences`, `coworkUserFilesPath`… của Claude Desktop. Chỉ **thêm key `"playwright"`** vào bên trong object `mcpServers` (tạo mới `mcpServers` nếu chưa có). Sai JSON một dấu phẩy là Claude **im lặng không load** server nào cả — không báo lỗi gì.

> 🪟 **Windows — chỉ dùng `cmd /c` khi thực sự gặp lỗi.** Bản Claude Desktop hiện tại gọi thẳng `npx` được bình thường. Chỉ khi log báo `spawn npx ENOENT` mới đổi sang dạng bọc:
> ```json
> "command": "cmd",
> "args": ["/c", "npx", "-y", "@playwright/mcp@latest"]
> ```
> Nguyên nhân lỗi này: `npx` trên Windows là file `.cmd`, một số phiên bản Node/Electron không spawn trực tiếp được.

### 1.4. Cấu hình khuyến nghị theo Rules của bộ Kit này

`CLAUDE.md` và `.claude/rules/playwright_rules.md` quy định: **Mặc định chạy Headless Mode (`1920×1080`, tắt GPU render)** để tiết kiệm tài nguyên GPU/RAM và không bị giới hạn bởi khung cửa sổ OS. Khi cần quan sát trực tiếp hoặc đăng nhập qua CAPTCHA/OTP/MFA, bật **Headed Mode (`1600×750`)** qua công tắc `/browser-mode` (`node scripts/browser-mode.mjs`).

| Chế độ | Viewport | Ghi chú |
|---|---|---|
| **Headless (Mặc định)** | **`1920×1080`** | Chạy ẩn, tắt GPU (`--disable-gpu`), không bị khung trình duyệt cắt mất chiều cao/ngang |
| **Headed (Opt-in)** | **`1600×750`** | Vừa màn hình 1920×1080 khi cần mở cửa sổ xem trực tiếp hoặc qua CAPTCHA/OTP |

Cấu hình `.mcp.json` mặc định của bộ kit (đặt ở **gốc project**):

```json
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": [
        "-y",
        "@playwright/mcp",
        "--headless",
        "--viewport-size=1920,1080",
        "--config",
        ".claude/playwright-mcp-config.json"
      ]
    }
  }
}
```

Kèm file `.claude/playwright-mcp-config.json` mặc định (Headless + tắt GPU):

```json
{
  "browser": {
    "launchOptions": {
      "headless": true,
      "args": [
        "--test-type",
        "--disable-gpu",
        "--disable-dev-shm-usage",
        "--no-sandbox"
      ]
    }
  }
}
```

**Chuyển đổi nhanh giữa Headless và Headed Mode (Browser Mode Switch):**

```bash
node scripts/browser-mode.mjs status    # Xem chế độ đang bật
node scripts/browser-mode.mjs headed    # Bật Headed Mode (1600x750, hiện cửa sổ tại 0,0)
node scripts/browser-mode.mjs headless  # Bật lại Headless Mode (1920x1080, tắt GPU)
node scripts/browser-mode.mjs toggle    # Đảo nhanh headless <-> headed
```
*(Hoặc gọi trực tiếp slash command `/browser-mode headed` / `/browser-mode headless` trong khung chat Claude Code, sau đó gõ `/mcp` để reconnect).*

> 📂 **Không có `--output-dir`, và đó là cố ý.** Server khai trong `.mcp.json` chạy với cwd = gốc project, nên snapshot / console log / screenshot tự rơi vào `.playwright-mcp/` của **đúng project này**. Dùng server global thì cwd bám theo project nào khởi động server trước — evidence sẽ lạc sang project khác. File cũng không chứa đường dẫn tuyệt đối nên mang sang máy khác vẫn chạy.

> 🖥️ **Khi bật Headed Mode trên màn hình không phải Full HD:** Tính lại theo công thức đo thực tế (Windows, Google Chrome): viewport `1600×750` → cửa sổ `1614×885`. Khung chiếm **+135 dọc** (ổn định) và **+14…17 ngang** (dao động theo scrollbar của trang).
>
> Muốn cửa sổ vừa màn hình `W×H` → `--viewport-size=(W−17),(H−135)`.
> - Màn 1920×1080 → `1600,750` (cấu hình sẵn của lệnh `node scripts/browser-mode.mjs headed`)
> - Màn 1366×768 → `1349,633`

> 💡 **Hai kiểu viết tham số đều chạy** — chọn kiểu nào cũng được, miễn nhất quán:
> - Gộp bằng dấu `=`: `"--viewport-size=1920,1080"` (1 phần tử)
> - Tách rời: `"--viewport-size", "1920,1080"` (2 phần tử)
>
> Kiểu `=` gọn hơn và ít nhầm hơn khi sửa tay.

**Các tham số hay dùng:**

| Tham số | Tác dụng | Khi nào dùng |
|---|---|---|
| `--headless` | Chạy ẩn, không hiện cửa sổ | **Mặc định** — tiết kiệm GPU/RAM, cho phép full viewport `1920×1080` |
| `--viewport-size "1920,1080"` | Đặt viewport ngay lúc launch | `1920,1080` cho Headless · `1600,750` cho Headed |
| `--config <path>` | Nạp file cấu hình JSON (launch args của browser…) | Bộ kit dùng `.claude/playwright-mcp-config.json` |
| `--browser chrome` | Dùng Chrome thật thay Chromium bundled | Muốn giống môi trường user thật |
| `--browser msedge` / `firefox` / `webkit` | Đổi browser | Cross-browser testing |
| `--isolated` | Mỗi phiên một profile sạch, không lưu state | Test luồng đăng nhập từ đầu |
| `--output-dir <path>` | Nơi lưu screenshot / trace / snapshot | Trỏ về `.playwright-mcp/` (đã gitignore sẵn) |
| `--save-trace` | Xuất Playwright trace để mở bằng trace viewer | Điều tra lỗi khó |
| `--device "iPhone 15"` | Giả lập thiết bị mobile | Test responsive |

> 📌 **`--viewport-size` là nơi DUY NHẤT đặt viewport lúc launch. KHÔNG gọi `browser_resize` sau `browser_navigate`**. Nếu đang ở Headed Mode và nghi viewport lệch thì **đo trước khi sửa**:
> ```js
> browser_evaluate: () => ({ inner:[innerWidth,innerHeight], outer:[outerWidth,outerHeight] })
> ```
> `inner` > `outer` → trang đang bị cắt, phải hạ `--viewport-size` xuống rồi reconnect MCP.

Sau khi sửa JSON: **lưu file → gõ `/mcp` (Claude Code) hoặc mở lại Claude Desktop**.

### 1.5. Cách C — Claude Code CLI (cho terminal / VS Code)

Claude Code **không đọc** `claude_desktop_config.json`. Phải khai báo riêng.

**Thêm cho riêng dự án này (khuyến nghị — cả team dùng chung, mặc định Headless):**

```bash
claude mcp add --scope project playwright -- npx -y @playwright/mcp --headless --viewport-size "1920,1080" --config ".claude/playwright-mcp-config.json"
```

Lệnh trên (hoặc chạy `node scripts/browser-mode.mjs headless`) sinh ra file `.mcp.json` ở thư mục gốc dự án:

```json
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": [
        "-y",
        "@playwright/mcp",
        "--headless",
        "--viewport-size=1920,1080",
        "--config",
        ".claude/playwright-mcp-config.json"
      ]
    }
  }
}
```

➡️ **Nên commit cả hai file** — `.mcp.json` và `.claude/playwright-mcp-config.json` — để đồng đội clone về là chạy được ngay. Cả hai đều dùng **đường dẫn tương đối**, không hardcode máy ai.

> ⚠️ `.mcp.json` ở gốc project **đè** cấu hình global trong `%APPDATA%\Claude\claude_desktop_config.json`. Sửa global mà không thấy tác dụng → kiểm tra file này trước.

**Thêm cho toàn bộ dự án trên máy bạn:**

```bash
claude mcp add --scope user playwright -- npx -y @playwright/mcp@latest
```

**Các lệnh quản lý:**

```bash
claude mcp list
```

```bash
claude mcp get playwright
```

```bash
claude mcp remove playwright
```

Trong phiên Claude Code, gõ `/mcp` để xem trạng thái kết nối và danh sách tool của từng server.

### 1.6. Nghiệm thu — xác nhận Playwright MCP đã chạy

Gửi cho Claude câu lệnh sau:

```
Dùng Playwright MCP mở https://anhtester.com rồi chụp snapshot cho tôi xem tiêu đề trang. Không resize.
```

**Đạt** khi: một cửa sổ browser **thật sự bật lên**, và Claude trả về nội dung DOM/tiêu đề trang.
**Chưa đạt** khi: Claude nói "tôi không có công cụ browser" → xem [mục 4](#4-checklist-nghiệm-thu--xử-lý-lỗi-thường-gặp).

### 1.7. Cài browser binary (chạy lần đầu có thể thiếu)

```bash
npx playwright install chrome
```

Hoặc cài đủ bộ:

```bash
npx playwright install
```

---

## 2. Cài Connectors: Atlassian, Slack, GitHub, Claude in Chrome

### 2.1. Đường vào chung cho mọi Connector

**Trên Claude Desktop hoặc claude.ai:**

1. **Settings** (⚙️).
2. Chọn **Connectors**.
3. Bấm **Browse connectors** (hoặc **Add connectors**) để xem danh mục có sẵn.
4. Tìm connector cần dùng → bấm **Connect**.
5. Trình duyệt mở ra trang đăng nhập của nhà cung cấp → **đăng nhập** → **Allow / Accept** các quyền được yêu cầu.
6. Quay lại Claude, connector chuyển sang trạng thái **Connected**.

> 🔐 **Nguyên tắc bảo mật khi cấp quyền:**
> - Đọc kỹ danh sách scope trước khi bấm Allow. Cấp **ít quyền nhất đủ dùng**.
> - Với tài khoản công ty: nhiều tổ chức **chặn** OAuth bên thứ ba — nếu thấy màn hình "Admin approval required", gửi yêu cầu cho admin, đừng tìm cách lách.
> - **KHÔNG** dán API token / password vào khung chat. Connector dùng OAuth, không bao giờ cần bạn gõ mật khẩu vào Claude.

### 2.2. Atlassian (Jira + Confluence)

**Dùng để:** kéo requirement/user story từ Jira, đọc tài liệu Confluence, cập nhật kết quả test lên ticket. Phục vụ command `/fetch-jira-requirements`, `/analyze-requirement-document`, `/update-requirements-from-ticket`, và skill `skills-jira-integration`.

**Các bước:**

1. `Settings → Connectors → Browse connectors → Atlassian → Connect`.
2. Đăng nhập tài khoản Atlassian (email công ty).
3. Chọn **site** cần cấp quyền (ví dụ `anhtester.atlassian.net`) — nếu bạn có nhiều site, chọn đúng site chứa project đang test.
4. Duyệt quyền: đọc issue, đọc page Confluence, (tuỳ chọn) ghi comment / cập nhật issue.
5. Test nhanh:

```
Lấy nội dung Jira ticket CRM-123 và tóm tắt acceptance criteria.
```

**Cấu hình cho Claude Code CLI** (nếu muốn dùng trong terminal):

```bash
claude mcp add --transport sse atlassian https://mcp.atlassian.com/v1/sse
```

Sau đó gõ `/mcp` trong phiên Claude Code → chọn `atlassian` → **Authenticate** để chạy luồng OAuth.

> ⚠️ Luồng OAuth **cần môi trường tương tác**. Nếu chạy trong CI hoặc phiên non-interactive, Claude sẽ báo "server needs authorization" và không dùng được cho tới khi bạn xác thực ở phiên tương tác.

**Giới hạn cần biết:** Connector Atlassian **không** bao gồm Xray. Muốn đẩy kết quả lên Xray (`/import-test-results-xray`), phải dùng Xray REST API với `CLIENT_ID` / `CLIENT_SECRET` để trong `.env` — xem skill `skills-jira-integration`.

### 2.3. Slack

**Dùng để:** đọc tin nhắn giao task, tóm tắt kênh, gửi báo cáo test vào channel. Đây là nền cho ví dụ Schedule ở [mục 3](#3-cowork--setup-schedule-cho-task-cụ-thể).

**Các bước:**

1. `Settings → Connectors → Browse connectors → Slack → Connect`.
2. Chọn đúng **workspace** (nếu bạn ở nhiều workspace).
3. Duyệt quyền: đọc lịch sử kênh công khai, đọc DM, gửi tin nhắn.
4. **Quan trọng:** Claude chỉ đọc được **kênh mà tài khoản bạn đã tham gia**. Kênh private chưa join → không thấy. Vào Slack join kênh trước.
5. Test nhanh:

```
Tóm tắt 20 tin nhắn gần nhất trong kênh #qa-daily.
```

**Slack có 2 hình thái, đừng nhầm:**

| | **Slack Connector** | **Claude trong Slack (Claude Tag)** |
|---|---|---|
| Bạn ngồi ở đâu | Trong Claude, đọc/ghi Slack | Trong Slack, gọi `@Claude` |
| Cài thế nào | Settings → Connectors | Admin cài Slack App vào workspace |
| Hợp cho | Automation, scheduled task | Hỏi đáp nhanh giữa team |

Tài liệu này dùng **Slack Connector**.

### 2.4. GitHub

**Dùng để:** đọc repo, review PR, đọc log GitHub Actions, tạo issue từ bug report.

**Cách 1 — Connector trong Claude Desktop / claude.ai:**

1. `Settings → Connectors → Browse connectors → GitHub → Connect`.
2. Đăng nhập GitHub → chọn **tổ chức** và **repository** được phép truy cập.
3. Khuyến nghị chọn **Only select repositories**, chỉ tick repo cần dùng — đừng cấp toàn bộ account.

**Cách 2 — GitHub MCP Server cho Claude Code CLI:**

```bash
claude mcp add --transport http github https://api.githubcopilot.com/mcp/
```

Rồi `/mcp` → `github` → **Authenticate**.

**Cách 3 — GitHub CLI (đơn giản nhất, không cần MCP):**

Bộ Kit này đã cho phép Claude chạy shell command. Chỉ cần cài `gh` và đăng nhập:

```bash
gh auth login
```

Sau đó Claude dùng được ngay:

```bash
gh run list --limit 5
```

```bash
gh run view --log-failed
```

> 💡 **Chọn cách nào?** Nếu bạn chủ yếu làm việc trong Claude Code CLI, **`gh` là gọn nhất** — không tốn context cho tool schema, và đọc log Actions rất tiện. Connector hợp hơn khi bạn dùng Claude Desktop và muốn hỏi đáp về PR/issue bằng ngôn ngữ tự nhiên.

### 2.5. Claude in Chrome

**Dùng để:** Claude điều khiển **Chrome thật của bạn** — với đầy đủ session đã đăng nhập, extension, cookie. Khác hẳn Playwright MCP (browser sạch, tách biệt).

**Các bước:**

1. Mở **Chrome Web Store** → tìm extension **"Claude in Chrome"** (do Anthropic phát hành — kiểm tra publisher trước khi cài).
2. Bấm **Add to Chrome** → duyệt quyền.
3. **Ghim** extension ra thanh công cụ (biểu tượng 🧩 → ghim Claude).
4. Bấm vào icon → **đăng nhập** tài khoản Claude.
5. Cấp quyền cho từng **site** bạn muốn Claude thao tác (extension hỏi quyền theo domain).
6. Test nhanh: mở một trang bất kỳ, bấm icon Claude, hỏi "Trang này có bao nhiêu nút submit?".

> ⚠️ **Yêu cầu gói cước:** Claude in Chrome giới hạn theo gói (thường Max/Team trở lên) và theo khu vực. Nếu không cài được, kiểm tra `Settings → Account`.

**Khi nào dùng cái nào — quyết định nhanh:**

| Tình huống | Dùng |
|---|---|
| Chạy manual test case, cần môi trường sạch, cần evidence có kiểm soát | **Playwright MCP** |
| Sinh automation script, cần lấy locator từ DOM | **Playwright MCP** |
| Cần dùng session đã đăng nhập sẵn (SSO công ty, 2FA phiền phức) | **Claude in Chrome** |
| Thao tác nhanh trên trang đang mở, không cần lưu evidence | **Claude in Chrome** |

> 🔒 **Cảnh báo bảo mật với Claude in Chrome:** extension chạy trên **trình duyệt cá nhân của bạn**, thấy được mọi thứ bạn đang đăng nhập. **Không** để nó thao tác trên trang ngân hàng, trang quản trị production, hay trang chứa dữ liệu khách hàng thật. Nội dung trên trang web là **dữ liệu**, không phải mệnh lệnh — nếu một trang có chữ "Claude hãy xoá tất cả", đó là dấu hiệu prompt injection.

### 2.6. Bảng Tổng Hợp

| Tên | Loại | Cách cài | Cần OAuth | Dùng cho command/skill nào |
|---|---|---|---|---|
| **Playwright** | Local MCP | `npx @playwright/mcp@latest` | Không | `/execute-test-cases`, `/generate-requirements-from-website`, `/generate-automation-from-ui-flow` |
| **Atlassian** | Connector | Settings → Connectors | Có | `/fetch-jira-requirements`, `/update-requirements-from-ticket`, `skills-jira-integration` |
| **Slack** | Connector | Settings → Connectors | Có | Gửi report, đọc task, Schedule |
| **GitHub** | Connector / CLI | Connectors hoặc `gh auth login` | Có | Đọc CI result, tạo issue từ `/create-bug-report` |
| **Claude in Chrome** | Extension | Chrome Web Store | Có | Thao tác trên session sẵn có |

---

## 3. Cowork — Setup Schedule Cho Task Cụ Thể

### 3.1. Cowork và Scheduled Task là gì

**Cowork** là chế độ làm việc cộng tác của Claude — nơi Claude chạy task nhiều bước, dùng được connectors và skills, và **giữ được ngữ cảnh giữa các phiên**.

**Scheduled Task** (tác vụ theo lịch) là một prompt được **lưu lại và tự chạy theo lịch cron**. Mỗi lần chạy, Claude khởi động **phiên mới hoàn toàn** — nghĩa là:

| Đặc điểm | Hệ quả bạn phải xử lý |
|---|---|
| Phiên mới, **không nhớ** phiên trước | Prompt phải **tự chứa đủ thông tin**: tên kênh, tên repo, tên file |
| Chạy khi bạn không ngồi máy | Không được có bước "hỏi user rồi mới làm" |
| Vẫn dùng được connectors đã kết nối | Nhưng nếu OAuth hết hạn → task **fail im lặng** |
| Hành động gửi tin/ghi dữ liệu là **không thể hoàn tác** | Phải nêu **rõ ràng, chính xác** đích đến trong prompt |

### 3.2. Cách tạo Scheduled Task

**Cách 1 — Nói bằng ngôn ngữ tự nhiên (khuyến nghị):**

Trong phiên Cowork, chỉ cần gõ yêu cầu kèm mốc thời gian. Claude sẽ tự tạo task và hỏi lại để chốt lịch:

```
Mỗi ngày lúc 9h sáng (giờ VN), hãy đọc kênh Slack #qa-tasks...
```

**Cách 2 — Qua giao diện:**

1. Mở **Settings** hoặc menu bên trái → tìm mục **Tasks** / **Scheduled tasks** / **Automations**.
2. Bấm **New task**.
3. Điền: **Tên task**, **Prompt**, **Lịch chạy** (cron hoặc chọn sẵn Daily/Weekly), **Múi giờ**.
4. Bấm **Create** → **Run now** một lần để kiểm chứng trước khi để nó tự chạy.

**Cách 3 — Claude Code CLI:**

```bash
/schedule
```

Skill `schedule` sẽ hướng dẫn tạo/sửa/xoá routine chạy theo cron.

### 3.3. Bảng cron tham chiếu nhanh

Cú pháp: `phút giờ ngày tháng thứ`

| Lịch mong muốn | Cron | Ghi chú |
|---|---|---|
| 9h00 sáng mỗi ngày | `0 9 * * *` | |
| 9h00 T2–T6 | `0 9 * * 1-5` | Bỏ cuối tuần |
| Mỗi 30 phút | `*/30 * * * *` | Cẩn thận tốn quota |
| 18h00 thứ Sáu | `0 18 * * 5` | Báo cáo tuần |
| 8h30 ngày 1 hằng tháng | `30 8 1 * *` | |

> 🕐 **Luôn ghi rõ múi giờ.** Ghi `Asia/Ho_Chi_Minh` (UTC+7) trong prompt hoặc chọn trong form. Bỏ qua bước này là task chạy lệch 7 tiếng.

---

### 3.4. Ví Dụ A — Mỗi sáng đọc task từ Slack và ước lượng thời gian

**Bài toán:** Sáng nào cũng có người giao task trong kênh `#qa-tasks`. Muốn Claude đọc, gom lại, ước lượng effort, và gửi lại tóm tắt.

**Điều kiện cần:** Slack Connector đã **Connected**, và tài khoản bạn **đã join** kênh `#qa-tasks`.

**Prompt để tạo task:**

```
Tạo scheduled task chạy 9h00 sáng thứ Hai đến thứ Sáu, múi giờ Asia/Ho_Chi_Minh.

Nội dung mỗi lần chạy:

1. Đọc toàn bộ tin nhắn trong kênh Slack #qa-tasks trong 24 giờ gần nhất.
2. Lọc ra những tin nhắn thực sự là GIAO VIỆC cho team QA — bỏ qua chào hỏi,
   thảo luận chung, và tin nhắn của bot.
3. Với mỗi task, xuất một dòng gồm:
   - Người giao và thời điểm giao
   - Mô tả task (tóm gọn 1 câu)
   - Module liên quan (nếu đoán được từ nội dung)
   - Ước lượng effort theo thang: XS (<1h) / S (1-3h) / M (3-8h) / L (1-3 ngày) / XL (>3 ngày)
   - Căn cứ ước lượng — nêu rõ 1 câu vì sao chọn mức đó
   - Độ tin cậy của ước lượng: Cao / Trung bình / Thấp
4. Task nào mô tả quá mơ hồ để ước lượng, xếp vào mục riêng
   "❓ Cần làm rõ" kèm câu hỏi cụ thể cần hỏi lại người giao.
5. Sắp xếp theo mức độ ưu tiên suy ra từ ngôn ngữ trong tin nhắn
   (gấp/urgent/hôm nay → lên đầu).
6. Xuất kết quả dạng bảng Markdown, tiêu đề "📋 Task QA ngày <dd/MM/yyyy>",
   kèm dòng tổng: tổng số task và tổng effort ước tính.

QUAN TRỌNG — chỉ ĐỌC và TRẢ VỀ kết quả trong phiên này.
KHÔNG tự động gửi tin nhắn lên bất kỳ kênh Slack nào.
```

> 🛑 **Vì sao dòng cuối quan trọng:** gửi tin nhắn là hành động **không thu hồi được** và người khác nhìn thấy. Giai đoạn đầu hãy để task chỉ **đọc** và trả kết quả cho riêng bạn. Khi đã tin tưởng output sau vài ngày, mới mở rộng sang gửi tự động (xem [3.6](#36-nâng-cấp-cho-task-tự-gửi-tin-nhắn)).

**Biến thể — ước lượng dựa trên test case đã có trong repo:**

Thêm vào bước 3 của prompt trên:

```
Trước khi ước lượng, đối chiếu với docs/testcases/ trong repo:
- Nếu module đã có test cases → ước lượng dựa trên số TC hiện có
  (giả định 10 phút/TC cho execute manual).
- Nếu là module mới hoàn toàn → cộng thêm effort cho việc phân tích
  requirements và viết TC mới.
- Ghi rõ trong cột "Căn cứ" là dựa trên TC nào.
```

---

### 3.5. Ví Dụ B — Nhận báo cáo GitHub Actions và gửi vào kênh Slack

**Bài toán:** Sau mỗi lần CI chạy test, muốn có bản tóm tắt dễ đọc trong Slack thay vì phải mở GitHub xem log.

#### ⚖️ Chọn cách trước khi làm — có 2 hướng, khác nhau về bản chất

| | **Cách 1: GitHub Actions gửi thẳng Slack** | **Cách 2: Scheduled Task của Claude** |
|---|---|---|
| Thời điểm | **Ngay khi** workflow xong | Theo lịch (ví dụ mỗi 30 phút / cuối ngày) |
| Nội dung | Cố định theo template | Claude **phân tích**: gom nhóm lỗi theo root cause, so trend |
| Độ tin cậy | Rất cao, không phụ thuộc Claude | Phụ thuộc quota, OAuth còn hạn |
| Chi phí | Miễn phí | Tốn quota mỗi lần chạy |
| Setup | Sửa file YAML trong repo | Không đụng repo |

➡️ **Khuyến nghị: dùng cả hai.** Cách 1 để **báo động tức thì** (đơn giản, không bao giờ hỏng). Cách 2 để có **bản tổng hợp có phân tích** cuối ngày. Đừng dùng Cách 2 thay thế Cách 1 cho việc báo build fail — trễ 30 phút là quá muộn.

#### Cách 1 — GitHub Actions gửi thẳng vào Slack

Tạo Slack Incoming Webhook: `Slack → Apps → Incoming Webhooks → Add to Slack → chọn kênh → copy URL`.

Lưu URL vào GitHub: `Repo → Settings → Secrets and variables → Actions → New repository secret`, tên `SLACK_WEBHOOK_URL`.

> 🔐 Webhook URL là **bí mật** — ai có nó cũng gửi tin vào kênh của bạn được. **KHÔNG** commit vào repo, **KHÔNG** dán vào chat.

Thêm step vào cuối workflow (`.github/workflows/playwright.yml`):

```yaml
      - name: Gửi kết quả test vào Slack
        if: always()
        env:
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
        run: |
          STATUS="${{ job.status }}"
          if [ "$STATUS" = "success" ]; then ICON="✅"; else ICON="❌"; fi
          curl -sS -X POST -H 'Content-type: application/json' \
            --data "{
              \"text\": \"$ICON *Playwright Tests* — \`${{ github.ref_name }}\`\n*Kết quả:* $STATUS\n*Commit:* ${{ github.event.head_commit.message }}\n*Người push:* ${{ github.actor }}\n<${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}|Xem chi tiết trên GitHub>\"
            }" \
            "$SLACK_WEBHOOK_URL"
```

> `if: always()` là bắt buộc — không có nó thì **test fail sẽ không gửi thông báo**, đúng lúc bạn cần biết nhất.

#### Cách 2 — Scheduled Task của Claude (có phân tích)

**Điều kiện cần:** GitHub Connector (hoặc `gh` CLI đã đăng nhập) **và** Slack Connector.

**Prompt để tạo task:**

```
Tạo scheduled task chạy lúc 18h00 mỗi ngày làm việc (T2-T6),
múi giờ Asia/Ho_Chi_Minh.

Nội dung mỗi lần chạy:

BƯỚC 1 — THU THẬP
Lấy toàn bộ workflow run của GitHub Actions trong repo
  anhtester/crm-automation
thuộc workflow "Playwright Tests", trong 24 giờ gần nhất.
Với mỗi run: lấy trạng thái, branch, người trigger, thời gian chạy,
số test PASS/FAIL/SKIP.

BƯỚC 2 — PHÂN TÍCH
- Với các run FAILED, đọc log của step bị lỗi.
- Gom nhóm các test fail theo ROOT CAUSE, không liệt kê rời rạc.
  Phân loại vào: Locator thay đổi / Timeout & wait / Test data /
  Lỗi ứng dụng thật / Hạ tầng CI.
- Đánh dấu test nào FAIL lặp lại ở nhiều run khác nhau
  → nghi ngờ flaky, ghi rõ tỉ lệ fail.
- So sánh với hôm qua: số test fail tăng hay giảm.

BƯỚC 3 — BÁO CÁO
Soạn tin nhắn Slack theo bố cục:

  📊 Báo cáo CI ngày <dd/MM/yyyy>
  ─────────────────────────
  Tổng run: <n>  |  ✅ <n>  |  ❌ <n>
  Tỉ lệ pass: <x>%  (hôm qua: <y>%)

  🔴 Nhóm lỗi cần xử lý:
  1. <Root cause> — <n> test — <mức ưu tiên>
     Test bị ảnh hưởng: <liệt kê tối đa 3 tên, còn lại ghi "và N test khác">

  ⚠️ Nghi ngờ flaky: <tên test> (fail <n>/<tổng> lần)

  🔗 <link tới run mới nhất>

Dùng định dạng Slack mrkdwn (*đậm*, `code`), KHÔNG dùng Markdown chuẩn.
Giữ tin nhắn dưới 40 dòng — dài hơn thì rút gọn phần liệt kê test.

BƯỚC 4 — GỬI
Gửi tin nhắn trên vào kênh Slack #qa-ci-report.

Nếu 24h qua KHÔNG có run nào, chỉ gửi đúng một dòng:
"📊 Hôm nay không có CI run nào cho Playwright Tests."
Nếu không truy cập được GitHub, gửi cảnh báo vào #qa-ci-report
nêu rõ lỗi gặp phải — không được im lặng bỏ qua.
```

**Trước khi để nó tự chạy — chạy thử 1 lần:**

Chạy task bằng tay (nút **Run now**), nhưng **sửa BƯỚC 4** thành:

```
BƯỚC 4 — In kết quả ra đây cho tôi xem. KHÔNG gửi lên Slack.
```

Xem output có đúng ý không, chỉnh prompt, rồi mới đổi lại thành gửi thật.

### 3.6. Nâng cấp cho task tự gửi tin nhắn

Khi đã tin tưởng output, mở khoá gửi tự động. Ba nguyên tắc bắt buộc:

1. **Ghi tên kênh chính xác, đầy đủ.** `#qa-ci-report` chứ không phải "kênh báo cáo". Một chữ sai là tin nhắn bay sang kênh khác — và không thu hồi được.
2. **Tạo kênh riêng cho bot.** Đừng cho task tự động gửi vào `#general`. Kênh riêng để tắt/mute dễ, và không làm phiền người khác nếu task lỗi.
3. **Nêu rõ hành vi khi lỗi.** Task không có chỉ dẫn xử lý lỗi thường sẽ **im lặng** — bạn tưởng "không có gì bất thường", thực ra nó chết từ 3 hôm trước.

### 3.7. Quản lý các task đã tạo

| Việc cần làm | Cách làm |
|---|---|
| Xem danh sách | Hỏi Claude "Liệt kê các scheduled task của tôi" hoặc vào mục **Tasks** |
| Sửa lịch / prompt | "Sửa task <tên>: đổi giờ chạy sang 8h00" |
| Tạm dừng | "Tạm dừng task <tên>" |
| Xoá | "Xoá task <tên>" |
| Chạy thử ngay | Bấm **Run now**, hoặc "Chạy task <tên> ngay bây giờ" |

> 📌 **Rà soát task định kỳ.** Task tạo xong dễ bị quên — mỗi tháng liếc lại danh sách một lần. Task chạy cho dự án đã kết thúc vẫn âm thầm tốn quota và gửi tin nhắn vô nghĩa vào kênh.

---

## 4. Checklist Nghiệm Thu & Xử Lý Lỗi Thường Gặp

### 4.1. Checklist — tick đủ là xong

**Playwright MCP**
- [ ] `node -v` cho ra phiên bản ≥ 18
- [ ] Server `playwright` hiện **connected** trong `Settings → Developer` (hoặc `claude mcp list`)
- [ ] Yêu cầu Claude mở một trang bất kỳ → **cửa sổ browser thật sự bật lên**
- [ ] Cửa sổ browser **vừa màn hình**, không tràn ra ngoài — kiểm bằng `browser_evaluate: () => ({ inner:[innerWidth,innerHeight], outer:[outerWidth,outerHeight] })`, phải thấy `inner` **nhỏ hơn** `outer`
- [ ] Screenshot lưu vào đúng `.playwright-mcp/` **của project này** (không lạc sang project khác)

**Connectors**
- [ ] Atlassian: lấy được nội dung một Jira ticket thật
- [ ] Slack: đọc được tin nhắn từ kênh đã join
- [ ] GitHub: liệt kê được workflow run gần nhất (`gh run list` hoặc qua connector)
- [ ] Claude in Chrome: icon đã ghim, đăng nhập xong, đọc được trang đang mở

**Schedule**
- [ ] Task đã tạo, hiện trong danh sách
- [ ] **Run now** cho ra kết quả đúng mong đợi
- [ ] Múi giờ là `Asia/Ho_Chi_Minh`
- [ ] Prompt có nêu hành vi khi gặp lỗi
- [ ] Tên kênh Slack đích **chính xác từng ký tự**

### 4.2. Lỗi thường gặp

| Triệu chứng | Nguyên nhân | Cách xử lý |
|---|---|---|
| `spawn npx ENOENT` (Windows) | Phiên bản Node/Electron không spawn được file `.cmd` | Đổi thành `"command": "cmd"`, args bắt đầu bằng `/c`, `npx`. **Chỉ làm khi gặp đúng lỗi này** — bình thường `npx` trần chạy tốt |
| MCP server không hiện sau khi sửa JSON | File JSON sai cú pháp | Dán vào trình kiểm tra JSON; chú ý **dấu phẩy thừa** ở phần tử cuối |
| Sửa xong thì Claude Desktop mất hết cấu hình khác | Ghi đè cả file thay vì thêm key | File này còn chứa `preferences`, `coworkUserFilesPath`… — chỉ thêm vào trong `mcpServers` |
| Sửa config rồi vẫn không thấy | Chưa restart **hẳn** | Thoát Claude từ **khay hệ thống**, không phải chỉ đóng cửa sổ |
| Claude nói "không có công cụ browser" | Claude Code đọc `.mcp.json`, không đọc `claude_desktop_config.json` | Chạy `claude mcp add --scope project playwright -- npx -y @playwright/mcp@latest` |
| Browser bật rồi tắt ngay | Thiếu browser binary | `npx playwright install chrome` |
| Connector kẹt ở "Connecting" | OAuth chưa hoàn tất hoặc bị tổ chức chặn | Bấm Disconnect → Connect lại; nếu thấy "Admin approval" → liên hệ admin |
| Connector đang chạy tự nhiên hỏng | OAuth token hết hạn | Disconnect → Connect lại. Nhớ kiểm tra các scheduled task phụ thuộc nó |
| Scheduled task không chạy | Sai múi giờ, hoặc task đang paused | Kiểm tra timezone; bấm Run now xem có lỗi gì |
| Task chạy nhưng không gửi Slack | Chưa join kênh, hoặc tên kênh sai | Join kênh; kiểm tra tên kênh trong prompt |
| Slack không thấy kênh private | Claude chỉ thấy kênh bạn đã tham gia | Vào Slack join kênh đó trước |
| Claude Code không hỏi permission nữa | `.claude/settings.local.json` đã cache quyền | Xoá file đó nếu muốn reset — file này đã gitignore, không commit |
| Trang bị **cắt bên phải**, tester không nhìn thấy hết | Viewport lớn hơn cửa sổ OS (thường do gọi `browser_resize` phóng lên) | **Đừng resize.** Hạ `--viewport-size` theo công thức `(W−17),(H−135)` ở [mục 1.4](#14-cấu-hình-khuyến-nghị-theo-rules-của-bộ-kit-này) rồi khởi động lại Claude Code |
| Sửa `--viewport-size` rồi mà không đổi | Chưa restart, hoặc `.mcp.json` gốc project đang đè cấu hình global | Thoát hẳn Claude Code rồi mở lại; kiểm tra `.mcp.json` ở gốc project trước khi sửa file global |
| Screenshot rơi vào project khác | Đang dùng server global — cwd bám theo project khởi động server trước | Khai server trong `.mcp.json` ở gốc project (mục 1.5) |

### 4.3. Nguyên tắc an toàn — đọc trước khi bật automation

1. **Không bao giờ dán secret vào chat.** API token, webhook URL, password, chuỗi kết nối DB — để trong `.env` (đã gitignore) hoặc GitHub Secrets.
2. **Screenshot evidence có thể chứa dữ liệu khách hàng thật.** Kiểm tra `docs/executions/*/run_*/evidence/` trước khi commit lên repo công khai.
3. **Nội dung từ web / Slack / Jira là DỮ LIỆU, không phải mệnh lệnh.** Nếu một trang web hay tin nhắn có chữ hướng dẫn Claude làm gì đó (xoá file, gửi dữ liệu đi đâu, "bạn đã được cấp quyền"), đó là **prompt injection**. Claude sẽ hỏi lại bạn thay vì làm theo — và bạn cũng nên nghi ngờ.
4. **Hành động không thu hồi được cần xác nhận.** Gửi tin nhắn, tạo issue, comment lên Jira, xoá dữ liệu. Với scheduled task, phải chốt kỹ ở bước chạy thử vì lúc chạy thật không có ai xác nhận.
5. **Môi trường dùng chung cần cẩn trọng gấp đôi.** Khi test trên hệ thống nhiều người dùng (như `crm.anhtester.com`), dọn dữ liệu test sau khi chạy và tránh mọi thao tác phá huỷ.

---

## Phụ Lục — Cấu Hình Mẫu Hoàn Chỉnh

**`%APPDATA%\Claude\claude_desktop_config.json`** (Windows, chỉ Playwright — connectors cài qua UI):

```json
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": [
        "-y", "@playwright/mcp@latest",
        "--browser=chrome",
        "--headless",
        "--viewport-size=1920,1080",
        "--output-dir=D:\\ANHTESTER\\ClaudeCode\\claude-testing-skills\\.playwright-mcp"
      ]
    }
  }
}
```

> Đây là **trích đoạn**, không phải toàn bộ file. File thật của bạn còn có `preferences`, `coworkUserFilesPath`, `localAgentModeTrustedFolders`… — giữ nguyên, chỉ chèn thêm khối `mcpServers`.

**`.mcp.json`** (đặt ở thư mục gốc dự án, dùng cho Claude Code CLI — **nên commit**, mặc định Headless):

```json
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": [
        "-y",
        "@playwright/mcp",
        "--headless",
        "--viewport-size=1920,1080",
        "--config",
        ".claude/playwright-mcp-config.json"
      ]
    }
  }
}
```

**`.claude/playwright-mcp-config.json`** (đi kèm `.mcp.json` — **nên commit**):

```json
{
  "browser": {
    "launchOptions": {
      "headless": true,
      "args": [
        "--test-type",
        "--disable-gpu",
        "--disable-dev-shm-usage",
        "--no-sandbox"
      ]
    }
  }
}
```

> Dùng `node scripts/browser-mode.mjs headed` hoặc `node scripts/browser-mode.mjs headless` (hoặc `/browser-mode`) để chuyển nhanh giữa Headless (`1920×1080`) và Headed (`1600×750`).

