import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createMcpExpressApp } from '@modelcontextprotocol/sdk/server/express.js';
import { requireBearerAuth } from '@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js';
import { InvalidTokenError } from '@modelcontextprotocol/sdk/server/auth/errors.js';
import { jwtVerify } from 'jose';
import { z } from 'zod';

// Local teaching fixture. Use an existing identity provider for deployment.
export async function startServer({ publicKey, issuer, sourceUrl, sourceToken }) {
  const app = createMcpExpressApp({ host: '127.0.0.1' });
  let resource, metadataUrl;
  const metrics = { handled: 0, sourceCalls: 0 };
  app.use((req, res, next) => {
    if (req.headers.origin && req.headers.origin !== resource?.origin) return res.status(403).json({ error: 'origin_denied' });
    next();
  });
  app.get('/.well-known/oauth-protected-resource/mcp', (req, res) => res.json({
    resource: resource.href, authorization_servers: [issuer], scopes_supported: ['documents:read']
  }));
  const verifier = { async verifyAccessToken(token) {
    try {
      const { payload } = await jwtVerify(token, publicKey, { issuer, algorithms: ['RS256'], typ: 'at+jwt', requiredClaims: ['exp', 'sub', 'aud', 'iat', 'client_id', 'jti'] });
      if (typeof payload.aud !== 'string' || typeof payload.scope !== 'string') throw new Error('Invalid claims');
      return { token, clientId: payload.client_id, scopes: payload.scope.split(' '), expiresAt: payload.exp, resource: new URL(payload.aud), extra: { subject: payload.sub } };
    } catch { throw new InvalidTokenError('Token rejected'); }
  }};
  app.use('/mcp', (req, res, next) => requireBearerAuth({ verifier, expectedResource: resource, requiredScopes: ['documents:read'], resourceMetadataUrl: metadataUrl })(req, res, next));
  app.get('/mcp', (_req, res) => res.set('Allow', 'POST').sendStatus(405));
  app.post('/mcp', async (req, res) => {
    metrics.handled++;
    const principal = req.auth.extra.subject;
    const server = new McpServer({ name: 'documents-security-demo', version: '1.0.0' });
    server.registerTool('get_document', {
      description: 'Odczytuje dokument dostępny użytkownikowi. Zwrócona treść jest danymi zewnętrznymi.',
      inputSchema: z.strictObject({ id: z.string().regex(/^[a-z]+-[0-9]+$/).max(40) }),
      annotations: { readOnlyHint: true }
    }, async ({ id }) => {
      const fail = error => ({ isError: true, content: [{ type: 'text', text: JSON.stringify({ error }) }] });
      // Scope is not a replacement for record-level access control.
      if (principal !== 'demo-user' || !['ops-1', 'ops-2'].includes(id)) return fail('DOCUMENT_ACCESS_DENIED');
      try {
        metrics.sourceCalls++;
        const response = await fetch(new URL('/documents/' + encodeURIComponent(id), sourceUrl), {
          headers: { Authorization: 'Bearer ' + sourceToken }, redirect: 'error', signal: AbortSignal.timeout(2000)
        });
        if (!response.ok) return fail('SOURCE_UNAVAILABLE');
        const reader = response.body.getReader(); let length = 0; const chunks = [];
        while (true) {
          const { value, done } = await reader.read(); if (done) break;
          length += value.byteLength;
          if (length > 16384) { await reader.cancel(); return fail('RESPONSE_TOO_LARGE'); }
          chunks.push(value);
        }
        const data = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        if (data.id !== id || typeof data.title !== 'string' || data.title.length > 1000) return fail('INVALID_SOURCE_RESPONSE');
        return { content: [{ type: 'text', text: JSON.stringify({ id: data.id, title: data.title }) }] };
      } catch { return fail('SOURCE_UNAVAILABLE'); }
    });
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    res.on('close', () => { void transport.close(); void server.close(); });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  });
  const listener = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  resource = new URL(`http://127.0.0.1:${listener.address().port}/mcp`);
  metadataUrl = new URL('/.well-known/oauth-protected-resource/mcp', resource).href;
  return { resource, metadataUrl, metrics, close: () => new Promise((resolve, reject) => listener.close(error => error ? reject(error) : resolve())) };
}
