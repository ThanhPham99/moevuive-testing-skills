---
name: skills-bug-reporter
description: "Create standardized bug reports (BUG_*.md) and update docs/bugs/README.md from failed test cases with reproduction steps, severity/priority, evidence links, and retest history."
---

# Bug Reporter

## 1. Vai trò & Khi nào sử dụng

Chuyển kết quả test **FAIL** (manual hoặc automation) thành bug report chuẩn mực tại `docs/bugs/<module>/BUG_<module>_<timestamp>_<TC_ID>.md`, cập nhật danh mục `docs/bugs/README.md`, kiểm chứng tính toàn vẹn tham chiếu bằng `scripts/validate-docs.mjs`, và tùy chọn đẩy lên Jira bằng `scripts/integrations/jira/jira_bug_creator.js`.
- **Trigger:** `/create-bug-report`, test case FAIL cần mở bug, hoặc chuẩn hóa lại bug report sơ sài.

---

## 2. Quy trình 6 bước (Workflow)

1. **Collect:** Đọc thông tin test FAIL (error log, screenshot, `execution_report.md` hoặc test script, test data đã dùng).
2. **Reproduce:** Tái hiện lỗi (chạy lại test hoặc thao tác qua Playwright MCP) để loại trừ flaky (nếu nghi flaky → chuyển sang [`skills-flaky-test-analyzer`](../skills-flaky-test-analyzer/SKILL.md)).
3. **Isolate:** Rút gọn `Steps to Reproduce` về mức tối giản, rõ ràng.
4. **Classify:** Gán `Severity` (mức ảnh hưởng kỹ thuật) và `Priority` (mức khẩn cấp nghiệp vụ) độc lập theo bảng mục 4.
5. **Write & Index:** Ghi file `docs/bugs/<module>/BUG_<module>_<timestamp>_<TC_ID>.md` theo mẫu tại [`references/BUG_REPORT_TEMPLATE_AND_JIRA.md`](references/BUG_REPORT_TEMPLATE_AND_JIRA.md) và thêm dòng vào `docs/bugs/README.md`.
6. **Verify Gate & Jira Push (Tuỳ chọn):**
   - Chạy `node scripts/validate-docs.mjs --check` để xác nhận link evidence, `TC ID`, `REQ ID` và bảng danh mục 8 cột hợp lệ 100%.
   - Nếu cần đẩy lên Jira: chạy `node scripts/integrations/jira/jira_bug_creator.js --file <path_to_BUG.md> --project <KEY> --attach --update`.

---

## 3. Quy Tắc Bất Biến Của File `BUG_<module>_<timestamp>_<TC_ID>.md`

- **Các mục bắt buộc** (xem mẫu đầy đủ tại [`references/BUG_REPORT_TEMPLATE_AND_JIRA.md`](references/BUG_REPORT_TEMPLATE_AND_JIRA.md)):
  1. `# [BUG] <Tóm tắt ngắn gọn — module + hành vi sai>`
  2. `## Thông tin chung` với danh sách bullet `- **ID:**`, `- **Severity:**`, `- **Priority:**`, `- **Môi trường:**`, `- **Build / Version:**` *(bắt buộc để retest)*, `- **Test case liên quan:**`, `- **REQ ID liên quan:**`, `- **Test data đã dùng:**`, `- **Ngày phát hiện:**`
  3. `## Steps to Reproduce` · `## Expected Result` · `## Actual Result` · `## Evidence` · `## Ghi chú thêm`
  4. `## Lịch sử retest` với bảng 5 cột: `| Ngày | Build | Kết quả | Retest report | Ghi chú |`
- **Quy tắc Evidence & Retest:**
  - Evidence ảnh còn tồn tại **bắt buộc** viết bằng link Markdown `[tên.png](../../executions/<module>/run_<ts>/evidence/<tên.png>)` (không nhân bản ảnh sang `docs/bugs/`); ảnh lịch sử đã mất thì ghi trong code span `` `tên.png` ``.
  - Sau khi bàn giao, **chỉ mục `Lịch sử retest` được thêm dòng mới lên đầu** khi chạy `/retest-fixed-bugs` với 4 trạng thái: ✅ **FIXED** · ❌ **NOT_FIXED** · 🟡 **PARTIAL** · ⚠️ **CANNOT_VERIFY**.

---

## 4. Bảng Phân Loại Severity & Priority

| Severity | Định nghĩa & Ví dụ | Priority | Định nghĩa |
|---|---|---|---|
| 🔴 **Critical** | Chặn luồng chính, mất dữ liệu, crash, lỗ hổng bảo mật | **P1** | Sửa ngay trong sprint hiện tại / hotfix |
| 🟠 **Major** | Chức năng chính sai nhưng có workaround | **P2** | Sửa trong sprint kế tiếp |
| 🟡 **Minor** | Chức năng phụ sai, validation message sai, UI lệch | **P3** | Sửa khi có thời gian (backlog) |
| 🟢 **Trivial** | Lỗi hiển thị nhỏ, sai chính tả, lệch margin | — | — |

---

## 5. Hợp Đồng Bảng Danh Mục `docs/bugs/README.md` (8 Cột Bắt Buộc)

`scripts/bugs-viewer/bundle.html` và `scripts/validate-docs.mjs` yêu cầu bảng danh mục trong `docs/bugs/README.md` giữ nguyên 8 cột chuẩn (trạng thái chứa một trong các từ khoá: `Đang mở` · `Đã fix` / `Chờ retest` · `rà lại` · `đóng`):

```markdown
| Mã bug | Module | Tiêu đề ngắn | Severity | Priority | Trạng thái | TC liên quan | Ngày phát hiện |
|---|---|---|---|---|---|---|---|
| [BUG_login_1787226514_TC016](login/BUG_login_1787226514_TC016.md) | `LOGIN` | Ô Email không giữ giá trị sau khi đăng nhập thất bại | 🟡 Minor | P2 | 🔴 **Đang mở** | `CRM_LOGIN_TC_016` | 2026-08-20 |
```

---

## 6. Tham chiếu

- [`references/BUG_REPORT_TEMPLATE_AND_JIRA.md`](references/BUG_REPORT_TEMPLATE_AND_JIRA.md) — Mẫu `BUG_*.md` đầy đủ và CLI `jira_bug_creator.js` đẩy bug lên Jira REST API
- [`.claude/rules/automation_rules.md`](../../rules/automation_rules.md) · [`skills-jira-integration`](../skills-jira-integration/SKILL.md) · [`skills-flaky-test-analyzer`](../skills-flaky-test-analyzer/SKILL.md)
- Verification CLI: `node scripts/validate-docs.mjs --check`
