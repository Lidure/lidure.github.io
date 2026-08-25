import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const readSource = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('banner waves own the transition while the page surface supports them from behind', () => {
  const theme = readSource('src/styles/firefly-v6-theme.css');

  assert.match(theme, /--banner-surface-overlap:\s*3\.5rem/);
  assert.match(theme, /html\[data-wallpaper-mode="banner"\]\s+body\.layout-standard\s+\.blog-banner-stage\s*\{[^}]*z-index:\s*4/s);
  assert.match(theme, /html\[data-wallpaper-mode="banner"\]\s+body\.layout-standard\s+\.standard-page-surface\s*\{[^}]*margin-top:\s*calc\(-1\s*\*\s*var\(--banner-surface-overlap\)\)/s);
  assert.match(theme, /html\[data-wallpaper-mode="banner"\]\s+body\.layout-standard\s+\.standard-content\s*\{[^}]*padding-top:\s*calc\(var\(--banner-surface-overlap\)\s*\+\s*14px\)/s);
});

test('Firefly-style waves and gradient are mutually exclusive on each device class', () => {
  const theme = readSource('src/styles/firefly-v6-theme.css');

  assert.match(theme, /@media\s*\(min-width:\s*1024px\)[\s\S]*html\[data-wave-enabled="true"\][\s\S]*\.standard-page-surface::before[\s\S]*display:\s*none/);
  assert.match(theme, /@media\s*\(max-width:\s*1023px\)[\s\S]*html\[data-wave-enabled="true"\]\[data-wave-mobile="true"\][\s\S]*\.standard-page-surface::before[\s\S]*display:\s*none/);
});
