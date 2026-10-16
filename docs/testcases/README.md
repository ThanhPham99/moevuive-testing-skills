# Danh mục Test Cases — Perfex CRM (Anh Tester Demo)

> **Điểm vào tầng test case.** Mọi workflow đụng tới `docs/testcases/` đọc file này **trước tiên**: module nào đã có TC · **dải TC ID nào đã bị chiếm** · mã kế tiếp · độ phủ so với requirements.

| Mục | Giá trị |
|---|---|
| Hệ thống | Perfex CRM — Anh Tester Demo (`https://crm.anhtester.com`) |
| Tiền tố TC ID | `CRM_` → `CRM_<MODULE>_TC_<3 số>` |
| Nguồn requirements | [`docs/requirements/README.md`](../requirements/README.md) |
| Môi trường | ⚠️ **Dùng chung** — TC phải chỉ đọc hoặc hoàn tác được; cấm thao tác phá huỷ dữ liệu nghiệp vụ |
| Ngày cập nhật | 2026-08-20 |

---

## 1. Danh mục module đã có test cases

| Module | Prefix TC ID | Dải đã dùng | Mã kế tiếp | Số TC | Độ hạt | REQ bao phủ | Tài liệu | Cập nhật |
|---|---|---|---|---|---|---|---|---|
| Đăng nhập / Xác thực | `CRM_LOGIN_TC_` | `001` → `050` | `051` | 50 | GỘP | 39/39 REQ trong phạm vi | [test_cases_login.md](login/test_cases_login.md) | 2026-09-11 |

### Namespace hệ thống khác

| Namespace | Hệ thống | Trạng thái |
|---|---|---|
| `_book-api/` | Book API (hệ thống thứ hai) | Thư mục đã tạo, **chưa có TC nào** — danh mục riêng sẽ nằm ở `_book-api/README.md` |


### Độ hạt test case của từng module

| Module | Độ hạt | Vì sao | Bản đối chiếu |
|---|---|---|---|
| `LOGIN` | **GỘP** | Biến thể cùng một trường nằm chung 1 TC dưới dạng Bảng biến thể — 50 TC (41 gốc + 9 bổ sung theo 4 vòng) · **70 biến thể** | Bản TÁCH 82 TC và bản 41 TC trước khi bổ sung đều lưu ở `login/archive/` |

> Chọn độ hạt ở **lượt sinh đầu tiên**: `/generate-testcases-from-requirements <đường dẫn> [GỘP|TÁCH]`. Mặc định `GỘP`. Đổi độ hạt sau khi đã có automation / execution report / RTM trỏ vào là **cấm** — xem mục **Độ Hạt Test Case** trong skill.

---

## 2. Độ phủ so với requirements

| Module | REQ có tài liệu | REQ trong phạm vi TC | REQ đã có ≥1 TC | Độ phủ | Ghi chú |
|---|---|---|---|---|---|
| `LOGIN` | 43 | 39 | 39 | **100%** | 4 REQ ngoài phạm vi theo quyết định PO 2026-08-18: `27`, `34`, `35`, `40` |
| `CUST` | 79 | — | 0 | 0% | Chưa sinh TC |
| `PRJ` | 104 | — | 0 | 0% | Chưa sinh TC |

> Các module còn lại đã cấp prefix REQ nhưng **chưa recon requirements** — xem `docs/requirements/README.md`.

---

## 3. Cấu trúc thư mục chuẩn

```
docs/testcases/
├── README.md                                   ← FILE NÀY — danh mục toàn hệ thống
└── <module>/
    ├── test_cases_<module>.md                  ← INDEX — TÊN FILE BẤT BIẾN
    ├── parts/part_NN_<slug>.md                 ← khi tách (>40 TC TÁCH · >50 TC GỘP)
    ├── impact/impact_plan_<TICKET-ID>.md       ← Mode DELTA
    └── archive/test_cases_<module>_vN.md       ← phiên bản cũ
```

**Quy tắc bất biến:**

| Quy tắc | Lý do |
|---|---|
| Tên index **luôn** `test_cases_<module>.md` | `/execute-test-cases`, `/review-testcases`, `/generate-automation-from-testcases`, `/generate-traceability-matrix` đều đọc theo mẫu đường dẫn cố định |
| **KHÔNG** nhét số phiên bản vào tên index (`_v2`, `_new`, `_improved`) | Bản mới **thay thế** index; bản cũ vào `archive/` |
| **KHÔNG đổi / đánh lại TC ID** khi cập nhật | TC ID là khoá nối sang `allure.label('testId', ...)`, cột TC ID của RTM, và execution report cũ |
| **KHÔNG xoá dòng TC** — chức năng gỡ thì đổi trạng thái 🗑️ Deprecated kèm mã ticket | Xoá dòng làm script tương ứng thành orphan, không phát hiện được tự động |
| Module đã có TC mà requirements đổi → dùng **Mode DELTA** (`/update-testcases-from-impact`) | Chạy lại QUICK/FULL RBT là sinh bộ thứ hai, TC ID đánh lại từ `001` |
| Vượt ngưỡng thì tách `parts/`, cắt tại ranh giới nhóm chức năng — **>40 TC** ở độ hạt TÁCH, **>50 TC** ở độ hạt GỘP | Ngưỡng đếm theo số TC vì người review đọc lần lượt từng TC |

---

## 4. Kết quả thực thi

