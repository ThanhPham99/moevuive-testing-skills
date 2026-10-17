#!/usr/bin/env node
/**
 * Zero-Dependency Xray Test Execution Importer (`scripts/integrations/jira/xray_importer.js`)
 *
 * Converts Playwright JSON reports, JUnit XML reports, or native Xray JSON payloads
 * and imports them into Jira Xray (Cloud or Server/Data Center).
 *
 * Usage:
 *   node scripts/integrations/jira/xray_importer.js --format playwright --file reports/test-results/results.json [--project PROJ] [--testExecKey PROJ-900]
 *   node scripts/integrations/jira/xray_importer.js --format junit --file reports/junit-results.xml [--project PROJ]
 *   node scripts/integrations/jira/xray_importer.js --format xray --file reports/xray-payload.json
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEnv, parseCliArgs } from './utils.js';
import { authenticateXray } from './xray_auth.js';

const __filename = fileURLToPath(import.meta.url);

/**
 * Extracts a Jira Test Issue Key (e.g., `PROJ-123` from `[PROJ-123] Login success`) from a test title.
 */
export function extractTestKey(title, projectKey = '') {
  const cleanTitle = String(title || '');
  const prefix = String(projectKey || '').trim().toUpperCase();
  const pattern = prefix
    ? new RegExp(`\\[?(?<![A-Z0-9])(${prefix}-\\d+)(?![A-Z0-9])\\]?`)
    : /\[?(?<![A-Z0-9])([A-Z][A-Z0-9_]+-\d+)(?![A-Z0-9])\]?/;
  const match = cleanTitle.match(pattern);
  return match ? match[1] : null;
}

/**
 * Maps runner test statuses (`passed`, `failed`, `skipped`, `timedOut`) to Xray Cloud or Server status codes.
 */
export function mapStatusToXray(rawStatus, platform = 'cloud') {
  const isServer = String(platform || 'cloud').toLowerCase() === 'server';
  const norm = String(rawStatus || '').trim().toLowerCase();
  if (norm === 'passed' || norm === 'pass') {
    return isServer ? 'PASS' : 'PASSED';
  }
  if (norm === 'failed' || norm === 'fail' || norm === 'timedout' || norm === 'error') {
    return isServer ? 'FAIL' : 'FAILED';
  }
  return 'TODO';
}

function summarizeTests(tests, platform = 'cloud') {
  const passCode = String(platform).toLowerCase() === 'server' ? 'PASS' : 'PASSED';
  const failCode = String(platform).toLowerCase() === 'server' ? 'FAIL' : 'FAILED';
  let passed = 0;
  let failed = 0;
  let todo = 0;
  for (const t of tests) {
    if (t.status === passCode) passed += 1;
    else if (t.status === failCode) failed += 1;
    else todo += 1;
  }
  return {
    total: tests.length,
    passed,
    failed,
    todo,
  };
}

function buildXrayExecutionResult(
  testsByKey,
  unmappedTests,
  runnerLabel,
  { projectKey = '', testExecKey = '', platform = 'cloud' } = {}
) {
  const tests = [...testsByKey.values()];
  const payload = {
    ...(testExecKey ? { testExecutionKey: testExecKey } : {}),
    info: {
      summary: `Automated ${runnerLabel} Execution${projectKey ? ` (${projectKey})` : ''}`,
      description: 'Imported via zero-dependency Xray Importer',
      ...(projectKey ? { project: projectKey } : {}),
    },
    tests,
  };
  return {
    payload,
    unmappedTests,
    stats: summarizeTests(tests, platform),
  };
}

const XRAY_STATUS_RANK = {
  FAILED: 3,
  FAIL: 3,
  PASSED: 2,
  PASS: 2,
  TODO: 1,
};

function upsertTestResult(testsByKey, testKey, status, comment) {
  const prev = testsByKey.get(testKey);
  if (!prev) {
    testsByKey.set(testKey, { testKey, status, comment });
    return;
  }
  const prevRank = XRAY_STATUS_RANK[prev.status] || 0;
  const nextRank = XRAY_STATUS_RANK[status] || 0;
  if (nextRank >= prevRank) {
    testsByKey.set(testKey, {
      testKey,
      status,
      comment: nextRank > prevRank || comment.startsWith('Failure:') ? comment : prev.comment,
    });
  }
}

/**
 * Converts a Playwright JSON report object into an Xray JSON execution payload.
 */
