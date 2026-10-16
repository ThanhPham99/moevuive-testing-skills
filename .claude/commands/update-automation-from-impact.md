---
description: "Cập nhật mã nguồn Test Automation hiện có theo Impact Report (chế độ Delta) — ánh xạ TC thay đổi sang script tương ứng và chỉ sửa đúng phần thay đổi (PLAN / APPLY modes)."
skills:
  - skills-coverage-traceability
  - skills-qa-automation-engineer
---

# Update Automation from Impact (Workflow Dispatcher)

Mắt xích cuối trong chuỗi cập nhật Delta 3 tầng (`/update-requirements-from-ticket` → `/update-testcases-from-impact` → **`/update-automation-from-impact`**): ánh xạ các Test Cases vừa thay đổi sang đúng file Automation Script / Page Object tương ứng và **chỉ cập nhật phần bị ảnh hưởng**, bảo toàn tuyệt đối phần code ổn định đã tích lũy.

## Inputs & Modes
- **Impact Source**: File `docs/requirements/<module>/impact/impact_<TICKET-ID>.md`, `docs/testcases/<module>/impact/impact_plan_<TICKET-ID>.md`, hoặc danh sách mã `TC_ID` vừa được cập nhật.
- **Updated Manual Test Cases**: File `docs/testcases/<module>/test_cases_<module>.md` (nguồn sự thật chứa kỳ vọng mới).
- **Automation Directory**: Đường dẫn thư mục chứa test scripts và Page Objects (`tests/`, `pages/`).
- **Mode**:
  - `PLAN` (Mặc định): Ánh xạ `TC_ID → Script/POM` và lập kế hoạch sửa chi tiết từng dòng tại `reports/automation_impact_plan.md` (không sửa code).
  - `APPLY`: Lập kế hoạch như `PLAN`, sau khi người dùng duyệt thì trực tiếp cập nhật code và chạy kiểm chứng 2 lớp.

## Context Pointers (Lazy-Load On Demand)
- **Delta Impact Mapping (`TC_ID ↔ Script`), 3 Confidence Tiers & 2-Layer Verification**: [`.claude/skills/skills-coverage-traceability/SKILL.md`](../skills/skills-coverage-traceability/SKILL.md)
- **Automation Coding Standards & DoD**: [`.claude/skills/skills-qa-automation-engineer/SKILL.md`](../skills/skills-qa-automation-engineer/SKILL.md)
- **DOM Inspection & Locator Priority Matrix (khi có thêm trường/UI mới)**: [`.claude/skills/skills-ui-debug-agent/SKILL.md`](../skills/skills-ui-debug-agent/SKILL.md) · [`.claude/rules/locator_strategy.md`](../rules/locator_strategy.md)

## Execution Steps
1. **Bước 1 — Đọc Delta & Ánh xạ `TC_ID ↔ Automation Script`:** Đọc Impact Report và các TC thuộc nhóm `⚠️ Review & sửa` / `🗑️ Archive`, ánh xạ sang script/POM theo 3 mức tin cậy (`✅ Chắc chắn`, `⚠️ Suy luận`, `❓ Chưa automate`) trong `skills-coverage-traceability/SKILL.md`. Các TC `➕ Viết mới` điều hướng sang `/generate-automation-from-testcases`.
2. **Bước 2 — Lập Kế hoạch Delta & Xin Duyệt (HITL Checkpoint ⏸️):** Thiết lập hành động cụ thể tại từng `file:line` (sửa assertion, cập nhật POM + lấy locator ở **Headless Mode `1920x1080`**, cập nhật data `auto_`, hoặc gắn `skip` kèm mã ticket cho TC `🗑️ Archive` — **cấm tự ý xóa file script**) và xuất `reports/automation_impact_plan.md`. Nếu `Mode = PLAN` → kết thúc; nếu `Mode = APPLY` → chờ user duyệt.
3. **Bước 3 — Áp dụng Thay đổi & Kiểm chứng 2 Lớp (`Mode = APPLY`):** Sửa đúng các dòng đã duyệt (giữ nguyên `TC_ID`), chạy các bài test vừa sửa (**PASS 2 lần liên tiếp**) + chạy toàn bộ bài test dùng chung Page Object vừa sửa, rồi cập nhật kết quả vào `reports/automation_impact_plan.md`.

## Output
- `reports/automation_impact_plan.md` và *(khi `Mode = APPLY`)* các file Test / Page Object đã đồng bộ Delta & kiểm chứng.
