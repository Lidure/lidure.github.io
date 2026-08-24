function readBalancedDestination(markdown, openIndex) {
  let depth = 1;
  let escaped = false;
  let value = '';

  for (let i = openIndex + 1; i < markdown.length; i += 1) {
    const char = markdown[i];
    if (escaped) {
      value += char;
      escaped = false;
      continue;
    }
    if (char === '\\') {
      value += char;
      escaped = true;
      continue;
    }
    if (char === '(') {
      depth += 1;
      value += char;
      continue;
    }
    if (char === ')') {
      depth -= 1;
      if (depth === 0) return value.trim();
      value += char;
      continue;
    }
    value += char;
  }

  return '';
}

function stripOptionalTitle(destination) {
  const trimmed = destination.trim();
  if (trimmed.startsWith('<')) {
    const close = trimmed.indexOf('>');
    return close > 0 ? trimmed.slice(1, close).trim() : '';
  }

  let escaped = false;
  for (let i = 0; i < trimmed.length; i += 1) {
    const char = trimmed[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === '\\') {
      escaped = true;
      continue;
    }
    if (/\s/.test(char)) return trimmed.slice(0, i).trim();
  }
  return trimmed;
}

export function extractFirstMarkdownImage(markdown = '') {
  const source = String(markdown || '');
  let cursor = 0;

  while (cursor < source.length) {
    const marker = source.indexOf('![', cursor);
    if (marker < 0) return '';

    const altClose = source.indexOf(']', marker + 2);
    if (altClose < 0) return '';

    let open = altClose + 1;
    while (open < source.length && /\s/.test(source[open])) open += 1;
    if (source[open] !== '(') {
      cursor = altClose + 1;
      continue;
    }

    const balanced = readBalancedDestination(source, open);
    const destination = stripOptionalTitle(balanced);
    if (destination) return destination;
    cursor = open + 1;
  }

  return '';
}

function isDirectBrowserUrl(value) {
  return /^(?:[a-z][a-z\d+.-]*:|\/\/|\/)/i.test(value);
}

function normalizeBlogAssetKey(postId, destination) {
  const cleanDestination = destination.split(/[?#]/, 1)[0];
  const postParts = String(postId || '').replace(/\\/g, '/').split('/');
  postParts.pop();

  const parts = [...postParts, ...cleanDestination.replace(/\\/g, '/').split('/')];
  const normalized = [];
  for (const part of parts) {
    if (!part || part === '.') continue;
    if (part === '..') {
      if (normalized.length === 0) return '';
      normalized.pop();
      continue;
    }
    normalized.push(part);
  }

  return `../content/blog/${normalized.join('/')}`;
}

function resolveCandidate(candidate, postId, assets) {
  const value = String(candidate || '').trim();
  if (!value) return '';
  if (isDirectBrowserUrl(value)) return value;

  const key = normalizeBlogAssetKey(postId, value);
  if (!key) return '';
  return typeof assets?.[key] === 'string' ? assets[key] : '';
}

export function resolvePostCover({ cover = '', body = '', postId = '', assets = {} } = {}) {
  const explicit = resolveCandidate(cover, postId, assets);
  if (explicit) return explicit;

  const firstImage = extractFirstMarkdownImage(body);
  return resolveCandidate(firstImage, postId, assets);
}
