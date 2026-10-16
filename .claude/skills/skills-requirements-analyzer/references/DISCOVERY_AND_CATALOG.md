# Tầng Khám Phá Hệ Thống & Danh Mục Toàn Hệ Thống (`_discovery/` & `README.md`)

Tài liệu tham chiếu cho nhánh **System Discovery** (`/discover-system`), khởi tạo & đối chiếu **Module Catalog** (`docs/requirements/README.md`), đọc **Discovery Map** (`_discovery/system_map.md` / `api_map.md`), và quản lý đa hệ thống (`_<hệ-thống>/`).

---

## 1. Danh mục toàn hệ thống — `docs/requirements/README.md` (Module Catalog)

### 1.1. Khởi tạo khi chưa tồn tại (BẮT BUỘC — dự án mới)

> ⚠️ Không có `docs/requirements/README.md` thì cơ chế đọc prefix đã chiếm và nối tiếp mã REQ (mục 2 của `SKILL.md`) im lặng mất tác dụng.

**Trước khi ghi tài liệu module ĐẦU TIÊN của một dự án:**
1. Kiểm tra `docs/requirements/README.md` có tồn tại không.
2. **Nếu CHƯA có** → tạo ngay từ cấu trúc mục 1.2 với bảng danh mục rỗng (chỉ có dòng tiêu đề).
3. Ghi tài liệu module đầu tiên (`docs/requirements/<module>/requirements_<module>.md`).
4. Bổ sung dòng đầu tiên vào bảng danh mục `docs/requirements/README.md`.

### 1.2. Nội dung bắt buộc của `docs/requirements/README.md`

File danh mục là **điểm vào cấp hệ thống** (Tầng 1 trong quy tắc đọc 3 tầng), cập nhật mỗi khi có module mới hoặc REQ mới:

| Mục | Nội dung bắt buộc |
|---|---|
| **Bảng thuộc tính đầu file** | `Hệ thống` · `Tiền tố TC ID` (`CRM_`, `ERP_`…) · `Môi trường dùng chung` (`CÓ`/`KHÔNG`) · `URL · tài khoản` (chỉ trỏ `.env`, cấm ghi credentials) · `Vai trò hệ thống` · **`Năng lực kiểm thử của QA`** (chốt 1 lần cho nhánh Vòng 3 của mọi bộ TC: Gọi API · Truy vấn CSDL · Kiểm tầng tích hợp · Xem nhật ký hoạt động — kiểm chứng được thì đo thật kèm ngày · DevTools trình duyệt) · `Khởi tạo` |
| **1. Bảng danh mục module** | `Module \| Prefix \| Trạng thái recon \| Mức phủ tài liệu \| Tài liệu \| REQ đã dùng \| Mã kế tiếp \| AMB treo \| Story \| Cập nhật` |
| **Danh sách prefix đã chiếm** | Khối liệt kê toàn bộ prefix đã cấp (`LOGIN · CUST · PRJ…`). Module mới **phải** chọn prefix ngoài danh sách này |
| **Vùng chưa cấp prefix** | Các vùng bị chặn quyền (`403`), ngoài phạm vi đợt khảo sát, hoặc cổng phụ chưa chốt phạm vi |
| **2. Trạng thái REQ toàn hệ thống** | Tổng hợp số lượng REQ theo `🟢 Active` · `🟡 Changed` · `🔴 Deprecated` · `⚪ Chưa implement` + dòng `Tổng` |
| **3. Ambiguity 🔴 High còn treo** | Gom toàn bộ `AMB-XX` mức 🔴 High đang chặn tiến độ từ mọi module + vấn đề cấp hệ thống để hỏi PO một lần |
| **4. Cấu trúc thư mục chuẩn** | Sơ đồ cây thư mục của `docs/requirements/` |
| **5. Quy trình sử dụng** | Bảng ánh xạ tình huống → workflow → nơi ghi file + Thứ tự recon đã chốt |
| **6. Nhật ký danh mục** | Lịch sử thay đổi cấp cấu trúc, recon module mới, hoặc kết quả đối chiếu danh mục |

