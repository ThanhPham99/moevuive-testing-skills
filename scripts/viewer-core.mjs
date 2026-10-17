/**
 * Deep Offline Report Viewer Core & Export Module (`scripts/viewer-core.mjs`)
 *
 * Single in-process module shared across all three Offline Report Viewers
 * (`testcases-viewer`, `bugs-viewer`, `execution-viewer`) and `scripts/verify-suite.mjs`:
 *   1. Markdown table, section, and bold key-value parsing + inline formatting
 *   2. Natural Vietnamese/alphanumeric sorting with empty-cell-last & ID tie-breaking
 *   3. Domain models & Export Plan builders for Test Cases, Bug Reports, Execution Reports & RTM
 *   4. Store-only binary ZIP + Office Open XML (`.xlsx`) with status-styled cells + UTF-8 BOM CSV
 */

/* ============================ 1. MARKDOWN & SORT PRIMITIVES ============================ */

export const STATUS_MAP = [
  [/CANNOT[_ ]?VERIFY|KHÔNG VERIFY|KHONG VERIFY/i, 'CANNOT_VERIFY'],
  [/NOT[_ ]?FIXED|CHƯA FIX|CHUA FIX/i, 'NOT_FIXED'],
  [/PARTIAL|MỘT PHẦN/i, 'PARTIAL'],
  [/FIXED|ĐÃ FIX/i, 'FIXED'],
  [/BLOCK/i, 'BLOCKED'],
  [/SKIP/i, 'SKIPPED'],
  [/FAIL/i, 'FAIL'],
  [/PASS/i, 'PASS'],
];

export function normStatus(raw) {
  const t = String(raw || '')
    .replace(/[^\p{L}\p{N}_ ]/gu, ' ')
    .trim();
  for (const [re, v] of STATUS_MAP) {
    if (re.test(t)) return v;
  }
  return '';
}

export const PLACEHOLDER_RE = /^(?:[—–\-]+|n\/a|na)$/i;

export function cleanCell(s) {
  return String(s || '')
    .replace(/\\\|/g, '|')
    .replace(/<br\s*\/?>/gi, '\n')
    .trim();
}

export function formatCellPlainText(raw) {
  return String(raw || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/`/g, '')
    .replace(/\*\*/g, '')
    .replace(/\*/g, '')
    .trim();
}

export function stripInline(s) {
  return formatCellPlainText(s).replace(/\s+/g, ' ').trim();
}

export function stripMd(s) {
  const v = cleanCell(s)
    .replace(/!?\[([^\]]*)\]\(([^)]*)\)/g, (_, a, b) => a || b)
    .replace(/[`*]/g, '')
    .trim();
  return PLACEHOLDER_RE.test(v) ? '' : v;
}

export function splitCells(line) {
  const cells = [];
  let cur = '';
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '\\' && line[i + 1] === '|') {
      cur += '|';
      i++;
    } else if (ch === '|') {
      cells.push(cur.trim());
      cur = '';
    } else {
      cur += ch;
    }
  }
  cells.push(cur.trim());
  if (cells.length && cells[0] === '') cells.shift();
  if (cells.length && cells[cells.length - 1] === '') cells.pop();
  return cells;
}

export function isSeparatorRow(line) {
  const s = String(line || '').trim();
  if (!/^\|?[\s:|-]+\|?$/.test(s) || !s.includes('-')) return false;
  const cells = splitCells(s);
  return cells.length > 0 && cells.every((c) => /^:?-{1,}:?$/.test(c));
}

