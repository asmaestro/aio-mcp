# Lokalny pokaz bezpieczeństwa MCP

Testowe dokumenty, rzeczywisty klient MCP i lokalny HTTP. Żadne konta ani sekrety firmy nie są potrzebne.

W tym katalogu, Node.js 22+:

```sh
npm ci --ignore-scripts
npm run demo
```

Skrypt tworzy tymczasową parę kluczy, podpisuje krótkotrwałe testowe JWT i wywołuje lokalny MCP. Klucze oraz tokeny pozostają w pamięci. Wyniki zapisuje w wyniki.json. Usługi są zamykane po pokazie.

server.mjs zawiera odczyt dokumentu, kontrolę scope i odbiorcy tokenu, kontrolę dostępu do dokumentu, ścisły schemat, stałe źródło, blokadę przekierowania, timeout i limit odpowiedzi. verify-security.mjs jest prowadzącym pokaz, nie serwerem logowania. Wartości limitów służą ćwiczeniu.

Demo nie implementuje pełnego OAuth, prawdziwego IdP, PKCE, TLS, hostingu, kontenerów, rate limitera ani systemu logowania. Lokalny klucz publiczny zastępuje konfigurację dostawcy. Do hostowania użyj sprawdzonej integracji dostawcy tożsamości i zweryfikuj zgodność klienta MCP. Tytuł zawierający instrukcję celowo przechodzi do wyniku: nie uruchamiamy modelu i nie wykazujemy jego odporności.

SDK jest przypięty do wersji zgodnej z laboratorium. Demo nie stanowi implementacji wszystkich funkcji rewizji MCP 2026-07-28.
