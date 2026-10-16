# 01: Verification Harness & Default Headless Browser Mode Switch

**What to build:** Deliver the automated verification suite at the highest testing seam alongside the default **Headless Mode** (`1920x1080` viewport, GPU rendering disabled) browser configuration, the **Browser Mode Switch** CLI utility, the `/browser-mode` **Workflow Dispatcher**, and updated browser execution rules so that interactive browser inspection and test runners run headless by default and can switch between **Headless Mode** and **Headed Mode** in one command.

**Blocked by:** None (can start immediately)

**Status:** resolved

- [x] Interactive browser inspection configuration defaults to **Headless Mode** (`--headless`, `"headless": true`, `--viewport-size=1920,1080`, and GPU-disabling flags `--disable-gpu`, `--disable-dev-shm-usage`, `--no-sandbox`).
- [x] The **Browser Mode Switch** CLI utility supports `headless`, `headed`, and `status` commands, deterministically toggling the project's interactive browser configuration between **Headless Mode** (`1920x1080`, GPU disabled) and **Headed Mode** (`1600x750`, visible window at `0,0`, GPU enabled) with idempotent behavior.
- [x] A `/browser-mode` **Workflow Dispatcher** allows users to switch or inspect the active **Browser Execution Mode** directly from chat.
- [x] Rule documents and setup guides reflect **Headless Mode** (`1920x1080`) as the default for all browser tasks and **Headed Mode** (`1600x750`) as an explicit opt-in for visual observation or manual authentication (CAPTCHA/OTP/MFA).
- [x] Automated verification suite executes via Node.js built-in test runner and passes all **Browser Mode Switch** state-transition tests and baseline structural checks.

## Comments

- Implemented `scripts/browser-mode.mjs`, `.claude/commands/browser-mode.md`, `.mcp.json` (Headless `1920,1080`), `.claude/playwright-mcp-config.json` (`headless: true`, `--disable-gpu`, `--disable-dev-shm-usage`, `--no-sandbox`), updated `.claude/rules/playwright_rules.md`, `.claude/rules/automation_rules.md`, `SETUP_CLAUDE.md`, and verified via `node --test scripts/verify-suite.mjs`.
