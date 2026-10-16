# Quy Tắc Cốt Lõi & Quy Trình Mode QUICK / Mode FULL RBT

> **Mục đích:** Quy định chi tiết về Độ hạt Test Case (`GỘP` / `TÁCH`), Quy tắc Đối chiếu Evidence, Quy tắc Ngôn ngữ Kiểm chứng, Quy tắc Xuất file theo Batch, và quy trình thực thi của **Mode 1: QUICK** cùng **Mode 2: FULL RBT (6 bước)**.
> **Áp dụng cho:** `/generate-testcases-from-requirements` (QUICK), `/generate-testcases-manual-rbt` (FULL RBT), và các quy tắc nền tảng dùng chung.

---

## 1. Độ Hạt Test Case — `GỘP` / `TÁCH` (Chốt Trước Batch Đầu Tiên)

Cùng một mức bao phủ REQ, số TC có thể chênh gấp đôi tùy độ hạt (`GỘP` ~35–45 TC vs `TÁCH` ~75–90 TC cho module cỡ Login). Phải chốt độ hạt trước khi ghi dòng TC đầu tiên và công bố ngay ở dòng kế hoạch batch.

| Tiêu chí | **GỘP** (consolidated) — ⭐ Mặc định | **TÁCH** (granular) |
|---|---|---|
| Nguyên tắc | Các biến thể cùng nhóm nằm chung 1 TC, liệt kê trong **Bảng biến thể** | 1 biến thể = 1 TC |
| Số TC điển hình (module cỡ Login) | 35–45 | 75–90 |
| Đọc & review / Chạy tay | Nhanh — nhìn 1 TC thấy cả nhóm rủi ro; mở form 1 lần chạy hết biến thể | Chậm — lướt nhiều dòng gần giống nhau; lặp lại setup từng TC |
| Báo cáo khi FAIL | Ghi rõ mã biến thể fail (`CRM_LOGIN_TC_012-c`) | Tự động chỉ đúng TC fail |
| Sang automation | Map thành **test data-driven** (`@DataProvider` · `test.each` · `parametrize`) | Map thành **1 test method / TC** |

**Chỉ chọn `TÁCH` khi:** (1) khách hàng/quy trình yêu cầu mỗi TC là 1 dòng trong Jira/TestRail/Xray (tính công hoặc giao việc theo TC), (2) cần báo cáo pass-rate theo từng biến thể, (3) module kiểm định/audit cần vết thực thi rời, hoặc (4) user yêu cầu rõ. Ngoài ra luôn dùng **`GỘP`**.

### Hai kiểu gộp được phép

1. **Kiểu A — Gộp biến thể dữ liệu (dùng cho validation):** Cùng chuỗi thao tác và **cùng loại phản hồi**, chỉ khác giá trị đầu vào:
   ```markdown
   | CRM_LOGIN_TC_012 | ... | 1. Mở /admin/authentication<br>2. Nhập Email theo biến thể<br>3. Nhập Password `Abc12345`<br>4. Bấm `Login`<br>5. Quan sát ô Email và trạng thái trang | **Mọi biến thể cho cùng kết quả:** trình duyệt hiện cảnh báo ngay cạnh ô Email · trang **không** nạp lại · dữ liệu đã nhập còn nguyên<br><br>`a` Thiếu `@` → `abc`<br>`b` Thiếu tên miền → `abc@`<br>`c` Thiếu phần trước `@` → `@example.com`<br>`d` Nhiều `@` → `a@b@example.com`<br>`e` Chuỗi tiêm SQL → `admin@example.com' OR '1'='1` | High | ... |
   ```
2. **Kiểu B — Gộp kiểm tra tĩnh cùng màn hình (dùng cho TC cấu trúc / hiển thị):** Cùng precondition, **mọi mục đều là quan sát tĩnh không làm đổi trạng thái**:
   ```markdown
   | CRM_LOGIN_TC_002 | REQ-LOGIN-02, REQ-LOGIN-03 | ... | 1. Mở /admin/authentication, KHÔNG nhập gì<br>2. Đối chiếu từng mục trong Bảng kiểm | **Bảng kiểm — mọi mục phải đạt:**<br>`1` (REQ-02) Thấy đủ ô `Email Address`, ô `Password`, ô tích `Remember me`, nút `Login`, liên kết `Forgot Password?`<br>`2` (REQ-02) Gõ vào ô Password hiện dấu chấm che<br>`3` (REQ-03) Con trỏ nhấp nháy sẵn trong ô Email | ... |
   ```

