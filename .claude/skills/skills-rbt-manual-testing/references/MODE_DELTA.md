# Mode 4: DELTA — Cập Nhật Bộ Test Cases Đã Có Theo Impact Report

> **Mục đích:** Đồng bộ bộ Test Cases **đã tồn tại** với requirements vừa thay đổi theo ticket. Chỉ chạm đúng phần bị ảnh hưởng, bảo toàn tuyệt đối `TC ID`, sao lưu bản cũ vào `archive/`, và xuất `Delta TC List` cho tầng automation.
> **Áp dụng cho:** `/update-testcases-from-impact` (Mode `DELTA` — hỗ trợ 2 chế độ con: `PLAN` và `APPLY`).

---

## 1. Vị Trí Trong Chuỗi Delta 3 Tầng & Phân Biệt Với `/review-testcases`

```text
/update-requirements-from-ticket   (tầng requirements)
        ↓ Impact Report (docs/requirements/<module>/impact/impact_<TICKET-ID>.md)
/update-testcases-from-impact      (tầng test case — MODE DELTA)
        ↓ Delta TC List + Kế hoạch (docs/testcases/<module>/impact/impact_plan_<TICKET-ID>.md)
/update-automation-from-impact     (tầng automation)
```

| Tiêu chí | `/update-testcases-from-impact` (Mode `DELTA`) | `/review-testcases` (Chất lượng) |
|---|---|---|
| **Câu hỏi trả lời** | "TC còn khớp requirement **mới** không?" | "TC viết có đạt chuẩn 12 tiêu chí không?" |
| **Bắt được** | TC **stale** — mô tả hành vi cũ đã bị thay đổi | TC mơ hồ, thiếu assertion, trùng lặp, thiếu boundary |
| **Ghi vào đâu** | Sửa **tại chỗ** trong `test_cases_<module>.md`, sao lưu bản cũ vào `archive/` | Sinh file `<tên>_improved.md` mới, giữ nguyên gốc |

> 🚨 **KHÔNG dùng `/review-testcases` mode FIX để đồng bộ TC theo ticket** (vì nó sinh file `_improved` làm lệch tên index bất biến). Chạy Mode `DELTA` đồng bộ nội dung trước, chạy `/review-testcases` chấm chất lượng sau.

---

## 2. Nguyên Tắc Gốc (`TC ID` Là Khoá) & 5 Quy Tắc Bất Biến

`TC ID` xuất hiện ở 3 nơi ngoài file TC: `allure.label('testId', ...)` trong script automation · cột `TC ID` của `traceability_matrix.md` · `docs/executions/`. Đổi hoặc đánh lại `TC ID` sẽ cắt đứt cả 3 mối nối cùng lúc.

| # | Quy tắc bắt buộc | Vì sao |
|---|---|---|
| 1 | **Sửa tại chỗ** trong `test_cases_<module>.md` / `parts/part_NN_*.md` — giữ nguyên tên file | Mọi workflow phía sau đọc theo mẫu đường dẫn cố định; cấm sinh `_improved` / `_v2` / `_new` ngoài `archive/` |
| 2 | **Sao lưu trước khi sửa** vào `archive/test_cases_<module>_v<N>.md` | Giữ bản đối chiếu trước khi sửa tại chỗ |
| 3 | **Giữ nguyên `TC ID`.** TC mới sinh trong phạm vi REQ `🟡` cấp số **tiếp theo dải hiện có** của module, KHÔNG chèn vào giữa | Bảo toàn khóa truy vết sang automation, RTM và execution reports |
| 4 | **KHÔNG xoá dòng TC.** Chức năng bị gỡ → đổi trạng thái thành `🗑️ Deprecated (TICKET-XXX)` | Giữ dấu vết lịch sử để script automation tương ứng biết cần đánh dấu skip thay vì thành orphan |
| 5 | **Đọc nội dung REQ sau khi đổi & Nhật ký thay đổi, không suy đoán từ tên TC** | Tên TC không chứa kỳ vọng mới; sửa theo suy đoán tạo ra TC sai kỳ vọng |

