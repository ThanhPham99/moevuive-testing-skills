# Bản đồ API — AnhTester Book Management API

> **TẦNG KHÁM PHÁ — cấp hệ thống.** Tài liệu này **KHÔNG chứa mã REQ**, chỉ cấp **mã module** và ghi lại những gì quan sát được từ spec + gọi thật.
> Mã REQ chi tiết sinh ở tầng module: `docs/requirements/_book-api/<module>/requirements_<module>.md`.
>
> Danh mục hệ thống: [`../README.md`](../README.md) · Spec gốc đã snapshot: [`sources/openapi_2026-08-14.json`](sources/openapi_2026-08-14.json)

| Mục | Giá trị |
|---|---|
| Hệ thống | AnhTester Book Management API |
| Loại | REST API — **không có UI trong phạm vi tài liệu này** |
| Spec | OpenAPI **3.0.0** · version `1.0.0` |
| Nguồn spec | `https://book.anhtester.com/swagger/json` (trang `/swagger` là Scalar renderer, không phải spec) |
| Base URL | `https://book.anhtester.com` — 1 server duy nhất, **Production** |
| Auth | `BearerAuth` — HTTP bearer, JWT **HS256** |
| Tổng endpoint | **35 operations** / 8 nhóm |
| Ngày khám phá | 2026-08-14 |
| Phương pháp | Parse spec + **gọi thật 20 request** để kiểm chứng (không tin spec suông) |

---

## 1. Bảng module & prefix

Hệ thống dùng mã hệ thống **`BK`** để không đụng dải prefix của Perfex CRM trong cùng repo.

| Mã module | Nhóm tag trong spec | Số op | 🌐 Công khai | 🔒 Cần token | Dải REQ | Dải TC ID |
|---|---|---|---|---|---|---|
| `AUTH` | Authentication Management | 6 | 3 | 3 | `REQ-BK-AUTH-nn` | `BK_AUTH_TC_nnn` |
| `USER` | User Management | 5 | 2 | 3 | `REQ-BK-USER-nn` | `BK_USER_TC_nnn` |
| `BOOK` | Book Management | 5 | 2 | 3 | `REQ-BK-BOOK-nn` | `BK_BOOK_TC_nnn` |
| `CAT` | Category Management | 4 | 1 | 3 | `REQ-BK-CAT-nn` | `BK_CAT_TC_nnn` |
| `PROMO` | Promotion Management | 5 | 2 | 3 | `REQ-BK-PROMO-nn` | `BK_PROMO_TC_nnn` |
| `FILE` | File Management | 7 | 2 | 5 | `REQ-BK-FILE-nn` | `BK_FILE_TC_nnn` |
| `ADDR` | Address Management | 2 | 2 | 0 | `REQ-BK-ADDR-nn` | `BK_ADDR_TC_nnn` |
| `SYS` | System (tiện ích test) | 1 | 1 | 0 | `REQ-BK-SYS-nn` | `BK_SYS_TC_nnn` |
| | **Tổng** | **35** | **15** | **20** | | |

---

## 2. Danh mục endpoint

Cột **Auth** lấy từ `security` của **từng operation**, không phải `security` toàn cục. Spec khai global `BearerAuth`, nhưng **15 operation ghi đè bằng `security: []`** → thành công khai. Đây là chi tiết dễ bỏ sót nhất khi đọc Swagger UI.

### 2.1. `AUTH` — Authentication Management

| Method | Path | Auth | Status codes khai | Mô tả |
|---|---|---|---|---|
| POST | `/api/login` | 🌐 Không | 200/400/403/404/422 | Đăng nhập, trả `accessToken` + set 2 cookie |
| POST | `/api/register` | 🌐 Không | 201/400/422 | Tự đăng ký tài khoản |
| POST | `/api/refetch-token` | 🌐 Không | 200/400/404/422 | Làm mới token — đọc `refetchToken` từ **cookie** |
| PATCH | `/api/profile` | 🔒 Có | 200/400/401/403/404/422 | Cập nhật hồ sơ, có `password` + `password_old` |
| GET | `/api/me` | 🔒 Có | 200/401/403/404/422 | Thông tin user hiện tại |
| DELETE | `/api/logout` | 🔒 Có | 200/400/401/403/404/422 | Đăng xuất |

