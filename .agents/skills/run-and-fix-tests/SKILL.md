---
name: run-and-fix-tests
description: "Thực thi bộ Test Automation hiện có, phân loại lỗi theo 6 nhóm nguyên nhân gốc rễ (Root Cause) và tự động sửa các lỗi thuộc phạm vi QA/Automation cho đến khi chạy xanh (RUN / FIX modes)."
skills:
  - skills-test-report-analyzer
---

# Run and Fix Tests (Workflow Dispatcher)

Thực thi bộ Test Automation hiện có (Smoke / Regression / Module), phân tích log lỗi thực tế theo **6 nhóm nguyên nhân gốc rễ (Root Cause Categories)** và tự động khắc phục các lỗi thuộc tầng Automation (`Locator`, `Data`, `Script`, `Flaky/Timing`) trong khi giữ nguyên hiện trường các lỗi thuộc về Ứng dụng (`🐛 Application Bug`).

## Inputs & Modes
- **Scope / Filter**: Toàn bộ suite (mặc định), hoặc lọc theo tag (`@smoke`, `@regression`), module hay đường dẫn file test.
- **Test Runner Command** *(Tự động suy từ `package.json`, `pom.xml`, `pytest.ini` nếu không truyền)*.
- **Mode**:
  - `RUN` (Mặc định): Chạy bộ test → Phân loại toàn bộ lỗi gom theo Root Cause → Xuất báo cáo `reports/run_and_fix_report.md`.
  - `FIX`: Thực hiện như `RUN`, sau khi người dùng duyệt danh sách sửa thì tự động sửa các lỗi Automation và chạy lại kiểm chứng (tối đa 3 vòng, phải PASS 2 lần liên tiếp).

## Context Pointers (Lazy-Load On Demand)
- **6 Failure Categories, Root Cause Clustering & `RUN`/`FIX` Remediation Rules**: [`.claude/skills/skills-test-report-analyzer/SKILL.md`](../../../.claude/skills/skills-test-report-analyzer/SKILL.md)
- **Broken Locator Healing (`🎯 Locator`)**: [`.claude/skills/skills-locator-healer-agent/SKILL.md`](../../../.claude/skills/skills-locator-healer-agent/SKILL.md)
- **Flaky & Timing Remediation (`⏱️ Flaky/Timing`)**: [`.claude/skills/skills-flaky-test-analyzer/SKILL.md`](../../../.claude/skills/skills-flaky-test-analyzer/SKILL.md)
- **Browser DOM Inspection (Headless `1920x1080` default)**: [`.claude/skills/skills-ui-debug-agent/SKILL.md`](../../../.claude/skills/skills-ui-debug-agent/SKILL.md)

## Execution Steps
1. **Bước 1 — Thực thi Baseline Test Suite:** Chạy lệnh test phù hợp với stack ở chế độ **Headless (`1920x1080`)** mặc định (hoặc chuyển sang Headed qua `/browser-mode` khi cần). Nếu gặp lỗi biên dịch/môi trường (`🌐 Environment`) → dừng ngay và báo rõ.
2. **Bước 2 — Phân loại 6 Nhóm & Gom cụm Root Cause:** Gom các bài test gãy cùng một điểm gốc theo Mục 2.1 & Mục 4 của `skills-test-report-analyzer/SKILL.md`. **Tuyệt đối CẤM sửa bài test cho xanh khi nguyên nhân là `🐛 Application Bug`** (giữ nguyên trạng thái đỏ và chuyển sang `/create-bug-report`).
3. **Bước 3 — Xuất Báo cáo & Xin Duyệt (HITL Checkpoint ⏸️):** Xuất `reports/run_and_fix_report.md` tách bạch **Danh sách Sẽ Sửa (`🎯`/`📊`/`🧪`/`⏱️`)** vs **Danh sách Không Sửa (`🐛`/`🌐`)**. Nếu `Mode = RUN` → kết thúc; nếu `Mode = FIX` → chờ user duyệt.
4. **Bước 4 — Tự động Sửa & Kiểm chứng (`Mode = FIX`):** Sửa tuần tự `🎯 Locator` → `📊 Data` → `🧪 Script` → `⏱️ Flaky`, chạy lại tối đa 3 vòng cho đến khi **PASS 2 lần liên tiếp** (rollback nếu không giải quyết được nguyên nhân gốc) và cập nhật `reports/run_and_fix_report.md`.

## Output
- `reports/run_and_fix_report.md` và *(khi `Mode = FIX`)* mã nguồn Automation đã được sửa & kiểm chứng chạy xanh.
