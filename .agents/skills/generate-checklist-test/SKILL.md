---
name: generate-checklist-test
description: "Sinh checklist test ngắn để tick tay (CHECKLIST mode) — smoke / post-hotfix / regression module / release-readiness."
skills:
  - skills-rbt-manual-testing
---

# Workflow Dispatcher: Sinh Checklist Rà Soát Tick Tay (`CHECKLIST` Mode)

Điều phối **Mode 3: `CHECKLIST`** của skill [`skills-rbt-manual-testing`](../../../.claude/skills/skills-rbt-manual-testing/SKILL.md) để sinh danh sách rà soát ngắn gọn (1 dòng/mục, ≤ 20 từ, kiểm tra trong ≤ 2 phút, có ô tick `☐`) trong **1 lượt duy nhất**.

> **Ranh giới:** Checklist trả lời *"đã rà hết chưa?"*, không chứa steps đánh số. Nếu user cần steps chi tiết, test data đầy đủ, import Jira/TestRail hay giao cho automation → chuyển sang `/generate-testcases-from-requirements` (Mode `QUICK`) hoặc `/generate-testcases-manual-rbt` (Mode `FULL RBT`). Nếu bộ TC hiện có chất lượng kém cần đánh giá trước khi rút gọn → chuyển sang `/review-testcases`.

---

## 1. Thu Thập Input & Phân Loại Checklist

| Input | Bắt buộc? | Quy tắc xử lý |
|---|---|---|
| **Module / Tính năng cần rà** | ⭐ Bắt buộc | Xác định rõ module, luồng nghiệp vụ và role |
| **Loại Checklist** | ⭐ Bắt buộc | Chọn 1 trong 4 loại: **`Smoke`** (10–20 mục, ≤15 phút, chỉ lấy V1) · **`Post-hotfix`** (5–15 mục, ≤10 phút, V1 vùng vá + nhánh V2 chạm tới) · **`Regression (module)`** (20–40 mục, ≤45 phút, V1 + V2 + V3 `Permission`) · **`Release-readiness`** (30–60 mục, ≤60 phút, V1 + V2 sống còn + V3 `Permission`/`Security` + V4 `E2E`). Nếu user chưa nêu, hỏi hoặc suy từ ngữ cảnh và công bố rõ |
| **Nguồn Input (`TC-based` / `REQ-based`)** | Tự động xác định | **Ưu tiên `TC-based`** khi đã có `docs/testcases/<module>/test_cases_<module>.md` (rút gọn theo nhóm chủ đề và điền cột `TC ID liên quan`). Chỉ dùng **`REQ-based`** khi chưa có bộ TC (cột `TC ID liên quan` ghi `—`) |
| **Ảnh Evidence (`evidence/`)** | ⭐ Bắt buộc mở | Mở ảnh trong `docs/requirements/<module>/evidence/` bằng `Read` để lấy chính xác nhãn nút và dấu hiệu UI |
| **Mô tả bản vá (Hotfix)** | Bắt buộc với `Post-hotfix` | Dùng để khoanh vùng ảnh hưởng trực tiếp và vùng lân cận có rủi ro hồi quy |

---

## 2. Tài Liệu Tham Chiếu Bắt Buộc Nạp (`Context Pointers`)

Agent **CHỈ nạp** các tài liệu phục vụ Mode `CHECKLIST` (không nạp `MODES_QUICK_AND_FULL_RBT.md` hay `MODE_DELTA.md`):

1. **Quy trình Mode `CHECKLIST` & Quality Gate 4 tiêu chí:** [`MODE_CHECKLIST.md`](../../../.claude/skills/skills-rbt-manual-testing/references/MODE_CHECKLIST.md) — thực thi đầy đủ **Bước 0 → Bước 8**, bảng ánh xạ vòng lấy mục theo 4 loại checklist, quy tắc viết mục 1 dòng bắt đầu bằng động từ, mẫu bảng Output kèm bảng `Ký nhận`, và **4 tiêu chí Checklist Quality Gate**.
2. **3 Bảng Checklist Chuẩn (để rút mục khi dùng `REQ-based` hoặc kiểm độ phủ Component):**
   - [`FIELD_VALIDATION_15_TYPES.md`](../../../.claude/skills/skills-rbt-manual-testing/references/FIELD_VALIDATION_15_TYPES.md) *(chỉ lấy 1–2 mục đại diện rủi ro cao nhất cho mỗi field quan trọng — không liệt kê toàn bộ validation)*.
   - [`COMPONENT_CHECKLIST.md`](../../../.claude/skills/skills-rbt-manual-testing/references/COMPONENT_CHECKLIST.md) *(Giao diện tĩnh, Table/List, CRUD, Permission, Modal, Toast, Status Flow — component không có trong module phải ghi vào mục "Không áp dụng cho module này")*.
   - [`ISO_25010_CHECKLIST.md`](../../../.claude/skills/skills-rbt-manual-testing/references/ISO_25010_CHECKLIST.md) *(Mục 3: Race condition/Double submit, Session/Network, UTF-8, A11y bàn phím)*.

---

## 3. Hợp Đồng Xuất File (`Write-First`)

- **Đường dẫn Output:** Ghi thẳng vào `docs/checklists/checklist_<loại>_<module>.md` (không ghi đè lên checklist loại khác của cùng module; không in toàn bộ bảng ra chat trừ khi user yêu cầu).
- **Cấu trúc bảng Output (tài liệu đọc/in trực tiếp, không nạp vào `scripts/testcases-viewer`):**
  ```markdown
  | # | ✅ | Hạng mục kiểm tra | Kết quả kỳ vọng | Priority | REQ ID | TC ID liên quan |
  ```
  *(Cột `✅` để trống ô tick `☐`; cuối file bắt buộc có mục **"Không áp dụng cho module này"** và bảng **"Ký nhận"** gồm `Môi trường | Build / Version | Người thực hiện | Ngày | Kết quả (Pass/Fail/Blocked)`).*
