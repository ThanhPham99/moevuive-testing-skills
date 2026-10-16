# 02: Progressive Disclosure — Requirements Analysis & Discovery Vertical

**What to build:** Refactor the Requirements Analysis skill and its four associated **Workflow Dispatchers** (System Discovery, Website Requirements Generation, Document Requirement Analysis, and Ticket Requirement Delta Update) using **Progressive Disclosure** and **Context Pointers**, eliminating duplicated instructions while preserving 100% of `REQ ID`, `AMB`, `RISK`, **Discovery Map**, **Module Catalog**, and **Impact Report** invariants.

**Blocked by:** 01: Verification Harness & Default Headless Browser Mode Switch

**Status:** resolved

- [x] Top-level Requirements Analysis skill entry point is compacted to <= 165 lines / <= 12 KB, retaining core ID conventions (`REQ`, `AMB`, `RISK`), branch routing, 10-point REQ self-verification summary, scaling thresholds, and **Context Pointers** to disclosed reference modules.
- [x] Mode-specific and deep reference sections are disclosed into dedicated reference modules under the skill's `references/` folder: (1) Discovery & **Module Catalog** (`_discovery/`), (2) UI Recon, Network Capture, Multi-Role & Evidence Hygiene (aligned with default **Headless Mode**), (3) Document Analysis & Partial-Document Hybrid Mapping, and (4) Output Format Templates & 10-Point REQ Gate details.
- [x] All four Requirements & Discovery **Workflow Dispatchers** are compacted into thin dispatchers (<= 110 lines each) that declare only required primary skills, mode/input resolution, human-in-the-loop checkpoints, and **Context Pointers** without duplicating skill tables or templates.
- [x] All internal **Context Pointers** and domain invariants (`REQ ID` continuity, `_discovery/` no-REQ-ID rule, **Impact Report** structure) pass the automated verification suite.