### 2.2. `USER` — User Management

| Method | Path | Auth | Status codes khai | Mô tả |
|---|---|---|---|---|
| GET | `/api/user` | 🌐 **Không** | 200/400/422/500 | Danh sách user — `limit`/`page`/`search`/`sort`/`sortBy` |
| POST | `/api/user` | 🔒 Có | 201/400/422 | Tạo user |
| GET | `/api/user/{id}` | 🌐 **Không** | 200/404 | Chi tiết user |
| PATCH | `/api/user/{id}` | 🔒 Có | 200/400/404/422 | Sửa user + thu hồi refresh token cũ |
| DELETE | `/api/user/{id}` | 🔒 Có | 200/400/404/422 | Xoá user + xoá refresh token liên quan |

### 2.3. `BOOK` — Book Management

| Method | Path | Auth | Status codes khai | Mô tả |
|---|---|---|---|---|
| GET | `/api/book` | 🌐 Không | 200/400/422 | Danh sách sách — phân trang / lọc / sắp xếp |
| POST | `/api/book` | 🔒 Có | 201/400/401/403/422 | Tạo sách |
| GET | `/api/book/{id}` | 🌐 Không | 200/400/404 | Chi tiết sách — có query `view` |
| PATCH | `/api/book/{id}` | 🔒 Có | **201**/400/401/403/404/422 | Sửa sách |
| DELETE | `/api/book/{id}` | 🔒 Có | 200/400/404/422 | Xoá sách |

### 2.4. `CAT` — Category Management

| Method | Path | Auth | Status codes khai | Mô tả |
|---|---|---|---|---|
| GET | `/api/category-book` | 🌐 Không | 200 | Danh sách danh mục — trả kèm `bookCount` |
| POST | `/api/category-book` | 🔒 Có | 201/400/422 | Tạo danh mục — body `{name}` |
| PUT | `/api/category-book` | 🔒 Có | 200/400/422 | Đổi tên — body `{name, newName}` |
| DELETE | `/api/category-book/{name}` | 🔒 Có | 200/400/404/422 | Xoá theo **tên**, không theo id |

### 2.5. `PROMO` — Promotion Management

| Method | Path | Auth | Status codes khai | Mô tả |
|---|---|---|---|---|
| GET | `/api/promotion-book` | 🌐 Không | 200/400/422/500 | Danh sách — `limit`/`page`/`sort`/`sortBy` khai **required** |
| POST | `/api/promotion-book` | 🔒 Có | 201/400/404/422/500 | Tạo khuyến mãi |
| GET | `/api/promotion-book/{id}` | 🌐 Không | 200/400/404 | Chi tiết |
| PATCH | `/api/promotion-book/{id}` | 🔒 Có | 200/400/404/422/500 | Sửa |
| DELETE | `/api/promotion-book/{id}` | 🔒 Có | 200/400/404/422/500 | Xoá |

### 2.6. `FILE` — File Management

| Method | Path | Auth | Status codes khai | Mô tả |
|---|---|---|---|---|
| GET | `/api/file` | 🌐 Không | 200/400/404 | Liệt kê file theo `path` |
| POST | `/api/file` | 🔒 Có | 200/400/422 | Upload — `multipart/form-data`, field `files` |
| DELETE | `/api/file` | 🔒 Có | 200/400/403/404/422 | Xoá theo query `path` |
| GET | `/api/file/info` | 🌐 Không | **(không khai)** | Dung lượng đã dùng / tối đa |
| PUT | `/api/file/rename` | 🔒 Có | 200/400/404/422 | Đổi tên |
| POST | `/api/file/copy` | 🔒 Có | 200/400/404/422 | Sao chép |
| PUT | `/api/file/move` | 🔒 Có | 200/400/404/422 | Di chuyển |

