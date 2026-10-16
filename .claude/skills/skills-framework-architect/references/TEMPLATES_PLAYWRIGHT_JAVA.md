# Code Templates — Playwright + Java (Maven + TestNG)

> **Stack:** Playwright Java + TestNG + Allure 2 CLI giải nén cục bộ vào `.allure/`.
> **Browser Execution Mode:** Mặc định `headless=true` (`1920x1080`, `--disable-gpu`). Bật **Headed Mode** tức thì khi chạy lệnh: `mvn test -Dheadless=false`.

---

## 1. Thread-Safe Browser Factory — `src/main/java/com/project/factory/PlaywrightFactory.java`

```java
package com.project.factory;

import com.microsoft.playwright.*;
import com.project.config.ConfigReader;
import java.util.List;

/**
 * Playwright objects KHÔNG thread-safe — mỗi thread giữ instance riêng
 * để TestNG chạy parallel (mặc định 5 luồng) không giẫm chân nhau.
 */
public class PlaywrightFactory {

    private static final ThreadLocal<Playwright> PLAYWRIGHT = new ThreadLocal<>();
    private static final ThreadLocal<Browser> BROWSER = new ThreadLocal<>();
    private static final ThreadLocal<BrowserContext> CONTEXT = new ThreadLocal<>();
    private static final ThreadLocal<Page> PAGE = new ThreadLocal<>();

    public Page initBrowser() {
        ConfigReader config = ConfigReader.getInstance();
        boolean headless = config.isHeadless();

        PLAYWRIGHT.set(Playwright.create());
        int width = headless ? 1920 : 1600;
        int height = headless ? 1080 : 750;
        BrowserType.LaunchOptions launchOptions = new BrowserType.LaunchOptions()
                .setHeadless(headless)
                .setArgs(headless
                        ? List.of("--disable-gpu", "--disable-dev-shm-usage", "--no-sandbox")
                        : List.of("--window-position=0,0"));
        BROWSER.set(PLAYWRIGHT.get().chromium().launch(launchOptions));

        Browser.NewContextOptions contextOptions = new Browser.NewContextOptions()
                .setViewportSize(width, height);
        if (!"off".equalsIgnoreCase(config.getVideoMode())) {
            contextOptions.setRecordVideoDir(java.nio.file.Paths.get("reports/videos"))
                          .setRecordVideoSize(width, height);
        }
        CONTEXT.set(BROWSER.get().newContext(contextOptions));

        PAGE.set(CONTEXT.get().newPage());
        PAGE.get().navigate(config.getBaseUrl());
        return PAGE.get();
    }

    public static Page getPage() {
        return PAGE.get();
    }

    public void closeBrowser() {
        if (PAGE.get() != null)       { PAGE.get().close();       PAGE.remove(); }
        if (CONTEXT.get() != null)    { CONTEXT.get().close();    CONTEXT.remove(); }
        if (BROWSER.get() != null)    { BROWSER.get().close();    BROWSER.remove(); }
        if (PLAYWRIGHT.get() != null) { PLAYWRIGHT.get().close(); PLAYWRIGHT.remove(); }
    }
}
```

## 2. Config Reader — `src/main/java/com/project/config/ConfigReader.java`

```java
package com.project.config;

import java.io.IOException;
import java.io.InputStream;
import java.util.Properties;

/** Singleton đọc config.properties, cho phép override bằng system property (-Dheadless=false). */
public class ConfigReader {

    private static ConfigReader instance;
    private final Properties properties = new Properties();

    private ConfigReader() {
        try (InputStream input = getClass().getClassLoader()
                .getResourceAsStream("config.properties")) {
            if (input == null) {
                throw new IllegalStateException("Không tìm thấy config.properties trong classpath");
            }
            properties.load(input);
        } catch (IOException e) {
            throw new IllegalStateException("Không đọc được config.properties", e);
        }
    }

    public static synchronized ConfigReader getInstance() {
        if (instance == null) {
            instance = new ConfigReader();
        }
        return instance;
    }

    public String get(String key, String defaultValue) {
        return System.getProperty(key, properties.getProperty(key, defaultValue));
    }

    public String getBaseUrl()   { return get("base.url", ""); }
    /** Mặc định headless=true. Bật headed: mvn test -Dheadless=false */
    public boolean isHeadless()  { return !"false".equalsIgnoreCase(get("headless", "true")); }
    /** VIDEO_MODE: retain-on-failure (mặc định) | on | off */
    public String getVideoMode() {
        String envMode = System.getenv("VIDEO_MODE");
        return get("video.mode", envMode != null ? envMode : "retain-on-failure");
    }
    public int getTimeout()      { return Integer.parseInt(get("timeout", "30")); }
}
```

## 3. Base Page — `src/main/java/com/project/pages/BasePage.java`

```java
package com.project.pages;

import com.microsoft.playwright.Locator;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.options.WaitForSelectorState;

public abstract class BasePage {

    protected final Page page;

    protected BasePage(Page page) {
        this.page = page;
    }

    protected void click(Locator locator) {
        locator.waitFor(new Locator.WaitForOptions().setState(WaitForSelectorState.VISIBLE));
        locator.click();
    }

    protected void fill(Locator locator, String value) {
        locator.waitFor(new Locator.WaitForOptions().setState(WaitForSelectorState.VISIBLE));
        locator.fill(value);
    }

    protected String getText(Locator locator) {
        locator.waitFor(new Locator.WaitForOptions().setState(WaitForSelectorState.VISIBLE));
        return locator.textContent();
    }

    public String getCurrentUrl() {
        return page.url();
    }
}
```

