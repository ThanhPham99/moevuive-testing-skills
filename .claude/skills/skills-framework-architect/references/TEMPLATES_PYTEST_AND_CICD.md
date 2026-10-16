# Code Templates — Playwright + Python (Pytest) & CI/CD Workflows

> **Stack:** Playwright + Python (`pytest`, `pytest-xdist`, `allure-pytest`, local `allure` Node CLI) + GitHub Actions CI/CD.
> **Browser Execution Mode:** Mặc định `HEADLESS=true` (`1920x1080`, `--disable-gpu`). Bật **Headed Mode** tức thì khi chạy lệnh: `HEADLESS=false pytest`.

---

## 1. Pytest Fixtures & Allure Screenshot Hook — `conftest.py`

```python
import os
from pathlib import Path
import allure
import pytest
from dotenv import load_dotenv
from playwright.sync_api import Browser, Page, Playwright, sync_playwright

load_dotenv()
VIDEO_MODE = os.getenv("VIDEO_MODE", "retain-on-failure").lower()


@pytest.fixture(scope="session")
def playwright_instance() -> Playwright:
    with sync_playwright() as p:
        yield p


@pytest.fixture(scope="session")
def browser(playwright_instance: Playwright) -> Browser:
    # Mặc định Headless Mode (1920x1080, tắt GPU). Override: HEADLESS=false pytest (1600x750)
    headless = os.getenv("HEADLESS", "true").lower() != "false"
    launch_args = (
        ["--disable-gpu", "--disable-dev-shm-usage", "--no-sandbox"]
        if headless
        else ["--window-position=0,0"]
    )
    browser = playwright_instance.chromium.launch(headless=headless, args=launch_args)
    yield browser
    browser.close()


@pytest.fixture
def page(browser: Browser, request) -> Page:
    headless = os.getenv("HEADLESS", "true").lower() != "false"
    size = {"width": 1920, "height": 1080} if headless else {"width": 1600, "height": 750}
    ctx_kwargs = {"viewport": size}
    if VIDEO_MODE != "off":
        ctx_kwargs["record_video_dir"] = "reports/videos"
        ctx_kwargs["record_video_size"] = size
    context = browser.new_context(**ctx_kwargs)
    page = context.new_page()
    page.goto(os.environ["BASE_URL"])
    yield page
    video_path = Path(page.video.path()) if page.video else None
    context.close()

    rep_call = getattr(request.node, "rep_call", None)
    passed = bool(rep_call and rep_call.passed)
    if video_path and video_path.exists():
        if (not passed and VIDEO_MODE != "off") or (passed and VIDEO_MODE == "on"):
            v_name = "video_bang_chung_pass" if passed else "video_khi_that_bai"
            allure.attach.file(str(video_path), name=v_name, attachment_type=allure.attachment_type.WEBM)
        elif passed and VIDEO_MODE == "retain-on-failure":
            video_path.unlink(missing_ok=True)


@pytest.hookimpl(hookwrapper=True, tryfirst=True)
def pytest_runtest_makereport(item, call):
    """Đính ảnh trạng thái cuối (PASS: viewport nhanh; FAIL: fullPage) và lưu vào reports/screenshots/."""
    outcome = yield
    report = outcome.get_result()
    setattr(item, f"rep_{report.when}", report)

    if report.when != "call":
        return

    page = item.funcargs.get("page")
    if page is None:
        return

    shots_dir = Path("reports/screenshots")
    shots_dir.mkdir(parents=True, exist_ok=True)
    suffix = "pass" if report.passed else "fail"
    shot_file = shots_dir / f"{item.name}_{suffix}.png"
    png = page.screenshot(path=str(shot_file), full_page=not report.passed)

    name = "trang_thai_cuoi_cua_test" if report.passed else "trang_thai_khi_that_bai"
    allure.attach(png, name=name, attachment_type=allure.attachment_type.PNG)
```

## 2. Base Page, POM (`@allure.step`) & Test Spec

```python
# src/pages/base_page.py
from playwright.sync_api import Locator, Page, expect


class BasePage:
    def __init__(self, page: Page) -> None:
        self.page = page

    def goto(self, path: str = "") -> None:
        self.page.goto(path)
        self.page.wait_for_load_state("domcontentloaded")

    def click(self, locator: Locator) -> None:
        expect(locator).to_be_enabled()
        locator.click()

    def fill(self, locator: Locator, value: str) -> None:
        expect(locator).to_be_visible()
        locator.fill(value)

    def get_text(self, locator: Locator) -> str:
        expect(locator).to_be_visible()
        return locator.inner_text()
```

