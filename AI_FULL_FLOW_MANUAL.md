# 🔄 AI Full Flow — Manual Testing

> Quy trình đầy đủ dùng AI cho **Manual Testing**, từ hệ thống chưa có gì → tài liệu → test cases → chạy tay → bug report → retest → ma trận truy vết → báo cáo release.
>
> Áp dụng cho tình huống phổ biến nhất: **hệ thống chỉ có UI, không tài liệu, không bộ test cases**.

---

## Toàn cảnh 8 chặng

```
┌─ CHUẨN BỊ TÀI LIỆU ──────────────────────────────────────────────┐
│  0. /discover-system                     → bản đồ module + prefix│  1 lần / hệ thống
│  1. /generate-requirements-from-website  → REQ ID                │  N lần = số module
└──────────────────────────────────────────────────────────────────┘
                                  ↓
┌─ SINH & KIỂM TEST CASES ─────────────────────────────────────────┐
│  2. /generate-testcases-manual-rbt       → TC có cột REQ ID      │  N lần = số module
│  3. /review-testcases                    → chấm rubric, lấp gap  │
└──────────────────────────────────────────────────────────────────┘
                                  ↓
┌─ THỰC THI & XỬ LÝ LỖI ───────────────────────────────────────────┐
│  4. /execute-test-cases                  → chạy tay, chấm P/F/B/S│  Mỗi đợt kiểm thử
│  5. /analyze-test-report                 → gom nhóm root cause   │
│     /create-bug-report                   → bug report chuẩn      │
│     /retest-fixed-bugs   ←──── dev fix ───┘  → FIXED? regression?│  ↻ lặp tới khi hết bug
└──────────────────────────────────────────────────────────────────┘
                                  ↓
┌─ CHỨNG MINH ĐỘ PHỦ ──────────────────────────────────────────────┐
│  6. /generate-traceability-matrix        → RTM                   │  Trước release
└──────────────────────────────────────────────────────────────────┘
                                  ↓
┌─ BÁO CÁO & QUYẾT ĐỊNH ───────────────────────────────────────────┐
│  7. /generate-test-summary-report        → go / no-go có căn cứ  │  Mỗi mốc release
└──────────────────────────────────────────────────────────────────┘
```

> 📋 **Đợt kiểm thử có kế hoạch chính thức** (khách hàng/PM yêu cầu tài liệu duyệt) → chạy `/generate-master-test-plan` **trước chặng 4**. Nó công bố tiêu chí exit mà chặng 7 sẽ chấm lại.

**Mắt xích giữ cả chuỗi là `REQ ID`.** Chặng 1 sinh ra → chặng 2 ghi vào cột `REQ ID` của mỗi TC → chặng 6 dùng để tính coverage. Đứt ở đâu thì từ đó trở đi không chứng minh được "đã test đủ".

---

## Chặng 0 — Khám phá hệ thống

> **Chạy 1 lần cho cả hệ thống.** Trả lời câu hỏi: *"hệ thống này có những module nào?"*

```
/discover-system
```

📋 Prompt mẫu: [`prompts/prompt_00_discover_system.txt`](prompts/prompt_00_discover_system.txt)

**Cần chuẩn bị:** URL · tài khoản (càng nhiều role càng tốt) · tài liệu sẵn có nếu QA đưa được · môi trường có dùng chung không.

**AI tự chọn mode** — bạn không cần khai:

| Đầu vào | Mode |
|---|---|
| URL, không tài liệu | **UI** |
| URL + tài liệu (kể cả chỉ một phần) | **HYBRID** |
| Chưa có account, chỉ có tài liệu | **DOC** |

AI công bố mode ở câu đầu tiên — sai thì chặn ngay lúc đó.

**⏸️ Checkpoint** — AI dừng, hỏi 3 câu. Câu quan trọng nhất: *"có module nào tôi không thấy được vì thiếu quyền / nằm sâu trong menu / chỉ vào được bằng URL?"* — trả lời ở đây rẻ hơn nhiều so với bổ sung sau.

**Đầu ra:**
```
docs/requirements/README.md                    ← danh mục, mọi module đang ⬜
docs/requirements/_discovery/system_map.md     ← bản đồ (tách modules/ nếu > 8 module)
docs/requirements/_discovery/doc_inventory.md  ← chỉ khi có tài liệu
```

