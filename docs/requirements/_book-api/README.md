# Danh mục Requirements — AnhTester Book Management API

> **Điểm vào của hệ thống Book API.** Mọi workflow đụng tới `docs/**/_book-api/` đọc file này **trước tiên**: module nào đã có tài liệu · **prefix nào đã bị chiếm** · mã REQ kế tiếp · ambiguity 🔴 còn treo.
>
> Bản đồ API chi tiết: [`_discovery/api_map.md`](_discovery/api_map.md)

> ⚠️ **Đây là hệ thống RIÊNG, không liên quan Perfex CRM.** Repo này chứa 2 hệ thống độc lập. Danh mục CRM nằm ở [`../README.md`](../README.md) và **không dùng chung dải prefix, mã REQ hay TC ID** với hệ thống này.

| Mục | Giá trị |
|---|---|
| Hệ thống | AnhTester Book Management API |
| Mã hệ thống | `BK` |
| Loại | REST API (OpenAPI 3.0.0) — không có UI trong phạm vi |
| Tiền tố REQ | `REQ-BK-<MODULE>-<nn>` |
| Tiền tố TC ID | `BK_<MODULE>_TC_<3 số>` |
| Base URL | `https://book.anhtester.com` — **Production, 1 server duy nhất** |
| Môi trường dùng chung | **KHÔNG** — user chốt 2026-08-14: được thao tác phá huỷ thoải mái |
| URL · tài khoản | `.env` (không commit) — **KHÔNG** ghi credentials vào `docs/` |
| Khởi tạo | 2026-08-14 — parse spec + kiểm chứng 20 request thật |

---

## 1. Bảng danh mục module (8 module)

| Module | Mã | Số endpoint | Trạng thái | Tài liệu | REQ đã dùng | Mã kế tiếp | AMB treo | Cập nhật |
|---|---|---|---|---|---|---|---|---|
| Xác thực & Phiên đăng nhập | `AUTH` | 6 | 🟨 Đã lập bản đồ | — | — | `REQ-BK-AUTH-01` | AMB-BK-01, 06 | 2026-08-14 |
| Người dùng | `USER` | 5 | 🟨 Đã lập bản đồ | — | — | `REQ-BK-USER-01` | AMB-BK-01, 02 | 2026-08-14 |
| Sách | `BOOK` | 5 | 🟨 Đã lập bản đồ | — | — | `REQ-BK-BOOK-01` | AMB-BK-03 | 2026-08-14 |
| Danh mục sách | `CAT` | 4 | 🟨 Đã lập bản đồ | — | — | `REQ-BK-CAT-01` | AMB-BK-05 | 2026-08-14 |
| Khuyến mãi | `PROMO` | 5 | 🟨 Đã lập bản đồ | — | — | `REQ-BK-PROMO-01` | AMB-BK-04, 09 | 2026-08-14 |
| Tệp tin | `FILE` | 7 | 🟨 Đã lập bản đồ | — | — | `REQ-BK-FILE-01` | AMB-BK-07 | 2026-08-14 |
| Địa chỉ hành chính | `ADDR` | 2 | 🟨 Đã lập bản đồ | — | — | `REQ-BK-ADDR-01` | — | 2026-08-14 |
| Tiện ích hệ thống | `SYS` | 1 | 🟨 Đã lập bản đồ | — | — | `REQ-BK-SYS-01` | — | 2026-08-14 |
| | | **35** | | | | | | |

**Bảng mã trạng thái:** ⬜ Chưa khảo sát · 🟨 Đã lập bản đồ (có catalog, chưa có REQ) · ✅ Đã có tài liệu REQ · ⏸️ Hoãn

### Prefix đã chiếm trong hệ thống `BK`

```
AUTH · USER · BOOK · CAT · PROMO · FILE · ADDR · SYS
```

Prefix của hệ thống CRM (`LOGIN`, `CUST`, `PRJ`…) **không liên quan** — hai hệ thống nằm ở hai namespace tách biệt, mã `BK` phía trước bảo đảm không bao giờ đụng nhau khi grep.

---

## 2. Trạng thái REQ toàn hệ thống

Đã lập bản đồ **8/8 module**, **chưa module nào có mã REQ**.

| Trạng thái | Số lượng |
|---|---|
| 🟢 Active | 0 |
| ⚪ Chưa sinh REQ | 35 endpoint |
| **Tổng** | **0 REQ** |

Ước lượng khi sinh REQ đầy đủ: **~180–260 REQ** cho 35 endpoint (mỗi endpoint 4–8 REQ: happy path · validation từng field · auth · boundary · response schema).

---

## 3. Ambiguity 🔴 High còn treo

