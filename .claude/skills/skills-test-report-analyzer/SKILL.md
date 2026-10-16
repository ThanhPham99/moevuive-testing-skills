---
name: skills-test-report-analyzer
description: "Analyze automated (Playwright, Allure, JUnit, TestNG, Pytest) and manual (execution_report.md, retest_report.md) test reports, classify root causes, compare run trends, and prioritize fixes."
---

# Test Report Analyzer

Đọc và phân tích kết quả của **một đợt chạy kiểm thử** (Automation hoặc Manual), gom nhóm lỗi theo nguyên nhân gốc (root cause), so sánh xu hướng giữa các lần chạy (trend) và đề xuất thứ tự xử lý ưu tiên.

> Để tổng hợp nhiều module toàn dự án tại một mốc phát hành kèm khuyến nghị Go/No-Go cho PM/PO, sử dụng [`skills-test-summary-reporter`](../skills-test-summary-reporter/SKILL.md).

---

## 1. Nguồn Báo Cáo Hỗ Trợ

### 1.1 Báo cáo Automation (Ưu tiên tìm trong `reports/`)

| Framework | Định dạng | Vị trí chuẩn (`reports/`) | Vị trí mặc định của công cụ |
|---|---|---|---|
| **Playwright** | JSON, HTML | `reports/html/`, `reports/test-artifacts/` | `playwright-report/`, `test-results/` |
| **Allure** | JSON results | `reports/allure-results/`, `reports/allure-report/` | `allure-results/`, `allure-report/` |
| **JUnit / Surefire** | XML | `reports/surefire/` | `target/surefire-reports/` |
| **TestNG** | XML (`testng-results.xml`) | `reports/surefire/` | `test-output/` |
| **Pytest** | JUnit XML, HTML | `reports/html/` | Do dự án cấu hình |

### 1.2 Báo cáo Manual (Markdown)
- **Execution Report:** `docs/executions/<module>/run_*/execution_report.md` (từ `/execute-test-cases`).
- **Retest Report:** `docs/executions/<module>/retest_*/retest_report.md` (từ `/retest-fixed-bugs`).

---

## 2. Phân Loại Nguyên Nhân Lỗi (Root-Cause Classification)

### 2.1 Nhóm lỗi cho Automation Report (Dựa trên Error Message & Stack Trace thực tế)

| Category | Dấu hiệu nhận diện | Hành động đề xuất |
|---|---|---|
| 🐛 **Application Bug** | Assertion fail với dữ liệu đầu vào hợp lệ, hành vi hệ thống lệch spec | Tạo bug report qua [`skills-bug-reporter`](../skills-bug-reporter/SKILL.md) (`/create-bug-report`) |
| 🎯 **Locator Hỏng** | `ElementNotFound`, `Timeout waiting for selector`, `strict mode violation` | Chữa lành locator qua [`skills-locator-healer-agent`](../skills-locator-healer-agent/SKILL.md) (`/heal-locators`) |
| ⏱️ **Flaky / Timing** | Pass sau retry, fail ngẫu nhiên do race condition / animation / network | Chẩn đoán qua [`skills-flaky-test-analyzer`](../skills-flaky-test-analyzer/SKILL.md) (`/analyze-flaky-tests`) |
| 📊 **Test Data** | `Duplicate key`, `404 Not Found` bản ghi mẫu, xung đột khi chạy 5 luồng | Sửa hàm sinh dữ liệu unique theo timestamp |
| 🌐 **Environment** | `ECONNREFUSED`, `502/503/504`, toàn bộ suite fail hàng loạt | Khắc phục môi trường trước, giữ nguyên code test |
| 🧪 **Test Script** | Lỗi cú pháp, sai import, viết nhầm điều kiện assert | Sửa trực tiếp trong test script |

### 2.2 Nhóm lỗi & 3 Tín Hiệu Sống Còn cho Manual Report (Dựa trên Expected vs Actual)

| Category | Dấu hiệu trong `execution_report.md` / `retest_report.md` | Hành động đề xuất |
|---|---|---|
| 🐛 **Bug ứng dụng** | Actual lệch Expected có căn cứ REQ, tái hiện được | `/create-bug-report` |
| 📝 **TC viết sai / mơ hồ** | Expected không đo lường được, thiếu Pre-Condition | `/review-testcases` |
| 📄 **Requirement đã đổi** | Ứng dụng chạy theo logic mới, TC vẫn giữ kỳ vọng cũ | `/update-requirements-from-ticket` → `/update-testcases-from-impact` |
| 🌐 **Môi trường / Chặn** | Nhiều TC bị `BLOCKED` do thiếu quyền/môi trường lỗi | Khắc phục môi trường trước khi kết luận chất lượng |
| 📊 **Nhiễu Test Data** | Bản ghi mẫu bị người khác sửa/xóa trên môi trường dùng chung | Tạo lại dữ liệu qua `/generate-test-data` |
| 🔁 **Regression sau fix** | Lỗi mới xuất hiện trong mục "Regression phát sinh do fix" | Báo bug mới với độ ưu tiên cao |

