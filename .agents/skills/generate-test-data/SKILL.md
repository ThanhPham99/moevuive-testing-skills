---
name: generate-test-data
description: "Sinh bộ dữ liệu kiểm thử (Test Data) có cấu trúc, duy nhất và truy vết được cho UI Forms, API Payloads và Data-Driven Testing."
skills:
  - skills-test-data-generator
---

# Generate Test Data (Workflow Dispatcher)

Phân tích các trường dữ liệu và ràng buộc (constraints) từ tài liệu SRS, OpenAPI/Swagger, Test Cases hoặc DOM thực tế để sinh bộ dữ liệu kiểm thử đầy đủ **4 nhóm (Positive, Negative, Boundary, Edge/Security)** theo định dạng sẵn sàng sử dụng.

## Inputs
- **Feature / Module**: Tên form, API endpoint hoặc module cần sinh dữ liệu.
- **Source Schema** *(1 hoặc kết hợp)*: Danh sách fields do người dùng mô tả, đường dẫn file SRS/Test Cases, file OpenAPI/Swagger, hoặc URL trang web chứa form.
- **Output Format**: `json` (mặc định), `csv`, `markdown`, hoặc `code` (`TypeScript` / `Java` / `Python`).
- **Locale**: Tiếng Việt (`vi_VN` — mặc định cho dự án nội địa) hoặc Tiếng Anh (`en_US`).

## Context Pointers (Lazy-Load On Demand)
- **4-Category Data Generation Rules & Output Schemas**: `.claude/skills/skills-test-data-generator/SKILL.md`
- **BVA / EP Mathematical Rules**: `.claude/skills/skills-rbt-manual-testing/references/DESIGN_TECHNIQUES.md`
- **Browser DOM Form Inspection (chỉ đọc khi cần quét URL)**: `.claude/skills/skills-ui-debug-agent/SKILL.md`

## Execution Steps

### Bước 1: Phân tích Trường Dữ liệu & Ràng buộc (Field & Constraint Extraction)
1. Trích xuất danh sách các trường dữ liệu từ nguồn đầu vào (nếu người dùng cung cấp URL form, mở trình duyệt ở chế độ **Headless `1920x1080`** mặc định để đọc các thuộc tính `type`, `required`, `minlength`, `maxlength`, `min`, `max`, `pattern`, options của `select`).
2. Lập bảng tổng hợp từng trường gồm: `Field | Type | Required | Constraints (min/max/regex/enum/unique) | Cross-field Dependencies (VD: confirmPassword == password, endDate >= startDate)`.

⏸️ **DỪNG LẠI (HITL Checkpoint)**: Trình bày bảng **Fields & Constraints** để người dùng xác nhận hoặc bổ sung quy tắc nghiệp vụ trước khi sinh bộ dữ liệu chi tiết.

### Bước 2: Thiết kế Bộ Dữ liệu theo 4 Nhóm Chuẩn
Áp dụng đầy đủ quy tắc trong `.claude/skills/skills-test-data-generator/SKILL.md`:
1. **Positive Data (`POS_xx` — Happy Path)**: Hợp lệ 100%, gắn định danh duy nhất & truy vết được theo chuẩn `auto_<module>_<timestamp>` (VD: `auto_reg_1712049200@test.com`), tuyệt đối không dùng dữ liệu cá nhân thật (No Real PII).
2. **Negative Data (`NEG_xx`)**: Mỗi bộ chỉ làm sai **đúng 1 điều kiện** (`targetField` + `negativeType`: `missing_required`, `invalid_format`, `invalid_type`, `duplicate`, `wrong_relationship`) trong khi giữ hợp lệ tất cả các trường còn lại để cô lập chính xác thông báo lỗi.
3. **Boundary Values (`BND_xx`)**: Áp dụng BVA 3 điểm cho mọi trường có giới hạn độ dài, số lượng, tiền tệ hoặc ngày tháng (`Min - 1`, `Min`, `Max`, `Max + 1`, `0`, `-1`, chuỗi rỗng `""`).
4. **Edge & Security Cases (`EDGE_xx`)**: Chuỗi Tiếng Việt có dấu + Emoji (`Nguyễn Văn 🎉`), khoảng trắng đầu/cuối, chuỗi rất dài, payload kiểm tra XSS (`<script>alert(1)</script>`) và SQLi (`' OR '1'='1`).

### Bước 3: Đóng gói & Xuất File Đầu ra
- Mỗi bản ghi dữ liệu bắt buộc đi kèm trường `expectedResult` rõ ràng để phục vụ trực tiếp cho câu lệnh Assert.
- Xuất dữ liệu ra định dạng người dùng yêu cầu (`json`, `csv`, `markdown`, hoặc file module `.ts`/`.java`/`.py` cho Data-Driven Testing).

## Output
- File dữ liệu kiểm thử hoàn chỉnh (VD: `test-data/<module>.data.json` / `.ts` / `.csv` / `.md`) phủ đủ 4 nhóm kịch bản.