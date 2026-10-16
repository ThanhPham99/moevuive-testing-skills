# Quy Tắc Report (Allure & Tương Đương)

> Áp dụng cho **mọi** script automation sinh ra, bất kể framework (Playwright, Selenium, Appium) hay ngôn ngữ.
> **Nguyên tắc gốc:** Report phải đọc hiểu được bởi người **không xem code** (QA Lead, BA, PM). Nhìn vào Test Body là biết test đã làm gì, ở bước nào, kết quả ra sao.

---

## 1. Năm Metadata Bắt Buộc Cho Mỗi Test

Mỗi test case **PHẢI** khai báo đủ 5 mục sau (thiếu bất kỳ mục nào = chưa đạt Definition of Done):

| Mục | Nội dung | Ví dụ |
|---|---|---|
| **Tên test (title)** | Mô tả hành vi bằng **Tiếng Việt**, không phải tên hàm (`test_login_valid`) | `Đăng nhập thành công với tài khoản admin hợp lệ` |
| **Description** | 1–2 câu: test kiểm tra gì, điều kiện gì, kỳ vọng gì | `Kiểm tra người dùng đăng nhập bằng email/password hợp lệ thì vào được Dashboard.` |
| **Severity** | `blocker` / `critical` / `normal` / `minor` / `trivial` | `blocker` |
| **Tags / Labels** | Nhóm chạy: `smoke`, `regression`, tên module | `smoke`, `login` |
| **TC ID** | Mã manual test case gắn qua label `testId` để `skills-coverage-traceability` đối soát RTM | `CRM_LOGIN_TC_001` |

---

## 2. Test Body — Mô Tả Từng Bước (`Arrange:` / `Act:` / `Assert:`)

Toàn bộ thân test **PHẢI** bọc trong các step Tiếng Việt mô tả **hành vi nghiệp vụ** (tối thiểu 3 step `Arrange:` / `Act:` / `Assert:`; cấm để test body phẳng 1 dòng hoặc đặt tên kiểu `step 1`, `login()`):

```text
▼ Test body
  ▸ Arrange: Mở trang Login
  ▸ Act: Đăng nhập bằng tài khoản admin
  ▸ Assert: Hệ thống chuyển vào Dashboard
  ▸ trang_thai_cuoi_cua_test  (ảnh)
```

---

## 3. Bằng Chứng Thực Thi: Screenshot & Video (Cho Cả PASS Lẫn FAIL)

### 3.1. Screenshot Thông Minh Ở Cuối MỌI Test (Trong Teardown Hook)

| Trường hợp | Phạm vi chụp (Tối ưu tốc độ & dung lượng) | Tên attachment Allure | File lưu đĩa |
|---|---|---|---|
| Test **PASSED** | **Viewport (`fullPage: false`)** — khung `1920x1080` chuẩn Full HD (~50ms) | `trang_thai_cuoi_cua_test` | `reports/screenshots/<test>_pass.png` |
| Test **FAILED** | **Full-page (`fullPage: true`)** — chụp toàn trang để không sót lỗi ngoài khung nhìn | `trang_thai_khi_that_bai` | `reports/screenshots/<test>_fail.png` |

> Chụp tập trung trong teardown (`afterEach` / `@AfterMethod` / fixture finalizer), **không** rải lệnh chụp trong thân test.

### 3.2. Video Bằng Chứng Thích Ứng (`VIDEO_MODE` / `-Dvideo.mode` — lưu tại `reports/videos/`)

| Chế độ `VIDEO_MODE` | Khi nào dùng | Hành vi với Test PASSED | Hành vi với Test FAILED |
|---|---|---|---|
| `retain-on-failure` (**Mặc định**) | Regression hàng ngày / CI | Tự động xóa file `.webm` tạm sau khi PASS | Giữ file `.webm` & đính kèm tên `video_khi_that_bai` |
| `on` (**Nghiệm thu / UAT**) | Cần video cho cả PASS lẫn FAIL | Giữ file `.webm` & đính kèm tên `video_bang_chung_pass` | Giữ file `.webm` & đính kèm tên `video_khi_that_bai` |
| `off` (**Tốc độ cao**) | Chỉ cần screenshot | Không quay video | Không quay video |

