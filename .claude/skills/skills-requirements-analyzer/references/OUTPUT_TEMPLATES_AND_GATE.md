# Khuôn Mẫu Tài Liệu Đầu Ra, Cổng Tự Soát REQ 10 Điểm, Quy Tắc Tách File & Impact Report

Tài liệu tham chiếu cho **Cổng Tự Soát REQ 10 điểm** (mục 4.3), **Quy tắc quy mô & tách file** (mục 5), **Cấu trúc đầu ra `requirements_<module>.md`** (mục 6), và **Cập nhật Delta & Impact Report** (`/update-requirements-from-ticket`).

---

## 1. Framework Phát Hiện Ambiguity & Risk (Mục 4.1 & 4.2)

- **Ambiguity (`AMB-XX`):** Ghi đủ: `Mã | Câu hỏi | Nguy cơ | Mức độ (🔴 High / 🟡 Medium / 🟢 Low) | Assumption tạm | Trạng thái (❓ / ✅ / ⏭️) | Kết luận`.
  - **7 hướng phát hiện:** (1) Từ khóa mơ hồ (*"where applicable"*, *"hợp lý"*, *"như module cũ"*) · (2) Thiếu validation (`min`/`max`, format, required, default) · (3) Hành vi edge case chưa quy định (lỗi mạng, concurrent access, data rỗng, timeout) · (4) Lệch pha giữa tài liệu và mockup/UI · (5) Ngưỡng/config chưa xác định · (6) Phân quyền chưa rõ role nào được làm · (7) Chuyển trạng thái chưa rõ.
- **Risk (`RISK-XX`):** Ghi đủ: `Mã | Rủi ro | Mô tả | Mitigation` (cách giảm thiểu khi kiểm thử).

---

## 2. Cổng Tự Soát REQ 10 Điểm Chi Tiết (Mục 4.3 — Chạy TRƯỚC KHI ghi file)

> Ambiguity bắt lỗi do hệ thống/tài liệu chưa rõ; **Cổng Tự Soát REQ** bắt lỗi do **chính agent vừa viết sai**. Rà từng REQ qua 10 điểm dưới đây; điểm nào vi phạm → **sửa trực tiếp REQ**, không phải mở AMB.

### 2.1. Tên REQ và AC phải là **cùng một mệnh đề** (4.3.1)
- *Lỗi điển hình:* Tên ghi *"Không giữ lại email sau khi đăng nhập lỗi"*, nhưng AC đo *"HTML trả về không có thuộc tính `value`"* (trình duyệt vẫn tự điền lại). Hoặc tên ghi *"Hai lối đăng xuất"*, nhưng AC chỉ đếm 2 node `li.header-logout` trong DOM (1 node đang ẩn).
- **Luật:** Đọc tên REQ và tự hỏi *"AC này có chứng minh đúng câu vừa đọc không?"* Nếu lệch → sửa tên theo đúng tầng kỹ thuật đo được hoặc kiểm khả dụng thật rồi đặt tên theo kết quả.

### 2.2. Khẳng định phủ định phải kiểm bằng **trạng thái sạch đủ 4 bước** (4.3.2)
- Mệnh đề dạng *"không sinh X"*, *"không gửi Y"*, *"không lưu Z"* không chứng minh được bằng quan sát *"giá trị không đổi"*.
- **Luật:** AC bắt buộc ghi đủ 4 bước theo thứ tự: `(1) xoá sạch tác tạo → (2) xác nhận đã sạch → (3) thực hiện hành động → (4) kiểm tác tạo có xuất hiện không`.

### 2.3. AC không được chứa giá trị **biến thiên theo phiên** hoặc **bí mật thật** (4.3.3 & 7.1)
- Token, session id, CSRF token, id bản ghi vừa tạo, timestamp, mật khẩu, cookie xác thực — chép giá trị cụ thể vào AC vừa làm hỏng test case ở lần chạy sau, vừa phát tán credential vào lịch sử Git.
- **Luật:** Chỉ ghi **hình thái** (`<16 ký tự hex>`, `độ dài = 32`, `a:2:{s:7:"user_id";s:1:"<id>";…}`) và **quan hệ** (*"khác giá trị trước đó"*). Credentials chỉ lưu ở `.env`.

