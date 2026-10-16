# Quy Tắc Report (Allure & tương đương)

> Áp dụng cho **mọi** script automation sinh ra, bất kể framework (Playwright, Selenium, Appium) hay ngôn ngữ.
>
> **Nguyên tắc gốc:** Report phải đọc hiểu được bởi người **không xem code** — QA lead, BA, PM. Nhìn vào Test Body là biết test đã làm gì, ở bước nào, kết quả ra sao.

---

## 1. Metadata Bắt Buộc Cho Mỗi Test

Mỗi test case **PHẢI** khai báo đủ 5 mục sau. Thiếu bất kỳ mục nào = chưa đạt Definition of Done.

| Mục | Nội dung | Ví dụ |
|---|---|---|
| **Tên test (title)** | Mô tả hành vi bằng **Tiếng Việt**, không phải tên hàm | `Đăng nhập thành công với tài khoản admin hợp lệ` |
| **Description** | 1–2 câu: test kiểm tra gì, điều kiện gì, kỳ vọng gì | `Kiểm tra người dùng đăng nhập bằng email và mật khẩu hợp lệ thì được chuyển vào Dashboard và thấy menu điều hướng.` |
| **Severity** | `blocker` / `critical` / `normal` / `minor` / `trivial` | `blocker` cho luồng login |
| **Tags / Labels** | Nhóm chạy: `smoke`, `regression`, tên module | `smoke`, `login` |
| **TC ID** | Mã manual test case để truy vết ngược | `CRM_LOGIN_TC_001` |

**KHÔNG** để tên test hiển thị trong report là tên hàm kiểu `test_login_with_valid_credentials` — đó là tên code, không phải tên test case.

**TC ID** gắn qua label riêng (không nhét vào title) để skill `skills-coverage-traceability` map được RTM.

---

## 2. Test Body — Mô Tả Từng Bước

Toàn bộ thân test **PHẢI** được bọc trong các **step có tên mô tả bằng Tiếng Việt**.

### Cấu trúc chuẩn — bám theo Arrange / Act / Assert

```
▼ Test body
  ▸ Arrange: Mở trang Login
  ▸ Act: Đăng nhập bằng tài khoản admin
  ▸ Assert: Hệ thống chuyển vào Dashboard
  ▸ trang_thai_cuoi_cua_test  (ảnh)
```

### Quy tắc đặt tên step

| ✅ Đúng | ❌ Sai |
|---|---|
| `Act: Đăng nhập bằng tài khoản admin` | `login()` |
| `Assert: Hệ thống chuyển vào Dashboard` | `check url` |
| `Arrange: Mở trang Login` | `step 1` |

- Bắt đầu bằng tiền tố `Arrange:` / `Act:` / `Assert:` để người đọc biết đang ở giai đoạn nào
- Tên step mô tả **hành vi nghiệp vụ**, không mô tả thao tác DOM
- Step con (sub-step) sinh tự động từ method của Page Object — đánh dấu method POM bằng step API tương ứng

### Không được để test body rỗng step

Test mà Test Body chỉ hiện 1 dòng phẳng = **fail review**. Tối thiểu phải có 3 step Arrange / Act / Assert.

---

## 3. Bằng Chứng Thực Thi: Screenshot & Video (Cho Cả PASS Lẫn FAIL)

### 3.1. Screenshot Thông Minh — Đính Kèm Allure & Lưu Đĩa Ở Cuối MỌI Test

**Bắt buộc** chụp và đính kèm ảnh màn hình ở **cuối mỗi test case**, **không phân biệt PASS hay FAIL**, đồng thời lưu bản cứng vào `reports/screenshots/`:

| Trường hợp | Phạm vi chụp (Tối ưu tốc độ & dung lượng) | Tên attachment Allure | File lưu đĩa |
|---|---|---|---|
| Test **PASSED** | **Viewport (`fullPage: false`)** — khung `1920x1080` chuẩn Full HD, chụp tức thì (~50ms), nhẹ dung lượng | `trang_thai_cuoi_cua_test` | `reports/screenshots/<test>_pass.png` |
| Test **FAILED** | **Full-page (`fullPage: true`)** — chụp toàn trang để không sót thông báo lỗi ở ngoài khung nhìn | `trang_thai_khi_that_bai` | `reports/screenshots/<test>_fail.png` |

**Quy tắc:**
- Chụp trong teardown (`afterEach` / `@AfterMethod` / fixture finalizer) — **không** rải lệnh chụp trong thân test.
- Lý do bắt buộc cả khi PASS: chứng minh test **thực sự chạy trên UI** chứ không phải pass giả do assertion yếu.

### 3.2. Video Bằng Chứng Thích Ứng (`VIDEO_MODE`)