Kết quả chạy TC **không** nằm trong thư mục này — xem `docs/executions/`:

```
docs/executions/
├── test_summary_<mốc>_<timestamp>.md      ← báo cáo tổng hợp, cắt ngang mọi module
└── <module>/
    ├── run_<timestamp>/execution_report.md
    ├── retest_<timestamp>/retest_report.md
    └── analysis_<timestamp>.md
```

Xem nhanh bằng web viewer: `scripts/execution-viewer/bundle.html` (mở offline, không cần cài gì).

---

## 5. Quy trình sử dụng

| Tình huống | Workflow | Ghi chú |
|---|---|---|
| Module **chưa có** TC, requirements đã rõ | `/generate-testcases-from-requirements` | Mode QUICK — 1 lượt |
| Module phức tạp, cần đánh giá rủi ro + RTM | `/generate-testcases-manual-rbt` | Mode FULL RBT — 6 bước có checkpoint |
| Cần checklist tick tay (smoke / hotfix / release) | `/generate-checklist-test` | Không sinh steps chi tiết |
| **Requirements vừa đổi, bộ TC đã có** | `/update-testcases-from-impact` | Mode DELTA — sửa tại chỗ, giữ nguyên TC ID |
| Chạy TC trên browser thật | `/execute-test-cases` | Xuất execution report vào `docs/executions/` |
| Review chất lượng TC | `/review-testcases` | Rubric 6 tiêu chí |
| Chuyển TC sang automation | `/generate-automation-from-testcases` | Map TC ID sang `allure.label('testId', ...)` |

---

## 6. Nhật ký danh mục

| Ngày | Thay đổi |
|---|---|
| 2026-09-11 | **Bổ sung 9 TC cho bộ `LOGIN` (`TC_042`→`TC_050`) theo Bản Đồ Loại Kiểm Thử 4 Vòng** — `TC_001`→`TC_041` **giữ nguyên hoàn toàn**, execution report `run_1787215085` và 6 bug đang mở vẫn truy vết đúng. Chấm bảng 4 vòng lên bộ TC đang có phát hiện **6 nhánh trống hoặc nông** trong khi Bảng Đối Soát Coverage vẫn xanh 39/39 REQ: `V2 · UI Behavior` (trống) · `V2 · BVA` (trống) · `V2 · Validation` chưa đối soát đủ mục bảng Email/Password · `V3 · Logging` (chưa chấm) · `V4 · Compatibility` (trống) · `V4 · Responsive` (chỉ có TC_033). Recon thật chốt mốc **64 ký tự** cho phần trước `@` (RFC 5321) và xác nhận ô mật khẩu không chặn dán, không có nút hiện/ẩn. Bổ sung **Bảng Đối soát loại kiểm thử (4 vòng)** + **Bảng ISO/IEC 25010:2023** vào cuối tài liệu TC. ⚠️ Phát hiện của `TC_046` cho thấy ca của bug `BUG_login_1787226515_TC018` là **ranh giới chuẩn RFC, không phải lỗi** — đề nghị xem lại bug đó. Khung 4 vòng đã vào skill `skills-rbt-manual-testing` (tiêu chí 10 Self-Quality Gate) và 5 command |
| 2026-08-20 | **Viết lại ngôn ngữ kiểm chứng của bộ TC `LOGIN`** theo phản hồi người dùng: TC chứa quá nhiều kiểm chứng thuộc tính HTML mà tester không cần. Toàn bộ `document.*`, `checkValidity()`, `className`, `offsetParent`, selector CSS, mã HTTP và tab Network được gỡ khỏi phần chính; nội dung cấp kỹ thuật tách xuống dòng `🔧 Ghi chú kỹ thuật (cần DevTools)` và TC gắn tag `@TechCheck` (23/41 TC). **TC ID giữ nguyên `001`→`041`**, không cắt case nào, độ phủ vẫn 39/39 REQ. Luật gốc đã vào skill `skills-rbt-manual-testing` mục **Quy Tắc Ngôn Ngữ Kiểm Chứng** + tiêu chí 8 của Self-Quality Gate, và 2 command sinh TC — lần sinh sau không lặp lại lỗi này |
| 2026-08-20 | **Gộp lại bộ TC `LOGIN`: 82 TC → 41 TC** theo yêu cầu người dùng. Độ phủ REQ không đổi (39/39), không case nào bị bỏ — chỉ đổi cách trình bày sang Bảng biến thể. TC ID đánh lại từ `001` (chấp nhận được vì chưa có script / execution report / RTM nào trỏ vào). Bản TÁCH cũ lưu ở `login/archive/`. Skill và 3 command đã bổ sung tuỳ chọn độ hạt **GỘP / TÁCH** |
| 2026-08-20 | Sinh bộ TC module `LOGIN` bằng `/generate-testcases-from-requirements` Mode QUICK — **82 TC**, 3 part, phủ 39/39 REQ trong phạm vi. Chiếm dải `CRM_LOGIN_TC_001` → `082`. 2 TC (`TC_036`, `TC_063`) **thiết kế để FAIL** theo `REQ-LOGIN-16` và `REQ-LOGIN-25` — chờ mở bug. 10 TC gắn `@NeedsVerify` chờ recon bổ sung |
| 2026-08-20 | Khởi tạo file danh mục. Chốt tiền tố TC ID `CRM_` cho toàn hệ thống, nhất quán với `docs/requirements/README.md` |