### Bảng CẤM gộp (bất kể độ hạt nào)

| Trường hợp cấm gộp | Lý do |
|---|---|
| **Khác trường nhập liệu** (Email với Password, Ngày với Số tiền) | FAIL không chỉ ra được trường nào hỏng. *Ngoại lệ duy nhất:* TC kiểm độ bền chống sập (HTTP 500) |
| **Khác LOẠI phản hồi** (trình duyệt chặn vs máy chủ báo lỗi; lỗi vs thành công) | Hai cơ chế khác nhau, không phát biểu chung Expected Result được |
| Gộp TC `@Smoke` / `Critical` với TC thuộc **nhóm hành vi khác** | Bộ smoke cần vết thực thi rời. *Được phép:* gộp biến thể của cùng 1 hành vi và ghi rõ biến thể nào thuộc smoke |
| **TC được thiết kế để FAIL** (hệ thống đang có bug so với REQ) | Mỗi TC loại này gắn 1-1 với một bug riêng |
| **Khác `REQ ID` mà mỗi REQ chỉ có đúng TC đó** | Làm mất TC chuyên biệt của REQ. Chỉ gộp khi REQ còn TC khác chống lưng và Bảng kiểm ghi rõ `(REQ-XX)` từng dòng |
| **Khác nhóm chức năng / khác màn hình** | Làm hỏng ranh giới tách `parts/` và ranh giới giao việc |

### Ràng buộc bắt buộc khi dùng `GỘP` & Đổi độ hạt

- Mỗi biến thể có mã riêng (`a`, `b`, `c`…); cột `REQ ID` liệt kê đủ mọi REQ chạm tới (phân cách `,`).
- **Trần tối đa 6 biến thể / TC** — vượt quá 6 phải tách thành TC mới theo nhóm rủi ro.
- **Không được cắt bớt biến thể** khi gộp; bắt buộc đếm và công bố `<N> TC · <M> biến thể` ở Bảng Đối soát 4 vòng và tóm tắt cuối chat.
- **Đổi độ hạt của bộ TC đã có:** Chỉ được làm khi **chưa** có script automation (`allure.label('testId', ...)`), execution report, hoặc RTM trỏ vào (khi đổi thì lưu bản cũ vào `archive/` và đánh lại từ `001`). Nếu đã có liên kết thì **CẤM đổi độ hạt** — muốn gọn để chạy tay thì sinh thêm `CHECKLIST`.

---

## 2. Quy Tắc Đối Chiếu Evidence (6 Quy Tắc Bắt Buộc)

Thứ tự tin cậy khi các nguồn mâu thuẫn: **`DOM thật (đọc trực tiếp) > Ảnh evidence > Tài liệu chữ`**.

1. **Mở toàn bộ evidence trước khi sinh TC:** Liệt kê `docs/requirements/<module>/evidence/` (và module liên quan nếu chạm tới) rồi mở **TỪNG ảnh bằng `Read`**. Chưa mở xong evidence thì chưa được ghi dòng TC đầu tiên.
2. **Xung đột tài liệu ↔ ảnh → ảnh thắng:** Viết TC theo ảnh, ghi dòng `ASM-XX` nêu rõ xung đột kèm tên file ảnh, và báo user ở tóm tắt cuối (hoặc đưa vào Q&A Bước 2 ở FULL RBT).
3. **Evidence thiếu / cắt cụt viewport → gắn `@NeedsVerify`, KHÔNG suy diễn:** Ghi `⚠️ chưa có evidence` trong `Expected Result`, liệt kê ở mục **"Vùng chưa có evidence"** trong index kèm đề xuất recon bổ sung. Cấm khẳng định chắc chắn về thứ tự Tab, vị trí phần tử, nhãn nút, định dạng hiển thị khi ảnh bị cắt.
4. **Bốn nhóm TC BẮT BUỘC có evidence chống lưng:**
   - **Bố cục & thứ tự** (tab order, thứ tự cột, thứ tự field — bố cục 2 cột làm thứ tự Tab khác thứ tự nhìn).
   - **Nhãn nguyên văn** (nút, tiêu đề, thông báo, tooltip).
   - **Giá trị mặc định** (checkbox tick sẵn, option đang chọn, multi-select chọn sẵn, con trỏ focus).
   - **Định dạng hiển thị** (tiền tệ `$1,403.00`, giờ `100:00`, ngày `dd-mm-yyyy`, badge màu, avatar).
