import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

const server = new McpServer({ name: 'gitea-issues-readonly', version: '1.0.0' });

// Zarejestruj list_issues i get_issue zgodnie z kontraktem w API.md.
// Użyj walidacji argumentów, odczytu określonego API i ograniczenia pól.
// Błędy źródła zwracaj jako błąd narzędzia MCP. Logi kieruj na stderr.

await server.connect(new StdioServerTransport());
