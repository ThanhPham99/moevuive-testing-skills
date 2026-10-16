# Chiến Lược Chọn Locator & Ma Trận Ưu Tiên Chuẩn (Locator Priority Matrix)

> Độ ổn định và khả năng đọc hiểu của locator quyết định sức khỏe của một automation framework.
> Nguyên tắc cốt lõi: **KHÔNG BAO GIỜ** chọn phần tử dựa trên cấu trúc DOM gắn với giao diện/styling. Luôn định vị dựa trên thuộc tính ngữ nghĩa hoặc định danh kiểm thử bền vững.

## 1. Ma Trận Ưu Tiên Bộ Định Vị Chuẩn (Canonical Locator Priority Matrix)

Đây là **nguồn sự thật duy nhất (Single Source of Truth)** quy định thứ tự ưu tiên chọn locator cho cả 3 engine trong toàn bộ repo:

| Thứ tự | Playwright (Web) | Selenium WebDriver (Web) | Appium (Mobile Android / iOS / Flutter) | Khi nào áp dụng |
|---|---|---|---|---|
| **1** | `getByRole(role, { name })` | `By.id()` *(ổn định, không tự sinh)* | `AppiumBy.accessibilityId()` (`content-desc` / `accessibility-id` / Flutter `Semantics`) | Ưu tiên số 1: ngữ nghĩa Accessibility/ARIA hoặc ID cố định |
| **2** | `getByLabel()` · `getByPlaceholder()` | `By.cssSelector("[data-testid='...']")` (`data-test`, `data-qa`) | `AppiumBy.id()` (`resource-id` trên Android / `name` trên iOS) | Trường form có `<label>`/`placeholder` hoặc thuộc tính test chuyên dụng |
| **3** | `getByText()` *(văn bản tĩnh)* | `By.name()` | `AppiumBy.androidUIAutomator()` (`UiSelector`) · `AppiumBy.iOSNsPredicateString()` | Phần tử có văn bản cố định, thuộc tính `name`, hoặc bộ lọc native |
| **4** | `getByTestId()` (`data-testid`, `data-test`, `data-qa`) | `By.cssSelector()` *(scoped theo ngữ cảnh cha / thuộc tính ARIA)* | `AppiumBy.iOSClassChain()` | Khi dự án gắn `data-testid` hoặc cần lọc theo cấu trúc cha-con ngắn |
| **5** | `locator('css')` + `.filter({ hasText })` | `By.xpath()` *(chỉ dùng XPath tương đối, lựa chọn cuối cùng)* | `AppiumBy.xpath()` *(chỉ dùng XPath tương đối, lựa chọn cuối cùng)* | Phương án dự phòng khi các cấp trên không khả thi |
| **6** | `locator('xpath=...')` *(tương đối, lựa chọn cuối cùng)* | — | — | Lựa chọn cuối cùng trên Playwright |

## 2. Quy Tắc Ổn Định & Định Vị Theo Ngữ Cảnh (Stability & Scoping Rules)

Mọi locator phải đảm bảo:
- Khớp **đúng 1 phần tử duy nhất** trong phạm vi tương tác (`count === 1` / `findElements().size() == 1`).
- Sống sót qua thay đổi bố cục (thêm/bớt `div` wrapper, đổi flexbox/grid).
- Với phần tử lặp trong bảng/danh sách hoặc nằm trong Modal/Dialog: **định vị theo ngữ cảnh cha** (ví dụ: `page.getByRole('row').filter({ hasText: 'Mã KH' }).getByRole('button', { name: 'Sửa' })`).

**NGHIÊM CẤM sử dụng:**
- CSS class name động / hash tạm thời (`css-1n2xyz-btn`, `sc-...`, `MuiBox-root`)
- Chuỗi `nth-child`, `nth-of-type`, `.nth(0)` khi có thể lọc theo văn bản/ngữ cảnh
- ID tự sinh bởi framework (`:r1:`, `ember123`, `mat-input-0`)
- XPath tuyệt đối hoặc phụ thuộc chỉ số vị trí (`/html/body/...`, `//div[3]/div[2]/form/button`)

## 3. Quy Trình Xác Minh Locator

Trước khi đưa locator vào Page Object, bắt buộc kiểm chứng trên DOM / UI Hierarchy thực tế:
1. Locator có khớp **đúng 1 phần tử** (`count === 1`) không?
2. Phần tử khớp có hiển thị và tương tác được không (không bị che bởi overlay/shadow DOM)?
3. Reload / điều hướng lại trang — locator có còn khớp ổn định không?
4. Thử trên các trạng thái trang (loading, có dữ liệu, trạng thái rỗng) — locator có bền vững không?

## 4. Quy Tắc Chi Tiết Theo Framework

- Playwright: [`.claude/rules/playwright_rules.md`](playwright_rules.md) (Mục 3)
- Selenium: [`.claude/rules/selenium_rules.md`](selenium_rules.md) (Mục 1)
- Appium: [`.claude/rules/appium_rules.md`](appium_rules.md) (Mục 1)
