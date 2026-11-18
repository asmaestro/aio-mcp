import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';

try {
  const port = execFileSync('docker', ['compose','port','gitea','3000'], { encoding:'utf8' }).trim().split(':').at(-1);
  if (!/^\d+$/.test(port)) throw new Error('Brak aktywnego portu Gitea.');
  const token = (await readFile('.state/reader-token','utf8')).trim();
  const base = `http://127.0.0.1:${port}/api/v1/repos/operator/`;
  const checks = [
    ['GET', 'ops/issues?state=open&limit=5', 200],
    ['GET', 'ops', 403],
    ['GET', 'restricted/issues', 404],
    ['POST', 'ops/issues', 403],
    ['DELETE', 'ops/issues/999999', 403],
  ];
  for (const [method, path, expected] of checks) {
    // POST z pustym obiektem nie utworzy zgłoszenia nawet przy błędnych uprawnieniach.
    // DELETE dotyczy numeru poza pulą ćwiczeniową, nie usuwa przygotowanych zgłoszeń.
    const response = await fetch(base + path, { method, headers: { Authorization:`token ${token}`, 'Content-Type':'application/json' }, ...(method==='POST' ? {body:'{}'} : {}) });
    console.log(`${method} ${path}: HTTP ${response.status} (oczekiwano ${expected})`);
    if (response.status !== expected) throw new Error('Wynik nie potwierdza oczekiwanych ograniczeń. Zatrzymaj ćwiczenie i sprawdź uprawnienia.');
  }
  console.log('Sprawdzenia dostępu do API zakończone. Token nie został wypisany.');
} catch (error) { console.error(error.message); process.exitCode=1; }
