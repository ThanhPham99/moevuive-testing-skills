# Mẫu Bug Report Chuẩn (`BUG_*.md`) & Quy Trình Đẩy Lên Jira

> Tài liệu tham chiếu chi tiết mẫu `docs/bugs/<module>/BUG_<module>_<timestamp>_<TC_ID>.md`, bảng chỉ mục `docs/bugs/README.md` và CLI đẩy bug lên Jira cho [`skills-bug-reporter`](../SKILL.md).

---

## 1. Cấu Trúc Đầy Đủ Của File `BUG_<module>_<timestamp>_<TC_ID>.md`

Mẫu dưới đây tương thích 100% với `scripts/bugs-viewer/bundle.html` (`parseBugFile` trong `scripts/viewer-core.mjs`), `scripts/validate-docs.mjs` và `scripts/integrations/jira/jira_bug_creator.js`:

```markdown
# [BUG] Ô Email không giữ lại giá trị vừa nhập sau khi đăng nhập thất bại

## Thông tin chung
- **ID:** BUG_login_1787226514_TC016
- **Severity:** 🟡 Minor
- **Priority:** P2
- **Môi trường:** https://crm.anhtester.com/admin/authentication | Chrome Headless 1920x1080 | Linux
- **Build / Version:** Perfex CRM demo (khảo sát 2026-08-20)
- **Test case liên quan:** `CRM_LOGIN_TC_016`
- **REQ ID liên quan:** `REQ-LOGIN-16`
- **Test data đã dùng:** `admin@example.com` / mật khẩu sai `WrongPass_1787226514`
- **Ngày phát hiện:** 2026-08-20
- **Execution run:** `docs/executions/login/run_1787215085/execution_report.md`

## Steps to Reproduce
1. Mở trang đăng nhập quản trị `/admin/authentication`.
2. Nhập email `admin@example.com` và mật khẩu sai `WrongPass_1787226514`.
3. Bấm nút **Login** và quan sát ô **Email Address** sau khi trang tải lại.

## Expected Result
Trang hiển thị thông báo lỗi xác thực và ô **Email Address** vẫn giữ nguyên giá trị `admin@example.com` vừa nhập.

## Actual Result
Trang hiển thị thông báo lỗi nhưng ô **Email Address** bị xoá trắng, người dùng phải gõ lại từ đầu.

## Evidence
- Screenshot: [CRM_LOGIN_TC_016_step3_fail.png](../../executions/login/run_1787215085/evidence/CRM_LOGIN_TC_016_step3_fail.png)
- Console / Network log: `POST /admin/authentication -> 200 OK (form re-rendered with empty value="")`

## Ghi chú thêm
- **Tần suất tái hiện:** Luôn luôn (2/2 lần)
- **Workaround:** Nhập lại email thủ công sau mỗi lần sai mật khẩu
- **Root cause nghi ngờ:** View template không truyền lại `set_value('email')` khi xác thực thất bại
- **Đề xuất fix:** Giữ lại giá trị trường `email` trong response render lại form login
- **Cách verify sau khi fix:** Chạy lại `CRM_LOGIN_TC_016` qua `/retest-fixed-bugs` tối thiểu 2 lần liên tiếp

## Lịch sử retest
| Ngày | Build | Kết quả | Retest report | Ghi chú |
|---|---|---|---|---|
| 2026-08-22 | v2.4.3 | ❌ NOT_FIXED | [retest_report.md](../../executions/login/retest_1787300000/retest_report.md) | Ô Email vẫn bị xoá trắng |
```

---

## 2. Tích Hợp Đẩy Bug Lên Jira Bằng CLI Zero-Dependency (`jira_bug_creator.js`)

Khi người dùng yêu cầu đẩy bug lên Jira và `.env` đã cấu hình `JIRA_BASE_URL` + `JIRA_EMAIL`/`JIRA_API_TOKEN` (Cloud) hoặc `JIRA_PAT` (Server/DC):

```bash
# Đẩy file BUG_*.md lên Jira, tự động đính kèm ảnh evidence và ghi ngược mã Jira Issue vào BUG_*.md
node scripts/integrations/jira/jira_bug_creator.js \
  --file docs/bugs/login/BUG_login_1787226514_TC016.md \
  --project PROJ \
  --attach \
  --update
```

1. Script dùng `parseBugFile()` trích xuất tiêu đề, `Severity`, `Priority`, `Môi trường`, `Build`, `TC ID`, `REQ ID`, `Steps to Reproduce`, `Expected Result`, `Actual Result` và chuyển đổi sang Atlassian Document Format (`markdownToAdf`) cho Jira Cloud v3 hoặc Markdown cho Jira Server v2.
2. Tự động tìm các ảnh evidence liên kết trong mục `## Evidence` và đính kèm lên Jira qua endpoint `POST /rest/api/{2|3}/issue/{key}/attachments` khi có cờ `--attach`.
3. Khi có cờ `--update`, ghi bổ sung dòng `- **Jira Issue:** \`PROJ-456\`` vào mục `## Thông tin chung` của file `BUG_*.md`.
