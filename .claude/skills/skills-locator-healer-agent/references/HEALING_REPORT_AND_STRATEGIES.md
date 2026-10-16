# Mẫu Báo Cáo Quét Locator & Chiến Lược Thay Thế (`SCAN` & `HEAL`)

> Tài liệu tham chiếu chi tiết cho [`skills-locator-healer-agent`](../SKILL.md). Nạp khi xuất `reports/locator_scan_report.md` hoặc thực hiện nâng cấp bộ định vị trong Page Object.

---

## 1. Mẫu Báo Cáo `reports/locator_scan_report.md`

```markdown
# Báo Cáo Quét & Chữa Lành Bộ Định Vị (`Locator Scan & Heal Report`)

- **Phạm vi Page Object:** `pages/LoginPage.ts`, `pages/CustomerPage.ts`
- **URL Kiểm chứng:** `https://crm.example.com` (Headless `1920x1080`)
- **Chế độ chạy:** `SCAN` / `HEAL`
- **Tổng quan:** Tổng `18` locators · `12 ✅ OK` · `3 ⚠️ Mong manh` · `2 🔴 Gãy` · `1 🔴 Mơ hồ`

## 1. Bảng Đối Chiếu & Đề Xuất Thay Thế

| File:line | Tên biến | Locator hiện tại | Rủi ro tĩnh | Trạng thái DOM | Locator đề xuất (Primary) | Fallback Locator | Lý do & Kiểm chứng |
|---|---|---|---|---|---|---|---|
| `LoginPage.ts:14` | `submitBtn` | `page.locator('.css-1a2b3c')` | 🔴 Sẽ gãy | 🔴 Gãy (`count=0`) | `page.getByRole('button', { name: 'Đăng nhập' })` | `page.locator('button[type="submit"]')` | Class hash đổi sau build; Role locator khớp `count=1` |
| `CustomerPage.ts:28` | `deleteBtn` | `page.getByRole('button', { name: 'Xoá' })` | 🟢 Bền | 🔴 Mơ hồ (`count=10`) | `row.getByRole('button', { name: 'Xoá' })` | `row.locator('[data-action="delete"]')` | Cần scope theo dòng `row` để tránh strict mode violation |
| `CustomerPage.ts:42` | `emailInput` | `page.locator('div > form > div:nth-child(2) > input')` | 🔴 Sẽ gãy | ⚠️ Mong manh (`count=1`) | `page.getByLabel('Email')` | `page.locator('input[name="email"]')` | Bỏ chuỗi cấu trúc `nth-child` dễ gãy khi thêm trường mới |

## 2. Danh Sách `❓ Chưa Kiểm Được` (Nếu có)

| File:line | Tên biến | Trạng thái giao diện cần mở | Lý do chưa kiểm chứng |
|---|---|---|---|
| `CustomerPage.ts:85` | `confirmArchiveModalBtn` | Modal xác nhận lưu trữ (chỉ hiện với tài khoản Admin) | Tài khoản hiện tại là Staff — không tự đoán locator |

## 3. Kết Quả Kiểm Chứng Sau Khi Sửa (`Chỉ có ở Mode = HEAL`)

| Bài test liên quan | Lần chạy 1 | Lần chạy 2 | Ghi chú |
|---|---|---|---|
| `tests/login.spec.ts` | ✅ PASS | ✅ PASS | Ổn định qua 2 lần chạy liên tiếp |
| `tests/customer.spec.ts` | ✅ PASS | ✅ PASS | Đã xử lý triệt để strict mode violation |
```

---

## 2. Quy Tắc Bảo Toàn Giao Diện Page Object Khi Thay Thế (`Mode = HEAL`)

1. **Giữ nguyên 100% tên thuộc tính và chữ ký hàm (Method Signature) trong Page Object:**
   - Chỉ cập nhật biểu thức định vị bên phải dấu `=` hoặc bên trong `@FindBy` / `page.locator(...)`.
   - Tuyệt đối không đổi tên biến public/getter mà các file `*.spec.ts` / `*Test.java` đang gọi.
2. **Xử lý Locator phụ thuộc ngữ cảnh dòng (`🔴 Mơ hồ` trong bảng/danh sách):**
   - Nếu locator nằm trong bảng có nhiều dòng, chuyển thành hàm nhận tham số định danh dòng (VD: `getDeleteButtonForCustomer(customerCode: string)` dùng `page.getByRole('row').filter({ hasText: customerCode })`) và giữ hàm cũ trỏ về dòng đầu hoặc cập nhật đồng bộ nơi gọi nếu được phép.
3. **Phân biệt rõ `skills-locator-healer-agent` và `skills-smart-locator-agent`:**

| Tiêu chí | `skills-locator-healer-agent` | `skills-smart-locator-agent` |
|---|---|---|
| **Thời điểm kích hoạt** | Khi test gãy (Reactive) hoặc rà soát lại Page Object cũ sau khi UI đổi (Proactive) | Khi viết mới Page Object cho màn hình/phần tử chưa từng có locator |
| **Đầu vào** | Code Page Object hiện có + Error log / URL thực tế | DOM / Mobile UI Hierarchy của phần tử mới |
| **Mục tiêu** | Hàn gắn, nâng cấp độ bền locator tại chỗ và giữ xanh bộ test hiện hữu | Thiết kế mới bộ đôi Primary + Fallback locator đạt chuẩn |