export function convertPlaywrightToXray(
  pwReport = {},
  { projectKey = '', testExecKey = '', platform = 'cloud' } = {}
) {
  const testsByKey = new Map();
  const unmappedTests = [];

  function walkSuites(suites = []) {
    for (const suite of suites) {
      for (const spec of suite.specs || []) {
        const title = spec.title || '';
        const testEntries =
          Array.isArray(spec.tests) && spec.tests.length > 0 ? spec.tests : [{}];
        for (const testEntry of testEntries) {
          const results = Array.isArray(testEntry.results) ? testEntry.results : [];
          const lastResult = results[results.length - 1] || {};
          const rawStatus =
            lastResult.status || testEntry.status || spec.status || 'skipped';
          const errorMsg =
            lastResult.error?.message ||
            (Array.isArray(lastResult.errors) && lastResult.errors[0]?.message) ||
            '';
          const allAnnotations = [
            ...(spec.annotations || []),
            ...(testEntry.annotations || []),
            ...(lastResult.annotations || []),
          ];
          const annotationText = allAnnotations
            .map((a) => `${a.type || ''} ${a.description || ''}`)
            .join(' ');
          const testKey =
            extractTestKey(title, projectKey) || extractTestKey(annotationText, projectKey);

          if (!testKey) {
            unmappedTests.push({ title, status: rawStatus });
            continue;
          }

          const xrayStatus = mapStatusToXray(rawStatus, platform);
          upsertTestResult(
            testsByKey,
            testKey,
            xrayStatus,
            errorMsg ? `Failure: ${errorMsg}` : `Executed: ${title}`
          );
        }
      }
      if (Array.isArray(suite.suites)) {
        walkSuites(suite.suites);
      }
    }
  }

  walkSuites(pwReport.suites || []);

  return buildXrayExecutionResult(testsByKey, unmappedTests, 'Playwright', {
    projectKey,
    testExecKey,
    platform,
  });
}

const XML_ENTITY_MAP = {
  quot: '"',
  apos: "'",
  lt: '<',
  gt: '>',
  amp: '&',
};

