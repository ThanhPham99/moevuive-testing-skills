# Bản Đồ Loại Kiểm Thử 4 Vòng, Độ Sâu Theo Rủi Ro & AI Self-Quality Gate

> **Mục đích:** Quy định khung tác nghiệp 4 vòng kiểm thử (`V1 Smoke → V2 Functional → V3 Technical → V4 Non-functional`), ma trận chấm mức rủi ro để chọn độ sâu kiểm thử, và 11 tiêu chí tự kiểm định chất lượng (AI Self-Quality Gate) trước khi xuất tài liệu Test Case.
> **Áp dụng cho:** Mode `QUICK`, Mode `FULL RBT`, và Mode `DELTA` (nhánh bị chạm).

---

## 1. Bản Đồ Loại Kiểm Thử — 4 Vòng (Khung Sinh TC Bắt Buộc)

> Hai bảng checklist tham chiếu ([`FIELD_VALIDATION_15_TYPES.md`](FIELD_VALIDATION_15_TYPES.md) · [`COMPONENT_CHECKLIST.md`](COMPONENT_CHECKLIST.md)) trả lời *"trường này / thành phần này phải test gì"*. Bảng 4 vòng trả lời câu hỏi **khác hẳn**: ***"bộ TC đã đi qua đủ các LOẠI kiểm thử chưa, và theo thứ tự nào"*** — chống bỏ sót nguyên một lớp test (đặc biệt là lớp giao diện ở Vòng 1).
>
> **Phân biệt với [`ISO_25010_CHECKLIST.md`](ISO_25010_CHECKLIST.md):** 4 vòng là **khung tác nghiệp lúc sinh** — chia batch, đặt thứ tự, chấm thiếu-đủ theo nhánh. ISO 25010 là **khung rà soát lúc xuất** — đặc tính nào ngoài phạm vi, ai chịu trách nhiệm, nuôi mục 2.2 của Master Test Plan. Chạy **cả hai**, không khung nào thay thế khung nào.

### Thứ tự bắt buộc

```text
VÒNG 1 – SMOKE            → màn hình dựng được, luồng sống còn không vỡ
VÒNG 2 – FUNCTIONAL       → phần thân của mọi bộ TC (~60–70% số TC)
VÒNG 3 – TECHNICAL        → phần lớn cần DevTools/DB → tag @TechCheck
VÒNG 4 – NON-FUNCTIONAL   → phần lớn chấm ➖ ở app nghiệp vụ thường
```

Sinh **tuần tự V1 → V4**, không nhảy cóc. Vòng 1 fail thì **mọi TC Vòng 2 đều BLOCKED** — phát hiện trong 10 phút đầu để dừng thay vì chạy hết 40 TC rồi mới biết form không mở được.

### VÒNG 1 — SMOKE

| Nhánh | Kích hoạt khi | TC phải có | Trỏ về |
|---|---|---|---|
| **UI cơ bản** | **Luôn luôn** | Màn hình hiển thị **đủ** thành phần theo evidence: nhãn nguyên văn, thứ tự field, nút, liên kết, tiêu đề. Trạng thái mặc định từng ô (rỗng / tick sẵn / option đang chọn / con trỏ đang ở đâu) | Gộp **Kiểu B** · 4 nhóm evidence bắt buộc |
| **Open form** | Có form / modal / trang con | Mở được bằng **mọi lối vào** (nút, menu, URL trực tiếp) · đóng được bằng X / Cancel / ESC / click ra ngoài | [`COMPONENT_CHECKLIST.md`](COMPONENT_CHECKLIST.md) → Modal/Dialog |
| **Display** | Có dữ liệu hiển thị | Định dạng hiển thị đúng (tiền tệ, ngày, giờ, badge, avatar) · trạng thái rỗng · trạng thái đang tải | 4 nhóm evidence bắt buộc |
| **Input valid data** | Có form nhập | Bộ dữ liệu hợp lệ **tối thiểu** (chỉ field bắt buộc) và bộ **đầy đủ** (mọi field) | Quy tắc Test Data |
| **Save** | Có hành động lưu | Lưu thành công → thông báo đúng → điều hướng đúng | [`COMPONENT_CHECKLIST.md`](COMPONENT_CHECKLIST.md) → CRUD |
| **Verify data** | Có lưu | Dữ liệu vừa lưu hiện đúng ở **danh sách** *và* ở **màn hình chi tiết** | [`COMPONENT_CHECKLIST.md`](COMPONENT_CHECKLIST.md) → CRUD |

