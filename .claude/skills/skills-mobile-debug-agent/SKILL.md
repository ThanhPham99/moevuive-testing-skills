---
name: skills-mobile-debug-agent
description: "Inspect Native Android, Native iOS, Flutter, and Hybrid mobile apps via Appium MCP, dump UI hierarchies, verify platform locators, and diagnose missing Flutter Semantics."
---

# Mobile Debug Agent

## Description

Skill inspect ứng dụng mobile **trên device/emulator thật** qua Appium MCP, thu thập locator đã verify, và chẩn đoán lỗi "không tìm thấy element" theo đúng loại app.

Đây là bản mobile của [`skills-ui-debug-agent`](../skills-ui-debug-agent/SKILL.md) (web/DOM). Hai skill **không thay thế nhau**: DOM và UI hierarchy của mobile là hai thứ khác nhau, và Flutter thì khác cả hai.

Agent có thể:

- Chọn device, mở phiên Appium đúng `automationName` theo loại app
- Dump UI hierarchy → **nhận diện Native / Flutter / Hybrid** trước khi tìm locator
- Thu locator ổn định riêng cho Android và iOS, verify bằng cách tìm và thao tác thật
- Phát hiện app Flutter **chưa bật semantics** và báo đúng việc cần dev làm
- Đổi context native ↔ webview cho app hybrid
- Chẩn đoán `NoSuchElementException` theo nguyên nhân thật, không đoán

---

## When to Use

- Khảo sát màn hình mobile mới, chưa có Screen Object
- Cần locator cho element trên app Android/iOS/Flutter
- Test mobile fail `NoSuchElementException` / `StaleElement` cần tìm nguyên nhân
- App Flutter mở Inspector lên **không thấy element nào**
- Cần biết app đang test là Native hay Flutter hay Hybrid

Trigger: "inspect app mobile", "tìm locator Android", "locator iOS", "app Flutter không thấy element", "dump hierarchy"

> Web/trình duyệt → dùng `skills-ui-debug-agent`. Đừng dùng skill này cho web.

---

## Quy tắc bất di bất dịch

1. **KHÔNG ĐOÁN locator** — mọi locator phải lấy từ hierarchy thật và **verify bằng `appium_find_element`**
2. **Nhận diện loại app TRƯỚC khi tìm locator** — làm ngược thứ tự là nguồn gốc của mọi bế tắc với Flutter
3. **KHÔNG dùng toạ độ** (`tap(x, y)`) để thay cho locator — kể cả khi bí
4. **KHÔNG sinh XPath tuyệt đối bám vị trí**
5. Hierarchy chỉ có `FlutterView` rỗng → **DỪNG, báo user**, không bịa locator
6. Mỗi locator ghi rõ **đã verify hay chưa**, và verify trên **device nào**

---

## Quy trình chuẩn (BẮT BUỘC theo thứ tự)

```
select_device → session(create) → get_page_source → NHẬN DIỆN LOẠI APP
      → find_element (verify) → generate_locators → ghi bảng Locator Collection
```

### Bước 1 — Chọn device & mở phiên

| Việc | Tool |
|---|---|
| Liệt kê / chọn device, emulator | `select_device` |
| Chuẩn bị simulator iOS | `prepare_ios_simulator` |
| Chuẩn bị real device iOS (WDA, signing) | `appium_prepare_ios_real_device` |
| Mở / đóng phiên | `appium_session_management` |

`automationName` chọn theo loại app — xem [`appium_rules.md`](../../rules/appium_rules.md) mục 0. Chưa biết loại app thì mở bằng `UiAutomator2` / `XCUITest` rồi dump hierarchy để nhận diện.

### Bước 2 — Dump hierarchy & nhận diện loại app

`appium_get_page_source` → đối chiếu bảng sau **trước khi làm gì tiếp**:

| Thấy trong hierarchy | Kết luận | Làm gì tiếp |
|---|---|---|
| Nhiều `android.widget.*` / `XCUIElementType*` | **Native** | Sang Bước 3 |
| **Chỉ một** `FlutterView` / `FlutterSurfaceView`, bên trong rỗng | **Flutter — semantics CHƯA bật** | 🛑 Dừng, báo user (xem mục Flutter bên dưới) |
| `FlutterView` + node con có `content-desc` | **Flutter — semantics đã bật** | Sang Bước 3, locator dùng `accessibilityId` |
| `android.webkit.WebView` / `XCUIElementTypeWebView` | **Hybrid** | Đổi context bằng `appium_context` rồi lấy locator web |

### Bước 3 — Thu & verify locator

1. Với mỗi element cần thao tác, lấy locator theo thứ tự ưu tiên của nền tảng (mục dưới)
2. **Verify từng cái** bằng `appium_find_element` — phải khớp **đúng 1 element** và **đúng element cần thao tác**
3. Element ngoài màn hình → `appium_gesture` với `action=scroll_to_element`, **không** tăng timeout
4. Đọc thuộc tính kiểm chứng bằng `appium_get_element_attribute` (`enabled`, `displayed`, `text`, `content-desc`)
5. `generate_locators` để lấy đề xuất, nhưng **kết quả của nó là gợi ý, không phải kết luận** — vẫn phải verify

### Bước 4 — Ghi bảng Locator Collection

| Screen | Element | Platform | Locator | Loại | Verified |
|---|---|---|---|---|---|
| LoginScreen | Ô email | Android | `AppiumBy.accessibilityId("email_input")` | a11y id | ✅ |
| LoginScreen | Ô email | iOS | `AppiumBy.accessibilityId("email_input")` | a11y id | ✅ |
| LoginScreen | Nút đăng nhập | Android | `AppiumBy.id("com.app:id/btn_login")` | resource-id | ✅ |

