---
name: generate-automation-framework
description: "Khởi tạo kiến trúc khung tự động hóa kiểm thử (Test Automation Framework) mới từ con số 0 (Greenfield) cho Web, Mobile, hoặc API."
skills:
  - skills-framework-architect
---

# Generate Automation Framework (Workflow Dispatcher)

Khởi tạo trọn bộ khung dự án Test Automation mới (Greenfield) theo kiến trúc chuẩn doanh nghiệp (POM + Fixture/DI + Multi-env Config + Auto-Wait + Reporting + CI/CD).

## Inputs
- **Target Application Type**: Web UI / Mobile App (Android/iOS) / REST API / Full-stack (Web + API).
- **Tech Stack** *(Optional — tự động gợi ý nếu để trống)*:
  - Web + API (Khuyên dùng): `Playwright + TypeScript`
  - Web Enterprise Java: `Playwright + Java` hoặc `Selenium 4 + Java + TestNG`
  - Mobile Native/Hybrid: `Appium 2 + Java + Maven + TestNG`
  - API / Data-heavy: `Python + Pytest + Requests`
- **Target Directory**: Thư mục khởi tạo dự án (mặc định tạo tại thư mục hiện tại hoặc `<project-root>/automation/`).
- **Base URL / App Package** *(Optional)*: URL môi trường `dev`/`staging` hoặc `appPackage`/`bundleId`.

## Context Pointers (Lazy-Load On Demand)
- **Framework Architecture & Stack Decision Matrix**: `.claude/skills/skills-framework-architect/SKILL.md`
- **Template Index**: `.claude/skills/skills-framework-architect/references/CODE_TEMPLATES.md`
- **Stack Templates (Chỉ đọc đúng 1 file khớp với stack đã chọn)**:
  - Playwright TypeScript: `.claude/skills/skills-framework-architect/references/TEMPLATES_PLAYWRIGHT_TS.md`
  - Playwright Java: `.claude/skills/skills-framework-architect/references/TEMPLATES_PLAYWRIGHT_JAVA.md`
  - Selenium Java: `.claude/skills/skills-framework-architect/references/TEMPLATES_SELENIUM_JAVA.md`
  - Appium Java (Mobile): `.claude/skills/skills-framework-architect/references/TEMPLATES_APPIUM_JAVA.md`
  - Python Pytest & CI/CD: `.claude/skills/skills-framework-architect/references/TEMPLATES_PYTEST_AND_CICD.md`

## Browser & Execution Mode Rules
- **Default Headless Mode**: Mọi cấu hình framework Web sinh ra (`playwright.config.ts`, `DriverFactory.java`, `conftest.py`) mặc định chạy **Headless (`1920x1080`)** với cờ tắt GPU (`--disable-gpu`) để tối ưu tốc độ và chạy ngay được trên CI/CD.
- **Runtime Headed Override**: Luôn cấu hình sẵn biến môi trường / CLI flag để chuyển nhanh sang Headed Mode khi cần debug trực quan mà không phải sửa code:
  - Playwright TS: `HEADLESS=false` hoặc `npx playwright test --headed`
  - Java (Selenium/Playwright): `-Dheadless=false`
  - Pytest: `--headed` hoặc `HEADLESS=false`

## Execution Steps

### Bước 1: Tư vấn Tech Stack & Thiết kế Cấu trúc Thư mục
1. Đọc `.claude/skills/skills-framework-architect/SKILL.md` để đối chiếu yêu cầu dự án với **Stack Decision Matrix**.
2. Đề xuất kiến trúc thư mục phân tầng rõ ràng (`config/`, `pages/` hoặc `screens/`, `fixtures/` hoặc `base/`, `api/`, `utils/`, `data/`, `tests/`) cùng danh sách dependencies và cơ chế quản lý đa môi trường (`.env.example` / `config.properties`).

⏸️ **DỪNG LẠI (HITL Checkpoint)**: Trình bày Tech Stack đề xuất, cây thư mục dự kiến và danh sách các file cốt lõi sẽ khởi tạo để người dùng xác nhận trước khi ghi file.

### Bước 2: Khởi tạo Core Framework & Boilerplate
1. Chỉ đọc **đúng 1 file** `TEMPLATES_<STACK>.md` tương ứng với stack người dùng đã chốt (kèm `TEMPLATES_PYTEST_AND_CICD.md` nếu cần sinh file GitHub Actions / GitLab CI).
2. Tạo đầy đủ các file nền tảng:
   - File quản lý dependencies (`package.json` + `tsconfig.json`, `pom.xml`, hoặc `requirements.txt` + `pytest.ini`).
   - Cấu hình đa môi trường (`.env.example`, `.gitignore`) — tuyệt đối không hardcode credentials.
   - Lớp khởi tạo Driver / Config (`playwright.config.ts`, `DriverFactory.java`, `AppiumDriverManager.java`, hoặc `conftest.py`) với **Headless `1920x1080`** mặc định + hỗ trợ override sang Headed.
   - Lớp `BasePage` / `BaseScreen` / `BaseTest` tích hợp Auto-Wait, Screenshot/Trace khi fail và Parallel-safe context.
   - 1 Sample Page Object + 1 Sample Smoke Test chạy mẫu để kiểm chứng kiến trúc.

### Bước 3: Kiểm chứng & Bàn giao Hướng dẫn Chạy
- Chạy lệnh kiểm tra cú pháp / compile (`npx tsc --noEmit`, `mvn test-compile`, hoặc `pytest --collect-only`) nếu môi trường đã cài đặt sẵn runtime.
- Xuất hướng dẫn cài đặt nhanh (`README.md` ngắn gọn) gồm lệnh cài dependencies, lệnh chạy test mặc định (Headless), lệnh chạy kèm giao diện (Headed) và lệnh mở HTML/Allure report.

## Output
- Bộ khung dự án Test Automation hoàn chỉnh tại thư mục đích, sẵn sàng để chạy `/generate-automation-from-testcases`, `/generate-automation-from-ui-flow`, hoặc `/generate-automation-from-mobile-flow`.