> ⚠️ Chặng này **không sinh REQ ID**, chỉ cấp **prefix** (`CUST`, `PRJ`…). Cấp số REQ khi chưa mở form là chắc chắn phải đánh lại.

**Phát hiện sót module về sau:** nói thẳng *"còn thiếu module Báo cáo, vào bằng `/admin/reports`"* → AI chạy **mode ADD**, chỉ xử lý module đó. Muốn rà lại toàn bộ → *"rà lại xem có gì mới"* → **mode DELTA**.

---

## Chặng 1 — Sinh Requirements

> **Chạy lặp, mỗi lần một module**, theo thứ tự đã chốt ở chặng 0.

```
/generate-requirements-from-website
```

📋 Prompt mẫu: [`prompts/prompt_01_generate_requirements.txt`](prompts/prompt_01_generate_requirements.txt)

| Biến thể | Command | Prompt mẫu |
|---|---|---|
| Có ticket Jira thay vì UI | `/analyze-requirement-document` | [`prompt_20`](prompts/prompt_20_analyze_requirement_document.txt) |
| Tài liệu đã có, ticket sửa đổi | `/update-requirements-from-ticket` | [`prompt_21`](prompts/prompt_21_update_requirements_from_ticket.txt) |
| Tài liệu vừa đổi, **bộ TC đã có cần đồng bộ** | `/update-testcases-from-impact` | [`prompt_27`](prompts/prompt_27_update_testcases_from_impact.txt) |

**AI làm gì:** đọc bản đồ chặng 0 (khỏi dò đường) → mở từng form → **trigger từng validation lấy message nguyên văn** → đọc DOM bằng `browser_evaluate` → bắt network lấy validation server-side → chụp evidence full-page → sinh `REQ-<PREFIX>-NN`.

**Đầu ra:**
```
docs/requirements/<module>/requirements_<module>.md   ← tên file BẤT BIẾN
docs/requirements/<module>/evidence/*.png
```
Cộng thêm: `README.md` cập nhật `Trạng thái recon` ⬜ → ✅.

**Xong module này thì lặp lại cho module kế tiếp.** Cột `Trạng thái recon` xanh hết = khảo sát xong hệ thống.

### Kiểm trước khi sang chặng 2

- [ ] Mọi yêu cầu đều có `REQ ID`, cột `Nguồn` không để trống
- [ ] Error message ghi **nguyên văn** từ UI, không diễn đạt lại
- [ ] Evidence chụp **full-page**, có ảnh cho từng trạng thái động (dropdown mở, form lỗi, từng tab)
- [ ] Ma trận phân quyền có **dòng tổng** `Đã kiểm chứng / Suy diễn / Chưa rõ`
- [ ] Ambiguity 🔴 High đã gửi PO — hoặc đã ghi **Assumption tạm** để test tiếp được

---

## Chặng 2 — Sinh Test Cases

> **Chạy lặp, mỗi lần một module.** Chọn đúng 1 trong 3 mode.

| Mode | Command | Prompt mẫu | Khi nào dùng |
|---|---|---|---|
| **FULL RBT** | `/generate-testcases-manual-rbt` | [`prompt_02_generate_test_cases.txt`](prompts/prompt_02_generate_test_cases.txt) | Module lớn · requirements còn mơ hồ · cần đánh giá risk · **bộ TC gốc của module** |
| **QUICK** | `/generate-testcases-from-requirements` | [`prompt_22_generate_testcases_quick.txt`](prompts/prompt_22_generate_testcases_quick.txt) | Requirements đã rõ · scope 1 form / 1 tính năng · cần nhanh |
| **CHECKLIST** | `/generate-checklist-test` | [`prompt_15_generate_checklist.txt`](prompts/prompt_15_generate_checklist.txt) | Rà tay nhanh: smoke · sau hotfix · trước release |

**Đầu ra tương ứng:** FULL RBT / QUICK → TC chi tiết có steps. CHECKLIST → danh sách tick, **không** có steps.

**Ranh giới:** cần **bộ TC lưu trữ / import Jira / giao cho automation** → QUICK hoặc FULL RBT. Cần **tick tay cho nhanh** → CHECKLIST.

💡 **Khuyến nghị:** module đầu tiên của hệ thống làm bằng **FULL RBT** — nó ép trả lời những câu hỏi nghiệp vụ mà sau này kiểu gì cũng phải hỏi. Các module tương tự sau đó dùng QUICK cho nhanh.

