---
name: generate-requirements-from-website
description: "Phân tích module website/ứng dụng thực tế và sinh tài liệu Requirement Index chuẩn mực (REQ ID, Field Spec, Phân quyền, Trạng thái, AMB/RISK, Evidence)."
skills:
  - skills-requirements-analyzer
---

# Workflow Dispatcher: Sinh Tài Liệu Yêu Cầu Từ Website (`/generate-requirements-from-website`)

## 1. Context Pointers (Tài liệu bắt buộc nạp)

- **Quy ước mã (`REQ`, `STORY`, `AMB`, `RISK`), nối tiếp mã, Cổng Tự Soát 10 điểm & Ngưỡng quy mô:** [`.claude/skills/skills-requirements-analyzer/SKILL.md`](../../../.claude/skills/skills-requirements-analyzer/SKILL.md).
- **Quy trình 9 bước UI Recon, tầng Network (`3.1.1`), Phân quyền thiếu account (`3.1.2`) & Chuẩn Evidence/DOM (`7.2.1`):** [`references/UI_RECON_AND_EVIDENCE.md`](../../../.claude/skills/skills-requirements-analyzer/references/UI_RECON_AND_EVIDENCE.md).
- **Chi tiết Cổng Tự Soát REQ 10 điểm (`4.3`), Quy tắc tách file (`5.1–5.6`) & Template `requirements_<module>.md` (`6.1–6.9`):** [`references/OUTPUT_TEMPLATES_AND_GATE.md`](../../../.claude/skills/skills-requirements-analyzer/references/OUTPUT_TEMPLATES_AND_GATE.md).
- **Đọc tầng `_discovery/`, khởi tạo `docs/requirements/README.md` & Đối chiếu danh mục:** [`references/DISCOVERY_AND_CATALOG.md`](../../../.claude/skills/skills-requirements-analyzer/references/DISCOVERY_AND_CATALOG.md) (Mục 1 & 2.5).
- **Khi user cung cấp kèm tài liệu (Đầy đủ hoặc Bán phần):** nạp thêm [`references/DOC_AND_HYBRID_ANALYSIS.md`](../../../.claude/skills/skills-requirements-analyzer/references/DOC_AND_HYBRID_ANALYSIS.md) (Mục 2).
- **Quy tắc trình duyệt Playwright MCP (Headless `1920×1080` mặc định / `/browser-mode`):** [`.claude/rules/playwright_rules.md`](../../../.claude/rules/playwright_rules.md).

---

## 2. Nhận Diện Nhánh & Điều Kiện Tiên Quyết (Branch Resolution)

> ⚠️ Nếu user chưa biết hệ thống có những module nào → dừng và điều hướng sang `/discover-system` trước.

| Nguồn đầu vào của module | Chiến lược thực thi |
|---|---|
| **Chỉ có Website/UI đang chạy** | Chạy nhánh **UI Recon thuần** theo `UI_RECON_AND_EVIDENCE.md` |
| **Website + Tài liệu phủ đầy đủ module** | Đọc tài liệu trước để nắm ý định → Recon UI sau để đối chiếu và bắt lệch pha (`DOC_AND_HYBRID_ANALYSIS.md` mục 2.1) |
| **Website + Tài liệu chỉ phủ một phần** | **Bắt buộc lập Bản đồ phủ tài liệu** (`🟩 Đầy đủ` · `🟨 Một phần` · `⬜ Trắng` · `⚠️ Nghi lỗi thời`) **TRƯỚC khi mở trình duyệt** (`DOC_AND_HYBRID_ANALYSIS.md` mục 2.2) |

---

## 3. Đầu Vào Cần Thu Thập (Required Inputs)

1. **Tên module & URL / Route đích** (ưu tiên đọc từ `docs/requirements/_discovery/system_map.md` nếu đã có).
2. **Tài khoản đăng nhập theo từng role** (lưu ở `.env`, **CẤM** ghi credentials vào `docs/`). Thiếu account role → áp thang 3 mức (`✅` / `⚠️✅` / `❔`) kèm dòng tổng và `AMB-XX` 🔴 theo `UI_RECON_AND_EVIDENCE.md` mục 4.
3. **Tài liệu bổ trợ của module** (hỏi user có spec, ticket, file Excel field, hay mockup nào không trước khi mở browser).

---

## 4. Trình Tự Thực Thi & Cổng Chất Lượng (Execution & Quality Gates)

