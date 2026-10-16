# 04: Progressive Disclosure — Framework Architect, Skill Router & Automation Vertical

**What to build:** Refactor the Framework Architect skill (splitting its monolithic 1,755-line multi-stack template into stack-specific reference modules with **Headless Mode** default and runtime **Headed Mode** override), streamline the QA Automation Engineer **Skill Router**, and optimize the remaining 15 specialized skills and 24 **Workflow Dispatchers** to eliminate duplicated instructions and tighten frontmatter **Context Pointers**.

**Blocked by:** 01: Verification Harness & Default Headless Browser Mode Switch

**Status:** resolved

- [x] Framework Architect code templates are split by tech stack (Playwright TypeScript, Playwright Java, Selenium Java, Appium Java, and CI/CD workflows) so scaffolding a single framework loads only the requested stack's template, with **Headless Mode** (`1920x1080`) configured as default and runtime **Headed Mode** override (`HEADLESS=false` / `--headed` / `-Dheadless=false`) supported out of the box.
- [x] QA Automation Engineer **Skill Router** is compacted from 581 lines to <= 150 lines, defining the core 4-phase automation lifecycle and routing via **Context Pointers** rather than duplicating 25+ workflow procedures inline.
- [x] Remaining 15 specialized skills are optimized for concise frontmatter **Context Pointers**, positive target phrasing, and alignment with default **Headless Mode** (`1920x1080`) and on-demand **Headed Mode** (`1600x750`) in UI Debug and Manual Test Executor skills.
- [x] Remaining 24 **Workflow Dispatchers** are compacted into thin dispatchers (<= 115 lines each) that declare only strictly necessary primary skills in frontmatter and delegate procedural details to their target skills.
