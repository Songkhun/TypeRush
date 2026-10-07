import path from 'node:path';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

export function contentType(file) {
  return TYPES[path.extname(file).toLowerCase()] ?? 'application/octet-stream';
}

/** Absolute file path for a request URL, or null if it is malformed or escapes `root`. */
export function resolvePath(root, url) {
  const raw = url.split('?')[0].split('#')[0];
  let decoded;
  try { decoded = decodeURIComponent(raw); } catch { return null; }
  if (decoded.includes('\0')) return null;
  const rootAbs = path.resolve(root);
  const rel = decoded.replace(/^\/+/, '') || 'index.html';
  const full = path.resolve(rootAbs, rel);
  if (full !== rootAbs && !full.startsWith(rootAbs + path.sep)) return null;
  return full;
}