**Quy tắc AI bắt buộc tuân thủ ở chặng này:**
- **Mở toàn bộ evidence trước khi viết TC** — không đọc ảnh mà viết là bịa
- **Ảnh thắng tài liệu** khi hai bên mâu thuẫn
- Evidence thiếu/cắt cụt → TC bị gắn `@NeedsVerify`, **không suy diễn**
- **Write-first** — ghi thẳng vào file, không in cả bảng TC ra chat

**Đầu ra:**
```
docs/testcases/<module>/test_cases_<module>.md   ← INDEX, tên file BẤT BIẾN
docs/testcases/<module>/parts/part_NN_<slug>.md  ← khi > 40 TC
docs/checklists/checklist_<loại>_<module>.md     ← nếu chạy mode CHECKLIST
```

---

## Chặng 3 — Review Test Cases

```
/review-testcases
```

📋 Prompt mẫu: [`prompts/prompt_12_review_testcases.txt`](prompts/prompt_12_review_testcases.txt)

| Mode | Làm gì |
|---|---|
| **REVIEW** (mặc định) | Chấm rubric 6 tiêu chí, chỉ ra TC mơ hồ / trùng lặp / thiếu negative-boundary / coverage gap |
| **FIX** | Như trên + sinh file TC phiên bản cải thiện (**giữ nguyên file gốc**) |

Nói *"sửa luôn"* / *"cải thiện giùm"* → AI tự chuyển sang **FIX**.

> Chặng này hay bị bỏ qua. Nhưng review 30 phút rẻ hơn nhiều so với chạy tay 50 TC rồi mới phát hiện một nửa viết sai.

> 🤖 **Muốn automate bộ TC này?** Đây là điểm rẽ — bộ TC đã review xong là **đầu vào của** [`AI_FULL_FLOW_AUTOMATION.md`](AI_FULL_FLOW_AUTOMATION.md). Hai flow chạy song song được: automation lo phần regression lặp lại, manual lo phần còn lại.

---

## Chặng 4 — Thực thi Manual

```
/execute-test-cases
```

📋 Prompt mẫu: [`prompts/prompt_16_execute_test_cases.txt`](prompts/prompt_16_execute_test_cases.txt)

**AI làm gì:** mở browser thật qua Playwright MCP → chạy từng bước theo TC → đối chiếu Expected vs Actual → chấm **PASS / FAIL / BLOCKED / SKIPPED** → thu evidence.

### 🎯 Chiến lược phân tầng thực thi (Execution Tiers)
Để tối ưu chi phí token và thời gian thực thi (tránh chạy 50 TC qua AI tốn > 1 tiếng):
- **Tier 1 (AI-Assisted Interactive):** Chạy Smoke (Vòng 1) và Critical flows ($\le 15$ TC) bằng `/execute-test-cases` để AI xác nhận trạng thái sống còn của app.
- **Tier 2 (Headless Automation Batch):** Chuyển Vòng 2 & 3 (Functional, Validation, Boundary) sang Automation bằng `/generate-automation-from-testcases` và chạy bằng script headless (50 TCs trong < 1 phút).
- **Tier 3 (Checklist Human-in-the-loop):** Chuyển Vòng 4 (UI visual, A11y, responsive) sang `/generate-checklist-test` để tester tick tay trên web viewer.

**Đầu ra:**
```
docs/executions/<module>/run_<timestamp>/execution_report.md
docs/executions/<module>/run_<timestamp>/evidence/<TC_ID>_<mô_tả>.png
```

Report gồm 6 mục: Tổng kết · Kết quả từng TC · Chi tiết FAIL · TC BLOCKED · **Dữ liệu đã tạo & dọn dẹp** · Đề xuất bước tiếp theo.

### ⚠️ Hai luật quan trọng

**1. KHÔNG sửa TC trong lúc chạy.** TC FAIL vì viết sai thì ghi nhận lại, chạy xong mới quay về `/review-testcases` mode FIX. Sửa giữa chừng là mất dấu vết của lần chạy đó.

**2. Môi trường dùng chung → kiểm mục "Dữ liệu đã tạo & dọn dẹp" mỗi lần chạy.** Dữ liệu test phải traceable (`Auto_<Module>_<timestamp>`) và có kế hoạch xoá. Không dọn thì vài lần chạy là môi trường thành bãi rác, và người khác lãnh hậu quả.

