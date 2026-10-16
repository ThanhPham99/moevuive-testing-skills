---
name: skills-manual-test-executor
description: "Execute manual test cases or checklists on a real browser via Playwright MCP, verify Expected vs Actual results, grade PASS/FAIL/BLOCKED/SKIPPED, capture evidence, and generate execution_report.md."
---

# Manual Test Executor

Thực thi bộ manual test cases hoặc checklist trực tiếp trên trình duyệt qua Playwright MCP, đối chiếu từng Expected Result với trạng thái UI thực tế, thu thập bằng chứng (evidence) và xuất báo cáo `execution_report.md`.

---

## 1. Input Bắt Buộc & Chiến Lược Phân Tầng Thực Thi

| Input | Yêu cầu | Ghi chú |
|---|---|---|
| **File TC / Checklist** | ⭐ Bắt buộc | VD: `docs/testcases/customers/parts/part_01_danh_sach.md` |
| **Phạm vi chạy** | ⭐ Bắt buộc | Toàn bộ file · theo tag (`@Smoke`) · theo dải `TC ID` · theo nhóm chức năng (hỏi user nếu chưa nêu) |
| **Môi trường & Tài khoản** | ⭐ Bắt buộc | URL, tài khoản test, build/version |
| **Tính chất môi trường** | ⭐ Bắt buộc | **Dùng chung** (bật Auto-Skip TC phá huỷ) hay **Môi trường riêng** (chạy đầy đủ) |

- **Tier 1 (AI Interactive — Skill này):** Phù hợp cho phạm vi $\le 15$ TC (Smoke, P1 Critical Path, Retest bug).
- **Tier 2 (Automated Runner):** Với phạm vi $> 15$ TC, khuyến nghị sinh script qua `skills-qa-automation-engineer` để chạy song song.
- **Tier 3 (Checklist):** Kiểm thử giao diện tĩnh/A11y qua `/generate-checklist-test`.

---

## 2. Browser Execution Mode, Video & Quy Tắc Thao Tác Trình Duyệt

- **Mặc định — Headless Mode (`1920x1080`, tắt GPU):** Chạy kiểm thử manual ẩn trên nền viewport chuẩn Full HD `1920x1080` (`--headless`, `--disable-gpu`) để tối ưu tài nguyên và không cắt giao diện.
- **Opt-in — Headed Mode (`1600x750`, cửa sổ tại `0,0`) & Quay Video MCP (`--video=on`):**
  ```bash
  node scripts/browser-mode.mjs headed              # Mở cửa sổ trực tiếp / nhập CAPTCHA, OTP, MFA
  node scripts/browser-mode.mjs headless --video=on # Bật ghi video phiên MCP vào reports/mcp-videos/
  node scripts/browser-mode.mjs headless --video=off
  ```
- **Chuỗi thao tác & Tối ưu Token Vision:** `browser_navigate` (chỉ khi đổi URL) → `browser_wait_for` → `browser_snapshot` (kiểm chứng trạng thái UI) → tương tác → `browser_take_screenshot` (chụp **1 ảnh cuối khi PASS** `evidence/<TC_ID>_pass.png` ở chế độ viewport nhanh `fullPage=false`, hoặc chụp **ngay tại bước FAIL** `evidence/<TC_ID>_step<N>_fail.png`). Không gọi `browser_resize`. **Không dùng `Read` đọc lại file `.png` vào context** khi `browser_snapshot` đã xác nhận trạng thái DOM rõ ràng.

---

## 3. 4 Trạng Thái Chấm Điểm & Quy Tắc Thực Thi

