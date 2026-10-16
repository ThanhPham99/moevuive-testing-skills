# Execution Report Viewer

Trang web nhỏ gọn để **xem và gộp kết quả kiểm thử từ file Markdown** — thống kê, lọc, so sánh giữa các lần chạy, và xem độ phủ automation.

Dùng để đọc output của:
`/execute-test-cases` (`execution_report.md`) · `/retest-fixed-bugs` (`retest_report.md`) · `/generate-traceability-matrix` (`traceability_matrix.md`)

---

## Dùng ngay (không cần cài gì)

Mở [`bundle.html`](bundle.html) bằng trình duyệt — double-click là được. Không cần build, không cần `node_modules`, chạy offline.

Kéo thả, hoặc bấm **+ Import thư mục** / **+ Import file .md** ở góc trên (hai nút này luôn hiện, kể cả sau khi đã nạp dữ liệu — bấm thêm được bất cứ lúc nào), ví dụ:

```
docs/executions/customers/run_1785700456/execution_report.md
docs/executions/customers/retest_1785700999/retest_report.md
traceability_matrix.md
```

Nạp **nhiều file/thư mục** để gộp số liệu và so sánh giữa các lần chạy — mỗi thư mục `run_*` là 1 lần chạy.

> ⚠️ **Hộp thoại "+ Import thư mục" chỉ chọn được 1 thư mục mỗi lần** — giới hạn của chính hộp thoại hệ điều hành. Muốn so sánh nhiều lần chạy (nhiều thư mục `run_*`) thì bấm nút đó lại cho từng thư mục — dữ liệu cộng dồn chứ không ghi đè. Muốn chọn nhiều thư mục trong 1 lần thì dùng kéo-thả: chọn nhiều thư mục cùng lúc trong Explorer (giữ Ctrl) rồi kéo cả cụm vào trang.

> Toàn bộ xử lý chạy trong trình duyệt, không gửi dữ liệu đi đâu. File đã import lưu vào `localStorage` nên lần mở sau vẫn còn.

---

## Tính năng

| Nhóm | Chi tiết |
|---|---|
| **Import** | Kéo thả, hoặc 2 nút cố định **+ Import thư mục** (nạp được luôn ảnh evidence trong `run_*`) / **+ Import file .md** — luôn hiện, bấm thêm được bất cứ lúc nào · import lại cùng Run ID sẽ ghi đè |
| **Thống kê** | PASS / FAIL / BLOCKED / SKIPPED · tổng TC · **pass rate = PASS / (PASS + FAIL + BLOCKED)** — SKIPPED không nằm ở mẫu số |
| **Cảnh báo tự động** | 4 loại — xem mục dưới |
| **Xoá tất cả** | Nút **Xoá tất cả** cạnh **+ Import file .md** (chỉ hiện khi đã nạp ít nhất 1 file) — xoá hết report + ảnh evidence đã nạp (kể cả trong `localStorage`), quay về màn hình kéo thả trống |
| **Sidebar** | Danh sách report đã nạp kèm nhãn `RUN` / `RETEST`; click để xem riêng một lần chạy, `×` để gỡ |
| **Lọc** | Theo trạng thái (chip) · theo module · tìm toàn văn trên TC ID, kịch bản, ghi chú, nguyên nhân chặn, Expected/Actual |
| **Sort** | Click header — TC ID sort theo số tự nhiên (`TC_002` trước `TC_010`) |
| **Chi tiết** | Click một dòng để mở panel: REQ ID · Priority · bước fail · Expected vs Actual · nguyên nhân chặn · evidence · file nguồn |
| **So sánh các lần chạy** | Tab riêng — 🆕 Mới fail · 🔁 Fail liên tục · ✅ Vừa được fix · ⚠️ Chuyển sang BLOCKED |
| **Verify bug** | Tab riêng cho kết quả retest: FIXED / NOT_FIXED / PARTIAL / CANNOT_VERIFY |
| **Độ phủ automation** | Tab riêng, nạp `traceability_matrix.md` — xem mục dưới |
| **Export** | **CSV** và **Excel (.xlsx)** — xuất **đúng tab đang mở** và **đúng phần đang hiển thị** sau lọc/tìm kiếm |

---

## Tab Độ phủ automation

Trả lời câu hỏi *"test case manual nào đã có script automation"*.