function decodeXmlEntities(str) {
  return String(str || '').replace(
    /&(?:#(\d+)|#x([0-9a-f]+)|(quot|apos|lt|gt|amp));/gi,
    (full, dec, hex, named) => {
      if (named) return XML_ENTITY_MAP[named.toLowerCase()] ?? full;
      const cp = dec !== undefined ? Number(dec) : parseInt(hex, 16);
      return Number.isInteger(cp) && cp >= 0 && cp <= 0x10ffff
        ? String.fromCodePoint(cp)
        : full;
    }
  );
}

function extractXmlElementText(rawInner) {
  const trimmed = String(rawInner || '').trim();
  if (!trimmed) return '';
  const cdataMatch = trimmed.match(/^<!\[CDATA\[([\s\S]*?)\]\]>$/i);
  if (cdataMatch) {
    return cdataMatch[1].trim();
  }
  if (/<!\[CDATA\[/i.test(trimmed)) {
    return trimmed.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, (_, cdata) => cdata).trim();
  }
  return decodeXmlEntities(trimmed);
}

/**
 * Converts JUnit XML report content into an Xray JSON execution payload.
 */
export function convertJunitXmlToXray(
  xmlContent = '',
  { projectKey = '', testExecKey = '', platform = 'cloud' } = {}
) {
  const testsByKey = new Map();
  const unmappedTests = [];
  const testcaseRegex = /<testcase\b([^>]*?)(?:\/>|>([\s\S]*?)<\/testcase>)/gi;

  for (const match of String(xmlContent || '').matchAll(testcaseRegex)) {
    const attrs = match[1] || '';
    const inner = match[2] || '';
    const nameMatch =
      attrs.match(/\bname\s*=\s*"([^"]*)"/i) || attrs.match(/\bname\s*=\s*'([^']*)'/i);
    const classMatch =
      attrs.match(/\bclassname\s*=\s*"([^"]*)"/i) || attrs.match(/\bclassname\s*=\s*'([^']*)'/i);
    const title = nameMatch ? decodeXmlEntities(nameMatch[1]) : '';
    const className = classMatch ? decodeXmlEntities(classMatch[1]) : '';

    let rawStatus = 'passed';
    let comment = `Executed: ${title}`;
    const failMatch = inner.match(/<(?:failure|error)\b([^>]*)>([\s\S]*?)<\/(?:failure|error)>/i);
    const selfClosingFail = inner.match(/<(?:failure|error)\b([^>]*)\/>/i);
    const skipTagMatch =
      inner.match(/<skipped\b([^>]*)>([\s\S]*?)<\/skipped>/i) ||
      inner.match(/<skipped\b([^>]*)\/>/i);

    if (failMatch || selfClosingFail) {
      rawStatus = 'failed';
      const attrStr = (failMatch || selfClosingFail)[1] || '';
      const msgAttr =
        attrStr.match(/\bmessage\s*=\s*"([^"]*)"/i) ||
        attrStr.match(/\bmessage\s*=\s*'([^']*)'/i);
      const bodyText = failMatch ? extractXmlElementText(failMatch[2]) : '';
      const msgText = msgAttr ? decodeXmlEntities(msgAttr[1]) : '';
      const combinedFail =
        msgText && bodyText && bodyText !== msgText
          ? `${msgText} — ${bodyText}`
          : msgText || bodyText || 'Test failed';
      comment = `Failure: ${combinedFail}`;
    } else if (skipTagMatch) {
      rawStatus = 'skipped';
      const skipAttr = skipTagMatch[1] || '';
      const skipMsgAttr =
        skipAttr.match(/\bmessage\s*=\s*"([^"]*)"/i) ||
        skipAttr.match(/\bmessage\s*=\s*'([^']*)'/i);
      const skipBody = skipTagMatch[2] ? extractXmlElementText(skipTagMatch[2]) : '';
      const skipMsg = skipMsgAttr ? decodeXmlEntities(skipMsgAttr[1]) : skipBody;
      if (skipMsg) {
        comment = `Skipped: ${skipMsg}`;
      }
    }

    const propMatch =
      inner.match(/<property\b[^>]*\bname\s*=\s*["']test_key["'][^>]*\bvalue\s*=\s*["']([^"']+)["']/i) ||
      inner.match(/<property\b[^>]*\bvalue\s*=\s*["']([^"']+)["'][^>]*\bname\s*=\s*["']test_key["']/i);
    const testKey =
      extractTestKey(title, projectKey) ||
      (propMatch ? extractTestKey(propMatch[1], projectKey) : null) ||
      extractTestKey(className, projectKey);
    if (!testKey) {
      unmappedTests.push({ title, status: rawStatus });
      continue;
    }

    upsertTestResult(testsByKey, testKey, mapStatusToXray(rawStatus, platform), comment);
  }

  return buildXrayExecutionResult(testsByKey, unmappedTests, 'JUnit', {
    projectKey,
    testExecKey,
    platform,
  });
}

/**
 * Authenticates and imports a Playwright, JUnit XML, or native Xray JSON report into Xray.
 */
export async function importToXray({
  format = 'playwright',
  filePath,
  projectKey = '',
  testExecKey = '',
  env = loadEnv(),
  fetchImpl = globalThis.fetch,
} = {}) {
  if (!filePath || !fs.existsSync(filePath)) {
    throw new Error(`Report file not found: ${filePath}`);
  }

  const auth = await authenticateXray({ env, fetchImpl });
  const rawContent = fs.readFileSync(filePath, 'utf8');
  const resolvedProject = projectKey || env.JIRA_PROJECT_KEY || '';
  const fmt = String(format || 'playwright').trim().toLowerCase();

  let payload;
  let unmappedTests = [];
  let stats = { total: 0, passed: 0, failed: 0, todo: 0 };

  if (fmt === 'playwright') {
    const converted = convertPlaywrightToXray(JSON.parse(rawContent), {
      projectKey: resolvedProject,
      testExecKey,
      platform: auth.platform,
    });
    payload = converted.payload;
    unmappedTests = converted.unmappedTests;
    stats = converted.stats;
  } else if (fmt === 'junit') {
    const converted = convertJunitXmlToXray(rawContent, {
      projectKey: resolvedProject,
      testExecKey,
      platform: auth.platform,
    });
    payload = converted.payload;
    unmappedTests = converted.unmappedTests;
    stats = converted.stats;
  } else if (fmt === 'xray') {
    payload = JSON.parse(rawContent);
    if (testExecKey && !payload.testExecutionKey) {
      payload.testExecutionKey = testExecKey;
    }
    stats = summarizeTests(payload.tests || [], auth.platform);
  } else {
    throw new Error(`Unsupported report format "${format}". Expected playwright, junit, or xray.`);
  }

  const res = await fetchImpl(`${auth.baseUrl}/import/execution`, {
    method: 'POST',
    headers: auth.headers,
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error(`Xray import failed with HTTP ${res.status}`);
  }

  const responseData = await res.json();
  const resolvedExecKey =
    responseData.key || responseData.testExecIssue?.key || testExecKey || 'UNKNOWN';

  return {
    testExecKey: resolvedExecKey,
    stats,
    unmappedTests,
    response: responseData,
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  const args = parseCliArgs(process.argv.slice(2));
  if (args.help || args.h) {
    console.log(
      'Usage: node scripts/integrations/jira/xray_importer.js --format playwright|junit|xray --file <report_path> [--project <KEY>] [--testExecKey <KEY>]'
    );
    process.exit(0);
  }
  importToXray({
    format: args.format || 'playwright',
    filePath: args.file,
    projectKey: args.project || '',
    testExecKey: args.testExecKey || '',
  })
    .then((res) => {
      console.log(
        `Xray Import PASSED -> Test Execution: ${res.testExecKey} (Total: ${res.stats.total}, Passed: ${res.stats.passed}, Failed: ${res.stats.failed}, Todo: ${res.stats.todo}, Unmapped: ${res.stats.unmapped ?? res.unmappedTests.length})`
      );
    })
    .catch((err) => {
      console.error(`Xray Import FAILED: ${err.message}`);
      process.exit(1);
    });
}
