---
name: analyze-requirement-document
description: "Phân tích requirement document (Jira ticket, .docx/.pdf/.xlsx/.csv/.xml, user story, mockup) — sinh tài liệu phân tích 10 mục chuẩn mực, KHÔNG sinh test cases."
skills:
  - skills-requirements-analyzer
---

# Workflow Dispatcher: Phân Tích Tài Liệu Yêu Cầu (`/analyze-requirement-document`)

## 1. Context Pointers (Tài liệu bắt buộc nạp)

- **Quy ước đánh mã (`REQ`, `AMB`, `RISK`), luật nối tiếp mã & Cổng Tự Soát 10 điểm:** [`.claude/skills/skills-requirements-analyzer/SKILL.md`](../../../.claude/skills/skills-requirements-analyzer/SKILL.md) (Mục 1, 2 & 3.1).
- **Chốt chặn đầu vào, công cụ đọc từng định dạng, khai thác CSV/XLSX, đối chiếu đa nguồn, xử lý thiếu AC & Template 10 mục `analysis_<TICKET-ID>.md`:** [`references/DOC_AND_HYBRID_ANALYSIS.md`](../../../.claude/skills/skills-requirements-analyzer/references/DOC_AND_HYBRID_ANALYSIS.md) (Mục 1 & 3).
- **Framework phát hiện Ambiguity/Risk & Chi tiết Cổng Tự Soát REQ 10 điểm:** [`references/OUTPUT_TEMPLATES_AND_GATE.md`](../../../.claude/skills/skills-requirements-analyzer/references/OUTPUT_TEMPLATES_AND_GATE.md) (Mục 1 & 2).
- **Kiểm tra/khởi tạo `docs/requirements/README.md` & đồng bộ danh mục:** [`references/DISCOVERY_AND_CATALOG.md`](../../../.claude/skills/skills-requirements-analyzer/references/DISCOVERY_AND_CATALOG.md) (Mục 1).

> ⚠️ Workflow này chỉ chạy nhánh **Document Analysis** (không mở trình duyệt, không dùng cấu trúc mục 6 của `requirements_<module>.md`, và **TUYỆT ĐỐI KHÔNG sinh test cases**). Nếu nguồn sự thật chỉ là website đang chạy → dùng `/generate-requirements-from-website`.

---

## 2. ⛔ Bước 0 — Chốt Chặn Đầu Vào (HITL Guardrail — BẮT BUỘC)

Mở tệp đầu vào và kiểm tra ngay trước khi phân tích (chi tiết tại `DOC_AND_HYBRID_ANALYSIS.md` mục 1.1). **DỪNG NGAY, báo user và hỏi ý định thật** nếu gặp bất kỳ trường hợp nào sau:
1. **Tệp truyền vào là sản phẩm đầu ra của workflow khác:**
   - Khớp `requirements_<module>.md` (hoặc có bảng `REQ ID` / `Dải mã đã dùng` / `Nhật ký thay đổi`) → muốn cập nhật theo ticket thì dùng `/update-requirements-from-ticket`; muốn sinh TC thì dùng `/generate-testcases-*`.
   - Khớp `system_map.md` / `api_map.md` trong `_discovery/` → muốn recon module thì dùng `/generate-requirements-from-website`.
   - Khớp `analysis_<TICKET-ID>.md`, `impact_<TICKET-ID>.md`, hoặc `test_cases_<module>.md`.
2. **Không xác định được `TICKET-ID`** từ tài liệu đầu vào (cấm tự bịa Ticket ID từ tên module hay ngày tháng).
3. **Đầu vào là URL Jira / Confluence:** không tự fetch; điều hướng sang `/fetch-jira-requirements` (`skills-jira-integration`). Nếu MCP chưa authorize hoặc không đọc được file bằng bất kỳ công cụ nào → **dừng và báo user**, cấm suy đoán nội dung từ tên file.

---

## 3. Đầu Vào Cần Thu Thập (Required Inputs)

