# Khảo Sát Giao Diện Thực Tế, Tầng Network, Phân Quyền & Chuẩn Evidence (UI Recon)

Tài liệu tham chiếu cho nhánh **UI Recon** (`/generate-requirements-from-website` và phần đối chiếu thực tế của nhánh Hybrid).

---

## 1. Chế độ Trình duyệt Mặc định (Browser Execution Mode)

- **Mặc định — Headless Mode (`1920×1080`, tắt GPU):** Mọi tác vụ recon UI chạy ở chế độ **Headless Mode** với viewport `1920×1080` (`--headless`, `--viewport-size=1920,1080`, `--disable-gpu`, `--disable-dev-shm-usage`). Không gọi `browser_resize` vì viewport đã chuẩn từ lúc khởi chạy.
- **Chuyển sang Headed Mode (`1600×750`) theo yêu cầu:** Chỉ bật **Headed Mode** khi người dùng yêu cầu trực tiếp hoặc khi hệ thống chặn bởi CAPTCHA / OTP / MFA cần đăng nhập thủ công một lần để lưu phiên. Chuyển đổi qua workflow `/browser-mode` hoặc lệnh:
  ```bash
  node scripts/browser-mode.mjs headed    # Mở cửa sổ 1600x750 tại (0,0)
  node scripts/browser-mode.mjs headless  # Quay về mặc định 1920x1080 tắt GPU
  node scripts/browser-mode.mjs status    # Kiểm tra chế độ hiện tại
  ```
- **Chuỗi thao tác bắt buộc** (theo `.claude/rules/playwright_rules.md`): `browser_navigate → browser_wait_for(page_load) → browser_snapshot`.

---

## 2. Quy trình 9 Bước Khảo sát UI (Mục 3.1)

1. **Phân tích Khung giao diện (Layout):** Header, Footer, Sidebar, Main Content, Breadcrumb.
2. **Thu thập Form & Inputs:** Tất cả `input`, `select`, `textarea` — ghi nhận `type`, `required`, `maxlength`, `minlength`, `pattern`, giá trị mặc định.
3. **Thu thập Actions:** Chức năng từng nút (Save, Submit, Cancel, Delete, Edit), alerts/toasts/validation messages khi tương tác lỗi.
4. **Trích xuất Workflows:** Sự phụ thuộc giữa các thành phần (VD: nút Submit chỉ enable khi tích Checkbox; chọn Billing Type làm hiện thêm field).
5. **Thu thập Phân quyền (nếu có nhiều role):** Đăng nhập từng role (nếu có account) — ghi nhận role nào thấy gì / làm được gì.
6. **Thu thập Trạng thái (nếu entity có status):** Các trạng thái quan sát được và hành động cho phép ở từng trạng thái.
7. **Thu thập Thông báo lỗi:** Trigger từng validation để ghi nhận **nguyên văn** error message từ UI thực tế.
8. **Đọc tầng Network thụ động** (mục 3 bên dưới) — bắt buộc khi hệ thống không có tài liệu.
9. **Thăm dò phân quyền khi thiếu account** (mục 4 bên dưới) — áp dụng khi không đủ account cho mọi role.

---

## 3. Thu thập từ tầng Network (Mục 3.1.1 — BẮT BUỘC khi thiếu tài liệu)

DOM chỉ cho biết hệ thống hiển thị gì; tầng network cho biết hệ thống thật sự làm gì ở backend. Bật `browser_network_requests` xuyên suốt quá trình recon (kể cả lúc submit form để bắt response lỗi).

