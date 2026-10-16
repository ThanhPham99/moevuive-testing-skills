---
name: skills-rbt-manual-testing
description: Sinh và cập nhật manual test cases theo 4 modes — QUICK (sinh nhanh 1 lượt từ requirements), FULL RBT (quy trình AI-RBT 6 bước tuần tự có đánh giá rủi ro và RTM), CHECKLIST (danh sách tick tay smoke/hotfix/regression/release) và DELTA (cập nhật bộ TC đã có theo Impact Report, bảo toàn TC ID).
---

# RBT Manual Testing — Master Skill & Orchestrator

Master Skill điều phối mọi tác vụ sinh mới và cập nhật manual test cases theo khung **Risk-Based Testing (RBT) 4 Vòng** (`V1 Smoke → V2 Functional → V3 Technical → V4 Non-functional`).

**Nguyên tắc cốt lõi:** **Human Strategy** (xác định chiến lược, mức rủi ro, chốt Q&A/kế hoạch) · **AI Execution** (đối chiếu evidence, thiết kế TC theo 4 vòng, tự kiểm định chất lượng) · **Human Verification** (duyệt tại các HITL checkpoint).

**Ranh giới:** Không dùng khi chỉ cần sinh automation code (`skills-qa-automation-engineer`), inspect DOM/locator (`skills-ui-debug-agent` / `skills-smart-locator-agent`), hoặc chỉ sinh bộ test data rời (`skills-test-data-generator`).

---

## 1. Mode Routing & Progressive Disclosure (Nạp Đúng Tài Liệu Theo Mode)

> 🚨 **Kiểm tra bắt buộc trước khi chọn `QUICK` / `FULL RBT`:** Module đã có `docs/testcases/<module>/test_cases_<module>.md` chưa? Nếu **đã có** và yêu cầu thay đổi theo ticket → **BẮT BUỘC dùng Mode `DELTA`**. Chạy `QUICK`/`FULL RBT` đè lên module đã có TC sẽ đánh lại `TC ID` từ `001` và làm đứt truy vết sang automation (`allure.label('testId', ...)`), RTM và execution reports.