**Ràng buộc về Độ hạt (`GỘP` / `TÁCH`) trong Mode DELTA:**
- **Bám đúng độ hạt của bộ TC đang có:** Bộ TC đang ở `GỘP` thì thêm field là thêm **1 dòng vào Bảng kiểm** của TC `UI cơ bản` (Kiểu B) và sửa biến thể là sửa dòng biến thể (giữ trần ≤ 6 biến thể/TC). Bộ TC đang ở `TÁCH` thì mỗi case mới là 1 TC.
- **CẤM đổi độ hạt của cả bộ TC trong Mode DELTA** vì đổi độ hạt sẽ đánh lại toàn bộ `TC ID`.
- **REQ mới hoàn toàn (nhóm `🟢` / `➕ Viết mới` chưa có TC):** Ngoài phạm vi sửa của DELTA — liệt kê ở mục *"Ngoài phạm vi"* và route sang `/generate-testcases-manual-rbt` hoặc `/generate-testcases-from-requirements`.

---

## 3. Quy Trình 7 Bước Mode DELTA (`PLAN` & `APPLY`)

### Bước 1: Đọc Delta & Mở Evidence
1. Đọc `Impact Report` (`docs/requirements/<module>/impact/impact_<TICKET-ID>.md`) hoặc danh sách REQ đã đổi do user cung cấp, trích 3 nhóm: `⚠️ Review & sửa` (REQ `🟡`) · `🗑️ Archive` (REQ `🔴`) · `➕ Viết mới` (REQ `🟢`).
   > Nếu Impact Report ghi `⚠️ chưa rà soát` ở cột TC và chưa có nguồn map → **DỪNG LẠI**, báo user chạy `/generate-traceability-matrix` trước.
2. Đọc nội dung REQ sau khi đổi và **Nhật ký thay đổi** ở cuối `docs/requirements/<module>/requirements_<module>.md`.
3. **BẮT BUỘC mở ảnh trong `docs/requirements/<module>/evidence/`** nếu thay đổi chạm tới 4 nhóm không được suy diễn (nhãn nguyên văn, bố cục/thứ tự field, giá trị mặc định, định dạng hiển thị). Chưa có ảnh mới sau khi đổi → gắn `@NeedsVerify`, không sửa mò.

### Bước 2: Map `REQ ID` → `TC ID` (Theo Thứ Tự Tin Cậy)

| Nguồn map | Độ tin cậy | Cách xử lý |
|---|---|---|
| Cột `REQ ID` trong bảng TC / `traceability_matrix.md` / Bảng Đối Soát Coverage ở index | ✅ Chắc chắn | Ghi nhận `file:dòng` và `TC ID` để lập kế hoạch sửa |
| So khớp mô tả TC ↔ nội dung REQ | ⚠️ Suy luận | **Bắt buộc tách riêng và chờ user xác nhận ở Bước 4 trước khi sửa** |
| Không tìm thấy TC nào | ❓ Chưa có TC | Chuyển sang nhóm `➕ Ngoài phạm vi`, không sửa gì |

### Bước 3: Lập Kế Hoạch Sửa Từng TC & Kiểm Tác Động Lan Toả

**Bảng ánh xạ: REQ đổi gì → TC sửa gì:**

