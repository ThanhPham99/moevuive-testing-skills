---
name: skills-requirements-analyzer
description: Phân tích yêu cầu và khám phá hệ thống — trích xuất REQ ID, AMB, RISK từ UI thực tế (UI Recon), tài liệu/ticket (Document Analysis), đối chiếu bán phần (Hybrid), bản đồ hệ thống (_discovery/), và cập nhật delta kèm Impact Report.
---

# Kỹ Năng Phân Tích Yêu Cầu & Khám Phá Hệ Thống (Requirements Analyzer)

Chuyển đổi giao diện UI thực tế, tầng network, hoặc tài liệu (Jira ticket, `.docx`, `.xlsx`, `.pdf`, mockup) thành **Requirement Index** (`requirements_<module>.md`), **Discovery Map** (`_discovery/system_map.md`), bản phân tích ticket (`analysis_<TICKET-ID>.md`), hoặc **Impact Report** (`impact_<TICKET-ID>.md`) truy vết được 100%.

---

## 1. Bảng Điều Hướng Nhánh Thực Thi (Branch Routing)

Xác định nhánh theo nguồn đầu vào và **chỉ nạp file tham chiếu tương ứng** (Progressive Disclosure):

| Nhánh tác vụ | Khi nào kích hoạt | File tham chiếu bắt buộc nạp (`Read`) | Đầu ra chính |
|---|---|---|---|
| **1. System Discovery** (`/discover-system`) | Chưa biết danh sách module/prefix; hoặc rà lại bản đồ hệ thống (`UI`, `HYBRID`, `DOC`, `ADD`, `DELTA`) | `DISCOVERY_AND_CATALOG.md` *(nếu mở browser: thêm `UI_RECON_AND_EVIDENCE.md`)* | `docs/requirements/README.md` + `docs/requirements/_discovery/system_map.md` *(không sinh `REQ ID`)* |
| **2. UI Recon** (`/generate-requirements-from-website`) | Phân tích module từ website/app đang chạy (không có tài liệu) | `UI_RECON_AND_EVIDENCE.md` + `OUTPUT_TEMPLATES_AND_GATE.md` + `DISCOVERY_AND_CATALOG.md` | `docs/requirements/<module>/requirements_<module>.md` + `evidence/*.png` |
| **3. Hybrid Recon** (Website + Tài liệu) | Có cả hệ thống đang chạy lẫn tài liệu đặc tả (đủ hoặc bán phần) | `DOC_AND_HYBRID_ANALYSIS.md` + `UI_RECON_AND_EVIDENCE.md` + `OUTPUT_TEMPLATES_AND_GATE.md` | `docs/requirements/<module>/requirements_<module>.md` (kèm Bản đồ phủ tài liệu 6.5.1) |
| **4. Document Analysis** (`/analyze-requirement-document`) | Phân tích độc lập Jira ticket, `.docx`, `.pdf`, `.xlsx/.csv`, mockup (không mở browser) | `DOC_AND_HYBRID_ANALYSIS.md` + `OUTPUT_TEMPLATES_AND_GATE.md` | `docs/requirements/<module>/analysis/analysis_<TICKET-ID>.md` |
| **5. Requirement Delta** (`/update-requirements-from-ticket`) | Module đã có `requirements_<module>.md`, cập nhật theo ticket mới & xuất Impact Report | `OUTPUT_TEMPLATES_AND_GATE.md` + `DOC_AND_HYBRID_ANALYSIS.md` + `DISCOVERY_AND_CATALOG.md` | Cập nhật `requirements_<module>.md` + `docs/requirements/<module>/impact/impact_<TICKET-ID>.md` |

---

## 2. Quy Ước Đánh Mã & Luật Nối Tiếp Mã (BẮT BUỘC)

| Loại mã | Format chuẩn | Ví dụ | Vai trò & Bất biến |
|---|---|---|---|
| **Requirement** | `REQ-<MODULE>-<NN>` | `REQ-LOGIN-01` | **Lớp truy vết duy nhất, bất biến.** Mỗi REQ = 1 rule đủ nhỏ để test độc lập. Hệ thống thứ hai dùng `REQ-<HỆ_THỐNG>-<MODULE>-<NN>` |
| **Story** | `STORY-<MODULE>-<NN>` | `STORY-PRJ-03` | Lớp nhóm việc (backlog view) — được gộp/tách lại mà **không** đổi số `REQ ID` |
| **Ambiguity** | `AMB-<NN>` | `AMB-03` | Điểm mơ hồ cần PO/BA làm rõ (`🔴 High` / `🟡 Medium` / `🟢 Low`), kèm Assumption tạm (`❓` / `✅` / `⏭️`) |
| **Risk** | `RISK-<NN>` | `RISK-02` | Rủi ro kiểm thử kèm phương án giảm thiểu (`Mitigation`) |