### 2.7. `ADDR` — Address Management

| Method | Path | Auth | Status codes khai | Mô tả |
|---|---|---|---|---|
| GET | `/api/address` | 🌐 Không | 200/400 | Danh sách đơn vị hành chính VN |
| GET | `/api/address/{divname}` | 🌐 Không | 200/400/422 | Phường/xã theo đơn vị |

### 2.8. `SYS` — System

| Method | Path | Auth | Status codes khai | Mô tả |
|---|---|---|---|---|
| POST | `/api/status` | 🌐 Không | **(không khai)** | Ép server trả status code tuỳ ý — body `{code, msg, time}` |

> `POST /api/status` là **công cụ test có sẵn của hệ thống**: ép trả status code bất kỳ, có `time` để giả lập độ trễ. Dùng nó để test nhánh xử lý lỗi phía client (500 / timeout) mà không cần mock.

---

## 3. Kết quả kiểm chứng bằng gọi thật

20 request thật ngày 2026-08-14. Cột **Spec khai** vs **Thực tế** cho thấy chỗ nào không được tin spec.

### 3.1. Phát hiện mức 🔴 — chặn việc viết TC nếu chưa chốt

| Mã | Phát hiện | Bằng chứng | Ảnh hưởng |
|---|---|---|---|
| **F-01** | `GET /api/user` và `GET /api/user/{id}` **công khai**, trả về `email` + `phone` + `address` của **mọi** user | `GET /api/user?limit=2` không token → **200**, body chứa `anhtester@example.com`, `0939206009`, địa chỉ đầy đủ | Rò rỉ PII toàn hệ thống. Là nguồn `id` để tấn công các endpoint khác |
| **F-02** | **Không có mô hình phân quyền.** Tài khoản vừa `register` (user thường, mới tinh) làm được mọi thứ | Cùng 1 token user thường: `POST /api/book` → 200 · `PATCH /api/user/{id_người_khác}` → 200 · `DELETE /api/user/{id_người_khác}` → 200 · `POST /api/user` → 201 | BOLA + BFLA toàn diện. Spec khai `403` ở nhiều endpoint nhưng **không quan sát được trường hợp nào phát sinh 403** |
| **F-03** | Cookie `accessToken` set **không có** `HttpOnly`, `Secure`, `SameSite` | `Set-Cookie: accessToken=eyJ...; Path=/` — trong khi `refetchToken` cùng response có đủ `HttpOnly; Secure; SameSite=Strict` | XSS đọc được access token. Hai cookie cùng luồng nhưng chuẩn bảo mật lệch nhau |

### 3.2. Phát hiện mức 🟠 — sai lệch dữ liệu

| Mã | Phát hiện | Bằng chứng |
|---|---|---|
| **F-04** | `price` **âm** được chấp nhận | `POST /api/book` với `price: -99999` → **200 Book created successfully**. Spec chỉ khai `maximum: 9000000000000`, **không có `minimum`** |
| **F-05** | `categories` trỏ tới danh mục **không tồn tại** vẫn tạo được sách | `POST /api/book` với `categories: ["khong_ton_tai_zzz"]` → **200**. Không kiểm tra khoá ngoại |
| **F-06** | Xoá user làm **mồ côi** sách của user đó | Sau khi xoá user, `GET /api/book/{id}` của sách cũ trả `auth: null`. Không chặn xoá, không gán lại chủ sở hữu |
| **F-07** | `POST /api/user` **không nhận** password → gán mặc định `anhtester.com` | Tạo user không truyền password, sau đó `POST /api/login` với password `anhtester.com` → **200**. Mọi user tạo qua endpoint này có mật khẩu đoán được |

### 3.3. Phát hiện mức 🟡 — sai lệch spec / lộ thông tin