**Bảng mã trạng thái recon & mức phủ tài liệu:**
- **Trạng thái recon:** `⬜ Chưa khảo sát` (mới phát hiện tên, chờ `/generate-requirements-from-website`) · `🟨 Đang khảo sát` · `✅ Đã có tài liệu` (`requirements_<module>.md` đã phát hành) · `⏸️ Hoãn` (ngoài phạm vi, giữ prefix) · `⚪ Chưa implement` (phát hiện qua tài liệu/API, UI chưa có; viết TC trước đánh `skip`).
- **Mức phủ tài liệu:** `🟩 Đầy đủ` · `🟨 Một phần` · `⬜ Trắng` · `⚠️ Nghi lỗi thời`.

### 1.3. Đối chiếu danh mục (`README.md` ↔ thư mục thực tế — BẮT BUỘC)

Danh mục là **bản phái sinh**, còn `docs/requirements/*/requirements_*.md` là **nguồn sự thật**. Chạy đối chiếu ở Bước 1 của `/discover-system` và Bước cuối của `/generate-requirements-from-website`:

1. Glob `docs/requirements/*/requirements_*.md` → danh sách module có thật trên đĩa.
2. Đọc bảng danh mục mục 1 của `docs/requirements/README.md` → danh sách module đã khai báo.
3. So hai danh sách theo 4 điểm kiểm:

| Điểm kiểm | Cách phát hiện | Xử lý bắt buộc |
|---|---|---|
| **Module có tài liệu nhưng thiếu ở danh mục** | Có thư mục + file index, thiếu dòng ở bảng mục 1 | Thêm dòng — lấy `Prefix`, `REQ đã dùng`, `Mã kế tiếp` **từ chính tài liệu module**, không đoán. `Trạng thái recon` = `✅` |
| **Dòng danh mục trỏ tới module không có thư mục** | Có dòng ở bảng mục 1, chưa có thư mục module | **KHÔNG xoá dòng.** Đưa `Trạng thái recon` về `⬜` và ghi lý do ở Nhật ký danh mục — prefix đã cấp là vĩnh viễn |
| **`Mã kế tiếp` lệch với REQ cuối trong tài liệu** | Số REQ lớn nhất trong file module khác cột `Mã kế tiếp` | Sửa danh mục theo tài liệu module (**tài liệu module thắng**) |
| **Prefix trùng giữa 2 module** | Hai dòng cùng một prefix | ⛔ **DỪNG, báo user ngay** — agent KHÔNG tự đổi prefix vì sẽ làm gãy toàn bộ REQ ID và TC ID đã map |

4. Có sửa → ghi **1 dòng vào Nhật ký danh mục** (mục 6 của `README.md`). Không lệch → báo `Danh mục khớp với thư mục thực tế`.

---

## 2. Tầng khám phá — `docs/requirements/_discovery/` (Discovery Map)

### 2.1. Cấu trúc thư mục & Phân vai Tầng khám phá vs Tầng module

```text
docs/requirements/
├── README.md                              ← DANH MỤC toàn hệ thống (mục 1)
├── _discovery/                            ← TẦNG KHÁM PHÁ — cấp hệ thống (KHÔNG CÓ MÃ REQ)
│   ├── system_map.md                      ← INDEX BẤT BIẾN (hệ thống UI) — hoặc api_map.md (hệ thống API)
│   ├── modules/                           ← chỉ khi tách (> 8 module, xem 2.3)
│   │   └── module_NN_<slug>.md
│   ├── doc_inventory.md                   ← bản đồ phủ tài liệu (khi mode HYBRID / DOC)
│   ├── sources/                           ← bản gốc tài liệu QA cung cấp / snapshot openapi
│   └── evidence/                          ← 1 ảnh tổng quan mỗi module (<module>_overview_fullpage.png)
└── <module>/                              ← TẦNG MODULE — chứa requirements_<module>.md
```

| Tiêu chí | Tầng khám phá (`/discover-system`) | Tầng module (`skills-requirements-analyzer`) |
|---|---|---|
| **Đơn vị làm việc** | Toàn hệ thống | Một module cụ thể |
| **Cấp mã** | **Chỉ cấp Prefix** (`LOGIN`, `CUST`, `PRJ`…) | **Cấp số REQ** (`REQ-CUST-01`, `AMB-01`, `RISK-01`) |
| **Độ sâu** | Module tồn tại · route · loại màn hình · có CRUD/status flow không · ước số REQ | Từng field · từng rule · từng validation message · ma trận quyền/trạng thái chi tiết |
| **Evidence** | 1 ảnh full-page/module chứng minh module tồn tại | Chuẩn đầy đủ theo `UI_RECON_AND_EVIDENCE.md` |
| **Đầu ra** | `_discovery/system_map.md` + `README.md` | `<module>/requirements_<module>.md` |