| Mã | Module | Câu hỏi | Chặn cái gì |
|---|---|---|---|
| [AMB-BK-01](_discovery/api_map.md#4-khoảng-trống-của-spec-amb--cần-chốt-trước-khi-sinh-tc) | `AUTH` · `USER` · tất cả | Hệ thống có mô hình vai trò không? Ai được gọi endpoint nào? Spec khai `403` ở 6 endpoint nhưng thực tế user thường làm được mọi thứ | TC phân quyền của **mọi** module. Không chốt thì không biết F-02 là lỗi hay thiết kế |
| [AMB-BK-02](_discovery/api_map.md#4-khoảng-trống-của-spec-amb--cần-chốt-trước-khi-sinh-tc) | `USER` | `GET /api/user` công khai trả email/phone/address toàn bộ user — cố ý hay lỗi cấu hình? | F-01 viết thành TC bug hay TC xác nhận hành vi |

7 ambiguity mức 🟠/🟡 còn lại xem [`_discovery/api_map.md` mục 4](_discovery/api_map.md#4-khoảng-trống-của-spec-amb--cần-chốt-trước-khi-sinh-tc).

---

## 4. Phát hiện bảo mật đáng chú ý

Đã kiểm chứng bằng gọi thật, **không** phải suy đoán từ spec. Chi tiết + bằng chứng: [`_discovery/api_map.md` mục 3](_discovery/api_map.md#3-kết-quả-kiểm-chứng-bằng-gọi-thật).

| Mã | Mức | Tóm tắt |
|---|---|---|
| F-01 | 🔴 | `GET /api/user` công khai → rò rỉ email/phone/address toàn bộ user |
| F-02 | 🔴 | Không có phân quyền — user vừa đăng ký xoá/sửa được user khác, tạo được sách |
| F-03 | 🔴 | Cookie `accessToken` thiếu `HttpOnly`/`Secure`/`SameSite` |
| F-04 | 🟠 | `price` âm được chấp nhận |
| F-05 | 🟠 | `categories` không tồn tại vẫn tạo được sách |
| F-06 | 🟠 | Xoá user làm sách của họ mồ côi (`auth: null`) |
| F-07 | 🟠 | `POST /api/user` gán mật khẩu mặc định đoán được (`anhtester.com`) |

---

## 5. Cấu trúc thư mục

```
docs/
├── requirements/
│   ├── README.md                      ← danh mục Perfex CRM (hệ thống khác)
│   ├── login/ customers/ projects/    ← module CRM
│   └── _book-api/                     ← HỆ THỐNG NÀY
│       ├── README.md                  ← file này — DANH MỤC
│       ├── _discovery/
│       │   ├── api_map.md             ← INDEX bản đồ API — TÊN FILE BẤT BIẾN
│       │   └── sources/openapi_*.json ← snapshot spec gốc
│       └── <module>/                  ← sinh dần khi sinh REQ
│           └── requirements_<module>.md
└── testcases/
    └── _book-api/<module>/test_cases_<module>.md
```

> Dấu `_` đầu tên thư mục đánh dấu **"không phải module"** — cùng quy ước với `_discovery/`. Nhờ đó `_book-api/` không bị workflow nhầm là một module của CRM.

---

## 6. Quy trình sử dụng

| Tình huống | Workflow | Ghi vào đâu |
|---|---|---|
| Sinh REQ chi tiết cho 1 module API | `/analyze-requirement-document` với spec đã snapshot | `_book-api/<module>/requirements_<module>.md` + cập nhật bảng mục 1 |
| Sinh API test cases | `/generate-api-tests-from-swagger` (Mode SPEC) | `docs/testcases/_book-api/<module>/` |
| Sinh cả automation script | `/generate-api-tests-from-swagger` (Mode FULL) | Như trên + source code |
| Spec đổi phiên bản | Snapshot spec mới vào `_discovery/sources/`, so sánh với bản cũ | Nhật ký khám phá ở `api_map.md` |
| Báo lỗi bảo mật F-01…F-07 | `/create-bug-report` | `docs/bugs/_book-api/<module>/` |

**Thứ tự đề xuất:** `AUTH → USER → BOOK → CAT → PROMO → FILE → ADDR → SYS`
`AUTH` đi đầu vì mọi module còn lại cần token. `SYS` để cuối vì là tiện ích test, không phải nghiệp vụ.

---

## 7. Nhật ký danh mục

| Ngày | Thay đổi |
|---|---|
| 2026-08-14 | Khởi tạo danh mục hệ thống `BK`. Lập bản đồ 35 endpoint / 8 module bằng parse spec + 20 request kiểm chứng. Ghi nhận 15 phát hiện (3 🔴) và 10 ambiguity. **Chưa sinh REQ nào** — chờ chốt AMB-BK-01 và AMB-BK-02 |
