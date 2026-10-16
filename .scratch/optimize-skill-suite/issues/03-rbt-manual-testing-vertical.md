# 03: Progressive Disclosure — RBT Manual Testing & Test Case Vertical

**What to build:** Refactor the Risk-Based Testing (RBT) Manual Testing skill and its four associated **Workflow Dispatchers** (Quick Test Case Generation, Full 6-Step RBT Generation, Checklist Generation, and Delta Test Case Update) using **Progressive Disclosure** and **Context Pointers**, cutting single-mode token load by over 70% while preserving the 4 **Test Rings**, `GỘP`/`TÁCH` **Granularity Mode**, 15 field validation types, ISO 25010 characteristics, **Delta TC List**, and HTML viewer table compatibility.

**Blocked by:** 01: Verification Harness & Default Headless Browser Mode Switch

**Status:** resolved

- [x] Top-level RBT Manual Testing skill entry point is compacted to <= 170 lines / <= 12 KB, retaining mode routing (`QUICK`, `FULL RBT`, `CHECKLIST`, `DELTA`), core invariants (evidence verification, observable verification language, `GỘP`/`TÁCH` **Granularity Mode**, batch write-first policy, 4 **Test Rings** overview), standard 13-column markdown table schema, and **Context Pointers**.
- [x] Mode-specific procedures and deep reference rules are disclosed into dedicated reference modules under the skill's `references/` folder: (1) 4 **Test Rings** Map, Risk-Depth Matrix & 11-Point Self-Quality Gate, (2) Mode 1 (`QUICK`) & Mode 2 (`FULL RBT` 6-step procedure), (3) Mode 3 (`CHECKLIST` procedure & 4-point gate), and (4) Mode 4 (`DELTA` procedure, impact mapping & 7-point gate), alongside the existing 4 reference checklists.
- [x] All four Manual Testing **Workflow Dispatchers** are compacted into thin dispatchers (<= 100 lines each) that preserve human-in-the-loop checkpoints (Step 2 Q&A and Step 4 4-Ring Review in Full RBT; Plan/Apply in Delta) and point to the disclosed reference modules without repeating procedures.
- [x] All internal **Context Pointers**, 13-column Test Case table headers, and RBT domain invariants pass the automated verification suite.
