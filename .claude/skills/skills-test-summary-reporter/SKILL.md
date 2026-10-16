---
name: skills-test-summary-reporter
description: "Compile project-wide test completion reports (release, sprint, UAT) aligned with ISO/IEC/IEEE 29119-3, aggregating execution reports, open bugs, RTM coverage, and evidence-backed Go/No-Go recommendations."
---

# Test Summary Reporter

Tổng hợp kết quả kiểm thử toàn dự án tại một mốc (Release / Sprint / UAT) thành **Báo Cáo Tổng Hợp Kiểm Thử** (theo cấu trúc **ISO/IEC/IEEE 29119-3 — Test Completion Report**) dành cho PM, PO và khách hàng.

> Để phân tích sâu một lần chạy đơn lẻ, dùng [`skills-test-report-analyzer`](../skills-test-report-analyzer/SKILL.md).

---

## 1. Nguyên Tắc Cốt Lõi & Tiêu Chí Exit

1. **QA khuyến nghị, PM/PO quyết định:** Đưa ra khuyến nghị **GO** / **GO CÓ ĐIỀU KIỆN** / **NO-GO** kèm căn cứ định lượng và danh sách rủi ro tồn đọng (kể cả khi khuyến nghị GO).
2. **Đặt Vùng Chưa Kiểm Thử lên trước mọi tỷ lệ:** Module chưa recon hoặc chưa có TC phải hiển thị ngay tại Mục 2 để người đọc hiểu rõ phạm vi của con số Pass Rate.
3. **Truy vết nguồn 100% & Tách bạch Manual / Automation:** Mỗi con số đều gắn link tới `execution_report.md`, `retest_report.md`, `BUG_*.md`, `traceability_matrix.md` hoặc `reports/`. Báo cáo bảng Manual và bảng Automation riêng biệt, không cộng gộp.
4. **Tính đúng Pass Rate:** `Pass Rate = PASS / (PASS + FAIL + BLOCKED)`. Các TC `SKIPPED` tách riêng thành **Nợ kiểm thử**.
5. **Chốt Tiêu Chí Exit trước khi chấm:** Hỏi tiêu chí của dự án; nếu chưa có, dùng **7 Tiêu Chí Mặc Định** bên dưới và ghi rõ cần PM xác nhận:

| # | Tiêu chí Exit mặc định | Ngưỡng đạt |
|---|---|---|
| 1 | Bug **Critical** đang mở | `0` |
| 2 | Bug **Major** đang mở | `0` (hoặc có workaround được PM duyệt bằng văn bản) |
| 3 | Pass rate TC **Priority High** | `≥ 95%` |
| 4 | Pass rate toàn bộ TC đã chạy | `≥ 90%` |
| 5 | Tỷ lệ **BLOCKED** | `≤ 5%` |
| 6 | REQ mức Critical có ít nhất 1 TC **PASS** | `100%` |
| 7 | Module trong phạm vi release đã có TC và đã chạy | `100%` |

---

## 2. Nguồn Dữ Liệu Đầu Vào

- `docs/requirements/README.md` (nhận diện module chưa recon / vùng mù).
- `docs/executions/*/run_*/execution_report.md` & `retest_*/retest_report.md`.
- `docs/bugs/README.md` & `docs/bugs/<module>/BUG_*.md` (hoặc lấy từ Jira qua `skills-jira-integration`).
- `traceability_matrix.md` (độ phủ REQ ↔ TC ↔ Automation) & `reports/` (kết quả suite tự động).

---

## 3. Cấu Trúc Báo Cáo Chuẩn (ISO/IEC/IEEE 29119-3 Test Completion Report)

> Ghi tên mục chuẩn để đối chiếu; ghi rõ *"Biên soạn theo cấu trúc ISO/IEC/IEEE 29119-3 — Test Completion Report"* (không ghi số điều khoản cứng và không tự tuyên bố chứng nhận tuân thủ).

