---
name: skills-flaky-test-analyzer
description: "Diagnose and fix flaky automated tests caused by unstable locators, race conditions, hard sleeps, shared state, or parallel test data collisions."
---

# Flaky Test Analyzer

Chẩn đoán nguyên nhân gốc rễ và khắc phục triệt để các bài kiểm thử tự động không ổn định (lúc PASS lúc FAIL — Flaky Tests) theo 2 chế độ: `ANALYZE` (chỉ báo cáo) và `FIX` (sửa code + chạy lặp kiểm chứng).

---

## 1. Vai Trò & Khi Nào Sử Dụng

- **Khi sử dụng:**
  - Bài test lúc PASS lúc FAIL trên cùng một phiên bản code mà không có thay đổi nghiệp vụ.
  - Bài test chạy đơn lẻ (`1 worker`) thì PASS nhưng chạy song song (`5 workers`) hoặc chạy trên CI/CD thì FAIL ngẫu nhiên.
  - Báo cáo test ghi nhận các bài test phải qua `retry` mới xanh.
- **Điều phối qua:** `/analyze-flaky-tests` (`ANALYZE` / `FIX` modes).

---

## 2. Năm Nhóm Nguyên Nhân Gốc Rễ Gây Flaky

| Nhóm nguyên nhân | Dấu hiệu nhận diện trong Log / Code | Chiến lược khắc phục chuẩn |
|---|---|---|
| 🎯 **Locator không ổn định** | Dùng class động (`css-1n2xyz`), XPath vị trí (`//div[3]/button`), hoặc selector khớp nhiều phần tử | Thay bằng bộ định vị bền vững theo [`.claude/rules/locator_strategy.md`](../../rules/locator_strategy.md) |
| ⏱️ **Hard Sleep & Race Condition** | Có `waitForTimeout` / `Thread.sleep` / `time.sleep`; thao tác trước khi API/DOM hoàn tất | Thay bằng Web-First Assertions (`expect().toBeVisible()`) hoặc `WebDriverWait` |
| 📊 **Xung đột Test Data song song** | Fail khi chạy 5 workers do dùng chung bản ghi hoặc trùng key (`Duplicate email/code`) | Sinh dữ liệu độc lập gắn timestamp + worker index (`auto_<test>_<ts>`) |
| 🔗 **Phụ thuộc trạng thái (Shared State)** | Test B phụ thuộc dữ liệu do Test A tạo ra; chạy riêng lẻ thì FAIL | Cô lập hoàn toàn từng test (`Arrange` tự tạo dữ liệu, `afterEach` tự dọn) |
| 🎭 **Animation / Overlay che khuất** | `Element is not stable`, `intercepts pointer events` do spinner/toast/modal đang chuyển cảnh | Chờ spinner/overlay ẩn hẳn (`toBeHidden()`) trước khi tương tác |

> Xem ví dụ code đối chiếu `Sai vs Đúng` và mẫu báo cáo tại [`references/FLAKY_ROOT_CAUSES_AND_FIXES.md`](references/FLAKY_ROOT_CAUSES_AND_FIXES.md).

---

## 3. Quy Trình Chẩn Đoán & Khử Flaky 5 Bước

1. **Tái hiện & Thu thập bằng chứng (Detect):** Chạy lặp bài test nghi ngờ (`--repeat-each=5` hoặc chạy song song) ở chế độ **Headless `1920x1080`** để bắt log lỗi, trace và screenshot tại thời điểm fail.
2. **Đọc Code & Phân tích DOM (Inspect):** Kiểm tra mã nguồn Test + Page Object để tìm hard sleep, locator yếu hoặc biến dùng chung; mở trình duyệt qua Playwright MCP nếu cần kiểm tra hành vi loading/animation thực tế.
3. **Phân loại & Xuất báo cáo `reports/flaky_test_analysis.md` (Classify — HITL Checkpoint ⏸️):** Chỉ rõ nguyên nhân gốc cho từng bài test kèm đoạn code đề xuất sửa. Dừng chờ user duyệt nếu ở `Mode = FIX`.
4. **Áp dụng bản sửa (Fix — `Mode = FIX`):** Thay thế bằng smart wait, locator chuẩn và dữ liệu độc lập (tuyệt đối không tăng số giây `sleep` hay gắn `.skip` để che lỗi).
5. **Kiểm chứng độ ổn định (Verify):** Chạy lại bài test tối thiểu **5 lần liên tiếp** (và chạy chung trong suite song song) đảm bảo **PASS 100% (5/5)** trước khi kết luận đã khử flaky.

---

## 4. Checklist Ổn Định (Stability Gate)

- [ ] Bộ định vị duy nhất (`count === 1`) và bền vững qua các lần tải lại trang.
- [ ] Không còn bất kỳ lệnh `waitForTimeout`, `Thread.sleep`, `time.sleep` cố định nào.
- [ ] Dữ liệu kiểm thử là duy nhất và có khả năng chạy song song nhiều luồng không đụng độ.
- [ ] Bài test hoàn toàn độc lập, chạy riêng lẻ hay chạy bất kỳ thứ tự nào đều PASS.
- [ ] Đã kiểm chứng chạy **PASS 5+ lần liên tiếp**.

---

## 5. Tài Liệu Tham Chiếu

- [`references/FLAKY_ROOT_CAUSES_AND_FIXES.md`](references/FLAKY_ROOT_CAUSES_AND_FIXES.md) — Mẫu code khắc phục 5 nhóm Flaky & mẫu báo cáo `flaky_test_analysis.md`
- [`.claude/rules/locator_strategy.md`](../../rules/locator_strategy.md) — Ma trận ưu tiên bộ định vị chuẩn
- [`.claude/rules/playwright_rules.md`](../../rules/playwright_rules.md) · [`.claude/rules/selenium_rules.md`](../../rules/selenium_rules.md) · [`.claude/rules/automation_rules.md`](../../rules/automation_rules.md)