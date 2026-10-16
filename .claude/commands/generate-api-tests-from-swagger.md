---
description: "Sinh test cases (Markdown) hoặc cả bộ API automation tests (Playwright request / RestAssured / Pytest) trực tiếp từ Swagger/OpenAPI spec — hỗ trợ Live API Probing & BOLA/IDOR."
skills:
  - skills-rbt-manual-testing
---

# Generate API Tests from Swagger / OpenAPI (Workflow Dispatcher)

Đọc Swagger / OpenAPI (URL hoặc file JSON/YAML) để tự động thiết kế bộ API test cases chuẩn Markdown (`SPEC` mode) hoặc sinh trọn gói API test cases + code automation (`FULL` mode).

## Inputs & Modes
- **Swagger / OpenAPI Source**: URL (`https://api.example.com/v3/api-docs`, `/swagger.json`) hoặc đường dẫn file JSON/YAML cục bộ.
- **Module / Tag**: Tên nhóm API cần sinh (hoặc `ALL`).
- **Mode**:
  - `SPEC` (mặc định nếu chưa có automation framework): Chỉ sinh file Markdown test cases (`docs/testcases/_<hệ-thống>/<module>/test_cases_<module>.md`) + cập nhật `_discovery/api_map.md`.
  - `FULL`: Sinh Markdown test cases + sinh code API Automation (Playwright `APIRequestContext`, RestAssured, hoặc Pytest `requests`).
- **Live API Probing** *(Optional)*: Base URL + test credentials (`userA`, `userB`) để thăm dò thực tế các endpoint trước khi thiết kế test.

## Context Pointers (Lazy-Load On Demand)
- **API Test Case Schema & Rules**: `.claude/skills/skills-rbt-manual-testing/SKILL.md`
- **BVA / EP / Decision Table Rules**: `.claude/skills/skills-rbt-manual-testing/references/DESIGN_TECHNIQUES.md`
- **API Automation Templates**:
  - Playwright TS (`APIRequestContext`): `.claude/skills/skills-framework-architect/references/TEMPLATES_PLAYWRIGHT_TS.md`
  - Selenium/RestAssured Java: `.claude/skills/skills-framework-architect/references/TEMPLATES_SELENIUM_JAVA.md`
  - Pytest (`requests` + `jsonschema`): `.claude/skills/skills-framework-architect/references/TEMPLATES_PYTEST_AND_CICD.md`

## Data Safety & Security Rules (Bắt buộc khi Live Probing / Chạy Test)
1. **Traceable Test Data**: Mọi bản ghi tạo mới phải gắn prefix `auto_<module>_<timestamp>` để dễ dọn dẹp (`afterEach` / teardown).
2. **Never Modify/Delete Existing Data**: Các test `PUT`/`PATCH`/`DELETE` chỉ được thao tác trên resource vừa tạo bởi chính test run đó (`POST` -> lấy `id` -> `PUT`/`DELETE`).
3. **2-User BOLA/IDOR Isolation**: Khi test phân quyền ngang (BOLA/IDOR), luôn dùng 2 tài khoản test độc lập (`userA` tạo resource, `userB` thử đọc/sửa/xóa resource của `userA` -> kỳ vọng `403 Forbidden` hoặc `404 Not Found`). Không bao giờ test lên dữ liệu thật của user khác.
4. **Per-Operation Auth Matrix**: Kiểm tra kỹ `security` ở cả cấp global lẫn per-operation (`security: []` nghĩa là public endpoint; có `bearerAuth`/`apiKey` phải sinh đủ test `401 Unauthorized` khi thiếu/sai/hết hạn token và `403 Forbidden` khi sai role).

## Execution Steps

