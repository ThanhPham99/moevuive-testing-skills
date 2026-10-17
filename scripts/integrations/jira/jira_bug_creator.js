#!/usr/bin/env node
/**
 * Zero-Dependency Jira Bug Creator CLI (`scripts/integrations/jira/jira_bug_creator.js`)
 *
 * Parses a local `docs/bugs/<module>/BUG_*.md` report via `parseBugFile()` from
 * `scripts/viewer-core.mjs`, creates a Jira `Bug` issue (Cloud REST API v3 ADF or
 * Server/DC REST API v2 Markdown), optionally uploads evidence attachments, and
 * optionally writes back the created Jira Issue Key into the local bug report.
 *
 * Usage:
 *   node scripts/integrations/jira/jira_bug_creator.js --file docs/bugs/login/BUG_login_1787226514_TC016.md [--project PROJ] [--attach] [--update]
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractPrimaryIds, parseBugFile } from '../../viewer-core.mjs';
import {
  buildJiraAuthHeaders,
  jiraRequest,
  loadEnv,
  markdownToAdf,
  parseCliArgs,
} from './utils.js';

const __filename = fileURLToPath(import.meta.url);

const EVIDENCE_LINK_RE =
  /(?:!?\[[^\]]*\]\(\s*<?([^)>?\s#"']+\.(?:png|jpe?g|gif|webp|svg|webm|mp4|zip|har|log|txt|json))>?(?:\s+["'][^"']*["'])?\s*\)|<img\b[^>]*\bsrc=["']([^"']+\.(?:png|jpe?g|gif|webp|svg))["']|`([^`\s]+\.(?:png|jpe?g|gif|webp|svg|webm|mp4|zip|har|log|txt|json))`)/gi;
const REQ_ID_RE = /\bREQ-(?:[A-Z0-9]+-)+\d+\b/g;
const TC_ID_RE = /\b[A-Z0-9_]+_TC_\d+(?:-[a-z0-9]+)?\b/g;

function mapJiraPriorityName(priorityRaw, severityKey) {
  const p = String(priorityRaw || '').trim().toUpperCase();
  const s = String(severityKey || '').trim().toLowerCase();
  if (p.startsWith('P1') || s === 'critical') return 'Highest';
  if (p.startsWith('P2') || s === 'major') return 'High';
  if (p.startsWith('P3') || s === 'minor') return 'Medium';
  return 'Low';
}

/**
 * Extracts and resolves existing local evidence file paths linked inside a bug report
 * (accepts either a raw Markdown string or a parsedBug object from parseBugFile()).
 */
export function extractEvidencePaths(bugOrMarkdown, bugFilePath) {
  const baseDir = bugFilePath ? path.dirname(path.resolve(bugFilePath)) : process.cwd();
  const docsMarker = `${path.sep}docs${path.sep}`;
  const docsIdx = baseDir.lastIndexOf(docsMarker);
  const repoRootFallback = docsIdx !== -1 ? baseDir.slice(0, docsIdx) : process.cwd();
  const seen = new Set();
  const resolvedPaths = [];
  const textSource =
    bugOrMarkdown && typeof bugOrMarkdown === 'object'
      ? [
          bugOrMarkdown.evidenceRaw,
          bugOrMarkdown.evidence,
          bugOrMarkdown.steps,
          bugOrMarkdown.actual,
        ]
          .filter((v) => typeof v === 'string')
          .join('\n')
      : String(bugOrMarkdown || '');

  for (const match of textSource.matchAll(EVIDENCE_LINK_RE)) {
    const rawRel = (match[1] || match[2] || match[3] || '').trim();
    if (!rawRel || rawRel.startsWith('http://') || rawRel.startsWith('https://')) continue;
    const candidates = [
      path.resolve(baseDir, rawRel),
      path.resolve(repoRootFallback, rawRel),
    ];
    for (const absPath of candidates) {
      if (!seen.has(absPath) && fs.existsSync(absPath) && fs.statSync(absPath).isFile()) {
        seen.add(absPath);
        resolvedPaths.push(absPath);
        break;
      }
    }
  }

  return resolvedPaths;
}

const SEVERITY_VALUE_MAP = {
  CRITICAL: 'Critical',
  MAJOR: 'Major',
  MINOR: 'Minor',
  TRIVIAL: 'Trivial',
};

/**
 * Builds the Jira `POST /rest/api/{2|3}/issue` payload from a parsed `BUG_*.md` object.
 * Supports both `buildJiraBugPayload(parsedBug, { projectKey, apiVersion, issueType, severityField, rawMarkdown })`
 * and `buildJiraBugPayload(parsedBug, rawMarkdown, { projectKey, apiVersion, issueType, severityField })`.
 */
