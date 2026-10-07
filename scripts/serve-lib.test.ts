import { describe, expect, it } from 'vitest';
import path from 'node:path';
// @ts-expect-error plain ESM helper without type declarations
import { contentType, resolvePath } from './serve-lib.mjs';

const root = path.resolve('/tmp/site');

describe('resolvePath', () => {
  it('maps / to index.html and keeps paths inside root', () => {
    expect(resolvePath(root, '/')).toBe(path.join(root, 'index.html'));
    expect(resolvePath(root, '/assets/a.js?v=1')).toBe(path.join(root, 'assets/a.js'));
  });
  it('refuses to leave the root', () => {
    expect(resolvePath(root, '/../secret')).toBeNull();
    expect(resolvePath(root, '/%2e%2e/secret')).toBeNull();
    expect(resolvePath(root, '/a/../../x')).toBeNull();
    expect(resolvePath(root, '/..%2fsecret')).toBeNull();
    expect(resolvePath('/tmp/site', '/../site-evil/x')).toBeNull();
  });
  it('rejects malformed encodings', () => {
    expect(resolvePath(root, '/%E0%A4%A')).toBeNull();
  });
});

describe('contentType', () => {
  it('knows the built asset types', () => {
    expect(contentType('a.js')).toBe('text/javascript; charset=utf-8');
    expect(contentType('a.css')).toBe('text/css; charset=utf-8');
    expect(contentType('index.html')).toBe('text/html; charset=utf-8');
    expect(contentType('icon.svg')).toBe('image/svg+xml');
    expect(contentType('x.bin')).toBe('application/octet-stream');
  });
});