| Trạng thái | Điều kiện chấm | Yêu cầu bằng chứng (Evidence) bắt buộc |
|---|---|---|
| ✅ **PASS** | **Mọi** Expected Result đánh số đều được xác minh khớp thực tế qua `snapshot` | Chụp 1 ảnh trạng thái cuối (`evidence/<TC_ID>_pass.png`, viewport `fullPage=false`) và gắn link `[ảnh](evidence/<TC_ID>_pass.png)` vào cột `Ghi chú` |
| ❌ **FAIL** | Ít nhất 1 Expected Result lệch thực tế (giữ nguyên TC, ghi nhận lỗi hệ thống) | Chụp screenshot ngay tại bước fail (`evidence/<TC_ID>_step<N>_fail.png`) + ghi rõ Expected vs Actual |
| ⚠️ **BLOCKED** | Không dựng được Pre-Condition, lỗi môi trường, phụ thuộc TC trước đã fail, hoặc có Expected không quan sát được | Ghi rõ nguyên nhân chặn và điều kiện cần để mở khoá |
| ⏭️ **SKIPPED** | TC ngoài phạm vi chọn hoặc bị chặn bởi quy tắc Auto-Skip trên môi trường dùng chung | Ghi rõ lý do skip (không tính vào mẫu số Pass Rate) |

### Quy tắc Auto-Skip trên môi trường dùng chung
Tự động chấm `⏭️ SKIPPED` (không thực thi) nếu TC có: tag `@ManualOnly` / `Automatable = No` vì rủi ro dữ liệu, thao tác xoá hàng loạt (`Mass Delete`, `Select All`), gọi trực tiếp URL xoá trên thanh địa chỉ, upload file thực thi (`.exe`, `.sh`, `.bat`), hoặc bơm dữ liệu khối lượng lớn.

### Quy tắc Fail-Forward & Ngưỡng dừng khẩn cấp (Circuit Breaker)
- Khi 1 TC FAIL: chụp ảnh tại chỗ → ghi bước fail + Expected/Actual → khôi phục trạng thái sạch (đóng modal, quay lại trang danh sách) → chạy tiếp TC kế tiếp.
- **Dừng ngay và báo user** khi: (1) Không đăng nhập được từ đầu, (2) 3 TC liên tiếp FAIL cùng một lỗi hạ tầng (500, mất mạng, văng phiên), hoặc (3) Phát hiện thao tác làm ảnh hưởng dữ liệu người dùng khác.

### Quản lý Test Data & Dọn Dẹp (Teardown)
- Tạo dữ liệu có tiền tố truy vết: `Auto_<Module>_<timestamp>`, `auto_<loại>_<timestamp>@auto.test`.
- Ghi nhật ký mọi bản ghi đã tạo (Tên, ID, đường dẫn) và xoá sạch ở cuối buổi chạy; đối chiếu số lượng bản ghi trước và sau khi chạy.

---

## 4. Quy Trình 7 Bước Thực Thi

1. **Xác nhận phạm vi & môi trường:** Đọc file TC, lọc danh sách TC sẽ chạy, công bố kế hoạch.
2. **Khởi tạo Run:** Tạo `run_id` (`run_<timestamp>`), thư mục `docs/executions/<module>/<run_id>/evidence/` và khởi tạo file `execution_report.md`.
3. **Đăng nhập & kiểm tra kết nối:** Mở hệ thống, đăng nhập và xác nhận vào được trang chính.
4. **Thực thi tuần tự từng TC:** Dựng Pre-Condition → kiểm tra Auto-Skip → chạy đúng từng bước trong Test Steps → `snapshot` đối chiếu từng Expected Result → chấm trạng thái → **ghi kết quả vào `execution_report.md` ngay sau mỗi TC**.
5. **Báo cáo tiến độ:** Cập nhật ra chat sau mỗi 5–10 TC (`Đã chạy 12/36 — PASS 10 · FAIL 1 · BLOCKED 0 · SKIPPED 1`).
6. **Teardown dữ liệu:** Xoá toàn bộ dữ liệu test đã tạo và kiểm tra trạng thái hệ thống về nguyên trạng.
7. **Hoàn thiện báo cáo:** Tổng hợp bảng thống kê, tính Pass Rate `= PASS / (PASS + FAIL + BLOCKED)` và đề xuất bước tiếp theo (`/create-bug-report` cho các TC FAIL).

---

## 5. Output Schema — `docs/executions/<module>/<run_id>/execution_report.md`

> Giữ đúng tên cột và cấu trúc heading bên dưới để tương thích 100% với **Execution Viewer**:

