---
description: "Sinh Master Test Plan cấp quản lý (theo cấu trúc ISO/IEC/IEEE 29119-3 & ánh xạ IEEE 829) — phạm vi, chiến lược, tiêu chí vào/ra, môi trường, nhân lực, lịch trình, rủi ro dự án."
skills:
  - skills-test-summary-reporter
---

# Generate Master Test Plan (Workflow Dispatcher)

Biên soạn tài liệu **Master Test Plan** cấp quản lý để gửi PM/PO/Khách hàng phê duyệt trước đợt kiểm thử — xác định rõ phạm vi (In-scope / Out-of-scope), chiến lược, tiêu chí Entry/Suspension/Exit, môi trường, nhân sự, lịch trình, rủi ro dự án và bảng ánh xạ chuẩn **ISO/IEC/IEEE 29119-3 & IEEE 829-2008**.

## Inputs
- **Release / Milestone (`<mốc>`)**: Tên đợt phát hành / Sprint / UAT.
- **Repository Artifacts** *(Tự động quét trước khi hỏi)*: `docs/requirements/`, `docs/testcases/`, `docs/bugs/`, `traceability_matrix.md`.
- **Management Inputs** *(Hỏi người dùng nếu chưa có)*: Phạm vi ngoài (Out-of-scope), lịch trình các mốc, phân công nhân sự, môi trường & bộ tiêu chí Exit riêng (nếu khác mặc định).

## Context Pointers (Lazy-Load On Demand)
- **11-Section Master Test Plan Schema & Governance Rules**: [`.claude/skills/skills-test-summary-reporter/references/MASTER_TEST_PLAN_SCHEMA.md`](../skills/skills-test-summary-reporter/references/MASTER_TEST_PLAN_SCHEMA.md)
- **Exit Criteria Standard (7 Default Exit Criteria)**: [`.claude/skills/skills-test-summary-reporter/SKILL.md`](../skills/skills-test-summary-reporter/SKILL.md)
- **Risk-Based Testing & 4 Test Rings**: [`.claude/skills/skills-rbt-manual-testing/SKILL.md`](../skills/skills-rbt-manual-testing/SKILL.md)

## Execution Steps
1. **Bước 1 — Tự động Quét Repo để Thu thập Dữ liệu Sẵn có:** Đọc `docs/requirements/` (`README.md`, `_discovery/system_map.md`), `docs/testcases/` và `docs/bugs/` để thống kê danh sách module, số lượng REQ/TC, các mục `➖ Ngoài phạm vi` đã ghi nhận và số bug đang mở ảnh hưởng tới Entry Criteria.
2. **Bước 2 — Chốt Thông tin Quản lý với Người dùng (HITL Checkpoint ⏸️):** Trình bày tóm tắt dữ liệu đã thu thập từ repo và hỏi gộp **1 lượt duy nhất** các thông tin quản lý chưa tự suy ra được (Out-of-scope `2.2`, lịch trình & nhân sự, môi trường riêng/dùng chung, bộ Tiêu chí Exit, và mục `11.2 Deviations`). Những thông tin chưa có câu trả lời điền `❓ Chờ <vai trò> xác nhận` vào bảng **Ô còn treo**.
3. **Bước 3 — Xuất File `docs/test_plan_<mốc>.md`:** Biên soạn đầy đủ **11 mục chuẩn** và bảng ánh xạ **ISO/IEC/IEEE 29119-3 — Test Plan** & **IEEE 829-2008** theo đúng mẫu và 4 quy tắc quản trị trong `MASTER_TEST_PLAN_SCHEMA.md`.

## Output
- `docs/test_plan_<mốc>.md`
