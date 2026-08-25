from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text(encoding='utf-8')
    if old not in text:
        raise SystemExit(f'pattern not found in {path}: {old[:100]!r}')
    text = text.replace(old, new, 1)
    file.write_text(text, encoding='utf-8')


# Base layout: preload the third mode before first paint, import mode styles,
# install the fullscreen scroll controller, and render the scroll cue.
replace_once(
    'src/layouts/BaseLayout.astro',
    "import '../styles/firefly-v6-theme.css';\nimport '../styles/immersive-nav.css';",
    "import '../styles/firefly-v6-theme.css';\nimport '../styles/firefly-wallpaper-modes.css';\nimport '../styles/immersive-nav.css';",
)
replace_once(
    'src/layouts/BaseLayout.astro',
    "import PageTransitionEnhancer from '../components/PageTransitionEnhancer.astro';",
    "import PageTransitionEnhancer from '../components/PageTransitionEnhancer.astro';\nimport FullscreenWallpaperController from '../components/FullscreenWallpaperController.astro';",
)
replace_once(
    'src/layouts/BaseLayout.astro',
    "var mode = raw.wallpaperMode === 'fullscreen' ? 'fullscreen' : 'banner';",
    "var mode = raw.wallpaperMode === 'fullscreen' || raw.wallpaperMode === 'overlay' ? raw.wallpaperMode : 'banner';",
)
replace_once(
    'src/layouts/BaseLayout.astro',
    "    <PageTransitionEnhancer />\n    <MomentsPinControls />",
    "    <PageTransitionEnhancer />\n    <FullscreenWallpaperController />\n    <MomentsPinControls />",
)
replace_once(
    'src/layouts/BaseLayout.astro',
    '''        <div class="blog-banner-stage">\n          <BlogBanner title={resolvedBannerTitle} subtitle={resolvedBannerSubtitle} />\n          <BannerWaves />\n        </div>\n        <div class="standard-page-surface">''',
    '''        <div class="blog-banner-stage">\n          <BlogBanner title={resolvedBannerTitle} subtitle={resolvedBannerSubtitle} />\n          <BannerWaves />\n          <a class="fullscreen-scroll-indicator" href="#standard-page-surface" aria-label="向下浏览">\n            <span aria-hidden="true"></span>\n          </a>\n        </div>\n        <div class="standard-page-surface" id="standard-page-surface">''',
)

# Settings panel: expose three wallpaper modes and let fullscreen/overlay share
# the transparent-background controls.
replace_once(
    'src/components/VisualSettingsPanel.astro',
    '''          <div class="segmented-control wallpaper-mode-switch" role="group" aria-label="壁纸显示模式">\n            <button id="wallpaper-mode-banner" class="segment-option wallpaper-mode-option is-active" type="button" aria-pressed="true">横幅壁纸</button>\n            <button id="wallpaper-mode-fullscreen" class="segment-option wallpaper-mode-option" type="button" aria-pressed="false">全屏壁纸</button>\n          </div>''',
    '''          <div class="segmented-control three wallpaper-mode-switch" role="group" aria-label="壁纸显示模式">\n            <button id="wallpaper-mode-banner" class="segment-option wallpaper-mode-option is-active" type="button" aria-pressed="true">横幅</button>\n            <button id="wallpaper-mode-fullscreen" class="segment-option wallpaper-mode-option" type="button" aria-pressed="false">全屏</button>\n            <button id="wallpaper-mode-overlay" class="segment-option wallpaper-mode-option" type="button" aria-pressed="false">覆盖透明</button>\n          </div>''',
)
replace_once(
    'src/components/VisualSettingsPanel.astro',
    'aria-label="全屏背景模糊"',
    'aria-label="透明壁纸背景模糊"',
)
replace_once(
    'src/components/VisualSettingsPanel.astro',
    'aria-label="全屏壁纸卡片透明度"',
    'aria-label="透明壁纸卡片透明度"',
)
replace_once(
    'src/components/VisualSettingsPanel.astro',
    '''  :global(html[data-wallpaper-mode="fullscreen"]) .mode-fullscreen-only { display: grid; }\n  :global(html[data-wallpaper-mode="fullscreen"]) .mode-banner-only { display: none; }''',
    '''  :global(html[data-wallpaper-mode="fullscreen"]) .mode-fullscreen-only,\n  :global(html[data-wallpaper-mode="overlay"]) .mode-fullscreen-only { display: grid; }\n  :global(html[data-wallpaper-mode="fullscreen"]) .mode-banner-only,\n  :global(html[data-wallpaper-mode="overlay"]) .mode-banner-only { display: none; }''',
)
replace_once(
    'src/components/VisualSettingsPanel.astro',
    '''      var mode = settings.wallpaperMode === 'fullscreen' ? 'fullscreen' : 'banner';\n      var bannerButton = document.getElementById('wallpaper-mode-banner');\n      var fullscreenButton = document.getElementById('wallpaper-mode-fullscreen');\n      if (bannerButton) { bannerButton.classList.toggle('is-active', mode === 'banner'); bannerButton.setAttribute('aria-pressed', String(mode === 'banner')); }\n      if (fullscreenButton) { fullscreenButton.classList.toggle('is-active', mode === 'fullscreen'); fullscreenButton.setAttribute('aria-pressed', String(mode === 'fullscreen')); }''',
    '''      var mode = settings.wallpaperMode === 'fullscreen' || settings.wallpaperMode === 'overlay' ? settings.wallpaperMode : 'banner';\n      var bannerButton = document.getElementById('wallpaper-mode-banner');\n      var fullscreenButton = document.getElementById('wallpaper-mode-fullscreen');\n      var overlayButton = document.getElementById('wallpaper-mode-overlay');\n      if (bannerButton) { bannerButton.classList.toggle('is-active', mode === 'banner'); bannerButton.setAttribute('aria-pressed', String(mode === 'banner')); }\n      if (fullscreenButton) { fullscreenButton.classList.toggle('is-active', mode === 'fullscreen'); fullscreenButton.setAttribute('aria-pressed', String(mode === 'fullscreen')); }\n      if (overlayButton) { overlayButton.classList.toggle('is-active', mode === 'overlay'); overlayButton.setAttribute('aria-pressed', String(mode === 'overlay')); }''',
)
replace_once(
    'src/components/VisualSettingsPanel.astro',
    '''    document.getElementById('wallpaper-mode-banner')?.addEventListener('click', function () { sync(writeSettings({ wallpaperMode: 'banner' })); }, options);\n    document.getElementById('wallpaper-mode-fullscreen')?.addEventListener('click', function () { sync(writeSettings({ wallpaperMode: 'fullscreen' })); }, options);''',
    '''    document.getElementById('wallpaper-mode-banner')?.addEventListener('click', function () { sync(writeSettings({ wallpaperMode: 'banner' })); }, options);\n    document.getElementById('wallpaper-mode-fullscreen')?.addEventListener('click', function () { sync(writeSettings({ wallpaperMode: 'fullscreen' })); }, options);\n    document.getElementById('wallpaper-mode-overlay')?.addEventListener('click', function () { sync(writeSettings({ wallpaperMode: 'overlay' })); }, options);''',
)

print('Firefly wallpaper mode patches applied.')
