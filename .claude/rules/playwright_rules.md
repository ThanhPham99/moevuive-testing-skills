# Quy Tắc Dành Riêng Cho Playwright

> Áp dụng khi thiết lập, khảo sát giao diện (Playwright MCP) và chạy automation với Playwright (TypeScript hoặc Java).

## 1. Thiết Lập Browser & Chế Độ Thực Thi (Browser Execution Mode)

- **Mặc định chạy Headless Mode (`1920×1080`, tắt GPU render):** Mọi tác vụ khảo sát hệ thống (recon), lấy DOM snapshot, thực thi manual test, heal locator và chạy automation test suite đều chạy **Headless Mode** mặc định để tiết kiệm GPU/RAM và không bị giới hạn bởi khung cửa sổ OS.
- **Headed Mode (`1600×750`) là chế độ bật theo yêu cầu (Opt-in):** Chỉ chuyển sang **Headed Mode** khi:
  1. Người dùng yêu cầu mở trình duyệt để quan sát trực tiếp (*"mở browser"*, *"chạy headed"*, *"bật UI"*).
  2. Trang đích có bước xác thực thủ công (CAPTCHA, OTP, MFA) cần người dùng đăng nhập tay 1 lần để lưu `.auth/user_state.json`, sau đó chuyển lại về **Headless Mode**.

| Chế độ | Viewport | Launch Args / Đặc điểm | Khi nào dùng |
|---|---|---|---|
| **Headless (Mặc định)** | **`1920×1080`** | `--headless`, `--disable-gpu`, `--disable-dev-shm-usage`, `--no-sandbox` | Mặc định cho mọi tác vụ MCP recon, manual execution, regression & CI/CD |
| **Headed (Opt-in)** | **`1600×750`** | `--window-position=0,0` (vừa màn hình 1920×1080, không bị cắt cạnh phải/dưới) | Khi user yêu cầu xem trực tiếp hoặc cần qua CAPTCHA/OTP/MFA |

### Công tắc chuyển đổi nhanh (Browser Mode Switch)

1. **Cho Playwright MCP (Claude `.mcp.json`, Antigravity `.agents/plugins/claude-testing-skills/mcp_config.json` & `.claude/playwright-mcp-config.json`):**
   - Dùng slash command `/browser-mode` hoặc chạy script (đồng bộ cả 2 nền tảng trong 1 lệnh):
     ```bash
     node scripts/browser-mode.mjs status               # Kiểm tra chế độ hiện tại, trạng thái Video & đồng bộ Antigravity
     node scripts/browser-mode.mjs headless             # Chuyển về Headless (1920x1080, tắt GPU — mặc định)
     node scripts/browser-mode.mjs headed               # Chuyển sang Headed (1600x750, hiện cửa sổ)
     node scripts/browser-mode.mjs headless --video=on  # Bật ghi video phiên MCP vào reports/mcp-videos/
     ```
   - Nếu đổi chế độ khi phiên đang mở, gõ `/mcp` (Claude Code) hoặc reload MCP Servers (Antigravity) để reconnect Playwright MCP server.
2. **Cho Automation Test Runner (Playwright TS / Java / Selenium):**
   - Mặc định đọc `HEADLESS=true` (`1920×1080`).
   - Khi user yêu cầu mở browser cho một lần chạy, truyền trực tiếp qua CLI mà không cần sửa file config:
     - Playwright TS: `HEADLESS=false npx playwright test` hoặc `npx playwright test --headed`
     - Java Maven: `mvn test -Dheadless=false`

### Quy tắc Viewport trên Playwright MCP

- Viewport đã được cấu hình sẵn từ `--viewport-size` lúc khởi chạy MCP server (`1920×1080` ở Headless, `1600×750` ở Headed) — **không gọi `browser_resize` sau `browser_navigate`**.
- Ở **Headed Mode**, `browser_resize` chỉ đổi viewport bên trong chứ không nở cửa sổ OS; đặt lớn hơn `1600×750` trên màn hình Full HD sẽ làm cắt mất phần bên phải của trang. Nếu nghi lệch ở Headed Mode, đo trước bằng:
  ```js
  browser_evaluate: () => ({ inner:[innerWidth,innerHeight], outer:[outerWidth,outerHeight] })
  ```

## 2. Thứ Tự Tương Tác & Tìm Element (Playwright MCP & Fallback Chrome DevTools MCP)

Khi dùng Browser MCP, luôn đi theo thứ tự chuẩn:

```
navigate → wait_for(page_load) → snapshot → interact → screenshot(on_fail / evidence)
```

