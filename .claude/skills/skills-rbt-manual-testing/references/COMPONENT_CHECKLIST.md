# Bảng Component-Level Checklist (Ngoài Form Input)

> **Mục đích:** Form input chỉ là một phần của ứng dụng. Khi module có các thành phần ngoài form input, agent **BẮT BUỘC** sinh TCs theo checklist tương ứng trong tài liệu này.
> **Áp dụng cho:** Tất cả các mode sinh test case (QUICK, FULL RBT, DELTA).

---

## Chi Tiết Checklist Từng Thành Phần

| Component | Checklist cần test |
|---|---|
| **Giao diện tĩnh của màn hình** | Đủ thành phần theo evidence (nhãn nguyên văn, thứ tự field, nút, liên kết, tiêu đề) · trạng thái mặc định từng ô (rỗng / tick sẵn / option đang chọn) · con trỏ đang ở ô nào khi vừa mở · định dạng hiển thị (tiền tệ, ngày, giờ, badge) · trạng thái rỗng · trạng thái đang tải · văn bản gợi ý trong ô (placeholder) · tooltip |
| **Data Table / List** | Sort từng cột (asc/desc) · Filter đơn + kết hợp nhiều filter · Search (khớp một phần, không dấu/có dấu, không có kết quả) · Pagination (trang đầu/cuối, đổi page size, nhảy trang) · Empty state (chưa có data) · Danh sách lớn (100+ bản ghi) · Bulk action (chọn tất cả, chọn một phần, thao tác hàng loạt) · Refresh giữ/mất filter đang áp |
| **CRUD Lifecycle** | Create → hiển thị đúng trong list · View detail khớp data đã tạo · Edit → lưu → verify data cập nhật (cả trong list và detail) · Delete → confirm dialog (Cancel giữ nguyên / OK xóa) · Xóa bản ghi đang được liên kết (foreign key) · Tạo trùng unique field · Edit đồng thời 2 người (concurrent) |
| **Permission / Role** | Đối chiếu **Ma trận Phân quyền** trong requirements: mỗi role × mỗi hành động = 1 TC · Truy cập URL trực tiếp khi không có quyền (bypass UI) · Element ẩn/disable đúng theo role · API trả 403 khi gọi trái quyền |
| **Modal / Dialog** | Mở/đóng bằng nút X, nút Cancel, phím ESC, click ra ngoài · Data trong modal reset hay giữ khi mở lại · Submit trong modal lỗi → modal không đóng, hiện lỗi · Nhiều modal chồng nhau (nếu có) |
| **Notification / Toast** | Nội dung đúng theo từng hành động · Tự đóng sau timeout / đóng tay · Nhiều notification liên tiếp · Toast lỗi khác toast thành công (màu/icon) |
| **Trạng thái (Status Flow)** | Đối chiếu **Ma trận Trạng thái** trong requirements: mỗi transition hợp lệ = 1 TC · Mỗi transition KHÔNG hợp lệ = 1 TC (verify bị chặn) · Hành động cho phép/khóa theo từng trạng thái |

> 📌 **Lưu ý:** Component nào không có trong module đang phân tích $\rightarrow$ ghi chú rõ *"Không áp dụng"* trong phần tổng kết coverage, **KHÔNG** lặng lẽ bỏ qua.
