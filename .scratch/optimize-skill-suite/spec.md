# Specification: Skill Suite Token Optimization & Default Headless Browser Architecture

Status: implemented

## Problem Statement

Quality Assurance engineers and AI coding agents operating within this testing skill suite face two compounding bottlenecks: excessive token consumption across every conversational turn and high GPU/system resource overhead during browser-based testing and inspection.

First, the **Always-Loaded Context** currently carries over 43 KB of instructions on every turn because global rules duplicate reference tables, directory schemas, window-border geometry essays, and full catalogs of 19 skills and 32 workflows. When a user invokes a single workflow, the corresponding **Workflow Dispatcher** repeats procedural steps and quality checklists already defined in the skills, while forcing the agent to load monolithic multi-mode skill documents (up to 109 KB and 75 KB each) even when only a single mode or branch is needed. Furthermore, all 19 skills are configured as model-invoked with verbose descriptions, and the master **Skill Router** duplicates the routing and step definitions of over 25 workflows. Together, a single workflow invocation can consume 45,000–60,000 tokens before any project work begins, degrading agent adherence, increasing latency, and exhausting context windows on multi-module projects.

Second, the current browser automation architecture mandates **Headed Mode** (`1600x750`) for all interactive inspection, manual test execution, locator healing, and UI debugging, explicitly prohibiting **Headless Mode** outside CI pipelines. Opening a visible browser window with hardware GPU rendering enabled for routine DOM inspection, requirement discovery, and test execution consumes significant GPU and memory resources, steals window focus on the developer's machine, and restricts the viewport to `1600x750` due to OS window chrome constraints. Users lack a fast, unified **Browser Mode Switch** to run in **Headless Mode** by default while still being able to switch to **Headed Mode** on demand when visual inspection or manual login intervention (CAPTCHA, OTP, MFA) is needed.

## Solution

Re-architect the skill suite around **Progressive Disclosure**, **Single Source of Truth**, and a **Headless Mode** default with a convenient dual-layer **Browser Mode Switch**:

1. **Compact Always-Loaded Context**: Prune the root agent instructions down to essential global invariants, concise **Browser Execution Mode** rules, the 3-tier documentation reading protocol, and sharp **Context Pointers** to specialized rule and skill documents, reducing per-turn **Always-Loaded Context** overhead by 70–80%.
2. **Progressive Disclosure across Skills**: Refactor monolithic multi-mode skills (such as Risk-Based Testing manual test generation and Requirements Analysis) into lean top-level orchestration entry points that disclose mode-specific procedures, templates, and checklists into dedicated reference modules loaded strictly on demand.
3. **Thin Workflow Dispatchers & Invocation Hygiene**: Strip duplicated procedures, rubrics, and output templates from all 32 **Workflow Dispatchers** so each dispatcher only resolves the execution mode, collects required inputs, enforces human-in-the-loop checkpoints, and points to the single authoritative skill section. Convert specialized skills that are only reached via dispatchers or explicit pointers to user/pointer-invoked mode (or tighten their model-facing trigger descriptions to a single concise line) and streamline the **Skill Router** to eliminate routing duplication.
4. **Default Headless Mode with GPU Optimization**: Configure both interactive browser inspection (MCP) and automated test runner templates to run in **Headless Mode** (`1920x1080` desktop viewport) by default with GPU-saving browser launch arguments, eliminating unnecessary GPU rendering and OS window clipping.
5. **Convenient Browser Mode Switch**: Provide a unified switching mechanism across both browser layers:
   - An instant CLI/command toggle and slash workflow that switches the interactive browser inspection server configuration between **Headless Mode** (`1920x1080`, GPU disabled) and **Headed Mode** (`1600x750`, visible window at `0,0`) in one step.
   - Natural-language prompt overrides and environment variable flags for automated test runners so users can request visible browser execution on any run without editing configuration files.

## User Stories

