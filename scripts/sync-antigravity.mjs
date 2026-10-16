#!/usr/bin/env node
/**
 * Dual-Harness Synchronization & Skill Document Module (`scripts/sync-antigravity.mjs`)
 *
 * Deep module that owns:
 *   1. Skill & Workflow Dispatcher YAML frontmatter parsing (`parseSkillDocument`)
 *   2. Context Pointer extraction, code-block stripping, and target resolution (`resolveContextPointers`)
 *   3. Dual-Harness Sync from Claude Code (`.claude/`, `CLAUDE.md`, `.mcp.json`) to
 *      Antigravity (`AGENTS.md`, `.agents/skills/`, `.agents/skills.json`, `.agents/plugins/`)
 *      with zero duplicate skill registrations (`syncAntigravity`)
 *
 * Usage (CLI):
 *   node scripts/sync-antigravity.mjs [--check] [--root <dir>]
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildAntigravityMcpConfig } from './browser-mode.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const INLINE_TOKEN_REGEX = /`([^`\n]+)`|\[([^\]]+)\]\(([^)]+)\)/g;
const DISCLOSED_REF_REGEX = /\.claude\/skills\/[^)`\s*<>]+\/references\/[^)`\s*<>]+\.md/g;
const INLINE_REPO_PATH_REGEX =
  /^(?:(?:\.claude\/(?:rules|skills|commands|playwright-mcp-config\.json)|\.agents\/(?:skills|plugins|skills\.json)|scripts\/(?!integrations\b)|docs\/agents)(?:\/[A-Za-z0-9_.-]+)*\.(?:md|mjs|ts|html|json)|(?:CLAUDE|AGENTS|GLOSSARY)\.md)$/;

function parseArgs(argv) {
  let checkOnly = false;
  let rootDir = path.resolve(__dirname, '..');

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--check') {
      checkOnly = true;
    } else if (arg === '--root' && argv[i + 1]) {
      rootDir = path.resolve(argv[++i]);
    }
  }
  return { checkOnly, rootDir };
}

/**
 * Parses YAML frontmatter and document metrics for any Skill (`SKILL.md`) or
 * Workflow Dispatcher (`.claude/commands/<cmd>.md`).
 */
export function parseSkillDocument(content) {
  const lines = content.split(/\r?\n/);
  const bytes = Buffer.byteLength(content, 'utf8');

  if (lines[0] !== '---') {
    return {
      name: '',
      description: '',
      rawDescription: '',
      isDescriptionQuoted: false,
      hasUnquotedColon: false,
      skills: [],
      extraFrontmatterLines: [],
      body: content,
      rawFrontmatter: '',
      lines: lines.length,
      bytes,
    };
  }

  const endIdx = lines.indexOf('---', 1);
  if (endIdx === -1) {
    return {
      name: '',
      description: '',
      rawDescription: '',
      isDescriptionQuoted: false,
      hasUnquotedColon: false,
      skills: [],
      extraFrontmatterLines: [],
      body: content,
      rawFrontmatter: '',
      lines: lines.length,
      bytes,
    };
  }

  const fmLines = lines.slice(1, endIdx);
  const body = lines.slice(endIdx + 1).join('\n');
  let name = '';
  let description = '';
  let rawDescription = '';
  let isDescriptionQuoted = false;
  const skills = [];
  const extraFrontmatterLines = [];
  let inSkills = false;

  for (const line of fmLines) {
    if (line.startsWith('name:')) {
      name = line.slice('name:'.length).trim();
      inSkills = false;
    } else if (line.startsWith('description:')) {
      rawDescription = line.slice('description:'.length).trim();
      isDescriptionQuoted =
        (rawDescription.startsWith('"') && rawDescription.endsWith('"')) ||
        (rawDescription.startsWith("'") && rawDescription.endsWith("'"));
      if (isDescriptionQuoted) {
        try {
          description = JSON.parse(rawDescription);
        } catch {
          description = rawDescription.slice(1, -1);
        }
      } else {
        description = rawDescription;
      }
      inSkills = false;
    } else if (line.startsWith('skills:')) {
      inSkills = true;
    } else if (inSkills && /^\s*-\s+/.test(line)) {
      skills.push(line.replace(/^\s*-\s+/, '').trim());
    } else if (/^[a-zA-Z0-9_-]+:/.test(line)) {
      inSkills = false;
      extraFrontmatterLines.push(line);
    } else if (!inSkills && line.trim()) {
      extraFrontmatterLines.push(line);
    }
  }

  const hasUnquotedColon = !isDescriptionQuoted && rawDescription.includes(':');

  return {
    name,
    description,
    rawDescription,
    isDescriptionQuoted,
    hasUnquotedColon,
    skills,
    extraFrontmatterLines,
    body,
    rawFrontmatter: fmLines.join('\n'),
    lines: lines.length,
    bytes,
  };
}