```markdown
# Execution Report — <Module> · <Loại chạy>

| Thông tin | Nội dung |
|---|---|
| Run ID | run_1785700456 |
| Nguồn TC | docs/testcases/customers/parts/part_01_danh_sach.md |
| Phạm vi | 36 TC (toàn bộ Part 1) |
| Môi trường | `<URL môi trường test>` — `<Staging/UAT/Production>` |
| Build / Version | (nếu có) |
| Tài khoản | `<tài khoản test>` (`<role>`) |
| Người thực hiện | <tên tester> (agent hỗ trợ) |
| Bắt đầu → Kết thúc | 2026-08-02 09:15 → 10:40 (85 phút) |
| Môi trường dùng chung? | Có — auto-skip TC phá huỷ đang BẬT |

## 1. Tổng kết

| Trạng thái | Số lượng | Tỷ lệ |
|---|---|---|
| ✅ PASS | 30 | 83.3% |
| ❌ FAIL | 3 | 8.3% |
| ⚠️ BLOCKED | 1 | 2.8% |
| ⏭️ SKIPPED | 2 | 5.6% |
| **Tổng** | **36** | 100% |

> **Pass rate (không tính SKIPPED):** 30/34 = 88.2%

## 2. Kết quả từng TC

| TC ID | Test Scenario | Kết quả | Bước fail | Ghi chú |
|---|---|---|---|---|
| CRM_CUST_TC_001 | Bảng hiển thị đủ 9 cột | ✅ PASS | — | [ảnh](evidence/CRM_CUST_TC_001_pass.png) |
| CRM_CUST_TC_011 | Search chuỗi SQL injection | ❌ FAIL | 4 | Xem chi tiết #1 |
| CRM_CUST_TC_030 | Modal Bulk Actions | ⏭️ SKIPPED | — | Thao tác phá huỷ, môi trường dùng chung |

## 3. Chi tiết TC FAIL

### FAIL #1 — CRM_CUST_TC_011 · Search chuỗi SQL injection

| | |
|---|---|
| REQ ID | REQ-CUST-04 |
| Priority | High |
| Bước fail | Bước 4 |
| **Expected** | Request trả HTTP 200; bảng hiển thị 0 kết quả |
| **Actual** | Request trả HTTP 500; trang hiện thông báo lỗi cơ sở dữ liệu |
| Evidence | ![](evidence/CRM_CUST_TC_011_step4_fail.png) |
| Tái hiện được? | Có — thử lại 2 lần đều lỗi |

## 4. TC BLOCKED

| TC ID | Nguyên nhân chặn | Cần gì để chạy được |
|---|---|---|

## 5. Dữ liệu đã tạo & dọn dẹp

| Dữ liệu | ID | Nơi tạo | Đã xoá? |
|---|---|---|---|
| Auto_Customer_1785700456 | 12130 | /admin/clients | ✅ |

> Đối chiếu số liệu hệ thống: `Total Customers` trước 1431 → sau 1431 ✅ môi trường trả về nguyên trạng.

## 6. Đề xuất bước tiếp theo

- FAIL #1 (High) → sinh bug report bằng `/create-bug-report`
- 2 TC SKIPPED cần chạy tay có giám sát trên môi trường riêng
```

---

## 6. Quy Trình Retest Bug Đã Sửa (`/retest-fixed-bugs` — `RETEST` / `FULL` Modes)

Khi thực thi xác minh bug đã được dev sửa trên bản build mới (`FIXED` / `NOT_FIXED` / `PARTIAL` / `CANNOT_VERIFY`, 3 vòng hồi quy đồng tâm $\le 15$ TC và mẫu `retest_report.md`), nạp tài liệu tham chiếu:
- [`references/RETEST_WORKFLOW_AND_REPORT.md`](references/RETEST_WORKFLOW_AND_REPORT.md) — Chốt chặn `Build mới ≠ Build gốc`, 4 trạng thái chấm điểm (chạy $\ge 2$ lần liên tiếp), 3 vòng hồi quy đồng tâm và schema `docs/executions/<module>/retest_<timestamp>/retest_report.md`.
