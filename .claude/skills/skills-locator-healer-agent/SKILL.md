---
name: skills-locator-healer-agent
description: "Scan and heal broken or fragile UI locators in Page Objects reactively (from test failure logs) or proactively (after frontend UI changes) by inspecting live DOM."
---

# Locator Healer Agent

Purpose: Automatically repair broken locators when automation tests fail.

---

## When to Use

Use this skill when:

- A test fails with "element not found" or "element detached" errors
- UI has changed and existing locators no longer work
- After a frontend deployment that modifies DOM structure

Workflow: `/heal-locators` (2 modes — SCAN chỉ báo cáo, HEAL sửa + verify).

---

## Hai Kiểu Kích Hoạt

| Kiểu | Trigger | Input | Đường vào |
|---|---|---|---|
| **Reactive** — chữa theo lỗi | Test fail với `ElementNotFound` / `strict mode violation` | Error log + stack trace | `/run-and-fix-tests`, `/analyze-test-report`, `/analyze-flaky-tests` |
| **Proactive** — rà cả loạt | UI vừa đổi, chưa chạy test cũng rà được | Page Object + URL | `/heal-locators` |

Kiểu proactive **không có error log để lần theo** — phải trích toàn bộ locator từ Page Object, mở browser đưa về đúng trạng thái chứa element, rồi đối chiếu từng cái. Bắt được cả locator **mong manh** (còn chạy nhưng bám thuộc tính dễ đổi) lẫn locator **sai element** (match 1 element nhưng không phải element cần — test vẫn xanh mà thao tác nhầm chỗ).

---

## Responsibilities

When a locator fails:

1. Inspect current DOM or UI hierarchy
2. Compare old locator with current page structure
3. Identify updated attributes
4. Generate a replacement locator
5. Re-run test to verify the fix

---

## Detection Strategy & 2-Layer Classification

### 1. Chấm điểm rủi ro tĩnh trên mã nguồn Page Object (Static Risk Tiers)
- `🔴 Sẽ gãy`: Chứa class động (`css-1a2b3c`, `sc-xxx`, `Mui...`), ID tự sinh (`:r1:`), XPath tuyệt đối hoặc chỉ số vị trí (`//div[3]/button[2]`, `nth-child`).
- `🟡 Dễ gãy`: CSS selector phụ thuộc chuỗi cấu trúc nhiều tầng (`div > div > span`).
- `🟢 Bền`: `getByRole`, `getByLabel`, `data-testid`, hoặc `id`/`name` cố định.

### 2. Sáu trạng thái đối chiếu trên DOM thực tế (Live DOM States)
- `✅ OK`: Khớp đúng 1 phần tử (`count === 1`) và đúng đối tượng nghiệp vụ cần tương tác.
- `⚠️ Mong manh`: Còn khớp nhưng dùng thuộc tính dễ đổi → cần nâng cấp sang locator bền hơn.
- `🔴 Gãy`: Khớp `0` phần tử (`ElementNotFound` / `TimeoutError`).
- `🔴 Mơ hồ`: Khớp `> 1` phần tử (gây lỗi `strict mode violation`).
- `🔴 Sai phần tử`: Khớp 1 phần tử nhưng không phải phần tử nghiệp vụ mục tiêu.
- `❓ Chưa kiểm được`: Chưa đưa được giao diện về trạng thái chứa phần tử (ghi rõ lý do, không đoán).

---

## Healing Workflow (`SCAN` & `HEAL` Modes)

### Step 1: Extract Locators & Analyze Error / Static Risk
- Trích xuất toàn bộ biến locator kèm vị trí `file:line` trong Page Object (hoặc đọc stack trace nếu chạy Reactive) và chấm điểm rủi ro tĩnh (`🔴`/`🟡`/`🟢`).

### Step 2: Inspect Current DOM in Target State
- Mở trang qua Playwright MCP (mặc định **Headless Mode** `1920x1080`, tắt GPU; nếu cần qua CAPTCHA/OTP hoặc user muốn xem trực tiếp thì bật Headed Mode qua `node scripts/browser-mode.mjs headed`).
- Điều hướng tới đúng trạng thái chứa phần tử (mở modal/tab/dropdown) theo chuỗi `browser_navigate` → `browser_wait_for` → `browser_snapshot` và chấm 1 trong 6 trạng thái DOM.

### Step 3: Design Replacement Locator & Emit `reports/locator_scan_report.md`
- Với mọi locator ở trạng thái `🔴` hoặc `⚠️`, chọn bộ định vị thay thế theo đúng **Ma Trận Ưu Tiên Bộ Định Vị Chuẩn (Locator Priority Matrix)** tại [`.claude/rules/locator_strategy.md`](../../rules/locator_strategy.md) và kiểm chứng `count === 1` trên DOM thật.
- Xuất báo cáo `reports/locator_scan_report.md` theo bảng chuẩn:
  `| File:line | Tên biến | Locator hiện tại | Trạng thái | Locator đề xuất | Lý do |`
- ⏸️ **HITL Checkpoint:** Nếu `Mode = SCAN` → kết thúc sau khi xuất báo cáo. Nếu `Mode = HEAL` → chờ user duyệt bảng đề xuất trước khi sửa code.

### Step 4: Replace in Page Object & Verify (`Mode = HEAL`)
- Thay thế locator trong Page Object (**giữ nguyên tên biến/method** để không làm gãy các file test đang gọi).
- Chạy lại các bài test liên quan (tối đa 3 vòng tinh chỉnh) cho đến khi **PASS 2 lần liên tiếp**. Nếu fail do lỗi nghiệp vụ ứng dụng, giữ nguyên hiện trường và chuyển sang `/run-and-fix-tests`.

---

## Difference from Smart Locator Agent

| Aspect | Locator Healer | Smart Locator |
|--------|---------------|---------------|
| **Trigger** | Test failure (reactive) | New element (proactive) |
| **Input** | Broken locator + error log | HTML/DOM element |
| **Goal** | Fix existing locator | Generate new locator |
| **Workflow** | Error → Inspect → Replace → Verify | Inspect → Generate → Validate |

---

## Verification

After healing:

- [ ] Locator must match exactly one element
- [ ] Element is the correct target (verify text/attributes)
- [ ] Test must pass successfully
- [ ] Locator is stable across page reloads

---

## Rules References

- `.claude/rules/locator_strategy.md` — Master locator priority map
- `.claude/rules/automation_rules.md` — General automation best practices
- `.claude/skills/skills-smart-locator-agent/SKILL.md` — Sinh locator thay thế
- `.claude/skills/skills-ui-debug-agent/SKILL.md` — Inspect DOM đúng trạng thái