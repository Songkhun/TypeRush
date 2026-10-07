#!/usr/bin/env node
// Minimal static server for the built app. Listens on 127.0.0.1 only.
// Usage: node serve.mjs <dist-dir> [port]
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { contentType, resolvePath } from './serve-lib.mjs';

const [root, portArg] = process.argv.slice(2);
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