| Mã | Phát hiện | Bằng chứng |
|---|---|---|
| **F-08** | `POST /api/book` trả **200**, spec khai **201** | Quan sát trực tiếp |
| **F-09** | `PATCH /api/book/{id}` spec khai **201** — sai chuẩn REST, PATCH nên trả 200 | Đọc spec |
| **F-10** | Header `Server: nginx/1.24.0 (Ubuntu)` lộ phiên bản web server và OS | Response header mọi endpoint |
| **F-11** | JWT `exp` = **6 ngày** cho access token | `{"exp":"6d"}` trong response login. Access token sống 6 ngày là dài bất thường |

### 3.4. Điểm hệ thống làm ĐÚNG — vẫn phải có TC để chống hồi quy

| Mã | Ghi nhận | Bằng chứng |
|---|---|---|
| **F-12** | `status` ngoài enum bị chặn đúng | `status: "HACKED"` → **422** `{"fields":{"status":["Expected kind 'UnionEnum'"]}}` |
| **F-13** | Gọi endpoint cần token mà không có token bị chặn đúng | `POST /api/book` không token → **401** `Missing or invalid Authorization header` |
| **F-14** | `refetchToken` cookie bảo vệ đúng chuẩn | `HttpOnly; Secure; SameSite=Strict; Max-Age` |
| **F-15** | ID dùng **cuid** (`cmiyq38a30002...`), không phải số tăng dần | Không đoán tuần tự được — giảm mức độ khai thác của F-01/F-02, nhưng `GET /api/user` công khai đã phát ID sẵn nên lợi thế này mất tác dụng |

---

## 4. Khoảng trống của spec (AMB) — cần chốt trước khi sinh TC

| Mã | Câu hỏi | Vì sao spec không trả lời được | Chặn cái gì |
|---|---|---|---|
| **AMB-BK-01** 🔴 | Hệ thống **có** mô hình vai trò không? Nếu có thì gồm những vai trò nào, ai được gọi endpoint nào? | Spec không có khái niệm role ở bất kỳ đâu, nhưng khai `403` ở 6 operation | Toàn bộ TC nhóm Auth/Permission của **mọi** module. Không chốt thì không biết F-02 là **lỗi** hay **thiết kế** |
| **AMB-BK-02** 🔴 | `GET /api/user` công khai là **cố ý** hay lỗi cấu hình? | `security: []` là khai báo tường minh, không phải quên | Quyết định F-01 được viết thành TC bug hay TC xác nhận hành vi |
| **AMB-BK-03** 🟠 | `price` có chặn âm không? Sàn là bao nhiêu? | Spec chỉ khai `maximum` | Bộ TC boundary của `BOOK` |
| **AMB-BK-04** 🟠 | Khuyến mãi `PERCENTAGE` thì `value` giới hạn 0–100? `endDate` bắt buộc sau `startDate`? | Spec khai `value: number` trần, không ràng buộc; 2 ngày chỉ có `default` | Bộ TC boundary + logic của `PROMO` |
| **AMB-BK-05** 🟠 | Xoá danh mục **đang có sách** (`bookCount > 0`) thì sách xử lý thế nào? | Spec khai 400/404 nhưng không nói trường hợp nào | TC `BK_CAT` nhánh xoá |
| **AMB-BK-06** 🟠 | Đổi mật khẩu qua `PATCH /api/profile` có **bắt buộc** `password_old` không? | Cả hai field đều optional trong spec | TC bảo mật `AUTH` |
| **AMB-BK-07** 🟡 | Upload file giới hạn dung lượng / định dạng gì? | Spec không khai. Chỉ biết `maxStorage` = 1 GB qua `GET /api/file/info` | TC 413 / 415 của `FILE` |
| **AMB-BK-08** 🟡 | Hệ thống có **rate limiting** không? | Không endpoint nào khai `429` | TC 429 — hiện **không có căn cứ** để viết |
| **AMB-BK-09** 🟡 | `GET /api/promotion-book` khai `limit`/`page`/`sort`/`sortBy` là **required**, trong khi `/api/book` và `/api/user` khai **optional** — cố ý hay lỗi spec? | Bất nhất giữa 3 endpoint cùng dạng list | TC pagination của `PROMO` |
| **AMB-BK-10** 🟡 | `config` (trong `/api/me`, `PATCH /api/profile`) và `configFe` (trong `PROMO`) chứa gì? | Khai kiểu tự do, không có schema | TC của 2 field này |

