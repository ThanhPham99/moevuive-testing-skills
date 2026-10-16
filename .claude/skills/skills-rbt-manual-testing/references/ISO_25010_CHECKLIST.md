# Rà Soát Đặc Tính Chất Lượng (ISO/IEC 25010:2023) & Non-Functional Scenarios

> **Mục đích:** Trả lời câu hỏi *"bộ TC này có bỏ sót loại kiểm thử nào không"* bằng một khung chuẩn quốc tế, thay vì cảm tính. Chạy **một lượt ở cuối**, sau khi đã sinh xong TC — **không** dùng làm khung sinh TC.
> **Áp dụng cho:** Bảng đối soát xuất kèm ở cuối tài liệu Test Case.

---

## 1. Bảng 9 Đặc Tính Chất Lượng ISO/IEC 25010:2023

ISO/IEC 25010:2023 (Product quality model) có **9 đặc tính**. So với bản 2011: `Usability` $\rightarrow$ **Interaction Capability**, `Portability` $\rightarrow$ **Flexibility**, và bổ sung mới **Safety**.

| # | Đặc tính | Đặc tính con chính | QA chức năng làm được gì bằng manual TC | Nếu ngoài phạm vi |
|---|---|---|---|---|
| 1 | **Functional Suitability**<br>Phù hợp chức năng | Completeness · Correctness · Appropriateness | ⭐ **Phần chính của mọi bộ TC** — đã phủ qua Positive/Negative/Boundary | Không bao giờ ngoài phạm vi |
| 2 | **Performance Efficiency**<br>Hiệu quả hiệu năng | Time behaviour · Resource utilization · Capacity | Chỉ quan sát được mức thô: trang tải quá lâu, danh sách 1000 dòng bị treo | Đội hiệu năng / công cụ tải — ghi vào mục 2.2 Master Test Plan |
| 3 | **Compatibility**<br>Tương thích | Co-existence · Interoperability | Đa trình duyệt · đa độ phân giải · import/export đúng định dạng · tích hợp bên thứ ba | Ghi rõ trình duyệt/thiết bị nào **không** kiểm |
| 4 | **Interaction Capability**<br>Khả năng tương tác (bản 2011: Usability) | Learnability · Operability · **User error protection** · Inclusivity · User assistance | ⭐ Làm được nhiều: thông báo lỗi có dễ hiểu không · chặn thao tác sai · điều hướng bàn phím · nhãn/tooltip · trạng thái rỗng | A11y chuyên sâu (WCAG đầy đủ) cần công cụ riêng |
| 5 | **Reliability**<br>Tin cậy | Faultlessness · Availability · Fault tolerance · **Recoverability** | Mất mạng giữa chừng · session hết hạn · submit lại sau lỗi · dữ liệu có mất không sau khi khôi phục | Đo uptime/MTBF thuộc vận hành |
| 6 | **Security**<br>An toàn thông tin | Confidentiality · Integrity · Authenticity · **Accountability** · Resistance | Phân quyền theo role · truy cập URL trực tiếp khi chưa đăng nhập · dữ liệu người này có lộ sang người kia không · nhật ký thao tác | Pentest, quét lỗ hổng — **luôn** ghi rõ ai làm |
| 7 | **Maintainability**<br>Bảo trì | Modularity · Reusability · Analysability · Modifiability · Testability | 🚫 **Không kiểm được bằng manual TC** — đây là đặc tính của mã nguồn | Code review / static analysis — không thuộc QA chức năng |
| 8 | **Flexibility**<br>Linh hoạt (bản 2011: Portability) | Adaptability · **Scalability** · Installability · Replaceability | Responsive trên nhiều kích thước màn hình · cài đặt/nâng cấp · đổi ngôn ngữ, múi giờ, đơn vị tiền | Scalability hạ tầng thuộc đội vận hành |
| 9 | **Safety**<br>An toàn (mới ở bản 2023) | Operational constraint · Fail safe · **Hazard warning** | Chỉ áp dụng cho hệ thống mà lỗi gây thiệt hại thật (y tế, tài chính, thiết bị): có cảnh báo trước thao tác không hồi lại được không · có xác nhận trước khi xoá/chuyển tiền không | ➖ Không áp dụng với đa số app nghiệp vụ thông thường |

