# Ticket 06: Unified Evidence Capture (Screenshot & Video for Pass & Fail) & Vision Token Optimization

Status: resolved
Labels: agent:ready, blocked-by:none
Depends on: 01, 04, 05

## Objective
Unify and optimize the screenshot and video evidence capture pipeline across both Automation Test Runners (`Playwright TS`, `Playwright Java`, `Selenium Java`, `Pytest`), Manual Test Execution (`skills-manual-test-executor`), UI Recon (`UI_RECON_AND_EVIDENCE.md`), and the Browser Mode Switch (`scripts/browser-mode.mjs`), ensuring both PASS and FAIL evidence are captured and persisted while minimizing CPU/disk overhead and LLM vision token waste.

## Deliverables
1. **`.claude/rules/reporting_rules.md`**:
   - Smart Screenshot Rule: PASS captures fast viewport (`fullPage: false`, `1920x1080`) -> `trang_thai_cuoi_cua_test` + saves to `reports/screenshots/`; FAIL captures full-page (`fullPage: true`) -> `trang_thai_khi_that_bai` + saves to `reports/screenshots/`.
   - Adaptive Video Rule (`VIDEO_MODE`): `retain-on-failure` (default: attaches `video_khi_that_bai` on FAIL, removes temporary PASS video) | `on` (attaches `video_bang_chung_pass` on PASS and `video_khi_that_bai` on FAIL) | `off` (disables video). All videos stored in `reports/videos/` (or `reports/test-artifacts/`).
2. **Framework Templates (`TEMPLATES_PLAYWRIGHT_TS.md`, `TEMPLATES_PLAYWRIGHT_JAVA.md`, `TEMPLATES_SELENIUM_JAVA.md`, `TEMPLATES_PYTEST_AND_CICD.md`)**:
   - Implement `VIDEO_MODE` (`retain-on-failure` default, `on`, `off`) and Allure video attachment (`video_bang_chung_pass` / `video_khi_that_bai`) in `Playwright TS`, `Playwright Java`, and `Pytest`.
   - Implement smart screenshot (`fullPage: !passed` / `full_page=not report.passed`) + disk persistence to `reports/screenshots/` across all web templates.
3. **Browser Mode Switch (`scripts/browser-mode.mjs` & `.claude/commands/browser-mode.md`)**:
   - Support `--video=on|off` (default `off`) to configure Playwright MCP with `--save-video=1920x1080` (or `1600x750` in headed mode) and `--output-dir=reports/mcp-videos`.
4. **Manual Test Executor & UI Recon Vision Token Optimization (`skills-manual-test-executor/SKILL.md` & `UI_RECON_AND_EVIDENCE.md`)**:
   - Mandate final screenshot on PASS (`evidence/<TC_ID>_pass.png`, `fullPage=false`) and failure step screenshot on FAIL (`evidence/<TC_ID>_step<N>_fail.png`) in `skills-manual-test-executor/SKILL.md`, linking PASS screenshot in the `Ghi chú` column of `execution_report.md`.
   - Replace mandatory `Read` of every captured PNG in `UI_RECON_AND_EVIDENCE.md` with the Zero-Waste Vision Token Rule: skip `Read` when `browser_snapshot` + `browser_evaluate` already confirm DOM state; use `Read` only for visual/layout inspection or suspected unrendered frames.
5. **Automated Verification (`scripts/verify-suite.mjs`)**:
   - Add Seam 4 test verifying `VIDEO_MODE`, smart screenshot rules, MCP `--video=on|off` behavior, manual PASS/FAIL evidence rules, and vision token optimization.