```python
# src/pages/login_page.py
import allure
from src.pages.base_page import BasePage


class LoginPage(BasePage):
    def __init__(self, page):
        super().__init__(page)
        self.email_input = page.get_by_label("Email")
        self.password_input = page.get_by_label("Mật khẩu")
        self.submit_button = page.get_by_role("button", name="Đăng nhập")

    @allure.step("Nhập email: {email}")
    def enter_email(self, email: str) -> None:
        self.fill(self.email_input, email)

    @allure.step("Nhập mật khẩu")
    def enter_password(self, password: str) -> None:
        self.fill(self.password_input, password)

    @allure.step("Bấm nút Đăng nhập")
    def submit(self) -> None:
        self.click(self.submit_button)

    def login(self, email: str, password: str) -> None:
        self.enter_email(email)
        self.enter_password(password)
        self.submit()
```

```python
# src/tests/test_login.py
import allure
from src.pages.login_page import LoginPage
from src.pages.dashboard_page import DashboardPage


@allure.feature("Đăng nhập")
class TestLogin:

    @allure.title("Đăng nhập thành công với tài khoản admin hợp lệ")
    @allure.description(
        "Kiểm tra người dùng đăng nhập bằng email và mật khẩu hợp lệ "
        "thì được chuyển vào Dashboard và thấy menu điều hướng."
    )
    @allure.severity(allure.severity_level.BLOCKER)
    @allure.tag("smoke", "login")
    @allure.label("testId", "CRM_LOGIN_TC_001")
    def test_login_with_valid_credentials(self, page, config):
        login_page = LoginPage(page)
        dashboard_page = DashboardPage(page)

        with allure.step("Arrange: Mở trang Login"):
            login_page.goto("/login")
        with allure.step("Act: Đăng nhập bằng tài khoản admin"):
            login_page.login(config.username, config.password)
        with allure.step("Assert: Hệ thống chuyển vào Dashboard"):
            assert dashboard_page.is_navigation_visible(), \
                "Menu điều hướng phải hiển thị sau khi đăng nhập thành công"
```

## 3. Pytest Parallel Configuration (`pyproject.toml`) & Local Allure CLI (`package.json`)

```toml
[tool.pytest.ini_options]
addopts = """
    --alluredir=reports/allure-results
    --allure-no-capture
    --html=reports/html/index.html
    --self-contained-html
    -n 5
    -v
"""
testpaths = ["src/tests"]
log_file = "reports/logs/pytest.log"
log_file_level = "INFO"
```

```json
{
  "name": "pytest-allure-cli",
  "private": true,
  "scripts": {
    "report": "allure generate reports/allure-results && allure open reports/allure-report"
  },
  "devDependencies": {
    "allure": "^3.15.0"
  }
}
```

---

## 4. CI/CD — GitHub Actions Workflows

### 4.1 Playwright + TypeScript — `.github/workflows/playwright.yml`

```yaml
name: Playwright Tests

on:
  push:
    branches: [main]
  pull_request:
  workflow_dispatch:

env:
  WORKERS: 5

jobs:
  test:
    runs-on: ubuntu-latest
    timeout-minutes: 30
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - name: Run tests (Headless 1920x1080)
        env:
          BASE_URL: ${{ secrets.BASE_URL }}
          TEST_USERNAME: ${{ secrets.TEST_USERNAME }}
          TEST_PASSWORD: ${{ secrets.TEST_PASSWORD }}
          HEADLESS: 'true'
        run: npx playwright test
      - name: Sinh Allure report
        if: always()
        run: npx allure generate reports/allure-results
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: test-reports
          path: reports/
          retention-days: 14
```

### 4.2 Java (Selenium / Playwright Java) — `.github/workflows/java-tests.yml`

```yaml
name: Java Automation Tests

on:
  push:
    branches: [main]
  pull_request:
  workflow_dispatch:

jobs:
  test:
    runs-on: ubuntu-latest
    timeout-minutes: 40
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-java@v4
        with:
          distribution: temurin
          java-version: '17'
          cache: maven
      - name: Run tests (Headless 1920x1080)
        env:
          BASE_URL: ${{ secrets.BASE_URL }}
          TEST_USERNAME: ${{ secrets.TEST_USERNAME }}
          TEST_PASSWORD: ${{ secrets.TEST_PASSWORD }}
        run: mvn clean test -Dheadless=true
      - name: Sinh Allure report
        if: always()
        run: mvn allure:report
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: test-reports
          path: reports/
          retention-days: 14
```
