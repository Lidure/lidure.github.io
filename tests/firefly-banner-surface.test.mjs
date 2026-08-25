import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');

const banner = read('src/components/BlogBanner.astro');
const modes = read('src/styles/firefly-wallpaper-modes.css');
const waves = read('src/components/BannerWaves.astro');
const bannerStyles = `${modes}\n${banner}`;

test('banner homepage uses a transparent Firefly-style content panel over the page background', () => {
  assert.match(
    bannerStyles,
    /data-wallpaper-mode="banner"[\s\S]*body\.layout-standard\.is-home\s+\.standard-page-surface\s*\{[^}]*background:\s*transparent/s,
  );
  assert.match(
    banner,
    /data-wallpaper-mode="banner"[\s\S]*body\.layout-standard\.is-home\s+\.standard-content\s*\{[^}]*position:\s*relative[^}]*z-index:\s*30[^}]*padding-top:\s*0/s,
  );
});

test('banner content stays above waves while preserving the Firefly 3.5rem overlap', () => {
  assert.match(waves, /body\.layout-standard\s+\.banner-waves\s*\{[^}]*z-index:\s*15/s);
  assert.match(banner, /--banner-surface-overlap:\s*3\.5rem/);
  assert.match(
    banner,
    /data-wallpaper-mode="banner"[\s\S]*\.standard-page-surface\s*\{[^}]*margin-top:\s*calc\(-1\s*\*\s*var\(--banner-surface-overlap\)\)/s,
  );
});