| # | Đầu vào | Bắt buộc | Quy tắc xử lý định dạng |
|---|---|---|---|
| 1 | **Requirement document** (`.md`, `.doc`, `.docx`, `.pdf`, `.xlsx`, `.csv`, `.xml`) | ✅ | `.docx` → skill `docx` · `.xlsx/.csv` → skill `xlsx` · `.pdf` → skill `pdf` · `.pptx` → skill `pptx` · `.doc` (HTML Jira) / text → `Read` |
| 2 | **Module đích (`<module>`)** | ✅ | Xác định thư mục `docs/requirements/<module>/` (chưa rõ module nào → **hỏi user**, không tự đoán) |
| 3 | **Mockup / Screenshot / File bảng đính kèm / Related tickets** | ⭕ Khuyến khích | Ảnh dùng `Read`; file bảng CSV/XLSX khai thác làm nguồn Field Spec / Validation Messages / Ma trận |

---

## 4. Trình Tự Thực Thi & Cổng Chất Lượng (Execution & Quality Gates)

Thực thi theo `DOC_AND_HYBRID_ANALYSIS.md` mục 1 & 3:
1. **Bước 1 — Đọc hiểu toàn diện:** Đọc tài liệu chính, toàn bộ **comments** (quyết định mới nhất có ngày đè lên mô tả gốc), related tickets, mockup và file bảng đính kèm (`.xlsx`/`.csv`).
2. **Bước 2 — Kiểm tra nối tiếp mã & Phân rã AC:**
   - Đọc `docs/requirements/README.md` và `docs/requirements/<module>/requirements_<module>.md` trước khi gán mã đầu tiên. Nếu module đã có tài liệu → **đánh tiếp từ số `REQ ID`, `AMB-XX`, `RISK-XX` cuối cùng** (tuyệt đối không đánh lại từ `01`). Nếu AC sửa hành vi REQ đã có → giữ nguyên mã cũ, ghi chú `Cập nhật bởi ticket <ID>`.
   - Trích **nguyên văn** User Story và từng rule AC kèm cột `Nguồn` ghi vị trí cụ thể (`Ticket ABC-123 · AC#4`, `field_spec.xlsx · sheet "Fields" · dòng 12`, `Comment của PO ngày YYYY-MM-DD`).
   - Nếu ticket **không có AC nào**: **cấm tự viết AC thay PO/BA**; liệt kê câu hỏi dạng `AMB-XX` 🔴 High và ghi rõ ở mục 1: *"Ticket chưa có AC — tài liệu này CHƯA ĐỦ để sinh test case"*. Phân biệt rõ *"Không đề cập trong tài liệu"* (kèm `AMB-XX`) với *"Không áp dụng"*.
3. **Bước 3 — Đối chiếu chéo đa nguồn & Phát hiện AMB/RISK:**
   - Khi có `≥ 2` nguồn → bắt buộc lập **Bảng đối chiếu chéo nguồn** (mục `4b`) theo thứ tự ưu tiên `Comment mới nhất > AC mô tả > File đính kèm > Mockup`, và mở `AMB-XX` kèm Assumption tạm cho **mọi** xung đột.
4. **Bước 4 — Tự soát 10 điểm & Đồng bộ ngược dải mã:**
   - Chạy **Cổng Tự Soát REQ 10 điểm** (`SKILL.md` mục 3.1 & `OUTPUT_TEMPLATES_AND_GATE.md` mục 2) trước khi ghi file.
   - Cập nhật ngược dải `REQ ID` vừa cấp vào bảng metadata của `docs/requirements/<module>/requirements_<module>.md` (nếu đã có) và bảng danh mục `docs/requirements/README.md`.

---

## 5. Hợp Đồng Đầu Ra (Output File Contract)

- **1 ticket hoặc `< 25` REQ:** Xuất 1 file theo đúng **Template 10 mục** (`DOC_AND_HYBRID_ANALYSIS.md` mục 3.2) tại:
  `docs/requirements/<module>/analysis/analysis_<TICKET-ID>.md`
- **Gộp `≥ 3` related tickets hoặc `≥ 25` REQ:** Tách thành Index `docs/requirements/<module>/analysis/analysis_<TICKET-ID>.md` (chứa `## Bản đồ tài liệu`, AMB/RISK toàn cục, Business Rules tổng hợp) + file con `docs/requirements/<module>/analysis/<TICKET-ID>/ticket_<DEP-N>.md`.