- Giữ nguyên phiên trang hiện tại nếu đã ở đúng URL (tránh gọi `browser_navigate` lại gây reload mất state).
- Dùng **`browser_snapshot`** để phân tích cấu trúc DOM và xác định locator thực tế; dùng **`browser_take_screenshot`** khi cần lưu bằng chứng hoặc khi test fail.
- Mọi locator đưa vào Page Object phải được verify khớp trên DOM thực tế của trang đích.

### Bảng ánh xạ Fallback sang `chrome-devtools-mcp` trên Antigravity
Mặc định ưu tiên dùng **`@playwright/mcp`** (tự động nạp qua `.agents/plugins/claude-testing-skills/mcp_config.json`). Trường hợp trên Antigravity chưa kết nối Playwright MCP mà đang bật sẵn **`chrome-devtools-mcp`**, agent tự động ánh xạ 1-1 các bước tương đương:

| Thao tác chuẩn | `@playwright/mcp` (Ưu tiên) | `chrome-devtools-mcp` (Fallback trên Antigravity) |
|---|---|---|
| Mở trang / điều hướng | `browser_navigate` | `navigate_page` (hoặc `new_page`) |
| Chờ trang / phần tử | `browser_wait_for` | `wait_for` |
| Lấy Accessibility Tree / DOM | `browser_snapshot` | `take_snapshot` |
| Tương tác phần tử | `browser_click` · `browser_type` · `browser_fill_form` · `browser_hover` · `browser_press_key` | `click` · `fill` · `fill_form` · `hover` · `press_key` |
| Chạy JS kiểm tra DOM/CSS | `browser_evaluate` | `evaluate_script` |
| Chụp ảnh bằng chứng | `browser_take_screenshot` | `take_screenshot` (`filePath`, `fullPage`) |
| Đọc Network / Console | `browser_network_requests` · `browser_console_messages` | `list_network_requests` · `list_console_messages` |

## 3. Thứ Tự Ưu Tiên Locator Playwright

Tuân thủ cột **Playwright (Web)** trong **Ma Trận Ưu Tiên Bộ Định Vị Chuẩn (Locator Priority Matrix)** tại [`.claude/rules/locator_strategy.md`](locator_strategy.md) (`getByRole` → `getByLabel` / `getByPlaceholder` → `getByText` → `getByTestId` → Scoped CSS `.filter()` → Relative XPath):

```typescript
// Chuẩn — Semantic locator
page.getByRole('button', { name: 'Đăng nhập' });
page.getByLabel('Email');
page.getByPlaceholder('Nhập mật khẩu');
```

## 4. Chiến Lược Chờ Đợi (Smart Waits)

Sử dụng cơ chế auto-waiting và Web-First Assertions có timeout rõ ràng thay cho mọi lệnh tạm dừng cố định (`waitForTimeout`, `setTimeout`):

```typescript
await expect(locator).toBeVisible();
await expect(locator).toBeEnabled();
await expect(locator).toHaveText('Thành công');
await expect(page).toHaveURL(/dashboard/);
```

Chỉ dùng `waitForSelector()` hoặc `waitForResponse()` khi chờ điều kiện mạng/DOM đặc thù mà `expect()` không biểu diễn trực tiếp được.

## 5. Cấu Trúc Test Chuẩn

```typescript
test.describe('Tên Module', () => {
  test.beforeEach(async ({ page }) => {
    // Setup: khởi tạo Page Object, điều hướng
  });

  test('mô tả hành vi bằng Tiếng Việt', async ({ page }) => {
    // Arrange: chuẩn bị dữ liệu
    // Act: thực hiện hành động qua Page Object
    // Assert: kiểm chứng kết quả
  });
});
```

## 6. Quản Lý Phiên Đăng Nhập (`storageState`)

Để tránh lặp lại đăng nhập UI ở mọi test (giảm thời gian chạy 3–5 giây/TC và tránh chạm Rate-Limit/CAPTCHA):

1. **Lưu phiên đăng nhập:**
   ```typescript
   await page.context().storageState({ path: '.auth/user_state.json' });
   ```
   *(Thư mục `.auth/` phải nằm trong `.gitignore`).*
2. **Tái sử dụng phiên trong Test Suite:** Khai báo `storageState: '.auth/user_state.json'` trong `playwright.config.ts` hoặc `test.use({ storageState: '.auth/user_state.json' })`.
3. **Với hệ thống có MFA/OTP/CAPTCHA trên Playwright MCP:** Chuyển sang **Headed Mode** (`node scripts/browser-mode.mjs headed`), để tester đăng nhập tay 1 lần lưu state, sau đó chuyển lại về **Headless Mode** (`node scripts/browser-mode.mjs headless`) để chạy toàn bộ luồng recon/test còn lại.
