---
name: update-requirements-from-ticket
description: "Cập nhật tại chỗ tài liệu requirements đã có từ ticket mới (Delta Mode) — phân loại THÊM/SỬA/BỎ, giữ nguyên REQ ID, đồng bộ Nhật ký thay đổi và xuất file Impact Report."
skills:
  - skills-requirements-analyzer
---

# Workflow Dispatcher: Cập Nhật Requirements Từ Ticket Mới (`/update-requirements-from-ticket`)

## 1. Context Pointers (Tài liệu bắt buộc nạp)

- **Quy ước đánh mã, bất biến giữ nguyên `REQ ID`, cấm xoá dòng (`🔴 Deprecated`) & Cổng Tự Soát 10 điểm:** [`.claude/skills/skills-requirements-analyzer/SKILL.md`](../../../.claude/skills/skills-requirements-analyzer/SKILL.md) (Mục 1, 2 & 3.1).
- **Quy tắc Phân loại 5 nhóm Delta, Đối chiếu `AMB-XX` đang treo, Cấu trúc `requirements_<module>.md` (`6.1–6.9`) & Mẫu chuẩn `impact_<TICKET-ID>.md`:** [`references/OUTPUT_TEMPLATES_AND_GATE.md`](../../../.claude/skills/skills-requirements-analyzer/references/OUTPUT_TEMPLATES_AND_GATE.md) (Mục 4 & 5).
- **Công cụ đọc ticket/file đính kèm theo định dạng, khai thác CSV/XLSX & đối chiếu comments:** [`references/DOC_AND_HYBRID_ANALYSIS.md`](../../../.claude/skills/skills-requirements-analyzer/references/DOC_AND_HYBRID_ANALYSIS.md) (Mục 1).
- **Cập nhật bảng danh mục toàn hệ thống `docs/requirements/README.md`:** [`references/DISCOVERY_AND_CATALOG.md`](../../../.claude/skills/skills-requirements-analyzer/references/DISCOVERY_AND_CATALOG.md) (Mục 1).

---

## 2. Điều Kiện Tiên Quyết & Đầu Vào (Pre-conditions & Inputs)

> ⛔ **Điều kiện bắt buộc:** Module đích phải **đã có** `docs/requirements/<module>/requirements_<module>.md`. Nếu file chưa tồn tại → **DỪNG NGAY** và hướng dẫn user chạy `/generate-requirements-from-website` hoặc `/analyze-requirement-document`. Workflow này chỉ cập nhật delta tại chỗ và xuất Impact Report (**KHÔNG sinh test cases**).

| # | Đầu vào | Bắt buộc | Mô tả |
|---|---|---|---|
| 1 | **Ticket mới / Quyết định PO (`<TICKET-ID>`)** | ✅ | File hoặc nội dung ticket (ủy quyền skill `docx`/`xlsx`/`pdf` cho file nhị phân; URL Jira route sang `/fetch-jira-requirements`) |
| 2 | **Module đích (`<module>`)** | ✅ | Xác định `docs/requirements/<module>/requirements_<module>.md` |
| 3 | **Thư mục Test Cases / RTM** | ⭕ Khuyến khích | Tra `docs/testcases/<module>/` hoặc RTM để liệt kê chính xác `TC ID` bị ảnh hưởng trong Impact Report (chưa có thì ghi `⚠️ chưa rà soát`) |
| 4 | **Mockup / File bảng đính kèm** | ⭕ Tùy chọn | Khai thác theo `DOC_AND_HYBRID_ANALYSIS.md` mục 1.3 |

---

## 3. Trình Tự Thực Thi & Điểm Dừng (Execution & HITL Checkpoints)

Thực thi chi tiết theo `OUTPUT_TEMPLATES_AND_GATE.md` mục 5:

1. **Bước 1 — Nạp trạng thái hiện tại & Tóm tắt cho User (BẮT BUỘC):**
   - Đọc `docs/requirements/<module>/requirements_<module>.md` (nếu có `## Bản đồ tài liệu` thì đọc tiếp các file trong `stories/`).
   - Trích xuất toàn bộ `REQ ID` hiện có, `Dải mã đã dùng`, `Mã kế tiếp`, danh sách `AMB-XX` (`❓`/`✅`/`⏭️`) và Nhật ký thay đổi (mục 6.9).
   - **Tóm tắt ngay cho user trước khi sửa:** *"Module `<module>` hiện có N REQ (a active / b changed / c deprecated), M ambiguity còn treo, mã kế tiếp là `REQ-XXX-nn`."*
