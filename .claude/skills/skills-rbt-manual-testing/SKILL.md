---
name: skills-rbt-manual-testing
description: Sinh và cập nhật manual test cases theo 4 modes — QUICK (sinh nhanh 1 lượt từ requirements), FULL RBT (quy trình AI-RBT 6 bước tuần tự có đánh giá rủi ro và RTM), CHECKLIST (danh sách tick tay smoke/hotfix/regression/release) và DELTA (cập nhật bộ TC đã có theo Impact Report, bảo toàn TC ID).
---

# RBT Manual Testing — Master Skill & Orchestrator

Master Skill điều phối sinh mới và cập nhật manual test cases theo khung **Risk-Based Testing (RBT) 4 Vòng** (`V1 Smoke → V2 Functional → V3 Technical → V4 Non-functional`).

- **Nguyên tắc cốt lõi:** **Human Strategy** (chốt mức rủi ro, Q&A, kế hoạch) · **AI Execution** (đối chiếu evidence, thiết kế TC 4 vòng, qua 11 tiêu chí Quality Gate) · **Human Verification** (duyệt tại các HITL checkpoint).
- **Ranh giới:** Không dùng khi chỉ sinh automation code (`skills-qa-automation-engineer`), inspect DOM/locator (`skills-ui-debug-agent`), hoặc chỉ sinh test data rời (`skills-test-data-generator`).

---

## 1. Mode Routing & Progressive Disclosure (Nạp Đúng Tài Liệu Theo Mode)

> 🚨 **Kiểm tra bắt buộc trước khi chọn `QUICK` / `FULL RBT`:** Nếu module **đã có** `docs/testcases/<module>/test_cases_<module>.md` và yêu cầu đổi theo ticket → **BẮT BUỘC dùng Mode `DELTA`** để bảo toàn `TC ID` (tránh đứt liên kết sang `allure.label('testId', ...)`, RTM và execution reports).

| Mode & Command | Khi nào kích hoạt | Tài liệu tham chiếu BẮT BUỘC nạp (`Read`) | Nhịp chạy |
|---|---|---|---|
| **Mode 1: `QUICK`**<br>`/generate-testcases-from-requirements` | Sinh TC nhanh từ requirements đã rõ, phạm vi 1 module, không qua 6 bước | `MODES_QUICK_AND_FULL_RBT.md`, `FOUR_RINGS_AND_QUALITY_GATE.md`, `FIELD_VALIDATION_15_TYPES.md`, `COMPONENT_CHECKLIST.md`, `DESIGN_TECHNIQUES.md`, `ISO_25010_CHECKLIST.md` | **1 lượt duy nhất** (ghi `ASM-XX` nếu mơ hồ) |
| **Mode 2: `FULL RBT`**<br>`/generate-testcases-manual-rbt` | Hệ thống phức tạp, còn điểm mờ cần Q&A, phân rã module, đánh giá Risk & RTM | Như Mode `QUICK` (thực thi mục **Mode 2: FULL RBT 6 Bước** trong [`MODES_QUICK_AND_FULL_RBT.md`](references/MODES_QUICK_AND_FULL_RBT.md)) | **6 bước tuần tự** — dừng ở **Bước 2 (Q&A)** & **Bước 4 (RTM)** |
| **Mode 3: `CHECKLIST`**<br>`/generate-checklist-test` | Danh sách rà soát ngắn (`≤ 2 phút/mục`, có ô `☐`) cho Smoke, Hotfix, Regression, Release | [`MODE_CHECKLIST.md`](references/MODE_CHECKLIST.md) + chọn lọc `FIELD_VALIDATION_15_TYPES.md`, `COMPONENT_CHECKLIST.md`, `ISO_25010_CHECKLIST.md` | **1 lượt duy nhất** (ưu tiên rút gọn `TC-based`) |
| **Mode 4: `DELTA`**<br>`/update-testcases-from-impact` | Module **đã có** `test_cases_<module>.md`, cập nhật theo `Impact Report` & xuất `Delta TC List` | [`MODE_DELTA.md`](references/MODE_DELTA.md) + `FOUR_RINGS_AND_QUALITY_GATE.md` *(nhánh chạm)* + `FIELD_VALIDATION_15_TYPES.md` *(nếu đổi field)* | **2 chế độ con:** `PLAN` (dừng Bước 4) hoặc `APPLY` |

