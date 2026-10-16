---
name: analyze-test-report
description: "Phân tích test report — automation (Playwright/Allure/JUnit/TestNG) hoặc manual (execution_report.md / retest_report.md). Tổng hợp PASS/FAIL, gom nhóm failure theo root cause, so sánh trend, đề xuất thứ tự xử lý."
skills:
  - skills-test-report-analyzer
---

# Workflow: Phân Tích Test Report (`/analyze-test-report`)

> **Context Pointer:** Nạp và thực thi theo [`.claude/skills/skills-test-report-analyzer/SKILL.md`](../../../.claude/skills/skills-test-report-analyzer/SKILL.md).

## 1. Xác Định Nhánh Báo Cáo (AUTOMATION vs MANUAL)

Phân biệt rõ 2 nhánh trước khi đọc dữ liệu (nếu user đưa cả hai loại, chạy và xuất **2 báo cáo riêng**, không cộng gộp số liệu Manual và Automation):

| Nhánh | Nguồn dữ liệu | Đường dẫn ưu tiên tìm kiếm |File đầu ra |
|---|---|---|---|
| **AUTOMATION** | Playwright JSON/HTML · Allure · Surefire/JUnit/TestNG XML | `reports/` (`allure-results/`, `html/`, `surefire/`), sau đó tới thư mục mặc định của tool | `test_report_analysis.md` |
| **MANUAL** | Báo cáo từ `/execute-test-cases` hoặc `/retest-fixed-bugs` | `docs/executions/<module>/run_*/execution_report.md` và `retest_*/retest_report.md` | `docs/executions/<module>/analysis_<timestamp>.md` |

## 2. Quy Trình Thực Thi Theo Nhánh

### Nhánh A — AUTOMATION Report
1. **Parse & Summarize:** Trích xuất tổng số test, `PASS`, `FAIL`, `SKIP`, `FLAKY` (pass sau retry), thời gian chạy.
2. **Classify & Group:** Đọc error message + stack trace thực tế của từng test fail, phân loại vào 6 nhóm trong `skills-test-report-analyzer` § 2.1 (`🐛 Application Bug`, `🎯 Locator Hỏng`, `⏱️ Flaky/Timing`, `📊 Test Data`, `🌐 Environment`, `🧪 Test Script`) và gom các test hỏng cùng điểm gốc (cùng Page Object / API).
3. **Compare Trend:** Nếu có report lần chạy trước, chỉ ra `🆕 Mới fail`, `🔁 Fail liên tục`, `✅ Đã fix`.
4. **Xuất `test_report_analysis.md`:** Kèm thứ tự xử lý ưu tiên và lệnh tiếp theo (`/create-bug-report`, `/heal-locators`, `/analyze-flaky-tests`, `/run-and-fix-tests`).

### Nhánh B — MANUAL Report (`execution_report.md` / `retest_report.md`)
1. **Kiểm tra 3 Tín Hiệu Sống Còn (Mục 2.2 trong skill) TRƯỚC khi kết luận:**
   - **Tỷ lệ `BLOCKED`:** Đọc mục `## 4. TC BLOCKED` trước tiên. Nếu `BLOCKED > 20%`, gắn cảnh báo `⛔ Không đủ dữ liệu kết luận chất lượng` ở ngay đầu báo cáo và yêu cầu mở khóa môi trường.
   - **Nợ kiểm thử (`SKIPPED` do Auto-Skip):** Tách riêng danh sách các TC thao tác phá huỷ cần chạy có giám sát trên môi trường riêng.
   - **Dữ liệu chưa dọn:** Kiểm tra mục `## 5. Dữ liệu đã tạo & dọn dẹp` — cảnh báo ngay nếu có dòng `Đã xoá? ❌`.
2. **Phân loại từng TC FAIL dựa trên `Expected` vs `Actual` (và đối chiếu `docs/testcases/<module>/` nếu cần):**
   - `Expected` có căn cứ `REQ ID` và hệ thống làm sai → `🐛 Bug ứng dụng` (`/create-bug-report`).
   - `Expected` mơ hồ hoặc do người viết TC tự suy đoán → `📝 TC viết sai` (`/review-testcases`).
   - Hệ thống chạy theo yêu cầu mới, TC giữ yêu cầu cũ → `📄 Requirement đã đổi` (`/update-requirements-from-ticket` → `/update-testcases-from-impact`).
   - Ngoài ra: `🌐 Môi trường`, `📊 Nhiễu Test Data`, `🔁 Regression sau fix`.
3. **So sánh Trend giữa các Run cùng module (nếu có $\ge 2$ run cùng nguồn TC):** Chỉ ra `🆕 Mới fail`, `🔁 Fail liên tục`, `✅ Vừa được fix`, `⚠️ Chuyển sang BLOCKED`.
4. **Xuất `docs/executions/<module>/analysis_<timestamp>.md`:** Đầy đủ 8 mục: `0. Mức tin cậy của lần chạy` · `1. Tổng quan` · `2. Phân loại FAIL theo nguyên nhân gốc` · `3. TC BLOCKED` · `4. Nợ kiểm thử (SKIPPED)` · `5. Trend giữa các lần chạy` · `6. Cảnh báo môi trường` · `7. Thứ tự xử lý đề xuất`.
