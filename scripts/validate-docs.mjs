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
  colIdx,
  compareRunOrder,
  extractDocTcStatusMap,
  extractPrimaryIds,
  formatCellPlainText,
  normStatus,
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

function extractMaxUsedIdNumber(text, idRegex) {
  const matches = [...String(text || '').matchAll(idRegex)];
  if (matches.length === 0) return null;
  return Math.max(...matches.map((m) => Number(m[1])));
}

function extractReqDefinitionsFromMarkdown(
  content,
  sourceRelPath,
  outMap,
  outOfScopeSet,
  duplicateReqs = []
) {
  const tables = parseMarkdownTables(content, { ignoreCodeFences: true });

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
        const reqStatusKey = classifyReqStatus(status);
        if (reqStatusKey === 'UNIMPLEMENTED' || reqStatusKey === 'DEPRECATED') {
          outOfScopeSet.add(reqId);
        }
        if (outMap.has(reqId)) {
          duplicateReqs.push({
            id: reqId,
            file: sourceRelPath,
            firstFile: outMap.get(reqId).sourceFile,
          });
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
        duplicateReqs: [],
        outOfScopeReqs: new Set(),
        outOfScopeTableRefs: [],
        tcs: new Map(),
        duplicateTcs: [],
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

  function collectIndexAndNestedMd(modDir, indexFileName, targetList) {
    const indexFile = path.join(modDir, indexFileName);
    if (fs.existsSync(indexFile)) targetList.push(indexFile);
    for (const entry of fs.readdirSync(modDir, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.name === 'impact' || entry.name === 'archive') continue;
      targetList.push(...walkFiles(path.join(modDir, entry.name), (f) => f.endsWith('.md')));
    }
  }

  // 1. Scan requirements + impact reports
  walkBranchModules(path.join(docsDir, 'requirements'), (mod, modDir, leafName) => {
    collectIndexAndNestedMd(modDir, `requirements_${leafName}.md`, mod.reqFiles);
    const impactDir = path.join(modDir, 'impact');
    if (fs.existsSync(impactDir)) {
      mod.impactFiles.push(...walkFiles(impactDir, (f) => f.endsWith('.md')));
    }
  });

  // 2. Scan testcases (index + nested subdirs + impact/*.md)
  walkBranchModules(path.join(docsDir, 'testcases'), (mod, modDir, leafName) => {
    collectIndexAndNestedMd(modDir, `test_cases_${leafName}.md`, mod.tcFiles);
    const impactDir = path.join(modDir, 'impact');
    if (fs.existsSync(impactDir)) {
      mod.impactFiles.push(...walkFiles(impactDir, (f) => f.endsWith('.md')));
    }
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

  // 5. Scan user-guides (index + nested subdirs)
  walkBranchModules(path.join(docsDir, 'user-guides'), (mod, modDir, leafName) => {
    collectIndexAndNestedMd(modDir, `user_guide_${leafName}.md`, mod.userGuideFiles);
  });

  return modulesMap;
}

function listBranchCatalogReadmes(repoRoot, branchName) {
  const branchRoot = path.join(repoRoot, 'docs', branchName);
  if (!fs.existsSync(branchRoot)) return [];
  const candidateReadmes = [];
  const primaryReadme = path.join(branchRoot, 'README.md');
  if (fs.existsSync(primaryReadme)) {
    candidateReadmes.push({ namespace: '', fullPath: primaryReadme });
  }
  for (const entry of fs.readdirSync(branchRoot, { withFileTypes: true })) {
    if (!entry.isDirectory() || !entry.name.startsWith('_') || entry.name === '_discovery') continue;
    const secReadme = path.join(branchRoot, entry.name, 'README.md');
    if (fs.existsSync(secReadme)) {
      candidateReadmes.push({ namespace: entry.name, fullPath: secReadme });
    }
  }
  return candidateReadmes;
}

function extractCatalogLinkedSlug(rawText, namespace, docPrefix) {
  const re = new RegExp(
    `(?:^|[\\s(\`])(?:\\.\\/)?([A-Za-z0-9_/-]+)\\/${docPrefix}_[A-Za-z0-9_-]+\\.md`
  );
  const m = String(rawText || '').match(re);
  if (!m) return null;
  const relDir = m[1].replace(/^\/+|\/+$/g, '');
  if (!namespace) return relDir.toLowerCase();
  const nsLower = namespace.toLowerCase();
  if (relDir.toLowerCase().startsWith(`${nsLower}/`)) {
    return relDir.toLowerCase();
  }
  return `${nsLower}/${relDir.toLowerCase()}`;
}

export function classifyReqStatus(rawStatus) {
  const s = String(rawStatus || '').trim();
  if (s.includes('🔴') || /deprecated|gỡ bỏ|đã bỏ/i.test(s)) return 'DEPRECATED';
  if (s.includes('⚪') || /chưa implement|chua implement|out of scope|ngoài phạm vi/i.test(s)) {
    return 'UNIMPLEMENTED';
  }
  if (s.includes('🟡') || /changed|sửa đổi/i.test(s)) return 'CHANGED';
  return 'ACTIVE';
}

/**
 * Discovers primary (`docs/requirements/README.md`) and secondary system
 * (`docs/requirements/_<system>/README.md`) requirement catalogs.
 */
function scanRequirementCatalogs(repoRoot) {
  const candidateReadmes = listBranchCatalogReadmes(repoRoot, 'requirements');
  if (candidateReadmes.length === 0) {
    return { catalogs: [], undocumentedModules: [], catalogEntries: [] };
  }

  const catalogs = [];
  const undocumentedModules = [];
  const catalogEntries = [];

  for (const { namespace, fullPath } of candidateReadmes) {
    const relFile = path.relative(repoRoot, fullPath).replace(/\\/g, '/');
    const tables = parseMarkdownTables(fs.readFileSync(fullPath, 'utf8'), {
      ignoreCodeFences: true,
    });
    const catalog = tables.find((t) => {
      const h0 = (t.headers[0] || '').trim().toLowerCase();
      const h1 = (t.headers[1] || '').trim().toLowerCase();
      return h0 === 'module' && (h1.includes('prefix') || h1 === 'mã');
    });
    const statusTable = tables.find(
      (t) =>
        colIdx(t.header, /trạng thái|trang thai/i) >= 0 &&
        colIdx(t.header, /số lượng|so luong/i) >= 0
    );
    catalogs.push({ namespace, relFile, catalog, statusTable });

    if (catalog && catalog.headers.length >= 7) {
      const headersLower = catalog.headers.map((h) => h.trim().toLowerCase());
      const statusIdx = headersLower.findIndex((h) => h.includes('trạng thái'));
      const docIdx = headersLower.findIndex(
        (h) => h === 'tài liệu' || (h.includes('tài liệu') && !h.includes('mức phủ'))
      );
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

        const docCell = String(row[docIdx >= 0 ? docIdx : 4] || '').trim();
        const linkedSlug = extractCatalogLinkedSlug(docCell, namespace, 'requirements');

        const statusCell = formatCellPlainText(row[statusIdx >= 0 ? statusIdx : 2] || '').trim();
        const usedCell = formatCellPlainText(row[usedIdx >= 0 ? usedIdx : 5] || '').trim();
        const ambCell = ambIdx >= 0 ? formatCellPlainText(row[ambIdx] || '').trim() : '';

        catalogEntries.push({
          namespace,
          modName,
          prefix,
          docCell,
          linkedSlug,
          statusCell,
          usedCell,
          ambCell,
        });

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
            linkedSlug,
            module: label,
            status: statusCell || '⬜ Chưa khảo sát',
            risk,
          });
        }
      }
    }
  }

  return { catalogs, undocumentedModules, catalogEntries };
}

