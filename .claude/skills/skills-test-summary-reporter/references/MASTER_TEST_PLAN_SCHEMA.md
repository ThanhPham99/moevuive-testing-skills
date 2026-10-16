# Cấu Trúc Master Test Plan Chuẩn (`docs/test_plan_<mốc>.md`)

> **Áp dụng cho:** `/generate-master-test-plan` (thuộc [`skills-test-summary-reporter`](../SKILL.md)).
> **Chuẩn đối chiếu:** Biên soạn theo cấu trúc **ISO/IEC/IEEE 29119-3 — Test Plan** và ánh xạ **IEEE 829-2008**.

---

## 1. Bốn Quy Tắc Quản Trị Bắt Buộc (Strict Governance Rules)

1. **Không tự bịa thông tin quản lý:** Lịch trình, ngày mốc, nhân sự, người phê duyệt nếu chưa được cung cấp phải điền `❓ Chờ <vai trò> xác nhận` và liệt kê ngay ở bảng **Ô còn treo** đầu tài liệu.
2. **Đồng bộ 100% Tiêu chí Exit với `/generate-test-summary-report`:** Sử dụng đúng bộ **7 Tiêu Chí Exit Mặc Định** tại [`skills-test-summary-reporter/SKILL.md`](../SKILL.md) (trừ khi dự án có quy định riêng) để khi kết thúc đợt test đối chiếu khớp tuyệt đối.
3. **Không để trống mục `2.2 Ngoài phạm vi (Out of Scope)`:** Tự động trích các mục đánh dấu `➖ Ngoài phạm vi` từ cuối các file `docs/testcases/<module>/test_cases_<module>.md` và hỏi xác nhận thêm với người dùng (kiểm thử tải nặng, pentest chuyên sâu, các module không thay đổi).
4. **Quy tắc ghi chuẩn tham chiếu:** Chỉ ghi **tên mục** của chuẩn (`ISO/IEC/IEEE 29119-3 — Test Plan` và `IEEE 829-2008`), **tuyệt đối không ghi số điều khoản cứng (`clause 7.x`)** và **không tự tuyên bố chứng nhận tuân thủ** (chỉ ghi *"Biên soạn theo cấu trúc ISO/IEC/IEEE 29119-3 — Test Plan"*).

---

## 2. Cấu Trúc 11 Mục Chuẩn Của `docs/test_plan_<mốc>.md`