---

## 2. Năm Quy Tắc Bất Biến Cốt Lõi (Core Invariants)

1. **Khung 4 Vòng Kiểm Thử (`Test Rings`) & Độ sâu theo Rủi ro:**
   - **`V1 Smoke`:** UI cơ bản · Open form · Display · Input valid · Save · Verify data.
   - **`V2 Functional`:** UI Behavior · Required · Validation 15 loại · EP · BVA · Business Rule · Decision Table · State Transition · Dependency · Use Case · CRUD · Error Guessing.
   - **`V3 Technical`:** Permission · Security · API · Database · Integration · Logging/Audit (đọc `Năng lực kiểm thử của QA` trong `docs/requirements/README.md`).
   - **`V4 Non-functional`:** Compatibility · Responsive · Accessibility · Performance · Regression · E2E.
   - Chấm Risk Level (`Cao` → 40–60 TC · `Trung bình` → 20–30 TC · `Thấp` → 8–12 TC; lưỡng lự chọn mức cao hơn) kèm dòng **"Nâng lên khi…"** ở đầu file.
   - **4 nhánh cấm rút (`➖`/`⏭️`):** Toàn bộ `V1 Smoke` · `V2 · Required + Validation` (khi có field nhập) · `V3 · Permission` ($\ge 2$ role) · `V3 · Security` (chạm dữ liệu người khác).
   - **4 trạng thái đối soát:** `✅ Có TC` · `➖ Không áp dụng` (sự thật kỹ thuật + đơn vị chịu trách nhiệm) · `⏭️ Cố ý bỏ` (chấp nhận rủi ro thấp: ghi lý do + người quyết định + điều kiện rà lại) · `🔴 Thiếu` (bổ sung trước khi xuất).
2. **Độ Hạt Test Case (`Granularity Mode`: `GỘP` mặc định vs `TÁCH`):**
   - Mặc định **`GỘP`** (Kiểu A: biến thể dữ liệu cùng trường & cùng phản hồi `a, b, c`; Kiểu B: kiểm tra tĩnh cùng màn hình `1, 2, 3`; **trần $\le 6$ biến thể/TC**, công bố `<N> TC · <M> biến thể`). Chỉ dùng **`TÁCH`** (1 biến thể = 1 TC) khi user yêu cầu hoặc cần pass-rate từng biến thể.
   - **CẤM gộp:** khác trường nhập · khác cơ chế phản hồi · `@Smoke` khác hành vi · TC thiết kế để FAIL · khác `REQ ID` không còn TC riêng · khác màn hình. Cấm đổi độ hạt bộ TC đã nối sang automation/RTM.
3. **Đối Chiếu Evidence (`DOM thật > Ảnh evidence > Tài liệu chữ`):**
   - Mở **100%** ảnh trong `docs/requirements/<module>/evidence/` trước khi viết TC. Xung đột tài liệu ↔ ảnh → **ảnh thắng** (ghi `ASM-XX`). Vùng thiếu ảnh → gắn `@NeedsVerify` và ghi `⚠️ chưa có evidence` (cấm suy diễn bố cục, nhãn nguyên văn, giá trị mặc định, định dạng hiển thị). Phân biệt `disabled` với `không tick`.
4. **Ngôn Ngữ Kiểm Chứng Quan Sát Được (Observable Verification Language):**
   - `Test Steps` đánh số `1. 2. 3.` (`<br>`), `Expected Result` đánh số khớp 1-1 bằng **hiện tượng nhìn thấy trên màn hình**; `Test Data` cụ thể.
   - Cấm đưa `document.*`, `querySelector`, `checkValidity`, `offsetParent`, selector CSS/XPath, mã HTTP vào phần TC chính (trừ `Auto Type = API`). Cơ chế ẩn (cookie, CSRF, HSTS) tách xuống **`🔧 Ghi chú kỹ thuật (cần DevTools):`** (🔒 không chép secret thật) kèm tag **`@TechCheck`**.
