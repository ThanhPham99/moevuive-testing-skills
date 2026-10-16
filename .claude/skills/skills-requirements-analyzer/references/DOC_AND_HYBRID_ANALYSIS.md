# Phân Tích Tài Liệu & Đối Chiếu Tài Liệu Bán Phần (Document & Hybrid Analysis)

Tài liệu tham chiếu cho nhánh **Document Analysis** (`/analyze-requirement-document`, Bước 2 của `/update-requirements-from-ticket`) và nhánh **Hybrid / Tài liệu bán phần** (kết hợp tài liệu với `/generate-requirements-from-website`).

---

## 1. Nhánh Document Analysis — Phân tích tài liệu có sẵn (Mục 3.2)

### 1.1. Bước 0 — Chốt chặn đầu vào & Đọc đúng định dạng file

**Chốt chặn đầu vào (khi chạy `/analyze-requirement-document`):**
Mở tệp đầu vào và kiểm tra ngay 3 dấu hiệu nhận diện **sản phẩm đầu ra của workflow khác**. Trúng bất kỳ dấu hiệu nào hoặc không xác định được `TICKET-ID` → **DỪNG, báo user, hỏi ý định thật** (tuyệt đối không tự bịa Ticket ID từ tên module/ngày tháng):
- Tên khớp `requirements_<module>.md`, hoặc có bảng `REQ ID` / `Dải mã đã dùng` / `Nhật ký thay đổi` → đầu ra của `/generate-requirements-from-website` (muốn cập nhật theo ticket → dùng `/update-requirements-from-ticket`; muốn sinh TC → dùng `/generate-testcases-*`).
- Tên khớp `system_map.md` / `api_map.md`, hoặc nằm trong `_discovery/` → đầu ra của `/discover-system` (muốn recon chi tiết → dùng `/generate-requirements-from-website`).
- Tên khớp `analysis_<TICKET-ID>.md`, `impact_<TICKET-ID>.md`, `test_cases_<module>.md` → hỏi user muốn thực hiện thao tác gì tiếp theo.

**Định dạng hỗ trợ & công cụ đọc bắt buộc (CẤM dùng `Read` thẳng cho file nhị phân):**

| Định dạng | Cách xử lý bắt buộc |
|---|---|
| `.md`, `.txt`, `.html`, `.xml`, `.json` | `Read` trực tiếp. File `.doc` export từ Jira thực chất là HTML → `Read` rồi bóc tag |
| `.docx`, `.dotx` | **Ủy quyền cho skill `docx`** (là ZIP/OOXML, `Read` thẳng ra rác) |
| `.xlsx`, `.xlsm`, `.csv`, `.tsv` | **Ủy quyền cho skill `xlsx`** |
| `.pdf` | **Ủy quyền cho skill `pdf`** |
| `.pptx` | **Ủy quyền cho skill `pptx`** |
| Ảnh (`.png`, `.jpg` — mockup, screenshot) | `Read` — công cụ hiển thị ảnh trực tiếp |
| URL Jira / Confluence | **KHÔNG tự fetch.** Route sang `/fetch-jira-requirements` (`skills-jira-integration`). Nếu MCP chưa authorize → **dừng và báo user**, tuyệt đối không bịa nội dung ticket |

> ⚠️ Nếu không đọc được file bằng bất kỳ cách nào → **báo user và dừng**, không suy đoán nội dung từ tên file.

### 1.2. Bước 1 — Trích xuất theo thứ tự 8 hạng mục

1. **Metadata:** Ticket ID, Type, Priority, Status, Reporter, Assignee, Fix Version, Sprint, Labels, Epic cha.
2. **User Story:** Dạng `"As a… I want… So that…"` — trích **nguyên văn**, không diễn đạt lại.
3. **Scope:** Module/page/component bị ảnh hưởng; ghi rõ cả phần **ngoài phạm vi** nếu tài liệu có nêu.
4. **Acceptance Criteria:** Trước khi gán mã đầu tiên, kiểm tra `docs/requirements/README.md` và `docs/requirements/<module>/requirements_<module>.md` để **đánh tiếp từ số REQ cuối cùng** (mục 2 của `SKILL.md`). Gán `REQ-<MODULE>-<SỐ>` cho từng rule đủ nhỏ để kiểm thử độc lập. Nếu AC sửa hành vi của một REQ đã có → giữ nguyên mã cũ, ghi chú `Cập nhật bởi ticket <ID>`.
5. **Dependencies:** Đọc và tóm tắt các ticket/feature được tham chiếu trong AC hoặc comments (kèm phân tích mockup của ticket phụ thuộc nếu có).
6. **Comments:** Đọc toàn bộ comments — thường chứa quyết định nghiệp vụ mới nhất và **đè lên** phần mô tả gốc.
7. **Attachments:** Phân tích chi tiết layout, components, fields trong mockup/screenshot và khai thác file bảng theo Bước 2.
8. **Lịch sử thay đổi (nếu có):** AC nào vừa sửa gần đây là vùng rủi ro cao.

