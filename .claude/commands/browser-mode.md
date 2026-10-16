---
description: Kiểm tra hoặc chuyển đổi nhanh chế độ trình duyệt (Browser Execution Mode) giữa Headless (1920x1080, tắt GPU — mặc định) và Headed (1600x750, hiện cửa sổ), kèm bật/tắt quay video bằng chứng.
skills:
  - skills-ui-debug-agent
---

# Workflow: Chuyển Đổi Chế Độ Trình Duyệt & Video (`/browser-mode`)

Quản lý **Browser Execution Mode** và **Video Recording** trên cả 2 tầng: **Playwright MCP** (recon, manual test execution, locator healing, UI debug) và **Automation Test Runner** (`npx playwright test`, `mvn test`, `pytest`).

## 1. Nhận diện hành động từ lời User

| Tham số / Lời gọi | Lệnh thực thi | Kết quả |
|---|---|---|
| `/browser-mode` hoặc `status` | `node scripts/browser-mode.mjs status` | Báo chế độ hiện tại (`HEADLESS`/`HEADED`), viewport, trạng thái GPU và `Video: ON/OFF` |
| `/browser-mode headless` · *"bật headless"* · *"chạy ẩn"* | `node scripts/browser-mode.mjs headless` | Chuyển MCP về **Headless Mode** (`1920,1080`, tắt GPU `--disable-gpu`) |
| `/browser-mode headed` · *"mở browser"* · *"bật UI"* | `node scripts/browser-mode.mjs headed` | Chuyển MCP sang **Headed Mode** (`1600,750`, hiện cửa sổ tại `0,0`) |
| `/browser-mode --video=on` · *"bật quay video MCP"* | `node scripts/browser-mode.mjs --video=on` | Bật ghi hình phiên Playwright MCP vào `reports/mcp-videos/` |
| `/browser-mode --video=off` · *"tắt quay video MCP"* | `node scripts/browser-mode.mjs --video=off` | Tắt ghi hình phiên Playwright MCP (mặc định để tiết kiệm CPU/ổ đĩa) |

## 2. Quy tắc áp dụng cho 2 tầng Browser

1. **Tầng Playwright MCP (`.mcp.json`, `.agents/plugins/claude-testing-skills/mcp_config.json` & `.claude/playwright-mcp-config.json`):**
   - Chạy lệnh `node scripts/browser-mode.mjs <headless|headed|status> [--video=on|off]` (tự động đồng bộ cấu hình cho cả Claude Code và Antigravity).
   - Sau khi đổi cấu hình MCP đang chạy giữa phiên, nhắc user gõ `/mcp` (trên Claude Code) hoặc reload MCP Servers (trên Antigravity) để Playwright MCP nhận tham số launch mới.
2. **Tầng Automation Test Runner (Playwright TS / Java / Selenium / Pytest):**
   - **Browser Mode:** Mặc định `HEADLESS=true` (`1920×1080`). Ghi đè tức thì: `HEADLESS=false npx playwright test`, `mvn test -Dheadless=false`, hoặc `HEADLESS=false pytest`.
   - **Video Evidence Mode (`VIDEO_MODE`):**
     - `VIDEO_MODE=retain-on-failure` (**mặc định**): Chỉ giữ và đính kèm video vào Allure (`video_khi_that_bai`) khi test **FAIL** (tự xóa video tạm khi PASS).
     - `VIDEO_MODE=on`: Lưu và đính kèm video vào Allure + `reports/videos/` cho **cả PASS (`video_bang_chung_pass`) lẫn FAIL (`video_khi_that_bai`)**.
     - `VIDEO_MODE=off`: Tắt quay video hoàn toàn.

## 3. Khi nào chuyển sang Headed Mode hoặc bật Video?

- **Mặc định luôn giữ `HEADLESS` (`1920×1080`) + `Video: OFF` (MCP) / `VIDEO_MODE=retain-on-failure` (Runner)** để tránh tiêu tốn GPU render và ổ đĩa.
- **Chuyển sang `HEADED` (`1600×750`)** khi user muốn quan sát trực tiếp hoặc cần nhập CAPTCHA, OTP, MFA để lưu `.auth/user_state.json`.
- **Bật `VIDEO_MODE=on` (hoặc `--video=on` trên MCP)** khi chạy nghiệm thu UAT / Sign-off cần video bằng chứng cho cả các kịch bản PASS.