/**
 * Strips fenced code blocks, then resolves both Markdown link Context Pointers `[label](target)`
 * (relative to `path.dirname(sourceFile)` or `repoRoot` if leading `/`) and inline-code
 * repo-relative Context Pointers (e.g., `` `.claude/rules/playwright_rules.md` ``), plus
 * verifies all Progressive Disclosure `.claude/skills/<skill>/references/*.md` paths.
 */
export function resolveContextPointers(content, { sourceFile, repoRoot }) {
  const withoutFenced = content.replace(/```[\s\S]*?```/g, '');
  const pointers = [];
  const brokenPointers = [];
  const seenResolved = new Set();

  function recordPointer(rawTarget, resolvedPath, kind) {
    const key = resolvedPath;
    if (seenResolved.has(key)) return;
    seenResolved.add(key);
    const exists = fs.existsSync(resolvedPath);
    const pointer = {
      rawTarget,
      resolvedPath,
      exists,
      kind,
    };
    pointers.push(pointer);
    if (!exists) {
      brokenPointers.push(pointer);
    }
  }

  for (const match of withoutFenced.matchAll(INLINE_TOKEN_REGEX)) {
    const inlineCode = match[1];
    const linkTarget = match[3];

    if (linkTarget) {
      const rawTarget = linkTarget.trim().split('#')[0];
      if (
        !rawTarget ||
        rawTarget.startsWith('http://') ||
        rawTarget.startsWith('https://') ||
        rawTarget.startsWith('mailto:') ||
        rawTarget.includes('<') ||
        rawTarget.includes('*')
      ) {
        continue;
      }

      const resolvedPath = rawTarget.startsWith('/')
        ? path.resolve(repoRoot, '.' + rawTarget)
        : path.resolve(path.dirname(sourceFile), rawTarget);
      recordPointer(rawTarget, resolvedPath, 'link');
    } else if (inlineCode) {
      const candidate = inlineCode.trim().split('#')[0];
      if (INLINE_REPO_PATH_REGEX.test(candidate)) {
        const resolvedPath = path.resolve(repoRoot, candidate);
        recordPointer(candidate, resolvedPath, 'code');
      }
    }
  }

  const disclosedSkillRefs = [...new Set(withoutFenced.match(DISCLOSED_REF_REGEX) ?? [])];
  let disclosedRefsBytes = 0;
  for (const relRef of disclosedSkillRefs) {
    const refPath = path.resolve(repoRoot, relRef);
    if (fs.existsSync(refPath)) {
      disclosedRefsBytes += fs.statSync(refPath).size;
    } else {
      recordPointer(relRef, refPath, 'disclosed-ref');
    }
  }

  return {
    pointers,
    brokenPointers,
    disclosedSkillRefs,
    disclosedRefsBytes,
  };
}

