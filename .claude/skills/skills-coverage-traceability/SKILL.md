---
name: skills-coverage-traceability
description: "Build Requirements Traceability Matrices (RTM) mapping Requirements (REQ ID) to Manual Test Cases (TC ID) and Automation Scripts, highlighting coverage gaps and orphan tests."
---

# Coverage & Traceability Matrix (RTM)

## 1. Vai trò & Khi nào sử dụng

Xây dựng **Ma Trận Truy Vết (Requirements Traceability Matrix — RTM)** nối 3 tầng `Requirements (REQ ID) ↔ Manual Test Cases (TC ID) ↔ Automation Scripts` để trả lời chính xác:
1. Requirement nào chưa có Test Case (`🔴 Uncovered`)?
2. Test Case nào chưa được tự động hóa (`🟡 Manual only`)?
3. Test Case / Script nào đang mồ côi (`⚪ Orphan`)?

**Trigger:** `/generate-traceability-matrix`, `/update-automation-from-impact`, kiểm tra độ phủ trước release, hoặc đối soát sau khi sinh TC/Automation.

---

## 2. Nguồn Dữ Liệu & Quy Tắc Ánh Xạ (Mapping Rules)

| Tầng dữ liệu | Nguồn chuẩn | Quy tắc nhận diện & đối chiếu |
|---|---|---|
| **1. Requirements** | `docs/requirements/<module>/requirements_<module>.md` (+ `stories/story_*.md`) | Mã `REQ-<MODULE>-<NN>` (hoặc `REQ-<SYS>-<MODULE>-<NN>`) |
| **2. Manual Test Cases** | `docs/testcases/<module>/test_cases_<module>.md` | Cột `TC ID` (`<PREFIX>_<MODULE>_TC_<NNN>`) và cột `REQ ID` |
| **3. Automation Scripts** | `*.spec.ts`, `*Test.java`, `test_*.py` | Nhãn `allure.label('testId', 'TC_xxx')` hoặc mã `TC_xxx` trong tên/annotation test |

- **Ưu tiên #1 — Chạy CLI đối soát tất định trước:**
  ```bash
  node scripts/validate-docs.mjs --check
  node scripts/validate-docs.mjs --rtm --module <module>
  ```
  Lệnh `--rtm` tự động trích xuất toàn bộ `REQ ID` (kể cả REQ tách theo `stories/`), phân loại REQ trong/ngoài phạm vi, nối với `TC ID` trong `test_cases_<module>.md` và sinh bảng RTM 5 cột trong `<50ms`.
- **Không bịa mapping:** Nếu phải ghép theo ngữ nghĩa (khi script thiếu `testId`), bắt buộc gắn cờ `⚠️ Suy luận` và tách vào bảng riêng chờ người dùng xác nhận.

---

## 3. Quy Trình 5 Bước & Mẫu Báo Cáo RTM Chuẩn (5 Cột)

1. **Chạy `node scripts/validate-docs.mjs --rtm [--module <slug>]`** để lấy khung ma trận `REQ ID ↔ TC ID` và các chỉ số cơ sở.
2. **Quét thư mục Automation** (nếu có) để nối `TC ID ↔ Script file` và tính `Automation Coverage`.
3. **Phân tích lỗ hổng (Gaps):**
   - `🔴 REQ chưa có TC` → đề xuất chạy `/generate-testcases-from-requirements` hoặc `/generate-testcases-manual-rbt`.
   - `🟡 TC chưa automate` → sắp xếp thứ tự ưu tiên theo `Priority` (`Critical` / `High` trước).
   - `⚪ Orphan tests` → đề xuất gắn lại `REQ ID`/`TC ID` hoặc dọn dẹp nếu thừa.
4. **Xuất file `traceability_matrix.md`** (tương thích trực tiếp với tab **RTM** của `scripts/execution-viewer/bundle.html`):

```markdown
# Ma Trận Truy Vết (RTM) — <Tên dự án / Module>

## Tổng quan độ phủ
| Chỉ số | Giá trị |
|---|---|
| Tổng REQ | 43 (Trong phạm vi: 39 · Ngoài phạm vi: 4) |
| REQ đã có TC | 39/39 (100%) |
| Automation Coverage | 35/50 TC (70%) · Orphan: 0 |

## Ma trận chi tiết
| REQ ID | Mô tả ngắn | TC IDs | Automation | Trạng thái |
|---|---|---|---|---|
| REQ-LOGIN-01 | Truy cập trang đăng nhập | CRM_LOGIN_TC_001, CRM_LOGIN_TC_039 | login.spec.ts | ✅ Full |
| REQ-LOGIN-02 | Thành phần biểu mẫu đăng nhập | CRM_LOGIN_TC_002, CRM_LOGIN_TC_038 | — | 🟡 Manual only |
| REQ-LOGIN-27 | Gửi liên kết đặt lại mật khẩu | — | — | ⚪ Out of scope |

## 🔴 Requirements chưa được cover · 🟡 TC chưa automate · ⚪ Orphan tests
```

---

## 4. Đồng Bộ Delta Sang Automation (`/update-automation-from-impact` — `PLAN` / `APPLY`)

Khi cập nhật mã nguồn Automation theo `Impact Report` hoặc `Delta TC List`:
1. **Phân loại độ tin cậy ánh xạ `TC_ID → Script/POM`:** `✅ Chắc chắn` (khớp `testId`/tên test) · `⚠️ Suy luận` (khớp ngữ nghĩa — chờ duyệt) · `❓ Chưa automate` (chuyển sang `/generate-automation-from-testcases`).
2. **Ma trận hành động Delta (`reports/automation_impact_plan.md`):**
   - Đổi `Expected Result` → chỉ sửa đúng dòng assertion tại `file:line`.
   - Đổi `Steps` / thêm `UI Field` → cập nhật method trong Page Object + lấy locator thật từ DOM (mặc định **Headless Mode `1920x1080`**).
   - Đổi `Validation / Test Data` → cập nhật dữ liệu đầu vào (giữ chuẩn traceable `auto_<module>_<timestamp>`).
   - `🗑️ Archive TC` → **cấm tự ý xóa file script**; chỉ gắn `test.skip(...)` / `@Test(enabled = false)` kèm comment mã ticket.
3. **Kiểm chứng 2 lớp (`Mode = APPLY`):** Các bài test vừa sửa phải **PASS $\ge 2$ lần liên tiếp**, và các bài test khác dùng chung Page Object phải chạy xanh không hồi quy.

---

## 5. Tham chiếu

- [`skills-requirements-analyzer`](../skills-requirements-analyzer/SKILL.md) · [`skills-rbt-manual-testing`](../skills-rbt-manual-testing/SKILL.md) · [`skills-testcase-reviewer`](../skills-testcase-reviewer/SKILL.md)
- CLI: `node scripts/validate-docs.mjs --rtm` · `node scripts/validate-docs.mjs --check`
