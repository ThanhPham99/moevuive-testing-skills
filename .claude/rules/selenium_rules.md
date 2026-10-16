# Quy Tắc Dành Riêng Cho Selenium WebDriver

> Áp dụng khi tự động hóa browser với Java và Selenium WebDriver.

## 1. Thứ Tự Ưu Tiên Locator

Tuân thủ cột **Selenium WebDriver (Web)** trong **Ma Trận Ưu Tiên Bộ Định Vị Chuẩn (Locator Priority Matrix)** tại [`.claude/rules/locator_strategy.md`](locator_strategy.md) (`By.id` ổn định → `By.cssSelector("[data-testid=...]")` → `By.name` → Scoped `By.cssSelector` → Relative `By.xpath`):

```java
// ĐÚNG — Ưu tiên thuộc tính định danh bền vững
driver.findElement(By.id("login-btn"));
driver.findElement(By.cssSelector("button[data-testid='submit-btn']"));
driver.findElement(By.name("username"));

// NGHIÊM CẤM — XPath tuyệt đối dựa trên cấu trúc vị trí DOM
driver.findElement(By.xpath("//div[3]/div[2]/form/div[1]/button"));
```

## 2. Chiến Lược Chờ Đợi (Wait Strategy)

- **NGHIÊM CẤM:** `Thread.sleep()` hoặc bất kỳ lệnh chờ cố định thời gian nào trong mọi trường hợp.
- **SỬ DỤNG:** Java Explicit Waits với `WebDriverWait` + `ExpectedConditions` (hoặc `FluentWait` khi cần custom polling):

```java
WebDriverWait wait = new WebDriverWait(driver, Duration.ofSeconds(10));

// Chờ element hiển thị / click được / chứa text / chuyển hướng URL
WebElement element = wait.until(ExpectedConditions.visibilityOfElementLocated(By.id("profile")));
wait.until(ExpectedConditions.elementToBeClickable(By.id("submit-btn")));
wait.until(ExpectedConditions.textToBePresentInElementLocated(By.id("message"), "Thành công"));
wait.until(ExpectedConditions.urlContains("/dashboard"));

// Custom FluentWait nếu cần polling linh hoạt
Wait<WebDriver> fluentWait = new FluentWait<>(driver)
    .withTimeout(Duration.ofSeconds(15))
    .pollingEvery(Duration.ofMillis(500))
    .ignoring(NoSuchElementException.class);
```

## 3. Thiết Lập Browser (Browser Execution Mode)

- **Mặc định — Headless Mode (`HEADLESS=true` / `-Dheadless=true`):** Chạy ẩn với `--headless=new`, `--window-size=1920,1080`, `--disable-gpu`, `--disable-dev-shm-usage`, `--no-sandbox` cho cả local lẫn CI/CD để tiết kiệm GPU render.
- **Opt-in — Headed Mode (`-Dheadless=false` / `HEADLESS=false`):** Khi user yêu cầu mở trình duyệt quan sát trực tiếp hoặc đăng nhập thủ công (`1600×750` để vừa màn hình Full HD):
  ```java
  driver.manage().window().setSize(new Dimension(1600, 750));
  ```

## 4. Cấu Trúc Test (TestNG)

```java
public class LoginTest extends BaseTest {

    @BeforeMethod
    public void setUp() {
        // Navigate, setup data...
    }

    @Test(groups = {"smoke", "regression"})
    public void testLoginWithValidCredentials() {
        // Arrange
        LoginPage loginPage = new LoginPage(driver);
        String email = DataGenerator.generateEmail("login");

        // Act
        loginPage.login(email, "ValidPass@123");

        // Assert
        DashboardPage dashboard = new DashboardPage(driver);
        Assert.assertTrue(dashboard.isDisplayed(),
            "Dashboard phải hiển thị sau khi đăng nhập thành công");
    }

    @AfterMethod
    public void tearDown() {
        // Cleanup...
    }
}
```

## 5. Assertions (Kiểm Tra Kết Quả)

- Sử dụng TestNG Assertions (`Assert.assertEquals`, `Assert.assertTrue`...) kèm **message mô tả Tiếng Việt**:
  ```java
  Assert.assertEquals(actualTitle, "Dashboard", "Tiêu đề trang phải là Dashboard");
  Assert.assertTrue(element.isDisplayed(), "Element phải hiển thị trên trang");
  ```
- Mỗi test method phải có ít nhất **1 assertion** nghiệp vụ ở cuối.
