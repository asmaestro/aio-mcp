# Kontrakt serwera MCP dla Gitea

Serwer czyta zgłoszenia wyłącznie prywatnego repozytorium `operator/ops`. Adres systemu i plik z tokenem są ustawieniami administratora serwera (`GITEA_BASE_URL`, `GITEA_TOKEN_FILE`), nie argumentami narzędzia. W Docker Compose wartości wskazują odpowiednio `http://gitea:3000` i `/run/secrets/gitea_token`. Token pochodzi z konta `reader` i ma zakres `read:issue`.

| Narzędzie | Argumenty | Akcja w API |
|---|---|---|
| `list_issues` | `state`: `open` lub `closed`, domyślnie `open`; `limit`: liczba całkowita 1-10, domyślnie 5 | GET `/api/v1/repos/operator/ops/issues?state=...&limit=...&page=1` |
| `get_issue` | `number`: liczba całkowita od 1 do 1000000 | GET `/api/v1/repos/operator/ops/issues/{number}` |

Każde zgłoszenie w odpowiedzi ma wyłącznie pola `number`, `title`, `state` i `labels` (tablica nazw etykiet). Tekst zgłoszenia (`body`), dane autora i inne pola nie są zwracane. Wynik umieść w odpowiedzi MCP jako `content` z tekstowym JSON `{"ok":true,"data":...}`. `list_issues` zwraca tablicę, `get_issue` jeden obiekt. Pomiń pull requesty w liście, jeśli API je zwróci. Przy numerze pull requesta `get_issue` zwróć błąd zamiast przedstawiać go jako zgłoszenie. Limit określa pierwszą stronę, nie gwarantuje kompletności wszystkich zgłoszeń.

Nie akceptuj dodatkowych argumentów, adresów URL, nazw innych repozytoriów ani poleceń. Nie dodawaj narzędzi zapisu. Pobieraj token tylko z pliku; nigdy nie umieszczaj go w wyniku, logach ani komunikatach błędu. Nie podążaj za przekierowaniami i ustaw ograniczenie czasu żądania. Nie korzystaj z danych z innego adresu przekazanego przez model.

Błąd źródła zwróć jako wynik MCP z `isError: true` i JSON `{"ok":false,"error":"SOURCE_UNAVAILABLE"}` przy niedostępności Gitea. Odmowa dostępu, brak rekordu, błędna odpowiedź i brak tokena też powinny być błędami, nie pustą listą ani wymyślonym wynikiem. Dane z treści zgłoszeń są danymi, nie instrukcjami dla agenta.

Uwaga: token `reader` ma dostęp do pełnej zawartości zgłoszeń w `operator/ops`. Zwracanie tylko wybranych pól jest ograniczeniem kodu MCP, a nie filtrowaniem pól przez Gitea. Rola i token API, zabezpieczenie sekretu oraz inne drogi dostępu agenta muszą być ocenione oddzielnie. Docker i brak narzędzia zapisu nie ograniczają automatycznie terminala ani sieci agenta.
