# Code Templates — Playwright + TypeScript

> **Stack:** Playwright + TypeScript (`@playwright/test`, `allure-playwright`, `allure` CLI local).
> **Browser Execution Mode:** Mặc định `HEADLESS=true` (`1920x1080`, `--disable-gpu`). Bật **Headed Mode** tức thì khi chạy lệnh: `HEADLESS=false npx playwright test` hoặc `npx playwright test --headed`.

---

## 1. Environment Configuration — `src/utils/env.config.ts`

```typescript
import * as dotenv from 'dotenv';

dotenv.config();

function required(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Thiếu biến môi trường bắt buộc: ${key}. Kiểm tra file .env`);
  }
  return value;
}

export const env = {
  baseURL: required('BASE_URL'),
  username: required('TEST_USERNAME'),
  password: required('TEST_PASSWORD'),
  // Mặc định HEADLESS=true (1920x1080). Ghi đè: HEADLESS=false npx playwright test (1600x750)
  headless: process.env.HEADLESS !== 'false',
  // Mặc định retain-on-failure. Ghi đè: VIDEO_MODE=on|off npx playwright test
  videoMode: (process.env.VIDEO_MODE || 'retain-on-failure') as 'retain-on-failure' | 'on' | 'off',
  timeout: Number(process.env.TIMEOUT ?? 30_000),
} as const;
```

## 2. Runner Configuration — `playwright.config.ts`

```typescript
import { defineConfig, devices } from '@playwright/test';
import { env } from './src/utils/env.config';

const viewport = env.headless ? { width: 1920, height: 1080 } : { width: 1600, height: 750 };

export default defineConfig({
  testDir: './src/tests',
  timeout: env.timeout,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  // Parallel LUÔN bật (mặc định 5 luồng) — đổi số luồng ở .env (WORKERS)
  workers: Number(process.env.WORKERS ?? 5),
  // Mọi output gom vào reports/ — xem .claude/rules/reporting_rules.md
  outputDir: 'reports/test-artifacts',
  reporter: [
    ['html', { outputFolder: 'reports/html', open: 'never' }],
    ['list'],
    ['allure-playwright', { resultsDir: 'reports/allure-results' }],
  ],
  use: {
    baseURL: env.baseURL,
    headless: env.headless,
    viewport,
    launchOptions: {
      args: env.headless
        ? ['--disable-gpu', '--disable-dev-shm-usage', '--no-sandbox']
        : ['--window-position=0,0'],
    },
    // 'off' vì ảnh được attach thủ công ở afterEach cho CẢ pass lẫn fail
    screenshot: 'off',
    video: env.videoMode,
    trace: 'retain-on-failure',
    actionTimeout: 15_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], viewport },
    },
  ],
});
```

## 3. Base Page — `src/pages/base.page.ts`

```typescript
import { Page, Locator, expect } from '@playwright/test';

export abstract class BasePage {
  constructor(protected readonly page: Page) {}

  async goto(path = ''): Promise<void> {
    await this.page.goto(path);
    await this.page.waitForLoadState('domcontentloaded');
  }

  protected async clickWhenReady(locator: Locator): Promise<void> {
    await expect(locator).toBeEnabled();
    await locator.click();
  }

  protected async fillField(locator: Locator, value: string): Promise<void> {
    await expect(locator).toBeVisible();
    await locator.fill(value);
  }

  protected async isVisible(locator: Locator): Promise<boolean> {
    return locator.isVisible();
  }

  async waitForUrl(pattern: RegExp): Promise<void> {
    await expect(this.page).toHaveURL(pattern);
  }
}
```

## 4. Custom Fixtures — `src/fixtures/base.fixture.ts`

```typescript
import { test as base } from '@playwright/test';
import { LoginPage } from '../pages/login.page';
import { DashboardPage } from '../pages/dashboard.page';

type Pages = {
  loginPage: LoginPage;
  dashboardPage: DashboardPage;
};

export const test = base.extend<Pages>({
  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page));
  },
  dashboardPage: async ({ page }, use) => {
    await use(new DashboardPage(page));
  },
});

