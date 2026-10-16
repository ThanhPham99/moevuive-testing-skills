# Code Templates — Selenium + Java (Maven + TestNG)

> **Stack:** Selenium 4.6+ (Selenium Manager tự quản lý driver) + TestNG + Allure 2 CLI cục bộ (`.allure/`).
> **Browser Execution Mode:** Mặc định `headless=true` (`--headless=new`, `--window-size=1920,1080`, `--disable-gpu`). Bật **Headed Mode** tức thì khi chạy lệnh: `mvn test -Dheadless=false`.

---

## 1. Thread-Safe Driver Factory — `src/main/java/com/project/drivers/DriverFactory.java`

```java
package com.project.drivers;

import com.project.config.ConfigReader;
import org.openqa.selenium.Dimension;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.chrome.ChromeDriver;
import org.openqa.selenium.chrome.ChromeOptions;

import java.time.Duration;

public class DriverFactory {

    private static final ThreadLocal<WebDriver> DRIVER = new ThreadLocal<>();

    public static WebDriver initDriver() {
        ConfigReader config = ConfigReader.getInstance();

        ChromeOptions options = new ChromeOptions();
        boolean headless = config.isHeadless();
        int width = headless ? 1920 : 1600;
        int height = headless ? 1080 : 750;
        // Mặc định Headless Mode (1920x1080, tắt GPU). Override: mvn test -Dheadless=false (1600x750)
        if (headless) {
            options.addArguments("--headless=new", "--disable-gpu", "--disable-dev-shm-usage", "--no-sandbox");
        } else {
            options.addArguments("--window-position=0,0");
        }
        options.addArguments("--window-size=" + width + "," + height);

        // Selenium 4.6+ tự quản lý driver binary — không cần WebDriverManager
        WebDriver driver = new ChromeDriver(options);
        driver.manage().window().setSize(new Dimension(width, height));
        driver.manage().timeouts().pageLoadTimeout(Duration.ofSeconds(config.getTimeout()));

        DRIVER.set(driver);
        return driver;
    }

    public static WebDriver getDriver() {
        return DRIVER.get();
    }

    public static void quitDriver() {
        if (DRIVER.get() != null) {
            DRIVER.get().quit();
            DRIVER.remove(); // BẮT BUỘC — tránh rò rỉ sang thread khác khi chạy parallel
        }
    }
}
```

## 2. Base Page — `src/main/java/com/project/pages/BasePage.java`

```java
package com.project.pages;

import com.project.config.ConfigReader;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.WebDriverWait;

import java.time.Duration;

public abstract class BasePage {

    protected final WebDriver driver;
    protected final WebDriverWait wait;

    protected BasePage(WebDriver driver) {
        this.driver = driver;
        this.wait = new WebDriverWait(driver,
                Duration.ofSeconds(ConfigReader.getInstance().getTimeout()));
    }

    protected WebElement waitForVisible(By locator) {
        return wait.until(ExpectedConditions.visibilityOfElementLocated(locator));
    }

    protected void click(By locator) {
        wait.until(ExpectedConditions.elementToBeClickable(locator)).click();
    }

    protected void type(By locator, String value) {
        WebElement element = waitForVisible(locator);
        element.clear();
        element.sendKeys(value);
    }

    protected String getText(By locator) {
        return waitForVisible(locator).getText();
    }

    protected boolean isDisplayed(By locator) {
        try {
            return waitForVisible(locator).isDisplayed();
        } catch (org.openqa.selenium.TimeoutException e) {
            return false;
        }
    }

    protected void waitForUrlContains(String fragment) {
        wait.until(ExpectedConditions.urlContains(fragment));
    }
}
```

## 3. Page Object (`@Step`) & Test Class (`LoginTest.java`)

```java
package com.project.pages;

import io.qameta.allure.Step;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;

public class LoginPage extends BasePage {

    private static final By EMAIL_INPUT = By.id("email");
    private static final By PASSWORD_INPUT = By.id("password");
    private static final By SUBMIT_BUTTON = By.cssSelector("button[type='submit']");

    public LoginPage(WebDriver driver) {
        super(driver);
    }

    @Step("Nhập email: {email}")
    public void enterEmail(String email) {
        type(EMAIL_INPUT, email);
    }

    @Step("Nhập mật khẩu")
    public void enterPassword(String password) {
        type(PASSWORD_INPUT, password);
    }

    @Step("Bấm nút Đăng nhập")
    public void submit() {
        click(SUBMIT_BUTTON);
    }

    public void login(String email, String password) {
        enterEmail(email);
        enterPassword(password);
        submit();
    }
}
```