| Loại request | Dữ kiện rút ra được | Ghi vào mục nào |
|---|---|---|
| `GET /api/<entity>` — danh sách | Tên trường thật của entity · trường có trong data nhưng ẩn trên bảng · cấu trúc phân trang (`page`/`size`/`total`) | 6.3 Field Spec · 6.2 REQ về phân trang |
| `GET /api/<entity>/{id}` — chi tiết | Toàn bộ schema entity · quan hệ tới entity khác (`customer_id`, `owner`) | 6.3 · Bản đồ phụ thuộc |
| `POST`/`PUT` — payload submit | Tên field thật ↔ nhãn hiển thị · field ẩn gửi kèm · kiểu dữ liệu thật (số vs chuỗi) | 6.3 (ánh xạ nhãn ↔ field) |
| Response **4xx khi submit sai** | ⭐ **Validation server-side** mà UI không chặn · **nguyên văn message** trong body (thường khác message trên UI) | 6.4 Validation Messages |
| Response chứa enum | Danh sách trạng thái đầy đủ — kể cả trạng thái chưa từng thấy trên UI | 6.6 Ma trận Trạng thái |
| Endpoint gọi khi mở dropdown | Nguồn dữ liệu của dropdown (bảng master nào) · tổng số option thật so với số đang hiển thị | 6.3 · phát hiện dropdown bị giới hạn |
| Endpoint **có nhưng không UI nào gọi** | Tính năng chưa build hoặc đã gỡ giao diện | 6.2 với trạng thái `⚪` + `AMB-XX` |
| Response `403` khi đổi role | Ranh giới phân quyền thật ở tầng server | 6.5 Ma trận Phân quyền |

**Luật ghi nhận dữ kiện Network:**
- **Rule chỉ có ở server, UI không chặn:** Vẫn gán REQ, cột `Nguồn` ghi `API · POST /api/x · 422` + mở `AMB-XX` hỏi chặn ở UI hay cố ý để server chặn.
- **Message API khác message hiện trên UI:** Ghi **cả hai nguyên văn** vào mục 6.4 + mở `AMB-XX` mức 🔴 High (dấu hiệu bug tiềm ẩn).
- **Field có trong payload nhưng không có trên form:** Gán REQ trạng thái `⚪` hoặc mở `AMB-XX` — không im lặng bỏ qua.
- **Endpoint không có UI:** Chỉ ghi nhận, **KHÔNG** gọi thử.

> 🚫 **Cấm tuyệt đối:** Gọi API trực tiếp (`curl` / `fetch` / `browser_evaluate` gọi endpoint) để dò hành vi. Recon chỉ được **quan sát thụ động** request do UI tự phát sinh.

---

## 4. Thăm dò Phân quyền khi thiếu Account (Mục 3.1.2)

Khi hệ thống có nhiều role nhưng QA chỉ có một số account, giữ đầy đủ mục 6.5 (không bỏ trống, không bịa) theo 3 bước:

1. **Bước 1 — Xác định danh sách role của hệ thống:**
   - Đọc dropdown chọn role / bảng danh sách role ở màn hình quản lý người dùng.
   - Đọc ma trận cấu hình quyền của chính hệ thống (nguồn tốt nhất — chép nguyên trạng).
   - Đọc response API chứa `role` / `permissions` (mục 3) hoặc tài liệu QA cung cấp.
2. **Bước 2 — Ghi ma trận theo thang 3 mức bằng chứng:**
   - `✅` / `❌` (**Đã kiểm chứng**): Đã đăng nhập đúng role đó và thao tác thật.
   - `⚠️✅` / `⚠️❌` (**Suy từ cấu hình**): Đọc từ màn hình phân quyền của hệ thống, chưa đăng nhập thử (kèm chú thích nguồn).
   - `❔` (**Chưa có căn cứ**): Không có account và không có màn hình cấu hình → **bắt buộc** mở `AMB-XX` 🔴 High.
3. **Bước 3 — Khai thác tối đa trên account đang có:**
   - Phân biệt bằng DOM: menu/nút **bị ẩn** (`display:none` / không render) vs **hiện nhưng `disabled`**.
   - Thử mở trực tiếp **URL chỉ đọc** của chức năng bị ẩn để quan sát phản ứng (chuyển hướng · trang `403` · vẫn vào được). ⚠️ Tuyệt đối không thử URL xoá/sửa.
   - So sánh response `permissions` lúc đăng nhập với danh sách quyền ở màn hình cấu hình.

