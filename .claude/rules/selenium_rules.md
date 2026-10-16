# Quy Tắc Dành Riêng Cho Selenium WebDriver

> Áp dụng khi tự động hóa browser với Java và Selenium WebDriver.

## 1. Thứ Tự Ưu Tiên Locator

Tuân thủ cột **Selenium WebDriver (Web)** trong **Ma Trận Ưu Tiên Bộ Định Vị Chuẩn (Locator Priority Matrix)** tại [`.claude/rules/locator_strategy.md`](locator_strategy.md) (`By.id` ổn định → `By.cssSelector("[data-testid=...]")` → `By.name` → Scoped `By.cssSelector` → Relative `By.xpath`):

Ví dụ đúng:
```java
driver.findElement(By.id("login-btn"));
driver.findElement(By.cssSelector("button[data-testid='submit-btn']"));
driver.findElement(By.name("username"));
```

Ví dụ sai — XPath cấu trúc phụ thuộc vị trí:
```java
// NGHIÊM CẤM: XPath tuyệt đối dựa trên DOM structure
driver.findElement(By.xpath("//div[3]/div[2]/form/div[1]/button"));
```

## 2. Chiến Lược Chờ Đợi (Wait Strategy)

**NGHIÊM CẤM:**
- `Thread.sleep()` — Trong mọi trường hợp
- Bất kỳ cách nào cố định thời gian chờ

**SỬ DỤNG:**
- Java Explicit Waits với `WebDriverWait` + `ExpectedConditions`:

```java
WebDriverWait wait = new WebDriverWait(driver, Duration.ofSeconds(10));

// Chờ element hiển thị
WebElement element = wait.until(
    ExpectedConditions.visibilityOfElementLocated(By.id("profile"))
);

// Chờ element click được
wait.until(ExpectedConditions.elementToBeClickable(By.id("submit-btn")));

// Chờ text xuất hiện
wait.until(ExpectedConditions.textToBePresentInElementLocated(
    By.id("message"), "Thành công"
));

// Chờ URL chuyển hướng
wait.until(ExpectedConditions.urlContains("/dashboard"));
```

- Có thể tạo custom `FluentWait` nếu cần polling linh hoạt:
```java
Wait<WebDriver> fluentWait = new FluentWait<>(driver)
    .withTimeout(Duration.ofSeconds(15))
    .pollingEvery(Duration.ofMillis(500))
    .ignoring(NoSuchElementException.class);
```

## 3. Thiết Lập Browser (Browser Execution Mode)

- **Mặc định — Headless Mode (`HEADLESS=true` / `-Dheadless=true`):** Chạy ẩn với `--headless=new`, `--window-size=1920,1080`, `--disable-gpu`, `--disable-dev-shm-usage`, `--no-sandbox` cho cả local lẫn CI/CD để tiết kiệm GPU render.
- **Opt-in — Headed Mode (`-Dheadless=false` / `HEADLESS=false`):** Khi user yêu cầu mở trình duyệt quan sát trực tiếp hoặc đăng nhập thủ công:
  ```java
  driver.manage().window().setSize(new Dimension(1920, 1080));
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

- Sử dụng TestNG Assertions (`Assert.assertEquals`, `Assert.assertTrue`...)
- Luôn thêm **message mô tả** vào assertion:
  ```java
  Assert.assertEquals(actualTitle, "Dashboard", "Tiêu đề trang phải là Dashboard");
  Assert.assertTrue(element.isDisplayed(), "Element phải hiển thị trên trang");
  ```
- Mỗi test method phải có ít nhất **1 assertion** ở cuối
