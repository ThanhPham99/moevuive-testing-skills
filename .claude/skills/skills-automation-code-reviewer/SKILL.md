---
name: skills-automation-code-reviewer
description: "Review and fix existing test automation code against the 6-group Definition of Done rubric (cleanup, POM, smart waits, test data, Allure reporting, assertions)."
---

# Automation Code Reviewer

## 1. Vai trò & Khi nào sử dụng

Chấm điểm và khắc phục chất lượng **mã nguồn Test Automation hiện có** theo Rubric 6 nhóm (12 điểm) và Definition of Done của repo — không viết lại framework từ đầu.
- **Khi dùng:** Trước khi bàn giao/merge script mới, onboard suite có sẵn, nghi ngờ "pass giả" (assertion yếu, thiếu step report), hoặc rà soát định kỳ trước release.
- **Không dùng khi:** Test đang FAIL (→ `/run-and-fix-tests`), test chập chờn (→ `/analyze-flaky-tests`), hoặc locator gãy hàng loạt (→ `/heal-locators`).

---

## 2. Rubric Chấm Điểm 6 Nhóm (Thang 12 Điểm)

Chấm từng file test / Page Object từ `0–2` điểm mỗi nhóm (`🟢 10–12`: Đạt · `🟡 6–9`: Cần sửa · `🔴 0–5`: Chặn bàn giao):

| # | Nhóm | Câu hỏi kiểm tra cốt lõi |
|---|---|---|
| 1 | **Sạch (Cleanup)** | Còn `console.log` / `System.out.println` / `print()`? Còn code comment-out, import thừa, locator không dùng? |
| 2 | **POM & Cấu trúc** | Locator nằm hết trong Page class (không inline trong test)? Assertion nằm ngoài Page class? Đúng chuẩn đặt tên? |
| 3 | **Wait Strategy** | Còn `waitForTimeout` / `Thread.sleep` / `time.sleep`? Đã dùng smart wait (`expect()`, `WebDriverWait`)? |
| 4 | **Test Data** | Dữ liệu unique có traceable (`[prefix]_[name]_[ts]`)? Còn hardcode (`test@email.com`)? Có dọn dữ liệu sau khi chạy? |
| 5 | **Report (Allure)** | Đủ 5 metadata (Title Tiếng Việt, Description, Severity, Tags, TC ID)? Có step `Arrange:`/`Act:`/`Assert:`? Có screenshot cuối **mọi** test (PASS & FAIL)? Không đính kèm `stdout`/`stderr`? |
| 6 | **Assertion & Độc lập** | Mỗi test có $\ge 1$ assertion nghiệp vụ kèm message? Không phụ thuộc thứ tự chạy? |

### 5 Vi Phạm Chặn Bàn Giao Tức Thì (Blocking 🔴 — Bất Kể Tổng Điểm)
1. **Hard sleep bất kỳ đâu** (`waitForTimeout`, `Thread.sleep`, `time.sleep`).
2. **Test không có assertion** hoặc chỉ assert phần tử tồn tại sẵn trước hành động (pass giả).
3. **Locator dùng dynamic class** (`css-1a2b3c`, `sc-xxx`) hoặc **XPath tuyệt đối bám vị trí** (`//div[3]/button[2]`).
4. **Thiếu screenshot cuối mỗi test** (`trang_thai_cuoi_cua_test` / `trang_thai_khi_that_bai`).
5. **Credentials thật nằm trong code** hoặc file config được commit.

---

## 3. Bộ Pattern Quét Nhanh & Đánh Giá Sức Mạnh Assertion

| Vi phạm | Biểu thức Grep khoanh vùng |
|---|---|
| Hard sleep | `waitForTimeout\|Thread\.sleep\|time\.sleep\|setTimeout\(` |
| Debug log | `console\.log\|System\.out\.print\|print\(` |
| Locator inline trong test | Trong thư mục test: `page\.locator\(\|By\.\|getByRole\(` |
| Dynamic class / XPath vị trí | `css-[0-9a-z]{6}\|sc-[A-Za-z]\|\]\[[0-9]\+\]\|div\[[0-9]\+\]` |
| Credentials / Data hardcode | `password\s*=\s*["']\|api[_-]?key\s*=\s*["']\|@test\.com\|admin123` |

### Đối chiếu Assertion Yếu vs Đủ Mạnh
| ❌ Assertion yếu (Nguy cơ Pass Giả) | ✅ Assertion đủ mạnh |
|---|---|
| `expect(page).toHaveURL(/./)` | `expect(page).toHaveURL(/\/dashboard/)` |
| `expect(el).toBeVisible()` (phần tử có sẵn trước Act) | Kiểm chứng **thay đổi trạng thái** sau Act (bản ghi mới, toast message) |
| `assertTrue(list.size() > 0)` (không message) | `assertEquals(list.get(0).getName(), expectedName, "Mô tả kỳ vọng")` |

---

## 4. Quy Trình 6 Bước & Mẫu Báo Cáo Review

1. **Xác định phạm vi** → 2. **Quét nhanh bằng Grep** → 3. **Đọc từng file chấm 6 nhóm (trích `file:line`)** → 4. **Soi sức mạnh Assertion** → 5. **Kiểm mức Suite (`reports/`, `.gitignore`)** → 6. **Xuất báo cáo (Mode REVIEW) hoặc sửa trực tiếp & chạy lại test (Mode FIX)**.

```markdown
# Báo Cáo Review Automation Code
- **Phạm vi:** <thư mục/file> · **Stack:** <stack> · **Kết quả:** 🟢 a đạt | 🟡 b cần sửa | 🔴 c chưa đạt (TB: x.x/12)

## 1. Vi phạm chặn bàn giao (Bắt buộc sửa trước khi deliver)
| # | File:line | Vi phạm | Code hiện tại | Code đề xuất |
|---|---|---|---|---|

## 2. Bảng chấm điểm từng file & Assertion yếu
| File | Sạch | POM | Wait | Data | Report | Assert | Tổng | Xếp loại |
|---|---|---|---|---|---|---|---|---|
```

---

## 5. Tham chiếu

- [`references/REVIEW_REPORT_TEMPLATE_AND_FIX_FLOW.md`](references/REVIEW_REPORT_TEMPLATE_AND_FIX_FLOW.md) — Mẫu báo cáo review chi tiết và quy trình sửa tự động an toàn (Mode FIX)
- [`.claude/rules/automation_rules.md`](../../rules/automation_rules.md) · [`.claude/rules/reporting_rules.md`](../../rules/reporting_rules.md) · [`.claude/rules/locator_strategy.md`](../../rules/locator_strategy.md)
- [`skills-testcase-reviewer`](../skills-testcase-reviewer/SKILL.md) — Bản đối xứng review Manual Test Cases
