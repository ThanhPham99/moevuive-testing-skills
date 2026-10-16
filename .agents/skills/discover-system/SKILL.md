---
name: discover-system
description: "Khám phá hệ thống ở cấp toàn cục — crawl điều hướng, lập Discovery Map, gán prefix module và khởi tạo Module Catalog (5 modes: UI, HYBRID, DOC, ADD, DELTA)."
skills:
  - skills-requirements-analyzer
---

# Workflow Dispatcher: Khám Phá Hệ Thống (`/discover-system`)

## 1. Context Pointers (Tài liệu bắt buộc nạp theo nhánh)

- **Quy ước Prefix & Bất biến truy vết:** [`.claude/skills/skills-requirements-analyzer/SKILL.md`](../../../.claude/skills/skills-requirements-analyzer/SKILL.md) (Mục 1 & 2).
- **Quy trình khám phá, khởi tạo/đối chiếu `README.md`, tách/gộp `system_map.md` & Mode `ADD`/`DELTA`:** [`references/DISCOVERY_AND_CATALOG.md`](../../../.claude/skills/skills-requirements-analyzer/references/DISCOVERY_AND_CATALOG.md).
- **Crawl UI (Headless Mode `1920×1080` mặc định), tầng Network thụ động & Phân quyền thiếu account:** [`references/UI_RECON_AND_EVIDENCE.md`](../../../.claude/skills/skills-requirements-analyzer/references/UI_RECON_AND_EVIDENCE.md) & [`.claude/rules/playwright_rules.md`](../../../.claude/rules/playwright_rules.md).
- **Đọc tài liệu đa định dạng & Bản đồ phủ tài liệu (Mode `HYBRID`/`DOC`):** [`references/DOC_AND_HYBRID_ANALYSIS.md`](../../../.claude/skills/skills-requirements-analyzer/references/DOC_AND_HYBRID_ANALYSIS.md) (Mục 1.1 & 2.2).

> ⛔ **Ranh giới bất biến:** Workflow này chỉ cấp **Prefix** (`LOGIN`, `CUST`, `PRJ`…), **TUYỆT ĐỐI KHÔNG** sinh mã `REQ-XXX-NN`, không sinh Field Spec chi tiết và không sinh test case.

---

## 2. Nhận Diện Chế Độ (Mode Detection — Tự động ở Bước 0)

Agent tự suy ra mode từ trạng thái repo + đầu vào và **bắt buộc công bố mode ngay câu đầu tiên kèm lý do 1 dòng** (không tự ý hạ mode giữa chừng; user có quyền chỉ định đè):

| Trạng thái `_discovery/system_map.md` | Điều kiện đầu vào | Mode kích hoạt |
|---|---|---|
| **Chưa tồn tại** (khảo sát lần đầu) | Chỉ có URL hệ thống đang chạy | **`UI`** (mặc định) |
| **Chưa tồn tại** (khảo sát lần đầu) | Có URL hệ thống đang chạy **+ tài liệu** (đầy đủ hoặc bán phần) | **`HYBRID`** |
| **Chưa tồn tại** (khảo sát lần đầu) | Chỉ có tài liệu, chưa có URL / account truy cập UI | **`DOC`** |
| **Đã tồn tại** | User chỉ đích danh module/menu bị sót (*"còn thiếu module X"*) | **`ADD`** (chỉ khảo sát module đó) |
| **Đã tồn tại** | Hệ thống vừa cập nhật hoặc user yêu cầu rà lại toàn bộ | **`DELTA`** (crawl lại & báo phần chênh) |

---

## 3. Đầu Vào Bắt Buộc (Input Collection — Bước 0)

Thu thập và hỏi user các thông tin không tự suy ra được trước khi crawl:
1. **URL hệ thống & Tài khoản đăng nhập** (càng nhiều role càng tốt — lưu vào `.env`, **CẤM** ghi credentials vào `docs/`).
2. **Tài liệu sẵn có** (nếu có: `.docx`, `.xlsx`, `.pdf`, mockup, ticket).
3. **Tên hệ thống viết tắt** làm tiền tố TC ID (`CRM_`, `ERP_`, `HRM_` — agent đề xuất, user xác nhận 1 câu).
4. **Môi trường dùng chung không?** (Nếu `CÓ` → bật chế độ **chỉ đọc**: mở form xem field, tuyệt đối không bấm Save/Sửa/Xoá).
5. **Năng lực kiểm thử của QA** (Gọi API · Truy vấn CSDL · Kiểm tầng tích hợp · Xem nhật ký hoạt động — *kiểm chứng được thì mở trang/gọi đọc đo thật kèm ngày* · DevTools) → ghi ngay vào bảng thuộc tính đầu `docs/requirements/README.md` phục vụ nhánh Vòng 3 của mọi bộ TC về sau.