1. As a QA engineer running multi-step workflows, I want the **Always-Loaded Context** to remain compact on every turn, so that token usage is minimized and the context window stays available for actual system discovery, requirements, and test cases.
2. As an AI agent starting a new session, I want global rules to use concise **Context Pointers** instead of inlining every checklist and template, so that I only load detailed rules when the active task requires them.
3. As a QA engineer invoking the Quick Manual Test Case workflow, I want the agent to load only the core RBT rules and the Quick Mode reference module rather than all four manual testing modes, so that single-pass test generation is fast and token-efficient.
4. As a QA engineer invoking the Full 6-Step RBT workflow, I want the agent to load only the step-specific rules and checklists needed for the current phase while preserving both human-in-the-loop checkpoints (Q&A at Step 2 and 4-Ring Scenario Review at Step 4), so that test quality remains exhaustive without context bloat.
5. As a QA engineer invoking the Checklist Test workflow, I want the agent to load only the Checklist Mode specification without loading full test case granularity or delta update rules, so that smoke and release-readiness checklists are generated with minimal token cost.
6. As a QA engineer invoking the Delta Test Case Update workflow from an **Impact Report**, I want the agent to load only the Delta Mode rules and **Traceability Matrix** invariants, so that existing test case IDs (`TC ID`) are preserved in place without loading unrelated generation templates.
7. As a QA engineer running System Discovery, I want the **Workflow Dispatcher** and Requirements Analysis skill to load only discovery and **Module Catalog** initialization rules without loading module-level field validation or document diffing rules, so that system mapping is fast and never prematurely allocates requirement IDs (`REQ ID`).
8. As a QA engineer generating a **Requirement Index** from a live website, I want the agent to load only the UI Recon and Evidence verification branches of the Requirements Analysis skill, so that DOM inspection and network capture proceed with minimal prompt overhead.
9. As a QA engineer analyzing an offline requirement document or ticket, I want the agent to load only the Document Analysis branch and the 10-point REQ self-verification gate, so that no browser or UI recon instructions pollute the context window.
10. As a QA engineer updating requirements from a change ticket, I want the agent to load only the Requirement Delta branch and **Impact Report** schema, so that requirement IDs remain immutable and downstream impact reports are produced cleanly.
11. As a QA engineer invoking any of the 32 slash commands, I want the **Workflow Dispatcher** to act as a thin entry point that delegates to its target skill rather than repeating the skill's tables and templates, so that instructions never drift out of sync or double-spend tokens.
12. As an AI agent resolving which skill to use, I want skills that are only invoked via explicit **Workflow Dispatchers** to avoid adding unnecessary descriptions to the **Always-Loaded Context**, so that per-turn token overhead from skill metadata is minimized.
13. As an AI agent using model-invoked skills, I want each active skill description to front-load its leading trigger words and list each distinct trigger branch once without synonyms, so that skill selection is deterministic and compact.
14. As a QA engineer using the automation **Skill Router**, I want it to route tasks to specialized skills and rules via **Context Pointers** rather than repeating 25+ workflow procedures inline, so that automation tasks load only the relevant framework and locator rules.
15. As a QA engineer scaffolding a new automation framework, I want code templates to be disclosed per target stack (Playwright TypeScript, Playwright Java, Selenium Java, Appium Java) rather than loading a single 1,750-line multi-stack template file into context all at once, so that scaffolding a single stack consumes a fraction of the tokens.
16. As a QA engineer running browser-based workflows (discovery, UI recon, manual test execution, locator healing, UI debugging), I want the browser to run in **Headless Mode** by default with GPU rendering disabled, so that my workstation's GPU and CPU are not taxed and no browser windows pop up to interrupt my work.
17. As an AI agent inspecting DOM elements and capturing evidence in **Headless Mode**, I want the default viewport to be set to `1920x1080`, so that full desktop layouts render without being clipped by OS window borders or browser tab bars.
18. As a QA engineer who wants to visually watch a test run or debug a tricky UI interaction on screen, I want a single-command **Browser Mode Switch** to toggle the interactive browser configuration to **Headed Mode** (`1600x750`), so that I can switch modes in seconds without manually editing JSON configuration files.
19. As a QA engineer switching back to routine testing after visual debugging, I want to toggle **Headless Mode** back on with a single command or check the current active **Browser Execution Mode**, so that I always know whether the browser will run headless or headed.
20. As a QA engineer testing an application protected by CAPTCHA, OTP, or MFA, I want the agent to automatically advise or switch to **Headed Mode** for one-time manual authentication state capture and then resume **Headless Mode** using persisted session state, so that authentication barriers are handled smoothly without keeping headed mode on permanently.
21. As a QA engineer executing automated test suites via CLI, I want generated test frameworks and execution workflows to run in **Headless Mode** (`1920x1080`) by default while supporting a simple runtime override (environment variable, CLI flag, or prompt instruction like "headed" / "mở browser"), so that I can toggle visual execution per run without changing project configuration.
22. As a QA engineer viewing generated Requirements, Manual Test Cases, Execution Reports, Traceability Matrices, and Bug Reports in the offline HTML viewers, I want all markdown output schemas and column headers to remain 100% backward-compatible after token optimization, so that existing viewer bundles continue to parse and export files without error.
23. As a QA lead auditing test quality, I want all domain quality gates—including the 4 **Test Rings** (Smoke, Functional, Technical, Non-Functional), 15 field validation types, ISO/IEC 25010 quality characteristics, `GỘP`/`TÁCH` **Granularity Mode** rules, and immutable `REQ ID` / `TC ID` traceability—to remain intact after refactoring, so that token savings never reduce testing rigor.
24. As a maintainer of this skill suite, I want an automated verification gate that checks token/size budgets, validates all internal **Context Pointers**, verifies output schema contracts, and tests the **Browser Mode Switch**, so that future edits cannot reintroduce context bloat or broken links.

