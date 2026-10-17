#!/usr/bin/env node
/**
 * Zero-Dependency Jira & Xray Shared Utilities (`scripts/integrations/jira/utils.js`)
 *
 * Provides:
 *   - `.env` parsing & loading without external `dotenv` (`parseEnvContent`, `loadEnv`)
 *   - CLI flag parsing (`parseCliArgs`)
 *   - Jira Cloud (Basic Auth) & Jira Server/DC (Bearer PAT) headers (`buildJiraAuthHeaders`)
 *   - Recursive Atlassian Document Format (ADF) -> Markdown converter (`adfToMarkdown`)
 *   - Built-in `fetch` wrapper & JQL pagination (`jiraRequest`, `fetchAllJiraPages`)
 */

import fs from 'node:fs';
import path from 'node:path';

/**
 * Parses `.env` file content into a plain key-value object.
 */
export function parseEnvContent(content) {
  const result = {};
  for (const rawLine of String(content || '').split(/\r?\n/)) {
    const trimmed = rawLine.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const withoutExport = trimmed.startsWith('export ') ? trimmed.slice(7).trim() : trimmed;
    const eqIdx = withoutExport.indexOf('=');
    if (eqIdx <= 0) continue;
    const key = withoutExport.slice(0, eqIdx).trim();
    let val = withoutExport.slice(eqIdx + 1).trim();
    if (val.startsWith('"') && val.endsWith('"')) {
      val = val
        .slice(1, -1)
        .replace(/\\n/g, '\n')
        .replace(/\\r/g, '\r')
        .replace(/\\t/g, '\t')
        .replace(/\\"/g, '"')
        .replace(/\\\\/g, '\\');
    } else if (val.startsWith("'") && val.endsWith("'")) {
      val = val.slice(1, -1).replace(/\\'/g, "'").replace(/\\\\/g, '\\');
    } else {
      const commentIdx = val.indexOf(' #');
      if (commentIdx !== -1) {
        val = val.slice(0, commentIdx).trim();
      }
    }
    result[key] = val;
  }
  return result;
}

/**
 * Loads `.env` from disk and merges into a shallow copy of `baseEnv`
 * without overwriting already-populated environment variables.
 */
export function loadEnv(envPath = path.resolve(process.cwd(), '.env'), baseEnv = process.env) {
  const merged = { ...baseEnv };
  if (envPath && fs.existsSync(envPath)) {
    const fileVars = parseEnvContent(fs.readFileSync(envPath, 'utf8'));
    for (const [k, v] of Object.entries(fileVars)) {
      if (merged[k] === undefined || merged[k] === '') {
        merged[k] = v;
      }
    }
  }
  return merged;
}

/**
 * Parses CLI arguments (`--key value`, `--key=value`, `--boolean-flag`).
 */
export function parseCliArgs(argv = []) {
  const opts = {};
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token === '-h') {
      opts.h = true;
      opts.help = true;
      continue;
    }
    if (!token.startsWith('--')) continue;
    const eqIdx = token.indexOf('=');
    if (eqIdx !== -1) {
      const key = token.slice(2, eqIdx).trim();
      opts[key] = token.slice(eqIdx + 1).trim();
    } else {
      const key = token.slice(2).trim();
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith('-')) {
        opts[key] = next;
        i += 1;
      } else {
        opts[key] = true;
      }
    }
  }
  return opts;
}

/**
 * Builds Jira REST API base URL, API version, and authentication headers
 * for either Jira Cloud (`JIRA_EMAIL` + `JIRA_API_TOKEN`) or Jira Server/DC (`JIRA_PAT`).
 */
