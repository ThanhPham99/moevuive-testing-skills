---
name: skills-jira-integration
description: "Fetch Jira issues/epics/JQL as requirement documents and import Playwright, JUnit, or Allure test execution results into Xray Cloud or Server."
---

# Jira & Xray Integration Skill

## 1. Mô tả & Khi nào sử dụng

Tích hợp hai chiều giữa Claude Testing Skills với **Jira** và **Xray Test Management** (Cloud hoặc Server/Data Center):
1. **Lấy Requirements / User Stories** từ Jira (theo Issue Key, Project, Epic, hoặc JQL) → xuất thành file Markdown/JSON chuẩn cho `/analyze-requirement-document`.
2. **Đẩy Bug Report (`BUG_*.md`) lên Jira** kèm đính kèm bằng chứng (`screenshot` / `video` / `log`) và tự động ghi ngược mã Jira Issue Key.
3. **Xác thực Xray API** và **Đẩy kết quả chạy test** (`Playwright JSON`, `JUnit XML`, `Xray JSON`) lên Xray Test Execution.

**Trigger:** `/fetch-jira-requirements`, `/import-test-results-xray`, `/create-bug-report` (Bước 4), "lấy requirement từ Jira", "đẩy bug lên Jira", "import kết quả test lên Xray".

---

## 2. Cấu trúc Scripts & Cài đặt (Zero-Dependency Node.js 20+)

```text
scripts/integrations/jira/
├── jira_fetcher.js      # Lấy Requirement/User Story từ Jira (tự động chuyển ADF → Markdown)
├── jira_bug_creator.js  # Đẩy file BUG_*.md lên Jira (ADF/Markdown) + upload evidence + ghi ngược Jira Key
├── xray_auth.js         # Xác thực và lấy Token Xray (Cloud & Server/DC)
├── xray_importer.js     # Import kết quả test (Playwright JSON / JUnit XML / Xray JSON) lên Xray
└── utils.js             # Hàm utility, .env loader, ADF <-> Markdown converter & phân trang (pagination)
```

```bash
cp .env.example .env   # Tại thư mục gốc repo (chạy trực tiếp bằng Node.js 20+, không cần npm install)
```

### Biến môi trường bắt buộc trong `.env`

| Biến | Mô tả | Bắt buộc |
|---|---|---|
| `JIRA_BASE_URL` | URL Jira instance (VD: `https://domain.atlassian.net`) | ✅ |
| `JIRA_EMAIL` / `JIRA_API_TOKEN` | Email & API Token (tạo tại `id.atlassian.com/manage-profile/security/api-tokens`) | ✅ (Jira Cloud) |
| `JIRA_PAT` | Personal Access Token | ✅ (Jira Server/DC) |
| `JIRA_PROJECT_KEY` | Project key mặc định (VD: `PROJ`) | Khuyến nghị |
| `XRAY_PLATFORM` | `cloud` (mặc định) hoặc `server` | ✅ (Khi dùng Xray) |
| `XRAY_CLIENT_ID` / `XRAY_CLIENT_SECRET` | Xray API Key (tạo tại `app.getxray.app` → Settings → API Keys) | ✅ (Xray Cloud) |

---

## 3. Lệnh CLI Chuẩn

| Tác vụ | Lệnh thực thi |
|---|---|
| **Lấy 1 issue cụ thể (JSON / Markdown)** | `node scripts/integrations/jira/jira_fetcher.js --issue PROJ-123 [--format md]` |
| **Lấy toàn bộ children của 1 Epic** | `node scripts/integrations/jira/jira_fetcher.js --epic PROJ-10 --format md` |
| **Lấy issues theo Project & Type** | `node scripts/integrations/jira/jira_fetcher.js --project PROJ --type Story --max 20` |
| **Tìm kiếm theo JQL** | `node scripts/integrations/jira/jira_fetcher.js --jql "project = PROJ AND status = 'To Do'"` |
| **Đẩy Bug Report (`BUG_*.md`) lên Jira** | `node scripts/integrations/jira/jira_bug_creator.js --file docs/bugs/<module>/BUG_*.md [--project PROJ] [--attach] [--update]` |
| **Kiểm tra kết nối & xác thực Xray** | `node scripts/integrations/jira/xray_auth.js --verify` |
| **Import kết quả Playwright JSON lên Xray** | `node scripts/integrations/jira/xray_importer.js --format playwright --file reports/test-results/results.json --project PROJ` |
| **Import kết quả JUnit XML lên Xray** | `node scripts/integrations/jira/xray_importer.js --format junit --file reports/junit-results.xml --project PROJ` |

> **Quy ước gắn Test Key:** Đặt mã Xray Test Key trong title của test (VD: `test('[PROJ-123] Đăng nhập hợp lệ', ...)`) để `xray_importer.js` ánh xạ tự động vào đúng Test Issue trên Jira.

---

## 4. Chẩn Đoán Lỗi Thường Gặp (Troubleshooting)

| Lỗi | Nguyên nhân | Cách khắc phục |
|---|---|---|
| `HTTP 401` | Sai API Token / PAT hoặc Client Secret | Kiểm tra lại `JIRA_API_TOKEN`, `JIRA_PAT`, `XRAY_CLIENT_SECRET` trong `.env` |
| `HTTP 403` | Tài khoản không đủ quyền trên Project/Xray | Cấp quyền Browse Projects / Create Test Execution trên Jira |
| `HTTP 404` | Sai `JIRA_BASE_URL` hoặc Issue Key không tồn tại | Kiểm tra lại domain Jira và mã Issue/Project |
| `ENOTFOUND` / `ECONNREFUSED` | Sai tên miền hoặc Jira Server offline | Kiểm tra kết nối mạng/VPN tới Jira Server |

---

## 5. Tài Liệu & Workflow Liên Quan

- [`references/JIRA_ENV_AND_CLI_GUIDE.md`](references/JIRA_ENV_AND_CLI_GUIDE.md) — Mẫu `.env` đầy đủ và ví dụ CLI chi tiết cho Jira & Xray.
- [`/fetch-jira-requirements`](../../commands/fetch-jira-requirements.md) — Lấy requirements từ Jira ticket và lưu thành file đầu vào.
- [`/import-test-results-xray`](../../commands/import-test-results-xray.md) — Đẩy kết quả chạy Automation lên Jira Xray.
