#!/usr/bin/env node
/**
 * Browser Mode Switch Module & CLI (`scripts/browser-mode.mjs`)
 *
 * Deep module that owns Browser Execution Mode state (Headless Mode vs Headed Mode)
 * and synthesizes Playwright MCP configuration across both Claude Code (`.mcp.json`)
 * and Antigravity (`.agents/plugins/claude-testing-skills/mcp_config.json`), plus the
 * shared browser launch config (`.claude/playwright-mcp-config.json`):
 *   - `headless` (DEFAULT): 1920x1080 viewport, headless=true, GPU disabled (--disable-gpu, --disable-dev-shm-usage, --no-sandbox)
 *   - `headed`   (OPT-IN) : 1600x750 viewport, headless=false, visible window at 0,0
 *   - `status`            : Inspects active Browser Execution Mode, viewport, GPU state, MCP video state, and Dual-Harness sync
 *
 * Usage (CLI):
 *   node scripts/browser-mode.mjs [headless|headed|status] [--video=on|off] [--root <dir>]
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const CONFIG_REL_PATH = '.claude/playwright-mcp-config.json';
export const MCP_VIDEO_DIR = 'reports/mcp-videos';
export const AGY_MCP_REL_PATH = '.agents/plugins/claude-testing-skills/mcp_config.json';
export const AGY_CONFIG_REL_FROM_PLUGIN = '../../../.claude/playwright-mcp-config.json';
export const AGY_VIDEO_DIR_FROM_PLUGIN = '../../../reports/mcp-videos';

export const PROFILES = {
  headless: {
    mode: 'headless',
    headless: true,
    width: 1920,
    height: 1080,
    launchArgs: ['--test-type', '--disable-gpu', '--disable-dev-shm-usage', '--no-sandbox'],
  },
  headed: {
    mode: 'headed',
    headless: false,
    width: 1600,
    height: 750,
    launchArgs: ['--test-type', '--window-position=0,0'],
  },
};

export function buildMcpArgs(
  profile,
  videoEnabled,
  { configPath = CONFIG_REL_PATH, videoDir = MCP_VIDEO_DIR } = {}
) {
  return [
    '-y',
    '@playwright/mcp',
    ...(profile.headless ? ['--headless'] : []),
    `--viewport-size=${profile.width},${profile.height}`,
    ...(videoEnabled
      ? [`--save-video=${profile.width}x${profile.height}`, `--output-dir=${videoDir}`]
      : []),
    '--config',
    configPath,
  ];
}

export function buildPwConfig(profile) {
  return {
    browser: {
      launchOptions: {
        headless: profile.headless,
        args: [...profile.launchArgs],
      },
    },
  };
}

function readJsonSafe(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

export function detectBrowserModeStatus(rootDir) {
  const mcpPath = path.join(rootDir, '.mcp.json');
  const cfgPath = path.join(rootDir, CONFIG_REL_PATH);
  const agyMcpPath = path.join(rootDir, AGY_MCP_REL_PATH);
  const mcp = readJsonSafe(mcpPath);
  const cfg = readJsonSafe(cfgPath);
  const agyMcp = readJsonSafe(agyMcpPath);

  const args = mcp?.mcpServers?.playwright?.args ?? [];
  const hasHeadlessFlag = args.includes('--headless');
  const viewportArg = args.find((a) => a.startsWith('--viewport-size=')) ?? '';
  const viewport = viewportArg.replace('--viewport-size=', '') || 'unknown';
  const launchOptions = cfg?.browser?.launchOptions ?? {};
  const cfgHeadless = launchOptions.headless;
  const gpuDisabled = Boolean(launchOptions.args?.includes('--disable-gpu'));
  const videoEnabled = args.some((a) => a.startsWith('--save-video='));

  const agyArgs = agyMcp?.mcpServers?.playwright?.args ?? [];
  const agyHasHeadless = agyArgs.includes('--headless');
  const agyViewport =
    (agyArgs.find((a) => a.startsWith('--viewport-size=')) ?? '').replace('--viewport-size=', '') ||
    'unknown';
  const agyVideoEnabled = agyArgs.some((a) => a.startsWith('--save-video='));
  const antigravitySynced =
    Boolean(agyMcp) &&
    agyHasHeadless === hasHeadlessFlag &&
    agyViewport === viewport &&
    agyVideoEnabled === videoEnabled &&
    agyArgs.includes(AGY_CONFIG_REL_FROM_PLUGIN) &&
    (!videoEnabled || agyArgs.includes(`--output-dir=${AGY_VIDEO_DIR_FROM_PLUGIN}`));

  const isHeadless = hasHeadlessFlag && cfgHeadless !== false;
  return {
    mode: isHeadless ? 'headless' : 'headed',
    viewport,
    gpuDisabled,
    videoEnabled,
    antigravitySynced,
    claudeArgs: args,
    antigravityArgs: agyArgs,
    launchOptions,
  };
}

/**
 * Non-destructively merges the `playwright` MCP server configuration into an existing
 * MCP config object, preserving all other top-level keys and `mcpServers` entries.
 */
export function mergePlaywrightMcpConfig(
  existingObj,
  profile,
  videoEnabled,
  { configPath = CONFIG_REL_PATH, videoDir = MCP_VIDEO_DIR } = {}
) {
  const base =
    existingObj && typeof existingObj === 'object' && !Array.isArray(existingObj)
      ? { ...existingObj }
      : {};
  const existingServers =
    base.mcpServers && typeof base.mcpServers === 'object' && !Array.isArray(base.mcpServers)
      ? { ...base.mcpServers }
      : {};
  existingServers.playwright = {
    command: 'npx',
    args: buildMcpArgs(profile, videoEnabled, { configPath, videoDir }),
  };
  base.mcpServers = existingServers;
  return base;
}

