---
name: skills-coverage-traceability
description: "Build Requirements Traceability Matrices (RTM) mapping Requirements (REQ ID) to Manual Test Cases (TC ID) and Automation Scripts, highlighting coverage gaps and orphan tests."
---

# Coverage & Traceability Matrix

Purpose: Xây dựng Requirements Traceability Matrix (RTM) để trả lời 3 câu hỏi: requirement nào chưa có test? TC nào chưa automate? test nào đang mồ côi?

---

## When to Use

Sử dụng skill này khi:

- User yêu cầu "ma trận truy vết", "RTM", "coverage report", "requirement nào chưa có test"
- Trước release — cần chứng minh độ phủ test cho stakeholder
- Sau khi sinh TC/automation — cần đối soát với requirements
- Audit bộ test cũ: tìm test thừa (mồ côi) và requirement bị bỏ sót

---

## Input Sources

| Nguồn | Định dạng chấp nhận | Cách nhận diện |
|---|---|---|
| **Requirements** | Requirement Index (`requirements_<module>.md`), Jira export, file phân tích từ `skills-requirements-analyzer` | ID dạng `REQ-<MODULE>-<NN>`, `STORY-<MODULE>-<NN>`, hoặc heading đánh số |
| **Manual Test Cases** | Markdown, Excel/CSV | ID dạng `TC_xxx` |
| **Automation Scripts** | `.spec.ts`, `*Test.java`, `.py` | Tên test method/block, annotation/tag chứa TC ID |

> Nếu thiếu 1 trong 3 nguồn → vẫn sinh RTM 2 chiều với nguồn có sẵn, ghi chú rõ phần thiếu. Nếu TC/test không có ID chuẩn → đề xuất bổ sung ID trước, hoặc map tạm theo tên/mô tả (đánh dấu ⚠️ map suy luận).

---

## Mapping Rules

1. **Map bằng ID là chuẩn nhất** — TC ghi `REQ-001` trong cột Requirement; automation ghi TC ID trong tag/annotation:
   ```typescript
   // Playwright — tag trong tên test
   test('TC_LOGIN_01 - đăng nhập thành công', ...)
   ```
   ```java
   // TestNG — description hoặc groups
   @Test(description = "TC_LOGIN_01")
   ```
2. **Map bằng nội dung khi thiếu ID** — so khớp mô tả TC với tên test method; kết quả đánh dấu ⚠️ cần người xác nhận
3. **1 requirement có thể map nhiều TC** và ngược lại — RTM là quan hệ n-n
4. **KHÔNG bịa mapping** — không chắc thì để trống và liệt kê vào mục "cần xác nhận"

---

## Coverage Metrics

| Metric | Công thức | Ý nghĩa |
|---|---|---|
| **Requirement Coverage** | # REQ có ≥1 TC / tổng REQ | Requirement nào chưa được test |
| **Automation Coverage** | # TC có ≥1 script / tổng TC | TC nào còn chạy tay |
| **Orphan Tests** | # test không map về REQ nào | Test thừa hoặc requirement chưa được ghi nhận |

---

## Workflow

1. **Thu thập** — đọc 3 nguồn input; xác định format ID của từng nguồn
2. **Trích xuất** — liệt kê toàn bộ REQ ID, TC ID, test method (kèm file path)
3. **Map** — nối 3 tầng theo Mapping Rules; tách riêng mapping chắc chắn và mapping suy luận ⚠️
4. **Tính metrics** — 3 chỉ số coverage
5. **Phát hiện gap:**
   - REQ không có TC → gap nghiêm trọng nhất, đề xuất sinh TC (dùng `skills-rbt-manual-testing`)
   - TC không có automation → đề xuất thứ tự automate theo priority của TC
   - Test mồ côi → đề xuất: bổ sung requirement, gắn ID, hoặc xóa nếu thừa
6. **Xuất RTM** — file `traceability_matrix.md` (kèm CSV nếu user cần import Excel)

---

## RTM Template