export function buildJiraAuthHeaders(env = {}) {
  const rawBaseUrl = String(env.JIRA_BASE_URL || '').trim().replace(/\/+$/, '');
  if (!rawBaseUrl) {
    throw new Error('Missing JIRA_BASE_URL in environment (.env).');
  }

  const pat = String(env.JIRA_PAT || '').trim();
  const email = String(env.JIRA_EMAIL || '').trim();
  const apiToken = String(env.JIRA_API_TOKEN || '').trim();

  if (pat) {
    return {
      baseUrl: rawBaseUrl,
      apiVersion: env.JIRA_API_VERSION || '2',
      authMode: 'pat',
      headers: {
        Authorization: `Bearer ${pat}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
    };
  }

  if (email && apiToken) {
    const encoded = Buffer.from(`${email}:${apiToken}`, 'utf8').toString('base64');
    return {
      baseUrl: rawBaseUrl,
      apiVersion: env.JIRA_API_VERSION || '3',
      authMode: 'basic',
      headers: {
        Authorization: `Basic ${encoded}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
    };
  }

  throw new Error(
    'Missing Jira credentials in .env: provide JIRA_EMAIL + JIRA_API_TOKEN (Jira Cloud) or JIRA_PAT (Jira Server/DC).'
  );
}

/**
 * Recursively converts Atlassian Document Format (ADF) JSON nodes or plain strings
 * into clean GitHub-Flavored Markdown.
 */
export function adfToMarkdown(node) {
  if (!node) return '';
  if (typeof node === 'string') return node.trim();
  if (typeof node !== 'object') return String(node);

  const MARK_PRIORITY = { code: 0, strike: 1, em: 2, strong: 3 };

  function formatNonLinkText(rawText, marks = []) {
    const raw = String(rawText || '');
    const nonLinkMarks = (marks || [])
      .filter((m) => m.type !== 'link')
      .slice()
      .sort((a, b) => (MARK_PRIORITY[a.type] ?? 9) - (MARK_PRIORITY[b.type] ?? 9));
    if (nonLinkMarks.length === 0 || !raw.trim()) return raw;
    const lead = (raw.match(/^\s+/) || [''])[0];
    const trail = (raw.match(/\s+$/) || [''])[0];
    let txt = raw.trim();
    for (const mark of nonLinkMarks) {
      if (mark.type === 'code') txt = `\`${txt}\``;
      else if (mark.type === 'strong') txt = `**${txt}**`;
      else if (mark.type === 'em') txt = `*${txt}*`;
      else if (mark.type === 'strike') txt = `~~${txt}~~`;
    }
    return `${lead}${txt}${trail}`;
  }

  function getLinkHref(n) {
    if (!n || n.type !== 'text' || !Array.isArray(n.marks)) return '';
    const linkMark = n.marks.find((m) => m.type === 'link' && m.attrs?.href);
    return linkMark ? String(linkMark.attrs.href) : '';
  }

  function renderInline(n) {
    if (!n) return '';
    if (typeof n === 'string') return n;
    switch (n.type) {
      case 'text': {
        const formatted = formatNonLinkText(n.text, n.marks);
        const href = getLinkHref(n);
        if (!href || !formatted.trim()) return formatted;
        const lead = (formatted.match(/^\s+/) || [''])[0];
        const trail = (formatted.match(/\s+$/) || [''])[0];
        return `${lead}[${formatted.trim()}](${href})${trail}`;
      }
      case 'hardBreak':
        return '\n';
      case 'inlineCard':
        return n.attrs?.url ? `<${n.attrs.url}>` : '';
      case 'mention':
        return `@${n.attrs?.text || n.attrs?.id || 'user'}`;
      case 'emoji':
        return n.attrs?.text || n.attrs?.shortName || '';
      case 'status':
        return n.attrs?.text ? `[${n.attrs.text}]` : '';
      case 'date': {
        const ts = n.attrs?.timestamp;
        if (ts !== undefined && ts !== null && /^\d+$/.test(String(ts))) {
          const ms = String(ts).length <= 10 ? Number(ts) * 1000 : Number(ts);
          const d = new Date(ms);
          if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
        }
        return String(ts || '');
      }
      case 'media': {
        const alt = n.attrs?.alt || n.attrs?.fileName || n.attrs?.id || 'attachment';
        const url = n.attrs?.url || `attachment:${n.attrs?.id || alt}`;
        return `![${alt}](${url})`;
      }
      default:
        return renderInlineList(n.content || []);
    }
  }

  function renderInlineList(nodes) {
    if (!Array.isArray(nodes) || nodes.length === 0) return '';
    const out = [];
    let i = 0;
    while (i < nodes.length) {
      const href = getLinkHref(nodes[i]);
      if (href) {
        const groupParts = [];
        while (i < nodes.length && getLinkHref(nodes[i]) === href) {
          groupParts.push(formatNonLinkText(nodes[i].text, nodes[i].marks));
          i += 1;
        }
        const combined = groupParts.join('');
        if (!combined.trim()) {
          out.push(combined);
        } else {
          const lead = (combined.match(/^\s+/) || [''])[0];
          const trail = (combined.match(/\s+$/) || [''])[0];
          out.push(`${lead}[${combined.trim()}](${href})${trail}`);
        }
      } else {
        out.push(renderInline(nodes[i]));
        i += 1;
      }
    }
    return out.join('');
  }

  function renderBlock(n, listDepth = 0) {
    if (!n) return '';
    switch (n.type) {
      case 'doc':
        return (n.content || []).map((child) => renderBlock(child, listDepth)).filter(Boolean).join('\n\n');
      case 'heading': {
        const level = Math.min(6, Math.max(1, Number(n.attrs?.level || 2)));
        return `${'#'.repeat(level)} ${renderInlineList(n.content || [])}`;
      }
      case 'paragraph':
        return renderInlineList(n.content || []);
      case 'bulletList':
        return (n.content || [])
          .map((item) => renderListItem(item, '- ', listDepth))
          .join('\n');
      case 'orderedList':
        return (n.content || [])
          .map((item, idx) => renderListItem(item, `${idx + 1}. `, listDepth))
          .join('\n');
      case 'codeBlock': {
        const lang = n.attrs?.language || '';
        const code = (n.content || []).map((c) => c.text || '').join('');
        return `\`\`\`${lang}\n${code}\n\`\`\``;
      }
      case 'blockquote':
      case 'panel': {
        const inner = (n.content || []).map((c) => renderBlock(c, listDepth)).join('\n');
        return inner
          .split('\n')
          .map((line) => `> ${line}`)
          .join('\n');
      }
      case 'expand':
      case 'nestedExpand': {
        const title = n.attrs?.title ? `**${n.attrs.title}**\n` : '';
        const inner = (n.content || [])
          .map((c) => renderBlock(c, listDepth))
          .filter(Boolean)
          .join('\n');
        return `${title}${inner}`.trim();
      }
      case 'mediaSingle':
      case 'mediaGroup':
        return (n.content || [])
          .map((c) => renderInline(c))
          .filter(Boolean)
          .join('\n');
      case 'rule':
        return '---';
      case 'table':
        return renderTable(n);
      default:
        if (Array.isArray(n.content)) {
          return n.content.map((c) => renderBlock(c, listDepth)).filter(Boolean).join('\n');
        }
        return renderInline(n);
    }
  }

  function renderListItem(itemNode, prefix, depth) {
    const indent = '  '.repeat(depth);
    const parts = [];
    for (const child of itemNode.content || []) {
      if (child.type === 'bulletList' || child.type === 'orderedList') {
        parts.push(renderBlock(child, depth + 1));
      } else {
        parts.push(renderBlock(child, depth));
      }
    }
    const [first, ...rest] = parts;
    return [
      `${indent}${prefix}${first || ''}`,
      ...rest.map((r) => (r.startsWith('  ') ? r : `${indent}  ${r}`)),
    ].join('\n');
  }

  function renderTable(tableNode) {
    const rows = (tableNode.content || []).filter((r) => r.type === 'tableRow');
    if (rows.length === 0) return '';
    const matrix = rows.map((r) =>
      (r.content || []).map((cell) =>
        (cell.content || [])
          .map((c) => renderBlock(c))
          .join(' ')
          .replace(/\|/g, '\\|')
          .replace(/\r?\n/g, '<br>')
          .trim()
      )
    );
    const colCount = Math.max(...matrix.map((r) => r.length), 1);
    const normRows = matrix.map((r) => {
      const padded = [...r];
      while (padded.length < colCount) padded.push('');
      return `| ${padded.join(' | ')} |`;
    });
    const sep = `| ${Array(colCount).fill('---').join(' | ')} |`;
    return [normRows[0], sep, ...normRows.slice(1)].join('\n');
  }

  return renderBlock(node).trim();
}

/**
 * Converts GitHub-Flavored Markdown into Atlassian Document Format (ADF) v1 JSON
 * for Jira Cloud REST API v3 issue descriptions and comments.
 */
export function markdownToAdf(markdown) {
  const lines = String(markdown || '').split(/\r?\n/);
  const content = [];

  function appendMarks(baseMarks, extraMarks) {
    const out = [...baseMarks];
    for (const m of extraMarks) {
      if (
        !out.some(
          (x) =>
            x.type === m.type &&
            JSON.stringify(x.attrs || {}) === JSON.stringify(m.attrs || {})
        )
      ) {
        out.push(m);
      }
    }
    return out;
  }

  function makeTextNode(text, marks = []) {
    return marks.length > 0 ? { type: 'text', text, marks } : { type: 'text', text };
  }

  function parseInline(text, inheritedMarks = []) {
    const raw = String(text || '');
    if (!raw) return [makeTextNode(' ', inheritedMarks)];
    const nodes = [];
    const tokenRe =
      /(<br\s*\/?>|\n|\[((?:[^\[\]]|\[[^\]]*\])+)\]\(([^)\s]+)(?:\s+["'][^"']*["'])?\)|`([^`]+)`|\*\*\*([\s\S]+?)\*\*\*|\*\*((?:(?!\*\*)[\s\S])+)\*\*|~~((?:(?!~~)[\s\S])+)~~|\*([^*\n]+)\*)/gi;
    let lastIdx = 0;
    let match;
    while ((match = tokenRe.exec(raw)) !== null) {
      if (match.index > lastIdx) {
        nodes.push(makeTextNode(raw.slice(lastIdx, match.index), inheritedMarks));
      }
      if (/^(?:<br\s*\/?>|\n)$/i.test(match[1])) {
        nodes.push({ type: 'hardBreak' });
      } else if (match[2] !== undefined && match[3] !== undefined) {
        const href = match[3].replace(/^<|>$/g, '');
        const linkMark = { type: 'link', attrs: { href } };
        const childNodes = parseInline(match[2], []);
        for (const cn of childNodes) {
          if (cn.type === 'text') {
            const combined = appendMarks(cn.marks || [], [...inheritedMarks, linkMark]);
            nodes.push(makeTextNode(cn.text, combined));
          } else {
            nodes.push(cn);
          }
        }
      } else if (match[4] !== undefined) {
        nodes.push(makeTextNode(match[4], appendMarks([{ type: 'code' }], inheritedMarks)));
      } else if (match[5] !== undefined) {
        nodes.push(
          ...parseInline(
            match[5],
            appendMarks([{ type: 'strong' }, { type: 'em' }], inheritedMarks)
          )
        );
      } else if (match[6] !== undefined) {
        nodes.push(...parseInline(match[6], appendMarks([{ type: 'strong' }], inheritedMarks)));
      } else if (match[7] !== undefined) {
        nodes.push(...parseInline(match[7], appendMarks([{ type: 'strike' }], inheritedMarks)));
      } else if (match[8] !== undefined) {
        nodes.push(...parseInline(match[8], appendMarks([{ type: 'em' }], inheritedMarks)));
      }
      lastIdx = tokenRe.lastIndex;
    }
    if (lastIdx < raw.length) {
      nodes.push(makeTextNode(raw.slice(lastIdx), inheritedMarks));
    }
    return nodes.length > 0 ? nodes : [makeTextNode(raw, inheritedMarks)];
  }

  function getListLineInfo(rawLine) {
    const str = String(rawLine || '');
    const mBullet = str.match(/^([ \t]*)([-*+])\s+(.*)$/);
    if (mBullet) {
      const indent = mBullet[1].replace(/\t/g, '  ').length;
      return { type: 'bulletList', indent, text: mBullet[3].trim() };
    }
    const mOrd = str.match(/^([ \t]*)\d+\.\s+(.*)$/);
    if (mOrd) {
      const indent = mOrd[1].replace(/\t/g, '  ').length;
      return { type: 'orderedList', indent, text: mOrd[2].trim() };
    }
    return null;
  }

  let i = 0;

  function parseListBlock(baseIndent, listType) {
    const items = [];
    while (i < lines.length) {
      const info = getListLineInfo(lines[i]);
      if (!info) break;
      if (info.indent < baseIndent) break;
      if (info.indent === baseIndent && info.type !== listType) break;
      if (info.indent > baseIndent && items.length > 0) {
        const subList = parseListBlock(info.indent, info.type);
        items[items.length - 1].content.push(subList);
        continue;
      }
      const itemNode = {
        type: 'listItem',
        content: [{ type: 'paragraph', content: parseInline(info.text) }],
      };
      items.push(itemNode);
      i += 1;
      while (i < lines.length) {
        const nextInfo = getListLineInfo(lines[i]);
        if (!nextInfo || nextInfo.indent <= info.indent) break;
        const subList = parseListBlock(nextInfo.indent, nextInfo.type);
        itemNode.content.push(subList);
      }
    }
    return { type: listType, content: items };
  }

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      i += 1;
      continue;
    }

    if (/^---+$/.test(trimmed)) {
      content.push({ type: 'rule' });
      i += 1;
      continue;
    }

    const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)/);
    if (headingMatch) {
      content.push({
        type: 'heading',
        attrs: { level: headingMatch[1].length },
        content: parseInline(headingMatch[2].trim()),
      });
      i += 1;
      continue;
    }

    const fenceMatch =
      trimmed.match(/^(`{3,})([^`]*)$/) || trimmed.match(/^(~{3,})(.*)$/);
    if (fenceMatch) {
      const fenceChar = fenceMatch[1][0];
      const fenceLen = fenceMatch[1].length;
      const lang = fenceMatch[2].trim().split(/\s+/)[0] || '';
      const codeLines = [];
      i += 1;
      while (i < lines.length) {
        const closeMatch = lines[i].trim().match(/^(`{3,}|~{3,})\s*$/);
        if (closeMatch && closeMatch[1][0] === fenceChar && closeMatch[1].length >= fenceLen) {
          break;
        }
        codeLines.push(lines[i]);
        i += 1;
      }
      if (i < lines.length) i += 1;
      content.push({
        type: 'codeBlock',
        attrs: lang ? { language: lang } : {},
        content: [{ type: 'text', text: codeLines.join('\n') }],
      });
      continue;
    }

    if (/^>\s?/.test(trimmed)) {
      const quoteLines = [];
      while (i < lines.length && /^>\s?/.test(lines[i].trim())) {
        quoteLines.push(lines[i].trim().replace(/^>\s?/, ''));
        i += 1;
      }
      content.push({
        type: 'blockquote',
        content: [
          {
            type: 'paragraph',
            content: parseInline(quoteLines.join('\n').trim()),
          },
        ],
      });
      continue;
    }

    const listInfo = getListLineInfo(line);
    if (listInfo) {
      content.push(parseListBlock(listInfo.indent, listInfo.type));
      continue;
    }

    if (
      trimmed.startsWith('|') &&
      i + 1 < lines.length &&
      /^\s*\|[\s:-]+\|/.test(lines[i + 1])
    ) {
      const parseRowCells = (rowStr) =>
        rowStr
          .trim()
          .replace(/^\|/, '')
          .replace(/(?<!\\)\|$/, '')
          .split(/(?<!\\)\|/)
          .map((c) => c.replace(/\\\|/g, '|').trim());

      const headers = parseRowCells(trimmed);
      i += 2;
      const tableRows = [
        {
          type: 'tableRow',
          content: headers.map((h) => ({
            type: 'tableHeader',
            content: [{ type: 'paragraph', content: parseInline(h || ' ') }],
          })),
        },
      ];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        const cells = parseRowCells(lines[i]);
        tableRows.push({
          type: 'tableRow',
          content: headers.map((_, idx) => ({
            type: 'tableCell',
            content: [{ type: 'paragraph', content: parseInline(cells[idx] || ' ') }],
          })),
        });
        i += 1;
      }
      content.push({ type: 'table', content: tableRows });
      continue;
    }

    content.push({
      type: 'paragraph',
      content: parseInline(trimmed),
    });
    i += 1;
  }

  return {
    type: 'doc',
    version: 1,
    content: content.length > 0 ? content : [{ type: 'paragraph', content: [{ type: 'text', text: '' }] }],
  };
}

