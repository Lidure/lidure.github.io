import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('../src/components/HeroSlideshow.astro', import.meta.url), 'utf8');

test('hero background fallback never exposes internal status text', () => {
  assert.doesNotMatch(source, /VIDEO_CORS_REQUIRED|needs-poster/);
  assert.match(source, /posterNeededEl\.textContent\s*=\s*''/);
});

test('hero background fallback stays decorative and hidden from assistive output', () => {
  assert.match(source, /posterNeededEl\.setAttribute\('aria-hidden',\s*'true'\)/);
  assert.match(source, /\.poster-needed-placeholder\s*\{[^}]*background:/s);
});
