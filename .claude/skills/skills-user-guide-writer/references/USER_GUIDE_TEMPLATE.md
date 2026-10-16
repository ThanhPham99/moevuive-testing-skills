# Mẫu Tài Liệu Hướng Dẫn Sử Dụng (`user_guide_<module>.md`) & Quy Trình `DOC` / `LIVE`

> Tài liệu tham chiếu chi tiết cho [`skills-user-guide-writer`](../SKILL.md). Nạp khi biên soạn file `docs/user-guides/<module>/user_guide_<module>.md` và cập nhật `docs/user-guides/README.md`.

---

## 1. Cấu Trúc Chuẩn `docs/user-guides/<module>/user_guide_<module>.md`

> Ghi rõ *"Biên soạn theo cấu trúc ISO/IEC/IEEE 26514"* (không ghi số điều khoản cứng và không tự tuyên bố chứng nhận tuân thủ).

```markdown
# Hướng dẫn sử dụng — <Tên hệ thống> · Module <Tên module>

| Thông tin | Nội dung |
|---|---|
| Phiên bản tài liệu | v1.0 |
| Áp dụng cho phiên bản phần mềm | v2.4 |
| Đối tượng đọc | <Vai trò người dùng, VD: Nhân viên kinh doanh (Sales)> |
| Ngày cập nhật | YYYY-MM-DD |
| Cấu trúc tài liệu | Biên soạn theo cấu trúc ISO/IEC/IEEE 26514 |

## 1. Trước khi bắt đầu
- Bạn cần có: tài khoản với quyền `<role>`, trình duyệt `<tên>`.
- Đăng nhập tại: `<đường dẫn hệ thống>`
- 💡 Nếu chưa có tài khoản: liên hệ `<bộ phận quản trị>`.

## 2. Bạn muốn làm gì?
| Tôi muốn… | Xem mục |
|---|---|
| Thêm một khách hàng mới | 3.1 |
| Tìm và sửa thông tin khách hàng | 3.2 |

## 3. Các thao tác

### 3.1 Thêm một khách hàng mới
**Khi nào dùng:** Khi có khách hàng mới cần đưa vào hệ thống theo dõi.

1. Vào **Khách hàng → Danh sách khách hàng**.
2. Nhấn **Thêm mới** ở góc trên bên phải.
   ![Nút Thêm mới](images/them-khach-hang-buoc-2.png)
3. Nhập **Tên khách hàng** (trường bắt buộc).
4. ⚠️ **CẢNH BÁO:** **Mã khách hàng** không sửa được sau khi lưu. Kiểm tra kỹ trước khi nhấn **Lưu**.
5. Nhấn **Lưu**. Hệ thống hiện thông báo **"Thêm mới thành công"** và hiển thị khách hàng mới ở đầu danh sách.

**Nếu không được:**
| Bạn thấy | Nghĩa là | Làm gì |
|---|---|---|
| Thông báo **"Email đã tồn tại"** | Đã có hồ sơ dùng email này | Tra cứu theo email ở mục 3.2 để kiểm tra trùng |

## 4. Câu hỏi thường gặp (Chỉ ghi khi có câu hỏi thực tế từ requirements/vận hành)
## 5. Bảng thuật ngữ (Chỉ lập khi tài liệu dài hoặc nhiều thuật ngữ nghiệp vụ)
## 6. Vùng chưa xác minh (NỘI BỘ — gỡ bỏ trước khi phát hành cho khách hàng)
| Nội dung | Nguyên nhân chưa xác minh |
|---|---|
| Xuất Excel (mục 3.4) | Requirements có nêu nhưng chưa có ảnh evidence và tài khoản hiện tại chưa có quyền |
```

---

## 2. Hai Chế Độ Thu Thập Minh Hoạ (`DOC` vs `LIVE`) & Cập Nhật Danh Mục

1. **Chế độ `DOC` (Mặc định khi không mở trình duyệt):**
   - Đọc `docs/requirements/<module>/requirements_<module>.md` và mở xem 100% ảnh có sẵn trong `docs/requirements/<module>/evidence/`.
   - Copy các ảnh minh hoạ sạch (không lộ dữ liệu khách hàng thật) sang `docs/user-guides/<module>/images/` với tên file gợi nhớ theo bước (`them-khach-hang-buoc-2.png`).
2. **Chế độ `LIVE` (Mở trình duyệt chụp ảnh mẫu sạch):**
   - Dùng Playwright MCP (mặc định **Headless `1920x1080`**) đi theo từng tác vụ người dùng với bộ dữ liệu mẫu giả lập (VD: `Công ty TNHH Minh Hoạ ABC`), chụp ảnh lưu vào `docs/user-guides/<module>/images/`.
3. **Đồng bộ danh mục `docs/user-guides/README.md`:**
   - Sau khi ghi xong `user_guide_<module>.md`, cập nhật bảng danh mục tại `docs/user-guides/README.md` (gồm tên module, đường dẫn file, đối tượng đọc, phiên bản, số mục còn nằm trong Mục 6 nội bộ).
