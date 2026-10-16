# Code Templates — Appium + Java (Native Android · Native iOS · Flutter)

> **Stack:** Appium Java Client 9+ + TestNG + Allure 2 CLI cục bộ (`.allure/`).
> **Quy tắc đầy đủ:** [`.claude/rules/appium_rules.md`](../../../rules/appium_rules.md) · Recon & thu locator: [`skills-mobile-debug-agent`](../../skills-mobile-debug-agent/SKILL.md).

---

## 1. Thread-Safe Appium Driver Factory — `src/main/java/com/project/drivers/AppiumDriverFactory.java`

```java
package com.project.drivers;

import io.appium.java_client.AppiumDriver;
import io.appium.java_client.android.AndroidDriver;
import io.appium.java_client.ios.IOSDriver;
import org.openqa.selenium.remote.DesiredCapabilities;

import java.net.MalformedURLException;
import java.net.URL;

public class AppiumDriverFactory {

    private static final ThreadLocal<AppiumDriver> DRIVER = new ThreadLocal<>();

    public static AppiumDriver initDriver(String platform, String deviceKey) {
        DesiredCapabilities caps = CapabilitiesManager.load(platform, deviceKey);
        URL serverUrl = appiumServerUrl();

        AppiumDriver driver = "android".equalsIgnoreCase(platform)
                ? new AndroidDriver(serverUrl, caps)
                : new IOSDriver(serverUrl, caps);

        DRIVER.set(driver);
        return driver;
    }

    private static URL appiumServerUrl() {
        String url = System.getProperty("appium.server", "http://127.0.0.1:4723");
        try {
            return new URL(url);
        } catch (MalformedURLException e) {
            throw new IllegalStateException("Appium server URL không hợp lệ: " + url, e);
        }
    }

    public static AppiumDriver getDriver() {
        return DRIVER.get();
    }

    public static void quitDriver() {
        if (DRIVER.get() != null) {
            DRIVER.get().quit();
            DRIVER.remove();
        }
    }
}
```

## 2. Base Screen (Cross-Platform + Gestures + Flutter + Hybrid) — `BaseScreen.java`

```java
package com.project.screens;

import io.appium.java_client.AppiumBy;
import io.appium.java_client.AppiumDriver;
import io.qameta.allure.Step;
import org.openqa.selenium.By;
import org.openqa.selenium.Dimension;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.interactions.PointerInput;
import org.openqa.selenium.interactions.Sequence;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.WebDriverWait;

import java.time.Duration;
import java.util.List;
import java.util.Map;

public abstract class BaseScreen {

    protected final AppiumDriver driver;
    protected final WebDriverWait wait;

    protected BaseScreen(AppiumDriver driver) {
        this.driver = driver;
        this.wait = new WebDriverWait(driver, Duration.ofSeconds(15));
    }

    protected By byPlatform(By android, By ios) {
        return isAndroid() ? android : ios;
    }

    protected boolean isAndroid() {
        return "android".equalsIgnoreCase(
                String.valueOf(driver.getCapabilities().getCapability("platformName")));
    }

    protected WebElement waitForVisible(By locator) {
        return wait.until(ExpectedConditions.visibilityOfElementLocated(locator));
    }

    protected void tap(By locator) {
        wait.until(ExpectedConditions.elementToBeClickable(locator)).click();
    }

    protected void type(By locator, String value) {
        WebElement element = waitForVisible(locator);
        element.clear();
        element.sendKeys(value);
    }

    @Step("Cuộn tới element {textOrLabel}")
    protected void scrollToElement(String textOrLabel) {
        if (isAndroid()) {
            driver.findElement(AppiumBy.androidUIAutomator(
                    "new UiScrollable(new UiSelector().scrollable(true))"
                  + ".scrollIntoView(new UiSelector().description(\"" + textOrLabel + "\"))"));
        } else {
            driver.executeScript("mobile: scroll", Map.of(
                    "direction", "down",
                    "predicateString", "name == '" + textOrLabel + "'"));
        }
    }

    @Step("Cuộn tới mục {label} trong danh sách Flutter")
    protected void scrollToInFlutterList(String label) {
        By target = AppiumBy.accessibilityId(label);
        for (int i = 0; i < 10 && driver.findElements(target).isEmpty(); i++) {
            swipeUp();
        }
        waitForVisible(target);
    }

    @Step("Vuốt lên")
    protected void swipeUp() {
        Dimension size = driver.manage().window().getSize();
        int startY = (int) (size.height * 0.7);
        int endY   = (int) (size.height * 0.3);
        int x      = size.width / 2;

        PointerInput finger = new PointerInput(PointerInput.Kind.TOUCH, "finger");
        Sequence swipe = new Sequence(finger, 1)
                .addAction(finger.createPointerMove(Duration.ZERO, PointerInput.Origin.viewport(), x, startY))
                .addAction(finger.createPointerDown(PointerInput.MouseButton.LEFT.asArg()))
                .addAction(finger.createPointerMove(Duration.ofMillis(600), PointerInput.Origin.viewport(), x, endY))
                .addAction(finger.createPointerUp(PointerInput.MouseButton.LEFT.asArg()));

        driver.perform(List.of(swipe));
    }

    @Step("Thao tác trong WebView")
    protected void inWebView(Runnable actions) {
        String original = driver.getContext();
        String webview = driver.getContextHandles().stream()
                .filter(c -> c.startsWith("WEBVIEW"))
                .findFirst()
                .orElseThrow(() -> new IllegalStateException("Không tìm thấy WEBVIEW context"));
        driver.context(webview);
        try {
            actions.run();
        } finally {
            driver.context(original);
        }
    }
}
```