```markdown
# Master Test Plan — <Dự Án> · <Mốc Phát Hành / Sprint / UAT>

| Thông tin | Nội dung |
|---|---|
| Phiên bản tài liệu | v1.0 — `<YYYY-MM-DD>` |
| Mốc áp dụng | `<Release / Sprint / UAT>` |
| Cấu trúc tham chiếu | Biên soạn theo cấu trúc ISO/IEC/IEEE 29119-3 — Test Plan (ánh xạ ở mục 11) |
| Ô còn treo cần xác nhận | `<Liệt kê các mục ❓ Chờ xác nhận hoặc ghi "Không có">` |

## 1. Mục Tiêu Kiểm Thử (Test Objectives)
- Mục tiêu nghiệp vụ và mức chất lượng cần chứng minh trước mốc phát hành.

## 2. Phạm Vi Kiểm Thử (Test Scope)
### 2.1 Trong phạm vi (In-Scope Modules)
| Module | Prefix | Số REQ | Số TC hiện có | Mức rủi ro (RBT) | Nguồn tài liệu |
|---|---|---|---|---|---|

### 2.2 Ngoài phạm vi (Out-of-Scope — Bắt buộc có nội dung)
| Hạng mục không kiểm thử | Lý do loại trừ | Đơn vị chịu trách nhiệm |
|---|---|---|

## 3. Chiến Lược Kiểm Thử (Test Strategy & Risk-Based Approach)
- Các loại kiểm thử thực hiện (`Functional`, `Regression`, `Retest Bug`, `Cross-Module`, `UAT`), tỷ trọng Manual / Automation và thứ tự ưu tiên theo rủi ro sản phẩm (`V1 Smoke → V2 Functional → V3 Technical → V4 Non-functional`).

## 4. Tiêu Chí Vào / Ra / Tạm Dừng (Entry, Exit & Suspension Criteria)
### 4.1 Tiêu chí VÀO (Entry Criteria — 6 điều kiện)
1. Tài liệu `requirements_<module>.md` đã qua cổng tự soát và không còn `AMB` 🔴 chặn luồng chính.
2. Bộ `test_cases_<module>.md` đã được duyệt.
3. Môi trường kiểm thử và tài khoản các role hoạt động ổn định.
4. Build mới đã vượt qua Smoke test cơ bản.
5. Dữ liệu nền (master data) đã sẵn sàng.
6. Các bug chặn diện rộng (`Blocker`/`Critical`) từ đợt trước đã có bản sửa.

### 4.2 Tiêu chí RA (Exit Criteria — Đồng bộ 7 tiêu chí với Test Summary Report)
- Áp dụng 7 Tiêu chí Exit chuẩn tại `skills-test-summary-reporter/SKILL.md` (Mục 1).

### 4.3 Tiêu chí TẠM DỪNG (Suspension) & Điều kiện Tiếp tục (Resumption)
- Tạm dừng khi: không đăng nhập được, $\ge 3$ TC liên tiếp fail do lỗi hạ tầng `5xx`, hoặc tỷ lệ `BLOCKED > 20%`.

## 5. Môi Trường & Dữ Liệu Kiểm Thử (Test Environment & Data)
- Quy định môi trường (dùng chung hay độc lập; không ghi mật khẩu/secret vào tài liệu), chế độ trình duyệt mặc định (`Headless 1920x1080`) và tiền tố dữ liệu truy vết (`auto_<module>_<timestamp>`).

## 6. Nhân Lực & Phân Công (Staffing & Responsibilities)
| Vai trò | Người phụ trách | Phạm vi / Trách nhiệm |
|---|---|---|

## 7. Lịch Trình & Cột Mốc (Schedule & Milestones)
| Cột mốc | Ngày dự kiến | Điều kiện hoàn thành | Trạng thái |
|---|---|---|---|

## 8. Rủi Ro Dự Án & Biện Pháp Giảm Thiểu (Project Risks & Mitigations)
| Rủi ro dự án (Hạ tầng / Nhân sự / Lịch trình / Tài liệu) | Khả năng | Tác động | Biện pháp giảm thiểu |
|---|---|---|---|

## 9. Sản Phẩm Bàn Giao (Test Deliverables)
- Danh mục tài liệu đầu ra (`requirements_*.md`, `test_cases_*.md`, `execution_report.md`, `retest_report.md`, `BUG_*.md`, `traceability_matrix.md`, `test_summary_report.md`).

## 10. Phê Duyệt (Approvals)
| Vai trò | Họ tên | Chữ ký / Xác nhận | Ngày duyệt |
|---|---|---|---|

## 11. Phụ Lục — Ánh Xạ Chuẩn Tài Liệu & Điểm Làm Khác (Deviations)
### 11.1 Đối chiếu mục (1–10) sang ISO/IEC/IEEE 29119-3 & IEEE 829-2008
| Mục trong tài liệu | ISO/IEC/IEEE 29119-3 — Test Plan | IEEE 829-2008 — Test Plan |
|---|---|---|
| Mục 1 & 2 | Context · Test scope (Test items & features to be/not to be tested) | Introduction · Test items · Features to be/not to be tested |
| Mục 3 & 4 | Test strategy · Test completion criteria | Approach · Item pass/fail criteria · Suspension/resumption |
| Mục 5, 6, 7 | Test environment · Staffing · Schedule | Environmental needs · Responsibilities · Schedule |
| Mục 8, 9, 10 | Risk register · Test deliverables · Approval | Risks and contingencies · Test deliverables · Approvals |

### 11.2 Điểm làm khác chiến lược kiểm thử chung (Deviations)
- Ghi rõ các điểm điều chỉnh riêng cho đợt này hoặc ghi `Không áp dụng` (không để bảng trống).
```