/**
 * Performs an authenticated HTTP request against the Jira REST API.
 */
export async function jiraRequest(
  endpoint,
  { env = loadEnv(), fetchImpl = globalThis.fetch, method = 'GET', body = null, headers = {} } = {}
) {
  const auth = buildJiraAuthHeaders(env);
  const url = endpoint.startsWith('http')
    ? endpoint
    : `${auth.baseUrl}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;

  const res = await fetchImpl(url, {
    method,
    headers: { ...auth.headers, ...headers },
    body: body ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined,
  });

  if (!res.ok) {
    let errText = '';
    try {
      errText = typeof res.text === 'function' ? await res.text() : '';
    } catch {
      errText = '';
    }
    throw new Error(`Jira API Error HTTP ${res.status} on ${method} ${endpoint}${errText ? `: ${errText}` : ''}`);
  }

  return res.json();
}

/**
 * Fetches all Jira issues matching a JQL query using deterministic pagination (`startAt` / `maxResults`).
 */
export async function fetchAllJiraPages(
  jql,
  {
    env = loadEnv(),
    fetchImpl = globalThis.fetch,
    maxResults = 50,
    pageSize = 50,
    fields = [
      'summary',
      'issuetype',
      'status',
      'priority',
      'assignee',
      'labels',
      'parent',
      'description',
      'comment',
    ],
  } = {}
) {
  const auth = buildJiraAuthHeaders(env);
  const collected = [];
  let startAt = 0;

  while (collected.length < maxResults) {
    const limit = Math.min(pageSize, maxResults - collected.length);
    const params = new URLSearchParams({
      jql,
      startAt: String(startAt),
      maxResults: String(limit),
      fields: fields.join(','),
    });
    const data = await jiraRequest(`/rest/api/${auth.apiVersion}/search?${params.toString()}`, {
      env,
      fetchImpl,
    });
    const batch = Array.isArray(data.issues) ? data.issues : [];
    if (batch.length === 0) break;
    collected.push(...batch);
    startAt += batch.length;
    const total = typeof data.total === 'number' ? data.total : collected.length;
    if (startAt >= total) break;
  }

  return collected.slice(0, maxResults);
}