5. **Có Playwright MCP → đọc DOM để chốt số liệu chính xác:**
   ```js
   () => {
     const q = s => document.querySelector(s);
     const sel = q('#<select_id>');
     return {
       options: [...sel.options].map(o => ({ v: o.value, text: o.text.trim(), subtext: o.getAttribute('data-subtext') })),
       selectedIndex: sel.selectedIndex,
       selectedValues: [...sel.options].filter(o => o.selected).map(o => o.value),
       checkboxes: [...document.querySelectorAll('<scope> input[type=checkbox]')]
         .map(c => ({ name: c.name, checked: c.checked, disabled: c.disabled })),
       fieldOrder: [...document.querySelectorAll('<form> input:not([type=hidden]), <form> select, <form> textarea')]
         .filter(e => e.offsetParent !== null).map(e => e.id || e.name)
     };
   }
   ```
6. **Phân biệt trạng thái phần tử (`disabled` xám mờ ≠ `không tick`):** Phát hiện phần tử `disabled` trong ảnh chứng tỏ có business rule phụ thuộc → sinh TC cho cả 2 chiều (bật điều kiện → mở khoá; tắt điều kiện → khoá lại) và mở `AMB-XX` nếu tài liệu chưa nêu.

---

## 3. Quy Tắc Ngôn Ngữ Kiểm Chứng (Observable Verification Language)

Agent đọc DOM để **biết sự thật**, nhưng viết manual TC bằng **ngôn ngữ người dùng nhìn thấy trên màn hình** để tester chấm PASS/FAIL bằng mắt thường. Trước mỗi dòng `Expected Result`, tự hỏi: ***"Người dùng thật sẽ thấy điều này bằng cách nào?"***

| ❌ Ngôn ngữ DOM / DevTools (CẤM ở phần TC chính) | ✅ Viết trong Manual TC |
|---|---|
| `document.title` chứa `Dashboard` · `body.className` chứa `user-id-2` | Vào được trang Dashboard, thanh tiêu đề trình duyệt ghi `Dashboard` |
| `input#email.checkValidity()` = `false` | Trình duyệt hiện cảnh báo ngay cạnh ô Email, biểu mẫu **không** gửi đi (trang không nạp lại, dữ liệu đã nhập còn nguyên) |
| Có `input#email[type=email]`, `input#password[type=password]`, `button[type=submit]` | Thấy đủ ô `Email Address`, ô `Password` (gõ vào hiện dấu chấm che), nút `Login` |
| `document.activeElement.id` = `email` | Con trỏ nhấp nháy sẵn trong ô Email, gõ được ngay không cần bấm chuột |
| `offsetParent` = `null`, hộp `0×0` | Không nhìn thấy trên màn hình |
| `POST` trả `303`, header `location: /admin/` | Trang tự chuyển sang Dashboard |
| `5. Đọc mã trạng thái và header location của POST /admin/authentication` | `5. Quan sát trang sau khi bấm Login` |
| `1. Xác nhận $(".started-timers-top").find("li.timer").length > 0` | `1. Xác nhận trên thanh đầu trang đang hiện ít nhất 1 bộ đếm giờ chạy` |

### Xử lý nhóm ẩn (`🔧 Ghi chú kỹ thuật` + `@TechCheck`) & Ngoại lệ

