---
name: execute-test-cases
description: "Thực thi manual test cases trên browser qua Playwright MCP — chấm PASS/FAIL/BLOCKED/SKIPPED, thu thập evidence và xuất execution_report.md."
skills:
  - skills-manual-test-executor
---

# Workflow: Thực Thi Manual Test Cases (`/execute-test-cases`)

> **Context Pointer:** Nạp và thực thi theo [`.claude/skills/skills-manual-test-executor/SKILL.md`](../../../.claude/skills/skills-manual-test-executor/SKILL.md).

## 1. Input Cần Thu Thập & Phân Tầng Thực Thi

| Input | Bắt buộc? | Ghi chú |
|---|---|---|
| **File TC hoặc Checklist** | ⭐ Bắt buộc | VD: `docs/testcases/customers/parts/part_01_danh_sach.md` |
| **Phạm vi chạy** | ⭐ Bắt buộc | Toàn bộ file · theo tag (`@Smoke`) · theo dải `TC ID` · theo nhóm chức năng *(hỏi user nếu chưa nêu)* |
| **URL, Tài khoản & Build** | ⭐ Bắt buộc | Thông tin môi trường test, tài khoản đăng nhập và phiên bản build |
| **Môi trường dùng chung?** | ⭐ Bắt buộc | **Có** → bật Auto-Skip TC phá huỷ; **Không** → chạy đầy đủ |

- **Quy tắc hiệu năng (Execution Tiers):** Nếu phạm vi $> 15$ TC, đề xuất user lọc chạy trước nhóm `@Smoke` / `P1` qua AI (Tier 1) hoặc chuyển sang `/generate-automation-from-testcases` để chạy bằng test runner song song (Tier 2).

## 2. Browser Execution Mode

- **Mặc định — Headless Mode (`1920x1080`, tắt GPU):** Thực thi toàn bộ bước test trên nền Headless Full HD để tiết kiệm GPU và không cắt giao diện.
- **Opt-in — Headed Mode (`1600x750`, cửa sổ tại `0,0`) & Video:** Chuyển đổi qua `/browser-mode` (`node scripts/browser-mode.mjs`) và tuân thủ chuỗi thao tác & quy tắc chụp bằng chứng tại `skills-manual-test-executor` § 2–3.

## 3. Quy Trình 7 Bước Thực Thi

1. **Xác nhận phạm vi & công bố kế hoạch:** Đếm số TC sẽ chạy, số TC dự kiến `SKIPPED` (Auto-Skip) và thông báo ra chat.
2. **Khởi tạo Run:** Tạo `run_id` (`run_<timestamp>`), thư mục `docs/executions/<module>/<run_id>/evidence/` và khởi tạo file `docs/executions/<module>/<run_id>/execution_report.md`.
3. **Đăng nhập & kiểm tra kết nối:** Mở hệ thống và đăng nhập. Nếu không đăng nhập được ngay từ đầu → **DỪNG NGAY** và báo user.
4. **Chạy tuần tự từng TC (theo quy tắc trong `skills-manual-test-executor` § 3–4):**
   - Kiểm tra Auto-Skip (`@ManualOnly`, xoá hàng loạt, URL xoá trực tiếp, file `.exe`) → chấm `⏭️ SKIPPED`.
   - Dựng Pre-Condition (không dựng được → `⚠️ BLOCKED`).
   - Thực hiện đúng từng bước trong Test Steps và dùng `browser_snapshot` đối chiếu từng Expected Result.
   - Chấm `✅ PASS` / `❌ FAIL` / `⚠️ BLOCKED` kèm thu thập bằng chứng theo bảng quy định tại `skills-manual-test-executor` § 3.
   - **Ghi kết quả vào `execution_report.md` ngay sau mỗi TC** và khôi phục trạng thái sạch trước khi qua TC mới (Fail-Forward; chỉ dừng khẩn cấp nếu 3 TC liên tiếp fail cùng lỗi hạ tầng hoặc ảnh hưởng dữ liệu người khác).
5. **Báo tiến độ:** Sau mỗi 5–10 TC, in 1 dòng tóm tắt tiến độ ra chat.
6. **Teardown dữ liệu:** Xoá toàn bộ bản ghi `Auto_<Module>_<timestamp>` đã tạo, đối chiếu số liệu hệ thống trước/sau.
7. **Hoàn tất `execution_report.md`:** Đầy đủ 6 mục theo schema chuẩn trong `skills-manual-test-executor` § 5 (tương thích 100% với Execution Viewer) và gợi ý bước tiếp theo (`/create-bug-report`, `/analyze-test-report`).
