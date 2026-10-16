---
name: generate-test-summary-report
description: "Tổng hợp kết quả kiểm thử toàn dự án tại một mốc (Release/Sprint/UAT) thành báo cáo gửi PM/Khách hàng — gộp execution reports, bugs, RTM kèm khuyến nghị GO / NO-GO có căn cứ."
skills:
  - skills-test-summary-reporter
---

# Generate Test Summary Report (Workflow Dispatcher)

Tổng hợp toàn bộ kết quả kiểm thử Manual, Automation, tình trạng Bug và Độ phủ Yêu cầu (RTM) tại một mốc phát hành thành **Báo cáo Tổng hợp Kiểm thử (Test Completion Report)** dành cho PM/PO/Khách hàng.

## Inputs
- **Milestone / Release (`<mốc>`) & Build Version**: Tên đợt kiểm thử (VD: `Release v2.4`, `Sprint 12`, `UAT Đợt 2`) và mã phiên bản build.
- **Scope**: Danh sách các modules thuộc phạm vi đợt phát hành.
- **Repository Artifacts** *(Tự động thu thập)*:
  - `docs/executions/*/run_*/execution_report.md` & `docs/executions/*/retest_*/retest_report.md`
  - `docs/bugs/README.md` & `docs/bugs/<module>/BUG_*.md`
  - `docs/requirements/README.md` (hoặc `_index.md`) & `traceability_matrix.md`
  - `reports/` (kết quả chạy Automation nếu có)

## Context Pointers (Lazy-Load On Demand)
- **Exit Criteria, 9-Section Template & ISO/IEC/IEEE 29119-3 Mapping**: `.claude/skills/skills-test-summary-reporter/SKILL.md`
- **Jira Bug Sync (chỉ đọc khi dự án quản lý bug trên Jira thay vì `docs/bugs/`)**: `.claude/skills/skills-jira-integration/SKILL.md`

## Nguyên tắc Thực thi Bắt buộc
1. **Chốt Tiêu chí Exit TRƯỚC khi chấm kết quả**: Không nhìn số liệu rồi mới hạ ngưỡng hợp thức hóa.
2. **Vùng chưa kiểm thử đặt TRƯỚC mọi tỷ lệ phần trăm**: Để người đọc thấy ngay các khoảng trống (Untested / Blind spots) trước khi nhìn tỷ lệ Pass.
3. **Không cộng gộp Manual và Automation**: Luôn trình bày ở hai bảng riêng biệt.
4. **QA khuyến nghị (`🟢 GO` / `🟡 GO có điều kiện` / `🔴 NO-GO`), PM/PO quyết định**: Kể cả khi khuyến nghị `🟢 GO` vẫn phải liệt kê rủi ro tồn đọng. Tuyệt đối không tự bịa số liệu hay đưa thông tin tài khoản/dữ liệu nhạy cảm vào báo cáo.

## Execution Steps

### Bước 0: Chốt Phạm vi, Build & Tiêu chí Exit (HITL Checkpoint ⏸️)
⏸️ **DỪNG LẠI (HITL Checkpoint)**: Hỏi người dùng xác nhận nhanh trước khi tổng hợp:
- **Mốc báo cáo**, **Phiên bản Build/Version**, và **Người nhận báo cáo** (nội bộ hay khách hàng);
- **Phạm vi module** trong đợt này;
- **Bộ Tiêu chí Exit**: Sử dụng bộ 7 tiêu chí chuẩn trong `skills-test-summary-reporter` (khớp với `/generate-master-test-plan`) hay bộ ngưỡng riêng của dự án.

### Bước 1: Thu thập & Đối chiếu Đa Nguồn Dữ liệu
1. Quét toàn bộ các file báo cáo thực thi (`execution_report.md` lấy bản chạy mới nhất mỗi module, `retest_report.md`), danh sách bug (`docs/bugs/`), trạng thái khảo sát hệ thống (`docs/requirements/`) và `traceability_matrix.md`.
2. Phát hiện các module nằm trong phạm vi nhưng chưa có execution report (đưa vào mục **Vùng chưa kiểm thử**) và kiểm tra mọi mâu thuẫn số liệu giữa các nguồn (nếu lệch phải nêu rõ cả hai).

### Bước 2: Chấm Tiêu chí Exit & Xác định Khuyến nghị Release
- Chấm từng tiêu chí trong 7 Tiêu chí Exit: `✅ Đạt` / `❌ Không đạt` / `🟡 Ngoại lệ chờ duyệt` / `➖ Không áp dụng` kèm con số thực tế (không có mức "gần đạt").
- Xác định khuyến nghị: `🟢 GO` (đạt 100% tiêu chí), `🟡 GO có điều kiện` (có workaround được duyệt), hoặc `🔴 NO-GO` (còn bug Critical mở hoặc gãy luồng chính).

### Bước 3: Xuất Báo cáo Tổng hợp (`docs/executions/test_summary_<mốc>_<timestamp>.md`)
Áp dụng đúng cấu trúc **9 mục bắt buộc** trong `.claude/skills/skills-test-summary-reporter/SKILL.md`:
1. **Khuyến nghị Release** (`🟢 GO` / `🟡 GO có điều kiện` / `🔴 NO-GO` + tuyên bố ranh giới trách nhiệm PM/PO).
2. **Vùng chưa kiểm thử (Untested Areas & Blind Spots)** *(Đặt trước mọi bảng tỷ lệ)*.
3. **Đối chiếu Tiêu chí Exit**.
4. **Kết quả Thực thi theo Module** (Bảng Manual riêng, Bảng Automation riêng).
5. **Tình hình Lỗi (Bug Status & Regression)**.
6. **Độ phủ Yêu cầu (RTM Coverage)**.
7. **Đề xuất Hành động Tiếp theo**.
8. **Yếu tố Cản trở & Bài học Kinh nghiệm** (`8.1 Thời lượng bị chặn thực tế`, `8.2 Bài học chỉ đích danh nơi áp dụng`).
9. **Phụ lục — Ánh xạ cấu trúc ISO/IEC/IEEE 29119-3 (Test Completion Report) & IEEE 829** (chỉ ghi tên mục chuẩn, không ghi số điều khoản).

## Output
- `docs/executions/test_summary_<mốc>_<timestamp>.md` (tương thích trực tiếp với `scripts/execution-viewer/bundle.html`).
