---
name: skills-ui-debug-agent
description: "Inspect live web DOM via Playwright MCP, analyze accessibility snapshots, extract and verify stable locators, capture UI evidence, and debug UI automation failures."
---

# UI Debug Agent

Inspect ứng dụng **web** trực tiếp trên trình duyệt qua Playwright MCP, phân tích DOM accessibility tree, xác định và kiểm chứng locators bền vững, thu thập screenshot evidence và chẩn đoán lỗi UI automation.

> 📱 **Ứng dụng Mobile (Android / iOS / Flutter):** Sử dụng [`skills-mobile-debug-agent`](../skills-mobile-debug-agent/SKILL.md).

---

## 1. Browser Execution Mode & Chuỗi Lệnh MCP Bắt Buộc

### Chế độ thực thi trình duyệt (Browser Execution Mode)
- **Mặc định — Headless Mode (`1920x1080`, tắt GPU):** Toàn bộ tác vụ inspect DOM, thu thập locator, chụp screenshot evidence và debug chạy ở chế độ ẩn với viewport desktop chuẩn `1920x1080` (`--headless`, `--disable-gpu`).
- **Opt-in — Headed Mode (`1600x750`, cửa sổ tại `0,0`):** Khi user yêu cầu mở trình duyệt xem trực tiếp hoặc trang bị chặn bởi CAPTCHA / OTP / MFA cần đăng nhập thủ công để lưu `.auth/user_state.json`, chuyển sang Headed Mode bằng lệnh:
  ```bash
  node scripts/browser-mode.mjs headed
  ```
  (hoặc gọi `/browser-mode headed`, sau đó reconnect `/mcp`). Khi hoàn tất đăng nhập/quan sát, gạt lại về mặc định: `node scripts/browser-mode.mjs headless`.

### Chuỗi lệnh Playwright MCP chuẩn
```text
1. browser_navigate(url)           → Mở trang (chỉ gọi khi cần đổi URL)
2. browser_wait_for(text/time)     → Chờ trang hoặc phần tử tải xong
3. browser_snapshot()              → Thu thập Accessibility Tree + ref IDs để phân tích DOM & chọn locator
4. browser_click/type/hover(ref)   → Tương tác thử bằng ref để kiểm chứng
5. browser_take_screenshot()       → Chụp ảnh bằng chứng tại các mốc quan trọng hoặc khi lỗi
```

> Giữ nguyên viewport đã cấu hình lúc khởi chạy MCP (`1920x1080` ở Headless hoặc `1600x750` ở Headed); không gọi `browser_resize`. Chi tiết: [`.claude/rules/playwright_rules.md`](../../rules/playwright_rules.md).

### Phân biệt `browser_snapshot` và `browser_take_screenshot`

| Tiêu chí | `browser_snapshot` | `browser_take_screenshot` |
|---|---|---|
| **Đầu ra** | Accessibility tree (text, role, attributes, `ref`) | Hình ảnh PNG/JPEG |
| **Mục đích chính** | Phân tích cấu trúc DOM, lấy locator, lấy `ref` để tương tác | Bằng chứng trực quan (evidence), báo cáo lỗi layout |
| **Tần suất dùng** | Luôn gọi trước và sau khi tương tác | Chỉ gọi tại milestone hoặc khi phát hiện lỗi |

---

## 2. Quy Trình Inspect DOM & Xác Định Locator

1. **Mở & chuẩn bị trang:** Điều hướng tới URL đích và chờ dấu hiệu trang tải xong. Nếu cần đăng nhập, sử dụng thông tin do user cung cấp trong phiên hoặc state đã lưu (không tự mở đọc giá trị mật khẩu từ `.env`).
2. **Đọc cấu trúc DOM từ `browser_snapshot`:**
   - Nhận diện các phần tử tương tác (buttons, inputs, links, selects, dialogs, tables).
   - Ghi nhận thuộc tính ngữ nghĩa: `role`, `name`, `label`, `placeholder`, `data-testid`, trạng thái (`enabled`/`disabled`/`checked`/`expanded`).
3. **Chọn Locator theo Ma Trận Ưu Tiên Bộ Định Vị Chuẩn ([`.claude/rules/locator_strategy.md`](../../rules/locator_strategy.md)):**
   - Tra cứu đúng cột **Playwright (Web)** hoặc **Selenium WebDriver (Web)** trong `locator_strategy.md` để chọn Primary + Fallback locator độc lập thuộc tính.
4. **Kiểm chứng Locator trực tiếp trên DOM thật:**
   - Tương tác thử qua `ref` và chụp lại `browser_snapshot` để xác nhận hành vi.
   - Đảm bảo locator đạt đầy đủ các quy tắc ổn định tại [`.claude/rules/locator_strategy.md`](../../rules/locator_strategy.md) (`count === 1`, không dùng class hash động hay XPath vị trí).

---

## 3. Xử Lý Các Tình Huống UI Đặc Biệt

| Tình huống | Cách xử lý chuẩn |
|---|---|
| **Modal / Dialog / Drawer** | Chờ animation mở hoàn tất (`browser_wait_for`), gọi `browser_snapshot` mới để lấy `ref` bên trong modal. |
| **Iframe** | Dùng `page.frameLocator('#iframe-id')` (Playwright) hoặc `browser_evaluate` để đọc nội dung `iframe.contentDocument`. |
| **Shadow DOM** | Playwright CSS/Role locator tự xuyên qua open Shadow DOM; với Selenium dùng `element.getShadowRoot().findElement(...)`. |
| **SPA / Lazy Load / Virtual Scroll** | Cuộn trang hoặc chờ text/network hoàn tất (`browser_wait_for`) trước khi gọi `browser_snapshot`. |
| **Bảng / Danh sách lặp (Table/List)** | Định vị theo dòng ngữ cảnh: `page.getByRole('row').filter({ hasText: 'Mã KH' }).getByRole('button', { name: 'Sửa' })`. |
| **Overlay / Toast che nút** | Chờ spinner/toast biến mất (`browser_wait_for(textGone)`) trước khi click phần tử bên dưới. |

---

## 4. Đầu Ra (Outputs) & Rules Tham Chiếu

- **Bảng đề xuất Locator:** Primary locator + Fallback locator kèm độ tin cậy cho từng phần tử.
- **Phân tích nguyên nhân lỗi UI:** Giải thích rõ lý do `ElementNotFound` / `Timeout` / `ClickIntercepted` kèm cách sửa trong Page Object.
- **Rules tham chiếu:** [`.claude/rules/locator_strategy.md`](../../rules/locator_strategy.md) · [`.claude/rules/playwright_rules.md`](../../rules/playwright_rules.md) · [`.claude/rules/selenium_rules.md`](../../rules/selenium_rules.md).