/**
 * Synthesizes the canonical Antigravity `mcp_config.json` JSON string from the active
 * Browser Execution Mode in `rootDir` (defaulting to Headless Mode if `.mcp.json` does not exist),
 * preserving any non-Playwright MCP servers already present in Antigravity's `mcp_config.json`.
 */
export function buildAntigravityMcpConfig(rootDir) {
  const mcpPath = path.join(rootDir, '.mcp.json');
  const agyMcpPath = path.join(rootDir, AGY_MCP_REL_PATH);
  const status = fs.existsSync(mcpPath)
    ? detectBrowserModeStatus(rootDir)
    : { mode: 'headless', videoEnabled: false };
  const profile = PROFILES[status.mode] ?? PROFILES.headless;
  const existingAgyMcp = readJsonSafe(agyMcpPath);
  const merged = mergePlaywrightMcpConfig(existingAgyMcp, profile, status.videoEnabled, {
    configPath: AGY_CONFIG_REL_FROM_PLUGIN,
    videoDir: AGY_VIDEO_DIR_FROM_PLUGIN,
  });

  return JSON.stringify(merged, null, 2) + '\n';
}

function writeMcpFile(filePath, profile, videoEnabled, { configPath, videoDir }) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const existing = readJsonSafe(filePath);
  const merged = mergePlaywrightMcpConfig(existing, profile, videoEnabled, {
    configPath,
    videoDir,
  });
  fs.writeFileSync(filePath, JSON.stringify(merged, null, 2) + '\n', 'utf8');
}

export function applyBrowserModeProfile(rootDir, { mode = 'headless', videoEnabled = false } = {}) {
  const profile = PROFILES[mode];
  if (!profile) {
    throw new Error(`Unsupported mode: ${mode}. Expected 'headless' or 'headed'.`);
  }

  const mcpPath = path.join(rootDir, '.mcp.json');
  const cfgPath = path.join(rootDir, CONFIG_REL_PATH);
  const agyMcpPath = path.join(rootDir, AGY_MCP_REL_PATH);
  fs.mkdirSync(path.dirname(cfgPath), { recursive: true });

  writeMcpFile(mcpPath, profile, videoEnabled, {
    configPath: CONFIG_REL_PATH,
    videoDir: MCP_VIDEO_DIR,
  });
  writeMcpFile(agyMcpPath, profile, videoEnabled, {
    configPath: AGY_CONFIG_REL_FROM_PLUGIN,
    videoDir: AGY_VIDEO_DIR_FROM_PLUGIN,
  });
  fs.writeFileSync(cfgPath, JSON.stringify(buildPwConfig(profile), null, 2) + '\n', 'utf8');

  return detectBrowserModeStatus(rootDir);
}

function parseArgs(argv) {
  let command = 'status';
  let rootDir = path.resolve(__dirname, '..');
  let videoOption = null;
  let help = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      help = true;
    } else if (arg === '--root' && argv[i + 1]) {
      rootDir = path.resolve(argv[++i]);
    } else if (arg.startsWith('--root=')) {
      rootDir = path.resolve(arg.slice('--root='.length));
    } else if (arg === '--video' && argv[i + 1]) {
      const val = argv[++i].toLowerCase();
      if (val === 'on' || val === 'true') videoOption = true;
      else if (val === 'off' || val === 'false') videoOption = false;
    } else if (arg.startsWith('--video=')) {
      const val = arg.slice('--video='.length).toLowerCase();
      if (val === 'on' || val === 'true') videoOption = true;
      else if (val === 'off' || val === 'false') videoOption = false;
    } else if (['headless', 'headed', 'status'].includes(arg.toLowerCase())) {
      command = arg.toLowerCase();
    }
  }
  return { command, rootDir, videoOption, help };
}

function main() {
  const { command, rootDir, videoOption, help } = parseArgs(process.argv.slice(2));
  if (help) {
    console.log('Usage: node scripts/browser-mode.mjs <status|headless|headed> [--video=on|off] [--root <dir>]');
    return;
  }
  const current = detectBrowserModeStatus(rootDir);

  if (command === 'status' && videoOption === null) {
    console.log(
      `Browser Execution Mode: ${current.mode.toUpperCase()} | Viewport: ${current.viewport} | GPU Disabled: ${current.gpuDisabled} | Video: ${current.videoEnabled ? 'ON' : 'OFF'} | Antigravity MCP Synced: ${current.antigravitySynced ? 'YES' : 'NO'}`
    );
    return;
  }

  const targetMode = command === 'status' ? current.mode : command;
  const targetVideo = videoOption !== null ? videoOption : current.videoEnabled;
  const updated = applyBrowserModeProfile(rootDir, {
    mode: targetMode,
    videoEnabled: targetVideo,
  });
  console.log(
    `Switched Browser Execution Mode -> ${updated.mode.toUpperCase()} (Viewport: ${updated.viewport}, GPU Disabled: ${updated.gpuDisabled}, Video: ${updated.videoEnabled ? 'ON' : 'OFF'}, Antigravity Synced: ${updated.antigravitySynced ? 'YES' : 'NO'}).`
  );
  console.log(
    `Note: Reconnect MCP ('/mcp' in Claude Code or reload MCP Servers in Antigravity) if switching an already-running Playwright MCP session; CLI test runners take HEADLESS=${updated.mode === 'headless' ? 'true' : 'false'} and VIDEO_MODE=retain-on-failure|on|off immediately.`
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  main();
}