---

## Chặng 5 — Xử lý FAIL

| Tình huống | Command | Prompt mẫu | Ghi chú |
|---|---|---|---|
| **Nhiều TC FAIL**, chưa rõ nguyên nhân | `/analyze-test-report` | [`prompt_11_analyze_test_report.txt`](prompts/prompt_11_analyze_test_report.txt) | **Chạy cái này trước** — 12 TC FAIL thường chỉ là 2 bug |
| Đã rõ bug, cần báo cáo | `/create-bug-report` | [`prompt_10_create_bug_report.txt`](prompts/prompt_10_create_bug_report.txt) | Tự lấy evidence từ run vừa rồi, tuỳ chọn đẩy Jira |
| FAIL vì **TC viết sai**, không phải lỗi hệ thống | `/review-testcases` mode FIX | [`prompt_12_review_testcases.txt`](prompts/prompt_12_review_testcases.txt) | Quay lại chặng 3 |
| **Dev báo đã fix**, cần xác minh | `/retest-fixed-bugs` | [`prompt_23_retest_fixed_bugs.txt`](prompts/prompt_23_retest_fixed_bugs.txt) | Đóng vòng lặp bug — xem dưới |

**Đầu ra:**
```
docs/executions/<module>/analysis_<timestamp>.md ← gom nhóm theo root cause (nhánh MANUAL)
docs/bugs/<module>/BUG_<module>_<timestamp>_<TC_ID>.md  ← mỗi bug 1 file, hậu tố TC_ID để nhìn tên biết ngay thuộc TC nào
```

> Gom nhóm trước rồi mới viết bug report — đỡ tạo 12 bug trùng nhau cho cùng một nguyên nhân.

### Vòng lặp bug — chạy tới khi hết, không phải một chiều

```
TC FAIL → /create-bug-report → dev fix → /retest-fixed-bugs
                    ↑                            │
                    └──── regression mới ────────┘
```

| Kết quả retest | Nghĩa | Làm gì tiếp |
|---|---|---|
| ✅ FIXED | Chạy đúng steps gốc, khớp Expected, lặp ≥ 2 lần | Đề xuất đóng bug |
| ❌ NOT_FIXED | Lỗi cũ vẫn còn | Mở lại **bug cũ**, không tạo bug trùng |
| 🟡 PARTIAL | Hết lỗi gốc nhưng vẫn lệch Expected | Giữ bug mở, ghi rõ phần nào còn |
| ⚠️ CANNOT_VERIFY | Không dựng được pre-condition | **Không** được chấm FIXED |

⚠️ **Hai luật của chặng này:**

1. **Bug Critical/Major luôn chạy mode FULL** — verify xong phải chạy regression quanh vùng fix. Bản fix làm hỏng chỗ khác là chuyện thường xuyên, không phải ngoại lệ.
2. **TC regression FAIL = bug MỚI**, tách riêng, link về bug gốc. Gộp vào bug cũ là mất dấu vết nguyên nhân.

**Đầu ra:** `docs/executions/<module>/retest_<timestamp>/retest_report.md` + mục `Lịch sử retest` thêm vào bug gốc.

---

## Chặng 6 — Ma trận truy vết (RTM)

```
/generate-traceability-matrix
```

📋 Prompt mẫu: [`prompts/prompt_13_generate_traceability_matrix.txt`](prompts/prompt_13_generate_traceability_matrix.txt)

**Ra 4 nhóm phát hiện:**

| Ký hiệu | Nghĩa |
|---|---|
| ⬛ | **Module chưa có tài liệu** — còn ⬜ trong danh mục, nằm **ngoài** phạm vi RTM |
| 🔴 | REQ chưa có TC nào cover |
| 🟡 | TC chưa được automate |
| ⚪ | Test mồ côi — không map về REQ nào |

> ⚠️ **Đọc mục ⬛ trước mọi con số phần trăm.** Coverage 95% mà còn 3 module chưa ai khảo sát thì con số đó vô nghĩa — nó chỉ tính trên phần đã có tài liệu.

---

## Chặng 7 — Báo cáo tổng hợp & quyết định release

```
/generate-test-summary-report
```

📋 Prompt mẫu: [`prompts/prompt_24_generate_test_summary_report.txt`](prompts/prompt_24_generate_test_summary_report.txt)