1. **Bước 1 — Đọc `README.md` & Tầng `_discovery/` (BẮT BUỘC làm đầu tiên):**
   - Kiểm tra `docs/requirements/README.md`: nếu dự án mới chưa có file này → **tạo ngay** theo `DISCOVERY_AND_CATALOG.md` mục 1.1. Lấy đúng **Prefix đã cấp** cho module (không tự đặt lại).
   - Kiểm tra `docs/requirements/<module>/requirements_<module>.md`: nếu đã có → nối tiếp từ số `REQ ID`, `AMB-XX`, `RISK-XX` cuối cùng (**tuyệt đối không đánh lại từ `01`**).
   - Đọc `_discovery/system_map.md` và `_discovery/doc_inventory.md` (nếu có) để nắm route, số tab, risk và vùng chưa xác minh.
2. **Bước 2 — Khảo sát UI, Network & DOM (Mặc định Headless Mode `1920×1080`):**
   - Duyệt trang theo chuỗi `browser_navigate → browser_wait_for(page_load) → browser_snapshot` (không gọi `browser_resize`; khi cần đăng nhập CAPTCHA/OTP/MFA thì chuyển sang **Headed Mode** `1600×750` qua `/browser-mode`).
   - Bật `browser_network_requests` xuyên suốt (kể cả khi submit form lỗi) để thu thập schema thật, field ẩn, validation server-side (`4xx`) và enum trạng thái. **Chỉ quan sát thụ động**, cấm gọi API trực tiếp.
   - Dùng `browser_evaluate` đọc đủ **10 dữ kiện DOM bắt buộc** (`<option>`, `selected`, `disabled`/`checked`, `value`, `offsetParent` + `getBoundingClientRect()`, `X > li:last-child`, `document.title`, `innerWidth × innerHeight`).
   - Chụp ảnh từng trạng thái động (`<màn_hình>_<trạng_thái>_<fullpage|viewport>.png`), tuân thủ vệ sinh dữ liệu và xác nhận trạng thái hiển thị qua `browser_snapshot` + `browser_evaluate` (không dùng `Read` nạp ngược mọi ảnh `.png` vào context trừ khi cần kiểm tra lỗi bố cục CSS) theo `UI_RECON_AND_EVIDENCE.md` mục 5.2.
3. **Bước 3 — Biên soạn, Tự soát 10 điểm & Áp ngưỡng tách file:**
   - Soạn đầy đủ các mục **6.1 → 6.9** theo `OUTPUT_TEMPLATES_AND_GATE.md` mục 4 (`Trình duyệt khảo sát` ở 6.1, Bản đồ phủ tài liệu ở 6.5.1, dòng tổng khớp `số hàng × số cột` ở 6.5, Phân rã Epic/Story + bảng đối chiếu AMB/RISK ở 6.8 khi `≥ 25` REQ, và Nhật ký thay đổi ở 6.9).
   - **Bắt buộc chạy Cổng Tự Soát REQ 10 điểm** (`SKILL.md` mục 3.1) trước khi ghi file.
   - Áp ngưỡng quy mô (`< 40` / `< 25` REQ: 1 file; `40 – 80` / `25 – 80` REQ: 1 file có TOC + Epic/Story; `> 80` REQ hoặc ≥ 2 entity độc lập: tách `requirements_<module>.md` làm Index có `## Bản đồ tài liệu` + `stories/story_NN_<slug>.md`, đảm bảo 6 bất biến mục 5.4).
4. **Bước 4 — Cập nhật & Đối chiếu Danh mục (`README.md`):**
   - Cập nhật `docs/requirements/README.md` (`Trạng thái recon → ✅ Đã có tài liệu`, `REQ đã dùng`, `Mã kế tiếp`, `AMB treo`, bảng trạng thái mục 2 và AMB 🔴 High mục 3) + Nhật ký khám phá `_discovery/system_map.md` nếu có lệch.
   - **Bắt buộc chạy Đối chiếu danh mục** (`README.md` ↔ `docs/requirements/*/requirements_*.md`) theo `DISCOVERY_AND_CATALOG.md` mục 1.3.

## 5. Hợp Đồng Đầu Ra (Output File Contract)
- `docs/requirements/<module>/requirements_<module>.md` (**Requirement Index** — tên file bất biến) và `stories/story_NN_<slug>.md` (chỉ khi `> 80` REQ).
- `docs/requirements/<module>/evidence/<màn_hình>_<trạng_thái>_<fullpage|viewport>.png` & cập nhật đồng bộ `docs/requirements/README.md`.