function scanTestcaseCatalogs(repoRoot) {
  const candidateReadmes = listBranchCatalogReadmes(repoRoot, 'testcases');
  const catalogs = [];
  const catalogEntries = [];

  for (const { namespace, fullPath } of candidateReadmes) {
    const relFile = path.relative(repoRoot, fullPath).replace(/\\/g, '/');
    const tables = parseMarkdownTables(fs.readFileSync(fullPath, 'utf8'), {
      ignoreCodeFences: true,
    });
    const tcCatalogTable = tables.find(
      (t) =>
        (t.headers[0] || '').trim().toLowerCase() === 'module' &&
        (t.headers[1] || '').trim().toLowerCase().includes('prefix')
    );
    const tcCoverageTable = tables.find(
      (t) =>
        colIdx(t.header, /^module$/i) >= 0 &&
        colIdx(t.header, /req có tài liệu/i) >= 0
    );
    catalogs.push({ namespace, relFile, tcCatalogTable, tcCoverageTable });

    if (tcCatalogTable) {
      for (const row of tcCatalogTable.rows) {
        const modName = formatCellPlainText(row[0] || '').trim();
        const prefixCell = formatCellPlainText(row[1] || '')
          .replace(/`/g, '')
          .trim();
        if (!modName && !prefixCell) continue;
        const linkedSlug = extractCatalogLinkedSlug(row.join(' '), namespace, 'test_cases');
        catalogEntries.push({
          namespace,
          modName,
          prefixCell,
          linkedSlug,
        });
      }
    }
  }

  return { catalogs, catalogEntries };
}

function scanBugCatalogs(repoRoot) {
  const candidateReadmes = listBranchCatalogReadmes(repoRoot, 'bugs');
  const catalogs = [];
  for (const { namespace, fullPath } of candidateReadmes) {
    const relFile = path.relative(repoRoot, fullPath).replace(/\\/g, '/');
    const content = fs.readFileSync(fullPath, 'utf8');
    const tables = parseMarkdownTables(content, { ignoreCodeFences: true });
    catalogs.push({ namespace, relFile, content, tables });
  }
  return { catalogs };
}

/**
 * Resolves a caller-supplied `options.module` token (which may be a directory slug like
 * `customers`, a REQ/catalog prefix like `CUST` or `_book-api/AUTH`, or a TC prefix like
 * `CRM_CUST_TC_`) into the canonical module slug.
 */
function resolveTargetModule(
  repoRoot,
  rawModuleInput,
  modulesMap = collectModuleArtifacts(repoRoot),
  reqScan = scanRequirementCatalogs(repoRoot),
  tcScan = scanTestcaseCatalogs(repoRoot)
) {
  if (!rawModuleInput || !String(rawModuleInput).trim()) {
    return { targetSlug: null, known: true, matchedCatalogEntry: null };
  }
  const qLower = String(rawModuleInput).trim().toLowerCase().replace(/^\/+|\/+$/g, '');

  for (const slug of modulesMap.keys()) {
    if (slug.toLowerCase() === qLower) {
      return { targetSlug: slug.toLowerCase(), known: true, matchedCatalogEntry: null };
    }
  }

  let fallbackCatalogHit = null;
  for (const entry of reqScan.catalogEntries || []) {
    const pLower = entry.prefix.toLowerCase();
    const pUnderscore = pLower.replace(/-/g, '_');
    const nsLower = entry.namespace ? entry.namespace.toLowerCase() : '';
    const nsPrefixLower = nsLower ? `${nsLower}/${pLower}` : pLower;
    const modNameLower = entry.modName.toLowerCase();
    const nsModNameLower = nsLower ? `${nsLower}/${modNameLower}` : modNameLower;
    const escapedP = pLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const escapedPUnderscore = pUnderscore.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const tcPrefixRegex = new RegExp(
      `^(?:[a-z0-9]+_)?(?:${escapedP}|${escapedPUnderscore})_tc_?$`,
      'i'
    );
    if (
      qLower === pLower ||
      qLower === pUnderscore ||
      qLower === nsPrefixLower ||
      qLower === modNameLower ||
      qLower === nsModNameLower ||
      qLower === `req-${pLower}` ||
      (nsLower && qLower === `${nsLower}/req-${pLower}`) ||
      tcPrefixRegex.test(qLower)
    ) {
      if (entry.linkedSlug && modulesMap.has(entry.linkedSlug.toLowerCase())) {
        return {
          targetSlug: entry.linkedSlug.toLowerCase(),
          known: true,
          matchedCatalogEntry: entry,
        };
      }
      if (entry.linkedSlug) {
        return {
          targetSlug: entry.linkedSlug.toLowerCase(),
          known: true,
          matchedCatalogEntry: entry,
        };
      }
      if (modulesMap.has(nsPrefixLower)) {
        return { targetSlug: nsPrefixLower, known: true, matchedCatalogEntry: entry };
      }
      if (!fallbackCatalogHit) {
        fallbackCatalogHit = { targetSlug: nsPrefixLower, known: true, matchedCatalogEntry: entry };
      }
    }
  }

  const qStripped = qLower.replace(/_tc_?$/, '');
  for (const tcEntry of tcScan.catalogEntries || []) {
    const prefixLower = tcEntry.prefixCell.toLowerCase();
    const modLower = tcEntry.modName.toLowerCase();
    const nsLower = tcEntry.namespace ? tcEntry.namespace.toLowerCase() : '';
    const nsPrefixLower = nsLower ? `${nsLower}/${prefixLower}` : prefixLower;
    if (
      prefixLower === qLower ||
      prefixLower.replace(/_tc_?$/, '') === qStripped ||
      nsPrefixLower === qLower ||
      nsPrefixLower.replace(/_tc_?$/, '') === qStripped ||
      modLower === qLower
    ) {
      if (tcEntry.linkedSlug) {
        return {
          targetSlug: tcEntry.linkedSlug.toLowerCase(),
          known: true,
          matchedCatalogEntry: fallbackCatalogHit?.matchedCatalogEntry || null,
        };
      }
    }
  }

  const qWithoutNs = qLower.startsWith('_') && qLower.includes('/') ? qLower.split('/').slice(1).join('/') : qLower;
  const hasTcSuffix = /_tc_?$/i.test(qWithoutNs);
  const cleanToken = hasTcSuffix
    ? qWithoutNs.replace(/_tc_?$/, '').replace(/^[a-z0-9]+_/, '')
    : qWithoutNs.replace(/^req-/, '');
  const cleanTokenHyphen = cleanToken.replace(/_/g, '-');
  const cleanTokenUnderscore = cleanToken.replace(/-/g, '_');
  const queryNs = qLower.startsWith('_') && qLower.includes('/') ? qLower.split('/')[0] : null;

  for (const [slug, mod] of modulesMap.entries()) {
    const slugLower = slug.toLowerCase();
    if (queryNs && !slugLower.startsWith(`${queryNs}/`)) continue;
    for (const reqFile of mod.reqFiles) {
      const content = fs.readFileSync(reqFile, 'utf8');
      for (const m of content.matchAll(REQ_ID_REGEX)) {
        const reqPre = m[0].replace(/^REQ-/i, '').replace(/-\d+$/, '').toLowerCase();
        const reqLeaf = reqPre.split('-').pop();
        if (
          reqPre === qWithoutNs ||
          reqPre === cleanToken ||
          reqPre === cleanTokenHyphen ||
          reqLeaf === cleanToken
        ) {
          return {
            targetSlug: slugLower,
            known: true,
            matchedCatalogEntry: fallbackCatalogHit?.matchedCatalogEntry || null,
          };
        }
      }
    }
    for (const tcFile of mod.tcFiles) {
      const content = fs.readFileSync(tcFile, 'utf8');
      for (const m of content.matchAll(TC_ID_REGEX)) {
        const tcIdLower = m[0].toLowerCase();
        const tcPre = tcIdLower.replace(/\d+(?:-[a-z0-9]+)?$/, '');
        const midMatch = tcIdLower.match(/^[a-z0-9]+_([a-z0-9_]+)_tc_\d+/);
        const midTok = midMatch ? midMatch[1] : '';
        const midLeaf = midTok ? midTok.split('_').pop() : '';
        if (
          tcPre === qWithoutNs ||
          tcPre.replace(/_tc_?$/, '') === qWithoutNs.replace(/_tc_?$/, '') ||
          (midTok &&
            (midTok === qWithoutNs ||
              midTok === cleanToken ||
              midTok === cleanTokenUnderscore ||
              midLeaf === cleanToken))
        ) {
          return {
            targetSlug: slugLower,
            known: true,
            matchedCatalogEntry: fallbackCatalogHit?.matchedCatalogEntry || null,
          };
        }
      }
    }
  }

  if (fallbackCatalogHit) {
    return fallbackCatalogHit;
  }

  return { targetSlug: qLower, known: false, matchedCatalogEntry: null };
}

/**
 * Shared helper that populates a module's `reqs`, `outOfScopeReqs`, `tcs`, `tcList`,
 * `executedTcs`, `openBugs`, and cached parsed file records from its discovered files.
 */
function populateModuleIndex(repoRoot, mod) {
  for (const reqFile of mod.reqFiles) {
    const content = fs.readFileSync(reqFile, 'utf8');
    const relFile = path.relative(repoRoot, reqFile).replace(/\\/g, '/');
    extractReqDefinitionsFromMarkdown(
      content,
      relFile,
      mod.reqs,
      mod.outOfScopeReqs,
      mod.duplicateReqs
    );
  }

  for (const tcFile of mod.tcFiles) {
    const content = fs.readFileSync(tcFile, 'utf8');
    const relFile = path.relative(repoRoot, tcFile).replace(/\\/g, '/');
    const tables = parseMarkdownTables(content, { ignoreCodeFences: true });
    for (const table of tables) {
      const headingLower = (table.heading || '').toLowerCase();
      const h0 = (table.headers[0] || '').trim().toLowerCase();
      if (h0 === 'req id' && (headingLower.includes('không có tc') || headingLower.includes('ngoài phạm vi'))) {
        for (const row of table.rows) {
          for (const match of String(row[0] || '').matchAll(REQ_ID_REGEX)) {
            mod.outOfScopeReqs.add(match[0]);
            mod.outOfScopeTableRefs.push({ reqId: match[0], relFile });
          }
        }
      }
    }
    const parsedTcFile = parseMarkdownFile(path.basename(tcFile), content);
    mod.parsedTcFiles.push({ relFile, tables, parsedTcFile });
    for (const tc of parsedTcFile.testCases) {
      if (mod.tcs.has(tc.id)) {
        mod.duplicateTcs.push({
          id: tc.id,
          file: relFile,
          firstFile: mod.tcs.get(tc.id).sourceFile || relFile,
        });
      }
      mod.tcs.set(tc.id, { ...tc, sourceFile: relFile });
      mod.tcList.push(tc);
    }
  }

  for (const execFile of mod.execFiles) {
    const content = fs.readFileSync(execFile, 'utf8');
    const relFile = path.relative(repoRoot, execFile).replace(/\\/g, '/');
    const tables = parseMarkdownTables(content, { ignoreCodeFences: true });
    const parsedExec = parseExecutionReport(content, relFile);
    mod.parsedExecFiles.push({ relFile, tables, parsedExec });
    for (const rawTc of extractDocTcStatusMap(parsedExec).keys()) {
      const baseTcId = normalizeTcId(rawTc);
      if (baseTcId) mod.executedTcs.add(baseTcId);
    }
  }

  for (const bugFile of mod.bugFiles) {
    const content = fs.readFileSync(bugFile, 'utf8');
    const relFile = path.relative(repoRoot, bugFile).replace(/\\/g, '/');
    const parsedBug = parseBugFile(content, relFile);
    mod.parsedBugFiles.push({ relFile, parsedBug });
    if (String(parsedBug.status || '').toUpperCase() !== 'CLOSED') {
      const primaryTcs = extractPrimaryIds(parsedBug.tc, TC_ID_REGEX);
      const primaryReqs = extractPrimaryIds(parsedBug.req, REQ_ID_REGEX);
      mod.openBugs.push({
        id: parsedBug.id,
        title: parsedBug.title,
        severity: parsedBug.severity,
        priority: parsedBug.priority,
        status: parsedBug.status,
        tc: primaryTcs.length > 0 ? primaryTcs.join(', ') : parsedBug.tc,
        req: primaryReqs.length > 0 ? primaryReqs.join(', ') : parsedBug.req,
      });
    }
  }
}

function extractModuleSlugFromDocsRel(relPath) {
  const parts = String(relPath || '').split('/');
  if (parts.length < 2) return null;
  const branch = parts[0];
  if (!['requirements', 'testcases', 'executions', 'bugs', 'user-guides'].includes(branch)) {
    return null;
  }
  const seg1 = parts[1];
  if (!seg1 || seg1.endsWith('.md') || seg1 === '_discovery' || seg1 === 'archive') return null;
  if (seg1.startsWith('_')) {
    const seg2 = parts[2];
    if (!seg2 || seg2.endsWith('.md') || seg2 === '_discovery' || seg2 === 'archive') return null;
    return `${seg1}/${seg2}`;
  }
  return seg1;
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

  const modulesMap = collectModuleArtifacts(repoRoot);
  const reqScan = scanRequirementCatalogs(repoRoot);
  const tcScan = scanTestcaseCatalogs(repoRoot);
  const bugScan = scanBugCatalogs(repoRoot);
  const resolvedMod = resolveTargetModule(repoRoot, options.module, modulesMap, reqScan, tcScan);
  const targetModule = resolvedMod.targetSlug;

  if (
    targetModule &&
    !resolvedMod.known &&
    (modulesMap.size > 0 || reqScan.catalogs.length > 0 || tcScan.catalogs.length > 0)
  ) {
    referentialErrors.push({
      file: 'docs/requirements/README.md',
      message: `Unknown target module "${options.module}" (not found in docs/ directory or Module Catalogs)`,
    });
  }

  // 1. Validate all Markdown links, evidence image paths, and inline-code pointers across docs/
  const allMdFiles = walkFiles(docsDir, (f) => {
    if (!f.endsWith('.md')) return false;
    if (!targetModule) return true;
    const rel = path.relative(docsDir, f).replace(/\\/g, '/').toLowerCase();
    return extractModuleSlugFromDocsRel(rel) === targetModule;
  });
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

  // 2. Validate Module Catalog tables & ID range continuity in docs/requirements/README.md, docs/requirements/_<system>/README.md, docs/testcases/README.md, docs/testcases/_<system>/README.md, and docs/user-guides/README.md
  const reqCatalogs = targetModule ? [] : reqScan.catalogs;
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
        const maxUsed = extractMaxUsedIdNumber(usedRange, /\bREQ-[A-Z0-9_-]+-(\d+)\b/gi);
        const nextMatch = nextCode.match(/\bREQ-[A-Z0-9_-]+-(\d+)\b/i);
        if (maxUsed !== null && nextMatch) {
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

  const tcCatalogs = targetModule ? [] : tcScan.catalogs;
  for (const { relFile: relTcReadme, tcCatalogTable } of tcCatalogs) {
    if (!tcCatalogTable || tcCatalogTable.headers.length < 4) {
      schemaViolations.push({
        file: relTcReadme,
        message: `Expected Test Cases Module Catalog table (Module | Prefix TC ID | Dải đã dùng | Mã kế tiếp | ...) in ${relTcReadme}`,
      });
    } else {
      for (const row of tcCatalogTable.rows) {
        const usedRange = (row[2] || '').replace(/`/g, '');
        const nextCode = (row[3] || '').replace(/`/g, '');
        const prefixedMax = extractMaxUsedIdNumber(usedRange, /\b[A-Z0-9_]+_TC_(\d+)\b/gi);
        const bareRangeMatches = [...usedRange.matchAll(/(\d+)\s*(?:→|->)\s*(\d+)/g)];
        const maxUsed =
          prefixedMax !== null
            ? prefixedMax
            : bareRangeMatches.length > 0
              ? Math.max(...bareRangeMatches.map((m) => Number(m[2])))
              : null;
        const nextMatch =
          nextCode.match(/\b[A-Z0-9_]+_TC_(\d+)\b/i) || nextCode.match(/(\d+)/);
        if (maxUsed !== null && nextMatch) {
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

  const ugCatalogs = [];
  if (!targetModule) {
    for (const { namespace, fullPath: ugReadmePath } of listBranchCatalogReadmes(repoRoot, 'user-guides')) {
      const relUgReadme = path.relative(repoRoot, ugReadmePath).replace(/\\/g, '/');
      const tables = parseMarkdownTables(fs.readFileSync(ugReadmePath, 'utf8'), {
        ignoreCodeFences: true,
      });
      const catalog = tables.find(
        (t) =>
          (t.headers[0] || '').trim().toLowerCase() === 'module' &&
          (t.headers[1] || '').trim().toLowerCase().includes('đối tượng')
      );
      if (!catalog || catalog.headers.length < 6) {
        schemaViolations.push({
          file: relUgReadme,
          message: `Expected User Guides Catalog table (minimum 6 columns starting with Module | Đối tượng đọc) in ${relUgReadme}`,
        });
      } else {
        ugCatalogs.push({ namespace, relFile: relUgReadme, catalog });
      }
    }
  }

  // 3. Collect per-module artifacts & validate schemas + referential integrity
  const allKnownTcIds = new Set();
  const allKnownBugIds = new Set();
  const allKnownBugsMap = new Map();
  let totalReqs = 0;
  let totalTcs = 0;
  let totalBugs = 0;

  for (const mod of modulesMap.values()) {
    if (targetModule && mod.slug.toLowerCase() !== targetModule) continue;
    populateModuleIndex(repoRoot, mod);
    totalReqs += mod.reqs.size;
    totalTcs += mod.tcList.length;
    for (const tcId of mod.tcs.keys()) allKnownTcIds.add(tcId);

    for (const dup of mod.duplicateReqs) {
      referentialErrors.push({
        file: dup.file,
        message: `Duplicate REQ ID "${dup.id}" defined in ${dup.file} (already defined in ${dup.firstFile})`,
      });
    }
    for (const dup of mod.duplicateTcs) {
      referentialErrors.push({
        file: dup.file,
        message: `Duplicate TC ID "${dup.id}" defined in ${dup.file} (already defined in ${dup.firstFile})`,
      });
    }

    if (mod.reqs.size > 0) {
      for (const { reqId, relFile } of mod.outOfScopeTableRefs) {
        if (!mod.reqs.has(reqId)) {
          referentialErrors.push({
            file: relFile,
            message: `Out-of-scope table references unknown REQ ID "${reqId}" (not found in module "${mod.slug}" requirements)`,
          });
        }
      }
    }

    // 3a. Check 13-column TC table schema + REQ references + Bảng Đối Soát Coverage parity + Top metadata range continuity
    const hasMultiPartTcFiles = mod.parsedTcFiles.length > 1;
    let moduleTotalTcTables = 0;
    const modReqToTcObjs = buildModuleReqToTcObjectsMap(mod);
    for (const { relFile, tables, parsedTcFile } of mod.parsedTcFiles) {
      const isIndexTcFile = path.basename(relFile).toLowerCase().startsWith('test_cases_');
      for (const table of tables) {
        if (table.headers.length === 2) {
          let usedTcRange = '';
          let nextTcCode = '';
          for (const row of table.rows) {
            const k = formatCellPlainText(row[0] || '').trim().toLowerCase();
            const v = formatCellPlainText(row[1] || '').replace(/`/g, '').trim();
            if (k === 'tổng số tc' && isIndexTcFile && mod.tcs.size > 0) {
              const totalMatch = v.match(/^(\d+)\b/);
              if (totalMatch && Number(totalMatch[1]) !== mod.tcs.size) {
                referentialErrors.push({
                  file: relFile,
                  message: `Test Cases metadata "Tổng số TC" mismatch: metadata declares ${totalMatch[1]} but ${mod.tcs.size} TCs were found`,
                });
              }
            } else if (k === 'dải tc id' || k === 'dải mã đã dùng') usedTcRange = v;
            else if (k === 'mã kế tiếp') nextTcCode = v;
          }
          if (usedTcRange && nextTcCode) {
            const maxUsed = extractMaxUsedIdNumber(usedTcRange, /\b[A-Z0-9_]+_TC_(\d+)\b/gi);
            const nextMatch = nextTcCode.match(/\b[A-Z0-9_]+_TC_(\d+)\b/i);
            if (maxUsed !== null && nextMatch) {
              const nextNum = Number(nextMatch[1]);
              if (nextNum !== maxUsed + 1) {
                schemaViolations.push({
                  file: relFile,
                  message: `Test Cases metadata ID range discontinuity: max used is ${maxUsed} but next code is ${nextTcCode}`,
                });
              }
            }
          }
        }
      }

      const tcTables = tables.filter((t) => {
        const h0 = (t.headers[0] || '').trim().toLowerCase();
        const h1 = (t.headers[1] || '').trim().toLowerCase();
        return h0 === 'tc id' && (h1 === 'req id' || t.headers.length >= 10);
      });
      moduleTotalTcTables += tcTables.length;

      const isIndexFileWithParts =
        hasMultiPartTcFiles && path.basename(relFile).startsWith('test_cases_');
      if (tcTables.length === 0 && !isIndexFileWithParts) {
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

      for (const table of tables) {
        const headingLower = (table.heading || '').toLowerCase();
        const h0 = (table.headers[0] || '').trim().toLowerCase();
        if (h0 === 'req id' && headingLower.includes('đối soát coverage')) {
          const soTcCol = colIdx(table.header, /^số tc$|^so tc$/i);
          for (const row of table.rows) {
            const reqMatches = [...String(row[0] || '').matchAll(REQ_ID_REGEX)].map((m) => m[0]);
            for (const reqId of reqMatches) {
              if (mod.reqs.size > 0 && !mod.reqs.has(reqId)) {
                referentialErrors.push({
                  file: relFile,
                  message: `Coverage table references unknown REQ ID "${reqId}" (not found in module "${mod.slug}" requirements)`,
                });
              } else if (soTcCol >= 0 && mod.reqs.has(reqId)) {
                const rawSoTc = formatCellPlainText(row[soTcCol] || '').trim();
                if (/^\d+$/.test(rawSoTc)) {
                  const actualLinkedCount = (modReqToTcObjs.get(reqId) || []).length;
                  if (Number(rawSoTc) !== actualLinkedCount) {
                    referentialErrors.push({
                      file: relFile,
                      message: `Coverage table "Số TC" mismatch for "${reqId}": table declares ${rawSoTc} but ${actualLinkedCount} TCs reference "${reqId}"`,
                    });
                  }
                }
              }
            }
          }
        }
      }
    }
    if (mod.parsedTcFiles.length > 0 && moduleTotalTcTables === 0 && hasMultiPartTcFiles) {
      schemaViolations.push({
        file: mod.parsedTcFiles[0].relFile,
        message: 'No Test Case table found with first column "TC ID"',
      });
    }

    // 3b. Validate Bug Reports (REQ ID and TC ID referential integrity)
    const modBugIds = new Set();
    for (const { relFile, parsedBug } of mod.parsedBugFiles) {
      totalBugs += 1;
      if (parsedBug.id) {
        allKnownBugIds.add(parsedBug.id);
        allKnownBugsMap.set(parsedBug.id, { ...parsedBug, moduleSlug: mod.slug });
        modBugIds.add(parsedBug.id);
      }

      const tcMatches = extractPrimaryIds(parsedBug.tc, TC_ID_REGEX);
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

      const reqMatches = extractPrimaryIds(parsedBug.req, REQ_ID_REGEX);
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
          for (const rawTc of extractPrimaryIds(bugRow.tcReq, TC_ID_REGEX)) {
            const baseTc = normalizeTcId(rawTc);
            if (mod.tcs.size > 0 && !mod.tcs.has(baseTc)) {
              referentialErrors.push({
                file: relFile,
                message: `Retest report bug entry references unknown TC ID "${rawTc}"`,
              });
            }
          }
          for (const reqId of extractPrimaryIds(bugRow.tcReq, REQ_ID_REGEX)) {
            if (mod.reqs.size > 0 && !mod.reqs.has(reqId)) {
              referentialErrors.push({
                file: relFile,
                message: `Retest report bug entry references unknown REQ ID "${reqId}"`,
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
        const summaryTable = tables.find(
          (t) =>
            colIdx(t.header, /trạng thái|trang thai/i) >= 0 &&
            colIdx(t.header, /số lượng|so luong/i) >= 0
        );
        if (summaryTable && Array.isArray(parsedExec.tcs) && parsedExec.tcs.length > 0) {
          const stCol = colIdx(summaryTable.header, /trạng thái|trang thai/i);
          const cntCol = colIdx(summaryTable.header, /số lượng|so luong/i);
          for (const sRow of summaryTable.rows) {
            const rawLabel = formatCellPlainText(sRow[stCol] || '').trim();
            const rawCnt = formatCellPlainText(sRow[cntCol] || '').trim();
            if (!/^\d+$/.test(rawCnt)) continue;
            const declaredCnt = Number(rawCnt);
            if (/^(?:tổng|tong|total)$/i.test(rawLabel)) {
              if (declaredCnt !== parsedExec.tcs.length) {
                referentialErrors.push({
                  file: relFile,
                  message: `Execution report summary total mismatch: summary table declares ${declaredCnt} total TCs but TC result table has ${parsedExec.tcs.length}`,
                });
              }
            } else {
              const normSt = normStatus(rawLabel);
              if (['PASS', 'FAIL', 'BLOCKED', 'SKIPPED'].includes(normSt)) {
                const actualCnt = parsedExec.tcs.filter((tc) => tc.status === normSt).length;
                if (declaredCnt !== actualCnt) {
                  referentialErrors.push({
                    file: relFile,
                    message: `Execution report summary count mismatch for "${normSt}": summary table declares ${declaredCnt} but TC result table has ${actualCnt}`,
                  });
                }
              }
            }
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
          for (const reqId of extractPrimaryIds(tcRow.reqId, REQ_ID_REGEX)) {
            if (!mod.reqs.has(reqId)) {
              referentialErrors.push({
                file: relFile,
                message: `Execution report FAIL detail for "${tcRow.id}" references unknown REQ ID "${reqId}"`,
              });
            }
          }
        }
      }
    }

    // 3d. Validate Impact Reports (docs/requirements/<module>/impact/impact_*.md), Requirement Metadata, Ambiguities, & Changelog
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

    const ambStats = {
      hasAmbTable: false,
      openTotal: 0,
      openByEmoji: { '🔴': 0, '🟡': 0, '🟢': 0 },
    };
    let declaredOpenAmbMeta = null;
    let declaredOpenAmbFile = '';
    for (const reqFile of mod.reqFiles) {
      const content = fs.readFileSync(reqFile, 'utf8');
      const relFile = path.relative(repoRoot, reqFile).replace(/\\/g, '/');
      const isIndexReqFile = path.basename(reqFile).toLowerCase().startsWith('requirements_');
      const tables = parseMarkdownTables(content, { ignoreCodeFences: true });

      for (const table of tables) {
        if (table.headers.length === 2) {
          let usedRangeVal = '';
          let nextCodeVal = '';
          for (const row of table.rows) {
            const k = formatCellPlainText(row[0] || '').trim().toLowerCase();
            const v = formatCellPlainText(row[1] || '').replace(/`/g, '').trim();
            if (k === 'tổng số req' && isIndexReqFile && mod.reqs.size > 0) {
              const totalMatch = v.match(/^(\d+)\b/);
              if (totalMatch && Number(totalMatch[1]) !== mod.reqs.size) {
                referentialErrors.push({
                  file: relFile,
                  message: `Requirements metadata "Tổng số REQ" mismatch: metadata declares ${totalMatch[1]} but ${mod.reqs.size} REQs were found`,
                });
              }
            } else if (k === 'dải mã đã dùng') {
              usedRangeVal = v;
            } else if (k === 'mã kế tiếp') {
              nextCodeVal = v;
            } else if (
              isIndexReqFile &&
              (k.includes('ambiguity còn treo') || k.includes('amb còn treo'))
            ) {
              const openMatch = v.match(/^(\d+)\b/);
              if (openMatch) {
                declaredOpenAmbMeta = Number(openMatch[1]);
                declaredOpenAmbFile = relFile;
              }
            }
          }
          if (usedRangeVal && nextCodeVal) {
            const reqMax = extractMaxUsedIdNumber(usedRangeVal, /\bREQ-[A-Z0-9_-]+-(\d+)\b/gi);
            const reqNext = nextCodeVal.match(/\bREQ-[A-Z0-9_-]+-(\d+)\b/i);
            if (reqMax !== null && reqNext && Number(reqNext[1]) !== reqMax + 1) {
              schemaViolations.push({
                file: relFile,
                message: `Requirements metadata REQ ID range discontinuity: max used is ${reqMax} but next code has ${reqNext[0]}`,
              });
            }
            const ambMax = extractMaxUsedIdNumber(usedRangeVal, /\bAMB-(\d+)\b/gi);
            const ambNext = nextCodeVal.match(/\bAMB-(\d+)\b/i);
            if (ambMax !== null && ambNext && Number(ambNext[1]) !== ambMax + 1) {
              schemaViolations.push({
                file: relFile,
                message: `Requirements metadata AMB ID range discontinuity: max used is ${ambMax} but next code has ${ambNext[0]}`,
              });
            }
            const riskMax = extractMaxUsedIdNumber(usedRangeVal, /\bRISK-(\d+)\b/gi);
            const riskNext = nextCodeVal.match(/\bRISK-(\d+)\b/i);
            if (riskMax !== null && riskNext && Number(riskNext[1]) !== riskMax + 1) {
              schemaViolations.push({
                file: relFile,
                message: `Requirements metadata RISK ID range discontinuity: max used is ${riskMax} but next code has ${riskNext[0]}`,
              });
            }
          }
        }

        const h0Lower = (table.headers[0] || '').trim().toLowerCase();
        if (
          (h0Lower === 'mã' || h0Lower === 'amb id') &&
          table.rows.some((r) => /\bAMB-\d+\b/.test(r[0] || ''))
        ) {
          ambStats.hasAmbTable = true;
          const sevIdx = colIdx(table.header, /mức độ|muc do|severity/i);
          const stIdx = colIdx(table.header, /trạng thái|trang thai|status/i);
          for (const row of table.rows) {
            if (!/\bAMB-\d+\b/.test(row[0] || '')) continue;
            const stText = formatCellPlainText(row[stIdx >= 0 ? stIdx : 5] || '').trim();
            const isClosedOrSkipped =
              stText.includes('✅') ||
              stText.includes('⏭️') ||
              /đã trả lời|đã đóng|bỏ qua|closed|resolved/i.test(stText);
            const isOpen =
              !isClosedOrSkipped &&
              (stText.includes('❓') || /chờ trả lời|cho tra loi|chưa trả lời|open|pending/i.test(stText));
            if (isOpen) {
              ambStats.openTotal += 1;
              const sevText = String(row[sevIdx >= 0 ? sevIdx : 3] || '');
              for (const emoji of ['🔴', '🟡', '🟢']) {
                if (sevText.includes(emoji)) {
                  ambStats.openByEmoji[emoji] += 1;
                }
              }
            }
          }
        }

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
    if (
      declaredOpenAmbMeta !== null &&
      ambStats.hasAmbTable &&
      declaredOpenAmbMeta !== ambStats.openTotal
    ) {
      referentialErrors.push({
        file: declaredOpenAmbFile,
        message: `Requirements metadata "Ambiguity còn treo" mismatch: metadata declares ${declaredOpenAmbMeta} open AMB(s) but Ambiguities table has ${ambStats.openTotal}`,
      });
    }
    mod.ambStats = ambStats;

    // 3e. Validate User Guides (docs/user-guides/<module>/user_guide_<module>.md) including <!-- Nguồn: REQ-... --> comments & metadata
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

      if (path.basename(ugFile).startsWith('user_guide_')) {
        const tables = parseMarkdownTables(content, { ignoreCodeFences: true });
        let version = '';
        let status = '';
        for (const table of tables) {
          if (table.headers.length === 2) {
            for (const row of table.rows) {
              const k = formatCellPlainText(row[0] || '').trim().toLowerCase();
              const v = formatCellPlainText(row[1] || '').trim();
              if (k === 'phiên bản tài liệu') version = v;
              else if (k === 'trạng thái') status = v;
            }
          }
        }
        const hasUnverifiedSection = /^\s*#{1,4}\s+.*vùng chưa xác minh/im.test(content);
        const unverifiedTable = tables.find((t) =>
          (t.heading || '').toLowerCase().includes('vùng chưa xác minh')
        );
        if (status.includes('✅') && hasUnverifiedSection) {
          referentialErrors.push({
            file: relFile,
            message: `User guide metadata status is released ("✅") but internal section "Vùng chưa xác minh" is still present`,
          });
        }
        mod.parsedUgMeta = {
          relFile,
          version,
          status,
          hasUnverifiedSection,
          hasUnverifiedTable: Boolean(unverifiedTable),
          unverifiedCount: unverifiedTable ? unverifiedTable.rows.length : 0,
        };
      }
    }
  }

  // 3f. Validate Requirements Catalog "REQ đã dùng" + "AMB treo", Requirements Section 2 status summary, Test Cases Catalog "Số TC", Test Cases Section 2 coverage table, and User Guides Catalog against parsed modules
  for (const { namespace, relFile, catalog, statusTable } of reqCatalogs) {
    if (catalog && catalog.headers.length >= 7) {
      const headersLower = catalog.headers.map((h) => h.trim().toLowerCase());
      const docIdx = headersLower.findIndex(
        (h) => h === 'tài liệu' || (h.includes('tài liệu') && !h.includes('mức phủ'))
      );
      const usedIdx = headersLower.findIndex(
        (h) => h.includes('req đã dùng') || h.includes('dải đã dùng')
      );
      const ambIdx = headersLower.findIndex((h) => h.includes('amb'));
      for (const row of catalog.rows) {
        const docCell = String(row[docIdx >= 0 ? docIdx : 4] || '').trim();
        if (!docCell || docCell === '—' || docCell === '-') continue;
        const linkedSlug = extractCatalogLinkedSlug(docCell, namespace, 'requirements');
        const matchedMod = linkedSlug
          ? modulesMap.get(linkedSlug)
          : [...modulesMap.values()].find((m) => {
              if (namespace) {
                if (!m.slug.startsWith(`${namespace}/`)) return false;
                const localSlug = m.slug.slice(namespace.length + 1);
                return (
                  docCell.includes(`(${localSlug}/`) ||
                  docCell.includes(`${localSlug}/requirements_`) ||
                  docCell.includes(`(${m.slug}/`) ||
                  docCell.includes(`${m.slug}/requirements_`)
                );
              }
              if (m.slug.startsWith('_')) return false;
              return docCell.includes(`(${m.slug}/`) || docCell.includes(`${m.slug}/requirements_`);
            });
        const usedRange = String(row[usedIdx >= 0 ? usedIdx : 5] || '').replace(/`/g, '');
        const parenMatch = usedRange.match(/\((\d+)\)/);
        const rangeMatch = usedRange.match(
          /REQ-[A-Z0-9_-]+-(\d+)\s*(?:→|->)\s*REQ-[A-Z0-9_-]+-(\d+)/
        );
        if (parenMatch || rangeMatch) {
          const declaredReqCount = parenMatch
            ? Number(parenMatch[1])
            : Number(rangeMatch[2]) - Number(rangeMatch[1]) + 1;
          if (matchedMod && matchedMod.reqs.size > 0 && matchedMod.reqs.size !== declaredReqCount) {
            referentialErrors.push({
              file: relFile,
              message: `Requirements Catalog "REQ đã dùng" count mismatch for module "${matchedMod.slug}": catalog declares ${declaredReqCount} but ${matchedMod.reqs.size} REQs were found`,
            });
          }
        }
        if (ambIdx >= 0 && matchedMod && matchedMod.ambStats?.hasAmbTable) {
          const rawAmbCell = formatCellPlainText(row[ambIdx] || '')
            .replace(/\([^)]*\)/g, '')
            .trim();
          for (const m of rawAmbCell.matchAll(/(\d+)\s*(🔴|🟡|🟢)/g)) {
            const declaredAmbCnt = Number(m[1]);
            const emoji = m[2];
            const actualAmbCnt = matchedMod.ambStats.openByEmoji[emoji] || 0;
            if (declaredAmbCnt !== actualAmbCnt) {
              referentialErrors.push({
                file: relFile,
                message: `Requirements Catalog "AMB treo" count mismatch for module "${matchedMod.slug}" (${emoji}): catalog declares ${declaredAmbCnt} open ${emoji} but Ambiguities table has ${actualAmbCnt}`,
              });
            }
          }
        }
      }
    }

    if (statusTable) {
      const stCol = colIdx(statusTable.header, /trạng thái|trang thai/i);
      const cntCol = colIdx(statusTable.header, /số lượng|so luong/i);
      const namespaceMods = [...modulesMap.values()].filter((m) =>
        namespace ? m.slug.startsWith(`${namespace}/`) : !m.slug.startsWith('_')
      );
      const namespaceReqsCount = namespaceMods.reduce((acc, m) => acc + m.reqs.size, 0);
      const actualByStatus = { ACTIVE: 0, CHANGED: 0, DEPRECATED: 0, UNIMPLEMENTED: 0 };
      for (const m of namespaceMods) {
        for (const reqDef of m.reqs.values()) {
          actualByStatus[classifyReqStatus(reqDef.status)] += 1;
        }
      }

      for (const sRow of statusTable.rows) {
        const rawLabel = formatCellPlainText(sRow[stCol] || '').trim();
        const rawCnt = formatCellPlainText(sRow[cntCol] || '').trim();
        if (/^(?:tổng|tong|total)$/i.test(rawLabel)) {
          const totalMatch = rawCnt.match(/^(\d+)(?:\s*req)?$/i);
          if (totalMatch) {
            const declaredTotal = Number(totalMatch[1]);
            if (declaredTotal !== namespaceReqsCount) {
              referentialErrors.push({
                file: relFile,
                message: `Requirements status summary total mismatch: summary table declares ${declaredTotal} total REQs but ${namespaceReqsCount} REQs were found`,
              });
            }
            const nonTotalRows = statusTable.rows.filter(
              (r) => !/^(?:tổng|tong|total)$/i.test(formatCellPlainText(r[stCol] || '').trim())
            );
            if (
              nonTotalRows.length > 0 &&
              nonTotalRows.every((r) => /^\d+$/.test(formatCellPlainText(r[cntCol] || '').trim()))
            ) {
              const sumCounts = nonTotalRows.reduce(
                (acc, r) => acc + Number(formatCellPlainText(r[cntCol] || '').trim()),
                0
              );
              if (sumCounts !== declaredTotal) {
                referentialErrors.push({
                  file: relFile,
                  message: `Requirements status summary breakdown mismatch: status rows sum to ${sumCounts} but total row declares ${declaredTotal}`,
                });
              }
            }
          }
        } else if (/^\d+$/.test(rawCnt)) {
          const declaredCnt = Number(rawCnt);
          let stKey = null;
          if (rawLabel.includes('🔴') || /deprecated/i.test(rawLabel)) {
            stKey = 'DEPRECATED';
          } else if (rawLabel.includes('⚪') || /chưa implement|chua implement|out of scope/i.test(rawLabel)) {
            stKey = 'UNIMPLEMENTED';
          } else if (rawLabel.includes('🟡') || /changed|sửa đổi/i.test(rawLabel)) {
            stKey = 'CHANGED';
          } else if (rawLabel.includes('🟢') || /active/i.test(rawLabel)) {
            stKey = 'ACTIVE';
          }
          if (stKey && declaredCnt !== actualByStatus[stKey]) {
            referentialErrors.push({
              file: relFile,
              message: `Requirements status summary count mismatch for "${rawLabel}": summary table declares ${declaredCnt} but ${actualByStatus[stKey]} REQs were found`,
            });
          }
        }
      }
    }
  }

  for (const { namespace, relFile: relTcReadme, tcCatalogTable, tcCoverageTable } of tcCatalogs) {
    if (tcCatalogTable) {
      const tcHeadersLower = tcCatalogTable.headers.map((h) => h.trim().toLowerCase());
      const soTcIdx = tcHeadersLower.findIndex((h) => h.includes('số tc'));
      if (soTcIdx !== -1) {
        for (const row of tcCatalogTable.rows) {
          const rawCountStr = formatCellPlainText(row[soTcIdx] || '').trim();
          const countMatch = rawCountStr.match(/^\d+$/);
          if (!countMatch) continue;
          const declaredCount = Number(countMatch[0]);
          const prefixCell = formatCellPlainText(row[1] || '')
            .replace(/`/g, '')
            .trim();
          const linkedSlug = extractCatalogLinkedSlug(row.join(' '), namespace, 'test_cases');
          const matchedMod = linkedSlug
            ? modulesMap.get(linkedSlug)
            : [...modulesMap.values()].find((m) => {
                if (namespace && !m.slug.startsWith(`${namespace}/`)) return false;
                if (!namespace && m.slug.startsWith('_')) return false;
                if (prefixCell && m.tcList.some((tc) => tc.id.startsWith(prefixCell))) return true;
                return false;
              });
          if (matchedMod) {
            const totalCount = matchedMod.tcList.length;
            const activeCount = matchedMod.tcList.filter(
              (tc) => !/deprecated|🗑️/i.test(`${tc.title || ''} ${(tc.tags || []).join(' ')}`)
            ).length;
            if (declaredCount !== totalCount && declaredCount !== activeCount) {
              referentialErrors.push({
                file: relTcReadme,
                message: `Test Cases Catalog "Số TC" mismatch for module "${matchedMod.slug}": catalog declares ${declaredCount} but ${totalCount} TCs (${activeCount} active) were found`,
              });
            }
          }
        }
      }
    }

    if (tcCoverageTable) {
      const modCol = colIdx(tcCoverageTable.header, /^module$/i);
      const docReqCol = colIdx(tcCoverageTable.header, /req có tài liệu/i);
      const inScopeReqCol = colIdx(tcCoverageTable.header, /req trong phạm vi/i);
      const covReqCol = colIdx(tcCoverageTable.header, /req đã có/i);
      const covPctCol = colIdx(tcCoverageTable.header, /độ phủ|do phu/i);
      for (const row of tcCoverageTable.rows) {
        const rawModCell = formatCellPlainText(row[modCol] || '')
          .replace(/`/g, '')
          .trim();
        if (!rawModCell) continue;
        const modInput = namespace && !rawModCell.startsWith('_') ? `${namespace}/${rawModCell}` : rawModCell;
        const modRes = resolveTargetModule(repoRoot, modInput, modulesMap, reqScan, tcScan);
        const matchedMod = modRes.targetSlug ? modulesMap.get(modRes.targetSlug) : null;
        if (!matchedMod || matchedMod.reqs.size === 0) continue;

        const actualOutOfScope = [...matchedMod.reqs.keys()].filter((id) =>
          matchedMod.outOfScopeReqs.has(id)
        ).length;
        const actualInScope = Math.max(0, matchedMod.reqs.size - actualOutOfScope);
        const reqToTcObjs = buildModuleReqToTcObjectsMap(matchedMod);
        let actualCovered = 0;
        for (const reqId of matchedMod.reqs.keys()) {
          if (matchedMod.outOfScopeReqs.has(reqId)) continue;
          if ((reqToTcObjs.get(reqId) || []).length > 0) actualCovered += 1;
        }

        if (docReqCol >= 0) {
          const rawDocReqs = formatCellPlainText(row[docReqCol] || '').trim();
          if (/^\d+$/.test(rawDocReqs) && Number(rawDocReqs) !== matchedMod.reqs.size) {
            referentialErrors.push({
              file: relTcReadme,
              message: `Test Cases coverage table "REQ có tài liệu" mismatch for module "${matchedMod.slug}": table declares ${rawDocReqs} but ${matchedMod.reqs.size} REQs were found`,
            });
          }
        }
        if (inScopeReqCol >= 0) {
          const rawInScope = formatCellPlainText(row[inScopeReqCol] || '').trim();
          if (/^\d+$/.test(rawInScope) && Number(rawInScope) !== actualInScope) {
            referentialErrors.push({
              file: relTcReadme,
              message: `Test Cases coverage table "REQ trong phạm vi TC" mismatch for module "${matchedMod.slug}": table declares ${rawInScope} but ${actualInScope} in-scope REQs were found`,
            });
          }
        }
        if (covReqCol >= 0) {
          const rawCov = formatCellPlainText(row[covReqCol] || '').trim();
          if (/^\d+$/.test(rawCov) && Number(rawCov) !== actualCovered) {
            referentialErrors.push({
              file: relTcReadme,
              message: `Test Cases coverage table "REQ đã có ≥1 TC" mismatch for module "${matchedMod.slug}": table declares ${rawCov} but ${actualCovered} covered REQs were found`,
            });
          }
        }
        if (covPctCol >= 0 && inScopeReqCol >= 0) {
          const rawInScope = formatCellPlainText(row[inScopeReqCol] || '').trim();
          const rawPct = formatCellPlainText(row[covPctCol] || '').trim();
          const pctMatch = rawPct.match(/^(\d+(?:\.\d+)?)\s*%$/);
          if (/^\d+$/.test(rawInScope) && pctMatch && actualInScope > 0) {
            const declaredPct = Number(pctMatch[1]);
            const actualPct = Number(((actualCovered / actualInScope) * 100).toFixed(1));
            if (Math.round(declaredPct) !== Math.round(actualPct)) {
              referentialErrors.push({
                file: relTcReadme,
                message: `Test Cases coverage table "Độ phủ" mismatch for module "${matchedMod.slug}": table declares ${rawPct} but actual coverage is ${actualPct}%`,
              });
            }
          }
        }
      }
    }
  }

  for (const { namespace, relFile: relUgReadme, catalog } of ugCatalogs) {
    const verCol = colIdx(catalog.header, /phiên bản tài liệu|phien ban tai lieu/i);
    const unverifiedCol = colIdx(catalog.header, /chưa xác minh|chua xac minh/i);
    const releaseCol = colIdx(catalog.header, /trạng thái phát hành|trang thai phat hanh/i);
    for (const row of catalog.rows) {
      const linkedSlug = extractCatalogLinkedSlug(row.join(' '), namespace, 'user_guide');
      const matchedMod = linkedSlug ? modulesMap.get(linkedSlug) : null;
      if (!matchedMod || !matchedMod.parsedUgMeta) continue;
      if (verCol >= 0 && matchedMod.parsedUgMeta.version) {
        const catVer = formatCellPlainText(row[verCol] || '').trim();
        if (catVer && catVer !== matchedMod.parsedUgMeta.version) {
          referentialErrors.push({
            file: relUgReadme,
            message: `User Guides Catalog version mismatch for module "${matchedMod.slug}": catalog declares "${catVer}" but ${matchedMod.parsedUgMeta.relFile} has "${matchedMod.parsedUgMeta.version}"`,
          });
        }
      }
      if (unverifiedCol >= 0 && matchedMod.parsedUgMeta.hasUnverifiedTable) {
        const rawUnv = formatCellPlainText(row[unverifiedCol] || '').trim();
        if (/^\d+$/.test(rawUnv) && Number(rawUnv) !== matchedMod.parsedUgMeta.unverifiedCount) {
          referentialErrors.push({
            file: relUgReadme,
            message: `User Guides Catalog "Còn ⚠️ chưa xác minh" count mismatch for module "${matchedMod.slug}": catalog declares ${rawUnv} but ${matchedMod.parsedUgMeta.relFile} has ${matchedMod.parsedUgMeta.unverifiedCount}`,
          });
        }
      }
      if (releaseCol >= 0) {
        const rawRel = formatCellPlainText(row[releaseCol] || '').trim();
        if (rawRel.includes('✅') && matchedMod.parsedUgMeta.hasUnverifiedSection) {
          referentialErrors.push({
            file: relUgReadme,
            message: `User Guides Catalog declares "${matchedMod.slug}" as released ("✅") but ${matchedMod.parsedUgMeta.relFile} still contains internal section "Vùng chưa xác minh"`,
          });
        }
      }
    }
  }

  // 4. Validate Bug Catalog schema & cross-references in docs/bugs/README.md and docs/bugs/_<system>/README.md if present
  const bugCatalogs = targetModule ? [] : bugScan.catalogs;
  const secondaryBugCatalogNamespaces = new Set(
    bugCatalogs.filter((c) => c.namespace).map((c) => c.namespace.toLowerCase())
  );
  for (const { namespace, relFile: relBugsReadme, content: bugsReadmeContent, tables } of bugCatalogs) {
    const catalogTable = tables.find((t) => {
      const h0 = (t.headers[0] || '').trim().toLowerCase();
      return h0 === 'mã bug' || h0 === 'bug id';
    });
    if (!catalogTable || catalogTable.headers.length !== 8) {
      schemaViolations.push({
        file: relBugsReadme,
        message: `Expected 8-column Bug Catalog table in ${relBugsReadme}, found ${catalogTable ? catalogTable.headers.length : 0} columns`,
      });
    } else {
      const parsedIndex = parseBugIndex(bugsReadmeContent, relBugsReadme);
      if (catalogTable.rows.length > 0 && parsedIndex.rows.length !== catalogTable.rows.length) {
        schemaViolations.push({
          file: relBugsReadme,
          message: `Bug Catalog table row count mismatch (${parsedIndex.rows.length} parsed vs ${catalogTable.rows.length} raw)`,
        });
      }
      const catalogedBugIds = new Set();
      for (const bugRow of parsedIndex.rows) {
        catalogedBugIds.add(bugRow.id);
        if (allKnownBugIds.size > 0 && !allKnownBugIds.has(bugRow.id)) {
          referentialErrors.push({
            file: relBugsReadme,
            message: `Bug Catalog references unknown BUG ID "${bugRow.id}" (no matching BUG_*.md found)`,
          });
        } else if (allKnownBugsMap.has(bugRow.id)) {
          const targetBug = allKnownBugsMap.get(bugRow.id);
          if (bugRow.severity && targetBug.severity && bugRow.severity !== targetBug.severity) {
            referentialErrors.push({
              file: relBugsReadme,
              message: `Bug Catalog severity mismatch for "${bugRow.id}": catalog says "${bugRow.severity}" but BUG file has "${targetBug.severity}"`,
            });
          }
          if (bugRow.priority && targetBug.priority && bugRow.priority !== targetBug.priority) {
            referentialErrors.push({
              file: relBugsReadme,
              message: `Bug Catalog priority mismatch for "${bugRow.id}": catalog says "${bugRow.priority}" but BUG file has "${targetBug.priority}"`,
            });
          }
          if (bugRow.status && targetBug.status) {
            const isCompatibleStatus =
              bugRow.status === targetBug.status ||
              (targetBug.status === 'OPEN' &&
                (bugRow.status === 'PENDING' || bugRow.status === 'NEEDS_REVIEW')) ||
              ((targetBug.status === 'PARTIAL' || targetBug.status === 'CANNOT_VERIFY') &&
                bugRow.status === 'NEEDS_REVIEW');
            if (!isCompatibleStatus) {
              referentialErrors.push({
                file: relBugsReadme,
                message: `Bug Catalog status mismatch for "${bugRow.id}": catalog status is "${bugRow.status}" but BUG file status is "${targetBug.status}"`,
              });
            }
          }
        }
        const tcRefs = extractPrimaryIds(bugRow.tc, TC_ID_REGEX).map((m) => normalizeTcId(m));
        for (const tcRef of tcRefs) {
          if (allKnownTcIds.size > 0 && !allKnownTcIds.has(tcRef)) {
            referentialErrors.push({
              file: relBugsReadme,
              message: `Bug Catalog row "${bugRow.id}" references unknown TC ID "${tcRef}"`,
            });
          }
        }
      }
      const nsLower = namespace ? namespace.toLowerCase() : '';
      for (const [knownBugId, bugInfo] of allKnownBugsMap.entries()) {
        const bugModSlug = String(bugInfo.moduleSlug || '').toLowerCase();
        const belongsToCatalog = nsLower
          ? bugModSlug.startsWith(`${nsLower}/`)
          : !bugModSlug.startsWith('_') || !secondaryBugCatalogNamespaces.has(bugModSlug.split('/')[0]);
        if (belongsToCatalog && !catalogedBugIds.has(knownBugId)) {
          referentialErrors.push({
            file: relBugsReadme,
            message: `Bug file "${knownBugId}" is missing from Bug Catalog in ${relBugsReadme}`,
          });
        }
      }

      const bugSummaryTable = tables.find(
        (t) =>
          colIdx(t.header, /trạng thái|trang thai/i) >= 0 &&
          colIdx(t.header, /số lượng|so luong/i) >= 0
      );
      if (bugSummaryTable) {
        const stCol = colIdx(bugSummaryTable.header, /trạng thái|trang thai/i);
        const cntCol = colIdx(bugSummaryTable.header, /số lượng|so luong/i);
        for (const sRow of bugSummaryTable.rows) {
          const rawLabel = formatCellPlainText(sRow[stCol] || '').trim();
          const rawCnt = formatCellPlainText(sRow[cntCol] || '').trim();
          if (!/^\d+$/.test(rawCnt)) continue;
          const declaredCnt = Number(rawCnt);
          let actualCnt = null;
          if (/^(?:tổng|tong|total)$/i.test(rawLabel)) {
            actualCnt = parsedIndex.rows.length;
          } else if (/đóng|closed/i.test(rawLabel)) {
            actualCnt = parsedIndex.rows.filter((r) => r.status === 'CLOSED').length;
          } else if (/một phần|mot phan|partial/i.test(rawLabel)) {
            actualCnt = parsedIndex.rows.filter((r) => r.status === 'PARTIAL').length;
          } else if (/không verify|khong verify|cannot[_ ]?verify/i.test(rawLabel)) {
            actualCnt = parsedIndex.rows.filter((r) => r.status === 'CANNOT_VERIFY').length;
          } else if (/chờ retest|đã fix|pending/i.test(rawLabel)) {
            actualCnt = parsedIndex.rows.filter((r) => r.status === 'PENDING').length;
          } else if (/rà lại|review/i.test(rawLabel)) {
            actualCnt = parsedIndex.rows.filter((r) => r.status === 'NEEDS_REVIEW').length;
          } else if (/đang mở|open/i.test(rawLabel)) {
            actualCnt = parsedIndex.rows.filter((r) => r.status === 'OPEN').length;
          }
          if (actualCnt !== null && declaredCnt !== actualCnt) {
            referentialErrors.push({
              file: relBugsReadme,
              message: `Bug Catalog status summary count mismatch for "${rawLabel}": summary table declares ${declaredCnt} but Bug Catalog has ${actualCnt}`,
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
    modules: [...modulesMap.keys()]
      .filter((k) => !targetModule || k.toLowerCase() === targetModule)
      .sort(),
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

function loadIndexedModules(repoRoot, targetSlug, modulesMap = collectModuleArtifacts(repoRoot)) {
  const selectedModules = [];
  const allModules = [];
  const allDocumentedTcIds = new Set();
  for (const [slug, mod] of modulesMap.entries()) {
    populateModuleIndex(repoRoot, mod);
    allModules.push(mod);
    for (const tcId of mod.tcs.keys()) {
      allDocumentedTcIds.add(tcId);
    }
    if (targetSlug && slug.toLowerCase() !== targetSlug) continue;
    if (mod.reqs.size > 0 || mod.tcList.length > 0 || mod.execFiles.length > 0 || targetSlug) {
      selectedModules.push(mod);
    }
  }
  return { selectedModules, allModules, allDocumentedTcIds };
}

function buildModuleOrphanMatcher(mod, reqScan, tcScan, tcToScripts) {
  const slugLower = mod.slug.toLowerCase();
  const leafSlug = slugLower.split('/').pop();
  const tcPrefixes = new Set();
  const tokens = new Set([leafSlug, leafSlug.replace(/-/g, '_')]);
  const knownScriptPaths = new Set();

  for (const tc of mod.tcList) {
    const tcLower = tc.id.toLowerCase();
    tcPrefixes.add(tcLower.replace(/\d+$/, ''));
    const mid = tcLower.match(/^[a-z0-9]+_([a-z0-9_]+)_tc_\d+/);
    if (mid) {
      tokens.add(mid[1]);
      tokens.add(mid[1].split('_').pop());
    }
    if (tcToScripts && tcToScripts.has(tc.id)) {
      for (const s of tcToScripts.get(tc.id) || []) {
        knownScriptPaths.add(s.relPath.toLowerCase());
      }
    }
  }
  for (const reqId of mod.reqs.keys()) {
    const pre = reqId.replace(/^REQ-/i, '').replace(/-\d+$/, '').toLowerCase();
    tokens.add(pre);
    tokens.add(pre.replace(/-/g, '_'));
    tokens.add(pre.split('-').pop());
  }
  for (const entry of reqScan?.catalogEntries || []) {
    if (entry.linkedSlug && entry.linkedSlug.toLowerCase() === slugLower) {
      const pLower = entry.prefix.toLowerCase();
      tokens.add(pLower);
      tokens.add(pLower.replace(/-/g, '_'));
    }
  }
  for (const tcEntry of tcScan?.catalogEntries || []) {
    if (tcEntry.linkedSlug && tcEntry.linkedSlug.toLowerCase() === slugLower && tcEntry.prefixCell) {
      const pLower = tcEntry.prefixCell.toLowerCase();
      tcPrefixes.add(pLower.endsWith('_') ? pLower : `${pLower}_`);
      tokens.add(pLower.replace(/_tc_?$/, '').replace(/^[a-z0-9]+_/, ''));
    }
  }
  return { slugLower, tcPrefixes, tokens, knownScriptPaths };
}

function tcIdMatchesModuleMatcher(matcher, tcId) {
  const tcLower = tcId.toLowerCase();
  const tcPre = tcLower.replace(/\d+$/, '');
  if (matcher.tcPrefixes.has(tcPre)) return true;
  const mid = tcLower.match(/^[a-z0-9]+_([a-z0-9_]+)_tc_\d+/);
  if (mid) {
    if (matcher.tokens.has(mid[1]) || matcher.tokens.has(mid[1].split('_').pop())) {
      return true;
    }
  }
  if (matcher.tokens.has(tcPre.replace(/_tc_?$/, ''))) return true;
  return false;
}

function scriptPathMatchesModuleMatcher(matcher, scripts) {
  for (const s of scripts) {
    const p = s.relPath.toLowerCase();
    if (matcher.knownScriptPaths && matcher.knownScriptPaths.has(p)) {
      return true;
    }
    for (const tok of matcher.tokens) {
      if (tok.length < 2) continue;
      const escapedTok = tok.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const boundaryRe = new RegExp(`(?:^|[/_.-])${escapedTok}(?:[/_.-]|test|spec|$)`, 'i');
      if (boundaryRe.test(p)) {
        return true;
      }
    }
  }
  return false;
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
  const reqScan = scanRequirementCatalogs(repoRoot);
  const tcScan = scanTestcaseCatalogs(repoRoot);
  const rawModulesMap = collectModuleArtifacts(repoRoot);
  const resolvedMod = resolveTargetModule(repoRoot, options.module, rawModulesMap, reqScan, tcScan);
  const targetSlug = resolvedMod.targetSlug;
  const rawQueryLower = options.module ? String(options.module).trim().toLowerCase() : null;
  const { tcToScripts } = scanAutomationScripts(repoRoot, options);
  const catalogUndocumented = reqScan.undocumentedModules;
  const undocumentedModules = targetSlug
    ? catalogUndocumented.filter(
        (m) =>
          (m.linkedSlug && m.linkedSlug.toLowerCase() === targetSlug) ||
          m.module.toLowerCase().includes(targetSlug) ||
          m.prefix.toLowerCase() === targetSlug ||
          (rawQueryLower && m.prefix.toLowerCase() === rawQueryLower) ||
          (m.namespace && `${m.namespace}/${m.prefix}`.toLowerCase() === targetSlug) ||
          m.namespace.toLowerCase() === targetSlug
      )
    : catalogUndocumented;

  const { selectedModules, allModules = [], allDocumentedTcIds } =
    options._preloaded || loadIndexedModules(repoRoot, targetSlug, rawModulesMap);

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

  const selectedMatchers = targetSlug
    ? selectedModules.length > 0
      ? selectedModules.map((m) => buildModuleOrphanMatcher(m, reqScan, tcScan, tcToScripts))
      : [
          {
            slugLower: targetSlug,
            tcPrefixes: new Set(),
            tokens: new Set([targetSlug.split('/').pop(), ...(rawQueryLower ? [rawQueryLower] : [])]),
            knownScriptPaths: new Set(),
          },
        ]
    : [];
  const otherMatchers = targetSlug
    ? allModules
        .filter((m) => !selectedModules.includes(m))
        .map((m) => buildModuleOrphanMatcher(m, reqScan, tcScan, tcToScripts))
    : [];

  for (const [tcId, scripts] of tcToScripts.entries()) {
    if (!allDocumentedTcIds.has(tcId)) {
      if (targetSlug) {
        const idMatchesSelected = selectedMatchers.some((mm) => tcIdMatchesModuleMatcher(mm, tcId));
        const idMatchesOther = otherMatchers.some((mm) => tcIdMatchesModuleMatcher(mm, tcId));
        if (!idMatchesSelected) {
          if (idMatchesOther) {
            continue;
          }
          const pathMatchesSelected = selectedMatchers.some((mm) =>
            scriptPathMatchesModuleMatcher(mm, scripts)
          );
          const pathMatchesOther = otherMatchers.some((mm) =>
            scriptPathMatchesModuleMatcher(mm, scripts)
          );
          if (!pathMatchesSelected && (pathMatchesOther || otherMatchers.length > 0)) {
            continue;
          }
        }
      }
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
    knownModule: resolvedMod.known,
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

function compareExecRunOrder(a, b) {
  const rawA = String(a?.parsedExec?.runId || a?.relFile || '');
  const rawB = String(b?.parsedExec?.runId || b?.relFile || '');
  return compareRunOrder(rawA, rawB);
}

/**
 * Computes a deterministic ISO/IEC/IEEE 29119-3 Test Completion Summary Report
 * and evaluates the 7 default Exit Criteria across `docs/`.
 */
export function computeTestSummaryReport(repoRoot = path.resolve(__dirname, '..'), options = {}) {
  const rawModulesMap = collectModuleArtifacts(repoRoot);
  const reqScan = scanRequirementCatalogs(repoRoot);
  const tcScan = scanTestcaseCatalogs(repoRoot);
  const resolvedMod = resolveTargetModule(repoRoot, options.module, rawModulesMap, reqScan, tcScan);
  const targetSlug = resolvedMod.targetSlug;
  const milestone = options.milestone ? String(options.milestone).trim() : 'Current Milestone';
  const preloaded = loadIndexedModules(repoRoot, targetSlug, rawModulesMap);
  const { selectedModules } = preloaded;
  const rtm = computeTraceabilityReport(repoRoot, { ...options, _preloaded: preloaded });

  let totalPass = 0;
  let totalFail = 0;
  let totalBlocked = 0;
  let totalSkipped = 0;
  let totalUnexecuted = 0;
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
      .sort(compareExecRunOrder);
    const retestExecs = mod.parsedExecFiles
      .filter((e) => e.parsedExec.kind === 'retest' || e.parsedExec.isRetest)
      .sort(compareExecRunOrder);
    executionRunsCount += nonRetestExecs.length;
    retestRunsCount += retestExecs.length;

    const orderedExecs = [...mod.parsedExecFiles].sort(
      (a, b) =>
        compareExecRunOrder(a, b) ||
        (a.parsedExec.isRetest ? 1 : 0) - (b.parsedExec.isRetest ? 1 : 0)
    );
    const latestExec = orderedExecs[orderedExecs.length - 1] || null;
    const latestNonRetest = nonRetestExecs[nonRetestExecs.length - 1] || null;

    const tcStatusById = new Map();
    for (const execEntry of orderedExecs) {
      for (const [rawTc, st] of extractDocTcStatusMap(execEntry.parsedExec).entries()) {
        const baseTcId = normalizeTcId(rawTc);
        if (baseTcId && st) tcStatusById.set(baseTcId, st);
      }
    }

    let modPass = 0;
    let modFail = 0;
    let modBlocked = 0;
    let modSkipped = 0;
    for (const st of tcStatusById.values()) {
      if (st === 'PASS') modPass += 1;
      else if (st === 'FAIL') modFail += 1;
      else if (st === 'BLOCKED') modBlocked += 1;
      else if (st === 'SKIPPED') modSkipped += 1;
    }

    const dirtyExec =
      [...orderedExecs]
        .reverse()
        .find(
          (e) =>
            (e.parsedExec.kind !== 'retest' && !e.parsedExec.isRetest) ||
            Number(e.parsedExec.dirty || 0) > 0
        ) || latestExec;
    const modDirty = Number(dirtyExec?.parsedExec?.dirty || 0);

    const modDesignedTcs = mod.tcList.length;
    let modExecutedDesignedCount = 0;
    for (const tcDef of mod.tcList) {
      const st = tcStatusById.get(tcDef.id) || '';
      if (st) modExecutedDesignedCount += 1;
      if (orderedExecs.length > 0) {
        const isHighPrio = /critical|high|p0|p1|nghiêm trọng|cao/i.test(
          String(tcDef.priority || '')
        );
        if (isHighPrio && st !== 'SKIPPED') {
          highPrioExecDenom += 1;
          if (st === 'PASS') highPrioPass += 1;
        }
      }
    }
    const modUnexecutedTcs =
      orderedExecs.length > 0
        ? Math.max(0, modDesignedTcs - modExecutedDesignedCount)
        : modDesignedTcs;

    totalPass += modPass;
    totalFail += modFail;
    totalBlocked += modBlocked;
    totalSkipped += modSkipped;
    totalDirty += modDirty;
    if (orderedExecs.length > 0) {
      totalUnexecuted += modUnexecutedTcs;
    }

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

    if (
      modExecDenom > 0 &&
      (modSkipped > 0 || modBlocked > 0 || modDirty > 0 || modUnexecutedTcs > 0)
    ) {
      untestedEntries.push({
        module: mod.slug,
        status: `⚠️ Nợ kiểm thử (${modBlocked} BLOCKED · ${modSkipped} SKIPPED · ${modUnexecutedTcs} chưa chạy · ${modDirty} data chưa dọn)`,
        reason:
          'TC chưa thực thi hết, bị chặn, tạm hoãn hoặc còn dữ liệu kiểm thử chưa dọn trong đợt chạy mới nhất',
        risk: modBlocked > 0 || modUnexecutedTcs > 0 ? '🟠 High' : '🟡 Medium',
      });
    }

    let modSource = '—';
    if (latestNonRetest && latestExec && latestExec !== latestNonRetest) {
      modSource = `${latestNonRetest.relFile} + ${latestExec.relFile}`;
    } else if (latestExec) {
      modSource = latestExec.relFile;
    }

    moduleRows.push({
      module: mod.slug,
      designed: modDesignedTcs,
      total: modTotalTcs,
      pass: modPass,
      fail: modFail,
      blocked: modBlocked,
      skipped: modSkipped,
      unexecuted: modUnexecutedTcs,
      dirty: modDirty,
      passRate: modPassRate,
      source: modSource,
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
            /critical|high|p0|p1|nghiêm trọng|cao/i.test(`${tc.priority || ''} ${tc.risk || ''}`)
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
        const primaryTcs = extractPrimaryIds(parsedBug.tc, TC_ID_REGEX);
        const primaryReqs = extractPrimaryIds(parsedBug.req, REQ_ID_REGEX);
        openBugs.push({
          module: mod.slug,
          id: parsedBug.id,
          title: parsedBug.title,
          severity: sev,
          priority: parsedBug.priority || '—',
          status: parsedBug.status,
          tc: primaryTcs.length > 0 ? primaryTcs.join(', ') : parsedBug.tc,
          req: primaryReqs.length > 0 ? primaryReqs.join(', ') : parsedBug.req,
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
    `| TC chưa chạy | ${totalUnexecuted} |`,
    '| Cấu trúc tài liệu | Biên soạn theo cấu trúc ISO/IEC/IEEE 29119-3 — Test Completion Report (ánh xạ ở mục 9) |',
    '',
    '## 1. Khuyến nghị (Test Completion Evaluation)',
    `> ## ${verdictBanner}`,
    `- **Tiến độ thực thi:** Đã thực thi ${totalExecutedWithSkipped} TC · Còn **${totalUnexecuted} TC chưa chạy**.`,
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
    knownModule: resolvedMod.known,
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
      unexecuted: totalUnexecuted,
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
    const result = validateDocsTree(rootDir, { module: moduleSlug });
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



