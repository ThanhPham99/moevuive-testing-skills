# Mẫu Code & Kịch Bản API Mocking (`Playwright` & `WireMock`)

> Tài liệu tham chiếu chi tiết cho [`skills-api-mocking`](../SKILL.md). Nạp khi cần sinh code mock/stub thực tế cho Playwright hoặc WireMock.

---

## 1. Playwright Route Interception (`page.route()`)

### 1.1. Mock Response Thành Công & Helper Tái Sử Dụng (`mocks/api-mocks.ts`)

```typescript
import { Page } from '@playwright/test';

export async function mockProductsSuccess(page: Page) {
  await page.route('**/api/products', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        { id: 1, name: 'Product A', price: 100000 },
      ]),
    });
  });
}
```

### 1.2. 6 Kịch Bản Edge Cases Bắt Buộc Cân Nhắc

```typescript
// 1. Server Error (500) — verify UI hiển thị thông báo lỗi thân thiện & nút thử lại
await page.route('**/api/products', (route) =>
  route.fulfill({
    status: 500,
    contentType: 'application/json',
    body: JSON.stringify({ message: 'Internal Server Error' }),
  })
);

// 2. Danh sách rỗng (Empty State) — verify hiển thị empty state placeholder
await page.route('**/api/products', (route) =>
  route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
);

// 3. Unauthorized (401) — verify tự động xoá session & redirect về /login
await page.route('**/api/products', (route) =>
  route.fulfill({
    status: 401,
    contentType: 'application/json',
    body: JSON.stringify({ message: 'Unauthorized' }),
  })
);

// 4. Response chậm (Slow Network) — verify skeleton/spinner loading state
// Lưu ý: CHỈ được phép dùng setTimeout bên trong mock route handler, cấm dùng trong test
await page.route('**/api/products', async (route) => {
  await new Promise((resolve) => setTimeout(resolve, 3000));
  await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
});

// 5. Network Disconnected / Failed — verify xử lý mất kết nối mạng
await page.route('**/api/products', (route) => route.abort('failed'));

// 6. Danh sách lớn (1000+ items) — verify phân trang / virtual scroll không treo UI
const bigList = Array.from({ length: 1000 }, (_, i) => ({
  id: i + 1,
  name: `Item ${i + 1}`,
  price: 50000,
}));
await page.route('**/api/products', (route) =>
  route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(bigList) })
);
```

---

## 2. WireMock Stubs (`Java` / Standalone Server)

- Đặt file dữ liệu mẫu tại `src/test/resources/__files/` và file cấu hình mapping tại `src/test/resources/mappings/`.
- Luôn lấy cấu trúc JSON từ **response thật hoặc Swagger/OpenAPI spec**, tuyệt đối không tự bịa trường.

```java
// 1. Stub response thành công từ file JSON mẫu
stubFor(get(urlPathEqualTo("/api/products"))
    .willReturn(aResponse()
        .withStatus(200)
        .withHeader("Content-Type", "application/json")
        .withBodyFile("products-list.json")));

// 2. Giả lập độ trễ mạng (Fixed Delay)
stubFor(get(urlPathEqualTo("/api/slow"))
    .willReturn(aResponse()
        .withStatus(200)
        .withFixedDelay(3000)));

// 3. Giả lập lỗi đứt kết nối tầng TCP (Fault Injection)
stubFor(get(urlPathEqualTo("/api/broken"))
    .willReturn(aResponse()
        .withFault(Fault.CONNECTION_RESET_BY_PEER)));
```