---

## 5. Ghi chú kỹ thuật cho khâu automation

| Vấn đề | Chi tiết | Xử lý khi dựng framework |
|---|---|---|
| **`components.schemas` RỖNG** | Toàn bộ request/response body khai **inline**, không có model tái sử dụng | Không sinh DTO tự động từ spec được. Phải tự viết model cho 8 nhóm |
| **Auth 2 kênh song song** | Login trả `accessToken` **trong body** *và* set cookie `accessToken` + `refetchToken` | Chọn 1 kênh và nhất quán. `POST /api/refetch-token` **chỉ** đọc từ cookie → client phải giữ cookie jar |
| **3 content-type mỗi endpoint** | Hầu hết POST/PUT/PATCH nhận `application/json`, `x-www-form-urlencoded`, `multipart/form-data` | Nhân 3 bề mặt test. Chốt `application/json` làm mặc định, để riêng TC 415 cho content-type sai |
| **Tiếng Việt trong body** | Field `address` chứa dấu tiếng Việt | Ép `charset=utf-8`. Gửi qua shell Windows dễ hỏng mã — dùng file JSON, không nhúng thẳng vào lệnh |
| **Danh mục định danh bằng `name`** | `DELETE /api/category-book/{name}` — tên có dấu cách, tiếng Việt | Phải URL-encode. Dữ liệu thật đang có danh mục tên `" Phương Nam"` (**có khoảng trắng đầu**) |
| **Dữ liệu rác sẵn có** | 744 sách, nhiều bản ghi `auto_*`, `Parallel Test Book *`, `TestBook-*` từ các đợt automation trước | Mọi khẳng định theo **tổng số bản ghi** đều không tin được. TC phải tự tạo data rồi tự dọn |
| **`POST /api/status`** | Ép status code + độ trễ tuỳ ý | Dùng thay mock cho TC xử lý lỗi phía client |

---

## 6. Nhật ký khám phá

| Ngày | Thay đổi |
|---|---|
| 2026-08-14 | Khởi tạo bản đồ. Parse spec `openapi 3.0.0` (35 op / 8 nhóm) + kiểm chứng bằng **20 request thật**. Cấp 8 mã module, mã hệ thống `BK`. Ghi nhận **15 phát hiện** (3 🔴 · 4 🟠 · 4 🟡 · 4 điểm đúng) và **10 ambiguity**. Snapshot spec vào `sources/openapi_2026-08-14.json`. **Chưa cấp mã REQ** — đúng quy tắc tầng khám phá |

### Sự cố trong lúc khám phá

| Ngày | Sự cố | Khắc phục |
|---|---|---|
| 2026-08-14 | Khi kiểm chứng BOLA, đã dùng **bản ghi seed có sẵn** `anhtester@example.com` (id `cmiyq38a300027udmc9666cq1`) làm mục tiêu `PATCH` rồi `DELETE` → xoá mất tài khoản gốc của demo | Tạo lại tài khoản cùng `name`/`email`/`phone`/`address`/`avatarUrl`/`isActive`, mật khẩu về mặc định `anhtester.com` (đã kiểm chứng đăng nhập được). **Không khôi phục được:** ID mới `cmssozna6102s7uk1dda2ujja`, các sách thuộc tài khoản cũ nay mang `auth: null`. Đã bổ sung quy tắc chặn vào workflow `/generate-api-tests-from-swagger` mục "Quy tắc dữ liệu test" |