### 1.3. Bước 2 — Khai thác file bảng (CSV/XLSX — nguồn Field Spec tốt nhất)

| Loại bảng đính kèm | Dùng để sinh hạng mục nào |
|---|---|
| Danh sách field/cột kèm kiểu dữ liệu, bắt buộc, độ dài | **Field Specifications** (mục 6.3) — ánh xạ gần như 1:1 |
| Bảng thông báo lỗi / message key | **Validation Messages** (mục 6.4) |
| Ma trận role × chức năng | **Ma trận Phân quyền** (mục 6.5) |
| Bảng trạng thái × hành động | **Ma trận Trạng thái** (mục 6.6) |
| Data mẫu / test data | Ghi chú làm đầu vào cho `/generate-test-data` — **không** đưa vào requirements |

Khi trích từ file bảng, cột `Nguồn` **phải ghi rõ vị trí**: `<tên file> · sheet "<tên>" · dòng <n>`.

### 1.4. Bước 3 — Đối chiếu chéo các nguồn (BẮT BUỘC khi có ≥ 2 nguồn)

Lập bảng đối chiếu trước khi viết phần phân tích AC:

| Hạng mục | Ticket mô tả | Comment | Mockup | File đính kèm | Kết luận |
|---|---|---|---|---|---|
| VD: Độ dài tối đa của Tên | Không nói | 255 | — | 200 | ⚠️ Xung đột → `AMB-XX` |

**Thứ tự ưu tiên mặc định khi các nguồn mâu thuẫn** (luôn ghi rõ đã chọn nguồn nào và vì sao):
1. **Comment / quyết định mới nhất có ghi ngày** (mới nhất thắng)
2. **AC trong phần mô tả ticket** (cam kết chính thức)
3. **File đặc tả đính kèm** (`CSV` / `XLSX` / `DOCX`)
4. **Mockup / wireframe** (dễ lỗi thời nhất)

> ❗ **Mọi xung đột giữa các nguồn đều phải mở một `AMB-XX` kèm Assumption tạm**, kể cả khi đã áp thứ tự ưu tiên trên. Không tự giải quyết im lặng.

### 1.5. Bước 4 — Xử lý tài liệu thiếu

| Tình huống | Cách xử lý bắt buộc |
|---|---|
| Ticket **không có AC nào**, chỉ 1–2 dòng mô tả | ❌ **KHÔNG tự viết AC thay PO/BA.** Ghi nhận đúng những gì có, liệt kê danh sách câu hỏi dạng `AMB-XX` mức 🔴 High, và nêu rõ ở Overview/Metadata: *"Ticket chưa có AC — tài liệu này CHƯA ĐỦ để sinh test case"* |
| AC viết mơ hồ (*"hoạt động đúng"*, *"như module cũ"*) | Gán `REQ ID` bình thường **nhưng** kèm ngay 1 `AMB-XX` hỏi tiêu chí nghiệm thu cụ thể |
| Tham chiếu *"giống module X"* | Nếu đã có `docs/requirements/<X>/requirements_<X>.md` → trích REQ tương ứng và **link chéo**. Nếu chưa có → mở `AMB-XX`, không tự suy diễn |
| Thiếu hoàn toàn thông tin phân quyền / trạng thái | Ghi **"Không đề cập trong tài liệu"** (phân biệt rõ với *"Không áp dụng"*) + mở `AMB-XX` |

---

## 2. Nhánh Hybrid — Kết hợp Tài liệu và UI Thực tế (Mục 3.3 & 3.3.1)

### 2.1. Khi tài liệu phủ đầy đủ module (Mục 3.3)

Chạy **Mục 1 (Document Analysis) trước** để nắm ý định thiết kế, sau đó chạy **`UI_RECON_AND_EVIDENCE.md` sau** để đối chiếu thực tế. Phân loại mọi điểm lệch:

| Kiểu lệch pha | Ý nghĩa | Xử lý bắt buộc |
|---|---|---|
| **Tài liệu có, UI chưa có** | Tính năng chưa build hoặc build thiếu | Giữ REQ, đặt trạng thái `⚪ Chưa implement` |
| **UI có, tài liệu không nói** | Tính năng ngoài tài liệu (scope creep / di sản) | Vẫn gán REQ, cột `Nguồn` ghi `UI thực tế — ngoài tài liệu` + mở `AMB-XX` |
| **Cả hai có nhưng khác nhau** | Xung đột thật giữa spec và bản chạy | Mở `AMB-XX` mức 🔴 High, ghi nguyên văn cả hai giá trị |

### 2.2. Khi tài liệu chỉ phủ một phần — Chia vùng trước khi Recon (Mục 3.3.1)

**Bước 1 — Lập Bản đồ phủ tài liệu TRƯỚC khi mở trình duyệt** (nếu đã có `docs/requirements/_discovery/doc_inventory.md`, lấy bản đồ cấp hệ thống rồi chi tiết hoá xuống từng vùng chức năng của module):

| Vùng chức năng | Tài liệu phủ | Mức phủ | Chiến lược recon |
|---|---|---|---|
| Form tạo mới | `field_spec.xlsx` sheet "Customer" dòng 3–28 | `🟩 Đầy đủ` | **Đối chiếu:** Mở màn hình kiểm từng dòng spec có khớp UI không; lệch → `AMB-XX` |
| Import Excel | Ticket ABC-12 mô tả 3 dòng | `🟨 Một phần` | **Bổ khuyết:** Trích dẫn phần khớp; recon đầy đủ phần tài liệu bỏ trống (validation, edge case, phân quyền) |
| Phân quyền | — | `⬜ Trắng` | **Recon đầy đủ:** Chạy trọn vẹn 9 bước UI Recon như khi không có tài liệu |
| Danh sách & lọc | Mockup `list_v1.png` (cũ) | `⚠️ Nghi lỗi thời` | **UI thắng:** Recon đầy đủ như `⬜ Trắng`; dùng tài liệu làm danh sách câu hỏi đối chiếu. Khớp UI → nâng lên `Tài liệu + kiểm chứng thực tế`; lệch → `AMB-XX` kèm nguyên văn cả hai bên |

**Bước 2 — Ghi cột `Nguồn` phân biệt rõ 4 mức:**
- `Tài liệu · <file> · <vị trí>`: Chỉ có trong tài liệu, chưa mở UI kiểm chứng.
- `Tài liệu + kiểm chứng thực tế`: Tài liệu nêu và đã mở UI xác nhận khớp (mức tin cậy cao nhất).
- `UI thực tế` / `Kiểm chứng thực tế`: Chỉ có ở UI, tài liệu không đề cập.
- `API · <method> <endpoint>`: Lấy từ tầng network (`UI_RECON_AND_EVIDENCE.md` mục 3).

**Luật cứng của nhánh Tài liệu bán phần:**
- Không dùng đặc tả của vùng này để suy diễn vùng khác (spec form tạo mới **không** nói gì về form sửa, dù hai form nhìn giống nhau).
- Vùng `⬜ Trắng` không được rút gọn recon với lý do *"chắc giống vùng kia"*.
- **Bản đồ phủ tài liệu bắt buộc nằm trong tài liệu đầu ra** (mục 6.5.1 trong `OUTPUT_TEMPLATES_AND_GATE.md`, đặt ngay sau Tổng quan).

---

## 3. Luật Cứng Nhánh Tài Liệu (Mục 7.3) & Template `analysis_<TICKET-ID>.md`

### 3.1. Luật cứng khi phân tích tài liệu (Mục 7.3)
- **Trích dẫn nguyên văn** mọi rule, message, giá trị ngưỡng — không diễn đạt lại rồi gán mã REQ.
- **Ghi vị trí nguồn cụ thể** ở cột `Nguồn` (`✅ Ticket ABC-123 · AC#4` · `✅ field_spec.xlsx · sheet "Fields" · dòng 12` · `✅ Comment của PO ngày 2026-07-15`; cấm ghi chung chung *"theo tài liệu"* hay *"trong ticket"*).
- **Chạy Cổng Tự Soát REQ 10 điểm** (`SKILL.md` mục 3 & `OUTPUT_TEMPLATES_AND_GATE.md` mục 2) trước khi ghi file.
- **Cập nhật ngược dải REQ đã dùng** vào bảng metadata của `docs/requirements/<module>/requirements_<module>.md` và `docs/requirements/README.md` sau khi cấp thêm REQ từ ticket.

