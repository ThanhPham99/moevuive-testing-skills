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
    ? new RegExp(`\\[?\\b(${prefix}-\\d+)\\b\\]?`)
    : /\[?\b([A-Z][A-Z0-9_]+-\d+)\b\]?/;
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
        const testEntry = (spec.tests || [])[0] || {};
        const lastResult =
          (testEntry.results || [])[(testEntry.results || []).length - 1] || {};
        const rawStatus = lastResult.status || spec.status || 'skipped';
        const errorMsg = lastResult.error?.message || '';
        const testKey = extractTestKey(title, projectKey);

        if (!testKey) {
          unmappedTests.push({ title, status: rawStatus });
          continue;
        }

        const xrayStatus = mapStatusToXray(rawStatus, platform);
        testsByKey.set(testKey, {
          testKey,
          status: xrayStatus,
          comment: errorMsg ? `Failure: ${errorMsg}` : `Executed: ${title}`,
        });
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
    const nameMatch = attrs.match(/\bname\s*=\s*"([^"]*)"/i) || attrs.match(/\bname\s*=\s*'([^']*)'/i);
    const title = nameMatch ? nameMatch[1] : '';

    let rawStatus = 'passed';
    let comment = `Executed: ${title}`;
    const failMatch = inner.match(/<(?:failure|error)\b([^>]*)>([\s\S]*?)<\/(?:failure|error)>/i);
    const selfClosingFail = inner.match(/<(?:failure|error)\b([^>]*)\/>/i);
    const skipMatch = /<skipped\b/i.test(inner);

    if (failMatch || selfClosingFail) {
      rawStatus = 'failed';
      const attrStr = (failMatch || selfClosingFail)[1] || '';
      const msgAttr = attrStr.match(/\bmessage\s*=\s*"([^"]*)"/i);
      const bodyText = failMatch ? failMatch[2].trim() : '';
      comment = `Failure: ${msgAttr ? msgAttr[1] : bodyText || 'Test failed'}`;
    } else if (skipMatch) {
      rawStatus = 'skipped';
    }

    const testKey = extractTestKey(title, projectKey);
    if (!testKey) {
      unmappedTests.push({ title, status: rawStatus });
      continue;
    }

    testsByKey.set(testKey, {
      testKey,
      status: mapStatusToXray(rawStatus, platform),
      comment,
    });
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
