---
description: Sinh mock/stub cho API (Playwright route interception / WireMock) từ response thực tế hoặc Swagger spec kèm test cho các edge cases (500, 401, timeout, empty state, big list).
skills:
  - skills-api-mocking
---

# Workflow: Sinh API Mocks (`/generate-api-mocks`)

> **Context Pointer:** Nạp và thực thi theo [`.claude/skills/skills-api-mocking/SKILL.md`](../skills/skills-api-mocking/SKILL.md). Khi cần sinh dữ liệu mẫu lớn (1000+ items), tham chiếu thêm [`skills-test-data-generator`](../skills/skills-test-data-generator/SKILL.md).

## 1. Input Cần Thu Thập

| Input | Bắt buộc? | Ghi chú |
|---|---|---|
| **API Endpoints cần mock** | ⭐ Bắt buộc | URL pattern cụ thể (VD: `**/api/products`) |
| **Nguồn Response mẫu thật** | ⭐ Bắt buộc | Capture từ network thực tế (`browser_network_requests`), Swagger/OpenAPI spec, hoặc response JSON thật |
| **Framework đích** | ⭐ Bắt buộc | Playwright (`page.route()`) hoặc WireMock (`stubFor`) |
| **Danh sách Edge Cases** | Mặc định | `200 Success`, `200 Empty []`, `500 Server Error`, `401 Unauthorized`, `Delay/Timeout`, `Network Abort`, `Big List` |

## 2. Các Bước Thực Hiện

### Bước 1: Thu thập Response Mẫu Thực Tế
1. Đọc schema từ Swagger/OpenAPI hoặc mở ứng dụng qua Playwright MCP (mặc định **Headless Mode** `1920x1080`) để bắt response thật từ `browser_network_requests`.
2. Lưu cấu trúc JSON thực tế làm chuẩn (không tự bịa trường dữ liệu).

### Bước 2: Thiết Kế Ma Trận Mock (⏸️ HITL Checkpoint)
1. Lập bảng `Endpoint × Edge Cases × Hành vi UI kỳ vọng`.
2. **⏸️ DỪNG LẠI** trình bày bảng cho user xác nhận phạm vi trước khi sinh code.

### Bước 3: Sinh Mock Helpers & Test Specs
1. Tạo helper mock tách biệt khỏi Page Object (`mocks/api-mocks.ts` cho Playwright hoặc `mappings/` + `__files/` cho WireMock) theo mẫu trong `skills-api-mocking`.
2. Viết test cho từng edge case, gắn nhãn `[mocked]` trong tên suite/tag và assert rõ phản hồi trên giao diện (empty state, toast lỗi, redirect login, skeleton loading).

### Bước 4: Kiểm Chứng (Verify)
1. Chạy test **2 lần liên tiếp** (mặc định **Headless Mode** `1920x1080`) xác nhận route được intercept chính xác và pass ổn định.
2. Dọn dẹp code theo Definition of Done trước khi bàn giao.
