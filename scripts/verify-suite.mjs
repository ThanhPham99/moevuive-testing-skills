import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

import {
  AGY_CONFIG_REL_FROM_PLUGIN,
  AGY_VIDEO_DIR_FROM_PLUGIN,
  PROFILES,
  applyBrowserModeProfile,
  detectBrowserModeStatus,
  mergePlaywrightMcpConfig,
} from './browser-mode.mjs';
import {
  convertCommandToAntigravitySkill,
  parseSkillDocument,
  resolveContextPointers,
  syncAntigravity,
  syncViewerBundles,
} from './sync-antigravity.mjs';
import {
  buildGroupScopeKey,
  formatCellPlainText,
  parseMarkdownFile,
  parseMarkdownTables,
  queryTestCases,
} from './testcases-viewer/src/lib/parser.ts';
import { EXPORT_COLUMNS } from './testcases-viewer/src/lib/export.ts';
import {
  buildBugsExportPlan,
  buildCsvString,
  buildExecutionExportPlan,
  buildTestCasesExportPlan,
  buildXlsxBytes,
  computeExecutionTrend,
  dedupeBugs,
  extractBoldKV,
  extractEvidenceImages,
  isBugFile,
  parseBugFile,
  parseBugIndex,
  parseExecutionReport,
  parseRtm,
  parseTestSummary,
  queryBugsCatalog,
  renderEvidenceHtml,
} from './viewer-core.mjs';
import {
  computeTestSummaryReport,
  computeTraceabilityReport,
  validateDocsTree,
} from './validate-docs.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function listFiles(dirPath, ext = '.md') {
  if (!fs.existsSync(dirPath)) return [];
  return fs
    .readdirSync(dirPath, { withFileTypes: true })
    .filter((d) => d.isFile() && d.name.endsWith(ext))
    .map((d) => path.join(dirPath, d.name))
    .sort();
}

test('Seam 1: Project defaults to Headless Mode (1920x1080, GPU disabled, Antigravity synced)', () => {
  const status = detectBrowserModeStatus(REPO_ROOT);
  assert.equal(status.mode, 'headless', 'Repo must default to Headless Mode');
  assert.equal(status.viewport, '1920,1080', 'Headless Mode must default to 1920,1080 viewport');
  assert.equal(status.gpuDisabled, true, 'Headless Mode must disable hardware GPU rendering');
  assert.equal(status.videoEnabled, false, 'MCP session video must default to OFF');
  assert.equal(status.antigravitySynced, true, 'Antigravity MCP config must be synced with Claude MCP');
  assert.ok(
    status.launchOptions.args.includes('--disable-dev-shm-usage'),
    'playwright-mcp-config.json must include --disable-dev-shm-usage in Headless Mode'
  );
  assert.ok(
    status.antigravityArgs.includes(AGY_CONFIG_REL_FROM_PLUGIN),
    'Antigravity MCP args must reference ../../../.claude/playwright-mcp-config.json'
  );
});

test('Seam 1: Browser Mode Switch module toggles deterministically in-process across both harnesses', () => {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'browser-mode-test-'));

  try {
    // 1. Switch to Headed Mode with Video ON via in-process interface
    const headed = applyBrowserModeProfile(tmpRoot, { mode: 'headed', videoEnabled: true });
    assert.equal(headed.mode, 'headed');
    assert.equal(headed.viewport, '1600,750');
    assert.equal(headed.gpuDisabled, false);
    assert.equal(headed.videoEnabled, true);
    assert.equal(headed.antigravitySynced, true);
    assert.ok(!headed.claudeArgs.includes('--headless'));
    assert.ok(headed.launchOptions.args.includes('--window-position=0,0'));
    assert.ok(headed.claudeArgs.includes('--output-dir=reports/mcp-videos'));
    assert.ok(headed.antigravityArgs.includes(`--output-dir=${AGY_VIDEO_DIR_FROM_PLUGIN}`));

    // 2. Switch back to Headless Mode with Video OFF idempotently
    applyBrowserModeProfile(tmpRoot, { mode: 'headless', videoEnabled: false });
    const headless = applyBrowserModeProfile(tmpRoot, { mode: 'headless', videoEnabled: false });
    assert.equal(headless.mode, 'headless');
    assert.equal(headless.viewport, '1920,1080');
    assert.equal(headless.gpuDisabled, true);
    assert.equal(headless.videoEnabled, false);
    assert.equal(headless.antigravitySynced, true);
    assert.equal(
      headless.claudeArgs.filter((a) => a === '--headless').length,
      1,
      'Must not duplicate --headless flag across repeated toggles'
    );
    assert.ok(!headless.claudeArgs.some((a) => a.startsWith('--save-video=')));

    // 3. Verify non-destructive mergePlaywrightMcpConfig preserves other MCP servers across toggles & sync
    fs.writeFileSync(
      path.join(tmpRoot, '.mcp.json'),
      JSON.stringify(
        {
          mcpServers: {
            github: { command: 'npx', args: ['-y', '@modelcontextprotocol/server-github'] },
          },
        },
        null,
        2
      ),
      'utf8'
    );
    applyBrowserModeProfile(tmpRoot, { mode: 'headless', videoEnabled: false });
    const mergedClaudeMcp = readJson(path.join(tmpRoot, '.mcp.json'));
    assert.ok(mergedClaudeMcp.mcpServers.github, 'applyBrowserModeProfile must preserve non-Playwright mcpServers');
    assert.ok(mergedClaudeMcp.mcpServers.playwright, 'applyBrowserModeProfile must configure playwright server');

    const pureMerged = mergePlaywrightMcpConfig(
      { customKey: true, mcpServers: { stitch: { command: 'stitch' } } },
      PROFILES.headless,
      true
    );
    assert.equal(pureMerged.customKey, true);
    assert.deepEqual(pureMerged.mcpServers.stitch, { command: 'stitch' });
    assert.ok(pureMerged.mcpServers.playwright.args.includes('--save-video=1920x1080'));

    // 4. Single CLI smoke assertion for argument parsing
    const cliStatus = execFileSync(
      process.execPath,
      [path.join(REPO_ROOT, 'scripts', 'browser-mode.mjs'), 'status', '--root', tmpRoot],
      { encoding: 'utf8' }
    );
    assert.match(cliStatus, /HEADLESS.*1920,1080.*Antigravity MCP Synced: YES/i);
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
});

test('Seam 1: /browser-mode Workflow Dispatcher and Playwright Rules document Headless Mode default & switch', () => {
  const cmdPath = path.join(REPO_ROOT, '.claude', 'commands', 'browser-mode.md');
  assert.ok(fs.existsSync(cmdPath), '.claude/commands/browser-mode.md must exist');
  const content = fs.readFileSync(cmdPath, 'utf8');
  assert.match(content, /scripts\/browser-mode\.mjs/);
  assert.match(content, /1920[×x,]1080/);
  assert.match(content, /1600[×x,]750/);

  const pwRules = fs.readFileSync(path.join(REPO_ROOT, '.claude', 'rules', 'playwright_rules.md'), 'utf8');
  assert.match(pwRules, /Headless Mode/i);
  assert.match(pwRules, /scripts\/browser-mode\.mjs/);
  assert.ok(!pwRules.includes('Bắt buộc mở browser có hiển thị (headed) trong quá trình thiết lập và debug test'));

  const selRules = fs.readFileSync(path.join(REPO_ROOT, '.claude', 'rules', 'selenium_rules.md'), 'utf8');
  assert.match(selRules, /Headless Mode/i);
  assert.ok(!selRules.includes('Headed mode: Bắt buộc khi debug'));
});

test('Seam 2: Always-Loaded Context (Claude Code & Antigravity) meets strict token/size budgets', () => {
  const claudeMdPath = path.join(REPO_ROOT, 'CLAUDE.md');
  const claudeDoc = parseSkillDocument(fs.readFileSync(claudeMdPath, 'utf8'));

  assert.ok(claudeDoc.lines <= 140, `CLAUDE.md must be <= 140 lines (got ${claudeDoc.lines} lines)`);
  assert.ok(
    claudeDoc.bytes <= 12288,
    `CLAUDE.md must be <= 12 KB / 12,288 bytes (got ${claudeDoc.bytes} bytes)`
  );

  const skillsDir = path.join(REPO_ROOT, '.claude', 'skills');
  const skillDirs = fs.readdirSync(skillsDir, { withFileTypes: true }).filter((d) => d.isDirectory());
  let totalDescBytes = 0;
  for (const d of skillDirs) {
    const skillFile = path.join(skillsDir, d.name, 'SKILL.md');
    const doc = parseSkillDocument(fs.readFileSync(skillFile, 'utf8'));
    assert.ok(doc.description.length > 0, `${d.name}/SKILL.md must have a non-empty description`);
    totalDescBytes += Buffer.byteLength(doc.description, 'utf8');
  }

  const totalAlwaysLoadedBytes = claudeDoc.bytes + totalDescBytes;
  assert.ok(
    totalAlwaysLoadedBytes <= 16800,
    `Claude Always-Loaded Context must be <= 16,800 bytes (>= 65% reduction from 48 KB baseline), got ${totalAlwaysLoadedBytes}`
  );

  const agySkillsDir = path.join(REPO_ROOT, '.agents', 'skills');
  const agySkillDirs = fs.existsSync(agySkillsDir)
    ? fs.readdirSync(agySkillsDir, { withFileTypes: true }).filter((d) => d.isDirectory())
    : [];
  let agyCmdDescBytes = 0;
  for (const d of agySkillDirs) {
    const skillFile = path.join(agySkillsDir, d.name, 'SKILL.md');
    const doc = parseSkillDocument(fs.readFileSync(skillFile, 'utf8'));
    agyCmdDescBytes += Buffer.byteLength(doc.description, 'utf8');
  }

  const totalAntigravityAlwaysLoadedBytes = totalAlwaysLoadedBytes + agyCmdDescBytes;
  assert.ok(
    totalAntigravityAlwaysLoadedBytes <= 21500,
    `Antigravity Always-Loaded Context (AGENTS.md + 20 core skills + 36 command skills) must be <= 21,500 bytes, got ${totalAntigravityAlwaysLoadedBytes}`
  );
});

test('Seam 2: All top-level SKILL.md entry points, Workflow Dispatchers (<= 65 lines), and combined workflow entry payloads meet Progressive Disclosure budgets', () => {
  const skillsDir = path.join(REPO_ROOT, '.claude', 'skills');
  const skillDirs = fs.readdirSync(skillsDir, { withFileTypes: true }).filter((d) => d.isDirectory());
  assert.equal(skillDirs.length, 20, 'All 20 skills must be preserved');

  const skillByteMap = new Map();
  for (const d of skillDirs) {
    const skillPath = path.join(skillsDir, d.name, 'SKILL.md');
    const rawSkill = fs.readFileSync(skillPath, 'utf8');
    const doc = parseSkillDocument(rawSkill);
    skillByteMap.set(d.name, doc.bytes);
    assert.ok(doc.lines <= 95, `${d.name}/SKILL.md must be <= 95 lines (got ${doc.lines})`);
    assert.ok(doc.bytes <= 9728, `${d.name}/SKILL.md must be <= 9.5 KB / 9,728 bytes (got ${doc.bytes} bytes)`);
    assert.match(
      rawSkill,
      /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i,
      `${d.name}/SKILL.md must be authored in Vietnamese for consistency across all 20 skills`
    );
  }

  for (const rulePath of listFiles(path.join(REPO_ROOT, '.claude', 'rules'), '.md')) {
    const ruleDoc = parseSkillDocument(fs.readFileSync(rulePath, 'utf8'));
    const ruleName = path.basename(rulePath);
    assert.ok(ruleDoc.lines <= 120, `.claude/rules/${ruleName} must be <= 120 lines (got ${ruleDoc.lines})`);
  }

  const seleniumRulesContent = fs.readFileSync(
    path.join(REPO_ROOT, '.claude', 'rules', 'selenium_rules.md'),
    'utf8'
  );
  assert.match(
    seleniumRulesContent,
    /new Dimension\(1600,\s*750\)/,
    'selenium_rules.md must configure 1600x750 viewport in Headed Mode'
  );

  const projectStructurePath = path.join(
    skillsDir,
    'skills-framework-architect',
    'references',
    'PROJECT_STRUCTURE.md'
  );
  const projectStructureDoc = parseSkillDocument(fs.readFileSync(projectStructurePath, 'utf8'));
  assert.ok(
    projectStructureDoc.lines <= 120,
    `PROJECT_STRUCTURE.md must be <= 120 lines (got ${projectStructureDoc.lines})`
  );

  for (const qaSkill of [
    'skills-coverage-traceability',
    'skills-testcase-reviewer',
    'skills-test-summary-reporter',
    'skills-bug-reporter',
  ]) {
    const qaSkillContent = fs.readFileSync(path.join(skillsDir, qaSkill, 'SKILL.md'), 'utf8');
    assert.match(
      qaSkillContent,
      /scripts\/validate-docs\.mjs/,
      `${qaSkill}/SKILL.md must reference scripts/validate-docs.mjs for deterministic verification`
    );
  }

  const commandsDir = path.join(REPO_ROOT, '.claude', 'commands');
  const commandFiles = listFiles(commandsDir, '.md');
  assert.ok(commandFiles.length >= 33, 'Must have all 32 original commands + browser-mode.md');

  const thinnedDispatchers = new Set([
    'heal-locators.md',
    'retest-fixed-bugs.md',
    'generate-master-test-plan.md',
    'update-automation-from-impact.md',
    'run-and-fix-tests.md',
  ]);

  for (const cmdPath of commandFiles) {
    const content = fs.readFileSync(cmdPath, 'utf8');
    const doc = parseSkillDocument(content);
    const name = path.basename(cmdPath);
    assert.ok(doc.lines <= 65, `Command ${name} must be <= 65 lines (got ${doc.lines})`);
    if (thinnedDispatchers.has(name)) {
      assert.ok(doc.lines <= 45, `Thinned dispatcher ${name} must be <= 45 lines (got ${doc.lines})`);
    }
    assert.ok(doc.bytes <= 8192, `Command ${name} must be <= 8 KB (got ${doc.bytes} bytes)`);

    let declaredSkillsBytes = 0;
    for (const s of doc.skills) {
      declaredSkillsBytes += skillByteMap.get(s) ?? 0;
    }

    const { disclosedRefsBytes } = resolveContextPointers(content, {
      sourceFile: cmdPath,
      repoRoot: REPO_ROOT,
    });

    const combinedEntryBytes = doc.bytes + declaredSkillsBytes + disclosedRefsBytes;
    assert.ok(
      combinedEntryBytes <= 66560,
      `Combined workflow entry payload for ${name} must be <= 66,560 bytes (got ${combinedEntryBytes} bytes)`
    );
  }
});

