# Mode 3: CHECKLIST — Sinh Danh Sách Rà Soát Tick Tay

> **Mục đích:** Sinh **checklist ngắn gọn để tick tay** khi cần chạy nhanh — smoke trước release, bàn giao cho tester thủ công, rà soát sau hotfix, hoặc regression cấp module. Mỗi mục là **1 dòng kiểm tra được trong ≤ 2 phút**, KHÔNG phải test case có steps đánh số.
> **Áp dụng cho:** `/generate-checklist-test` (Mode `CHECKLIST`).

---

## 1. Ranh Giới Với Mode QUICK / FULL RBT & Lưu Ý Viewer

- **Checklist trả lời *"đã rà hết chưa?"*, Test Case trả lời *"rà bằng cách nào?"*.** Nếu user cần steps chi tiết, test data đầy đủ, import Jira/TestRail hay giao cho automation → chuyển sang Mode `QUICK` (`/generate-testcases-from-requirements`) hoặc `FULL RBT` (`/generate-testcases-manual-rbt`).
- 📄 **Checklist là tài liệu đọc/in trực tiếp (`docs/checklists/checklist_<loại>_<module>.md`), KHÔNG nạp vào `scripts/testcases-viewer`.** Viewer chỉ đọc bảng test case 13 cột (`test_cases_*.md`); vì vậy bảng checklist được phép dùng tên cột Tiếng Việt thân thiện với người tick tay (`Hạng mục kiểm tra`, `Kết quả kỳ vọng`, `TC ID liên quan`).

---

## 2. Hai Nguồn Input (Ưu Tiên `TC-based` Khi Đã Có Bộ TC)

| Nguồn | Khi nào dùng | Cách làm |
|---|---|---|
| **TC-based** *(ưu tiên)* | Đã có file `docs/testcases/<module>/test_cases_<module>.md` | **Rút gọn** từ bộ TC sẵn có — gom nhóm TC cùng chủ đề thành 1 mục, giữ cột `TC ID liên quan` để truy ngược |
| **REQ-based** | Chưa có bộ TC, chỉ có requirements / UI | Rút mục trực tiếp từ requirements + 3 bảng checklist tham chiếu của skill; cột `TC ID liên quan` ghi `—` |

> Đã có bộ TC mà vẫn sinh mới từ đầu sẽ gây lệch nội dung với bộ TC gốc.

---

## 3. Bốn Loại Checklist, Quy Mô Khuyến Nghị & Lấy Mục Theo Vòng

Agent **BẮT BUỘC** hỏi hoặc suy ra loại checklist và ghi rõ ở đầu output:

| Loại checklist | Mục đích | Số mục | Thời gian chạy tay | Lấy mục từ vòng nào | Bỏ qua |
|---|---|---|---|---|---|
| **Smoke** | Xác nhận build chạy được, luồng sống còn không vỡ | 10–20 | ≤ 15 phút | **Chỉ V1** — UI cơ bản · mở form · hiển thị · nhập hợp lệ · lưu · đối chiếu dữ liệu | Toàn bộ V2–V4 |
| **Post-hotfix** | Rà vùng ảnh hưởng của bản vá + vùng lân cận | 5–15 | ≤ 10 phút | V1 của vùng vá + nhánh V2 mà bản vá chạm tới | V3 · V4 |
| **Regression (module)** | Rà toàn bộ 1 module trước khi bàn giao | 20–40 | ≤ 45 phút | V1 + V2 đầy đủ + nhánh V3 `Permission` | V4 (trừ `Regression` nếu module có bug cũ) |
| **Release-readiness** | Rà toàn hệ thống trước khi lên production | 30–60 | ≤ 60 phút | V1 + nhánh sống còn của V2 + `Permission`/`Security` (V3) + `E2E` (V4) | Phần còn lại của V3 · V4 |