### 2.4. Một REQ = **một** rule kiểm được độc lập (4.3.4)
- Dấu hiệu REQ đang gộp: tên chứa **"và"**, **"hoặc"**, dấu phẩy nối hai mệnh đề, hoặc AC dùng 1 input để kiểm nhiều rule cùng lúc (khi fail không biết rule nào hỏng).
- **Luật:** Tách thành các REQ riêng (`REQ-a` kiểm hoa/thường, `REQ-b` kiểm khoảng trắng đầu/cuối). Khi tách một REQ đã có: **giữ nguyên mã cũ** cho rule ở lại, cấp mã mới từ `Mã kế tiếp` cho phần tách ra.

### 2.5. Tồn tại trong DOM ≠ **người dùng dùng được** (4.3.5)
- `querySelectorAll(...).length` không chứng minh người dùng thao tác được.
- **Luật:** Trước khi khai một phần tử là *"người dùng thao tác được"*, bắt buộc kiểm bằng `browser_evaluate`: (1) `el.offsetParent !== null` (hoặc kiểm `position:fixed`), (2) `getBoundingClientRect()` có kích thước `> 0×0`, (3) duyệt ngược `parentElement` kiểm `getComputedStyle().display`, (4) ghi rõ viewport đang đo (`innerWidth × innerHeight`). Khi mô tả vị trí (*"mục cuối cùng"*), dùng bộ chọn con trực tiếp `X > li:last-child` kèm số phần tử lồng bên trong.

### 2.6. Chuỗi do **trình duyệt / hệ điều hành** sinh không phải hành vi ứng dụng (4.3.6)
- Thông báo validation HTML5 mặc định, tiêu đề trang lỗi trình duyệt, hộp thoại `alert/confirm` gốc, định dạng ngày theo locale đều đổi theo trình duyệt và ngôn ngữ OS.
- **Luật:** Ghi tham khảo kèm tên + phiên bản trình duyệt đã quan sát, **đánh dấu rõ cấm dùng làm assertion**, và chỉ assert phần ứng dụng kiểm soát (`checkValidity() === false`, request không gửi đi). Bảng metadata mục 6.1 bắt buộc có dòng `Trình duyệt khảo sát`.

### 2.7. Không assert khớp tuyệt đối lên giá trị có **phần động** (4.3.7)
- `document.title` có tiền tố đếm thông báo `(16) Dashboard`, `body.className` có token động, text chèn số đếm.
- **Luật:** AC ghi `**chứa** <phần bất biến>` kèm ghi chú phần nào là động và vì sao; cấm ghi `= "<giá trị hôm nay>"`.

### 2.8. Tính năng sinh ra **tác tạo** phải kiểm chứng tác tạo **có tác dụng** (4.3.8)
- Cookie ghi nhớ, email gửi đi, tệp xuất ra, bản ghi lịch sử, thông báo đẩy.
- **Luật:** Mỗi tác tạo cần **tối thiểu 2 REQ**: 1 REQ cho *được tạo đúng hình thái*, 1 REQ cho *dùng được đúng mục đích*. Nếu chưa kiểm chứng được vế thứ hai, bắt buộc cấp REQ ở trạng thái `⚪ Chưa implement` kèm `AMB-XX` (tuyệt đối không bỏ qua).

### 2.9. Mã trạng thái / hành vi kỹ thuật bất thường phải **nghi ngờ nhất quán** (4.3.9)
- Mã HTTP lệch quy ước (`307` thay vì `302/303`, body ghi `419` nhưng header trả `403`, `500` ở luồng người dùng).
- **Luật:** Đã mở `AMB-XX` cho một bất thường thì mọi bất thường cùng loại trong tài liệu phải được xử lý nhất quán; chưa loại trừ được sai số công cụ đo thì chỉ assert điểm dừng và nội dung hiển thị chắc chắn.

