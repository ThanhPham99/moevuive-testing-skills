# 05: Always-Loaded Context Compaction & Full-Suite Contract Gate

**What to build:** Compact the root **Always-Loaded Context** (`CLAUDE.md`) by 70%+ using **Context Pointers** to the refactored rules and skills, align auxiliary prompt and plan templates (`prompts/`, `plans/`, `AI_FULL_FLOW_*.md`, `README.md`) with the default **Headless Mode** and **Browser Mode Switch**, and enforce the final strict token-budget, pointer-integrity, and viewer-compatibility assertions in the automated verification gate.

**Blocked by:** `01-headless-browser-switch-and-harness.md`, `02-requirements-and-discovery-vertical.md`, `03-rbt-manual-testing-vertical.md`, `04-framework-router-and-automation-vertical.md`

**Status:** resolved

- [x] Root **Always-Loaded Context** (`CLAUDE.md`) is compacted from 516 lines (~43 KB) to <= 140 lines (<= 12 KB), preserving all global invariants (Git read-only rule, Vietnamese communication rule, default **Headless Mode** & **Browser Mode Switch**, 3-tier `docs/` reading protocol, `REQ ID` / `TC ID` immutability, evidence & security hygiene, smart waits) and pointing to `.claude/rules/` and `.claude/skills/`.
- [x] Auxiliary copy-paste prompts and flow guides (`prompts/`, `plans/`, `AI_FULL_FLOW_*.md`, `README.md`) are updated to reflect default **Headless Mode** (`1920x1080`) and on-demand **Headed Mode** (`1600x750`) switching.
- [x] Automated verification suite enforces final strict budgets (Always-Loaded Context reduced by >= 65%, all `SKILL.md` entry points <= 200 lines, all **Workflow Dispatchers** <= 120 lines, 100% valid **Context Pointers**, and 100% preservation of HTML viewer markdown schemas) and passes with zero errors.

## Comments

- Compacted `CLAUDE.md` from 516 lines (43,134 bytes) down to 105 lines (7,633 bytes — an 82.3% reduction!).
- Updated `prompts/prompt_16_execute_test_cases.txt`, `plans/automation/02_analysis_and_ui_recon/README.md`, `AI_FULL_FLOW_AUTOMATION.md`, and `README.md`.
- Expanded `scripts/verify-suite.mjs` with Seam 2 and Seam 3 assertions; all 7/7 tests pass.