export function buildJiraBugPayload(parsedBug, arg2 = {}, arg3 = {}) {
  const isTwoArgObject = arg2 && typeof arg2 === 'object' && !Array.isArray(arg2);
  const rawMarkdown = isTwoArgObject ? String(arg2.rawMarkdown || '') : String(arg2 || '');
  const opts = isTwoArgObject ? arg2 : arg3 || {};
  const { projectKey, apiVersion = '3', issueType = 'Bug', severityField = '' } = opts;

  if (!projectKey) {
    throw new Error('Missing Jira project key (provide --project KEY or JIRA_PROJECT_KEY in .env).');
  }

  const summaryPrefix = parsedBug.id ? `[${parsedBug.id}] ` : '[BUG] ';
  const cleanTitle = String(parsedBug.title || 'Untitled Bug').replace(/^\[BUG\]\s*/i, '').trim();
  const summary = `${summaryPrefix}${cleanTitle}`.slice(0, 250);

  const tcLabels = extractPrimaryIds(parsedBug.tc, TC_ID_RE);
  const reqLabels = extractPrimaryIds(parsedBug.req, REQ_ID_RE);
  const labels = [
    ...new Set([
      ...(parsedBug.id ? [parsedBug.id] : []),
      ...tcLabels,
      ...reqLabels,
      ...(parsedBug.severity ? [`severity-${parsedBug.severity}`] : []),
    ]),
  ];

  const descSections = [
    '## Thông tin chung',
    `- **Bug ID:** ${parsedBug.id || 'N/A'}`,
    `- **Severity:** ${parsedBug.severityRaw || parsedBug.severity || 'N/A'}`,
    `- **Priority:** ${parsedBug.priority || 'N/A'}`,
    `- **Môi trường:** ${parsedBug.env || 'N/A'}`,
    `- **Build / Version:** ${parsedBug.build || 'N/A'}`,
    `- **Test case liên quan:** ${parsedBug.tc || 'N/A'}`,
    `- **REQ ID liên quan:** ${parsedBug.req || 'N/A'}`,
    '',
    '## Steps to Reproduce',
    parsedBug.steps || rawMarkdown || 'N/A',
    '',
    '## Expected Result',
    parsedBug.expected || 'N/A',
    '',
    '## Actual Result',
    parsedBug.actual || 'N/A',
  ];

  const evText =
    typeof parsedBug.evidenceRaw === 'string' && parsedBug.evidenceRaw
      ? parsedBug.evidenceRaw
      : typeof parsedBug.evidence === 'string'
        ? parsedBug.evidence
        : '';
  if (evText) {
    descSections.push('', '## Evidence', evText);
  }
  if (parsedBug.rootCause) {
    descSections.push('', '## Root Cause / Ghi chú kỹ thuật', parsedBug.rootCause);
  }

  const descriptionMarkdown = descSections.join('\n');
  const description =
    String(apiVersion) === '3' ? markdownToAdf(descriptionMarkdown) : descriptionMarkdown;

  const fields = {
    project: { key: projectKey },
    summary,
    issuetype: { name: issueType },
    priority: { name: mapJiraPriorityName(parsedBug.priority, parsedBug.severity) },
    labels,
    description,
  };

  const sevKey = String(parsedBug.severity || '').toUpperCase();
  if (severityField && SEVERITY_VALUE_MAP[sevKey]) {
    fields[severityField] = { value: SEVERITY_VALUE_MAP[sevKey] };
  }

  return { fields };
}

/**
 * Uploads a single attachment file to an existing Jira issue.
 */
export async function uploadJiraAttachment(
  issueKey,
  attachmentPath,
  { env = loadEnv(), fetchImpl = globalThis.fetch } = {}
) {
  const auth = buildJiraAuthHeaders(env);
  const url = `${auth.baseUrl}/rest/api/${auth.apiVersion}/issue/${encodeURIComponent(issueKey)}/attachments`;
  const fileBuffer = fs.readFileSync(attachmentPath);
  const fileName = path.basename(attachmentPath);

  const form = new FormData();
  form.append('file', new Blob([fileBuffer]), fileName);

  const headers = {
    Authorization: auth.headers.Authorization,
    Accept: 'application/json',
    'X-Atlassian-Token': 'no-check',
  };

  const res = await fetchImpl(url, {
    method: 'POST',
    headers,
    body: form,
  });

  if (!res.ok) {
    let errText = '';
    try {
      errText = typeof res.text === 'function' ? await res.text() : '';
    } catch {
      errText = '';
    }
    throw new Error(
      `Jira Attachment Upload Error HTTP ${res.status} on ${issueKey} (${fileName})${errText ? `: ${errText}` : ''}`
    );
  }

  return res.json();
}

