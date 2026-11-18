import { readFile } from 'node:fs/promises';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const base = process.env.GITEA_BASE_URL || 'http://gitea:3000';
const tokenFile = process.env.GITEA_TOKEN_FILE || '/run/secrets/gitea_token';
const fixedRepo = '/api/v1/repos/operator/ops/issues';
const server = new McpServer({ name: 'gitea-issues-readonly', version: '1.0.0' });

function safeIssue(issue) {
  if (issue?.pull_request) throw new Error('NOT_FOUND');
  if (!Number.isInteger(issue?.number) || typeof issue.title !== 'string' || !['open', 'closed'].includes(issue.state) || !Array.isArray(issue.labels)) throw new Error('INVALID_SOURCE_RESPONSE');
  return { number: issue.number, title: issue.title, state: issue.state, labels: issue.labels.map(label => label.name).filter(name => typeof name === 'string') };
}
async function readIssue(path) {
  let token;
  try { token = (await readFile(tokenFile, 'utf8')).trim(); } catch { throw new Error('CREDENTIAL_UNAVAILABLE'); }
  if (!token) throw new Error('CREDENTIAL_UNAVAILABLE');
  let response;
  try { response = await fetch(base + path, { headers: { Authorization: `token ${token}`, Accept: 'application/json' }, redirect: 'error', signal: AbortSignal.timeout(5000) }); }
  catch { throw new Error('SOURCE_UNAVAILABLE'); }
  if (response.status === 404) throw new Error('NOT_FOUND');
  if (response.status === 401 || response.status === 403) throw new Error('ACCESS_DENIED');
  if (!response.ok) throw new Error('SOURCE_ERROR');
  try { return await response.json(); } catch { throw new Error('INVALID_SOURCE_RESPONSE'); }
}
function result(data) { return { content: [{ type: 'text', text: JSON.stringify({ ok: true, data }) }] }; }
function failure(error) {
  const code = ['CREDENTIAL_UNAVAILABLE','SOURCE_UNAVAILABLE','NOT_FOUND','ACCESS_DENIED','SOURCE_ERROR','INVALID_SOURCE_RESPONSE'].includes(error.message) ? error.message : 'SOURCE_ERROR';
  return { isError: true, content: [{ type: 'text', text: JSON.stringify({ ok: false, error: code }) }] };
}
server.registerTool('list_issues', {
  description: 'Lista zgłoszeń repozytorium operator/ops. Zwraca numer, tytuł, stan i etykiety.',
  inputSchema: z.strictObject({ state: z.enum(['open', 'closed']).default('open'), limit: z.number().int().min(1).max(10).default(5) }),
  annotations: { readOnlyHint: true, destructiveHint: false }
}, async ({ state, limit }) => {
  try {
    const data = await readIssue(`${fixedRepo}?state=${state}&limit=${limit}&page=1`);
    if (!Array.isArray(data)) throw new Error('INVALID_SOURCE_RESPONSE');
    return result(data.filter(issue => !issue.pull_request).map(safeIssue));
  } catch (error) { return failure(error); }
});
server.registerTool('get_issue', {
  description: 'Zgłoszenie o podanym numerze w operator/ops. Zwraca numer, tytuł, stan i etykiety.',
  inputSchema: z.strictObject({ number: z.number().int().min(1).max(1000000) }),
  annotations: { readOnlyHint: true, destructiveHint: false }
}, async ({ number }) => {
  try { return result(safeIssue(await readIssue(`${fixedRepo}/${number}`))); }
  catch (error) { return failure(error); }
});
await server.connect(new StdioServerTransport());
