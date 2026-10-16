---
description: Lấy Requirements / User Stories từ Jira ticket (theo Issue Key, Project, Epic hoặc JQL) và lưu thành file Markdown hoặc JSON.
skills:
  - skills-jira-integration
---

# Workflow: Fetch Jira Requirements (`/fetch-jira-requirements`)

> **Context Pointers:** Nạp và thực thi theo [`.claude/skills/skills-jira-integration/SKILL.md`](../skills/skills-jira-integration/SKILL.md) và [`JIRA_ENV_AND_CLI_GUIDE.md`](../skills/skills-jira-integration/references/JIRA_ENV_AND_CLI_GUIDE.md).

## 1. Input Cần Thu Thập

| Input | Bắt buộc? | Tham số CLI tương ứng |
|---|---|---|
| **Phạm vi Jira cần lấy** | ⭐ Bắt buộc (chọn 1) | `--issue <KEY>` · `--project <KEY> --type <TYPE>` · `--epic <KEY>` · `--jql "<QUERY>"` |
| **Định dạng đầu ra** | Mặc định `md` | `--format md` (Markdown requirement) hoặc `json` |
| **Thư mục lưu** | Mặc định `./requirements/jira` | `--output <path>` |

## 2. Các Bước Thực Hiện

1. **Kiểm tra điều kiện tiên quyết:**
   - Xác nhận file `.env` (khởi tạo từ `.env.example`) có đủ thông tin kết nối Jira (`JIRA_BASE_URL`, `JIRA_EMAIL`/`JIRA_API_TOKEN` hoặc `JIRA_PAT`).
   - Bộ script `scripts/integrations/jira/` sử dụng Node.js 20+ built-in `fetch` (zero-dependency, chạy trực tiếp không cần `npm install`).
2. **Thực thi `jira_fetcher.js`:**
   ```bash
   node scripts/integrations/jira/jira_fetcher.js --issue <ISSUE_KEY> --format md --output ./requirements/jira
   ```
   *(Hoặc thay bằng `--project`, `--epic`, `--jql` tùy theo yêu cầu của user).*
3. **Kiểm tra & Bàn giao kết quả:**
   - Đọc file vừa xuất trong `./requirements/jira/` và tóm tắt danh sách issues bằng Tiếng Việt.
   - Nếu gặp lỗi kết nối (`401`, `403`, `404`), tra bảng **Troubleshooting** trong `skills-jira-integration`.
   - Gợi ý bước tiếp theo: phân tích sâu tài liệu bằng `/analyze-requirement-document` hoặc cập nhật delta bằng `/update-requirements-from-ticket`.