> ❌ **Luật bất biến `_discovery/` no-REQ-ID:** Tầng khám phá **TUYỆT ĐỐI KHÔNG** sinh mã `REQ-XXX-NN`. Gán mã khi chưa mở từng form và chưa trigger validation chắc chắn dẫn tới đánh lại số — vi phạm tính bất biến của REQ ID.

### 2.2. Quy trình khám phá hệ thống (`/discover-system`)

1. **Đọc trạng thái hiện có (Bước 1):** Kiểm tra `docs/requirements/README.md`, `_discovery/system_map.md`, và chạy đối chiếu danh mục (mục 1.3). Không bao giờ ghi đè `README.md` hay `system_map.md` đã có.
2. **Nạp tài liệu (Mode `HYBRID` / `DOC`):** Đọc file theo đúng định dạng (ủy quyền skill `docx`/`xlsx`/`pdf`, không `Read` file nhị phân), lưu bản gốc vào `_discovery/sources/`, lập **Bản đồ phủ tài liệu** (`_discovery/doc_inventory.md`) với 4 mức: `🟩 Đầy đủ` · `🟨 Một phần` · `⬜ Trắng` · `⚠️ Nghi lỗi thời`.
3. **Crawl điều hướng & Network cấp hệ thống (Mode `UI` / `HYBRID`):**
   - Theo thứ tự `browser_navigate → chờ load → browser_snapshot` (mặc định **Headless Mode** `1920x1080`).
   - Mở cạn kiệt menu cấp 2/3, cuộn hết sidebar, gom `a[href]` bằng `browser_evaluate`, mở 1 bản ghi ở chế độ chỉ đọc (trên môi trường dùng chung: **chỉ đọc, tuyệt đối không bấm Save/Xoá**). Route đoán ra mà không mở được chỉ ghi `❔ Nghi có, chưa xác minh`, không đưa vào danh mục module.
   - Bật `browser_network_requests` thụ động để phát hiện module có API nhưng chưa có UI (`⚪ Chưa implement`), ranh giới entity thật, và enum trạng thái.
   - Chụp 1 ảnh `browser_take_screenshot(fullPage=true)` cho mỗi module lưu vào `_discovery/evidence/<module>_overview_fullpage.png`.
4. **Chuẩn hoá ranh giới module, gán Prefix & đánh giá Risk:**
   - **Ranh giới module:** 1 entity nghiệp vụ có vòng đời riêng = 1 module (`Customer` tách `Contact`); tab con không có entity riêng thì giữ chung (`17 tab của Project` = 1 module `PRJ`); tab con có entity + CRUD riêng thì tách (`INV`); màn hình cấu hình rời rạc gom thành `SETTING`; **nghi ngờ → gộp, đừng tách**.
   - **Đối chiếu tài liệu ↔ UI (Mode `HYBRID`):** lấy tên UI làm chuẩn (ghi tên tài liệu vào cột bí danh); ranh giới theo UI; tài liệu có mà UI chưa có → `⚪ Chưa implement`.
   - **Gán Prefix:** 3–6 ký tự IN HOA không dấu (`LOGIN`, `CUST`, `PRJ`), suy từ tên nghiệp vụ (không suy từ URL), không trùng danh sách prefix đã chiếm.
   - **Risk sơ bộ:** `🔴 Cao` (tiền/quyền/dữ liệu khách hàng, nhiều phụ thuộc, status flow phức tạp, tài liệu `⬜ Trắng`) · `🟡 Trung bình` (CRUD thường, tài liệu `🟨`) · `🟢 Thấp` (tra cứu tĩnh, ít đổi, tài liệu `🟩`).

### 2.3. Quy tắc tách/gộp file bản đồ khám phá (`system_map.md` + `modules/module_NN_<slug>.md`)