| Delta của REQ | Vòng · Nhánh | Hành động với TC | Phạm vi chạm |
|---|---|---|---|
| Đổi **nhãn nguyên văn** (nút, tiêu đề, nhãn field, thông báo) | **V1 · UI cơ bản** | Sửa nhãn trong bảng kiểm màn hình **và** mọi Expected Result trích nhãn đó *(mở evidence)* | Bảng kiểm V1 + các ô Expected liên quan |
| **Thêm / bớt field** trên form | **V1 · UI cơ bản** *(+ V2 kèm theo)* | Thêm/bớt **dòng trong bảng kiểm** thành phần màn hình, kiểm lại thứ tự field & Tab **rồi mới** tới TC `Required`/`Validation` ở V2 *(mở evidence)* | Bảng kiểm V1 + TC `Required`/`Validation` ở V2 |
| Đổi **giá trị mặc định** (checkbox tick sẵn, option đang chọn, con trỏ focus) | **V1 · UI cơ bản** | Sửa dòng tương ứng trong bảng kiểm *(mở evidence)* | 1 dòng bảng kiểm |
| Đổi **định dạng hiển thị** (tiền tệ, ngày, giờ, badge) | **V1 · Display** | Sửa Expected Result ghi đúng định dạng mới *(mở evidence)* | Nhóm TC hiển thị |
| Đổi **hành vi giao diện** (nút khoá đến khi đủ điều kiện, field bật/tắt) | **V2 · UI Behavior** | Sửa TC hành vi + kiểm **cả hai chiều** (bật điều kiện → mở khoá; tắt → khoá lại) | Nhóm TC hành vi |
| Đổi **expected result / message** | V2 · theo nhánh của TC | Sửa cột Expected Result, ghi message **nguyên văn** | 1 ô trong bảng |
| Field từ tuỳ chọn → **bắt buộc** | **V2 · Required** | Sửa TC happy path + **thêm TC negative** cho trường hợp để trống | 1 TC sửa + 1 TC mới cuối dải |
| Đổi **luật validation** (độ dài, định dạng, dải giá trị) | **V2 · Validation + BVA** | Sửa TC boundary — kiểm lại **cả 3 mốc**: dưới ngưỡng / đúng ngưỡng / trên ngưỡng | Nhóm TC boundary của field đó |
| Đổi **steps / luồng** | **V2 · Use Case** | Sửa cột Steps, kiểm lại Precondition còn đúng không | Steps + Precondition |
| Đổi **quy tắc nghiệp vụ / trạng thái** | **V2 · Business Rule · State Transition** | Sửa bảng quyết định / bảng transition, kiểm cả ô hợp lệ lẫn ô bị chặn | Nhóm TC tương ứng |
| Đổi **phân quyền** | **V3 · Permission** | Sửa TC phân quyền, kiểm ma trận role còn khớp | Nhóm TC phân quyền |
| Đổi **breakpoint / trình duyệt cam kết** | **V4 · Responsive · Compatibility** | Sửa danh sách kích thước/trình duyệt trong TC | Nhóm TC V4 |
| Chức năng **bị gỡ** (REQ `🔴`) | Nhánh của TC đó | Đổi trạng thái TC → `🗑️ Deprecated (TICKET-XXX)`, **KHÔNG xoá dòng** | Cột trạng thái |
| REQ **mới hoàn toàn** (REQ `🟢`) | — | ❌ Ngoài phạm vi DELTA → chuyển `/generate-testcases-manual-rbt` hoặc `/generate-testcases-from-requirements` | — |

**Tác động lan toả — 5 câu bắt buộc tự hỏi:**
1. **Ticket có đụng thành phần nhìn thấy trên màn hình không** (thêm/bớt field, đổi nhãn, đổi vị trí, đổi mặc định)? → Phải cập nhật cả `V1 · UI cơ bản`, không chỉ sửa validation ở V2.
2. Field đổi thành bắt buộc → **TC nào khác dùng field đó ở bước phụ** mà giờ sẽ fail?
3. TC vừa `Deprecated` → **TC nào khác đang lấy nó làm Pre-Condition**?
4. Thêm field mới → đã đối soát đủ từng mục của loại field đó trong [`FIELD_VALIDATION_15_TYPES.md`](FIELD_VALIDATION_15_TYPES.md) chưa?
5. Số TC sau khi thêm có **vượt ngưỡng** (`>40 TÁCH` / `>50 GỘP`) cần tách `parts/` không?

### Bước 4: Báo Cáo Kế Hoạch & Xin Duyệt — ⏸️ HITL CHECKPOINT
1. Ghi file kế hoạch `docs/testcases/<module>/impact/impact_plan_<TICKET-ID>.md` gồm:
   - Bảng ánh xạ `REQ → TC` (tách rõ `✅ Chắc chắn` · `⚠️ Suy luận` · `❓ Chưa có TC`).
   - Kế hoạch sửa từng TC kèm `file:dòng`, `TC ID`, `Vòng · Nhánh`, ô cần sửa, yêu cầu mở evidence.
   - **Danh sách nhánh 4 vòng bị ticket chạm tới** và nhánh giữ nguyên.
   - Kết quả kiểm 5 câu tác động lan toả + Danh sách ngoài phạm vi (REQ `🟢`).
2. **⏸️ DỪNG LẠI:**
   - Nếu chạy **Mode `PLAN`** → **KẾT THÚC tại đây**.
   - Nếu chạy **Mode `APPLY`** → chờ user duyệt kế hoạch (đặc biệt xác nhận nhóm `⚠️ Suy luận`, nhóm `🗑️ Deprecated`, và các nhánh 4 vòng bị chạm) trước khi sang Bước 5.

### Bước 5: Sửa TC Tại Chỗ (Chỉ Chạy Ở Mode `APPLY` Sau Khi Duyệt)
1. **Sao lưu bắt buộc:** Copy bản hiện tại sang `docs/testcases/<module>/archive/test_cases_<module>_v<N>.md`.
2. **Sửa tại chỗ** trong `test_cases_<module>.md` (hoặc `parts/part_NN_*.md`):
   - TC bị gỡ → giữ nguyên dòng và `TC ID`, đánh dấu: `| CRM_PRJ_TC_031 | ... | 🗑️ Deprecated — gỡ theo TICKET-123 (2026-08-17) |`.
   - TC negative/boundary mới phát sinh từ REQ `🟡` → cấp `TC ID` nối tiếp cuối dải hiện có.
