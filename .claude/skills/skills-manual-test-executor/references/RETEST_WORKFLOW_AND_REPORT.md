# Quy Trình Retest Bug Đã Sửa & Schema Báo Cáo (`retest_report.md`)

> **Áp dụng cho:** `/retest-fixed-bugs` (phối hợp giữa [`skills-manual-test-executor`](../SKILL.md) và [`skills-bug-reporter`](../../skills-bug-reporter/SKILL.md)).

---

## 1. Chốt Chặn Phiên Bản Build & 2 Chế Độ Thực Thi (`FULL` / `RETEST`)

1. **Chốt chặn Phiên bản Build (`Build mới ≠ Build gốc`):**
   - Trước khi mở trình duyệt, đối chiếu phiên bản build hiện tại với `Build / Version` ghi trong file `docs/bugs/<module>/BUG_*.md` gốc.
   - Nếu **giống hệt** bản build lúc ghi nhận bug → ⛔ **DỪNG NGAY** và báo người dùng, không chạy retest vô nghĩa trên build cũ.
2. **Bảo toàn nguyên trạng Bug Report gốc:**
   - Giữ nguyên toàn bộ mô tả gốc (`Steps to Reproduce`, `Expected`, `Actual`, ảnh lỗi ban đầu) làm bằng chứng lịch sử; chỉ nối thêm dòng kết quả mới lên đầu bảng `## Lịch sử retest` ở cuối file bug.
3. **Hai chế độ thực thi:**
   - **`FULL` (Mặc định cho mọi bug `Critical` / `Major` hoặc bản sửa chạm logic dùng chung):** Xác minh lại bug gốc (tối thiểu 2 lần liên tiếp) + chạy kiểm thử hồi quy (Regression) tối đa **15 Test Cases** theo 3 vòng đồng tâm.
   - **`RETEST` (Dùng cho bug `Minor` / `Trivial` cô lập như sửa chính tả, căn chỉnh UI):** Chỉ xác minh lại đúng bug gốc (tối thiểu 2 lần liên tiếp, lược bỏ mục `## 3. Kết quả regression`).

---

## 2. Bốn Trạng Thái Chấm Điểm Retest (Tối Thiểu 2 Lần Chạy Liên Tiếp)

Thực hiện đúng trình tự `browser_navigate → browser_wait_for → browser_snapshot → interact` theo đúng từng bước trong `Steps to Reproduce` của bug gốc **tối thiểu 2 lần liên tiếp** và chụp screenshot bằng chứng (kể cả khi đã sửa xong):

| Trạng thái | Điều kiện chấm | Hành động trên Bug Report gốc |
|---|---|---|
| `✅ FIXED` | Chạy đủ các bước, kết quả thực tế khớp hoàn toàn `Expected Result` trong cả 2 lần chạy liên tiếp | Cập nhật trạng thái đóng/đã xác minh + gắn ảnh bằng chứng pass vào `## Lịch sử retest` |
| `❌ NOT_FIXED` | Lỗi cũ vẫn tái hiện ở bất kỳ lần chạy nào | Giữ bug mở (không tạo bug mới trùng lặp), gắn ảnh lỗi mới vào `## Lịch sử retest` |
| `🟡 PARTIAL` | Lỗi gốc không còn nhưng hành vi mới vẫn lệch `Expected Result` hoặc chỉ đúng ở một phần trường hợp | Giữ bug mở, mô tả rõ phần còn lệch tại `## Lịch sử retest` |
| `⚠️ CANNOT_VERIFY` | Môi trường lỗi, thiếu quyền hoặc không dựng được điều kiện tiền đề | Tuyệt đối không đoán là `FIXED`; ghi rõ nguyên nhân chặn |

---

## 3. Ba Vòng Hồi Quy Đồng Tâm Quanh Vùng Fix (`Mode = FULL`, Tối Đa 15 TC)

Khi chạy `Mode = FULL`, chọn tối đa **15 Test Cases** từ `docs/testcases/<module>/test_cases_<module>.md` theo 3 vòng đồng tâm:

1. **Vòng 1 — Cùng `REQ ID`:** Các TC kiểm thử cùng yêu cầu nghiệp vụ với bug vừa sửa.
2. **Vòng 2 — Cùng Màn hình / Form / API:** Các TC thao tác trên cùng màn hình, modal hoặc endpoint.
3. **Vòng 3 — Thành phần dùng chung:** Chỉ mở khi bản fix sửa vào hàm/component dùng chung (`Auth`, `Search`, `Filter`, `Pagination`, `Export`).

> Nếu phát hiện TC hồi quy bị `❌ FAIL` do bản sửa gây ra → tách thành **Bug mới** qua `/create-bug-report` và ghi rõ *"Regression phát sinh sau khi fix BUG_xxx"*. Tuân thủ quy tắc **Auto-Skip TC phá huỷ** nếu đang chạy trên môi trường dùng chung.

---

## 4. Output Schema Chuẩn — `docs/executions/<module>/retest_<timestamp>/retest_report.md`

Schema dưới đây tương thích 100% với `scripts/execution-viewer/bundle.html` (`parseExecutionReport`) và `scripts/validate-docs.mjs`:

```markdown
# Retest Report — Customers · Build v2.4.3

| Thông tin | Nội dung |
|---|---|
| Retest ID | retest_1785700999 |
| Build lúc log bug → Build retest | v2.4.1 → v2.4.3 |
| Chế độ chạy | FULL (hoặc RETEST) |
| Môi trường | https://crm.anhtester.com/admin/ — Staging |
| Bắt đầu → Kết thúc | 2026-08-22 10:00 → 10:25 |

## 1. Tổng kết nhanh
- **Bug xác minh:** 1 FIXED · 0 NOT_FIXED · 0 PARTIAL · 0 CANNOT_VERIFY
- **Regression (`Mode = FULL`):** 1 PASS · 0 FAIL · 0 BLOCKED · 0 SKIPPED

## 2. Kết quả từng bug
### BUG_cust_1785700456_TC011 — Lỗi lưu SĐT có dấu cộng
| Thông tin | Nội dung |
|---|---|
| Bug | [BUG_cust_1785700456_TC011](../../../bugs/customers/BUG_cust_1785700456_TC011.md) |
| Severity gốc | 🟠 Major |
| TC / REQ liên quan | CRM_CUST_TC_011 · REQ-CUST-04 |
| Số lần lặp | 2/2 lần chạy độc lập |
| Expected (theo bug gốc) | Lưu thành công SĐT định dạng quốc tế `+84...` |
| Actual lần này | Lưu thành công và hiển thị đúng trên danh sách |
| **Kết quả** | ✅ FIXED |
| Evidence | [run1](evidence/BUG_cust_1785700456_TC011_retest_run1.png), [run2](evidence/BUG_cust_1785700456_TC011_retest_run2.png) |

## 3. Kết quả regression
| TC ID | Vòng | Kịch bản | Kết quả | Ghi chú |
|---|---|---|---|---|
| CRM_CUST_TC_012 | Vòng 1 (Cùng REQ) | Lưu SĐT nội địa 10 chữ số | ✅ PASS | [ảnh](evidence/CRM_CUST_TC_012_pass.png) |

## 4. Dữ liệu đã tạo & dọn dẹp
| Dữ liệu | ID | Nơi tạo | Đã xoá? |
|---|---|---|---|
| Auto_Retest_1785700999 | 108 | /admin/clients | ✅ |

## 5. Kết luận & đề xuất đóng/mở bug
- Đề xuất: Đóng `BUG_cust_1785700456_TC011` (đã FIXED ổn định qua 2 lần chạy và không phát sinh lỗi hồi quy).
```
