import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const page = readFileSync(new URL('../src/pages/moments.astro', import.meta.url), 'utf8');

test('legacy r2.dev moment images fall back through the current media endpoint', () => {
  assert.match(page, /function resolveImageCandidates\(src: string\)/);
  assert.match(page, /\.r2\.dev$/);
  assert.match(page, /IMAGE_PUBLIC_BASE/);
  assert.match(page, /parsed\.pathname\.replace\(\/\^\\\/+\//);
  assert.match(page, /`\$\{IMAGE_PUBLIC_BASE\}\/\$\{legacyKey\}`/);
  assert.doesNotMatch(
    page,
    /if \(src\.startsWith\('http:\/\/'\) \|\| src\.startsWith\('https:\/\/'\)\) return \[src\];/,
    'absolute legacy URLs must not bypass fallback candidates',
  );
});