- **Nhóm ẩn** (cookie `autologin`, token CSRF, header HSTS, chuyển hướng HTTP→HTTPS, mã `500` thân rỗng):
  1. **Expected Result chính** vẫn phát biểu **hệ quả nghiệp vụ** quan sát được (VD: đóng trình duyệt mở lại vẫn đang đăng nhập).
  2. Tách phần kỹ thuật xuống dòng riêng mở đầu bằng **`🔧 Ghi chú kỹ thuật (cần DevTools):`** (chỉ ghi hình thái cấu trúc, 🔒 **KHÔNG chép giá trị secret thật**).
  3. Gắn tag **`@TechCheck`**. *Thước đo:* che dòng `🔧 Ghi chú kỹ thuật` đi, TC vẫn phải chạy và chấm được.
- **Ngoại lệ hợp lệ được dùng thuật ngữ kỹ thuật ở TC chính:** (1) `Auto Type = API`, (2) mục Checklist dành riêng cho DevOps/Security, (3) nhãn hiển thị nguyên văn trên màn hình (`Invalid email or password`, nút `Login`), (4) URL đầy đủ trên thanh địa chỉ.
- **Selector CSS/XPath:** Ghi vào `docs/requirements/<module>/requirements_<module>.md` (mục kỹ thuật), tuyệt đối **không** đưa vào manual TC.

---

## 4. Quy Tắc Xuất File, Cấu Trúc Thư Mục & Chia Batch

1. **Write-first — KHÔNG in toàn bộ bảng TC ra chat:** Ghi thẳng vào file sau mỗi batch (`15–25 TC/batch`, chia tuần tự theo vòng `V1 → V2a/V2b → V3 → V4`, không trộn 2 vòng vào 1 batch, chạy thẳng hết các batch không dừng hỏi giữa chừng). Trước khi sinh, công bố kế hoạch batch kèm độ hạt:
   ```text
   Kế hoạch: 5 batch · ~46 TC · 1 file · độ hạt GỘP (mặc định)
   V1 Smoke        (≈9 TC)   — UI cơ bản, mở form, hiển thị, nhập hợp lệ, lưu, đối chiếu
   V2a Validation  (≈14 TC)  — required + 15 loại field
   V2b CRUD & luồng(≈11 TC)  — sửa, xoá, phụ thuộc, đoán lỗi
   V3 Technical    (≈8 TC)   — phân quyền, bảo mật cơ bản  [@TechCheck]
   V4 Non-func     (≈4 TC)   — responsive, bàn phím
   ```
2. **Cấu trúc thư mục & Ngưỡng tách file:**
   - Kiểm tra `docs/testcases/README.md` trước batch đầu tiên — chưa có thì tạo ngay bảng danh mục rỗng; sinh xong cập nhật số TC, số part, prefix TC ID đã chiếm, độ phủ REQ↔TC.
   - Tên index bất biến: `docs/testcases/<module>/test_cases_<module>.md` (không thêm `_v2`, `_new`).
   - **Ngưỡng tách:** `≤ 40 TC` ở độ hạt `TÁCH` hoặc `≤ 50 TC` ở độ hạt `GỘP` → giữ 1 file `test_cases_<module>.md`. Vượt ngưỡng → tách vào `parts/part_01_<slug>.md`, `part_02_<slug>.md` (cắt tại ranh giới nhóm chức năng). Khi có `≥ 2 part`, `test_cases_<module>.md` trở thành **file index** chứa Bản đồ tài liệu (`File | Nhóm chức năng | Số TC | TC ID range | REQ bao phủ`) và Bảng Đối Soát Coverage toàn module; mỗi part có link ngược về index và part liền kề.
   - Tổng TC dự kiến `> 30` hoặc `≥ 2 module` → tạo/cập nhật `task.md` (hoặc task list) sau mỗi batch.
3. **Quy tắc trình bày Test Steps & Test Data:**
   - Mỗi bước 1 hành động, đánh số `1. 2. 3.`, xuống dòng bằng `<br>` trong ô bảng; `Expected Result` đánh số khớp 1-1 với step có kết quả quan sát được.
   - Test Data bắt buộc cụ thể (`KH-2026-0012`, `test_khachhang_01@domain.com`, `256 ký tự (max: 255)`), cấm viết placeholder chung chung.