### 2.10. Tính toàn vẹn Truy vết & Không mồ côi (4.3.10 & 7.1)
- Mọi `REQ ID` thuộc đúng 1 Story; mọi `AMB-XX` và `RISK-XX` gắn vào 1 Story hoặc nằm trong bảng Hạng mục cấp Epic; 4 nơi (`Nhật ký 6.9` ↔ `Trạng thái REQ 6.2` ↔ `Dải mã metadata 6.1` ↔ `docs/requirements/README.md`) khớp tuyệt đối.

---

## 3. Quy Mô Tài Liệu & Quy Tắc Tách File (Mục 5.1 – 5.6)

### 3.1. Bảng ngưỡng quy mô (Mục 5.1 & 5.2)

Đếm tổng số REQ sau khi hoàn tất khảo sát/phân tích, trước khi ghi file (ưu tiên giữ convention sẵn có của các module trong `docs/requirements/` theo mục 5.6):

| Quy mô số REQ | Cấu trúc tệp đầu ra | Mục lục (TOC) & Phân rã Epic/Story (6.8) |
|---|---|---|
| **Nhỏ (`< 25` / `< 40` REQ)** | 1 file `requirements_<module>.md` | Không bắt buộc tách; `< 25` REQ không bắt buộc mục 6.8 |
| **Vừa (`25 – 80` / `40 – 80` REQ)** | 1 file `requirements_<module>.md` | ✅ **BẮT BUỘC** có Mục lục (TOC) đầu file và mục **6.8 Phân rã Epic/Story** |
| **Lớn (`> 80` REQ)** hoặc thoả điều kiện tách bắt buộc | Tách `requirements_<module>.md` (Index) + `stories/story_NN_<slug>.md` | ✅ **BẮT BUỘC** ở file Index kèm `## Bản đồ tài liệu` |

**Điều kiện tách bắt buộc kể cả khi `≤ 80` REQ (Mục 5.2):**
- Module chứa **≥ 2 entity nghiệp vụ độc lập** có vòng đời riêng (`Customer` và `Contact`, `Project` và `Task`).
- Phạm vi khảo sát mở rộng sang **sub-module/tab con** có nghiệp vụ riêng.
- Có **≥ 2 ma trận trạng thái** khác nhau trong cùng tài liệu, hoặc user yêu cầu chia việc theo Jira Story.

### 3.2. Cấu trúc thư mục chuẩn & Phân chia nội dung khi tách (Mục 5.3 – 5.5)

```text
docs/requirements/
├── README.md                              ← DANH MỤC toàn hệ thống
└── <module>/
    ├── requirements_<module>.md           ← INDEX — TÊN FILE BẤT BIẾN (không gắn _v2, _new)
    ├── evidence/*.png                     ← Ảnh bằng chứng nằm cùng thư mục module
    ├── stories/story_NN_<slug>.md         ← CHỈ khi tách file (> 80 REQ)
    ├── analysis/analysis_<TICKET-ID>.md   ← Tài liệu phân tích ticket của riêng module này
    └── impact/impact_<TICKET-ID>.md       ← Impact Report cho /update-testcases-from-impact
```

| Hạng mục nội dung | Đặt ở đâu khi tách file |
|---|---|
| Bảng Metadata (6.1), Tổng quan, Phạm vi, Bản đồ phủ tài liệu (6.5.1) | **Index (`requirements_<module>.md`)** |
| `## Bản đồ tài liệu` + Bảng Phân rã Epic/Story & đối chiếu AMB/RISK (6.8) | **Index (`requirements_<module>.md`)** |
| Ma trận Phân quyền (6.5), Ma trận Trạng thái (6.6), Yêu cầu Phi chức năng | **Index (`requirements_<module>.md`)** — hạng mục cắt ngang |
| Bảng Ambiguity & Risk (6.7) — đánh số toàn module, không đánh lại theo file | **Index (`requirements_<module>.md`)** (file story chỉ tham chiếu mã) |
| Nhật ký Thay đổi (6.9) + Bảng Danh mục Evidence | **Index (`requirements_<module>.md`)** |
| Bảng REQ chi tiết (6.2), Field Spec (6.3), Validation Messages (6.4), User Flow | **File story (`stories/story_NN_<slug>.md`)** tương ứng |

