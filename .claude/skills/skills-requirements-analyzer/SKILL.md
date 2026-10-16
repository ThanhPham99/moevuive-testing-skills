---
name: skills-requirements-analyzer
description: Phân tích yêu cầu và khám phá hệ thống — trích xuất REQ ID, AMB, RISK từ UI thực tế (UI Recon), tài liệu/ticket (Document Analysis), đối chiếu bán phần (Hybrid), bản đồ hệ thống (_discovery/), và cập nhật delta kèm Impact Report.
---

# Kỹ năng Phân tích Yêu cầu & Khám phá Hệ thống (Requirements Analyzer)

Chuyển đổi giao diện UI thực tế, tầng network, hoặc tài liệu (Jira ticket, `.docx`, `.xlsx`, `.pdf`, mockup) thành **Requirement Index** (`requirements_<module>.md`), **Discovery Map** (`_discovery/system_map.md`), bản phân tích ticket (`analysis_<TICKET-ID>.md`), hoặc **Impact Report** (`impact_<TICKET-ID>.md`) truy vết được 100%.

---

## 1. Mục tiêu cốt lõi & Bảng điều hướng nhánh (Branch Routing)

Xác định nhánh thực thi theo nguồn đầu vào và **chỉ nạp file tham chiếu tương ứng** (Progressive Disclosure):

| Nhánh tác vụ (Branch) | Khi nào kích hoạt | File tham chiếu bắt buộc nạp (Context Pointers) | Đầu ra chính |
|---|---|---|---|
| **1. System Discovery** (`/discover-system`) | Chưa biết hệ thống có những module/prefix nào; hoặc bổ sung/rà lại bản đồ hệ thống (`UI`, `HYBRID`, `DOC`, `ADD`, `DELTA`) | [`references/DISCOVERY_AND_CATALOG.md`](references/DISCOVERY_AND_CATALOG.md) · *(nếu mở trình duyệt: thêm [`references/UI_RECON_AND_EVIDENCE.md`](references/UI_RECON_AND_EVIDENCE.md))* | `docs/requirements/README.md` + `docs/requirements/_discovery/system_map.md` *(tuyệt đối không sinh `REQ ID`)* |
| **2. UI Recon** (`/generate-requirements-from-website`) | Phân tích module từ website/ứng dụng đang chạy (không có tài liệu) | [`references/UI_RECON_AND_EVIDENCE.md`](references/UI_RECON_AND_EVIDENCE.md) + [`references/OUTPUT_TEMPLATES_AND_GATE.md`](references/OUTPUT_TEMPLATES_AND_GATE.md) + [`references/DISCOVERY_AND_CATALOG.md`](references/DISCOVERY_AND_CATALOG.md) (mục 1 & 2.5) | `docs/requirements/<module>/requirements_<module>.md` + `evidence/*.png` |
| **3. Hybrid Recon** (Website + Tài liệu đủ/bán phần) | Có cả hệ thống đang chạy lẫn tài liệu đặc tả (đầy đủ hoặc bán phần) | [`references/DOC_AND_HYBRID_ANALYSIS.md`](references/DOC_AND_HYBRID_ANALYSIS.md) (mục 2) + [`references/UI_RECON_AND_EVIDENCE.md`](references/UI_RECON_AND_EVIDENCE.md) + [`references/OUTPUT_TEMPLATES_AND_GATE.md`](references/OUTPUT_TEMPLATES_AND_GATE.md) | `docs/requirements/<module>/requirements_<module>.md` (kèm Bản đồ phủ tài liệu mục 6.5.1) |
| **4. Document Analysis** (`/analyze-requirement-document`) | Phân tích độc lập Jira ticket, `.docx`, `.pdf`, `.xlsx/.csv`, user story, mockup (không mở trình duyệt) | [`references/DOC_AND_HYBRID_ANALYSIS.md`](references/DOC_AND_HYBRID_ANALYSIS.md) (mục 1 & 3) + [`references/OUTPUT_TEMPLATES_AND_GATE.md`](references/OUTPUT_TEMPLATES_AND_GATE.md) (mục 1 & 2) | `docs/requirements/<module>/analysis/analysis_<TICKET-ID>.md` |
| **5. Requirement Delta** (`/update-requirements-from-ticket`) | Module đã có `requirements_<module>.md`, cần cập nhật từ ticket mới / quyết định PO và xuất Impact Report | [`references/OUTPUT_TEMPLATES_AND_GATE.md`](references/OUTPUT_TEMPLATES_AND_GATE.md) (mục 4 & 5) + [`references/DOC_AND_HYBRID_ANALYSIS.md`](references/DOC_AND_HYBRID_ANALYSIS.md) (mục 1) + [`references/DISCOVERY_AND_CATALOG.md`](references/DISCOVERY_AND_CATALOG.md) (mục 1) | Cập nhật tại chỗ `requirements_<module>.md` + `docs/requirements/<module>/impact/impact_<TICKET-ID>.md` |

---

## 2. Quy Ước Đánh Mã & Luật Nối Tiếp Mã (BẮT BUỘC)