/**
 * Parses a local `BUG_*.md` report string into a structured bug object
 * with primary `TC ID` and `REQ ID` references stripped of parenthetical historical notes.
 */
export function parseBugMarkdown(rawMarkdown, fileName = 'BUG_unknown_0.md') {
  const parsed = parseBugFile(rawMarkdown, fileName);
  const primaryTcs = extractPrimaryIds(parsed.tc, TC_ID_RE);
  const primaryReqs = extractPrimaryIds(parsed.req, REQ_ID_RE);
  return {
    ...parsed,
    tcRaw: parsed.tc,
    reqRaw: parsed.req,
    tc: primaryTcs.length > 0 ? primaryTcs.join(', ') : parsed.tc,
    req: primaryReqs.length > 0 ? primaryReqs.join(', ') : parsed.req,
  };
}

function escapeRegExp(str) {
  return String(str || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Inserts or updates `- **Jira Issue:** <KEY>` inside a local `BUG_*.md` file.
 */
export function updateBugMarkdownWithJiraKey(filePath, issueKey) {
  if (!filePath || !issueKey || !fs.existsSync(filePath)) return false;
  const raw = fs.readFileSync(filePath, 'utf8');
  const issueKeyRe = new RegExp(`\\b${escapeRegExp(issueKey)}\\b`);

  const lines = raw.split(/\r?\n/);
  const jiraLineIdx = lines.findIndex((l) =>
    /^\s*[-*+]\s*\*\*Jira\s*(?:Issue|Key)(?::\*\*|\*\*\s*:)/i.test(l)
  );
  if (jiraLineIdx !== -1) {
    if (issueKeyRe.test(lines[jiraLineIdx])) return false;
    lines[jiraLineIdx] = `- **Jira Issue:** ${issueKey}`;
    fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
    return true;
  }

  const idIdx = lines.findIndex((l) =>
    /^\s*[-*+]\s*\*\*(?:ID|Mã\s*bug|Bug\s*ID)(?::\*\*|\*\*\s*:)/i.test(l)
  );
  if (idIdx !== -1) {
    lines.splice(idIdx + 1, 0, `- **Jira Issue:** ${issueKey}`);
    fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
    return true;
  }

  const headingIdx = lines.findIndex((l) => /^##\s+Thông tin chung/i.test(l));
  if (headingIdx !== -1) {
    lines.splice(headingIdx + 1, 0, `- **Jira Issue:** ${issueKey}`);
    fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
    return true;
  }
  return false;
}

/**
 * Appends `(<KEY>)` inside the `Trạng thái` cell of `docs/bugs/README.md` while preserving its 8-column table schema.
 */
export function updateBugsCatalogWithJiraKey(bugsReadmePath, bugId, issueKey) {
  if (!bugId || !issueKey || !bugsReadmePath || !fs.existsSync(bugsReadmePath)) return false;
  const readmeRaw = fs.readFileSync(bugsReadmePath, 'utf8');
  const bugIdRe = new RegExp(`\\b${escapeRegExp(bugId)}\\b`);
  const issueKeyRe = new RegExp(`\\b${escapeRegExp(issueKey)}\\b`);
  if (!bugIdRe.test(readmeRaw)) return false;

  let changed = false;
  const updatedReadme = readmeRaw
    .split(/\r?\n/)
    .map((line) => {
      if (!bugIdRe.test(line)) return line;
      const trimmed = line.trim();
      if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
        const innerCells = trimmed
          .slice(1, -1)
          .split(/(?<!\\)\|/)
          .map((c) => c.trim());
        if (!bugIdRe.test(innerCells[0] || '')) return line;
        const stIdx = innerCells.length >= 6 ? 5 : innerCells.length - 1;
        if (issueKeyRe.test(innerCells[stIdx] || '')) return line;
        const baseSt = innerCells[stIdx].replace(/\s*\([A-Z][A-Z0-9_]+-\d+\)\s*$/, '').trim();
        innerCells[stIdx] = `${baseSt} (${issueKey})`;
        changed = true;
        return `| ${innerCells.join(' | ')} |`;
      }
      if (/^[-*+]\s+/.test(trimmed)) {
        if (issueKeyRe.test(line)) return line;
        changed = true;
        return `${line} (${issueKey})`;
      }
      return line;
    })
    .join('\n');
  if (!changed) return false;
  fs.writeFileSync(bugsReadmePath, updatedReadme, 'utf8');
  return true;
}

export function writeJiraKeyBackToBugFile(filePath, issueKey, bugId) {
  const resolvedBugId =
    bugId ||
    (filePath && fs.existsSync(filePath)
      ? parseBugMarkdown(fs.readFileSync(filePath, 'utf8'), path.basename(filePath)).id
      : path.basename(String(filePath || ''), '.md'));
  updateBugMarkdownWithJiraKey(filePath, issueKey);
  const bugsReadmePath = path.resolve(path.dirname(filePath), '..', 'README.md');
  if (!updateBugsCatalogWithJiraKey(bugsReadmePath, resolvedBugId, issueKey)) {
    const parentReadmePath = path.resolve(path.dirname(filePath), '..', '..', 'README.md');
    updateBugsCatalogWithJiraKey(parentReadmePath, resolvedBugId, issueKey);
  }
}

/**
 * Parses a local `BUG_*.md` file, creates the issue on Jira, optionally uploads
 * evidence attachments, and optionally writes back the Jira Issue Key.
 * Supports both `pushBugToJira({ filePath, projectKey, ... })` and
 * `pushBugToJira(filePath, projectKey, updateMd, options)`.
 */
export async function pushBugToJira(arg1 = {}, arg2, arg3, arg4 = {}) {
  const isPositional = typeof arg1 === 'string';
  const cfg = isPositional
    ? {
        ...arg4,
        filePath: arg1,
        projectKey: arg2 || arg4.projectKey,
        update: arg3 !== undefined ? Boolean(arg3) : arg4.update,
      }
    : arg1 || {};

  const {
    filePath,
    projectKey,
    issueType = 'Bug',
    attach,
    attachEvidence = true,
    update,
    updateLocal = false,
    env = loadEnv(),
    fetchImpl = globalThis.fetch,
  } = cfg;

  const shouldAttach = attach !== undefined ? attach : attachEvidence;
  const shouldUpdate = update !== undefined ? update : updateLocal;
  const resolvedFile = path.resolve(filePath || '');
  if (!filePath || !fs.existsSync(resolvedFile)) {
    throw new Error(`Bug report file not found: ${filePath}`);
  }

  const rawMarkdown = fs.readFileSync(resolvedFile, 'utf8');
  const parsedBug = parseBugMarkdown(rawMarkdown, path.basename(resolvedFile));
  const auth = buildJiraAuthHeaders(env);
  const resolvedProject = projectKey || env.JIRA_PROJECT_KEY;

  const payload = buildJiraBugPayload(parsedBug, {
    projectKey: resolvedProject,
    apiVersion: auth.apiVersion,
    issueType,
    severityField: env.JIRA_SEVERITY_FIELD || '',
    rawMarkdown,
  });

  const created = await jiraRequest(`/rest/api/${auth.apiVersion}/issue`, {
    method: 'POST',
    body: payload,
    env,
    fetchImpl,
  });

  const issueKey = created.key;
  const uploadedAttachments = [];

  if (shouldAttach && issueKey) {
    const evidenceFiles = extractEvidencePaths(parsedBug, resolvedFile);
    for (const evFile of evidenceFiles) {
      await uploadJiraAttachment(issueKey, evFile, { env, fetchImpl });
      uploadedAttachments.push(evFile);
    }
  }

  if (shouldUpdate && issueKey) {
    writeJiraKeyBackToBugFile(resolvedFile, issueKey, parsedBug.id);
  }

  return {
    issueKey,
    key: issueKey,
    issueId: created.id,
    bugId: parsedBug.id,
    summary: payload.fields.summary,
    uploadedAttachments,
    attachments: uploadedAttachments,
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  const args = parseCliArgs(process.argv.slice(2));
  if (args.help || args.h) {
    console.log(
      'Usage: node scripts/integrations/jira/jira_bug_creator.js --file <path_to_BUG.md> [--project <KEY>] [--type Bug] [--attach|--attach=false] [--update] [--json]'
    );
    process.exit(0);
  }
  const env = loadEnv();
  const attachFlag = args.attach !== undefined ? args.attach : args['attach-evidence'];
  const updateFlag = args.update !== undefined ? args.update : args['update-local'];
  pushBugToJira({
    filePath: args.file,
    projectKey: args.project || env.JIRA_PROJECT_KEY,
    issueType: args.type || 'Bug',
    attach: attachFlag !== 'false' && attachFlag !== false,
    update: Boolean(updateFlag),
    env,
  })
    .then((res) => {
      if (args.json) {
        console.log(JSON.stringify(res, null, 2));
      } else {
        console.log(
          `Created Jira Bug ${res.issueKey} for ${res.bugId} (${res.uploadedAttachments.length} attachment(s) uploaded).`
        );
      }
    })
    .catch((err) => {
      console.error(`Jira Bug Creator Error: ${err.message}`);
      process.exit(1);
    });
}
