# Dwa narzędzia do odczytu zgłoszeń

Serwer czyta z `/api/v1/repos/operator/ops/issues`. Adres Gitea bierze z `GITEA_BASE_URL`, a token konta `reader` z pliku wskazanego przez `GITEA_TOKEN_FILE`.

| Narzędzie | Argumenty | Co zwraca |
|---|---|---|
| `list_issues` | `state` (`open` lub `closed`, domyślnie `open`) i całkowity `limit` od 1 do 10 (domyślnie 5) | Tablicę zgłoszeń z pierwszej strony. Wyślij GET z parametrami `state`, `limit` i `page=1`. Pomiń pull requesty. |
| `get_issue` | Całkowity `number` od 1 do 1000000 | Jedno zgłoszenie pobrane przez GET pod ścieżką zakończoną `/{number}`. Numer pull requesta zwraca błąd. |

Przyjmuj tylko argumenty z tabeli. Ustaw timeout żądania i odrzucaj przekierowania. Token pozostaje po stronie serwera, również przy błędzie.

## Wynik

W `content` zwróć element typu `text` z JSON-em. Każde zgłoszenie ma cztery pola: `number`, `title`, `state` i `labels` (lista nazw etykiet). Przykład dla `get_issue`:

```json
{"ok":true,"data":{"number":1,"title":"Przykładowe zgłoszenie","state":"open","labels":[]}}
```

Pusta lista po poprawnym odczycie to `{"ok":true,"data":[]}`. Gdy Gitea nie odpowiada, ustaw `isError: true` i zwróć `{"ok":false,"error":"SOURCE_UNAVAILABLE"}`. Brak tokenu, brak zgłoszenia, odmowę dostępu i niepoprawną odpowiedź API też zgłaszaj jako błędy.