```markdown
# Báo Cáo Tổng Hợp Kiểm Thử — <Dự án> · <Mốc: Release v2.4 / Sprint 12 / UAT>

| Thông tin | Nội dung |
|---|---|
| Phạm vi báo cáo | <Danh sách module, build> |
| Build / Version | v2.4.3 |
| Môi trường | Staging — `<URL>` |
| Khoảng thời gian | 2026-08-01 → 2026-08-12 |
| Người lập | <Tên QA> (agent hỗ trợ) |
| Nguồn dữ liệu | N execution report · M retest report · K bug report |
| Cấu trúc tài liệu | Biên soạn theo cấu trúc ISO/IEC/IEEE 29119-3 — Test Completion Report (ánh xạ ở mục 9) |

---

## 1. Khuyến nghị (Test Completion Evaluation)

> ## 🟡 GO CÓ ĐIỀU KIỆN (hoặc 🟢 GO / 🔴 NO-GO)
> Đạt X/7 tiêu chí exit. Có thể phát hành nếu chấp nhận các điều kiện và rủi ro tồn đọng dưới đây.

- **Điều kiện kèm theo:** (Liệt kê cụ thể mã Bug / Module chưa kiểm thử + workaround).
- **Rủi ro nếu phát hành:** (Mô tả tác động thực tế tới người dùng cuối / vận hành).
- *Lưu ý: Quyết định phát hành thuộc về PM/PO.*

## 2. Vùng CHƯA Được Kiểm Thử (Deviations & Residual Risks)

| Module | Trạng thái | Nguyên nhân chưa kiểm thử | Mức rủi ro |
|---|---|---|---|
| Báo cáo | ⬜ Chưa recon | Chưa được cấp tài khoản role Manager | Cao |

- **Nợ kiểm thử (TC bị SKIPPED):** N TC thao tác phá huỷ trên môi trường dùng chung cần chạy có giám sát trên môi trường riêng.

## 3. Đối Chiếu Tiêu Chí Exit

| # | Tiêu chí | Ngưỡng | Thực tế | Kết quả |
|---|---|---|---|---|
| 1 | Bug Critical đang mở | 0 | 0 | ✅ Đạt |
| 2 | Bug Major đang mở | 0 / có workaround | 1 (có workaround) | 🟡 Ngoại lệ — chờ PM duyệt |
| 3 | Pass rate TC Priority High | ≥ 95% | 97.2% | ✅ Đạt |

## 4. Kết Quả Kiểm Thử Theo Module (Testing Performed & Measures)

| Module | Tổng TC | ✅ PASS | ❌ FAIL | ⚠️ BLOCKED | ⏭️ SKIP | Pass rate | Nguồn |
|---|---|---|---|---|---|---|---|
| Khách hàng | 36 | 30 | 3 | 1 | 2 | 88.2% | [run_1785700456](docs/executions/customers/run_1785700456/execution_report.md) |
| **Tổng** | **54** | **48** | **3** | **1** | **2** | **92.3%** | |

- **Kết quả Automation (báo riêng):** N test · PASS x · FAIL y · Pass rate z% — `[reports/allure-report](...)`

## 5. Tình Hình Lỗi (Defect Metrics & Residual Risks)

| Severity | Đang mở | Đã fix & verify | Ghi chú |
|---|---|---|---|
| 🔴 Critical / 🟠 Major / 🟡 Minor / 🟢 Trivial | ... | ... | ... |

- **Danh sách Bug đang mở:** `| Bug ID | Severity | Module | Tóm tắt | Workaround | Retest gần nhất |`
- **⚠️ Regression phát sinh từ bản fix trong kỳ:** (Nêu rõ số lượng và mã bug để cảnh báo vùng code nhạy cảm).

## 6. Độ Phủ Yêu Cầu (Coverage Measures)

| Chỉ số | Giá trị | Nguồn |
|---|---|---|
| REQ có ít nhất 1 TC | 48/52 (92.3%) | [traceability_matrix.md](...) |
| REQ Critical có TC PASS | 12/12 (100%) | |
| TC đã được Automate | 30/54 (55.6%) | |

## 7. Đề Xuất Hành Động (Recommendations)

| Ưu tiên | Hành động | Phụ trách | Workflow hỗ trợ |
|---|---|---|---|
| 🔴 Trước release | Fix BUG_... hoặc duyệt ngoại lệ | Dev / PM | — |

## 8. Yếu Tố Cản Trở Tiến Độ & Bài Học (Blocking Factors, Lessons & Reusable Assets)

- **8.1 Yếu tố làm chậm tiến độ:** `| Yếu tố | Thời lượng mất thực tế | Ảnh hưởng | Cách đã xử lý |`
- **8.2 Bài học rút ra:** `| Bài học | Áp dụng vào mục nào của Master Test Plan đợt sau |`
- **8.3 Tài sản tái sử dụng:** `| Tài sản (Bộ TC / Checklist / Script) | Đường dẫn lưu | Dùng lại cho |`

## 9. Phụ Lục — Ánh Xạ Cấu Trúc ISO/IEC/IEEE 29119-3

| Mục báo cáo | Thành phần tương ứng trong ISO/IEC/IEEE 29119-3 — Test Completion Report |
|---|---|
| Mục 1 & 3 | Test completion evaluation |
| Mục 2 | Deviations from planned testing · Residual risks |
| Mục 4, 5, 6 | Testing performed · Test measures (execution, defects, coverage) |
| Mục 7 & 8 | Recommendations · Factors blocking progress · Lessons learned · Reusable test assets |
```

---

## 4. Biên Soạn Master Test Plan Cấp Quản Lý (`/generate-master-test-plan`)

Khi lập **Master Test Plan** (`docs/test_plan_<mốc>.md`) đầu kỳ kiểm thử (đồng bộ 100% bộ 7 Tiêu chí Exit ở Mục 1 và ánh xạ chuẩn **ISO/IEC/IEEE 29119-3 — Test Plan** & **IEEE 829-2008**), nạp tài liệu tham chiếu:
- [`references/MASTER_TEST_PLAN_SCHEMA.md`](references/MASTER_TEST_PLAN_SCHEMA.md) — 4 quy tắc quản trị bắt buộc (bảng **Ô còn treo**, không để trống `2.2 Ngoài phạm vi`, quy tắc ghi tên chuẩn) và cấu trúc 11 mục chuẩn của `docs/test_plan_<mốc>.md`.