### Quy trình 6 bước nối tiếp mã TRƯỚC KHI gán `REQ ID` đầu tiên
1. **Đọc `docs/requirements/README.md` đầu tiên:** Kiểm tra danh sách module, **prefix đã chiếm**, và `Mã kế tiếp`. Nếu chưa có `README.md` → khởi tạo ngay theo [`references/DISCOVERY_AND_CATALOG.md`](references/DISCOVERY_AND_CATALOG.md).
2. **Kiểm tra `docs/requirements/<module>/requirements_<module>.md`:** Chưa tồn tại → đánh số từ `01`. Đã tồn tại → tìm số lớn nhất đang dùng và **đánh tiếp từ số kế tiếp** (áp dụng cho cả `REQ-`, `AMB-`, `RISK-`).
3. **Không bao giờ đánh lại từ `01` hoặc xoá dòng REQ:** Tính năng gỡ bỏ chuyển sang `🔴 Deprecated`; mã đã Deprecated vĩnh viễn không tái sử dụng.
4. **Sửa hành vi đã có = Giữ nguyên mã cũ:** Chuyển trạng thái sang `🟡 Changed` và ghi `Ngày · Ticket ID` vào cột `Cập nhật lần cuối`.
5. **Ghi cột `Nguồn` cụ thể:** VD: `UI thực tế`, `API · POST /api/x · 422`, hoặc `Ticket ABC-123 · AC#4`.
6. **Cập nhật đồng bộ 4 nơi sau khi ghi:** `Nhật ký thay đổi (6.9)` ↔ `Trạng thái REQ (6.2)` ↔ `Metadata dải mã (6.1)` ↔ `docs/requirements/README.md`.

---

## 3. Cổng Tự Soát REQ 10 Điểm & Ngưỡng Quy Mô (Scaling Thresholds)

### 3.1. Cổng Tự Soát REQ 10 Điểm (Chạy trước khi ghi file — chi tiết tại [`references/OUTPUT_TEMPLATES_AND_GATE.md`](references/OUTPUT_TEMPLATES_AND_GATE.md))
- [ ] **1. Cùng mệnh đề (4.3.1):** Tên REQ và AC chứng minh đúng cùng một hành vi ở cùng tầng.
- [ ] **2. Phủ định 4 bước sạch (4.3.2):** Mệnh đề *"không sinh/không lưu X"* đủ 4 bước: `xoá sạch → xác nhận sạch → thao tác → kiểm tra không xuất hiện`.
- [ ] **3. Không chứa giá trị phiên / bí mật (4.3.3):** Không chép token/session/CSRF/mật khẩu thật; chỉ ghi hình thái (`<16 ký tự hex>`).
- [ ] **4. Một REQ = một rule độc lập (4.3.4):** Không dùng *"và"* / *"hoặc"* gộp nhiều rule kiểm thử vào một mã REQ.
- [ ] **5. Hiển thị thật trong DOM (4.3.5):** Đã kiểm `offsetParent !== null`, `getBoundingClientRect() > 0×0`, ghi kèm viewport.
- [ ] **6. Chuỗi mặc định trình duyệt (4.3.6):** Thông báo HTML5 native ghi kèm tên trình duyệt và đánh dấu cấm assert cứng chuỗi chữ.
- [ ] **7. Giá trị có phần động (4.3.7):** `document.title`, `body.className`, bộ đếm động dùng toán tử `**chứa** <phần bất biến>`.
- [ ] **8. Tác tạo có tác dụng (4.3.8):** Mỗi tác tạo (cookie, mail, export) có $\ge 2$ REQ: 1 REQ *được tạo đúng hình thái* + 1 REQ *dùng được đúng mục đích*.
- [ ] **9. Nghi ngờ kỹ thuật nhất quán (4.3.9):** Mã HTTP/response bất thường được mở `AMB-XX` nhất quán.
- [ ] **10. Không mồ côi & Khớp tổng (4.3.10):** Mọi REQ thuộc đúng 1 Story; phép cộng tổng REQ và Ma trận phân quyền khớp 100%.

### 3.2. Ngưỡng quy mô & Tách file (`docs/requirements/<module>/`)

| Số lượng REQ | Cấu trúc file đầu ra | Yêu cầu bắt buộc |
|---|---|---|
| **`< 40` REQ** | **1 file** `requirements_<module>.md` | Đủ mục 6.1 → 6.9 (`≥ 25` REQ bắt buộc có mục 6.8 Phân rã Epic/Story) |
| **`40 – 80` REQ** | **1 file** `requirements_<module>.md` có **TOC** | Bắt buộc có Mục lục (TOC) đầu file + mục 6.8 + bảng đối chiếu AMB/RISK |
| **`> 80` REQ** | **Index** `requirements_<module>.md` + `stories/story_NN_<slug>.md` | Index giữ Bản đồ tài liệu, Metadata, Ma trận quyền/trạng thái, AMB/RISK, Epic/Story, Nhật ký; file story giữ REQ chi tiết & Field Spec |

---

## 4. Context Pointers (Tài Liệu Tham Chiếu Chi Tiết)

- [`references/DISCOVERY_AND_CATALOG.md`](references/DISCOVERY_AND_CATALOG.md) — Danh mục `README.md`, `_discovery/system_map.md`, `api_map.md` & Đa hệ thống (`_<hệ-thống>/`)
- [`references/UI_RECON_AND_EVIDENCE.md`](references/UI_RECON_AND_EVIDENCE.md) — Quy trình 9 bước UI Recon, Tầng Network, Phân quyền & Chuẩn Evidence (`1920×1080`)
- [`references/DOC_AND_HYBRID_ANALYSIS.md`](references/DOC_AND_HYBRID_ANALYSIS.md) — Đọc tài liệu/CSV/XLSX, Đối chiếu Hybrid & Template 10 mục `analysis_<TICKET-ID>.md`
- [`references/OUTPUT_TEMPLATES_AND_GATE.md`](references/OUTPUT_TEMPLATES_AND_GATE.md) — Cổng Tự Soát 10 điểm, Tách file `stories/`, Template `requirements_<module>.md` & `impact_<TICKET-ID>.md`
- [`.claude/rules/playwright_rules.md`](../../rules/playwright_rules.md) — Quy tắc điều khiển Playwright MCP Headless (`1920×1080`) / Headed (`1600×750`)