## Implementation Decisions

### 1. Always-Loaded Context Architecture
- The root agent instruction document will be restructured into a compact index (targeting under 140 lines / 12 KB, down from 516 lines / 43 KB).
- It will retain only rules that apply to every turn across all tasks:
  - Git read-only safety rule.
  - Vietnamese communication language rule and concise reporting posture.
  - Default **Headless Mode** (`1920x1080`, GPU disabled) and on-demand **Headed Mode** (`1600x750`) browser policy, plus the mandatory DOM inspection sequence (`navigate -> wait_for -> snapshot -> interact -> screenshot on fail/evidence`).
  - The 3-tier documentation reading protocol (`Module Catalog -> Discovery Map -> single module index`) to prevent agents from globbing the entire documentation tree.
  - Core traceability invariants (`REQ ID` and `TC ID` immutability, no secret values in documentation, evidence co-location).
  - Compact **Context Pointers** to detailed rule files and the issue tracker / domain glossary configuration.
- Detailed Definition of Done checklists, OS window chrome measurement derivations, full directory trees, multi-agent ASCII diagrams, and full tables of 19 skills and 32 workflows will be moved out of the **Always-Loaded Context** into their respective authoritative rule or reference files.

### 2. Progressive Disclosure for Multi-Mode Skills
- Monolithic skills will be split into a concise top-level orchestration file (under 180 lines) plus focused reference modules loaded only when the active mode or branch requires them:
  - **RBT Manual Testing Skill**:
    - Top-level skill file retains mode routing (`QUICK`, `FULL RBT`, `CHECKLIST`, `DELTA`), shared core invariants (evidence verification, observable verification language, `GỘP`/`TÁCH` **Granularity Mode**, batch write-first rule, and the 4 **Test Rings** summary), and **Context Pointers** to mode-specific and checklist reference files.
    - Disclosed reference modules will house: (a) Full 4-Ring Test Map & Risk-Depth Matrix + Self-Quality Gate details, (b) Mode 1 (`QUICK`) & Mode 2 (`FULL RBT` 6-step procedure), (c) Mode 3 (`CHECKLIST` procedure and gate), and (d) Mode 4 (`DELTA` procedure, impact mapping, and gate), alongside the existing 4 reference checklists (15 Field Types, Component Checklist, Design Techniques, ISO 25010).
  - **Requirements Analyzer Skill**:
    - Top-level skill file retains ID naming conventions (`REQ`, `AMB`, `RISK`), branch selection (`UI Recon`, `Document Analysis`, `Hybrid`, `Discovery`, `Delta`), the 10-point REQ self-verification gate summary, scaling thresholds, and **Context Pointers**.
    - Disclosed reference modules will house: (a) UI Recon, Network Capture, Multi-Role Probing & Evidence Hygiene rules, (b) Document Analysis & Partial-Document Hybrid Mapping rules, (c) System Discovery (`_discovery/`) & **Module Catalog** initialization rules, and (d) Output Format Templates & 10-point REQ Self-Verification Gate examples.
  - **Framework Architect Skill**:
    - Split the 1,755-line multi-stack code template reference into stack-specific reference files (Playwright TypeScript, Playwright Java, Selenium Java, Appium Java, and CI/CD workflows) so the agent loads only the target stack requested by the user.
  - **QA Automation Engineer Skill Router**:
    - Condense the 581-line router into a lean orchestration skill under 150 lines that defines the core automation lifecycle (Recon -> POM Implementation -> Execution & Self-Fix -> Cleanup) and points to the specialized skills and framework rules instead of repeating 25+ workflow descriptions inline.