**Hợp đồng đọc (Consumer Contract — Mục 5.5) & 6 Bất biến khi tách (Mục 5.4):**
- Đường dẫn điểm vào **LUÔN** là `docs/requirements/<module>/requirements_<module>.md`. Khi tách, Index **BẮT BUỘC** có mục:
  ```markdown
  ## Bản đồ tài liệu
  | File | Story | REQ bao phủ |
  |---|---|---|
  | [stories/story_01_danh_sach.md](stories/story_01_danh_sach.md) | STORY-PRJ-01 | REQ-PRJ-01 → REQ-PRJ-13 |
  ```
- **6 Bất biến:** (1) `REQ ID` giữ nguyên tuyệt đối · (2) Mỗi REQ thuộc đúng 1 Story · (3) Tổng REQ trong các Story = tổng REQ đã sinh · (4) `AMB/RISK` đánh số toàn module đặt ở Index · (5) Hạng mục cắt ngang không nhân bản vào file story · (6) Link 2 chiều giữa Index và từng file story.

---

## 4. Cấu Trúc Tài Liệu Đặc Tả Module — `requirements_<module>.md` (Mục 6.1 – 6.9)

### 6.1. Bảng Metadata + Tổng quan (Overview)
```markdown
| Thuộc tính | Giá trị |
|---|---|
| **Module / Prefix** | Tên module (`<PREFIX>`) |
| **Dải mã đã dùng** | `REQ-PRJ-01` → `REQ-PRJ-65` · `AMB-01` → `AMB-12` · `RISK-01` → `RISK-12` |
| **Mã kế tiếp**     | Đợt phân tích sau bắt đầu từ `REQ-PRJ-66` · `AMB-13` · `RISK-13` — **KHÔNG đánh lại từ 01** |
| **Trình duyệt khảo sát** | Google Chrome (Playwright MCP), Headless Mode viewport `1920×1080` (hoặc Headed Mode `1600×750` khi bật `/browser-mode`). Mọi AC dựa trên thông báo mặc định của trình duyệt chỉ đúng với trình duyệt này |
```
Sau bảng metadata: mô tả mục đích module, phạm vi trong/ngoài module.

### 6.2. Yêu cầu Chức năng (Functional Requirements)
| REQ ID | Tên yêu cầu | Mô tả | Acceptance Criteria | Trạng thái | Cập nhật lần cuối | Nguồn |
|---|---|---|---|---|---|---|
| REQ-LOGIN-01 | Đăng nhập bằng email | ... | Nhập đúng email+password → vào Dashboard | 🟢 | — | UI thực tế / AC#1 |
| REQ-LOGIN-02 | Khóa account sau 5 lần sai | ... | ... | 🟡 | 2026-08-10 · ABC-123 | AC#3 |

- **Mã trạng thái REQ:** `🟢 Active` (đang hiệu lực, TC giữ nguyên) · `🟡 Changed` (đã sửa, TC map vào REQ này phải review lại) · `🔴 Deprecated` (tính năng bị gỡ, TC phải archive; **TUYỆT ĐỐI KHÔNG xoá dòng REQ**, không tái sử dụng mã) · `⚪ Chưa implement` (tài liệu/API có, UI chưa build; viết TC trước đánh `skip`).

### 6.3. Đặc tả Trường Dữ liệu (Field Specifications)
| Field (Label) | Loại UI | Required | Ràng buộc (min/max/format/default) | REQ liên quan | Ghi chú (ánh xạ field API / option DOM) |
|---|---|---|---|---|---|

### 6.4. Business Rules & Validation Messages
| REQ ID | Rule / Trigger | Thông báo lỗi mong đợi (nguyên văn UI / API) |
|---|---|---|

### 6.5. Ma trận Phân quyền & 6.5.1. Bản đồ Phủ Tài liệu
- **6.5.1. Bản đồ phủ tài liệu** (đặt ngay sau Tổng quan; nếu không có tài liệu thì ghi 1 dòng *"Không có tài liệu — toàn bộ REQ sinh từ khảo sát UI thực tế"*, không bỏ mục):
  `| Vùng chức năng | Tài liệu phủ | Mức phủ (🟩/🟨/⬜/⚠️) | REQ liên quan |`