**3 tín hiệu bắt buộc kiểm tra trên Manual Report:**
1. **Tỷ lệ `BLOCKED`:** $\le 5\%$ bình thường · $5\text{–}20\%$ cảnh báo đầu báo cáo · **$> 20\%$ dừng kết luận chất lượng** (yêu cầu mở khóa môi trường và chạy lại).
2. **Nợ kiểm thử từ `SKIPPED` (Auto-Skip):** Gom riêng các TC bị skip do thao tác phá huỷ trên môi trường dùng chung thành danh sách *"Cần chạy tay có giám sát trên môi trường riêng"*.
3. **Dữ liệu chưa dọn (`Đã xoá? ❌` ở mục 5):** Cảnh báo ngay nguy cơ làm nhiễu lần chạy kế tiếp.

---

## 3. So Sánh Xu Hướng (Trend Analysis) & Quy Trình 7 Bước

1. **Locate & Parse:** Đọc file report hiện tại (và các bản chạy trước cùng nguồn TC nếu có).
2. **Summarize:** Thống kê tổng số test, PASS, FAIL, BLOCKED, SKIP, FLAKY (pass sau retry), thời lượng chạy.
3. **Classify & Group:** Phân loại từng failure và gom các test hỏng cùng một điểm gốc (cùng Page Object, cùng endpoint API, cùng Pre-Condition).
4. **Compare Trend (Giữa các lần chạy cùng nguồn TC):**
   - 🆕 **Mới fail** (`PASS → FAIL`): Ưu tiên số 1 — nghi ngờ regression từ bản build mới.
   - 🔁 **Fail liên tục** (`FAIL ≥ 2 lần`): Kiểm tra đã có mã `BUG_*` chưa.
   - ✅ **Đã fix** (`FAIL → PASS`): Đối chiếu lịch sử retest.
   - ⚠️ **Mới bị chặn** (`→ BLOCKED`): Cảnh báo suy giảm môi trường test.
5. **Xuất Báo Cáo Phân Tích:**

```markdown
# Báo Cáo Phân Tích Test Run

## 1. Tổng quan
| Chỉ số | Giá trị |
|---|---|
| Tổng số test | N |
| ✅ PASS | x (x%) |
| ❌ FAIL | y |
| ⚠️ BLOCKED / ⏭️ SKIP | b / z |
| 🔁 FLAKY (pass sau retry) | w |
| Thời gian chạy | mm:ss |

## 2. Phân loại Failure (Gom theo Root Cause)
| Category | Số lượng | Danh sách TC / Test | Nguyên nhân gốc & Hành động đề xuất |
|---|---|---|---|
| 🐛 Application Bug | 2 | TC_01, TC_05 | Lỗi 500 tại API tạo đơn → `/create-bug-report` |
| 🎯 Locator hỏng | 3 | LoginSpec, ... | Nút Submit đổi label → `/heal-locators` |

## 3. Xu hướng so với lần chạy trước (Nếu có)
- 🆕 Mới fail: ...
- 🔁 Fail liên tục: ...
- ✅ Đã fix: ...

## 4. Thứ tự xử lý ưu tiên
1. Khắc phục sự cố Môi trường / BLOCKED chặn diện rộng.
2. Lập Bug Report cho các lỗi sản phẩm (🐛).
3. Sửa Locator / Flaky / Test Data thuộc phạm vi QA.
```

---

## 4. Quy Trình Thực Thi & Tự Động Sửa Lỗi Suite (`/run-and-fix-tests` — `RUN` / `FIX` Modes)

1. **Nguyên tắc bất khả xâm phạm với `🐛 Application Bug`:** Tuyệt đối **CẤM sửa bài test cho xanh khi nguyên nhân là lỗi ứng dụng** (cấm nới lỏng assertion, cấm đổi `expected` theo `actual` sai, cấm gắn `.skip` / `@Ignore` để giấu lỗi). Mọi `🐛 Application Bug` phải giữ nguyên trạng thái đỏ và chuyển sang `/create-bug-report`. Nếu gặp `🌐 Environment` (server sập, lỗi biên dịch/mạng) → dừng ngay, không sửa code.
2. **Báo cáo `reports/run_and_fix_report.md` (HITL Checkpoint ⏸️):** Xuất bảng tổng quan (`PASS`/`FAIL`/`SKIP`/`FLAKY`), bảng gom cụm theo Root Cause (VD: 8 test cùng gãy tại 1 hàm Page Object gom thành 1 cụm), và tách bạch **Danh sách Sẽ Sửa (`🎯`/`📊`/`🧪`/`⏱️`)** vs **Danh sách Không Sửa (`🐛`/`🌐`)**. Dừng chờ duyệt trước khi sửa ở `Mode = FIX`.
3. **Thứ tự sửa & Kiểm chứng (`Mode = FIX`):** Sửa tuần tự `🎯 Broken Locator` (kiểm chứng trên DOM thật ở **Headless Mode `1920x1080`**) → `📊 Test Data` (`auto_<module>_<timestamp>`) → `🧪 Test Script` → `⏱️ Flaky / Timing`. Chạy lại tối đa 3 vòng; mỗi bài test được sửa phải **PASS 2 lần liên tiếp** (nếu không giải quyết được nguyên nhân gốc thì rollback thay đổi đó) và cập nhật `Pass Rate Baseline → Pass Rate Sau Khi Sửa`.
