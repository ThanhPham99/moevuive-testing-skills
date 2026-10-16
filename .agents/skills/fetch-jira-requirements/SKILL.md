---
name: fetch-jira-requirements
description: "Lấy Requirements / User Stories từ Jira ticket (theo Issue Key, Project, Epic hoặc JQL) và lưu thành file Markdown hoặc JSON."
skills:
  - skills-jira-integration
---

# Workflow: Fetch Jira Requirements (`/fetch-jira-requirements`)

> **Context Pointer:** Nạp và thực thi theo [`.claude/skills/skills-jira-integration/SKILL.md`](../../../.claude/skills/skills-jira-integration/SKILL.md).

## 1. Input Cần Thu Thập

| Input | Bắt buộc? | Tham số CLI tương ứng |
|---|---|---|
| **Phạm vi Jira cần lấy** | ⭐ Bắt buộc (chọn 1) | `--issue <KEY>` · `--project <KEY> --type <TYPE>` · `--epic <KEY>` · `--jql "<QUERY>"` |
| **Định dạng đầu ra** | Mặc định `md` | `--format md` (Markdown requirement) hoặc `json` |
| **Thư mục lưu** | Mặc định `./requirements/jira` | `--output <path>` |

## 2. Các Bước Thực Hiện

1. **Kiểm tra điều kiện tiên quyết:**
   - Xác nhận file `.env` có đủ thông tin kết nối Jira (`JIRA_BASE_URL`, `JIRA_EMAIL`/`JIRA_API_TOKEN` hoặc `JIRA_PAT`).
   - Kiểm tra `scripts/integrations/node_modules/`; nếu chưa có thì chạy `npm install` tại `scripts/integrations`.
2. **Thực thi `jira_fetcher.js`:**
   ```bash
   node scripts/integrations/jira/jira_fetcher.js --issue <ISSUE_KEY> --format md --output ./requirements/jira
   ```
   *(Hoặc thay bằng `--project`, `--epic`, `--jql` tùy theo yêu cầu của user).*
3. **Kiểm tra & Bàn giao kết quả:**
   - Đọc file vừa xuất trong `./requirements/jira/` và tóm tắt danh sách issues bằng Tiếng Việt.
   - Nếu gặp lỗi kết nối (`401`, `403`, `404`), tra bảng **Troubleshooting** trong `skills-jira-integration`.
   - Gợi ý bước tiếp theo: phân tích sâu tài liệu bằng `/analyze-requirement-document` hoặc cập nhật delta bằng `/update-requirements-from-ticket`.
