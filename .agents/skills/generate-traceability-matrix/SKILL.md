---
name: generate-traceability-matrix
description: "Sinh ma trận truy vết (RTM) Requirements ↔ Test Cases ↔ Automation Scripts — chỉ ra requirement chưa cover, TC chưa automate, orphan tests và module chưa khảo sát."
skills:
  - skills-coverage-traceability
---

# Generate Traceability Matrix (Workflow Dispatcher)

Xây dựng **Ma trận Truy vết Yêu cầu (Requirements Traceability Matrix — RTM)** 2 hoặc 3 tầng (`Requirements ↔ Manual Test Cases ↔ Automation Scripts`) để đo lường chính xác độ phủ kiểm thử, phát hiện khoảng trống (gaps) và các module chưa có tài liệu.

## Inputs
- **Requirements Source**: Danh mục `docs/requirements/README.md` và các file `docs/requirements/<module>/requirements_<module>.md` (hoặc trong namespace `_<hệ-thống>/`, hoặc danh sách Jira issues từ `/fetch-jira-requirements`).
- **Manual Test Cases**: Danh mục `docs/testcases/README.md` và các file `docs/testcases/<module>/test_cases_<module>.md` (hoặc CSV/Excel).
- **Automation Test Suite** *(Optional — cần ít nhất 2 trong 3 nguồn trên)*: Đường dẫn thư mục chứa code test (`.spec.ts`, `*Test.java`, `test_*.py`).

## Context Pointers (Lazy-Load On Demand)
- **RTM Schema, Metrics Formula & Gap Classification**: `.claude/skills/skills-coverage-traceability/SKILL.md`

## Nguyên tắc Thực thi Bắt buộc
1. **Không tự bịa liên kết (No Hallucinated Mapping)**: Ưu tiên ánh xạ chính xác theo mã định danh (`REQ-xxx` ↔ `TC_xxx` ↔ `@Test` / `test('[TC_xxx]...')`). Nếu phải suy luận theo ngữ nghĩa tiêu đề/mô tả vì thiếu mã ID, bắt buộc gắn cờ `⚠️ Suy luận` và tách riêng để người dùng xác nhận.
2. **Kiểm tra Điểm mù Cấp Hệ thống (⬛ Unreconnoitered Modules)**: Bắt buộc đọc `docs/requirements/README.md` để liệt kê các module có trạng thái khảo sát `⬜` / `🟨` / `⏸️` **ngay trên đầu báo cáo**, tránh việc các module đã viết tài liệu đạt 100% làm che khuất các module chưa từng được khảo sát.
3. **Không tự ý sửa file gốc**: Chỉ đề xuất danh sách mã ID cần bổ sung vào Test Cases hoặc Automation Scripts.

## Execution Steps

### Bước 1: Thu thập & Trích xuất Danh mục Định danh
1. Đọc danh mục `docs/requirements/README.md`, `docs/testcases/README.md` và các file `requirements_<module>.md` / `test_cases_<module>.md` / Automation Scripts trong phạm vi để lập danh sách đầy đủ: `REQ ID` (kèm mức độ rủi ro/ưu tiên), `TC ID`, và đường dẫn hàm test tự động (`file:line`).
2. Kiểm tra `docs/requirements/README.md` để phát hiện các module chưa có `requirements_<module>.md` (`⬛ Module chưa có tài liệu`). Nếu dự án chưa chạy `/discover-system`, ghi chú cảnh báo rõ ràng ở đầu báo cáo.

### Bước 2: Ánh xạ Đa Chiều & Tính Toán Chỉ số Độ phủ
1. Thực hiện ánh xạ `n-n` giữa `REQ ↔ TC ↔ Automation`:
   - Ánh xạ trực tiếp qua ID tường minh.
   - Ánh xạ gợi ý theo ngữ nghĩa (gắn nhãn `⚠️ Cần xác nhận`).
2. Tính toán 3 chỉ số cốt lõi theo công thức của `skills-coverage-traceability`:
   - **Requirement Coverage (%)** = Số REQ có ≥ 1 TC / Tổng số REQ đã có tài liệu.
   - **Automation Coverage (%)** = Số TC đã automate hoàn toàn / Tổng số TC.
   - **Orphan Tests**: Các TC hoặc hàm test không gắn với bất kỳ REQ nào hiện hành.

### Bước 3: Xuất Ma trận Truy vết & Đề xuất Hành động (HITL Checkpoint ⏸️)
1. Xuất file `traceability_matrix.md` (và `traceability_matrix.csv` nếu người dùng yêu cầu xuất Excel) gồm đầy đủ các phần:
   - **Cảnh báo ⬛ Module chưa có tài liệu** (đặt trước bảng chỉ số).
   - **Bảng Tổng quan 3 Chỉ số Độ phủ**.
   - **Bảng Ma trận Chi tiết (`REQ ↔ TC ↔ Automation`)** — tương thích 100% với tab **Độ phủ automation** của `scripts/execution-viewer/bundle.html`.
   - **Danh sách Khoảng trống**: `🔴 REQ chưa có TC` -> `🟡 TC ưu tiên cao chưa automate` -> `⚪ Orphan Tests` -> `⚠️ Mapping suy luận cần xác nhận`.

⏸️ **DỪNG LẠI (HITL Checkpoint)**: Trình bày tóm tắt các khoảng trống `🔴`, `⬛` và các liên kết `⚠️` để người dùng xác nhận, kèm gợi ý lệnh tiếp theo (`/generate-requirements-from-website`, `/generate-testcases-from-requirements`, hoặc `/generate-automation-from-testcases`).

## Output
- `traceability_matrix.md` (xem trực quan bằng cách kéo thả vào `scripts/execution-viewer/bundle.html`) và `traceability_matrix.csv` *(tùy chọn)*.
