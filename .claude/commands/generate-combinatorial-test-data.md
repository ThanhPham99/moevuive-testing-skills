---
description: "Sinh test data cho ma trận kết hợp đa chiều (từ /generate-cross-module-test-plan) ở chế độ GENERATE (JSON/CSV/Markdown/Code) hoặc PIPELINE (tạo data thật qua nhiều modules)."
skills:
  - skills-test-data-generator
---

# Generate Combinatorial Test Data (Workflow Dispatcher)

Sinh bộ dữ liệu kiểm thử cho từng tổ hợp trong Ma trận kết hợp đa chiều (`/generate-cross-module-test-plan`) — đảm bảo mỗi combo có bộ dữ liệu riêng biệt, truy vết được (`auto_combo{XX}_{module}_{timestamp}`) và khớp công thức tính toán.

## Inputs & Modes
- **Combinatorial Matrix**: File `cross_module_test_plan_<feature>.md` hoặc bảng ma trận kết hợp.
- **Mode**:
  - `GENERATE` (Mặc định): Sinh dữ liệu có cấu trúc (`json`, `csv`, `markdown`, hoặc `code` TS/Java/Python) cho toàn bộ các bộ kết hợp mà không mở trình duyệt.
  - `PIPELINE` (Lựa chọn cuối khi bắt buộc phải tạo data qua UI): Đi qua từng module trên trình duyệt (mặc định **Headless `1920x1080`**, chuyển sang Headed bằng `/browser-mode` nếu cần), tạo bản ghi thật theo từng combo, thu thập ID và chụp ảnh bằng chứng.
- **Target URL & Credentials** *(Chỉ khi `PIPELINE`)*: URL ứng dụng và tài khoản đăng nhập.

## Context Pointers (Lazy-Load On Demand)
- **Data Generation & Multi-Step Pipeline Rules**: `.claude/skills/skills-test-data-generator/SKILL.md`
- **Browser DOM Interaction (chỉ đọc khi `Mode = PIPELINE`)**: `.claude/skills/skills-ui-debug-agent/SKILL.md`
- **Cross-Module Matrix Schema**: `.claude/commands/generate-cross-module-test-plan.md`

## Thứ tự ưu tiên khi cần tạo Data thật trên hệ thống
Trước khi chạy `PIPELINE` qua trình duyệt (tốn thời gian và dễ tạo dữ liệu rác trên môi trường dùng chung), luôn hỏi người dùng kiểm tra 3 phương án nhanh hơn:
1. **Seed qua REST/GraphQL API** (Ưu tiên số 1 — nhanh và ổn định nhất)
2. **Seed qua DB Script / Migration**
3. **Import file Excel / CSV**
4. **Browser `PIPELINE`** (Chỉ dùng khi logic nghiệp vụ chỉ tồn tại ở tầng UI). Nếu chạy trên môi trường dùng chung, bắt buộc xác nhận với người dùng, giới hạn **tối đa 10 combos / batch** (trần cứng 30 combos / phiên) và ghi lại toàn bộ ID đã tạo để dọn dẹp.

## Execution Steps

### Bước 1: Đọc Ma trận & Phân tích Trường Dữ liệu từng Module
1. Đọc bảng Ma trận kết hợp để xác định danh sách Dimensions (`D1`, `D2`...), các giá trị mỗi chiều, công thức/template kỳ vọng và tổng số combos.
2. Phân loại toàn bộ các trường dữ liệu của từng module trong chuỗi thành 4 nhóm:
   - **Dimension fields**: Lấy chính xác 100% từ giá trị của bộ kết hợp trong ma trận (tuyệt đối không random).
   - **Supporting fields**: Trường bắt buộc nhưng không thuộc dimension -> sinh dữ liệu hợp lệ, duy nhất theo từng combo với prefix `auto_combo{XX}_{module_short}_{timestamp}` (không dùng PII thật).
   - **Reference fields**: Khoá ngoại / mã bản ghi lấy từ output của module đứng trước trong chuỗi.
   - **Computed fields**: Giá trị tự động tính theo công thức nghiệp vụ (thuế, chiết khấu, tổng tiền, loại mẫu biên bản).

⏸️ **DỪNG LẠI (HITL Checkpoint)**: Trình bày tóm tắt số lượng combos, bảng phân loại fields theo từng module, Mode thực thi (`GENERATE` hay `PIPELINE` theo batch ≤ 10 bộ) để người dùng xác nhận trước khi thực hiện.

### Bước 2A: Sinh Bộ Test Data (`Mode = GENERATE`)
- Với mỗi `COMBO_XX`, sinh đầy đủ object dữ liệu cho từng module (`module_data`) kèm `expected_output` (`template`, `formula`, `computed_total`, `expected_fields`).
- Xuất ra định dạng người dùng yêu cầu (`json` mặc định, `markdown`, `csv`, hoặc `code` dùng cho Data-Driven Test).

### Bước 2B: Thực thi Tạo Data trên Hệ thống (`Mode = PIPELINE`)
1. Khởi chạy trình duyệt (mặc định **Headless `1920x1080`**; dùng `node scripts/browser-mode.mjs headed` nếu cần hiển thị UI).
2. Với mỗi combo trong batch (tối đa 10 combos/batch):
   - Đi tuần tự qua từng module -> điền `Dimension fields` + `Supporting fields` -> lưu bản ghi -> trích xuất ID/mã vừa tạo để truyền sang module tiếp theo.
   - Ở module cuối: đối chiếu kết quả hiển thị với `expected_output` và chụp screenshot bằng chứng.
3. Ngay khi mỗi bản ghi được tạo, ghi nhận ID vào danh sách **🧹 Data cần dọn dẹp** để đảm bảo luôn truy vết được kể cả khi dừng giữa chừng.

## Output
- File dữ liệu tổ hợp (`test-data/combinatorial_<feature>.json` / `.csv` / `.md` / `.ts`) hoặc **Pipeline Execution Report** kèm danh sách ID đã tạo theo từng module.