```markdown
# Ma Trận Truy Vết (RTM) — <Tên dự án/module>

## Tổng quan Coverage
| Metric | Giá trị |
|---|---|
| Requirement Coverage | 18/20 (90%) |
| Automation Coverage | 35/50 TC (70%) |
| Orphan Tests | 3 |

## Ma trận chi tiết
| REQ ID | Mô tả ngắn | TC IDs | Automation | Trạng thái |
|---|---|---|---|---|
| REQ-001 | Đăng nhập email | TC_LOGIN_01, TC_LOGIN_02 | login.spec.ts (2/2) | ✅ Full |
| REQ-002 | Quên mật khẩu | TC_PW_01 | — | 🟡 Manual only |
| REQ-003 | Khóa account sau 5 lần sai | — | — | 🔴 NOT COVERED |

## 🔴 Requirements chưa được cover (ưu tiên xử lý)
| REQ ID | Mô tả | Đề xuất |
|---|---|---|
| REQ-003 | ... | Sinh TC bằng /generate-testcases-from-requirements |

## 🟡 TC chưa automate (đề xuất thứ tự theo priority)
| TC ID | Priority | Ghi chú |
|---|---|---|

## ⚪ Orphan tests (không map về REQ nào)
| Test | File | Đề xuất |
|---|---|---|

## ⚠️ Mapping suy luận — cần người xác nhận
| REQ | TC/Test | Căn cứ suy luận |
|---|---|---|
```

---

## Quality Checklist

- [ ] Mọi REQ/TC/test trong nguồn input đều xuất hiện trong RTM (không bỏ sót)
- [ ] Mapping suy luận được tách riêng, không trộn với mapping có ID
- [ ] Metrics tính đúng, khớp số dòng trong ma trận
- [ ] Gap có đề xuất hành động kèm command/skill cụ thể
- [ ] Không tự ý sửa file TC/test khi chưa được yêu cầu

## Delta Impact Mapping (`TC_ID ↔ Automation Script` — `/update-automation-from-impact`)

Khi đồng bộ mã nguồn Automation theo `Impact Report` hoặc `Delta TC List` (`PLAN` / `APPLY` modes):
1. **3 Mức độ tin cậy khi ánh xạ `TC_ID → Script/POM`:**
   - `✅ Chắc chắn`: Khớp nhãn `allure.label('testId', 'TC_xxx')` hoặc mã `TC_xxx` trong tên hàm/annotation test.
   - `⚠️ Suy luận`: Khớp theo mô tả ngữ nghĩa (bắt buộc tách riêng trong kế hoạch để người dùng xác nhận trước khi sửa).
   - `❓ Chưa automate`: Ghi nhận vào báo cáo, không chạm vào code; các TC `➕ Viết mới` điều hướng sang `/generate-automation-from-testcases`.
2. **Ma trận hành động Delta (`reports/automation_impact_plan.md`):**
   - Đổi `Expected Result` → chỉ sửa đúng dòng assertion tại `file:line`.
   - Đổi `Steps` / thêm `UI Field mới` → cập nhật hàm trong Page Object + lấy locator thật từ DOM (mặc định **Headless Mode `1920x1080`**).
   - Đổi `Validation / Test Data` → cập nhật dữ liệu đầu vào (giữ chuẩn traceable `auto_<module>_<timestamp>`).
   - `🗑️ Archive TC` → **cấm tự ý xóa file script**; chỉ gắn `test.skip(...)` / `@Test(enabled = false)` kèm comment mã ticket.
3. **Kiểm chứng 2 lớp (`Mode = APPLY`):** (a) Các bài test vừa sửa phải **PASS 2 lần liên tiếp**, và (b) toàn bộ bài test khác dùng chung Page Object vừa sửa phải chạy xanh không hồi quy.

---

## Rules References

- `.claude/skills/skills-requirements-analyzer/SKILL.md` — Nguồn requirements & Impact Report chuẩn
- `.claude/skills/skills-rbt-manual-testing/SKILL.md` — Sinh TC lấp gap & Delta TC List
- `.claude/skills/skills-testcase-reviewer/SKILL.md` — Review chất lượng TC hiện có
