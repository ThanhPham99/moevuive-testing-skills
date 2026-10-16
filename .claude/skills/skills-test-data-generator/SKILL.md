---
name: skills-test-data-generator
description: "Generate unique, traceable test datasets (positive, negative, boundary, edge cases) and multi-module combinatorial data pipelines for UI and API testing."
---

# Test Data Generator

Sinh dữ liệu kiểm thử có cấu trúc, duy nhất (unique), truy vết được nguồn tạo (traceable) và tuân thủ ràng buộc thực tế của hệ thống cho cả đơn module lẫn chuỗi liên kết nhiều module (Combinatorial Pipeline).

---

## 1. Quy Chuẩn Định Danh & Tính Chất Dữ Liệu

Mọi dữ liệu sinh ra phải thỏa mãn 4 tính chất:
1. **Unique & Traceable:** Nhúng tiền tố định danh test case/combo và timestamp để tránh trùng lặp khi chạy song song và dễ dọn dẹp:
   - Chuỗi chuẩn: `<prefix>_<testName>_<timestamp>` (VD: `auto_register_1712024100`)
   - Email: `auto_<testName>_<timestamp>@auto.test`
   - Username / Code: `user_<testName>_<timestamp>` / `CODE_<timestamp>`
   - Chuỗi liên module (Combo): `auto_combo{XX}_{module_short}_{timestamp}`
2. **Safe (Không chứa PII thật):** Sử dụng tên miền giả định (`@auto.test`, `@example.com`) và số điện thoại/CCCD/MST hợp lệ về mặt cú pháp nhưng không trùng dữ liệu khách hàng thật.
3. **Rule-Aligned:** Khớp chính xác kiểu dữ liệu, định dạng ngày tháng và giới hạn độ dài đã khảo sát từ DOM hoặc `requirements_<module>.md`.

---

## 2. 4 Nhóm Dữ Liệu Cho Đơn Module (Single-Module Data)

| Nhóm dữ liệu | Nội dung cần sinh |
|---|---|
| **Positive (Happy Path)** | Đủ trường bắt buộc, đúng định dạng chuẩn và giá trị nghiệp vụ điển hình. |
| **Negative (Invalid)** | Bỏ trống trường bắt buộc, sai định dạng (email thiếu `@`, mật khẩu thiếu ký tự đặc biệt), giá trị trùng lặp (duplicate key). |
| **Boundary (Biên EP/BVA)** | `Min - 1`, `Min`, `Min + 1`, `Max - 1`, `Max`, `Max + 1`, chuỗi rỗng `""` vs `null`, số `0` và số âm. |
| **Edge & Security** | Tiếng Việt có dấu + Emoji + Unicode đa ngôn ngữ, khoảng trắng đầu/cuối, chuỗi rất dài, payload kiểm thử XSS (`<script>`) và SQLi (`' OR 1=1 --`). |

### Cấu trúc JSON đầu ra (Đơn Module)
```json
{
  "positive": [
    { "email": "auto_tc01_1712024100@auto.test", "password": "Test@12345" }
  ],
  "negative": [
    { "email": "", "password": "Test@12345", "expectedError": "Email là bắt buộc" },
    { "email": "invalid-email", "password": "Test@12345", "expectedError": "Email không đúng định dạng" }
  ],
  "boundary": [
    { "email": "a@b.co", "password": "Test@123", "note": "Độ dài tối thiểu (Min = 8)" }
  ]
}
```

---

## 3. Dữ Liệu Kết Hợp Đa Chiều & Chuỗi Liên Module (Combinatorial & Multi-Module Pipeline)

Sử dụng khi tính năng đi qua chuỗi $N$ modules nối tiếp (`Module 1 → Module 2 → ... → Module N`) hoặc đã có ma trận kết hợp từ `/generate-cross-module-test-plan`.

### Phân loại 4 nhóm trường trong chuỗi liên module

| Loại trường | Định nghĩa | Quy tắc sinh giá trị |
|---|---|---|
| **Dimension Field** | Thuộc chiều phân hoạch trong ma trận kết hợp (`D1`, `D2`...) | Lấy **chính xác 100%** giá trị từ dòng tương ứng của ma trận kết hợp. |
| **Supporting Field** | Trường bắt buộc trên form nhưng không nằm trong chiều kết hợp | Sinh giá trị hợp lệ + unique theo mẫu `auto_combo{XX}_{module}_{timestamp}`. |
| **Reference Field** | Khóa ngoại / mã tham chiếu sinh ra từ module đứng trước | Trích xuất trực tiếp từ output thực tế của module trước (`{id_1, code_1}`). |
| **Computed Field** | Giá trị hệ thống tự tính theo công thức (thuế, chiết khấu, tổng tiền) | Tính trước giá trị kỳ vọng theo công thức nghiệp vụ để đối chiếu. |

### Cấu trúc JSON đầu ra (Combinatorial Data)
```json
{
  "combination_id": "COMBO_01",
  "dimensions": {
    "D1": "value_from_matrix",
    "D2": "value_from_matrix"
  },
  "module_data": {
    "module_1": { "partner_name": "auto_combo01_partner_1712049200" },
    "module_2": { "partner_ref": "<output_from_module_1>", "amount": 100000000 }
  },
  "expected_output": {
    "template": "EXPECTED_TEMPLATE_CODE",
    "formula": "Amount * (1 + VAT_Rate)",
    "computed_values": { "total": 110000000 }
  }
}
```

### Quy tắc bất biến cho Combinatorial Pipeline
1. Mỗi `COMBO_XX` sử dụng một bộ dữ liệu độc lập hoàn toàn để khi 1 combo lỗi không làm bẩn các combo còn lại.
2. Khi chạy ở chế độ **PIPELINE** trên trình duyệt (qua `/generate-combinatorial-test-data`), trình duyệt mặc định chạy **Headless Mode (`1920x1080`)**; nếu cần quan sát trực tiếp hoặc đăng nhập qua CAPTCHA/OTP, bật **Headed Mode** qua `node scripts/browser-mode.mjs headed`.
3. Tham chiếu thêm: [`.claude/rules/automation_rules.md`](../../rules/automation_rules.md) § 2.