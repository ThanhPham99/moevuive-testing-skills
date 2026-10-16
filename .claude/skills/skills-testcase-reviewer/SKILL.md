---
name: skills-testcase-reviewer
description: "Review and improve manual test case suites against the 6-criteria rubric, 4 Test Rings (V1-V4), and 15 field validation checklists to detect coverage gaps and duplicates."
---

# Test Case Reviewer

## 1. Vai trò & Khi nào sử dụng

Đánh giá chất lượng bộ Manual Test Cases (`docs/testcases/<module>/test_cases_<module>.md`) theo Rubric 6 tiêu chí (12 điểm) và đối soát Bản đồ 4 Vòng + Bảng 15 loại trường — phát hiện TC mơ hồ, trùng lặp và lỗ hổng độ phủ.
- **Khi dùng:** Trước khi chuyển Manual TC sang Automation, sau khi sinh TC bằng `skills-rbt-manual-testing`, hoặc onboard bộ TC có sẵn.
- **Không dùng khi:** Requirements vừa thay đổi theo ticket mới cần đồng bộ TC stale → bắt buộc dùng [`/update-testcases-from-impact`](../../commands/update-testcases-from-impact.md) (Mode DELTA) trước, rồi mới chạy skill này để chấm chất lượng.

---

## 2. Rubric Chấm Điểm Từng TC (6 Tiêu Chí — Thang 12 Điểm)

Mỗi TC chấm `0–2` điểm mỗi tiêu chí (`🟢 10–12`: Tốt · `🟡 6–9`: Cần sửa · `🔴 0–5`: Viết lại):

| # | Tiêu chí | Câu hỏi kiểm tra cốt lõi |
|---|---|---|
| 1 | **Rõ ràng (Clarity)** | Tester chưa biết tính năng đọc có làm theo được ngay không? Steps đánh số, mỗi bước 1 hành động quan sát được? |
| 2 | **Expected Result đo được** | Cụ thể, kiểm chứng được trên UI (❌ *"hoạt động đúng"* → ✅ *"Toast hiển thị 'Lưu thành công', chuyển về `/dashboard`"*). Phần cần DevTools phải tách xuống dòng `🔧 Ghi chú kỹ thuật`. |
| 3 | **Độc lập (Independence)** | TC tự chuẩn bị Pre-Condition rõ ràng, không phụ thuộc ngầm vào TC chạy trước. |
| 4 | **Test Data cụ thể** | Có dữ liệu mẫu hoặc Bảng biến thể rõ ràng; trường unique có ghi chú tiền tố traceable. |
| 5 | **Truy vết được (Traceability)** | Gắn đúng `REQ ID` đang có hiệu lực trong `requirements_<module>.md` (kiểm chứng bằng `node scripts/validate-docs.mjs --check`). |
| 6 | **Đúng trọng tâm (Focus)** | Mỗi TC kiểm chứng 1 mục tiêu rõ ràng (hoặc gộp biến thể cùng loại phản hồi của 1 trường ở chế độ `GỘP`). |

---

## 3. Phân Tích Độ Phủ Cấp Bộ TC (Bắt Buộc Đối Soát 4 Vòng & 15 Loại Trường)

> ⚠️ Rubric 6 tiêu chí chỉ chấm **cách viết từng TC**, không nhìn thấy phần bị thiếu. Bắt buộc đối soát **Bản Đồ 4 Vòng** ([`FOUR_RINGS_AND_QUALITY_GATE.md`](../skills-rbt-manual-testing/references/FOUR_RINGS_AND_QUALITY_GATE.md)) và **Bảng 15 loại trường** ([`FIELD_VALIDATION_15_TYPES.md`](../skills-rbt-manual-testing/references/FIELD_VALIDATION_15_TYPES.md)) trong [`skills-rbt-manual-testing`](../skills-rbt-manual-testing/SKILL.md):

| Vòng | Nhánh bắt buộc đối soát | Ba điểm hay bị bỏ sót nhất (Soi kỹ) |
|---|---|---|
| **V1 Smoke** | UI cơ bản · Open form · Display · Input valid · Save · Verify data | 🚨 **1. `UI cơ bản` (V1):** Thiếu kiểm nhãn nguyên văn, thứ tự field, trạng thái mặc định |
| **V2 Functional** | UI Behavior · Required · Validation · EP · BVA · Business Rule · Decision Table · State Transition · Dependency · Use Case · Save/Edit/Delete · Error Guessing | 🚨 **2. `Validation` (V2):** Đọc lướt bảng 15 loại trường (VD Password/Email có 9 mục nhưng chỉ viết 2–3 biến thể) |
| **V3 Technical** | Permission · Security · API · Database · Integration · Logging/Audit | 🚨 **3. `Permission` (V3):** Hệ thống có $\ge 2$ vai trò nhưng thiếu TC phân quyền |
| **V4 Non-functional** | Compatibility · Responsive · Accessibility · Performance · Regression · E2E | *(Nhánh không áp dụng ghi `➖` kèm lý do, không tính là gap)* |

---

## 4. Quy Trình 5 Bước & Mẫu Báo Cáo Review

1. **Chạy Gate tự động:** Chạy `node scripts/validate-docs.mjs --check` và `node scripts/validate-docs.mjs --rtm --module <module>` để kiểm tra nhanh schema 13 cột, link hỏng và danh sách `REQ ID` chưa có TC.
2. **Chấm điểm từng TC** theo 6 tiêu chí (kèm đề xuất sửa cụ thể trước → sau cho mọi TC `🟡`/`🔴`).
3. **Đối soát 4 Vòng & 15 loại trường** để lập bảng `Coverage Gaps` (ghi đích danh vòng/nhánh và mục còn thiếu).
4. **Phát hiện TC trùng lặp** cần gộp hoặc loại bỏ.
5. **Xuất Báo Cáo Review** (Mode `REVIEW` chỉ báo cáo; Mode `FIX` chỉ cập nhật khi người dùng yêu cầu và bảo toàn nguyên vẹn `TC ID`).

```markdown
# Báo Cáo Review Test Cases — <Module>
- **Nguồn:** `<file path>` · **Số TC:** N · **Kết quả:** 🟢 x tốt | 🟡 y cần sửa | 🔴 z viết lại · **Điểm TB:** x.x/12

## 1. Chi tiết từng TC cần cải thiện
| TC ID | Điểm | Xếp loại | Vấn đề chính | Đề xuất sửa cụ thể |
|---|---|---|---|---|

## 2. Đối soát loại kiểm thử (4 Vòng) & Coverage Gaps
| Vòng | Nhánh | Trạng thái (✅/🟡/🔴/➖) | Kịch bản / Mục còn thiếu | Priority đề xuất |
|---|---|---|---|---|

## 3. TC trùng lặp & Khuyến nghị hành động
```

---

## 5. Tham chiếu

- [`skills-rbt-manual-testing`](../skills-rbt-manual-testing/SKILL.md) · [`skills-coverage-traceability`](../skills-coverage-traceability/SKILL.md)
- Verification & RTM CLI: `node scripts/validate-docs.mjs --check` · `node scripts/validate-docs.mjs --rtm`
