import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { createSyncGenerationGate } from '../src/lib/gallery-manage-controller.mjs';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('controller keeps GitHub token in runtime memory only', async () => {
  const source = await read('src/lib/gallery-manage-controller.mjs');
  assert.doesNotMatch(source, /localStorage|sessionStorage|document\.cookie/);
  assert.doesNotMatch(source, /console\.(?:log|info|warn|error)\([^\n]*token/i);
  assert.match(source, /let\s+token\s*=\s*['"]['"]/);
  assert.match(source, /token\s*=\s*['"]['"]/);
});

test('sync generation gate rejects stale completion', () => {
  const gate = createSyncGenerationGate();
  const first = gate.next();
  const second = gate.next();
  assert.equal(gate.isCurrent(first), false);
  assert.equal(gate.isCurrent(second), true);
});

test('native controller imports transaction core instead of implementing ref ordering itself', async () => {
  const source = await read('src/lib/gallery-manage-controller.mjs');
  assert.match(source, /commitGitHubUploadTransaction/);
  assert.match(source, /commitGitHubDeleteTransaction/);
  assert.doesNotMatch(source, /git\/refs\/heads/);
});