- **Ngưỡng tách file bản đồ** (đếm số module sau khi user chốt ở Checkpoint):
  - `≤ 8 module`: 1 file `_discovery/system_map.md`.
  - `> 8 module` (hoặc có module ≥ 5 tab con / ≥ 30 field, chia theo phân hệ rõ rệt, hoặc nhiều người khảo sát song song): tách thành `system_map.md` (index bất biến) + `modules/module_NN_<slug>.md`.
- **Hợp đồng đọc khi tách:** `system_map.md` **BẮT BUỘC** có mục `## Bản đồ tài liệu`:
  ```markdown
  ## Bản đồ tài liệu
  | File | Module bao phủ | Prefix | Trạng thái recon |
  |---|---|---|---|
  | [modules/module_01_dang_nhap_phan_quyen.md](modules/module_01_dang_nhap_phan_quyen.md) | Đăng nhập · Người dùng · Vai trò | `LOGIN` · `USER` · `ROLE` | ⬜ ⬜ ⬜ |
  ```
- **Phân chia nội dung Index vs File module:**
  - **Index (`system_map.md`):** (1) Bối cảnh khảo sát · (2) Sơ đồ điều hướng toàn hệ thống · (3) Bảng module tổng · (4) Bản đồ entity & phụ thuộc + network cấp hệ thống · (5) Ma trận phân quyền sơ bộ cấp module · (6) Thứ tự khảo sát đã chốt + module `BLOCKED` · (7) Nhật ký khám phá · `## Bản đồ tài liệu`.
  - **File module (`modules/module_NN_<slug>.md`):** Chi tiết từng module (route, loại màn hình, CRUD, status flow, số tab, số field ước lượng, risk kèm lý do) · Phát hiện network riêng của module · Vùng chưa xác minh riêng · Link ảnh evidence.
- **Quy tắc đặt tên & gộp file khám phá:**
  - Đặt tên `module_NN_<slug>.md` (`NN` theo thứ tự khảo sát đã chốt, `<slug>` tiếng Việt không dấu mô tả đủ nhóm bên trong, VD `module_01_dang_nhap_phan_quyen.md`, không đặt tên cụt hay `_misc`).
  - Chỉ gộp tối đa **≤ 3 module** khi: quan hệ cha–con chặt (`Dự án` ↔ `Công việc`), luôn khảo sát cùng nhau (`LOGIN` ↔ `USER` ↔ `ROLE`), danh mục nhỏ cùng loại, hoặc cùng phân hệ ≤ 3 module. **Không gộp** 2 module `🔴 Cao` hoặc khác trạng thái recon (`⬜` vs `✅`).
- **6 Bất biến khi tách/gộp bản đồ khám phá:**
  - [ ] **Prefix giữ nguyên tuyệt đối** — gộp file khám phá **KHÔNG** gộp prefix và **KHÔNG** gộp `requirements_<module>.md` (3 module chung 1 file khám phá vẫn sinh 3 file `requirements_<module>.md` riêng).
  - [ ] **Mỗi module thuộc đúng 1 file** — không mồ côi, không trùng ở 2 file.
  - [ ] **Tổng module trong các file = tổng module ở bảng index**.
  - [ ] **Cột `Trạng thái recon` chỉ đặt ở `docs/requirements/README.md`** (file khám phá chỉ tham chiếu).
  - [ ] Link 2 chiều giữa `system_map.md` và từng `modules/module_NN_<slug>.md`.
  - [ ] Nội dung cắt ngang (mục 2, 4, 5, 6) không nhân bản vào file module.

### 2.4. Chế độ bổ sung (`Mode ADD`) & Chạy lại (`Mode DELTA`)

- **Mode ADD (User chỉ đích danh module bị sót):**
  1. Hỏi user đủ 2 thông tin: đường đi tới module (URL hoặc menu path) + lý do agent không thấy (thiếu quyền role cao hơn · menu cấp 3+ hover/click · route trực tiếp không nằm trên menu · chỉ mở từ dòng dữ liệu · danh sách rỗng thiếu data · ẩn sau feature flag).
  2. Thử truy cập thật:
     - `✅ Vào được`: khảo sát đầy đủ, ghi `Nguồn = UI thực tế`.
     - `❌ Không vào được (403 / thiếu data)`: vẫn thêm vào danh mục với `Trạng thái recon = ⬜`, ghi rõ ở mục 7 của index lý do chưa xác minh và `Nguồn = User cung cấp — chưa xác minh UI` (tuyệt đối không ghi như đã tự khảo sát).
  3. Cấp prefix mới (không trùng `README.md`), ghi vào file khám phá phù hợp, cập nhật 3 nơi (`system_map.md`, `README.md`, Nhật ký khám phá) và rà lại thứ tự khảo sát mục 6.
