# Nguyên Nhân Gốc Rễ & Mẫu Khắc Phục Flaky Test (`ANALYZE` & `FIX`)

> Tài liệu tham chiếu chi tiết cho [`skills-flaky-test-analyzer`](../SKILL.md). Nạp khi cần đối chiếu mẫu code khắc phục Flaky Test hoặc xuất báo cáo `reports/flaky_test_analysis.md`.

---

## 1. Năm Nhóm Nguyên Nhân Flaky & Mẫu Code Khắc Phục Chuẩn

### 1.1. Bộ Định Vị Không Ổn Định (`Unstable Locator`)

**Dấu hiệu:** XPath theo chỉ số vị trí hoặc CSS class tự sinh (`css-1n2xyz-btn`, `:nth-child`) gãy ngẫu nhiên khi thứ tự danh sách hoặc banner quảng cáo thay đổi.

```typescript
// ❌ SAI — Phụ thuộc vị trí DOM hoặc class hash động
await page.locator('//div[3]/button').click();
await page.locator('.css-1n2xyz-btn').click();

// ✅ ĐÚNG — Dùng Role / Label / TestId theo .claude/rules/locator_strategy.md
await page.getByRole('button', { name: 'Lưu thay đổi' }).click();
```

### 1.2. Chờ Cứng & Đua Thời Gian (`Hard Sleep & Race Condition`)

**Dấu hiệu:** Dùng `Thread.sleep()` / `page.waitForTimeout()` hoặc thao tác ngay khi API/animation chưa hoàn tất.

```java
// ❌ SAI — Hard sleep cố định
Thread.sleep(3000);
```

```java
// ✅ ĐÚNG (Selenium) — Explicit Wait chờ đúng điều kiện DOM
WebDriverWait wait = new WebDriverWait(driver, Duration.ofSeconds(10));
wait.until(ExpectedConditions.visibilityOfElementLocated(By.id("result")));
```

```typescript
// ✅ ĐÚNG (Playwright) — Web-First Assertions tự động retry
await expect(page.getByRole('button', { name: 'Submit' })).toBeVisible();
await expect(page.getByTestId('status-badge')).toHaveText('Hoàn tất');
```

### 1.3. Xung Đột Dữ Liệu Khi Chạy Song Song (`Parallel Test Data Collision`)

**Dấu hiệu:** Chạy đơn lẻ (`--workers=1`) thì PASS, chạy song song 5 luồng thì FAIL ngẫu nhiên do dùng chung tài khoản/bản ghi hoặc trùng email/mã.

```typescript
// ❌ SAI — Hardcode dữ liệu dùng chung giữa các worker
const email = 'test@example.com';

// ✅ ĐÚNG — Sinh dữ liệu độc lập có gắn tiền tố truy vết + timestamp + workerIndex
const email = `auto_login_${Date.now()}_${testInfo.workerIndex}@example.com`;
```

### 1.4. Rò Rỉ Trạng Thái Giữa Các Bài Test (`Shared State / Leaky Storage`)

**Dấu hiệu:** Bài test B chỉ PASS khi chạy sau bài test A, hoặc FAIL khi chạy độc lập.

- **Cách sửa:** Khởi tạo browser context/storage sạch cho mỗi bài test, thiết lập dữ liệu tiền điều kiện (`Arrange`) qua API/UI ngay trong bài test đó và dọn dẹp ở `afterEach`.

### 1.5. Animation, Overlay & Lazy Render (`UI Transition Interference`)

**Dấu hiệu:** Lỗi `Element is not stable` hoặc `subtree intercepts pointer events` do modal/toast/spinner đang đóng mở.

- **Cách sửa:** Chờ spinner/skeleton biến mất (`expect(spinner).toBeHidden()`) trước khi thao tác phần tử bên dưới.

---

## 2. Mẫu Báo Cáo `reports/flaky_test_analysis.md`

```markdown
# Báo Cáo Chẩn Đoán & Khử Flaky Test

- **Phạm vi kiểm tra:** `<file hoặc suite>` · **Số lần lặp kiểm chứng:** `5 lần liên tiếp`
- **Chế độ:** `ANALYZE` / `FIX`

## 1. Bảng Chẩn Đoán Từng Bài Test Chập Chờn
| # | Tên bài test (`File:line`) | Tỷ lệ Fail | Phân loại nguyên nhân | Bằng chứng lỗi | Giải pháp khắc phục |
|---|---|---|---|---|---|
| 1 | `customer.spec.ts:42` | 2/5 lần | ⏱️ Race Condition | Click nút Lưu khi API tỉnh/thành chưa tải xong | Chờ `expect(citySelect).toBeEnabled()` trước khi chọn |
| 2 | `invoice.spec.ts:88` | 3/5 lần | 📊 Data Collision | Trùng mã hoá đơn khi chạy 5 workers | Đổi sang `auto_inv_${Date.now()}_${workerIndex}` |

## 2. Kết Quả Kiểm Chứng Độ Ổn Định (`Chỉ có ở Mode = FIX`)
| Bài test | Trước khi sửa | Sau khi sửa (Chạy 5 lần liên tiếp) | Trạng thái |
|---|---|---|---|
| `customer.spec.ts:42` | 3/5 PASS | ✅ 5/5 PASS | Đã khử Flaky |
| `invoice.spec.ts:88` | 2/5 PASS | ✅ 5/5 PASS | Đã khử Flaky |
```
