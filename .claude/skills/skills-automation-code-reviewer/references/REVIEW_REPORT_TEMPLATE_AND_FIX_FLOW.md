# Mẫu Báo Cáo Review Code Automation & Quy Trình Sửa (Mode FIX)

> Tài liệu tham chiếu mẫu báo cáo review chi tiết và quy trình tự sửa an toàn cho [`skills-automation-code-reviewer`](../SKILL.md).

## 1. Mẫu Báo Cáo Review Đầy Đủ

```markdown
# Báo Cáo Review Automation Code — <Module / Phạm vi>
- **Framework:** `<Playwright TS / Selenium Java / Appium Java / Pytest>`
- **Số file đã quét:** `N Page Objects, M Test Specs`
- **Tổng điểm Rubric:** `XX / 12` (`🟢 Đạt chuẩn DoD` / `🟡 Cần khắc phục` / `🔴 Vi phạm nghiêm trọng`)

## 1. Bảng Điểm Theo 6 Nhóm Rubric
| Nhóm | Tiêu chí | Điểm (0–2) | Số vi phạm | Tóm tắt phát hiện chính |
|---|---|---|---|---|
| 1 | Code sạch & Cấu trúc | x/2 | n | ... |
| 2 | POM & Locator | x/2 | n | ... |
| 3 | Smart Waits | x/2 | n | ... |
| 4 | Test Data & Độc lập | x/2 | n | ... |
| 5 | Allure Reporting & Evidence | x/2 | n | ... |
| 6 | Assertions (Chống Pass Giả) | x/2 | n | ... |

## 2. Danh Sách Vi Phạm Chi Tiết
| # | Mức độ | Nhóm | Vị trí (`file:line`) | Code hiện tại | Cách sửa đề xuất |
|---|---|---|---|---|---|
| 1 | 🔴 Blocker | Nhóm 6 | `tests/login.spec.ts:42` | `expect(true).toBe(true)` | `await expect(loginPage.errorAlert).toHaveText('...')` |
```

## 2. Quy Trình Sửa Tự Động An Toàn (Mode FIX)

1. **Ưu tiên sửa theo mức độ:** Sửa nhóm 🔴 Blocker (pass giả, hard sleep, thiếu `testId`) trước, sau đó đến 🟡 Major (inline locator chuyển về Page Object, bổ sung Allure step/metadata) và 🟢 Minor (xoá import thừa, `console.log`).
2. **Bảo toàn logic kiểm thử:** Khi chuyển inline locator từ test spec vào Page Object, giữ nguyên hành vi tương tác và đối chiếu DOM thật nếu locator cũ mong manh.
3. **Chạy lại kiểm chứng bắt buộc:** Sau khi sửa xong, chạy lại test suite với `--repeat-each=2 --retries=0` (hoặc tương đương) để chứng minh mọi test vẫn PASS ổn định $\ge 2$ lần liên tiếp.
