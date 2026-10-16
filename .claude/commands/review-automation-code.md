---
description: "Review chất lượng mã nguồn Test Automation theo Rubric 6 nhóm (12 điểm) & Definition of Done — phát hiện pass giả, hard sleep, inline locator, rò rỉ dữ liệu (REVIEW / FIX modes)."
skills:
  - skills-automation-code-reviewer
---

# Review Automation Code (Workflow Dispatcher)

Đánh giá độc lập chất lượng mã nguồn Test Automation hiện có theo **Rubric 6 nhóm (thang 12 điểm)** và bộ tiêu chuẩn **Definition of Done (DoD)** — giúp phát hiện các bài test "xanh giả" (false positives), lệnh chờ cứng (`hard sleep`), locator viết trực tiếp trong hàm test, và cấu hình báo cáo sai chuẩn.

## Inputs & Modes
- **Target Scope**: Đường dẫn file test, thư mục module hoặc toàn bộ suite automation.
- **Manual Test Cases** *(Optional)*: File `test_cases_<module>.md` để đối chiếu độ khớp giữa kịch bản gốc và câu lệnh Assert/Allure metadata.
- **Mode**:
  - `REVIEW` (Mặc định): Quét và chấm điểm chi tiết từng file kèm trích dẫn `file:line` + đề xuất code sửa -> Xuất `reports/automation_code_review.md` (không sửa file code).
  - `FIX`: Xuất báo cáo `REVIEW`, sau khi người dùng duyệt danh sách thì trực tiếp sửa code và chạy lại kiểm chứng (phải PASS 2 lần liên tiếp).

## Context Pointers (Lazy-Load On Demand)
- **6-Group Scoring Rubric (12 pts), Blockers & Report Template**: `.claude/skills/skills-automation-code-reviewer/SKILL.md`
- **Resilient Locator Replacement (chỉ đọc khi `Mode = FIX` cần thay locator xấu)**: `.claude/skills/skills-smart-locator-agent/SKILL.md`
- **Browser DOM Verification (Headless `1920x1080` default)**: `.claude/skills/skills-ui-debug-agent/SKILL.md`

## Nguyên tắc Thực thi Bắt buộc
1. **Mọi lỗi đều phải chỉ rõ `file:line` và đoạn code nguyên văn**: Không nhận xét cảm tính chung chung; mỗi vấn đề phải đi kèm đoạn code thay thế cụ thể (`Code cũ -> Code mới`).
2. **Bảo toàn ngữ nghĩa nghiệp vụ của bài test**: Khi refactor ở `Mode = FIX`, chỉ nâng cấp chất lượng kỹ thuật (Wait, POM, Locator, Data, Report), tuyệt đối không làm yếu đi hoặc đổi kỳ vọng nghiệp vụ của bài test.
3. **Sửa xong bắt buộc chạy lại kiểm chứng**: Mọi file sửa ở `Mode = FIX` phải được chạy lại (mặc định **Headless `1920x1080`**) và PASS 2 lần liên tiếp; nếu việc sửa làm hỏng bài test đang chạy xanh thì phải hoàn tác (rollback) và báo rõ.

## Execution Steps

### Bước 1: Khoanh vùng Codebase & Kiểm tra Cấp Suite
1. Nhận diện Tech Stack (`Playwright TS/Java`, `Selenium Java`, `Appium`, `Pytest`) và phân tách danh sách **Page/Screen Objects** với **Test Files** trong phạm vi.
2. Kiểm tra cấu hình cấp toàn bộ Suite:
   - Thư mục xuất báo cáo (`reports/`) đã tập trung đúng quy chuẩn và được đưa vào `.gitignore` chưa?
   - Có lộ thông tin nhạy cảm (mật khẩu, token, API key thật) trong code hay file cấu hình commit lên Git không?

### Bước 2: Chấm điểm Rubric 6 Nhóm (0–2 điểm/nhóm, Tổng 12 điểm) & Soi Assertion
Đọc từng file và chấm điểm theo `.claude/skills/skills-automation-code-reviewer/SKILL.md`:
1. **Code Hygiene & Cleanliness (0–2đ)**: Không có `console.log`/`System.out.println` rác, code comment-out, hoặc biến/import thừa.
2. **POM & Architecture Separation (0–2đ)**: Test file không chứa raw locator (`page.locator`, `By.xpath`); Page Object không chứa câu lệnh Assert nghiệp vụ (trừ hàm xác nhận trang đã tải).
3. **Wait & Synchronization Strategy (0–2đ)**: Cấm tuyệt đối `waitForTimeout` / `Thread.sleep` / `time.sleep` cố định; sử dụng Web-First Assertions hoặc `WebDriverWait`.
4. **Test Data & Isolation (0–2đ)**: Không hardcode dữ liệu dễ đụng độ khi chạy song song; dữ liệu tạo mới có prefix traceable `auto_<module>_<timestamp>`.
5. **Reporting & Traceability Metadata (0–2đ)**: Đủ nhãn TC ID, Severity, mô tả Tiếng Việt, phân tách bước `Arrange / Act / Assert` và chụp screenshot tự động ở teardown.
6. **Assertion Strength & Test Independence (0–2đ)**: Đánh dấu đỏ các bài test **Pass giả / Assertion yếu** (chỉ kiểm tra nút tồn tại hoặc không có câu lệnh assert thay đổi trạng thái sau hành động).

### Bước 3: Xuất Báo cáo Review (HITL Checkpoint ⏸️)
- Xuất file `reports/automation_code_review.md` gồm: Điểm tổng quan từng file (`/12`), Danh sách **Vi phạm Chặn Bàn giao (Blockers)**, Chi tiết từng lỗi kèm `file:line` + hướng sửa, và Danh sách các bài test có Assertion yếu.

⏸️ **DỪNG LẠI (HITL Checkpoint)**: Nếu `Mode = REVIEW` -> Kết thúc. Nếu `Mode = FIX` -> Chờ người dùng duyệt danh sách các mục cần sửa.

### Bước 4: Refactor Code & Chạy Lại Kiểm chứng *(Chỉ khi `Mode = FIX`)*
- Sửa lần lượt từ các lỗi **Blocker** -> `🔴 High` -> `🟡 Medium` (nếu cần thay locator động/XPath vị trí, mở trình duyệt **Headless `1920x1080`** để lấy locator thật trên DOM).
- Chạy lại bộ test vừa sửa **2 lần liên tiếp**, cập nhật bảng điểm `Trước -> Sau` vào cuối file `reports/automation_code_review.md`.

## Output
- `reports/automation_code_review.md` và *(khi `Mode = FIX`)* mã nguồn đã được làm sạch & kiểm chứng chạy xanh.