3. Cập nhật **Bảng Đối Soát Coverage** ở index (REQ `🔴` ghi lý do không còn TC active; REQ `🟡` có ≥1 TC active).
4. Cập nhật **Bảng Đối soát loại kiểm thử (4 vòng)** và **Bảng ISO 25010** ở cuối index — **chỉ cập nhật đúng những nhánh/đặc tính mà ticket chạm tới**, giữ nguyên phần còn lại.

### Bước 6: 🛡️ Quality Gate DELTA (7 Tiêu Chí Bắt Buộc)
- [ ] **1.** Mọi `TC ID` giữ nguyên — không TC nào bị đổi số, đánh lại từ `001`, hay chèn số vào giữa dải.
- [ ] **2.** Tên file index (`test_cases_<module>.md`) không đổi — không sinh `_improved` / `_v2` ngoài `archive/`, và đã có bản sao lưu trong `archive/`.
- [ ] **3.** Không dòng TC nào bị xoá — mọi TC của chức năng gỡ đều mang `🗑️ Deprecated` kèm mã ticket.
- [ ] **4.** Bảng Đối Soát Coverage khớp lại: mọi REQ `🟡` active có ≥1 TC active.
- [ ] **5.** Bảng Đối soát loại kiểm thử (4 vòng) đã cập nhật **đúng những nhánh ticket chạm tới** (ticket đụng màn hình thì `V1 · UI cơ bản` phải được cập nhật), giữ nguyên phần còn lại.
- [ ] **6.** Số TC trong index khớp tổng của các `parts/` (nếu có tách) và `docs/testcases/README.md` đã được cập nhật.
- [ ] **7.** Đã ghi **Nhật ký thay đổi** ở cuối file TC và xuất **Delta TC List** (có cột `Vòng · Nhánh`) ra chat.

### Bước 7: Ghi Nhật Ký Thay Đổi & Xuất Delta TC List

1. Ghi vào cuối `docs/testcases/<module>/test_cases_<module>.md`:
   ```markdown
   ## Nhật ký thay đổi

   | Ngày | Ticket | TC bị ảnh hưởng | Thay đổi | Bản sao lưu |
   |---|---|---|---|---|
   | 2026-08-17 | TICKET-123 | CRM_PRJ_TC_002 | V1 · UI cơ bản: thêm dòng bảng kiểm cho field `Deadline`, cập nhật thứ tự field | `archive/test_cases_project_v2.md` |
   | 2026-08-17 | TICKET-123 | CRM_PRJ_TC_018 | V2 · Required: Deadline tuỳ chọn → bắt buộc — sửa expected result + thêm TC_077 negative | ↑ |
   | 2026-08-17 | TICKET-123 | CRM_PRJ_TC_031 | 🗑️ Deprecated — chức năng Copy Project đã gỡ | ↑ |
   ```
2. Xuất **Delta TC List** ra chat (input trực tiếp cho `/update-automation-from-impact`):
   ```markdown
   ## Delta TC List — TICKET-123 · 2026-08-17

   | TC ID | Vòng · Nhánh | Hành động đã làm | Đổi cái gì (cho automation) |
   |---|---|---|---|
   | CRM_PRJ_TC_002 | V1 · UI cơ bản | ✏️ Đã sửa | Thêm dòng bảng kiểm cho field `Deadline` → sửa assertion danh sách thành phần màn hình |
   | CRM_PRJ_TC_018 | V2 · Required | ✏️ Đã sửa | Expected result: giờ báo lỗi khi Deadline trống → sửa assertion |
   | CRM_PRJ_TC_077 | V2 · Required | ➕ Mới (trong REQ 🟡) | TC negative mới → cần viết script mới |
   | CRM_PRJ_TC_031 | V2 · Save/Edit/Delete | 🗑️ Deprecated | Script tương ứng đánh dấu skip, KHÔNG xoá file |

   ### Ngoài phạm vi
   | REQ | Việc còn lại | Command |
   |---|---|---|
   | REQ-PRJ-79 → 81 | Chưa có TC | `/generate-testcases-manual-rbt` |
   ```
3. Nhắc chuỗi tiếp theo: `/update-automation-from-impact` → `/generate-traceability-matrix`.