**Luật cứng về phân quyền:**
- Không suy quyền của role B từ hành vi của role A.
- Ô `❔` giữ nguyên là `❔`, **không làm tròn thành `❌`** ("chưa kiểm chứng" ≠ "không có quyền").
- Cuối ma trận 6.5 **bắt buộc** có dòng tổng khớp `số hàng × số cột`: `Tổng N ô = Đã kiểm chứng A · Suy diễn B · Chưa rõ C · Không áp dụng D` (giải thích rõ các ô `—` không áp dụng).
- Mỗi role chưa có account = 1 `AMB-XX` 🔴 riêng (*"Xin account role X để kiểm chứng M ô đang suy diễn/chưa rõ"*).

---

## 5. Luật Cứng Nhánh UI Recon & Chuẩn Evidence (Mục 7.2 & 7.2.1)

### 5.1. Phân biệt cột `Nguồn` trên UI
- `UI thực tế`: Chỉ quan sát thấy trên giao diện.
- `Kiểm chứng thực tế`: Đã tương tác (bấm nút, submit, mở dropdown) và xác nhận kết quả + có ảnh trong Danh mục Evidence hoặc số liệu đọc DOM trong AC.
- Khi kết hợp tài liệu bán phần: dùng thang 4 mức tại `DOC_AND_HYBRID_ANALYSIS.md` mục 2.2.

### 5.2. 10 Quy tắc Chuẩn Evidence (`docs/requirements/<module>/evidence/`)

| Quy tắc | Yêu cầu thực thi |
|---|---|
| **1. Chứa trọn đối tượng cần chứng minh** | Mặc định `browser_take_screenshot(fullPage=true)` cho form/trang dài để không cắt mất nút Save hay field cuối. Nếu đối tượng là widget nhỏ nằm trọn trong viewport (header, dropdown, modal), chụp `viewport` để tuân thủ vệ sinh dữ liệu |
| **2. Chụp theo từng trạng thái động** | Mỗi trạng thái động = 1 ảnh riêng: dropdown **đang mở**, field mới hiện sau khi đổi giá trị điều khiển, checkbox `disabled` vs `enabled`, form **sau khi submit lỗi** (thấy rõ inline error) |
| **3. ⚡ Tối ưu Token Vision khi chụp ảnh** | `browser_take_screenshot` ghi trực tiếp tệp `.png` xuống đĩa làm bằng chứng cho con người/viewer. **KHÔNG dùng `Read` nạp ngược mọi ảnh `.png` vào context** nếu `browser_snapshot` + `browser_evaluate` đã xác nhận trạng thái DOM hiển thị (`offsetParent !== null`, `boundingClientRect > 0`); chỉ gọi `Read` trên tệp ảnh khi cần kiểm tra lỗi bố cục thị giác/CSS hoặc nghi ngờ trang chưa render xong |
| **4. Chụp đủ mọi tab** | Trang nhiều tab → kích hoạt và chụp riêng từng tab (tab ẩn không render đúng nội dung bên trong) |
| **5. Bảng danh sách đủ điều khiển** | Ảnh bảng phải thấy: hàng tiêu đề, dropdown page size, các nút thanh công cụ (kể cả icon không nhãn), ô tìm kiếm, khu vực phân trang |
| **6. Đặt tên chuẩn theo trạng thái & phạm vi** | `<màn_hình>_<trạng_thái>_<fullpage\|viewport>.png` (VD: `project_new_form_default_fullpage.png`, `dashboard_logout_menu_open_viewport.png`). Hậu tố phải khớp cách chụp thật |
| **7. 🔒 Vệ sinh dữ liệu (Data Hygiene)** | Không chụp thừa dữ liệu nhạy cảm/nghiệp vụ không liên quan tới REQ. Đối tượng nằm gọn trong viewport thì chụp `viewport` và ghi lý do vào Danh mục Evidence; buộc phải `fullpage` dính dữ liệu nhạy cảm thì báo user trước khi commit |
| **8. Bảng Danh mục Evidence trong tài liệu** | Liệt kê mỗi ảnh 1 dòng: `Tên tệp \| Màn hình \| Trạng thái \| REQ chứng minh`. REQ không có ảnh hoặc số liệu DOM thì không được ghi `Kiểm chứng thực tế` |
| **9. Ảnh không thay thế đọc DOM** | Dùng `browser_evaluate` để lấy các thông số kỹ thuật mà ảnh không thể hiện được (bảng 5.3 bên dưới) và chép nguyên số liệu vào AC |
| **10. DOM không thay thế ảnh** | Phần tử đếm được trong DOM không chứng minh người dùng nhìn thấy nó — luôn kết hợp kiểm tra hiển thị thật (mục 5.3) |