> 🚨 **Nhánh `UI cơ bản` là chỗ bị bỏ sót nhiều nhất.** Bộ TC không có TC nào kiểm nhãn / thứ tự / trạng thái mặc định của màn hình là **thiếu hẳn một lớp**, dù phần validation đầy đủ đến đâu. Nhánh này **KHÔNG BAO GIỜ** được chấm `➖` hay `⏭️`.

### VÒNG 2 — FUNCTIONAL

| Nhánh | Kích hoạt khi | TC phải có | Trỏ về |
|---|---|---|---|
| **UI Behavior** | Có tương tác làm đổi giao diện | Field bật/tắt theo lựa chọn khác · nút khoá đến khi đủ điều kiện · bộ đếm ký tự · gợi ý autocomplete · nút hiện/ẩn mật khẩu | Quy Tắc Đối Chiếu Evidence mục 6 (`disabled` ≠ không tick) |
| **Required** | Có field bắt buộc | Bỏ trống **TỪNG** field bắt buộc → thông báo trỏ đúng field đó · bỏ trống tất cả | [`FIELD_VALIDATION_15_TYPES.md`](FIELD_VALIDATION_15_TYPES.md) |
| **Validation** | Mọi field có ràng buộc | Đối soát **đủ từng mục** của loại field tương ứng trong bảng 15 loại — mục bỏ qua phải ghi lý do | [`FIELD_VALIDATION_15_TYPES.md`](FIELD_VALIDATION_15_TYPES.md) |
| **Equivalence Partitioning** | Field có miền giá trị phân nhóm được | Mỗi partition ≥1 TC | [`DESIGN_TECHNIQUES.md`](DESIGN_TECHNIQUES.md) |
| **Boundary Value Analysis** | Field có min/max | `min-1` · `min` · `max` · `max+1` | [`DESIGN_TECHNIQUES.md`](DESIGN_TECHNIQUES.md) |
| **Business Rule** | Có quy tắc nghiệp vụ | Mỗi rule ≥1 TC tuân thủ + ≥1 TC vi phạm (verify bị chặn) | [`DESIGN_TECHNIQUES.md`](DESIGN_TECHNIQUES.md) |
| **Decision Table** | ≥3 điều kiện kết hợp → 1 output | Mỗi rule (cột) = 1 TC | [`DESIGN_TECHNIQUES.md`](DESIGN_TECHNIQUES.md) |
| **State Transition** | Entity có ≥3 trạng thái | Mọi transition hợp lệ + mọi transition **bị chặn** | [`DESIGN_TECHNIQUES.md`](DESIGN_TECHNIQUES.md) · [`COMPONENT_CHECKLIST.md`](COMPONENT_CHECKLIST.md) |
| **Dependency** | Field / màn hình phụ thuộc nhau | Đổi A → B đổi theo · xoá A đang được B tham chiếu · A rỗng thì B khoá | [`COMPONENT_CHECKLIST.md`](COMPONENT_CHECKLIST.md) → CRUD (khoá ngoại) |
| **Use Case / Scenario** | Có luồng nghiệp vụ nhiều bước | Chuỗi end-to-end **trong phạm vi module** (tạo → sửa → đổi trạng thái → tìm lại) | — |
| **Save / Edit / Delete** | Có CRUD | Toàn bộ CRUD Lifecycle, gồm huỷ giữa chừng và xoá bản ghi đang được liên kết | [`COMPONENT_CHECKLIST.md`](COMPONENT_CHECKLIST.md) → CRUD |
| **Error Guessing** | **Luôn luôn** | Bấm Lưu hai lần liên tiếp · dán dữ liệu lạ · bấm Back sau khi lưu · nạp lại trang giữa chừng · mở 2 tab cùng sửa | [`ISO_25010_CHECKLIST.md`](ISO_25010_CHECKLIST.md) mục 3 |