Điều khiển qua biến môi trường `VIDEO_MODE` (hoặc `-Dvideo.mode` trong Java Maven), lưu file tại `reports/videos/` (hoặc `reports/test-artifacts/`):

| Chế độ `VIDEO_MODE` | Khi nào dùng | Hành vi với Test PASSED | Hành vi với Test FAILED |
|---|---|---|---|
| `retain-on-failure` (**Mặc định**) | Chạy regression hàng ngày / CI | Tự động xóa file `.webm` tạm sau khi PASS để tiết kiệm ổ đĩa & I/O | Giữ file `.webm` và đính kèm vào Allure với tên `video_khi_that_bai` |
| `on` (**Nghiệm thu / UAT**) | Khi cần bằng chứng video cho cả luồng chạy thành công lẫn lỗi | Giữ file `.webm` và đính kèm vào Allure với tên `video_bang_chung_pass` | Giữ file `.webm` và đính kèm vào Allure với tên `video_khi_that_bai` |
| `off` (**Tốc độ cao**) | Khi chỉ cần screenshot bằng chứng | Không quay video | Không quay video |

---

## 4. CẤM Đính Kèm stdout / stderr

Report **KHÔNG** được chứa attachment `stdout`, `stderr`.

| Framework | Cách tắt |
|---|---|
| **pytest + allure-pytest** | Thêm `--allure-no-capture` vào `addopts` trong `pyproject.toml` / `pytest.ini` |
| **Playwright TS** | Không attach mặc định — chỉ cần **không** dùng `console.log` trong test |
| **TestNG + allure-testng** | Không attach mặc định — chỉ cần **không** dùng `System.out.println` |

> ⚠️ `--allure-no-capture` tắt luôn cả attachment `log`. Nếu vẫn cần log nghiệp vụ, attach thủ công một khối log đã chọn lọc — **không** đổ toàn bộ output thô vào report.

Ghi log dùng **logger framework** (Log4j / logging / winston), không dùng `print` / `console.log` — đây cũng là anti-pattern đã cấm ở `automation_rules.md`.

---

## 5. Bảng API Theo Framework

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

Code mẫu đầy đủ theo từng stack: [`TEMPLATES_PLAYWRIGHT_TS.md`](../skills/skills-framework-architect/references/TEMPLATES_PLAYWRIGHT_TS.md) · [`TEMPLATES_PLAYWRIGHT_JAVA.md`](../skills/skills-framework-architect/references/TEMPLATES_PLAYWRIGHT_JAVA.md) · [`TEMPLATES_SELENIUM_JAVA.md`](../skills/skills-framework-architect/references/TEMPLATES_SELENIUM_JAVA.md) · [`TEMPLATES_PYTEST_AND_CICD.md`](../skills/skills-framework-architect/references/TEMPLATES_PYTEST_AND_CICD.md) (chỉ mục chung: [`CODE_TEMPLATES.md`](../skills/skills-framework-architect/references/CODE_TEMPLATES.md)).

---

## 6. Thư Mục Output — Gom Hết Vào `reports/`

**Toàn bộ** sản phẩm sinh ra khi chạy test PHẢI nằm trong **một thư mục `reports/` duy nhất** ở gốc project. **CẤM** rải file report ra root.

```text
project-root/
└── reports/                      # ← Toàn bộ output nằm trong đây
    ├── allure-results/           # Raw results (JSON + attachments) — input cho allure generate
    ├── allure-report/            # HTML report nhiều file (mở bằng allure open)
    ├── allure-report-single/     # Report gộp 1 file — tiện gửi qua chat/email
    ├── html/                     # HTML report của runner (pytest-html / Playwright HTML)
    ├── logs/                     # Log file thực thi
    ├── screenshots/              # Ảnh chụp PASS (_pass.png) và FAIL (_fail.png) lưu ra đĩa
    └── videos/                   # Video bằng chứng (.webm) theo chế độ VIDEO_MODE
```

### Cấu hình theo stack

| Stack | Nơi khai báo | Giá trị |
|---|---|---|
| **Playwright TS** | `playwright.config.ts` | `['html', { outputFolder: 'reports/html' }]` · `['allure-playwright', { resultsDir: 'reports/allure-results' }]` · `outputDir: 'reports/test-artifacts'` |
| **Pytest** | `pyproject.toml` → `addopts` | `--alluredir=reports/allure-results --html=reports/html/index.html` |
| **TestNG + Maven** | `pom.xml` → surefire `systemPropertyVariables` | `allure.results.directory` = `${project.basedir}/reports/allure-results` · surefire `reportsDirectory` = `${project.basedir}/reports/surefire` |
| **Log file** | Log4j2 / `logging` / winston | Ghi vào `reports/logs/` |
| **Screenshot lưu đĩa** | Teardown / `ScreenshotUtil` | Ghi vào `reports/screenshots/` |
| **Video lưu đĩa** | Browser Context / `VIDEO_MODE` | Ghi vào `reports/videos/` (hoặc `reports/test-artifacts/`) |

