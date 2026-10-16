---
name: generate-locator
description: "Trích xuất và kiểm chứng bộ định vị phần tử (UI Locator) bền vững từ DOM/UI Hierarchy thực tế cho Playwright, Selenium và Appium."
skills:
  - skills-smart-locator-agent
---

# Generate Locator (Workflow Dispatcher)

Khảo sát trực tiếp DOM (Web) hoặc Native XML Hierarchy (Mobile) để thiết kế và kiểm chứng bộ định vị phần tử (Primary + Fallback Locator) bền vững, duy nhất (`count === 1`) cho Playwright, Selenium hoặc Appium.

## Inputs
- **Target Element(s)**: Mô tả phần tử cần lấy locator (VD: *"Nút Xác nhận trong modal xóa"*, *"Ô nhập Email"*, hoặc danh sách tất cả phần tử tương tác trên 1 màn hình).
- **Source Context**: URL trang web (hoặc HTML snippet) đối với Web; hoặc thiết bị đang kết nối / XML dump đối với Mobile.
- **Target Framework**: `playwright` (TS/JS/Java/Python), `selenium` (Java), hoặc `appium` (Java Android/iOS).
- **Target Page/Screen Class** *(Optional)*: Đường dẫn file Page Object nếu muốn chèn trực tiếp locator vào code.

## Context Pointers (Lazy-Load On Demand)
- **Canonical Locator Priority Matrix & Stability Rules**: [`.claude/rules/locator_strategy.md`](../../../.claude/rules/locator_strategy.md)
- **Smart Locator Agent Workflow**: [`.claude/skills/skills-smart-locator-agent/SKILL.md`](../../../.claude/skills/skills-smart-locator-agent/SKILL.md)
- **Web Browser Inspection (Headless `1920x1080` default)**: [`.claude/skills/skills-ui-debug-agent/SKILL.md`](../../../.claude/skills/skills-ui-debug-agent/SKILL.md)
- **Mobile XML Hierarchy Dump**: [`.claude/skills/skills-mobile-debug-agent/SKILL.md`](../../../.claude/skills/skills-mobile-debug-agent/SKILL.md)

## Browser Mode & Safety Rules
- **Không bao giờ đoán Locator**: Bắt buộc đọc từ DOM snapshot / HTML snippet hoặc Mobile XML Hierarchy thực tế.
- **Default Headless Mode (`1920x1080`)**: Khi cần mở trình duyệt quét DOM, mặc định dùng **Headless Mode (`1920x1080`)** để lấy snapshot nhanh; nếu cần người dùng đăng nhập thủ công hoặc xử lý CAPTCHA thì chuyển sang Headed bằng `/browser-mode` (`node scripts/browser-mode.mjs headed`). Tuyệt đối không tự đọc `.env` để lấy mật khẩu.

## Execution Steps

### Bước 1: Phân tích Ngữ cảnh & Thu thập DOM / UI Hierarchy Thực tế
1. Xác định loại phần tử (button, input, combobox, table action, modal dialog, toast) và ngữ cảnh chứa phần tử (page chính, `dialog`, `iframe`, `shadow-root`, hay `ScrollView` trên mobile).
2. Thu thập cấu trúc giao diện thật:
   - **Web**: Điều hướng tới trang đích, mở trạng thái ẩn nếu cần (click mở dropdown/modal), lấy DOM snapshot và ghi nhận toàn bộ thuộc tính (`role`, `aria-label`, `data-testid`, `id`, `name`, `placeholder`, `type`, text).
   - **Mobile**: Lấy UI hierarchy qua `uiautomator dump` / Appium page source và ghi nhận `content-desc` / `accessibility-id`, `resource-id`, `text` / `label`, `class`.

### Bước 2: Thiết kế & Kiểm chứng Độ Duy nhất (Uniqueness & Stability Verification)
1. Áp dụng **Locator Priority Matrix** theo đúng cột engine (`Playwright`, `Selenium`, `Appium`) tại [`.claude/rules/locator_strategy.md`](../../../.claude/rules/locator_strategy.md).
2. **Kiểm chứng bắt buộc**: Đảm bảo locator khớp **đúng 1 phần tử duy nhất** (`count === 1` / `findElements().size() == 1`) và tuân thủ quy tắc chống class/ID động trong `locator_strategy.md`.

### Bước 3: Trả Kết quả (Primary + Fallback + Reasoning) & Cập nhật Page Class
Trình bày kết quả theo đúng 3 phần chuẩn cho mỗi phần tử:
1. **🎯 Primary Locator (Recommended)**: Đoạn code copy-paste chạy ngay theo cú pháp của framework yêu cầu + xác nhận `Unique: ✅ (1 match)` & `Stability: ✅`.
2. **🔄 Fallback Locator**: Phương án dự phòng độc lập với thuộc tính của Primary (VD: Primary dùng `getByRole` theo nhãn hiển thị thì Fallback dùng `data-testid` hoặc CSS cấu trúc).
3. **💡 Reasoning**: Giải thích ngắn gọn vì sao chọn Primary và cách scope (nếu phần tử nằm trong bảng hoặc modal).
- Nếu người dùng chỉ định file Page/Screen Object: Chèn trực tiếp locator và helper method vào đúng chuẩn đặt tên của dự án.

## Output
- Báo cáo **Locator Result** (Primary + Fallback + Reasoning) và/hoặc file Page Object đã cập nhật.