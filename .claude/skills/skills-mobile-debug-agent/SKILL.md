---
name: skills-mobile-debug-agent
description: "Inspect Native Android, Native iOS, Flutter, and Hybrid mobile apps via Appium MCP, dump UI hierarchies, verify platform locators, and diagnose missing Flutter Semantics."
---

# Mobile Debug Agent

## 1. Vai trò & Khi sử dụng

Skill inspect ứng dụng mobile **trên thiết bị thật / emulator / simulator** qua Appium MCP, thu thập locator đã kiểm chứng, và chẩn đoán lỗi `NoSuchElementException` theo đúng loại app (**Native Android · Native iOS · Flutter · Hybrid**).
- Đây là bản mobile của [`skills-ui-debug-agent`](../skills-ui-debug-agent/SKILL.md) (Web/DOM). Không dùng skill này cho trình duyệt web.
- **Trigger:** Khảo sát màn hình mobile mới, thu thập locator Android/iOS/Flutter, debug lỗi không tìm thấy phần tử, hoặc kiểm tra `FlutterView` rỗng.

---

## 2. Quy tắc bất di bất dịch

1. **KHÔNG ĐOÁN locator:** Mọi locator phải trích xuất từ UI hierarchy thực tế và **kiểm chứng bằng `appium_find_element`**.
2. **Nhận diện loại app TRƯỚC khi tìm locator:** Dump `appium_get_page_source` trước mọi thao tác.
3. **KHÔNG dùng toạ độ cứng** (`tap(x, y)`) hoặc **XPath tuyệt đối bám vị trí** để thay cho locator.
4. **Hierarchy chỉ có `FlutterView` rỗng → DỪNG NGAY:** Báo người dùng và gửi checklist Semantics cho Dev, tuyệt đối không bịa locator.
5. **Ghi nhận minh bạch:** Mỗi locator phải ghi rõ nền tảng (`Android` / `iOS`), loại locator, trạng thái `Verified`, và thiết bị đã kiểm chứng.

---

## 3. Quy trình chuẩn 4 bước (BẮT BUỘC theo thứ tự)

```text
select_device → session(create) → get_page_source → NHẬN DIỆN LOẠI APP
      → find_element (verify) → generate_locators → ghi bảng Locator Collection
```

### Bước 1 — Chọn thiết bị & mở phiên Appium
- Dùng `select_device` (hoặc `prepare_ios_simulator` / `appium_prepare_ios_real_device`) → mở phiên bằng `appium_session_management`.
- Chọn `automationName` theo [`.claude/rules/appium_rules.md`](../../rules/appium_rules.md) mục 0 (`UiAutomator2` cho Android, `XCUITest` cho iOS).

### Bước 2 — Dump Hierarchy & Nhận diện loại app (`appium_get_page_source`)

| Dấu hiệu trong Hierarchy | Kết luận | Hành động tiếp theo |
|---|---|---|
| Nhiều node `android.widget.*` / `XCUIElementType*` | **Native** | Sang Bước 3 |
| **Chỉ một** `FlutterView` / `FlutterSurfaceView` rỗng | **Flutter — Chưa bật Semantics** | 🛑 **Dừng ngay**, báo user & gửi 3 câu hỏi cho Dev (xem mục 4) |
| `FlutterView` + node con có `content-desc` | **Flutter — Đã bật Semantics** | Sang Bước 3, dùng `AppiumBy.accessibilityId` |
| Có `android.webkit.WebView` / `XCUIElementTypeWebView` | **Hybrid** | Đổi context qua `appium_context` sang `WEBVIEW_*` (nhớ quay về `NATIVE_APP` sau khi xong) |

### Bước 3 — Thu thập & Kiểm chứng Locator
1. Chọn locator theo thứ tự ưu tiên tại [`.claude/rules/locator_strategy.md`](../../rules/locator_strategy.md) và [`.claude/rules/appium_rules.md`](../../rules/appium_rules.md):
   - **Android:** `accessibilityId` (`content-desc`) → `id` (`resource-id`) → `androidUIAutomator` (`UiSelector`) → XPath tương đối.
   - **iOS:** `accessibilityId` (`name`) → `iOSNsPredicateString` → `iOSClassChain` → XPath tương đối.
   - **Flutter (Đường A):** `accessibilityId` ánh xạ từ `Semantics(label: '...')`.
2. **Verify từng locator** bằng `appium_find_element` và `appium_get_element_attribute` (`enabled`, `displayed`, `text`, `content-desc`).
3. Phần tử nằm ngoài màn hình → cuộn bằng `appium_gesture` (`action=scroll_to_element`), **không** tăng timeout.

### Bước 4 — Xuất Bảng Locator Collection
> Locator khác nhau giữa Android và iOS phải tách thành 2 dòng riêng biệt:

| Screen | Element | Platform | Locator | Loại | Verified |
|---|---|---|---|---|---|
| LoginScreen | Ô email | Android | `AppiumBy.accessibilityId("email_input")` | a11y id | ✅ |
| LoginScreen | Ô email | iOS | `AppiumBy.accessibilityId("email_input")` | a11y id | ✅ |
| LoginScreen | Nút đăng nhập | Android | `AppiumBy.id("com.app:id/btn_login")` | resource-id | ✅ |

---

## 4. Xử lý Flutter Hierarchy Rỗng & Chẩn Đoán Lỗi

- Khi `FlutterView` rỗng: **Dừng ngay**, báo người dùng xác nhận với Dev 3 điểm: (1) Bọc `Semantics(label: ...)` cho widget, (2) Bật `SemanticsBinding.instance.ensureSemantics()`, và (3) Cảnh báo rõ **`Key('login_btn')` không sinh ra `content-desc`** cho driver native.
- Toàn bộ code mẫu Dart `Semantics`, chuyển đổi context `NATIVE_APP ↔ WEBVIEW`, cuộn `UiScrollable` / `mobile: scroll`, cấu hình multi-device và **Bảng chẩn đoán 8 lỗi phổ biến** nằm tại:
  - [`references/APPIUM_CAPABILITIES_AND_GESTURES.md`](references/APPIUM_CAPABILITIES_AND_GESTURES.md)

---

## 5. Tham chiếu

- [`.claude/rules/appium_rules.md`](../../rules/appium_rules.md) · [`.claude/rules/locator_strategy.md`](../../rules/locator_strategy.md)
- [`references/APPIUM_CAPABILITIES_AND_GESTURES.md`](references/APPIUM_CAPABILITIES_AND_GESTURES.md) — Flutter Semantics, Gestures, Multi-device & Troubleshooting Matrix
- [`TEMPLATES_APPIUM_JAVA.md`](../skills-framework-architect/references/TEMPLATES_APPIUM_JAVA.md) — Screen Object & Driver Factory mẫu