export function cleanGroupName(raw) {
  return String(raw || '')
    .replace(/^#+\s*/, '')
    .replace(/\s*\(\d+\s*TC\)\s*$/i, '')
    .trim();
}

function stepCodeFence(trimmed, activeFence) {
  if (!activeFence) {
    const openMatch = trimmed.match(/^(`{3,})[^`]*$/) || trimmed.match(/^(~{3,}).*$/);
    if (openMatch) {
      const fence = openMatch[1];
      return { isFenceLine: true, nextFence: { char: fence[0], len: fence.length } };
    }
    return { isFenceLine: false, nextFence: null };
  }
  const closeMatch = trimmed.match(/^(`{3,}|~{3,})\s*$/);
  if (
    closeMatch &&
    closeMatch[1][0] === activeFence.char &&
    closeMatch[1].length >= activeFence.len
  ) {
    return { isFenceLine: true, nextFence: null };
  }
  return { isFenceLine: false, nextFence: activeFence };
}

function extractFirstH1(contentOrLines, preferBugPrefix = false) {
  const lines = Array.isArray(contentOrLines)
    ? contentOrLines
    : String(contentOrLines || '').split(/\r?\n/);
  let fenceState = null;
  let fallbackH1 = '';
  for (const line of lines) {
    const stepped = stepCodeFence(line.trim(), fenceState);
    fenceState = stepped.nextFence;
    if (stepped.isFenceLine || fenceState) continue;
    if (preferBugPrefix) {
      const mBug = line.match(/^#\s*\[BUG\]\s*(.*)$/);
      if (mBug && mBug[1].trim()) return mBug[1].trim();
    }
    if (!fallbackH1) {
      const mH1 = line.match(/^#\s+(.+)/);
      if (mH1 && mH1[1].trim()) {
        fallbackH1 = mH1[1].trim();
        if (!preferBugPrefix) return fallbackH1;
      }
    }
  }
  return fallbackH1;
}

/**
 * Parses all pipe-escaped Markdown tables in a document.
 * Preserves both `headers` and `header` aliases for compatibility across all 3 viewers.
 */
export function parseMarkdownTables(contentOrLines, options = {}) {
  const ignoreCodeFences = Boolean(options && options.ignoreCodeFences);
  const lines = Array.isArray(contentOrLines)
    ? contentOrLines
    : String(contentOrLines || '').split(/\r?\n/);
  const tables = [];
  let currentHeading = '';
  let fenceState = null;
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();
    if (ignoreCodeFences) {
      const stepped = stepCodeFence(trimmed, fenceState);
      fenceState = stepped.nextFence;
      if (stepped.isFenceLine || fenceState) {
        i++;
        continue;
      }
    }

    const heading = line.match(/^(#{1,4})\s+(.+)/);
    if (heading) {
      // Top-level H1 is document title; H2..H4 are section/group headings
      if (heading[1].length >= 2 || !currentHeading) {
        currentHeading = heading[1].length >= 2 ? cleanGroupName(heading[2]) : '';
      }
      i++;
      continue;
    }

    if (trimmed.startsWith('|') && i + 1 < lines.length && isSeparatorRow(lines[i + 1].trim())) {
      const headers = splitCells(trimmed).map(cleanCell);
      const rows = [];
      i += 2;
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        const rowLine = lines[i].trim();
        if (!isSeparatorRow(rowLine)) {
          const cells = splitCells(rowLine).map(cleanCell);
          if (cells.some((c) => c !== '')) rows.push(cells);
        }
        i++;
      }
      tables.push({ heading: currentHeading, headers, header: headers, rows });
      continue;
    }
    i++;
  }

  return tables;
}

export function colIdx(header, re) {
  return header.findIndex((h) => re.test(h));
}

export function splitSections(text) {
  const lines = String(text || '').split(/\r?\n/);
  const sec = { _pre: [] };
  let cur = '_pre';
  let fenceState = null;
  for (const line of lines) {
    const stepped = stepCodeFence(line.trim(), fenceState);
    fenceState = stepped.nextFence;
    if (stepped.isFenceLine || fenceState) {
      sec[cur].push(line);
      continue;
    }
    const m = line.match(/^##\s+(.*)$/);
    if (m) {
      cur = m[1].trim();
      sec[cur] = sec[cur] || [];
      continue;
    }
    sec[cur].push(line);
  }
  return sec;
}

export function extractBoldKV(lines) {
  const o = {};
  let currentKey = '';
  let currentHasInlineValue = false;
  let sawBlank = false;
  let fenceState = null;
  let inHtmlComment = false;
  for (const raw of lines || []) {
    const rawStr = String(raw || '');
    const trimmed = rawStr.trim();
    const stepped = stepCodeFence(trimmed, fenceState);
    fenceState = stepped.nextFence;
    if (stepped.isFenceLine) {
      if (currentKey) {
        o[currentKey] = o[currentKey] ? `${o[currentKey]}\n${trimmed}` : trimmed;
        sawBlank = false;
      }
      continue;
    }
    if (fenceState) {
      if (currentKey) {
        const fenceLine = rawStr.trimEnd();
        o[currentKey] = o[currentKey] ? `${o[currentKey]}\n${fenceLine}` : fenceLine;
      }
      continue;
    }
    if (inHtmlComment) {
      if (trimmed.includes('-->')) inHtmlComment = false;
      continue;
    }
    if (trimmed.startsWith('<!--')) {
      if (!trimmed.includes('-->')) inHtmlComment = true;
      continue;
    }
    if (!trimmed) {
      sawBlank = true;
      continue;
    }
    if (trimmed.startsWith('|')) {
      currentKey = '';
      currentHasInlineValue = false;
      sawBlank = false;
      continue;
    }
    if (/^(?:#{1,6}\s+|---+|\*\*\*+|___+|>\s*)/.test(trimmed)) {
      currentKey = '';
      currentHasInlineValue = false;
      sawBlank = false;
      continue;
    }
    const indent = (rawStr.match(/^[ \t]+/) || [''])[0].replace(/\t/g, '  ').length;
    if (indent < 2) {
      const line = trimmed.replace(/^[-*+]\s+/, '').trim();
      const m =
        line.match(/^\*\*([^*]+?)([:?])\*\*\s*(.*)$/) ||
        line.match(/^\*\*([^*]+?)\*\*\s*([:?])\s*(.*)$/);
      if (m) {
        const k = m[2] === '?' ? `${m[1].trim()}?` : m[1].trim();
        const v = m[3].trim();
        currentKey = k;
        currentHasInlineValue = Boolean(v);
        sawBlank = false;
        if (v || !(k in o)) o[k] = v;
        continue;
      }
    }
    if (currentKey) {
      const isListContinuation = /^[-*+]\s+|^\d+\.\s+/.test(trimmed);
      if (
        indent < 2 &&
        (currentHasInlineValue || (sawBlank && o[currentKey] && !isListContinuation))
      ) {
        currentKey = '';
        currentHasInlineValue = false;
        continue;
      }
      o[currentKey] = o[currentKey] ? `${o[currentKey]}\n${trimmed}` : trimmed;
      sawBlank = false;
    }
  }
  return o;
}

export function compareTcId(a, b) {
  return String(a || '').localeCompare(String(b || ''), 'vi', {
    numeric: true,
    sensitivity: 'base',
  });
}

export function compareText(a, b) {
  const norm = (s) =>
    stripInline(s)
      .replace(/^[^\p{L}\p{N}]+/u, '')
      .trim();
  return norm(a).localeCompare(norm(b), 'vi', { numeric: true, sensitivity: 'base' });
}

export function rowComparator(key, dir, ranks = {}, valueAccessor = null) {
  const rank = ranks[key];
  return (x, y) => {
    const rawA = valueAccessor ? valueAccessor(x, key) : x[key];
    const rawB = valueAccessor ? valueAccessor(y, key) : y[key];
    const a = String(rawA ?? '').trim();
    const b = String(rawB ?? '').trim();
    if (!a !== !b) return a ? -1 : 1;
    const main = rank
      ? (rank[a] ?? rank[a.toLowerCase()] ?? 99) - (rank[b] ?? rank[b.toLowerCase()] ?? 99)
      : a.localeCompare(b, 'vi', { numeric: true, sensitivity: 'base' });
    return dir * main || compareTcId(x.id || x.bug || x.req || '', y.id || y.bug || y.req || '');
  };
}

/* ============================ 2. TEST CASES VIEWER MODEL ============================ */

export const EXPORT_COLUMNS = [
  'TC ID',
  'REQ ID',
  'Module',
  'Risk Level',
  'Test Scenario',
  'Pre-Condition',
  'Test Steps',
  'Test Data',
  'Expected Result',
  'Priority',
  'Automatable',
  'Auto Type',
  'Tags',
];

export const TESTCASE_COLUMN_WIDTHS = [20, 16, 10, 10, 42, 26, 52, 26, 52, 10, 12, 10, 20];

export const PRIORITY_ORDER = {
  critical: 0,
  'nghiêm trọng': 0,
  p0: 0,
  high: 1,
  cao: 1,
  p1: 1,
  medium: 2,
  'trung bình': 2,
  p2: 2,
  low: 3,
  thấp: 3,
  p3: 3,
  p4: 4,
};

export const RISK_ORDER = {
  critical: -1,
  'nghiêm trọng': -1,
  high: 0,
  cao: 0,
  medium: 1,
  'trung bình': 1,
  low: 2,
  thấp: 2,
};

const PRIORITY_BUCKET_MAP = {
  critical: 'critical',
  'nghiêm trọng': 'critical',
  p0: 'critical',
  high: 'high',
  cao: 'high',
  p1: 'high',
  medium: 'medium',
  'trung bình': 'medium',
  p2: 'medium',
  low: 'low',
  thấp: 'low',
  p3: 'low',
  p4: 'low',
};

const VI_PRIORITY_QUERY_MAP = {
  'nghiêm trọng': 'critical',
  cao: 'high',
  'trung bình': 'medium',
  thấp: 'low',
};

function normalizePriorityToken(raw) {
  return String(raw || '')
    .toLowerCase()
    .replace(/^[^a-z0-9à-ỹ]+/i, '')
    .trim();
}

function tcColumnKey(header) {
  const h = String(header || '')
    .toLowerCase()
    .replace(/\*/g, '')
    .trim();
  if (h === 'tc id') return 'id';
  if (h === 'req id') return 'req';
  if (h === 'module') return 'module';
  if (h.includes('risk')) return 'risk';
  if (h.includes('scenario') || h.includes('test title') || h.includes('test case title'))
    return 'title';
  if (h.includes('pre-condition') || h.includes('precondition')) return 'pre';
  if (h.includes('test steps')) return 'steps';
  if (h.includes('test data')) return 'data';
  if (h.includes('expected')) return 'expected';
  if (h === 'priority') return 'priority';
  if (h === 'automatable') return 'automatable';
  if (h.includes('auto type')) return 'autoType';
  if (h === 'tags') return 'tags';
  return null;
}

export function buildGroupScopeKey(fileName, group = '') {
  return `${fileName}::${group}`;
}

export function parseGroupScopeKey(scopeKey) {
  if (!scopeKey) return { fileName: '', group: '' };
  const idx = scopeKey.indexOf('::');
  if (idx === -1) return { fileName: scopeKey, group: '' };
  return {
    fileName: scopeKey.slice(0, idx),
    group: scopeKey.slice(idx + 2),
  };
}

export function parseMarkdownFile(fileName, content) {
  const lines = String(content || '').split(/\r?\n/);
  const docTitle = extractFirstH1(lines) || fileName.replace(/\.md$/i, '');

  const tables = parseMarkdownTables(lines, { ignoreCodeFences: true });
  const testCases = [];
  let seq = 0;

  for (const table of tables) {
    const keys = table.headers.map(tcColumnKey);
    const hasBody = keys.includes('title') || keys.includes('steps') || keys.includes('expected');
    if (!keys.includes('id') || !hasBody) continue;

    for (const cells of table.rows) {
      const row = {};
      keys.forEach((k, idx) => {
        if (k && idx < cells.length) row[k] = cells[idx];
      });
      if (row.id && /TC/i.test(row.id)) {
        testCases.push({
          uid: fileName + '#' + seq++,
          id: stripInline(row.id),
          reqIds: (row.req || '')
            .split(',')
            .map((s) => stripInline(s).trim())
            .filter(Boolean),
          module: stripInline(row.module || ''),
          risk: stripInline(row.risk || ''),
          title: row.title || '',
          preCondition: row.pre || '',
          steps: row.steps || '',
          testData: row.data || '',
          expected: row.expected || '',
          priority: stripInline(row.priority || ''),
          automatable: stripInline(row.automatable || ''),
          autoType: stripInline(row.autoType || ''),
          tags: (row.tags || '')
            .split(/[\s,;]+/)
            .map((t) => stripInline(t).trim())
            .filter((t) => t.startsWith('@')),
          group: table.heading,
          sourceFile: fileName,
        });
      }
    }
  }

  return { fileName, docTitle, testCases };
}

export function queryTestCases(parsedFiles, query = {}) {
  const allCases = parsedFiles.flatMap((f) => f.testCases);
  const tagSet = new Set();
  for (const tc of allCases) {
    for (const t of tc.tags) tagSet.add(t);
  }
  const allTags = [...tagSet].sort();

  const q = (query.search ?? '').trim().toLowerCase();
  const scopeKey = query.scopeKey ?? '';
  const prioritySet = new Set(
    [...(query.priorities ?? [])].map((p) => {
      const tok = normalizePriorityToken(p);
      return VI_PRIORITY_QUERY_MAP[tok] || tok;
    })
  );
  const autoFilter = normalizePriorityToken(query.automatable ?? '');
  const tagFilter = query.tag ?? '';
  const sort = query.sort ?? { key: 'id', dir: 1 };

  let rows = allCases;
  if (scopeKey) {
    const { fileName, group } = parseGroupScopeKey(scopeKey);
    rows = rows.filter(
      (tc) => tc.sourceFile === fileName && (group === '' || tc.group === group)
    );
  }
  if (prioritySet.size > 0) {
    rows = rows.filter((tc) => {
      const rawLower = tc.priority.toLowerCase();
      const tok = normalizePriorityToken(tc.priority);
      const bucket = PRIORITY_BUCKET_MAP[tok] || tok;
      return prioritySet.has(rawLower) || prioritySet.has(tok) || prioritySet.has(bucket);
    });
  }
  if (autoFilter) {
    rows = rows.filter((tc) => {
      const a = normalizePriorityToken(tc.automatable);
      if (autoFilter === 'yes' || autoFilter === 'có' || autoFilter === 'co') {
        return a === 'yes' || a === 'có' || a === 'co';
      }
      if (autoFilter === 'no' || autoFilter === 'không' || autoFilter === 'khong') {
        return a === 'no' || a === 'không' || a === 'khong';
      }
      return a === autoFilter;
    });
  }
  if (tagFilter) {
    rows = rows.filter((tc) => tc.tags.includes(tagFilter));
  }
  if (q) {
    rows = rows.filter((tc) =>
      [
        tc.id,
        tc.reqIds.join(' '),
        tc.title,
        tc.steps,
        tc.expected,
        tc.testData,
        tc.preCondition,
        tc.tags.join(' '),
      ]
        .join(' ')
        .toLowerCase()
        .includes(q)
    );
  }

  const dir = sort.dir;
  const primary = (a, b) => {
    switch (sort.key) {
      case 'id':
        return compareTcId(a.id, b.id);
      case 'title':
        return compareText(a.title, b.title);
      case 'group':
        return compareText(a.group, b.group);
      case 'priority':
        return (
          (PRIORITY_ORDER[normalizePriorityToken(a.priority)] ?? 9) -
          (PRIORITY_ORDER[normalizePriorityToken(b.priority)] ?? 9)
        );
      case 'risk':
        return (
          (RISK_ORDER[normalizePriorityToken(a.risk)] ?? 9) -
          (RISK_ORDER[normalizePriorityToken(b.risk)] ?? 9)
        );
      default:
        return compareTcId(a.id, b.id);
    }
  };

  const filtered = [...rows].sort((a, b) => dir * primary(a, b) || compareTcId(a.id, b.id));

  const stats = {};
  for (const tc of filtered) {
    const tok = normalizePriorityToken(tc.priority);
    const p = PRIORITY_BUCKET_MAP[tok] || tok || 'khác';
    stats[p] = (stats[p] ?? 0) + 1;
  }

  const { fileName: selectedFile } = parseGroupScopeKey(scopeKey);
  const source = selectedFile || (parsedFiles.length === 1 ? parsedFiles[0].fileName : '');
  const exportBaseName = source ? source.replace(/\.(md|markdown|txt)$/i, '') : 'test_cases';

  return {
    allCases,
    filtered,
    allTags,
    stats,
    exportBaseName,
  };
}

function tcRowOf(tc) {
  return [
    tc.id,
    tc.reqIds.join(', '),
    tc.module,
    tc.risk,
    formatCellPlainText(tc.title),
    formatCellPlainText(tc.preCondition),
    formatCellPlainText(tc.steps),
    formatCellPlainText(tc.testData),
    formatCellPlainText(tc.expected),
    tc.priority,
    tc.automatable,
    tc.autoType,
    tc.tags.join(' '),
  ];
}

export function buildTestCasesExportPlan(cases, baseName = 'test_cases') {
  const head = [...EXPORT_COLUMNS];
  const groups = [...new Set(cases.map((tc) => tc.group))].filter(Boolean);
  const sheets = [
    {
      name: 'Tổng hợp',
      statusCol: 9,
      statusCols: [3, 9, 10],
      widths: TESTCASE_COLUMN_WIDTHS,
      head,
      rows: cases.map(tcRowOf),
    },
  ];
  if (groups.length > 1) {
    for (const g of groups) {
      const rows = cases.filter((tc) => tc.group === g).map(tcRowOf);
      sheets.push({
        name: g.replace(/^Nhóm\s+/i, ''),
        statusCol: 9,
        statusCols: [3, 9, 10],
        widths: TESTCASE_COLUMN_WIDTHS,
        head,
        rows,
      });
    }
  }
  return { base: baseName, sheets };
}

/* ============================ 3. BUGS VIEWER MODEL ============================ */

export const SEV_MAP = [
  [/critical|nghiêm trọng/i, 'CRITICAL'],
  [/major/i, 'MAJOR'],
  [/minor/i, 'MINOR'],
  [/trivial/i, 'TRIVIAL'],
];

export const SEV_LABEL = {
  CRITICAL: '🔴 Critical',
  MAJOR: '🟠 Major',
  MINOR: '🟡 Minor',
  TRIVIAL: '🟢 Trivial',
};

export const ST_LABEL = {
  OPEN: '🔴 Đang mở',
  PARTIAL: '🟡 Một phần (PARTIAL)',
  CANNOT_VERIFY: '⚠️ Không verify được',
  CLOSED: '🟢 Đã đóng',
  PENDING: '🟡 Chờ retest',
  NEEDS_REVIEW: '⚠️ Cần rà lại',
};

export const ALL_BUG_ST = ['OPEN', 'PARTIAL', 'CANNOT_VERIFY', 'PENDING', 'NEEDS_REVIEW', 'CLOSED'];
export const ALL_BUG_SV = ['CRITICAL', 'MAJOR', 'MINOR', 'TRIVIAL'];
export const ALL_BUG_PR = ['P1', 'P2', 'P3'];

export const BUG_RANKS = {
  severity: { CRITICAL: 0, MAJOR: 1, MINOR: 2, TRIVIAL: 3 },
  priority: { P1: 0, P2: 1, P3: 2 },
  status: ALL_BUG_ST.reduce((o, s, i) => ((o[s] = i), o), {}),
};

export function classifyBugStatus(rawStatus) {
  const s = stripMd(rawStatus || '');
  if (!s) return 'OPEN';
  if (/một phần|\bpartial\b/i.test(s)) return 'PARTIAL';
  if (/không verify|khong verify|cannot[_ ]?verify/i.test(s)) return 'CANNOT_VERIFY';
  if (/chờ retest|cho retest|\bpending\b/i.test(s)) return 'PENDING';
  if (/rà lại|ra lai|needs[_ ]?review/i.test(s)) return 'NEEDS_REVIEW';
  if (/đóng|\bclosed\b|(?<!not[_ ])\bfixed\b|🟢|✅/i.test(s)) return 'CLOSED';
  if (/đã fix|da fix/i.test(s)) return 'PENDING';
  return 'OPEN';
}

function extractBugModule(bugId, fallbackMod = 'unknown') {
  const rawId = String(bugId || '').trim();
  const m =
    rawId.match(/^BUG_([a-z][a-z0-9_-]*?)_\d+(?:_|$)/i) ||
    rawId.match(/^BUG_([a-z][a-z0-9-]*?)_/i);
  const candidate = m ? m[1].toLowerCase() : '';
  if (candidate && !/^tc_?\d*$/i.test(candidate)) {
    return candidate;
  }
  const fb = stripMd(fallbackMod || '').trim().toLowerCase();
  return fb || 'unknown';
}

function findKey(o, res) {
  for (const re of res) {
    for (const k of Object.keys(o)) {
      if (re.test(k)) return o[k];
    }
  }
  return '';
}

export function isBugFile(text) {
  return /\*\*(?:ID|Mã\s*bug|Bug\s*ID)(?::\*\*|\*\*\s*:)\s*[`*'"]*BUG_/i.test(
    String(text || '')
  );
}

export function parseBugFile(text, fileName) {
  const raw = String(text || '');
  const titleLine = extractFirstH1(raw, true);
  const sec = splitSections(raw);
  const infoKV = extractBoldKV(sec['Thông tin chung'] || []);
  const noteKV = extractBoldKV(sec['Ghi chú thêm'] || []);

  const id = (
    stripMd(findKey(infoKV, [/^id$/i, /^mã\s*bug$/i, /^bug\s*id$/i])) ||
    String(fileName || '').replace(/\.md$/i, '')
  ).trim();
  const module = extractBugModule(
    id,
    findKey(infoKV, [/^module$/i, /module|phân hệ/i]) || 'unknown'
  );
  const sevRaw = findKey(infoKV, [/^severity$/i, /severity|mức độ nghiêm trọng/i]) || '';
  const severity = (SEV_MAP.find(([re]) => re.test(sevRaw)) || [, ''])[1];
  const prioRaw =
    findKey(infoKV, [/^priority$/i, /priority|độ ưu tiên|mức độ ưu tiên/i]) || '';
  const priority = (prioRaw.match(/P[1-3]/i) || [''])[0].toUpperCase();
  const statusRaw = stripMd(
    findKey(infoKV, [/^trạng thái$/i, /^status$/i, /trạng thái|status/i]) || ''
  );
  const jiraIssue =
    stripMd(findKey(infoKV, [/^jira\s*(?:issue|key)$/i]) || '') ||
    (statusRaw.match(/\(([A-Z][A-Z0-9_]+-\d+)\)/) || [, ''])[1];
  const execRuns = Object.keys(infoKV)
    .filter((k) => /execution run/i.test(k))
    .map((k) => `${k}: ${infoKV[k]}`)
    .join('\n');

  const rtabs = parseMarkdownTables(sec['Lịch sử retest'] || [], { ignoreCodeFences: true });
  const rtab = rtabs.find(
    (t) => colIdx(t.header, /ngày/i) >= 0 && colIdx(t.header, /kết quả/i) >= 0
  );
  const retest = [];
  if (rtab) {
    const iD = colIdx(rtab.header, /ngày/i);
    const iB = colIdx(rtab.header, /build/i);
    const iR = colIdx(rtab.header, /kết quả/i);
    const iRep = colIdx(rtab.header, /retest report/i);
    const iN = colIdx(rtab.header, /ghi chú/i);
    for (const r of rtab.rows) {
      const result = stripMd(r[iR]);
      if (!result) continue;
      retest.push({
        date: stripMd(r[iD]),
        build: stripMd(r[iB]),
        result,
        resultCode: normStatus(result),
        report: r[iRep] || '',
        note: stripMd(r[iN]),
      });
    }
  }

  let status = statusRaw ? classifyBugStatus(statusRaw) : 'OPEN';
  if (retest.length) {
    const latest = retest[0].resultCode;
    status =
      latest === 'FIXED'
        ? 'CLOSED'
        : latest === 'PARTIAL'
          ? 'PARTIAL'
          : latest === 'CANNOT_VERIFY'
            ? 'CANNOT_VERIFY'
            : 'OPEN';
  }

  return {
    kind: 'bug',
    fileName,
    id,
    module,
    title: titleLine,
    severityRaw: sevRaw,
    severity,
    priorityRaw: prioRaw,
    priority,
    jiraIssue,
    env: stripMd(findKey(infoKV, [/^môi trường$/i, /môi trường|environment/i]) || ''),
    build: stripMd(
      findKey(infoKV, [/^build\s*\/\s*version$/i, /^build$/i, /build|version|phiên bản/i]) || ''
    ),
    tc: stripMd(
      findKey(infoKV, [/^test case liên quan$/i, /test case|tc liên quan/i]) || ''
    ),
    req: stripMd(
      findKey(infoKV, [/^req id liên quan$/i, /^requirement$/i, /req id|requirement/i]) || ''
    ),
    testData: findKey(infoKV, [/^test data đã dùng$/i, /test data|dữ liệu test/i]) || '',
    dateFound: stripMd(
      findKey(infoKV, [/^ngày phát hiện$/i, /ngày phát hiện|date found/i]) || ''
    ),
    executionRun: execRuns,
    steps: (sec['Steps to Reproduce'] || []).join('\n').trim(),
    expected: (sec['Expected Result'] || []).join('\n').trim(),
    actual: (sec['Actual Result'] || []).join('\n').trim(),
    evidenceRaw: (sec['Evidence'] || []).join('\n').trim(),
    freq: findKey(noteKV, [/^tần suất tái hiện$/i, /tần suất/i]) || '',
    workaround: findKey(noteKV, [/^workaround/i, /workaround|giải pháp tạm/i]) || '',
    rootCause: findKey(noteKV, [/root cause|nguyên nhân gốc/i]) || '',
    proposedFix:
      findKey(noteKV, [/đề xuất\s*fix|^đề xuất\b|hướng khắc phục/i]) || '',
    verifyAfterFix: findKey(noteKV, [/cách verify sau khi fix|verify sau khi fix/i]) || '',
    notesOther: Object.entries(noteKV)
      .filter(
        ([k]) =>
          !/tần suất|workaround|giải pháp tạm|root cause|nguyên nhân gốc|đề xuất\s*fix|^đề xuất\b|hướng khắc phục|verify sau khi fix/i.test(
            k
          )
      )
      .map(([k, v]) => `${k}: ${v}`)
      .join('\n'),
    retest,
    retestCount: retest.length,
    status,
    statusRaw,
  };
}

export function parseBugIndex(text, fileName) {
  const tables = parseMarkdownTables(String(text || '').split(/\r?\n/), {
    ignoreCodeFences: true,
  });
  const t = tables.find(
    (tb) => colIdx(tb.header, /mã bug/i) >= 0 && colIdx(tb.header, /trạng thái/i) >= 0
  );
  const out = [];
  if (t) {
    const iId = colIdx(t.header, /mã bug/i);
    const iMod = colIdx(t.header, /module/i);
    const iTitle = colIdx(t.header, /tiêu đề/i);
    const iSev = colIdx(t.header, /severity/i);
    const iPrio = colIdx(t.header, /priority/i);
    const iSt = colIdx(t.header, /trạng thái/i);
    const iTc = colIdx(t.header, /tc liên quan/i);
    const iDate = colIdx(t.header, /ngày phát hiện/i);
    for (const r of t.rows) {
      const rawId = r[iId] || '';
      const m = rawId.match(/\[([^\]]+)\]/);
      const id = (m ? m[1] : stripMd(rawId)).trim();
      if (!id) continue;
      const statusRaw = stripMd(r[iSt] || '');
      const status = classifyBugStatus(statusRaw);
      const sevRaw = stripMd(r[iSev] || '');
      const severity = (SEV_MAP.find(([re]) => re.test(sevRaw)) || [, ''])[1];
      const prioRaw = stripMd(r[iPrio] || '');
      const priority = (prioRaw.match(/P[1-3]/i) || [''])[0].toUpperCase();
      const jiraIssue = (statusRaw.match(/\(([A-Z][A-Z0-9_]+-\d+)\)/) || [, ''])[1];
      out.push({
        kind: 'summary',
        fileName,
        id,
        module: extractBugModule(id, iMod >= 0 ? r[iMod] : 'unknown'),
        title: stripMd(r[iTitle] || ''),
        severityRaw: sevRaw,
        severity,
        priorityRaw: prioRaw,
        priority,
        jiraIssue,
        env: '',
        build: '',
        tc: stripMd(r[iTc] || ''),
        req: '',
        testData: '',
        dateFound: stripMd(r[iDate] || ''),
        executionRun: '',
        steps: '',
        expected: '',
        actual: '',
        evidenceRaw: '',
        freq: '',
        workaround: '',
        rootCause: '',
        proposedFix: '',
        verifyAfterFix: '',
        notesOther: '',
        retest: [],
        retestCount: 0,
        status,
        statusRaw,
      });
    }
  }
  const meta = {};
  for (const tb of tables) {
    if (tb.header.length === 2 && !tb.heading) {
      for (const r of tb.rows) if (r[0]) meta[r[0]] = stripMd(r[1]);
    }
  }
  return { rows: out, meta };
}

function mergeBugAndSummary(bugDoc, summaryDoc) {
  const merged = { ...bugDoc };
  if (!merged.jiraIssue && summaryDoc.jiraIssue) merged.jiraIssue = summaryDoc.jiraIssue;
  if (!merged.statusRaw && summaryDoc.statusRaw) merged.statusRaw = summaryDoc.statusRaw;
  if (
    (!merged.retest || merged.retest.length === 0) &&
    merged.status === 'OPEN' &&
    summaryDoc.status &&
    summaryDoc.status !== 'OPEN'
  ) {
    merged.status = summaryDoc.status;
  }
  if (
    (!merged.module || merged.module === 'unknown') &&
    summaryDoc.module &&
    summaryDoc.module !== 'unknown'
  ) {
    merged.module = summaryDoc.module;
  }
  return merged;
}

export function dedupeBugs(docs) {
  const byId = {};
  for (const d of docs) {
    const prev = byId[d.id];
    if (!prev) {
      byId[d.id] = d;
    } else if (prev.kind === 'summary' && d.kind === 'bug') {
      byId[d.id] = mergeBugAndSummary(d, prev);
    } else if (prev.kind === 'bug' && d.kind === 'summary') {
      byId[d.id] = mergeBugAndSummary(prev, d);
    }
  }
  return Object.values(byId);
}

export function queryBugsCatalog(docs, query = {}) {
  const base = dedupeBugs(docs);
  const q = String(query.search || '')
    .trim()
    .toLowerCase();
  const mod = query.module || '';
  const offStatus = query.offStatus || new Set();
  const offSev = query.offSev || new Set();
  const offPrio = query.offPrio || new Set();
  const sortKey = query.sortKey || 'dateFound';
  const sortDir = query.sortDir ?? -1;

  const filtered = base
    .filter((b) => {
      if (offStatus.has(b.status)) return false;
      if (b.severity && offSev.has(b.severity)) return false;
      if (b.priority && offPrio.has(b.priority)) return false;
      if (mod && b.module !== mod) return false;
      if (!q) return true;
      return [
        b.id,
        b.title,
        b.module,
        b.tc,
        b.req,
        b.steps,
        b.expected,
        b.actual,
        b.freq,
        b.workaround,
        b.rootCause,
        b.proposedFix,
        b.notesOther,
        b.build,
        b.env,
      ].some((v) => String(v || '').toLowerCase().includes(q));
    })
    .sort(rowComparator(sortKey, sortDir, BUG_RANKS));

  const open = base.filter((b) => b.status === 'OPEN').length;
  const closed = base.filter((b) => b.status === 'CLOSED').length;
  const pending = base.filter((b) =>
    ['PARTIAL', 'PENDING', 'CANNOT_VERIFY', 'NEEDS_REVIEW'].includes(b.status)
  ).length;
  const critOpen = base.filter((b) => b.severity === 'CRITICAL' && b.status !== 'CLOSED');
  const recurNotFixed = base.filter(
    (b) => (b.retest || []).filter((r) => r.resultCode === 'NOT_FIXED').length >= 2
  );
  const missingRef = base.filter((b) => b.kind === 'bug' && (!b.build || !b.req));
  const summaryOnly = base.filter((b) => b.kind === 'summary');

  return {
    base,
    filtered,
    stats: {
      total: base.length,
      open,
      pending,
      closed,
      critOpenCount: critOpen.length,
    },
    alerts: {
      critOpen,
      recurNotFixed,
      missingRef,
      summaryOnly,
    },
  };
}

export function buildBugsExportPlan(rows) {
  const head = [
    'Mã bug',
    'Tiêu đề',
    'Module',
    'Severity',
    'Priority',
    'Trạng thái',
    'TC liên quan',
    'REQ ID',
    'Ngày phát hiện',
    'Build',
    'Số lần retest',
    'File nguồn',
  ];
  const sheetRows = rows.map((b) => [
    b.id,
    b.title,
    b.module,
    b.severityRaw,
    b.priorityRaw,
    b.status,
    b.tc,
    b.req,
    b.dateFound,
    b.build,
    String(b.retestCount || 0),
    b.fileName,
  ]);
  const widths = [28, 44, 14, 12, 10, 16, 20, 16, 14, 22, 10, 32];
  return {
    base: 'bug_report',
    sheets: [
      {
        name: 'Tổng hợp',
        statusCol: 5,
        statusCols: [3, 4, 5],
        widths,
        head,
        rows: sheetRows,
      },
    ],
  };
}

/* ============================ 4. EXECUTION & RTM VIEWER MODEL ============================ */

export const RTM_ST = {
  FULL: 'Đã automate',
  PARTIALCOV: 'Automate một phần',
  MANUAL: 'Mới có TC thủ công',
  NOTCOVERED: 'Chưa có TC',
  OUTOFSCOPE: 'Ngoài phạm vi',
};

export const GRP_LABEL = {
  NEW: '🆕 Mới fail',
  RECUR: '🔁 Fail liên tục',
  FIXEDTREND: '✅ Vừa được fix',
  TOBLOCKED: '⚠️ Chuyển sang BLOCKED',
};

const TCID_RE = /\b([A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*_TC_\d+(?:-[a-z0-9]+)?|TC_[A-Z0-9_]+(?:-[a-z0-9]+)?)\b/i;

function isKVTable(t) {
  return (
    t.header.length === 2 &&
    (t.header.every((h) => h === '') ||
      /thông tin|thuộc tính|mục|trường|field|key|property/i.test(t.header[0]))
  );
}

function kvOfTable(t) {
  const o = {};
  for (const r of t.rows) {
    if (r[0]) {
      const k = r[0].replace(/[*`]/g, '').trim();
      o[k] = /^evidence|bằng chứng$/i.test(k) ? cleanCell(r[1]) : stripMd(r[1]);
    }
  }
  return o;
}

export function parseRtm(tables, fileName, title) {
  const rows = [];
  const notAuto = [];
  const orphans = [];
  const guesses = [];
  const undocumented = [];
  const suggest = {};

  for (const t of tables) {
    const H = t.header;
    const iReq = colIdx(H, /^REQ(\s*ID)?$/i);
    const iTc = colIdx(H, /^TC\s*IDs?$/i);
    const iAuto = colIdx(H, /automation|script/i);
    const iSt = colIdx(H, /trạng thái/i);
    const iDesc = colIdx(H, /mô tả/i);
    const iSug = colIdx(H, /đề xuất/i);
    const iTcId = colIdx(H, /^TC\s*ID$/i);
    const iPrio = colIdx(H, /priority|ưu tiên/i);
    const iTest = colIdx(H, /^test$/i);
    const iFile = colIdx(H, /^file$/i);
    const iBasis = colIdx(H, /căn cứ/i);
    const iMod = colIdx(H, /^module$/i);

    if (iReq >= 0 && iTc >= 0) {
      for (const r of t.rows) {
        const req = stripMd(r[iReq]);
        if (!req) continue;
        const tcs = (iTc >= 0 ? stripMd(r[iTc]) : '')
          .split(/[,;]/)
          .map((s) => s.trim())
          .filter(Boolean);
        const auto = iAuto >= 0 ? stripMd(r[iAuto]) : '';
        const declared = iSt >= 0 ? stripMd(r[iSt]) : '';
        const isOutOfScope = /out\s*of\s*scope|ngoài\s*phạm\s*vi/i.test(declared);
        const isDeclaredUncovered = /uncovered|not\s*covered|chưa\s*có\s*tc/i.test(declared);
        const isDeclaredManual = /manual(?:\s*only)?|mới\s*có\s*tc\s*thủ\s*công/i.test(declared);
        const isDeclaredPartial = /\bpartial\b|automate\s*một\s*phần/i.test(declared);
        const isNonAutoText =
          !auto ||
          /^(?:chưa\s*(?:automate|có|hỗ\s*trợ)|không(?:\s*có)?|none|no|false|manual(?:\s*only)?|0|❌|⚪)$/i.test(
            auto
          );
        const m =
          auto.match(/\((\d+)\s*\/\s*(\d+)\)/) || auto.match(/^(\d+)\s*\/\s*(\d+)$/);
        const nTc = m ? +m[2] : tcs.length;
        const nAuto = m
          ? +m[1]
          : isNonAutoText || isDeclaredManual || isDeclaredUncovered
            ? 0
            : isDeclaredPartial
              ? Math.max(0, tcs.length - 1)
              : tcs.length;
        rows.push({
          req,
          desc: iDesc >= 0 ? stripMd(r[iDesc]) : '',
          tcs,
          auto,
          nAuto,
          nTc,
          declared,
          status: isOutOfScope
            ? 'OUTOFSCOPE'
            : tcs.length === 0 || isDeclaredUncovered
              ? 'NOTCOVERED'
              : nAuto === 0 || isDeclaredManual
                ? 'MANUAL'
                : nAuto < nTc || isDeclaredPartial
                  ? 'PARTIALCOV'
                  : 'FULL',
        });
      }
    } else if (iReq >= 0 && iSug >= 0) {
      for (const r of t.rows) {
        const req = stripMd(r[iReq]);
        if (req) suggest[req] = stripMd(r[iSug]);
      }
    } else if (iTcId >= 0 && iPrio >= 0) {
      for (const r of t.rows) {
        const id = stripMd(r[iTcId]);
        if (id) {
          notAuto.push({
            id,
            priority: stripMd(r[iPrio]),
            note: stripMd(r[colIdx(H, /ghi chú/i)]),
          });
        }
      }
    } else if (iTest >= 0 && iFile >= 0) {
      for (const r of t.rows) {
        const n = stripMd(r[iTest]);
        if (n) {
          orphans.push({
            test: n,
            file: stripMd(r[iFile]),
            suggest: iSug >= 0 ? stripMd(r[iSug]) : '',
          });
        }
      }
    } else if (iBasis >= 0) {
      for (const r of t.rows) {
        const a = stripMd(r[0]);
        if (a) guesses.push({ req: a, tc: stripMd(r[1]), basis: stripMd(r[iBasis]) });
      }
    } else if (iMod >= 0 && /⬛|chưa|khám phá|recon/i.test(t.heading)) {
      for (const r of t.rows) {
        const mo = stripMd(r[iMod]);
        if (mo) {
          undocumented.push({
            module: mo,
            note: t.rows.length ? stripMd(r[1]) : '',
            risk: stripMd(r[2]),
          });
        }
      }
    }
  }
  for (const r of rows) {
    if (suggest[r.req]) r.suggest = suggest[r.req];
  }
  return {
    kind: 'rtm',
    fileName,
    title,
    module: title || fileName,
    runId: fileName,
    build: '',
    meta: {},
    tcs: [],
    bugs: [],
    dirty: 0,
    rtm: { rows, notAuto, orphans, guesses, undocumented },
  };
}

export function parseTestSummary(rawOrTables, nameOrLines = '', maybeFileName = '', maybeTitle = '') {
  let tables;
  let lines;
  let fileName;
  let title;

  if (typeof rawOrTables === 'string') {
    lines = rawOrTables.split(/\r?\n/);
    tables = parseMarkdownTables(lines, { ignoreCodeFences: true });
    fileName = String(nameOrLines || '');
    title = extractFirstH1(lines);
  } else {
    tables = Array.isArray(rawOrTables) ? rawOrTables : [];
    lines = Array.isArray(nameOrLines) ? nameOrLines : String(nameOrLines || '').split(/\r?\n/);
    fileName = String(maybeFileName || '');
    title = String(maybeTitle || '');
  }

  let meta = {};
  for (const t of tables) {
    if (isKVTable(t) && !t.heading) meta = { ...kvOfTable(t), ...meta };
  }

  let verdictBanner = '';
  for (const l of lines) {
    const m = l.match(/^>\s*#{1,3}\s*(.+)$/);
    if (m) {
      verdictBanner = stripMd(m[1]);
      break;
    }
  }
  let verdict = 'GO';
  if (/NO[-_ ]?GO/i.test(verdictBanner)) verdict = 'NO_GO';
  else if (/ĐIỀU KIỆN|CONDITIONAL/i.test(verdictBanner)) verdict = 'CONDITIONAL_GO';

  const untested = [];
  const exitCriteria = [];
  const modules = [];
  const defectSummary = [];
  const openBugs = [];
  const rtmMetrics = [];

  const isTotalSummaryLabel = (s) =>
    /^(?:tổng(?:\s*cộng|\s*số|\s*hợp)?|total|grand\s*total|all\s*modules)$/i.test(
      String(s || '').trim()
    );

  for (const t of tables) {
    const H = t.header;
    const iCrit = colIdx(H, /tiêu chí/i);
    const iThr = colIdx(H, /ngưỡng/i);
    const iAct = colIdx(H, /thực tế/i);
    const iRes = colIdx(H, /kết quả/i);

    const iMod = colIdx(H, /^module$/i);
    const iPref = colIdx(H, /^prefix$/i);
    const iTotTc = colIdx(H, /tổng tc/i);
    const iPass = colIdx(H, /\bpass\b/i);
    const iFail = colIdx(H, /\bfail\b/i);
    const iBlk = colIdx(H, /block/i);
    const iSkip = colIdx(H, /skip/i);
    const iRate = colIdx(H, /pass rate/i);
    const iSrc = colIdx(H, /nguồn|latest/i);

    const iReason = colIdx(H, /nguyên nhân/i);
    const iRisk = colIdx(H, /rủi ro/i);

    const iBugId = colIdx(H, /mã bug/i);
    const iSev = colIdx(H, /severity|mức độ/i);
    const iOpenCount = colIdx(H, /^đang mở$/i);

    const iMetric = colIdx(H, /^chỉ số$/i);
    const iVal = colIdx(H, /^giá trị$/i);

    if (iCrit >= 0 && iThr >= 0 && iAct >= 0) {
      const iIdx = colIdx(H, /^#$/);
      for (const r of t.rows) {
        const criterion = stripMd(r[iCrit]);
        if (!criterion) continue;
        const rawRes = iRes >= 0 ? r[iRes] : '';
        const status = /không đạt|❌|fail/i.test(rawRes) ? 'FAIL' : 'PASS';
        const idxVal = iIdx >= 0 ? stripMd(r[iIdx]) : String(exitCriteria.length + 1);
        exitCriteria.push({
          idx: idxVal,
          index: idxVal,
          criterion,
          threshold: stripMd(r[iThr]),
          actual: stripMd(r[iAct]),
          result: stripMd(rawRes),
          status,
        });
      }
    } else if (iMod >= 0 && iTotTc >= 0 && iRate >= 0) {
      for (const r of t.rows) {
        const mod = stripMd(r[iMod]);
        if (!mod || isTotalSummaryLabel(mod)) continue;
        const srcVal = iSrc >= 0 ? stripMd(r[iSrc]) : '';
        const mPref = mod.match(/\(`?([A-Z0-9_]+)`?\)/);
        const prefVal =
          iPref >= 0 ? stripMd(r[iPref]) : mPref ? mPref[1] : mod.toUpperCase();
        modules.push({
          module: mod,
          prefix: prefVal,
          latestRun: srcVal,
          total: +(stripMd(r[iTotTc]) || 0),
          pass: iPass >= 0 ? +(stripMd(r[iPass]) || 0) : 0,
          fail: iFail >= 0 ? +(stripMd(r[iFail]) || 0) : 0,
          blocked: iBlk >= 0 ? +(stripMd(r[iBlk]) || 0) : 0,
          skipped: iSkip >= 0 ? +(stripMd(r[iSkip]) || 0) : 0,
          passRate: stripMd(r[iRate]),
          source: srcVal,
          openBugs: 0,
        });
      }
    } else if (iMod >= 0 && iReason >= 0) {
      const iSt = colIdx(H, /trạng thái/i);
      for (const r of t.rows) {
        const mod = stripMd(r[iMod]);
        const st = iSt >= 0 ? stripMd(r[iSt]) : '';
        if (!mod || isTotalSummaryLabel(mod) || /^đã phủ 100%/i.test(st)) continue;
        const mPref = mod.match(/\(`?([A-Z0-9_]+)`?\)/);
        untested.push({
          module: mod,
          prefix: iPref >= 0 ? stripMd(r[iPref]) : mPref ? mPref[1] : mod.toUpperCase(),
          status: st,
          reason: stripMd(r[iReason]),
          risk: iRisk >= 0 ? stripMd(r[iRisk]) : '',
        });
      }
    } else if (iBugId >= 0 && iSev >= 0) {
      const iTitle = colIdx(H, /tiêu đề/i);
      const iPrio = colIdx(H, /priority/i);
      const iTcReq = colIdx(H, /tc|req/i);
      const iSt = colIdx(H, /trạng thái/i);
      for (const r of t.rows) {
        const id = stripMd(r[iBugId]);
        if (!id) continue;
        const stRaw = iSt >= 0 ? stripMd(r[iSt]) : 'OPEN';
        const bugStatus = classifyBugStatus(stRaw);
        const modFromId = extractBugModule(id, '');
        openBugs.push({
          id,
          module:
            (iMod >= 0 ? stripMd(r[iMod]) : '') ||
            (modFromId !== 'unknown' ? modFromId : ''),
          title: iTitle >= 0 ? stripMd(r[iTitle]) : '',
          severity: stripMd(r[iSev]),
          priority: iPrio >= 0 ? stripMd(r[iPrio]) : '',
          tcReq: iTcReq >= 0 ? stripMd(r[iTcReq]) : '',
          status: bugStatus,
          statusRaw: stRaw,
        });
      }
    } else if (iSev >= 0 && iOpenCount >= 0) {
      const iTot = colIdx(H, /tổng số/i);
      const iClosed = colIdx(H, /đã đóng/i);
      for (const r of t.rows) {
        const sev = stripMd(r[iSev]);
        if (!sev || isTotalSummaryLabel(sev)) continue;
        defectSummary.push({
          severity: sev,
          total: iTot >= 0 ? +(stripMd(r[iTot]) || 0) : 0,
          open: +(stripMd(r[iOpenCount]) || 0),
          closed: iClosed >= 0 ? +(stripMd(r[iClosed]) || 0) : 0,
        });
      }
    } else if (iMetric >= 0 && iVal >= 0) {
      for (const r of t.rows) {
        const metric = stripMd(r[iMetric]);
        if (!metric) continue;
        rtmMetrics.push({
          metric,
          value: stripMd(r[iVal]),
        });
      }
    }
  }

  const modKeys = (rawMod, rawPref, bugId) => {
    const keys = new Set();
    for (const v of [rawMod, rawPref]) {
      const s = String(v || '').trim().toLowerCase();
      if (!s) continue;
      keys.add(s);
      const noParen = s.replace(/\s*\([^)]*\)\s*$/, '').trim();
      if (noParen) keys.add(noParen);
      const inParen = (s.match(/\(`?([a-z0-9_]+)`?\)/) || [, ''])[1];
      if (inParen) keys.add(inParen);
      const leaf = noParen.split('/').pop();
      if (leaf) keys.add(leaf);
    }
    if (bugId) {
      const fromId = extractBugModule(bugId, '');
      if (fromId && fromId !== 'unknown') keys.add(fromId);
    }
    return keys;
  };

  for (const m of modules) {
    const targetKeys = modKeys(m.module, m.prefix, '');
    m.openBugs = openBugs.filter((b) => {
      if (b.status === 'CLOSED') return false;
      const bKeys = modKeys(b.module, '', b.id);
      for (const k of bKeys) {
        if (targetKeys.has(k)) return true;
      }
      return false;
    }).length;
  }

  const total = modules.reduce((s, m) => s + m.total, 0);
  const pass = modules.reduce((s, m) => s + m.pass, 0);
  const fail = modules.reduce((s, m) => s + m.fail, 0);
  const blocked = modules.reduce((s, m) => s + m.blocked, 0);
  const skipped = modules.reduce((s, m) => s + m.skipped, 0);
  const executedModulesCount = modules.filter((m) => m.total > 0 && !/chưa chạy/i.test(m.source)).length;
  const denom = pass + fail + blocked;
  const passRate = denom > 0 ? ((pass / denom) * 100).toFixed(1) + '%' : '—';
  const exitPassed = exitCriteria.filter((c) => c.status === 'PASS').length;
  const exitTotal = exitCriteria.length;
  const activeOpenBugsCount = openBugs.filter((b) => b.status !== 'CLOSED').length;
  const openBugsTotal =
    activeOpenBugsCount || defectSummary.reduce((s, d) => s + d.open, 0);

  if (!verdictBanner && exitTotal > 0) {
    verdict = exitPassed === exitTotal ? 'GO' : 'CONDITIONAL_GO';
    verdictBanner = `${verdict} — Đạt ${exitPassed}/${exitTotal} tiêu chí exit`;
  }

  const totals = {
    modulesCount: modules.length,
    executedModulesCount,
    total,
    totalExecuted: total,
    pass,
    fail,
    blocked,
    skipped,
    passRate,
    exitPassed,
    exitTotal,
    openBugsTotal,
  };

  const scopeTitle = (title.split(/—|--/)[1] || '').trim();
  const scopeMeta =
    meta['Phạm vi · Mốc'] ||
    meta['Phạm vi · Build · Môi trường'] ||
    meta['Phạm vi'] ||
    '';
  const summaryPayload = {
    verdict,
    verdictBanner,
    recommendation: verdict,
    recommendationLabel: verdictBanner,
    exitCriteria,
    modules,
    untested,
    defectSummary,
    openBugs,
    rtmMetrics,
    rtmSummary: rtmMetrics,
    totals,
  };

  return {
    kind: 'summary',
    fileName,
    title,
    module: scopeTitle || scopeMeta || String(fileName || '').replace(/\.md$/, ''),
    runId: scopeMeta || String(fileName || '').replace(/\.md$/, ''),
    build: '',
    meta,
    recommendation: verdict,
    recommendationLabel: verdictBanner,
    exitCriteria,
    modules,
    untested,
    defectSummary,
    openBugs,
    rtmMetrics,
    rtmSummary: rtmMetrics,
    totals,
    tcs: [],
    bugs: [],
    dirty: 0,
    summary: summaryPayload,
  };
}

export function parseExecutionReport(text, fileName) {
  const lines = String(text || '').split(/\r?\n/);
  const titleLine = extractFirstH1(lines);
  const isRetest = /retest/i.test(titleLine) || /retest/i.test(fileName);
  const tables = parseMarkdownTables(lines, { ignoreCodeFences: true });
  if (/ma trận truy vết|traceability|\bRTM\b/i.test(titleLine) || /traceab|rtm/i.test(fileName)) {
    return parseRtm(tables, fileName, titleLine);
  }
  if (
    /báo cáo tổng hợp kiểm thử|test summary report|test completion report/i.test(titleLine) ||
    /^test_summary/i.test(String(fileName || '')) ||
    tables.some((t) => /tiêu chí exit|exit criteria/i.test(t.heading || ''))
  ) {
    return parseTestSummary(tables, lines, fileName, titleLine);
  }

  let meta = {};
  for (const t of tables) {
    if (isKVTable(t) && !t.heading) meta = { ...kvOfTable(t), ...meta };
  }
  if (!Object.keys(meta).length) {
    const t = tables.find(isKVTable);
    if (t) meta = kvOfTable(t);
  }

  const module =
    (titleLine.split(/—|--/)[1] || '').split('·')[0].trim() ||
    meta['Module'] ||
    String(fileName || '').replace(/\.md$/, '');
  const runId =
    meta['Run ID'] ||
    meta['Retest ID'] ||
    meta['Run'] ||
    String(fileName || '').replace(/\.md$/, '');
  const build =
    meta['Build / Version'] || meta['Build'] || meta['Build lúc log bug → Build retest'] || '';

  const tcs = [];
  const byId = {};
  const add = (id, o) => {
    if (!id) return;
    if (byId[id]) {
      Object.assign(
        byId[id],
        Object.fromEntries(Object.entries(o).filter(([, v]) => v !== '' && v != null))
      );
    } else {
      byId[id] = {
        id,
        module,
        runId,
        build,
        file: fileName,
        isRetest,
        scenario: '',
        status: '',
        note: '',
        ...o,
      };
      tcs.push(byId[id]);
    }
  };

  for (const t of tables) {
    const ci = colIdx(t.header, /^TC ID$/i);
    if (ci < 0) continue;
    const cs = colIdx(t.header, /kết quả|ket qua|trạng thái/i);
    const cn = colIdx(t.header, /nguyên nhân|nguyen nhan/i);
    const cd = colIdx(t.header, /kịch bản|scenario|test title|mô tả/i);
    const cnote = colIdx(t.header, /ghi chú|ghi chu/i);
    const cstep = colIdx(t.header, /bước fail|buoc fail/i);
    const cneed = colIdx(t.header, /cần gì|can gi/i);
    const cev = colIdx(t.header, /evidence|bằng chứng|bang chung/i);
    for (const r of t.rows) {
      const id = stripMd(r[ci]);
      if (!id || /^-+$/.test(id)) continue;
      const o = {};
      if (cd >= 0) o.scenario = stripMd(r[cd]);
      if (cs >= 0) o.status = normStatus(r[cs]);
      if (cn >= 0) {
        o.blockReason = stripMd(r[cn]);
        if (!o.status) o.status = 'BLOCKED';
      }
      if (cev >= 0 && r[cev] && !PLACEHOLDER_RE.test(stripMd(r[cev]))) {
        o.evidence = cleanCell(r[cev]);
      }
      if (cnote >= 0) {
        o.note = stripMd(r[cnote]);
        if (!o.evidence && extractEvidenceImages(r[cnote] || '').items.length > 0) {
          o.evidence = cleanCell(r[cnote]);
        }
      }
      if (cstep >= 0) o.failStep = stripMd(r[cstep]);
      if (cneed >= 0) o.needToRun = stripMd(r[cneed]);
      if (/regression/i.test(t.heading)) o.isRegression = true;
      add(id, o);
    }
  }

  for (const t of tables) {
    if (!isKVTable(t) || !t.heading) continue;
    const m = t.heading.match(TCID_RE);
    if (!m) continue;
    const rawMatchedId = m[1];
    const baseMatchedId = rawMatchedId.replace(/-[a-z0-9]+$/i, '');
    const resolvedId = byId[rawMatchedId]
      ? rawMatchedId
      : byId[baseMatchedId]
        ? baseMatchedId
        : Object.keys(byId).find((k) => k.replace(/-[a-z0-9]+$/i, '') === baseMatchedId) ||
          rawMatchedId;
    const kv = kvOfTable(t);
    const existingNote = byId[resolvedId]?.note || '';
    const detailNote = kv['Ghi chú'] || '';
    let mergedNote = '';
    if (detailNote) {
      if (!existingNote || /xem chi tiết/i.test(existingNote) || detailNote.includes(existingNote)) {
        mergedNote = detailNote;
      } else if (existingNote.includes(detailNote)) {
        mergedNote = existingNote;
      } else {
        mergedNote = `${existingNote} — ${detailNote}`;
      }
    }
    add(resolvedId, {
      scenario: (t.heading.split('·')[1] || '').trim(),
      reqId: kv['REQ ID'] || '',
      priority: kv['Priority'] || '',
      expected: kv['Expected'] || kv['**Expected**'] || '',
      actual: kv['Actual'] || kv['**Actual**'] || kv['Actual lần này'] || '',
      evidence: kv['Evidence'] || kv['Bằng chứng'] || '',
      reproducible: kv['Tái hiện được?'] || '',
      suspect: kv['Nghi ngờ nguyên nhân'] || '',
      newBug: kv['Bug mới'] || '',
      failStep: kv['Bước fail'] || '',
      ...(mergedNote ? { note: mergedNote } : {}),
    });
  }

  const bugs = [];
  for (const t of tables) {
    if (!isKVTable(t)) continue;
    const kv = kvOfTable(t);
    const bugKey = kv['Bug'] || kv['Bug retest'] || '';
    if (!bugKey || !(kv['Kết quả'] || kv['**Kết quả**'])) continue;
    bugs.push({
      bug: bugKey,
      status: normStatus(kv['Kết quả'] || kv['**Kết quả**']),
      module,
      runId,
      build,
      file: fileName,
      severity: kv['Severity gốc'] || kv['Severity'] || '',
      expected: kv['Expected (theo bug gốc)'] || kv['Expected'] || '',
      actual: kv['Actual lần này'] || kv['Actual'] || '',
      repeat: kv['Số lần lặp'] || '',
      tcReq:
        kv['TC / REQ liên quan'] ||
        [kv['TC gốc'], kv['REQ ID']].filter(Boolean).join(' · ') ||
        '',
      evidence: kv['Evidence'] || kv['Bằng chứng'] || '',
    });
  }

  let dirty = 0;
  for (const t of tables) {
    const c = colIdx(t.header, /đã xoá|da xoa/i);
    if (c < 0) continue;
    for (const r of t.rows) {
      if (r[c] && !/✅|yes|có|x$/i.test(r[c])) dirty++;
    }
  }

  return {
    kind: isRetest ? 'retest' : 'run',
    fileName,
    title: titleLine,
    module,
    runId,
    build,
    isRetest,
    meta,
    tcs,
    bugs,
    dirty,
  };
}

export function extractPrimaryIds(rawText, regex) {
  const str = String(rawText || '');
  const withoutParens = str.replace(/\([^)]*\)/g, ' ');
  const primaryMatches = [...withoutParens.matchAll(regex)].map((m) => m[0]);
  if (primaryMatches.length > 0) return [...new Set(primaryMatches)];
  return [...new Set([...str.matchAll(regex)].map((m) => m[0]))];
}

export function mapRetestBugStatusToTcStatus(bugStatus) {
  const s = String(bugStatus || '').toUpperCase();
  if (s === 'FIXED' || s === 'PASS') return 'PASS';
  if (s === 'NOT_FIXED' || s === 'PARTIAL' || s === 'FAIL') return 'FAIL';
  if (s === 'CANNOT_VERIFY' || s === 'BLOCKED') return 'BLOCKED';
  return '';
}

const TC_STATUS_SEVERITY = { FAIL: 3, BLOCKED: 2, PASS: 1, SKIPPED: 0 };

export function extractDocTcStatusMap(d) {
  const map = new Map();
  for (const t of d?.tcs || []) {
    const st = String(t.status || '').toUpperCase();
    const baseId = String(t.id || '').trim().replace(/-[a-z0-9]+$/i, '');
    if (baseId && st) {
      const prev = map.get(baseId);
      if (!prev || (TC_STATUS_SEVERITY[st] ?? 0) > (TC_STATUS_SEVERITY[prev] ?? 0)) {
        map.set(baseId, st);
      }
    }
  }
  const bugTcMap = new Map();
  for (const b of d?.bugs || []) {
    const mappedSt = mapRetestBugStatusToTcStatus(b.status);
    if (!mappedSt) continue;
    for (const rawTcId of extractPrimaryIds(
      b.tcReq,
      /\b(?:[A-Z0-9]+_)*TC_\d+(?:-[a-z0-9]+)?\b/gi
    )) {
      const tcId = rawTcId.replace(/-[a-z0-9]+$/i, '');
      const prev = bugTcMap.get(tcId);
      if (!prev || (TC_STATUS_SEVERITY[mappedSt] ?? 0) > (TC_STATUS_SEVERITY[prev] ?? 0)) {
        bugTcMap.set(tcId, mappedSt);
      }
    }
  }
  for (const [tcId, mappedSt] of bugTcMap.entries()) {
    if (!map.has(tcId)) map.set(tcId, mappedSt);
  }
  return map;
}

export function compareRunOrder(a, b) {
  const numsA = [...String(a || '').matchAll(/\d+/g)].map((m) => Number(m[0]));
  const numsB = [...String(b || '').matchAll(/\d+/g)].map((m) => Number(m[0]));
  const len = Math.max(numsA.length, numsB.length);
  for (let i = 0; i < len; i++) {
    const na = numsA[i] ?? -1;
    const nb = numsB[i] ?? -1;
    if (na !== nb) return na - nb;
  }
  return 0;
}

export function computeExecutionTrend(docs) {
  const normModKey = (m) =>
    String(m || '')
      .replace(/\s*\([^)]*\)/g, '')
      .replace(/\s+\/\s+.*$/, '')
      .trim()
      .toLowerCase();
  const out = [];
  const byMod = {};
  for (const d of docs.filter((x) => x.kind !== 'rtm' && x.kind !== 'summary')) {
    const key = normModKey(d.module) || String(d.module || '');
    (byMod[key] = byMod[key] || []).push(d);
  }
  for (const modDocs of Object.values(byMod)) {
    if (modDocs.length < 2) continue;
    const ordered = [...modDocs].sort(
      (a, b) =>
        compareRunOrder(a.runId, b.runId) ||
        (a.isRetest ? 1 : 0) - (b.isRetest ? 1 : 0)
    );
    const displayMod = ordered[0].module;
    const docMaps = ordered.map((d) => ({ run: d.runId, map: extractDocTcStatusMap(d) }));
    const ids = new Set(docMaps.flatMap((dm) => [...dm.map.keys()]));
    for (const id of ids) {
      const seq = docMaps
        .map((dm) => ({
          run: dm.run,
          st: dm.map.get(id) || '',
        }))
        .filter((x) => x.st);
      if (seq.length < 2) continue;
      const prev = seq[seq.length - 2].st;
      const last = seq[seq.length - 1].st;
      let grp = '';
      if (prev === 'PASS' && last === 'FAIL') grp = 'NEW';
      else if (prev === 'FAIL' && last === 'FAIL') grp = 'RECUR';
      else if (prev === 'FAIL' && last === 'PASS') grp = 'FIXEDTREND';
      else if (prev !== 'BLOCKED' && last === 'BLOCKED') grp = 'TOBLOCKED';
      if (grp) out.push({ grp, id, module: displayMod, seq });
    }
  }
  const rank = { NEW: 0, RECUR: 1, TOBLOCKED: 2, FIXEDTREND: 3 };
  return out.sort((a, b) => rank[a.grp] - rank[b.grp] || compareTcId(a.id, b.id));
}

export function buildExecutionExportPlan(arg = {}) {
  const isDirectSummary = arg && arg.kind === 'summary';
  const {
    tab = isDirectSummary ? 'sum' : 'tc',
    tcRows = [],
    trendRows = [],
    bugRows = [],
    covAll = null,
    covRows = [],
    summaryDoc = isDirectSummary ? arg : null,
  } = arg;
  if (tab === 'sum' || isDirectSummary) {
    const rawSum = summaryDoc?.summary || summaryDoc || {};
    const exitCriteria = rawSum.exitCriteria || [];
    const modules = rawSum.modules || [];
    const untested = rawSum.untested || [];
    const openBugs = rawSum.openBugs || [];
    const rtmMetrics = rawSum.rtmMetrics || [];

    const sheets = [
      {
        name: 'Tiêu chí Exit',
        statusCol: 4,
        statusCols: [4],
        widths: [6, 44, 16, 22, 14],
        head: ['#', 'Tiêu chí', 'Ngưỡng', 'Thực tế', 'Kết quả'],
        rows: exitCriteria.map((c) => [c.index, c.criterion, c.threshold, c.actual, c.status]),
      },
      {
        name: 'Kết quả theo Module',
        widths: [18, 10, 10, 10, 12, 10, 12, 32],
        head: ['Module', 'Tổng TC', 'PASS', 'FAIL', 'BLOCKED', 'SKIPPED', 'Pass rate', 'Nguồn'],
        rows: modules.map((m) => [
          m.module,
          String(m.total),
          String(m.pass),
          String(m.fail),
          String(m.blocked),
          String(m.skipped),
          m.passRate,
          m.source,
        ]),
      },
    ];
    if (untested.length) {
      sheets.push({
        name: 'Vùng chưa kiểm thử',
        statusCol: 3,
        statusCols: [1, 3],
        widths: [20, 22, 44, 16],
        head: ['Module', 'Trạng thái', 'Nguyên nhân chưa kiểm thử', 'Mức rủi ro'],
        rows: untested.map((u) => [u.module, u.status, u.reason, u.risk]),
      });
    }
    if (openBugs.length) {
      sheets.push({
        name: 'Bug đang mở',
        statusCol: 6,
        statusCols: [3, 4, 6],
        widths: [28, 16, 42, 14, 10, 24, 16],
        head: ['Mã Bug', 'Module', 'Tiêu đề', 'Severity', 'Priority', 'TC / REQ', 'Trạng thái'],
        rows: openBugs.map((b) => [
          b.id,
          b.module,
          b.title,
          b.severity,
          b.priority,
          b.tcReq,
          b.status,
        ]),
      });
    }
    if (rtmMetrics.length) {
      sheets.push({
        name: 'Độ phủ RTM',
        widths: [42, 24],
        head: ['Chỉ số', 'Giá trị'],
        rows: rtmMetrics.map((m) => [m.metric, m.value]),
      });
    }
    return { base: 'test_summary_report', sheets };
  }

  if (tab === 'cov') {
    const R = covAll || { notAuto: [], orphans: [], guesses: [], undocumented: [] };
    const sheets = [
      {
        name: 'Tổng hợp',
        statusCol: 4,
        statusCols: [4],
        widths: [16, 34, 30, 26, 20, 11, 9, 42],
        head: [
          'REQ ID',
          'Mô tả',
          'Test case',
          'Automation',
          'Trạng thái',
          'TC đã automate',
          'Tổng TC',
          'Đề xuất',
        ],
        rows: covRows.map((r) => [
          r.req,
          r.desc,
          r.tcs.join(', '),
          r.auto,
          RTM_ST[r.status],
          String(r.nAuto),
          String(r.nTc),
          r.suggest || '',
        ]),
      },
    ];
    if (R.notAuto.length) {
      sheets.push({
        name: 'TC chưa automate',
        statusCol: 1,
        statusCols: [1],
        widths: [24, 12, 50],
        head: ['TC ID', 'Priority', 'Ghi chú'],
        rows: R.notAuto.map((i) => [i.id, i.priority, i.note]),
      });
    }
    if (R.orphans.length) {
      sheets.push({
        name: 'Orphan test',
        widths: [36, 26, 42],
        head: ['Test', 'File', 'Đề xuất'],
        rows: R.orphans.map((i) => [i.test, i.file, i.suggest]),
      });
    }
    if (R.guesses.length) {
      sheets.push({
        name: 'Mapping suy luận',
        widths: [18, 30, 48],
        head: ['REQ', 'TC / Test', 'Căn cứ suy luận'],
        rows: R.guesses.map((i) => [i.req, i.tc, i.basis]),
      });
    }
    if (R.undocumented.length) {
      sheets.push({
        name: 'Module chưa có tài liệu',
        statusCol: 1,
        statusCols: [1, 2],
        widths: [26, 20, 34],
        head: ['Module', 'Trạng thái', 'Rủi ro'],
        rows: R.undocumented.map((i) => [i.module, i.note, i.risk]),
      });
    }
    return { base: 'do_phu_automation', sheets };
  }

  if (tab === 'trend') {
    const rows = trendRows.map((r) => [
      GRP_LABEL[r.grp] || r.grp,
      r.id,
      r.module,
      r.seq.map((x) => x.st).join(' → '),
      r.seq.map((x) => x.run).join(' → '),
    ]);
    return {
      base: 'so_sanh_cac_lan_chay',
      sheets: [
        {
          name: 'Diễn biến',
          widths: [22, 22, 20, 30, 40],
          head: ['Nhóm', 'TC ID', 'Module', 'Diễn biến kết quả', 'Các lần chạy'],
          rows,
        },
      ],
    };
  }

  if (tab === 'bug') {
    const rows = bugRows.map((b) =>
      [
        b.bug,
        b.status,
        b.module,
        b.build,
        b.runId,
        b.severity,
        b.tcReq,
        b.repeat,
        b.expected,
        b.actual,
        b.file,
      ].map((v) => String(v ?? ''))
    );
    return {
      base: 'verify_bug_retest',
      sheets: [
        {
          name: 'Verify bug',
          statusCol: 1,
          statusCols: [1, 5],
          widths: [26, 16, 18, 14, 20, 14, 24, 11, 40, 40, 26],
          head: [
            'Bug',
            'Kết quả retest',
            'Module',
            'Build',
            'Lần retest',
            'Severity gốc',
            'TC / REQ liên quan',
            'Số lần lặp',
            'Expected',
            'Actual',
            'File nguồn',
          ],
          rows,
        },
      ],
    };
  }

  const head = [
    'TC ID',
    'Kịch bản',
    'Kết quả',
    'Module',
    'Lần chạy',
    'Build',
    'REQ ID',
    'Priority',
    'Bước fail',
    'Expected',
    'Actual',
    'Nguyên nhân chặn',
    'Ghi chú',
    'File nguồn',
  ];
  const keys = [
    'id',
    'scenario',
    'status',
    'module',
    'runId',
    'build',
    'reqId',
    'priority',
    'failStep',
    'expected',
    'actual',
    'blockReason',
    'note',
    'file',
  ];
  const widths = [22, 34, 13, 18, 20, 12, 16, 10, 11, 40, 40, 32, 30, 26];
  const toRow = (t) => keys.map((k) => String(t[k] ?? ''));
  const sheets = [
    { name: 'Tổng hợp', statusCol: 2, statusCols: [2, 7], widths, head, rows: tcRows.map(toRow) },
  ];
  const runs = [...new Set(tcRows.map((r) => r.runId))].filter(Boolean);
  if (runs.length > 1) {
    for (const r of runs) {
      sheets.push({
        name: r,
        statusCol: 2,
        statusCols: [2, 7],
        widths,
        head,
        rows: tcRows.filter((x) => x.runId === r).map(toRow),
      });
    }
  }
  return { base: 'execution_report', sheets };
}

/* ============================ 5. PURE BYTE-LEVEL EXPORT ENGINE ============================ */

export function formatExportTimestamp(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

export function buildCsvString(planOrHead, maybeRows) {
  const s =
    Array.isArray(planOrHead) && Array.isArray(maybeRows)
      ? { head: planOrHead, rows: maybeRows }
      : planOrHead?.sheets?.[0] || planOrHead || { head: [], rows: [] };
  const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const body = [s.head || [], ...(s.rows || [])].map((r) => r.map(q).join(',')).join('\r\n');
  return '\uFEFF' + body;
}

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[i] = c >>> 0;
  }
  return t;
})();

export function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

export function zipStoreBytes(files) {
  const enc = new TextEncoder();
  const entries = files.map((f) => {
    const data = enc.encode(f.content);
    return { data, crc: crc32(data) };
  });
  const nameBytes = files.map((f) => enc.encode(f.name));
  const localSize = entries.reduce((s, e, i) => s + 30 + nameBytes[i].length + e.data.length, 0);
  const centralSize = entries.reduce((s, _, i) => s + 46 + nameBytes[i].length, 0);

  const buf = new ArrayBuffer(localSize + centralSize + 22);
  const view = new DataView(buf);
  const out = new Uint8Array(buf);
  let off = 0;
  const offsets = [];

  entries.forEach((e, i) => {
    offsets.push(off);
    view.setUint32(off, 0x04034b50, true);
    view.setUint16(off + 4, 20, true);
    view.setUint16(off + 6, 0x0800, true);
    view.setUint16(off + 8, 0, true);
    view.setUint16(off + 10, 0, true);
    view.setUint16(off + 12, 0x2821, true);
    view.setUint32(off + 14, e.crc, true);
    view.setUint32(off + 18, e.data.length, true);
    view.setUint32(off + 22, e.data.length, true);
    view.setUint16(off + 26, nameBytes[i].length, true);
    view.setUint16(off + 28, 0, true);
    off += 30;
    out.set(nameBytes[i], off);
    off += nameBytes[i].length;
    out.set(e.data, off);
    off += e.data.length;
  });

  const centralStart = off;
  entries.forEach((e, i) => {
    view.setUint32(off, 0x02014b50, true);
    view.setUint16(off + 4, 20, true);
    view.setUint16(off + 6, 20, true);
    view.setUint16(off + 8, 0x0800, true);
    view.setUint16(off + 10, 0, true);
    view.setUint16(off + 12, 0, true);
    view.setUint16(off + 14, 0x2821, true);
    view.setUint32(off + 16, e.crc, true);
    view.setUint32(off + 20, e.data.length, true);
    view.setUint32(off + 24, e.data.length, true);
    view.setUint16(off + 28, nameBytes[i].length, true);
    view.setUint16(off + 30, 0, true);
    view.setUint16(off + 32, 0, true);
    view.setUint16(off + 34, 0, true);
    view.setUint16(off + 36, 0, true);
    view.setUint32(off + 38, 0, true);
    view.setUint32(off + 42, offsets[i], true);
    off += 46;
    out.set(nameBytes[i], off);
    off += nameBytes[i].length;
  });

  view.setUint32(off, 0x06054b50, true);
  view.setUint16(off + 8, entries.length, true);
  view.setUint16(off + 10, entries.length, true);
  view.setUint32(off + 12, centralSize, true);
  view.setUint32(off + 16, centralStart, true);

  return out;
}

export function xmlEscape(s) {
  let out = '';
  for (const ch of String(s ?? '')) {
    const code = ch.codePointAt(0);
    if (code === 9 || code === 10 || code === 13 || code >= 32) out += ch;
  }
  return out
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function colLetter(index) {
  let n = index + 1;
  let s = '';
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

export const XLSX_STATUS_STYLES = {
  PASS: 3,
  FIXED: 3,
  CLOSED: 3,
  GO: 3,
  'Đã automate': 3,
  'Đã đóng': 3,
  Đạt: 3,
  Yes: 3,
  Có: 3,
  Low: 6,
  Thấp: 6,
  P3: 6,
  P4: 6,
  No: 6,
  Không: 6,
  FAIL: 4,
  NOT_FIXED: 4,
  OPEN: 4,
  'NO-GO': 4,
  NO_GO: 4,
  Critical: 4,
  'Nghiêm trọng': 4,
  Blocker: 4,
  P0: 4,
  'Chưa có TC': 4,
  'Đang mở': 4,
  'Chưa đạt': 4,
  'Không đạt': 4,
  BLOCKED: 5,
  CANNOT_VERIFY: 5,
  PENDING: 5,
  NEEDS_REVIEW: 5,
  CONDITIONAL: 5,
  CONDITIONAL_GO: 5,
  'CONDITIONAL-GO': 5,
  'Go có điều kiện': 5,
  High: 5,
  Cao: 5,
  Major: 5,
  P1: 5,
  'Mới có TC thủ công': 5,
  'Chờ retest': 5,
  'Đã fix': 5,
  'Cần rà lại': 5,
  'Không verify được': 5,
  'Đạt có điều kiện': 5,
  SKIPPED: 6,
  'Ngoài phạm vi': 6,
  Medium: 6,
  'Trung bình': 6,
  Minor: 6,
  Trivial: 6,
  P2: 6,
  PARTIAL: 7,
  'Một phần': 7,
  'Automate một phần': 7,
};

const XLSX_STATUS_STYLE_LOWER = new Map(
  Object.entries(XLSX_STATUS_STYLES).map(([k, v]) => [k.toLowerCase(), v])
);

export function resolveXlsxStatusStyle(val) {
  const raw = String(val ?? '').trim();
  if (!raw) return undefined;
  if (XLSX_STATUS_STYLES[raw] !== undefined) return XLSX_STATUS_STYLES[raw];
  const lower = raw.toLowerCase();
  if (XLSX_STATUS_STYLE_LOWER.has(lower)) return XLSX_STATUS_STYLE_LOWER.get(lower);
  const unmd = raw.replace(/[*`~]+/g, '').trim();
  if (unmd && XLSX_STATUS_STYLE_LOWER.has(unmd.toLowerCase())) {
    return XLSX_STATUS_STYLE_LOWER.get(unmd.toLowerCase());
  }
  const stripped = unmd
    .replace(/^[^A-Za-z0-9À-ỹ]+/, '')
    .replace(/[^A-Za-z0-9À-ỹ)]+$/, '')
    .trim();
  if (stripped) {
    if (XLSX_STATUS_STYLE_LOWER.has(stripped.toLowerCase())) {
      return XLSX_STATUS_STYLE_LOWER.get(stripped.toLowerCase());
    }
    const withoutParen = stripped
      .replace(/\s*\([^)]*\)\s*$/, '')
      .replace(/[^A-Za-z0-9À-ỹ]+$/, '')
      .trim();
    if (withoutParen && XLSX_STATUS_STYLE_LOWER.has(withoutParen.toLowerCase())) {
      return XLSX_STATUS_STYLE_LOWER.get(withoutParen.toLowerCase());
    }
  }
  return undefined;
}

export const STYLES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="7"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FF166534"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FF991B1B"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FF92400E"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FF475569"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FF5B21B6"/><name val="Calibri"/></font></fonts><fills count="8"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF2F7A29"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFDCFCE7"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFEE2E2"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFEF3C7"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF1F5F9"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFEDE9FE"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="8"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf><xf numFmtId="0" fontId="2" fillId="3" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="top" horizontal="center" wrapText="1"/></xf><xf numFmtId="0" fontId="3" fillId="4" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="top" horizontal="center" wrapText="1"/></xf><xf numFmtId="0" fontId="4" fillId="5" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="top" horizontal="center" wrapText="1"/></xf><xf numFmtId="0" fontId="5" fillId="6" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="top" horizontal="center" wrapText="1"/></xf><xf numFmtId="0" fontId="6" fillId="7" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="top" horizontal="center" wrapText="1"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;

export function buildSheetXml(sh) {
  const all = [sh.head, ...sh.rows];
  const last = colLetter(sh.head.length - 1);
  const statusColSet = new Set([
    ...(typeof sh.statusCol === 'number' ? [sh.statusCol] : []),
    ...(Array.isArray(sh.statusCols) ? sh.statusCols : []),
  ]);
  const body = all
    .map((cells, r) => {
      const n = r + 1;
      const td = cells
        .map((val, c) => {
          const v = String(val ?? '');
          let s = r === 0 ? 1 : 2;
          if (r > 0 && statusColSet.has(c)) {
            const mappedStyle = resolveXlsxStatusStyle(v);
            if (mappedStyle !== undefined) s = mappedStyle;
          }
          return v === ''
            ? `<c r="${colLetter(c)}${n}" s="${s}"/>`
            : `<c r="${colLetter(c)}${n}" s="${s}" t="inlineStr"><is><t xml:space="preserve">${xmlEscape(v)}</t></is></c>`;
        })
        .join('');
      return `<row r="${n}"${r === 0 ? ' ht="22" customHeight="1"' : ''}>${td}</row>`;
    })
    .join('');
  const cols = (sh.widths || sh.head.map(() => 24))
    .map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`)
    .join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="15"/><cols>${cols}</cols><sheetData>${body}</sheetData><autoFilter ref="A1:${last}${all.length}"/></worksheet>`;
}

export function safeSheetName(raw, taken = new Set()) {
  let n =
    String(raw || 'Sheet')
      .replace(/^Nhóm\s+/i, '')
      .replace(/[:\\/?*[\]\x00-\x1f]/g, '-')
      .replace(/^[\s']+|[\s']+$/g, '') || 'Sheet';
  if (/^history$/i.test(n)) n = 'History_Sheet';
  if (n.length > 31) n = (n.slice(0, 30).replace(/[\s']+$/g, '') || 'Sheet') + '…';
  let c = n;
  let i = 2;
  while (taken.has(c.toLowerCase())) {
    const sfx = ` (${i++})`;
    c = (n.slice(0, 31 - sfx.length).replace(/[\s']+$/g, '') || 'Sheet') + sfx;
  }
  taken.add(c.toLowerCase());
  return c;
}

export function buildXlsxFiles(planOrSheets) {
  const rawSheets = Array.isArray(planOrSheets) ? planOrSheets : planOrSheets?.sheets || [];
  const taken = new Set();
  const sheets = rawSheets.map((s) => ({ ...s, name: safeSheetName(s.name, taken) }));
  const ov = sheets
    .map(
      (_, i) =>
        `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`
    )
    .join('');
  return [
    {
      name: '[Content_Types].xml',
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${ov}</Types>`,
    },
    {
      name: '_rels/.rels',
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    },
    {
      name: 'xl/workbook.xml',
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets
        .map((s, i) => `<sheet name="${xmlEscape(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`)
        .join('')}</sheets></workbook>`,
    },
    {
      name: 'xl/_rels/workbook.xml.rels',
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets
        .map(
          (_, i) =>
            `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`
        )
        .join('')}<Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
    },
    { name: 'xl/styles.xml', content: STYLES_XML },
    ...sheets.map((s, i) => ({
      name: `xl/worksheets/sheet${i + 1}.xml`,
      content: buildSheetXml(s),
    })),
  ];
}

export function buildXlsxBytes(plan) {
  return zipStoreBytes(buildXlsxFiles(plan));
}

export const EVIDENCE_IMG_RE = /\.(png|jpe?g|gif|webp|svg)$/i;

export function evidenceBaseName(p) {
  return String(p || '')
    .split(/[\\/]/)
    .pop()
    .trim();
}

export function extractEvidenceImages(raw, imagesMap) {
  const txt = String(raw || '');
  const hasImg = (name) => {
    const key = evidenceBaseName(name).toLowerCase();
    if (!key || !imagesMap) return false;
    if (typeof imagesMap.has === 'function') return imagesMap.has(key);
    if (Array.isArray(imagesMap)) return imagesMap.some((x) => String(x).toLowerCase() === key);
    return Boolean(imagesMap[key]);
  };
  const found = [];
  const rest = txt
    .replace(/!?\[[^\]]*\]\(([^)]+)\)/gi, (m, a) => {
      const p = String(a || '')
        .trim()
        .split(/\s+["']/)[0]
        .trim()
        .replace(/^<|>$/g, '')
        .trim();
      if (p && EVIDENCE_IMG_RE.test(p)) found.push(p);
      return ' ';
    })
    .replace(/<img\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi, (m, a) => {
      const p = String(a || '').trim();
      if (p && EVIDENCE_IMG_RE.test(p)) found.push(p);
      return ' ';
    });
  for (const tok of rest.split(/[\s,;|]+/)) {
    const hadBacktick = tok.includes('`');
    const t = tok.trim().replace(/^[('"<`]+|[)'">`.,;]+$/g, '');
    if (
      t &&
      EVIDENCE_IMG_RE.test(t) &&
      (hasImg(t) || hadBacktick || /[\\/]/.test(t))
    ) {
      found.push(t);
    }
  }
  const uniq = [...new Set(found)];
  const items = uniq.map((path) => {
    const baseName = evidenceBaseName(path);
    const loaded = hasImg(baseName);
    return { path, baseName, loaded };
  });
  const missingCount = items.filter((i) => !i.loaded).length;
  return { items, missingCount };
}

export function escapeHtml(s) {
  return String(s ?? '').replace(
    /[&<>"]/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]
  );
}

export function renderEvidenceHtml(raw, imagesMap, mode = 'execution') {
  const txt = String(raw || '');
  const { items, missingCount } = extractEvidenceImages(txt, imagesMap);
  if (!items.length) {
    const fallback = mode === 'bugs' ? escapeHtml(txt) || '—' : escapeHtml(txt);
    return `<span class="v">${fallback}</span>`;
  }
  const chips = items
    .map(({ baseName, loaded }) =>
      loaded
        ? `<button type="button" class="ev-chip" data-img="${escapeHtml(baseName)}" title="Bấm để xem ảnh">🖼 ${escapeHtml(baseName)}</button>`
        : `<span class="ev-chip miss" title="Chưa nạp ảnh này vào viewer">🖼 ${escapeHtml(baseName)}</span>`
    )
    .join('');
  const hint = missingCount
    ? mode === 'bugs'
      ? `<span class="ev-hint">Bug không có thư mục ảnh riêng — ảnh nằm ở <code>docs/executions/&lt;module&gt;/run_*/evidence/</code> của (các) lần chạy được link tới ở trên. Kéo thả thư mục <code>evidence/</code> đó (hoặc chính các file ảnh, khớp theo tên file nên kéo nhiều thư mục cùng lúc vẫn được) vào trang để xem được ${missingCount} ảnh còn thiếu.</span>`
      : `<span class="ev-hint">Kéo thả thư mục <code>evidence/</code> (hoặc chính các file ảnh) vào trang để xem được ${missingCount} ảnh còn thiếu.</span>`
    : '';
  return `<span class="v">${chips}${hint}</span>`;
}