---

## 2. Ba Quy Tắc Áp Dụng

1. **Chấm từng đặc tính, không bỏ trống ô nào:** `✅ Có TC` (dẫn TC ID) · `➖ Ngoài phạm vi` (**phải ghi ai chịu trách nhiệm**) · `🔴 Thiếu` (phải bổ sung trước khi xuất).
2. 🚫 **KHÔNG sinh TC cho đủ 9 ô.** Đặc tính không áp dụng với module này thì chấm `➖` kèm lý do — TC sinh ra chỉ để lấp bảng là TC rác, làm loãng bộ TC thật.
3. **Ô `➖` là dữ liệu đầu vào cho `/generate-master-test-plan` mục 2.2 (Ngoài phạm vi).** Đây là giá trị lớn nhất của bảng này: biến *"QA quên test"* thành *"đã xem xét và thống nhất không test"*.

### Mẫu bảng xuất kèm cuối tài liệu TC:

```markdown
## Rà soát đặc tính chất lượng (ISO/IEC 25010:2023)

| Đặc tính | Trạng thái | TC ID / Lý do |
|---|---|---|
| Functional Suitability | ✅ Có TC | TC_001–TC_048 |
| Performance Efficiency | ➖ Ngoài phạm vi | Không có công cụ tải — đội Hạ tầng, đợt sau |
| Compatibility | ✅ Có TC | TC_049–TC_052 (Chrome, Edge, 1366×768) |
| Interaction Capability | ✅ Có TC | TC_053–TC_060 (thông báo lỗi, điều hướng bàn phím, trạng thái rỗng) |
| Reliability | 🔴 Thiếu | Chưa có TC session hết hạn giữa chừng khi điền form → bổ sung trước khi xuất |
| Security | ✅ Có TC | TC_061–TC_070 (phân quyền 3 role, truy cập URL trực tiếp) |
| Maintainability | ➖ Không áp dụng | Đặc tính của mã nguồn, không kiểm bằng manual TC |
| Flexibility | ✅ Có TC | TC_071–TC_074 (responsive 1366/1920, đổi ngôn ngữ) |
| Safety | ➖ Không áp dụng | App nghiệp vụ, lỗi không gây thiệt hại vật lý |
```

---

## 3. Scenarios Chuyên Sâu & Non-Functional Checklist (Áp dụng nâng cao)

Các tình huống kiểm thử nâng cao chi tiết hoá các đặc tính ISO 25010:

1. **Race Condition & Double Submit:**
   - Double click liên tiếp nút Save/Submit (ngăn tạo 2 bản ghi trùng).
   - Concurrent editing: 2 tabs/users cùng sửa 1 bản ghi đồng thời.
2. **Session & Network Resilience:**
   - Session timeout / Token hết hạn giữa chừng khi đang điền form.
   - Network interruption (mất mạng khi submit payload, slow 3G timeout, retry logic).
3. **Localization & UTF-8 / Emoji:**
   - Nhập tiếng Việt đầy đủ dấu (`Tiếng Việt có dấu phức tạp ỨỜÁ...`).
   - Nhập emoji (`😀🎉🚀`) và ký tự đa ngôn ngữ (RTL, tiếng Trung, Nhật, Ả Rập).
4. **Keyboard Accessibility (A11y):**
   - Điều hướng bằng phím `Tab` theo thứ tự hợp lý, kích hoạt bằng `Enter`/`Space`.
   - Hiển thị viền focus state rõ ràng.
5. **HTTP Status Codes (Cho API Test Cases):**
   - Assert đầy đủ các status codes tiêu chuẩn: `200/201 Success`, `400 Bad Request`, `401 Unauthorized`, `403 Forbidden`, `404 Not Found`, `409 Conflict`, `422 Unprocessable Entity`, `429 Rate Limit`, `500/503 Server Error`.
