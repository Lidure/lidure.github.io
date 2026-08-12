import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';

const sourceUrl = new URL('../src/lib/video-poster.ts', import.meta.url);

async function importVideoPosterModule() {
  const source = readFileSync(sourceUrl, 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
}

test('choosePosterTime falls back to 0.1 seconds for invalid duration', async () => {
  const { choosePosterTime } = await importVideoPosterModule();

  assert.equal(choosePosterTime(Number.NaN, 2), 0.1);
  assert.equal(choosePosterTime(0, 2), 0.1);
  assert.equal(choosePosterTime(-4, 2), 0.1);
});

test('choosePosterTime clamps requested time inside a safe video range', async () => {
  const { choosePosterTime } = await importVideoPosterModule();

  assert.equal(choosePosterTime(10, -1), 0.1);
  assert.equal(choosePosterTime(10, 0), 0.1);
  assert.equal(choosePosterTime(10, 3.25), 3.25);
  assert.equal(choosePosterTime(10, 20), 9.9);
  assert.equal(choosePosterTime(0.15, 20), 0.1);
});
