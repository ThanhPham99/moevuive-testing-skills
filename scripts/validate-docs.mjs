#!/usr/bin/env node
/**
 * Artifact Integrity Gate & Deterministic RTM CLI (`scripts/validate-docs.mjs`)
 *
 * Deep zero-dependency verification and traceability module for `docs/`:
 *   1. `validateDocsTree(repoRoot, options)` — Verifies all Markdown/evidence pointers,
 *      table schemas (13-col TC, 5-col Execution, 8-col Bug Catalog), and cross-artifact
 *      referential integrity (`REQ ID <-> TC ID <-> BUG ID`) across `docs/`.
 *   2. `computeTraceabilityReport(repoRoot, options)` — Deterministically computes
 *      Requirements Traceability Matrix (RTM) coverage, uncovered REQs, unautomated TCs,
 *      orphan TCs, and canonical 5-column Markdown RTM tables in <50ms.
 *
 * Usage:
 *   node scripts/validate-docs.mjs --check [--root <dir>] [--json]
 *   node scripts/validate-docs.mjs --rtm [--module <slug>] [--root <dir>] [--json]
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveContextPointers } from './sync-antigravity.mjs';
import {
  formatCellPlainText,
  parseBugFile,
  parseBugIndex,
  parseExecutionReport,
  parseMarkdownFile,
  parseMarkdownTables,
} from './viewer-core.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const REQ_ID_REGEX = /\bREQ-(?:[A-Z0-9]+-)+\d+\b/g;
const TC_ID_REGEX = /\b[A-Z0-9_]+_TC_\d+(?:-[a-z0-9]+)?\b/g;

const CANONICAL_TC_HEADERS = [
  'tc id',
  'req id',
  'module',
  'risk level',
  'test scenario',
  'pre-condition',
  'test steps',
  'test data',
  'expected result',
  'priority',
  'automatable',
  'auto type',
  'tags',
];

function walkFiles(dirPath, predicate = () => true) {
  if (!fs.existsSync(dirPath)) return [];
  const results = [];
  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkFiles(fullPath, predicate));
    } else if (entry.isFile() && predicate(fullPath)) {
      results.push(fullPath);
    }
  }
  return results.sort();
}

export function normalizeTcId(rawTcId) {
  return String(rawTcId || '')
    .trim()
    .replace(/-[a-z0-9]+$/i, '');
}

function extractReqDefinitionsFromMarkdown(content, sourceRelPath, outMap, outOfScopeSet) {
  const tables = parseMarkdownTables(content);

  // Check explicit "REQ cố ý KHÔNG có TC" tables where column 0 is REQ ID
  for (const table of tables) {
    const headingLower = (table.heading || '').toLowerCase();
    const h0 = (table.headers[0] || '').trim().toLowerCase();
    if (h0 === 'req id' && headingLower.includes('không có tc')) {
      for (const row of table.rows) {
        for (const match of String(row[0] || '').matchAll(REQ_ID_REGEX)) {
          outOfScopeSet.add(match[0]);
        }
      }
    }

    const headersLower = table.headers.map((h) => h.trim().toLowerCase());
    const reqIdx = headersLower.indexOf('req id');
    const titleIdx = headersLower.findIndex(
      (h) => h === 'tên yêu cầu' || h === 'mô tả' || h === 'tên req'
    );
    const acIdx = headersLower.findIndex((h) => h.includes('acceptance criteria'));
    const statusIdx = headersLower.findIndex((h) => h === 'trạng thái' || h === 'status');

    if (reqIdx === 0 && (titleIdx !== -1 || acIdx !== -1)) {
      for (const row of table.rows) {
        const rawReqCell = formatCellPlainText(row[reqIdx] || '').trim();
        const reqMatches = [...rawReqCell.matchAll(REQ_ID_REGEX)].map((m) => m[0]);
        if (reqMatches.length === 0) continue;
        const reqId = reqMatches[0];
        const title = formatCellPlainText(row[titleIdx !== -1 ? titleIdx : 1] || '').trim();
        const status = statusIdx !== -1 ? formatCellPlainText(row[statusIdx] || '').trim() : '🟢';
        if (status.includes('⚪') || status.includes('🔴') || status.toLowerCase().includes('deprecated')) {
          outOfScopeSet.add(reqId);
        }
        outMap.set(reqId, {
          id: reqId,
          title,
          status,
          sourceFile: sourceRelPath,
        });
      }
    }
  }
}

function collectModuleArtifacts(repoRoot) {
  const docsDir = path.join(repoRoot, 'docs');
  const modulesMap = new Map();

  function ensureModule(slug) {
    if (!modulesMap.has(slug)) {
      modulesMap.set(slug, {
        slug,
        reqFiles: [],
        impactFiles: [],
        userGuideFiles: [],
        tcFiles: [],
        execFiles: [],
        bugFiles: [],
        reqs: new Map(),
        outOfScopeReqs: new Set(),
        tcs: new Map(),
        tcList: [],
        executedTcs: new Set(),
        openBugs: [],
        parsedTcFiles: [],
        parsedExecFiles: [],
        parsedBugFiles: [],
      });
    }
    return modulesMap.get(slug);
  }

  function walkBranchModules(branchRoot, onModuleDir) {
    if (!fs.existsSync(branchRoot)) return;
    for (const entry of fs.readdirSync(branchRoot, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.name === '_discovery' || entry.name === 'archive') continue;
      if (entry.name.startsWith('_')) {
        const nsRoot = path.join(branchRoot, entry.name);
        for (const sub of fs.readdirSync(nsRoot, { withFileTypes: true })) {
          if (!sub.isDirectory() || sub.name === '_discovery' || sub.name === 'archive') continue;
          const modSlug = `${entry.name}/${sub.name}`;
          onModuleDir(ensureModule(modSlug), path.join(nsRoot, sub.name), sub.name);
        }
      } else {
        onModuleDir(ensureModule(entry.name), path.join(branchRoot, entry.name), entry.name);
      }
    }
  }

  // 1. Scan requirements + impact reports
  walkBranchModules(path.join(docsDir, 'requirements'), (mod, modDir, leafName) => {
    const indexFile = path.join(modDir, `requirements_${leafName}.md`);
    if (fs.existsSync(indexFile)) mod.reqFiles.push(indexFile);
    const storiesDir = path.join(modDir, 'stories');
    if (fs.existsSync(storiesDir)) {
      mod.reqFiles.push(...walkFiles(storiesDir, (f) => f.endsWith('.md')));
    }
    const impactDir = path.join(modDir, 'impact');
    if (fs.existsSync(impactDir)) {
      mod.impactFiles.push(...walkFiles(impactDir, (f) => f.endsWith('.md')));
    }
  });

  // 2. Scan testcases
  walkBranchModules(path.join(docsDir, 'testcases'), (mod, modDir, leafName) => {
    const tcFile = path.join(modDir, `test_cases_${leafName}.md`);
    if (fs.existsSync(tcFile)) mod.tcFiles.push(tcFile);
  });

  // 3. Scan executions
  walkBranchModules(path.join(docsDir, 'executions'), (mod, modDir) => {
    mod.execFiles.push(
      ...walkFiles(
        modDir,
        (f) => path.basename(f) === 'execution_report.md' || path.basename(f) === 'retest_report.md'
      )
    );
  });

  // 4. Scan bugs
  walkBranchModules(path.join(docsDir, 'bugs'), (mod, modDir) => {
    mod.bugFiles.push(
      ...walkFiles(modDir, (f) => path.basename(f).startsWith('BUG_') && f.endsWith('.md'))
    );
  });

  // 5. Scan user-guides
  walkBranchModules(path.join(docsDir, 'user-guides'), (mod, modDir, leafName) => {
    const ugFile = path.join(modDir, `user_guide_${leafName}.md`);
    if (fs.existsSync(ugFile)) mod.userGuideFiles.push(ugFile);
  });

  return modulesMap;
}

/**
 * Discovers primary (`docs/requirements/README.md`) and secondary system
 * (`docs/requirements/_<system>/README.md`) requirement catalogs.
 */