### 3.2. Quy mô, Nơi lưu & Template 10 Mục cho `/analyze-requirement-document`

- **Nơi lưu bắt buộc:** `docs/requirements/<module>/analysis/analysis_<TICKET-ID>.md` (nếu chưa rõ module đích thì hỏi user; nếu module chưa có thư mục thì tạo mới và bổ sung 1 dòng vào `docs/requirements/README.md`).
- **Ngưỡng tách file phân tích ticket:** Một ticket đơn lẻ tự nó là một Story nên không chia Epic/Story. Tuy nhiên nếu gộp **≥ 3 related tickets** hoặc **≥ 25 REQ**, tách thành:
  - Index: `docs/requirements/<module>/analysis/analysis_<TICKET-ID>.md` (giữ metadata, User Story, Scope, Business Rules tổng hợp, Ma trận trạng thái, toàn bộ AMB/RISK đánh số chung, Checklist AC, Khuyến nghị kiểm thử, và mục `## Bản đồ tài liệu`).
  - File con: `docs/requirements/<module>/analysis/<TICKET-ID>/ticket_<DEP-N>.md` (giữ AC chi tiết + phân tích mockup riêng của từng ticket).
- **Cấu trúc 10 mục bắt buộc của `analysis_<TICKET-ID>.md`:**

```markdown
# 📋 Phân Tích Requirement: [TICKET-ID]
## [Ticket Title]

## 1. Tổng Quan Ticket
| Thuộc tính | Giá trị |
|---|---|
| **Ticket ID / Type / Priority / Status / Sprint / Assignee** | ... |
| **Nguồn phân tích** | Liệt kê MỌI file/nguồn đã đọc: `ABC-123.docx` · `field_spec.xlsx` · 3 comments · `mockup_v2.png` |
| **Dải mã đã dùng**  | `REQ-PRJ-66` → `REQ-PRJ-78` · `AMB-01` → `AMB-05` · `RISK-01` → `RISK-03` |
| **Mã kế tiếp**      | Đợt sau bắt đầu từ `REQ-PRJ-79` — **KHÔNG đánh lại từ 01** |
| **Mức độ đầy đủ**   | Đủ AC để sinh test case / ⚠️ Thiếu AC — chưa đủ (xem mục 7) |

## 2. User Story
(Trích NGUYÊN VĂN "As a... I want... So that...")

## 3. Phạm Vi Áp Dụng (Scope)
(Bảng modules/pages bị ảnh hưởng — ghi rõ cả phần NGOÀI phạm vi nếu tài liệu có nêu)

## 4. Acceptance Criteria — Phân Tích Chi Tiết
### 4.1. [Nhóm AC 1] ... 4.N. [Nhóm AC N]
(Bảng REQ: mỗi rule 1 mã `REQ-<MODULE>-<SỐ>` + cột `Nguồn` ghi vị trí cụ thể)

## 4b. Đối Chiếu Chéo Nguồn (bắt buộc khi có ≥ 2 nguồn)
| Hạng mục | Ticket mô tả | Comment | Mockup | File đính kèm | Kết luận |

## 5. Phụ Thuộc (Dependencies)
(Tóm tắt ticket phụ thuộc, chi tiết UI mockup phụ thuộc, và Business Rules tổng hợp phân biệt rõ ticket chính vs phụ thuộc)

## 6. Phân Tích Mockup/Screenshot
(Mô tả layout, components, chi tiết fields, điểm lệch giữa mockup và mô tả văn bản)

## 7. Các Điểm Mơ Hồ & Rủi Ro
### 7.1. Điểm Mơ Hồ (Ambiguities — `AMB-XX | Câu hỏi | Nguy cơ | Mức độ | Assumption tạm`)
### 7.2. Rủi Ro Kiểm Thử (Testing Risks — `RISK-XX | Rủi ro | Mô tả | Mitigation`)

## 8. Ma Trận Trạng Thái (nếu applicable — hoặc ghi rõ "Không đề cập trong tài liệu" / "Không áp dụng")

## 9. Tóm Tắt Acceptance Criteria (Checklist checkbox nhóm theo chức năng)

## 10. Khuyến Nghị Cho Kiểm Thử (Top gợi ý trọng tâm khi test — KHÔNG sinh test cases)
```