- **6.5. Ma trận Phân quyền** (nếu không áp dụng thì ghi rõ *"Không áp dụng"*, không bỏ mục):
  `| Hành động | Admin | Manager | Staff | Guest |` — dùng ký hiệu `✅`/`❌` (đã kiểm chứng), `⚠️✅`/`⚠️❌` (suy từ cấu hình), `❔` (chưa có căn cứ + mở `AMB-XX` 🔴), `—` (không áp dụng).
  **Dòng tổng bắt buộc ngay dưới bảng (tổng các nhóm phải bằng `số hàng × số cột`):**
  `Tổng 21 ô = Đã kiểm chứng 13 · Suy diễn 0 · Chưa rõ 7 · Không áp dụng 1` (kèm giải thích ô `—` và mã `AMB-XX` của các role thiếu account).

### 6.6. Ma trận Trạng thái (State Matrix)
`| Trạng thái hiện tại | Hành động cho phép | Trạng thái kế tiếp | Ai được thực hiện |` (hoặc ghi *"Không áp dụng"*).

### 6.7. Điểm Mơ Hồ (Ambiguities) & Rủi Ro (Risks)
- **Bảng Ambiguities** (giữ nguyên các dòng đã `✅` hoặc `⏭️`, không xoá):
  `| Mã | Câu hỏi | Nguy cơ | Mức độ (🔴/🟡/🟢) | Assumption tạm | Trạng thái (❓/✅/⏭️) | Kết luận |`
- **Bảng Risks:** `| Mã | Rủi ro | Mô tả | Mitigation |`

### 6.8. Phân rã Epic / Story (Backlog View — BẮT BUỘC khi `≥ 25` REQ)
`| Story ID | Tên Story | REQ bao phủ | Số REQ | AMB / RISK liên quan | Ghi chú phạm vi |`
**Bắt buộc kèm đủ 4 phần dưới bảng:**
1. **Dòng tổng kiểm chứng:** `Tổng: N Story / M REQ — mọi REQ thuộc đúng một Story, không mồ côi, không trùng` kèm phép cộng tường minh (`7+5+7+6+6+9 = 40 ✔`).
2. **Bảng đối chiếu AMB/RISK:** `| Nhóm (AMB thuộc Story / AMB cấp Epic / RISK thuộc Story / RISK cấp Epic) | Mã | Nằm ở đâu |` — đảm bảo 100% mã `AMB-XX` và `RISK-XX` có chủ sở hữu.
3. **Hạng mục cấp Epic:** Liệt kê các phần cắt ngang không gán riêng vào Story nào kèm lý do.
4. **Thứ tự triển khai đề xuất:** Xếp theo phụ thuộc và rủi ro, đánh dấu rõ Story nào đang `BLOCKED` bởi `AMB-XX` nào.

### 6.9. Nhật ký Thay đổi (Changelog — BẮT BUỘC ở cuối mọi tài liệu module, mới nhất lên trên)
| Ngày | Nguồn | REQ ảnh hưởng | Loại | Tóm tắt thay đổi | TC cần xử lý |
|---|---|---|---|---|---|
| 2026-08-15 | ABC-140 | REQ-PRJ-58 → 62 | 🔴 Bỏ | Gỡ chức năng Copy Project | TC-PRJ-31 → archive |
| 2026-08-10 | ABC-123 | REQ-PRJ-42 | 🟡 Sửa | Deadline bắt buộc sau Start Date | TC-PRJ-18, 19 → review |
| 2026-08-02 | UI recon | REQ-PRJ-01 → 65 | 🟢 Thêm | Khởi tạo tài liệu từ khảo sát UI | — |

- Ghi mọi thay đổi (kể cả `✏️ Biên tập`). Đồng bộ 4 nơi: `Nhật ký (6.9) ↔ Trạng thái REQ (6.2) ↔ Dải mã metadata (6.1) ↔ docs/requirements/README.md`.

---

## 5. Quy Trình Cập Nhật Delta & Mẫu Impact Report (`/update-requirements-from-ticket`)

### 5.1. Phân loại 5 Nhóm Delta & Đối chiếu Ambiguity đang treo
Trước khi xếp AC vào nhóm **THÊM**, phải rà toàn bộ REQ hiện có để chống cấp trùng mã cho hành vi đã tồn tại (*cùng hành vi khác tham số = SỬA; hành vi mới hoàn toàn = THÊM; không chắc → hỏi user*):

