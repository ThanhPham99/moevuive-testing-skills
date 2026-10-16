---
name: heal-locators
description: "Đối chiếu bộ định vị (Locators) trong Page Object với DOM thực tế trên trình duyệt, phát hiện locator đã gãy hoặc mong manh, tự động sửa và kiểm chứng (SCAN / HEAL modes)."
skills:
  - skills-locator-healer-agent
---

# Heal Locators (Workflow Dispatcher)

Rà soát chủ động hoặc khắc phục hàng loạt bộ định vị phần tử (Locators) trong các file Page Object — đối chiếu trực tiếp với DOM thực tế trên trình duyệt để phát hiện locator đã gãy, mơ hồ hoặc bám thuộc tính động.

## Inputs & Modes
- **Target Page Object(s)**: Đường dẫn file Page Object, thư mục module hoặc toàn bộ thư mục `pages/`.
- **Target URL & Preconditions**: URL trang web tương ứng và các bước tiền đề để mở đúng trạng thái giao diện (đăng nhập, mở modal/tab).
- **Error Log** *(Optional)*: Log lỗi chạy test nếu có để khoanh vùng nhanh các phần tử bị gãy.
- **Mode**:
  - `SCAN` (Mặc định): Quét Page Objects + đối chiếu DOM thực tế → Xuất báo cáo `reports/locator_scan_report.md` kèm đề xuất locator thay thế (không sửa code).
  - `HEAL`: Thực hiện đầy đủ như `SCAN`, sau khi người dùng duyệt thì cập nhật trực tiếp vào Page Object và chạy lại test kiểm chứng (PASS 2 lần liên tiếp).

## Context Pointers (Lazy-Load On Demand)
- **2-Layer Risk Classification, 6 DOM States & `locator_scan_report.md` Schema**: [`.claude/skills/skills-locator-healer-agent/SKILL.md`](../../../.claude/skills/skills-locator-healer-agent/SKILL.md)
- **Canonical Locator Priority Matrix**: [`.claude/rules/locator_strategy.md`](../../../.claude/rules/locator_strategy.md)
- **Browser Inspection & Mode Switching (Headless `1920x1080` default)**: [`.claude/skills/skills-ui-debug-agent/SKILL.md`](../../../.claude/skills/skills-ui-debug-agent/SKILL.md)

## Execution Steps
1. **Bước 1 — Trích xuất & Chấm điểm Rủi ro Tĩnh (`🔴`/`🟡`/`🟢`):** Đọc các file Page Object trong phạm vi, lập danh sách biến locator kèm `file:line` và phân loại theo `skills-locator-healer-agent/SKILL.md`.
2. **Bước 2 — Đối chiếu DOM Thực tế (6 Trạng thái):** Điều hướng tới URL đích ở **Headless Mode (`1920x1080`, tắt GPU)** (hoặc chuyển sang Headed qua `/browser-mode` nếu cần qua CAPTCHA/OTP), đưa UI về đúng trạng thái chứa phần tử, chụp `browser_snapshot()` và gắn 1 trong 6 trạng thái (`✅ OK`, `⚠️ Mong manh`, `🔴 Gãy`, `🔴 Mơ hồ`, `🔴 Sai phần tử`, `❓ Chưa kiểm được`).
3. **Bước 3 — Sinh Bộ Định vị Thay thế & Xuất Báo cáo (HITL Checkpoint ⏸️):** Thiết kế locator mới theo [`.claude/rules/locator_strategy.md`](../../../.claude/rules/locator_strategy.md) (`count === 1`), xuất `reports/locator_scan_report.md`. Nếu `Mode = SCAN` → kết thúc; nếu `Mode = HEAL` → chờ người dùng duyệt danh sách thay thế.
4. **Bước 4 — Cập nhật Page Object & Kiểm chứng (`Mode = HEAL`):** Sửa locator trong Page Object (giữ nguyên tên biến/method) và chạy lại test liên quan cho đến khi **PASS 2 lần liên tiếp**.

## Output
- `reports/locator_scan_report.md` và *(khi `Mode = HEAL`)* các file Page Object đã được cập nhật & kiểm chứng.