export { expect } from '@playwright/test';
```

## 5. Unique Test Data Helper — `src/utils/test-data.ts`

```typescript
export class TestData {
  private static stamp(): string {
    return `${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  }

  static email(testName: string): string {
    return `auto_${testName}_${this.stamp()}@auto.test`;
  }

  static username(testName: string): string {
    return `auto_${testName}_${this.stamp()}`;
  }

  static code(prefix: string): string {
    return `${prefix}_${this.stamp()}`;
  }
}
```

## 6. Page Object + Allure Sub-steps — `src/pages/login.page.ts`

```typescript
import { test } from '@playwright/test';
import { BasePage } from './base.page';

export class LoginPage extends BasePage {
  readonly emailInput = this.page.getByLabel('Email');
  readonly passwordInput = this.page.getByLabel('Mật khẩu');
  readonly submitButton = this.page.getByRole('button', { name: 'Đăng nhập' });

  async login(email: string, password: string): Promise<void> {
    await test.step(`Nhập email: ${email}`, () => this.fillField(this.emailInput, email));
    await test.step('Nhập mật khẩu', () => this.fillField(this.passwordInput, password));
    await test.step('Bấm nút Đăng nhập', () => this.clickWhenReady(this.submitButton));
  }
}
```

## 7. Spec Template + Smart Screenshot & Video Attach — `src/tests/auth/login.spec.ts`

```typescript
import * as fs from 'node:fs';
import { allure } from 'allure-playwright';
import { test, expect } from '../../fixtures/base.fixture';
import { env } from '../../utils/env.config';

test.describe('Đăng nhập', () => {
  test.afterEach(async ({ page }, testInfo) => {
    const passed = testInfo.status === 'passed';
    const shotName = passed ? 'trang_thai_cuoi_cua_test' : 'trang_thai_khi_that_bai';
    const slug = testInfo.title.replace(/[^a-zA-Z0-9_-]+/g, '_');

    fs.mkdirSync('reports/screenshots', { recursive: true });
    // Tối ưu: PASS chụp viewport 1920x1080 nhanh (~50ms); FAIL chụp fullPage toàn trang
    const png = await page.screenshot({
      path: `reports/screenshots/${slug}_${passed ? 'pass' : 'fail'}.png`,
      fullPage: !passed,
    });
    await testInfo.attach(shotName, { body: png, contentType: 'image/png' });

    const video = page.video();
    if (video && ((!passed && env.videoMode !== 'off') || (passed && env.videoMode === 'on'))) {
      fs.mkdirSync('reports/videos', { recursive: true });
      const videoDest = `reports/videos/${slug}_${passed ? 'pass' : 'fail'}.webm`;
      await page.close();
      const rawVideoPath = await video.path();
      if (fs.existsSync(rawVideoPath)) {
        fs.renameSync(rawVideoPath, videoDest);
        await testInfo.attach(passed ? 'video_bang_chung_pass' : 'video_khi_that_bai', {
          path: videoDest,
          contentType: 'video/webm',
        });
      }
    }
  });

  test('Đăng nhập thành công với tài khoản admin hợp lệ', async ({ loginPage, dashboardPage }) => {
    await allure.description(
      'Kiểm tra người dùng đăng nhập bằng email và mật khẩu hợp lệ '
      + 'thì được chuyển vào Dashboard và thấy menu điều hướng.',
    );
    await allure.severity('blocker');
    await allure.tags('smoke', 'login');
    await allure.label('testId', 'CRM_LOGIN_TC_001');

    await test.step('Arrange: Mở trang Login', async () => {
      await loginPage.goto('/login');
    });

    await test.step('Act: Đăng nhập bằng tài khoản admin', async () => {
      await loginPage.login(env.username, env.password);
    });

    await test.step('Assert: Hệ thống chuyển vào Dashboard', async () => {
      await expect(dashboardPage.navigationMenu).toBeVisible();
      await dashboardPage.waitForUrl(/dashboard/);
    });
  });
});
```

## 8. Local Allure CLI Configuration — `package.json` & `allurerc.mjs`

```json
{
  "scripts": {
    "test": "playwright test",
    "test:headed": "HEADLESS=false playwright test",
    "report": "allure generate reports/allure-results && allure open reports/allure-report",
    "report:watch": "allure watch reports/allure-results"
  },
  "devDependencies": {
    "@playwright/test": "^1.56.0",
    "allure-playwright": "^3.10.2",
    "allure": "^3.15.0",
    "dotenv": "^16.4.5"
  }
}
```

```js
// allurerc.mjs
import { defineConfig } from "allure";

export default defineConfig({
  name: "Automation Report",
  output: "reports/allure-report",
  plugins: {
    awesome: {
      options: {
        singleFile: false,
        reportLanguage: "en",
      },
    },
  },
});
```
