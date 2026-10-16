---
description: Cập nhật manual test cases đã có theo Impact Report (DELTA mode — PLAN/APPLY) — sửa TC stale tại chỗ, bảo toàn TC ID, xuất Delta TC List.
skills:
  - skills-rbt-manual-testing
---

# Workflow Dispatcher: Cập Nhật Test Cases Theo Impact Report (`DELTA` Mode)

Điều phối **Mode 4: `DELTA`** của skill [`skills-rbt-manual-testing`](../skills/skills-rbt-manual-testing/SKILL.md) — mắt xích giữa của chuỗi đồng bộ 3 tầng (`/update-requirements-from-ticket` → `/update-testcases-from-impact` → `/update-automation-from-impact`).

> 🚨 **Khác biệt với `/review-testcases`:** Workflow này sửa **tại chỗ** các TC bị stale so với requirement mới trong `test_cases_<module>.md` (kèm bản sao lưu vào `archive/`), tuyệt đối **không** sinh file `_improved` hay `_v2` ngoài `archive/`.

---

## 1. Chế Độ Thực Thi (`PLAN` / `APPLY`) & Input Bắt Buộc

| Chế độ | Khi nào kích hoạt | Hành vi & Điểm dừng (`HITL Checkpoint`) |
|---|---|---|
| **`PLAN`** *(mặc định)* | User chưa yêu cầu sửa ngay | Chạy **Bước 1 → Bước 4**: xuất file kế hoạch `docs/testcases/<module>/impact/impact_plan_<TICKET-ID>.md` rồi **⏸️ DỪNG LẠI (KẾT THÚC)** |
| **`APPLY`** | User nói *"sửa luôn"*, *"cập nhật TC đi"*, *"apply"* | Xuất kế hoạch ở **Bước 4** → **⏸️ DỪNG LẠI chờ user duyệt** (đặc biệt nhóm `⚠️ Suy luận`, `🗑️ Deprecated`, và các nhánh 4 vòng bị chạm) → sau khi user duyệt mới chạy thẳng **Bước 5 → Bước 7** |

| Nguồn Input | Bắt buộc? | Quy tắc kiểm tra |
|---|---|---|
| **Impact Report / Danh sách REQ đổi** | ⭐ Bắt buộc | `docs/requirements/<module>/impact/impact_<TICKET-ID>.md` hoặc danh sách REQ đổi. Nếu Impact Report ghi `⚠️ chưa rà soát` ở cột TC và chưa có nguồn map → **DỪNG LẠI**, báo chạy `/generate-traceability-matrix` trước |
| **Tài liệu Requirements hiện hành** | ⭐ Bắt buộc | `docs/requirements/<module>/requirements_<module>.md` (đọc nội dung REQ mới + Nhật ký thay đổi cuối file; không suy đoán từ tên TC) |
| **File Test Cases hiện hành** | ⭐ Bắt buộc | `docs/testcases/<module>/test_cases_<module>.md` (+ `parts/part_NN_*.md` nếu có) và `traceability_matrix.md` (nếu có) |
| **Ảnh Evidence (`evidence/*.png`)** | ⭐ Bắt buộc khi chạm V1 | Phải mở bằng `Read` nếu ticket chạm nhãn nguyên văn, bố cục/thứ tự field, giá trị mặc định, hoặc định dạng hiển thị. Chưa có ảnh mới → gắn `@NeedsVerify`, không sửa mò |

---

## 2. Tài Liệu Tham Chiếu Bắt Buộc Nạp (`Context Pointers`)

Agent **CHỈ nạp** các tài liệu phục vụ Mode `DELTA` (không nạp `MODE_CHECKLIST.md` hay quy trình `QUICK`/`FULL RBT`):

1. **Quy trình 7 bước Mode `DELTA` & 5 Quy tắc Bất biến:** [`MODE_DELTA.md`](../skills/skills-rbt-manual-testing/references/MODE_DELTA.md) — thực thi đầy đủ **Bước 1 → Bước 7**, gồm:
   - **5 quy tắc bảo toàn `TC ID`:** sửa tại chỗ trong index/parts · sao lưu trước khi sửa vào `archive/test_cases_<module>_v<N>.md` · giữ nguyên `TC ID` (TC mới trong REQ `🟡` nối tiếp cuối dải, không chèn giữa) · không xoá dòng TC (đổi thành `🗑️ Deprecated (TICKET-XXX)`) · bám đúng độ hạt `GỘP`/`TÁCH` hiện có của file (cấm đổi độ hạt cả file).
   - **Bảng ánh xạ 14 dòng (`REQ đổi gì → TC sửa gì`)** và **5 câu hỏi Tác động lan toả** (đặc biệt kiểm tra xem ticket có chạm `V1 · UI cơ bản` hay không).
   - **7 tiêu chí Quality Gate DELTA**, mẫu bảng **Nhật ký thay đổi**, và mẫu **Delta TC List**.
2. **Khung 4 Vòng (chỉ đối soát nhánh bị chạm):** [`FOUR_RINGS_AND_QUALITY_GATE.md`](../skills/skills-rbt-manual-testing/references/FOUR_RINGS_AND_QUALITY_GATE.md) — chỉ cập nhật những nhánh trong Bảng Đối soát 4 vòng mà ticket chạm tới, giữ nguyên phần còn lại.
3. **Checklist 15 loại Field (nếu ticket thêm/sửa input field):** [`FIELD_VALIDATION_15_TYPES.md`](../skills/skills-rbt-manual-testing/references/FIELD_VALIDATION_15_TYPES.md).

---

## 3. Hợp Đồng Output & Chuyển Tiếp Chuỗi Delta

- **Output Mode `PLAN`:** `docs/testcases/<module>/impact/impact_plan_<TICKET-ID>.md` (Bảng map `REQ → TC` phân tách `✅ Chắc chắn` / `⚠️ Suy luận` / `❓ Chưa có TC`, kế hoạch sửa từng TC kèm `Vòng · Nhánh`, danh sách nhánh 4 vòng bị chạm, tác động lan toả, và danh sách REQ `🟢` ngoài phạm vi cần chuyển sang `/generate-testcases-manual-rbt` hoặc `/generate-testcases-from-requirements`).
- **Output Mode `APPLY` (sau khi duyệt):** Bản sao lưu `docs/testcases/<module>/archive/test_cases_<module>_v<N>.md` · File `test_cases_<module>.md` (và `parts/`) đã sửa tại chỗ kèm **Bảng Đối Soát Coverage**, **Bảng Đối soát 4 vòng** (nhánh bị chạm), và **Nhật ký thay đổi** · Cập nhật `docs/testcases/README.md` · Xuất **Delta TC List** (có cột `Vòng · Nhánh`) ra chat để làm đầu vào cho `/update-automation-from-impact` → `/generate-traceability-matrix`.
