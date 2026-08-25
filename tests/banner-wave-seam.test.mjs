import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const readSource = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const bannerStyles = () => [
  readSource('src/styles/firefly-refresh.css'),
  readSource('src/components/BlogBanner.astro'),
  readSource('src/components/BannerWaves.astro'),
].join('\n');

test('homepage content panel genuinely overlaps the banner while waves stay above both layers', () => {
  const styles = bannerStyles();

  assert.match(styles, /--banner-surface-overlap:\s*3\.5rem/);
  assert.match(styles, /body\.layout-standard\s+\.blog-banner-stage\s*\{[^}]*z-index:\s*auto/s);
  assert.doesNotMatch(styles, /html\[data-wallpaper-mode="banner"\]\s+body\.layout-standard\s+\.blog-banner-stage\s*\{[^}]*z-index:\s*4/s);
  assert.match(styles, /html\[data-wallpaper-mode="banner"\]\s+body\.layout-standard\.is-home\s+\.standard-page-surface\s*\{[^}]*margin-top:\s*calc\(-1\s*\*\s*var\(--banner-surface-overlap\)\)[^}]*border-radius:\s*0/s);
  assert.match(styles, /body\.layout-standard\s+\.banner-waves\s*\{[^}]*z-index:\s*15/s);
});

test('homepage hero copy and first navigation row use a softer Firefly-like vertical rhythm', () => {
  const styles = bannerStyles();

  assert.match(styles, /html\[data-wallpaper-mode="banner"\]\s+body\.layout-standard\.is-home\s+\.blog-banner-copy\s*\{[^}]*transform:\s*translateY\(clamp\(-30px,\s*-3vh,\s*-14px\)\)/s);
  assert.match(styles, /html\[data-wallpaper-mode="banner"\]\s+body\.layout-standard\.is-home\s+\.standard-content\s*\{[^}]*padding-top:\s*calc\(var\(--banner-surface-overlap\)\s*\+\s*10px\)/s);
  assert.match(styles, /html\[data-wallpaper-mode="banner"\]\s+body\.layout-standard\.is-home\s+\.home-category-bar\s*\{[^}]*margin-bottom:\s*20px/s);
  assert.match(styles, /@media\s*\(max-width:\s*1023px\)[\s\S]*--banner-surface-overlap:\s*2\.75rem/s);
});

test('Firefly-style waves and gradient are mutually exclusive on each device class', () => {
  const styles = bannerStyles();

  assert.match(styles, /@media\s*\(min-width:\s*1024px\)[\s\S]*html\[data-wave-enabled="true"\][\s\S]*\.standard-page-surface::before[\s\S]*display:\s*none/);
  assert.match(styles, /@media\s*\(max-width:\s*1023px\)[\s\S]*html\[data-wave-enabled="true"\]\[data-wave-mobile="true"\][\s\S]*\.standard-page-surface::before[\s\S]*display:\s*none/);
});
