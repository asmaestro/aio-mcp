import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile, access, realpath } from 'node:fs/promises';
import { resolve } from 'node:path';

const state = resolve('.state');
const exists = async path => access(path).then(() => true, () => false);
const run = (...args) => execFileSync('docker', ['compose', ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
async function waitForGitea(base) {
  for (let i = 0; i < 60; i++) {
    try { if ((await fetch(`${base}/api/v1/version`, { signal: AbortSignal.timeout(1200) })).ok) return; } catch {}
    await wait(1000);
  }
  throw new Error('Gitea nie odpowiada. Sprawdź docker compose logs gitea.');
}

async function main() {
  const location = await realpath('.');
  const envFile = resolve('.env');
  const rootFile = `${state}/project-root`;
  await mkdir(state, { recursive: true, mode: 0o700 });
  let project;
  const containerUser = `${process.getuid?.() ?? 1000}:${process.getgid?.() ?? 1000}`;
  if (await exists(envFile)) {
    const env = await readFile(envFile, 'utf8');
    const match = /^AI_OPS_PROJECT_NAME=(aiops-[0-9a-f]{20})\nAI_OPS_CONTAINER_USER=([0-9]+:[0-9]+)\n$/.exec(env);
    if (!match || match[2] !== containerUser || !(await exists(rootFile))) throw new Error('Istnieje .env, którego nie utworzył ten bootstrap. Nie zmieniam go. Użyj świeżego klonu repozytorium.');
    if ((await readFile(rootFile,'utf8')).trim() !== location) throw new Error('Ta kopia zawiera stan innego katalogu. Nie uruchamiam go. Użyj świeżego klonu repozytorium.');
    project = match[1];
  } else {
    if (await exists(`${state}/in-progress`) || await exists(`${state}/ready`) || await exists(rootFile)) throw new Error('Istnieje wcześniejszy stan bez konfiguracji projektu. Nie nadpisuję danych. Użyj świeżego klonu repozytorium.');
    project = `aiops-${randomBytes(10).toString('hex')}`;
    await writeFile(envFile, `AI_OPS_PROJECT_NAME=${project}\nAI_OPS_CONTAINER_USER=${containerUser}\n`, { flag: 'wx', mode: 0o600 });
    await writeFile(rootFile, location+'\n', { flag: 'wx', mode: 0o600 });
  }
  let resolved;
  try { resolved = JSON.parse(run('--profile', 'mcp', 'config', '--format', 'json')); }
  catch { throw new Error('Nie udało się sprawdzić konfiguracji Docker Compose. Sprawdź Docker Desktop.'); }
  if (resolved.name !== project || resolved.services?.mcp?.user !== containerUser) throw new Error('Zewnętrzna konfiguracja zmienia nazwę projektu lub użytkownika kontenera. Nie uruchamiam kontenerów.');
  if (!(await exists(`${state}/ready`)) && await exists(`${state}/in-progress`)) throw new Error('Wcześniejsze przygotowanie nie zakończyło się poprawnie. Nie modyfikuję istniejących kont ani danych. Sprawdź .state i stan Gitea.');
  console.log('Uruchamiam własny projekt Gitea. Pierwsze pobranie obrazu może potrwać.');
  try { run('up', '-d', 'gitea'); } catch { throw new Error('Nie udało się uruchomić Gitea. Sprawdź Docker Desktop i dostęp do pobrania obrazu.'); }
  if (await exists(`${state}/ready`)) {
    if (!(await exists(`${state}/reader-token`)) || !(await exists(`${state}/operator-password`))) throw new Error('Brakuje lokalnych danych dostępowych. Nie tworzę kolejnego tokena; sprawdź katalog .state.');
    const port = run('port','gitea','3000').split(':').at(-1);
    await waitForGitea(`http://127.0.0.1:${port}`);
    console.log(`Laboratorium już przygotowane. Gitea: http://127.0.0.1:${port}\nNie utworzono dodatkowych kont ani tokenów.`);
    return;
  }
  let port;
  try { port = run('port', 'gitea', '3000').split(':').at(-1); } catch { throw new Error('Uruchom najpierw Gitea: docker compose up -d gitea'); }
  if (!/^\d+$/.test(port || '')) throw new Error('Nie udało się odczytać portu Gitea.');
  const base = `http://127.0.0.1:${port}`;
  await waitForGitea(base);
  await mkdir(state, { recursive: true, mode: 0o700 });
  await writeFile(`${state}/in-progress`, 'Niedokończone przygotowanie.\n', { flag: 'wx', mode: 0o600 });
  const adminPassword = randomBytes(24).toString('base64url');
  const readerPassword = randomBytes(24).toString('base64url');
  await writeFile(`${state}/operator-password`, adminPassword + '\n', { flag: 'wx', mode: 0o600 });
  const admin = ['exec', '-T', 'gitea', 'gitea', 'admin', 'user'];
  try {
    run(...admin, 'create', '--username', 'operator', '--password', adminPassword, '--email', 'operator@example.test', '--must-change-password=false', '--admin');
    run(...admin, 'create', '--username', 'reader', '--password', readerPassword, '--email', 'reader@example.test', '--must-change-password=false');
  } catch { throw new Error('Nie udało się utworzyć kont testowych. Sprawdź stan Gitea. Żadne hasło nie zostało wypisane.'); }
  const auth = `Basic ${Buffer.from(`operator:${adminPassword}`).toString('base64')}`;
  const request = async (method, path, body, expected) => {
    const response = await fetch(base + '/api/v1' + path, { method, headers: { Authorization: auth, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
    if (response.status !== expected) throw new Error(`${method} ${path}: oczekiwano HTTP ${expected}, otrzymano ${response.status}.`);
    return response.status === 204 ? null : response.json();
  };
  await request('POST', '/user/repos', { name: 'ops', private: true, auto_init: true }, 201);
  await request('POST', '/user/repos', { name: 'restricted', private: true, auto_init: true }, 201);
  await request('PUT', '/repos/operator/ops/collaborators/reader', { permission: 'read' }, 204);
  await request('POST', '/repos/operator/ops/issues', { title: 'Udostępnić agentowi odczyt zgłoszeń', body: 'Zadanie ćwiczeniowe: przygotować ograniczony odczyt zgłoszeń repozytorium ops przez serwer MCP.' }, 201);
  await request('POST', '/repos/operator/ops/issues', { title: 'Sprawdzić ograniczenia dostępu konta reader', body: 'Zadanie ćwiczeniowe: potwierdzić brak dostępu do prywatnego repozytorium restricted oraz brak prawa tworzenia zgłoszeń przez token odczytowy.' }, 201);
  let token;
  try { token = run(...admin, 'generate-access-token', '--username', 'reader', '--token-name', 'mcp-reader', '--scopes', 'read:issue', '--raw'); }
  catch { throw new Error('Nie udało się utworzyć tokena reader. Nie uruchamiaj ponownie bootstrapu bez sprawdzenia stanu.'); }
  if (!/^[0-9a-f]{40}$/i.test(token)) throw new Error('Nieoczekiwany format tokena. Sprawdź stan w Gitea, nie wypisując wartości tokena.');
  await writeFile(`${state}/reader-token`, token + '\n', { flag: 'wx', mode: 0o600 });
  await writeFile(`${state}/ready`, 'Laboratorium przygotowane.\n', { flag: 'wx', mode: 0o600 });
  console.log(`Gitea: ${base}\nUżytkownik operator. Hasło znajduje się w .state/operator-password.\nUtworzono prywatne repozytoria ops i restricted oraz dwa zgłoszenia ćwiczeniowe. Token reader zapisano w .state/reader-token.`);
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
