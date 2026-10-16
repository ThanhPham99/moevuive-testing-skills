---
description: "Chiến lược Kiểm thử Tổng thể Cấp Hệ thống (Application Test Strategy) — điều phối thứ tự kiểm thử đa module, quản lý phụ thuộc, tích hợp E2E và phân bổ nguồn lực toàn ứng dụng."
skills:
  - skills-rbt-manual-testing
---

# Generate Application Test Plan (Workflow Dispatcher)

Xây dựng Chiến lược Kiểm thử Cấp Hệ thống (Application-Level Test Plan) khi dự án có nhiều modules phụ thuộc lẫn nhau — giúp định hình bản đồ phụ thuộc (Dependency Graph), thứ tự thực thi (Waves), luồng E2E liên module và chiến lược môi trường/dữ liệu.

## Inputs
- **System Documentation**: Danh mục `docs/requirements/README.md`, bản đồ hệ thống `docs/requirements/_discovery/system_map.md`, danh mục `docs/testcases/README.md` (hoặc trong namespace `docs/<nhánh>/_<hệ-thống>/`) và các file `requirements_<module>.md` cần tra cứu.
- **Release Target / Scope** *(Optional)*: Phiên bản phát hành, danh sách modules trong đợt release, ràng buộc thời gian và nhân sự.

## Context Pointers (Lazy-Load On Demand)
- **Risk-Based Testing (RBT) & Priority Rules**: `.claude/skills/skills-rbt-manual-testing/SKILL.md`
- **Coverage & Traceability Rules**: `.claude/skills/skills-coverage-traceability/SKILL.md`
- **Automation Framework Strategy**: `.claude/skills/skills-qa-automation-engineer/SKILL.md`

## Execution Steps

### Bước 1: Kiểm kê Hệ thống & Bản đồ Phụ thuộc (Module Dependency Graph)
1. Đọc theo chuỗi 3 tầng (`docs/requirements/README.md` → `_discovery/system_map.md` → `docs/testcases/README.md`, chỉ mở `requirements_<module>.md` khi cần chi tiết) để lập bảng kiểm kê tất cả modules: số lượng REQ, trạng thái tài liệu, số lượng Test Cases hiện có, độ phủ hiện tại.
2. Phân tích mối quan hệ phụ thuộc giữa các modules:
   - **Upstream / Core Modules** (VD: `auth`, `users`, `roles`, `master-data`) mà các module khác cần làm tiền đề.
   - **Midstream / Business Modules** (VD: `catalog`, `inventory`, `pricing`, `orders`).
   - **Downstream / Aggregation Modules** (VD: `billing`, `notifications`, `reports`, `audit-log`).
3. Vẽ sơ đồ phụ thuộc Mermaid (`flowchart LR` hoặc `TD`) và phát hiện các phụ thuộc vòng (circular dependencies) hoặc điểm nghẽn (bottlenecks).

### Bước 2: Phân tích Rủi ro Cấp Hệ thống & Chia Đợt Thực thi (Execution Waves)
1. Đánh giá mức độ rủi ro cấp module (`Critical` / `High` / `Medium` / `Low`) dựa trên tác động nghiệp vụ và mức độ kết nối liên module.
2. Chia lộ trình kiểm thử thành các **Execution Waves**:
   - **Wave 0 (Smoke & Environment Readiness)**: Kiểm tra hạ tầng, Auth, kết nối DB/API, tài khoản phân quyền nền tảng.
   - **Wave 1 (Foundation / Core Modules)**: Kiểm thử sâu các module nền tảng để mở khóa dữ liệu cho các wave sau.
   - **Wave 2 (Core Business & Cross-Module Flows)**: Kiểm thử các luồng nghiệp vụ chính và tích hợp giữa các module.
   - **Wave 3 (Downstream, Reporting, Non-Functional & Regression)**: Báo cáo, thông báo, bảo mật, hiệu năng và hồi quy toàn hệ thống.

⏸️ **DỪNG LẠI (HITL Checkpoint)**: Trình bày Bản đồ phụ thuộc (Dependency Graph), bảng phân loại rủi ro các module và kế hoạch phân chia Execution Waves (Wave 0 -> Wave 3) để người dùng xác nhận trước khi xuất file kế hoạch hoàn chỉnh.

### Bước 3: Xuất File Application Test Plan
Tạo file `docs/testcases/_<hệ-thống>/application_test_plan.md` gồm đầy đủ các phần:
1. **System Overview & Scope**: Danh sách modules trong/ngoài phạm vi, trạng thái tài liệu SRS và Test Cases.
2. **Module Dependency Graph & Data Seeding Order**: Sơ đồ Mermaid + thứ tự chuẩn bị dữ liệu nền (seed data) từ Upstream xuống Downstream.
3. **System-Level Risk Matrix (RBT)**: Bảng đánh giá rủi ro từng module, tỷ trọng phân bổ effort và mục tiêu độ phủ (`Critical = 100%`, `High >= 90%`).
4. **Execution Waves (Wave 0 -> Wave 3)**: Tiêu chí bắt đầu/kết thúc mỗi Wave, các module kiểm thử song song vs tuần tự.
5. **End-to-End (E2E) Cross-Module Journeys**: Danh sách các luồng nghiệp vụ xuyên suốt nhiều modules cần kiểm thử tích hợp (gợi ý chạy tiếp `/generate-cross-module-test-plan` nếu cần chi tiết hóa).
6. **Test Environment, Roles & Automation Split**: Phân bổ tỷ lệ Manual vs Automation (UI/API), cấu hình tài khoản theo Role Matrix, và tiêu chí Entry / Suspension / Exit / Sign-off cấp toàn ứng dụng.

## Output
- `docs/testcases/_<hệ-thống>/application_test_plan.md`