### 5.3. 10 Dữ kiện BẮT BUỘC đọc từ DOM bằng `browser_evaluate`

| # | Dữ kiện phải đọc từ DOM | Lý do & cách ghi vào AC |
|---|---|---|
| 1 | Số `<option>` thật của mỗi `<select>` | Phát hiện option rỗng đầu danh sách không hiện trên ảnh nhưng vẫn đếm khi chạy automation |
| 2 | Option nào đang `selected` (nhất là multi-select) | Multi-select trên ảnh bị cắt thành `...`, không đếm được |
| 3 | `disabled` vs `checked` của từng checkbox/button | Màu xám trên ảnh không phân biệt được `disabled` thật hay style nhạt |
| 4 | Thuộc tính `value` của option (ánh xạ nhãn ↔ giá trị) | Automation chọn theo `value`, không hiện trên ảnh |
| 5 | Thứ tự focus (`tabIndex` / thứ tự DOM) ở form nhiều cột | Thứ tự nhấn phím Tab có thể khác thứ tự nhìn từ trên xuống |
| 6 | Phần tử ẩn bằng class (`hidden`, `d-none`) nhưng vẫn trong DOM | Phân biệt "không tồn tại" với "tồn tại nhưng đang ẩn" |
| 7 | `el.offsetParent` + `getBoundingClientRect()` + `getComputedStyle().display` của tổ tiên | Xác minh phần tử **thực sự hiển thị và bấm được** (`offsetParent !== null`, kích thước `> 0×0`), phát hiện ẩn theo responsive/quyền |
| 8 | Số phần tử **lồng bên trong** khi mô tả vị trí (`:last-child`, `:first-child`) | Dùng bộ chọn con trực tiếp `X > li:last-child` thay vì `X li:last-child` để không bắt nhầm submenu lồng bên trong; ghi rõ số phần tử lồng |
| 9 | Giá trị **đầy đủ** của `document.title` và `body.className` | Phát hiện phần động (số đếm thông báo `(16) Dashboard`, token theo trình duyệt) để AC dùng `chứa <phần bất biến>` thay vì `=` tuyệt đối |
| 10 | Kích thước viewport đang đo (`innerWidth × innerHeight`) | Ghi rõ vào bảng Metadata (`Trình duyệt khảo sát`, mặc định `1920×1080` ở Headless Mode hoặc `1600×750` ở Headed Mode) và vào các AC phụ thuộc responsive |

### 5.4. Checklist đóng phiên UI Recon
- [ ] Mọi REQ ghi `Nguồn = UI thực tế / Kiểm chứng thực tế` đều truy về ít nhất 1 ảnh trong Danh mục Evidence hoặc 1 số liệu đọc DOM trong AC (nếu chưa kiểm chứng → hạ trạng thái + mở `AMB-XX`).
- [ ] Mọi tệp ảnh trong Danh mục Evidence đã được xác nhận trạng thái hiển thị qua `browser_snapshot` + `browser_evaluate` (chỉ gọi `Read` trên tệp ảnh khi cần kiểm tra lỗi bố cục thị giác/CSS hoặc nghi ngờ chưa render xong).
- [ ] Đã chạy **Cổng Tự Soát REQ 10 điểm** (`SKILL.md` mục 3 & `OUTPUT_TEMPLATES_AND_GATE.md` mục 2) trên toàn bộ REQ vừa sinh.