---

## 5. Mode 1: QUICK — Quy Trình Sinh Nhanh (1 Lượt Duy Nhất)

1. **Chốt độ hạt `GỘP` / `TÁCH`** (mặc định `GỘP`) và **đọc requirements** (giữ nguyên `REQ ID` nếu đã có; chưa có thì tự gán `REQ-<MODULE>-<SỐ>`). Nếu phát hiện requirements quá phức tạp/mơ hồ hoặc `> 3 modules` → đề xuất chuyển sang **Mode FULL RBT**.
2. **Mở 100% ảnh trong `docs/requirements/<module>/evidence/`** bằng `Read` (theo mục 2).
3. **Ghi nhận Assumptions (`ASM-XX`):** QUICK không dừng hỏi Q&A; mọi điểm mơ hồ hoặc xung đột tài liệu ↔ ảnh phải xuất ở bảng `ASM-XX | Điểm chưa rõ | Giả định đã áp dụng | TC bị ảnh hưởng` ngay đầu tài liệu.
4. **Chấm Risk Level (`Cao`/`Trung bình`/`Thấp`), chọn độ sâu (`Đầy đủ`/`Tiêu chuẩn`/`Tối giản`) và lập kế hoạch 4 vòng** theo [`FOUR_RINGS_AND_QUALITY_GATE.md`](FOUR_RINGS_AND_QUALITY_GATE.md). Công bố kế hoạch batch ra chat.
5. **Sinh TC tuần tự `V1 → V2 → V3 → V4`** (V1 luôn mở đầu bằng nhánh `UI cơ bản`):
   - Áp dụng kỹ thuật thiết kế trong [`DESIGN_TECHNIQUES.md`](DESIGN_TECHNIQUES.md) (EP, BVA, Decision Table khi ≥3 điều kiện, State Transition khi ≥3 trạng thái).
   - Đối soát từng input field với [`FIELD_VALIDATION_15_TYPES.md`](FIELD_VALIDATION_15_TYPES.md) (không gộp khác trường).
   - Đối soát [`COMPONENT_CHECKLIST.md`](COMPONENT_CHECKLIST.md) và các kịch bản chuyên sâu trong [`ISO_25010_CHECKLIST.md`](ISO_25010_CHECKLIST.md) (Race condition/Double submit, Session/Network, UTF-8/Emoji, Keyboard A11y, HTTP Status Codes).
6. **Ghi vào bảng Markdown 13 cột chuẩn** theo từng batch (Write-first).
7. **Chạy đủ 11 tiêu chí AI Self-Quality Gate (0–10)** trong [`FOUR_RINGS_AND_QUALITY_GATE.md`](FOUR_RINGS_AND_QUALITY_GATE.md), xuất kèm **Bảng Đối Soát Coverage**, **Bảng Đối Soát Evidence**, **Bảng Đối soát loại kiểm thử (4 vòng)**, **Bảng rà soát đặc tính chất lượng (ISO/IEC 25010:2023)**, và cập nhật `docs/testcases/README.md`.

---

## 6. Mode 2: FULL RBT — Quy Trình AI-RBT 6 Bước Tuần Tự

> ⚠️ **BẮT BUỘC chạy tuần tự từng bước.** Có 2 điểm dừng HITL bắt buộc chờ user phản hồi ở **Bước 2 (Q&A)** và **Bước 4 (Review Scenarios & 4 Vòng)** (cộng xác nhận bối cảnh ở Bước 1 nếu user chưa cung cấp đủ thông tin). Trong Bước 5, chạy thẳng hết các batch không dừng giữa chừng.

### Bước 1: Context & Role-play (Khởi tạo ngữ cảnh)
1. Thu thập tên dự án, mô tả hệ thống, mục tiêu MVP, tài liệu yêu cầu.
2. **Chốt độ hạt `GỘP` (mặc định) / `TÁCH`** kèm ước tính số TC để user xác nhận ngay từ đầu.
3. Mở 100% ảnh trong `docs/requirements/<module>/evidence/` bằng `Read`.
4. **Output Bước 1:** Xác nhận bối cảnh + tóm tắt scope + độ hạt + **Danh mục Evidence đã mở** (ảnh đủ / cắt cụt / thiếu). Chờ user xác nhận nếu cần bổ sung đầu vào.