| Loại mã | Format chuẩn | Ví dụ | Vai trò & Bất biến |
|---|---|---|---|
| **Requirement** | `REQ-<MODULE>-<NN>` | `REQ-LOGIN-01` | **Lớp truy vết duy nhất, bất biến.** Mỗi REQ = 1 rule đủ nhỏ để test độc lập. Hệ thống thứ hai trong namespace `_<hệ-thống>/` dùng `REQ-<HỆ_THỐNG>-<MODULE>-<NN>` |
| **Story** | `STORY-<MODULE>-<NN>` | `STORY-PRJ-03` | Lớp nhóm việc (backlog view) — được gộp/tách lại mà **không** đổi số `REQ ID` |
| **Ambiguity** | `AMB-<NN>` | `AMB-03` | Điểm mơ hồ cần PO/BA làm rõ (`🔴 High` / `🟡 Medium` / `🟢 Low`), kèm Assumption tạm và trạng thái (`❓` / `✅` / `⏭️`) |
| **Risk** | `RISK-<NN>` | `RISK-02` | Rủi ro kiểm thử kèm phương án giảm thiểu (`Mitigation`) |

### Quy trình 6 bước nối tiếp mã TRƯỚC KHI gán `REQ ID` đầu tiên:
1. **Đọc `docs/requirements/README.md` (luôn làm đầu tiên):** Kiểm tra các module đã có, **danh sách prefix đã chiếm** (module mới phải chọn prefix chưa dùng), và `Mã kế tiếp` của từng module. Nếu dự án mới chưa có `README.md` → **bắt buộc khởi tạo ngay** theo [`references/DISCOVERY_AND_CATALOG.md`](references/DISCOVERY_AND_CATALOG.md) mục 1.1 trước khi ghi tài liệu module.
2. **Kiểm tra `docs/requirements/<module>/requirements_<module>.md`:**
   - Chưa tồn tại → đánh số từ `01`.
   - Đã tồn tại → tìm số lớn nhất đang dùng và **đánh tiếp từ số kế tiếp** (`REQ-PRJ-65` → mới bắt đầu từ `REQ-PRJ-66`). Áp dụng cùng nguyên tắc nối tiếp cho `AMB-XX` và `RISK-XX`.
3. **Không bao giờ đánh lại từ `01` và không bao giờ xoá dòng REQ:** Tính năng bị gỡ bỏ thì giữ nguyên dòng, chuyển trạng thái sang `🔴 Deprecated`. Mã của REQ đã Deprecated là **vĩnh viễn chết**, cấm tái sử dụng.
4. **Sửa hành vi đã có = Giữ nguyên mã cũ:** Nếu ticket mới thay đổi điều kiện/ngưỡng của một hành vi đã có `REQ ID`, giữ nguyên mã cũ, chuyển trạng thái sang `🟡 Changed`, và ghi `Ngày · Ticket ID` vào cột `Cập nhật lần cuối` (không cấp mã mới cho cùng một hành vi).
5. **Bắt buộc ghi cột `Nguồn` cụ thể:** Ghi rõ `UI thực tế`, `Kiểm chứng thực tế`, `API · POST /api/x · 422`, hoặc `Ticket ABC-123 · AC#4` / `field_spec.xlsx · sheet "Fields" · dòng 12`.
6. **Cập nhật đồng bộ 4 nơi sau khi ghi:** `Nhật ký thay đổi (6.9)` ↔ `Trạng thái REQ (6.2)` ↔ `Dải mã đã dùng / Mã kế tiếp ở Metadata (6.1)` ↔ `Bảng danh mục docs/requirements/README.md`.

---

## 3. Cổng Tự Soát REQ 10 Điểm & Ngưỡng Quy Mô (Scaling Thresholds)

### 3.1. Checklist tóm tắt Cổng Tự Soát REQ 10 điểm (Chạy TRƯỚC KHI ghi file)
Chi tiết từng quy tắc và ví dụ xem tại [`references/OUTPUT_TEMPLATES_AND_GATE.md`](references/OUTPUT_TEMPLATES_AND_GATE.md) mục 2. Vi phạm điểm nào → **sửa trực tiếp REQ**, không mở AMB:

