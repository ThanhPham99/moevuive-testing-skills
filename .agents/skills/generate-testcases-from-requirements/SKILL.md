---
name: generate-testcases-from-requirements
description: "Sinh manual test cases nhanh từ requirements (QUICK mode — 1 lượt theo khung 4 vòng)."
skills:
  - skills-rbt-manual-testing
---

# Workflow Dispatcher: Sinh Manual Test Cases Nhanh (`QUICK` Mode)

Điều phối **Mode 1: `QUICK`** của skill [`skills-rbt-manual-testing`](../../../.claude/skills/skills-rbt-manual-testing/SKILL.md) để sinh bộ manual test cases hoàn chỉnh trong **1 lượt duy nhất** theo khung 4 vòng (`V1 Smoke → V2 Functional → V3 Technical → V4 Non-functional`).

> 🚨 **Chốt chặn trùng lặp:** Kiểm tra xem `docs/testcases/<module>/test_cases_<module>.md` đã tồn tại chưa. Nếu **đã có** và yêu cầu vừa thay đổi theo ticket → **DỪNG LẠI**, chuyển sang `/update-testcases-from-impact` (Mode `DELTA`) để bảo toàn `TC ID`. Nếu phát hiện requirements quá mơ hồ, cần hỏi Q&A, hoặc phạm vi `> 3 modules` → đề xuất chuyển sang `/generate-testcases-manual-rbt` (Mode `FULL RBT`).

---

## 1. Input & Chế Độ Độ Hạt (`Granularity Mode`)

```text
/generate-testcases-from-requirements <đường_dẫn_requirements_hoặc_mô_tả> [GỘP | TÁCH]
```

| Tham số / Nguồn | Bắt buộc? | Quy tắc xử lý |
|---|---|---|
| **Tài liệu Requirements** | ⭐ Bắt buộc | `docs/requirements/<module>/requirements_<module>.md` (hoặc mô tả user cung cấp). Giữ nguyên `REQ ID` sẵn có; chưa có thì gán `REQ-<MODULE>-<SỐ>` |
| **Ảnh Evidence** | ⭐ Bắt buộc (nếu có thư mục) | Mở **100%** ảnh trong `docs/requirements/<module>/evidence/` bằng `Read` **trước** khi ghi dòng TC đầu tiên |
| **Độ hạt (`GỘP` / `TÁCH`)** | Mặc định: **`GỘP`** | `GỘP`: gộp biến thể cùng trường & cùng loại phản hồi (Kiểu A) hoặc kiểm tra tĩnh cùng màn hình (Kiểu B), trần ≤ 6 biến thể/TC. `TÁCH`: 1 biến thể = 1 TC. Công bố độ hạt ngay ở dòng kế hoạch batch |

---

## 2. Tài Liệu Tham Chiếu Bắt Buộc Nạp (`Context Pointers`)

Trước khi sinh TC, Agent **BẮT BUỘC** nạp (`Read`) đúng các module tham chiếu sau:

1. **Quy trình Mode `QUICK` & Quy tắc cốt lõi:** [`MODES_QUICK_AND_FULL_RBT.md`](../../../.claude/skills/skills-rbt-manual-testing/references/MODES_QUICK_AND_FULL_RBT.md) — thực thi **Mục 1–5** (Độ hạt `GỘP`/`TÁCH` & bảng CẤM gộp, 6 quy tắc Đối chiếu Evidence, Ngôn ngữ Kiểm chứng & `@TechCheck`, Xuất file Write-first theo batch, và Quy trình 7 bước Mode `QUICK`).
2. **Khung 4 Vòng, Độ sâu Rủi ro & Self-Quality Gate:** [`FOUR_RINGS_AND_QUALITY_GATE.md`](../../../.claude/skills/skills-rbt-manual-testing/references/FOUR_RINGS_AND_QUALITY_GATE.md) — tự chấm Risk Level (`Cao` → Đầy đủ · `Trung bình` → Tiêu chuẩn · `Thấp` → Tối giản), giữ 4 nhánh không bao giờ rút, chia batch tuần tự `V1 → V2 → V3 → V4`, và chạy đủ **11 tiêu chí AI Self-Quality Gate (0–10)**.
3. **Checklist Thiết kế Chuyên sâu:**
   - [`FIELD_VALIDATION_15_TYPES.md`](../../../.claude/skills/skills-rbt-manual-testing/references/FIELD_VALIDATION_15_TYPES.md) (đối soát đủ từng mục của 15 loại input field).
   - [`COMPONENT_CHECKLIST.md`](../../../.claude/skills/skills-rbt-manual-testing/references/COMPONENT_CHECKLIST.md) (Giao diện tĩnh, Table/List, CRUD, Permission, Modal, Toast, Status Flow).
   - [`DESIGN_TECHNIQUES.md`](../../../.claude/skills/skills-rbt-manual-testing/references/DESIGN_TECHNIQUES.md) (EP, BVA `min-1..max+1`, Decision Table khi ≥3 điều kiện, State Transition khi ≥3 trạng thái).
   - [`ISO_25010_CHECKLIST.md`](../../../.claude/skills/skills-rbt-manual-testing/references/ISO_25010_CHECKLIST.md) (Bảng 9 đặc tính ISO/IEC 25010:2023 + kịch bản Non-Functional chuyên sâu).

*(Không nạp `MODE_CHECKLIST.md` hay `MODE_DELTA.md` trong luồng này).*

---

## 3. Hợp Đồng Xuất File (`Write-First`) & Chuẩn Bảng 13 Cột

1. **Danh mục hệ thống:** Kiểm tra `docs/testcases/README.md` trước Batch 1 (chưa có thì khởi tạo); cập nhật lại dòng của module sau khi hoàn tất.
2. **Chạy thẳng theo batch (không dừng hỏi giữa chừng):** Công bố kế hoạch batch kèm độ hạt (`GỘP`/`TÁCH`) và mức rủi ro · độ sâu ra chat → ghi thẳng từng batch (`15–25 TC/batch`) vào `docs/testcases/<module>/test_cases_<module>.md` (tách `parts/part_NN_<slug>.md` nếu vượt `> 40 TC` ở `TÁCH` hoặc `> 50 TC` ở `GỘP`; tạo `task.md` nếu `> 30 TC`). Không in toàn bộ bảng TC ra chat.
3. **Định dạng bảng 13 cột bất biến (tương thích `scripts/testcases-viewer`):**
   ```markdown
   | TC ID | REQ ID | Module | Risk Level | Test Title | Pre-Condition | Test Steps | Expected Result | Priority | Test Data | Automatable | Auto Type | Tags |
   ```
4. **Cấu phần bắt buộc trong file Output:** Dòng `Mức rủi ro · độ sâu` (kèm điều kiện *"Nâng lên khi…"*), mục `Assumptions (ASM-XX)` (nếu có điểm mờ hoặc xung đột tài liệu ↔ ảnh), Bảng TC 13 cột, **Bảng Đối Soát Coverage**, **Bảng Đối Soát Evidence** (+ mục *"Vùng chưa có evidence"* gắn `@NeedsVerify`), **Bảng Đối soát loại kiểm thử (4 vòng)**, và **Bảng rà soát đặc tính chất lượng (ISO/IEC 25010:2023)**.