**Locator khác nhau giữa 2 nền tảng thì ghi thành 2 dòng** — không gộp rồi để người viết code tự đoán.

---

## Thứ tự ưu tiên locator

**Native Android:** `accessibilityId` (content-desc) → `id` (resource-id) → `androidUIAutomator` theo text → xpath tương đối

**Native iOS:** `accessibilityId` → `iOSNsPredicateString` → `iOSClassChain` → xpath (chậm nhất, tránh)

**Flutter (semantics đã bật):** `accessibilityId` từ `Semantics(label:)` — **chỉ dùng cái này**

Chi tiết + ví dụ code: [`appium_rules.md`](../../rules/appium_rules.md) mục 1–3.

---

## Flutter — xử lý khi hierarchy rỗng

Đây là tình huống gặp nhiều nhất và hay bị chẩn đoán sai nhất.

**Triệu chứng:** dump hierarchy chỉ ra một node `FlutterView`, không có gì bên trong. Mọi locator đều `NoSuchElementException`.

**KHÔNG phải** do: locator sai · timeout ngắn · Appium version · thiếu quyền.

**Nguyên nhân:** Flutter vẽ UI lên canvas. Không bật semantics thì **không tồn tại element native nào** để tìm.

**Việc agent phải làm — theo đúng thứ tự:**

1. **Dừng ngay**, không sinh locator, không thử XPath, không dùng toạ độ
2. Báo user chính xác 3 điều cần xác nhận với dev:

   | Câu hỏi cho dev | Vì sao hỏi |
   |---|---|
   | App đã bọc `Semantics(label: ...)` cho widget cần test chưa? | Không có thì Appium native không thấy gì |
   | Đã gọi `SemanticsBinding.instance.ensureSemantics()` chưa? | Semantics chỉ sinh khi được bật |
   | Có bản build **debug/profile** không? | Quyết định có dùng được Đường B (flutter driver) hay không |

3. 🚨 **Cảnh báo bắt buộc nêu ra:** dev trả lời *"đã thêm `Key('login_btn')` rồi"* → **vẫn không dùng được**. `Key`/`ValueKey` chỉ flutter driver thấy, **không** sinh ra `content-desc`. Đây là hiểu nhầm phổ biến nhất giữa QA và dev Flutter — nói rõ ngay, đừng để mất thêm một vòng trao đổi.

4. Semantics đã bật → locator dùng `accessibilityId` với đúng chuỗi trong `Semantics(label:)`

**Danh sách Flutter cuộn được:** item chưa cuộn tới thì **chưa render** ⇒ chưa có trong semantics tree. Đây **không** phải locator sai — cuộn từng bước bằng `appium_gesture` rồi tìm lại.

## Hybrid / WebView

```
appium_context (list)  → xem có WEBVIEW_* nào
appium_context (set)   → sang WEBVIEW_* → locator web (id, css)
appium_context (set)   → BẮT BUỘC quay lại NATIVE_APP trước khi thao tác native
```

Quên quay lại `NATIVE_APP` → mọi locator native sau đó fail, và log **không** chỉ ra nguyên nhân. Gặp chuỗi fail khó hiểu sau một đoạn WebView thì kiểm context đầu tiên.

## Bảng chẩn đoán lỗi

| Triệu chứng | Nguyên nhân thường gặp | Cách xử lý |
|---|---|---|
| `NoSuchElementException`, hierarchy **có** element | Locator sai kiểu / sai nền tảng | Dump lại, lấy đúng thuộc tính, verify |
| Hierarchy chỉ có `FlutterView` rỗng | Flutter chưa bật semantics | Xem mục Flutter — **không** đoán locator |
| Element có trong hierarchy nhưng không tương tác được | Bị che, `enabled=false`, ngoài viewport | Kiểm `displayed`/`enabled`, scroll tới trước |
| Tìm thấy trên Android, mất trên iOS | Locator không cross-platform | Tách locator theo nền tảng |
| Locator native fail hàng loạt sau một màn hình | Đang kẹt ở context WEBVIEW | `appium_context` về `NATIVE_APP` |
| Phiên không mở được trên iOS real device | WDA chưa ký | `appium_prepare_ios_real_device` — **không** phải lỗi locator |
| Chạy 1 device thì ổn, nhiều device thì loạn | Trùng `systemPort` / `wdaLocalPort` | Cấp port riêng từng device |
| Element mất sau khi app quay lại foreground | Màn hình bị dựng lại | Tìm lại element, không giữ tham chiếu cũ |

## Output của skill

- **Bảng Locator Collection** (tách dòng theo nền tảng, có cột `Verified`), **Kết luận loại app** (Native / Flutter / Hybrid), **Ảnh chụp màn hình** (`appium_screenshot`), **Danh sách việc cần dev làm** (nếu Flutter chưa bật semantics), và gợi ý **Screen Object**.

## Tham chiếu

- [`.claude/rules/appium_rules.md`](../../rules/appium_rules.md) — quy tắc locator, gesture, parallel multi-device
- [`.claude/rules/locator_strategy.md`](../../rules/locator_strategy.md) — nguyên tắc chung mọi framework
- [`skills-smart-locator-agent`](../skills-smart-locator-agent/SKILL.md) — sinh locator thay thế khi locator hiện tại mong manh
- [`TEMPLATES_APPIUM_JAVA.md`](../skills-framework-architect/references/TEMPLATES_APPIUM_JAVA.md) — capabilities + Screen Object mẫu cho Android/iOS/Flutter
