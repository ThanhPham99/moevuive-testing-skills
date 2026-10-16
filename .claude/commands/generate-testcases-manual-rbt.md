---
description: Sinh manual test cases chất lượng cao theo quy trình AI-RBT 6 bước tuần tự (FULL RBT mode) từ requirements.
skills:
  - skills-rbt-manual-testing
---

# Workflow Dispatcher: Sinh Manual Test Cases Theo AI-RBT 6 Bước (`FULL RBT` Mode)

Điều phối **Mode 2: `FULL RBT`** của skill [`skills-rbt-manual-testing`](../skills/skills-rbt-manual-testing/SKILL.md) — quy trình **AI-Driven Risk-Based Testing 6 bước tuần tự** dành cho hệ thống phức tạp, nhiều module, hoặc requirements còn điểm mờ cần phân tích Ambiguity và xây dựng Traceability Matrix.

> 🚨 **Chốt chặn trùng lặp:** Nếu module đã có `docs/testcases/<module>/test_cases_<module>.md` và yêu cầu thay đổi theo ticket → **DỪNG LẠI**, dùng `/update-testcases-from-impact` (Mode `DELTA`).
> *(Lưu ý: Nếu dùng AI chat ngoài Claude Code không hỗ trợ slash command, QA có thể copy-paste từng bước từ `plans/manual/01-06/prompt.txt`).*

---

## 1. Input & Hai Điểm Dừng Bắt Buộc (`HITL Checkpoints`)

Agent **BẮT BUỘC chạy tuần tự từng bước**, tuyệt đối không gộp nhiều bước qua mặt các điểm dừng:

| Bước | Tên bước | Hành động trọng tâm & Điểm dừng (`HITL Checkpoint`) |
|---|---|---|
| **Bước 1** | **Context & Role-play** | Thu thập tên dự án, mô tả hệ thống, mục tiêu MVP, đường dẫn `requirements_<module>.md`. Chốt độ hạt **`GỘP`** (mặc định) hoặc **`TÁCH`** kèm số TC ước tính. Mở **100%** ảnh trong `docs/requirements/<module>/evidence/` bằng `Read` và xuất **Danh mục Evidence đã mở**. **Chờ user xác nhận bối cảnh** nếu cần bổ sung đầu vào |
| **Bước 2** | **Analysis & QnA** | Xác định Happy/Alternate/Exception Paths. Phát hiện Ambiguities (thiếu sót, mâu thuẫn, và **xung đột giữa tài liệu chữ ↔ ảnh evidence**). Đặt câu hỏi đánh số `Q1, Q2...` kèm ngữ cảnh + assumption mặc định.<br>⏸️ **HITL CHECKPOINT 1 (HARD STOP): DỪNG LẠI chờ user trả lời Q&A trước khi sang Bước 3** |
| **Bước 3** | **Decomposition** | Phân rã hệ thống thành các Module / Sub-module (theo UI hoặc theo luồng nghiệp vụ) và chỉ rõ Dependencies giữa các module |
| **Bước 4** | **Traceability & 4 Vòng** | Lập Traceability Matrix (`Module/Rule ↔ REQ ID`), chạy Gap Analysis. Tự chấm `Risk Level` (`Cao`/`Trung bình`/`Thấp`) → chọn độ sâu (`Đầy đủ`/`Tiêu chuẩn`/`Tối giản`). Liệt kê High-Level Scenarios **xếp theo 4 vòng (`V1–V4`)**, chấm sơ bộ từng nhánh `✅` / `➖` / `⏭️`.<br>⏸️ **HITL CHECKPOINT 2 (HARD STOP): DỪNG LẠI chờ user review RTM và bảng 4 vòng trước khi sang Bước 5** |
| **Bước 5** | **RBT & TC Generation** | Công bố kế hoạch batch theo vòng (`V1 Smoke → V2 Functional → V3 Technical → V4 Non-functional`, mở đầu bằng `V1 · UI cơ bản`). Sinh TC chi tiết và **ghi thẳng vào file theo từng batch (Write-first)**, chạy liền mạch hết các batch của module không dừng giữa chừng |
| **Bước 6** | **Template Mapping & Gate** | Chuẩn hóa bảng Markdown 13 cột, chạy đủ **11 tiêu chí AI Self-Quality Gate (`0–10`)**, xuất 4 bảng đối soát cuối file và cập nhật `docs/testcases/README.md` |

---

## 2. Tài Liệu Tham Chiếu Bắt Buộc Nạp (`Context Pointers`)

1. **Quy trình 6 bước Mode `FULL RBT` & Quy tắc cốt lõi:** [`MODES_QUICK_AND_FULL_RBT.md`](../skills/skills-rbt-manual-testing/references/MODES_QUICK_AND_FULL_RBT.md) — thực thi **Mục 1–4** (Độ hạt `GỘP`/`TÁCH`, Đối chiếu Evidence, Ngôn ngữ Kiểm chứng & `@TechCheck`, Xuất file Write-first) và **Mục 6 (Mode 2: FULL RBT 6 Bước)**.
2. **Khung 4 Vòng, Độ sâu Rủi ro & 11 Tiêu chí Quality Gate:** [`FOUR_RINGS_AND_QUALITY_GATE.md`](../skills/skills-rbt-manual-testing/references/FOUR_RINGS_AND_QUALITY_GATE.md) — nạp từ Bước 4 để chấm Risk-Depth, lập bảng 4 vòng và kiểm định ở Bước 6.
3. **Checklist Thiết kế Chuyên sâu (nạp ở Bước 5–6):**
   - [`FIELD_VALIDATION_15_TYPES.md`](../skills/skills-rbt-manual-testing/references/FIELD_VALIDATION_15_TYPES.md) · [`COMPONENT_CHECKLIST.md`](../skills/skills-rbt-manual-testing/references/COMPONENT_CHECKLIST.md) · [`DESIGN_TECHNIQUES.md`](../skills/skills-rbt-manual-testing/references/DESIGN_TECHNIQUES.md) · [`ISO_25010_CHECKLIST.md`](../skills/skills-rbt-manual-testing/references/ISO_25010_CHECKLIST.md).

*(Không nạp `MODE_CHECKLIST.md` hay `MODE_DELTA.md` trong luồng này).*

---

## 3. Hợp Đồng Xuất File & Chuẩn Bảng 13 Cột

- **Đường dẫn Output:** Cập nhật `docs/testcases/README.md`; ghi file chính tại `docs/testcases/<module>/test_cases_<module>.md` (khi vượt ngưỡng `> 40 TC` ở `TÁCH` hoặc `> 50 TC` ở `GỘP` thì tách vào `docs/testcases/<module>/parts/part_NN_<slug>.md` tại ranh giới nhóm chức năng và giữ `test_cases_<module>.md` làm file index). Tạo `task.md` khi tổng TC dự kiến `> 30`.
- **Chuẩn bảng 13 cột (tương thích `scripts/testcases-viewer`):**
  ```markdown
  | TC ID | REQ ID | Module | Risk Level | Test Title | Pre-Condition | Test Steps | Expected Result | Priority | Test Data | Automatable | Auto Type | Tags |
  ```
- **4 bảng đối soát bắt buộc ở cuối tài liệu TC:** **Bảng Đối Soát Coverage** (mọi REQ có ≥1 TC), **Bảng Đối Soát Evidence** (+ vùng `@NeedsVerify`), **Bảng Đối soát loại kiểm thử (4 vòng)**, và **Bảng rà soát đặc tính chất lượng (ISO/IEC 25010:2023)**.