> - Checklist **không** chấm bảng đối soát 4 vòng hay bảng ISO 25010 ở cuối file, nhưng bắt buộc lấy mục theo đúng vòng ở bảng trên (Checklist Smoke mà có validation biên hay bảng quyết định là sai loại).
> - Vượt ngưỡng số mục → **BẮT BUỘC** tách theo module hoặc hạ scope (ghi rõ phần đã cắt), KHÔNG xuất checklist dài lê thê làm mất tác dụng rà nhanh.

---

## 4. Quy Trình Thực Hiện (1 Lượt Duy Nhất, Bước 0–8)

0. **Mở evidence (`docs/requirements/<module>/evidence/`):** Đọc ảnh bằng `Read` để lấy đúng nhãn nút và dấu hiệu quan sát được trên UI (sai 1 chữ là người chạy tick nhầm). Nếu nguồn là `TC-based`, chỉ cần mở lại ảnh của các màn hình có mặt trong checklist.
1. **Xác định loại checklist** (`Smoke` / `Post-hotfix` / `Regression` / `Release-readiness`) và **nguồn input** (`TC-based` hay `REQ-based`).
2. **Xác định scope:** Module nào, luồng nào, role nào. Với `Post-hotfix`, khoanh rõ **vùng ảnh hưởng** của bản vá + vùng lân cận có rủi ro hồi quy.
3. **Rút mục từ 3 bảng tham chiếu chuẩn** — chỉ lấy mục thực sự áp dụng cho module:
   - [`FIELD_VALIDATION_15_TYPES.md`](FIELD_VALIDATION_15_TYPES.md): chỉ lấy **1–2 mục đại diện rủi ro cao nhất** cho mỗi field quan trọng (KHÔNG liệt kê hết mọi validation).
   - [`COMPONENT_CHECKLIST.md`](COMPONENT_CHECKLIST.md): Giao diện tĩnh, Data Table/List, CRUD Lifecycle, Permission/Role, Modal/Dialog, Notification, Status Flow.
   - [`ISO_25010_CHECKLIST.md`](ISO_25010_CHECKLIST.md) (Mục 3): Race condition/Double submit, Session & Network, Localization & UTF-8, A11y bàn phím.
4. **Ưu tiên theo rủi ro:** Luồng liên quan **tiền, phân quyền, mất dữ liệu** luôn phải có mặt (gắn `P1`) dù ở loại checklist nào.
5. **Viết từng mục theo Quy Tắc Viết Mục Checklist** (mục 5 bên dưới).
6. **Gắn metadata:** `Priority` (`P1`/`P2`/`P3`), `REQ ID` (nếu có), `TC ID liên quan` (nếu `TC-based`, không có ghi `—`).
7. **Nhóm mục theo `Module → Nhóm chức năng`**, đánh số `#` liên tục để dễ đối chiếu khi báo cáo.
8. **Chạy Checklist Quality Gate (4 tiêu chí)** và **ghi thẳng vào file** `docs/checklists/checklist_<loại>_<module>.md` (Write-first: chat chỉ báo tổng số mục + đường dẫn file, không in cả bảng ra chat trừ khi user yêu cầu). Không ghi đè lên checklist loại khác của cùng module.

---

## 5. Quy Tắc Viết Mục Checklist (BẮT BUỘC)

- **Mỗi mục 1 dòng, ≤ 20 từ**, bắt đầu bằng **động từ** (`Đăng nhập`, `Tạo`, `Sửa`, `Xóa`, `Lọc`, `Xuất`...).
- **Verify được trong ≤ 2 phút** bởi người chưa đọc requirements.
- **Có kết quả kỳ vọng quan sát được trên UI** — cấm viết *"hoạt động đúng / bình thường / OK"*.
- **Test data cụ thể** ở mục phụ thuộc dữ liệu (`test.domain.com`, `/admin/settings`).
- **KHÔNG viết steps đánh số** — nếu một mục cần `> 3 thao tác` mới verify được thì tách nhỏ hoặc chuyển sang Mode `QUICK`.

