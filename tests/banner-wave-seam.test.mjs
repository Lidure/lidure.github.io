import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const readSource = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const bannerStyles = () => [
  readSource('src/styles/firefly-v6-theme.css'),
  readSource('src/components/BlogBanner.astro'),
].join('\n');

test('homepage uses a real Firefly-style content overlap instead of fully compensating the lift', () => {
  const theme = bannerStyles();

  assert.match(theme, /--banner-surface-overlap:\s*3\.5rem/);
  assert.match(theme, /--home-banner-content-inset:\s*2\.35rem/);
  assert.match(theme, /body\.layout-standard\.is-home\s+\.standard-content\s*\{[^}]*padding-top:\s*var\(--home-banner-content-inset\)/s);
  assert.match(theme, /body\.layout-standard:not\(\.is-home\)\s+\.standard-content\s*\{[^}]*padding-top:\s*calc\(var\(--banner-surface-overlap\)\s*\+\s*14px\)/s);
  assert.match(theme, /body\.layout-standard\.is-home\s+\.home-category-bar\s*\{[^}]*z-index:\s*6[^}]*backdrop-filter:\s*blur\(12px\)/s);
  assert.match(theme, /body\.layout-standard\.is-home\s+\.blog-banner-copy\s*\{[^}]*transform:\s*translateY\(-clamp\(20px,\s*4vh,\s*42px\)\)/s);
});

test('mobile homepage softens the overlap without removing it', () => {
  const theme = bannerStyles();

  assert.match(theme, /@media\s*\(max-width:\s*720px\)[\s\S]*body\.layout-standard\.is-home\s*\{[^}]*--banner-surface-overlap:\s*2\.25rem[^}]*--home-banner-content-inset:\s*1\.75rem/s);
});

test('Firefly-style waves and gradient are mutually exclusive on each device class', () => {
  const theme = bannerStyles();

  assert.match(theme, /@media\s*\(min-width:\s*1024px\)[\s\S]*html\[data-wave-enabled="true"\][\s\S]*\.standard-page-surface::before[\s\S]*display:\s*none/);
  assert.match(theme, /@media\s*\(max-width:\s*1023px\)[\s\S]*html\[data-wave-enabled="true"\]\[data-wave-mobile="true"\][\s\S]*\.standard-page-surface::before[\s\S]*display:\s*none/);
});