## 3. Capabilities Matrix — `capabilities/devices.json`

```json
{
  "android_native": {
    "platformName": "Android",
    "appium:automationName": "UiAutomator2",
    "appium:deviceName": "Pixel_7",
    "appium:udid": "emulator-5554",
    "appium:systemPort": 8201,
    "appium:appPackage": "com.application.xyz",
    "appium:appActivity": "com.application.xyz.MainActivity",
    "appium:autoGrantPermissions": true,
    "appium:newCommandTimeout": 120
  },
  "ios_native": {
    "platformName": "iOS",
    "appium:automationName": "XCUITest",
    "appium:deviceName": "iPhone 15",
    "appium:platformVersion": "17.5",
    "appium:udid": "auto",
    "appium:wdaLocalPort": 8101,
    "appium:bundleId": "com.application.xyz",
    "appium:autoAcceptAlerts": true,
    "appium:newCommandTimeout": 120
  },
  "flutter_android": {
    "_comment": "Đường A — semantics + UiAutomator2. Chạy được cả bản RELEASE",
    "platformName": "Android",
    "appium:automationName": "UiAutomator2",
    "appium:deviceName": "Pixel_7",
    "appium:systemPort": 8203,
    "appium:appPackage": "com.application.flutter",
    "appium:appActivity": ".MainActivity",
    "appium:autoGrantPermissions": true
  },
  "flutter_ios": {
    "_comment": "Đường A — semantics + XCUITest",
    "platformName": "iOS",
    "appium:automationName": "XCUITest",
    "appium:deviceName": "iPhone 15",
    "appium:wdaLocalPort": 8103,
    "appium:bundleId": "com.application.flutter",
    "appium:autoAcceptAlerts": true
  }
}
```

## 4. Screen Object & Multi-Device Parallel (`testng.xml`)

```java
package com.project.screens;

import io.appium.java_client.AppiumBy;
import io.appium.java_client.AppiumDriver;
import io.qameta.allure.Step;
import org.openqa.selenium.By;

public class LoginScreen extends BaseScreen {

    private final By emailInput = byPlatform(
            AppiumBy.accessibilityId("email_input"),
            AppiumBy.accessibilityId("email_input"));
    private final By passwordInput = byPlatform(
            AppiumBy.accessibilityId("password_input"),
            AppiumBy.accessibilityId("password_input"));
    private final By loginButton = byPlatform(
            AppiumBy.id("com.application.xyz:id/btn_login"),
            AppiumBy.iOSNsPredicateString("type == 'XCUIElementTypeButton' AND name == 'btn_login'"));

    public LoginScreen(AppiumDriver driver) {
        super(driver);
    }

    @Step("Đăng nhập bằng tài khoản {email}")
    public HomeScreen login(String email, String password) {
        type(emailInput, email);
        type(passwordInput, password);
        tap(loginButton);
        return new HomeScreen(driver);
    }
}
```

```xml
<!-- testng.xml — thread-count = số device thật đang kết nối, mỗi device 1 systemPort/wdaLocalPort riêng -->
<suite name="Mobile Suite" parallel="tests" thread-count="2">
  <test name="Pixel_7">
    <parameter name="deviceName" value="Pixel_7"/>
    <parameter name="udid"       value="emulator-5554"/>
    <parameter name="systemPort" value="8201"/>
    <classes><class name="com.project.tests.LoginMobileTest"/></classes>
  </test>
  <test name="Pixel_8">
    <parameter name="deviceName" value="Pixel_8"/>
    <parameter name="udid"       value="emulator-5556"/>
    <parameter name="systemPort" value="8202"/>
    <classes><class name="com.project.tests.LoginMobileTest"/></classes>
  </test>
</suite>
```
