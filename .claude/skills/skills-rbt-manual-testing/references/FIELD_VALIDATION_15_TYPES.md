# Bảng Field-Level Validation Checklist (15 Field Types)

> **Mục đích:** Khi form/UI có các input fields, agent **BẮT BUỘC** phải liệt kê từng trường và sinh validation TCs riêng theo loại tương ứng trong bảng này.
> **Áp dụng cho:** Tất cả các mode sinh test case (QUICK, FULL RBT, DELTA).

---

## 1. Chi Tiết 15 Loại Input Field Types

| Loại Field | Validation cần test |
|---|---|
| **Text (Name, Address...)** | Required/Optional · Min/Max length · Whitespace-only · Ký tự đặc biệt (`<>&"'`) · XSS injection (`<script>alert(1)</script>`) · SQL injection (`' OR 1=1--`) · Unicode/Emoji · Leading/trailing spaces |
| **Email** | Format hợp lệ (`user@domain.com`) · Thiếu `@` · Thiếu domain · Domain không hợp lệ · Nhiều `@` · Ký tự đặc biệt trước `@` · Max length · Case sensitivity · Email đã tồn tại (nếu unique) |
| **Phone** | Chỉ số · Prefix hợp lệ (ví dụ: `+84`, `0`) · Min/Max length · Chữ cái xen lẫn · Dấu `-`, `.`, khoảng trắng · Mã vùng không hợp lệ |
| **Date / DateTime** | Format đúng (dd/MM/yyyy, ISO...) · Ngày không tồn tại (`31/02`, `30/02`) · Năm nhuận (`29/02/2024`) · Quá khứ / tương lai · Min/max date · Timezone |
| **Number / Currency** | Min/Max value · Số âm · Số 0 · Số thập phân · Ký tự không phải số · Overflow · Leading zeros · Định dạng currency |
| **Dropdown / Select** | Giá trị mặc định · Tất cả options hợp lệ · Option disabled · Thay đổi selection · Required validation |
| **Checkbox / Radio** | Trạng thái mặc định · Check/Uncheck · Required validation · Nhóm radio (chỉ chọn 1) |
| **File Upload** | File type hợp lệ/không hợp lệ · Max size · File rỗng (0 KB) · Tên file ký tự đặc biệt · Multiple files · Kéo thả vs nút chọn |
| **Password** | Min/Max length · Yêu cầu ký tự đặc biệt · Yêu cầu chữ hoa/thường · Yêu cầu số · Khoảng trắng đầu/cuối · Copy-paste bị chặn? · Hiện/ẩn password · Confirm password khớp/không khớp · Trùng mật khẩu cũ (khi đổi MK) |
| **Textarea** | Max length · Line breaks · HTML tags · Resize (nếu UI cho phép) · Character counter (nếu có) |
| **OTP / MFA Code** | Auto-focus ô tiếp theo · Paste chuỗi OTP · Hết hạn timeout · Vượt số lần nhập sai (retry limit/lockout) · Re-send OTP rate limit |
| **Date Range / Time Picker** | Ngày kết thúc < Ngày bắt đầu · Khung giờ trùng lặp (time conflict) · Giới hạn khoảng ngày (VD: max 30 ngày) · Quá khứ/Tương lai restriction |
| **Rich Text Editor (WYSIWYG)** | Sanitize HTML tags nguy hiểm (`<script>`, `<iframe>`) · Paste văn bản kèm format/ảnh · Character counter tính theo text thô vs HTML markup |
| **Multi-Select / Tag Input** | Giới hạn số lượng tag · Tag trùng lặp · Xóa tag bằng Backspace/nút X · Tag có ký tự đặc biệt |
| **Range Slider / Stepper** | Giới hạn min/max · Bước nhảy (step increment violation) · Nhập tay trực tiếp so với kéo slider |

---

## 2. Nguyên Tắc Sinh TC Cho Form Fields

1. **Đối soát 1-1 từng field:** Mỗi field trong form phải có ít nhất:
   - 1 test case hợp lệ (Positive).
   - 1 test case bỏ trống nếu là required field (Negative).
   - Các test case biên (Boundary) và định dạng sai (Format Negative) tương ứng với loại trường.
2. **Nguyên văn thông báo lỗi:** Expected Result của các test case validation phải ghi **nguyên văn** message bắt được từ UI thực tế hoặc Network response, không suy diễn hoặc tự dịch lại.
3. **Data cụ thể:** Mọi bước thực hiện phải ghi rõ giá trị nhập cụ thể (VD: `Nhập "31/02/2026"` thay vì `Nhập ngày không hợp lệ`).