### Bước 1: Thu thập & Lưu trữ OpenAPI Spec + Live API Probing (nếu có)
1. Đọc file hoặc tải OpenAPI spec về lưu bản snapshot tại `docs/requirements/_<hệ-thống>/_discovery/sources/openapi_<YYYY-MM-DD>.json`.
2. Phân tích danh sách endpoints, methods, path/query/header params, requestBody (`required`, `type`, `format`, `enum`, `minLength`, `maxLength`, `minimum`, `maximum`, `pattern`), responses (`200`, `201`, `204`, `400`, `401`, `403`, `404`, `409`, `422`, `429`, `500`, `503`) và per-operation `security`.
3. Cập nhật hoặc tạo mới `docs/requirements/_<hệ-thống>/_discovery/api_map.md`.
4. Nếu có **Live API Probing**: Gửi các request thăm dò an toàn (`GET`, `OPTIONS`, hoặc `POST` với payload test có prefix `auto_`) để phát hiện chênh lệch giữa Spec và thực tế (ghi nhận thành `F-01`, `F-02`... và câu hỏi `AMB-01`... nếu spec thiếu/sai).

### Bước 2: Thiết kế Ma trận Kịch bản API (7 Nhóm + 12 HTTP Status Codes)
Với mỗi endpoint trong phạm vi, lập kế hoạch phủ đủ 7 nhóm kịch bản:
1. **Happy Path (`200`/`201`/`204`)**: Đúng schema, đủ trường bắt buộc, đúng kiểu dữ liệu và headers.
2. **Schema & Validation (`400`/`422`)**: Thiếu trường `required`, sai kiểu (`string` vs `number`), sai `format` (`email`, `uuid`, `date-time`), ngoài miền `enum`, vượt biên `min/max` (BVA).
3. **Authentication (`401`)**: Không gửi token, token sai định dạng, token hết hạn (trừ endpoint có `security: []`).
4. **Authorization & BOLA/IDOR (`403`/`404`)**: Role thấp gọi API admin; `userB` truy cập/sửa/xóa ID của `userA`.
5. **State, Resource & Idempotency (`404`/`409`)**: ID không tồn tại, tạo trùng unique key (`409 Conflict`), gọi `DELETE`/`PUT` lặp lại.
6. **Pagination, Filter, Sort & Rate Limit (`200`/`400`/`429`)**: `page=0`, `limit=-1`, `limit=10000`, sort field không hợp lệ, spam vượt ngưỡng.
7. **OWASP API Security**: SQLi/NoSQLi qua query/filter, Mass Assignment (truyền thêm `role: "admin"`, `isVerified: true` vào body), lộ thông tin nhạy cảm (`passwordHash`, stack trace khi `500`).

⏸️ **DỪNG LẠI (HITL Checkpoint)**: Trình bày bảng tóm tắt Endpoints, Per-Operation Auth Matrix, các điểm lệch giữa Spec & Live Probe (`F-nn` / `AMB-nn`), và số lượng test cases dự kiến theo 7 nhóm để người dùng duyệt trước khi sinh chi tiết.

### Bước 3 & 4: Sinh Bộ API Test Cases (`SPEC` & `FULL`) và Code Automation (`FULL`)
- **Markdown Test Cases (`SPEC` & `FULL`)**: Xuất `docs/testcases/_<hệ-thống>/<module>/test_cases_<module>.md` theo schema chuẩn của `skills-rbt-manual-testing` (ghi rõ Method + Endpoint, Auth/Role `userA`/`userB`/`guest`, Headers/Params/Body mẫu, Expected Status Code + Schema/Message assertion, và bước Teardown).
- **API Automation (`Mode = FULL`)**: Đọc template tương ứng từ `Context Pointers`, sinh API Client / Service wrapper tách biệt khỏi file test (`APIRequestContext` / `RequestSpecification` / `requests.Session`), tự tạo dữ liệu tiền điều kiện (`auto_<module>_<timestamp>`) và dọn dẹp ở `afterEach`.

## Output
- `docs/requirements/_<hệ-thống>/_discovery/sources/openapi_<YYYY-MM-DD>.json` & `docs/requirements/_<hệ-thống>/_discovery/api_map.md`
- `docs/testcases/_<hệ-thống>/<module>/test_cases_<module>.md` và *(khi `FULL`)* code API client, schema/models và test specs.