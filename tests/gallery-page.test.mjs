import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('gallery route joins Blog navigation and responsive styling', async () => {
  const [page, header, css] = await Promise.all([
    read('src/pages/gallery.astro'),
    read('src/components/SiteHeader.astro'),
    read('src/styles/gallery.css'),
  ]);
  assert.match(header, /href:\s*['"]\/gallery['"][^}]*label:\s*['"]画廊['"]/);
  assert.match(page, /BaseLayout/);
  assert.match(page, /GalleryBrowser/);
  assert.match(page, /GalleryLightbox/);
  assert.doesNotMatch(page, /GalleryManager/);
  assert.match(page, /gallery-manage-entry\.mjs/);
  assert.match(page, /gallery\.css/);
  assert.match(css, /\.gallery-grid/);
  assert.match(css, /grid-template-columns/);
  assert.match(css, /repeat\(5,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(css, /@media \(max-width:\s*1180px\)[\s\S]*repeat\(4,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(css, /@media \(max-width:\s*900px\)[\s\S]*repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(css, /@media \(max-width:\s*720px\)[\s\S]*repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(css, /@media \(max-width:\s*720px\)[\s\S]*\.gallery-filter-panel\s*\{[^}]*padding:\s*10px 12px 11px/s);
  assert.match(css, /@media \(prefers-reduced-motion:\s*reduce\)/);
  assert.match(css, /\.gallery-lightbox/);
});

test('public Gallery exposes a visible native management entry beside refresh', async () => {
  const [component, css] = await Promise.all([
    read('src/components/GalleryBrowser.astro'),
    read('src/styles/gallery.css'),
  ]);
  const styles = `${component}\n${css}`;

  assert.match(component, /class="gallery-hero-actions"/);
  assert.match(component, /href="\/gallery\/manage"[^>]*class="gallery-manage-link"/);
  assert.match(component, />图库管理<\/a>/);
  assert.match(styles, /\.gallery-hero-actions\s*\{[^}]*display:\s*flex\s*;[^}]*align-items:\s*center\s*;/s);
  assert.match(styles, /\.gallery-manage-link\s*\{[^}]*display:\s*inline-flex\s*;[^}]*align-items:\s*center\s*;[^}]*justify-content:\s*center\s*;/s);
});

test('native Gallery management route is standalone and iframe-free', async () => {
  const [page, workspace, css] = await Promise.all([
    read('src/pages/gallery/manage.astro'),
    read('src/components/GalleryManageWorkspace.astro'),
    read('src/styles/gallery-manage.css'),
  ]);
  assert.match(page, /BaseLayout/);
  assert.match(page, /GalleryManageWorkspace/);
  assert.match(workspace, /gallery-manage-root/);
  assert.match(workspace, /gallery-manage-dialog/);
  assert.doesNotMatch(`${page}\n${workspace}`, /<iframe/i);
  assert.match(css, /\.gallery-manage-layout/);
  assert.match(css, /grid-template-columns:\s*minmax\(260px,\s*330px\)\s*minmax\(0,\s*1fr\)/);
});

test('mobile management categories are discoverable in a wrapped list with an expand control', async () => {
  const [workspace, controller, css] = await Promise.all([
    read('src/components/GalleryManageWorkspace.astro'),
    read('src/lib/gallery-manage-controller.mjs'),
    read('src/styles/gallery-manage.css'),
  ]);

  assert.match(workspace, /id="gallery-manage-categories-toggle"/);
  assert.match(workspace, /aria-controls="gallery-manage-categories"/);
  assert.match(css, /\.gallery-manage-categories\s*\{[^}]*\bflex-wrap:\s*wrap\s*;/s);
  assert.match(css, /@media \(max-width:\s*700px\)[\s\S]*\.gallery-manage-categories\s*\{[^}]*\bmax-height:\s*76px\s*;[^}]*\boverflow:\s*hidden\s*;/s);
  assert.match(css, /\.gallery-manage-categories\.is-expanded\s*\{[^}]*max-height:\s*none\s*;/s);
  assert.match(css, /\.gallery-manage-categories-toggle/);
  assert.match(controller, /categoriesExpanded:\s*false/);
  assert.match(controller, /function updateCategoryToggle\(\)/);
  assert.match(controller, /scrollHeight\s*>\s*categoryNav\.clientHeight\s*\+\s*1/);
  assert.match(controller, /state\.categoriesExpanded\s*=\s*false/);
  assert.match(controller, /if \(categoriesToggle\) listen\(categoriesToggle, ['"]click['"], onCategoriesToggle\)/);
  assert.match(controller, /listen\(win, ['"]resize['"], updateCategoryToggle\)/);
  assert.match(controller, /展开全部分类/);
});

test('mobile management image grid matches the public gallery three-column layout', async () => {
  const [manageCss, galleryCss] = await Promise.all([
    read('src/styles/gallery-manage.css'),
    read('src/styles/gallery.css'),
  ]);

  assert.match(
    manageCss,
    /@media \(max-width:\s*700px\)[\s\S]*\.gallery-manage-grid\s*\{[^}]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)\s*;[^}]*gap:\s*8px\s*;/s,
  );
  assert.match(
    manageCss,
    /@media \(max-width:\s*390px\)[\s\S]*\.gallery-manage-grid\s*\{[^}]*gap:\s*6px\s*;/s,
  );
  assert.match(
    galleryCss,
    /@media \(max-width:\s*720px\)[\s\S]*\.gallery-grid\s*\{[^}]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)\s*;[^}]*gap:\s*8px\s*;/s,
  );
  assert.match(
    galleryCss,
    /@media \(max-width:\s*390px\)[\s\S]*\.gallery-grid\s*\{[^}]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)\s*;[^}]*gap:\s*6px\s*;/s,
  );
});

test('Gallery management hero buttons share true vertical centering', async () => {
  const css = await read('src/styles/gallery-manage.css');
  assert.match(
    css,
    /\.gallery-manage-button\s*\{[^}]*display:\s*inline-flex\s*;[^}]*align-items:\s*center\s*;[^}]*justify-content:\s*center\s*;[^}]*line-height:\s*1\s*;/s,
  );
});

test('gallery shell neutralizes Grid automatic minimum sizing', async () => {
  const css = await read('src/styles/gallery.css');
  assert.match(
    css,
    /\.gallery-page-shell\s*\{[^}]*\bmin-width:\s*0\s*;/s,
    'the page shell must allow the parent Grid track to shrink instead of using the category strip min-content width',
  );
});

test('gallery categories are discoverable in a wrapped mobile list with an expand control', async () => {
  const [component, css, controller] = await Promise.all([
    read('src/components/GalleryBrowser.astro'),
    read('src/styles/gallery.css'),
    read('src/lib/gallery-browser-controller.mjs'),
  ]);

  assert.match(component, /class="gallery-filter-panel"/);
  assert.match(component, /class="gallery-filter-heading"/);
  assert.match(component, /id="gallery-categories-toggle"/);
  assert.match(component, /aria-controls="gallery-category-tabs"/);
  assert.match(css, /\.gallery-category-tabs\s*\{[^}]*\bflex-wrap:\s*wrap\s*;/s);
  assert.match(css, /@media \(max-width:\s*720px\)[\s\S]*\.gallery-category-tabs\s*\{[^}]*\bflex-wrap:\s*wrap\s*;[^}]*\bmax-height:\s*76px\s*;[^}]*\boverflow:\s*hidden\s*;/s);
  assert.match(css, /\.gallery-category-tabs\.is-expanded\s*\{[^}]*max-height:\s*none\s*;/s);
  assert.match(css, /\.gallery-categories-toggle/);
  assert.doesNotMatch(css, /\.gallery-category-tabs\s*\{[^}]*\boverflow-x:\s*auto\s*;/s);
  assert.match(controller, /scrollHeight\s*>\s*tabs\.clientHeight\s*\+\s*1/);
  assert.match(controller, /categoriesToggle\?\.addEventListener\(['"]click['"],\s*onCategoriesToggle\)/);
  assert.match(controller, /展开全部分类/);
  assert.match(css, /@media \(max-width:\s*720px\)[\s\S]*\.gallery-filter-heading\s*>\s*p\s*\{[^}]*display:\s*none\s*;/s);
});


test('mobile management workspace expands horizontally and keeps card actions visible', async () => {
  const [manageCss, componentCss] = await Promise.all([
    read('src/styles/gallery-manage.css'),
    read('src/styles/gallery-manage-components.css'),
  ]);

  assert.match(
    manageCss,
    /@media \\(max-width:\\s*700px\\)[\\s\\S]*?\\.gallery-manage-page-shell\\s*\\{[^}]*width:\\s*calc\\(100%\\s*\\+\\s*20px\\)[^}]*margin-inline:\\s*-10px[^}]*padding-inline:\\s*4px/s,
  );
  assert.match(
    manageCss,
    /@media \\(max-width:\\s*390px\\)[\\s\\S]*?\\.gallery-manage-page-shell\\s*\\{[^}]*width:\\s*calc\\(100%\\s*\\+\\s*24px\\)[^}]*margin-inline:\\s*-12px[^}]*padding-inline:\\s*4px/s,
  );
  assert.match(
    manageCss,
    /@media \\(max-width:\\s*700px\\)[\\s\\S]*?\\.gallery-manage-panel\\s*\\{[^}]*padding:\\s*12px/s,
  );
  assert.match(
    componentCss,
    /@media \\(max-width:\\s*700px\\)[\\s\\S]*\\.gallery-manage-card-actions\\s*\\{[^}]*display:\\s*grid[^}]*grid-template-columns:\\s*repeat\\(2,\\s*minmax\\(0,\\s*1fr\\)\\)[^}]*width:\\s*100%/s,
  );
  assert.match(
    componentCss,
    /\\.gallery-manage-card-actions button:first-child\\s*\\{[^}]*grid-column:\\s*1\\s*\\/\\s*-1/s,
  );
  assert.match(
    componentCss,
    /@media \\(max-width:\\s*700px\\)[\\s\\S]*?\\.gallery-manage-card-actions button\\s*\\{[^}]*min-width:\\s*0[^}]*white-space:\\s*nowrap/s,
  );
});
