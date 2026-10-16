---
name: skills-test-summary-reporter
description: "Compile project-wide test completion reports (release, sprint, UAT) aligned with ISO/IEC/IEEE 29119-3, aggregating execution reports, open bugs, RTM coverage, and evidence-backed Go/No-Go recommendations."
---

# Test Summary Reporter

Tổng hợp kết quả kiểm thử toàn dự án tại một mốc (**Release / Sprint / UAT**) thành **Báo Cáo Tổng Hợp Kiểm Thử** (theo cấu trúc **ISO/IEC/IEEE 29119-3 — Test Completion Report**) dành cho PM, PO và khách hàng.
> Để phân tích sâu một lần chạy đơn lẻ, dùng [`skills-test-report-analyzer`](../skills-test-report-analyzer/SKILL.md).

---

## 1. Nguyên Tắc Cốt Lõi & 7 Tiêu Chí Exit Mặc Định

1. **Kiểm chứng tính toàn vẹn & tổng hợp tự động:** Chạy `node scripts/validate-docs.mjs --check`, `node scripts/validate-docs.mjs --rtm` và `node scripts/validate-docs.mjs --summary [--milestone "<mốc>"] [--out docs/executions/test_summary_<mốc>.md]` để kiểm tra đồng bộ REQ/TC/Execution/Bug và tự động chấm 7 Tiêu chí Exit trong `< 50ms`.
2. **QA khuyến nghị, PM/PO quyết định:** Đưa ra khuyến nghị **🟢 GO** / **🟡 GO CÓ ĐIỀU KIỆN** / **🔴 NO-GO** kèm căn cứ định lượng và danh sách rủi ro tồn đọng.
3. **Đặt Vùng Chưa Kiểm Thử lên Mục 2 (trước mọi tỷ lệ):** Module chưa recon hoặc chưa có TC phải hiển thị ngay đầu báo cáo để không gây hiểu lầm về phạm vi Pass Rate.
4. **Truy vết nguồn 100% & Tách bạch Manual / Automation:** Không cộng gộp số liệu Manual và Automation vào cùng một bảng. Tính đúng `Pass Rate = PASS / (PASS + FAIL + BLOCKED)` (TC `SKIPPED` tách riêng thành **Nợ kiểm thử**).

| # | Tiêu chí Exit mặc định (nếu dự án chưa quy định riêng) | Ngưỡng đạt |
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

- `docs/requirements/README.md` (nhận diện danh mục module & vùng chưa khảo sát).
- `docs/executions/*/run_*/execution_report.md` & `retest_*/retest_report.md`.
- `docs/bugs/README.md` & `docs/bugs/<module>/BUG_*.md` (hoặc lấy từ Jira qua [`skills-jira-integration`](../skills-jira-integration/SKILL.md)).
- Kết quả RTM từ `node scripts/validate-docs.mjs --rtm` (hoặc `traceability_matrix.md`) & `reports/` (Allure/HTML).

---

## 3. Cấu Trúc Báo Cáo Chuẩn (ISO/IEC/IEEE 29119-3 Test Completion Report)

> Ghi rõ *"Biên soạn theo cấu trúc ISO/IEC/IEEE 29119-3 — Test Completion Report"* (không ghi số điều khoản cứng và không tự tuyên bố chứng nhận tuân thủ).

```markdown
# Báo Cáo Tổng Hợp Kiểm Thử — <Dự án> · <Mốc: Release v2.4 / Sprint 12 / UAT>

| Thông tin | Nội dung |
|---|---|
| Phạm vi · Build · Môi trường | <Danh sách module> · <Build v2.4.3> · <Staging URL> |
| Thời gian · Người lập · Nguồn | <YYYY-MM-DD → YYYY-MM-DD> · <QA> · N execution, M retest, K bug reports |
| Cấu trúc tài liệu | Biên soạn theo cấu trúc ISO/IEC/IEEE 29119-3 — Test Completion Report (ánh xạ ở mục 9) |

## 1. Khuyến nghị (Test Completion Evaluation)
> ## 🟡 GO CÓ ĐIỀU KIỆN (hoặc 🟢 GO / 🔴 NO-GO) — Đạt X/7 tiêu chí exit
- **Điều kiện kèm theo & Rủi ro tồn đọng nếu phát hành:** ...

## 2. Vùng CHƯA Được Kiểm Thử & Nợ Kiểm Thử (Deviations & Residual Risks)
| Module | Trạng thái | Nguyên nhân chưa kiểm thử | Mức rủi ro |
|---|---|---|---|

## 3. Đối Chiếu Tiêu Chí Exit (`| # | Tiêu chí | Ngưỡng | Thực tế | Kết quả |`)

## 4. Kết Quả Kiểm Thử Theo Module (Testing Performed & Measures)
| Module | Tổng TC | ✅ PASS | ❌ FAIL | ⚠️ BLOCKED | ⏭️ SKIP | Pass rate | Nguồn |
|---|---|---|---|---|---|---|---|
- **Kết quả Automation (báo riêng):** N test · PASS x · FAIL y · Pass rate z%

## 5. Tình Hình Lỗi (Defect Metrics)
- Thống kê theo Severity (`Critical` / `Major` / `Minor` / `Trivial`), bảng Bug đang mở, và cảnh báo regression phát sinh từ bản fix.

## 6. Độ Phủ Yêu Cầu (Coverage Measures từ RTM)
- `REQ có ≥ 1 TC` · `REQ Critical có TC PASS` · `TC đã Automate`.

## 7. Đề Xuất Hành Động · 8. Yếu Tố Cản Trở, Bài Học & Tài Sản Tái Sử Dụng
## 9. Phụ Lục — Ánh Xạ Cấu Trúc ISO/IEC/IEEE 29119-3
```

---

## 4. Biên Soạn Master Test Plan Cấp Quản Lý (`/generate-master-test-plan`)

Khi lập **Master Test Plan** (`docs/test_plan_<mốc>.md`) đầu kỳ kiểm thử (đồng bộ 100% bộ 7 Tiêu chí Exit ở Mục 1 và ánh xạ chuẩn **ISO/IEC/IEEE 29119-3 — Test Plan** & **IEEE 829-2008**), nạp tài liệu tham chiếu:
- [`references/MASTER_TEST_PLAN_SCHEMA.md`](references/MASTER_TEST_PLAN_SCHEMA.md) — 4 quy tắc quản trị bắt buộc (bảng **Ô còn treo**, không để trống `2.2 Ngoài phạm vi`, quy tắc ghi tên chuẩn) và cấu trúc 11 mục chuẩn của `docs/test_plan_<mốc>.md`.
