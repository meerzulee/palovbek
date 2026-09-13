import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import net from 'node:net';

const uv = process.env.UV_BIN ?? (existsSync(join(homedir(), '.local/bin/uv')) ? join(homedir(), '.local/bin/uv') : 'uv');
// Do not silently connect a different backend or kill a user's existing process.
for (const port of [8001, 5173]) {
  const free = await new Promise(resolve => {
    const server = net.createServer();
    server.once('error', () => resolve(false));
    server.listen(port, '127.0.0.1', () => server.close(() => resolve(true)));
  });
  if (!free) { console.error(`Port ${port} is already in use. Stop the existing local server or use separate terminal commands from README.md.`); process.exit(1); }
}
const children = [];
let stopping = false;
const stop = code => {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill('SIGTERM');
  process.exitCode = code;
};
for (const [command, args] of [[uv, ['run', '--frozen', 'python', '-m', 'brain.server']], ['npm', ['run', 'dev', '--', '--port', '5173', '--strictPort']]]) {
  const child = spawn(command, args, { stdio: 'inherit' });
  children.push(child);
  child.once('error', error => { console.error(error.message); stop(1); });
  child.once('exit', code => { if (!stopping) stop(code ?? 1); });
}
process.on('SIGINT', () => stop(0)); process.on('SIGTERM', () => stop(0));
