import { describe, expect, it } from 'vitest';
import { activeAbilities, ALL_ABILITIES, findAbility, toolsFor } from '../src/abilities/index.js';
import type { CallContext } from '../src/abilities/types.js';
import { loadConfig } from '../src/config.js';
import { Store } from '../src/store.js';
import type { TakenMessage } from '../src/types.js';

const mkCtx = (over: Partial<CallContext> = {}): { ctx: CallContext; delivered: TakenMessage[] } => {
  const delivered: TakenMessage[] = [];
  const ctx: CallContext = {
    callId: 'c1', fromNumber: '+61491570006', toNumber: null, phase: 'greeter',
    config: loadConfig({ PHONEAI_PHASE: 'greeter' } as NodeJS.ProcessEnv, '/nonexistent.json'),
    store: new Store(':memory:'), sinks: [{ name: 't', async deliver(m) { delivered.push(m); } }],
    now: () => new Date('2026-11-02T10:00:00Z'), test: false, ...over,
  };
  return { ctx, delivered };
};

describe('registry', () => {
  it('nothing is offered unless the rung is customer-facing', () => {
    expect(activeAbilities('off')).toEqual([]);
    expect(activeAbilities('shadow')).toEqual([]);
  });
  it('v1 greeter offers exactly capture_message and opening_hours', () => {
    expect(toolsFor('greeter').map((t) => t.function.name).sort()).toEqual(['capture_message', 'opening_hours']);
  });
  it('stubs exist, are disabled, and are never found', () => {
    const stubs = ALL_ABILITIES.filter((a) => !a.enabled).map((a) => a.name);
    expect(stubs).toEqual(expect.arrayContaining(['order_status', 'transfer_to_human', 'book_callback']));
    for (const n of stubs) expect(findAbility(n, 'faq')).toBeNull();
  });
  it('every enabled ability has a break-it scenario file mentioning it', async () => {
    const { readdirSync, readFileSync } = await import('node:fs');
    const all = readdirSync(new URL('../robot/scenarios', import.meta.url)).map((f) => readFileSync(new URL(`../robot/scenarios/${f}`, import.meta.url), 'utf8')).join('\n');
    for (const a of ALL_ABILITIES.filter((x) => x.enabled)) expect(all).toContain(a.tool.function.name);
  });
});

describe('capture_message', () => {
  const run = (args: Record<string, unknown>, ctx: CallContext) => findAbility('capture_message', 'greeter')!.handle(args, ctx);
  it('does not save without caller_confirmed', async () => {
    const { ctx, delivered } = mkCtx();
    const r = await run({ caller_name: 'Sam', topic: 'x', caller_confirmed: false }, ctx);
    expect(r.result?.saved).toBe(false);
    expect(delivered).toHaveLength(0);
  });
  it('needs a name and a topic', async () => {
    const { ctx } = mkCtx();
    expect((await run({ caller_confirmed: true }, ctx)).result?.saved).toBe(false);
  });
  it('saves, delivers, and a second save updates the same message', async () => {
    const { ctx, delivered } = mkCtx();
    await run({ caller_name: 'Sam', topic: 'quote', caller_confirmed: true }, ctx);
    const r = await run({ caller_name: 'Sam', topic: 'quote', caller_confirmed: true, callback_email: 'sam@example.com' }, ctx);
    expect(r.result?.updated).toBe(true);
    expect(ctx.store.getMessage('c1')?.callbackEmail).toBe('sam@example.com');
    expect(delivered).toHaveLength(2);
  });
  it('test calls are stored but never delivered', async () => {
    const { ctx, delivered } = mkCtx({ test: true });
    await run({ caller_name: 'Sam', topic: 'quote', caller_confirmed: true }, ctx);
    expect(ctx.store.getMessage('c1')).not.toBeNull();
    expect(delivered).toHaveLength(0);
  });
  it('a failing sink never fails the save', async () => {
    const { ctx } = mkCtx({ sinks: [{ name: 'bad', async deliver() { throw new Error('down'); } }] });
    expect((await run({ caller_name: 'Sam', topic: 'x', caller_confirmed: true }, ctx)).result?.saved).toBe(true);
  });
});
