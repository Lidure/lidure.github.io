import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const readSource = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('homepage profile follows Firefly with a large square avatar and brand icon buttons', () => {
  const source = readSource('src/components/HomeLeftSidebar.astro');

  assert.match(source, /class="profile-avatar-frame"/);
  assert.match(source, /\.profile-avatar-frame[\s\S]*width:\s*100%/);
  assert.match(source, /\.profile-avatar-frame[\s\S]*aspect-ratio:\s*1\s*\/\s*1/);
  assert.match(source, /\.profile-avatar-frame[\s\S]*border-radius:\s*12px/);
  assert.match(source, /class="profile-social-icon"/);
  assert.match(source, /viewBox=\{item\.viewBox\}/);
  assert.match(source, /<path d=\{item\.path\}\s*\/?>/);
  assert.doesNotMatch(source, /glyph:\s*'GH'/);
  assert.doesNotMatch(source, /glyph:\s*'QQ'/);
});

test('standard banner uses Firefly 65vh height on the shared banner stage', () => {
  const refreshCss = readSource('src/styles/firefly-refresh.css');
  const waves = readSource('src/components/BannerWaves.astro');

  assert.match(refreshCss, /--blog-banner-height:\s*65vh/);
  assert.match(waves, /height:\s*var\(--blog-banner-height,\s*65vh\)/);
  assert.match(waves, /min-height:\s*400px/);
});
