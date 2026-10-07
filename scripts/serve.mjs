#!/usr/bin/env node
// Minimal static server for the built app. Listens on 127.0.0.1 only.
// Usage: node serve.mjs <dist-dir> [port] [chrome-profile-dir]
// With a Chrome profile dir, the server exits once that profile's Chrome instance has quit.
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { contentType, lockPid, resolvePath, shouldStop } from './serve-lib.mjs';

const [root, portArg, watchProfile] = process.argv.slice(2);
if (!root) { console.error('usage: serve.mjs <dist-dir> [port]'); process.exit(2); }
const port = Number(portArg) || 4747;
const index = path.join(path.resolve(root), 'index.html');

const server = http.createServer(async (req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405).end(); return; }
  if (req.url === '/__typerush') { res.writeHead(200, { 'Content-Type': 'text/plain' }).end('ok'); return; }
  const file = resolvePath(root, req.url ?? '/');
  if (!file) { res.writeHead(400).end(); return; }
  let target = file;
  let body;
  try {
    body = await fs.readFile(target);
  } catch {
    if (path.extname(file)) { res.writeHead(404).end(); return; } // missing asset
    target = index; // app route: serve the SPA shell
    try { body = await fs.readFile(target); } catch { res.writeHead(404).end(); return; }
  }
  res.writeHead(200, { 'Content-Type': contentType(target), 'Cache-Control': 'no-cache' });
  res.end(req.method === 'HEAD' ? undefined : body);
});

server.on('error', (e) => { console.error(e.message); process.exit(1); });
server.listen(port, '127.0.0.1');

function isRunning(pid) {
  try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; }
}

async function chromeRunning() {
  try {
    const pid = lockPid(await fs.readlink(path.join(watchProfile, 'SingletonLock')));
    return pid !== null && isRunning(pid);
  } catch {
    return false; // no lock file: that Chrome profile is not running
  }
}

if (watchProfile) {
  const started = Date.now();
  setInterval(async () => {
    if (shouldStop({ chromeRunning: await chromeRunning(), uptimeMs: Date.now() - started })) process.exit(0);
  }, 5000);
}
