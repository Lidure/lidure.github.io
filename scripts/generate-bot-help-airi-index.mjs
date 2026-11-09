/**
 * Build the public Airi command-search index from the Airi manual itself.
 * No separate hand-maintained command list: new help entries stay searchable.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const input = path.join(root, 'public/bot-help/airi/index.html');
const output = path.join(root, 'public/bot-help/airi-search-index.json');
const html = readFileSync(input, 'utf8');

function getAttr(tag, name) {
  const match = tag.match(new RegExp('\\b' + name + '="([^"]*)"'));
  return match ? match[1] : '';
}
function decodeText(value) {
  return value.replace(/&amp;/g, '&').replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();
}

const tools = [];
const seen = new Set();
for (const match of html.matchAll(/<article\b[^>]*\bdata-tool="[^"]+"[^>]*>/g)) {
  const tag = match[0];
  const slug = getAttr(tag, 'data-tool');
  const id = getAttr(tag, 'id');
  if (!/^[a-z0-9-]+$/.test(slug) || id !== 'tool-' + slug || seen.has(id)) {
    throw new Error('Airi manual has a missing, duplicate, or invalid tool anchor: ' + slug);
  }
  seen.add(id);
  const closing = html.indexOf('</article>', match.index + tag.length);
  if (closing < 0) throw new Error('Missing closing article for ' + id);
  const body = html.slice(match.index + tag.length, closing);
  const title = decodeText(body.match(/<h3>([^<]+)<\/h3>/)?.[1] || '');
  if (!title) throw new Error('Missing Airi tool title: ' + id);
  const commands = [...new Set(
    [...body.matchAll(/\bdata-copy="([^"]+)"/g)].map(m => decodeText(m[1]))
  )].filter(Boolean);
  tools.push({
    id,
    title,
    keywords: decodeText(getAttr(tag, 'data-search')),
    commands,
  });
}
if (tools.length !== 24) {
  throw new Error('Expected 24 Airi functions, found ' + tools.length);
}
writeFileSync(output, JSON.stringify({ version: 1, tools }, null, 2) + '\n');
console.log('Generated Airi search index (' + tools.length + ' functions, ' +
  tools.reduce((sum, tool) => sum + tool.commands.length, 0) + ' commands).');