```java
package com.project.tests;

import com.project.base.BaseTest;
import com.project.pages.DashboardPage;
import com.project.pages.LoginPage;
import io.qameta.allure.*;
import org.testng.Assert;
import org.testng.annotations.Test;

@Feature("Đăng nhập")
public class LoginTest extends BaseTest {

    @Test(groups = {"smoke", "login"}, description = "Đăng nhập thành công với tài khoản admin hợp lệ")
    @Severity(SeverityLevel.BLOCKER)
    @Description("Kiểm tra người dùng đăng nhập bằng email và mật khẩu hợp lệ "
            + "thì được chuyển vào Dashboard và thấy menu điều hướng.")
    public void testLoginWithValidCredentials() {
        Allure.label("testId", "CRM_LOGIN_TC_001");

        LoginPage loginPage = new LoginPage(DriverFactory.getDriver());
        DashboardPage dashboardPage = new DashboardPage(DriverFactory.getDriver());

        Allure.step("Arrange: Mở trang Login", () -> loginPage.open());
        Allure.step("Act: Đăng nhập bằng tài khoản admin",
                () -> loginPage.login(config.getUsername(), config.getPassword()));
        Allure.step("Assert: Hệ thống chuyển vào Dashboard", () ->
                Assert.assertTrue(dashboardPage.isNavigationDisplayed(),
                        "Menu điều hướng phải hiển thị sau khi đăng nhập thành công"));
    }
}
```

## 4. Base Test, Smart Screenshot (`fullPage: !passed`) & Unique Test Data Utilities

```java
package com.project.base;

import com.project.drivers.DriverFactory;
import com.project.utils.ScreenshotUtil;
import org.testng.ITestResult;
import org.testng.annotations.AfterMethod;
import org.testng.annotations.BeforeMethod;

public abstract class BaseTest {

    @BeforeMethod(alwaysRun = true)
    public void setUp() {
        DriverFactory.initDriver();
    }

    @AfterMethod(alwaysRun = true)
    public void tearDown(ITestResult result) {
        ScreenshotUtil.captureAndAttach(
                DriverFactory.getDriver(),
                result.getMethod().getMethodName(),
                result.isSuccess());
        DriverFactory.quitDriver();
    }
}
```

```java
package com.project.utils;

import io.qameta.allure.Allure;
import org.openqa.selenium.OutputType;
import org.openqa.selenium.TakesScreenshot;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.chromium.HasCdp;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Base64;
import java.util.Map;

public final class ScreenshotUtil {
    private ScreenshotUtil() {}

    public static void captureAndAttach(WebDriver driver, String testName, boolean passed) {
        if (driver == null) return;
        boolean fullPage = !passed;
        byte[] png = (fullPage && driver instanceof HasCdp cdp)
                ? Base64.getDecoder().decode((String) cdp.executeCdpCommand(
                        "Page.captureScreenshot", Map.of("captureBeyondViewport", true)).get("data"))
                : ((TakesScreenshot) driver).getScreenshotAs(OutputType.BYTES);
        String attachName = passed ? "trang_thai_cuoi_cua_test" : "trang_thai_khi_that_bai";
        try {
            Path out = Paths.get("reports/screenshots", testName + (passed ? "_pass.png" : "_fail.png"));
            Files.createDirectories(out.getParent());
            Files.write(out, png);
        } catch (IOException ignored) {}
        Allure.addAttachment(attachName, "image/png", new ByteArrayInputStream(png), ".png");
    }
}
```

```java
package com.project.utils;

import java.util.concurrent.ThreadLocalRandom;

public final class TestDataGenerator {
    private TestDataGenerator() {}

    private static String stamp() {
        return System.currentTimeMillis() + "_" + ThreadLocalRandom.current().nextInt(1000);
    }
    public static String email(String testName) { return String.format("auto_%s_%s@auto.test", testName, stamp()); }
    public static String username(String testName) { return String.format("auto_%s_%s", testName, stamp()); }
    public static String code(String prefix) { return String.format("%s_%s", prefix, stamp()); }
}
```

> Cấu hình `ConfigReader.java`, `testng.xml` (`parallel="methods" thread-count="5"`) và giải nén Allure 2 CLI vào `.allure/` trong `pom.xml` dùng chung với [`TEMPLATES_PLAYWRIGHT_JAVA.md`](TEMPLATES_PLAYWRIGHT_JAVA.md) § 2 & § 5.