```markdown
❌ Sai: "Kiểm tra chức năng khách hàng hoạt động tốt"
✅ Đúng: "Tạo KH mới với đủ field bắt buộc → xuất hiện đầu danh sách, đúng tên vừa nhập"

❌ Sai: "Test phân quyền"
✅ Đúng: "Đăng nhập role Sale, mở URL /admin/settings trực tiếp → bị chặn, về trang 403"

❌ Sai: "Kiểm tra validate email"
✅ Đúng: "Nhập email thiếu @ (`test.domain.com`) → hiện lỗi 'Email không hợp lệ', không submit"
```

---

## 6. Bảng Output Standard & Bảng Ký Nhận

```markdown
## [Tên Module] — Checklist <Loại> (<số mục> mục · ~<thời gian> phút)

**Nguồn:** TC-based (`docs/testcases/<module>/test_cases_<module>.md`) | REQ-based
**Scope:** <module / luồng / role>

### Nhóm: <Tên nhóm chức năng>

| # | ✅ | Hạng mục kiểm tra | Kết quả kỳ vọng | Priority | REQ ID | TC ID liên quan |
|---|---|---|---|---|---|---|
| 1 | ☐ | Đăng nhập bằng tài khoản admin hợp lệ | Vào /dashboard, hiển thị tên user góc phải | P1 | REQ-LOGIN-01 | CRM_LOGIN_TC_001 |
| 2 | ☐ | Đăng nhập sai mật khẩu 5 lần liên tiếp | Tài khoản bị khóa, hiện thông báo khóa | P1 | REQ-LOGIN-02 | CRM_LOGIN_TC_012 |

### Không áp dụng cho module này
- <Component có trong bảng chuẩn nhưng module không có> — lý do kỹ thuật

### Ký nhận

| Môi trường | Build / Version | Người thực hiện | Ngày | Kết quả (Pass/Fail/Blocked) |
|---|---|---|---|---|
|  |  |  |  |  |
```

> Cột `✅` luôn để trống ô tick `☐` để người chạy tự đánh dấu.

---

## 7. 🛡️ Checklist Quality Gate (4 Tiêu Chí) & Điều Kiện Chuyển Mode

Trước khi xuất file, agent **BẮT BUỘC** tự rà đủ 4 tiêu chí:

- [ ] **1. Verify được:** 100% mục có kết quả kỳ vọng quan sát được trên UI, không còn từ *"hoạt động đúng / bình thường / OK"*.
- [ ] **2. Critical path đủ:** Mọi luồng sống còn của module (đăng nhập, tạo/sửa/xóa bản ghi chính, phân quyền, thanh toán nếu có) đều có ≥1 mục `P1`.
- [ ] **3. Component đủ:** Mỗi component có mặt trong module (`Table/List`, `CRUD`, `Permission`, `Modal`, `Notification`, `Status Flow`) có ≥1 mục; component không có trong module được ghi rõ ở mục `"Không áp dụng cho module này"`, không lặng lẽ bỏ qua.
- [ ] **4. Đúng quy mô:** Số mục nằm trong ngưỡng của loại checklist đã chọn (`Smoke` 10–20 · `Post-hotfix` 5–15 · `Regression` 20–40 · `Release-readiness` 30–60).

**Khi nào đề xuất chuyển sang workflow khác:**

| Dấu hiệu phát hiện | Chuyển sang command |
|---|---|
| User cần steps chi tiết / test data đầy đủ / import Jira-TestRail | `/generate-testcases-from-requirements` (Mode `QUICK`) |
| Scope lớn, requirements mơ hồ, cần Risk Assessment hoặc Traceability Matrix | `/generate-testcases-manual-rbt` (Mode `FULL RBT`) |
| Đã có bộ TC nhưng chất lượng kém, cần đánh giá trước khi rút gọn | `/review-testcases` |
