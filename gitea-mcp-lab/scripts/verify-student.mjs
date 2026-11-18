import { access, readFile } from 'node:fs/promises';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const file = process.argv[2] || 'src/my-server.mjs';
const assert = (condition, message) => { if (!condition) throw new Error(message); };
await access(file).catch(() => { throw new Error('Brakuje pliku serwera. Utwórz src/my-server.mjs zgodnie z API.md.'); });
const env = { PATH: process.env.PATH, HOME: process.env.HOME, GITEA_BASE_URL: process.env.GITEA_BASE_URL || 'http://gitea:3000', GITEA_TOKEN_FILE: process.env.GITEA_TOKEN_FILE || '/run/secrets/gitea_token' };
async function connect(overrides = {}) {
  const client = new Client({ name: 'gitea-lab-verifier', version: '1.0.0' });
  const transport = new StdioClientTransport({ command: 'node', args: [file], env: { ...env, ...overrides }, stderr: 'pipe' });
  await client.connect(transport);
  return client;
}
function parsed(result) {
  assert(result?.content?.[0]?.type === 'text', 'Narzędzie nie zwróciło tekstowego JSON.');
  try { return JSON.parse(result.content[0].text); } catch { throw new Error('Narzędzie nie zwróciło prawidłowego JSON.'); }
}
function exactFields(issue) {
  assert(issue && Object.keys(issue).sort().join(',') === 'labels,number,state,title', 'Zgłoszenie zawiera nieprawidłowy zestaw pól.');
  assert(Number.isInteger(issue.number) && typeof issue.title === 'string' && ['open','closed'].includes(issue.state), 'Nieprawidłowe pola zgłoszenia.');
  assert(Array.isArray(issue.labels) && issue.labels.every(x => typeof x === 'string'), 'Etykiety muszą być tablicą nazw.');
}
async function rejected(client, name, args) {
  try { const res = await client.callTool({ name, arguments: args }); return res.isError === true; } catch { return true; }
}
const token = (await readFile(env.GITEA_TOKEN_FILE, 'utf8')).trim();
assert(token.length > 0, 'Brak tokena konta reader.');
const api = async (method, path, body) => fetch(env.GITEA_BASE_URL+'/api/v1/repos/operator/'+path, { method, headers: { Authorization: `token ${token}`, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
const statuses = [
  ['GET','ops/issues?state=open&limit=5',200], ['GET','ops',403], ['GET','restricted/issues',404],
  ['POST','ops/issues',403,{}], ['DELETE','ops/issues/999999',403]
];
for (const [method,path,expected,body] of statuses) assert((await api(method,path,body)).status === expected, `Gitea ${method} ${path}: nieoczekiwany status.`);
const sourceList = await (await api('GET', 'ops/issues?state=open&limit=2&page=1')).json();
const sourceIssue = await (await api('GET', 'ops/issues/1')).json();
const selected = item => ({ number: item.number, title: item.title, state: item.state, labels: item.labels.map(label => typeof label === 'string' ? label : label.name) });
const expectedList = sourceList.filter(item => !item.pull_request).map(selected);
const client = await connect();
try {
  const names = (await client.listTools()).tools.map(x => x.name).sort();
  assert(JSON.stringify(names) === JSON.stringify(['get_issue','list_issues']), 'Serwer ma udostępniać dokładnie list_issues i get_issue.');
  const listResult = await client.callTool({ name:'list_issues', arguments:{state:'open',limit:2} });
  assert(!listResult.isError, 'Nie udało się odczytać zgłoszeń przez MCP.');
  const list = parsed(listResult);
  assert(list.ok === true && Array.isArray(list.data) && list.data.length > 0 && list.data.length <= 2, 'Nieprawidłowa lista zgłoszeń.');
  list.data.forEach(exactFields);
  assert(JSON.stringify(list.data.map(selected)) === JSON.stringify(expectedList), 'Lista MCP nie odpowiada bieżącym danym Gitea.');
  const issueResult = await client.callTool({ name:'get_issue', arguments:{number:1} });
  assert(!issueResult.isError, 'Nie udało się odczytać zgłoszenia 1.');
  const issue = parsed(issueResult);
  assert(issue.ok === true && issue.data?.number === 1, 'Nieprawidłowe zgłoszenie 1.'); exactFields(issue.data);
  assert(JSON.stringify(selected(issue.data)) === JSON.stringify(selected(sourceIssue)), 'Zgłoszenie MCP nie odpowiada bieżącym danym Gitea.');
  assert(await rejected(client,'get_issue',{number:1,repo:'restricted'}), 'Dodatkowy argument repo został zaakceptowany.');
  assert(await rejected(client,'list_issues',{state:'open',limit:11}), 'Limit 11 został zaakceptowany.');
  assert(await rejected(client,'get_issue',{number:0}), 'Numer 0 został zaakceptowany.');
  assert(await rejected(client,'delete_issue',{number:1}), 'Nieoczekiwane narzędzie usuwające.');
  assert(!JSON.stringify(listResult).includes(token) && !JSON.stringify(issueResult).includes(token), 'W odpowiedzi pojawił się token.');
  console.log('MCP: dwa narzędzia, rzeczywiste odczyty, pola, zakresy i błędne argumenty OK.');
} finally { await client.close(); }
const offline = await connect({ GITEA_BASE_URL:'http://127.0.0.1:9' });
try {
  const res = await offline.callTool({name:'get_issue',arguments:{number:1}});
  assert(res.isError && parsed(res).error === 'SOURCE_UNAVAILABLE', 'Niedostępne API musi dać SOURCE_UNAVAILABLE i isError.');
  console.log('MCP: niedostępne API poprawnie zwraca błąd.');
} finally { await offline.close(); }
console.log('API Gitea: ograniczenia tokena 200/403/404/403/403 OK.');