### Bước 2: Analysis & QnA (Phân tích yêu cầu) — ⏸️ HITL CHECKPOINT 1
1. Xác định Happy Path, Alternate Paths, Exception Paths.
2. Phát hiện Ambiguities (thiếu sót, mâu thuẫn, chưa rõ ràng, và **xung đột giữa tài liệu chữ và ảnh evidence**).
3. Đặt câu hỏi Q&A đánh số (`Q1`, `Q2`...) kèm ngữ cảnh và giả định mặc định (assumption) nếu không được trả lời.
4. **⏸️ DỪNG LẠI — Chờ user trả lời Q&A** trước khi sang Bước 3.

### Bước 3: Decomposition (Phân rã hệ thống)
1. Chia tính năng thành các Module / Sub-module (theo UI hoặc theo luồng nghiệp vụ).
2. Mô tả chức năng từng Module và chỉ ra Dependencies giữa chúng.

### Bước 4: Traceability (Đảm bảo độ bao phủ) — ⏸️ HITL CHECKPOINT 2
1. Map mỗi Module/Rule với mã `REQ ID` (`REQ-01`, `REQ-02`...) và thực hiện Gap Analysis.
2. Chấm **Risk Level** (`Cao` / `Trung bình` / `Thấp`) và **độ sâu tương ứng** (`Đầy đủ` / `Tiêu chuẩn` / `Tối giản`) theo [`FOUR_RINGS_AND_QUALITY_GATE.md`](FOUR_RINGS_AND_QUALITY_GATE.md).
3. Liệt kê High-Level Test Scenarios cho từng Module **xếp theo 4 vòng (`V1 Smoke` → `V2 Functional` → `V3 Technical` → `V4 Non-functional`)**, chấm sơ bộ từng nhánh `✅ sẽ sinh` / `➖ không áp dụng (kèm lý do kỹ thuật + ai chịu)` / `⏭️ cố ý bỏ (kèm lý do + ai quyết + điều kiện rà lại)`.
4. **⏸️ DỪNG LẠI — Chờ user review** Traceability Matrix và bảng 4 vòng trước khi sinh TC chi tiết.

### Bước 5: RBT & TC Generation (Sinh Test Case chi tiết)
1. Công bố kế hoạch batch theo vòng (`15–25 TC/batch`, mỗi batch nằm trọn trong 1 vòng).
2. Sinh TC tuần tự `V1 → V2 → V3 → V4` (mở đầu bằng `V1 · UI cơ bản`), áp dụng [`DESIGN_TECHNIQUES.md`](DESIGN_TECHNIQUES.md), [`FIELD_VALIDATION_15_TYPES.md`](FIELD_VALIDATION_15_TYPES.md), [`COMPONENT_CHECKLIST.md`](COMPONENT_CHECKLIST.md), và [`ISO_25010_CHECKLIST.md`](ISO_25010_CHECKLIST.md).
3. Ghi thẳng vào file theo từng batch (Write-first), báo 1 dòng tiến độ/batch, chạy thẳng hết các batch của module.

### Bước 6: Template Mapping & Self-Quality Gate
1. Chuẩn hóa toàn bộ TC vào bảng Markdown 13 cột chuẩn trong `docs/testcases/<module>/test_cases_<module>.md` (hoặc tách `parts/part_NN_<slug>.md` nếu vượt ngưỡng `>40 TÁCH` / `>50 GỘP`), không bỏ sót bất kỳ TC nào đã sinh ở Bước 5.
2. Chạy đủ **11 tiêu chí AI Self-Quality Gate (0–10)** theo [`FOUR_RINGS_AND_QUALITY_GATE.md`](FOUR_RINGS_AND_QUALITY_GATE.md), xuất đủ 4 bảng đối soát ở cuối tài liệu (Coverage, Evidence, 4 Vòng, ISO 25010) và cập nhật `docs/testcases/README.md`.
