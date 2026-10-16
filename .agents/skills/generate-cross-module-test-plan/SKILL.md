---
name: generate-cross-module-test-plan
description: "Phân tích tính năng đi qua nhiều modules nối tiếp, xây dựng Module Map + Dimension Catalog, và sinh ma trận kết hợp (Output-Class Coverage / Pairwise / Full Cartesian)."
skills:
  - skills-requirements-analyzer
---

# Generate Cross-Module Test Plan (Workflow Dispatcher)

Phân tích các luồng nghiệp vụ đi xuyên qua **nhiều modules nối tiếp nhau** (trong đó lựa chọn ở module trước quyết định điều kiện/công thức/template ở module sau) để xây dựng **Dimension Catalog** và **Ma trận Kết hợp (Combinatorial Matrix)**.

## Inputs & Modes
- **Feature / Chain Name**: Tên luồng liên module (VD: *"Đối tác -> Thanh toán -> Thuế -> Biên bản"*).
- **Mode**:
  - `DOCUMENT` (Mặc định): Trích xuất chuỗi modules, dimensions, constraints và công thức đầu ra từ tài liệu SRS/spec/ticket.
  - `BROWSER`: Mở ứng dụng trên trình duyệt (mặc định **Headless `1920x1080`**, hoặc chuyển sang Headed qua `/browser-mode`) để khảo sát DOM thực tế, đọc các tùy chọn dropdown/radio ở từng module.
- **Matrix Strategy**: `output-class` (Mặc định — phủ 100% lớp kết quả đầu ra + biên rủi ro cao), `pairwise` (bằng script Python `allpairspy`), hoặc `full-cartesian` (khi tổng tổ hợp hợp lệ ≤ 50).

## Context Pointers (Lazy-Load On Demand)
- **Requirements & Business Rule Extraction**: `.claude/skills/skills-requirements-analyzer/SKILL.md`
- **Decision Table & Combinatorial Design**: `.claude/skills/skills-rbt-manual-testing/references/DESIGN_TECHNIQUES.md`
- **Browser DOM Recon (chỉ đọc khi `Mode = BROWSER`)**: `.claude/skills/skills-ui-debug-agent/SKILL.md`

## Execution Steps

### Bước 0: Kiểm tra Tiền đề (Business Rules / Output Formula Check ⚠️)
- Kiểm tra ngay xem người dùng đã cung cấp **quy tắc nghiệp vụ / công thức xác định Expected Output** (ứng với tổ hợp nào thì ra template/công thức nào) hay chưa.
- Nếu **THIẾU**: Cảnh báo ngay và cho người dùng chọn 1 trong 3 hướng (tuyệt đối không tự bịa công thức):
  - **(A)** Bổ sung quy tắc nghiệp vụ để điền đầy đủ cột `Expected Output` *(Khuyên dùng)*.
  - **(B)** Chạy `BROWSER` mode thử một vài tổ hợp mẫu trên hệ thống để suy ra quy tắc đầu ra.
  - **(C)** Tiếp tục sinh ma trận chỉ gồm các chiều Input (dùng chiến lược `pairwise`) và ghi chú rõ `⚠️ Output coverage chưa verify được — thiếu business rules`.

### Bước 1: Khảo sát Chuỗi Module & Luồng Dữ liệu (Module Recon & Data Flow)
1. Thu thập thông tin từng module theo thứ tự luồng nghiệp vụ (từ tài liệu ở `DOCUMENT` mode hoặc quét DOM ở `BROWSER` mode) để lập bảng **Module Inventory**: `Module | URL/Path | Inputs chính | Key Dimensions | Output | -> Next Module`.
2. Xây dựng **Dependencies Matrix** (Module đích phụ thuộc vào trường nào của Module nguồn) và **Dimension Catalog** (`D1`, `D2`, `D3`... kèm danh sách giá trị và các **Constraints** loại trừ tổ hợp không hợp lệ).

### Bước 2: Sinh Ma trận Kết hợp & Kiểm chứng Quy tắc Bất biến (Output Coverage)
- **⭐ QUY TẮC BẤT BIẾN (Output Coverage Rule)**: Khi đã có quy tắc đầu ra, **mọi giá trị `Expected Output` (mỗi loại template/công thức) bắt buộc phải xuất hiện ít nhất 1 lần trong ma trận**, bất kể dùng chiến lược nào.
- **Chiến lược `output-class` (3A — Mặc định)**: Chọn ít nhất 1 tổ hợp đại diện cho mỗi lớp `Expected Output` + bổ sung các tổ hợp biên/rủi ro tài chính cao + ghép thêm pairwise cho các chiều phụ.
- **Chiến lược `pairwise` (3B)**: **Bắt buộc chạy bằng script Python `allpairspy`** (nghiêm cấm tự tính nhẩm thủ công). Khi viết hàm lọc `is_valid(row)`, phải ánh xạ theo tên chiều `c = dict(zip(keys, row))` và kiểm tra bằng `c.get("D1_...")` (không dùng chỉ số `row[0]`, `row[1]` vì `allpairspy` truyền row từng phần). Sau khi chạy xong vẫn phải đối chiếu và bổ sung nếu thiếu lớp `Expected Output`.
- **Chiến lược `full-cartesian` (3C)**: Liệt kê toàn bộ tổ hợp hợp lệ sau khi trừ Constraints (dùng khi tổng số bộ ≤ 50).

### Bước 3: Xuất File Kế hoạch & Xác nhận (HITL Checkpoint ⏸️)
1. Ghi kết quả ra file `docs/testcases/_<hệ-thống>/cross_module_test_plan_<feature>.md` gồm: Module Inventory, Dependencies Matrix, Dimension Catalog + Constraints, Bảng Ma trận Kết hợp kèm mức Risk và dòng xác nhận `Output coverage: X/X template được cover ✅`.
2. *(Tùy chọn `--with-data`)* Sinh kèm dữ liệu mẫu cho từng `COMBO_XX` với prefix `auto_combo{XX}_{module}_{timestamp}`.

⏸️ **DỪNG LẠI (HITL Checkpoint)**: Trình bày bảng Ma trận Kết hợp hoàn chỉnh để người dùng rà soát trước khi chuyển sang `/generate-testcases-manual-rbt` hoặc `/generate-combinatorial-test-data`.

## Output
- `docs/testcases/_<hệ-thống>/cross_module_test_plan_<feature>.md`