Gộp **mọi** kết quả của cả đợt — execution report nhiều module + bug đang mở + RTM — thành **một** tài liệu gửi PM/khách hàng, kết thúc bằng khuyến nghị **GO / GO có điều kiện / NO-GO** kèm căn cứ.

**Ba luật của chặng này:**

| Luật | Vì sao |
|---|---|
| **QA khuyến nghị, PM quyết định** | QA không nắm áp lực thị trường, hợp đồng, chi phí trễ hạn |
| **Khuyến nghị GO vẫn phải kèm rủi ro tồn đọng** | GO trơn không nêu tồn đọng là báo cáo vô trách nhiệm — có sự cố thì không ai biết QA đã cảnh báo hay chưa |
| **Vùng chưa test đứng TRƯỚC mọi tỷ lệ** | Cùng lý do với mục ⬛ của RTM: pass rate đẹp che mất module chưa ai chạm |

**Tiêu chí exit phải chốt TRƯỚC khi nhìn kết quả.** Nhìn số rồi mới đặt ngưỡng là hợp thức hoá kết quả, không phải đánh giá. Đợt có kế hoạch chính thức thì `/generate-master-test-plan` đã công bố bộ tiêu chí này từ đầu — chặng 7 chỉ chấm lại đúng bộ đó.

**Đầu ra:** `docs/executions/test_summary_<mốc>_<timestamp>.md`

---

## Xem kết quả bằng web viewer

Không cần đọc file `.md` thô. Mở [`scripts/execution-viewer/bundle.html`](scripts/execution-viewer/README.md) (double-click, chạy offline), kéo thả file vào:

| Nạp file | Xem được gì |
|---|---|
| `execution_report.md` · `retest_report.md` (chặng 4–5) | Thống kê PASS/FAIL/BLOCKED/SKIPPED · **so sánh giữa các lần chạy** (🆕 mới fail · 🔁 fail liên tục · ✅ vừa được fix) · cảnh báo BLOCKED > 20%, nợ kiểm thử, data chưa dọn |
| `traceability_matrix.md` (chặng 6) | **Độ phủ automation** — REQ nào chưa có TC, TC nào chưa automate, REQ mới automate **một phần**, orphan test |

Xuất **CSV** hoặc **Excel** (nhiều sheet, ô trạng thái tô màu) đúng phần đang hiển thị.

Tương tự, [`scripts/testcases-viewer/bundle.html`](scripts/testcases-viewer/README.md) để duyệt và xuất Excel test case ở chặng 2–3.

---

## Vòng lặp khi Requirements thay đổi

Hệ thống đang phát triển thì ticket sẽ liên tục sửa yêu cầu. Đừng sinh lại từ đầu:

```
/update-requirements-from-ticket
        ↓  Impact Report — TC nào stale
   ┌────┴──────────────────────────────────────────┐
   ↓                                               ↓
REQ mới (🟢) → /generate_testcases_*     TC phải sửa (🟡) + TC bị gỡ (🗑️)
                                              → /update-testcases-from-impact
   └────────────────────┬─────────────────────────┘
                        ↓
            /execute-test-cases  (chạy lại phần bị ảnh hưởng)
```

> 🚨 **Không dùng `/review-testcases` mode FIX cho nhánh 🟡.** Nó chấm rubric chất lượng, không đối chiếu với REQ mới — TC viết rất tốt về hành vi **cũ** vẫn đạt 12/12 điểm. Nó cũng sinh file `_improved` lạc tên index. Đồng bộ bằng `/update-testcases-from-impact` trước, chấm chất lượng bằng `/review-testcases` sau.

Cột **`TC cần xử lý`** trong Nhật ký thay đổi của tài liệu requirements là **mắt xích cảnh báo duy nhất** cho tester biết TC nào đã lỗi thời. Bỏ qua nó là chạy test trên bộ TC sai mà không biết.

---

## Bảng tra nhanh — chạy bao nhiêu lần

