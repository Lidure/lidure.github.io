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
  assert.match(css, /--standard-accent:\s*hsl\(var\(--theme-hue,\s*255\)/);
  assert.match(css, /data-wallpaper-mode="fullscreen"/);
  assert.match(css, /--card-opacity-percent/);
  assert.match(css, /data-card-border="false"/);
  assert.match(css, /data-card-follow-theme="true"/);
});

test('Firefly-aligned visual defaults stay synchronized across preload, reset, dim, and blur lifecycle', () => {
  const layout = readSource('src/layouts/BaseLayout.astro');
  const wallpaperCss = readSource('src/styles/firefly-wallpaper-modes.css');
  const controller = readSource('src/components/FullscreenWallpaperController.astro');

  assert.match(layout, /raw\.backgroundBlur[\s\S]*?:\s*5;/);
  assert.match(layout, /raw\.themeHue[\s\S]*?:\s*255;/);
  assert.match(layout, /bridge\.write\(\{\s*themeHue:\s*255\s*\}\)/);
  assert.match(layout, /bridge\.write\(\{\s*backgroundBlur:\s*5\s*\}\)/);

  assert.match(wallpaperCss, /calc\(var\(--wallpaper-overlay,\s*0\.45\)\s*\*\s*0\.44\)/);
  assert.match(wallpaperCss, /var\(--wallpaper-blur,\s*5px\)/);

  assert.match(controller, /const blurRatio = Math\.min\(scrollY \/ 300, 1\)/);
  assert.match(controller, /blurRatio\s*>=\s*1\s*\?\s*maxBlur/);
});

test('fullscreen video follows Firefly native rendering without image blur or scale softening', () => {
  const wallpaperCss = readSource('src/styles/firefly-wallpaper-modes.css');
  const blocks = [...wallpaperCss.matchAll(/([^{}]+)\{([^{}]*)\}/g)];
  const fullscreenVideoBlocks = blocks.filter(([, selector]) =>
    selector.includes('data-wallpaper-mode="fullscreen"') && selector.includes('.slideshow-video')
  );

  assert.ok(fullscreenVideoBlocks.length > 0);
  assert.ok(fullscreenVideoBlocks.some(([, , body]) => /object-fit:\s*cover/.test(body)));
  for (const [, , body] of fullscreenVideoBlocks) {
    assert.doesNotMatch(body, /filter:\s*blur/);
    assert.doesNotMatch(body, /transform:\s*scale/);
  }
  assert.match(wallpaperCss, /data-wallpaper-mode="fullscreen"[\s\S]*?\.slideshow-canvas[\s\S]*?display:\s*none\s*!important/);
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

test('sakura effect renders drawn petals through canvas worker with a safe fallback', () => {
  const particles = readSource('src/components/SekaiParticles.astro');
  const worker = readSource('src/workers/sakura.worker.js');

  assert.match(particles, /<canvas[^>]*id="sakura-canvas"/);
  assert.match(particles, /new Worker\(new URL\(['"]\.\.\/workers\/sakura\.worker\.js['"], import\.meta\.url\)/);
  assert.match(particles, /transferControlToOffscreen/);
  assert.match(particles, /getContext\(['"]2d['"]\)/);
  assert.match(particles, /lidure:sakura-setting/);
  assert.match(particles, /prefers-reduced-motion/);
  assert.match(worker, /bezierCurveTo/);
  assert.match(worker, /MAX_PETALS\s*=\s*24/);
  assert.match(worker, /wind|sway/);
  assert.doesNotMatch(particles, /createElement\(['"]div['"]\)/);
  assert.doesNotMatch(particles, /🌸|🌷|🌹|🌺|❀/);
});

test('visual settings panel exposes dialog state, escape recovery, visible focus, and mobile viewport safety', () => {
  const panel = readSource('src/components/VisualSettingsPanel.astro');

  assert.match(panel, /aria-controls="hero-settings-panel"/);
  assert.match(panel, /aria-expanded="false"/);
  assert.match(panel, /role="dialog"/);
  assert.match(panel, /aria-labelledby="visual-settings-title"/);
  assert.match(panel, /id="visual-settings-title"/);
  assert.match(panel, /event\.key\s*===\s*['"]Escape['"]/);
  assert.match(panel, /aria-expanded/);
  assert.match(panel, /\.toggle-switch input:focus-visible \+ \.toggle-track/);
  assert.match(panel, /100dvh/);
  assert.match(panel, /safe-area-inset-bottom/);
});

test('music shortcuts keep keyboard focus visible and suppress decorative motion when requested', () => {
  const music = readSource('src/components/MusicStatusWidget.astro');

  assert.match(music, /music-status-cover-open:focus-visible/);
  assert.match(music, /music-status-play-overlay:focus-visible/);
  assert.match(music, /music-status-control:focus-visible/);
  assert.match(music, /prefers-reduced-motion:\s*reduce/);
  assert.match(music, /data-reduce-motion="true"/);
});

test('worker sakura keeps density and speed controls functional after the renderer migration', () => {
  const particles = readSource('src/components/SekaiParticles.astro');
  const worker = readSource('src/workers/sakura.worker.js');

  assert.match(particles, /sakuraDensity/);
  assert.match(particles, /sakuraSpeed/);
  assert.match(particles, /lidure:visual-settings-change/);
  assert.match(worker, /density/);
  assert.match(worker, /speedMultiplier/);
  assert.match(worker, /MAX_PETALS\s*\*\s*density/);
});
