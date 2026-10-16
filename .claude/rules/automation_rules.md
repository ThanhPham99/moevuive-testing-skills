# Quy Tắc Chung cho QA Automation & Definition of Done

> Áp dụng cho mọi tác vụ automation testing trên toàn bộ framework (Playwright, Selenium, Appium, REST Assured).

## 1. Kiến Trúc Page Object Model (POM)

- Tách biệt 3 tầng:
  - **Page classes:** Khai báo locators + methods tương tác UI (tích hợp `@Step` / `allure.step`).
  - **Test classes:** Chứa kịch bản kiểm thử (`Arrange` / `Act` / `Assert`) + assertions.
  - **Test data & Utils:** Tách riêng khỏi code chức năng (JSON, DataProvider, Factory/Builder, Helpers).
- Đặt toàn bộ assertions trong Test classes; Page classes chỉ trả về trạng thái/dữ liệu hoặc fluent page object.

## 2. Sinh Dữ Liệu Test (Traceable Dynamic Data)

- Mọi trường yêu cầu duy nhất (`Email`, `Username`, `Code`, `TaxID`...) phải sinh động và truy vết ngược được về test tạo ra nó:
  ```
  Format: [prefix]_[testName]_[timestamp]_[random]
  Ví dụ:  auto_createCustomer_1712049200_A3F2@auto.test
  ```
- **Parallel mặc định cho Stateless Tests:** Bật chạy song song (mặc định 5 workers/threads) cho các test độc lập dữ liệu.
- **Đánh dấu `@serial` cho Shared Mutating State:** Gắn chế độ tuần tự (`test.describe.configure({ mode: 'serial' })` hoặc `@Test(singleThreaded = true)`) khi test sửa cấu hình hệ thống toàn cục, dùng chung thực thể độc bản/kho giới hạn, hoặc khoá/xoá tài khoản dùng chung.

## 3. Quy Tắc Đặt Tên

| Thành phần | Java (Selenium / Playwright / Appium) | TypeScript (Playwright) |
|---|---|---|
| Page class | `PascalCasePage.java` (`LoginPage.java`) | `PascalCasePage.ts` (`LoginPage.ts`) |
| Test class / file | `PascalCaseTest.java` (`LoginTest.java`) | `kebab-case.spec.ts` (`login.spec.ts`) |
| Test method / block | `test<Behavior>()` (`testLoginWithValidCredentials()`) | `test('mô tả hành vi Tiếng Việt')` |
| Biến locator | `lowerCamelCase` + loại phần tử (`loginButton`) | `readonly lowerCamelCase` (`readonly loginButton`) |
| Utils / Helper | `PascalCase.java` (`DataGenerator.java`) | `PascalCase.ts` / `kebab-case.ts` |

## 4. Assertions & Smart Waits

- Mỗi test case phải có ít nhất 1 assertion rõ nghĩa ở cuối và assertion tại các bước chuyển trạng thái quan trọng.
- Luôn dùng **Smart Waits** (`expect(locator).toBeVisible()`, `WebDriverWait` + `ExpectedConditions`) kèm message mô tả hành vi mong đợi. Không dùng lệnh chờ cứng (`waitForTimeout`, `Thread.sleep`).

## 5. Tính Độc Lập & Teardown

- Mỗi test case chạy độc lập, không phụ thuộc thứ tự thực thi của test khác.
- Ưu tiên dọn dữ liệu phát sinh trong `afterEach` / `@AfterMethod` qua **API hoặc Database** thay vì qua UI để đảm bảo teardown vẫn chạy sạch ngay cả khi UI bước trước bị lỗi.

## 6. Điều Kiện Bàn Giao (Definition of Done — DoD)

Một bộ test automation chỉ được coi là hoàn thành khi đạt đủ 5 nhóm tiêu chí sau:

### 6.1. Code Cleanup & Hygiene
- [ ] Đã gỡ bỏ toàn bộ `console.log()`, `System.out.println()`, `print()`, debug log tạm và commented-out code.
- [ ] Không còn locator thừa, biến hoặc import không sử dụng.
- [ ] Không có `waitForTimeout` / `Thread.sleep` / delay cố định.
- [ ] Không có credentials thật hoặc test data unique bị hardcode trong source code.

### 6.2. Cấu Trúc & POM
- [ ] Tuân thủ đúng kiến trúc dự án (tham chiếu `.claude/skills/skills-framework-architect/references/PROJECT_STRUCTURE.md`).
- [ ] Toàn bộ locator nằm trong Page class và đã được verify trên DOM thực tế.

### 6.3. Chất Lượng Thực Thi (Headless Default)
- [ ] Test chạy **PASS ổn định ít nhất 2 lần liên tiếp** (mặc định ở **Headless Mode** `1920×1080`; hoặc ở **Headed Mode** `1600×750` nếu người dùng yêu cầu bật hiển thị browser).
- [ ] Mọi test độc lập dữ liệu và an toàn khi chạy song song (hoặc đã gắn `@serial` nếu chạm trạng thái dùng chung).

### 6.4. Chất Lượng Report (Allure)
> Chi tiết: [`reporting_rules.md`](reporting_rules.md)
- [ ] Tên hiển thị của test bằng **Tiếng Việt** mô tả hành vi nghiệp vụ.
- [ ] Đủ 5 metadata: **Title**, **Description**, **Severity**, **Tags**, **TC ID** (`allure.label('testId', ...)`).
- [ ] Test Body có cấu trúc step `Arrange:` / `Act:` / `Assert:` rõ ràng.
- [ ] Đính kèm screenshot ở cuối **mọi** test (cả `PASSED` lẫn `FAILED`), không đính kèm `stdout`/`stderr` thô, toàn bộ output đặt trong `reports/`.

### 6.5. Báo Cáo Bàn Giao
- [ ] Tóm tắt số lượng test `PASS` / `FAIL` / `SKIP`, danh sách TC đã implement, TC bị skip (kèm lý do) và các known issues / bugs phát hiện được.