---
name: skills-smart-locator-agent
description: "Generate and validate unique, resilient UI locators (Primary + Fallback) for Playwright, Selenium, and Appium from live DOM or mobile hierarchies."
---

# Smart Locator Agent

Thiết kế và kiểm chứng bộ định vị phần tử giao diện (UI Locators — gồm **Primary** và **Fallback**) bền vững, duy nhất cho **Playwright**, **Selenium WebDriver**, và **Appium** từ DOM hoặc Mobile UI Hierarchy thực tế.

---

## 1. Vai Trò & Khi Nào Sử Dụng

- **Khi sử dụng:**
  - Trích xuất bộ định vị mới cho các phần tử trên màn hình Web hoặc Mobile (`/generate-locator`).
  - Cung cấp bộ định vị đạt chuẩn khi viết mới Page Object / Screen Object.
  - Chuyển đổi bộ định vị giữa các công cụ (Playwright ↔ Selenium ↔ Appium).
- **Khi cần sửa hàng loạt locator bị gãy trong Page Object đã có:** Sử dụng [`skills-locator-healer-agent`](../skills-locator-healer-agent/SKILL.md) (`/heal-locators`).

---

## 2. Quy Trình 5 Bước Bắt Buộc (Cấm Đoán Mò Locator)

1. **Khảo sát DOM / UI Hierarchy thực tế (Inspect):**
   - **Web:** Dùng Playwright MCP (`browser_navigate` → `browser_wait_for` → `browser_snapshot`, mặc định **Headless `1920x1080`**) qua [`skills-ui-debug-agent`](../skills-ui-debug-agent/SKILL.md).
   - **Mobile:** Trích xuất XML page source thật từ thiết bị/emulator qua [`skills-mobile-debug-agent`](../skills-mobile-debug-agent/SKILL.md).
2. **Nhận diện thuộc tính bền vững:** Thu thập `role`, `aria-label`, `label`, `placeholder`, `data-testid`, `id`/`name` cố định, `accessibilityId` (`content-desc`/`label`).
3. **Thiết kế Primary Locator:** Chọn cấp độ ưu tiên cao nhất theo Ma trận mục 3.
4. **Thiết kế Fallback Locator:** Chọn phương án dự phòng độc lập thuộc tính với Primary (để không gãy cùng lúc nếu 1 thuộc tính đổi).
5. **Kiểm chứng độ duy nhất (`count === 1`):** Xác nhận locator khớp đúng 1 phần tử hiển thị và tương tác được trên màn hình.

---

## 3. Ma Trận Ưu Tiên Bộ Định Vị Chuẩn (Single Source of Truth)

Luôn chọn **Primary** và **Fallback** locator tuân thủ nghiêm ngặt **Ma Trận Ưu Tiên Bộ Định Vị 3 Nền Tảng** và quy tắc định vị theo vùng chứa (Scoping) tại [`.claude/rules/locator_strategy.md`](../../rules/locator_strategy.md):

- **Playwright (Web):** `getByRole(role, { name })` → `getByLabel()` / `getByPlaceholder()` → `getByText()` → `getByTestId()` → Scoped CSS `.filter()` → Relative XPath. Chi tiết: [`.claude/rules/playwright_rules.md`](../../rules/playwright_rules.md).
- **Selenium WebDriver (Web):** `By.id()` (cố định) → `By.cssSelector("[data-testid='...']")` → `By.name()` → Scoped `By.cssSelector()` → Relative `By.xpath()`. Chi tiết: [`.claude/rules/selenium_rules.md`](../../rules/selenium_rules.md).
- **Appium (Mobile):** `AppiumBy.accessibilityId()` → `AppiumBy.id()` (`resource-id` / `name`) → `androidUIAutomator` / `iOSNsPredicateString` → `iOSClassChain` → Relative `AppiumBy.xpath()`. Chi tiết: [`.claude/rules/appium_rules.md`](../../rules/appium_rules.md).

---

## 4. Quy Tắc Kiểm Chứng & Định Dạng Đầu Ra Chuẩn

### Checklist kiểm chứng trước khi bàn giao Locator
- [ ] Khớp duy nhất 1 phần tử (`count === 1`) trên trạng thái màn hình đích.
- [ ] Phần tử đang hiển thị (`visible`) và sẵn sàng nhận tương tác (`enabled`).
- [ ] Giữ nguyên giá trị qua các lần tải lại trang (không chứa chuỗi tự sinh theo phiên).
- [ ] Không bị ảnh hưởng khi thay đổi bố cục trang trí (CSS styling/layout).
- [ ] **Tuyệt đối không dùng** class hash động (`css-1a2b3c`, `sc-xxx`) hoặc XPath chỉ số vị trí (`//div[3]/button[2]`).

### Bảng đầu ra chuẩn khi cung cấp Locator
| Phần tử | Primary Locator | Fallback Locator | Cấp độ bền & Lý do chọn |
|---|---|---|---|
| Nút Lưu | `page.getByRole('button', { name: 'Lưu' })` | `page.getByTestId('btn-save')` | 🟢 Cấp 1 — Ngữ nghĩa role + accessible name duy nhất |

---

## 5. Tài Liệu Tham Chiếu

- [`.claude/rules/locator_strategy.md`](../../rules/locator_strategy.md) — Ma trận ưu tiên bộ định vị 3 nền tảng & mẫu code chuẩn
- [`.claude/rules/playwright_rules.md`](../../rules/playwright_rules.md) · [`.claude/rules/selenium_rules.md`](../../rules/selenium_rules.md) · [`.claude/rules/appium_rules.md`](../../rules/appium_rules.md)