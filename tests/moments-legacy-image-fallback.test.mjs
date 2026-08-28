import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const bridge = readFileSync(new URL('../src/components/MomentsSnapshotPreviewBridge.astro', import.meta.url), 'utf8');

test('legacy r2.dev moment images fall back through the current media endpoint', () => {
  assert.match(bridge, /LEGACY_MEDIA_PROXY_BASE/);
  assert.match(bridge, /\.r2\.dev$/);
  assert.match(bridge, /parsed\.pathname\.replace\(\/\^\\\/+\//);
  assert.match(bridge, /dataset\.legacyMediaFallback/);
  assert.match(bridge, /addEventListener\('error',[\s\S]*true\)/);
  assert.match(bridge, /`\$\{LEGACY_MEDIA_PROXY_BASE\}\/\$\{legacyKey\}`/);
});