test('Seam 3: All Context Pointers, Markdown links, and frontmatter skill references resolve via the Skill Document module', () => {
  const skillsDir = path.join(REPO_ROOT, '.claude', 'skills');
  const validSkills = new Set(
    fs
      .readdirSync(skillsDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
  );

  const filesToScan = [
    path.join(REPO_ROOT, 'CLAUDE.md'),
    path.join(REPO_ROOT, 'README.md'),
    path.join(REPO_ROOT, 'SETUP_CLAUDE.md'),
    path.join(REPO_ROOT, 'HUONG_DAN_CAI_DAT_VA_SU_DUNG.md'),
    path.join(REPO_ROOT, 'AI_FULL_FLOW_MANUAL.md'),
    path.join(REPO_ROOT, 'AI_FULL_FLOW_AUTOMATION.md'),
    path.join(REPO_ROOT, 'GLOSSARY.md'),
    path.join(REPO_ROOT, 'prompts', 'README.md'),
    path.join(REPO_ROOT, 'scripts', 'bugs-viewer', 'README.md'),
    path.join(REPO_ROOT, 'scripts', 'execution-viewer', 'README.md'),
    path.join(REPO_ROOT, 'scripts', 'testcases-viewer', 'README.md'),
    ...listFiles(path.join(REPO_ROOT, 'plans', 'manual')),
    ...listFiles(path.join(REPO_ROOT, 'plans', 'automation')),
    ...listFiles(path.join(REPO_ROOT, 'plans', 'cross-module')),
    ...listFiles(path.join(REPO_ROOT, '.claude', 'rules')),
    ...listFiles(path.join(REPO_ROOT, '.claude', 'commands')),
  ];
  for (const subRoot of ['manual', 'automation', 'cross-module']) {
    const base = path.join(REPO_ROOT, 'plans', subRoot);
    for (const entry of fs.readdirSync(base, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        filesToScan.push(...listFiles(path.join(base, entry.name)));
      }
    }
  }

  for (const skillName of validSkills) {
    const sDir = path.join(skillsDir, skillName);
    filesToScan.push(...listFiles(sDir));
    filesToScan.push(...listFiles(path.join(sDir, 'references')));
  }

  let totalPointersResolved = 0;

  for (const filePath of filesToScan) {
    const content = fs.readFileSync(filePath, 'utf8');
    const relFile = path.relative(REPO_ROOT, filePath);

    if (
      filePath.includes(`${path.sep}.claude${path.sep}commands${path.sep}`) ||
      (filePath.includes(`${path.sep}.claude${path.sep}skills${path.sep}`) &&
        path.basename(filePath) === 'SKILL.md')
    ) {
      const doc = parseSkillDocument(content);
      assert.ok(doc.description.length > 0, `${relFile} must have a non-empty description`);
      assert.equal(
        doc.hasUnquotedColon,
        false,
        `${relFile} has an unquoted colon in description ('${doc.rawDescription}'); wrap in double quotes for strict YAML parsers`
      );

      if (filePath.includes(`${path.sep}.claude${path.sep}commands${path.sep}`)) {
        assert.ok(doc.skills.length >= 1, `${relFile} must declare at least 1 primary skill`);
        for (const s of doc.skills) {
          assert.ok(validSkills.has(s), `${relFile} references non-existent skill '${s}'`);
        }
      }
    }

    const { pointers, brokenPointers } = resolveContextPointers(content, {
      sourceFile: filePath,
      repoRoot: REPO_ROOT,
    });
    totalPointersResolved += pointers.length;
    assert.deepEqual(
      brokenPointers,
      [],
      `Broken Context Pointer(s) in ${relFile}: ${brokenPointers.map((b) => b.rawTarget).join(', ')}`
    );
  }

  assert.ok(
    totalPointersResolved >= 250,
    `Expected at least 250 Context Pointers (including code-labeled links) to be verified across the suite, got ${totalPointersResolved}`
  );

  // Ensure CLAUDE.md Section 5 and prompts/README.md index all 36 slash commands
  const claudeMdContent = fs.readFileSync(path.join(REPO_ROOT, 'CLAUDE.md'), 'utf8');
  const promptsReadmeContent = fs.readFileSync(path.join(REPO_ROOT, 'prompts', 'README.md'), 'utf8');
  const promptTxtFiles = listFiles(path.join(REPO_ROOT, 'prompts'), '.txt');
  assert.equal(
    promptTxtFiles.length,
    36,
    `Expected 36 prompt_*.txt templates in prompts/ matching the 36 workflows, got ${promptTxtFiles.length}`
  );
  for (const refMatch of promptsReadmeContent.matchAll(/\b(prompt_[A-Za-z0-9_]+\.txt)\b/g)) {
    const refName = refMatch[1];
    assert.ok(
      fs.existsSync(path.join(REPO_ROOT, 'prompts', refName)),
      `prompts/README.md references non-existent prompt file 'prompts/${refName}'`
    );
  }
  for (const promptFile of promptTxtFiles) {
    const baseName = path.basename(promptFile);
    assert.ok(
      promptsReadmeContent.includes(baseName),
      `prompts/README.md must index prompt file '${baseName}'`
    );
  }

  const combinedPromptsTxt = promptTxtFiles
    .map((f) => fs.readFileSync(f, 'utf8'))
    .join('\n');

  for (const cmdFile of listFiles(path.join(REPO_ROOT, '.claude', 'commands'), '.md')) {
    const cmdSlug = `/${path.basename(cmdFile, '.md')}`;
    assert.ok(
      claudeMdContent.includes(cmdSlug),
      `CLAUDE.md must list slash command '${cmdSlug}' in its Context Pointers index`
    );
    assert.ok(
      promptsReadmeContent.includes(cmdSlug),
      `prompts/README.md must index slash command '${cmdSlug}'`
    );
    assert.ok(
      combinedPromptsTxt.includes(cmdSlug),
      `At least one template in prompts/prompt_*.txt must reference slash command '${cmdSlug}'`
    );
  }

  // Ensure AI_FULL_FLOW_MANUAL.md and AI_FULL_FLOW_AUTOMATION.md reflect Headless default, /browser-mode, Antigravity sync, and validate-docs.mjs
  for (const guideName of ['AI_FULL_FLOW_MANUAL.md', 'AI_FULL_FLOW_AUTOMATION.md']) {
    const guideContent = fs.readFileSync(path.join(REPO_ROOT, guideName), 'utf8');
    assert.match(guideContent, /1920x1080/, `${guideName} must document default Headless Mode (1920x1080)`);
    assert.match(guideContent, /\/browser-mode/, `${guideName} must document /browser-mode switch`);
    assert.match(guideContent, /sync-antigravity\.mjs/, `${guideName} must document Antigravity dual-harness sync`);
    assert.match(guideContent, /validate-docs\.mjs/, `${guideName} must document scripts/validate-docs.mjs gate`);
  }
});

test('Seam 3: Core QA Domain Invariants, Offline Report Viewer Table Schemas, and TestCase Catalog Query Module are verified in-process', () => {
  const rbtDir = path.join(REPO_ROOT, '.claude', 'skills', 'skills-rbt-manual-testing');

  // 1. Parse skills-rbt-manual-testing/SKILL.md through the real TestCase viewer parser
  const rbtSkill = fs.readFileSync(path.join(rbtDir, 'SKILL.md'), 'utf8');
  const rbtTables = parseMarkdownTables(rbtSkill);
  const tcSchemaTable = rbtTables.find(
    (t) => t.headers.length === 13 && t.headers[0] === 'TC ID' && t.headers[12] === 'Tags'
  );
  assert.ok(
    tcSchemaTable,
    'skills-rbt-manual-testing/SKILL.md must contain a valid 13-column Test Cases table parsed by parseMarkdownTables()'
  );
  assert.equal(EXPORT_COLUMNS.length, 13, 'export.ts must define exactly 13 export columns');

  // Verify the TestCase parser + queryTestCases + formatCellPlainText on a synthetic 13-column table using the exact SKILL.md header
  const headerLine = `| ${tcSchemaTable.headers.join(' | ')} |`;
  const sepLine = `|${tcSchemaTable.headers.map(() => '---').join('|')}|`;
  const sampleMd = [
    '# Manual Test Cases — Login Module',
    '## Nhóm A — Smoke (2 TC)',
    headerLine,
    sepLine,
    '| `TC_LOGIN_010` | `REQ-LOGIN-01` | Login | Thấp | **Đăng nhập** thành công | Đã có tài khoản | 1. Nhập user<br>2. Bấm Login | `user=admin` | Mong đợi vào Dashboard | Medium | Yes | UI | `@Smoke, @Login` |',
    '| `TC_LOGIN_002` | `REQ-LOGIN-02` | Login | Cao | 🐞 Khoá tài khoản khi sai 5 lần | Đã có tài khoản | 1. Nhập sai 5 lần | `pass=wrong` | Báo lỗi khoá 15 phút | Critical | Yes | UI | `@Security, @Regression` |',
  ].join('\n');

  const parsedFile = parseMarkdownFile('test_cases_login.md', sampleMd);
  assert.equal(parsedFile.testCases.length, 2, 'parseMarkdownFile must parse 13-column TC rows');
  assert.deepEqual(parsedFile.testCases[0].tags, ['@Smoke', '@Login']);
  assert.equal(
    formatCellPlainText(parsedFile.testCases[0].steps),
    '1. Nhập user\n2. Bấm Login',
    'formatCellPlainText must normalize <br> to newline and strip inline markdown'
  );

  const queried = queryTestCases([parsedFile], {
    scopeKey: buildGroupScopeKey('test_cases_login.md', 'Nhóm A — Smoke'),
    sort: { key: 'id', dir: 1 },
  });
  assert.deepEqual(
    queried.filtered.map((tc) => tc.id),
    ['TC_LOGIN_002', 'TC_LOGIN_010'],
    'queryTestCases must natural-sort TC IDs (TC_002 before TC_010)'
  );
  assert.equal(queried.stats.critical, 1);
  assert.equal(queried.stats.medium, 1);
  assert.equal(queried.exportBaseName, 'test_cases_login');

  // Verify bilingual Risk Level sorting (Cao < Thấp) and case-insensitive Set priority filtering
  const byRisk = queryTestCases([parsedFile], {
    priorities: new Set(['Critical', 'MEDIUM']),
    sort: { key: 'risk', dir: 1 },
  });
  assert.deepEqual(
    byRisk.filtered.map((tc) => tc.id),
    ['TC_LOGIN_002', 'TC_LOGIN_010'],
    'queryTestCases must support case-insensitive Set priorities and bilingual Risk Level ordering (Cao before Thấp)'
  );

  // 2. 4 Test Rings, 15 Field Types, ISO 25010, and Granularity GỘP/TÁCH in RBT references
  const rbtRings = fs.readFileSync(
    path.join(rbtDir, 'references', 'FOUR_RINGS_AND_QUALITY_GATE.md'),
    'utf8'
  );
  assert.match(rbtRings, /VÒNG 1\s*[—-]\s*SMOKE/i);
  assert.match(rbtRings, /VÒNG 2\s*[—-]\s*FUNCTIONAL/i);
  assert.match(rbtRings, /VÒNG 3\s*[—-]\s*TECHNICAL/i);
  assert.match(rbtRings, /VÒNG 4\s*[—-]\s*NON-FUNCTIONAL/i);

  const fieldTypes = fs.readFileSync(
    path.join(rbtDir, 'references', 'FIELD_VALIDATION_15_TYPES.md'),
    'utf8'
  );
  assert.match(fieldTypes, /15/);

  const isoChecklist = fs.readFileSync(
    path.join(rbtDir, 'references', 'ISO_25010_CHECKLIST.md'),
    'utf8'
  );
  assert.match(isoChecklist, /ISO\s*25010/i);

  const rbtModes = fs.readFileSync(
    path.join(rbtDir, 'references', 'MODES_QUICK_AND_FULL_RBT.md'),
    'utf8'
  );
  assert.match(rbtModes, /GỘP/);
  assert.match(rbtModes, /TÁCH/);

  // 3. Requirements Analyzer ID continuity, _discovery no-REQ-ID rule, and 10-point REQ self-gate
  const reqSkill = fs.readFileSync(
    path.join(REPO_ROOT, '.claude', 'skills', 'skills-requirements-analyzer', 'SKILL.md'),
    'utf8'
  );
  assert.match(reqSkill, /REQ-<MODULE>-<NN>|REQ-<PREFIX>-<NN>/);
  assert.match(reqSkill, /AMB-/);
  assert.match(reqSkill, /RISK-/);

  // 4. Parse Execution Viewer & Bug Viewer table schemas in skills-manual-test-executor & skills-bug-reporter via parseMarkdownTables()
  const execSkill = fs.readFileSync(
    path.join(REPO_ROOT, '.claude', 'skills', 'skills-manual-test-executor', 'SKILL.md'),
    'utf8'
  );
  const execTables = parseMarkdownTables(execSkill);
  assert.ok(
    execTables.some(
      (t) =>
        t.headers.join(' | ') === 'TC ID | Test Scenario | Kết quả | Bước fail | Ghi chú' &&
        t.rows.length >= 1
    ),
    'skills-manual-test-executor/SKILL.md must contain a parseable Execution Viewer table with sample rows'
  );
  assert.match(execSkill, /PASS/);
  assert.match(execSkill, /FAIL/);
  assert.match(execSkill, /BLOCKED/);
  assert.match(execSkill, /SKIPPED/);

  const bugSkill = fs.readFileSync(
    path.join(REPO_ROOT, '.claude', 'skills', 'skills-bug-reporter', 'SKILL.md'),
    'utf8'
  );
  const bugTables = parseMarkdownTables(bugSkill);
  assert.ok(
    bugTables.some(
      (t) =>
        t.headers.join(' | ') ===
          'Mã bug | Module | Tiêu đề ngắn | Severity | Priority | Trạng thái | TC liên quan | Ngày phát hiện' &&
        t.rows.length >= 1
    ),
    'skills-bug-reporter/SKILL.md must contain a parseable Bugs Viewer catalog table with sample rows'
  );

  // 5. Ensure unused UI pass-through wrappers in scripts/testcases-viewer/src/components/ui/ remain pruned
  const uiFiles = fs.readdirSync(
    path.join(REPO_ROOT, 'scripts', 'testcases-viewer', 'src', 'components', 'ui')
  );
  assert.deepEqual(
    uiFiles.sort(),
    ['button.tsx', 'input.tsx'],
    'scripts/testcases-viewer/src/components/ui/ must only retain used UI modules (button.tsx, input.tsx)'
  );
});

test('Seam 4: Unified Evidence Capture (Screenshot & Video for Pass & Fail) and Vision Token Optimization', () => {
  const reportingRules = fs.readFileSync(
    path.join(REPO_ROOT, '.claude', 'rules', 'reporting_rules.md'),
    'utf8'
  );
  assert.match(reportingRules, /trang_thai_cuoi_cua_test/);
  assert.match(reportingRules, /trang_thai_khi_that_bai/);
  assert.match(reportingRules, /fullPage:\s*false/);
  assert.match(reportingRules, /fullPage:\s*true/);
  assert.match(reportingRules, /VIDEO_MODE/);
  assert.match(reportingRules, /video_bang_chung_pass/);
  assert.match(reportingRules, /video_khi_that_bai/);
  assert.match(reportingRules, /reports\/videos\//);

  const templatesDir = path.join(
    REPO_ROOT,
    '.claude',
    'skills',
    'skills-framework-architect',
    'references'
  );
  for (const tplName of [
    'TEMPLATES_PLAYWRIGHT_TS.md',
    'TEMPLATES_PLAYWRIGHT_JAVA.md',
    'TEMPLATES_PYTEST_AND_CICD.md',
  ]) {
    const tpl = fs.readFileSync(path.join(templatesDir, tplName), 'utf8');
    assert.match(tpl, /VIDEO_MODE|video\.mode/, `${tplName} must support adaptive VIDEO_MODE`);
    assert.match(tpl, /video_bang_chung_pass/, `${tplName} must attach PASS video when VIDEO_MODE=on`);
    assert.match(tpl, /video_khi_that_bai/, `${tplName} must attach FAIL video`);
    assert.match(tpl, /reports\/screenshots/, `${tplName} must persist screenshots to reports/screenshots/`);
    assert.match(tpl, /fullPage|setFullPage|full_page/, `${tplName} must differentiate PASS viewport vs FAIL fullPage`);
  }

  const selTpl = fs.readFileSync(path.join(templatesDir, 'TEMPLATES_SELENIUM_JAVA.md'), 'utf8');
  assert.match(selTpl, /reports\/screenshots/, 'TEMPLATES_SELENIUM_JAVA.md must persist screenshots to reports/screenshots/');
  assert.match(selTpl, /fullPage/, 'TEMPLATES_SELENIUM_JAVA.md must differentiate PASS viewport vs FAIL fullPage');

  const execSkill = fs.readFileSync(
    path.join(REPO_ROOT, '.claude', 'skills', 'skills-manual-test-executor', 'SKILL.md'),
    'utf8'
  );
  assert.match(execSkill, /_pass\.png/, 'skills-manual-test-executor must capture _pass.png evidence');
  assert.match(execSkill, /fullPage=false/, 'skills-manual-test-executor must use viewport fullPage=false on PASS');
  assert.match(execSkill, /_fail\.png|_error/i, 'skills-manual-test-executor must capture failure evidence');

  const uiRecon = fs.readFileSync(
    path.join(
      REPO_ROOT,
      '.claude',
      'skills',
      'skills-requirements-analyzer',
      'references',
      'UI_RECON_AND_EVIDENCE.md'
    ),
    'utf8'
  );
  assert.ok(
    !uiRecon.includes('Chụp xong **BẮT BUỘC dùng `Read` mở lại chính tệp ảnh đó**'),
    'UI_RECON_AND_EVIDENCE.md must not force reading every PNG into LLM vision context'
  );
  const webCmd = fs.readFileSync(
    path.join(REPO_ROOT, '.claude', 'commands', 'generate-requirements-from-website.md'),
    'utf8'
  );
  assert.ok(
    !webCmd.includes('bắt buộc dùng `Read` mở lại từng ảnh'),
    'generate-requirements-from-website.md must not force reading every PNG into LLM vision context'
  );
});

test('Seam 5: Dual-Harness Antigravity Sync Module verified in-process (Zero Duplicate Skills & Guardrails)', () => {
  // 1. Verify REPO_ROOT is 100% in sync via in-process call to syncAntigravity()
  const syncResult = syncAntigravity(REPO_ROOT, { checkOnly: true });
  assert.equal(
    syncResult.inSync,
    true,
    `Expected zero Dual-Harness drift, got drift=${JSON.stringify(syncResult.drift)}, broken=${JSON.stringify(syncResult.brokenSkillPointers)}`
  );
  assert.equal(syncResult.commandsSynced, 36, 'All 36 slash commands must be synced to .agents/skills/');

  // 2. Verify zero duplicate skill registrations across Antigravity workspace discovery & plugins
  const wsSkillsJson = readJson(path.join(REPO_ROOT, '.agents', 'skills.json'));
  const entryPaths = (wsSkillsJson.entries ?? []).map((e) => e.path);
  assert.deepEqual(
    entryPaths,
    ['.claude/skills'],
    '.agents/skills.json must register only .claude/skills (since .agents/skills is auto-discovered by workspace discovery)'
  );

  const pluginDir = path.join(REPO_ROOT, '.agents', 'plugins', 'claude-testing-skills');
  assert.ok(
    !fs.existsSync(path.join(pluginDir, 'skills.json')),
    '.agents/plugins/claude-testing-skills/skills.json must not exist (would duplicate workspace skills in Antigravity <skills>)'
  );
  assert.ok(
    !fs.existsSync(path.join(pluginDir, 'skills')),
    '.agents/plugins/claude-testing-skills/skills/ must not exist (would duplicate workspace skills in Antigravity <skills>)'
  );

  // 3. Verify root package.json and CI guardrail workflow exist
  const pkgJson = readJson(path.join(REPO_ROOT, 'package.json'));
  assert.ok(pkgJson?.scripts?.check, 'package.json must define a "check" script');
  assert.ok(pkgJson?.scripts?.test, 'package.json must define a "test" script');
  assert.ok(pkgJson?.scripts?.sync, 'package.json must define a "sync" script');
  assert.ok(
    fs.existsSync(path.join(REPO_ROOT, '.github', 'workflows', 'verify-suite.yml')),
    '.github/workflows/verify-suite.yml CI guardrail must exist'
  );
  assert.ok(
    !fs.existsSync(path.join(REPO_ROOT, '.codegraph')),
    '.codegraph directory must not exist in this Markdown skill suite'
  );

  // 4. Verify inline-code Context Pointer detection, missing disclosed ref detection, and extra frontmatter preservation
  const syntheticCmd = [
    '---',
    'description: "Synthetic command: test"',
    'skills:',
    '  - skills-ui-debug-agent',
    'argument-hint: "<target>"',
    '---',
    'See [other cmd](.claude/commands/browser-mode.md) and `.claude/rules/NonExistentRule.md` and `.claude/skills/skills-ui-debug-agent/references/MISSING.md`.',
  ].join('\n');
  const convertedCmd = convertCommandToAntigravitySkill('synthetic-cmd', syntheticCmd);
  assert.match(convertedCmd, /argument-hint: "<target>"/);
  assert.match(convertedCmd, /\]\(\.\.\/\.\.\/\.\.\/\.claude\/commands\/browser-mode\.md\)/);

  const pointerCheck = resolveContextPointers(convertedCmd, {
    sourceFile: path.join(REPO_ROOT, '.agents', 'skills', 'synthetic-cmd', 'SKILL.md'),
    repoRoot: REPO_ROOT,
  });
  assert.equal(pointerCheck.brokenPointers.length, 2);
  assert.deepEqual(
    pointerCheck.brokenPointers.map((b) => b.rawTarget).sort(),
    ['.claude/rules/NonExistentRule.md', '.claude/skills/skills-ui-debug-agent/references/MISSING.md']
  );
});

test('Seam 6: Shared Viewer Core Module (Bugs, Execution, RTM, Export Plan, CSV & Binary XLSX) verified in-process', () => {
  // 1. Bugs domain parser + catalog query + export plan
  const bugIndexMd = [
    '# Danh mục Bug',
    '| Mã bug | Module | Tiêu đề ngắn | Severity | Priority | Trạng thái | TC liên quan | Ngày phát hiện |',
    '|---|---|---|---|---|---|---|---|',
    '| BUG_CUST_002 | Customers | Lỗi lưu SĐT | 🟠 Major | P1 | Đang mở | CRM_CUST_TC_011 | 2026-08-02 |',
  ].join('\n');
  const indexRes = parseBugIndex(bugIndexMd, 'README.md');
  assert.equal(indexRes.rows.length, 1);
  assert.equal(indexRes.rows[0].id, 'BUG_CUST_002');

  const bugFileMd = [
    '# [BUG] Lỗi lưu SĐT có dấu cộng',
    '## Thông tin chung',
    '- **ID:** BUG_CUST_002',
    '- **Severity:** 🟠 Major',
    '- **Priority:** P1',
    '- **Môi trường:** Staging',
    '- **Build / Version:** v2.4.2',
    '- **Test case liên quan:** CRM_CUST_TC_011',
    '- **REQ ID liên quan:** REQ-CUST-04',
    '- **Ngày phát hiện:** 2026-08-02',
    '## Steps to Reproduce',
    '1. Mở form Thêm KH',
    '2. Nhập `+84912345678` và bấm Lưu',
    '## Expected Result',
    'Lưu thành công',
    '## Actual Result',
    'Báo lỗi 500',
    '## Evidence',
    '![fail](evidence/CRM_CUST_TC_011_step4_fail.png)',
    '## Lịch sử retest',
    '| Ngày | Build | Kết quả | Retest Report | Ghi chú |',
    '|---|---|---|---|---|',
    '| 2026-08-05 | v2.4.3 | 🟡 PARTIAL | retest_1.md | Còn lỗi khi có khoảng trắng |',
  ].join('\n');

  const bugDoc = parseBugFile(bugFileMd, 'BUG_CUST_002.md');
  assert.equal(bugDoc.id, 'BUG_CUST_002');
  assert.equal(bugDoc.status, 'PARTIAL');
  assert.equal(bugDoc.severity, 'MAJOR');
  assert.equal(bugDoc.retest.length, 1);

  const bugsQuery = queryBugsCatalog([...indexRes.rows, bugDoc], { sortKey: 'id', sortDir: 1 });
  assert.equal(bugsQuery.stats.total, 1);
  assert.equal(bugsQuery.stats.pending, 1);
  const bugsPlan = buildBugsExportPlan(bugsQuery.filtered);
  assert.equal(bugsPlan.sheets.length, 1);

  // 2. Execution & Retest report parser + RTM + Trend + Export Plan
  const execMd = [
    '# Execution Report — Customers · Smoke',
    '| Thông tin | Nội dung |',
    '|---|---|',
    '| Run ID | run_1785700456 |',
    '| Nguồn TC | docs/testcases/customers/test_cases_customers.md |',
    '| Môi trường | https://crm.example.com — Staging |',
    '| Bắt đầu → Kết thúc | 2026-08-02 09:00 → 09:30 |',
    '## 2. Kết quả từng TC',
    '| TC ID | Test Scenario | Kết quả | Bước fail | Ghi chú |',
    '|---|---|---|---|---|',
    '| CRM_CUST_TC_001 | Hiển thị bảng | ✅ PASS | — | [ảnh](evidence/CRM_CUST_TC_001_pass.png) |',
    '| CRM_CUST_TC_011 | Lưu SĐT | ❌ FAIL | 2 | Xem chi tiết #1 |',
    '## 3. Chi tiết TC FAIL',
    '### FAIL #1 — CRM_CUST_TC_011 · Lưu SĐT',
    '| | |',
    '|---|---|',
    '| REQ ID | REQ-CUST-04 |',
    '| Priority | High |',
    '| **Expected** | Lưu thành công |',
    '| **Actual** | HTTP 500 |',
    '## 5. Dữ liệu đã tạo & dọn dẹp',
    '| Dữ liệu | ID | Nơi tạo | Đã xoá? |',
    '|---|---|---|---|',
    '| Auto_Cust_1 | 101 | /clients | ❌ |',
  ].join('\n');

  const run1 = parseExecutionReport(execMd, 'execution_report_1.md');
  assert.equal(run1.module, 'Customers');
  assert.equal(run1.tcs.filter((t) => t.status === 'PASS').length, 1);
  assert.equal(run1.tcs.filter((t) => t.status === 'FAIL').length, 1);
  assert.equal(run1.dirty, 1);
  assert.equal(run1.tcs[1].reqId, 'REQ-CUST-04');

  const execMd2 = execMd
    .replace('run_1785700456', 'run_1785700999')
    .replace('2026-08-02 09:00 → 09:30', '2026-08-03 09:00 → 09:30')
    .replace('| CRM_CUST_TC_011 | Lưu SĐT | ❌ FAIL | 2 | Xem chi tiết #1 |', '| CRM_CUST_TC_011 | Lưu SĐT | ✅ PASS | — | Đã fix |');
  const run2 = parseExecutionReport(execMd2, 'execution_report_2.md');
  const trend = computeExecutionTrend([run1, run2]);
  assert.equal(trend.length, 1);
  assert.equal(trend[0].grp, 'FIXEDTREND');
  assert.equal(trend[0].id, 'CRM_CUST_TC_011');

  // Verify computeExecutionTrend also maps retest_report.md Section 2 bug verification outcomes (d.bugs) across all 4 statuses (FIXED, NOT_FIXED, PARTIAL, CANNOT_VERIFY) and multi-bug collision precedence
  const run1MultiMd = [
    '# Execution Report — Customers · run_1785700500',
    '| Thông tin | Nội dung |',
    '|---|---|',
    '| Run ID | run_1785700500 |',
    '## 2. Chi Tiết Thực Thi',
    '| TC ID | REQ ID | Tên TC | Vòng | Kết quả | Bug ID | Evidence | Ghi chú |',
    '|---|---|---|---|---|---|---|---|',
    '| CRM_CUST_TC_011 | REQ-CUST-04 | Lưu SĐT | 2 | ❌ FAIL | BUG_CUST_002 | — | Lỗi 500 |',
    '| CRM_CUST_TC_012 | REQ-CUST-05 | Xóa KH | 2 | ❌ FAIL | BUG_CUST_003 | — | Lỗi 500 |',
    '| CRM_CUST_TC_013 | REQ-CUST-06 | Xuất CSV | 2 | ❌ FAIL | BUG_CUST_004 | — | Lỗi format |',
    '| CRM_CUST_TC_014 | REQ-CUST-07 | Gửi SMS | 2 | ❌ FAIL | BUG_CUST_005 | — | Gateway lỗi |',
    '| CRM_CUST_TC_015 | REQ-CUST-08 | Lưu Địa chỉ | 2 | ❌ FAIL | BUG_CUST_006, BUG_CUST_007 | — | 2 bugs trên 1 TC |',
  ].join('\n');
  const retestOnlyMd = [
    '# Retest Report — Customers · RETEST',
    '| Thông tin | Nội dung |',
    '|---|---|',
    '| Retest ID | retest_1785701500 |',
    '| Mode | RETEST |',
    '## 2. Kết quả từng bug',
    '### BUG_CUST_002 — Lỗi lưu SĐT',
    '| Thông tin | Nội dung |',
    '|---|---|',
    '| Bug | BUG_CUST_002 |',
    '| TC / REQ liên quan | CRM_CUST_TC_011 · REQ-CUST-04 |',
    '| **Kết quả** | ✅ FIXED |',
    '### BUG_CUST_003 — Lỗi xóa KH',
    '| Thông tin | Nội dung |',
    '|---|---|',
    '| Bug | BUG_CUST_003 |',
    '| TC / REQ liên quan | CRM_CUST_TC_012 · REQ-CUST-05 |',
    '| **Kết quả** | ❌ NOT_FIXED |',
    '### BUG_CUST_004 — Lỗi xuất CSV',
    '| Thông tin | Nội dung |',
    '|---|---|',
    '| Bug | BUG_CUST_004 |',
    '| TC / REQ liên quan | CRM_CUST_TC_013 · REQ-CUST-06 |',
    '| **Kết quả** | 🟠 PARTIAL |',
    '### BUG_CUST_005 — Lỗi gửi SMS',
    '| Thông tin | Nội dung |',
    '|---|---|',
    '| Bug | BUG_CUST_005 |',
    '| TC / REQ liên quan | CRM_CUST_TC_014 · REQ-CUST-07 |',
    '| **Kết quả** | ⚠️ CANNOT_VERIFY |',
    '### BUG_CUST_006 — Lỗi địa chỉ 1 (chưa fix)',
    '| Thông tin | Nội dung |',
    '|---|---|',
    '| Bug | BUG_CUST_006 |',
    '| TC / REQ liên quan | CRM_CUST_TC_015 · REQ-CUST-08 |',
    '| **Kết quả** | ❌ NOT_FIXED |',
    '### BUG_CUST_007 — Lỗi địa chỉ 2 (đã fix)',
    '| Thông tin | Nội dung |',
    '|---|---|',
    '| Bug | BUG_CUST_007 |',
    '| TC / REQ liên quan | CRM_CUST_TC_015 · REQ-CUST-08 |',
    '| **Kết quả** | ✅ FIXED |',
  ].join('\n');
  const run1MultiDoc = parseExecutionReport(run1MultiMd, 'execution_report.md');
  const retestDoc = parseExecutionReport(retestOnlyMd, 'retest_report.md');
  const retestTrend = computeExecutionTrend([run1MultiDoc, retestDoc]);
  const trendById = new Map(retestTrend.map((r) => [r.id, r.grp]));
  assert.equal(trendById.get('CRM_CUST_TC_011'), 'FIXEDTREND', 'FIXED must map to PASS -> FIXEDTREND');
  assert.equal(trendById.get('CRM_CUST_TC_012'), 'RECUR', 'NOT_FIXED must map to FAIL -> RECUR');
  assert.equal(trendById.get('CRM_CUST_TC_013'), 'RECUR', 'PARTIAL must map to FAIL -> RECUR');
  assert.equal(trendById.get('CRM_CUST_TC_014'), 'TOBLOCKED', 'CANNOT_VERIFY must map to BLOCKED -> TOBLOCKED');
  assert.equal(
    trendById.get('CRM_CUST_TC_015'),
    'RECUR',
    'Multi-bug collision on same TC ID must keep worst status (NOT_FIXED + FIXED -> FAIL -> RECUR)'
  );

  const rtmMd = [
    '# Ma Trận Truy Vết (RTM) — Customers',
    '## Ma trận chi tiết',
    '| REQ ID | Mô tả ngắn | TC IDs | Automation | Trạng thái |',
    '|---|---|---|---|---|',
    '| REQ-CUST-01 | Danh sách KH | CRM_CUST_TC_001 | cust.spec.ts | ✅ Full |',
    '| REQ-CUST-04 | Thêm SĐT | CRM_CUST_TC_011 | — | 🟡 Manual only |',
  ].join('\n');
  const rtmDoc = parseExecutionReport(rtmMd, 'traceability_matrix.md');
  assert.equal(rtmDoc.kind, 'rtm');
  assert.equal(rtmDoc.rtm.rows.length, 2);

  const execPlan = buildExecutionExportPlan({
    tab: 'tc',
    tcRows: [...run1.tcs, ...run2.tcs],
  });
  assert.equal(execPlan.sheets.length, 3);

  // 2b. Test Summary Report (test_summary_*.md) parser & multi-sheet Export Plan
  const realSummaryForViewer = computeTestSummaryReport(REPO_ROOT, {
    module: 'login',
    milestone: 'Sprint 12',
  });
  const directSummaryParsed = parseTestSummary(
    realSummaryForViewer.markdown,
    'test_summary_sprint12.md'
  );
  assert.equal(directSummaryParsed.kind, 'summary');
  assert.equal(directSummaryParsed.recommendation, 'NO_GO');
  assert.match(directSummaryParsed.recommendationLabel, /NO-GO/);
  assert.equal(directSummaryParsed.exitCriteria[0].idx, '1');
  assert.equal(directSummaryParsed.modules[0].prefix, 'LOGIN');
  assert.equal(directSummaryParsed.modules[0].openBugs, 6);
  assert.match(directSummaryParsed.modules[0].latestRun, /run_1787215085/);
  assert.equal(directSummaryParsed.totals.executedModulesCount, 1);
  assert.equal(directSummaryParsed.totals.totalExecuted, 41);
  assert.equal(directSummaryParsed.rtmSummary.length, 3);

  const parsedSummaryDoc = parseExecutionReport(
    realSummaryForViewer.markdown,
    'test_summary_sprint12.md'
  );
  assert.equal(parsedSummaryDoc.kind, 'summary', 'parseExecutionReport must classify test_summary_*.md as kind="summary"');
  assert.equal(parsedSummaryDoc.summary.verdict, 'NO_GO');
  assert.equal(parsedSummaryDoc.summary.recommendation, 'NO_GO');
  assert.equal(parsedSummaryDoc.summary.exitCriteria.length, 7);
  assert.equal(parsedSummaryDoc.summary.exitCriteria[0].status, 'FAIL');
  assert.equal(parsedSummaryDoc.summary.modules.length, 1);
  assert.equal(parsedSummaryDoc.summary.modules[0].module, 'login');
  assert.equal(parsedSummaryDoc.summary.modules[0].pass, 32);
  assert.equal(parsedSummaryDoc.summary.openBugs.length, 6);
  assert.equal(parsedSummaryDoc.summary.rtmMetrics.length, 3);

  const summaryExportPlan = buildExecutionExportPlan(parsedSummaryDoc);
  assert.equal(summaryExportPlan.base, 'test_summary_report');
  assert.deepEqual(
    summaryExportPlan.sheets.map((s) => s.name),
    ['Tiêu chí Exit', 'Kết quả theo Module', 'Vùng chưa kiểm thử', 'Bug đang mở', 'Độ phủ RTM'],
    'When untested is non-empty, all 5 summary sheets must be emitted'
  );
  const bugSheet = summaryExportPlan.sheets.find((s) => s.name === 'Bug đang mở');
  assert.equal(bugSheet.statusCol, 6, 'Bug đang mở sheet must set statusCol: 6');

  const noUntestedPlan = buildExecutionExportPlan({
    ...parsedSummaryDoc,
    summary: { ...parsedSummaryDoc.summary, untested: [] },
  });
  assert.deepEqual(
    noUntestedPlan.sheets.map((s) => s.name),
    ['Tiêu chí Exit', 'Kết quả theo Module', 'Bug đang mở', 'Độ phủ RTM'],
    'When untested is empty, Vùng chưa kiểm thử sheet must be omitted'
  );

  const fullSummaryForViewer = computeTestSummaryReport(REPO_ROOT, { milestone: 'Release 1.0' });
  const parsedFullSummary = parseTestSummary(fullSummaryForViewer.markdown, 'test_summary_rel1.md');
  assert.ok(parsedFullSummary.untested.length >= 2);
  assert.ok(parsedFullSummary.untested[0].prefix.length >= 2);
  const fullSummaryExportPlan = buildExecutionExportPlan({
    tab: 'sum',
    summaryDoc: parsedFullSummary,
  });
  const summaryXlsxAscii = Buffer.from(buildXlsxBytes(fullSummaryExportPlan)).toString('utf8');
  assert.match(summaryXlsxAscii, /Tiêu chí Exit/);
  assert.match(summaryXlsxAscii, /Kết quả theo Module/);
  assert.match(summaryXlsxAscii, /Vùng chưa kiểm thử/);

  // 3. CSV (with BOM) and Binary XLSX store-ZIP serializer verification
  const csvStr = buildCsvString(bugsPlan);
  assert.ok(csvStr.startsWith('\uFEFF"Mã bug",'), 'CSV output must start with UTF-8 BOM \\uFEFF');
  assert.match(csvStr, /BUG_CUST_002/);

  const xlsxBytes = buildXlsxBytes(bugsPlan);
  const view = new DataView(xlsxBytes.buffer, xlsxBytes.byteOffset, xlsxBytes.byteLength);
  assert.equal(view.getUint32(0, true), 0x04034b50, 'XLSX binary must start with ZIP Local File Header signature PK\\x03\\x04');
  const xlsxAscii = Buffer.from(xlsxBytes).toString('utf8');
  assert.match(xlsxAscii, /xl\/workbook\.xml/);
  assert.match(xlsxAscii, /xl\/styles\.xml/);
  assert.match(xlsxAscii, /BUG_CUST_002/);

  const tcPlan = buildTestCasesExportPlan(
    [
      {
        id: 'TC_01',
        reqIds: ['REQ-01'],
        module: 'Auth',
        risk: 'High',
        title: 'Login',
        preCondition: 'None',
        steps: '1. Open',
        expected: '1. Loaded',
        priority: 'High',
        testData: 'a@b.c',
        automatable: 'Yes',
        autoType: 'UI',
        tags: ['@Smoke'],
        group: 'Group 1',
      },
    ],
    'test_cases_auth'
  );
  assert.equal(tcPlan.sheets[0].head.length, 13);

  // 4. Verify Escape key behavior parity in bugs-viewer/bundle.html and execution-viewer/bundle.html
  const bugsBundle = fs.readFileSync(path.join(REPO_ROOT, 'scripts', 'bugs-viewer', 'bundle.html'), 'utf8');
  const execBundle = fs.readFileSync(path.join(REPO_ROOT, 'scripts', 'execution-viewer', 'bundle.html'), 'utf8');
  assert.match(bugsBundle, /if\(\$\('#lightbox'\)\.classList\.contains\('open'\)\)\s*closeLightbox\(\);\s*else\s*\$\('#detail'\)\.classList\.remove\('open'\);/);
  assert.match(execBundle, /if\(\$\('#lightbox'\)\.classList\.contains\('open'\)\)\s*return\s+closeLightbox\(\);\s*\$\('#detail'\)\.classList\.remove\('open'\);/);

  // 5. Verify all real bug files in docs/bugs/login/ have complete Build/Version & REQ ID metadata (zero missingRef alerts)
  const realBugDir = path.join(REPO_ROOT, 'docs', 'bugs', 'login');
  const realBugs = fs
    .readdirSync(realBugDir)
    .filter((f) => f.endsWith('.md'))
    .map((f) => parseBugFile(fs.readFileSync(path.join(realBugDir, f), 'utf8'), f));
  const realBugCatalog = queryBugsCatalog(realBugs);
  assert.equal(
    realBugCatalog.alerts.missingRef.length,
    0,
    `Expected zero missingRef alerts across docs/bugs/login/*.md, got: ${realBugCatalog.alerts.missingRef.map((b) => b.id).join(', ')}`
  );
});

test('Seam 7: Canonical Locator Priority Matrix in .claude/rules/locator_strategy.md and Legacy Plans Schema Parity', () => {
  // 1. Canonical Locator Priority Matrix in .claude/rules/locator_strategy.md
  const locatorStrategy = fs.readFileSync(
    path.join(REPO_ROOT, '.claude', 'rules', 'locator_strategy.md'),
    'utf8'
  );
  const locatorTables = parseMarkdownTables(locatorStrategy);
  assert.ok(
    locatorTables.some(
      (t) =>
        t.headers.length === 5 &&
        t.headers[1].includes('Playwright') &&
        t.headers[2].includes('Selenium') &&
        t.headers[3].includes('Appium') &&
        t.rows.length === 6
    ),
    '.claude/rules/locator_strategy.md must define the canonical 5-column x 6-row Locator Priority Matrix across Playwright, Selenium, and Appium'
  );

  for (const relPath of [
    '.claude/rules/playwright_rules.md',
    '.claude/rules/selenium_rules.md',
    '.claude/skills/skills-smart-locator-agent/SKILL.md',
    '.claude/skills/skills-locator-healer-agent/SKILL.md',
    '.claude/skills/skills-ui-debug-agent/SKILL.md',
    '.claude/commands/generate-locator.md',
  ]) {
    const content = fs.readFileSync(path.join(REPO_ROOT, relPath), 'utf8');
    assert.match(
      content,
      /locator_strategy\.md/,
      `${relPath} must delegate to the canonical Locator Priority Matrix in locator_strategy.md`
    );
  }

  // 2. Legacy plans/ prompts parity with canonical 13-column TC header, 15 field types, 4 Ring statuses, and Headless Mode
  const plan05 = fs.readFileSync(
    path.join(REPO_ROOT, 'plans', 'manual', '05_rbt_and_tc_generation', 'prompt.txt'),
    'utf8'
  );
  const plan05Tables = parseMarkdownTables(plan05);
  const fieldTable05 = plan05Tables.find((t) => t.headers[0] === 'Loại Field');
  assert.ok(fieldTable05, 'plans/manual/05_rbt_and_tc_generation/prompt.txt must contain the Loại Field validation table');
  assert.equal(
    fieldTable05.rows.length,
    15,
    'plans/manual/05_rbt_and_tc_generation/prompt.txt must include all 15 input field types'
  );
  const passwordRow = fieldTable05.rows.find((r) => r[0].includes('Password'));
  assert.equal(
    passwordRow[1].split('·').length,
    9,
    'Password validation row must list all 9 items matching skills-testcase-reviewer'
  );
  assert.match(plan05, /⏭️/);

  const plan06 = fs.readFileSync(
    path.join(REPO_ROOT, 'plans', 'manual', '06_template_mapping', 'prompt.txt'),
    'utf8'
  );
  assert.match(
    plan06,
    /\|\s*TC ID\s*\|\s*REQ ID\s*\|\s*Module\s*\|\s*Risk Level\s*\|\s*Test Scenario\s*\|\s*Pre-Condition\s*\|\s*Test Steps\s*\|\s*Test Data\s*\|\s*Expected Result\s*\|\s*Priority\s*\|\s*Automatable\s*\|\s*Auto Type\s*\|\s*Tags\s*\|/,
    'plans/manual/06_template_mapping/prompt.txt must use the canonical 13-column order (Test Steps | Test Data | Expected Result | Priority)'
  );
  assert.match(plan06, /⏭️\s*Cố ý bỏ/);

  const planAuto = fs.readFileSync(
    path.join(REPO_ROOT, 'plans', 'automation', 'prompt_automation.txt'),
    'utf8'
  );
  assert.match(planAuto, /Headless Mode.*1920x1080/i);
  assert.match(planAuto, /VIDEO_MODE/);
  assert.match(planAuto, /trang_thai_cuoi_cua_test/);
  assert.match(planAuto, /trang_thai_khi_that_bai/);
});

test('Seam 8: Viewer Core Synchronization projects viewer-core.mjs into standalone HTML viewers with zero duplication', () => {
  const viewerSync = syncViewerBundles(REPO_ROOT, { checkOnly: true });
  assert.equal(
    viewerSync.inSync,
    true,
    `Expected standalone HTML viewers to be in sync with viewer-core.mjs, got drift=${JSON.stringify(viewerSync.drift)}`
  );

  const bugsBundle = fs.readFileSync(
    path.join(REPO_ROOT, 'scripts', 'bugs-viewer', 'bundle.html'),
    'utf8'
  );
  const execBundle = fs.readFileSync(
    path.join(REPO_ROOT, 'scripts', 'execution-viewer', 'bundle.html'),
    'utf8'
  );
  const tcBundle = fs.readFileSync(
    path.join(REPO_ROOT, 'scripts', 'testcases-viewer', 'bundle.html'),
    'utf8'
  );

  for (const [name, html] of [
    ['bugs-viewer/bundle.html', bugsBundle],
    ['execution-viewer/bundle.html', execBundle],
    ['testcases-viewer/bundle.html', tcBundle],
  ]) {
    assert.ok(
      html.includes('/* __VIEWER_CORE_START__ */') && html.includes('/* __VIEWER_CORE_END__ */'),
      `${name} must contain the deterministic viewer-core.mjs injection markers`
    );
    assert.ok(
      !html.includes('function zipStore(') && !html.includes('function sheetXml('),
      `${name} must not retain hand-copied zipStore() or sheetXml() implementations`
    );
    assert.match(html, /buildCsvString\(/, `${name} must delegate CSV serialization to viewer-core.mjs`);
    assert.match(html, /buildXlsxBytes\(/, `${name} must delegate XLSX serialization to viewer-core.mjs`);
    const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/);
    assert.ok(scriptMatch, `${name} must contain a <script> block`);
    assert.ok(!html.includes('<<script>'), `${name} must not contain a malformed <<script> tag`);
    assert.doesNotThrow(
      () => new Function(scriptMatch[1]),
      `${name} embedded <script> must parse with zero JavaScript syntax errors`
    );
  }

  assert.match(bugsBundle, /queryBugsCatalog\(/, 'bugs-viewer must delegate catalog querying/sorting to viewer-core.mjs');
  assert.match(bugsBundle, /buildBugsExportPlan\(/, 'bugs-viewer must delegate Export Plan building to viewer-core.mjs');
  assert.match(execBundle, /parseExecutionReport\(/, 'execution-viewer must delegate report parsing to viewer-core.mjs');
  assert.match(execBundle, /computeExecutionTrend\(/, 'execution-viewer must delegate trend calculation to viewer-core.mjs');
  assert.match(execBundle, /buildExecutionExportPlan\(/, 'execution-viewer must delegate Export Plan building to viewer-core.mjs');
  assert.match(execBundle, /data-tab="sum"/, 'execution-viewer must provide the Tổng hợp Release (sum) tab for test_summary_*.md');
  assert.match(execBundle, /function renderSummary\(/, 'execution-viewer must define renderSummary() for kind="summary" reports');
  assert.match(tcBundle, /parseMarkdownFile\(/, 'testcases-viewer must delegate markdown parsing to viewer-core.mjs');
  assert.match(tcBundle, /queryTestCases\(/, 'testcases-viewer must delegate test case querying/sorting to viewer-core.mjs');
  assert.match(tcBundle, /buildTestCasesExportPlan/, 'testcases-viewer must delegate Export Plan building to viewer-core.mjs');

  // Verify testcases-viewer parity (wrapper delegation to viewer-core.mjs, bundle.html 13-col & XLSX ZIP headers, README.md React 19 & viewer-core.mjs docs)
  const tcParserSrc = fs.readFileSync(
    path.join(REPO_ROOT, 'scripts', 'testcases-viewer', 'src', 'lib', 'parser.ts'),
    'utf8'
  );
  const tcExportSrc = fs.readFileSync(
    path.join(REPO_ROOT, 'scripts', 'testcases-viewer', 'src', 'lib', 'export.ts'),
    'utf8'
  );
  assert.match(tcParserSrc, /\.\.\/\.\.\/\.\.\/viewer-core\.mjs/, 'testcases-viewer parser.ts must delegate to scripts/viewer-core.mjs');
  assert.match(tcExportSrc, /\.\.\/\.\.\/\.\.\/viewer-core\.mjs/, 'testcases-viewer export.ts must delegate to scripts/viewer-core.mjs');

  assert.match(tcBundle, /Test Scenario/, 'testcases-viewer/bundle.html must include canonical Test Scenario column');
  assert.match(tcBundle, /application\/vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet/, 'testcases-viewer/bundle.html must support .xlsx export');
  const tcModuleScriptMatch = tcBundle.match(/<script type="module">([\s\S]*?)<\/script>/);
  assert.ok(tcModuleScriptMatch, 'testcases-viewer/bundle.html must contain a <script type="module"> block');
  assert.doesNotThrow(
    () => new Function(tcModuleScriptMatch[1]),
    'testcases-viewer/bundle.html <script type="module"> must parse with zero JavaScript syntax errors'
  );

  const tcReadme = fs.readFileSync(
    path.join(REPO_ROOT, 'scripts', 'testcases-viewer', 'README.md'),
    'utf8'
  );
  assert.match(tcReadme, /React 19/, 'scripts/testcases-viewer/README.md must document React 19');
  assert.match(tcReadme, /viewer-core\.mjs/, 'scripts/testcases-viewer/README.md must document delegation to scripts/viewer-core.mjs');

  const tcViteConfig = fs.readFileSync(
    path.join(REPO_ROOT, 'scripts', 'testcases-viewer', 'vite.config.ts'),
    'utf8'
  );
  assert.ok(
    !tcViteConfig.includes('__dirname'),
    'scripts/testcases-viewer/vite.config.ts must use ESM-safe URL/dirname resolution instead of bare __dirname'
  );
  assert.ok(
    !fs.existsSync(path.join(REPO_ROOT, 'scripts', 'testcases-viewer', 'postcss.config.js')),
    'scripts/testcases-viewer/postcss.config.js must be replaced by .postcssrc.json so Parcel 2 caches PostCSS without warnings'
  );
  const tcPostcssRc = readJson(
    path.join(REPO_ROOT, 'scripts', 'testcases-viewer', '.postcssrc.json')
  );
  assert.ok(
    tcPostcssRc?.plugins?.tailwindcss !== undefined,
    'scripts/testcases-viewer/.postcssrc.json must configure tailwindcss plugin'
  );

  // Verify root & viewer documentation parity (--summary, test_summary_*.md, OUTOFSCOPE, scripts/integrations/jira/)
  const rootReadme = fs.readFileSync(path.join(REPO_ROOT, 'README.md'), 'utf8');
  assert.match(rootReadme, /--summary/, 'README.md must document validate-docs.mjs --summary');
  assert.match(rootReadme, /integrations\/jira/, 'README.md must document scripts/integrations/jira/');

  const manualFlowDoc = fs.readFileSync(path.join(REPO_ROOT, 'AI_FULL_FLOW_MANUAL.md'), 'utf8');
  assert.match(manualFlowDoc, /validate-docs\.mjs --summary/, 'AI_FULL_FLOW_MANUAL.md must document node scripts/validate-docs.mjs --summary');
  assert.match(manualFlowDoc, /test_summary_/, 'AI_FULL_FLOW_MANUAL.md viewer table must document test_summary_*.md');

  const execViewerReadme = fs.readFileSync(
    path.join(REPO_ROOT, 'scripts', 'execution-viewer', 'README.md'),
    'utf8'
  );
  assert.match(execViewerReadme, /test_summary_/, 'scripts/execution-viewer/README.md must document test_summary_*.md');
  assert.match(execViewerReadme, /Ngoài phạm vi/, 'scripts/execution-viewer/README.md must document the 5th RTM status (Ngoài phạm vi)');
});

test('Seam 9: Artifact Integrity Gate (scripts/validate-docs.mjs) validates docs/ schemas, pointers, and RTM coverage', () => {
  // 1. Validate the real repository docs/ tree
  const realValidation = validateDocsTree(REPO_ROOT);
  assert.equal(
    realValidation.brokenPointers.length,
    0,
    `Expected zero broken pointers in docs/, got:\n${realValidation.brokenPointers.map((p) => `  - ${p.sourceFile}: ${p.rawTarget}`).join('\n')}`
  );
  assert.equal(
    realValidation.schemaViolations.length,
    0,
    `Expected zero schema violations in docs/, got:\n${realValidation.schemaViolations.map((s) => `  - ${s.file}: ${s.message}`).join('\n')}`
  );
  assert.equal(
    realValidation.referentialErrors.length,
    0,
    `Expected zero referential integrity errors in docs/, got:\n${realValidation.referentialErrors.map((r) => `  - ${r.file}: ${r.message}`).join('\n')}`
  );
  assert.equal(realValidation.valid, true);
  assert.ok(realValidation.modules.includes('login'), 'validateDocsTree must discover login module');
  assert.ok(realValidation.modules.includes('customers'), 'validateDocsTree must discover customers module');
  assert.ok(realValidation.modules.includes('projects'), 'validateDocsTree must discover projects module');

  // 2. Compute deterministic RTM for login module
  const rtm = computeTraceabilityReport(REPO_ROOT, { module: 'login' });
  assert.equal(rtm.summary.totalReqs, 43, 'login module must have 43 REQs');
  assert.equal(rtm.summary.totalTcs, 50, 'login module must have 50 TCs');
  assert.equal(rtm.summary.coveredReqs, 39, 'login module must have 39 covered in-scope REQs');
  assert.equal(rtm.summary.outOfScopeReqs, 4, 'login module must recognize 4 out-of-scope REQs');
  assert.ok(rtm.summary.executedTcs > 0, 'login module RTM must report executedTcs > 0');
  assert.ok(rtm.summary.openBugs > 0, 'login module RTM must report openBugs > 0');
  assert.equal(rtm.orphanTcs.length, 0, 'login module must have zero orphan TCs');
  assert.match(rtm.markdown, /\|\s*REQ ID\s*\|\s*Mô tả ngắn\s*\|\s*TC IDs\s*\|\s*Automation\s*\|\s*Trạng thái\s*\|/);
  assert.match(rtm.markdown, /Bug đang mở/);
  const parsedJson = JSON.parse(JSON.stringify(rtm));
  assert.equal(parsedJson.summary.coveragePct, 100);

  // 3. Verify synthetic broken docs/ tree triggers brokenPointers, schemaViolations, and referentialErrors
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'validate-docs-test-'));
  try {
    const reqDir = path.join(tmpRoot, 'docs', 'requirements', 'auth');
    const tcDir = path.join(tmpRoot, 'docs', 'testcases', 'auth');
    const execDir = path.join(tmpRoot, 'docs', 'executions', 'auth', 'run_1');
    const bugDir = path.join(tmpRoot, 'docs', 'bugs', 'auth');
    fs.mkdirSync(reqDir, { recursive: true });
    fs.mkdirSync(tcDir, { recursive: true });
    fs.mkdirSync(execDir, { recursive: true });
    fs.mkdirSync(bugDir, { recursive: true });

    fs.writeFileSync(
      path.join(reqDir, 'requirements_auth.md'),
      [
        '# Requirements Auth',
        'Broken link: [missing](../missing.md)',
        '| REQ ID | Tên yêu cầu | Mô tả | Acceptance Criteria | Trạng thái | Cập nhật lần cuối | Nguồn |',
        '|---|---|---|---|---|---|---|',
        '| REQ-AUTH-01 | Login | Desc | AC | 🟢 | — | DOM |',
      ].join('\n'),
      'utf8'
    );

    fs.writeFileSync(
      path.join(tcDir, 'test_cases_auth.md'),
      [
        '# Test Cases Auth',
        '| TC ID | REQ ID | Module | Risk Level | Test Scenario | Pre-Condition | Test Steps | Test Data | Expected Result | Priority | Automatable | Auto Type | Tags |',
        '|---|---|---|---|---|---|---|---|---|---|---|---|---|',
        '| CRM_AUTH_TC_001 | REQ-AUTH-99 | AUTH | High | Invalid REQ ref | None | 1. Go | None | 1. Ok | High | Yes | UI | @Smoke |',
      ].join('\n'),
      'utf8'
    );

    fs.writeFileSync(
      path.join(execDir, 'execution_report.md'),
      [
        '# Execution Report — Auth',
        '## 2. Kết quả từng TC',
        '| TC ID | Test Scenario | Kết quả | Ghi chú |',
        '|---|---|---|---|',
        '| CRM_AUTH_TC_999 | Missing 5th column and unknown TC | ❌ FAIL | [img](evidence/missing.png) |',
      ].join('\n'),
      'utf8'
    );

    const badResult = validateDocsTree(tmpRoot);
    assert.equal(badResult.valid, false);
    assert.ok(badResult.brokenPointers.length >= 2, 'Must detect broken markdown link and missing evidence image');
    assert.ok(badResult.schemaViolations.length >= 1, 'Must detect malformed 4-column execution report table');
    assert.ok(badResult.referentialErrors.length >= 1, 'Must detect unknown REQ-AUTH-99 reference');

    // 4. Verify RETEST_WORKFLOW_AND_REPORT.md and BUG_REPORT_TEMPLATE_AND_JIRA.md templates parse cleanly via viewer-core.mjs
    const retestRefContent = fs.readFileSync(
      path.join(
        REPO_ROOT,
        '.claude',
        'skills',
        'skills-manual-test-executor',
        'references',
        'RETEST_WORKFLOW_AND_REPORT.md'
      ),
      'utf8'
    );
    const retestTplMatch = retestRefContent.match(/```markdown\r?\n([\s\S]*?)```/);
    assert.ok(retestTplMatch, 'RETEST_WORKFLOW_AND_REPORT.md must contain a ```markdown template block');
    const parsedRetestTpl = parseExecutionReport(retestTplMatch[1], 'retest_report.md');
    assert.equal(parsedRetestTpl.kind, 'retest');
    assert.ok(
      parsedRetestTpl.bugs.length >= 1,
      'RETEST_WORKFLOW_AND_REPORT.md template must parse >= 1 bug entry via parseExecutionReport()'
    );
    assert.ok(
      parsedRetestTpl.tcs.length >= 1,
      'RETEST_WORKFLOW_AND_REPORT.md template must parse >= 1 regression TC row via parseExecutionReport()'
    );

    const bugRefContent = fs.readFileSync(
      path.join(
        REPO_ROOT,
        '.claude',
        'skills',
        'skills-bug-reporter',
        'references',
        'BUG_REPORT_TEMPLATE_AND_JIRA.md'
      ),
      'utf8'
    );
    const bugTplMatch = bugRefContent.match(/```markdown\r?\n([\s\S]*?)```/);
    assert.ok(bugTplMatch, 'BUG_REPORT_TEMPLATE_AND_JIRA.md must contain a ```markdown template block');
    const parsedBugTpl = parseBugFile(bugTplMatch[1], 'BUG_login_1787226514_TC016.md');
    assert.match(parsedBugTpl.id, /^BUG_/);
    assert.ok(parsedBugTpl.tc.length > 0, 'BUG_REPORT_TEMPLATE_AND_JIRA.md template must parse non-empty tc');
    assert.ok(parsedBugTpl.req.length > 0, 'BUG_REPORT_TEMPLATE_AND_JIRA.md template must parse non-empty req');
    assert.ok(parsedBugTpl.steps.length > 0, 'BUG_REPORT_TEMPLATE_AND_JIRA.md template must parse non-empty steps');
    assert.ok(parsedBugTpl.expected.length > 0, 'BUG_REPORT_TEMPLATE_AND_JIRA.md template must parse non-empty expected');
    assert.ok(parsedBugTpl.actual.length > 0, 'BUG_REPORT_TEMPLATE_AND_JIRA.md template must parse non-empty actual');

    // 5. Verify validateDocsTree supports RETEST mode (no regression TCs), FULL mode (with regression TCs), and "Test Title" header alias
    const validRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'validate-retest-ok-'));
    try {
      const vReqDir = path.join(validRoot, 'docs', 'requirements', 'auth');
      const vTcDir = path.join(validRoot, 'docs', 'testcases', 'auth');
      const vBugDir = path.join(validRoot, 'docs', 'bugs', 'auth');
      const vRetestOnlyDir = path.join(validRoot, 'docs', 'executions', 'auth', 'retest_1');
      const vRetestFullDir = path.join(validRoot, 'docs', 'executions', 'auth', 'retest_2');
      fs.mkdirSync(vReqDir, { recursive: true });
      fs.mkdirSync(vTcDir, { recursive: true });
      fs.mkdirSync(vBugDir, { recursive: true });
      fs.mkdirSync(vRetestOnlyDir, { recursive: true });
      fs.mkdirSync(vRetestFullDir, { recursive: true });

      fs.writeFileSync(
        path.join(vReqDir, 'requirements_auth.md'),
        [
          '# Requirements Auth',
          '| REQ ID | Tên yêu cầu | Mô tả | Acceptance Criteria | Trạng thái | Cập nhật lần cuối | Nguồn |',
          '|---|---|---|---|---|---|---|',
          '| REQ-AUTH-01 | Login | Desc | AC | 🟢 | — | DOM |',
        ].join('\n'),
        'utf8'
      );

      // Uses "Test Title" instead of "Test Scenario"
      fs.writeFileSync(
        path.join(vTcDir, 'test_cases_auth.md'),
        [
          '# Test Cases Auth',
          '| TC ID | REQ ID | Module | Risk Level | Test Title | Pre-Condition | Test Steps | Test Data | Expected Result | Priority | Automatable | Auto Type | Tags |',
          '|---|---|---|---|---|---|---|---|---|---|---|---|---|',
          '| CRM_AUTH_TC_001 | REQ-AUTH-01 | AUTH | High | Valid Login | None | 1. Go | None | 1. Ok | High | Yes | UI | @Smoke |',
        ].join('\n'),
        'utf8'
      );

      fs.writeFileSync(
        path.join(vBugDir, 'BUG_auth_1787000001_TC001.md'),
        [
          '# [BUG] Login fails',
          '## Thông tin chung',
          '- **ID:** BUG_auth_1787000001_TC001',
          '- **Severity:** 🟠 Major',
          '- **Priority:** P1',
          '- **Môi trường:** Staging',
          '- **Build / Version:** v1.0.0',
          '- **Test case liên quan:** CRM_AUTH_TC_001',
          '- **REQ ID liên quan:** REQ-AUTH-01',
          '- **Ngày phát hiện:** 2026-08-20',
          '## Steps to Reproduce',
          '1. Login',
          '## Expected Result',
          'Dashboard',
          '## Actual Result',
          'Error 500',
          '## Lịch sử retest',
          '| Ngày | Build | Kết quả | Retest report | Ghi chú |',
          '|---|---|---|---|---|',
        ].join('\n'),
        'utf8'
      );

      // RETEST mode: only bug verification table, no regression TC table
      fs.writeFileSync(
        path.join(vRetestOnlyDir, 'retest_report.md'),
        [
          '# Retest Report — Auth · RETEST',
          '| Thông tin | Nội dung |',
          '|---|---|',
          '| Retest ID | retest_1 |',
          '| Mode | RETEST |',
          '## 2. Kết quả từng bug',
          '### BUG_auth_1787000001_TC001 — Login fails',
          '| Thông tin | Nội dung |',
          '|---|---|',
          '| Bug | BUG_auth_1787000001_TC001 |',
          '| Severity gốc | 🟠 Major |',
          '| TC / REQ liên quan | CRM_AUTH_TC_001 · REQ-AUTH-01 |',
          '| Số lần lặp | 2/2 |',
          '| **Kết quả** | ✅ FIXED |',
        ].join('\n'),
        'utf8'
      );

      // FULL mode: bug verification table + 5-column regression table (TC ID | Vòng | Kịch bản | Kết quả | Ghi chú)
      fs.writeFileSync(
        path.join(vRetestFullDir, 'retest_report.md'),
        [
          '# Retest Report — Auth · FULL',
          '| Thông tin | Nội dung |',
          '|---|---|',
          '| Retest ID | retest_2 |',
          '| Mode | FULL |',
          '## 2. Kết quả từng bug',
          '### BUG_auth_1787000001_TC001 — Login fails',
          '| Thông tin | Nội dung |',
          '|---|---|',
          '| Bug | BUG_auth_1787000001_TC001 |',
          '| TC / REQ liên quan | CRM_AUTH_TC_001 · REQ-AUTH-01 |',
          '| **Kết quả** | ✅ FIXED |',
          '## 3. Kết quả regression',
          '| TC ID | Vòng | Kịch bản | Kết quả | Ghi chú |',
          '|---|---|---|---|---|',
          '| CRM_AUTH_TC_001 | Vòng 1 | Valid Login | ✅ PASS | — |',
        ].join('\n'),
        'utf8'
      );

      const okRes = validateDocsTree(validRoot);
      assert.equal(
        okRes.valid,
        true,
        `Expected valid RETEST/FULL retest_report.md and Test Title alias to pass validateDocsTree, got schema=${JSON.stringify(okRes.schemaViolations)}, ref=${JSON.stringify(okRes.referentialErrors)}`
      );

      // 6. Verify secondary system catalog (_book-api/README.md), user-guides/README.md, user_guide_<module>.md, impact_*.md, and changelog validation
      const bookApiDir = path.join(validRoot, 'docs', 'requirements', '_book-api');
      const ugDir = path.join(validRoot, 'docs', 'user-guides', 'auth');
      const impactDir = path.join(vReqDir, 'impact');
      fs.mkdirSync(bookApiDir, { recursive: true });
      fs.mkdirSync(ugDir, { recursive: true });
      fs.mkdirSync(impactDir, { recursive: true });

      // Discontinuous ID range in secondary system catalog (_book-api/README.md using "Mã" column)
      fs.writeFileSync(
        path.join(bookApiDir, 'README.md'),
        [
          '# Book API Catalog',
          '## 1. Bảng danh mục module',
          '| Module | Mã | Số endpoint | Trạng thái | Tài liệu | REQ đã dùng | Mã kế tiếp | AMB treo | Cập nhật |',
          '|---|---|---|---|---|---|---|---|---|',
          '| Auth | `AUTH` | 6 | ✅ Đã có tài liệu | — | `REQ-BK-AUTH-01` → `REQ-BK-AUTH-05` | `REQ-BK-AUTH-09` | — | 2026-08-14 |',
          '| | | **6** | | | | | | |',
        ].join('\n'),
        'utf8'
      );

      // Malformed user-guides/README.md catalog (only 3 columns instead of >=7)
      fs.writeFileSync(
        path.join(validRoot, 'docs', 'user-guides', 'README.md'),
        [
          '# Danh mục Hướng dẫn sử dụng',
          '## 1. Bảng danh mục',
          '| Module | Đối tượng đọc | Cập nhật |',
          '|---|---|---|',
          '| [Auth](auth/user_guide_auth.md) | Admin | 2026-09-09 |',
        ].join('\n'),
        'utf8'
      );

      // user_guide_auth.md referencing unknown REQ-AUTH-88 inside HTML comment and prose
      fs.writeFileSync(
        path.join(ugDir, 'user_guide_auth.md'),
        [
          '# Hướng dẫn sử dụng Auth',
          '<!-- Nguồn: REQ-AUTH-01, REQ-AUTH-88 -->',
          '## 6. Vùng chưa xác minh (nội bộ)',
          '| Nội dung | Vì sao chưa xác minh | Ảnh hưởng |',
          '|---|---|---|',
          '| MFA | `REQ-AUTH-77` chưa kiểm chứng | — |',
        ].join('\n'),
        'utf8'
      );

      // impact report referencing unknown REQ-AUTH-66 and unknown CRM_AUTH_TC_888
      fs.writeFileSync(
        path.join(impactDir, 'impact_CR-999.md'),
        [
          '# Báo Cáo Tác Động — CR-999',
          '| REQ ID | Tóm tắt | TC bị ảnh hưởng |',
          '|---|---|---|',
          '| REQ-AUTH-66 | Unknown req in impact | CRM_AUTH_TC_888 |',
        ].join('\n'),
        'utf8'
      );

      const multiErrRes = validateDocsTree(validRoot);
      assert.equal(multiErrRes.valid, false);
      assert.ok(
        multiErrRes.schemaViolations.some((s) => s.file.includes('_book-api/README.md')),
        'validateDocsTree must detect ID range discontinuity in secondary system catalog _book-api/README.md'
      );
      assert.ok(
        multiErrRes.schemaViolations.some((s) => s.file.includes('user-guides/README.md')),
        'validateDocsTree must detect malformed catalog table in docs/user-guides/README.md'
      );
      assert.ok(
        multiErrRes.referentialErrors.some(
          (r) => r.file.includes('user_guide_auth.md') && r.message.includes('REQ-AUTH-88')
        ),
        'validateDocsTree must detect unknown REQ ID inside <!-- Nguồn: ... --> comment in user_guide_<module>.md'
      );
      assert.ok(
        multiErrRes.referentialErrors.some(
          (r) => r.file.includes('impact_CR-999.md') && r.message.includes('REQ-AUTH-66')
        ),
        'validateDocsTree must detect unknown REQ ID in docs/requirements/<module>/impact/impact_*.md'
      );
      assert.ok(
        multiErrRes.referentialErrors.some(
          (r) => r.file.includes('impact_CR-999.md') && r.message.includes('CRM_AUTH_TC_888')
        ),
        'validateDocsTree must detect unknown TC ID in docs/requirements/<module>/impact/impact_*.md'
      );
    } finally {
      fs.rmSync(validRoot, { recursive: true, force: true });
    }
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
});

test('Seam 10: CLI Script Pointer Gate (inline & fenced node scripts/...) and canonical .env.example', () => {
  // 1. Verify resolveContextPointers detects missing CLI script targets in both inline code and fenced bash blocks
  const sampleMarkdown = [
    '# Sample Skill Doc',
    'Run inline: `node scripts/integrations/jira/missing_inline.js --issue PROJ-1`',
    'Reference inline file: `scripts/integrations/jira/missing_file.js` and `.env.example`',
    '```bash',
    'node scripts/browser-mode.mjs status',
    'node scripts/missing_fenced_script.mjs --verify',
    '```',
  ].join('\n');

  const pointerRes = resolveContextPointers(sampleMarkdown, {
    sourceFile: path.join(REPO_ROOT, '.claude', 'skills', 'skills-jira-integration', 'SKILL.md'),
    repoRoot: REPO_ROOT,
  });

  const brokenTargets = pointerRes.brokenPointers.map((b) => b.rawTarget).sort();
  assert.ok(
    brokenTargets.includes('scripts/integrations/jira/missing_inline.js'),
    'resolveContextPointers must detect missing CLI script inside inline code span'
  );
  assert.ok(
    brokenTargets.includes('scripts/integrations/jira/missing_file.js'),
    'resolveContextPointers must detect missing scripts/integrations/*.js inline path'
  );
  assert.ok(
    brokenTargets.includes('scripts/missing_fenced_script.mjs'),
    'resolveContextPointers must detect missing CLI script inside fenced code block'
  );

  // 2. Verify canonical .env.example exists at repo root and documents all required keys
  const envExamplePath = path.join(REPO_ROOT, '.env.example');
  assert.ok(fs.existsSync(envExamplePath), 'Root .env.example must exist');
  const envExampleContent = fs.readFileSync(envExamplePath, 'utf8');
  for (const requiredKey of [
    'BASE_URL',
    'ADMIN_EMAIL',
    'ADMIN_PASSWORD',
    'HEADLESS',
    'VIDEO_MODE',
    'WORKERS',
    'JIRA_BASE_URL',
    'JIRA_EMAIL',
    'JIRA_API_TOKEN',
    'JIRA_PAT',
    'JIRA_PROJECT_KEY',
    'XRAY_PLATFORM',
    'XRAY_CLIENT_ID',
    'XRAY_CLIENT_SECRET',
  ]) {
    assert.match(
      envExampleContent,
      new RegExp(`^#?\\s*${requiredKey}=`, 'm'),
      `.env.example must document ${requiredKey}`
    );
  }
});

test('Seam 11: Zero-Dependency Jira & Xray Integration Suite (utils, jira_fetcher, xray_auth, xray_importer) verified in-process', async () => {
  const utilsMod = await import('./integrations/jira/utils.js');
  const fetcherMod = await import('./integrations/jira/jira_fetcher.js');
  const authMod = await import('./integrations/jira/xray_auth.js');
  const importerMod = await import('./integrations/jira/xray_importer.js');

  // 1. Verify .env parser, CLI arg parser, and Jira Cloud vs Server Auth headers
  const parsedEnv = utilsMod.parseEnvContent(
    [
      '# Comment line',
      'JIRA_BASE_URL="https://acme.atlassian.net/"',
      "export JIRA_EMAIL='qa@acme.com'",
      'JIRA_API_TOKEN=secret_token_123',
    ].join('\n')
  );
  assert.equal(parsedEnv.JIRA_BASE_URL, 'https://acme.atlassian.net/');
  assert.equal(parsedEnv.JIRA_EMAIL, 'qa@acme.com');
  assert.equal(parsedEnv.JIRA_API_TOKEN, 'secret_token_123');

  const cloudAuth = utilsMod.buildJiraAuthHeaders(parsedEnv);
  assert.equal(cloudAuth.baseUrl, 'https://acme.atlassian.net');
  assert.equal(
    cloudAuth.headers.Authorization,
    `Basic ${Buffer.from('qa@acme.com:secret_token_123').toString('base64')}`
  );

  const serverAuth = utilsMod.buildJiraAuthHeaders({
    JIRA_BASE_URL: 'https://jira.internal.corp',
    JIRA_PAT: 'pat_xyz_999',
  });
  assert.equal(serverAuth.headers.Authorization, 'Bearer pat_xyz_999');

  const cliArgs = utilsMod.parseCliArgs([
    '--issue',
    'PROJ-123',
    '--format=md',
    '--verify',
    '--max',
    '20',
  ]);
  assert.equal(cliArgs.issue, 'PROJ-123');
  assert.equal(cliArgs.format, 'md');
  assert.equal(cliArgs.verify, true);
  assert.equal(cliArgs.max, '20');

  // 2. Verify recursive ADF-to-Markdown conversion
  const sampleAdf = {
    type: 'doc',
    version: 1,
    content: [
      {
        type: 'heading',
        attrs: { level: 2 },
        content: [{ type: 'text', text: 'Acceptance Criteria' }],
      },
      {
        type: 'paragraph',
        content: [
          { type: 'text', text: 'User must login with ' },
          { type: 'text', text: 'valid email', marks: [{ type: 'strong' }] },
          { type: 'text', text: ' and ' },
          { type: 'text', text: 'OTP', marks: [{ type: 'code' }] },
          {
            type: 'text',
            text: ' spec link',
            marks: [{ type: 'link', attrs: { href: 'https://example.com/spec' } }],
          },
        ],
      },
      {
        type: 'bulletList',
        content: [
          {
            type: 'listItem',
            content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Lock after 5 failures' }] }],
          },
          {
            type: 'listItem',
            content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Audit log recorded' }] }],
          },
        ],
      },
      {
        type: 'table',
        content: [
          {
            type: 'tableRow',
            content: [
              { type: 'tableHeader', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Field' }] }] },
              { type: 'tableHeader', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Rule' }] }] },
            ],
          },
          {
            type: 'tableRow',
            content: [
              { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Email' }] }] },
              { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Required' }] }] },
            ],
          },
        ],
      },
    ],
  };

  const mdFromAdf = utilsMod.adfToMarkdown(sampleAdf);
  assert.match(mdFromAdf, /## Acceptance Criteria/);
  assert.match(mdFromAdf, /\*\*valid email\*\*/);
  assert.match(mdFromAdf, /`OTP`/);
  assert.match(mdFromAdf, /\[spec link\]\(https:\/\/example\.com\/spec\)/);
  assert.match(mdFromAdf, /- Lock after 5 failures/);
  assert.match(mdFromAdf, /\| Field \| Rule \|/);

  // 3. Verify Jira Fetcher with mock fetchImpl (single issue + JQL pagination + file output)
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jira-suite-test-'));
  try {
    const mockFetch = async (url, init = {}) => {
      const u = String(url);
      if (u.includes('/rest/api/3/issue/PROJ-123')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            key: 'PROJ-123',
            fields: {
              summary: 'Login MFA Enforcement',
              issuetype: { name: 'Story' },
              status: { name: 'In Progress' },
              priority: { name: 'High' },
              assignee: { displayName: 'QA Lead' },
              labels: ['security', 'auth'],
              parent: { key: 'PROJ-10' },
              description: sampleAdf,
              comment: {
                comments: [
                  {
                    author: { displayName: 'PM' },
                    created: '2026-10-01T10:00:00.000Z',
                    body: 'Confirmed timeout is 15 minutes.',
                  },
                ],
              },
            },
          }),
        };
      }
      if (u.includes('/rest/api/3/search')) {
        const parsedUrl = new URL(u);
        const startAt = Number(parsedUrl.searchParams.get('startAt') || 0);
        const allIssues = [
          { key: 'PROJ-101', fields: { summary: 'Story 1', issuetype: { name: 'Story' }, status: { name: 'To Do' }, description: 'Desc 1' } },
          { key: 'PROJ-102', fields: { summary: 'Story 2', issuetype: { name: 'Story' }, status: { name: 'Done' }, description: 'Desc 2' } },
        ];
        const slice = allIssues.slice(startAt, startAt + 1);
        return {
          ok: true,
          status: 200,
          json: async () => ({
            startAt,
            maxResults: 1,
            total: 2,
            issues: slice,
          }),
        };
      }
      if (u.includes('/rest/api/2/myself')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ name: 'qa_server_user' }),
        };
      }
      if (u.includes('xray.cloud.getxray.app/api/v2/authenticate')) {
        return {
          ok: true,
          status: 200,
          text: async () => '"xray_jwt_token_abc"',
          json: async () => 'xray_jwt_token_abc',
        };
      }
      if (u.includes('xray.cloud.getxray.app/api/v2/import/execution')) {
        const postedBody = JSON.parse(init.body);
        assert.equal(postedBody.testExecutionKey, 'PROJ-900');
        assert.equal(postedBody.tests.length, 3);
        return {
          ok: true,
          status: 200,
          json: async () => ({ key: 'PROJ-900', id: '10099' }),
        };
      }
      throw new Error(`Unexpected URL in mockFetch: ${u}`);
    };

    assert.equal(
      fetcherMod.buildJqlFromOptions({ issue: 'PROJ-123' }),
      'key = "PROJ-123"',
      'buildJqlFromOptions must support { issue } option'
    );

    const singleRes = await fetcherMod.fetchJiraIssues({
      issue: 'PROJ-123',
      format: 'md',
      outputDir: tmpDir,
      env: parsedEnv,
      fetchImpl: mockFetch,
    });
    assert.equal(singleRes.issues.length, 1);
    assert.equal(singleRes.issues[0].key, 'PROJ-123');
    assert.match(singleRes.markdown, /# \[PROJ-123\] Login MFA Enforcement/);
    assert.match(singleRes.markdown, /Confirmed timeout is 15 minutes/);
    assert.ok(fs.existsSync(singleRes.outputPath), 'jira_fetcher must write Markdown output file');

    const epicRes = await fetcherMod.fetchJiraIssues({
      epic: 'PROJ-10',
      maxResults: 5,
      pageSize: 1,
      env: parsedEnv,
      fetchImpl: mockFetch,
    });
    assert.equal(epicRes.issues.length, 2, 'fetchAllJiraPages must paginate across startAt=0 and startAt=1');

    // 4. Verify Xray Cloud & Server/DC Auth
    const xrayAuthRes = await authMod.authenticateXray({
      env: {
        ...parsedEnv,
        XRAY_PLATFORM: 'cloud',
        XRAY_CLIENT_ID: 'cid_1',
        XRAY_CLIENT_SECRET: 'csec_1',
      },
      fetchImpl: mockFetch,
    });
    assert.equal(xrayAuthRes.platform, 'cloud');
    assert.equal(xrayAuthRes.token, 'xray_jwt_token_abc');
    assert.equal(xrayAuthRes.headers.Authorization, 'Bearer xray_jwt_token_abc');

    const xrayServerAuthRes = await authMod.authenticateXray({
      env: {
        JIRA_BASE_URL: 'https://jira.internal.corp',
        JIRA_PAT: 'pat_xyz_999',
        XRAY_PLATFORM: 'server',
      },
      fetchImpl: mockFetch,
    });
    assert.equal(xrayServerAuthRes.platform, 'server');
    assert.equal(xrayServerAuthRes.baseUrl, 'https://jira.internal.corp/rest/raven/2.0/api');
    assert.equal(xrayServerAuthRes.headers.Authorization, 'Bearer pat_xyz_999');

    // 5. Verify Playwright JSON -> Xray and JUnit XML -> Xray conversions + importToXray
    const pwReportPath = path.join(tmpDir, 'pw-results.json');
    const samplePwReport = {
      suites: [
        {
          title: 'login.spec.ts',
          specs: [
            {
              title: '[PROJ-201] Valid login redirects to dashboard',
              tests: [{ results: [{ status: 'passed', duration: 1250 }] }],
            },
            {
              title: '[PROJ-202] Invalid password shows error banner',
              tests: [
                {
                  results: [
                    {
                      status: 'failed',
                      duration: 2100,
                      error: { message: 'Expected error alert to be visible' },
                    },
                  ],
                },
              ],
            },
            {
              title: '[PROJ-203] Remember me token persistence',
              tests: [{ results: [{ status: 'skipped', duration: 0 }] }],
            },
            {
              title: 'Unmapped helper smoke test without Jira key',
              tests: [{ results: [{ status: 'passed', duration: 300 }] }],
            },
          ],
        },
      ],
    };
    fs.writeFileSync(pwReportPath, JSON.stringify(samplePwReport, null, 2), 'utf8');

    const importRes = await importerMod.importToXray({
      format: 'playwright',
      filePath: pwReportPath,
      projectKey: 'PROJ',
      testExecKey: 'PROJ-900',
      env: {
        ...parsedEnv,
        XRAY_PLATFORM: 'cloud',
        XRAY_CLIENT_ID: 'cid_1',
        XRAY_CLIENT_SECRET: 'csec_1',
      },
      fetchImpl: mockFetch,
    });
    assert.equal(importRes.testExecKey, 'PROJ-900');
    assert.equal(importRes.stats.total, 3);
    assert.equal(importRes.stats.passed, 1);
    assert.equal(importRes.stats.failed, 1);
    assert.equal(importRes.stats.todo, 1);
    assert.equal(importRes.unmappedTests.length, 1);

    const sampleJunitXml = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<testsuites>',
      '  <testsuite name="LoginSuite" tests="3" failures="1" skipped="1">',
      '    <testcase classname="auth.LoginTest" name="[PROJ-301] Login success" time="1.2"/>',
      '    <testcase classname="auth.LoginTest" name="[PROJ-302] Login locked" time="0.8">',
      '      <failure message="Expected HTTP 423">AssertionError at line 42</failure>',
      '    </testcase>',
      '    <testcase classname="auth.LoginTest" name="[PROJ-303] Login SSO" time="0.0">',
      '      <skipped/>',
      '    </testcase>',
      '  </testsuite>',
      '</testsuites>',
    ].join('\n');

    const junitConverted = importerMod.convertJunitXmlToXray(sampleJunitXml, {
      projectKey: 'PROJ',
      platform: 'server',
    });
    assert.equal(junitConverted.payload.tests.length, 3);
    assert.deepEqual(
      junitConverted.payload.tests.map((t) => `${t.testKey}:${t.status}`),
      ['PROJ-301:PASS', 'PROJ-302:FAIL', 'PROJ-303:TODO']
    );

    // 6. Verify markdownToAdf() and jira_bug_creator.js (Cloud v3 ADF, Server v2, attachment upload, local Jira Key write-back)
    const bugCreatorMod = await import('./integrations/jira/jira_bug_creator.js');
    assert.equal(typeof utilsMod.markdownToAdf, 'function', 'utils.js must export markdownToAdf');
    const convertedAdf = utilsMod.markdownToAdf(
      [
        '## Steps to Reproduce',
        '1. Open **Login** page with `admin`',
        '- Verify error banner',
      ].join('\n')
    );
    assert.equal(convertedAdf.type, 'doc');
    assert.equal(convertedAdf.version, 1);
    assert.ok(
      convertedAdf.content.some((n) => n.type === 'heading'),
      'markdownToAdf must convert ## headings'
    );
    assert.ok(
      convertedAdf.content.some((n) => n.type === 'orderedList'),
      'markdownToAdf must convert numbered lists'
    );
    assert.ok(
      convertedAdf.content.some((n) => n.type === 'bulletList'),
      'markdownToAdf must convert bullet lists'
    );

    const evidenceDir = path.join(tmpDir, 'docs', 'executions', 'login', 'run_1', 'evidence');
    const bugDir = path.join(tmpDir, 'docs', 'bugs', 'login');
    fs.mkdirSync(evidenceDir, { recursive: true });
    fs.mkdirSync(bugDir, { recursive: true });
    const imgPath = path.join(evidenceDir, 'CRM_LOGIN_TC_016_step3_fail.png');
    fs.writeFileSync(imgPath, Buffer.from([0x89, 0x50, 0x4e, 0x47]));

    const bugFilePath = path.join(bugDir, 'BUG_login_1787226514_TC016.md');
    const bugsReadmePath = path.join(tmpDir, 'docs', 'bugs', 'README.md');
    fs.writeFileSync(
      bugsReadmePath,
      [
        '# Danh mục Bug',
        '| Mã bug | Module | Tiêu đề ngắn | Severity | Priority | Trạng thái | TC liên quan | Ngày phát hiện |',
        '|---|---|---|---|---|---|---|---|',
        '| [BUG_login_1787226514_TC016](login/BUG_login_1787226514_TC016.md) | login | Email cleared after failed login | 🟠 Major | P2 | 🆕 Đang mở | CRM_LOGIN_TC_016 | 2026-08-20 |',
      ].join('\n'),
      'utf8'
    );
    const sampleBugMd = [
      '# [BUG] Email cleared after failed login',
      '',
      '## Thông tin chung',
      '- **ID:** BUG_login_1787226514_TC016',
      '- **Severity:** 🟠 Major',
      '- **Priority:** P2',
      '- **Môi trường:** Staging · Chrome Headless 1920x1080',
      '- **Build / Version:** v2.3.4',
      '- **Test case liên quan:** CRM_LOGIN_TC_016',
      '- **REQ ID liên quan:** REQ-LOGIN-16',
      '- **Ngày phát hiện:** 2026-08-20',
      '- **Trạng thái:** 🆕 Open',
      '',
      '## Steps to Reproduce',
      '1. Navigate to `/admin/authentication`',
      '2. Submit invalid password',
      '',
      '## Expected Result',
      'Email input retains entered value',
      '',
      '## Actual Result',
      'Email input is cleared',
      '',
      '## Evidence',
      '- **Screenshot:** [CRM_LOGIN_TC_016_step3_fail.png](../../executions/login/run_1/evidence/CRM_LOGIN_TC_016_step3_fail.png)',
      '- **Duplicate ref:** ![dup](../../executions/login/run_1/evidence/CRM_LOGIN_TC_016_step3_fail.png)',
      '- **Missing ref:** [missing.png](../../executions/login/run_1/evidence/missing.png)',
      '- **Remote ref:** [remote.png](https://example.com/remote.png)',
    ].join('\n');
    fs.writeFileSync(bugFilePath, sampleBugMd, 'utf8');

    const extractedEvidence = bugCreatorMod.extractEvidencePaths(sampleBugMd, bugFilePath);
    assert.equal(extractedEvidence.length, 1, 'extractEvidencePaths must deduplicate identical resolved paths and ignore missing/remote links');
    assert.equal(extractedEvidence[0], imgPath);

    const parsedSampleBug = bugCreatorMod.parseBugMarkdown(sampleBugMd, 'BUG_login_1787226514_TC016.md');
    const extractedFromParsed = bugCreatorMod.extractEvidencePaths(parsedSampleBug, bugFilePath);
    assert.equal(extractedFromParsed.length, 1);
    assert.equal(extractedFromParsed[0], imgPath);

    const twoArgPayload = bugCreatorMod.buildJiraBugPayload(parsedSampleBug, {
      projectKey: 'PROJ',
      apiVersion: '2',
      severityField: 'customfield_10042',
    });
    assert.equal(twoArgPayload.fields.project.key, 'PROJ');
    assert.match(twoArgPayload.fields.description, /## Evidence/);
    assert.deepEqual(twoArgPayload.fields.customfield_10042, { value: 'Major' });

    // Verify buildJiraBugPayload strips parenthetical historical mistakes (e.g. BUG_login_1785678750_TC039.md)
    const realTc039BugMd = fs.readFileSync(
      path.join(REPO_ROOT, 'docs', 'bugs', 'login', 'BUG_login_1785678750_TC039.md'),
      'utf8'
    );
    const parsedTc039Bug = bugCreatorMod.parseBugMarkdown(
      realTc039BugMd,
      'BUG_login_1785678750_TC039.md'
    );
    assert.equal(parsedTc039Bug.tc, 'CRM_LOGIN_TC_039');
    assert.equal(parsedTc039Bug.req, 'REQ-LOGIN-01');
    const tc039Payload = bugCreatorMod.buildJiraBugPayload(parsedTc039Bug, {
      projectKey: 'PROJ',
      apiVersion: '3',
    });
    assert.ok(tc039Payload.fields.labels.includes('CRM_LOGIN_TC_039'));
    assert.ok(tc039Payload.fields.labels.includes('REQ-LOGIN-01'));
    assert.ok(
      !tc039Payload.fields.labels.includes('CRM_LOGIN_TC_004'),
      'buildJiraBugPayload must not attach historical mistake CRM_LOGIN_TC_004 from parenthetical note as a Jira label'
    );
    assert.ok(
      !tc039Payload.fields.labels.includes('REQ-LOGIN-24'),
      'buildJiraBugPayload must not attach historical mistake REQ-LOGIN-24 from parenthetical note as a Jira label'
    );

    let attachmentUploaded = false;
    const bugMockFetch = async (url, init = {}) => {
      const u = String(url);
      if (u.includes('/rest/api/3/issue') && !u.includes('/attachments')) {
        const body = JSON.parse(init.body);
        assert.equal(body.fields.project.key, 'PROJ');
        assert.equal(body.fields.issuetype.name, 'Bug');
        assert.equal(body.fields.description.type, 'doc');
        assert.deepEqual(body.fields.customfield_10042, { value: 'Major' });
        assert.ok(body.fields.labels.includes('CRM_LOGIN_TC_016'));
        assert.ok(body.fields.labels.includes('REQ-LOGIN-16'));
        return {
          ok: true,
          status: 201,
          json: async () => ({ id: '10500', key: 'PROJ-555' }),
        };
      }
      if (u.includes('/rest/api/3/issue/PROJ-555/attachments')) {
        assert.equal(init.headers['X-Atlassian-Token'], 'no-check');
        attachmentUploaded = true;
        return {
          ok: true,
          status: 200,
          json: async () => [{ id: '9001', filename: 'CRM_LOGIN_TC_016_step3_fail.png' }],
        };
      }
      if (u.includes('/rest/api/2/issue')) {
        const body = JSON.parse(init.body);
        assert.equal(typeof body.fields.description, 'string');
        return {
          ok: true,
          status: 201,
          json: async () => ({ id: '10501', key: 'PROJ-556' }),
        };
      }
      throw new Error(`Unexpected URL in bugMockFetch: ${u}`);
    };

    const createdCloud = await bugCreatorMod.pushBugToJira({
      filePath: bugFilePath,
      projectKey: 'PROJ',
      attach: true,
      update: true,
      env: { ...parsedEnv, JIRA_SEVERITY_FIELD: 'customfield_10042' },
      fetchImpl: bugMockFetch,
    });
    assert.equal(createdCloud.issueKey, 'PROJ-555');
    assert.equal(createdCloud.key, 'PROJ-555');
    assert.equal(attachmentUploaded, true, 'pushBugToJira must upload existing evidence attachments when attach=true');
    const updatedBugMd = fs.readFileSync(bugFilePath, 'utf8');
    assert.match(updatedBugMd, /- \*\*Jira Issue:\*\* PROJ-555/, 'pushBugToJira must write back - **Jira Issue:** PROJ-555 when update=true');

    const updatedReadmeMd = fs.readFileSync(bugsReadmePath, 'utf8');
    assert.match(updatedReadmeMd, /PROJ-555/, 'pushBugToJira must write back Jira Issue Key to docs/bugs/README.md');
    const updatedReadmeTables = parseMarkdownTables(updatedReadmeMd);
    assert.equal(
      updatedReadmeTables[0].rows[0].length,
      8,
      'docs/bugs/README.md table row must remain strictly 8 columns after Jira Key write-back'
    );
    const parsedUpdatedCatalog = parseBugIndex(updatedReadmeMd, 'README.md');
    assert.equal(parsedUpdatedCatalog.rows.length, 1);
    assert.match(parsedUpdatedCatalog.rows[0].statusRaw, /PROJ-555/);

    const createdServer = await bugCreatorMod.pushBugToJira({
      filePath: bugFilePath,
      projectKey: 'PROJ',
      attach: false,
      update: false,
      env: {
        JIRA_BASE_URL: 'https://jira.internal.corp',
        JIRA_PAT: 'pat_xyz_999',
      },
      fetchImpl: bugMockFetch,
    });
    assert.equal(createdServer.issueKey, 'PROJ-556');

    // Also verify pushBugToJira positional signature against an in-process http.createServer mock HTTP server
    const bugFilePathHttp = path.join(bugDir, 'BUG_login_1787226515_TC017.md');
    fs.writeFileSync(
      bugFilePathHttp,
      sampleBugMd.replace('BUG_login_1787226514_TC016', 'BUG_login_1787226515_TC017'),
      'utf8'
    );
    let httpServerAttachmentHeader = '';
    const mockHttpServer = http.createServer((req, res) => {
      const chunks = [];
      req.on('data', (c) => chunks.push(c));
      req.on('end', () => {
        res.setHeader('Content-Type', 'application/json');
        if (req.method === 'POST' && req.url === '/rest/api/2/issue') {
          res.statusCode = 201;
          res.end(JSON.stringify({ id: '10777', key: 'PROJ-777' }));
          return;
        }
        if (req.method === 'POST' && req.url === '/rest/api/2/issue/PROJ-777/attachments') {
          httpServerAttachmentHeader = String(req.headers['x-atlassian-token'] || '');
          res.statusCode = 200;
          res.end(JSON.stringify([{ id: '9002', filename: 'CRM_LOGIN_TC_016_step3_fail.png' }]));
          return;
        }
        res.statusCode = 404;
        res.end(JSON.stringify({ error: 'Not Found' }));
      });
    });
    await new Promise((resolve) => mockHttpServer.listen(0, '127.0.0.1', resolve));
    try {
      const addr = mockHttpServer.address();
      const baseUrl = `http://127.0.0.1:${addr.port}`;
      const httpRes = await bugCreatorMod.pushBugToJira(bugFilePathHttp, 'PROJ', true, {
        env: {
          JIRA_BASE_URL: baseUrl,
          JIRA_PAT: 'pat_http_test',
          JIRA_SEVERITY_FIELD: 'customfield_10042',
        },
      });
      assert.equal(httpRes.issueKey, 'PROJ-777');
      assert.equal(httpRes.attachments.length, 1);
      assert.equal(httpServerAttachmentHeader, 'no-check');
      assert.match(fs.readFileSync(bugFilePathHttp, 'utf8'), /- \*\*Jira Issue:\*\* PROJ-777/);
    } finally {
      await new Promise((resolve) => mockHttpServer.close(resolve));
    }
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('Seam 12: Layer 3 Automation Script Traceability Scanner & --out in scripts/validate-docs.mjs', () => {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'rtm-layer3-test-'));
  try {
    const reqDir = path.join(tmpRoot, 'docs', 'requirements', 'auth');
    const tcDir = path.join(tmpRoot, 'docs', 'testcases', 'auth');
    const testsDir = path.join(tmpRoot, 'tests', 'auth');
    fs.mkdirSync(reqDir, { recursive: true });
    fs.mkdirSync(tcDir, { recursive: true });
    fs.mkdirSync(testsDir, { recursive: true });

    fs.writeFileSync(
      path.join(reqDir, 'requirements_auth.md'),
      [
        '# Requirements Auth',
        '| REQ ID | Tên yêu cầu | Mô tả | Acceptance Criteria | Trạng thái | Cập nhật lần cuối | Nguồn |',
        '|---|---|---|---|---|---|---|',
        '| REQ-AUTH-01 | Valid Login | Desc | AC | 🟢 | — | DOM |',
        '| REQ-AUTH-02 | Lockout Policy | Desc | AC | 🟢 | — | DOM |',
        '| REQ-AUTH-03 | Remember Me | Desc | AC | 🟢 | — | DOM |',
        '| REQ-AUTH-04 | SSO Login | Desc | AC | 🟢 | — | DOM |',
        '| REQ-AUTH-05 | Legacy LDAP | Desc | AC | ⚪ Out of scope | — | DOM |',
      ].join('\n'),
      'utf8'
    );

    fs.writeFileSync(
      path.join(tcDir, 'test_cases_auth.md'),
      [
        '# Test Cases Auth',
        '| TC ID | REQ ID | Module | Risk Level | Test Scenario | Pre-Condition | Test Steps | Test Data | Expected Result | Priority | Automatable | Auto Type | Tags |',
        '|---|---|---|---|---|---|---|---|---|---|---|---|---|',
        '| CRM_AUTH_TC_001 | REQ-AUTH-01 | AUTH | High | Valid admin login | None | 1. Go | None | 1. Ok | High | Yes | UI | @Smoke |',
        '| CRM_AUTH_TC_002 | REQ-AUTH-01 | AUTH | High | Valid staff login | None | 1. Go | None | 1. Ok | High | Yes | UI | @Smoke |',
        '| CRM_AUTH_TC_003 | REQ-AUTH-02 | AUTH | High | Lock after 5 tries | None | 1. Go | None | 1. Ok | Critical | Yes | UI | @Security |',
        '| CRM_AUTH_TC_004 | REQ-AUTH-02 | AUTH | Medium | Unlock after 15m | None | 1. Go | None | 1. Ok | Medium | Yes | UI | @Security |',
        '| CRM_AUTH_TC_005 | REQ-AUTH-03 | AUTH | Low | Remember me cookie | None | 1. Go | None | 1. Ok | Low | Yes | UI | @Regression |',
      ].join('\n'),
      'utf8'
    );

    fs.writeFileSync(
      path.join(testsDir, 'login.spec.ts'),
      [
        "import { test } from '@playwright/test';",
        "test('[CRM_AUTH_TC_001] Valid admin login', async () => {});",
        "test('[CRM_AUTH_TC_002] Valid staff login', async () => {});",
        "test('[CRM_AUTH_TC_003] Lock after 5 tries', async () => {});",
        "test('[CRM_AUTH_TC_999] Orphan automation test', async () => {});",
      ].join('\n'),
      'utf8'
    );

    fs.writeFileSync(
      path.join(tmpRoot, 'docs', 'requirements', 'README.md'),
      [
        '# Danh mục Requirements',
        '## 1. Bảng danh mục module',
        '| Module | Prefix | Trạng thái recon | Mức phủ tài liệu | Tài liệu | REQ đã dùng | Mã kế tiếp | AMB treo | Cập nhật |',
        '|---|---|---|---|---|---|---|---|---|',
        '| Xác thực | `AUTH` | ✅ Đã có tài liệu | 🟩 Đầy đủ | [auth/requirements_auth.md](auth/requirements_auth.md) | `REQ-AUTH-01` → `REQ-AUTH-05` | `REQ-AUTH-06` | — | 2026-08-14 |',
        '| Thanh toán | `BILL` | ⬜ Chưa khảo sát | ⬜ Trắng | — | — | `REQ-BILL-01` | — | 2026-08-14 |',
      ].join('\n'),
      'utf8'
    );

    const rtm = computeTraceabilityReport(tmpRoot);
    const rowByReq = new Map(rtm.rows.map((r) => [r.reqId, r]));

    assert.equal(rowByReq.get('REQ-AUTH-01').status, '✅ Full');
    assert.equal(rowByReq.get('REQ-AUTH-01').automation, 'login.spec.ts');

    assert.equal(rowByReq.get('REQ-AUTH-02').status, '🟣 Partial');
    assert.equal(rowByReq.get('REQ-AUTH-02').automation, 'login.spec.ts (1/2)');

    assert.equal(rowByReq.get('REQ-AUTH-03').status, '🟡 Manual only');
    assert.equal(rowByReq.get('REQ-AUTH-03').automation, '—');

    assert.equal(rowByReq.get('REQ-AUTH-04').status, '🔴 Uncovered');
    assert.equal(rowByReq.get('REQ-AUTH-05').status, '⚪ Out of scope');

    assert.equal(rtm.summary.automatedTcs, 3);
    assert.deepEqual(
      rtm.unautomatedTcs.map((t) => t.id),
      ['CRM_AUTH_TC_004', 'CRM_AUTH_TC_005'],
      'unautomatedTcs must list only Automatable=Yes TCs not yet automated'
    );
    assert.deepEqual(
      rtm.orphanScripts.map((o) => o.tcId),
      ['CRM_AUTH_TC_999'],
      'orphanScripts must detect TC IDs in automation scripts that do not exist in test_cases_*.md'
    );
    assert.ok(
      rtm.undocumentedModules && rtm.undocumentedModules.length >= 1,
      'computeTraceabilityReport must collect undocumented modules from Module Catalog'
    );
    assert.match(rtm.markdown, /## 🔴 Requirements chưa được cover/);
    assert.match(rtm.markdown, /## ⬛ Module chưa có tài liệu/);

    // Verify execution-viewer parseExecutionReport / parseRtm compatibility across all 6 RTM sections
    const parsedForViewer = parseExecutionReport(rtm.markdown, 'traceability_matrix.md');
    assert.equal(parsedForViewer.kind, 'rtm');
    const viewerRowByReq = new Map(parsedForViewer.rtm.rows.map((r) => [r.req, r]));
    assert.equal(viewerRowByReq.get('REQ-AUTH-01').status, 'FULL');
    assert.equal(viewerRowByReq.get('REQ-AUTH-02').status, 'PARTIALCOV');
    assert.equal(viewerRowByReq.get('REQ-AUTH-03').status, 'MANUAL');
    assert.equal(viewerRowByReq.get('REQ-AUTH-04').status, 'NOTCOVERED');
    assert.equal(
      viewerRowByReq.get('REQ-AUTH-05').status,
      'OUTOFSCOPE',
      'parseRtm must classify ⚪ Out of scope rows as OUTOFSCOPE instead of NOTCOVERED'
    );
    assert.ok(
      viewerRowByReq.get('REQ-AUTH-04').suggest && viewerRowByReq.get('REQ-AUTH-04').suggest.length > 0,
      'parseRtm must populate suggest for uncovered REQ from ## 🔴 Requirements chưa được cover'
    );
    assert.deepEqual(
      parsedForViewer.rtm.notAuto.map((t) => t.id),
      ['CRM_AUTH_TC_004', 'CRM_AUTH_TC_005'],
      'parseRtm must parse unautomatedTcs table from report.markdown'
    );
    assert.deepEqual(
      parsedForViewer.rtm.orphans.map((o) => o.test),
      ['CRM_AUTH_TC_999'],
      'parseRtm must parse orphanScripts table from report.markdown'
    );
    assert.ok(
      parsedForViewer.rtm.undocumented.length >= 1,
      'parseRtm must parse undocumented modules table from ## ⬛ Module chưa có tài liệu'
    );

    // Verify CLI --out and --module=<slug> / --root=<dir> equals-syntax flags write traceability_matrix.md
    const outFile = path.join(tmpRoot, 'docs', 'traceability_matrix.md');
    execFileSync(
      process.execPath,
      [
        path.join(REPO_ROOT, 'scripts', 'validate-docs.mjs'),
        '--rtm',
        `--root=${tmpRoot}`,
        '--module=auth',
        `--out=${outFile}`,
      ],
      { encoding: 'utf8' }
    );
    assert.ok(fs.existsSync(outFile), 'validate-docs.mjs --rtm --out must write output file');
    assert.match(fs.readFileSync(outFile, 'utf8'), /login\.spec\.ts \(1\/2\)/);
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
});

test('Seam 13: Deterministic ISO/IEC/IEEE 29119-3 Test Completion Summary & 7 Exit Criteria Engine (--summary)', () => {
  assert.equal(typeof computeTestSummaryReport, 'function', 'validate-docs.mjs must export computeTestSummaryReport');

  // 1. Evaluate real repository docs/ summary (has 1 Critical open bug BUG_login_1785678750_TC039 -> NO_GO)
  const realSummary = computeTestSummaryReport(REPO_ROOT, { module: 'login', milestone: 'Sprint 12' });
  assert.equal(realSummary.verdict, 'NO_GO', 'login module has an open Critical bug and must evaluate to NO_GO');
  assert.equal(realSummary.exitCriteria.length, 7, 'Must evaluate all 7 default Exit Criteria');
  assert.equal(realSummary.defects.openCritical, 1);
  assert.equal(realSummary.defects.totalOpen, 6);
  assert.equal(realSummary.execution.pass, 32);
  assert.equal(realSummary.execution.fail, 6);
  assert.equal(realSummary.execution.blocked, 2);
  assert.equal(realSummary.execution.skipped, 1);
  assert.equal(realSummary.execution.dirty, 0);
  assert.equal(realSummary.execution.passRate, 80, 'Pass rate excluding SKIPPED must be 32/40 = 80%');
  assert.match(realSummary.markdown, /ISO\/IEC\/IEEE 29119-3/);
  assert.match(realSummary.markdown, /🔴 NO-GO/);
  assert.match(realSummary.markdown, /## 2\. Vùng CHƯA Được Kiểm Thử & Nợ Kiểm Thử/);
  assert.match(realSummary.markdown, /## 3\. Đối Chiếu Tiêu Chí Exit/);
  assert.match(realSummary.markdown, /### Danh sách Bug đang mở/);

  // 2. Evaluate synthetic green project (all 7 Exit Criteria met -> GO, with run_90 FAIL and run_100 PASS to verify numerical run sorting) and CLI --summary --out
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'summary-go-test-'));
  try {
    const reqDir = path.join(tmpRoot, 'docs', 'requirements', 'auth');
    const tcDir = path.join(tmpRoot, 'docs', 'testcases', 'auth');
    const execOldDir = path.join(tmpRoot, 'docs', 'executions', 'auth', 'run_90');
    const execDir = path.join(tmpRoot, 'docs', 'executions', 'auth', 'run_100');
    fs.mkdirSync(reqDir, { recursive: true });
    fs.mkdirSync(tcDir, { recursive: true });
    fs.mkdirSync(execOldDir, { recursive: true });
    fs.mkdirSync(execDir, { recursive: true });

    fs.writeFileSync(
      path.join(reqDir, 'requirements_auth.md'),
      [
        '# Requirements Auth',
        '| REQ ID | Tên yêu cầu | Mô tả | Acceptance Criteria | Trạng thái | Cập nhật lần cuối | Nguồn |',
        '|---|---|---|---|---|---|---|',
        '| REQ-AUTH-01 | Valid Login | Desc | AC | 🟢 | — | DOM |',
      ].join('\n'),
      'utf8'
    );

    fs.writeFileSync(
      path.join(tcDir, 'test_cases_auth.md'),
      [
        '# Test Cases Auth',
        '| TC ID | REQ ID | Module | Risk Level | Test Scenario | Pre-Condition | Test Steps | Test Data | Expected Result | Priority | Automatable | Auto Type | Tags |',
        '|---|---|---|---|---|---|---|---|---|---|---|---|---|',
        '| CRM_AUTH_TC_001 | REQ-AUTH-01 | AUTH | High | Valid Login | None | 1. Go | None | 1. Ok | High | Yes | UI | @Smoke |',
      ].join('\n'),
      'utf8'
    );

    fs.writeFileSync(
      path.join(execOldDir, 'execution_report.md'),
      [
        '# Execution Report — Auth',
        '| Thông tin | Nội dung |',
        '|---|---|',
        '| Run ID | run_90 |',
        '## 2. Kết quả từng TC',
        '| TC ID | Test Scenario | Kết quả | Bước fail | Ghi chú |',
        '|---|---|---|---|---|',
        '| CRM_AUTH_TC_001 | Valid Login | ❌ FAIL | 1 | Old failure |',
      ].join('\n'),
      'utf8'
    );

    fs.writeFileSync(
      path.join(execDir, 'execution_report.md'),
      [
        '# Execution Report — Auth',
        '| Thông tin | Nội dung |',
        '|---|---|',
        '| Run ID | run_100 |',
        '## 2. Kết quả từng TC',
        '| TC ID | Test Scenario | Kết quả | Bước fail | Ghi chú |',
        '|---|---|---|---|---|',
        '| CRM_AUTH_TC_001 | Valid Login | ✅ PASS | — | — |',
      ].join('\n'),
      'utf8'
    );

    const goSummary = computeTestSummaryReport(tmpRoot, { milestone: 'Release v1.0' });
    assert.equal(goSummary.verdict, 'GO', 'Numerical run sort must pick run_100 over run_90');
    assert.equal(goSummary.passedCriteriaCount, 7);
    assert.match(goSummary.markdown, /🟢 GO — Đạt 7\/7 tiêu chí exit/);

    const outSummaryFile = path.join(tmpRoot, 'docs', 'test_summary_report.md');
    execFileSync(
      process.execPath,
      [
        path.join(REPO_ROOT, 'scripts', 'validate-docs.mjs'),
        '--summary',
        `--root=${tmpRoot}`,
        `--out=${outSummaryFile}`,
      ],
      { encoding: 'utf8' }
    );
    assert.ok(fs.existsSync(outSummaryFile), 'validate-docs.mjs --summary --out must write summary report file');
    assert.match(fs.readFileSync(outSummaryFile, 'utf8'), /🟢 GO — Đạt 7\/7 tiêu chí exit/);
    assert.equal(realSummary.execution.unexecuted, 9, 'login module has 50 designed TCs and 41 executed TCs -> 9 unexecuted TCs');
    assert.match(realSummary.markdown, /9 chưa chạy/, 'Section 2 debt status must surface 9 unexecuted TCs for login');
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }

  // 3. Verify Chronological Execution Overlay (run_100 FAIL -> retest_110 FIXED) and unexecuted High-Priority TC denominator in Exit Criterion #3
  const overlayRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'summary-retest-overlay-'));
  try {
    const reqDir = path.join(overlayRoot, 'docs', 'requirements', 'auth');
    const tcDir = path.join(overlayRoot, 'docs', 'testcases', 'auth');
    const runDir = path.join(overlayRoot, 'docs', 'executions', 'auth', 'run_100');
    const retestDir = path.join(overlayRoot, 'docs', 'executions', 'auth', 'retest_110');
    fs.mkdirSync(reqDir, { recursive: true });
    fs.mkdirSync(tcDir, { recursive: true });
    fs.mkdirSync(runDir, { recursive: true });
    fs.mkdirSync(retestDir, { recursive: true });

    fs.writeFileSync(
      path.join(reqDir, 'requirements_auth.md'),
      [
        '# Requirements Auth',
        '| REQ ID | Tên yêu cầu | Mô tả | Acceptance Criteria | Trạng thái | Cập nhật lần cuối | Nguồn |',
        '|---|---|---|---|---|---|---|',
        '| REQ-AUTH-01 | Valid Login | Desc | AC | 🟢 | — | DOM |',
      ].join('\n'),
      'utf8'
    );

    fs.writeFileSync(
      path.join(tcDir, 'test_cases_auth.md'),
      [
        '# Test Cases Auth',
        '| TC ID | REQ ID | Module | Risk Level | Test Scenario | Pre-Condition | Test Steps | Test Data | Expected Result | Priority | Automatable | Auto Type | Tags |',
        '|---|---|---|---|---|---|---|---|---|---|---|---|---|',
        '| CRM_AUTH_TC_001 | REQ-AUTH-01 | AUTH | High | Valid Login | None | 1. Go | None | 1. Ok | High | Yes | UI | @Smoke |',
        '| CRM_AUTH_TC_002 | REQ-AUTH-01 | AUTH | High | Unexecuted High TC | None | 1. Go | None | 1. Ok | High | Yes | UI | @Smoke |',
      ].join('\n'),
      'utf8'
    );

    fs.writeFileSync(
      path.join(runDir, 'execution_report.md'),
      [
        '# Execution Report — Auth',
        '| Thông tin | Nội dung |',
        '|---|---|',
        '| Run ID | run_100 |',
        '## 2. Kết quả từng TC',
        '| TC ID | Test Scenario | Kết quả | Bước fail | Ghi chú |',
        '|---|---|---|---|---|',
        '| CRM_AUTH_TC_001 | Valid Login | ❌ FAIL | 1 | Initial bug |',
      ].join('\n'),
      'utf8'
    );

    fs.writeFileSync(
      path.join(retestDir, 'retest_report.md'),
      [
        '# Retest Report — Auth · RETEST',
        '| Thông tin | Nội dung |',
        '|---|---|',
        '| Retest ID | retest_110 |',
        '| Mode | RETEST |',
        '## 2. Kết quả từng bug',
        '### BUG_auth_1 — Login fails',
        '| Thông tin | Nội dung |',
        '|---|---|',
        '| Bug | BUG_auth_1 |',
        '| TC / REQ liên quan | CRM_AUTH_TC_001 · REQ-AUTH-01 |',
        '| **Kết quả** | ✅ FIXED |',
      ].join('\n'),
      'utf8'
    );

    const overlaidSummary = computeTestSummaryReport(overlayRoot, { milestone: 'Release v1.1' });
    assert.equal(
      overlaidSummary.execution.pass,
      1,
      'Chronological overlay must update CRM_AUTH_TC_001 from FAIL (run_100) to PASS (retest_110)'
    );
    assert.equal(overlaidSummary.execution.fail, 0);
    assert.equal(overlaidSummary.execution.unexecuted, 1);
    assert.equal(
      overlaidSummary.execution.highPriorityPassRate,
      50,
      'Exit Criterion #3 must include unexecuted High-Priority TC_002 in denominator (1/2 = 50%)'
    );
    assert.equal(overlaidSummary.verdict, 'CONDITIONAL_GO');
  } finally {
    fs.rmSync(overlayRoot, { recursive: true, force: true });
  }
});

test('Seam 14: Multi-Part parts/part_*.md Support (Test Cases & User Guides) and Cross-Catalog Metadata Parity Gate', () => {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'multipart-and-parity-test-'));
  try {
    const reqDir = path.join(tmpRoot, 'docs', 'requirements', 'orders');
    const tcDir = path.join(tmpRoot, 'docs', 'testcases', 'orders');
    const tcPartsDir = path.join(tcDir, 'parts');
    const ugDir = path.join(tmpRoot, 'docs', 'user-guides', 'orders');
    const ugPartsDir = path.join(ugDir, 'parts');
    fs.mkdirSync(reqDir, { recursive: true });
    fs.mkdirSync(tcPartsDir, { recursive: true });
    fs.mkdirSync(ugPartsDir, { recursive: true });

    fs.writeFileSync(
      path.join(reqDir, 'requirements_orders.md'),
      [
        '# Requirements Orders',
        '| REQ ID | Tên yêu cầu | Mô tả | Acceptance Criteria | Trạng thái | Cập nhật lần cuối | Nguồn |',
        '|---|---|---|---|---|---|---|',
        '| REQ-ORD-01 | Create Order | Desc | AC | 🟢 | — | DOM |',
        '| REQ-ORD-02 | Cancel Order | Desc | AC | 🟢 | — | DOM |',
      ].join('\n'),
      'utf8'
    );

    // Index file without 13-col TC table, pointing to parts/part_01_create.md & parts/part_02_cancel.md
    fs.writeFileSync(
      path.join(tcDir, 'test_cases_orders.md'),
      [
        '# Test Cases — Orders (Index)',
        '| File | Nhóm chức năng | Số TC | TC ID range | REQ bao phủ |',
        '|---|---|---|---|---|',
        '| [parts/part_01_create.md](parts/part_01_create.md) | Create | 1 | CRM_ORD_TC_001 | REQ-ORD-01 |',
        '| [parts/part_02_cancel.md](parts/part_02_cancel.md) | Cancel | 1 | CRM_ORD_TC_002 | REQ-ORD-02 |',
      ].join('\n'),
      'utf8'
    );

    fs.writeFileSync(
      path.join(tcPartsDir, 'part_01_create.md'),
      [
        '# Part 1 — Create Order',
        '| TC ID | REQ ID | Module | Risk Level | Test Scenario | Pre-Condition | Test Steps | Test Data | Expected Result | Priority | Automatable | Auto Type | Tags |',
        '|---|---|---|---|---|---|---|---|---|---|---|---|---|',
        '| CRM_ORD_TC_001 | REQ-ORD-01 | ORD | High | Create valid order | None | 1. Go | None | 1. Ok | High | Yes | UI | @Smoke |',
      ].join('\n'),
      'utf8'
    );

    fs.writeFileSync(
      path.join(tcPartsDir, 'part_02_cancel.md'),
      [
        '# Part 2 — Cancel Order',
        '| TC ID | REQ ID | Module | Risk Level | Test Scenario | Pre-Condition | Test Steps | Test Data | Expected Result | Priority | Automatable | Auto Type | Tags |',
        '|---|---|---|---|---|---|---|---|---|---|---|---|---|',
        '| CRM_ORD_TC_002 | REQ-ORD-02 | ORD | Medium | Cancel pending order | None | 1. Go | None | 1. Ok | Medium | Yes | UI | @Regression |',
      ].join('\n'),
      'utf8'
    );

    fs.writeFileSync(
      path.join(ugDir, 'user_guide_orders.md'),
      [
        '# Hướng dẫn sử dụng — Orders',
        '- [Phần 1: Tạo đơn](parts/part_01_create_guide.md)',
      ].join('\n'),
      'utf8'
    );

    fs.writeFileSync(
      path.join(ugPartsDir, 'part_01_create_guide.md'),
      [
        '# Phần 1: Tạo đơn hàng',
        '<!-- Nguồn: REQ-ORD-01 -->',
        'Hướng dẫn chi tiết tạo đơn hàng.',
      ].join('\n'),
      'utf8'
    );

    const validPartsRes = validateDocsTree(tmpRoot);
    assert.equal(
      validPartsRes.valid,
      true,
      `Multi-part test_cases_orders.md + parts/*.md must pass validateDocsTree without false-positive errors, got schema=${JSON.stringify(validPartsRes.schemaViolations)}, ref=${JSON.stringify(validPartsRes.referentialErrors)}`
    );
    assert.equal(validPartsRes.stats.totalTcs, 2, 'validateDocsTree must aggregate TCs across all parts/*.md');

    const partsRtm = computeTraceabilityReport(tmpRoot, { module: 'orders' });
    assert.equal(partsRtm.summary.totalTcs, 2);
    assert.equal(partsRtm.summary.coveredReqs, 2);
    assert.equal(partsRtm.summary.coveragePct, 100);

    // Verify clean canonical TC/REQ IDs in computeTestSummaryReport Section 5 for BUG_login_1785678750_TC039
    const realLoginSummary = computeTestSummaryReport(REPO_ROOT, { module: 'login' });
    const bug039Entry = realLoginSummary.defects.openBugs.find(
      (b) => b.id === 'BUG_login_1785678750_TC039'
    );
    assert.equal(bug039Entry.tc, 'CRM_LOGIN_TC_039');
    assert.equal(bug039Entry.req, 'REQ-LOGIN-01');
    assert.ok(
      !realLoginSummary.markdown.includes('file gốc ghi nhầm CRM_LOGIN_TC_004'),
      'Section 5 open bugs table must render canonical IDs without parenthetical historical notes'
    );

    // Verify Cross-Catalog Metadata Parity Gate (docs/testcases/README.md Số TC mismatch & docs/bugs/README.md severity/status mismatch)
    fs.writeFileSync(
      path.join(tmpRoot, 'docs', 'testcases', 'README.md'),
      [
        '# Danh mục Test Cases',
        '| Module | Prefix TC ID | Dải đã dùng | Mã kế tiếp | Số TC | Độ hạt | REQ bao phủ | Tài liệu | Cập nhật |',
        '|---|---|---|---|---|---|---|---|---|',
        '| Orders | `CRM_ORD_TC_` | `001` → `002` | `003` | 99 | TÁCH | 2/2 | [test_cases_orders.md](orders/test_cases_orders.md) | 2026-10-17 |',
      ].join('\n'),
      'utf8'
    );

    const bugOrdersDir = path.join(tmpRoot, 'docs', 'bugs', 'orders');
    fs.mkdirSync(bugOrdersDir, { recursive: true });
    fs.writeFileSync(
      path.join(bugOrdersDir, 'BUG_orders_1787000001_TC001.md'),
      [
        '# [BUG] Order total rounding error',
        '## Thông tin chung',
        '- **ID:** BUG_orders_1787000001_TC001',
        '- **Severity:** 🔴 Critical',
        '- **Priority:** P1',
        '- **Môi trường:** Staging',
        '- **Build / Version:** v1.0.0',
        '- **Test case liên quan:** CRM_ORD_TC_001',
        '- **REQ ID liên quan:** REQ-ORD-01',
        '- **Ngày phát hiện:** 2026-10-17',
        '## Steps to Reproduce',
        '1. Create order',
        '## Expected Result',
        '100',
        '## Actual Result',
        '99',
        '## Lịch sử retest',
        '| Ngày | Build | Kết quả | Retest report | Ghi chú |',
        '|---|---|---|---|---|',
      ].join('\n'),
      'utf8'
    );

    // Catalog wrongly claims Severity is Minor and Status is Đã đóng while BUG file is Critical & OPEN
    fs.writeFileSync(
      path.join(tmpRoot, 'docs', 'bugs', 'README.md'),
      [
        '# Danh mục Bug',
        '| Mã bug | Module | Tiêu đề ngắn | Severity | Priority | Trạng thái | TC liên quan | Ngày phát hiện |',
        '|---|---|---|---|---|---|---|---|',
        '| [BUG_orders_1787000001_TC001](orders/BUG_orders_1787000001_TC001.md) | `ORD` | Order total rounding error | 🟡 Minor | P1 | 🟢 Đã đóng | `CRM_ORD_TC_001` | 2026-10-17 |',
      ].join('\n'),
      'utf8'
    );

    const driftRes = validateDocsTree(tmpRoot);
    assert.equal(driftRes.valid, false);
    assert.ok(
      driftRes.referentialErrors.some(
        (e) => e.file.includes('testcases/README.md') && e.message.includes('Số TC')
      ),
      'validateDocsTree must detect Số TC count mismatch in docs/testcases/README.md'
    );
    assert.ok(
      driftRes.referentialErrors.some(
        (e) => e.file.includes('bugs/README.md') && e.message.includes('severity mismatch')
      ),
      'validateDocsTree must detect severity mismatch between docs/bugs/README.md and BUG_*.md'
    );
    assert.ok(
      driftRes.referentialErrors.some(
        (e) => e.file.includes('bugs/README.md') && e.message.includes('status mismatch')
      ),
      'validateDocsTree must detect status mismatch between docs/bugs/README.md and BUG_*.md'
    );
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
});

test('Seam 15: Viewer Core TypeScript Declaration Parity, Full Cross-Catalog/Summary Parity, Escaped-Pipe Jira Table Handling, and CLI Flag Uniformity', async () => {
  // 1. Verify scripts/viewer-core.d.mts declares every single runtime export of scripts/viewer-core.mjs
  const viewerCoreModule = await import('./viewer-core.mjs');
  const dtsPath = path.join(REPO_ROOT, 'scripts', 'viewer-core.d.mts');
  const dtsContent = fs.readFileSync(dtsPath, 'utf8');
  const runtimeExports = Object.keys(viewerCoreModule);
  assert.ok(runtimeExports.length >= 60, `Expected >= 60 runtime exports in viewer-core.mjs, got ${runtimeExports.length}`);
  for (const sym of runtimeExports) {
    const declRegex = new RegExp(`\\bexport\\s+(?:const|function)\\s+${sym}\\b`);
    assert.match(
      dtsContent,
      declRegex,
      `scripts/viewer-core.d.mts is missing declaration for runtime export "${sym}"`
    );
  }
  assert.match(dtsContent, /\bhead:\s*readonly\s+string\[\]/, 'ExportSheet in viewer-core.d.mts must match runtime head property');
  assert.match(dtsContent, /\bstatusCol\?:\s*number/, 'ExportSheet in viewer-core.d.mts must match runtime statusCol property');

  const parserTsContent = fs.readFileSync(
    path.join(REPO_ROOT, 'scripts', 'testcases-viewer', 'src', 'lib', 'parser.ts'),
    'utf8'
  );
  assert.match(
    parserTsContent,
    /export\s+type\s*\{[^}]*TestCase[^}]*\}/,
    'testcases-viewer/src/lib/parser.ts must re-export shared types from viewer-core.mjs'
  );

  // 2. Verify module-scoped validateDocsTree(REPO_ROOT, { module: 'login' }) and CLI --check --module=login
  const loginOnlyValidation = validateDocsTree(REPO_ROOT, { module: 'login' });
  assert.equal(loginOnlyValidation.valid, true);
  assert.deepEqual(loginOnlyValidation.modules, ['login']);
  assert.equal(loginOnlyValidation.stats.totalReqs, 43);
  assert.equal(loginOnlyValidation.stats.totalTcs, 50);
  assert.equal(loginOnlyValidation.stats.totalBugs, 6);

  const cliCheckLoginOut = execFileSync(
    process.execPath,
    [path.join(REPO_ROOT, 'scripts', 'validate-docs.mjs'), '--check', '--module=login', '--json'],
    { encoding: 'utf8' }
  );
  const cliCheckLoginJson = JSON.parse(cliCheckLoginOut);
  assert.equal(cliCheckLoginJson.valid, true);
  assert.deepEqual(cliCheckLoginJson.modules, ['login']);

  // 3. Verify Requirements Catalog count parity, Reverse Bug Catalog parity, and Execution Report Section 1 summary count parity
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'wave8-parity-test-'));
  try {
    const reqDir = path.join(tmpRoot, 'docs', 'requirements', 'orders');
    const tcDir = path.join(tmpRoot, 'docs', 'testcases', 'orders');
    const bugDir = path.join(tmpRoot, 'docs', 'bugs', 'orders');
    const execDir = path.join(tmpRoot, 'docs', 'executions', 'orders', 'run_1');
    fs.mkdirSync(reqDir, { recursive: true });
    fs.mkdirSync(tcDir, { recursive: true });
    fs.mkdirSync(bugDir, { recursive: true });
    fs.mkdirSync(execDir, { recursive: true });

    fs.writeFileSync(
      path.join(reqDir, 'requirements_orders.md'),
      [
        '# Requirements Orders',
        '| REQ ID | Tên yêu cầu | Mô tả | Acceptance Criteria | Trạng thái | Cập nhật lần cuối | Nguồn |',
        '|---|---|---|---|---|---|---|',
        '| REQ-ORD-01 | Create Order | Desc | AC | 🟢 | — | DOM |',
        '| REQ-ORD-02 | Cancel Order | Desc | AC | 🟢 | — | DOM |',
      ].join('\n'),
      'utf8'
    );

    // Requirements Catalog declares 5 REQs (REQ-ORD-01 -> REQ-ORD-05 (5)) when module only has 2 REQs
    fs.writeFileSync(
      path.join(tmpRoot, 'docs', 'requirements', 'README.md'),
      [
        '# Danh mục Requirements',
        '## 1. Bảng danh mục module',
        '| Module | Prefix | Trạng thái recon | Mức phủ tài liệu | Tài liệu | REQ đã dùng | Mã kế tiếp | AMB treo | Cập nhật |',
        '|---|---|---|---|---|---|---|---|---|',
        '| Orders | `ORD` | ✅ Đã có tài liệu | 🟩 Đầy đủ | [orders/requirements_orders.md](orders/requirements_orders.md) | `REQ-ORD-01` → `REQ-ORD-05` (5) | `REQ-ORD-06` | — | 2026-10-17 |',
      ].join('\n'),
      'utf8'
    );

    fs.writeFileSync(
      path.join(tcDir, 'test_cases_orders.md'),
      [
        '# Test Cases — Orders',
        '| TC ID | REQ ID | Module | Risk Level | Test Scenario | Pre-Condition | Test Steps | Test Data | Expected Result | Priority | Automatable | Auto Type | Tags |',
        '|---|---|---|---|---|---|---|---|---|---|---|---|---|',
        '| CRM_ORD_TC_001 | REQ-ORD-01 | ORD | High | Create order | None | 1. Go | None | 1. Ok | High | Yes | UI | @Smoke |',
        '| CRM_ORD_TC_002 | REQ-ORD-02 | ORD | Medium | Cancel order | None | 1. Go | None | 1. Ok | Medium | Yes | UI | @Regression |',
      ].join('\n'),
      'utf8'
    );

    // Two BUG_*.md files on disk, but docs/bugs/README.md only lists the first one
    for (const [id, tc, req] of [
      ['BUG_orders_1787000001_TC001', 'CRM_ORD_TC_001', 'REQ-ORD-01'],
      ['BUG_orders_1787000002_TC002', 'CRM_ORD_TC_002', 'REQ-ORD-02'],
    ]) {
      fs.writeFileSync(
        path.join(bugDir, `${id}.md`),
        [
          `# [BUG] Issue ${id}`,
          '## Thông tin chung',
          `- **ID:** ${id}`,
          '- **Severity:** 🟠 Major',
          '- **Priority:** P2',
          '- **Môi trường:** Staging',
          '- **Build / Version:** v1.0.0',
          `- **Test case liên quan:** ${tc}`,
          `- **REQ ID liên quan:** ${req}`,
          '- **Ngày phát hiện:** 2026-10-17',
          '## Steps to Reproduce',
          '1. Step',
          '## Expected Result',
          'Ok',
          '## Actual Result',
          'Fail',
          '## Lịch sử retest',
          '| Ngày | Build | Kết quả | Retest report | Ghi chú |',
          '|---|---|---|---|---|',
        ].join('\n'),
        'utf8'
      );
    }

    fs.writeFileSync(
      path.join(tmpRoot, 'docs', 'bugs', 'README.md'),
      [
        '# Danh mục Bug',
        '| Mã bug | Module | Tiêu đề ngắn | Severity | Priority | Trạng thái | TC liên quan | Ngày phát hiện |',
        '|---|---|---|---|---|---|---|---|',
        '| [BUG_orders_1787000001_TC001](orders/BUG_orders_1787000001_TC001.md) | `ORD` | Issue 1 | 🟠 Major | P2 | 🔴 Đang mở | `CRM_ORD_TC_001` | 2026-10-17 |',
      ].join('\n'),
      'utf8'
    );

    // Execution report where Section 1 summary declares PASS=10, Tổng=10 but Section 2 has only 2 rows (1 PASS, 1 FAIL)
    fs.writeFileSync(
      path.join(execDir, 'execution_report.md'),
      [
        '# Execution Report — Orders',
        '## 1. Tổng kết',
        '| Trạng thái | Số lượng | Tỷ lệ |',
        '|---|---|---|',
        '| ✅ PASS | 10 | 100% |',
        '| ❌ FAIL | 0 | 0% |',
        '| **Tổng** | **10** | 100% |',
        '## 2. Kết quả từng TC',
        '| TC ID | Test Scenario | Kết quả | Bước fail | Ghi chú |',
        '|---|---|---|---|---|',
        '| CRM_ORD_TC_001 | Create order | ✅ PASS | — | — |',
        '| CRM_ORD_TC_002 | Cancel order | ❌ FAIL | 1 | Error |',
      ].join('\n'),
      'utf8'
    );

    const res = validateDocsTree(tmpRoot);
    assert.equal(res.valid, false);
    assert.ok(
      res.referentialErrors.some(
        (e) => e.file.includes('requirements/README.md') && e.message.includes('REQ đã dùng')
      ),
      'validateDocsTree must detect Requirements Catalog "REQ đã dùng" count mismatch'
    );
    assert.ok(
      res.referentialErrors.some(
        (e) =>
          e.file.includes('bugs/README.md') &&
          e.message.includes('BUG_orders_1787000002_TC002') &&
          e.message.includes('missing from Bug Catalog')
      ),
      'validateDocsTree must detect BUG_*.md file on disk that is missing from docs/bugs/README.md'
    );
    assert.ok(
      res.referentialErrors.some(
        (e) =>
          e.file.includes('execution_report.md') &&
          e.message.includes('summary count mismatch for "PASS"')
      ),
      'validateDocsTree must detect Execution report Section 1 PASS count mismatch against Section 2 rows'
    );
    assert.ok(
      res.referentialErrors.some(
        (e) =>
          e.file.includes('execution_report.md') &&
          e.message.includes('summary total mismatch')
      ),
      'validateDocsTree must detect Execution report Section 1 total count mismatch against Section 2 rows'
    );
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }

  // 4. Verify escaped-pipe (\|) handling in markdownToAdf and updateBugsCatalogWithJiraKey
  const { markdownToAdf } = await import('./integrations/jira/utils.js');
  const { updateBugsCatalogWithJiraKey } = await import('./integrations/jira/jira_bug_creator.js');

  const adfDoc = markdownToAdf(
    [
      '| Field | Expression |',
      '|---|---|',
      '| Bitwise OR | `a \\| b` |',
    ].join('\n')
  );
  const tableNode = adfDoc.content.find((n) => n.type === 'table');
  assert.ok(tableNode, 'markdownToAdf must produce a table node');
  const dataRowCells = tableNode.content[1].content;
  assert.equal(dataRowCells.length, 2, 'Escaped pipe \\| must not split table row into 3 cells');
  assert.equal(dataRowCells[1].content[0].content[0].text, 'a | b');

  const tmpBugDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jira-bug-catalog-pipe-'));
  try {
    const readmePath = path.join(tmpBugDir, 'README.md');
    fs.writeFileSync(
      readmePath,
      [
        '# Danh mục Bug',
        '| Mã bug | Module | Tiêu đề ngắn | Severity | Priority | Trạng thái | TC liên quan | Ngày phát hiện |',
        '|---|---|---|---|---|---|---|---|',
        '| [BUG_login_1](login/BUG_login_1.md) | `LOGIN` | Lỗi A \\| B | 🟠 Major | P2 | 🔴 Đang mở (OLD-1) | `CRM_LOGIN_TC_001` | 2026-10-17 |',
      ].join('\n'),
      'utf8'
    );
    const updated = updateBugsCatalogWithJiraKey(readmePath, 'BUG_login_1', 'NEW-2');
    assert.equal(updated, true);
    const afterText = fs.readFileSync(readmePath, 'utf8');
    assert.match(afterText, /🔴 Đang mở \(NEW-2\)/, 'Must replace (OLD-1) with (NEW-2) in column 6 even when title has escaped pipe \\|');
    assert.doesNotMatch(afterText, /OLD-1/, 'Must not leave stale (OLD-1) key in status cell');
  } finally {
    fs.rmSync(tmpBugDir, { recursive: true, force: true });
  }

  // 5. Verify CLI --help and --root=<dir> flags across sync-antigravity.mjs and browser-mode.mjs
  const syncHelp = execFileSync(
    process.execPath,
    [path.join(REPO_ROOT, 'scripts', 'sync-antigravity.mjs'), '--help'],
    { encoding: 'utf8' }
  );
  assert.match(syncHelp, /Usage:\s*node scripts\/sync-antigravity\.mjs/);

  const syncCheckRootEq = execFileSync(
    process.execPath,
    [path.join(REPO_ROOT, 'scripts', 'sync-antigravity.mjs'), '--check', `--root=${REPO_ROOT}`],
    { encoding: 'utf8' }
  );
  assert.match(syncCheckRootEq, /100% in sync/);

  const bmHelp = execFileSync(
    process.execPath,
    [path.join(REPO_ROOT, 'scripts', 'browser-mode.mjs'), '--help'],
    { encoding: 'utf8' }
  );
  assert.match(bmHelp, /Usage:\s*node scripts\/browser-mode\.mjs/);

  const bmStatusRootEq = execFileSync(
    process.execPath,
    [path.join(REPO_ROOT, 'scripts', 'browser-mode.mjs'), 'status', `--root=${REPO_ROOT}`],
    { encoding: 'utf8' }
  );
  assert.match(bmStatusRootEq, /Browser Execution Mode:/);

  // 6. Verify sub-variant TC IDs (-a, -b) in parseExecutionReport Section 3 merge & computeExecutionTrend
  const variantExecMd = [
    '# Execution Report — Login',
    '## 1. Tổng kết',
    '| Trạng thái | Số lượng | Tỷ lệ |',
    '|---|---|---|',
    '| ❌ FAIL | 1 | 100% |',
    '| **Tổng** | **1** | 100% |',
    '## 2. Kết quả từng TC',
    '| TC ID | Test Scenario | Kết quả | Bước fail | Ghi chú |',
    '|---|---|---|---|---|',
    '| CRM_LOGIN_TC_018-a | Variant A | ❌ FAIL | 2 | Err |',
    '## 3. Chi tiết TC FAIL',
    '### FAIL #1 — CRM_LOGIN_TC_018-a · Variant A',
    '| Thông tin | Nội dung |',
    '|---|---|',
    '| REQ ID | REQ-LOGIN-01 |',
    '| Expected | Pass |',
    '| Actual | Fail |',
  ].join('\n');
  const parsedVariantExec = viewerCoreModule.parseExecutionReport(
    variantExecMd,
    'docs/executions/login/run_100/execution_report.md'
  );
  assert.equal(
    parsedVariantExec.tcs.length,
    1,
    'Section 3 FAIL detail with sub-variant TC ID must merge into Section 2 row without creating a phantom duplicate row'
  );
  assert.equal(parsedVariantExec.tcs[0].id, 'CRM_LOGIN_TC_018-a');
  assert.equal(parsedVariantExec.tcs[0].reqId, 'REQ-LOGIN-01');

  const parsedVariantRetest = viewerCoreModule.parseExecutionReport(
    [
      '# Retest Report — Login · RETEST',
      '| Thông tin | Nội dung |',
      '|---|---|',
      '| Retest ID | retest_110 |',
      '## 2. Kết quả từng bug',
      '### BUG_login_1 — Fix Variant A',
      '| Thông tin | Nội dung |',
      '|---|---|',
      '| Bug | BUG_login_1 |',
      '| TC / REQ liên quan | CRM_LOGIN_TC_018-a · REQ-LOGIN-01 |',
      '| **Kết quả** | ✅ FIXED |',
    ].join('\n'),
    'docs/executions/login/retest_110/retest_report.md'
  );
  const parsedBaseExec = viewerCoreModule.parseExecutionReport(
    variantExecMd.replace(/CRM_LOGIN_TC_018-a/g, 'CRM_LOGIN_TC_018'),
    'docs/executions/login/run_100/execution_report.md'
  );
  const trendRows = viewerCoreModule.computeExecutionTrend([parsedBaseExec, parsedVariantRetest]);
  assert.equal(trendRows.length, 1, 'computeExecutionTrend must correlate base TC ID with sub-variant retest TC ID');
  assert.equal(trendRows[0].grp, 'FIXEDTREND');

  // 7. Verify Jira severity->priority fallback, word-boundary Jira key writeback, -h flag, and Xray parameterized worst-status precedence
  const { parseCliArgs } = await import('./integrations/jira/utils.js');
  const { buildJiraBugPayload, updateBugMarkdownWithJiraKey } = await import(
    './integrations/jira/jira_bug_creator.js'
  );
  const { convertPlaywrightToXray, convertJunitXmlToXray } = await import(
    './integrations/jira/xray_importer.js'
  );

  assert.equal(parseCliArgs(['-h']).help, true, 'parseCliArgs must support -h short flag');
  const critBugNoPriority = viewerCoreModule.parseBugFile(
    '# [BUG] Crash\n## Thông tin chung\n- **ID:** BUG_1\n- **Severity:** 🔴 Critical\n',
    'BUG_1.md'
  );
  const critPayload = buildJiraBugPayload(critBugNoPriority, { projectKey: 'PROJ' });
  assert.equal(
    critPayload.fields.priority.name,
    'Highest',
    'buildJiraBugPayload must map uppercase CRITICAL severity from parseBugFile to Highest priority when priority is omitted'
  );

  const tmpCollisionDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jira-collision-test-'));
  try {
    const readmeCollisionPath = path.join(tmpCollisionDir, 'README.md');
    fs.writeFileSync(
      readmeCollisionPath,
      [
        '# Danh mục Bug',
        '| Mã bug | Module | Tiêu đề ngắn | Severity | Priority | Trạng thái | TC liên quan | Ngày phát hiện |',
        '|---|---|---|---|---|---|---|---|',
        '| [BUG_login_10](login/BUG_login_10.md) | `LOGIN` | Bug 10 | 🟠 Major | P2 | 🔴 Đang mở (PROJ-10) | `CRM_LOGIN_TC_010` | 2026-10-17 |',
        '| [BUG_login_1](login/BUG_login_1.md) | `LOGIN` | Bug 1 | 🟠 Major | P2 | 🔴 Đang mở | `CRM_LOGIN_TC_001` | 2026-10-17 |',
      ].join('\n'),
      'utf8'
    );
    assert.equal(
      updateBugsCatalogWithJiraKey(readmeCollisionPath, 'BUG_login_1', 'PROJ-1'),
      true,
      'updateBugsCatalogWithJiraKey must not skip PROJ-1 just because PROJ-10 exists in README.md'
    );
    const collisionReadmeAfter = fs.readFileSync(readmeCollisionPath, 'utf8');
    assert.match(collisionReadmeAfter, /BUG_login_10.*🔴 Đang mở \(PROJ-10\)/);
    assert.match(collisionReadmeAfter, /BUG_login_1\b.*🔴 Đang mở \(PROJ-1\)/);

    const bugMdCollisionPath = path.join(tmpCollisionDir, 'BUG_login_1.md');
    fs.writeFileSync(
      bugMdCollisionPath,
      '# [BUG] Related to PROJ-10\n## Thông tin chung\n- **ID:** BUG_login_1\n',
      'utf8'
    );
    assert.equal(
      updateBugMarkdownWithJiraKey(bugMdCollisionPath, 'PROJ-1'),
      true,
      'updateBugMarkdownWithJiraKey must not skip PROJ-1 when PROJ-10 appears in bug prose'
    );
    assert.match(fs.readFileSync(bugMdCollisionPath, 'utf8'), /- \*\*Jira Issue:\*\* PROJ-1/);
  } finally {
    fs.rmSync(tmpCollisionDir, { recursive: true, force: true });
  }

  const pwParameterized = convertPlaywrightToXray({
    suites: [
      {
        specs: [
          {
            title: '[PROJ-201] Login [param 1]',
            tests: [{ results: [{ status: 'failed', error: { message: 'Boom' } }] }],
          },
          {
            title: '[PROJ-201] Login [param 2]',
            tests: [{ results: [{ status: 'passed' }] }],
          },
        ],
      },
    ],
  });
  assert.equal(
    pwParameterized.payload.tests[0].status,
    'FAILED',
    'convertPlaywrightToXray must preserve worst-status precedence (FAILED over PASSED) across parameterized iterations'
  );

  const junitParameterized = convertJunitXmlToXray(
    '<testsuite><testcase name="[PROJ-201] iter 1"><failure message="Boom"/></testcase><testcase name="[PROJ-201] iter 2"/></testsuite>'
  );
  assert.equal(
    junitParameterized.payload.tests[0].status,
    'FAILED',
    'convertJunitXmlToXray must preserve worst-status precedence (FAILED over PASSED) across parameterized iterations'
  );

  // 8. Verify secondary-system --module=_book-api/auth filtering, duplicate REQ/TC ID detection, and docs/testcases/<module>/impact/*.md validation
  const tmpSecRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'sec-system-and-dup-test-'));
  try {
    const secReqDir = path.join(tmpSecRoot, 'docs', 'requirements', '_book-api', 'auth');
    const secTcDir = path.join(tmpSecRoot, 'docs', 'testcases', '_book-api', 'auth');
    const secTcImpactDir = path.join(secTcDir, 'impact');
    fs.mkdirSync(secReqDir, { recursive: true });
    fs.mkdirSync(secTcImpactDir, { recursive: true });

    fs.writeFileSync(
      path.join(secReqDir, 'requirements_auth.md'),
      [
        '# Requirements Book API Auth',
        'See [broken](missing_target.md)',
        '| REQ ID | Tên yêu cầu | Mô tả | Acceptance Criteria | Trạng thái | Cập nhật lần cuối | Nguồn |',
        '|---|---|---|---|---|---|---|',
        '| REQ-BK-AUTH-05 | Token Auth | Desc | AC | 🟢 | — | API |',
        '| REQ-BK-AUTH-05 | Duplicate Token Auth | Desc | AC | 🟢 | — | API |',
      ].join('\n'),
      'utf8'
    );

    fs.writeFileSync(
      path.join(secTcDir, 'test_cases_auth.md'),
      [
        '# Test Cases Book API Auth',
        '| TC ID | REQ ID | Module | Risk Level | Test Scenario | Pre-Condition | Test Steps | Test Data | Expected Result | Priority | Automatable | Auto Type | Tags |',
        '|---|---|---|---|---|---|---|---|---|---|---|---|---|',
        '| BK_AUTH_TC_001 | REQ-BK-AUTH-05 | AUTH | High | Token 1 | None | 1. Call | None | 1. 200 | High | Yes | API | @Smoke |',
        '| BK_AUTH_TC_001 | REQ-BK-AUTH-05 | AUTH | High | Duplicate Token 1 | None | 1. Call | None | 1. 200 | High | Yes | API | @Smoke |',
      ].join('\n'),
      'utf8'
    );

    fs.writeFileSync(
      path.join(secTcImpactDir, 'delta_plan.md'),
      '# Delta TC Plan\nImpacts `BK_AUTH_TC_999` and `REQ-BK-AUTH-99`.\n',
      'utf8'
    );

    const scopedSecRes = validateDocsTree(tmpSecRoot, { module: '_book-api/auth' });
    assert.equal(scopedSecRes.valid, false);
    assert.equal(
      scopedSecRes.brokenPointers.length,
      1,
      'validateDocsTree with module: "_book-api/auth" must check markdown pointers inside docs/*/_book-api/auth/'
    );
    assert.ok(
      scopedSecRes.referentialErrors.some((e) => e.message.includes('Duplicate REQ ID "REQ-BK-AUTH-05"')),
      'validateDocsTree must detect duplicate REQ ID definitions'
    );
    assert.ok(
      scopedSecRes.referentialErrors.some((e) => e.message.includes('Duplicate TC ID "BK_AUTH_TC_001"')),
      'validateDocsTree must detect duplicate TC ID definitions'
    );
    assert.ok(
      scopedSecRes.referentialErrors.some(
        (e) => e.file.includes('testcases/_book-api/auth/impact/delta_plan.md') && e.message.includes('BK_AUTH_TC_999')
      ),
      'validateDocsTree must validate TC IDs referenced in docs/testcases/<module>/impact/*.md'
    );
  } finally {
    fs.rmSync(tmpSecRoot, { recursive: true, force: true });
  }

  // 9. Verify prefix-to-slug module resolution (CUST -> customers, PRJ -> projects, CRM_LOGIN_TC_ -> login), unknown module error, module-scoped orphanScripts, and Section 2 summary table parity
  const custValidation = validateDocsTree(REPO_ROOT, { module: 'CUST' });
  assert.equal(custValidation.valid, true, 'validateDocsTree({ module: "CUST" }) must resolve prefix CUST to customers');
  assert.deepEqual(custValidation.modules, ['customers']);
  assert.equal(custValidation.stats.totalReqs, 79);

  const prjRtm = computeTraceabilityReport(REPO_ROOT, { module: 'PRJ' });
  assert.deepEqual(prjRtm.modules, ['projects'], 'computeTraceabilityReport({ module: "PRJ" }) must resolve prefix PRJ to projects');
  assert.equal(prjRtm.summary.totalReqs, 104);

  const loginByTcPrefixSummary = computeTestSummaryReport(REPO_ROOT, { module: 'CRM_LOGIN_TC_' });
  assert.deepEqual(
    loginByTcPrefixSummary.modules,
    ['login'],
    'computeTestSummaryReport({ module: "CRM_LOGIN_TC_" }) must resolve TC prefix to login'
  );

  const unknownModValidation = validateDocsTree(REPO_ROOT, { module: 'nonexistent_module_xyz' });
  assert.equal(unknownModValidation.valid, false, 'validateDocsTree must fail when options.module does not exist');
  assert.ok(
    unknownModValidation.referentialErrors.some((e) =>
      e.message.includes('Unknown target module "nonexistent_module_xyz"')
    ),
    'validateDocsTree must report Unknown target module in referentialErrors'
  );

  const tmpParityAndOrphanRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'parity-and-orphan-test-'));
  try {
    const authReqDir = path.join(tmpParityAndOrphanRoot, 'docs', 'requirements', 'auth');
    const ordReqDir = path.join(tmpParityAndOrphanRoot, 'docs', 'requirements', 'orders');
    const authTcDir = path.join(tmpParityAndOrphanRoot, 'docs', 'testcases', 'auth');
    const ordTcDir = path.join(tmpParityAndOrphanRoot, 'docs', 'testcases', 'orders');
    const authBugDir = path.join(tmpParityAndOrphanRoot, 'docs', 'bugs', 'auth');
    const testsAuthDir = path.join(tmpParityAndOrphanRoot, 'tests', 'auth');
    const testsOrdDir = path.join(tmpParityAndOrphanRoot, 'tests', 'orders');
    for (const d of [authReqDir, ordReqDir, authTcDir, ordTcDir, authBugDir, testsAuthDir, testsOrdDir]) {
      fs.mkdirSync(d, { recursive: true });
    }

    fs.writeFileSync(
      path.join(authReqDir, 'requirements_auth.md'),
      [
        '# Auth Reqs',
        '| REQ ID | Tên yêu cầu | Mô tả | Acceptance Criteria | Trạng thái | Cập nhật lần cuối | Nguồn |',
        '|---|---|---|---|---|---|---|',
        '| REQ-AUTH-01 | Login | Desc | AC | 🟢 Active | — | UI |',
        '| REQ-AUTH-02 | SSO | Desc | AC | ⚪ Out of scope | — | UI |',
      ].join('\n'),
      'utf8'
    );
    fs.writeFileSync(
      path.join(ordReqDir, 'requirements_orders.md'),
      [
        '# Orders Reqs',
        '| REQ ID | Tên yêu cầu | Mô tả | Acceptance Criteria | Trạng thái | Cập nhật lần cuối | Nguồn |',
        '|---|---|---|---|---|---|---|',
        '| REQ-ORD-01 | Create Order | Desc | AC | 🟢 Active | — | UI |',
      ].join('\n'),
      'utf8'
    );
    fs.writeFileSync(
      path.join(authTcDir, 'test_cases_auth.md'),
      [
        '# Auth TCs',
        '## Ngoài phạm vi kiểm thử',
        '| REQ ID | Lý do |',
        '|---|---|',
        '| REQ-AUTH-02 | Out of scope |',
        '## Danh sách TC',
        '| TC ID | REQ ID | Module | Risk Level | Test Scenario | Pre-Condition | Test Steps | Test Data | Expected Result | Priority | Automatable | Auto Type | Tags |',
        '|---|---|---|---|---|---|---|---|---|---|---|---|---|',
        '| CRM_AUTH_TC_001 | REQ-AUTH-01 | AUTH | High | Login ok | None | 1. Go | None | 1. Ok | High | Yes | UI | @Smoke |',
      ].join('\n'),
      'utf8'
    );
    fs.writeFileSync(
      path.join(ordTcDir, 'test_cases_orders.md'),
      [
        '# Orders TCs',
        '| TC ID | REQ ID | Module | Risk Level | Test Scenario | Pre-Condition | Test Steps | Test Data | Expected Result | Priority | Automatable | Auto Type | Tags |',
        '|---|---|---|---|---|---|---|---|---|---|---|---|---|',
        '| CRM_ORD_TC_001 | REQ-ORD-01 | ORD | High | Order ok | None | 1. Go | None | 1. Ok | High | Yes | UI | @Smoke |',
      ].join('\n'),
      'utf8'
    );
    fs.writeFileSync(
      path.join(authBugDir, 'BUG_auth_100_TC001.md'),
      [
        '# [BUG] Auth failure',
        '## Thông tin chung',
        '- **ID:** BUG_auth_100_TC001',
        '- **Mức độ nghiêm trọng (Severity):** 🔴 Critical',
        '- **Độ ưu tiên (Priority):** P1',
        '- **Test case liên quan:** CRM_AUTH_TC_001',
        '- **REQ ID liên quan:** REQ-AUTH-01',
      ].join('\n'),
      'utf8'
    );

    // Deliberately put wrong counts in Section 2 summary tables of requirements/README.md, testcases/README.md, and bugs/README.md
    fs.writeFileSync(
      path.join(tmpParityAndOrphanRoot, 'docs', 'requirements', 'README.md'),
      [
        '# Danh mục Requirements',
        '## 1. Bảng danh mục module',
        '| Module | Prefix | Trạng thái recon | Mức phủ tài liệu | Tài liệu | REQ đã dùng | Mã kế tiếp | AMB treo | Cập nhật |',
        '|---|---|---|---|---|---|---|---|---|',
        '| Xác thực | `AUTH` | ✅ Đã có tài liệu | 🟩 Đầy đủ | [auth/requirements_auth.md](auth/requirements_auth.md) | `REQ-AUTH-01` → `REQ-AUTH-02` (2) | `REQ-AUTH-03` | — | 2026-10-17 |',
        '| Đơn hàng | `ORD` | ✅ Đã có tài liệu | 🟩 Đầy đủ | [orders/requirements_orders.md](orders/requirements_orders.md) | `REQ-ORD-01` → `REQ-ORD-01` (1) | `REQ-ORD-02` | — | 2026-10-17 |',
        '',
        '## 2. Trạng thái REQ toàn hệ thống',
        '| Trạng thái | Số lượng | Chi tiết |',
        '|---|---|---|',
        '| 🟢 Active | 10 | lệch |',
        '| ⚪ Chưa implement | 5 | lệch |',
        '| **Tổng** | **99** | |',
      ].join('\n'),
      'utf8'
    );

    fs.writeFileSync(
      path.join(tmpParityAndOrphanRoot, 'docs', 'testcases', 'README.md'),
      [
        '# Danh mục Test Cases',
        '## 1. Danh mục module đã có test cases',
        '| Module | Prefix TC ID | Dải đã dùng | Mã kế tiếp | Số TC | Độ hạt | REQ bao phủ | Tài liệu | Cập nhật |',
        '|---|---|---|---|---|---|---|---|---|',
        '| Xác thực | `CRM_AUTH_TC_` | `001` → `001` | `002` | 1 | GỘP | 1/1 | [auth/test_cases_auth.md](auth/test_cases_auth.md) | 2026-10-17 |',
        '| Đơn hàng | `CRM_ORD_TC_` | `001` → `001` | `002` | 1 | GỘP | 1/1 | [orders/test_cases_orders.md](orders/test_cases_orders.md) | 2026-10-17 |',
        '',
        '## 2. Độ phủ so với requirements',
        '| Module | REQ có tài liệu | REQ trong phạm vi TC | REQ đã có ≥1 TC | Độ phủ | Ghi chú |',
        '|---|---|---|---|---|---|',
        '| `AUTH` | 50 | 40 | 30 | 100% | lệch cả 3 cột |',
      ].join('\n'),
      'utf8'
    );

    fs.writeFileSync(
      path.join(tmpParityAndOrphanRoot, 'docs', 'bugs', 'README.md'),
      [
        '# Danh mục Bug',
        '## 1. Danh mục bug',
        '| Mã bug | Module | Tiêu đề ngắn | Severity | Priority | Trạng thái | TC liên quan | Ngày phát hiện |',
        '|---|---|---|---|---|---|---|---|',
        '| [BUG_auth_100_TC001](auth/BUG_auth_100_TC001.md) | `AUTH` | Auth failure | 🔴 Critical | P1 | 🔴 **Đang mở** | `CRM_AUTH_TC_001` | 2026-10-17 |',
        '',
        '## 2. Thống kê theo trạng thái',
        '| Trạng thái | Số lượng | Ý nghĩa |',
        '|---|---|---|',
        '| 🔴 Đang mở | 5 | lệch |',
        '| 🟢 Đã đóng | 2 | lệch |',
      ].join('\n'),
      'utf8'
    );

    const parityRes = validateDocsTree(tmpParityAndOrphanRoot);
    assert.equal(parityRes.valid, false);
    assert.ok(
      parityRes.referentialErrors.some((e) =>
        e.message.includes('Requirements status summary count mismatch for "🟢 Active": summary table declares 10 but 2 REQs were found')
      ),
      'validateDocsTree must detect per-status "🟢 Active" count mismatch in docs/requirements/README.md'
    );
    assert.ok(
      parityRes.referentialErrors.some((e) =>
        e.message.includes('Requirements status summary count mismatch for "⚪ Chưa implement": summary table declares 5 but 1 REQs were found')
      ),
      'validateDocsTree must detect per-status "⚪ Chưa implement" count mismatch in docs/requirements/README.md'
    );
    assert.ok(
      parityRes.referentialErrors.some((e) =>
        e.message.includes('Requirements status summary total mismatch: summary table declares 99 total REQs but 3 REQs were found')
      ),
      'validateDocsTree must detect Section 2 total REQ mismatch in docs/requirements/README.md'
    );
    assert.ok(
      parityRes.referentialErrors.some((e) =>
        e.message.includes('Requirements status summary breakdown mismatch: status rows sum to 15 but total row declares 99')
      ),
      'validateDocsTree must detect Section 2 breakdown row sum mismatch in docs/requirements/README.md'
    );
    assert.ok(
      parityRes.referentialErrors.some((e) =>
        e.message.includes('Test Cases coverage table "REQ có tài liệu" mismatch for module "auth": table declares 50 but 2 REQs were found')
      ),
      'validateDocsTree must detect Section 2 "REQ có tài liệu" mismatch in docs/testcases/README.md'
    );
    assert.ok(
      parityRes.referentialErrors.some((e) =>
        e.message.includes('Test Cases coverage table "REQ trong phạm vi TC" mismatch for module "auth": table declares 40 but 1 in-scope REQs were found')
      ),
      'validateDocsTree must detect Section 2 "REQ trong phạm vi TC" mismatch in docs/testcases/README.md'
    );
    assert.ok(
      parityRes.referentialErrors.some((e) =>
        e.message.includes('Test Cases coverage table "REQ đã có ≥1 TC" mismatch for module "auth": table declares 30 but 1 covered REQs were found')
      ),
      'validateDocsTree must detect Section 2 "REQ đã có ≥1 TC" mismatch in docs/testcases/README.md'
    );
    assert.ok(
      parityRes.referentialErrors.some((e) =>
        e.message.includes('Bug Catalog status summary count mismatch for "🔴 Đang mở": summary table declares 5 but Bug Catalog has 1')
      ),
      'validateDocsTree must detect Section 2 open bug count mismatch in docs/bugs/README.md'
    );
    assert.ok(
      parityRes.referentialErrors.some((e) =>
        e.message.includes('Bug Catalog status summary count mismatch for "🟢 Đã đóng": summary table declares 2 but Bug Catalog has 0')
      ),
      'validateDocsTree must detect Section 2 closed bug count mismatch in docs/bugs/README.md'
    );

    // Verify out-of-scope table column-0 isolation (mentioning REQ-AUTH-01 in Lý do column must not mark REQ-AUTH-01 out-of-scope)
    // and verify unknown REQ ID & Bảng Đối Soát Coverage validation in test_cases_<module>.md
    fs.writeFileSync(
      path.join(authTcDir, 'test_cases_auth.md'),
      [
        '# Auth TCs',
        '## Ngoài phạm vi kiểm thử',
        '| REQ ID | Lý do |',
        '|---|---|',
        '| REQ-AUTH-02 | Đã gộp vào REQ-AUTH-01 |',
        '| REQ-AUTH-99 | Unknown out of scope REQ |',
        '## Danh sách TC',
        '| TC ID | REQ ID | Module | Risk Level | Test Scenario | Pre-Condition | Test Steps | Test Data | Expected Result | Priority | Automatable | Auto Type | Tags |',
        '|---|---|---|---|---|---|---|---|---|---|---|---|---|',
        '| CRM_AUTH_TC_001 | REQ-AUTH-01 | AUTH | High | Login ok | None | 1. Go | None | 1. Ok | High | Yes | UI | @Smoke |',
        '## Bảng Đối Soát Coverage',
        '| REQ ID | Số TC | Trạng thái |',
        '|---|---|---|',
        '| REQ-AUTH-01 | 5 | ✅ Covered |',
        '| REQ-AUTH-98 | 1 | ✅ Covered |',
      ].join('\n'),
      'utf8'
    );

    const oosAndCovCheck = validateDocsTree(tmpParityAndOrphanRoot, { module: 'AUTH' });
    assert.ok(
      oosAndCovCheck.referentialErrors.some((e) =>
        e.message.includes('Out-of-scope table references unknown REQ ID "REQ-AUTH-99"')
      ),
      'validateDocsTree must flag unknown REQ ID in out-of-scope table'
    );
    assert.ok(
      oosAndCovCheck.referentialErrors.some((e) =>
        e.message.includes('Coverage table references unknown REQ ID "REQ-AUTH-98"')
      ),
      'validateDocsTree must flag unknown REQ ID in Bảng Đối Soát Coverage'
    );
    assert.ok(
      oosAndCovCheck.referentialErrors.some((e) =>
        e.message.includes('Coverage table "Số TC" mismatch for "REQ-AUTH-01": table declares 5 but 1 TCs reference "REQ-AUTH-01"')
      ),
      'validateDocsTree must flag TC count mismatch in Bảng Đối Soát Coverage'
    );

    const authRtmColIsolation = computeTraceabilityReport(tmpParityAndOrphanRoot, { module: 'AUTH' });
    assert.equal(
      authRtmColIsolation.summary.inScopeReqs,
      1,
      'Mentioning REQ-AUTH-01 in the Lý do column of out-of-scope table must not mark REQ-AUTH-01 as out-of-scope'
    );
    assert.equal(authRtmColIsolation.summary.outOfScopeReqs, 1);

    // Verify fallback prefix resolution when Tài liệu column in requirements/README.md is "—"
    fs.writeFileSync(
      path.join(tmpParityAndOrphanRoot, 'docs', 'requirements', 'README.md'),
      [
        '# Danh mục Requirements',
        '## 1. Bảng danh mục module',
        '| Module | Prefix | Trạng thái recon | Mức phủ tài liệu | Tài liệu | REQ đã dùng | Mã kế tiếp | AMB treo | Cập nhật |',
        '|---|---|---|---|---|---|---|---|---|',
        '| Đơn hàng | `ORD` | 🟨 Đang khảo sát | ⬜ Trắng | — | — | `REQ-ORD-01` | — | 2026-10-17 |',
      ].join('\n'),
      'utf8'
    );
    const ordFallbackRes = computeTraceabilityReport(tmpParityAndOrphanRoot, { module: 'ORD' });
    assert.deepEqual(
      ordFallbackRes.modules,
      ['orders'],
      'resolveTargetModule must resolve prefix ORD to orders via fallback artifacts even when Tài liệu in requirements/README.md is —'
    );
    assert.equal(ordFallbackRes.summary.totalReqs, 1);

    // Verify secondary-system (_book-api) catalogs in testcases/_book-api/README.md and bugs/_book-api/README.md
    // and ensure bugs cataloged in secondary system do not trigger false-positive missing-bug errors in primary bugs/README.md
    const secReqDir = path.join(tmpParityAndOrphanRoot, 'docs', 'requirements', '_book-api', 'auth');
    const secTcDir = path.join(tmpParityAndOrphanRoot, 'docs', 'testcases', '_book-api', 'auth');
    const secBugDir = path.join(tmpParityAndOrphanRoot, 'docs', 'bugs', '_book-api', 'auth');
    for (const d of [secReqDir, secTcDir, secBugDir]) {
      fs.mkdirSync(d, { recursive: true });
    }
    fs.writeFileSync(
      path.join(secReqDir, 'requirements_auth.md'),
      [
        '# Book API Auth Reqs',
        '| REQ ID | Tên yêu cầu | Mô tả | Acceptance Criteria | Trạng thái | Cập nhật lần cuối | Nguồn |',
        '|---|---|---|---|---|---|---|',
        '| REQ-BK-AUTH-01 | Token | Desc | AC | 🟢 Active | — | API |',
      ].join('\n'),
      'utf8'
    );
    fs.writeFileSync(
      path.join(secTcDir, 'test_cases_auth.md'),
      [
        '# Book API Auth TCs',
        '| TC ID | REQ ID | Module | Risk Level | Test Scenario | Pre-Condition | Test Steps | Test Data | Expected Result | Priority | Automatable | Auto Type | Tags |',
        '|---|---|---|---|---|---|---|---|---|---|---|---|---|',
        '| BK_AUTH_TC_001 | REQ-BK-AUTH-01 | BK-AUTH | High | Token ok | None | 1. Call | None | 1. 200 | High | Yes | API | @Smoke |',
      ].join('\n'),
      'utf8'
    );
    fs.writeFileSync(
      path.join(secBugDir, 'BUG_auth_200_TC001.md'),
      [
        '# [BUG] Secondary API auth failure',
        '## Thông tin chung',
        '- **ID:** BUG_auth_200_TC001',
        '- **Mức độ nghiêm trọng (Severity):** 🟠 Major',
        '- **Độ ưu tiên (Priority):** P2',
        '- **Test case liên quan:** BK_AUTH_TC_001',
        '- **REQ ID liên quan:** REQ-BK-AUTH-01',
      ].join('\n'),
      'utf8'
    );
    fs.writeFileSync(
      path.join(tmpParityAndOrphanRoot, 'docs', 'requirements', '_book-api', 'README.md'),
      [
        '# Book API Requirements',
        '| Module | Prefix | Trạng thái recon | Mức phủ tài liệu | Tài liệu | REQ đã dùng | Mã kế tiếp | AMB treo | Cập nhật |',
        '|---|---|---|---|---|---|---|---|---|',
        '| Auth API | `BK-AUTH` | ✅ Đã có tài liệu | 🟩 Đầy đủ | [auth/requirements_auth.md](auth/requirements_auth.md) | `REQ-BK-AUTH-01` → `REQ-BK-AUTH-01` (1) | `REQ-BK-AUTH-02` | — | 2026-10-17 |',
      ].join('\n'),
      'utf8'
    );
    fs.writeFileSync(
      path.join(tmpParityAndOrphanRoot, 'docs', 'testcases', '_book-api', 'README.md'),
      [
        '# Book API Test Cases',
        '| Module | Prefix TC ID | Dải đã dùng | Mã kế tiếp | Số TC | Độ hạt | REQ bao phủ | Tài liệu | Cập nhật |',
        '|---|---|---|---|---|---|---|---|---|',
        '| Auth API | `BK_AUTH_TC_` | `001` → `001` | `002` | 1 | GỘP | 1/1 | [auth/test_cases_auth.md](auth/test_cases_auth.md) | 2026-10-17 |',
      ].join('\n'),
      'utf8'
    );
    fs.writeFileSync(
      path.join(tmpParityAndOrphanRoot, 'docs', 'bugs', '_book-api', 'README.md'),
      [
        '# Book API Bugs',
        '## 1. Danh mục bug',
        '| Mã bug | Module | Tiêu đề ngắn | Severity | Priority | Trạng thái | TC liên quan | Ngày phát hiện |',
        '|---|---|---|---|---|---|---|---|',
        '| [BUG_auth_200_TC001](auth/BUG_auth_200_TC001.md) | `BK-AUTH` | Secondary API auth failure | 🟠 Major | P2 | 🔴 **Đang mở** | `BK_AUTH_TC_001` | 2026-10-17 |',
        '## 2. Thống kê theo trạng thái',
        '| Trạng thái | Số lượng | Ý nghĩa |',
        '|---|---|---|',
        '| 🔴 Đang mở | 1 | open |',
        '| 🟢 Đã đóng | 0 | closed |',
      ].join('\n'),
      'utf8'
    );

    const secRtmByPrefix = computeTraceabilityReport(tmpParityAndOrphanRoot, { module: 'BK-AUTH' });
    assert.deepEqual(
      secRtmByPrefix.modules,
      ['_book-api/auth'],
      'resolveTargetModule must resolve secondary-system prefix BK-AUTH to _book-api/auth'
    );
    const secCheck = validateDocsTree(tmpParityAndOrphanRoot);
    assert.ok(
      !secCheck.referentialErrors.some((e) => e.message.includes('BUG_auth_200_TC001')),
      'Secondary-system bug cataloged in docs/bugs/_book-api/README.md must not trigger false-positive missing-bug error in primary docs/bugs/README.md'
    );

    // Module-scoped two-stage orphanScripts filtering test:
    // - CRM_AUTH_TC_999 (matches AUTH prefix) and LEGACY_UNKNOWN_TC_777 (non-standard TC ID in auth-smoke.spec.ts) -> included in AUTH
    // - CRM_ORD_TC_888 placed inside tests/auth/auth.spec.ts -> excluded from AUTH because its TC ID explicitly belongs to ORD, and included in ORD
    fs.writeFileSync(
      path.join(testsAuthDir, 'auth.spec.ts'),
      'test("CRM_AUTH_TC_001 and orphan CRM_AUTH_TC_999 and cross-module CRM_ORD_TC_888", async () => {});\n',
      'utf8'
    );
    fs.writeFileSync(
      path.join(tmpParityAndOrphanRoot, 'tests', 'auth-smoke.spec.ts'),
      'test("non-standard orphan LEGACY_UNKNOWN_TC_777 in auth-smoke.spec.ts", async () => {});\n',
      'utf8'
    );
    fs.writeFileSync(
      path.join(testsOrdDir, 'orders.spec.ts'),
      'test("CRM_ORD_TC_001", async () => {});\n',
      'utf8'
    );

    const authScopedRtm = computeTraceabilityReport(tmpParityAndOrphanRoot, { module: 'AUTH' });
    assert.deepEqual(
      authScopedRtm.orphanScripts.map((o) => o.tcId).sort(),
      ['CRM_AUTH_TC_999', 'LEGACY_UNKNOWN_TC_777'],
      'Module-scoped computeTraceabilityReport({ module: "AUTH" }) must include CRM_AUTH_TC_999 and path-matched LEGACY_UNKNOWN_TC_777 while excluding CRM_ORD_TC_888'
    );

    const ordScopedRtm = computeTraceabilityReport(tmpParityAndOrphanRoot, { module: 'ORD' });
    assert.deepEqual(
      ordScopedRtm.orphanScripts.map((o) => o.tcId),
      ['CRM_ORD_TC_888'],
      'Module-scoped computeTraceabilityReport({ module: "ORD" }) must claim CRM_ORD_TC_888 by TC ID prefix even when located in another file'
    );

    const allRtm = computeTraceabilityReport(tmpParityAndOrphanRoot);
    assert.deepEqual(
      allRtm.orphanScripts.map((o) => o.tcId).sort(),
      ['CRM_AUTH_TC_999', 'CRM_ORD_TC_888', 'LEGACY_UNKNOWN_TC_777'],
      'Unscoped computeTraceabilityReport must include orphanScripts across all modules'
    );
  } finally {
    fs.rmSync(tmpParityAndOrphanRoot, { recursive: true, force: true });
  }
});

test('Seam 16: Real Bug/Execution Parsing Fidelity, Jira/Xray Edge Cases, and Metadata/AMB/User-Guide Parity Gates', async () => {
  // 1. Real repository bug reports preserve question-key bold KV, multi-line proposedFix, and notesOther
  const bug018Text = fs.readFileSync(
    path.join(REPO_ROOT, 'docs', 'bugs', 'login', 'BUG_login_1787226515_TC018.md'),
    'utf8'
  );
  const parsedBug018 = parseBugFile(bug018Text, 'BUG_login_1787226515_TC018.md');
  assert.match(
    parsedBug018.notesOther,
    /Đây có thực sự là bug không\?.*Cần cân nhắc kỹ trước khi fix/s,
    'parseBugFile must preserve bold question keys (**Đây có thực sự là bug không?**) in notesOther'
  );

  const bug029Text = fs.readFileSync(
    path.join(REPO_ROOT, 'docs', 'bugs', 'login', 'BUG_login_1787226517_TC029.md'),
    'utf8'
  );
  const parsedBug029 = parseBugFile(bug029Text, 'BUG_login_1787226517_TC029.md');
  assert.match(
    parsedBug029.notesOther,
    /Đây có phải hành vi mong muốn không\?/,
    'parseBugFile must preserve **Đây có phải hành vi mong muốn không?** in notesOther'
  );

  const bug039Text = fs.readFileSync(
    path.join(REPO_ROOT, 'docs', 'bugs', 'login', 'BUG_login_1785678750_TC039.md'),
    'utf8'
  );
  const parsedBug039 = parseBugFile(bug039Text, 'BUG_login_1785678750_TC039.md');
  assert.match(
    parsedBug039.proposedFix,
    /Cấu hình web server redirect.*Strict-Transport-Security.*12 lỗi CORS font/s,
    'parseBugFile must capture multi-line continuation under **Đề xuất:** into proposedFix'
  );
  assert.match(
    parsedBug039.notesOther,
    /Yếu tố giảm nhẹ.*Vì sao vẫn xếp Critical/s,
    'parseBugFile must capture multi-line continuation under Ghi chú bổ sung into notesOther'
  );

  // 2. Real execution report preserves raw Markdown evidence image links and Section 3 detailed Ghi chú
  const realExecText = fs.readFileSync(
    path.join(REPO_ROOT, 'docs', 'executions', 'login', 'run_1787215085', 'execution_report.md'),
    'utf8'
  );
  const parsedRealExec = parseExecutionReport(
    realExecText,
    'docs/executions/login/run_1787215085/execution_report.md'
  );
  const tc016Exec = parsedRealExec.tcs.find((t) => t.id === 'CRM_LOGIN_TC_016');
  assert.ok(tc016Exec, 'CRM_LOGIN_TC_016 must be parsed from real execution_report.md');
  assert.match(
    tc016Exec.evidence,
    /\(evidence\/TC_016_email_not_retained\.png\)/,
    'parseExecutionReport must preserve Markdown image link targets in Evidence cells'
  );
  assert.match(
    tc016Exec.note,
    /PO đã xác nhận là lỗi hệ thống/,
    'parseExecutionReport must preserve detailed Ghi chú from Section 3 FAIL detail tables'
  );

  // Also test parseBugFile & parseBugIndex with multi-word module, Jira Issue, and all 6 canonical statuses
  const customBugMd = [
    '# [BUG] Credit note rounding mismatch',
    '## Thông tin chung',
    '* **ID**: BUG_credit_notes_1700000001_TC005',
    '* **Mức độ nghiêm trọng (Severity):** 🟠 Major',
    '* **Độ ưu tiên (Priority):** P2',
    '* **Jira Issue:** FIN-404',
    '* **Test case liên quan:** CRM_CN_TC_005',
    '* **REQ ID liên quan:** REQ-CN-02',
  ].join('\n');
  const parsedCustomBug = parseBugFile(customBugMd, 'BUG_credit_notes_1700000001_TC005.md');
  assert.equal(parsedCustomBug.id, 'BUG_credit_notes_1700000001_TC005');
  assert.equal(parsedCustomBug.module, 'credit_notes');
  assert.equal(parsedCustomBug.jiraIssue, 'FIN-404');

  const customCatalogMd = [
    '# Danh mục Bug',
    '| Mã bug | Module | Tiêu đề ngắn | Severity | Priority | Trạng thái | TC liên quan | Ngày phát hiện |',
    '|---|---|---|---|---|---|---|---|',
    '| BUG_credit_notes_1700000001_TC005 | `CREDIT_NOTES` | Rounding | 🟠 Major | P2 | 🟡 **Fix một phần** (FIN-404) | CRM_CN_TC_005 | 2026-10-17 |',
    '| BUG_credit_notes_1700000002_TC006 | — | Blocked env | 🟡 Minor | P3 | ⚪ **Không verify được** | CRM_CN_TC_006 | 2026-10-17 |',
  ].join('\n');
  const parsedCustomIdx = parseBugIndex(customCatalogMd, 'README.md');
  assert.equal(parsedCustomIdx.rows.length, 2);
  assert.equal(parsedCustomIdx.rows[0].status, 'PARTIAL');
  assert.equal(parsedCustomIdx.rows[0].jiraIssue, 'FIN-404');
  assert.equal(parsedCustomIdx.rows[1].status, 'CANNOT_VERIFY');
  assert.equal(parsedCustomIdx.rows[1].module, 'credit_notes');

  // 3. Jira utils markdownToAdf <-> adfToMarkdown round-trip for blockquote, italic, strikethrough
  const jiraUtils = await import('./integrations/jira/utils.js');
  const richMd = [
    '> Quoted warning note',
    '',
    'Paragraph with **bold**, *italic*, ~~strikethrough~~, and `code`.',
  ].join('\n');
  const adfDoc = jiraUtils.markdownToAdf(richMd);
  assert.equal(adfDoc.content[0].type, 'blockquote');
  const roundTripMd = jiraUtils.adfToMarkdown(adfDoc);
  assert.match(roundTripMd, /^> Quoted warning note/m);
  assert.match(roundTripMd, /\*\*bold\*\*/);
  assert.match(roundTripMd, /\*italic\*/);
  assert.match(roundTripMd, /~~strikethrough~~/);
  assert.match(roundTripMd, /`code`/);

  // 4. Xray importer: testEntry.annotations fallback + JUnit <property name="test_key"> & XML entity/CDATA decoding
  const xrayImporter = await import('./integrations/jira/xray_importer.js');
  const pwConverted = xrayImporter.convertPlaywrightToXray({
    suites: [
      {
        title: 'Suite',
        specs: [
          {
            title: 'Test with testEntry annotations',
            tests: [
              {
                annotations: [{ type: 'test_key', description: 'PROJ-888' }],
                results: [{ status: 'passed', duration: 120, annotations: [] }],
              },
            ],
          },
        ],
      },
    ],
  });
  assert.equal(pwConverted.payload.tests.length, 1);
  assert.equal(pwConverted.payload.tests[0].testKey, 'PROJ-888');
  assert.equal(pwConverted.payload.tests[0].status, 'PASSED');

  const junitConverted = xrayImporter.convertJunitXmlToXray(
    [
      '<testsuite name="Suite">',
      '  <testcase name="Login XML entities">',
      '    <properties><property name="test_key" value="PROJ-889"/></properties>',
      '    <failure message="Expected &quot;200&quot; &amp; &lt;ok&gt;"><![CDATA[Stack trace details]]></failure>',
      '  </testcase>',
      '</testsuite>',
    ].join('\n')
  );
  assert.equal(junitConverted.payload.tests.length, 1);
  assert.equal(junitConverted.payload.tests[0].testKey, 'PROJ-889');
  assert.equal(junitConverted.payload.tests[0].status, 'FAILED');
  assert.match(junitConverted.payload.tests[0].comment, /Expected "200" & <ok>/);
  assert.match(junitConverted.payload.tests[0].comment, /Stack trace details/);
  assert.ok(!junitConverted.payload.tests[0].comment.includes('CDATA'));

  // 5. Secondary system Jira bug write-back & validateDocsTree metadata/AMB/user-guide/bug-status parity
  const tmpEdgeRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'validate-edge-gates-'));
  try {
    const reqDir = path.join(tmpEdgeRoot, 'docs', 'requirements', 'login');
    const tcDir = path.join(tmpEdgeRoot, 'docs', 'testcases', 'login');
    const ugDir = path.join(tmpEdgeRoot, 'docs', 'user-guides', 'login');
    const secBugDir = path.join(tmpEdgeRoot, 'docs', 'bugs', '_book-api', 'auth');
    for (const d of [reqDir, tcDir, ugDir, secBugDir]) {
      fs.mkdirSync(d, { recursive: true });
    }

    const bugCreatorMod = await import('./integrations/jira/jira_bug_creator.js');
    const secBugReadme = path.join(tmpEdgeRoot, 'docs', 'bugs', '_book-api', 'README.md');
    const secBugFile = path.join(secBugDir, 'BUG_auth_300_TC001.md');
    fs.writeFileSync(
      secBugFile,
      [
        '# [BUG] Sec bug',
        '## Thông tin chung',
        '- **ID:** BUG_auth_300_TC001',
        '- **Mức độ nghiêm trọng (Severity):** 🔴 Critical',
        '- **Độ ưu tiên (Priority):** P1',
      ].join('\n'),
      'utf8'
    );
    fs.writeFileSync(
      secBugReadme,
      [
        '# Sec Bugs',
        '| Mã bug | Module | Tiêu đề ngắn | Severity | Priority | Trạng thái | TC liên quan | Ngày phát hiện |',
        '|---|---|---|---|---|---|---|---|',
        '| [BUG_auth_300_TC001](auth/BUG_auth_300_TC001.md) | `BK-AUTH` | Sec bug | 🔴 Critical | P1 | 🔴 **Đang mở** | `BK_AUTH_TC_001` | 2026-10-17 |',
      ].join('\n'),
      'utf8'
    );
    bugCreatorMod.writeJiraKeyBackToBugFile(secBugFile, 'BK-101');
    assert.match(
      fs.readFileSync(secBugReadme, 'utf8'),
      /BK-101/,
      'writeJiraKeyBackToBugFile must update docs/bugs/_<system>/README.md for secondary system bugs'
    );

    // Write login module with intentional metadata, AMB, and user-guide mismatches
    fs.writeFileSync(
      path.join(reqDir, 'requirements_login.md'),
      [
        '# Login Reqs',
        '| Mục | Giá trị |',
        '|---|---|',
        '| **Tổng số REQ** | **99** |',
        '| **Dải mã đã dùng** | `REQ-LOGIN-01` → `REQ-LOGIN-02` · `AMB-01` → `AMB-02` |',
        '| **Mã kế tiếp** | `REQ-LOGIN-05` · `AMB-05` |',
        '| **Ambiguity còn treo** | **5** ❓ |',
        '## Danh sách REQ',
        '| REQ ID | Tên yêu cầu | Mô tả | Acceptance Criteria | Trạng thái | Cập nhật lần cuối | Nguồn |',
        '|---|---|---|---|---|---|---|',
        '| REQ-LOGIN-01 | Login | Desc | AC | 🟢 | — | DOM |',
        '| REQ-LOGIN-02 | Logout | Desc | AC | 🟢 | — | DOM |',
        '## Ambiguities',
        '| Mã | Câu hỏi | Nguy cơ | Mức độ | Assumption tạm | Trạng thái | Kết luận |',
        '|---|---|---|---|---|---|---|',
        '| AMB-01 | Q1? | R1 | 🔴 | A1 | ✅ Đã trả lời | Done |',
        '| AMB-02 | Q2? | R2 | 🟡 | A2 | ❓ Chờ trả lời | — |',
      ].join('\n'),
      'utf8'
    );
    fs.writeFileSync(
      path.join( tmpEdgeRoot, 'docs', 'requirements', 'README.md'),
      [
        '# Reqs Catalog',
        '| Module | Prefix | Trạng thái recon | Mức phủ tài liệu | Tài liệu | REQ đã dùng | Mã kế tiếp | AMB treo | Cập nhật |',
        '|---|---|---|---|---|---|---|---|---|',
        '| Đăng nhập | `LOGIN` | ✅ Đã có tài liệu | 🟩 Đầy đủ | [login/requirements_login.md](login/requirements_login.md) | `REQ-LOGIN-01` → `REQ-LOGIN-02` (2) | `REQ-LOGIN-03` | 2 🔴 · 0 🟡 (1 đã đóng) | 2026-10-17 |',
      ].join('\n'),
      'utf8'
    );
    fs.writeFileSync(
      path.join(tcDir, 'test_cases_login.md'),
      [
        '# Login TCs',
        '| Thông tin | Nội dung |',
        '|---|---|',
        '| **Dải TC ID** | `CRM_LOGIN_TC_001` → `CRM_LOGIN_TC_002` |',
        '| **Mã kế tiếp** | `CRM_LOGIN_TC_009` |',
        '## Danh sách TC',
        '| TC ID | REQ ID | Module | Risk Level | Test Scenario | Pre-Condition | Test Steps | Test Data | Expected Result | Priority | Automatable | Auto Type | Tags |',
        '|---|---|---|---|---|---|---|---|---|---|---|---|---|',
        '| CRM_LOGIN_TC_001 | REQ-LOGIN-01 | LOGIN | High | S1 | None | 1. Go | None | 1. Ok | High | Yes | UI | @Smoke |',
        '| CRM_LOGIN_TC_002 | REQ-LOGIN-02 | LOGIN | High | S2 | None | 1. Go | None | 1. Ok | High | Yes | UI | @Smoke |',
      ].join('\n'),
      'utf8'
    );
    fs.writeFileSync(
      path.join(ugDir, 'user_guide_login.md'),
      [
        '# User Guide Login',
        '| | |',
        '|---|---|',
        '| Phiên bản tài liệu | v1.0 |',
        '| Trạng thái | ✅ Đã phát hành |',
        '## 6. Vùng chưa xác minh (nội bộ)',
        '| Nội dung | Vì sao chưa xác minh | Ảnh hưởng |',
        '|---|---|---|',
        '| Item 1 | Reason 1 | Impact 1 |',
      ].join('\n'),
      'utf8'
    );
    fs.writeFileSync(
      path.join(tmpEdgeRoot, 'docs', 'user-guides', 'README.md'),
      [
        '# User Guides Catalog',
        '| Module | Đối tượng đọc | Áp dụng cho phiên bản | Số việc | Phiên bản tài liệu | Còn ⚠️ chưa xác minh | Trạng thái phát hành | Cập nhật |',
        '|---|---|---|---|---|---|---|---|',
        '| [Đăng nhập](login/user_guide_login.md) | Nội bộ | 2026 | 1 | v2.0 | **9** | ✅ Đã gỡ mục 6 | 2026-10-17 |',
      ].join('\n'),
      'utf8'
    );

    // Verify unknown_login does NOT falsely match login via cleanToken stripping
    const unknownLoginRes = validateDocsTree(tmpEdgeRoot, { module: 'unknown_login' });
    assert.ok(
      unknownLoginRes.referentialErrors.some((e) => e.message.includes('Unknown target module "unknown_login"')),
      'resolveTargetModule must not strip leading word_ from non-TC queries like unknown_login'
    );

    const edgeRes = validateDocsTree(tmpEdgeRoot);
    assert.ok(
      edgeRes.referentialErrors.some((e) => e.message.includes('Requirements metadata "Tổng số REQ" mismatch')),
      'validateDocsTree must detect Tổng số REQ mismatch in requirements_<module>.md metadata'
    );
    assert.ok(
      edgeRes.schemaViolations.some((e) => e.message.includes('Requirements metadata REQ ID range discontinuity')),
      'validateDocsTree must detect REQ ID range discontinuity in requirements_<module>.md metadata'
    );
    assert.ok(
      edgeRes.schemaViolations.some((e) => e.message.includes('Requirements metadata AMB ID range discontinuity')),
      'validateDocsTree must detect AMB ID range discontinuity in requirements_<module>.md metadata'
    );
    assert.ok(
      edgeRes.referentialErrors.some((e) => e.message.includes('Requirements metadata "Ambiguity còn treo" mismatch')),
      'validateDocsTree must detect Ambiguity còn treo mismatch in requirements_<module>.md metadata'
    );
    assert.ok(
      edgeRes.referentialErrors.some((e) => e.message.includes('Requirements Catalog "AMB treo" count mismatch for module "login" (🔴)')),
      'validateDocsTree must detect AMB treo severity count mismatch in docs/requirements/README.md'
    );
    assert.ok(
      edgeRes.schemaViolations.some((e) => e.message.includes('Test Cases metadata ID range discontinuity')),
      'validateDocsTree must detect TC ID range discontinuity in test_cases_<module>.md metadata'
    );
    assert.ok(
      edgeRes.referentialErrors.some((e) => e.message.includes('User Guides Catalog version mismatch for module "login"')),
      'validateDocsTree must detect version mismatch between docs/user-guides/README.md and user_guide_<module>.md'
    );
    assert.ok(
      edgeRes.referentialErrors.some((e) => e.message.includes('User Guides Catalog "Còn ⚠️ chưa xác minh" count mismatch')),
      'validateDocsTree must detect unverified count mismatch between docs/user-guides/README.md and user_guide_<module>.md'
    );
    assert.ok(
      edgeRes.referentialErrors.some((e) => e.message.includes('still contains internal section "Vùng chưa xác minh"')),
      'validateDocsTree must detect released User Guide that still contains Section 6 Vùng chưa xác minh'
    );

    // 6. Verify extractBoldKV nested sub-bullets, headings/rules, and trailing unindented paragraphs
    const nestedBug = parseBugFile(
      [
        '# [BUG] Nested sub-bullets & trailing paragraph',
        '## Thông tin chung',
        '- **ID:** BUG_login_20261017_TC099',
        '- **Ngày phát hiện:** 2026-10-17',
        '',
        'Đoạn văn chung bên dưới không thuộc trường Ngày phát hiện.',
        '> Blockquote lưu ý thêm',
        '## Ghi chú thêm',
        '- **Root cause (nếu đã biết):**',
        '  - `AuthController` thiếu kiểm tra session',
        '- **Đề xuất fix:**',
        '  - **Bước 1:** Bổ sung middleware kiểm tra session',
        '  - **Bước 2:** Thêm integration test',
        '---',
        '### Ghi chú phụ',
        'Đoạn kết luận cuối trang.',
      ].join('\n'),
      'BUG_login_20261017_TC099.md'
    );
    assert.equal(
      nestedBug.dateFound,
      '2026-10-17',
      'extractBoldKV must not append trailing unindented paragraphs or blockquotes after a blank line to single-line bullet keys'
    );
    assert.match(nestedBug.proposedFix, /\*\*Bước 1:\*\* Bổ sung middleware/);
    assert.match(nestedBug.proposedFix, /\*\*Bước 2:\*\* Thêm integration test/);
    assert.equal(
      nestedBug.notesOther,
      '',
      'extractBoldKV must keep indented sub-bullets with bold labels inside their parent key instead of leaking into notesOther'
    );

    // 7. Verify parseExecutionReport merges distinct Section 2 + Section 3 notes and captures HTML <img> evidence
    const mergedExec = parseExecutionReport(
      [
        '# Báo cáo thực thi — Module Login',
        '| Thông tin | Nội dung |',
        '|---|---|',
        '| **Module** | `LOGIN` |',
        '| **Run ID** | `run_300` |',
        '## 2. Kết quả từng TC',
        '| TC ID | Test Scenario | Kết quả | Bước fail | Ghi chú |',
        '|---|---|---|---|---|',
        '| CRM_LOGIN_TC_001 | Login fail | ❌ FAIL | Bước 2 | Redirect sai URL <img src="evidence/tc001.png"> |',
        '## 3. Chi tiết TC FAIL',
        '### CRM_LOGIN_TC_001 · Login fail',
        '| Thuộc tính | Nội dung |',
        '|---|---|',
        '| **Ghi chú** | Root URL tự chuyển sang /admin/authentication |',
      ].join('\n'),
      'execution_report.md'
    );
    assert.equal(mergedExec.tcs.length, 1);
    assert.equal(
      mergedExec.tcs[0].note,
      'Redirect sai URL <img src="evidence/tc001.png"> — Root URL tự chuyển sang /admin/authentication',
      'parseExecutionReport must merge distinct Section 2 and Section 3 notes when Section 2 note does not say "xem chi tiết"'
    );
    assert.match(
      mergedExec.tcs[0].evidence,
      /evidence\/tc001\.png/,
      'parseExecutionReport must capture HTML <img> evidence in Section 2 notes'
    );

    // 8. Verify extractEvidencePaths supports HTML <img> and backticked repo-relative paths
    const evDir = path.join(tmpEdgeRoot, 'docs', 'executions', 'login', 'run_300', 'evidence');
    fs.mkdirSync(evDir, { recursive: true });
    const evImg1 = path.join(evDir, 'html_shot.png');
    const evImg2 = path.join(evDir, 'backtick_shot.png');
    fs.writeFileSync(evImg1, 'png1', 'utf8');
    fs.writeFileSync(evImg2, 'png2', 'utf8');
    const bugDirLogin = path.join(tmpEdgeRoot, 'docs', 'bugs', 'login');
    fs.mkdirSync(bugDirLogin, { recursive: true });
    const bugFilePath = path.join(bugDirLogin, 'BUG_login_300_TC001.md');
    const extractedEv = bugCreatorMod.extractEvidencePaths(
      [
        '- HTML tag: <img src="../../executions/login/run_300/evidence/html_shot.png">',
        '- Repo-relative backtick: `docs/executions/login/run_300/evidence/backtick_shot.png`',
      ].join('\n'),
      bugFilePath
    );
    assert.deepEqual(extractedEv, [evImg1, evImg2]);

    // 9. Verify multi-file requirement module (stories/ or parts/) validates Tổng số REQ and Ambiguity còn treo across split files
    const multiReqDir = path.join(tmpEdgeRoot, 'docs', 'requirements', 'projects');
    const multiStoriesDir = path.join(multiReqDir, 'stories');
    fs.mkdirSync(multiStoriesDir, { recursive: true });
    fs.writeFileSync(
      path.join(multiReqDir, 'requirements_projects.md'),
      [
        '# Projects Reqs',
        '| Mục | Giá trị |',
        '|---|---|',
        '| **Tổng số REQ** | **5** |',
        '| **Ambiguity còn treo** | **3** ❓ |',
      ].join('\n'),
      'utf8'
    );
    fs.writeFileSync(
      path.join(multiStoriesDir, 'story_01.md'),
      [
        '# Story 01',
        '| REQ ID | Tên yêu cầu | Mô tả | Acceptance Criteria | Trạng thái | Cập nhật lần cuối | Nguồn |',
        '|---|---|---|---|---|---|---|',
        '| REQ-PROJ-01 | Create project | Desc | AC | 🟢 | — | DOM |',
        '## Ambiguities',
        '| Mã | Câu hỏi | Nguy cơ | Mức độ | Assumption tạm | Trạng thái | Kết luận |',
        '|---|---|---|---|---|---|---|',
        '| AMB-01 | Open Q? | R1 | 🔴 | A1 | ❓ Chờ trả lời | — |',
      ].join('\n'),
      'utf8'
    );
    const multiRes = validateDocsTree(tmpEdgeRoot, { module: 'projects' });
    assert.ok(
      multiRes.referentialErrors.some(
        (e) =>
          e.file.includes('requirements_projects.md') &&
          e.message.includes('Requirements metadata "Tổng số REQ" mismatch')
      ),
      'validateDocsTree must check Tổng số REQ on requirements_<module>.md even when REQs are split across stories/ or parts/'
    );
    assert.ok(
      multiRes.referentialErrors.some(
        (e) =>
          e.file.includes('requirements_projects.md') &&
          e.message.includes('Requirements metadata "Ambiguity còn treo" mismatch')
      ),
      'validateDocsTree must check Ambiguity còn treo on requirements_<module>.md against open AMBs aggregated across split files'
    );
  } finally {
    fs.rmSync(tmpEdgeRoot, { recursive: true, force: true });
  }
});

