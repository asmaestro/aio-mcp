# Gitea i własny serwer MCP

Polecenia wykonuj w `aio-mcp/gitea-mcp-lab`. Potrzebujesz Node.js 22 lub nowszego, Dockera z Compose i agenta z obsługą MCP przez stdio. Na Windows użyj WSL z integracją Dockera.

## 05B.01 · Uruchom Gitea

```bash
node scripts/bootstrap.mjs
node scripts/inspect-api.mjs
```

Otwórz adres z terminala. Zaloguj się jako `operator` hasłem z `.state/operator-password`. W **operator/ops → Issues** zobaczysz dwa zgłoszenia. Porównaj ich numery i tytuły z wynikiem skryptu. Odczyt API powinien zwrócić HTTP 200. Hasło i token zostaw poza rozmową z agentem.

## 05B.02 · Sprawdź uprawnienia

```bash
node scripts/check-access.mjs
node --test test/hook.test.mjs
```

Dla tokenu `reader` oczekuj kolejno: 200 dla zgłoszeń, 403 dla metadanych repozytorium, 404 dla prywatnego `restricted` i po 403 dla obu prób zapisu. Test samego hooka powinien zaliczyć 6 przypadków. W lekcji znajdziesz też opcjonalny przykład rejestracji hooka w Claude Code.

## 05B.03 · Sprawdź swój serwer

Zacznij od `starter/server.mjs`. Zgodnie z [kontraktem](API.md) przygotuj `src/my-server.mjs`, a potem uruchom:

```bash
docker compose --profile mcp build mcp
docker compose --profile mcp run --rm -T --entrypoint node mcp scripts/verify-student.mjs
```

Tester powinien potwierdzić odczyt przez oba narzędzia, błąd przy niedostępnym API i uprawnienia tokenu. Gotowy przykład znajdziesz w `solution/server.mjs`.

W swoim kliencie MCP dodaj serwer stdio o nazwie `gitea-issues`. Program to `docker`. Jako argumenty podaj kolejno `compose`, `--project-directory`, pełną ścieżkę do `gitea-mcp-lab`, `--profile`, `mcp`, `run`, `--rm`, `-T`, `mcp`. W 05B.03 znajdziesz gotowe konfiguracje dla Codexa, Cursora i Claude Code.

Otwórz nową sesję w projekcie i poproś agenta o wywołanie `list_issues` dla otwartych zgłoszeń. Porównaj numery i tytuły z widokiem **Issues** w Gitea.

Po pracy wpisz `docker compose stop`. Następnym razem uruchom `node scripts/bootstrap.mjs` w tym samym katalogu.