### 3. Thin Workflow Dispatchers & Skill Frontmatter Optimization
- All 32 **Workflow Dispatchers** will be standardized around a compact contract:
  - Frontmatter declaring `description` and only the strictly required primary `skills` (removing secondary skills that were previously pre-loaded "just in case").
  - Explicit Mode Detection / Input Collection table.
  - Human-in-the-loop (HITL) stop points where applicable.
  - Exact **Context Pointers** to the authoritative skill and reference module sections to execute.
  - Output file path contract.
- Duplicated step-by-step procedures, markdown output templates, and quality gate checklists that already exist in the target skill will be removed from the dispatchers, eliminating double token expenditure and instruction drift.
- Skill frontmatter across all 19 skills will be tightened following context-pointer discipline: front-load leading trigger words, collapse synonymous triggers, and strip exposition that duplicates the skill body.

### 4. Default Headless Mode & Dual-Layer Browser Mode Switch
- **Interactive Browser Inspection Layer (MCP)**:
  - Default configuration will launch the browser in **Headless Mode** (`--headless` / `"headless": true`) with a `1920,1080` viewport and GPU-saving Chromium launch flags (`--disable-gpu`, `--disable-dev-shm-usage`, `--no-sandbox`).
  - When switched to **Headed Mode**, the configuration will use a `1600,750` viewport (preventing OS window clipping on `1920x1080` displays), position the window at `0,0`, and remove headless/GPU-disable flags so the tester can observe and interact with the live window.
  - A zero-dependency Node.js CLI utility (`browser-mode`) and a corresponding slash command workflow (`/browser-mode`) will allow the user or agent to run `headless`, `headed`, or `status` to inspect or switch the project's MCP configuration deterministically and report whether an MCP server restart/reconnect is needed.
- **Automated Test Runner Layer (Playwright / Selenium Frameworks)**:
  - All framework templates and rules will default to `HEADLESS=true` (`1920x1080` viewport) for both local and CI execution.
  - Users can switch to **Headed Mode** on any run without modifying files by either:
    - Requesting headed execution in natural language in their prompt (e.g., asking to open the browser or run in headed mode), which instructs the agent to pass `HEADLESS=false` / `--headed` (Playwright TS) or `-Dheadless=false` (Java Maven) on the command line, or
    - Setting `HEADLESS=false` in their local environment configuration.
