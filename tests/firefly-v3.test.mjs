import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const readSource = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('v3 banner geometry uses the approved desktop tablet and mobile dimensions', () => {
  const css = readSource('src/styles/firefly-refresh.css');
  assert.match(css, /--blog-banner-height:\s*62vh/);
  assert.match(css, /--blog-banner-overlap:\s*56px/);
  assert.match(css, /min-height:\s*360px/);
  assert.match(css, /--blog-banner-height:\s*54vh/);
  assert.match(css, /--blog-banner-overlap:\s*44px/);
  assert.match(css, /--blog-banner-height:\s*42vh/);
  assert.match(css, /--blog-banner-overlap:\s*28px/);
  assert.match(css, /\.blog-banner-copy[\s\S]*?1380px/);
});

test('standard layout distinguishes homepage fullscreen wallpaper from non-home pages', () => {
  const layout = readSource('src/layouts/BaseLayout.astro');
  const css = readSource('src/styles/firefly-refresh.css');
  assert.match(layout, /const isHome\s*=/);
  assert.match(layout, /['"]is-home['"]\s*:\s*isHome/);
  assert.match(css, /data-wallpaper-mode="fullscreen"/);
  assert.match(css, /body\.layout-standard\.is-home/);
  assert.match(css, /body\.layout-standard:not\(\.is-home\)/);
  assert.match(css, /height:\s*100vh/);
});

test('fullscreen cards use wallpaper-aware opacity and theme hue affects the primary accent', () => {
  const css = readSource('src/styles/firefly-v2.css');
  assert.match(css, /--standard-accent:\s*hsl\(var\(--theme-hue,\s*340\)/);
  assert.match(css, /data-wallpaper-mode="fullscreen"/);
  assert.match(css, /--card-opacity-percent/);
  assert.match(css, /data-card-border="false"/);
  assert.match(css, /data-card-follow-theme="true"/);
});

test('homepage music widget uses the approved large-cover composition', () => {
  const music = readSource('src/components/MusicStatusWidget.astro');
  assert.match(music, /class="music-status-art"/);
  assert.match(music, /class="music-status-cover-open"/);
  assert.match(music, /class="music-status-play-overlay/);
  assert.match(music, /class="music-status-track-title"/);
  assert.match(music, /id="home-music-prev"/);
  assert.match(music, /id="home-music-play-pause"/);
  assert.match(music, /id="home-music-next"/);
  assert.match(music, /aspect-ratio:\s*1/);
  assert.match(music, /border-radius:\s*22px/);
  assert.match(music, /window\.__sekaiOpenPlayer\s*\?\.\(\)/);
});
