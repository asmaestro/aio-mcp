import { realpath } from 'node:fs/promises';
import { resolve } from 'node:path';

const project = resolve(process.env.CLAUDE_PROJECT_DIR || process.cwd());
const canonical = async path => { try { return await realpath(path); } catch { return resolve(path); } };
let input = '';
for await (const chunk of process.stdin) input += chunk;
try {
  const event = JSON.parse(input);
  if (!['Edit', 'Write'].includes(event.tool_name)) process.exit(0);
  if (typeof event.tool_input?.file_path !== 'string' || !event.tool_input.file_path) throw new Error('Brak ścieżki pliku.');
  const target = await canonical(resolve(project, event.tool_input.file_path));
  const protectedPaths = await Promise.all(['reader-token', 'operator-password'].map(name => canonical(resolve(project, '.state', name))));
  if (protectedPaths.includes(target)) {
    console.error('Edycja pliku z danymi dostępowymi jest zabroniona w tym ćwiczeniu.');
    process.exit(2);
  }
} catch {
  console.error('Nie udało się sprawdzić ścieżki w zdarzeniu hooka.');
  process.exit(2);
}