### Allure CLI phải cài TRONG project — máy không cài gì

> **Người dùng clone project về, chạy `npm install` (hoặc `mvn`) là mở được report.**
>
> 🚫 **CẤM** hướng dẫn cài Allure lên máy: `scoop install allure` · `brew install allure` · `choco install allure` · tải zip thêm vào `PATH`. Cài vào máy thì đổi máy là hỏng, và CI phải cài lại lần nữa.

| Stack | Cài vào project | Cần Java? |
|---|---|---|
| **Node** (Playwright TS/JS) | devDependency `allure` (Allure 3 — chạy thuần Node) | ❌ |
| **Java + Maven** | `maven-dependency-plugin` giải nén `allure-commandline:zip` vào **`.allure/`** + `allure-maven` trỏ `installDirectory` về đó | ✅ đã có sẵn |
| **Python + Pytest** | `package.json` tối giản + devDependency `allure` | ❌ |

Gói npm `allure-commandline` chỉ **bọc** CLI Allure 2 viết bằng Java → máy vẫn phải có JRE. Chỉ dùng cho project Node khi team bắt buộc giao diện Allure 2 cổ điển, và **phải ghi rõ yêu cầu JRE trong README**.

**Java: KHÔNG dựa vào cơ chế tự tải của `allure-maven`** — nó tải từ Internet lúc chạy goal, máy không mạng / sau proxy là hỏng. Phải giải nén sẵn bộ CLI vào `.allure/` để nó nằm hẳn trong project.

**Máy không có JDK** thì không chạy được test Java (Maven cũng là app Java) — đây là ràng buộc của stack, không phải của Allure. Vẫn **xem** report được bằng: máy có Node → `npx allure generate reports/allure-results`; máy không có gì → gửi bản **single-file HTML**.

### Lệnh sinh report

```bash
npm run report        # Node · Python — allure generate + allure open
mvn allure:serve      # Java + Maven — sinh và mở luôn
```

```bash
# Java — gọi thẳng CLI trong project, không cần Maven
.allure\allure-2.45.0\bin\allure.bat generate reports\allure-results -o reports\allure-report --clean
```

Thư mục output khai trong `allurerc.mjs` (`output: "reports/allure-report"`) hoặc trong `<configuration>` của `allure-maven`.

Config đầy đủ từng stack: [`CODE_TEMPLATES.md`](../skills/skills-framework-architect/references/CODE_TEMPLATES.md).

### Quy tắc kèm theo

- **`.gitignore` PHẢI có dòng `reports/`** — không commit output test lên repo
- **`.gitignore` cũng phải chặn `.allure/`** — nơi `allure-maven` tải CLI về
- **CI upload artifact** trỏ vào `reports/` (1 artifact duy nhất, không upload lẻ từng thư mục)
- **KHÔNG** để thư mục mặc định của tool nằm ở root: `allure-results/`, `test-results/`, `playwright-report/`, `target/surefire-reports/` — phải trỏ lại vào `reports/`
- Ảnh/video trong `reports/screenshots/` và `reports/videos/` chụp hệ thống thật, **thường chứa dữ liệu khách hàng** — thêm lý do nữa để không commit

---

## 7. Checklist Review Report

Trước khi bàn giao script, mở report lên và kiểm:

- [ ] Tên test hiển thị bằng Tiếng Việt, **không** phải tên hàm
- [ ] Có Description giải thích test kiểm tra gì
- [ ] Có Severity + Tags + TC ID
- [ ] Test Body có step Arrange / Act / Assert, tên step đọc hiểu được
- [ ] Có ảnh `trang_thai_cuoi_cua_test` (chụp viewport nhanh) ở cuối **mọi** test PASSED và lưu vào `reports/screenshots/`
- [ ] Test FAILED có ảnh `trang_thai_khi_that_bai` (chụp full-page) và video `video_khi_that_bai` (khi `VIDEO_MODE` khác `off`)
- [ ] Khi chạy `VIDEO_MODE=on`, test PASSED có đính kèm `video_bang_chung_pass`
- [ ] **Không** có attachment `stdout` / `stderr`
- [ ] Toàn bộ output nằm trong `reports/` — root project sạch, không có `allure-results/` / `test-results/` / `playwright-report/` lạc ra ngoài
- [ ] `.gitignore` đã có `reports/`
- [ ] Mở report bằng CLI **cài trong project** (`npm run report` / `mvn allure:serve`) — máy chưa cài Allure vẫn chạy được
