import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';

try {
  const port = execFileSync('docker', ['compose','port','gitea','3000'], { encoding:'utf8' }).trim().split(':').at(-1);
  if (!/^\d+$/.test(port)) throw new Error('Brak aktywnego portu Gitea.');
  const token = (await readFile('.state/reader-token','utf8')).trim();
  const response = await fetch(`http://127.0.0.1:${port}/api/v1/repos/operator/ops/issues?state=open&limit=5`, { headers: { Authorization: `token ${token}`, Accept: 'application/json' } });
  if (!response.ok) throw new Error(`Odczyt API: HTTP ${response.status}.`);
  const data = await response.json();
  console.log(`GET zgłoszeń operator/ops: HTTP ${response.status}`);
  console.log(JSON.stringify(data.map(({number,title,state,body,labels}) => ({number,title,state,body,labels: labels.map(x => x.name)})), null, 2));
} catch (error) { console.error(error.message); process.exitCode=1; }
