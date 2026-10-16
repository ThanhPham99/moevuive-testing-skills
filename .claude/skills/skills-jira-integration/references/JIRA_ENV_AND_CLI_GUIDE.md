# Jira & Xray Environment Setup and CLI Reference

> Tài liệu chi tiết cấu hình `.env`, cú pháp CLI `jira_fetcher.js` / `xray_importer.js` và quy tắc ánh xạ Test Key cho [`skills-jira-integration`](../SKILL.md).

## 1. Mẫu `.env` Đầy Đủ Cho Jira & Xray

```env
# --- JIRA CONNECTION ---
JIRA_BASE_URL=https://your-domain.atlassian.net
# Cloud: dùng JIRA_EMAIL + JIRA_API_TOKEN
JIRA_EMAIL=qa@example.com
JIRA_API_TOKEN=ATATT3xFfGF0...
# Server / Data Center: dùng JIRA_PAT thay cho EMAIL + API_TOKEN
# JIRA_PAT=MzI0...

# --- XRAY TEST MANAGEMENT ---
# Xray Cloud: dùng Client ID + Client Secret
XRAY_CLIENT_ID=2150...
XRAY_CLIENT_SECRET=8f9a...
# Xray Server/DC: dùng chung xác thực với JIRA_PAT hoặc Basic Auth
```

## 2. Các Lệnh CLI Chi Tiết

```bash
# Lấy 1 issue cụ thể (xuất JSON hoặc Markdown)
node scripts/integrations/jira/jira_fetcher.js --issue PROJ-123 --format md --out docs/requirements/analysis_PROJ-123.md

# Lấy toàn bộ Story/Task con của 1 Epic
node scripts/integrations/jira/jira_fetcher.js --epic PROJ-10 --format md

# Tìm kiếm theo JQL tuỳ chỉnh
node scripts/integrations/jira/jira_fetcher.js --jql "project = PROJ AND sprint in openSprints() AND issuetype = Story"

# Kiểm tra kết nối Xray API
node scripts/integrations/jira/xray_auth.js --verify

# Import kết quả chạy Playwright JSON lên Xray
node scripts/integrations/jira/xray_importer.js --format playwright --file reports/test-results/results.json --project PROJ --testExecKey PROJ-900

# Import kết quả chạy JUnit XML (Maven / Pytest) lên Xray
node scripts/integrations/jira/xray_importer.js --format junit --file reports/junit-results.xml --project PROJ

# Đẩy Bug Report (BUG_*.md) lên Jira kèm đính kèm evidence và ghi ngược Jira Key
node scripts/integrations/jira/jira_bug_creator.js --file docs/bugs/login/BUG_login_1787226514_TC016.md --project PROJ --attach --update
```

