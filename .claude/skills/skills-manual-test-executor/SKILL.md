---
name: skills-manual-test-executor
description: "Execute manual test cases or checklists on a real browser via Playwright MCP, verify Expected vs Actual results, grade PASS/FAIL/BLOCKED/SKIPPED, capture evidence, and generate execution_report.md."
---

# Manual Test Executor

Thực thi bộ Manual Test Cases hoặc Checklist trực tiếp trên trình duyệt qua Playwright MCP, đối chiếu từng Expected Result với trạng thái UI thực tế, thu thập bằng chứng (evidence) và xuất báo cáo `execution_report.md`.

---

## 1. Input Bắt Buộc & Phân Tầng Thực Thi

| Input | Yêu cầu | Ghi chú |
|---|---|---|
| **File TC / Checklist** | ⭐ Bắt buộc | VD: `docs/testcases/login/test_cases_login.md` |
| **Phạm vi chạy** | ⭐ Bắt buộc | Toàn bộ file · theo tag (`@Smoke`) · theo dải `TC ID` · theo nhóm chức năng |
| **Môi trường & Tài khoản** | ⭐ Bắt buộc | URL, tài khoản test (lấy từ `.env`), build/version, tính chất môi trường (**Dùng chung** bật Auto-Skip TC phá huỷ vs **Môi trường riêng**) |

- **Tier 1 (AI Interactive — Skill này):** Tối ưu cho phạm vi $\le 15$ TC (Smoke, P1 Critical Path, Retest bug).
- **Tier 2 (Automated Runner):** Với phạm vi $> 15$ TC, khuyến nghị sinh script qua [`skills-qa-automation-engineer`](../skills-qa-automation-engineer/SKILL.md).

---

## 2. Browser Execution Mode, Video & Tối Ưu Token Vision

- **Mặc định — Headless Mode (`1920x1080`, tắt GPU):** Chạy kiểm thử ẩn trên nền viewport chuẩn Full HD.
- **Opt-in — Headed Mode (`1600x750`) & Quay Video MCP:** Chạy `node scripts/browser-mode.mjs headed` (mở cửa sổ trực tiếp / nhập CAPTCHA, OTP, MFA) hoặc `node scripts/browser-mode.mjs headless --video=on` (ghi video vào `reports/mcp-videos/`).
- **Chuỗi thao tác:** `browser_navigate` → `browser_wait_for` → `browser_snapshot` (xác nhận DOM) → tương tác → `browser_take_screenshot` (**1 ảnh cuối khi PASS** `evidence/<TC_ID>_pass.png` với `fullPage=false`, hoặc **ngay tại bước FAIL** `evidence/<TC_ID>_step<N>_fail.png`). Không gọi `browser_resize`; **không dùng `Read` đọc lại file `.png` vào context** khi `browser_snapshot` đã xác nhận rõ trạng thái.

---

## 3. Bốn Trạng Thái Chấm Điểm & Quy Tắc An Toàn

| Trạng thái | Điều kiện chấm | Yêu cầu bằng chứng (Evidence) bắt buộc |
|---|---|---|
| ✅ **PASS** | **Mọi** Expected Result đều khớp thực tế qua `snapshot` | Chụp 1 ảnh trạng thái cuối (`evidence/<TC_ID>_pass.png`, `fullPage=false`) và gắn link `[ảnh](evidence/<TC_ID>_pass.png)` vào cột `Ghi chú` |
| ❌ **FAIL** | Ít nhất 1 Expected Result lệch thực tế | Chụp ảnh tại bước fail (`evidence/<TC_ID>_step<N>_fail.png`) + ghi rõ Expected vs Actual |
| ⚠️ **BLOCKED** | Không dựng được Pre-Condition, lỗi môi trường, hoặc phụ thuộc TC trước đã fail | Ghi rõ nguyên nhân chặn và điều kiện cần để mở khoá |
| ⏭️ **SKIPPED** | TC ngoài phạm vi chọn hoặc bị chặn bởi Auto-Skip trên môi trường dùng chung | Ghi rõ lý do skip (không tính vào mẫu số Pass Rate) |

- **Auto-Skip trên môi trường dùng chung:** Tự động chấm `⏭️ SKIPPED` nếu TC có `@ManualOnly` / `Automatable = No` vì rủi ro dữ liệu, xoá hàng loạt (`Mass Delete`), gọi URL xoá trực tiếp, hoặc upload file thực thi.
- **Circuit Breaker:** Dừng ngay và báo user nếu: (1) Không đăng nhập được từ đầu, (2) 3 TC liên tiếp FAIL cùng lỗi hạ tầng (500/mất mạng), hoặc (3) Ảnh hưởng dữ liệu người dùng khác.
- **Quản lý Test Data:** Dùng tiền tố truy vết `Auto_<Module>_<timestamp>`, ghi nhật ký bản ghi đã tạo và xoá sạch ở bước Teardown.

---

## 4. Quy Trình 7 Bước & Hợp Đồng Bảng 5 Cột `execution_report.md`

1. **Xác nhận phạm vi** → 2. **Khởi tạo `docs/executions/<module>/run_<ts>/evidence/`** → 3. **Đăng nhập** → 4. **Chạy tuần tự từng TC & ghi ngay vào `execution_report.md`** → 5. **Cập nhật tiến độ mỗi 5–10 TC** → 6. **Teardown dữ liệu** → 7. **Chạy `node scripts/validate-docs.mjs --check` & tổng kết Pass Rate `= PASS / (PASS + FAIL + BLOCKED)`**.

> Giữ đúng tên 5 cột bảng Mục 2 để tương thích 100% với `scripts/execution-viewer/bundle.html` (mẫu báo cáo đầy đủ 5 mục xem tại [`references/EXECUTION_REPORT_TEMPLATE.md`](references/EXECUTION_REPORT_TEMPLATE.md)):

| TC ID | Test Scenario | Kết quả | Bước fail | Ghi chú |
|---|---|---|---|---|
| CRM_CUST_TC_001 | Bảng hiển thị đủ 9 cột | ✅ PASS | — | `[ảnh](evidence/CRM_CUST_TC_001_pass.png)` |
| CRM_CUST_TC_011 | Search chuỗi SQL injection | ❌ FAIL | 4 | Xem chi tiết #1 (`evidence/CRM_CUST_TC_011_step4_fail.png`) |
| CRM_CUST_TC_030 | Modal Bulk Actions | ⏭️ SKIPPED | — | Thao tác phá huỷ, môi trường dùng chung |

---

## 5. Quy Trình Retest Bug Đã Sửa & Tài Liệu Tham Chiếu

- [`references/EXECUTION_REPORT_TEMPLATE.md`](references/EXECUTION_REPORT_TEMPLATE.md) — Mẫu `execution_report.md` đầy đủ (Metadata, Tổng kết, Bảng 5 cột, Chi tiết FAIL, Teardown Log)
- [`references/RETEST_WORKFLOW_AND_REPORT.md`](references/RETEST_WORKFLOW_AND_REPORT.md) — Quy trình `/retest-fixed-bugs` (`RETEST` / `FULL` modes, chấm `FIXED` / `NOT_FIXED` / `PARTIAL` / `CANNOT_VERIFY`, 3 vòng hồi quy đồng tâm $\le 15$ TC & mẫu `retest_report.md`)
