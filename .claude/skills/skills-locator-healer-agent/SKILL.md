---
name: skills-locator-healer-agent
description: "Scan and heal broken or fragile UI locators in Page Objects reactively (from test failure logs) or proactively (after frontend UI changes) by inspecting live DOM."
---

# Locator Healer Agent

Tự động quét, phát hiện và hàn gắn các bộ định vị (UI Locators) bị gãy hoặc mong manh trong Page Objects bằng cách đối chiếu trực tiếp với DOM thực tế trên trình duyệt.

---

## 1. Vai Trò & Hai Kiểu Kích Hoạt

Điều phối qua `/heal-locators` (2 chế độ: `SCAN` chỉ xuất báo cáo, `HEAL` sửa Page Object + chạy lại test kiểm chứng):

| Kiểu kích hoạt | Khi nào dùng (Trigger) | Đầu vào | Đường vào |
|---|---|---|---|
| **Reactive (Chữa theo lỗi)** | Test fail với `ElementNotFound`, `TimeoutError`, `strict mode violation` | Error log + Stack trace + Page Object | `/run-and-fix-tests`, `/analyze-test-report`, `/analyze-flaky-tests` |
| **Proactive (Rà soát chủ động)** | Giao diện FE vừa cập nhật, muốn rà toàn bộ Page Object trước khi chạy suite | File Page Object + URL trang đích | `/heal-locators` |

> Ở kiểu **Proactive**, agent trích xuất toàn bộ biến locator từ Page Object, mở trình duyệt đưa giao diện về đúng trạng thái chứa phần tử và kiểm chứng từng cái — giúp bắt sớm cả locator **mong manh** (sắp gãy) lẫn locator **bấm nhầm phần tử**.

---

## 2. Phân Loại 2 Tầng: Rủi Ro Tĩnh & 6 Trạng Thái DOM Thực Tế

### 2.1. Chấm điểm rủi ro tĩnh trên mã nguồn Page Object (Static Risk Tiers)
- `🔴 Sẽ gãy`: Chứa class tự sinh/hash (`css-1a2b3c`, `sc-xxx`, `Mui...`), ID động (`:r1:`), XPath tuyệt đối hoặc chỉ số vị trí (`//div[3]/button[2]`, `:nth-child`).
- `🟡 Dễ gãy`: CSS selector phụ thuộc chuỗi cấu trúc nhiều tầng (`div > div > span`).
- `🟢 Bền`: `getByRole`, `getByLabel`, `data-testid`, hoặc `id`/`name` nghiệp vụ cố định.

### 2.2. Sáu trạng thái đối chiếu trên DOM thực tế (Live DOM States)
- `✅ OK`: Khớp đúng 1 phần tử (`count === 1`) và đúng đối tượng nghiệp vụ cần tương tác.
- `⚠️ Mong manh`: Còn khớp (`count === 1`) nhưng bám vào thuộc tính dễ đổi → cần nâng cấp sang locator bền hơn.
- `🔴 Gãy`: Khớp `0` phần tử (`ElementNotFound` / `TimeoutError`).
- `🔴 Mơ hồ`: Khớp `> 1` phần tử (gây lỗi `strict mode violation`).
- `🔴 Sai phần tử`: Khớp 1 phần tử nhưng không phải phần tử nghiệp vụ mục tiêu (nguy cơ test xanh giả).
- `❓ Chưa kiểm được`: Chưa đưa được giao diện về trạng thái chứa phần tử (ghi rõ lý do, **tuyệt đối không đoán mò**).

---

## 3. Quy Trình 4 Bước (`SCAN` & `HEAL` Modes)

1. **Bước 1 — Trích xuất Locator & Đánh giá Rủi ro Tĩnh:**
   - Quét Page Object lấy danh sách locator kèm vị trí `file:line` (hoặc đọc từ stack trace nếu chạy Reactive) và gắn nhãn `🔴`/`🟡`/`🟢`.
2. **Bước 2 — Mở DOM Thực Tế ở Đúng Trạng Thái Đích:**
   - Mở trang qua Playwright MCP (mặc định **Headless Mode `1920x1080`**, tắt GPU; nếu cần qua CAPTCHA/OTP hoặc user muốn xem trực tiếp thì bật Headed Mode qua `node scripts/browser-mode.mjs headed`).
   - Điều hướng tới đúng trạng thái chứa phần tử (mở modal/tab/dropdown) theo chuỗi `browser_navigate` → `browser_wait_for` → `browser_snapshot` và chấm 1 trong 6 trạng thái DOM.
3. **Bước 3 — Thiết Kế Locator Thay Thế & Xuất `reports/locator_scan_report.md`:**
   - Với mọi locator ở trạng thái `🔴` hoặc `⚠️`, chọn bộ định vị mới theo đúng **Ma Trận Ưu Tiên Bộ Định Vị Chuẩn** tại [`.claude/rules/locator_strategy.md`](../../rules/locator_strategy.md) và kiểm chứng `count === 1` trên DOM thật.
   - Xuất báo cáo `reports/locator_scan_report.md` theo mẫu tại [`references/HEALING_REPORT_AND_STRATEGIES.md`](references/HEALING_REPORT_AND_STRATEGIES.md):
     `| File:line | Tên biến | Locator hiện tại | Trạng thái | Locator đề xuất | Lý do |`
   - ⏸️ **HITL Checkpoint:** Nếu `Mode = SCAN` → kết thúc. Nếu `Mode = HEAL` → chờ user duyệt bảng đề xuất trước khi sửa code.
4. **Bước 4 — Cập Nhật Page Object & Chạy Kiểm Chứng (`Mode = HEAL`):**
   - Thay thế biểu thức locator trong Page Object (**giữ nguyên tên biến/method** để không làm gãy các file test đang gọi).
   - Chạy lại các bài test liên quan (tối đa 3 vòng tinh chỉnh) cho đến khi **PASS 2 lần liên tiếp**. Nếu fail do lỗi nghiệp vụ ứng dụng, giữ nguyên hiện trường và chuyển sang `/run-and-fix-tests`.

---

## 4. Checklist Kiểm Chứng & Tài Liệu Tham Chiếu

- [ ] Locator mới khớp duy nhất 1 phần tử (`count === 1`) và đúng đối tượng nghiệp vụ.
- [ ] Không làm thay đổi tên biến/method public của Page Object.
- [ ] Bài test liên quan chạy PASS ổn định qua các lần reload trang.

### Tài liệu tham chiếu
- [`references/HEALING_REPORT_AND_STRATEGIES.md`](references/HEALING_REPORT_AND_STRATEGIES.md) — Mẫu báo cáo `locator_scan_report.md` đầy đủ & chiến lược bảo toàn Page Object
- [`.claude/rules/locator_strategy.md`](../../rules/locator_strategy.md) · [`.claude/rules/automation_rules.md`](../../rules/automation_rules.md)
- [`skills-smart-locator-agent`](../skills-smart-locator-agent/SKILL.md) · [`skills-ui-debug-agent`](../skills-ui-debug-agent/SKILL.md)