function scanRequirementCatalogs(repoRoot) {
  const reqRoot = path.join(repoRoot, 'docs', 'requirements');
  if (!fs.existsSync(reqRoot)) return { catalogs: [], undocumentedModules: [] };

  const candidateReadmes = [];
  const primaryReadme = path.join(reqRoot, 'README.md');
  if (fs.existsSync(primaryReadme)) {
    candidateReadmes.push({ namespace: '', fullPath: primaryReadme });
  }
  for (const entry of fs.readdirSync(reqRoot, { withFileTypes: true })) {
    if (!entry.isDirectory() || !entry.name.startsWith('_') || entry.name === '_discovery') continue;
    const secReadme = path.join(reqRoot, entry.name, 'README.md');
    if (fs.existsSync(secReadme)) {
      candidateReadmes.push({ namespace: entry.name, fullPath: secReadme });
    }
  }

  const catalogs = [];
  const undocumentedModules = [];

  for (const { namespace, fullPath } of candidateReadmes) {
    const relFile = path.relative(repoRoot, fullPath).replace(/\\/g, '/');
    const tables = parseMarkdownTables(fs.readFileSync(fullPath, 'utf8'));
    const catalog = tables.find((t) => {
      const h0 = (t.headers[0] || '').trim().toLowerCase();
      const h1 = (t.headers[1] || '').trim().toLowerCase();
      return h0 === 'module' && (h1.includes('prefix') || h1 === 'mã');
    });
    catalogs.push({ namespace, relFile, catalog });

    if (catalog && catalog.headers.length >= 7) {
      const headersLower = catalog.headers.map((h) => h.trim().toLowerCase());
      const statusIdx = headersLower.findIndex((h) => h.includes('trạng thái'));
      const usedIdx = headersLower.findIndex(
        (h) => h.includes('req đã dùng') || h.includes('dải đã dùng')
      );
      const ambIdx = headersLower.findIndex((h) => h.includes('amb'));

      for (const row of catalog.rows) {
        const modName = formatCellPlainText(row[0] || '').trim();
        const prefix = formatCellPlainText(row[1] || '')
          .replace(/`/g, '')
          .trim();
        if (!modName || !prefix) continue;

        const statusCell = formatCellPlainText(row[statusIdx >= 0 ? statusIdx : 2] || '').trim();
        const usedCell = formatCellPlainText(row[usedIdx >= 0 ? usedIdx : 5] || '').trim();
        const ambCell = ambIdx >= 0 ? formatCellPlainText(row[ambIdx] || '').trim() : '';

        if (
          statusCell.includes('⬜') ||
          statusCell.includes('🟨') ||
          usedCell === '—' ||
          usedCell === '-' ||
          usedCell === ''
        ) {
          const label = namespace ? `${namespace}/${modName} (${prefix})` : `${modName} (${prefix})`;
          const risk =
            ambCell && ambCell !== '—' && ambCell !== '-'
              ? `Chưa có REQ chính thức · AMB treo: ${ambCell}`
              : 'Chưa có tài liệu requirements — cần chạy /generate-requirements-from-website';
          undocumentedModules.push({
            namespace,
            prefix,
            module: label,
            status: statusCell || '⬜ Chưa khảo sát',
            risk,
          });
        }
      }
    }
  }

  return { catalogs, undocumentedModules };
}

/**
 * Shared helper that populates a module's `reqs`, `outOfScopeReqs`, `tcs`, `tcList`,
 * `executedTcs`, `openBugs`, and cached parsed file records from its discovered files.
 */
function populateModuleIndex(repoRoot, mod) {
  for (const reqFile of mod.reqFiles) {
    const content = fs.readFileSync(reqFile, 'utf8');
    const relFile = path.relative(repoRoot, reqFile).replace(/\\/g, '/');
    extractReqDefinitionsFromMarkdown(content, relFile, mod.reqs, mod.outOfScopeReqs);
  }

  for (const tcFile of mod.tcFiles) {
    const content = fs.readFileSync(tcFile, 'utf8');
    const relFile = path.relative(repoRoot, tcFile).replace(/\\/g, '/');
    const tables = parseMarkdownTables(content);
    for (const table of tables) {
      const headingLower = (table.heading || '').toLowerCase();
      if (headingLower.includes('không có tc') || headingLower.includes('ngoài phạm vi')) {
        for (const row of table.rows) {
          for (const match of row.join(' ').matchAll(REQ_ID_REGEX)) {
            mod.outOfScopeReqs.add(match[0]);
          }
        }
      }
    }
    const parsedTcFile = parseMarkdownFile(path.basename(tcFile), content);
    mod.parsedTcFiles.push({ relFile, tables, parsedTcFile });
    for (const tc of parsedTcFile.testCases) {
      mod.tcs.set(tc.id, tc);
      mod.tcList.push(tc);
    }
  }

  for (const execFile of mod.execFiles) {
    const content = fs.readFileSync(execFile, 'utf8');
    const relFile = path.relative(repoRoot, execFile).replace(/\\/g, '/');
    const tables = parseMarkdownTables(content);
    const parsedExec = parseExecutionReport(content, relFile);
    mod.parsedExecFiles.push({ relFile, tables, parsedExec });
    for (const tcRow of parsedExec.tcs || []) {
      const baseTcId = normalizeTcId(tcRow.id);
      if (baseTcId) mod.executedTcs.add(baseTcId);
    }
  }

  for (const bugFile of mod.bugFiles) {
    const content = fs.readFileSync(bugFile, 'utf8');
    const relFile = path.relative(repoRoot, bugFile).replace(/\\/g, '/');
    const parsedBug = parseBugFile(content, relFile);
    mod.parsedBugFiles.push({ relFile, parsedBug });
    if (String(parsedBug.status || '').toUpperCase() !== 'CLOSED') {
      mod.openBugs.push({
        id: parsedBug.id,
        title: parsedBug.title,
        severity: parsedBug.severity,
        priority: parsedBug.priority,
        status: parsedBug.status,
        tc: parsedBug.tc,
        req: parsedBug.req,
      });
    }
  }
}

/**
 * Validates the `docs/` tree for:
 *  - Broken Markdown links, inline-code pointers, and missing evidence images (`brokenPointers`)
 *  - Table schema violations across Module Catalogs, 13-col TC tables, 5-col Execution tables, and 8-col Bug Catalog (`schemaViolations`)
 *  - Cross-artifact referential integrity (`REQ ID <-> TC ID <-> BUG ID`) (`referentialErrors`)
 */
export function validateDocsTree(repoRoot = path.resolve(__dirname, '..'), options = {}) {
  const docsDir = path.join(repoRoot, 'docs');
  const brokenPointers = [];
  const schemaViolations = [];
  const referentialErrors = [];
  const targetModule = options.module ? String(options.module).trim().toLowerCase() : null;

  if (!fs.existsSync(docsDir)) {
    return {
      valid: true,
      brokenPointers,
      schemaViolations,
      referentialErrors,
      modules: [],
      stats: { markdownFiles: 0, totalReqs: 0, totalTcs: 0, totalBugs: 0 },
    };
  }

  // 1. Validate all Markdown links, evidence image paths, and inline-code pointers across docs/
  const allMdFiles = walkFiles(docsDir, (f) => f.endsWith('.md'));
  for (const mdFile of allMdFiles) {
    const content = fs.readFileSync(mdFile, 'utf8');
    const relFile = path.relative(repoRoot, mdFile).replace(/\\/g, '/');
    const pointerRes = resolveContextPointers(content, {
      sourceFile: mdFile,
      repoRoot,
    });
    for (const bp of pointerRes.brokenPointers) {
      brokenPointers.push({
        sourceFile: relFile,
        rawTarget: bp.rawTarget,
        resolvedPath: bp.resolvedPath,
        kind: bp.kind,
      });
    }
  }

  // 2. Validate Module Catalog tables & ID range continuity in docs/requirements/README.md, docs/requirements/_<system>/README.md, docs/testcases/README.md, and docs/user-guides/README.md
  const { catalogs: reqCatalogs } = scanRequirementCatalogs(repoRoot);
  for (const { relFile, catalog } of reqCatalogs) {
    if (!catalog || catalog.headers.length < 7) {
      schemaViolations.push({
        file: relFile,
        message: `Expected Module Catalog table (Module | Prefix/Mã | ... | REQ đã dùng | Mã kế tiếp) in ${relFile}`,
      });
    } else {
      const headersLower = catalog.headers.map((h) => h.trim().toLowerCase());
      const usedIdx = headersLower.findIndex(
        (h) => h.includes('req đã dùng') || h.includes('dải đã dùng')
      );
      const nextIdx = headersLower.findIndex((h) => h.includes('mã kế tiếp'));
      for (const row of catalog.rows) {
        if (!(row[0] || '').trim() || !(row[1] || '').trim()) continue;
        const usedRange = (row[usedIdx >= 0 ? usedIdx : 5] || '').replace(/`/g, '');
        const nextCode = (row[nextIdx >= 0 ? nextIdx : 6] || '').replace(/`/g, '');
        const rangeMatch = usedRange.match(/REQ-[A-Z0-9_-]+-(\d+)\s*(?:→|->)\s*REQ-[A-Z0-9_-]+-(\d+)/);
        const nextMatch = nextCode.match(/REQ-[A-Z0-9_-]+-(\d+)/);
        if (rangeMatch && nextMatch) {
          const maxUsed = Number(rangeMatch[2]);
          const nextNum = Number(nextMatch[1]);
          if (nextNum !== maxUsed + 1) {
            schemaViolations.push({
              file: relFile,
              message: `Module Catalog ID range discontinuity for "${row[0]}": max used is ${maxUsed} but next code is ${nextCode}`,
            });
          }
        }
      }
    }
  }

  const tcReadmePath = path.join(docsDir, 'testcases', 'README.md');
  if (fs.existsSync(tcReadmePath)) {
    const relTcReadme = path.relative(repoRoot, tcReadmePath).replace(/\\/g, '/');
    const tables = parseMarkdownTables(fs.readFileSync(tcReadmePath, 'utf8'));
    const catalog = tables.find(
      (t) =>
        (t.headers[0] || '').trim().toLowerCase() === 'module' &&
        (t.headers[1] || '').trim().toLowerCase().includes('prefix')
    );
    if (!catalog || catalog.headers.length < 4) {
      schemaViolations.push({
        file: relTcReadme,
        message: 'Expected Test Cases Module Catalog table (Module | Prefix TC ID | Dải đã dùng | Mã kế tiếp | ...) in docs/testcases/README.md',
      });
    } else {
      for (const row of catalog.rows) {
        const usedRange = (row[2] || '').replace(/`/g, '');
        const nextCode = (row[3] || '').replace(/`/g, '');
        const rangeMatch = usedRange.match(/(\d+)\s*(?:→|->)\s*(\d+)/);
        const nextMatch = nextCode.match(/(\d+)/);
        if (rangeMatch && nextMatch) {
          const maxUsed = Number(rangeMatch[2]);
          const nextNum = Number(nextMatch[1]);
          if (nextNum !== maxUsed + 1) {
            schemaViolations.push({
              file: relTcReadme,
              message: `Test Cases Catalog ID range discontinuity for "${row[0]}": max used is ${maxUsed} but next code is ${nextCode}`,
            });
          }
        }
      }
    }
  }

  const ugReadmePath = path.join(docsDir, 'user-guides', 'README.md');
  if (fs.existsSync(ugReadmePath) && !targetModule) {
    const relUgReadme = path.relative(repoRoot, ugReadmePath).replace(/\\/g, '/');
    const tables = parseMarkdownTables(fs.readFileSync(ugReadmePath, 'utf8'));
    const catalog = tables.find(
      (t) =>
        (t.headers[0] || '').trim().toLowerCase() === 'module' &&
        (t.headers[1] || '').trim().toLowerCase().includes('đối tượng')
    );
    if (!catalog || catalog.headers.length < 6) {
      schemaViolations.push({
        file: relUgReadme,
        message:
          'Expected User Guides Catalog table (minimum 6 columns starting with Module | Đối tượng đọc) in docs/user-guides/README.md',
      });
    }
  }

  // 3. Collect per-module artifacts & validate schemas + referential integrity
  const modulesMap = collectModuleArtifacts(repoRoot);
  const allKnownTcIds = new Set();
  const allKnownBugIds = new Set();
  let totalReqs = 0;
  let totalTcs = 0;
  let totalBugs = 0;

  for (const mod of modulesMap.values()) {
    if (targetModule && mod.slug.toLowerCase() !== targetModule) continue;
    populateModuleIndex(repoRoot, mod);
    totalReqs += mod.reqs.size;
    totalTcs += mod.tcList.length;
    for (const tcId of mod.tcs.keys()) allKnownTcIds.add(tcId);

    // 3a. Check 13-column TC table schema + REQ references
    for (const { relFile, tables, parsedTcFile } of mod.parsedTcFiles) {
      const tcTables = tables.filter((t) => {
        const h0 = (t.headers[0] || '').trim().toLowerCase();
        const h1 = (t.headers[1] || '').trim().toLowerCase();
        return h0 === 'tc id' && (h1 === 'req id' || t.headers.length >= 10);
      });

      if (tcTables.length === 0) {
        schemaViolations.push({
          file: relFile,
          message: 'No Test Case table found with first column "TC ID"',
        });
      }

      for (const tcTable of tcTables) {
        const headersLower = tcTable.headers.map((h) => h.trim().toLowerCase());
        const missingCols = CANONICAL_TC_HEADERS.filter((col) => {
          if (col === 'test scenario') {
            return !(
              headersLower.includes('test scenario') ||
              headersLower.includes('test title') ||
              headersLower.includes('test case title')
            );
          }
          return !headersLower.includes(col);
        });
        if (tcTable.headers.length !== 13 || missingCols.length > 0) {
          schemaViolations.push({
            file: relFile,
            message: `Test Case table under "${tcTable.heading}" must have 13 canonical columns (got ${tcTable.headers.length}; missing: ${missingCols.join(', ') || 'none'})`,
          });
        }
      }

      for (const tc of parsedTcFile.testCases) {
        if (mod.reqs.size > 0) {
          for (const reqId of tc.reqIds) {
            const cleanReqIds = [...reqId.matchAll(REQ_ID_REGEX)].map((m) => m[0]);
            if (cleanReqIds.length === 0) {
              referentialErrors.push({
                file: relFile,
                message: `TC "${tc.id}" has invalid REQ ID token "${reqId}"`,
              });
            }
            for (const cleanReqId of cleanReqIds) {
              if (!mod.reqs.has(cleanReqId)) {
                referentialErrors.push({
                  file: relFile,
                  message: `TC "${tc.id}" references unknown REQ ID "${cleanReqId}" (not found in module "${mod.slug}" requirements)`,
                });
              }
            }
          }
        }
      }
    }

    // 3b. Validate Bug Reports (REQ ID and TC ID referential integrity)
    const modBugIds = new Set();
    for (const { relFile, parsedBug } of mod.parsedBugFiles) {
      totalBugs += 1;
      if (parsedBug.id) {
        allKnownBugIds.add(parsedBug.id);
        modBugIds.add(parsedBug.id);
      }

      const tcMatches = [...String(parsedBug.tc || '').matchAll(TC_ID_REGEX)].map((m) => m[0]);
      if (tcMatches.length === 0) {
        referentialErrors.push({
          file: relFile,
          message: `Bug report "${parsedBug.id}" does not reference any valid TC ID in "Test case liên quan"`,
        });
      } else if (mod.tcs.size > 0) {
        for (const rawTc of tcMatches) {
          const baseTc = normalizeTcId(rawTc);
          if (!mod.tcs.has(baseTc)) {
            referentialErrors.push({
              file: relFile,
              message: `Bug report "${parsedBug.id}" references unknown TC ID "${rawTc}"`,
            });
          }
        }
      }

      const reqMatches = [...String(parsedBug.req || '').matchAll(REQ_ID_REGEX)].map((m) => m[0]);
      if (reqMatches.length === 0) {
        referentialErrors.push({
          file: relFile,
          message: `Bug report "${parsedBug.id}" does not reference any valid REQ ID in "REQ ID liên quan"`,
        });
      } else if (mod.reqs.size > 0) {
        for (const reqId of reqMatches) {
          if (!mod.reqs.has(reqId)) {
            referentialErrors.push({
              file: relFile,
              message: `Bug report "${parsedBug.id}" references unknown REQ ID "${reqId}"`,
            });
          }
        }
      }
    }

    // 3c. Validate Execution & Retest Reports
    for (const { relFile, tables, parsedExec } of mod.parsedExecFiles) {
      if (parsedExec.kind === 'retest') {
        if (!parsedExec.bugs || parsedExec.bugs.length === 0) {
          schemaViolations.push({
            file: relFile,
            message:
              'Retest report must contain at least one 2-column bug verification table (Bug | Kết quả)',
          });
        }
        const regressionTables = tables.filter(
          (t) => (t.headers[0] || '').trim().toLowerCase() === 'tc id'
        );
        for (const rt of regressionTables) {
          if (rt.headers.length !== 5) {
            schemaViolations.push({
              file: relFile,
              message: `Retest report regression table must have 5 columns (TC ID | Vòng | Kịch bản | Kết quả | Ghi chú), got ${rt.headers.length}`,
            });
          }
        }
        for (const bugRow of parsedExec.bugs || []) {
          const bugIdMatch = String(bugRow.bug || '').match(/\bBUG_[A-Za-z0-9_]+\b/);
          if (bugIdMatch && modBugIds.size > 0 && !modBugIds.has(bugIdMatch[0])) {
            referentialErrors.push({
              file: relFile,
              message: `Retest report references unknown BUG ID "${bugIdMatch[0]}"`,
            });
          }
          for (const tcMatch of String(bugRow.tcReq || '').matchAll(TC_ID_REGEX)) {
            const baseTc = normalizeTcId(tcMatch[0]);
            if (mod.tcs.size > 0 && !mod.tcs.has(baseTc)) {
              referentialErrors.push({
                file: relFile,
                message: `Retest report bug entry references unknown TC ID "${tcMatch[0]}"`,
              });
            }
          }
          for (const reqMatch of String(bugRow.tcReq || '').matchAll(REQ_ID_REGEX)) {
            if (mod.reqs.size > 0 && !mod.reqs.has(reqMatch[0])) {
              referentialErrors.push({
                file: relFile,
                message: `Retest report bug entry references unknown REQ ID "${reqMatch[0]}"`,
              });
            }
          }
        }
      } else {
        const resultTables = tables.filter((t) => {
          const h0 = (t.headers[0] || '').trim().toLowerCase();
          const h1 = (t.headers[1] || '').trim().toLowerCase();
          const headingLower = (t.heading || '').toLowerCase();
          return (
            h0 === 'tc id' &&
            (h1.includes('scenario') ||
              h1.includes('kịch bản') ||
              headingLower.includes('kết quả từng tc'))
          );
        });
        if (resultTables.length === 0) {
          schemaViolations.push({
            file: relFile,
            message: 'Execution report must contain a result table starting with "TC ID"',
          });
        }
        for (const rt of resultTables) {
          if (rt.headers.length !== 5) {
            schemaViolations.push({
              file: relFile,
              message: `Execution report TC result table must have 5 columns (TC ID | Test Scenario | Kết quả | Bước fail | Ghi chú), got ${rt.headers.length}`,
            });
          }
        }
      }

      for (const tcRow of parsedExec.tcs || []) {
        const baseTcId = normalizeTcId(tcRow.id);
        if (mod.tcs.size > 0 && !mod.tcs.has(baseTcId)) {
          referentialErrors.push({
            file: relFile,
            message: `Execution report references unknown TC ID "${tcRow.id}" (normalized "${baseTcId}" not found in module "${mod.slug}")`,
          });
        }
        if (tcRow.reqId && mod.reqs.size > 0) {
          for (const m of tcRow.reqId.matchAll(REQ_ID_REGEX)) {
            if (!mod.reqs.has(m[0])) {
              referentialErrors.push({
                file: relFile,
                message: `Execution report FAIL detail for "${tcRow.id}" references unknown REQ ID "${m[0]}"`,
              });
            }
          }
        }
      }
    }

    // 3d. Validate Impact Reports (docs/requirements/<module>/impact/impact_*.md) & Requirement Changelog
    for (const impactFile of mod.impactFiles) {
      const content = fs.readFileSync(impactFile, 'utf8');
      const relFile = path.relative(repoRoot, impactFile).replace(/\\/g, '/');
      if (mod.reqs.size > 0) {
        const seenReqs = new Set([...content.matchAll(REQ_ID_REGEX)].map((m) => m[0]));
        for (const reqId of seenReqs) {
          if (!mod.reqs.has(reqId)) {
            referentialErrors.push({
              file: relFile,
              message: `Impact report references unknown REQ ID "${reqId}" (not found in module "${mod.slug}" requirements)`,
            });
          }
        }
      }
      if (mod.tcs.size > 0) {
        const seenTcs = new Set([...content.matchAll(TC_ID_REGEX)].map((m) => normalizeTcId(m[0])));
        for (const tcId of seenTcs) {
          if (tcId && !mod.tcs.has(tcId)) {
            referentialErrors.push({
              file: relFile,
              message: `Impact report references unknown TC ID "${tcId}" (not found in module "${mod.slug}" test cases)`,
            });
          }
        }
      }
    }

    for (const reqFile of mod.reqFiles) {
      const content = fs.readFileSync(reqFile, 'utf8');
      const relFile = path.relative(repoRoot, reqFile).replace(/\\/g, '/');
      const tables = parseMarkdownTables(content);
      for (const table of tables) {
        const headingLower = (table.heading || '').toLowerCase();
        if (!headingLower.includes('nhật ký thay đổi') && !headingLower.includes('changelog')) continue;
        const headersLower = table.headers.map((h) => h.trim().toLowerCase());
        const reqColIdx = headersLower.findIndex((h) => h.includes('req'));
        const tcColIdx = headersLower.findIndex((h) => h.includes('tc'));
        for (const row of table.rows) {
          if (reqColIdx >= 0 && mod.reqs.size > 0) {
            for (const m of String(row[reqColIdx] || '').matchAll(REQ_ID_REGEX)) {
              if (!mod.reqs.has(m[0])) {
                referentialErrors.push({
                  file: relFile,
                  message: `Requirement changelog references unknown REQ ID "${m[0]}"`,
                });
              }
            }
          }
          if (tcColIdx >= 0 && mod.tcs.size > 0) {
            for (const m of String(row[tcColIdx] || '').matchAll(TC_ID_REGEX)) {
              const baseTc = normalizeTcId(m[0]);
              if (baseTc && !mod.tcs.has(baseTc)) {
                referentialErrors.push({
                  file: relFile,
                  message: `Requirement changelog references unknown TC ID "${baseTc}"`,
                });
              }
            }
          }
        }
      }
    }

    // 3e. Validate User Guides (docs/user-guides/<module>/user_guide_<module>.md) including <!-- Nguồn: REQ-... --> comments
    for (const ugFile of mod.userGuideFiles) {
      const content = fs.readFileSync(ugFile, 'utf8');
      const relFile = path.relative(repoRoot, ugFile).replace(/\\/g, '/');
      if (mod.reqs.size > 0) {
        const seenReqs = new Set([...content.matchAll(REQ_ID_REGEX)].map((m) => m[0]));
        for (const reqId of seenReqs) {
          if (!mod.reqs.has(reqId)) {
            referentialErrors.push({
              file: relFile,
              message: `User guide references unknown REQ ID "${reqId}" (not found in module "${mod.slug}" requirements)`,
            });
          }
        }
      }
    }
  }

  // 4. Validate Bug Catalog schema & cross-references in docs/bugs/README.md if present
  const bugsReadmePath = path.join(docsDir, 'bugs', 'README.md');
  if (fs.existsSync(bugsReadmePath) && !targetModule) {
    const bugsReadmeContent = fs.readFileSync(bugsReadmePath, 'utf8');
    const relBugsReadme = path.relative(repoRoot, bugsReadmePath).replace(/\\/g, '/');
    const tables = parseMarkdownTables(bugsReadmeContent);
    const catalogTable = tables.find((t) => {
      const h0 = (t.headers[0] || '').trim().toLowerCase();
      return h0 === 'mã bug' || h0 === 'bug id';
    });
    if (!catalogTable || catalogTable.headers.length !== 8) {
      schemaViolations.push({
        file: relBugsReadme,
        message: `Expected 8-column Bug Catalog table in docs/bugs/README.md, found ${catalogTable ? catalogTable.headers.length : 0} columns`,
      });
    } else {
      const parsedIndex = parseBugIndex(bugsReadmeContent, relBugsReadme);
      if (catalogTable.rows.length > 0 && parsedIndex.rows.length !== catalogTable.rows.length) {
        schemaViolations.push({
          file: relBugsReadme,
          message: `Bug Catalog table row count mismatch (${parsedIndex.rows.length} parsed vs ${catalogTable.rows.length} raw)`,
        });
      }
      for (const bugRow of parsedIndex.rows) {
        if (allKnownBugIds.size > 0 && !allKnownBugIds.has(bugRow.id)) {
          referentialErrors.push({
            file: relBugsReadme,
            message: `Bug Catalog references unknown BUG ID "${bugRow.id}" (no matching BUG_*.md found)`,
          });
        }
        const tcRefs = [...String(bugRow.tc || '').matchAll(TC_ID_REGEX)].map((m) => normalizeTcId(m[0]));
        for (const tcRef of tcRefs) {
          if (allKnownTcIds.size > 0 && !allKnownTcIds.has(tcRef)) {
            referentialErrors.push({
              file: relBugsReadme,
              message: `Bug Catalog row "${bugRow.id}" references unknown TC ID "${tcRef}"`,
            });
          }
        }
      }
    }
  }

  const valid =
    brokenPointers.length === 0 &&
    schemaViolations.length === 0 &&
    referentialErrors.length === 0;

  return {
    valid,
    brokenPointers,
    schemaViolations,
    referentialErrors,
    modules: [...modulesMap.keys()].sort(),
    stats: {
      markdownFiles: allMdFiles.length,
      totalReqs,
      totalTcs,
      totalBugs,
    },
  };
}

const AUTO_SCRIPT_FILE_REGEX =
  /(?:\.(?:spec|test)\.(?:[cm]?ts|[cm]?js|tsx|jsx)|Test(?:s)?\.java|^test_.*\.py|.*_test\.py)$/;

/**
 * Scans automation test directories (`tests/`, `e2e/`, `src/`, or `options.testsDir`) for
 * automated test scripts and maps referenced `TC ID` tokens to script filenames.
 */
export function scanAutomationScripts(repoRoot = path.resolve(__dirname, '..'), options = {}) {
  const candidateDirs = options.testsDir
    ? [path.resolve(repoRoot, options.testsDir)]
    : ['tests', 'e2e', 'src'].map((d) => path.join(repoRoot, d));

  const tcToScripts = new Map();
  const scriptFiles = [];

  for (const dir of candidateDirs) {
    if (!fs.existsSync(dir)) continue;
    const files = walkFiles(dir, (fullPath) => {
      const rel = path.relative(repoRoot, fullPath).replace(/\\/g, '/');
      if (
        rel.startsWith('scripts/') ||
        rel.startsWith('docs/') ||
        rel.startsWith('node_modules/') ||
        rel.startsWith('.claude/') ||
        rel.startsWith('.agents/')
      ) {
        return false;
      }
      return AUTO_SCRIPT_FILE_REGEX.test(path.basename(fullPath));
    });
    scriptFiles.push(...files);
  }

  for (const file of scriptFiles) {
    const content = fs.readFileSync(file, 'utf8');
    const baseName = path.basename(file);
    const relPath = path.relative(repoRoot, file).replace(/\\/g, '/');
    for (const match of content.matchAll(TC_ID_REGEX)) {
      const tcId = normalizeTcId(match[0]);
      if (!tcId) continue;
      if (!tcToScripts.has(tcId)) {
        tcToScripts.set(tcId, []);
      }
      const list = tcToScripts.get(tcId);
      if (!list.some((item) => item.relPath === relPath)) {
        list.push({ baseName, relPath });
      }
    }
  }

  return { tcToScripts, scriptFiles };
}

function loadIndexedModules(repoRoot, targetSlug) {
  const modulesMap = collectModuleArtifacts(repoRoot);
  const selectedModules = [];
  const allDocumentedTcIds = new Set();
  for (const [slug, mod] of modulesMap.entries()) {
    populateModuleIndex(repoRoot, mod);
    for (const tcId of mod.tcs.keys()) {
      allDocumentedTcIds.add(tcId);
    }
    if (targetSlug && slug.toLowerCase() !== targetSlug) continue;
    if (mod.reqs.size > 0 || mod.tcList.length > 0 || mod.execFiles.length > 0 || targetSlug) {
      selectedModules.push(mod);
    }
  }
  return { selectedModules, allDocumentedTcIds };
}

function buildModuleReqToTcObjectsMap(mod) {
  const reqToTcObjs = new Map();
  for (const reqId of mod.reqs.keys()) {
    reqToTcObjs.set(reqId, []);
  }
  for (const tc of mod.tcList) {
    for (const rawReq of tc.reqIds) {
      for (const m of rawReq.matchAll(REQ_ID_REGEX)) {
        if (reqToTcObjs.has(m[0])) {
          reqToTcObjs.get(m[0]).push(tc);
        }
      }
    }
  }
  return reqToTcObjs;
}

/**
 * Computes a deterministic 3-layer Requirements Traceability Matrix (RTM) report
 * (`REQ ID <-> TC ID <-> Automation Script`) for one or all modules.
 */
export function computeTraceabilityReport(repoRoot = path.resolve(__dirname, '..'), options = {}) {
  const targetSlug = options.module ? String(options.module).trim().toLowerCase() : null;
  const { tcToScripts } = scanAutomationScripts(repoRoot, options);
  const { undocumentedModules: catalogUndocumented } = scanRequirementCatalogs(repoRoot);
  const undocumentedModules = targetSlug
    ? catalogUndocumented.filter(
        (m) =>
          m.module.toLowerCase().includes(targetSlug) ||
          m.prefix.toLowerCase() === targetSlug ||
          m.namespace.toLowerCase() === targetSlug
      )
    : catalogUndocumented;

  const { selectedModules, allDocumentedTcIds } =
    options._preloaded || loadIndexedModules(repoRoot, targetSlug);

  const rows = [];
  const uncoveredReqs = [];
  const automatableTcs = [];
  const unautomatedTcs = [];
  const automatedTcSet = new Set();
  const orphanTcs = [];
  const orphanScripts = [];
  const openBugsList = [];
  let totalReqs = 0;
  let totalTcs = 0;
  let executedTcsCount = 0;
  let coveredReqs = 0;
  let outOfScopeReqs = 0;

  for (const mod of selectedModules) {
    if (mod.reqs.size === 0 && mod.tcList.length === 0 && !targetSlug) continue;
    totalReqs += mod.reqs.size;
    totalTcs += mod.tcList.length;
    executedTcsCount += mod.executedTcs.size;
    for (const bug of mod.openBugs) {
      openBugsList.push({ module: mod.slug, ...bug });
    }

    const reqToTcObjs = buildModuleReqToTcObjectsMap(mod);

    for (const tc of mod.tcList) {
      const isAutomated = tcToScripts.has(tc.id);
      if (isAutomated) {
        automatedTcSet.add(tc.id);
      }
      if (String(tc.automatable).toLowerCase() === 'yes') {
        const entry = { module: mod.slug, id: tc.id, title: tc.title, priority: tc.priority };
        automatableTcs.push(entry);
        if (!isAutomated) {
          unautomatedTcs.push(entry);
        }
      }
      const matchedAnyReq = tc.reqIds.some((rawReq) =>
        [...rawReq.matchAll(REQ_ID_REGEX)].some((m) => reqToTcObjs.has(m[0]))
      );
      if (!matchedAnyReq) {
        orphanTcs.push({ module: mod.slug, id: tc.id, reqIds: tc.reqIds });
      }
    }

    for (const [reqId, reqDef] of mod.reqs.entries()) {
      const linkedTcs = (reqToTcObjs.get(reqId) || []).map((tc) => tc.id);
      const isOutOfScope = mod.outOfScopeReqs.has(reqId);
      const automatedLinked = linkedTcs.filter((tcId) => tcToScripts.has(tcId));
      const scriptNames = [
        ...new Set(
          automatedLinked.flatMap((tcId) => (tcToScripts.get(tcId) || []).map((s) => s.baseName))
        ),
      ];

      let statusLabel = '🔴 Uncovered';
      let automationCell = '—';

      if (isOutOfScope) {
        outOfScopeReqs += 1;
        statusLabel = '⚪ Out of scope';
      } else if (linkedTcs.length > 0) {
        coveredReqs += 1;
        if (automatedLinked.length === linkedTcs.length) {
          statusLabel = '✅ Full';
          automationCell = scriptNames.join(', ');
        } else if (automatedLinked.length > 0) {
          statusLabel = '🟣 Partial';
          automationCell = `${scriptNames.join(', ')} (${automatedLinked.length}/${linkedTcs.length})`;
        } else {
          statusLabel = '🟡 Manual only';
        }
      } else {
        uncoveredReqs.push({ module: mod.slug, id: reqId, title: reqDef.title });
      }

      rows.push({
        module: mod.slug,
        reqId,
        title: reqDef.title,
        tcIds: linkedTcs,
        automation: automationCell,
        status: statusLabel,
      });
    }
  }

  for (const [tcId, scripts] of tcToScripts.entries()) {
    if (!allDocumentedTcIds.has(tcId)) {
      orphanScripts.push({
        tcId,
        files: scripts.map((s) => s.relPath),
      });
    }
  }

  const inScopeReqs = Math.max(0, totalReqs - outOfScopeReqs);
  const coveragePct = inScopeReqs > 0 ? Number(((coveredReqs / inScopeReqs) * 100).toFixed(1)) : 100;

  const titleSuffix = targetSlug ? targetSlug.toUpperCase() : 'All Modules';
  const mdLines = [
    `# Ma Trận Truy Vết (RTM) — ${titleSuffix}`,
    '',
    '## Tổng quan độ phủ',
    '',
    '| Chỉ số | Giá trị |',
    '|---|---|',
    `| Tổng REQ | ${totalReqs} (Trong phạm vi: ${inScopeReqs} · Ngoài phạm vi: ${outOfScopeReqs}) |`,
    `| REQ đã có TC | ${coveredReqs}/${inScopeReqs} (${coveragePct}%) |`,
    `| Tổng TC | ${totalTcs} (Đã thực thi: ${executedTcsCount} · Đã automate: ${automatedTcSet.size} · Ứng viên Automation: ${automatableTcs.length} · Orphan: ${orphanTcs.length}) |`,
    `| Bug đang mở | ${openBugsList.length} |`,
    '',
    '## Ma trận chi tiết',
    '',
    '| REQ ID | Mô tả ngắn | TC IDs | Automation | Trạng thái |',
    '|---|---|---|---|---|',
    ...rows.map(
      (r) =>
        `| ${r.reqId} | ${r.title.replace(/\|/g, '\\|')} | ${r.tcIds.length ? r.tcIds.join(', ') : '—'} | ${r.automation} | ${r.status} |`
    ),
    '',
  ];

  if (uncoveredReqs.length > 0) {
    mdLines.push(
      '## 🔴 Requirements chưa được cover',
      '',
      '| REQ ID | Mô tả | Đề xuất |',
      '|---|---|---|',
      ...uncoveredReqs.map(
        (u) =>
          `| ${u.id} | ${(u.title || '').replace(/\|/g, '\\|')} | Bổ sung TC cho module ${u.module} (/generate-testcases-manual-rbt) |`
      ),
      ''
    );
  }

  if (unautomatedTcs.length > 0) {
    mdLines.push(
      '## 🟡 TC chưa automate',
      '',
      '| TC ID | Priority | Ghi chú |',
      '|---|---|---|',
      ...unautomatedTcs.map(
        (tc) =>
          `| ${tc.id} | ${tc.priority || 'Medium'} | ${(tc.title || '').replace(/\|/g, '\\|')} |`
      ),
      ''
    );
  }

  if (orphanScripts.length > 0) {
    mdLines.push(
      '## ⚪ Orphan tests',
      '',
      '| Test | File | Đề xuất |',
      '|---|---|---|',
      ...orphanScripts.map(
        (o) =>
          `| ${o.tcId} | ${o.files.join(', ')} | Kiểm tra hoặc bổ sung TC vào test_cases_<module>.md |`
      ),
      ''
    );
  }

  if (undocumentedModules.length > 0) {
    mdLines.push(
      '## ⬛ Module chưa có tài liệu',
      '',
      '| Module | Trạng thái | Rủi ro |',
      '|---|---|---|',
      ...undocumentedModules.map(
        (m) =>
          `| ${m.module.replace(/\|/g, '\\|')} | ${m.status.replace(/\|/g, '\\|')} | ${m.risk.replace(/\|/g, '\\|')} |`
      ),
      ''
    );
  }

  return {
    modules: selectedModules.map((m) => m.slug),
    rows,
    uncoveredReqs,
    automatableTcs,
    unautomatedTcs,
    orphanTcs,
    orphanScripts,
    undocumentedModules,
    openBugs: openBugsList,
    summary: {
      totalReqs,
      inScopeReqs,
      outOfScopeReqs,
      coveredReqs,
      uncoveredReqs: uncoveredReqs.length,
      totalTcs,
      executedTcs: executedTcsCount,
      automatedTcs: automatedTcSet.size,
      openBugs: openBugsList.length,
      automatableTcs: automatableTcs.length,
      unautomatedTcs: unautomatedTcs.length,
      orphanTcs: orphanTcs.length,
      orphanScripts: orphanScripts.length,
      undocumentedModules: undocumentedModules.length,
      coveragePct,
    },
    markdown: mdLines.join('\n'),
  };
}

function numericRunOrder(execEntry) {
  const raw = String(execEntry?.parsedExec?.runId || execEntry?.relFile || '');
  const m = raw.match(/\d+/);
  return m ? Number(m[0]) : 0;
}

/**
 * Computes a deterministic ISO/IEC/IEEE 29119-3 Test Completion Summary Report
 * and evaluates the 7 default Exit Criteria across `docs/`.
 */
export function computeTestSummaryReport(repoRoot = path.resolve(__dirname, '..'), options = {}) {
  const targetSlug = options.module ? String(options.module).trim().toLowerCase() : null;
  const milestone = options.milestone ? String(options.milestone).trim() : 'Current Milestone';
  const preloaded = loadIndexedModules(repoRoot, targetSlug);
  const { selectedModules } = preloaded;
  const rtm = computeTraceabilityReport(repoRoot, { ...options, _preloaded: preloaded });

  let totalPass = 0;
  let totalFail = 0;
  let totalBlocked = 0;
  let totalSkipped = 0;
  let totalDirty = 0;
  let highPrioPass = 0;
  let highPrioExecDenom = 0;
  let criticalReqsTotal = 0;
  let criticalReqsPassed = 0;
  let executedModulesCount = 0;
  let executionRunsCount = 0;
  let retestRunsCount = 0;

  const moduleRows = [];
  const untestedEntries = [
    ...rtm.undocumentedModules.map((u) => ({
      module: u.module,
      status: u.status,
      reason: u.risk,
      risk: '🟠 High',
    })),
  ];

  const bySeverity = {
    CRITICAL: { total: 0, open: 0, closed: 0 },
    MAJOR: { total: 0, open: 0, closed: 0 },
    MINOR: { total: 0, open: 0, closed: 0 },
    TRIVIAL: { total: 0, open: 0, closed: 0 },
  };
  const openBugs = [];
  let totalBugsCount = 0;
  let totalClosedBugsCount = 0;

  for (const mod of selectedModules) {
    const nonRetestExecs = mod.parsedExecFiles
      .filter((e) => e.parsedExec.kind !== 'retest' && !e.parsedExec.isRetest)
      .sort((a, b) => numericRunOrder(a) - numericRunOrder(b));
    const retestExecs = mod.parsedExecFiles
      .filter((e) => e.parsedExec.kind === 'retest' || e.parsedExec.isRetest)
      .sort((a, b) => numericRunOrder(a) - numericRunOrder(b));
    executionRunsCount += nonRetestExecs.length;
    retestRunsCount += retestExecs.length;

    const latestExec =
      nonRetestExecs[nonRetestExecs.length - 1] ||
      retestExecs[retestExecs.length - 1] ||
      null;

    let modPass = 0;
    let modFail = 0;
    let modBlocked = 0;
    let modSkipped = 0;
    const modDirty = Number(latestExec?.parsedExec?.dirty || 0);
    const tcStatusById = new Map();

    if (latestExec && Array.isArray(latestExec.parsedExec.tcs)) {
      for (const tcRow of latestExec.parsedExec.tcs) {
        const baseTcId = normalizeTcId(tcRow.id);
        const st = String(tcRow.status || '').toUpperCase();
        tcStatusById.set(baseTcId, st);
        if (st === 'PASS') modPass += 1;
        else if (st === 'FAIL') modFail += 1;
        else if (st === 'BLOCKED') modBlocked += 1;
        else if (st === 'SKIPPED') modSkipped += 1;

        const tcDef = mod.tcs.get(baseTcId);
        const isHighPrio = Boolean(
          tcDef && /critical|high|p1|cao/i.test(String(tcDef.priority || ''))
        );
        if (isHighPrio && (st === 'PASS' || st === 'FAIL' || st === 'BLOCKED')) {
          highPrioExecDenom += 1;
          if (st === 'PASS') highPrioPass += 1;
        }
      }
    }

    totalPass += modPass;
    totalFail += modFail;
    totalBlocked += modBlocked;
    totalSkipped += modSkipped;
    totalDirty += modDirty;

    const modExecDenom = modPass + modFail + modBlocked;
    const modPassRate =
      modExecDenom > 0 ? Number(((modPass / modExecDenom) * 100).toFixed(1)) : 0;
    const modTotalTcs = modPass + modFail + modBlocked + modSkipped;

    if (mod.tcList.length > 0 && modExecDenom > 0) {
      executedModulesCount += 1;
    } else {
      untestedEntries.push({
        module: mod.slug,
        status: mod.tcList.length === 0 ? '⬜ Chưa có TC' : '🟨 Chưa thực thi',
        reason:
          mod.tcList.length === 0
            ? 'Module chưa sinh bộ Test Cases'
            : 'Module đã có TC nhưng chưa có execution_report.md',
        risk: '🟠 High',
      });
    }

    if (modSkipped > 0 || modBlocked > 0 || modDirty > 0) {
      untestedEntries.push({
        module: mod.slug,
        status: `⚠️ Nợ kiểm thử (${modBlocked} BLOCKED · ${modSkipped} SKIPPED · ${modDirty} data chưa dọn)`,
        reason: 'TC bị chặn, tạm hoãn hoặc còn dữ liệu kiểm thử chưa dọn trong đợt chạy mới nhất',
        risk: modBlocked > 0 ? '🟠 High' : '🟡 Medium',
      });
    }

    moduleRows.push({
      module: mod.slug,
      total: modTotalTcs,
      pass: modPass,
      fail: modFail,
      blocked: modBlocked,
      skipped: modSkipped,
      dirty: modDirty,
      passRate: modPassRate,
      source: latestExec ? latestExec.relFile : '—',
    });

    // Evaluate Critical REQs in module (only for modules that have test cases)
    if (mod.tcList.length > 0) {
      const reqToTcObjs = buildModuleReqToTcObjectsMap(mod);
      for (const [reqId] of mod.reqs.entries()) {
        if (mod.outOfScopeReqs.has(reqId)) continue;
        const linkedTcs = reqToTcObjs.get(reqId) || [];
        const isCritReq =
          linkedTcs.length === 0 ||
          linkedTcs.some((tc) =>
            /critical|high|p1|cao/i.test(`${tc.priority || ''} ${tc.risk || ''}`)
          );
        if (isCritReq) {
          criticalReqsTotal += 1;
          if (linkedTcs.some((tc) => tcStatusById.get(tc.id) === 'PASS')) {
            criticalReqsPassed += 1;
          }
        }
      }
    }

    // Aggregate Bugs in module
    for (const { parsedBug } of mod.parsedBugFiles) {
      const sev = ['CRITICAL', 'MAJOR', 'MINOR', 'TRIVIAL'].includes(parsedBug.severity)
        ? parsedBug.severity
        : 'MINOR';
      const isClosed = String(parsedBug.status || '').toUpperCase() === 'CLOSED';
      totalBugsCount += 1;
      bySeverity[sev].total += 1;
      if (isClosed) {
        totalClosedBugsCount += 1;
        bySeverity[sev].closed += 1;
      } else {
        bySeverity[sev].open += 1;
        openBugs.push({
          module: mod.slug,
          id: parsedBug.id,
          title: parsedBug.title,
          severity: sev,
          priority: parsedBug.priority || '—',
          status: parsedBug.status,
          tc: parsedBug.tc,
          req: parsedBug.req,
        });
      }
    }
  }

  const defects = {
    total: totalBugsCount,
    totalOpen: openBugs.length,
    totalClosed: totalClosedBugsCount,
    openCritical: bySeverity.CRITICAL.open,
    openMajor: bySeverity.MAJOR.open,
    openMinor: bySeverity.MINOR.open,
    openTrivial: bySeverity.TRIVIAL.open,
    bySeverity,
    openBugs,
  };

  const execDenom = totalPass + totalFail + totalBlocked;
  const totalExecutedWithSkipped = execDenom + totalSkipped;
  const passRate = execDenom > 0 ? Number(((totalPass / execDenom) * 100).toFixed(1)) : 0;
  const blockedRate =
    execDenom > 0 ? Number(((totalBlocked / execDenom) * 100).toFixed(1)) : 0;
  const highPriorityPassRate =
    highPrioExecDenom > 0
      ? Number(((highPrioPass / highPrioExecDenom) * 100).toFixed(1))
      : passRate;
  const criticalReqPassRate =
    criticalReqsTotal > 0
      ? Number(((criticalReqsPassed / criticalReqsTotal) * 100).toFixed(1))
      : 100;
  const totalInScopeModules = selectedModules.length + rtm.undocumentedModules.length;
  const inScopeModulesExecutedPct =
    totalInScopeModules > 0
      ? Number(((executedModulesCount / totalInScopeModules) * 100).toFixed(1))
      : 100;

  const exitCriteria = [
    {
      index: 1,
      criterion: 'Bug **Critical** đang mở',
      threshold: '0',
      actual: String(defects.openCritical),
      passed: defects.openCritical === 0,
    },
    {
      index: 2,
      criterion: 'Bug **Major** đang mở',
      threshold: '0',
      actual: String(defects.openMajor),
      passed: defects.openMajor === 0,
    },
    {
      index: 3,
      criterion: 'Pass rate TC **Priority High**',
      threshold: '≥ 95%',
      actual: `${highPriorityPassRate}%`,
      passed: highPriorityPassRate >= 95,
    },
    {
      index: 4,
      criterion: 'Pass rate toàn bộ TC đã chạy',
      threshold: '≥ 90%',
      actual: `${passRate}%`,
      passed: passRate >= 90,
    },
    {
      index: 5,
      criterion: 'Tỷ lệ **BLOCKED**',
      threshold: '≤ 5%',
      actual: `${blockedRate}%`,
      passed: blockedRate <= 5,
    },
    {
      index: 6,
      criterion: 'REQ mức Critical có ít nhất 1 TC **PASS**',
      threshold: '100%',
      actual: `${criticalReqPassRate}% (${criticalReqsPassed}/${criticalReqsTotal})`,
      passed: criticalReqPassRate === 100,
    },
    {
      index: 7,
      criterion: 'Module trong phạm vi release đã có TC và đã chạy',
      threshold: '100%',
      actual: `${inScopeModulesExecutedPct}% (${executedModulesCount}/${totalInScopeModules})`,
      passed: inScopeModulesExecutedPct === 100,
    },
  ];

  const passedCriteriaCount = exitCriteria.filter((c) => c.passed).length;
  let verdict = 'GO';
  let verdictBanner = `🟢 GO — Đạt ${passedCriteriaCount}/7 tiêu chí exit`;
  if (
    defects.openCritical > 0 ||
    passRate < 70 ||
    criticalReqPassRate < 80 ||
    inScopeModulesExecutedPct === 0
  ) {
    verdict = 'NO_GO';
    verdictBanner = `🔴 NO-GO — Đạt ${passedCriteriaCount}/7 tiêu chí exit`;
  } else if (passedCriteriaCount < 7) {
    verdict = 'CONDITIONAL_GO';
    verdictBanner = `🟡 GO CÓ ĐIỀU KIỆN — Đạt ${passedCriteriaCount}/7 tiêu chí exit`;
  }

  const scopeLabel = selectedModules.map((m) => m.slug).join(', ') || 'All Modules';
  const mdLines = [
    `# Báo Cáo Tổng Hợp Kiểm Thử — ${scopeLabel.toUpperCase()} · ${milestone}`,
    '',
    '| Thông tin | Nội dung |',
    '|---|---|',
    `| Phạm vi · Mốc | ${scopeLabel} · ${milestone} |`,
    `| Nguồn dữ liệu | ${executionRunsCount} execution, ${retestRunsCount} retest, ${defects.total} bug reports |`,
    '| Cấu trúc tài liệu | Biên soạn theo cấu trúc ISO/IEC/IEEE 29119-3 — Test Completion Report (ánh xạ ở mục 9) |',
    '',
    '## 1. Khuyến nghị (Test Completion Evaluation)',
    `> ## ${verdictBanner}`,
    `- **Ranh giới trách nhiệm:** QA đưa ra khuyến nghị dựa trên bằng chứng định lượng; quyết định phát hành cuối cùng thuộc về PM/PO.`,
    '',
    '## 2. Vùng CHƯA Được Kiểm Thử & Nợ Kiểm Thử (Deviations & Residual Risks)',
    '',
    '| Module | Trạng thái | Nguyên nhân chưa kiểm thử | Mức rủi ro |',
    '|---|---|---|---|',
    ...(untestedEntries.length > 0
      ? untestedEntries.map(
          (u) =>
            `| ${u.module.replace(/\|/g, '\\|')} | ${u.status.replace(/\|/g, '\\|')} | ${u.reason.replace(/\|/g, '\\|')} | ${u.risk} |`
        )
      : ['| — | ✅ Đã phủ 100% | Không có vùng mù hoặc nợ kiểm thử tồn đọng | 🟢 Low |']),
    '',
    '## 3. Đối Chiếu Tiêu Chí Exit',
    '',
    '| # | Tiêu chí | Ngưỡng | Thực tế | Kết quả |',
    '|---|---|---|---|---|',
    ...exitCriteria.map(
      (c) =>
        `| ${c.index} | ${c.criterion} | \`${c.threshold}\` | \`${c.actual}\` | ${c.passed ? '✅ Đạt' : '❌ Không đạt'} |`
    ),
    '',
    '## 4. Kết Quả Kiểm Thử Theo Module (Testing Performed & Measures)',
    '',
    '| Module | Tổng TC | ✅ PASS | ❌ FAIL | ⚠️ BLOCKED | ⏭️ SKIP | Pass rate | Nguồn |',
    '|---|---|---|---|---|---|---|---|',
    ...moduleRows.map(
      (r) =>
        `| ${r.module} | ${r.total} | ${r.pass} | ${r.fail} | ${r.blocked} | ${r.skipped} | ${r.passRate}% | \`${r.source}\` |`
    ),
    '',
    '## 5. Tình Hình Lỗi (Defect Metrics)',
    '',
    '| Mức độ (Severity) | Tổng số | Đang mở | Đã đóng |',
    '|---|---|---|---|',
    `| 🔴 Critical | ${defects.bySeverity.CRITICAL.total} | ${defects.bySeverity.CRITICAL.open} | ${defects.bySeverity.CRITICAL.closed} |`,
    `| 🟠 Major | ${defects.bySeverity.MAJOR.total} | ${defects.bySeverity.MAJOR.open} | ${defects.bySeverity.MAJOR.closed} |`,
    `| 🟡 Minor | ${defects.bySeverity.MINOR.total} | ${defects.bySeverity.MINOR.open} | ${defects.bySeverity.MINOR.closed} |`,
    `| 🟢 Trivial | ${defects.bySeverity.TRIVIAL.total} | ${defects.bySeverity.TRIVIAL.open} | ${defects.bySeverity.TRIVIAL.closed} |`,
    '',
    ...(defects.openBugs.length > 0
      ? [
          '### Danh sách Bug đang mở',
          '',
          '| Mã Bug | Module | Tiêu đề | Severity | Priority | TC / REQ | Trạng thái |',
          '|---|---|---|---|---|---|---|',
          ...defects.openBugs.map(
            (b) =>
              `| \`${b.id}\` | ${b.module} | ${(b.title || '').replace(/\|/g, '\\|')} | ${b.severity} | ${b.priority} | ${[b.tc, b.req].filter(Boolean).join(' · ') || '—'} | ${b.status} |`
          ),
          '',
        ]
      : []),
    '## 6. Độ Phủ Yêu Cầu (Coverage Measures từ RTM)',
    '',
    '| Chỉ số | Giá trị |',
    '|---|---|',
    `| REQ trong phạm vi có ≥ 1 TC | ${rtm.summary.coveredReqs}/${rtm.summary.inScopeReqs} (${rtm.summary.coveragePct}%) |`,
    `| REQ mức Critical có ít nhất 1 TC PASS | ${criticalReqsPassed}/${criticalReqsTotal} (${criticalReqPassRate}%) |`,
    `| TC đã Automate | ${rtm.summary.automatedTcs}/${rtm.summary.totalTcs} |`,
    '',
    '## 7. Đề Xuất Hành Động Tiếp Theo',
    defects.totalOpen > 0
      ? `- Ưu tiên xử lý ${defects.totalOpen} bug đang mở (đặc biệt ${defects.openCritical} Critical và ${defects.openMajor} Major) rồi chạy \`/retest-fixed-bugs\`.`
      : '- Duy trì bộ regression suite và đóng mốc kiểm thử.',
    '',
    '## 8. Yếu Tố Cản Trở, Bài Học & Tài Sản Tái Sử Dụng',
    `- **Nợ kiểm thử & Vệ sinh dữ liệu:** ${totalBlocked} BLOCKED · ${totalSkipped} SKIPPED · ${totalDirty} bản ghi test data chưa dọn.`,
    `- **Tài sản tái sử dụng:** ${rtm.summary.totalReqs} REQs · ${rtm.summary.totalTcs} TCs · ${rtm.summary.automatedTcs} kịch bản tự động hóa.`,
    '',
    '## 9. Phụ Lục — Ánh Xạ Cấu Trúc ISO/IEC/IEEE 29119-3',
    '',
    '| Mục trong báo cáo | Mục tương ứng trong ISO/IEC/IEEE 29119-3 (Test Completion Report) |',
    '|---|---|',
    '| 1. Khuyến nghị | Test Completion Evaluation |',
    '| 2. Vùng chưa kiểm thử & Nợ kiểm thử | Deviations from Planned Testing & Residual Risks |',
    '| 3. Đối chiếu Tiêu chí Exit | Evaluation of Test Completion Criteria |',
    '| 4. Kết quả kiểm thử theo Module | Summary of Testing Performed |',
    '| 5. Tình hình lỗi & 6. Độ phủ RTM | Summary of Test Measures (Defects & Coverage) |',
    '| 7. Đề xuất & 8. Bài học kinh nghiệm | Lessons Learned & Reusable Assets |',
    '',
  ];

  return {
    verdict,
    verdictBanner,
    milestone,
    modules: selectedModules.map((m) => m.slug),
    passedCriteriaCount,
    exitCriteria,
    execution: {
      total: totalExecutedWithSkipped,
      pass: totalPass,
      fail: totalFail,
      blocked: totalBlocked,
      skipped: totalSkipped,
      dirty: totalDirty,
      passRate,
      blockedRate,
      highPriorityPassRate,
    },
    defects,
    coverage: {
      inScopeReqs: rtm.summary.inScopeReqs,
      coveredReqs: rtm.summary.coveredReqs,
      coveragePct: rtm.summary.coveragePct,
      criticalReqsTotal,
      criticalReqsPassed,
      criticalReqPassRate,
    },
    untestedEntries,
    moduleRows,
    markdown: mdLines.join('\n'),
  };
}

function parseCliArgs(argv) {
  let mode = 'check';
  let rootDir = path.resolve(__dirname, '..');
  let moduleSlug = null;
  let milestone = 'Current Milestone';
  let outFile = null;
  let json = false;
  let help = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      help = true;
    } else if (arg === '--check') {
      mode = 'check';
    } else if (arg === '--rtm') {
      mode = 'rtm';
    } else if (arg === '--summary') {
      mode = 'summary';
    } else if (arg === '--root' && argv[i + 1]) {
      rootDir = path.resolve(argv[++i]);
    } else if (arg.startsWith('--root=')) {
      rootDir = path.resolve(arg.slice('--root='.length));
    } else if (arg === '--module' && argv[i + 1]) {
      moduleSlug = argv[++i];
    } else if (arg.startsWith('--module=')) {
      moduleSlug = arg.slice('--module='.length);
    } else if (arg === '--milestone' && argv[i + 1]) {
      milestone = argv[++i];
    } else if (arg.startsWith('--milestone=')) {
      milestone = arg.slice('--milestone='.length);
    } else if ((arg === '--out' || arg === '--output') && argv[i + 1]) {
      outFile = path.resolve(argv[++i]);
    } else if (arg.startsWith('--out=') || arg.startsWith('--output=')) {
      outFile = path.resolve(arg.split('=').slice(1).join('='));
    } else if (arg === '--json') {
      json = true;
    }
  }
  return { mode, rootDir, moduleSlug, milestone, outFile, json, help };
}

function emitCliReport(report, { json, outFile }) {
  const outputText = json ? JSON.stringify(report, null, 2) : report.markdown;
  if (outFile) {
    fs.mkdirSync(path.dirname(outFile), { recursive: true });
    fs.writeFileSync(outFile, outputText, 'utf8');
  }
  process.stdout.write(outputText);
  process.exit(0);
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  const { mode, rootDir, moduleSlug, milestone, outFile, json, help } = parseCliArgs(
    process.argv.slice(2)
  );
  if (help) {
    console.log(
      'Usage: node scripts/validate-docs.mjs [--check|--rtm|--summary] [--module <slug>] [--milestone <name>] [--root <dir>] [--out <file>] [--json]'
    );
    process.exit(0);
  }
  if (mode === 'rtm') {
    emitCliReport(computeTraceabilityReport(rootDir, { module: moduleSlug }), { json, outFile });
  } else if (mode === 'summary') {
    emitCliReport(computeTestSummaryReport(rootDir, { module: moduleSlug, milestone }), {
      json,
      outFile,
    });
  } else {
    const result = validateDocsTree(rootDir);
    if (json) {
      console.log(JSON.stringify(result, null, 2));
    } else if (result.valid) {
      console.log(
        `Artifact Integrity Gate PASSED: ${result.stats.markdownFiles} docs, ${result.stats.totalReqs} REQs, ${result.stats.totalTcs} TCs, ${result.stats.totalBugs} Bug Reports across [${result.modules.join(', ')}].`
      );
    } else {
      console.error('Artifact Integrity Gate FAILED:');
      for (const bp of result.brokenPointers) {
        console.error(`  [BROKEN POINTER] ${bp.sourceFile} -> ${bp.rawTarget}`);
      }
      for (const sv of result.schemaViolations) {
        console.error(`  [SCHEMA VIOLATION] ${sv.file}: ${sv.message}`);
      }
      for (const re of result.referentialErrors) {
        console.error(`  [REFERENTIAL ERROR] ${re.file}: ${re.message}`);
      }
    }
    process.exit(result.valid ? 0 : 1);
  }
}