> ⚠️ **Nguồn phải là `traceability_matrix.md`** do `/generate-traceability-matrix` sinh ra — workflow đó quét **code thật** để biết TC nào có script.
> **Đừng** dùng cột `Automatable` trong file test case: đó là **dự định** lúc viết TC, không phải **thực tế** đã automate. Hai con số này lệch nhau rất nhanh.

**Bốn trạng thái, suy ra từ dữ liệu chứ không đọc cột `Trạng thái` của file:**

| Trạng thái | Điều kiện |
|---|---|
| ✅ **Đã automate** | Mọi TC của REQ đều có script |
| 🟣 **Automate một phần** | Có script nhưng chưa phủ hết TC — VD `customers.spec.ts (1/3)` |
| 🟡 **Mới có TC thủ công** | Có TC, chưa có script nào |
| 🔴 **Chưa có TC** | REQ chưa được viết test case |

Trạng thái 🟣 là lý do phải tự suy thay vì đọc cột có sẵn: RTM ghi `🟡 Manual only` cho dòng đã automate 1/3, gộp vào một nhóm là **thổi phồng độ phủ**.

**⬛ Module chưa có tài liệu đặt TRƯỚC mọi phần trăm** — cùng luật với RTM: module chưa recon thì không có REQ nào để "chưa cover", nên tỷ lệ vẫn đẹp trong khi cả vùng đó chưa ai chạm tới.

Ngoài bảng chính còn 3 danh sách: 🟡 TC chưa automate (xếp theo priority — đây là việc cần làm tiếp) · ⚪ orphan test · ⚠️ mapping suy luận cần người xác nhận.

---

## Export CSV / Excel

Hai nút `↓ CSV` và `↓ Excel` xuất **đúng tab đang mở**, đã áp bộ lọc và tìm kiếm hiện tại.

| Định dạng | Đặc điểm |
|---|---|
| **CSV** | Một bảng (sheet Tổng hợp). Có BOM UTF-8 nên Excel trên Windows đọc đúng tiếng Việt, không lỗi font |
| **Excel** | **Nhiều sheet**, freeze dòng tiêu đề, AutoFilter, wrap text, độ rộng cột đặt sẵn, **ô trạng thái tô màu** đúng như trên web |

**Excel tách sheet thế nào:**

| Tab | Sheet |
|---|---|
| Kết quả TC | `Tổng hợp` + mỗi **lần chạy** một sheet (khi nạp > 1 lần chạy) |
| Độ phủ automation | `Tổng hợp` + `TC chưa automate` + `Orphan test` + `Mapping suy luận` + `Module chưa có tài liệu` |

Tên file dạng `execution_report_<yyyyMMdd-HHmmss>.xlsx` / `do_phu_automation_<...>.xlsx`.

> File `.xlsx` được dựng thủ công bằng zip + Office Open XML (không dùng SheetJS — thư viện ~900 KB sẽ làm phình `bundle.html` vốn phải mở offline được). Zip ghi ở chế độ STORE (không nén) nên file to hơn bình thường.

---

## 4 cảnh báo tự động

Đây là phần khiến trang này khác một bảng Excel thường — nó chủ động chặn những kết luận sai hay gặp nhất:

| Cảnh báo | Kích hoạt khi | Vì sao quan trọng |
|---|---|---|
| 🔴 **BLOCKED > 20%** | Tỷ lệ BLOCKED vượt 20% | BLOCKED là **chưa test được**, không phải đạt. Trên 20% thì lần chạy không đủ dữ liệu để kết luận chất lượng |
| 🟡 **BLOCKED 5–20%** | — | Nhắc nêu rõ nguyên nhân chặn khi báo cáo |
| 🟡 **Có TC SKIPPED** | Bất kỳ TC nào bị skip | TC skip do thao tác phá huỷ trên môi trường dùng chung là **nợ kiểm thử**, dễ biến mất khỏi mọi báo cáo về sau |
| 🟡 **Dữ liệu chưa dọn** | Cột `Đã xoá?` có ô khác ✅ | Môi trường còn data thừa → lần chạy sau có thể fail vì lý do không liên quan đến ứng dụng |
| 🟡 **Gộp nhiều lần chạy cùng module** | Cùng module có ≥ 2 report | Mỗi TC bị đếm một lần cho **mỗi** lần chạy → tổng lớn hơn số TC thật. Chọn một lần chạy ở sidebar để xem số chính xác |

---

## Định dạng Markdown được hỗ trợ

Parser **không phụ thuộc số thứ tự mục** (`## 1.`, `## 2.`…) — nó nhận diện bảng theo **tên cột**, nên report có thêm/bớt mục vẫn đọc được.