## 4. Base Test & Evidence Utility — `BaseTest.java` & `ScreenshotUtil.java`

```java
package com.project.base;

import com.microsoft.playwright.Page;
import com.microsoft.playwright.Video;
import com.project.config.ConfigReader;
import com.project.factory.PlaywrightFactory;
import com.project.utils.ScreenshotUtil;
import org.testng.ITestResult;
import org.testng.annotations.AfterMethod;
import org.testng.annotations.BeforeMethod;
import java.nio.file.Path;

public abstract class BaseTest {

    protected PlaywrightFactory factory;
    protected Page page;

    @BeforeMethod(alwaysRun = true)
    public void setUp() {
        factory = new PlaywrightFactory();
        page = factory.initBrowser();
    }

    @AfterMethod(alwaysRun = true)
    public void tearDown(ITestResult result) {
        boolean passed = result.isSuccess();
        ScreenshotUtil.captureAndAttach(page, result.getMethod().getMethodName(), passed);
        Video video = page != null ? page.video() : null;
        Path videoPath = video != null ? video.path() : null;
        factory.closeBrowser();
        ScreenshotUtil.handleVideo(videoPath, ConfigReader.getInstance().getVideoMode(), passed);
    }
}
```

```java
package com.project.utils;

import com.microsoft.playwright.Page;
import io.qameta.allure.Allure;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;

public final class ScreenshotUtil {
    private ScreenshotUtil() {}

    public static void captureAndAttach(Page page, String testName, boolean passed) {
        if (page == null) return;
        String attachName = passed ? "trang_thai_cuoi_cua_test" : "trang_thai_khi_that_bai";
        Path shotPath = Paths.get("reports/screenshots", testName + (passed ? "_pass.png" : "_fail.png"));
        // PASS: chụp viewport nhanh; FAIL: chụp fullPage toàn trang
        byte[] png = page.screenshot(new Page.ScreenshotOptions().setPath(shotPath).setFullPage(!passed));
        Allure.addAttachment(attachName, "image/png", new ByteArrayInputStream(png), ".png");
    }

    public static void handleVideo(Path videoPath, String videoMode, boolean passed) {
        if (videoPath == null || !Files.exists(videoPath)) return;
        try {
            if ((!passed && !"off".equalsIgnoreCase(videoMode)) || (passed && "on".equalsIgnoreCase(videoMode))) {
                String attachName = passed ? "video_bang_chung_pass" : "video_khi_that_bai";
                Allure.addAttachment(attachName, "video/webm", Files.newInputStream(videoPath), ".webm");
            } else if (passed && "retain-on-failure".equalsIgnoreCase(videoMode)) {
                Files.deleteIfExists(videoPath);
            }
        } catch (IOException ignored) {}
    }
}
```

## 5. Parallel Suite (`testng.xml`) & Local Allure CLI (`pom.xml`)

```xml
<!-- testng.xml — NGUỒN DUY NHẤT của số luồng (mặc định 5) -->
<!DOCTYPE suite SYSTEM "https://testng.org/testng-1.0.dtd">
<suite name="Automation Suite" parallel="methods" thread-count="5" data-provider-thread-count="5">
  <listeners>
    <listener class-name="io.qameta.allure.testng.AllureTestNg"/>
  </listeners>
  <test name="Regression">
    <packages>
      <package name="com.project.tests.*"/>
    </packages>
  </test>
</suite>
```

```xml
<!-- pom.xml — trích đoạn cấu hình Surefire + giải nén Allure 2 CLI vào .allure/ -->
<properties>
  <allure.cli.version>2.45.0</allure.cli.version>
  <allure.home>${project.basedir}/.allure</allure.home>
</properties>

<build>
  <plugins>
    <plugin>
      <groupId>org.apache.maven.plugins</groupId>
      <artifactId>maven-surefire-plugin</artifactId>
      <version>3.2.5</version>
      <configuration>
        <suiteXmlFiles><suiteXmlFile>testng.xml</suiteXmlFile></suiteXmlFiles>
        <reportsDirectory>${project.basedir}/reports/surefire</reportsDirectory>
        <systemPropertyVariables>
          <allure.results.directory>${project.basedir}/reports/allure-results</allure.results.directory>
        </systemPropertyVariables>
      </configuration>
    </plugin>
    <plugin>
      <groupId>org.apache.maven.plugins</groupId>
      <artifactId>maven-dependency-plugin</artifactId>
      <version>3.8.1</version>
      <executions>
        <execution>
          <id>unpack-allure-cli</id>
          <phase>validate</phase>
          <goals><goal>unpack</goal></goals>
          <configuration>
            <artifactItems>
              <artifactItem>
                <groupId>io.qameta.allure</groupId>
                <artifactId>allure-commandline</artifactId>
                <version>${allure.cli.version}</version>
                <type>zip</type>
                <outputDirectory>${allure.home}</outputDirectory>
              </artifactItem>
            </artifactItems>
            <markersDirectory>${allure.home}/.markers</markersDirectory>
          </configuration>
        </execution>
      </executions>
    </plugin>
    <plugin>
      <groupId>io.qameta.allure</groupId>
      <artifactId>allure-maven</artifactId>
      <version>2.15.2</version>
      <configuration>
        <reportVersion>${allure.cli.version}</reportVersion>
        <installDirectory>${allure.home}</installDirectory>
        <resultsDirectory>${project.basedir}/reports/allure-results</resultsDirectory>
        <reportDirectory>${project.basedir}/reports/allure-report</reportDirectory>
      </configuration>
    </plugin>
  </plugins>
</build>
```