| Mode & Command | Khi nào kích hoạt (Trigger Branches) | Tài liệu tham chiếu BẮT BUỘC nạp (`Read`) | Nhịp chạy & Checkpoint |
|---|---|---|---|
| **Mode 1: `QUICK`**<br>`/generate-testcases-from-requirements` | Sinh TC chi tiết nhanh từ requirements đã rõ, phạm vi 1 module/tính năng, không yêu cầu quy trình 6 bước | 1. [`MODES_QUICK_AND_FULL_RBT.md`](references/MODES_QUICK_AND_FULL_RBT.md)<br>2. [`FOUR_RINGS_AND_QUALITY_GATE.md`](references/FOUR_RINGS_AND_QUALITY_GATE.md)<br>3. [`FIELD_VALIDATION_15_TYPES.md`](references/FIELD_VALIDATION_15_TYPES.md) · [`COMPONENT_CHECKLIST.md`](references/COMPONENT_CHECKLIST.md) · [`DESIGN_TECHNIQUES.md`](references/DESIGN_TECHNIQUES.md) · [`ISO_25010_CHECKLIST.md`](references/ISO_25010_CHECKLIST.md) | **1 lượt duy nhất** (ghi `ASM-XX` nếu mơ hồ; đề xuất sang `FULL RBT` nếu >3 modules hoặc quá mơ hồ) |
| **Mode 2: `FULL RBT`**<br>`/generate-testcases-manual-rbt` | Hệ thống lớn/phức tạp, requirements còn điểm mờ cần Q&A, cần phân rã module, đánh giá Risk Level và Traceability Matrix | Như Mode `QUICK` (thực thi mục **Mode 2: FULL RBT 6 Bước** trong [`MODES_QUICK_AND_FULL_RBT.md`](references/MODES_QUICK_AND_FULL_RBT.md)) | **6 bước tuần tự** — dừng chờ user ở **Bước 2 (Q&A)** và **Bước 4 (Review 4 Vòng & RTM)** |
| **Mode 3: `CHECKLIST`**<br>`/generate-checklist-test` | Cần danh sách rà soát ngắn (1 dòng/mục, ≤2 phút/mục, có ô tick `☐`) cho Smoke, Post-hotfix, Regression module, hoặc Release-readiness | 1. [`MODE_CHECKLIST.md`](references/MODE_CHECKLIST.md)<br>2. Nạp chọn lọc [`FIELD_VALIDATION_15_TYPES.md`](references/FIELD_VALIDATION_15_TYPES.md) · [`COMPONENT_CHECKLIST.md`](references/COMPONENT_CHECKLIST.md) · [`ISO_25010_CHECKLIST.md`](references/ISO_25010_CHECKLIST.md) *(không nạp `MODE_DELTA.md`)* | **1 lượt duy nhất** (ưu tiên rút gọn `TC-based` nếu đã có bộ TC) |
| **Mode 4: `DELTA`**<br>`/update-testcases-from-impact` | Module **đã có** `test_cases_<module>.md`, requirements vừa đổi theo ticket / `Impact Report` — sửa TC stale tại chỗ và xuất `Delta TC List` | 1. [`MODE_DELTA.md`](references/MODE_DELTA.md)<br>2. [`FOUR_RINGS_AND_QUALITY_GATE.md`](references/FOUR_RINGS_AND_QUALITY_GATE.md) *(chỉ đối soát nhánh bị chạm)*<br>3. [`FIELD_VALIDATION_15_TYPES.md`](references/FIELD_VALIDATION_15_TYPES.md) *(nếu ticket thêm/sửa field)* | **2 chế độ con:** `PLAN` (dừng ở Bước 4) hoặc `APPLY` (sửa sau khi duyệt kế hoạch) |

**Khi ngữ cảnh chưa rõ mode**, hỏi user chọn 1 trong 4: `1. QUICK` · `2. FULL RBT` · `3. CHECKLIST` · `4. DELTA`.

---

## 2. Năm Quy Tắc Bất Biến Cốt Lõi (Core Invariants)

1. **Khung 4 Vòng Kiểm Thử (`Test Rings`) & Độ sâu theo Rủi ro:**
   - Sinh tuần tự không nhảy cóc: **`V1 Smoke`** (UI cơ bản · Open form · Display · Input valid · Save · Verify data) → **`V2 Functional`** (UI Behavior · Required · Validation 15 loại · EP · BVA · Business Rule · Decision Table · State Transition · Dependency · Use Case · CRUD · Error Guessing) → **`V3 Technical`** (Permission · Security · API · Database · Integration · Logging/Audit — đọc quyền cấp dự án từ dòng `Năng lực kiểm thử của QA` trong `docs/requirements/README.md`) → **`V4 Non-functional`** (Compatibility · Responsive · Accessibility · Performance · Regression · E2E).
   - Tự chấm Risk Level (`Cao` → **Đầy đủ** 40–60 TC · `Trung bình` → **Tiêu chuẩn** 20–30 TC · `Thấp` → **Tối giản** 8–12 TC; lưỡng lự chấm mức cao hơn) kèm dòng **"Nâng lên khi…"** ở đầu file.
   - **4 nhánh không bao giờ rút (`➖`/`⏭️`):** Toàn bộ `V1 Smoke` (đặc biệt `UI cơ bản`) · `V2 · Required + Validation` (khi có field nhập) · `V3 · Permission` (khi ≥2 role) · `V3 · Security` (khi chạm dữ liệu người khác).
   - **4 trạng thái đối soát:** `✅ Có TC` · `➖ Không áp dụng` (sự thật kỹ thuật + đơn vị chịu trách nhiệm) · `⏭️ Cố ý bỏ` (chấp nhận rủi ro thấp: ghi **lý do + ai quyết định + điều kiện rà lại**; cấm dùng lẫn `➖` và `⏭️`) · `🔴 Thiếu` (bổ sung trước khi xuất).