- [ ] **1. Cùng mệnh đề (4.3.1):** Tên REQ và Acceptance Criteria (AC) chứng minh đúng cùng một hành vi ở cùng tầng (UI vs HTML/Server).
- [ ] **2. Phủ định 4 bước sạch (4.3.2):** Mệnh đề *"không sinh/không lưu X"* có đủ 4 bước: `(1) xoá sạch → (2) xác nhận đã sạch → (3) thao tác → (4) kiểm tra không xuất hiện`.
- [ ] **3. Không chứa giá trị theo phiên / bí mật (4.3.3 & 7.1):** Không chép token, session id, CSRF, timestamp, mật khẩu thật vào AC hay `docs/`; chỉ ghi **hình thái** (`<16 ký tự hex>`) hoặc quan hệ (*"khác giá trị trước đó"*).
- [ ] **4. Một REQ = một rule độc lập (4.3.4):** Không dùng *"và"* / *"hoặc"* gộp nhiều rule kiểm thử vào một mã REQ.
- [ ] **5. Hiển thị thật trong DOM (4.3.5):** Phần tử khai là *"dùng được"* đã kiểm `offsetParent !== null`, `getBoundingClientRect() > 0×0`, `getComputedStyle().display`, ghi kèm viewport và dùng bộ chọn trực tiếp `X > li:last-child`.
- [ ] **6. Chuỗi mặc định trình duyệt (4.3.6):** Thông báo HTML5 / OS native ghi kèm tên trình duyệt + đánh dấu **cấm dùng làm assertion** (chỉ assert `checkValidity() === false`).
- [ ] **7. Giá trị có phần động (4.3.7):** `document.title`, `body.className`, bộ đếm động dùng toán tử `**chứa** <phần bất biến>`, không assert `=` tuyệt đối.
- [ ] **8. Tác tạo có tác dụng (4.3.8):** Mỗi tác tạo (cookie, mail, file export, log) có tối thiểu **2 REQ**: 1 REQ *được tạo đúng hình thái* + 1 REQ *dùng được đúng mục đích* (chưa kiểm chứng được vế 2 thì cấp REQ `⚪` + `AMB-XX`).
- [ ] **9. Nghi ngờ kỹ thuật nhất quán (4.3.9):** Mã HTTP/response bất thường được mở `AMB-XX` và xử lý nhất quán trên toàn tài liệu.
- [ ] **10. Không mồ côi & Khớp tổng (4.3.10 & 6.8):** Mọi REQ thuộc đúng 1 Story; mọi `AMB-XX`/`RISK-XX` gắn vào Story hoặc bảng Hạng mục cấp Epic; phép cộng tổng REQ và tổng ô Ma trận phân quyền khớp 100%.

### 3.2. Ngưỡng quy mô & Tách file (Scaling Thresholds)
Đếm tổng số REQ sau khi khảo sát xong để chọn cấu trúc lưu tại `docs/requirements/<module>/` (chi tiết tại [`references/OUTPUT_TEMPLATES_AND_GATE.md`](references/OUTPUT_TEMPLATES_AND_GATE.md) mục 3):

| Số lượng REQ | Cấu trúc file đầu ra | Yêu cầu bắt buộc |
|---|---|---|
| **`< 40` REQ** *(nhỏ `< 25`)* | **1 file** `requirements_<module>.md` | Đủ mục 6.1 → 6.9 (`≥ 25` REQ bắt buộc có mục 6.8 Phân rã Epic/Story) |
| **`40 – 80` REQ** *(vừa `25 – 80`)* | **1 file** `requirements_<module>.md` có **Mục lục (TOC)** | Bắt buộc có TOC đầu file + mục **6.8 Phân rã Epic/Story** + bảng đối chiếu AMB/RISK |
| **`> 80` REQ** *(hoặc ≥ 2 entity/status matrix độc lập)* | **Tách file:** `requirements_<module>.md` (**Index**) + `stories/story_NN_<slug>.md` | Index giữ tên bất biến `requirements_<module>.md`, chứa `## Bản đồ tài liệu`, Metadata, Ma trận quyền/trạng thái, AMB/RISK toàn module, Epic/Story, Nhật ký. File story giữ REQ chi tiết, Field Spec, Validation Messages, User Flow |

---

## 4. Context Pointers (Tài liệu tham chiếu chi tiết)

- **Danh mục hệ thống (`README.md`), Tầng khám phá (`_discovery/system_map.md`, `api_map.md`), Đối chiếu danh mục & Đa hệ thống (`_<hệ-thống>/`):** đọc [`references/DISCOVERY_AND_CATALOG.md`](references/DISCOVERY_AND_CATALOG.md).
- **Quy trình 9 bước UI Recon, Tầng Network (`3.1.1`), Phân quyền thiếu account (`3.1.2`), Chuẩn Evidence (`7.2.1`) & Headless Mode (`1920×1080`):** đọc [`references/UI_RECON_AND_EVIDENCE.md`](references/UI_RECON_AND_EVIDENCE.md).
- **Quy trình đọc tài liệu (`3.2`), Khai thác CSV/XLSX, Đối chiếu đa nguồn, Tài liệu bán phần (`3.3.1`) & Template 10 mục `analysis_<TICKET-ID>.md`:** đọc [`references/DOC_AND_HYBRID_ANALYSIS.md`](references/DOC_AND_HYBRID_ANALYSIS.md).
- **Chi tiết Cổng Tự Soát REQ 10 điểm (`4.3`), Quy tắc tách file (`5.1–5.6`), Template `requirements_<module>.md` (`6.1–6.9`), Phân loại Delta & Mẫu `impact_<TICKET-ID>.md`:** đọc [`references/OUTPUT_TEMPLATES_AND_GATE.md`](references/OUTPUT_TEMPLATES_AND_GATE.md).
- **Quy tắc điều khiển trình duyệt Playwright MCP & chuyển đổi Headless (`1920×1080`) / Headed (`1600×750`):** đọc [`.claude/rules/playwright_rules.md`](../../rules/playwright_rules.md).
