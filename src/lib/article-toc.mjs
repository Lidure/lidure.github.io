export function buildArticleToc(headings = []) {
  return headings
    .filter((heading) => heading && (heading.depth === 2 || heading.depth === 3))
    .map(({ depth, slug, text }) => ({ depth, slug, text }));
}

export function shouldShowArticleToc(entries = []) {
  return entries.length >= 2;
}