> `Positive` / `Negative` **KHÔNG phải nhánh riêng** — chúng là thuộc tính của mọi nhánh bên trên. Chấm ở mức bộ TC (Gate #4), không tạo batch riêng hay dòng riêng trong bảng đối soát.

### VÒNG 3 — TECHNICAL

> ⚠️ Đa số nhánh vòng này **không kiểm được bằng mắt** → nội dung phải nằm dưới `🔧 Ghi chú kỹ thuật (cần DevTools):` và TC mang tag `@TechCheck` theo Quy Tắc Ngôn Ngữ Kiểm Chứng. Viết mã HTTP / câu SQL / tên bảng vào phần TC chính là **vi phạm Gate #8**.
>
> 🔑 **Bốn nhánh `API` · `Database` · `Integration` · `Logging/Audit` là thuộc tính CẤP DỰ ÁN, không phải cấp module:**
> 1. **Đọc `docs/requirements/README.md`** → bảng thuộc tính ở đầu file, dòng **`Năng lực kiểm thử của QA`**. Có sẵn thì **dùng luôn, KHÔNG hỏi lại** — chép nguyên lý do và người chịu trách nhiệm vào bảng đối soát 4 vòng.
> 2. Chưa có dòng đó → hỏi user **đúng một lần**, rồi **ghi ngay vào `docs/requirements/README.md`** trước khi sinh dòng TC đầu tiên.
> 3. Trả lời của user có thể kiểm chứng được thì kiểm luôn (mở trang nhật ký hoạt động, thử gọi API đọc) và ghi **kết quả đo kèm ngày** vào `docs/requirements/README.md`:
>
> ```markdown
> | **Năng lực kiểm thử của QA** | Chốt <ngày> — dùng cho nhánh Vòng 3 của **mọi** bộ TC:<br>• Gọi API: ❌/✅ + ai chịu nếu ❌<br>• Truy vấn CSDL: ❌/✅ + ai chịu<br>• Kiểm tầng tích hợp: ❌/✅ + ai chịu<br>• Xem nhật ký hoạt động: ❌/✅ + đường dẫn đã thử + kết quả đo<br>• DevTools trình duyệt: ❌/✅ |
> ```

| Nhánh | Kích hoạt khi | TC phải có | Mặc định nếu không áp dụng |
|---|---|---|---|
| **Permission** | Có ≥2 role | Ma trận Phân quyền: mỗi role × mỗi hành động · truy cập URL trực tiếp khi không đủ quyền · phần tử ẩn/khoá đúng theo role | 🚫 **Không được `➖`** khi hệ thống có ≥2 role |
| **Security** | Luôn (mức cơ bản) | Truy cập khi chưa đăng nhập · dữ liệu người này có lộ sang người kia không · XSS/SQLi ở field text · phiên sau khi đăng xuất · nút Back sau đăng xuất | `➖` chỉ khi có đội security riêng — **bắt buộc ghi tên đội** |
| **API** | QA được phép gọi API | Mã trạng thái theo từng thao tác · gọi thẳng API bỏ qua UI · gọi thiếu/sai token | `➖` ghi *"QA không có quyền gọi API"* |
| **Database** | QA được phép truy vấn DB | Dữ liệu lưu đúng bảng/đúng kiểu · xoá mềm hay xoá cứng · dữ liệu rác còn lại sau khi huỷ giữa chừng | `➖` ghi *"không có quyền truy cập DB — đội Dev xác minh"* |
| **Integration** | Có tích hợp bên thứ ba | Bên thứ ba trả lỗi / quá hạn chờ / không phản hồi → app xử lý ra sao | `➖` ghi rõ hệ thống nào không kiểm |
| **Logging / Audit** | Có yêu cầu nhật ký thao tác | Thao tác quan trọng có ghi nhật ký (ai · lúc nào · đổi gì) · nhật ký không lộ dữ liệu nhạy cảm | `➖` ghi *"requirements không có yêu cầu audit"* |

### VÒNG 4 — NON-FUNCTIONAL & REGRESSION

> Ở app nghiệp vụ thông thường, phần lớn vòng này chấm `➖` là ĐÚNG, nhưng `➖` phải **ghi ai chịu trách nhiệm** để làm nguồn cho mục **2.2 Ngoài phạm vi** của `/generate-master-test-plan`.

| Nhánh | Kích hoạt khi | TC phải có | Ghi chú |
|---|---|---|---|
| **Compatibility** | Có cam kết đa trình duyệt | Danh sách trình duyệt/phiên bản **đã chốt** × luồng chính | Ghi rõ trình duyệt nào **không** kiểm |
| **Responsive / UI Stability** | App có bản web đáp ứng | Các breakpoint **đã chốt** (VD 1920 · 1366 · 768 · 375) · không tràn ngang · không đè chữ · phóng to 125% | Phải chốt danh sách breakpoint — cấm ghi *"mọi kích thước màn hình"* |
| **Accessibility** | Luôn (mức cơ bản) | Tab theo thứ tự hợp lý · Enter/Space kích hoạt · viền focus nhìn thấy được · ảnh có văn bản thay thế | WCAG đầy đủ cần công cụ riêng → phần đó `➖` |
| **Performance** | Có ngưỡng thời gian đã cam kết | Chỉ mức quan sát thô: trang tải quá lâu · danh sách lớn bị treo | Đo tải thật → `➖`, ghi đội hiệu năng |
| **Regression** | Module đã từng có bug được đóng | Mỗi bug đã đóng = 1 TC chống tái phát, **trỏ về mã bug** | Nguồn: `docs/bugs/<module>/` |
| **E2E** | Luồng đi qua ≥2 module | Kịch bản xuyên module, dữ liệu chảy từ module này sang module kia | Luồng phức tạp → chuyển sang `/generate-cross-module-test-plan` |

---

## 2. Độ Sâu Theo Rủi Ro (Risk-Depth Matrix)

### Chấm mức rủi ro — agent tự chấm, KHÔNG hỏi user

| Mức | Điều kiện | Cách chấm |
|---|---|---|
| **Cao** | Chỉ cần **MỘT** dấu hiệu: đụng tiền hoặc số liệu tài chính · đụng xác thực/phân quyền · đụng dữ liệu cá nhân khách hàng · có thao tác **không hồi lại được** (xoá cứng, gửi mail ra ngoài, chốt sổ) · là **cổng vào** module khác (hỏng thì chặn cả đợt kiểm thử) | Đủ 1 dấu hiệu là Cao, không cần cân nhắc thêm |
| **Thấp** | Phải đủ **CẢ BỐN**: chỉ hiển thị, không ghi dữ liệu · không có field nhập (hoặc chỉ có ô tìm kiếm) · hỏng thì không ai mất dữ liệu và không chặn việc gì · sửa lại được trong vài phút, không cần triển khai lại | Thiếu một điều kiện là **không** được chấm Thấp |
| **Trung bình** | Phần còn lại | Mặc định khi lưỡng lự |

> 🚨 **Lưỡng lự thì chấm mức CAO HƠN.** Agent tự chấm và ghi căn cứ; user phủ quyết ở **checkpoint Bước 4** (FULL RBT) hoặc ở dòng kế hoạch batch (QUICK).

### Ba mức độ sâu

| Vòng / Chỉ tiêu | **Đầy đủ** (rủi ro Cao) | **Tiêu chuẩn** (Trung bình) | **Tối giản** (Thấp) |
|---|---|---|---|
| **V1 Smoke** | Đủ 6 nhánh | Đủ 6 nhánh | **Đủ 6 nhánh — KHÔNG rút** |
| **V2 Functional** | Đủ mọi nhánh có điều kiện kích hoạt | Đủ mọi nhánh có điều kiện kích hoạt | Chỉ `Required` · `Validation` của field **có ràng buộc thật**; phần còn lại `⏭️` |
| **V3 Technical** | Đủ 6 nhánh | `Permission` + `Security`; còn lại theo Năng lực kiểm thử của QA | `Permission` (nếu ≥2 role); còn lại `⏭️` |
| **V4 Non-functional** | Đủ 6 nhánh | `Responsive` + `Accessibility`; còn lại `⏭️` | Toàn bộ `⏭️` |
| **Số TC điển hình** (`GỘP`, module cỡ Login) | 40–60 | 20–30 | 8–12 |

### Bốn nhánh KHÔNG BAO GIỜ rút (bất kể rủi ro thấp đến đâu)

| Không rút | Vì sao |
|---|---|
| **Toàn bộ V1** | Bỏ V1 thì không biết chức năng **có chạy được không**. Sáu TC là cái giá rẻ nhất để biết điều đó |
| `V2 · Required` + `V2 · Validation` khi **có field nhập** | Có ô nhập là có người nhập sai. Trang "chỉ hiển thị" mà có ô nhập thì không còn là "chỉ hiển thị" — chấm lại mức rủi ro |
| `V3 · Permission` khi hệ thống có **≥2 vai trò** | Lỗi phân quyền không tỷ lệ với độ quan trọng của chức năng: trang xem báo cáo vẫn có thể lộ dữ liệu cả công ty |
| `V3 · Security` khi chức năng chạm **dữ liệu của người dùng khác** | Cùng lý do trên |

### Bốn trạng thái đối soát (`✅` · `➖` · `⏭️` · `🔴`)

| Ký hiệu | Nghĩa | Bắt buộc ghi kèm |
|---|---|---|
| `✅` | Có TC | TC ID (kèm số biến thể nếu `GỘP`: `TC_001–TC_003 (3 TC · 11 biến thể)`) |
| `➖` | **Không áp dụng** — sự thật kỹ thuật là module không có thứ đó để kiểm | Lý do kỹ thuật (+ đơn vị chịu trách nhiệm nếu ở V3/V4) |
| `⏭️` | **Cố ý bỏ** — có thứ đó, kiểm được, nhưng quyết định không kiểm vì rủi ro thấp | **Lý do + ai quyết định (kèm ngày) + điều kiện rà lại** |
| `🔴` | Thiếu — phải bổ sung trước khi xuất | — |

> 🚨 **`➖` và `⏭️` KHÔNG được dùng lẫn.** Ghi `➖` cho thứ thật ra là `⏭️` là **giấu quyết định chấp nhận rủi ro**.
> Mẫu dòng `⏭️` đạt chuẩn:
> `| 4 | Compatibility | ⏭️ Cố ý bỏ | Trang tĩnh, rủi ro Thấp — chỉ kiểm Chrome. **Quyết định: QA lead, 2026-09-11.** Rà lại khi trang có thêm field nhập hoặc cam kết trình duyệt mới |`

### Ghi mức độ sâu ở đầu tài liệu TC & Bảng xuất cuối tài liệu

Ngay dưới tiêu đề bộ TC, bắt buộc ghi:

```markdown
| **Mức rủi ro · độ sâu** | `Thấp` → **Tối giản** — V1 đủ 6 nhánh, V2 chỉ nhánh có ràng buộc, V3/V4 phần lớn `⏭️`.<br>Căn cứ chấm Thấp: chỉ hiển thị · không ghi dữ liệu · không có field nhập · hỏng không chặn việc gì.<br>**Nâng lên Tiêu chuẩn khi:** thêm bất kỳ field nhập nào, hoặc chức năng bắt đầu ghi dữ liệu |
```

Cuối tài liệu TC (**trước** bảng ISO 25010), xuất bảng:

```markdown
## Đối soát loại kiểm thử (4 vòng)

| Vòng | Nhánh | Trạng thái | TC ID / Lý do |
|---|---|---|---|
| 1 | UI cơ bản | ✅ | TC_001–TC_003 (3 TC · 11 biến thể) |
| 1 | Open form · Display | ✅ | TC_004–TC_006 |
| 1 | Input valid · Save · Verify | ✅ | TC_007–TC_009 |
| 2 | Required | ✅ | TC_010–TC_012 |
| 2 | Validation | ✅ | TC_013–TC_028 (16 TC · 61 biến thể · đủ 9/9 mục bảng Password) |
| 2 | Error Guessing | 🔴 Thiếu | Chưa có TC bấm Lưu hai lần liên tiếp → **bổ sung trước khi xuất** |
| 3 | Permission | ✅ | TC_040–TC_047 (3 role × 3 hành động) |
| 3 | Database | ➖ | QA không có quyền truy cập DB — đội Dev xác minh |
| 4 | Responsive | ✅ | TC_050–TC_052 (1920 · 1366 · 768) |
| 4 | Performance | ➖ | Không có công cụ tải — đội Hạ tầng, đợt sau |
| 4 | Regression | ➖ | Module mới, chưa có bug nào được đóng |
```

---

## 3. 🛡️ AI Self-Quality Gate (11 Tiêu Chí, 0–10)

Trước khi xuất kết quả cuối cùng, Agent **BẮT BUỘC** tự rà soát đủ 11 tiêu chí:

- [ ] **0. Độ hạt nhất quán:** Đã chốt `GỘP` hay `TÁCH` **trước** batch đầu và nêu ra chat. Toàn bộ bộ TC theo **một** độ hạt. Nếu `GỘP`: mọi biến thể có mã riêng (`a`, `b`…), không TC nào quá 6 biến thể, không vi phạm bảng CẤM gộp.
- [ ] **1. Unique TC ID:** Không trùng mã TC ID và đúng quy tắc dự án (`PROJECT_MODULE_TC_001`).
- [ ] **2. 1-to-1 Step-Expected Matching:** `Test Steps` đánh số rõ ràng (`1. 2. 3.` — mỗi bước 1 hành động, dùng `<br>` trong cell) và khớp 1-1 với `Expected Result` đánh số tương ứng.
- [ ] **3. Concrete Test Data:** 100% test data chứa giá trị cụ thể, không còn từ ngữ mơ hồ ("hợp lệ", "dữ liệu đúng").
- [ ] **4. Field Validation Coverage (đối soát theo BẢNG, không đếm theo số):** Với **TỪNG** input field, mở đúng dòng trong [`FIELD_VALIDATION_15_TYPES.md`](FIELD_VALIDATION_15_TYPES.md) và đối soát **đủ từng mục** (`≥1 Positive + 2 Negative` chỉ là sàn tối thiểu, không phải mức đạt). Ghi `đủ N/N mục bảng <loại field>` ở dòng `V2 · Validation`.
- [ ] **5. Automation Metadata Ready:** 100% test cases gắn đầy đủ `Automatable`, `Auto Type`, và `Tags`.
- [ ] **6. Requirement Coverage:** 100% `REQ ID` có **≥1 TC** trỏ về; REQ mức High Risk có đủ Positive + Negative + Boundary. Không được xuất kết quả còn dòng `🔴`. Xuất kèm **Bảng Đối Soát Coverage**:
  ```markdown
  | REQ ID | Mô tả ngắn | Số TC | TC IDs | Đủ Positive/Negative/Boundary? |
  |---|---|---|---|---|
  | REQ-LOGIN-01 | Đăng nhập email | 5 | TC_001..TC_005 | ✅ |
  | REQ-LOGIN-02 | Khóa sau 5 lần sai | 0 | — | 🔴 THIẾU — phải bổ sung trước khi xuất |
  ```
- [ ] **7. Evidence-verified:** Đã mở **100%** ảnh trong `docs/requirements/<module>/evidence/`; mọi TC thuộc 4 nhóm bắt buộc (bố cục/thứ tự · nhãn nguyên văn · giá trị mặc định · định dạng hiển thị) đều truy được về ảnh hoặc lần đọc DOM cụ thể. Vùng thiếu/cắt cụt → gắn `@NeedsVerify` và liệt kê ở mục "Vùng chưa có evidence". Xuất kèm **Bảng Đối Soát Evidence**:
  ```markdown
  | Ảnh evidence | Màn hình / trạng thái | TC dựa vào | Đầy đủ? |
  |---|---|---|---|
  | project_new_form_default_fullpage.png | Form tạo — mặc định | TC_041→050 | ✅ full-page |
  | project_new_form_1920x1080.png | Form tạo — mặc định | TC_092→095 | 🔴 CẮT CỤT tại "Description" — thiếu editor, checkbox email, nút Save |
  | (không có) | Form tạo — dropdown Customer đang mở | TC_060→063 | 🔴 THIẾU — TC gắn @NeedsVerify |
  ```
- [ ] **8. Ngôn ngữ kiểm chứng:** Grep toàn file, phần TC chính **không còn** `document.`, `querySelector`, `checkValidity`, `offsetParent`, `className`, `getAttribute`, `$(`, `input#`, `[type=`, mã HTTP, tên header, selector CSS/XPath (trừ `Auto Type = API`). Nội dung kỹ thuật nằm dưới `🔧 Ghi chú kỹ thuật (cần DevTools):` kèm `@TechCheck`. Che dòng `🔧 Ghi chú kỹ thuật` đi thì mọi TC vẫn chạy và chấm PASS/FAIL được.
- [ ] **9. Rà soát đặc tính chất lượng (ISO/IEC 25010:2023):** Đã chấm đủ **9/9 đặc tính** theo [`ISO_25010_CHECKLIST.md`](ISO_25010_CHECKLIST.md), không ô nào trống. Ô `➖` ghi rõ **ai chịu trách nhiệm**; ô `🔴` phải bổ sung TC trước khi xuất. (Với `DELTA`: chỉ chấm lại đặc tính bị ticket chạm tới).
- [ ] **10. Đối soát loại kiểm thử 4 vòng:** Mọi nhánh của cả 4 vòng được chấm (`✅`/`➖`/`⏭️`/`🔴`), không dùng lẫn `➖` và `⏭️`, 3 nhánh (`UI cơ bản`, `Validation` khi có field nhập, `Permission` khi ≥2 role) không bao giờ `➖`/`⏭️`, độ hạt `GỘP` ghi cả số TC và số biến thể, đầu tài liệu có dòng mức rủi ro · độ sâu kèm **"Nâng lên khi…"**. (Với `DELTA`: chỉ chấm lại nhánh bị ticket chạm tới).
