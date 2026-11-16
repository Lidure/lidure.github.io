import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';

const source = readFileSync(new URL('../src/lib/moments-api.ts', import.meta.url), 'utf8').replace('import.meta.env.PUBLIC_MOMENTS_API', 'undefined');
const code = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
const api = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);

test('moments share in-flight reads, isolate consumers, invalidate writes and reject stale cache fills', async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  let resolveRead;
  globalThis.fetch = async (_url, options) => {
    calls++;
    if (options.method === 'DELETE') return Response.json({});
    return new Promise(resolve => { resolveRead = () => resolve(Response.json({ items: [{ id: 'one', text: 'original' }] })); });
  };
  try {
    const controller = new AbortController();
    const one = api.fetchMoments({ signal: controller.signal });
    const two = api.fetchMoments();
    assert.equal(calls, 1);
    controller.abort();
    resolveRead();
    await assert.rejects(one, { name: 'AbortError' });
    const result = await two;
    result.items[0].text = 'changed';
    assert.equal(api.getCachedMoments().items[0].text, 'original');
    const oldRead = api.fetchMoments();
    await api.deleteMoment('one');
    assert.equal(api.getCachedMoments(), null);
    resolveRead();
    await oldRead;
    assert.equal(api.getCachedMoments(), null);
    const newRead = api.fetchMoments();
    resolveRead();
    await newRead;
    assert.equal(api.getCachedMoments().items[0].id, 'one');
  } finally { globalThis.fetch = originalFetch; }
});