- **Mode DELTA (Hệ thống thay đổi hoặc rà lại toàn bộ):**
  1. Đọc `system_map.md` (và `modules/*` nếu có `## Bản đồ tài liệu`).
  2. Crawl lại và chỉ báo cáo **phần chênh** (module mới · module biến mất · route đổi · menu đổi tên).
  3. Module biến mất khỏi UI → **không xoá dòng**, chỉ đổi trạng thái + ghi chú ngày vào Nhật ký khám phá.
  4. Module mới: nếu bản đồ chưa tách và tổng ≤ 8 thì thêm vào `system_map.md`; vượt 8 thì tách file; nếu đã tách thì thêm vào nhóm có sẵn (khi ≤ 3 module) hoặc tạo `module_NN_<slug>.md` với `NN` kế tiếp (**không đổi tên file module cũ**).

### 2.5. Cách recon cấp module sử dụng tầng `_discovery/`

Ở đầu mỗi lần chạy `/generate-requirements-from-website`:
1. Đọc `_discovery/system_map.md` (và file con trong `modules/` nếu tách) → lấy route, loại màn hình, số tab, risk, vùng chưa xác minh của module.
2. Đọc `_discovery/doc_inventory.md` (nếu có) → lấy Bản đồ phủ tài liệu của module để chi tiết hoá xuống cấp vùng chức năng.
3. Lấy đúng **Prefix đã cấp** trong `docs/requirements/README.md` — không tự đặt lại.
4. Sau khi recon xong: cập nhật `Trạng thái recon` trong `README.md` sang `✅ Đã có tài liệu`, và ghi 1 dòng vào Nhật ký khám phá của `system_map.md` nếu phát hiện thực tế lệch với bản đồ ban đầu.

---

## 3. Đa hệ thống trong cùng Repo (`_<hệ-thống>/`) & Nhánh API (`api_map.md`)

### 3.1. Namespace `_<hệ-thống>/` cho hệ thống thứ hai trở đi

Mặc định `docs/requirements/` phục vụ hệ thống đầu tiên. Khi repo chứa hệ thống thứ hai trở đi, đặt trong thư mục có dấu `_` đứng đầu để tách biệt hoàn toàn:

```text
docs/requirements/README.md                      ← Hệ thống MẶC ĐỊNH
docs/requirements/<module>/requirements_<module>.md
docs/requirements/_book-api/                     ← HỆ THỐNG THỨ HAI (namespace _<hệ-thống>/)
├── README.md                                    ← Danh mục riêng (prefix, TC ID, AMB riêng)
├── _discovery/api_map.md                        ← Hoặc system_map.md nếu hệ thống có UI
└── <module>/requirements_<module>.md
```

- **Quy tắc bất biến:** Dấu `_` đầu tên báo hiệu không phải thư mục module. Mỗi namespace có `README.md` danh mục riêng. Mã REQ và TC ID của hệ thống thứ hai mang tiền tố hệ thống: `REQ-<HỆ_THỐNG>-<MODULE>-<nn>` và `<HỆ_THỐNG>_<MODULE>_TC_<nnn>` (hệ thống mặc định giữ nguyên `REQ-<MODULE>-<nn>`).

### 3.2. Nhánh hệ thống REST API (`_discovery/api_map.md`)

Hệ thống chỉ có OpenAPI/Swagger spec (không có UI) được xử lý bởi `/generate-api-tests-from-swagger` với 3 điểm khác biệt so với hệ thống UI:
- **File index tầng khám phá:** `_discovery/api_map.md` (tên file bất biến, thay cho `system_map.md`).
- **Bằng chứng khảo sát:** `_discovery/sources/openapi_<ngày>.json` kèm request/response kiểm chứng thật chép trong tài liệu (thay cho `evidence/*.png`).
- **Ranh giới module:** chia theo `tags` của OpenAPI spec (thay cho menu điều hướng).