- **Rule & Documentation Alignment**:
  - Update global rules, Playwright rules, UI debug skill, manual test executor skill, setup documentation, and prompt templates to reflect the new policy: **Headless Mode (`1920x1080`) is the default for all browser tasks; Headed Mode (`1600x750`) is an explicit opt-in used when requested by the user or when manual authentication (CAPTCHA/OTP/MFA) is required.**

### 5. Preservation of Domain Invariants & Viewer Compatibility
- Zero changes will be made to the markdown table schemas, heading structures, or file naming conventions consumed by the three static HTML viewers (Test Cases Viewer, Execution Viewer, Bugs Viewer).
- All positive behavioral rules (4 **Test Rings**, 15 field types, ISO 25010 table, `GỘP`/`TÁCH` **Granularity Mode**, 10-point REQ gate, evidence hygiene, and 3-tier `docs/` reading protocol) are preserved 100%—only their packaging, deduplication, and disclosure hierarchy change.
- Where instructions previously used negative prohibitions ("do not...", "never..."), reframe them into positive target behaviors paired with concise hard guardrails where necessary.

### 6. Unified Evidence Capture (Screenshot & Video for Pass & Fail) & Vision Token Optimization
- **Smart Pass & Fail Screenshot Capture & Disk Persistence**:
  - In automation runners (`Playwright TS`, `Playwright Java`, `Selenium Java`, `Pytest`) and `.claude/rules/reporting_rules.md`:
    - **PASSED tests**: capture fast viewport screenshot (`fullPage: false`, `1920x1080`), persist to `reports/screenshots/`, and attach to Allure as `trang_thai_cuoi_cua_test`.
    - **FAILED tests**: capture full-page screenshot (`fullPage: true`), persist to `reports/screenshots/`, and attach to Allure as `trang_thai_khi_that_bai`.
  - In manual test execution (`skills-manual-test-executor/SKILL.md`):
    - Capture both **PASS** final state (`evidence/<TC_ID>_pass.png`, viewport `fullPage=false`) and **FAIL** step state (`evidence/<TC_ID>_step<N>_fail.png`), linking the PASS screenshot in the `Ghi chú` column of `execution_report.md` so the HTML **Execution Viewer** renders clickable evidence for both PASS and FAIL without altering its 5-column table header schema.
- **Adaptive Video Recording (`VIDEO_MODE` & MCP `--video`)**:
  - Automation runners support `VIDEO_MODE` (`retain-on-failure` default · `on` for both PASS and FAIL · `off` disabled), storing videos in `reports/videos/` (or `reports/test-artifacts/`) and attaching `.webm` to Allure as `video_khi_that_bai` (on FAIL) and `video_bang_chung_pass` (on PASS when `VIDEO_MODE=on`), while deleting temporary PASS videos when `VIDEO_MODE=retain-on-failure`.
  - `scripts/browser-mode.mjs` and `/browser-mode` support optional `--video=on|off` (default `off`) to configure Playwright MCP with `--save-video` and `--output-dir=reports/mcp-videos` on demand.
- **Zero-Waste Vision Token Rule for MCP Screenshots**:
  - `browser_take_screenshot` writes PNG files to disk for human/viewer consumption. When `browser_snapshot` and `browser_evaluate` have already verified DOM state, agents do not `Read` the PNG back into LLM vision context, reserving `Read` on images strictly for visual/CSS layout checks or suspected blank renders.

## Testing Decisions

### What Makes a Good Test
- Tests must verify observable external behavior and structural contracts at the highest possible seam rather than asserting on phrasing details of individual prose sentences.
- A single automated verification suite should validate the entire skill suite's invariants, token/size budgets, reference integrity, and **Browser Mode Switch** behavior deterministically in under 2 seconds using Node.js built-in test runner primitives.