2. **Độ Hạt Test Case (`Granularity Mode`: `GỘP` mặc định vs `TÁCH`):**
   - Chốt trước Batch 1 và nêu ở dòng kế hoạch batch. Mặc định **`GỘP`** (Kiểu A: biến thể dữ liệu cùng trường & cùng loại phản hồi mã `a, b, c`; Kiểu B: kiểm tra tĩnh cùng màn hình mã `1, 2, 3`; **trần ≤ 6 biến thể/TC**, công bố `<N> TC · <M> biến thể`). Chỉ dùng **`TÁCH`** (1 biến thể = 1 TC) khi tính công/giao việc theo dòng TC, cần pass-rate từng biến thể, audit rời, hoặc user yêu cầu.
   - **CẤM gộp:** khác trường nhập liệu · khác cơ chế phản hồi · gộp `@Smoke` khác hành vi · TC thiết kế để FAIL (gắn bug riêng) · khác `REQ ID` không còn TC riêng · khác màn hình/nhóm chức năng. Cấm đổi độ hạt bộ TC đã nối sang automation/RTM/execution.
3. **Đối Chiếu Evidence (`DOM thật > Ảnh evidence > Tài liệu chữ`):**
   - Mở **100%** ảnh trong `docs/requirements/<module>/evidence/` bằng `Read` trước khi ghi dòng TC đầu tiên (kết hợp đọc DOM qua Playwright MCP nếu có).
   - Xung đột tài liệu ↔ ảnh → **ảnh thắng** (viết theo ảnh, ghi `ASM-XX` kèm tên ảnh, báo user). Vùng cắt cụt/thiếu ảnh → gắn `@NeedsVerify` và ghi `⚠️ chưa có evidence` (cấm suy diễn 4 nhóm: bố cục/thứ tự Tab, nhãn nguyên văn, giá trị mặc định, định dạng hiển thị). Phân biệt `disabled` (xám mờ → rule phụ thuộc 2 chiều) với `không tick`.
4. **Ngôn Ngữ Kiểm Chứng Quan Sát Được (Observable Verification Language):**
   - `Test Steps` đánh số `1. 2. 3.` (1 hành động/bước, `<br>`), `Expected Result` đánh số khớp 1-1 bằng **hiện tượng nhìn thấy trên màn hình**; `Test Data` cụ thể.
   - Cấm đưa `document.*`, `querySelector`, `checkValidity`, `offsetParent`, `className`, selector CSS/XPath, mã HTTP, tên header vào phần TC chính (trừ `Auto Type = API`). Cơ chế ẩn (cookie `autologin`, CSRF, HSTS) tách xuống **`🔧 Ghi chú kỹ thuật (cần DevTools):`** (chỉ ghi hình thái, 🔒 không chép secret thật) kèm tag **`@TechCheck`**.
5. **Write-First Theo Batch & Hợp Đồng Thư Mục / Index Bất Biến:**
   - Kiểm tra/khởi tạo `docs/testcases/README.md` trước Batch 1; cập nhật sau khi hoàn tất.
   - **Write-first:** Chia batch theo vòng (`15–25 TC/batch`), ghi thẳng vào `docs/testcases/<module>/test_cases_<module>.md` (chạy liền mạch, không in bảng TC ra chat; tạo `task.md` nếu `> 30 TC`).
   - **Ngưỡng tách part:** Vượt `> 40 TC` (`TÁCH`) hoặc `> 50 TC` (`GỘP`) → tách vào `docs/testcases/<module>/parts/part_01_<slug>.md` tại ranh giới nhóm chức năng; giữ `test_cases_<module>.md` làm **file index**.

---

## 3. Chuẩn Bảng Test Case 13 Cột (Hợp Đồng Đọc Của `scripts/testcases-viewer`)