| Nhóm Delta | Dấu hiệu nhận biết | Xử lý trong `requirements_<module>.md` |
|---|---|---|
| 🟢 **THÊM** | Hành vi hoàn toàn mới, chưa có REQ nào mô tả | Cấp mã mới từ `Mã kế tiếp`, trạng thái `🟢` |
| 🟡 **SỬA** | Cùng hành vi nhưng đổi điều kiện / ngưỡng / message | **GIỮ NGUYÊN mã REQ cũ**, sửa nội dung, đổi trạng thái `🟡`, ghi `Ngày · Ticket ID` vào `Cập nhật lần cuối` |
| 🔴 **BỎ** | Ticket gỡ bỏ tính năng đã đặc tả | Đổi trạng thái sang `🔴 Deprecated`. **KHÔNG xoá dòng**, không tái sử dụng mã |
| ⚪ **CHƯA BUILD** | Yêu cầu đã chốt nhưng hệ thống chưa implement | Cấp mã mới từ `Mã kế tiếp`, trạng thái `⚪` |
| ⏸️ **TRÙNG** | Nhắc lại đúng điều REQ cũ đã quy định | Không sửa REQ; ghi nhận vào báo cáo là *"đã có sẵn, không tác động"* |

**Đối chiếu với các `AMB-XX` đang ở trạng thái `❓ Chờ trả lời`:**
- Kết luận **trùng** Assumption tạm → đổi AMB sang `✅ Đã trả lời <ngày>`, ghi kết luận; TC hiện có giữ nguyên.
- Kết luận **khác** Assumption tạm → đổi AMB sang `✅`, ghi kết luận; **mọi TC dựa trên assumption cũ phải đưa vào Impact Report** để sửa.
- Kết luận **sinh yêu cầu mới** → cấp REQ mới từ `Mã kế tiếp`, ghi chú `Giải quyết AMB-XX`.

### 5.2. Mẫu chuẩn Impact Report (`docs/requirements/<module>/impact/impact_<TICKET-ID>.md`)

**BẮT BUỘC ghi ra file** (kể cả khi không có TC nào bị ảnh hưởng) để làm đầu vào cho `/update-testcases-from-impact` và `/update-automation-from-impact`. Xác định TC bị ảnh hưởng bằng cách tra cột `REQ ID` trong `docs/testcases/<module>/` hoặc RTM (nếu chưa có TC thì ghi `⚠️ chưa rà soát`):

```markdown
## Impact Report — <TICKET-ID> · <ngày>

### Tóm tắt
| Nhóm | Số lượng | REQ |
|---|---|---|
| 🟢 Thêm mới | 3 | REQ-PRJ-79 → 81 |
| 🟡 Sửa | 2 | REQ-PRJ-42, REQ-PRJ-51 |
| 🔴 Bỏ | 5 | REQ-PRJ-58 → 62 |
| ⏸️ Trùng, không tác động | 4 | REQ-PRJ-14, 15, 22, 30 |

### Test case cần xử lý
| TC ID | REQ liên quan | Hành động | Lý do |
|---|---|---|---|
| TC-PRJ-18 | REQ-PRJ-42 | ⚠️ Review & sửa | Deadline đổi từ tuỳ chọn sang bắt buộc |
| TC-PRJ-31 | REQ-PRJ-58 | 🗑️ Archive | Chức năng Copy Project đã bị gỡ |
| — | REQ-PRJ-79 → 81 | ➕ Viết mới | Yêu cầu mới chưa có TC |

### Ambiguity
| Mã | Chuyển trạng thái | Ghi chú |
|---|---|---|
| AMB-02 | ❓ → ✅ | PO xác nhận là lỗi → sinh REQ-PRJ-79 |
| AMB-13 | (mới) ❓ | Chưa rõ Priority có ảnh hưởng sắp xếp danh sách không |

### Cảnh báo
- ⚠️ AMB-04 vẫn treo sau 2 sprint — STORY-PRJ-03 tiếp tục BLOCKED
```