2. **Bước 2 — Đọc ticket mới & Phân loại 5 nhóm Delta:**
   - Đọc mô tả ticket, toàn bộ comments và file đính kèm.
   - Rà soát toàn bộ REQ hiện có trước khi xếp vào nhóm **THÊM** để chống cấp trùng mã cho hành vi đã tồn tại:
     - `🟢 THÊM`: Hành vi mới hoàn toàn → cấp mã mới từ `Mã kế tiếp` (**tuyệt đối không đánh lại từ `01`**).
     - `🟡 SỬA`: Cùng hành vi nhưng đổi điều kiện/ngưỡng/message → **GIỮ NGUYÊN mã REQ cũ**, sửa nội dung, đổi trạng thái `🟡`, ghi `Ngày · <TICKET-ID>` vào `Cập nhật lần cuối`.
     - `🔴 BỎ`: Gỡ tính năng → đổi trạng thái sang `🔴 Deprecated` (**TUYỆT ĐỐI KHÔNG xoá dòng REQ**, không tái sử dụng mã).
     - `⚪ CHƯA BUILD`: Cấp mã mới từ `Mã kế tiếp`, trạng thái `⚪`.
     - `⏸️ TRÙNG`: Không sửa REQ, ghi nhận vào báo cáo là *"đã có sẵn, không tác động"*.
   - **⏸️ HITL Checkpoint:** Nếu không chắc một AC thuộc `🟡 SỬA` hay `🟢 THÊM` → xếp tạm vào `🟡 SỬA` và **hỏi user xác nhận**, không tự quyết.
3. **Bước 3 — Đối chiếu với `AMB-XX` đang treo (`❓`):**
   - Nếu ticket giải quyết `AMB-XX` **trùng** Assumption tạm → đổi sang `✅` (TC giữ nguyên).
   - Nếu giải quyết **khác** Assumption tạm → đổi sang `✅` và **bắt buộc đưa mọi TC dựa trên assumption cũ vào Impact Report**.
   - Nếu sinh yêu cầu mới → cấp REQ mới từ `Mã kế tiếp`, ghi chú `Giải quyết AMB-XX`. AMB mới phát sinh đánh tiếp theo dải hiện có.
4. **Bước 4 — Cập nhật tại chỗ & Đồng bộ 4 nơi:**
   - Chạy **Cổng Tự Soát REQ 10 điểm** (`SKILL.md` mục 3.1) trên các REQ thêm/sửa.
   - Sửa tại chỗ `requirements_<module>.md`: bảng REQ (6.2), Field Spec/Validation/Ma trận (6.3–6.6), bảng AMB (6.7), kiểm tra lại dòng tổng Phân rã Epic/Story (6.8), thêm dòng mới lên đầu **Nhật ký thay đổi (6.9)** (kể cả `✏️ Biên tập`), và cập nhật `Dải mã đã dùng` / `Mã kế tiếp` ở Metadata (6.1). Nếu vượt ngưỡng `> 80` REQ → báo user trước khi tách file.
   - Cập nhật **`docs/requirements/README.md`** (bảng mục 1, bảng tổng trạng thái mục 2, AMB 🔴 High mục 3) — giữ **4 nơi khớp nhau tuyệt đối**: `Nhật ký (6.9) ↔ Trạng thái REQ (6.2) ↔ Metadata (6.1) ↔ README.md`.
5. **Bước 5 — Xuất Impact Report ra file (BẮT BUỘC):**
   - Ghi file `docs/requirements/<module>/impact/impact_<TICKET-ID>.md` theo đúng mẫu tại `OUTPUT_TEMPLATES_AND_GATE.md` mục 5.2 (kể cả khi không có TC nào bị ảnh hưởng), hiển thị trong chat và báo lệnh kế tiếp: `/update-testcases-from-impact`.

## 4. Hợp Đồng Đầu Ra (Output File Contract)
- `docs/requirements/<module>/requirements_<module>.md` (và `stories/story_NN_<slug>.md` nếu đã tách) — Cập nhật tại chỗ, giữ nguyên mọi `REQ ID` cũ.
- `docs/requirements/<module>/impact/impact_<TICKET-ID>.md` (**Impact Report** bắt buộc ghi ra đĩa) & đồng bộ `docs/requirements/README.md`.
