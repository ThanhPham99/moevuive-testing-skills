# Mẫu Báo Cáo Thực Thi Kiểm Thử Thủ Công (`execution_report.md`)

> Tài liệu tham chiếu chi tiết cho [`skills-manual-test-executor`](../SKILL.md). Nạp khi khởi tạo và ghi nhận kết quả vào `docs/executions/<module>/run_<timestamp>/execution_report.md`.
> **Lưu ý hợp đồng parser:** Giữ nguyên chính xác 5 cột của bảng Mục 2 (`| TC ID | Test Scenario | Kết quả | Bước fail | Ghi chú |`) để tương thích 100% với `scripts/execution-viewer/bundle.html` và `node scripts/validate-docs.mjs --check`.

---

## Mẫu `docs/executions/<module>/run_<timestamp>/execution_report.md`

```markdown
# Execution Report — <Module> · <Loại chạy: Smoke / Regression / Full>

| Thông tin | Nội dung |
|---|---|
| Run ID | run_1785700456 |
| Nguồn TC | docs/testcases/customers/test_cases_customers.md |
| Phạm vi chọn | Toàn bộ `@Smoke` (12 TC) |
| Môi trường | https://crm.example.com — Staging (Môi trường dùng chung) |
| Tài khoản thực thi | Role: Staff (`.env` -> `TEST_STAFF_EMAIL`) |
| Trình duyệt & Chế độ | Chromium — Headless `1920x1080` |
| Bắt đầu → Kết thúc | 2026-08-02 09:15 → 10:40 |

## 1. Tổng kết

| Trạng thái | Số lượng | Tỷ lệ |
|---|---|---|
| ✅ PASS | 10 | 90.9% |
| ❌ FAIL | 1 | 9.1% |
| ⚠️ BLOCKED | 0 | 0.0% |
| ⏭️ SKIPPED | 1 | — (không tính vào mẫu số Pass Rate) |
| **Pass Rate** (`PASS / (PASS + FAIL + BLOCKED)`) | **10 / 11** | **90.9%** |

## 2. Kết quả từng TC

| TC ID | Test Scenario | Kết quả | Bước fail | Ghi chú |
|---|---|---|---|---|
| CRM_CUST_TC_001 | Bảng hiển thị đủ 9 cột mặc định | ✅ PASS | — | [ảnh](evidence/CRM_CUST_TC_001_pass.png) |
| CRM_CUST_TC_011 | Search chuỗi SQL injection cơ bản | ❌ FAIL | 4 | Xem chi tiết #1 |
| CRM_CUST_TC_030 | Xoá hàng loạt khách hàng qua Bulk Actions | ⏭️ SKIPPED | — | Thao tác phá huỷ, môi trường dùng chung (Auto-Skip) |

## 3. Chi tiết TC FAIL

### FAIL #1 — CRM_CUST_TC_011 · Search chuỗi SQL injection cơ bản

| Thuộc tính | Nội dung |
|---|---|
| REQ ID | REQ-CUST-04 |
| Priority | High |
| Bước fail | Bước 4 |
| **Expected** | Request trả HTTP 200; bảng hiển thị 0 kết quả và không bắn lỗi hệ thống |
| **Actual** | Request trả HTTP 500 Internal Server Error; màn hình treo spinner |
| Console / Network Error | `GET /api/customers?q=%27%20OR%201%3D1 500 (Internal Server Error)` |
| Evidence | ![](evidence/CRM_CUST_TC_011_step4_fail.png) |
| Mã Bug (nếu đã tạo) | `BUG_customers_1785700890_CRM_CUST_TC_011` |

## 4. Chi tiết TC BLOCKED (Nếu có)

| TC ID | Test Scenario | Nguyên nhân bị chặn | Điều kiện cần để mở khoá |
|---|---|---|---|
| — | — | — | — |

## 5. Dữ liệu đã tạo & dọn dẹp (Teardown Log)

| Dữ liệu | ID / Tên định danh | Nơi tạo (TC ID) | Đã xoá? |
|---|---|---|---|
| Khách hàng test | `Auto_CUST_1785700512` | `CRM_CUST_TC_005` | ✅ Đã xoá ở bước Teardown |
```
