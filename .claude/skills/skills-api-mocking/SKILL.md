---
name: skills-api-mocking
description: "Mock and stub APIs using Playwright route interception or WireMock to isolate UI tests and simulate 500 errors, timeouts, empty states, and large payloads."
---

# API Mocking

Sinh mock/stub API để cô lập kiểm thử UI khỏi sự phụ thuộc backend và tái hiện các trạng thái lỗi/biên khó dựng trên môi trường thật.

---

## 1. Vai Trò & Khi Nào Sử Dụng

- **Khi sử dụng:**
  - Backend chưa sẵn sàng nhưng cần kiểm thử giao diện UI trước.
  - Cần kiểm thử các edge cases khó tái hiện trên môi trường thật: API trả `500`, `401`, timeout, danh sách rỗng (`[]`), danh sách lớn (`1000+` bản ghi), hoặc đứt kết nối mạng.
  - Cô lập third-party API (cổng thanh toán, bản đồ, SMS/OTP) không thể gọi thật trong regression test.
- **KHÔNG mock khi:** Chạy E2E verification cuối cùng trước release — luồng E2E nghiệm thu bắt buộc đi qua backend thật.

---

## 2. Chiến Lược Mock Theo Layer & 6 Edge Cases Bắt Buộc

| Layer | Công cụ | Khi nào dùng |
|---|---|---|
| **Trong test (Network Intercept)** | Playwright `page.route()` | Mock nhanh, cô lập theo từng kịch bản test UI |
| **Mock server độc lập** | WireMock (Java / standalone) | Nhiều suite hoặc nhiều team dùng chung contract cố định |
| **Trong ứng dụng (Env Config)** | Feature flag / Mock service của FE | Khi ứng dụng đã có sẵn cơ chế mock nội bộ |

### 6 kịch bản Edge Cases bắt buộc rà soát
1. **Server Error (`500`):** Kiểm tra thông báo lỗi thân thiện và nút thử lại (không trắng trang).
2. **Empty State (`200 []`):** Kiểm tra giao diện khi danh sách rỗng (placeholder + CTA).
3. **Unauthorized (`401`):** Kiểm tra cơ chế dọn session và chuyển hướng về trang đăng nhập.
4. **Slow Response (Delay):** Kiểm tra trạng thái loading/skeleton và khoá nút tránh bấm đúp.
5. **Network Failure (`abort('failed')`):** Kiểm tra thông báo mất kết nối mạng.
6. **Large Payload (`1000+ items`):** Kiểm tra phân trang, lazy load và hiệu năng render.

> Mẫu code chi tiết cho Playwright `page.route()` và WireMock xem tại [`references/MOCK_PATTERNS_AND_TEMPLATES.md`](references/MOCK_PATTERNS_AND_TEMPLATES.md).

---

## 3. Quy Trình 6 Bước & Nguyên Tắc Trong POM

1. **Xác định API cần mock:** Quan sát network thực tế (`browser_network_requests` / `page.on('response')`) hoặc đọc yêu cầu test.
2. **Thu thập response mẫu THẬT:** Capture payload từ API thật hoặc lấy schema từ Swagger/OpenAPI — **tuyệt đối không tự bịa cấu trúc JSON**.
3. **Chọn layer mock:** Tra bảng chiến lược mục 2 (`page.route()` hoặc `WireMock`).
4. **Tách biệt khỏi Page Object:** Đặt hàm setup mock trong `mocks/api-mocks.ts`, fixture hoặc test file — **KHÔNG đặt logic mock bên trong Page class**. Dùng glob pattern cụ thể (`**/api/products`), tránh pattern quá rộng (`**/*`).
5. **Viết test cho từng Edge Case:** Mỗi trạng thái mock đi kèm assertion kiểm chứng đúng phản ứng của UI.
6. **Kiểm chứng:** Chạy test xác nhận request được intercept đúng, không lọt request thật về server.

---

## 4. Quality Checklist

- [ ] Cấu trúc JSON của bản mock khớp 100% với API thật hoặc Swagger spec.
- [ ] Route pattern đủ cụ thể, không chặn nhầm tài nguyên tĩnh hoặc API khác.
- [ ] Hàm mock tách riêng tại fixture/helper (`mocks/`), không nằm trong Page Object.
- [ ] Mỗi edge case có assertion kiểm tra hành vi UI tương ứng (empty state, toast lỗi, skeleton).
- [ ] Bài test dùng mock được gắn tag/describe `[mocked]` rõ ràng để phân biệt với E2E thật.
- [ ] Không dùng mock delay để che giấu flaky test — đồng bộ UI phải xử lý bằng smart wait.

---

## 5. Tài Liệu Tham Chiếu

- [`references/MOCK_PATTERNS_AND_TEMPLATES.md`](references/MOCK_PATTERNS_AND_TEMPLATES.md) — Code mẫu Playwright `page.route()` (6 edge cases) & WireMock Java stubs
- [`.claude/rules/playwright_rules.md`](../../rules/playwright_rules.md) · [`.claude/rules/automation_rules.md`](../../rules/automation_rules.md)
- [`skills-test-data-generator`](../skills-test-data-generator/SKILL.md) — Sinh dữ liệu chuẩn cho response payload lớn
