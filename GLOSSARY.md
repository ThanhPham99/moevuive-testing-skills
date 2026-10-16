# Claude Testing Skills Suite

A modular AI-driven Quality Assurance and Test Automation skill suite that orchestrates system discovery, requirements analysis, Risk-Based Testing (RBT) manual test generation, browser-based test execution, and multi-framework automation engineering.

## Language

### Agent Architecture & Token Optimization

**Always-Loaded Context**:
The baseline instruction payload loaded into the agent's context window on every conversational turn, consisting of the root project instructions and active model-invoked skill descriptions.
_Avoid_: System prompt, global rules file

**Context Pointer**:
A compact reference held in active context—written either as a Markdown link or a repository-relative inline-code path—that names an external reference document and specifies the exact condition or branch under which the agent must load it.
_Avoid_: Link, see-also note

**Progressive Disclosure**:
The structural separation of a skill into a concise top-level orchestration entry point and on-demand reference modules loaded only when a specific execution mode or branch is triggered.
_Avoid_: File splitting, chunking

**Workflow Dispatcher**:
A lightweight user-invoked command definition that parses user inputs, declares human-in-the-loop checkpoints, and delegates execution to a specific skill mode without duplicating the skill's procedural rules.
_Avoid_: Prompt file, command script

**Skill Router**:
A top-level entry point that maps user intent to specialized skills or workflows without duplicating their internal step-by-step instructions.
_Avoid_: Master prompt, mega-skill

**Dual-Harness Sync**:
The deterministic projection of canonical root instructions, **Workflow Dispatchers**, and **Browser Execution Mode** settings across both Claude Code and Antigravity without duplicating active skill registrations.
_Avoid_: Copy script, plugin mirroring

### Browser Execution & Hardware Efficiency

**Browser Execution Mode**:
The rendering state in which the browser automation engine operates across both interactive agent inspection (MCP) and automated test runner suites, either Headless Mode or Headed Mode.
_Avoid_: Display mode, UI flag

**Headless Mode**:
The default Browser Execution Mode that runs the browser without a visible OS window and with hardware GPU rendering disabled, using an unclipped full desktop viewport for maximum resource efficiency and layout fidelity.
_Avoid_: CI-only mode, background mode

**Headed Mode**:
The on-demand Browser Execution Mode that opens a visible OS browser window positioned on screen with a window-fitted desktop viewport, activated only when explicitly requested by the user or required for manual authentication challenges (CAPTCHA, OTP, MFA).
_Avoid_: Debug mode, real browser mode

**Browser Mode Switch**:
The unified toggle mechanism that switches both interactive browser configuration and test runner execution between Headless Mode and Headed Mode via a single command or runtime parameter.
_Avoid_: Config edit, manual JSON patch

**Locator Priority Matrix**:
The canonical engine-specific ranking of UI element selectors across Playwright, Selenium, and Appium that governs primary and fallback selector choice during inspection, test generation, and self-healing.
_Avoid_: Selector cheat sheet, XPath rules

### QA & Traceability Domain

**Discovery Map**:
The system-level inventory of modules, navigation routes, roles, and document coverage produced before module-level requirement analysis begins, assigning module prefixes without allocating requirement IDs.
_Avoid_: Site map, initial recon doc

**Module Catalog**:
The top-level index table for a documentation branch (Requirements, Test Cases, Bugs, or User Guides) that tracks registered module prefixes, ID ranges, and unresolved ambiguities.
_Avoid_: Folder list, summary README

**Requirement Index**:
The canonical requirement specification for a single module containing immutable requirement IDs (`REQ ID`), field specifications, permission matrices, state transitions, ambiguities (`AMB`), risks (`RISK`), and a changelog.
_Avoid_: PRD, user story doc

**Test Ring**:
One of the four sequential verification tiers in the Risk-Based Testing framework: Ring 1 (Smoke), Ring 2 (Functional), Ring 3 (Technical), and Ring 4 (Non-Functional & Regression).
_Avoid_: Test phase, test category

**Granularity Mode**:
The structural grouping policy for test case variations on the same input field or rule, chosen before generation as either Grouped (`GỘP`, combining same-field variations with sub-codes) or Split (`TÁCH`, one test case per variation).
_Avoid_: Test size, compression mode

**Impact Report**:
The structured change analysis generated when a requirement is updated from a ticket, classifying changes into Added, Modified, or Deprecated requirements to drive downstream delta updates.
_Avoid_: Diff log, change summary

**Delta TC List**:
The downstream artifact produced by updating the Test Case Index against an Impact Report, preserving existing test case IDs (`TC ID`) and listing only new, modified, or deprecated test cases for automation synchronization.
_Avoid_: Updated test sheet

**Traceability Matrix**:
The bidirectional mapping across Requirements (`REQ ID`), Manual Test Cases (`TC ID`), Automated Test Scripts, Execution Reports, and Bug Reports.
_Avoid_: Coverage table

**Offline Report Viewer**:
A self-contained HTML application that parses Markdown QA tables (**Test Cases**, **Execution Reports**, or **Bug Reports**) locally in the browser for interactive filtering and Office Open XML (`.xlsx`) export without a backend server.
_Avoid_: Dashboard app, reporting portal

**Export Plan**:
The normalized tabular workbook specification—defining sheet names, column headers, column widths, status-styled columns, and plain-text row cells—produced by an **Offline Report Viewer** model prior to CSV or Office Open XML (`.xlsx`) serialization.
_Avoid_: Sheet config, raw table dump


