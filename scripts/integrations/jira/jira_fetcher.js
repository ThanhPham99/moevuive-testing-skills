#!/usr/bin/env node
/**
 * Zero-Dependency Jira Requirements Fetcher (`scripts/integrations/jira/jira_fetcher.js`)
 *
 * Fetches Jira Issues, Epic children, Project issues, or custom JQL results and
 * exports normalized Markdown or JSON requirement files for `/analyze-requirement-document`.
 *
 * Usage:
 *   node scripts/integrations/jira/jira_fetcher.js --issue PROJ-123 [--format md|json] [--output <dir>] [--out <file>]
 *   node scripts/integrations/jira/jira_fetcher.js --epic PROJ-10 [--format md]
 *   node scripts/integrations/jira/jira_fetcher.js --project PROJ [--type Story] [--max 20]
 *   node scripts/integrations/jira/jira_fetcher.js --jql "project = PROJ AND status = 'To Do'"
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  adfToMarkdown,
  buildJiraAuthHeaders,
  fetchAllJiraPages,
  jiraRequest,
  loadEnv,
  parseCliArgs,
} from './utils.js';

const __filename = fileURLToPath(import.meta.url);

/**
 * Builds a JQL query string from CLI options (`--issue`, `--epic`, `--project`/`--type`, or `--jql`).
 */
export function buildJqlFromOptions({ issue, epic, project, type, jql } = {}) {
  if (jql) return String(jql).trim();
  if (issue) {
    return `key = "${String(issue).trim()}"`;
  }
  if (epic) {
    const cleanEpic = String(epic).trim();
    return `"Epic Link" = "${cleanEpic}" OR parent = "${cleanEpic}" ORDER BY created ASC`;
  }
  if (project) {
    const clauses = [`project = "${String(project).trim()}"`];
    if (type) {
      clauses.push(`issuetype = "${String(type).trim()}"`);
    }
    return `${clauses.join(' AND ')} ORDER BY created DESC`;
  }
  throw new Error('Must specify one of: --issue <KEY>, --epic <KEY>, --project <KEY>, or --jql "<QUERY>".');
}

/**
 * Normalizes a raw Jira REST API issue payload into a structured requirement record.
 */
export function normalizeJiraIssue(rawIssue = {}) {
  const fields = rawIssue.fields || {};
  const comments = Array.isArray(fields.comment?.comments)
    ? fields.comment.comments.map((c) => ({
        author: c.author?.displayName || c.author?.name || 'Unknown',
        created: c.created || '',
        bodyMd: adfToMarkdown(c.body),
      }))
    : [];

  return {
    key: rawIssue.key || 'UNKNOWN',
    summary: fields.summary || '',
    type: fields.issuetype?.name || 'Issue',
    status: fields.status?.name || 'Unknown',
    priority: fields.priority?.name || 'Unassigned',
    assignee: fields.assignee?.displayName || fields.assignee?.name || 'Unassigned',
    labels: Array.isArray(fields.labels) ? fields.labels : [],
    parentKey: fields.parent?.key || '',
    descriptionMd: adfToMarkdown(fields.description),
    comments,
  };
}

/**
 * Formats an array of normalized Jira issues into a Markdown requirement document.
 */