test('Seam 17: Viewer Core Edge Cases (Code Fences, Backticked Bug IDs, RTM Placeholders, Summary NOT_FIXED & Prefix Matching, Evidence Chips) and In-Process Viewer DOM Runtime', async () => {
  // 1. extractBoldKV: fenced code blocks, '+' bullets, ordered list with bold items, and unindented paragraph separation
  const kv = extractBoldKV([
    '+ **Payload mẫu:**',
    '```json',
    '{',
    '  "#comment": "not a heading",',
    '  "pipe": "a | b"',
    '}',
    '',
    '```',
    '- **Đề xuất fix:**',
    '1. **Backend:** Kiểm tra chữ ký số.',
    '2. **Frontend:** Hiển thị thông báo lỗi.',
    '- **Ngày phát hiện:** 2026-08-20',
    'Đoạn văn rời phía dưới không được gộp vào Ngày phát hiện.',
  ]);
  assert.ok(kv['Payload mẫu'].includes('"#comment": "not a heading"'));
  assert.ok(kv['Payload mẫu'].includes('"pipe": "a | b"'));
  assert.equal(
    kv['Đề xuất fix'],
    '1. **Backend:** Kiểm tra chữ ký số.\n2. **Frontend:** Hiển thị thông báo lỗi.'
  );
  assert.equal(kv['Ngày phát hiện'], '2026-08-20');

  // 2. isBugFile & parseBugFile: backticked Bug IDs, Mã bug alias, and placeholder Build / Version
  const backtickBugMd = [
    '# [BUG] Lỗi đăng nhập khi dùng mật khẩu có ký tự đặc biệt',
    '## Thông tin chung',
    '- **Mã bug:** `BUG_login_1787226599_TC099`',
    '- **Severity:** 🔴 Critical',
    '- **Priority:** P1',
    '- **Môi trường:** `Staging`',
    '- **Build / Version:** —',
    '- **Test case liên quan:** `TC_LOGIN_099`',
    '- **REQ ID liên quan:** `REQ-LOGIN-001`',
    '- **Ngày phát hiện:** `2026-08-21`',
  ].join('\n');
  assert.equal(isBugFile(backtickBugMd), true);
  const parsedBacktickBug = parseBugFile(backtickBugMd, 'BUG_login_1787226599_TC099.md');
  assert.equal(parsedBacktickBug.id, 'BUG_login_1787226599_TC099');
  assert.equal(parsedBacktickBug.module, 'login');
  assert.equal(parsedBacktickBug.env, 'Staging');
  assert.equal(parsedBacktickBug.build, '');
  assert.equal(parsedBacktickBug.dateFound, '2026-08-21');

  const idxParsed = parseBugIndex(
    [
      '| Mã Bug | Module | Tiêu đề | Severity | Priority | Trạng thái | TC liên quan | Ngày phát hiện |',
      '|---|---|---|---|---|---|---|---|',
      '| `BUG_login_1787226599_TC099` | login | Tóm tắt từ README | 🔴 Critical | P1 | 🔴 Open | TC_LOGIN_099 | 2026-08-21 |',
    ].join('\n'),
    'README.md'
  );
  const deduped = dedupeBugs([...idxParsed.rows, parsedBacktickBug]);
  assert.equal(deduped.length, 1);
  assert.equal(deduped[0].kind, 'bug');
  const catalogQuery = queryBugsCatalog(deduped);
  assert.equal(
    catalogQuery.alerts.missingRef.length,
    1,
    'Placeholder Build / Version (—) must be stripped to empty string so missingRef alert triggers'
  );

  // 3. parseRtm: non-automated text placeholders and declared status overrides
  const rtmTables = parseMarkdownTables(
    [
      '## Ma trận truy vết',
      '| REQ ID | Mô tả | TC IDs | Automation | Trạng thái |',
      '|---|---|---|---|---|',
      '| REQ-AUTH-001 | Đăng nhập | TC_AUTH_01, TC_AUTH_02 | Chưa automate | 🟡 Manual only |',
      '| REQ-AUTH-002 | Quên mật khẩu | TC_AUTH_03, TC_AUTH_04 | auth.spec.ts | 🟠 Partial |',
      '| REQ-AUTH-003 | Đổi mật khẩu | TC_AUTH_05, TC_AUTH_06 | 0/2 | 🟡 Mới có TC thủ công |',
      '| REQ-AUTH-004 | SSO | — | Không có | 🔴 Chưa có TC |',
    ].join('\n')
  );
  const rtm = parseRtm(rtmTables, 'rtm.md', 'RTM');
  assert.equal(rtm.rtm.rows[0].nAuto, 0);
  assert.equal(rtm.rtm.rows[0].status, 'MANUAL');
  assert.equal(rtm.rtm.rows[1].nAuto, 1);
  assert.equal(rtm.rtm.rows[1].status, 'PARTIALCOV');
  assert.equal(rtm.rtm.rows[2].nAuto, 0);
  assert.equal(rtm.rtm.rows[2].status, 'MANUAL');
  assert.equal(rtm.rtm.rows[3].nAuto, 0);
  assert.equal(rtm.rtm.rows[3].status, 'NOTCOVERED');

  // 4. parseTestSummary: NOT_FIXED vs FIXED/CLOSED bug statuses and prefix/slug module matching
  const summaryMd = [
    '# Báo cáo Tổng hợp Kiểm thử',
    '## Kết quả theo Module',
    '| Module | Prefix | Tổng TC | PASS | FAIL | BLOCKED | SKIP | Pass rate | Nguồn |',
    '|---|---|---|---|---|---|---|---|---|',
    '| Customers (`CUST`) | CUST | 10 | 8 | 2 | 0 | 0 | 80.0% | run_01 |',
    '## Danh sách Bug đang mở',
    '| Mã Bug | Module | Tiêu đề | Severity | Priority | TC / REQ | Trạng thái |',
    '|---|---|---|---|---|---|---|',
    '| BUG_cust_100_TC01 | CUST | Lỗi 1 chưa fix | 🔴 Critical | P1 | TC_CUST_01 | ❌ NOT_FIXED |',
    '| BUG_cust_101_TC02 | customers | Lỗi 2 sửa một phần | 🟠 High | P2 | TC_CUST_02 | 🟠 PARTIAL |',
    '| BUG_cust_102_TC03 | CUST | Lỗi 3 đã đóng | 🟡 Medium | P3 | TC_CUST_03 | ✅ FIXED |',
  ].join('\n');
  const parsedSum = parseTestSummary(summaryMd, 'test_summary_report.md');
  assert.equal(parsedSum.openBugs[0].status, 'OPEN');
  assert.equal(parsedSum.openBugs[1].status, 'PARTIAL');
  assert.equal(parsedSum.openBugs[2].status, 'CLOSED');
  assert.equal(
    parsedSum.modules[0].openBugs,
    2,
    'Module Customers (CUST) must match both CUST and customers non-CLOSED bugs'
  );
  assert.equal(parsedSum.totals.openBugsTotal, 2);

  // 5. extractEvidenceImages & renderEvidenceHtml: backticked filename without slash, plain path with slash, markdown links
  const evRaw =
    'Ảnh: `TC_01_fail.png`, evidence/TC_02_fail.png, ![shot](<docs/executions/login/run_1/evidence/TC_03.png> "title")';
  const emptyEv = extractEvidenceImages(evRaw, new Map());
  assert.deepEqual(
    emptyEv.items.map((i) => ({ baseName: i.baseName, loaded: i.loaded })),
    [
      { baseName: 'TC_03.png', loaded: false },
      { baseName: 'TC_01_fail.png', loaded: false },
      { baseName: 'TC_02_fail.png', loaded: false },
    ]
  );
  assert.equal(emptyEv.missingCount, 3);
  const loadedMap = new Map([['tc_01_fail.png', 'blob:mock/1']]);
  const bugsEvHtml = renderEvidenceHtml(evRaw, loadedMap, 'bugs');
  assert.ok(bugsEvHtml.includes('data-img="TC_01_fail.png"'));
  assert.ok(bugsEvHtml.includes('ev-chip miss'));
  assert.ok(bugsEvHtml.includes('2 ảnh còn thiếu'));

  // 6. Jira ADF nested link marks and <br> hardBreak round-trip
  const { adfToMarkdown, markdownToAdf } = await import('./integrations/jira/utils.js');
  const mdWithFormattedLinks = [
    'Xem ticket [`QA-101`](https://jira.example.com/browse/QA-101) và [**Spec**](https://jira.example.com/spec).',
    '',
    '| Bước | Kỳ vọng |',
    '| --- | --- |',
    '| Bước 1<br>Bước 2 | Hiển thị `OK` |',
  ].join('\n');
  const adfDoc = markdownToAdf(mdWithFormattedLinks);
  const roundTripMd = adfToMarkdown(adfDoc);
  assert.ok(roundTripMd.includes('[`QA-101`](https://jira.example.com/browse/QA-101)'));
  assert.ok(roundTripMd.includes('[**Spec**](https://jira.example.com/spec)'));
  assert.ok(roundTripMd.includes('Bước 1<br>Bước 2'));

  // 7. In-process DOM execution of scripts/bugs-viewer/bundle.html and scripts/execution-viewer/bundle.html
  function createViewerDomSandbox(htmlFilePath) {
    const html = fs.readFileSync(htmlFilePath, 'utf8');
    const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/);
    assert.ok(scriptMatch, `Missing <script> in ${htmlFilePath}`);
    const elements = new Map();
    const downloads = [];
    const makeClassList = () => {
      const set = new Set();
      return {
        add: (...cls) => cls.forEach((c) => set.add(c)),
        remove: (...cls) => cls.forEach((c) => set.delete(c)),
        toggle: (c, force) => {
          const on = force === undefined ? !set.has(c) : Boolean(force);
          if (on) set.add(c);
          else set.delete(c);
          return on;
        },
        contains: (c) => set.has(c),
      };
    };
    const makeEl = (id = '') => ({
      id,
      value: '',
      innerHTML: '',
      textContent: '',
      src: '',
      download: '',
      href: '',
      dataset: {},
      style: { display: '', cssText: '' },
      classList: makeClassList(),
      addEventListener() {},
      removeAttribute(attr) {
        if (attr === 'src') this.src = '';
      },
      appendChild() {},
      remove() {},
      click() {
        if (this.download) downloads.push({ download: this.download, href: this.href });
      },
      closest() {
        return null;
      },
    });
    const tabs = ['tc', 'trend', 'bug', 'cov', 'sum'].map((t) => {
      const el = makeEl();
      el.dataset.tab = t;
      return el;
    });
    const getEl = (sel) => {
      if (!elements.has(sel)) {
        const id = sel.startsWith('#') ? sel.slice(1) : '';
        elements.set(sel, makeEl(id));
      }
      return elements.get(sel);
    };
    const storage = new Map();
    const sandbox = {
      console,
      Blob,
      Uint8Array,
      DataView,
      TextEncoder,
      Map,
      Set,
      Promise,
      Math,
      Date,
      JSON,
      String,
      Number,
      Boolean,
      Array,
      Object,
      RegExp,
      setTimeout: (fn) => {
        fn();
        return 1;
      },
      URL: {
        createObjectURL: (obj) => `blob:mock/${obj?.name || 'data'}`,
        revokeObjectURL: () => {},
      },
      localStorage: {
        getItem: (k) => (storage.has(k) ? storage.get(k) : null),
        setItem: (k, v) => storage.set(k, String(v)),
        removeItem: (k) => storage.delete(k),
      },
      document: {
        body: makeEl('body'),
        querySelector: (sel) => getEl(sel),
        querySelectorAll: (sel) => (sel === '.tab' ? tabs : []),
        createElement: (tag) => makeEl(tag),
        addEventListener() {},
      },
    };
    sandbox.window = sandbox;
    vm.runInNewContext(scriptMatch[1], sandbox, { filename: htmlFilePath });
    return { sandbox, elements, getEl, downloads };
  }

  // 7a. Execute bugs-viewer/bundle.html in-process
  const bugsEnv = createViewerDomSandbox(
    path.join(REPO_ROOT, 'scripts', 'bugs-viewer', 'bundle.html')
  );
  bugsEnv.sandbox.addFiles([
    { name: 'TC_099_fail.png' },
    { name: 'BUG_login_1787226599_TC099.md', text: async () => backtickBugMd },
  ]);
  await new Promise((r) => setImmediate(r));
  assert.equal(bugsEnv.sandbox.__rows.length, 1);
  assert.ok(bugsEnv.getEl('#rows').innerHTML.includes('BUG_login_1787226599_TC099'));
  bugsEnv.sandbox.openDetail(bugsEnv.sandbox.__rows[0]);
  assert.equal(bugsEnv.getEl('#detail').classList.contains('open'), true);
  bugsEnv.sandbox.openLightbox('TC_099_fail.png');
  assert.equal(bugsEnv.getEl('#lightbox').classList.contains('open'), true);
  assert.equal(bugsEnv.getEl('#lbImg').src, 'blob:mock/TC_099_fail.png');
  bugsEnv.sandbox.closeLightbox();
  assert.equal(bugsEnv.getEl('#lightbox').classList.contains('open'), false);
  bugsEnv.sandbox.toCsv();
  bugsEnv.sandbox.toXlsx();
  assert.equal(bugsEnv.downloads.length, 2);
  assert.ok(bugsEnv.downloads[0].download.endsWith('.csv'));
  assert.ok(bugsEnv.downloads[1].download.endsWith('.xlsx'));

  // 7b. Execute execution-viewer/bundle.html in-process
  const execEnv = createViewerDomSandbox(
    path.join(REPO_ROOT, 'scripts', 'execution-viewer', 'bundle.html')
  );
  const sampleExecMd = fs.readFileSync(
    path.join(REPO_ROOT, 'docs', 'executions', 'login', 'run_1787215085', 'execution_report.md'),
    'utf8'
  );
  execEnv.sandbox.addFiles([
    { name: 'TC_LOGIN_016_fail.png' },
    { name: 'execution_report.md', text: async () => sampleExecMd },
    { name: 'test_summary_report.md', text: async () => summaryMd },
  ]);
  await new Promise((r) => setImmediate(r));
  assert.ok(execEnv.sandbox.__rows.length > 0);
  execEnv.sandbox.openDetail(
    execEnv.sandbox.__rows[0],
    execEnv.sandbox.__rows[0].id,
    execEnv.sandbox.__rows[0].scenario || '',
    [
      ['Kết quả', 'status'],
      ['Evidence', 'evidence'],
    ]
  );
  assert.equal(execEnv.getEl('#detail').classList.contains('open'), true);
  execEnv.sandbox.setActiveTab('sum');
  execEnv.sandbox.renderSummary();
  assert.ok(execEnv.getEl('#sumContent').innerHTML.includes('Customers'));
  execEnv.sandbox.toCsv();
  execEnv.sandbox.toXlsx();
  assert.equal(execEnv.downloads.length, 2);

  // Exercise cov, trend, and bug tabs in execution-viewer DOM sandbox
  const rtmSampleMd = [
    '# Ma Trận Truy Vết (RTM) — Login',
    '',
    '| REQ ID | Mô tả | TC IDs | Automation | Trạng thái |',
    '| --- | --- | --- | --- | --- |',
    '| REQ-LOGIN-01 | Đăng nhập | LOGIN_TC_001 | `login.spec.ts` (1/1) | ✅ Đầy đủ |',
  ].join('\n');
  const retestSampleMd = [
    '# Báo cáo Retest — Login · retest_1787299999',
    '',
    '| Trường | Giá trị |',
    '| --- | --- |',
    '| Module | Login |',
    '| Retest ID | retest_1787299999 |',
    '| Build | v1.0.2 |',
    '',
    '### BUG_login_1787226514_TC016',
    '| Trường | Giá trị |',
    '| --- | --- |',
    '| Bug | BUG_login_1787226514_TC016 |',
    '| Kết quả | ✅ FIXED |',
    '| TC / REQ liên quan | CRM_LOGIN_TC_016 · REQ-LOGIN-05 |',
  ].join('\n');
  execEnv.sandbox.addFiles([
    { name: 'traceability_matrix.md', text: async () => rtmSampleMd },
    { name: 'retest_report.md', text: async () => retestSampleMd },
  ]);
  await new Promise((r) => setImmediate(r));
  execEnv.sandbox.setActiveTab('cov');
  execEnv.sandbox.renderCoverage();
  assert.ok(execEnv.getEl('#covRows').innerHTML.includes('REQ-LOGIN-01'));
  execEnv.sandbox.setActiveTab('trend');
  execEnv.sandbox.render();
  assert.ok(execEnv.getEl('#trendRows').innerHTML.includes('CRM_LOGIN_TC_016'));
  execEnv.sandbox.setActiveTab('bug');
  execEnv.sandbox.render();
  assert.ok(execEnv.getEl('#bugRows').innerHTML.includes('BUG_login_1787226514_TC016'));
});