```markdown
| TC ID | REQ ID | Module | Risk Level | Test Title | Pre-Condition | Test Steps | Expected Result | Priority | Test Data | Automatable | Auto Type | Tags |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
```

> ⚠️ **Giữ nguyên tên cột tiếng Anh và không bỏ cột `Risk Level`.** `scripts/testcases-viewer` map chính xác `TC ID`, `REQ ID`, `Module`, `Priority`, `Automatable`, `Tags` và map chuỗi con `Risk Level`, `Test Title` (hoặc `Test Scenario`), `Pre-Condition`, `Test Steps`, `Expected Result`, `Test Data`, `Auto Type`.

---

## 4. Danh Mục Tài Liệu Tham Chiếu (`Context Pointers`)

| Tài liệu trong `references/` | Nội dung chi tiết & Điều kiện nạp |
|---|---|
| [`FOUR_RINGS_AND_QUALITY_GATE.md`](references/FOUR_RINGS_AND_QUALITY_GATE.md) | Bản đồ 4 vòng (`V1–V4`), Ma trận Risk-Depth (`Cao`/`Trung bình`/`Thấp`), 4 trạng thái `✅`/`➖`/`⏭️`/`🔴`, mẫu bảng 4 vòng & **11 tiêu chí AI Self-Quality Gate (0–10)** |
| [`MODES_QUICK_AND_FULL_RBT.md`](references/MODES_QUICK_AND_FULL_RBT.md) | Quy tắc `GỘP`/`TÁCH` (Kiểu A/B, bảng CẤM gộp), 6 quy tắc Evidence, bảng chuyển ngữ Observable Language, tách `parts/`, quy trình **Mode 1 (`QUICK`)** & **Mode 2 (`FULL RBT` 6 bước)** |
| [`MODE_CHECKLIST.md`](references/MODE_CHECKLIST.md) | Quy trình **Mode 3 (`CHECKLIST`)**: nguồn `TC-based`/`REQ-based`, 4 loại checklist & ngưỡng số mục, ánh xạ vòng, quy tắc viết ≤20 từ, bảng ký nhận & **4 tiêu chí Checklist Gate** |
| [`MODE_DELTA.md`](references/MODE_DELTA.md) | Quy trình **Mode 4 (`DELTA` — 7 bước `PLAN`/`APPLY`)**: 5 quy tắc bảo toàn `TC ID`, bảng ánh xạ `REQ đổi → TC sửa`, 5 câu tác động lan toả, `🗑️ Deprecated`, `Delta TC List` & **7 tiêu chí Delta Gate** |
| [`FIELD_VALIDATION_15_TYPES.md`](references/FIELD_VALIDATION_15_TYPES.md) | Checklist validation bắt buộc cho **15 loại Input Field** (Text, Email, Phone, Date, Number, Dropdown, Checkbox/Radio, File Upload, Password, Textarea, OTP/MFA, Date Range, Rich Text, Multi-Select, Range Slider) |
| [`COMPONENT_CHECKLIST.md`](references/COMPONENT_CHECKLIST.md) | Checklist cho **7 nhóm Component ngoài form input** (Giao diện tĩnh màn hình, Data Table/List, CRUD Lifecycle, Permission/Role, Modal/Dialog, Notification/Toast, Status Flow) |
| [`DESIGN_TECHNIQUES.md`](references/DESIGN_TECHNIQUES.md) | Điều kiện bắt buộc áp dụng và ví dụ bảng cho **EP, BVA (`min-1, min, max, max+1`), Decision Table (≥3 điều kiện), State Transition (≥3 trạng thái)** |
| [`ISO_25010_CHECKLIST.md`](references/ISO_25010_CHECKLIST.md) | Bảng rà soát **9 đặc tính chất lượng ISO/IEC 25010:2023** cuối tài liệu TC + 5 kịch bản Non-Functional (Race condition/Double submit, Session/Network, UTF-8/Emoji, A11y bàn phím, HTTP Status Codes) |
