import type { AddressInfo } from 'node:net';
import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config.js';
import { createApp } from '../src/server.js';
import { Store } from '../src/store.js';
import { handleVapiBody, type Deps } from '../src/webhook.js';

const mkDeps = (env: Record<string, string>): Deps => ({
  config: loadConfig({ PHONEAI_DB_PATH: ':memory:', ...env } as NodeJS.ProcessEnv, '/nonexistent.json'),
  store: new Store(':memory:'), sinks: [], notifier: { async send() {} }, vapi: null, now: () => new Date('2026-11-02T10:00:00Z'),
});
const toolCall = { message: { type: 'tool-calls', call: { id: 'x' }, toolCallList: [{ id: 't', name: 'capture_message', arguments: { caller_name: 'S', topic: 'x', caller_confirmed: true } }] } };

describe('webhook', () => {
  it('is inert while the phase is off: no tool ever runs', async () => {
    const d = mkDeps({ PHONEAI_PHASE: 'off' });
    expect(await handleVapiBody(toolCall, d)).toEqual({ results: [] });
    expect(d.store.getMessage('x')).toBeNull();
  });
  it('accepts the older tool-call shape too', async () => {
    const d = mkDeps({ PHONEAI_PHASE: 'greeter' });
    const old = { message: { type: 'tool-calls', call: { id: 'y' }, toolCalls: [{ id: 't', function: { name: 'capture_message', arguments: JSON.stringify({ caller_name: 'S', topic: 'x', caller_confirmed: true }) } }] } };
    const r = (await handleVapiBody(old, d)) as { results: Array<{ result: string }> };
    expect(JSON.parse(r.results[0].result).saved).toBe(true);
  });
  it('never throws on garbage', async () => {
    const d = mkDeps({ PHONEAI_PHASE: 'greeter' });
    for (const g of [null, undefined, 42, 'x', { message: { type: 'tool-calls', toolCallList: 'nope' } }]) await expect(handleVapiBody(g, d)).resolves.toBeDefined();
  });
});

describe('http', () => {
  const serve = async (env: Record<string, string>) => {
    const app = createApp(mkDeps({ PHONEAI_PHASE: 'greeter', ...env }));
    const server = app.listen(0, '127.0.0.1');
    await new Promise((r) => server.once('listening', r));
    return { server, url: `http://127.0.0.1:${(server.address() as AddressInfo).port}` };
  };
  it('route does not exist without a secret', async () => {
    const { server, url } = await serve({});
    const r = await fetch(`${url}/webhooks/vapi`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(toolCall) });
    expect(r.status).toBe(404);
    server.close();
  });
  it('rejects a wrong secret and accepts the right one', async () => {
    const { server, url } = await serve({ PHONEAI_VAPI_WEBHOOK_SECRET: 's3cret' });
    const bad = await fetch(`${url}/webhooks/vapi`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-vapi-secret': 'nope' }, body: '{}' });
    expect(bad.status).toBe(401);
    const good = await fetch(`${url}/webhooks/vapi`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-vapi-secret': 's3cret' }, body: JSON.stringify(toolCall) });
    expect(good.status).toBe(200);
    server.close();
  });
});
