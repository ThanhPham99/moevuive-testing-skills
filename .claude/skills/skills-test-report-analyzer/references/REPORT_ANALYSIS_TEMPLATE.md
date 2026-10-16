# Mẫu Báo Cáo Phân Tích Test Run & Báo Cáo Sửa Lỗi Suite (`run_and_fix_report.md`)

> Tài liệu tham chiếu chi tiết cho [`skills-test-report-analyzer`](../SKILL.md). Nạp khi xuất báo cáo phân tích đợt chạy kiểm thử (`/analyze-test-report`) hoặc báo cáo chạy kèm tự sửa lỗi (`/run-and-fix-tests`).

---

## 1. Mẫu Báo Cáo Phân Tích Đợt Chạy Kiểm Thử (`/analyze-test-report`)

```markdown
# Báo Cáo Phân Tích Test Run — <Tên Suite / Module>

## 1. Tổng quan
| Chỉ số | Giá trị |
|---|---|
| Nguồn báo cáo | `reports/html/` (hoặc `docs/executions/<module>/run_<ts>/execution_report.md`) |
| Tổng số test | N |
| ✅ PASS | x (x%) |
| ❌ FAIL | y |
| ⚠️ BLOCKED / ⏭️ SKIP | b / z |
| 🔁 FLAKY (pass sau retry) | w |
| Thời gian chạy | mm:ss |

## 2. Phân loại Failure (Gom theo Root Cause)
| Category | Số lượng | Danh sách TC / Test | Nguyên nhân gốc & Hành động đề xuất |
|---|---|---|---|
| 🐛 Application Bug | 2 | `TC_01`, `TC_05` | Lỗi HTTP 500 tại API tạo đơn → `/create-bug-report` |
| 🎯 Locator hỏng | 3 | `LoginSpec`, ... | Nút Submit đổi label trên UI → `/heal-locators` |
| ⏱️ Flaky / Timing | 1 | `OrderListSpec` | Chưa chờ bảng tải xong trước khi đếm dòng → `/analyze-flaky-tests` |

## 3. Xu hướng so với lần chạy trước (Nếu có)
- 🆕 **Mới fail (`PASS → FAIL`):** ...
- 🔁 **Fail liên tục (`FAIL ≥ 2 lần`):** ...
- ✅ **Đã fix (`FAIL → PASS`):** ...
- ⚠️ **Mới bị chặn (`→ BLOCKED`):** ...

## 4. Cảnh báo Tín hiệu Sống còn (Với Manual Report)
- **Tỷ lệ `BLOCKED`:** `<x%>` (`≤ 5%` bình thường / `5–20%` cảnh báo / `> 20%` dừng kết luận chất lượng).
- **Nợ kiểm thử từ `SKIPPED` (Auto-Skip):** Danh sách TC cần chạy tay có giám sát trên môi trường riêng.
- **Dữ liệu chưa dọn (`Đã xoá? ❌`):** Danh sách bản ghi tồn đọng có nguy cơ gây nhiễu lần chạy kế tiếp.

## 5. Thứ tự xử lý ưu tiên
1. Khắc phục sự cố Môi trường / `BLOCKED` chặn diện rộng.
2. Lập Bug Report cho các lỗi sản phẩm (`🐛 Application Bug`).
3. Sửa Locator / Flaky / Test Data thuộc phạm vi QA/Automation.
```

---

## 2. Mẫu Báo Cáo `reports/run_and_fix_report.md` (`/run-and-fix-tests`)

```markdown
# Báo Cáo Thực Thi & Tự Động Sửa Lỗi Suite (`Run & Fix Report`)

- **Lệnh thực thi:** `npx playwright test` (Headless `1920x1080`)
- **Chế độ:** `RUN` / `FIX`
- **Pass Rate Baseline:** `x/N (xx%)` → **Pass Rate Sau Khi Sửa:** `y/N (yy%)`

## 1. Gom cụm lỗi theo Điểm gốc (Root-Cause Clusters)
| Cụm # | Category | Điểm gốc (File / Hàm / Endpoint) | Số test bị ảnh hưởng | Phân nhóm xử lý |
|---|---|---|---|---|
| #1 | 🎯 Broken Locator | `CustomerPage.ts:45` (`saveButton`) | 6 tests | ✅ **Danh sách Sẽ Sửa** (Phạm vi QA) |
| #2 | 🐛 Application Bug | `POST /api/invoices` trả `500` | 2 tests | 🛑 **Danh sách Không Sửa** (Chuyển `/create-bug-report`) |

## 2. Kết quả Sửa & Kiểm chứng (`Chỉ có ở Mode = FIX`)
| Cụm # | Thay đổi đã áp dụng | Vòng chạy 1 | Vòng chạy 2 | Trạng thái cuối |
|---|---|---|---|---|
| #1 | Cập nhật `saveButton` sang `getByRole('button', { name: 'Lưu' })` | ✅ 6/6 PASS | ✅ 6/6 PASS | Đã đóng (PASS 2 lần liên tiếp) |
```
