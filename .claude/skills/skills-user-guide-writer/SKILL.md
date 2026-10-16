---
name: skills-user-guide-writer
description: "Write task-oriented end-user manuals (User Guides) from verified requirements and UI evidence following ISO/IEC/IEEE 26514 and 82079-1 minimalism, safety hierarchy, and anti-hallucination rules."
---

# User Guide Writer

Chuyển hóa tài liệu `docs/requirements/<module>/` và ảnh chụp giao diện thực tế thành **Hướng Dẫn Sử Dụng (User Guide)** tổ chức theo **công việc người dùng cần làm (task-oriented)**, biên soạn theo cấu trúc **ISO/IEC/IEEE 26514** và **ISO/IEC/IEEE 82079-1:2019**.

---

## 1. Ranh Giới Tài Liệu & 5 Quy Tắc Chống Bịa (Anti-Hallucination)

| Tiêu chí | Requirements (`REQ`) | Test Cases (`TC`) | **User Guide (Skill này)** |
|---|---|---|---|
| **Câu hỏi trả lời** | Hệ thống phải làm gì? | Làm sao kiểm chứng hệ thống đúng? | **Tôi làm thế nào để hoàn thành công việc?** |
| **Cách tổ chức** | Theo chức năng / màn hình | Theo `REQ ID` & 4 Vòng kiểm thử | ⭐ **Theo việc người dùng muốn làm (*"Tôi muốn..."*)** |
| **Giọng văn** | Mô tả quy tắc | Thao tác + Kỳ vọng kiểm thử | **Ngôi thứ hai, mệnh lệnh, thì hiện tại (*"Nhấn **Lưu**."*)** |

### 5 Quy tắc chống bịa bắt buộc
1. **Truy vết bằng chứng 100%:** Mọi bước hướng dẫn phải dựa trên ít nhất 1 trong 3 nguồn: (a) ảnh thật đã mở xem trong `docs/requirements/<module>/evidence/`, (b) dòng `REQ ID` trong `requirements_<module>.md`, hoặc (c) thao tác trực tiếp qua Playwright MCP (`Mode = LIVE`). Nội dung chưa xác minh phải gắn `⚠️ Chưa xác minh` và đưa vào **Mục 6 (Nội bộ)**.
2. **Chép nguyên văn nhãn giao diện:** Mọi tên nút, menu, trường nhập, thông báo phải viết **in đậm** và khớp từng ký tự trên màn hình (VD: nhấn **Cập nhật**, không viết *"nhấn nút lưu"*).
3. **Mỗi bước 1 hành động + Kết quả quan sát được:** Tối đa **10 bước / thủ tục** (dài hơn thì tách thành việc con). Bước cuối của mỗi thủ tục phải nêu rõ người dùng nhìn thấy gì khi thành công.
4. **Không độn bảng *"Nếu không được"* và FAQ:** Chỉ ghi những tình huống lỗi/câu hỏi có bằng chứng từ requirements/evidence. Bảng 1 dòng hoàn toàn hợp lệ; nếu thủ tục đơn giản không có lỗi thường gặp thì **bỏ hẳn bảng**.
5. **🔒 Bảo mật dữ liệu trên ảnh minh hoạ (`docs/user-guides/<module>/images/`):** Chỉ dùng dữ liệu mẫu trên ảnh; tuyệt đối không để lộ tên thật, email, SĐT, số tiền của khách hàng thật. Đặt ảnh ngay dưới bước cần minh hoạ.

---

## 2. Phân Cấp Cảnh Báo An Toàn (Theo ISO/IEC/IEEE 82079-1)

Đặt cảnh báo **ngay trước** bước thao tác có rủi ro:
- 🛑 **NGUY HIỂM:** Gây thiệt hại tài chính/tài sản không thể đảo ngược (VD: lệnh chuyển tiền, xuất kho).
- ⚠️ **CẢNH BÁO:** Mất dữ liệu hoặc thao tác xoá không thể khôi phục.
- ❗ **THẬN TRỌNG:** Dữ liệu khoá không sửa lại được sau khi lưu (VD: Mã số thuế, Mã khách hàng).
- 💡 **Lưu ý:** Mẹo thao tác nhanh, không có rủi ro.

---

## 3. Cấu Trúc Chuẩn `docs/user-guides/<module>/user_guide_<module>.md`

Nạp mẫu Markdown đầy đủ tại [`references/USER_GUIDE_TEMPLATE.md`](references/USER_GUIDE_TEMPLATE.md). Tài liệu gồm 6 mục chuẩn (ghi rõ *"Biên soạn theo cấu trúc ISO/IEC/IEEE 26514"*, không tự tuyên bố chứng nhận tuân thủ):
1. **Mục 1 — Trước khi bắt đầu:** Quyền tài khoản `<role>`, trình duyệt hỗ trợ, đường dẫn đăng nhập.
2. **Mục 2 — Bạn muốn làm gì?:** Bảng điều hướng nhanh `| Tôi muốn… | Xem mục |` viết theo tác vụ thực tế.
3. **Mục 3 — Các thao tác:** Từng thủ tục `3.1, 3.2...` gồm **Khi nào dùng**, các bước `1..N` ($\le 10$ bước, kèm ảnh `images/*.png` và cảnh báo an toàn), và bảng **Nếu không được** (`| Bạn thấy | Nghĩa là | Làm gì |`).
4. **Mục 4 — Câu hỏi thường gặp (FAQ)** & **Mục 5 — Bảng thuật ngữ:** Chỉ lập khi có dữ liệu thực tế từ requirements/vận hành.
5. **Mục 6 — Vùng chưa xác minh (NỘI BỘ):** Ghi rõ các tính năng thiếu ảnh evidence hoặc thiếu quyền tài khoản để gỡ bỏ trước khi phát hành cho khách hàng.

---

## 4. Quality Gate 10 Tiêu Chí (Cơ sở: ISO/IEC/IEEE 26513) & Tham Chiếu

Trước khi xuất file, kiểm tra đủ 10 điểm:
- [ ] **1.** Mục lục Mục 2 viết theo công việc (*"Tôi muốn…"*), không viết theo tên màn hình.
- [ ] **2.** 100% các bước truy được về ảnh evidence / `REQ ID` / thao tác MCP thật; phần thiếu đưa vào Mục 6.
- [ ] **3.** Nhãn nút, menu, thông báo chép nguyên văn và **in đậm**.
- [ ] **4.** Mỗi bước 1 hành động, đánh số thứ tự, dùng câu mệnh lệnh ở thì hiện tại.
- [ ] **5.** Bước cuối mỗi thủ tục mô tả rõ kết quả người dùng nhìn thấy trên màn hình.
- [ ] **6.** Mỗi thủ tục $\le 10$ bước.
- [ ] **7.** Cảnh báo 🛑/⚠️/❗ đặt ngay trước bước gây hậu quả, đúng cấp độ rủi ro.
- [ ] **8.** 🔒 Đã mở kiểm tra từng ảnh minh hoạ: không chứa PII hay dữ liệu khách hàng thật.
- [ ] **9.** Thuật ngữ đồng nhất xuyên suốt tài liệu và cập nhật danh mục `docs/user-guides/README.md`.
- [ ] **10.** Không độn dòng giả định vào bảng *"Nếu không được"* hoặc FAQ.

- **Tài liệu tham chiếu:** [`references/USER_GUIDE_TEMPLATE.md`](references/USER_GUIDE_TEMPLATE.md) (Mẫu `user_guide_<module>.md` đầy đủ & quy trình `DOC` / `LIVE`).
