# Quy Tắc Dành Riêng Cho Appium (Mobile Automation)

> Áp dụng khi tự động hóa ứng dụng mobile với Java/Python và Appium — **Native Android · Native iOS · Flutter · Hybrid**.
>
> Quy trình recon & thu locator: [`skills-mobile-debug-agent`](../skills/skills-mobile-debug-agent/SKILL.md) · Chi tiết Flutter Semantics, Gestures & Multi-device: [`APPIUM_CAPABILITIES_AND_GESTURES.md`](../skills/skills-mobile-debug-agent/references/APPIUM_CAPABILITIES_AND_GESTURES.md) · Code mẫu: [`TEMPLATES_APPIUM_JAVA.md`](../skills/skills-framework-architect/references/TEMPLATES_APPIUM_JAVA.md).

---

## 0. Chọn Driver Theo Loại App (Quyết Định Trước Mọi Thứ Khác)

**Không xác định được app thuộc loại nào thì không viết được locator.** Phải dump page source (`appium_get_page_source`) để phân loại trước:

| Loại app | `automationName` | Dấu hiệu nhận biết khi dump hierarchy |
|---|---|---|
| **Native Android** (Kotlin/Java) | `UiAutomator2` | Nhiều node `android.widget.*` có `resource-id`, `text`, `content-desc` |
| **Native iOS** (Swift/ObjC) | `XCUITest` | Nhiều node `XCUIElementType*` có `name`, `label`, `value` |
| **Flutter (Đường A — Mặc định)** | `UiAutomator2` / `XCUITest` | `FlutterView` + các node con có `content-desc` (khi đã bật Semantics) |
| **Flutter (Chưa bật Semantics)** | — | **Chỉ một node `FlutterView` / `FlutterSurfaceView` rỗng bên trong** → 🛑 DỪNG NGAY |
| **Flutter (Đường B)** | `Flutter` / `FlutterIntegration` | Chỉ chạy trên bản build **debug/profile**; dùng `byValueKey`, `bySemanticsLabel` |
| **Hybrid / WebView** | `UiAutomator2` / `XCUITest` + `context` | Có node `android.webkit.WebView` / `XCUIElementTypeWebView` |

---

## 1. Thứ Tự Ưu Tiên Locator Theo Nền Tảng

> Ma trận đối chiếu chung 3 framework nằm tại [`locator_strategy.md`](locator_strategy.md). Code mẫu `AppiumBy` cho từng mức xem tại [`APPIUM_CAPABILITIES_AND_GESTURES.md`](../skills/skills-mobile-debug-agent/references/APPIUM_CAPABILITIES_AND_GESTURES.md).

- **Native Android:** 1. `AppiumBy.accessibilityId` (`content-desc`) → 2. `AppiumBy.id` (`resource-id`) → 3. `AppiumBy.androidUIAutomator` (`UiSelector`) → 4. XPath tương đối.
- **Native iOS:** 1. `AppiumBy.accessibilityId` (`name`) → 2. `AppiumBy.iOSNsPredicateString` → 3. `AppiumBy.iOSClassChain` → 4. XPath tương đối (chậm nhất, tránh tối đa).
  - *Lưu ý iOS:* Dùng `name` (`accessibilityIdentifier`) làm locator cố định; `label` đổi theo ngôn ngữ nên chỉ dùng để assert nội dung.
- **Flutter (Đường A — Semantics + Native Driver):** Dùng `AppiumBy.accessibilityId("<label>")` ánh xạ tới `Semantics(label: '...')` hoặc `Semantics(identifier: '...')`.
  - 🚨 **Cảnh báo bắt buộc với Dev:** `Key('login_btn')` / `ValueKey` trong Flutter **KHÔNG** sinh ra `content-desc` cho `UiAutomator2`/`XCUITest`. Nếu hierarchy chỉ có `FlutterView` rỗng, **dừng ngay** và gửi checklist trong [`APPIUM_CAPABILITIES_AND_GESTURES.md`](../skills/skills-mobile-debug-agent/references/APPIUM_CAPABILITIES_AND_GESTURES.md) mục 2 cho Dev.
- **Hybrid / WebView:** Dùng `driver.context("WEBVIEW_<pkg>")` để thao tác DOM web, và **BẮT BUỘC** gọi `driver.context("NATIVE_APP")` ngay khi quay lại màn hình native.

---

## 2. NGHIÊM CẤM (Mọi Loại App)

- ❌ **XPath tuyệt đối bám vị trí** (`//android.widget.FrameLayout[1]/...`) — thay đổi layout nhỏ nhất cũng gãy.
- ❌ **`Thread.sleep()`** dưới mọi hình thức — bắt buộc dùng `WebDriverWait` (timeout mặc định mobile **15s**).
- ❌ **Toạ độ cứng** `tap(540, 1200)` để thay cho locator — đổi độ phân giải màn hình là sai vị trí.
- ❌ **Đoán locator khi `FlutterView` rỗng** hoặc trộn Đường A và Đường B trong cùng một test suite.
- ❌ **Trộn implicit wait với explicit wait** (`WebDriverWait`).
- ❌ **Truy vấn element ngoài màn hình mà chưa scroll** (đặc biệt danh sách Flutter chỉ render item đang hiển thị trên viewport).

---

## 3. Kiến Trúc Screen Object, Gestures & Multi-Device Parallel

1. **Screen Object Model (`*Screen.java` / `*_screen.py`):**
   - Mỗi màn hình là 1 class kế thừa `BaseScreen`.
   - Locator khác nhau giữa Android và iOS phải tách trong Screen class qua helper `byPlatform(androidBy, iosBy)`, **không** viết `if (isAndroid)` rải rác trong test.
2. **Gestures chuẩn nền tảng:**
   - Android: `UiScrollable.scrollIntoView(...)` hoặc W3C Actions.
   - iOS: `driver.executeScript("mobile: scroll", ...)` / `"mobile: swipe"`.
   - Chi tiết code mẫu: [`APPIUM_CAPABILITIES_AND_GESTURES.md`](../skills/skills-mobile-debug-agent/references/APPIUM_CAPABILITIES_AND_GESTURES.md) mục 3.
3. **Chạy song song nhiều thiết bị (`parallel="tests"`):**
   - Số luồng = **số thiết bị thật/emulator đang kết nối**.
   - Driver quản lý bằng `ThreadLocal<AppiumDriver>` và gọi `remove()` ở `@AfterMethod`.
   - Mỗi thiết bị trong `capabilities/devices.json` bắt buộc có `udid` riêng, `systemPort` riêng (Android) và `wdaLocalPort` riêng (iOS).

---

## 4. Đặc Thù Mobile Bắt Buộc Kiểm Thử

| Tình huống | Cách thực hiện |
|---|---|
| **Xoay màn hình** | `driver.rotate(ScreenOrientation.LANDSCAPE)` — kiểm tra layout không vỡ |
| **Background → Foreground** | `driver.runAppInBackground(Duration.ofSeconds(5))` — kiểm tra giữ nguyên state |
| **Dialog xin quyền OS** | Android: `autoGrantPermissions: true` · iOS: `autoAcceptAlerts: true` |
| **Bàn phím che input** | Ẩn bàn phím (`hideKeyboard()`) trước khi tap nút bên dưới |
| **Mất mạng / Mạng yếu** | Bật/tắt chế độ máy bay hoặc network connection, kiểm tra thông báo lỗi |
