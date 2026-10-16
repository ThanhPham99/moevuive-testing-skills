---
name: retest-fixed-bugs
description: "Retest bug đã được dev fix trên build mới — chấm FIXED/NOT_FIXED/PARTIAL/CANNOT_VERIFY, chạy regression quanh vùng fix và cập nhật lịch sử bug (RETEST / FULL modes)."
skills:
  - skills-manual-test-executor
  - skills-bug-reporter
---

# Retest Fixed Bugs (Workflow Dispatcher)

Xác minh các lỗi (Bugs) đã được đội phát triển sửa trên bản build mới — thực thi lại chính xác các bước tái hiện trong Bug Report gốc, kiểm tra hồi quy (Regression) xung quanh vùng vừa sửa và cập nhật bảng **Lịch sử retest**.

## Inputs & Modes
- **Bug Source**: Đường dẫn file `docs/bugs/<module>/BUG_*.md` hoặc mã Jira Bug Key.
- **New Build / Version**: Phiên bản build mới cần kiểm tra (**Bắt buộc phải khác bản build lúc ghi nhận bug**).
- **Environment & Credentials**: URL môi trường kiểm thử, tài khoản test và cờ xác nhận môi trường dùng chung (Shared Environment).
- **Mode**:
  - `FULL` (Mặc định cho bug `Critical` / `Major` hoặc bản sửa chạm logic dùng chung): Xác minh lại bug gốc ($\ge 2$ lần) + chạy Regression tối đa **15 Test Cases** theo 3 vòng đồng tâm.
  - `RETEST` (Dùng cho bug `Minor` / `Trivial` cô lập): Chỉ xác minh lại đúng bug đó ($\ge 2$ lần).

## Context Pointers (Lazy-Load On Demand)
- **Retest Verdicts, 3 Concentric Regression Rings & `retest_report.md` Schema**: [`.claude/skills/skills-manual-test-executor/references/RETEST_WORKFLOW_AND_REPORT.md`](../../../.claude/skills/skills-manual-test-executor/references/RETEST_WORKFLOW_AND_REPORT.md)
- **Browser Execution, Evidence & Shared-Env Safety Rules**: [`.claude/skills/skills-manual-test-executor/SKILL.md`](../../../.claude/skills/skills-manual-test-executor/SKILL.md)
- **Bug Report Schema & `## Lịch sử retest` Table**: [`.claude/skills/skills-bug-reporter/SKILL.md`](../../../.claude/skills/skills-bug-reporter/SKILL.md)

## Execution Steps
1. **Bước 1 — Kiểm tra Chốt chặn Build & Dựng lại Bối cảnh:** Đọc Bug Report gốc; nếu `Build mới == Build gốc` → ⛔ **DỪNG NGAY**. Chuẩn bị dữ liệu traceable `auto_retest_<timestamp>` nếu dữ liệu cũ đã xoá.
2. **Bước 2 — Thực thi Lại Steps Gốc ($\ge 2$ Lần) & Chấm 4 Trạng thái:** Chạy ở **Headless Mode (`1920x1080`)** mặc định (hoặc `/browser-mode headed` khi cần) theo `RETEST_WORKFLOW_AND_REPORT.md` mục 2 (`✅ FIXED`, `❌ NOT_FIXED`, `🟡 PARTIAL`, `⚠️ CANNOT_VERIFY`) kèm ảnh bằng chứng.
3. **Bước 3 — Chạy Regression Quanh Vùng Fix (`Mode = FULL`):** Chọn tối đa 15 TC theo 3 vòng đồng tâm (Cùng `REQ ID` → Cùng Màn hình/Form → Thành phần dùng chung). Nếu phát sinh lỗi mới do bản sửa → tách thành Bug mới qua `/create-bug-report`.
4. **Bước 4 — Xuất Báo cáo & Cập nhật Lịch sử Bug Gốc:** Ghi `docs/executions/<module>/retest_<timestamp>/retest_report.md` theo đúng 5 mục trong `RETEST_WORKFLOW_AND_REPORT.md` mục 4 và nối dòng mới lên đầu bảng `## Lịch sử retest` trong `docs/bugs/<module>/BUG_*.md` (không sửa mô tả gốc).

## Output
- `docs/executions/<module>/retest_<timestamp>/retest_report.md`, thư mục `evidence/` và bảng `## Lịch sử retest` trong file Bug gốc.