5. **Write-First Theo Batch & Ngưỡng Tách `parts/`:**
   - Cập nhật `docs/testcases/README.md`; ghi theo batch (`15–25 TC/batch`) thẳng vào `docs/testcases/<module>/test_cases_<module>.md`.
   - Vượt `> 40 TC` (`TÁCH`) hoặc `> 50 TC` (`GỘP`) → tách vào `docs/testcases/<module>/parts/part_01_<slug>.md`, giữ `test_cases_<module>.md` làm **file index**.

---

## 3. Chuẩn Bảng Test Case 13 Cột (Hợp Đồng Đọc Của `scripts/testcases-viewer`)

| TC ID | REQ ID | Module | Risk Level | Test Scenario | Pre-Condition | Test Steps | Test Data | Expected Result | Priority | Automatable | Auto Type | Tags |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| TC_LOGIN_001 | REQ-LOGIN-01 | Login | Cao | Kiểm tra giao diện mặc định màn hình Đăng nhập | Chưa đăng nhập | 1. Mở trang Login<br>2. Quan sát form | URL: `/login` | 1. Trang tải thành công<br>2. Hiển thị ô Email, Password và nút Đăng nhập | High | Yes | UI | `@Smoke, @UI` |

> ⚠️ **Giữ nguyên tên 13 cột tiếng Anh** để tương thích 100% với `scripts/testcases-viewer/bundle.html` và `node scripts/validate-docs.mjs --check`.

---

## 4. Danh Mục Tài Liệu Tham Chiếu (`Context Pointers`)

| Tài liệu trong `references/` | Nội dung chi tiết |
|---|---|
| [`FOUR_RINGS_AND_QUALITY_GATE.md`](references/FOUR_RINGS_AND_QUALITY_GATE.md) | Bản đồ 4 vòng (`V1–V4`), Ma trận Risk-Depth, 4 trạng thái `✅`/`➖`/`⏭️`/`🔴` & **11 tiêu chí AI Self-Quality Gate** |
| [`MODES_QUICK_AND_FULL_RBT.md`](references/MODES_QUICK_AND_FULL_RBT.md) | Quy tắc `GỘP`/`TÁCH`, 6 quy tắc Evidence, Observable Language, tách `parts/`, **Mode 1 (`QUICK`)** & **Mode 2 (`FULL RBT`)** |
| [`MODE_CHECKLIST.md`](references/MODE_CHECKLIST.md) | Quy trình **Mode 3 (`CHECKLIST`)**: 4 loại checklist, quy tắc viết $\le 20$ từ & **4 tiêu chí Checklist Gate** |
| [`MODE_DELTA.md`](references/MODE_DELTA.md) | Quy trình **Mode 4 (`DELTA` — `PLAN`/`APPLY`)**: bảo toàn `TC ID`, `🗑️ Deprecated`, `Delta TC List` & **7 tiêu chí Delta Gate** |
| [`FIELD_VALIDATION_15_TYPES.md`](references/FIELD_VALIDATION_15_TYPES.md) | Checklist validation bắt buộc cho **15 loại Input Field** |
| [`COMPONENT_CHECKLIST.md`](references/COMPONENT_CHECKLIST.md) | Checklist cho **7 nhóm Component ngoài form input** (Table/List, CRUD, Permission, Modal, Toast, Status Flow) |
| [`DESIGN_TECHNIQUES.md`](references/DESIGN_TECHNIQUES.md) | Điều kiện áp dụng & bảng mẫu cho **EP, BVA (`min-1, min, max, max+1`), Decision Table, State Transition** |
| [`ISO_25010_CHECKLIST.md`](references/ISO_25010_CHECKLIST.md) | Bảng rà soát **9 đặc tính ISO/IEC 25010:2023** & 5 kịch bản Non-Functional (Double submit, Network, UTF-8/Emoji, A11y, HTTP Codes) |
