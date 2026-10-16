---
name: analyze-flaky-tests
description: "Phân tích automation tests không ổn định (flaky), xác định root cause và tự động khắc phục theo 2 mode — ANALYZE (chỉ báo cáo) và FIX (báo cáo + sửa code + verify)."
skills:
  - skills-flaky-test-analyzer
---

# Workflow: Phân Tích & Khắc Phục Flaky Tests (`/analyze-flaky-tests`)

> **Context Pointer:** Nạp và thực thi theo [`.claude/skills/skills-flaky-test-analyzer/SKILL.md`](../../../.claude/skills/skills-flaky-test-analyzer/SKILL.md). Khi cần thay thế locator hỏng, tham chiếu thêm [`skills-locator-healer-agent`](../../../.claude/skills/skills-locator-healer-agent/SKILL.md) và [`.claude/rules/locator_strategy.md`](../../../.claude/rules/locator_strategy.md).

## 1. Nhận Diện Chế Độ (Mode) & Thu Thập Input

| Mode | Khi nào kích hoạt | Đầu ra |
|---|---|---|
| **ANALYZE** *(mặc định)* | User cần chẩn đoán nguyên nhân flaky, chưa yêu cầu sửa code | Báo cáo `flaky_analysis.md` + Bảng đề xuất fix |
| **FIX** | User yêu cầu *"sửa luôn"*, *"fix giùm"*, *"khắc phục test này"* | Báo cáo `flaky_analysis.md` + Code đã sửa + Kết quả chạy lại 3 lần liên tiếp |

| Input cần thu thập | Bắt buộc? | Cách lấy |
|---|---|---|
| **Test file path** | ⭐ Bắt buộc | User cung cấp hoặc tìm trong repo |
| **Error log / Stack trace** | ⭐ Bắt buộc | User cung cấp hoặc agent tự chạy test 3 lần để thu thập |
| **CI/CD log / Report HTML/JSON** | Tùy chọn | Dùng để đối chiếu môi trường CI vs local |

## 2. Quy Trình Thực Thi

### Bước 1: Tái hiện lỗi & Thu thập bằng chứng (Detect & Reproduce)
1. Đọc file test và các Page Object / Fixture liên quan.
2. Nếu chưa có log lỗi, chạy test **3 lần liên tiếp** không retry (mặc định **Headless Mode** `1920x1080`):
   - Playwright: `npx playwright test <test_file> --retries=0 --repeat-each=3 --reporter=list`
   - Pytest: `python -m pytest <test_file> -v --count=3`
   - Maven/TestNG: `mvn test -Dtest=<TestClass> -Dsurefire.rerunFailingTestsCount=0`

### Bước 2: Phân tích Root Cause (Inspect & Classify)
1. Phân loại nguyên nhân theo `skills-flaky-test-analyzer`:
   - 🎯 **Unstable Locator** (dynamic class `css-xxx`, positional XPath)
   - ⏱️ **Timing / Race Condition** (hard sleep `waitForTimeout`/`Thread.sleep`, thiếu web-first assertion)
   - 📊 **Test Data Conflict** (dữ liệu hardcode đụng độ khi chạy song song 5 luồng)
   - 🔄 **State Dependency / Cleanup** (phụ thuộc thứ tự test khác)
   - 🌐 **Environment / Viewport** (lệch cấu hình CI vs local)
2. Nếu cần đối chiếu DOM thực tế: mở trang qua Playwright MCP (mặc định **Headless Mode** `1920x1080`; dùng `node scripts/browser-mode.mjs headed` nếu cần quan sát trực tiếp) theo chuỗi `browser_navigate` → `browser_wait_for` → `browser_snapshot`.

### Bước 3: Lập báo cáo `flaky_analysis.md` (⏸️ HITL Checkpoint)
1. Ghi báo cáo `flaky_analysis.md` gồm: Tổng quan tần suất fail, Bảng Root Cause (`Vị trí file:line` × `Category` × `Mô tả`), và Bảng Đề xuất Fix (`Code hiện tại` → `Code đề xuất`).
2. **⏸️ DỪNG LẠI** trình bày báo cáo cho user xác nhận:
   - Nếu đang ở **Mode ANALYZE**: kết thúc tại đây.
   - Nếu ở **Mode FIX** và user xác nhận: sang Bước 4.

### Bước 4: Sửa Code & Kiểm Chứng Ổn Định (Chỉ Mode FIX)
1. Áp dụng bản vá (thay locator bền vững, đổi sang smart wait `expect()`/`WebDriverWait`, tạo dữ liệu unique theo timestamp, tách state).
2. Chạy lại test **3 lần liên tiếp** (`--retries=0`):
   - **3/3 PASS:** Đánh dấu `✅ STABILIZED` trong `flaky_analysis.md`.
   - **Còn FAIL:** Phân tích vòng lặp tối đa 3 lần; nếu do bug ứng dụng thì giữ nguyên đỏ và báo user.
3. Kiểm tra **Stability Checklist** trong `skills-flaky-test-analyzer` trước khi bàn giao.