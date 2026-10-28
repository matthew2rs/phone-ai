// SMOKE TEST. Imports every module and runs the offline robot scenarios with the network blocked
// and no credentials in the environment. If this passes on a clean machine, the install is sound.
import { readdirSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const realFetch = globalThis.fetch;
beforeAll(() => {
  for (const k of Object.keys(process.env)) if (k.startsWith('PHONEAI_')) delete process.env[k];
  globalThis.fetch = (() => { throw new Error('network is blocked in the smoke test'); }) as typeof fetch;
});
afterAll(() => { globalThis.fetch = realFetch; });

const walk = (dir: URL): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(new URL(`${e.name}/`, dir)) : e.name.endsWith('.ts') ? [new URL(e.name, dir).href] : []));

describe('smoke', () => {
  it('imports every source module (CLI entry points are skipped: they run on import)', async () => {
    const files = walk(new URL('../src/', import.meta.url)).filter((f) => !f.includes('/cli/'));
    expect(files.length).toBeGreaterThan(15);
    for (const f of files) await import(f);
  });
  it('boots with an empty environment into the safe state', async () => {
    const { loadConfig } = await import('../src/config.js');
    const c = loadConfig({} as NodeJS.ProcessEnv, '/nonexistent.json');
    expect(c.phase).toBe('off');
  });
  it('every robot scenario passes offline', async () => {
    const { loadScenarios, runScenario } = await import('../robot/runner.js');
    for (const s of loadScenarios()) expect((await runScenario(s)).failures, s.name).toEqual([]);
  });
  it('the Vapi client is never called by anything here', async () => {
    const { createVapiClient } = await import('../src/vapiClient.js');
    await expect(createVapiClient('k').createAssistant({})).rejects.toThrow(/network is blocked/);
  });
});
