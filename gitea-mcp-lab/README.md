# Gitea i własny serwer MCP

W tym katalogu pracujemy z rzeczywistą aplikacją [Gitea](https://github.com/go-gitea/gitea), jej interfejsem oraz REST API. Gitea działa lokalnie w kontenerze i korzysta z bazy SQLite. Dwa zgłoszenia zostały utworzone na potrzeby ćwiczenia, nie są opisem prawdziwego incydentu.

## Czego potrzebujesz

Docker z działającym Docker Compose, Node.js 22 lub nowszy, edytor i działający Claude Code. Docker musi móc pobrać obraz Gitea 28.2.0 oraz obraz Node.js i zależności MCP. Samemu nie trzeba uruchamiać `npm install` na komputerze, obraz MCP instaluje zależności przypięte w `package-lock.json`.

Po sklonowaniu repozytorium otwórz terminal w katalogu `aio-mcp/gitea-mcp-lab`, obok pliku `compose.yaml`. Nie kopiuj już uruchomionego katalogu razem z `.env` i `.state`: jego stan jest przypisany do poprzedniej ścieżki, a bootstrap wykrywa rozbieżność. Dla systemu Windows wykonuj polecenia w WSL z działającą integracją Docker. Instrukcja i testy techniczne były wykonywane na macOS; różnice środowiska mogą wymagać osobnego sprawdzenia.

## Uruchom i obejrzyj Gitea

```bash
node scripts/bootstrap.mjs
```

Skrypt tworzy unikatową nazwę projektu Docker Compose i zapisuje ją w lokalnym `.env`, przypisuje ją do ścieżki kopii oraz uruchamia Gitea na automatycznie przydzielonym porcie lokalnym. Otrzymujesz adres w terminalu. Po pierwszym uruchomieniu skrypt zakłada konto `operator`, konto `reader`, prywatne repozytoria `operator/ops` i `operator/restricted` oraz dwa zgłoszenia w `operator/ops`. Hasło operatora zapisuje w `.state/operator-password`, a token czytelnika w `.state/reader-token`. Wartości tych plików nie są wypisywane. Katalog `.state` i plik `.env` zostają na Twoim komputerze, poza pakietem i repozytorium.

Otwórz adres z terminala. Zaloguj się jako `operator` hasłem odczytanym z pliku `.state/operator-password`. Otwórz `operator/ops` i zakładkę Issues. Hasło pokazuj tylko sobie, poza nagraniem i poza rozmową z agentem. Adres bieżącego portu da się ponownie odczytać poleceniem:

```bash
docker compose port gitea 3000
```

Powtórne `node scripts/bootstrap.mjs` uruchamia istniejący projekt i nie tworzy kolejnych kont ani tokenów. Jeśli pierwszy bootstrap przerwał się w trakcie tworzenia danych, skrypt się zatrzyma zamiast nadpisywać stan. Sprawdź komunikat i `docker compose logs gitea`; jeśli potrzebujesz nowej instancji, pracuj na świeżym klonie repozytorium. Nie usuwaj danych ani wolumenów, których pochodzenia nie znasz.

## Sprawdź API konta reader

```bash
node scripts/inspect-api.mjs
node scripts/check-access.mjs
```

Pierwszy skrypt odczytuje token ze wskazanego lokalnego pliku, wysyła GET do `/api/v1/repos/operator/ops/issues` i pokazuje HTTP 200 oraz wybrane pola, w tym pełny tekst `body` dostępnych zgłoszeń. Drugi sprawdza HTTP 200 dla zgłoszeń `ops`, 403 dla metadanych repozytorium, 404 dla zgłoszeń prywatnego `restricted` oraz 403 dla prób POST i DELETE. Żaden skrypt nie wypisuje tokena.

POST jest próbą z pustym obiektem, więc nie utworzy poprawnego zgłoszenia nawet gdyby uprawnienia były szersze. DELETE dotyczy numeru `999999`, a nie utworzonych zgłoszeń. Oba mają dać 403 dla `read:issue`, ale te dwie próby nie są pełnym audytem każdego endpointu Gitea. Wynik 404 dla prywatnego repozytorium oznacza, że z perspektywy tego konta zasób jest niewidoczny; nie odróżnia niewidocznego zasobu od nieistniejącego.

Token `reader` ma zakres `read:issue`. W testowanej wersji sama rola collaborator `read` nie wystarcza jako dowód zakazu tworzenia zgłoszeń, jeśli token posiada `write:issue`. Ograniczenie wynika tu z połączenia konta, dostępności repozytorium i zakresu tokena.

## Hook dla plików danych dostępowych

```bash
node --test test/hook.test.mjs
```

Pliki `hooks/protect-token.mjs` i `hooks/settings.example.json` zawierają przykład `PreToolUse` dla narzędzi `Edit|Write` Claude Code. Hook zwraca kod wyjścia 2, gdy próba edycji wskazuje `.state/reader-token` lub `.state/operator-password`, także przez istniejący dowiązany plik. Test obejmuje zdarzenia skryptu. Nie potwierdza rejestracji w kliencie, którą sprawdzamy oddzielnie w lekcji.

Hook chroni tylko edycje wykonywane pasującymi narzędziami. Nie blokuje odczytu, zapisu przez Bash, innych programów, przejęcia uprawnień hosta ani dowolnych kopii tokena. Sama instrukcja lub hook nie są autoryzacją API.

## Zbuduj własny MCP

Kontrakt narzędzi jest w `API.md`. `starter/server.mjs` jest niekompletnym punktem wyjścia. Zleć agentowi utworzenie `src/my-server.mjs` z narzędziami `list_issues` i `get_issue`. `solution/server.mjs` to kompletne rozwiązanie referencyjne, które można obejrzeć po samodzielnej próbie.

```bash
docker compose --profile mcp build mcp
docker compose --profile mcp run --rm -T --entrypoint node mcp scripts/verify-student.mjs
```

Druga komenda uruchamia prawdziwego klienta MCP i plik `src/my-server.mjs` w kontenerze, sprawdza listę narzędzi, odczyt z prawdziwej Gitea i zgodność zwracanych pól z jej bieżącą odpowiedzią, dodatkowe argumenty, limit, brak tokena w odpowiedzi, niedostępne API oraz określone statusy API. Wynik nie jest pełnym audytem bezpieczeństwa ani testem interaktywnego zachowania modelu. Rozwiązanie referencyjne można sprawdzić, dodając po nazwie skryptu parametr `solution/server.mjs`.

Aby podłączyć własny serwer do Claude Code, wykonaj z tego samego katalogu:

```bash
claude mcp add --transport stdio --scope local gitea-issues -- docker compose --profile mcp run --rm -T mcp
```

Następnie uruchom nową sesję Claude Code w tym katalogu, sprawdź `/mcp` i poproś o listę otwartych zgłoszeń z `operator/ops`. W trybie `stdio` klient uruchamia proces kontenera na czas połączenia i komunikuje się z nim przez wejście i wyjście standardowe. Logi serwera muszą trafiać na stderr, aby nie popsuć protokołu. Rejestracja `--scope local` zapisuje konfigurację lokalną klienta; nie sprawdzamy jej przez sam test skryptu.

## Granice laboratorium

Gitea i serwer MCP są rzeczywistymi programami. Dane kont i zgłoszeń są lokalne i przygotowane do ćwiczenia. Widoczny z hosta port Gitea służy do korzystania z interfejsu i API przez właściciela laboratorium. Nie demonstrujemy pełnej izolacji klienta AI od sieci hosta.

Dwa narzędzia MCP udostępniają tylko odczyt z `operator/ops` i wybrane pola. Token Gitea ma jednak dostęp do pełnej zawartości zgłoszeń w dostępnym repozytorium. Filtr pól to warstwa w naszym kodzie, a `readOnlyHint` jest informacją dla klienta, nie blokadą zapisu. Agent z terminalem, dostępem do pliku tokena lub innymi uprawnieniami może użyć innej drogi. Docker sam nie zastępuje polityk sieciowych, uprawnień konta ani ochrony sekretów.

Ćwiczenie używa połączenia lokalnego `stdio`, nie publikuje zdalnego serwera MCP. Dostęp wielu użytkowników przez sieć wymaga osobnego zaprojektowania uwierzytelniania, TLS, uprawnień oraz audytu. Nasz lab nie jest gotowym wdrożeniem produkcyjnym.

## Zatrzymaj środowisko

```bash
docker compose stop
```

To zatrzymuje usługi projektu bez usuwania danych. Ponowny `node scripts/bootstrap.mjs` uruchamia je ponownie. Nie używaj `docker compose down -v`, jeśli chcesz zachować repozytoria i zgłoszenia. Nie usuwaj cudzych kontenerów ani wolumenów.