test('Seam 18: Multi-mark ADF, nested lists, extractBoldKV hardening, bug status/dedupe/module parity, total-row guard, multi-part run ordering, and testcases-viewer export', async () => {
  const { adfToMarkdown, markdownToAdf } = await import('./integrations/jira/utils.js');
  const {
    extractEvidencePaths,
    updateBugMarkdownWithJiraKey,
    updateBugsCatalogWithJiraKey,
  } = await import('./integrations/jira/jira_bug_creator.js');
  const {
    classifyBugStatus,
    compareRunOrder,
    computeExecutionTrend,
    dedupeBugs,
    extractBoldKV,
    parseBugFile,
    parseBugIndex,
    parseExecutionReport,
    parseMarkdownFile,
    parseTestSummary,
  } = await import('./viewer-core.mjs');
  const { classifyReqStatus, computeTestSummaryReport, validateDocsTree } = await import(
    './validate-docs.mjs'
  );
  const { exportCsv, exportXlsx } = await import('./testcases-viewer/src/lib/export.ts');

  // 1. Multi-mark inline combinations, mixed-format links, nested lists, + bullets, and ~~~ code fences
  const complexMd = [
    'Đoạn có ***bold italic***, **bold with *italic* and `code`**, và link [Click **here** now](https://example.com/docs).',
    '',
    '- Parent 1',
    '  - Child 1a',
    '    1. Grandchild 1a-i',
    '  - Child 1b',
    '+ Parent 2',
    '',
    '~~~c++',
    'int main() { return 0; }',
    '~~~',
  ].join('\n');
  const complexAdf = markdownToAdf(complexMd);
  const paraContent = complexAdf.content[0].content;
  const boldItalicNode = paraContent.find((n) => n.text === 'bold italic');
  assert.ok(boldItalicNode, 'Must parse ***bold italic*** into text node');
  assert.equal(boldItalicNode.marks.some((m) => m.type === 'strong'), true);
  assert.equal(boldItalicNode.marks.some((m) => m.type === 'em'), true);

  const nestedCodeNode = paraContent.find((n) => n.text === 'code');
  assert.ok(nestedCodeNode, 'Must parse `code` nested inside **bold**');
  assert.equal(nestedCodeNode.marks.some((m) => m.type === 'code'), true);
  assert.equal(nestedCodeNode.marks.some((m) => m.type === 'strong'), true);

  const bulletListNode = complexAdf.content.find((n) => n.type === 'bulletList');
  assert.ok(bulletListNode, 'Must parse bulletList');
  assert.equal(bulletListNode.content.length, 2, 'Top-level bulletList must have 2 parent items');
  const subBulletList = bulletListNode.content[0].content.find((n) => n.type === 'bulletList');
  assert.ok(subBulletList, 'Parent 1 must contain nested bulletList');
  const grandOrderedList = subBulletList.content[0].content.find((n) => n.type === 'orderedList');
  assert.ok(grandOrderedList, 'Child 1a must contain nested orderedList');

  const codeBlockNode = complexAdf.content.find((n) => n.type === 'codeBlock');
  assert.ok(codeBlockNode, 'Must parse ~~~c++ code fence');
  assert.equal(codeBlockNode.attrs.language, 'c++');

  const roundTripComplex = adfToMarkdown(complexAdf);
  assert.ok(roundTripComplex.includes('***bold italic***'));
  assert.ok(roundTripComplex.includes('**`code`**'));
  assert.ok(roundTripComplex.includes('[Click **here** now](https://example.com/docs)'));
  assert.ok(roundTripComplex.includes('  - Child 1a\n    1. Grandchild 1a-i'));

  // 2. extractBoldKV sibling bullet, table, and multi-line HTML comment isolation
  const kvEdge = extractBoldKV([
    '- **Test data đã dùng:** `user=admin`',
    '- Ghi chú ngoài không có bold key',
    '<!--',
    'Multi-line comment should be ignored',
    '-->',
    '- **Môi trường:** Staging',
    '| Cột A | Cột B |',
    '| --- | --- |',
    '| 1 | 2 |',
    'Đoạn văn bên dưới bảng không thuộc Môi trường',
  ]);
  assert.equal(kvEdge['Test data đã dùng'], '`user=admin`');
  assert.equal(kvEdge['Môi trường'], 'Staging');

  // 3. Bug status classification, dedupeBugs metadata preservation, and numeric-first Bug ID module extraction
  assert.equal(classifyBugStatus('✅ FIXED'), 'CLOSED');
  assert.equal(classifyBugStatus('✅ Đã fix'), 'CLOSED');
  assert.equal(classifyBugStatus('🟡 Đã fix, chờ retest'), 'PENDING');
  assert.equal(classifyBugStatus('🟡 Chờ retest (Fixed by dev)'), 'PENDING');
  assert.equal(classifyBugStatus('⚠️ Cần rà lại'), 'NEEDS_REVIEW');

  const numIdBugMd = [
    '# [BUG] Lỗi với mã bug bắt đầu bằng timestamp',
    '',
    '## Thông tin chung',
    '- **Mã bug:** BUG_20260820_120000_TC001',
    '- **Module:** Customers',
    '- **Severity:** 🟠 Major',
    '- **Priority:** P2',
    '- **Trạng thái:** 🟡 Đã fix, chờ retest (PROJ-777)',
  ].join('\n');
  const parsedNumIdBug = parseBugFile(numIdBugMd, 'BUG_20260820_120000_TC001.md');
  assert.equal(parsedNumIdBug.module, 'customers');
  assert.equal(parsedNumIdBug.status, 'PENDING');
  assert.equal(parsedNumIdBug.jiraIssue, 'PROJ-777');

  const openBugFile = parseBugFile(
    [
      '# [BUG] Lỗi chưa có bảng retest',
      '',
      '## Thông tin chung',
      '- **ID:** BUG_login_1787226500_TC002',
      '- **Severity:** 🟠 Major',
      '- **Priority:** P2',
    ].join('\n'),
    'BUG_login_1787226500_TC002.md'
  );
  const catalogReadme = parseBugIndex(
    [
      '| Mã Bug | Module | Tiêu đề | Severity | Priority | Trạng thái | TC liên quan | Ngày phát hiện |',
      '| --- | --- | --- | --- | --- | --- | --- | --- |',
      '| [BUG_login_1787226500_TC002](login/BUG_login_1787226500_TC002.md) | Login | Lỗi chưa có bảng retest | 🟠 Major | P2 | 🟡 Chờ retest (PROJ-888) | LOGIN_TC_002 | 2026-08-20 |',
    ].join('\n'),
    'README.md'
  );
  const dedupedA = dedupeBugs([...catalogReadme.rows, openBugFile]);
  const dedupedB = dedupeBugs([openBugFile, ...catalogReadme.rows]);
  assert.equal(dedupedA[0].status, 'PENDING');
  assert.equal(dedupedA[0].jiraIssue, 'PROJ-888');
  assert.equal(dedupedB[0].status, 'PENDING');
  assert.equal(dedupedB[0].jiraIssue, 'PROJ-888');

  // 4. parseTestSummary total-row guard and Phạm vi · Build · Môi trường metadata key
  const summaryWithTotalsMd = [
    '# Báo Cáo Tổng Hợp Kiểm Thử',
    '',
    '| Trường | Giá trị |',
    '| --- | --- |',
    '| Phạm vi · Build · Môi trường | Sprint 12 · v2.1.0 · Staging |',
    '',
    '## 4. Kết Quả Theo Module',
    '| Module | Prefix | Tổng TC | PASS | FAIL | BLOCKED | SKIPPED | Pass Rate | Nguồn |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- |',
    '| Login (`LOGIN`) | LOGIN | 10 | 8 | 2 | 0 | 0 | 80.0% | `run_1` |',
    '| **Tổng** | — | **10** | **8** | **2** | **0** | **0** | **80.0%** | — |',
    '',
    '## 5. Tổng Hợp Lỗi',
    '| Severity | Tổng số | Đang mở | Đã đóng |',
    '| --- | --- | --- | --- |',
    '| 🟠 Major | 2 | 1 | 1 |',
    '| **Tổng cộng** | **2** | **1** | **1** |',
  ].join('\n');
  const parsedSummaryWithTotals = parseTestSummary(summaryWithTotalsMd, 'test_summary_report.md');
  assert.equal(parsedSummaryWithTotals.module, 'Sprint 12 · v2.1.0 · Staging');
  assert.equal(parsedSummaryWithTotals.modules.length, 1);
  assert.equal(parsedSummaryWithTotals.totals.total, 10);
  assert.equal(parsedSummaryWithTotals.totals.pass, 8);
  assert.equal(parsedSummaryWithTotals.defectSummary.length, 1);
  assert.equal(parsedSummaryWithTotals.totals.openBugsTotal, 1);

  // 5. extractEvidencePaths with <...> and title, updateBugMarkdownWithJiraKey with Mã bug, and updateBugsCatalogWithJiraKey blockquote safety
  const tmpJiraDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jira-edge-18-'));
  try {
    const evDir = path.join(tmpJiraDir, 'docs', 'executions', 'login', 'run_1', 'evidence');
    const bugDir = path.join(tmpJiraDir, 'docs', 'bugs', 'login');
    fs.mkdirSync(evDir, { recursive: true });
    fs.mkdirSync(bugDir, { recursive: true });
    const imgPath = path.join(evDir, 'shot_1.png');
    fs.writeFileSync(imgPath, 'png', 'utf8');

    const bugFile = path.join(bugDir, 'BUG_login_1787226514_TC016.md');
    const bugContent = [
      '# [BUG] Test Jira write-back',
      '',
      '## Thông tin chung',
      '- **Mã bug:** BUG_login_1787226514_TC016',
      '- **Severity:** 🟠 Major',
      '',
      '## Evidence',
      '- ![Shot](<../../executions/login/run_1/evidence/shot_1.png> "Screenshot 1")',
    ].join('\n');
    fs.writeFileSync(bugFile, bugContent, 'utf8');

    const resolvedEv = extractEvidencePaths(bugContent, bugFile);
    assert.deepEqual(resolvedEv, [imgPath]);

    assert.equal(updateBugMarkdownWithJiraKey(bugFile, 'QA-555'), true);
    const updatedBugMd = fs.readFileSync(bugFile, 'utf8');
    assert.ok(updatedBugMd.includes('- **Mã bug:** BUG_login_1787226514_TC016\n- **Jira Issue:** QA-555'));

    const readmeFile = path.join(tmpJiraDir, 'docs', 'bugs', 'README.md');
    fs.writeFileSync(
      readmeFile,
      [
        '| Mã Bug | Module | Tiêu đề | Severity | Priority | Trạng thái | TC liên quan | Ngày phát hiện |',
        '| --- | --- | --- | --- | --- | --- | --- | --- |',
        '| [BUG_login_1787226514_TC016](login/BUG_login_1787226514_TC016.md) | Login | Test | 🟠 Major | P2 | 🔴 Đang mở | LOGIN_TC_016 | 2026-08-20 |',
        '',
        '> Lưu ý: `BUG_login_1787226514_TC016` cần kiểm tra lại trên môi trường Staging.',
      ].join('\n'),
      'utf8'
    );
    assert.equal(
      updateBugsCatalogWithJiraKey(readmeFile, 'BUG_login_1787226514_TC016', 'QA-555'),
      true
    );
    const updatedReadme = fs.readFileSync(readmeFile, 'utf8');
    assert.ok(updatedReadme.includes('| 🔴 Đang mở (QA-555) |'));
    assert.ok(
      updatedReadme.includes(
        '> Lưu ý: `BUG_login_1787226514_TC016` cần kiểm tra lại trên môi trường Staging.'
      ) && !updatedReadme.includes('Staging. (QA-555)')
    );
  } finally {
    fs.rmSync(tmpJiraDir, { recursive: true, force: true });
  }

  // 6. Multi-part timestamp ordering in compareRunOrder & computeExecutionTrend + backticked note evidence in parseExecutionReport
  assert.ok(compareRunOrder('run_2026_08_20_1500', 'run_2026_08_21_0900') < 0);
  assert.ok(compareRunOrder('run_2026-08-20', 'run_2026-09-05') < 0);

  const runDay1 = parseExecutionReport(
    [
      '# Execution Report — Login · run_2026_08_20_1500',
      '| Trường | Giá trị |',
      '| --- | --- |',
      '| Module | Login |',
      '| Run ID | run_2026_08_20_1500 |',
      '',
      '| TC ID | Kịch bản | Kết quả | Ghi chú |',
      '| --- | --- | --- | --- |',
      '| LOGIN_TC_001 | Đăng nhập | ❌ FAIL | Ảnh lỗi `evidence/TC001_fail.png` |',
    ].join('\n'),
    'run_2026_08_20_1500/execution_report.md'
  );
  assert.ok(runDay1.tcs[0].evidence.includes('TC001_fail.png'));

  const runDay2 = parseExecutionReport(
    [
      '# Execution Report — Login · run_2026_08_21_0900',
      '| Trường | Giá trị |',
      '| --- | --- |',
      '| Module | Login |',
      '| Run ID | run_2026_08_21_0900 |',
      '',
      '| TC ID | Kịch bản | Kết quả | Ghi chú |',
      '| --- | --- | --- | --- |',
      '| LOGIN_TC_001 | Đăng nhập | ✅ PASS | Đã chạy xanh |',
    ].join('\n'),
    'run_2026_08_21_0900/execution_report.md'
  );
  const trendRows = computeExecutionTrend([runDay2, runDay1]);
  assert.equal(trendRows.length, 1);
  assert.equal(trendRows[0].grp, 'FIXEDTREND');
  assert.equal(trendRows[0].seq[0].run, 'run_2026_08_20_1500');
  assert.equal(trendRows[0].seq[1].run, 'run_2026_08_21_0900');

  // 7. classifyReqStatus parity with out-of-scope requirement text
  assert.equal(classifyReqStatus('Ngoài phạm vi'), 'UNIMPLEMENTED');
  assert.equal(classifyReqStatus('Đã bỏ'), 'DEPRECATED');

  // 8. Direct execution of exportCsv and exportXlsx in scripts/testcases-viewer/src/lib/export.ts
  const parsedTcFile = parseMarkdownFile(
    'test_cases_login.md',
    fs.readFileSync(path.join(REPO_ROOT, 'docs', 'testcases', 'login', 'test_cases_login.md'), 'utf8')
  );
  const exportedDownloads = [];
  const origDoc = globalThis.document;
  const origCreateObjUrl = URL.createObjectURL;
  const origRevokeObjUrl = URL.revokeObjectURL;
  try {
    URL.createObjectURL = (blob) => {
      exportedDownloads.push({ size: blob.size, type: blob.type });
      return 'blob:tc-export';
    };
    URL.revokeObjectURL = () => {};
    globalThis.document = {
      body: {
        appendChild() {},
      },
      createElement() {
        return {
          href: '',
          download: '',
          click() {
            exportedDownloads[exportedDownloads.length - 1].download = this.download;
          },
          remove() {},
        };
      },
    };
    exportCsv(parsedTcFile.testCases.slice(0, 3), 'login_tcs');
    exportXlsx(parsedTcFile.testCases.slice(0, 3), 'login_tcs');
    assert.equal(exportedDownloads.length, 2);
    assert.ok(exportedDownloads[0].download.startsWith('login_tcs_') && exportedDownloads[0].download.endsWith('.csv'));
    assert.ok(exportedDownloads[0].size > 100);
    assert.ok(exportedDownloads[1].download.startsWith('login_tcs_') && exportedDownloads[1].download.endsWith('.xlsx'));
    assert.ok(exportedDownloads[1].size > 500);
  } finally {
    globalThis.document = origDoc;
    URL.createObjectURL = origCreateObjUrl;
    URL.revokeObjectURL = origRevokeObjUrl;
  }
});