export function formatJiraIssuesMarkdown(issues = [], { title = '' } = {}) {
  const lines = [];
  if (issues.length === 1) {
    const issue = issues[0];
    lines.push(`# [${issue.key}] ${issue.summary}`);
  } else {
    lines.push(`# ${title || `Jira Requirements Export (${issues.length} Issues)`}`);
  }
  lines.push('');

  for (const issue of issues) {
    if (issues.length > 1) {
      lines.push(`## [${issue.key}] ${issue.summary}`);
      lines.push('');
    }
    lines.push('| Field | Value |');
    lines.push('|---|---|');
    lines.push(`| **Issue Key** | \`${issue.key}\` |`);
    lines.push(`| **Type** | ${issue.type} |`);
    lines.push(`| **Status** | ${issue.status} |`);
    lines.push(`| **Priority** | ${issue.priority} |`);
    lines.push(`| **Assignee** | ${issue.assignee} |`);
    if (issue.parentKey) {
      lines.push(`| **Parent / Epic** | \`${issue.parentKey}\` |`);
    }
    if (issue.labels.length > 0) {
      lines.push(`| **Labels** | ${issue.labels.map((l) => `\`${l}\``).join(', ')} |`);
    }
    lines.push('');
    lines.push('### Description');
    lines.push('');
    lines.push(issue.descriptionMd || '_No description provided._');
    lines.push('');

    if (issue.comments.length > 0) {
      lines.push('### Comments');
      lines.push('');
      for (const c of issue.comments) {
        lines.push(`- **${c.author}** (${c.created}): ${c.bodyMd}`);
      }
      lines.push('');
    }
    if (issues.length > 1) {
      lines.push('---');
      lines.push('');
    }
  }

  return lines.join('\n').trim() + '\n';
}

/**
 * Fetches Jira issues by `--issue`, `--epic`, `--project`, or `--jql` and optionally writes output to disk.
 */
export async function fetchJiraIssues({
  issue,
  epic,
  project,
  type,
  jql,
  maxResults = 50,
  pageSize = 50,
  format = 'md',
  outputDir = '',
  outFile = '',
  env = loadEnv(),
  fetchImpl = globalThis.fetch,
} = {}) {
  const auth = buildJiraAuthHeaders(env);
  let rawIssues = [];

  if (issue) {
    const cleanIssue = String(issue).trim();
    const single = await jiraRequest(`/rest/api/${auth.apiVersion}/issue/${encodeURIComponent(cleanIssue)}`, {
      env,
      fetchImpl,
    });
    rawIssues = [single];
  } else {
    const resolvedJql = buildJqlFromOptions({
      epic,
      project: project || env.JIRA_PROJECT_KEY,
      type,
      jql,
    });
    rawIssues = await fetchAllJiraPages(resolvedJql, {
      env,
      fetchImpl,
      maxResults: Number(maxResults) || 50,
      pageSize: Number(pageSize) || 50,
    });
  }

  const issues = rawIssues.map(normalizeJiraIssue);
  const fmt = String(format || 'md').toLowerCase();
  const markdown = formatJiraIssuesMarkdown(issues, {
    title: epic ? `Epic ${epic} Requirements` : project ? `Project ${project} Requirements` : '',
  });
  const serialized = fmt === 'json' ? JSON.stringify(issues, null, 2) : markdown;

  let outputPath = '';
  if (outFile) {
    outputPath = path.resolve(outFile);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, serialized, 'utf8');
  } else if (outputDir) {
    const dirPath = path.resolve(outputDir);
    fs.mkdirSync(dirPath, { recursive: true });
    const slug = issue || epic || project || 'jql_query';
    const ext = fmt === 'json' ? 'json' : 'md';
    outputPath = path.join(dirPath, `jira_${String(slug).replace(/[^A-Za-z0-9_-]/g, '_')}.${ext}`);
    fs.writeFileSync(outputPath, serialized, 'utf8');
  }

  return {
    issues,
    markdown,
    outputPath,
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  const args = parseCliArgs(process.argv.slice(2));
  if (args.help || args.h) {
    console.log(
      'Usage: node scripts/integrations/jira/jira_fetcher.js (--issue <KEY> | --epic <KEY> | --project <KEY> [--type <Type>] | --jql "<JQL>") [--max <N>] [--format md|json] [--output <dir>] [--out <file>]'
    );
    process.exit(0);
  }
  fetchJiraIssues({
    issue: args.issue,
    epic: args.epic,
    project: args.project,
    type: args.type,
    jql: args.jql,
    maxResults: args.max ? Number(args.max) : 50,
    format: args.format || 'md',
    outputDir: args.output || (!args.out ? './requirements/jira' : ''),
    outFile: args.out || '',
  })
    .then((res) => {
      console.log(
        `Fetched ${res.issues.length} Jira issue(s)${res.outputPath ? ` -> ${res.outputPath}` : ''}.`
      );
    })
    .catch((err) => {
      console.error(`Jira Fetcher Error: ${err.message}`);
      process.exit(1);
    });
}
