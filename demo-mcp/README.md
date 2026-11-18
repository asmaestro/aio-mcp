# Kto może odczytać dokument?

W katalogu `aio-mcp/demo-mcp` uruchom poniższe polecenia. Wystarczy Node.js 22 lub nowszy z npm.

```bash
npm ci --ignore-scripts
npm run demo
```

Otwórz wygenerowany plik `wyniki.json` i znajdź dwa wpisy:

- **Odczyt przez rzeczywisty klient MCP** · `PASS` oznacza, że użytkownik odczytał `ops-1`.
- **Kontrola dostępu do dokumentu** · `PASS` oznacza, że wywołanie dla `finance-1` zwróciło `DOCUMENT_ACCESS_DENIED`, a licznik zapytań do źródła pozostał bez zmian.

W `server.mjs` znajdź `DOCUMENT_ACCESS_DENIED`. To w tym miejscu serwer decyduje, czy wolno mu pobrać wskazany dokument.