---

## 4. CẤM Đính Kèm `stdout` / `stderr`

Report **KHÔNG** được chứa attachment `stdout`, `stderr` thô:
- **Pytest (`allure-pytest`):** Thêm `--allure-no-capture` vào `addopts` trong `pyproject.toml` / `pytest.ini`.
- **Playwright TS / TestNG:** Không dùng `console.log` / `System.out.println` trong test; dùng logger framework ghi vào `reports/logs/`.

---

## 5. Bảng Ánh Xạ API Theo Framework

| Mục | Playwright + TS | Pytest (Python) | TestNG (Java) |
|---|---|---|---|
| Tên test | `allure.displayName()` | `@allure.title(...)` | `@Description` + `ITestListener` |
| Description | `allure.description()` | `@allure.description(...)` | `@Description(...)` |
| Severity | `allure.severity()` | `@allure.severity(...)` | `@Severity(SeverityLevel.X)` |
| Tag / Label | `allure.tags()` | `@allure.tag(...)` | `@Story` / `@Feature` |
| TC ID | `allure.label('testId', ...)` | `@allure.label('testId', ...)` | `Allure.label("testId", ...)` |
| Step | `test.step('...', async () => {})` | `with allure.step('...')` | `@Step("...")` / `Allure.step(...)` |
| Attach ảnh | `testInfo.attach(name, {body, contentType: 'image/png'})` | `allure.attach(png, name, PNG)` | `Allure.addAttachment(name, "image/png", stream, ".png")` |
| Attach video | `testInfo.attach(name, {path, contentType: 'video/webm'})` | `allure.attach.file(webm, name, WEBM)` | `Allure.addAttachment(name, "video/webm", stream, ".webm")` |

> Code mẫu đầy đủ theo từng stack: [`TEMPLATES_PLAYWRIGHT_TS.md`](../skills/skills-framework-architect/references/TEMPLATES_PLAYWRIGHT_TS.md) · [`TEMPLATES_PLAYWRIGHT_JAVA.md`](../skills/skills-framework-architect/references/TEMPLATES_PLAYWRIGHT_JAVA.md) · [`TEMPLATES_SELENIUM_JAVA.md`](../skills/skills-framework-architect/references/TEMPLATES_SELENIUM_JAVA.md) · [`TEMPLATES_PYTEST_AND_CICD.md`](../skills/skills-framework-architect/references/TEMPLATES_PYTEST_AND_CICD.md) (chỉ mục chung: [`CODE_TEMPLATES.md`](../skills/skills-framework-architect/references/CODE_TEMPLATES.md)).

---

## 6. Thư Mục Output `reports/` & Allure CLI Cài Cục Bộ Trong Project

1. **Gom toàn bộ output vào `reports/`:** Mọi `allure-results/`, `allure-report/`, `allure-report-single/`, `html/`, `logs/`, `screenshots/`, `videos/` phải nằm trong `reports/` (cấm rải `allure-results/` hoặc `playwright-report/` ở root).
2. **`.gitignore` bắt buộc chặn `reports/` và `.allure/`**; CI chỉ upload 1 artifact duy nhất là `reports/`.
3. **Allure CLI cài cục bộ trong project (CẤM `brew/scoop/choco install allure`):**
   - **Node / Python:** cài devDependency `allure` (Allure 3 thuần Node) → mở bằng `npm run report`.
   - **Java + Maven:** dùng `maven-dependency-plugin` giải nén `allure-commandline:zip` vào `.allure/` → mở bằng `mvn allure:serve`.

---

## 7. Checklist Nghiệm Thu Report Trước Bàn Giao

- [ ] Đủ 5 metadata (Tên test Tiếng Việt, Description, Severity, Tags, `testId` = TC ID) & $\ge 3$ step `Arrange:` / `Act:` / `Assert:`.
- [ ] Có `trang_thai_cuoi_cua_test` (PASS viewport) và `trang_thai_khi_that_bai` (FAIL full-page) + video theo `VIDEO_MODE`.
- [ ] Không có attachment `stdout`/`stderr`; toàn bộ output nằm gọn trong `reports/`; mở được bằng `npm run report` / `mvn allure:serve`.
