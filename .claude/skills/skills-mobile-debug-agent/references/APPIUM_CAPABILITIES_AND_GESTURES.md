# Appium Capabilities, Flutter Semantics, Gestures & Troubleshooting Reference

> **Thuộc skill:** [`skills-mobile-debug-agent`](../SKILL.md) · **Rule gốc:** [`.claude/rules/appium_rules.md`](../../../rules/appium_rules.md)

---

## 1. Code Mẫu Locator Theo Nền Tảng (`AppiumBy`)

### 1.1 Native Android (`UiAutomator2`)
```java
// 1 — Accessibility id (content-desc) — Ưu tiên #1
driver.findElement(AppiumBy.accessibilityId("login_button"));

// 2 — resource-id (ghi đủ package)
driver.findElement(AppiumBy.id("com.application.xyz:id/login_button"));

// 3 — UiSelector theo text
driver.findElement(AppiumBy.androidUIAutomator("new UiSelector().text(\"Đăng nhập\")"));

// 4 — XPath tương đối (lựa chọn cuối cùng)
driver.findElement(AppiumBy.xpath("//android.widget.Button[@text='Đăng nhập']"));
```

### 1.2 Native iOS (`XCUITest`)
```java
// 1 — Accessibility id (accessibilityIdentifier) — Ưu tiên #1
driver.findElement(AppiumBy.accessibilityId("login_button"));

// 2 — iOS Predicate String
driver.findElement(AppiumBy.iOSNsPredicateString("type == 'XCUIElementTypeButton' AND label == 'Đăng nhập'"));

// 3 — iOS Class Chain (**/ = tìm ở mọi cấp)
driver.findElement(AppiumBy.iOSClassChain("**/XCUIElementTypeButton[`label == 'Đăng nhập'`]"));
```

| Thuộc tính iOS | Ý nghĩa | Cách dùng |
|---|---|---|
| `name` | `accessibilityIdentifier` (cố định) | **Locator ưu tiên #1** — không đổi theo ngôn ngữ |
| `label` | Text hiển thị cho người dùng | Assert nội dung (không dùng làm locator nếu đa ngôn ngữ) |
| `value` | Giá trị hiện tại của input/switch | Assert trạng thái |

---

## 2. Flutter — Thoả Thuận Bắt Buộc Với Dev (Đường A vs Đường B)

| Tiêu chí | **Đường A — Semantics + Native Driver** ⭐ Mặc định | **Đường B — Flutter Driver** |
|---|---|---|
| `automationName` | `UiAutomator2` / `XCUITest` | `Flutter` hoặc `FlutterIntegration` |
| Bản build | **Release / Staging / Debug đều chạy** | **Bắt buộc Debug/Profile** (nhúng extension) |
| Locator | `AppiumBy.accessibilityId("...")` từ `Semantics` | `byValueKey`, `bySemanticsLabel`, `byText`, `byType` |
| Nhìn thấy `Key('...')`? | ❌ Không (`Key`/`ValueKey` không sinh `content-desc`) | ✅ Có |

### Code Dart Dev cần bọc cho Đường A
```dart
Semantics(
  label: 'login_button', // hoặc identifier: 'login_button' trên Flutter mới
  child: ElevatedButton(...),
)
// Và bật: SemanticsBinding.instance.ensureSemantics();
```

### 3 Câu Hỏi Gửi Dev Khi Hierarchy Chỉ Có `FlutterView` Rỗng
1. App đã bọc `Semantics(label: ...)` (hoặc `identifier:`) cho các widget cần kiểm thử chưa?
2. Đã gọi `SemanticsBinding.instance.ensureSemantics()` khi khởi tạo chưa?
3. Cảnh báo rõ: **`Key('login_btn')` không sinh ra `content-desc`** cho `UiAutomator2`/`XCUITest`.

---

## 3. Hybrid / WebView Context Switching & Gestures

### 3.1 Đổi Context Native ↔ WebView
```java
Set<String> contexts = driver.getContextHandles(); // [NATIVE_APP, WEBVIEW_com.app]
driver.context("WEBVIEW_com.app");
driver.findElement(By.cssSelector("#submit")).click();
driver.context("NATIVE_APP"); // BẮT BUỘC quay lại trước khi thao tác native
```

### 3.2 Cuộn & Gesture Theo Nền Tảng
```java
// Android — cuộn tới element theo text
driver.findElement(AppiumBy.androidUIAutomator(
    "new UiScrollable(new UiSelector().scrollable(true))"
  + ".scrollIntoView(new UiSelector().text(\"Đăng nhập\"))"));

// iOS — cuộn trong container tới element khớp predicate
driver.executeScript("mobile: scroll", Map.of(
    "direction", "down",
    "predicateString", "label == 'Đăng nhập'"));
```
> **Lưu ý Flutter:** Danh sách Flutter chỉ render item đang hiển thị trên viewport. Nếu chưa thấy node trong semantics tree, phải cuộn từng bước bằng gesture rồi tìm lại (không tăng timeout).

---

## 4. Chạy Song Song Nhiều Device & Bảng Chẩn Đoán Lỗi

### 4.1 Capabilities Bắt Buộc Cho Multi-Device (`testng.xml` `parallel="tests"`)
- `udid` (Cả hai): Chỉ đích danh thiết bị thật/emulator.
- `systemPort` (Android): Port riêng cho mỗi UiAutomator2 server (tránh đụng độ phiên).
- `wdaLocalPort` (iOS): Port riêng cho mỗi WebDriverAgent (kèm `xcodeOrgId`, `xcodeSigningId`, `updatedWDABundleId` trên real device).

### 4.2 Bảng Chẩn Đoán Lỗi Mobile
| Triệu chứng | Nguyên nhân gốc rễ | Cách xử lý |
|---|---|---|
| `NoSuchElementException`, hierarchy **có** element | Locator sai kiểu / sai nền tảng | Dump lại `appium_get_page_source`, lấy đúng thuộc tính, verify bằng `appium_find_element` |
| Hierarchy chỉ có `FlutterView` rỗng | Flutter chưa bật Semantics | Dừng ngay, gửi 3 câu hỏi mục 2 cho Dev |
| Element có trong hierarchy nhưng không tap được | Bị bàn phím che, `enabled=false`, ngoài viewport | Ẩn bàn phím, kiểm tra `displayed`/`enabled`, scroll tới trước |
| Tìm thấy trên Android, mất trên iOS | Locator không cross-platform | Tách locator theo nền tảng trong `BaseScreen.byPlatform()` |
| Locator native fail hàng loạt sau WebView | Đang kẹt ở context `WEBVIEW_*` | Gọi `driver.context("NATIVE_APP")` |
| Phiên không mở được trên iOS real device | WebDriverAgent chưa ký chứng chỉ | Chạy `appium_prepare_ios_real_device` |
| Chạy 1 device ổn, nhiều device lỗi loạn | Trùng `systemPort` / `wdaLocalPort` | Cấu hình port riêng cho từng `<test>` trong `devices.json` |
