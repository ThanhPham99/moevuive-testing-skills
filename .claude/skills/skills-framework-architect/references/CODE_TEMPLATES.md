# Code Templates Index — Progressive Disclosure by Stack

> **Quy tắc nạp theo nhánh (Progressive Disclosure):** Chỉ đọc đúng file template của tech stack được yêu cầu, tránh nạp đồng thời mọi ngôn ngữ vào context.

## 1. Bảng Tra Cứu Template Theo Stack (Context Pointers)

| Tech Stack | File Reference Cần Đọc | Ghi đè Headed Mode tức thì |
|---|---|---|
| **Playwright + TypeScript** | [`TEMPLATES_PLAYWRIGHT_TS.md`](TEMPLATES_PLAYWRIGHT_TS.md) | `HEADLESS=false npx playwright test` hoặc `npx playwright test --headed` |
| **Playwright + Java (Maven + TestNG)** | [`TEMPLATES_PLAYWRIGHT_JAVA.md`](TEMPLATES_PLAYWRIGHT_JAVA.md) | `mvn test -Dheadless=false` |
| **Selenium + Java (Maven + TestNG)** | [`TEMPLATES_SELENIUM_JAVA.md`](TEMPLATES_SELENIUM_JAVA.md) | `mvn test -Dheadless=false` |
| **Appium + Java (Android / iOS / Flutter)** | [`TEMPLATES_APPIUM_JAVA.md`](TEMPLATES_APPIUM_JAVA.md) | N/A (Chạy trên emulator / real device theo `udid`) |
| **Playwright + Python (Pytest) & CI/CD** | [`TEMPLATES_PYTEST_AND_CICD.md`](TEMPLATES_PYTEST_AND_CICD.md) | `HEADLESS=false pytest` |

> Với cấu trúc thư mục 8 stacks (bao gồm REST Assured & Selenium/Appium Python), đọc [`PROJECT_STRUCTURE.md`](PROJECT_STRUCTURE.md).

## 2. Bất Biến Kiến Trúc Chung (Shared Invariants)

1. **Default Headless Mode (`1920x1080`, GPU disabled):** Mọi web framework mặc định `HEADLESS=true` (`--disable-gpu`, `--disable-dev-shm-usage`, `--no-sandbox`) và hỗ trợ bật **Headed Mode** qua biến môi trường/CLI flag mà không sửa code.
2. **Parallel Execution (Mặc định 5 luồng):** Khai báo duy nhất tại 1 nơi (`WORKERS=5` / `-n 5` / `thread-count="5"`). Driver/Browser quản lý theo `ThreadLocal` (có `remove()` ở teardown) hoặc isolated worker fixture. Appium đặt `thread-count` = số device thật kèm `udid` + `systemPort`/`wdaLocalPort` riêng.
3. **Allure Reporting Cục Bộ:** Cài Allure CLI ngay trong project (`devDependency "allure"` cho Node/Python, giải nén `allure-commandline:zip` vào `.allure/` qua `maven-dependency-plugin` cho Java). Đính kèm screenshot ở cuối **mọi** test (cả PASS lẫn FAIL), không đính kèm `stdout`/`stderr`, gom toàn bộ output vào `reports/`.
4. **Smart Waits & Clean Code:** Dùng auto-wait / `WebDriverWait`, Logger chuẩn, đọc credentials từ `.env` / `config.properties`, tạo test data unique theo timestamp.

## 3. Checklist Nghiệm Thu Trước Bàn Giao

- [ ] Đổi package/module mẫu thành tên thật của dự án; thay locator ví dụ bằng locator đã inspect DOM thực tế.
- [ ] Điền `.env.example` đầy đủ key; thêm `.env`, `reports/`, `.allure/` vào `.gitignore`.
- [ ] Build & chạy thử (`npm ci` / `mvn validate` / `pip install -r requirements.txt`) xác nhận 5 luồng song song và Allure report sinh thành công từ CLI cục bộ.
- [ ] Có sẵn `.github/workflows/` (xem [`TEMPLATES_PYTEST_AND_CICD.md`](TEMPLATES_PYTEST_AND_CICD.md) § 4) chạy headless + parallel và upload `reports/` với `if: always()`.
