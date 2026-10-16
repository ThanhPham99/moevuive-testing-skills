---
description: "Sinh Hướng dẫn sử dụng (User Guide) cho người dùng cuối theo tư duy công việc từ requirements & evidence — hỗ trợ 2 chế độ DOC (từ tài liệu/ảnh sẵn có) và LIVE (chạy trình duyệt chụp ảnh mẫu sạch)."
skills:
  - skills-user-guide-writer
---

# Generate User Guide (Workflow Dispatcher)

Biên soạn tài liệu **Hướng dẫn Sử dụng (End-User Guide)** bằng ngôn ngữ tự nhiên, dễ hiểu cho người dùng cuối — được tổ chức theo **công việc cần làm (task-oriented)** thay vì liệt kê theo màn hình kỹ thuật.

## Inputs & Modes
- **Module**: Tên phân hệ cần viết hướng dẫn.
- **Target Audience & Role**: Vai trò người dùng đọc tài liệu (VD: `Nhân viên Bán hàng`, `Kế toán`, `Quản trị viên`) — bắt buộc chốt để không viết lẫn chức năng của quyền khác.
- **Software Version**: Phiên bản phần mềm áp dụng.
- **Mode**:
  - `DOC` (Mặc định khi không mở trình duyệt): Viết từ `docs/requirements/<module>/requirements_<module>.md` và toàn bộ ảnh trong thư mục `evidence/`.
  - `LIVE` (Khuyên dùng khi có tài khoản test): Thực thi lại từng công việc trên trình duyệt bằng dữ liệu mẫu sạch (`Công ty Mẫu ABC`, `demo@example.com`) để chụp bộ ảnh minh họa chuẩn xác và không dính dữ liệu thật.

## Context Pointers (Lazy-Load On Demand)
- **Task-Oriented Structure, Anti-Hallucination & 10-Point Quality Gate**: `.claude/skills/skills-user-guide-writer/SKILL.md`
- **Browser Interaction Rules (chỉ đọc khi `Mode = LIVE`)**: `.claude/skills/skills-ui-debug-agent/SKILL.md`

## Browser Mode & Data Privacy Rules
- **Default Headless Mode (`1920x1080`)**: Khi chạy `Mode = LIVE`, mặc định mở trình duyệt ở chế độ **Headless (`1920x1080`)** để chụp ảnh minh họa sắc nét, đồng nhất kích thước; nếu cần đăng nhập thủ công hoặc quan sát trực tiếp thì chuyển sang Headed bằng `/browser-mode` (`node scripts/browser-mode.mjs headed`).
- **Bảo mật dữ liệu trên ảnh (Zero Real PII)**: Tuyệt đối không để lộ tên thật, SĐT, email, doanh số thật hoặc URL nội bộ trên ảnh chụp phát hành ra ngoài.
- **Chống bịa đặt tuyệt đối**: Mọi bước hướng dẫn, nhãn nút/menu (chép nguyên văn) và bảng *"Nếu không được"* phải truy vết được về ảnh evidence, mã `REQ-ID` hoặc thao tác thật trong phiên `LIVE`. Tính năng chưa có bằng chứng phải đưa vào mục **6. Vùng chưa xác minh (`⚠️ Chưa xác minh`)**.

## Execution Steps

### Bước 0: Chốt Phạm vi, Vai trò (Role) & Chế độ (HITL Checkpoint 1 ⏸️)
⏸️ **DỪNG LẠI (HITL Checkpoint 1)**: Hỏi người dùng xác nhận nhanh: **Module**, **Role người đọc**, **Phiên bản phần mềm**, **Mode (`DOC` hay `LIVE`)**, và tài liệu dùng nội bộ hay phát hành cho khách hàng.

### Bước 1: Đọc Tài liệu Nguồn, Kiểm tra 100% Ảnh Evidence & Lập Danh mục Việc (HITL Checkpoint 2 ⏸️)
1. Đọc file Requirements của module và **mở xem trực tiếp 100% ảnh** trong `evidence/` để ghi nhận nguyên văn nhãn nút, menu, trường bắt buộc và thông báo lỗi.
2. Chuyển đổi từ danh sách màn hình sang **Danh sách Công việc của Người dùng** (mỗi mục bắt đầu bằng động từ hành động: *"1. Thêm khách hàng mới"*, *"2. Tìm kiếm và lọc đơn hàng"*...) kèm các mục `⚠️ Chưa xác minh` (nếu thiếu ảnh/bằng chứng).

⏸️ **DỪNG LẠI (HITL Checkpoint 2)**: Trình bày **Danh sách Công việc** dự kiến để người dùng duyệt trước khi viết chi tiết.

### Bước 2: Chạy Thật & Chụp Ảnh Minh họa Dữ liệu Mẫu *(Chỉ khi `Mode = LIVE`)*
- Đăng nhập đúng `Role` đã chốt, thực hiện từng việc theo đúng trình tự sẽ viết bằng dữ liệu mẫu (`demo@example.com`), chụp ảnh ở các bước quan trọng và lưu vào `docs/user-guides/<module>/images/` (không chạy thao tác phá hủy trên môi trường dùng chung).

### Bước 3: Biên soạn Tài liệu & Kiểm tra 10 Tiêu chí Quality Gate
1. Ghi trực tiếp vào file chuẩn `docs/user-guides/<module>/user_guide_<module>.md` (nếu > 15 việc thì tách vào `parts/part_NN_<slug>.md`) và cập nhật danh mục `docs/user-guides/README.md`.
2. Mỗi công việc trình bày rõ: **Khi nào dùng** -> **Các bước thực hiện đánh số** (kèm cảnh báo `⚠️` đặt ngay trước bước không thể hoàn tác nếu có) -> **Bảng "Nếu không được"** (chỉ ghi các lỗi có thật trong spec/evidence, không tự bịa dòng độn bảng).
3. Rà soát đủ **10 tiêu chí Quality Gate** trong `skills-user-guide-writer` và nhắc người dùng gỡ mục **6. Vùng chưa xác minh** trước khi gửi khách hàng.

## Output
- `docs/user-guides/<module>/user_guide_<module>.md`, thư mục ảnh `docs/user-guides/<module>/images/` và cập nhật `docs/user-guides/README.md`.