test('Seam 19: GFM separator cell validation, code-fence section/table isolation, XLSX status/sheet hardening, CommonMark link pointers, single/multi-range ID continuity, ADF status/date/media/expand, multi-project Xray, and viewer docKey/row highlight', async () => {
  const {
    isSeparatorRow,
    splitSections,
    extractBoldKV,
    resolveXlsxStatusStyle,
    buildSheetXml,
    safeSheetName,
  } = await import('./viewer-core.mjs');
  const { parseEnvContent, adfToMarkdown, markdownToAdf } = await import(
    './integrations/jira/utils.js'
  );
  const { convertPlaywrightToXray, convertJunitXmlToXray } = await import(
    './integrations/jira/xray_importer.js'
  );

  // 1. GFM isSeparatorRow cell-level validation
  assert.equal(isSeparatorRow('| --- | :--- | ---: | :---: |'), true);
  assert.equal(isSeparatorRow('| -- -- | --- |'), false);
  assert.equal(isSeparatorRow('| : - : |'), false);
  assert.equal(isSeparatorRow('| : | - |'), false);

  // 2. splitSections, extractBoldKV, parseMarkdownFile & parseBugFile with nested CommonMark fences
  const bugWithCodeFenceHeadingAndTable = [
    '# BUG_login_1787299999_TC001 — Crash on login',
    '',
    '## Thông tin chung',
    '- **Module:** Login',
    '- **Severity:** 🔴 Critical',
    '- **Priority:** P1',
    '- **Trạng thái:** 🔴 Open',
    '- **Test case liên quan:** CRM_LOGIN_TC_001',
    '- **REQ ID liên quan:** REQ-LOGIN-01',
    '- **Build / Version:** v2.0',
    '- **Ngày phát hiện:** 2026-10-17',
    '',
    '## Steps to Reproduce',
    '1. Run nested markdown snippet:',
    '````markdown',
    '```bash',
    '# [BUG] Hijacked title inside nested fence',
    '## This bash comment inside code fence must not split Steps to Reproduce!',
    'echo "step 2"',
    '```',
    '## Still inside 4-backtick outer fence!',
    '````',
    '2. Observe crash',
    '',
    '## Expected Result',
    'No crash',
    '',
    '## Actual Result',
    'Crash occurred',
    '',
    '## Lịch sử retest',
    '```markdown',
    '| Ngày | Build | Kết quả | Retest Report | Ghi chú |',
    '|---|---|---|---|---|',
    '| 2026-10-18 | v2.0 | FIXED | ghost | Inside fence must be ignored |',
    '```',
    '| Ngày | Build | Kết quả | Retest Report | Ghi chú |',
    '|---|---|---|---|---|',
    '| 2026-10-19 | v2.1 | NOT_FIXED | retest_report.md | Real retest row |',
  ].join('\n');
  const sec = splitSections(bugWithCodeFenceHeadingAndTable);
  assert.equal(
    sec['This bash comment inside code fence must not split Steps to Reproduce!'],
    undefined
  );
  assert.equal(sec['Still inside 4-backtick outer fence!'], undefined);
  const parsedFenceBug = parseBugFile(
    bugWithCodeFenceHeadingAndTable,
    'BUG_login_1787299999_TC001.md'
  );
  assert.equal(parsedFenceBug.title, 'BUG_login_1787299999_TC001 — Crash on login');
  assert.ok(parsedFenceBug.steps.includes('2. Observe crash'));
  assert.equal(parsedFenceBug.retestCount, 1);
  assert.equal(parsedFenceBug.retest[0].build, 'v2.1');

  const kvNestedFence = extractBoldKV([
    '- **Snippet:**',
    '  ````markdown',
    '  ```json',
    '  {"a": 1}',
    '  ```',
    '  **BoldInsideOuterFence:** must stay inside Snippet',
    '  ````',
    '- **After:** clean value',
  ]);
  assert.ok(kvNestedFence.Snippet.includes('**BoldInsideOuterFence:** must stay inside Snippet'));
  assert.equal(kvNestedFence.BoldInsideOuterFence, undefined);
  assert.equal(kvNestedFence.After, 'clean value');

  const tcFileWithMockFence = [
    '```bash',
    '# Fake H1 inside code fence',
    '```',
    '# Test Cases — Login Real Title',
    '',
    '````markdown',
    '```markdown',
    '| TC ID | REQ ID | Module | Risk Level | Test Scenario | Pre-Condition | Test Steps | Test Data | Expected Result | Priority | Automatable | Auto Type | Tags |',
    '|---|---|---|---|---|---|---|---|---|---|---|---|---|',
    '| PHANTOM_TC_001 | REQ-LOGIN-01 | Login | High | Fake | — | 1. Fake | — | Fake | High | Yes | E2E | @smoke |',
    '```',
    '| TC ID | REQ ID | Module | Risk Level | Test Scenario | Pre-Condition | Test Steps | Test Data | Expected Result | Priority | Automatable | Auto Type | Tags |',
    '|---|---|---|---|---|---|---|---|---|---|---|---|---|',
    '| PHANTOM_TC_002 | REQ-LOGIN-01 | Login | High | Still inside 4-backtick fence | — | 1. Fake | — | Fake | High | Yes | E2E | @smoke |',
    '````',
    '',
    '## Nhóm Đăng nhập (1 TC)',
    '| TC ID | REQ ID | Module | Risk Level | Test Scenario | Pre-Condition | Test Steps | Test Data | Expected Result | Priority | Automatable | Auto Type | Tags |',
    '|---|---|---|---|---|---|---|---|---|---|---|---|---|',
    '| CRM_LOGIN_TC_001 | REQ-LOGIN-01 | Login | High | Real TC | — | 1. Login | — | OK | High | Yes | E2E | @smoke |',
  ].join('\n');
  const parsedFenceTcFile = parseMarkdownFile('test_cases_login.md', tcFileWithMockFence);
  assert.equal(parsedFenceTcFile.docTitle, 'Test Cases — Login Real Title');
  assert.equal(parsedFenceTcFile.testCases.length, 1);
  assert.equal(parsedFenceTcFile.testCases[0].id, 'CRM_LOGIN_TC_001');

  const execWithMockTableInCodeFence = [
    '# Báo cáo thực thi — Login',
    '',
    '| Trường | Giá trị |',
    '|---|---|',
    '| Module | Login |',
    '| Run ID | run_fence_test |',
    '',
    '```markdown',
    '| TC ID | Test Scenario | Kết quả | Bước fail | Ghi chú |',
    '|---|---|---|---|---|',
    '| PHANTOM_TC_999 | Should be ignored | ❌ FAIL | 1 | inside fence |',
    '```',
    '',
    '## Kết quả từng TC',
    '| TC ID | Test Scenario | Kết quả | Bước fail | Ghi chú |',
    '|---|---|---|---|---|',
    '| CRM_LOGIN_TC_001 | Real TC | ✅ PASS | — | ok |',
  ].join('\n');
  const parsedFenceExec = parseExecutionReport(execWithMockTableInCodeFence, 'execution_report.md');
  assert.equal(parsedFenceExec.tcs.length, 1);
  assert.equal(parsedFenceExec.tcs[0].id, 'CRM_LOGIN_TC_001');

  // 3. resolveXlsxStatusStyle, buildSheetXml, and safeSheetName hardening
  assert.equal(resolveXlsxStatusStyle('pass'), 3);
  assert.equal(resolveXlsxStatusStyle('✅ PASS'), 3);
  assert.equal(resolveXlsxStatusStyle('✅ Đạt'), 3);
  assert.equal(resolveXlsxStatusStyle('🟢 Đã đóng'), 3);
  assert.equal(resolveXlsxStatusStyle('❌ FAIL'), 4);
  assert.equal(resolveXlsxStatusStyle('❌ Chưa đạt'), 4);
  assert.equal(resolveXlsxStatusStyle('❌ **Không đạt**'), 4);
  assert.equal(resolveXlsxStatusStyle('**FAIL**'), 4);
  assert.equal(resolveXlsxStatusStyle('`PASS`'), 3);
  assert.equal(resolveXlsxStatusStyle('`NOT_FIXED`'), 4);
  assert.equal(resolveXlsxStatusStyle('🔴 **Critical**'), 4);
  assert.equal(resolveXlsxStatusStyle('**PASS (100%)**'), 3);
  assert.equal(resolveXlsxStatusStyle('🔴 Đang mở (PROJ-123)'), 4);
  assert.equal(resolveXlsxStatusStyle('critical'), 4);
  assert.equal(resolveXlsxStatusStyle('P0'), 4);
  assert.equal(resolveXlsxStatusStyle('P1'), 5);
  assert.equal(resolveXlsxStatusStyle('Major'), 5);
  assert.equal(resolveXlsxStatusStyle('⚠️ Đạt có điều kiện'), 5);
  assert.equal(resolveXlsxStatusStyle('🟡 GO CÓ ĐIỀU KIỆN'), 5);
  assert.equal(resolveXlsxStatusStyle('CONDITIONAL_GO'), 5);
  assert.equal(resolveXlsxStatusStyle('🟡 Chờ retest'), 5);
  assert.equal(resolveXlsxStatusStyle('P2'), 6);
  assert.equal(resolveXlsxStatusStyle('P3'), 6);
  assert.equal(resolveXlsxStatusStyle('Yes'), 3);
  assert.equal(resolveXlsxStatusStyle('Có'), 3);
  assert.equal(resolveXlsxStatusStyle('No'), 6);
  assert.equal(resolveXlsxStatusStyle('Không'), 6);
  assert.equal(resolveXlsxStatusStyle('PARTIAL'), 7);
  assert.equal(resolveXlsxStatusStyle('🟡 Một phần (PARTIAL)'), 7);
  assert.equal(resolveXlsxStatusStyle('unknown-token'), undefined);

  const sheetXml = buildSheetXml({
    name: 'Test',
    head: ['ID', 'Status', 'Priority'],
    rows: [
      ['TC_1', '✅ PASS', 'P0'],
      ['TC_2', '**FAIL**', 'P1'],
      ['TC_3', '🔴 Đang mở (PROJ-101)', 'Medium'],
    ],
    statusCol: 1,
    statusCols: [1, 2],
  });
  assert.match(sheetXml, /<c r="B2" s="3"/);
  assert.match(sheetXml, /<c r="C2" s="4"/);
  assert.match(sheetXml, /<c r="B3" s="4"/);
  assert.match(sheetXml, /<c r="C3" s="5"/);
  assert.match(sheetXml, /<c r="B4" s="4"/);
  assert.match(sheetXml, /<c r="C4" s="6"/);

  const takenNames = new Set();
  assert.equal(safeSheetName("'QuotedSheet'", takenNames), 'QuotedSheet');
  assert.equal(safeSheetName("  'SpacedQuotedSheet'  ", takenNames), 'SpacedQuotedSheet');
  assert.equal(safeSheetName('DefaultTakenOmitted'), 'DefaultTakenOmitted');
  assert.equal(safeSheetName('History', takenNames), 'History_Sheet');
  assert.equal(safeSheetName('history', takenNames), 'History_Sheet (2)');

  // 4. resolveContextPointers: tilde code fences, nested 4-backtick fences, HTML comments, CommonMark titles & angle brackets
  const pointerDoc = [
    'Valid link with title: [Claude Rules](CLAUDE.md "Main Rules")',
    'Valid angle-bracket link: [Playwright Rules](<.claude/rules/playwright_rules.md#1-mode> "PW")',
    'Template placeholder ignored: [Module Doc](docs/requirements/<module>/requirements_<module>.md)',
    '<!-- Broken link inside HTML comment must be ignored: [Ghost](docs/ghost_comment.md) `.claude/rules/ghost_comment.md` -->',
    '~~~markdown',
    '[Ghost in tilde fence](docs/ghost_tilde.md)',
    '`.claude/rules/ghost_tilde.md`',
    '~~~',
    '````markdown',
    '```bash',
    'echo "inner 3-backtick fence"',
    '```',
    '[Ghost after inner 3-backtick fence but inside 4-backtick outer fence](docs/ghost_nested_fence.md)',
    '````',
  ].join('\n');
  const resolvedPtrs = resolveContextPointers(pointerDoc, {
    sourceFile: path.join(REPO_ROOT, 'README.md'),
    repoRoot: REPO_ROOT,
  });
  assert.equal(resolvedPtrs.brokenPointers.length, 0);
  assert.equal(resolvedPtrs.pointers.length, 2);

  // 5. Single-ID and multi-range ID continuity validation + knownModule flag + P0/Nghiêm trọng in computeTestSummaryReport
  assert.equal(computeTraceabilityReport(REPO_ROOT, { module: 'login' }).knownModule, true);
  assert.equal(computeTraceabilityReport(REPO_ROOT, { module: 'nonexistent_xyz' }).knownModule, false);
  assert.equal(computeTestSummaryReport(REPO_ROOT, { module: 'login' }).knownModule, true);
  assert.equal(computeTestSummaryReport(REPO_ROOT, { module: 'nonexistent_xyz' }).knownModule, false);

  const tmpDocsRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'validate-range-continuity-'));
  try {
    fs.mkdirSync(path.join(tmpDocsRoot, 'docs', 'requirements', 'orders'), { recursive: true });
    fs.mkdirSync(path.join(tmpDocsRoot, 'docs', 'testcases', 'orders'), { recursive: true });
    fs.mkdirSync(path.join(tmpDocsRoot, 'docs', 'executions', 'orders', 'run_20260101'), {
      recursive: true,
    });
    fs.writeFileSync(
      path.join(tmpDocsRoot, 'docs', 'requirements', 'README.md'),
      [
        '# Requirements Catalog',
        '| Module | Prefix | File | Môi trường | Trạng thái | REQ đã dùng | Mã kế tiếp |',
        '|---|---|---|---|---|---|---|',
        '| [Orders](orders/requirements_orders.md) | `ORD` | [requirements_orders.md](orders/requirements_orders.md) | Web | ✅ Done | `REQ-ORD-01` (1) | `REQ-ORD-05` |',
      ].join('\n'),
      'utf8'
    );
    fs.writeFileSync(
      path.join(tmpDocsRoot, 'docs', 'requirements', 'orders', 'requirements_orders.md'),
      [
        '# Requirements — Orders',
        '| Trường | Giá trị |',
        '|---|---|',
        '| Tổng số REQ | 1 |',
        '| Dải mã đã dùng | `REQ-ORD-01` · `AMB-01` · `RISK-01` |',
        '| Mã kế tiếp | `REQ-ORD-02` · `AMB-05` · `RISK-06` |',
        '',
        '## Danh sách yêu cầu',
        '| REQ ID | Tiêu đề | Mô tả | Mức ưu tiên | Trạng thái | Nguồn |',
        '|---|---|---|---|---|---|',
        '| REQ-ORD-01 | Create order | Desc | High | ✅ Implemented | Spec |',
      ].join('\n'),
      'utf8'
    );
    fs.writeFileSync(
      path.join(tmpDocsRoot, 'docs', 'testcases', 'README.md'),
      [
        '# Test Cases Catalog',
        '| Module | Prefix TC ID | Dải đã dùng | Mã kế tiếp | Tổng số TC | File |',
        '|---|---|---|---|---|---|',
        '| [Orders](orders/test_cases_orders.md) | `CRM_ORD_TC_` | `CRM_ORD_TC_001` (1) | `CRM_ORD_TC_004` | 1 | [test_cases_orders.md](orders/test_cases_orders.md) |',
      ].join('\n'),
      'utf8'
    );
    fs.writeFileSync(
      path.join(tmpDocsRoot, 'docs', 'testcases', 'orders', 'test_cases_orders.md'),
      [
        '# Test Cases — Orders',
        '| Trường | Giá trị |',
        '|---|---|',
        '| Tổng số TC | 1 |',
        '| Dải TC ID | `CRM_ORD_TC_001` (1) |',
        '| Mã kế tiếp | `CRM_ORD_TC_003` |',
        '',
        '## Nhóm Order (1 TC)',
        '| TC ID | REQ ID | Module | Risk Level | Test Scenario | Pre-Condition | Test Steps | Test Data | Expected Result | Priority | Automatable | Auto Type | Tags |',
        '|---|---|---|---|---|---|---|---|---|---|---|---|---|',
        '| CRM_ORD_TC_001 | REQ-ORD-01 | Orders | Nghiêm trọng | Create order | Logged in | 1. Click | Valid | Created | P0 | Có | E2E | @smoke |',
      ].join('\n'),
      'utf8'
    );
    fs.writeFileSync(
      path.join(tmpDocsRoot, 'docs', 'executions', 'orders', 'run_20260101', 'execution_report.md'),
      [
        '# Execution Report — Orders',
        '| TC ID | Kịch bản | Kết quả | Evidence | Ghi chú |',
        '|---|---|---|---|---|',
        '| CRM_ORD_TC_001 | Create order | PASS | — | OK |',
      ].join('\n'),
      'utf8'
    );
    const rangeValidation = validateDocsTree(tmpDocsRoot);
    assert.equal(rangeValidation.valid, false);
    assert.ok(
      rangeValidation.schemaViolations.some((v) =>
        v.message.includes('Module Catalog ID range discontinuity for "[Orders]')
      )
    );
    assert.ok(
      rangeValidation.schemaViolations.some((v) =>
        v.message.includes('Requirements metadata AMB ID range discontinuity: max used is 1')
      )
    );
    assert.ok(
      rangeValidation.schemaViolations.some((v) =>
        v.message.includes('Requirements metadata RISK ID range discontinuity: max used is 1')
      )
    );
    assert.ok(
      rangeValidation.schemaViolations.some((v) =>
        v.message.includes('Test Cases Catalog ID range discontinuity')
      )
    );
    assert.ok(
      rangeValidation.schemaViolations.some((v) =>
        v.message.includes('Test Cases metadata ID range discontinuity')
      )
    );
    const ordSummary = computeTestSummaryReport(tmpDocsRoot, { module: 'orders' });
    assert.equal(ordSummary.execution.highPriorityPassRate, 100);
    assert.equal(ordSummary.coverage.criticalReqsTotal, 1);
    assert.equal(ordSummary.coverage.criticalReqsPassed, 1);
  } finally {
    fs.rmSync(tmpDocsRoot, { recursive: true, force: true });
  }

  // 6. Jira & Xray: quoted .env unescaping, ADF status/date/media/expand + 4-backtick codeBlock, multi-project Playwright & JUnit single-pass entities + indented CDATA
  const parsedEnv = parseEnvContent(
    [
      'DOUBLE_Q="Line 1\\nLine 2 \\"quoted\\" \\\\slash\\tEnd"',
      "SINGLE_Q='It\\'s a \\\\test'",
    ].join('\n')
  );
  assert.equal(parsedEnv.DOUBLE_Q, 'Line 1\nLine 2 "quoted" \\slash\tEnd');
  assert.equal(parsedEnv.SINGLE_Q, "It's a \\test");

  const adfFrom4Backtick = markdownToAdf(
    ['````markdown', '```json', '{"nested": true}', '```', '````'].join('\n')
  );
  assert.equal(adfFrom4Backtick.content.length, 1);
  assert.equal(adfFrom4Backtick.content[0].type, 'codeBlock');
  assert.ok(adfFrom4Backtick.content[0].content[0].text.includes('{"nested": true}'));

  const richAdf = {
    type: 'doc',
    version: 1,
    content: [
      {
        type: 'paragraph',
        content: [
          { type: 'status', attrs: { text: 'IN PROGRESS', color: 'blue' } },
          { type: 'text', text: ' Due: ' },
          { type: 'date', attrs: { timestamp: '1704067200000' } },
        ],
      },
      {
        type: 'expand',
        attrs: { title: 'Diagnostic Logs' },
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Stack trace line' }] }],
      },
      {
        type: 'mediaSingle',
        content: [
          {
            type: 'media',
            attrs: { id: 'att-123', alt: 'login_error.png', url: 'https://jira.example.com/att-123.png' },
          },
        ],
      },
    ],
  };
  const renderedAdf = adfToMarkdown(richAdf);
  assert.match(renderedAdf, /\[IN PROGRESS\] Due: 2024-01-01/);
  assert.match(renderedAdf, /\*\*Diagnostic Logs\*\*\nStack trace line/);
  assert.match(renderedAdf, /!\[login_error\.png\]\(https:\/\/jira\.example\.com\/att-123\.png\)/);

  const multiProjectPw = convertPlaywrightToXray(
    {
      suites: [
        {
          specs: [
            {
              title: 'Cross-browser checkout test',
              annotations: [{ type: 'test_key', description: 'PROJ-777' }],
              tests: [
                {
                  projectName: 'chromium',
                  results: [{ status: 'passed' }],
                },
                {
                  projectName: 'firefox',
                  results: [
                    {
                      status: 'failed',
                      errors: [{ message: 'Firefox button detached' }],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
    { projectKey: 'PROJ', platform: 'cloud' }
  );
  assert.equal(multiProjectPw.payload.tests.length, 1);
  assert.equal(multiProjectPw.payload.tests[0].testKey, 'PROJ-777');
  assert.equal(multiProjectPw.payload.tests[0].status, 'FAILED');
  assert.match(multiProjectPw.payload.tests[0].comment, /Firefox button detached/);

  const junitNumericAndSkip = convertJunitXmlToXray(
    [
      '<testsuite>',
      '  <testcase name="[PROJ-801] Check &#39;quote&#39; &amp; &#x3C;tag&#x3E; &amp;lt;literal&amp;gt; &#38;lt;escaped&#38;gt;">',
      '    <skipped message="Blocked by &#39;SSO&#39; maintenance"/>',
      '  </testcase>',
      '  <testcase classname="com.example.PROJ-802_AuthSpec" name="should handle indented CDATA">',
      '    <failure message="Assertion failed">',
      '      <![CDATA[Expected status 200 &amp; ok, got 500]]>',
      '    </failure>',
      '  </testcase>',
      '</testsuite>',
    ].join('\n'),
    { projectKey: 'PROJ', platform: 'cloud' }
  );
  assert.equal(junitNumericAndSkip.payload.tests.length, 2);
  assert.equal(junitNumericAndSkip.payload.tests[0].testKey, 'PROJ-801');
  assert.equal(junitNumericAndSkip.payload.tests[0].status, 'TODO');
  assert.equal(
    junitNumericAndSkip.payload.tests[0].comment,
    "Skipped: Blocked by 'SSO' maintenance"
  );
  assert.equal(junitNumericAndSkip.payload.tests[1].testKey, 'PROJ-802');
  assert.equal(junitNumericAndSkip.payload.tests[1].status, 'FAILED');
  assert.equal(
    junitNumericAndSkip.payload.tests[1].comment,
    'Failure: Assertion failed — Expected status 200 &amp; ok, got 500'
  );

  // 7. Standalone Viewers: execution-viewer docKey & SORT_VALUE.run, bugs-viewer row .sel, testcases-viewer bundle sync & runtime export execution, P0-P4/VI priority filtering & stats
  const execBundleSrc = fs.readFileSync(
    path.join(REPO_ROOT, 'scripts', 'execution-viewer', 'bundle.html'),
    'utf8'
  );
  assert.match(execBundleSrc, /function docKey\(d\)\{\s*return `\$\{d\.fileName\}\|\$\{d\.module\|\|''\}\|\$\{d\.runId\}`;\s*\}/);
  assert.match(execBundleSrc, /run:\s*t\s*=>\s*t\.runId\s*\|\|\s*''/);

  const bugsBundleSrc = fs.readFileSync(
    path.join(REPO_ROOT, 'scripts', 'bugs-viewer', 'bundle.html'),
    'utf8'
  );
  assert.match(bugsBundleSrc, /tr\.classList\.add\('sel'\)/);

  const tcBundleSrc = fs.readFileSync(
    path.join(REPO_ROOT, 'scripts', 'testcases-viewer', 'bundle.html'),
    'utf8'
  );
  assert.ok(
    tcBundleSrc.includes('/* __VIEWER_CORE_START__ */') &&
      tcBundleSrc.includes('/* __VIEWER_CORE_END__ */')
  );
  assert.match(tcBundleSrc, /parseMarkdownFile\(e\.name,e\.content\)/);
  assert.match(tcBundleSrc, /queryTestCases\(U,/);
  assert.match(tcBundleSrc, /buildCsvString\(e\)/);
  assert.match(tcBundleSrc, /buildXlsxBytes\(e\)/);

  // Execute the synchronized viewer-core script + export call expressions extracted from testcases-viewer/bundle.html in-process
  const coreScriptMatch = tcBundleSrc.match(
    /\/\* __VIEWER_CORE_START__ \*\/([\s\S]*?)\/\* __VIEWER_CORE_END__ \*\//
  );
  const csvCallMatch = tcBundleSrc.match(/new Blob\(\[(buildCsvString\([^)]+\))\]/);
  const xlsxCallMatch = tcBundleSrc.match(/new Blob\(\[(buildXlsxBytes\([^)]+\))\]/);
  assert.ok(coreScriptMatch && csvCallMatch && xlsxCallMatch);
  const vmSandbox = { TextEncoder, Uint8Array, Uint32Array, ArrayBuffer, DataView, Set, Map };
  vm.createContext(vmSandbox);
  vm.runInContext(
    `${coreScriptMatch[1]}\n` +
      `const parsed = parseMarkdownFile('tc.md', '# TCs\\n| TC ID | Risk Level | Test Scenario | Priority | Automatable |\\n|---|---|---|---|---|\\n| TC_01 | Cao | Login | P1 | Có |');\n` +
      `const q = queryTestCases([parsed], { priorities: ['high'], automatable: 'yes' });\n` +
      `const e = buildTestCasesExportPlan(q.filtered, q.exportBaseName);\n` +
      `globalThis.csvOut = ${csvCallMatch[1]};\n` +
      `globalThis.xlsxOut = ${xlsxCallMatch[1]};\n` +
      `globalThis.qStats = q.stats;\n` +
      `globalThis.qCount = q.filtered.length;\n`,
    vmSandbox
  );
  assert.equal(vmSandbox.qCount, 1);
  assert.equal(vmSandbox.qStats.high, 1);
  assert.match(vmSandbox.csvOut, /"TC_01"/);
  assert.equal(vmSandbox.xlsxOut[0], 0x50);
  assert.equal(vmSandbox.xlsxOut[1], 0x4b);

  const parsedPrioFile = parseMarkdownFile(
    'test_cases_prio.md',
    [
      '# Test Cases — Prio',
      '| TC ID | Risk Level | Test Scenario | Priority | Automatable |',
      '| --- | --- | --- | --- | --- |',
      '| TC-PRIO-01 | Thấp | Low P4 | P4 | Không |',
      '| TC-PRIO-02 | Nghiêm trọng | Critical VI | Nghiêm trọng | Có |',
      '| TC-PRIO-03 | Trung bình | Medium P2 | P2 | Yes |',
      '| TC-PRIO-04 | Cao | High VI | Cao | Có |',
      '| TC-PRIO-05 | Thấp | Low VI | Thấp | No |',
      '| TC-PRIO-06 | Critical | Critical P0 | P0 | Yes |',
      '| TC-PRIO-07 | High | High P1 | P1 | Partial |',
    ].join('\n')
  );
  const prioritySorted = queryTestCases([parsedPrioFile], {
    sort: { key: 'priority', dir: 1 },
  });
  assert.deepEqual(
    prioritySorted.filtered.map((tc) => tc.id),
    [
      'TC-PRIO-02',
      'TC-PRIO-06',
      'TC-PRIO-04',
      'TC-PRIO-07',
      'TC-PRIO-03',
      'TC-PRIO-05',
      'TC-PRIO-01',
    ]
  );
  assert.deepEqual(prioritySorted.stats, {
    critical: 2,
    high: 2,
    medium: 1,
    low: 2,
  });
  assert.deepEqual(
    queryTestCases([parsedPrioFile], { priorities: ['high'] }).filtered.map((tc) => tc.id),
    ['TC-PRIO-04', 'TC-PRIO-07']
  );
  assert.deepEqual(
    queryTestCases([parsedPrioFile], { priorities: ['critical'] }).filtered.map((tc) => tc.id),
    ['TC-PRIO-02', 'TC-PRIO-06']
  );
  assert.deepEqual(
    queryTestCases([parsedPrioFile], { priorities: ['low'] }).filtered.map((tc) => tc.id),
    ['TC-PRIO-01', 'TC-PRIO-05']
  );
  assert.deepEqual(
    queryTestCases([parsedPrioFile], { automatable: 'yes' }).filtered.map((tc) => tc.id),
    ['TC-PRIO-02', 'TC-PRIO-03', 'TC-PRIO-04', 'TC-PRIO-06']
  );
  assert.deepEqual(
    queryTestCases([parsedPrioFile], { automatable: 'no' }).filtered.map((tc) => tc.id),
    ['TC-PRIO-01', 'TC-PRIO-05']
  );
  assert.equal(resolveXlsxStatusStyle('P4'), 6);
});

