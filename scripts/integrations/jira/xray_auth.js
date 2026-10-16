#!/usr/bin/env node
/**
 * Zero-Dependency Xray Authentication Module (`scripts/integrations/jira/xray_auth.js`)
 *
 * Supports:
 *   - Xray Cloud (`XRAY_PLATFORM=cloud` default): POSTs `XRAY_CLIENT_ID` + `XRAY_CLIENT_SECRET`
 *     to `https://xray.cloud.getxray.app/api/v2/authenticate` to obtain a Bearer JWT.
 *   - Xray Server / Data Center (`XRAY_PLATFORM=server`): Uses Jira PAT or Basic Auth headers
 *     against `${JIRA_BASE_URL}/rest/raven/2.0/api` and verifies connectivity via `/rest/api/2/myself`.
 *
 * Usage:
 *   node scripts/integrations/jira/xray_auth.js --verify
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildJiraAuthHeaders, loadEnv } from './utils.js';

const __filename = fileURLToPath(import.meta.url);

export const XRAY_CLOUD_BASE_URL = 'https://xray.cloud.getxray.app/api/v2';

/**
 * Authenticates against Xray Cloud or Xray Server/DC and returns connection headers & baseUrl.
 */
export async function authenticateXray({
  env = loadEnv(),
  fetchImpl = globalThis.fetch,
  verifyServer = true,
} = {}) {
  const platform = String(env.XRAY_PLATFORM || 'cloud')
    .trim()
    .toLowerCase();

  if (platform === 'server' || platform === 'datacenter' || platform === 'dc') {
    const jiraAuth = buildJiraAuthHeaders(env);
    if (verifyServer) {
      const res = await fetchImpl(`${jiraAuth.baseUrl}/rest/api/2/myself`, {
        method: 'GET',
        headers: jiraAuth.headers,
      });
      if (!res.ok) {
        throw new Error(`Xray Server/DC verification failed with HTTP ${res.status}`);
      }
    }
    return {
      platform: 'server',
      token: null,
      baseUrl: `${jiraAuth.baseUrl}/rest/raven/2.0/api`,
      headers: jiraAuth.headers,
    };
  }

  const clientId = String(env.XRAY_CLIENT_ID || '').trim();
  const clientSecret = String(env.XRAY_CLIENT_SECRET || '').trim();
  if (!clientId || !clientSecret) {
    throw new Error(
      'Missing XRAY_CLIENT_ID or XRAY_CLIENT_SECRET in .env for Xray Cloud authentication.'
    );
  }

  const res = await fetchImpl(`${XRAY_CLOUD_BASE_URL}/authenticate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret }),
  });

  if (!res.ok) {
    throw new Error(`Xray Cloud authentication failed with HTTP ${res.status}`);
  }

  const rawText = typeof res.text === 'function' ? await res.text() : JSON.stringify(await res.json());
  const token = String(rawText || '')
    .trim()
    .replace(/^"+|"+$/g, '');

  return {
    platform: 'cloud',
    token,
    baseUrl: XRAY_CLOUD_BASE_URL,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    console.log('Usage: node scripts/integrations/jira/xray_auth.js [--verify]');
    process.exit(0);
  }
  authenticateXray({ verifyServer: true })
    .then((auth) => {
      console.log(
        `Xray Authentication PASSED [platform=${auth.platform.toUpperCase()}, endpoint=${auth.baseUrl}].`
      );
    })
    .catch((err) => {
      console.error(`Xray Authentication FAILED: ${err.message}`);
      process.exit(1);
    });
}