export function convertCommandToAntigravitySkill(cmdName, content) {
  const { description, skills, extraFrontmatterLines, body } = parseSkillDocument(content);
  const fmParts = [
    '---',
    `name: ${cmdName}`,
    `description: ${JSON.stringify(description)}`,
  ];
  if (skills.length > 0) {
    fmParts.push('skills:');
    for (const s of skills) {
      fmParts.push(`  - ${s}`);
    }
  }
  for (const extraLine of extraFrontmatterLines) {
    fmParts.push(extraLine);
  }
  fmParts.push('---');

  const rewrittenBody = body
    .replace(/\]\((?:\.\.|\.claude)\/skills\//g, '](../../../.claude/skills/')
    .replace(/\]\((?:\.\.|\.claude)\/rules\//g, '](../../../.claude/rules/')
    .replace(/\]\((?:\.\.|\.claude)\/commands\//g, '](../../../.claude/commands/');

  return `${fmParts.join('\n')}\n${rewrittenBody}`;
}

export function syncAntigravity(rootDir, { checkOnly = false } = {}) {
  const drift = [];
  const brokenSkillPointers = [];

  function ensureFile(relPath, expectedContent) {
    const absPath = path.join(rootDir, relPath);
    const currentContent = fs.existsSync(absPath) ? fs.readFileSync(absPath, 'utf8') : null;
    if (currentContent !== expectedContent) {
      drift.push(relPath);
      if (!checkOnly) {
        fs.mkdirSync(path.dirname(absPath), { recursive: true });
        fs.writeFileSync(absPath, expectedContent, 'utf8');
      }
    }
  }

  function ensureAbsent(relPath) {
    const absPath = path.join(rootDir, relPath);
    if (fs.existsSync(absPath)) {
      drift.push(relPath);
      if (!checkOnly) {
        fs.rmSync(absPath, { recursive: true, force: true });
      }
    }
  }

  // 1. Sync CLAUDE.md -> AGENTS.md
  const claudeMdPath = path.join(rootDir, 'CLAUDE.md');
  if (!fs.existsSync(claudeMdPath)) {
    throw new Error(`Missing CLAUDE.md at ${claudeMdPath}`);
  }
  const claudeMdContent = fs.readFileSync(claudeMdPath, 'utf8');
  ensureFile('AGENTS.md', claudeMdContent);

  // 2. Ensure .agents/skills.json registers only .claude/skills
  //    (.agents/skills is automatically discovered by Antigravity workspace discovery)
  const workspaceSkillsJson =
    JSON.stringify(
      {
        entries: [{ path: '.claude/skills' }],
      },
      null,
      2
    ) + '\n';
  ensureFile('.agents/skills.json', workspaceSkillsJson);

  // 3. Ensure .agents/plugins/claude-testing-skills/{plugin.json,mcp_config.json}
  //    and forbid duplicate skill registrations inside the plugin
  const pluginJson =
    JSON.stringify(
      {
        name: 'claude-testing-skills',
        displayName: 'QA Testing Skills (Claude & Antigravity)',
        version: '1.0.0',
        description:
          'End-to-End AI Manual Testing (AI-RBT 4 Modes x 4 Rings) & Test Automation Skill Suite with Playwright MCP.',
        suggestedPrompts: [
          '/discover-system Khám phá hệ thống và khởi tạo Module Catalog',
          '/generate-testcases-manual-rbt Sinh bộ Manual Test Cases theo chuẩn AI-RBT',
          '/browser-mode Kiểm tra trạng thái trình duyệt Headless/Headed',
        ],
      },
      null,
      2
    ) + '\n';
  ensureFile('.agents/plugins/claude-testing-skills/plugin.json', pluginJson);
  ensureAbsent('.agents/plugins/claude-testing-skills/skills.json');
  ensureAbsent('.agents/plugins/claude-testing-skills/skills');

  const pluginMcpJson = buildAntigravityMcpConfig(rootDir);
  ensureFile('.agents/plugins/claude-testing-skills/mcp_config.json', pluginMcpJson);

  // 4. Sync all .claude/commands/*.md -> .agents/skills/<cmd>/SKILL.md
  const commandsDir = path.join(rootDir, '.claude', 'commands');
  const commandFiles = fs
    .readdirSync(commandsDir, { withFileTypes: true })
    .filter((d) => d.isFile() && d.name.endsWith('.md'))
    .map((d) => d.name)
    .sort();

  const expectedCmdNames = new Set();
  for (const fileName of commandFiles) {
    const cmdName = fileName.replace(/\.md$/, '');
    expectedCmdNames.add(cmdName);
    const srcContent = fs.readFileSync(path.join(commandsDir, fileName), 'utf8');
    const converted = convertCommandToAntigravitySkill(cmdName, srcContent);
    const relSkillPath = path.join('.agents', 'skills', cmdName, 'SKILL.md');
    ensureFile(relSkillPath, converted);

    const absSkillPath = path.join(rootDir, relSkillPath);
    const { brokenPointers } = resolveContextPointers(converted, {
      sourceFile: absSkillPath,
      repoRoot: rootDir,
    });
    for (const bp of brokenPointers) {
      brokenSkillPointers.push({ file: relSkillPath, target: bp.rawTarget });
    }
  }

  // Remove any stale command skill directories under .agents/skills/
  const agySkillsDir = path.join(rootDir, '.agents', 'skills');
  if (fs.existsSync(agySkillsDir)) {
    const existingDirs = fs
      .readdirSync(agySkillsDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);
    for (const dirName of existingDirs) {
      if (!expectedCmdNames.has(dirName)) {
        ensureAbsent(path.join('.agents', 'skills', dirName));
      }
    }
  }

  return {
    inSync: drift.length === 0 && brokenSkillPointers.length === 0,
    drift,
    brokenSkillPointers,
    commandsSynced: expectedCmdNames.size,
  };
}

function main() {
  const { checkOnly, rootDir } = parseArgs(process.argv.slice(2));
  const result = syncAntigravity(rootDir, { checkOnly });

  if (checkOnly) {
    if (!result.inSync) {
      const reasons = [
        ...result.drift.map((p) => `  - drift: ${p}`),
        ...result.brokenSkillPointers.map((b) => `  - broken pointer in ${b.file}: ${b.target}`),
      ];
      console.error(
        `Antigravity customization drift detected (${reasons.length} items):\n` +
          reasons.join('\n') +
          `\nRun 'node scripts/sync-antigravity.mjs' to synchronize.`
      );
      process.exit(1);
    }
    console.log(
      `Antigravity customizations are 100% in sync (${result.commandsSynced} slash commands + 20 core skills + AGENTS.md + Playwright MCP).`
    );
    return;
  }

  console.log(
    `Synchronized Antigravity workspace customizations (${result.commandsSynced} slash commands -> .agents/skills/, 20 core skills via .agents/skills.json, AGENTS.md, and Playwright MCP plugin). Updated ${result.drift.length} file(s).`
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  main();
}