---

## 4. Trình Tự Điều Phối & Điểm Dừng (Execution & HITL Checkpoint)

Thực thi chi tiết theo `DISCOVERY_AND_CATALOG.md` mục 2.2 – 2.4:
1. **Bước 1 — Đọc trạng thái repo & Đối chiếu danh mục:** Kiểm tra `docs/requirements/README.md`, `_discovery/system_map.md` và chạy đối chiếu với `docs/requirements/*/requirements_*.md` (mục 1.3). Không bao giờ ghi đè prefix đã cấp; nếu phát hiện trùng prefix giữa 2 module → **DỪNG báo user**.
2. **Bước 2 — Nạp tài liệu & Lập Bản đồ phủ tài liệu (`HYBRID` / `DOC`):** Ủy quyền đúng skill đọc file (`docx`/`xlsx`/`pdf`), lưu bản gốc vào `_discovery/sources/`, đánh giá 4 mức phủ (`🟩 Đầy đủ` · `🟨 Một phần` · `⬜ Trắng` · `⚠️ Nghi lỗi thời`).
3. **Bước 3 — Khám phá UI & Network cấp hệ thống (`UI` / `HYBRID`):** Chạy ở **Headless Mode** (`1920×1080`) mặc định (chuyển sang **Headed Mode** `1600×750` qua `/browser-mode` khi cần đăng nhập CAPTCHA/OTP/MFA). Crawl cạn kiệt menu mọi cấp, đọc `browser_network_requests` thụ động, thăm dò phân quyền và chụp 1 ảnh full-page/module.
4. **Bước 4 — Chuẩn hoá danh sách module:** Đối chiếu tài liệu ↔ UI, quyết định ranh giới tách/gộp module theo entity vòng đời riêng, gán Prefix duy nhất (3–6 ký tự IN HOA) và đánh giá Risk sơ bộ (`🔴` / `🟡` / `🟢`).
5. **Bước 5 — ⏸️ HITL CHECKPOINT (BẮT BUỘC DỪNG LẠI TRƯỚC KHI GHI FILE):**
   Trình bày: (1) Bảng module + prefix đề xuất + loại màn hình + mức phủ + risk + ước số REQ, (2) Danh sách nghi vấn, (3) Điểm lệch tài liệu ↔ UI (`HYBRID`), (4) Thứ tự khảo sát đề xuất. Hỏi đúng 3 câu và chờ user phản hồi mới ghi file: (a) *Danh sách module đã đủ chưa (có module ẩn do quyền/menu sâu/URL trực tiếp)?* (b) *Ranh giới tách/gộp module đã đúng cách vận hành chưa?* (c) *Thứ tự khảo sát ưu tiên thế nào?*
6. **Bước 6 & 7 — Ghi file & Bàn giao:** Áp ngưỡng tách bản đồ (`≤ 8` module: 1 file `system_map.md`; `> 8` module: `system_map.md` kèm `## Bản đồ tài liệu` + `modules/module_NN_<slug>.md`), kiểm tra đủ 6 bất biến tách/gộp (mục 2.3) và đề xuất lệnh tiếp theo: `/generate-requirements-from-website <module đầu tiên>`.

## 5. Hợp Đồng Đầu Ra (Output File Contract)
- `docs/requirements/README.md` (Module Catalog) · `docs/requirements/_discovery/system_map.md` (Discovery Map Index — không chứa mã `REQ-XXX-NN`).
- `docs/requirements/_discovery/modules/module_NN_<slug>.md` (khi `> 8` module) · `doc_inventory.md` & `sources/*` (Mode `HYBRID`/`DOC`) · `evidence/<module>_overview_fullpage.png`.