| Chặng | Command | Prompt mẫu | Số lần chạy |
|---|---|---|---|
| 0 | `/discover-system` | [`prompt_00`](prompts/prompt_00_discover_system.txt) | **1 lần** / hệ thống (+ ADD/DELTA khi cần) |
| 1 | `/generate-requirements-from-website` | [`prompt_01`](prompts/prompt_01_generate_requirements.txt) | **N lần** = số module |
| 2 | `/generate-testcases-manual-rbt` | [`prompt_02`](prompts/prompt_02_generate_test_cases.txt) | **N lần** = số module |
| 2' | `/generate-checklist-test` | [`prompt_15`](prompts/prompt_15_generate_checklist.txt) | Khi cần checklist tick tay |
| 3 | `/review-testcases` | [`prompt_12`](prompts/prompt_12_review_testcases.txt) | 1 lần / bộ TC |
| 4 | `/execute-test-cases` | [`prompt_16`](prompts/prompt_16_execute_test_cases.txt) | Mỗi đợt kiểm thử |
| 5 | `/analyze-test-report` | [`prompt_11`](prompts/prompt_11_analyze_test_report.txt) | Khi nhiều TC FAIL |
| 5 | `/create-bug-report` | [`prompt_10`](prompts/prompt_10_create_bug_report.txt) | Mỗi bug cần báo |
| 5 | `/retest-fixed-bugs` | [`prompt_23`](prompts/prompt_23_retest_fixed_bugs.txt) | **Mỗi lần dev báo đã fix** |
| 6 | `/generate-traceability-matrix` | [`prompt_13`](prompts/prompt_13_generate_traceability_matrix.txt) | Định kỳ / trước release |
| 7 | `/generate-test-summary-report` | [`prompt_24`](prompts/prompt_24_generate_test_summary_report.txt) | **Mỗi mốc release / sprint** |
| ↻ | `/update-requirements-from-ticket` | [`prompt_21`](prompts/prompt_21_update_requirements_from_ticket.txt) | Mỗi ticket sửa yêu cầu |
| ↻ | `/update-testcases-from-impact` | [`prompt_27`](prompts/prompt_27_update_testcases_from_impact.txt) | **Mỗi Impact Report** — ngay sau command trên |
| ⊹ | `/generate-master-test-plan` | [`prompt_25`](prompts/prompt_25_generate_master_test_plan.txt) | 1 lần / đợt — khi cần kế hoạch chính thức |
| ⊹ | `/generate-user-guide` | [`prompt_28`](prompts/prompt_28_generate_user_guide.txt) | Khi bàn giao — tài liệu cho **người dùng cuối**, không phải cho QA |

**Biến thể của chặng 1–2** (không nằm trên luồng chính): `/analyze-requirement-document` → [`prompt_20`](prompts/prompt_20_analyze_requirement_document.txt) · `/generate-testcases-from-requirements` → [`prompt_22`](prompts/prompt_22_generate_testcases_quick.txt).

---

## Ba lỗi hay gặp nhất

**1. Nhảy thẳng vào chặng 2, bỏ chặng 0–1.**
TC sinh ra không có `REQ ID` → chặng 6 không chạy được → không ai chứng minh được "đã test đủ". Sửa sau thì phải viết lại toàn bộ TC.

**2. Bỏ qua checkpoint, gõ "tiếp tục" cho nhanh.**
Checkpoint tồn tại vì đó là chỗ AI **không thể tự quyết đúng**: ranh giới module, phạm vi test, scenario còn thiếu. Bấm qua là đẩy sai lầm xuống tận chặng 4 mới lộ.

**3. Tin coverage % mà không đọc mục ⬛.**
Xem lại cảnh báo ở chặng 6.

---

## Tài liệu liên quan

| File | Nội dung |
|---|---|
| [`AI_FULL_FLOW_AUTOMATION.md`](AI_FULL_FLOW_AUTOMATION.md) | Flow 8 chặng Automation Testing — nối tiếp từ bộ TC của chặng 2–3 |
| [`CLAUDE.md`](CLAUDE.md) | Quy tắc bắt buộc · cấu trúc `docs/` · danh sách đầy đủ workflows |
| [`README.md`](README.md) | Tổng quan bộ kit · cài đặt |
| [`SETUP_CLAUDE.md`](SETUP_CLAUDE.md) | Cài Claude Code + Playwright MCP |
| [`prompts/README.md`](prompts/README.md) | 32 prompt mẫu copy-paste, chia 7 nhóm tra cứu |
| [`plans/manual/QUICK_START.md`](plans/manual/QUICK_START.md) | Luồng 6 bước AI-RBT bản copy-paste — dùng cho AI agent khác (Codex · Antigravity · Kiro · Cursor) không có slash command của bộ này |