### Testing Seams & Modules Under Test
1. **Browser Mode Switch Seam**:
   - Test the CLI toggle utility against temporary/fixture or project MCP configuration files across state transitions: default state verification (`headless`), switching `headless -> headed`, idempotency (`headed -> headed`), switching `headed -> headless`, `--video=on|off` flag handling, and querying `status`.
   - Verify external outputs: in **Headless Mode**, configuration contains `--headless`, `"headless": true`, `--viewport-size=1920,1080`, and `"--disable-gpu"`; in **Headed Mode**, configuration omits `--headless`, sets `"headless": false`, sets `--viewport-size=1600,750`, and preserves `--window-position=0,0`; when `--video=on`, configuration includes `--save-video` and `--output-dir=reports/mcp-videos`.
2. **Token & Context-Load Budget Seam**:
   - Test the byte and line sizes of the **Always-Loaded Context** (root instructions + all skill frontmatter descriptions), every top-level skill entry point, and the combined payload of every **Workflow Dispatcher** plus its declared primary skills and disclosed mode references.
   - Verify that total per-turn **Always-Loaded Context** is reduced by at least 65% compared to baseline and that no single workflow entry payload exceeds its target budget.
3. **Context Pointer & Domain Contract Seam**:
   - Parse all markdown links, relative file references, and skill frontmatter declarations across root instructions, rules, skills, and workflow dispatchers to verify that 100% of pointers resolve to existing files.
   - Verify that essential domain contracts (4 **Test Rings**, 15 field types, ISO 25010, `GỘP`/`TÁCH` **Granularity Mode**, immutable `REQ ID` / `TC ID`, and markdown table header schemas required by the HTML viewers) remain present in their authoritative files.
4. **Evidence Capture & Video Optimization Seam**:
   - Verify that `.claude/rules/reporting_rules.md` and framework templates (`TEMPLATES_PLAYWRIGHT_TS.md`, `TEMPLATES_PLAYWRIGHT_JAVA.md`, `TEMPLATES_SELENIUM_JAVA.md`, `TEMPLATES_PYTEST_AND_CICD.md`) define smart screenshot capture (`trang_thai_cuoi_cua_test` on PASS with viewport `fullPage: false`, `trang_thai_khi_that_bai` on FAIL with `fullPage: true`), `reports/screenshots/` persistence, and adaptive `VIDEO_MODE` (`retain-on-failure` / `on` / `off`) with Allure video attachments (`video_bang_chung_pass` / `video_khi_that_bai`).
   - Verify that `skills-manual-test-executor/SKILL.md` mandates capturing evidence for both PASS and FAIL test cases and that `UI_RECON_AND_EVIDENCE.md` enforces the vision-token optimization rule for `browser_take_screenshot`.

### Prior Art in the Codebase
- Existing utility scripts in the repository use standalone Node.js `.mjs` scripts (such as the asset embedding tool in the viewer package). The verification suite and **Browser Mode Switch** utility will follow the same zero-external-dependency `.mjs` pattern so they run out of the box on any machine with Node.js installed.

## Out of Scope

- Modifying the React/TypeScript source code or bundled HTML of the three offline viewers (Test Cases Viewer, Execution Viewer, Bugs Viewer).
- Deleting or rewriting the sample project artifacts already generated under the documentation directories (such as existing `login`, `customers`, `projects`, or `_book-api` sample outputs).
- Changing the underlying methodology of the 6-step AI-RBT framework, the 4 **Test Rings**, or the 3-layer delta update chain (`Requirements -> Test Cases -> Automation`).
- Modifying Appium mobile driver rules for native Android/iOS/Flutter devices (GPU/headless browser switching applies only to web browser execution via Playwright and Selenium).

## Further Notes

- For non-Claude-Code environments that rely on manual copy-paste prompts (`prompts/` and `plans/`), those files do not contribute to Claude Code's automatic context load; they will only be updated where necessary to reflect the new **Headless Mode** default (`1920x1080`) and **Headed Mode** toggle instructions.
- Because the interactive MCP server reads its launch arguments when spawned by the host IDE/CLI, switching the MCP configuration between **Headless Mode** and **Headed Mode** takes effect immediately upon reconnecting/restarting the MCP server, whereas automated test runner overrides (`HEADLESS=false` / `--headed`) take effect instantaneously on the very next test command.
