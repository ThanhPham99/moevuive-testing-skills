---
name: review-testcases
description: "Review chất lượng bộ Manual Test Cases theo Rubric 6 tiêu chí (12 điểm) & đối soát Bản đồ 4 Vòng + 15 loại trường — phát hiện TC mơ hồ, trùng lặp và lỗ hổng độ phủ (REVIEW / FIX modes)."
skills:
  - skills-testcase-reviewer
---

# Review Manual Test Cases (Workflow Dispatcher)

Đánh giá độc lập chất lượng bộ Manual Test Cases hiện có ở cả **cấp từng Test Case** (Rubric 6 tiêu chí — 12 điểm) và **cấp toàn bộ Suite** (Đối soát Bản đồ 4 Vòng & 15 loại trường dữ liệu).

> ⚠️ **Lưu ý điều hướng**: Nếu cần cập nhật nội dung Test Cases do ticket thay đổi yêu cầu (Requirements Delta), hãy chạy `/update-testcases-from-impact` **trước**, sau đó mới dùng lệnh này để rà soát chất lượng cách viết.

## Inputs & Modes
- **Test Cases File**: Đường dẫn file `docs/testcases/<module>/test_cases_<module>.md` (hoặc CSV/Excel).
- **Requirements Source** *(Khuyến nghị)*: File `docs/requirements/<module>/requirements_<module>.md` để chấm tiêu chí Truy vết (Traceability) và lỗ hổng độ phủ (Coverage Gaps).
- **Mode**:
  - `REVIEW` (Mặc định): Xuất báo cáo đánh giá chi tiết `testcase_review_report.md` kèm đề xuất sửa cụ thể (không sửa file gốc).
  - `FIX`: Xuất báo cáo `REVIEW`, sau khi người dùng duyệt thì sinh file `<tên_file_gốc>_improved.md` đã nâng cấp các TC `🔴`/`🟡` và bổ sung các TC còn thiếu (giữ nguyên file gốc).

## Context Pointers (Lazy-Load On Demand)
- **6-Criterion Scoring Rubric (12 pts) & Review Report Template**: `.claude/skills/skills-testcase-reviewer/SKILL.md`
- **4-Ring Test Type Map & Quality Gate**: `.claude/skills/skills-rbt-manual-testing/references/FOUR_RINGS_AND_QUALITY_GATE.md`
- **15-Field Validation Checklist**: `.claude/skills/skills-rbt-manual-testing/references/FIELD_VALIDATION_15_TYPES.md`
- **BVA / EP / Decision Table / State Transition Rules**: `.claude/skills/skills-rbt-manual-testing/references/DESIGN_TECHNIQUES.md`

## Execution Steps

### Bước 1: Chấm điểm Từng Test Case theo Rubric 6 Tiêu chí (Thang 12 điểm)
Đọc từng Test Case và chấm điểm theo `.claude/skills/skills-testcase-reviewer/SKILL.md` (0–2 điểm/tiêu chí):
1. **Tính Rõ ràng & Nguyên tử (Clarity & Atomicity)**
2. **Tiền điều kiện & Dữ liệu Đầu vào Cụ thể (Preconditions & Concrete Test Data — không ghi chung chung "nhập dữ liệu hợp lệ")**
3. **Các Bước Thực hiện Rõ ràng (Actionable Steps)**
4. **Kết quả Kỳ vọng Kiểm chứng được (Verifiable Expected Result — UI + DB/API/State)**
5. **Độ ưu tiên & Phân loại Rủi ro Hợp lý (Priority & Risk Alignment)**
6. **Truy vết Yêu cầu (Requirement Traceability — gắn đúng `REQ-ID`)**
- Phân loại từng TC: `🟢 Tốt (10–12đ)`, `🟡 Cần cải thiện (6–9đ)`, `🔴 Yếu/Cần viết lại (0–5đ)`. Với mọi TC `🟡`/`🔴`, trích nguyên văn điểm yếu và viết sẵn phương án sửa cụ thể.

### Bước 2: Đối soát Độ phủ Cấp Bộ Test Cases (Suite-Level Audit — Bắt buộc)
Một bộ TC viết câu chữ rất đẹp (`🟢 12/12`) vẫn có thể bỏ sót cả mảng nghiệp vụ. Bắt buộc kiểm tra 4 mục cấp bộ:
1. **Đối soát Bản đồ 4 Vòng (`skills-rbt-manual-testing`)**: Chấm trạng thái `✅ Đủ` / `🟡 Nông` / `🔴 Thiếu` / `➖ Không áp dụng` cho từng nhánh của Vòng 1 (`UI cơ bản`, `Happy Path`), Vòng 2 (`Validation`, `BVA/EP`, `State/Business Rule`), Vòng 3 (`Permission/Role`, `Cross-module`, `Idempotency/Concurrent`), Vòng 4 (`Security OWASP`, `UX/A11y`).
2. **Đối soát Bảng 15 Loại Trường Dữ liệu**: So từng trường trên màn hình với các kịch bản biên/định dạng bắt buộc của loại trường đó; chỉ đích danh trường nào thiếu case nào.
3. **Kiểm tra Độ hạt Gộp (Grouped TC Granularity)**: Đếm số lượng biến thể dữ liệu trong các TC gộp — cảnh báo nếu gộp làm rụng mất các trường hợp biên quan trọng.
4. **Phát hiện TC Trùng lặp (Duplicates)**: Đề xuất gộp hoặc loại bỏ các TC kiểm tra cùng một điều kiện.

### Bước 3: Xuất Báo cáo Review (HITL Checkpoint ⏸️)
- Xuất file `testcase_review_report.md` gồm: Thống kê tổng quan (`🟢`/`🟡`/`🔴`), Bảng đối soát 4 Vòng + 15 loại trường, Danh sách lỗ hổng độ phủ (Coverage Gaps), Danh sách TC trùng lặp và Bảng chi tiết từng TC cần sửa.

⏸️ **DỪNG LẠI (HITL Checkpoint)**: Nếu `Mode = REVIEW` -> Kết thúc. Nếu `Mode = FIX` -> Chờ người dùng xác nhận danh sách TC cần sửa và các Gap cần bổ sung.

### Bước 4: Sinh Phiên bản Cải thiện *(Chỉ khi `Mode = FIX`)*
- Tạo file `<tên_file_gốc>_improved.md`: giữ nguyên các TC `🟢`, nâng cấp các TC `🟡`/`🔴` và viết bổ sung các TC lấp lỗ hổng độ phủ theo đúng chuẩn `skills-rbt-manual-testing`.

## Output
- `testcase_review_report.md` và *(khi `Mode = FIX`)* file `<tên_file_gốc>_improved.md`.