| Loại bảng | Nhận diện bằng | Lấy ra |
|---|---|---|
| Kết quả từng TC | có cột `TC ID` **và** cột `Kết quả` | TC ID · kịch bản · trạng thái · bước fail · ghi chú |
| TC BLOCKED | có cột `TC ID` **và** cột `Nguyên nhân chặn` | nguyên nhân chặn · cần gì để chạy được |
| Chi tiết FAIL / REG | heading `### FAIL #1 — <TC ID> · <kịch bản>` + bảng 2 cột ngay sau | REQ ID · Priority · Expected · Actual · evidence · nghi ngờ nguyên nhân |
| Verify bug (retest) | bảng 2 cột có khoá `Bug` **và** khoá `Kết quả` | bug · kết quả retest · severity gốc · số lần lặp |
| Dữ liệu đã dọn | có cột `Đã xoá?` | đếm số dòng chưa dọn |
| Header lần chạy | bảng 2 cột đầu file (`Thông tin` / `Nội dung`) | Run ID · Retest ID · Build · môi trường… |
| **Ma trận truy vết** | có cột `REQ ID` **và** cột `TC IDs` | REQ · mô tả · TC · script · số TC đã automate |
| ⬛ Module chưa có tài liệu | có cột `Module`, heading chứa ⬛ / "chưa" / "recon" | module nằm ngoài phạm vi RTM |

File được nhận là RTM khi tiêu đề hoặc tên file chứa `Ma trận truy vết` / `traceability` / `RTM`.

**Quy ước khác:**

- **Module** lấy từ heading `#` đầu file: `# Execution Report — <Module> · <Loại chạy>`
- **Run ID** lấy từ khoá `Run ID` hoặc `Retest ID` trong bảng header; không có thì dùng tên file
- **Trạng thái** nhận cả dạng có emoji (`✅ PASS`, `⚠️ BLOCKED`) lẫn không; retest nhận `FIXED` / `NOT_FIXED` / `PARTIAL` / `CANNOT_VERIFY`
- Ô placeholder (`—`, `-`, `N/A`) được coi là **không có dữ liệu**, không lọt vào tìm kiếm hay CSV
- Pipe trong cell phải escape `\|` (đúng chuẩn Markdown)
- Bảng không khớp mẫu nào ở trên (Tổng kết, Đề xuất bước tiếp theo…) được **bỏ qua tự động** — số liệu tổng kết được **tính lại từ bảng TC**, không đọc từ bảng Tổng kết, nên report có số sai vẫn hiện đúng

---

## So sánh các lần chạy hoạt động thế nào

Gom report theo **module**, sắp theo Run ID (số trong `run_1785700456`) tăng dần, rồi so **cùng TC ID** giữa hai lần chạy gần nhất:

| Nhóm | Điều kiện |
|---|---|
| 🆕 Mới fail | lần trước PASS → lần này FAIL |
| 🔁 Fail liên tục | FAIL ở cả hai lần |
| ✅ Vừa được fix | lần trước FAIL → lần này PASS |
| ⚠️ Chuyển sang BLOCKED | trước chạy được → giờ bị chặn |

> ⚠️ So sánh chỉ có ý nghĩa khi các lần chạy dùng **cùng nguồn TC**. File TC đã sửa giữa hai lần chạy thì đừng kết luận "chất lượng giảm" từ số thô.

---

## Vì sao là 1 file HTML thuần, không phải React như `testcases-viewer`

| | `testcases-viewer` | `execution-viewer` |
|---|---|---|
| Stack | React + TS + Vite + Parcel + Tailwind + shadcn/ui | HTML/CSS/JS thuần, 1 file |
| File trong repo | 71 | 2 (`bundle.html` + README) |
| Cần `pnpm install` để sửa | Có | Không — mở file, sửa, xong |

Trang này chỉ có 3 bảng và một panel chi tiết — không đủ phức tạp để cần component framework, mà lại phải sống được khi mở bằng `file://` trên máy bất kỳ. Cách dùng với người dùng cuối là **y hệt**: double-click `bundle.html`, kéo thả file `.md`.

Muốn đổi giao diện thì sửa thẳng trong `bundle.html` — CSS nằm ở `<style>` đầu file, logic ở `<script>` cuối file, chia sẵn 4 khối: `PARSER` · `STATE` · `DERIVED` · `RENDER`.

Màu thương hiệu `#4DBD44` khai báo ở biến CSS `--brand`, đồng bộ với `testcases-viewer`.
