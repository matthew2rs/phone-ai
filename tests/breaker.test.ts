import { describe, expect, it } from 'vitest';
import { afterCall, breakerState, callFailed, type BreakerDeps } from '../src/breaker.js';
import { loadConfig } from '../src/config.js';
import { effectivePhase } from '../src/ladder.js';
import { Store } from '../src/store.js';

const mk = (env: Record<string, string> = {}) => {
  const config = loadConfig({ PHONEAI_PHASE: 'greeter', PHONEAI_VAPI_PHONE_NUMBER_ID: 'num1', ...env } as NodeJS.ProcessEnv, '/nonexistent.json');
  const store = new Store(':memory:');
  const notices: string[] = [];
  const detach: Array<string | null> = [];
  const d: BreakerDeps = {
    config, store,
    notifier: { async send(s) { notices.push(s); } },
    vapi: { createAssistant: async () => ({ id: 'a' }), updateAssistant: async () => ({ id: 'a' }), setNumberAssistant: async (_n, a) => { detach.push(a); } },
    now: () => new Date('2026-11-02T10:00:00Z'),
  };
  return { d, notices, detach, store, config };
};

describe('breaker', () => {
  it('classifies failures', () => {
    expect(callFailed('pipeline-error-openai', 60)).toBe(true);
    expect(callFailed('customer-ended-call', 3)).toBe(true);
    expect(callFailed('customer-ended-call', 90)).toBe(false);
  });
  it('trips on 3 inside an hour', () => {
    const n = 1_000_000;
    expect(breakerState([n - 10, n - 20], n).tripped).toBe(false);
    expect(breakerState([n - 10, n - 20, n - 30], n).tripped).toBe(true);
    expect(breakerState([n - 4_000_000, n - 20, n - 30], n).tripped).toBe(false);
  });
  it('three failed calls switch the AI off, detach the number and tell the operator', async () => {
    const { d, notices, detach, store, config } = mk();
    for (let i = 0; i < 3; i++) await afterCall({ failed: true, costUsd: 0, test: false }, d);
    expect(effectivePhase(config, store)).toBe('off');
    expect(detach).toEqual([null]);
    expect(notices.some((n) => n.includes('switched itself OFF'))).toBe(true);
  });
  it('test calls never count', async () => {
    const { d, store, config } = mk();
    for (let i = 0; i < 5; i++) await afterCall({ failed: true, costUsd: 0, test: true }, d);
    expect(effectivePhase(config, store)).toBe('greeter');
  });
  it('the cost cap switches it off', async () => {
    const { d, store, config } = mk({ PHONEAI_DAILY_COST_CAP_USD: '1' });
    store.recordCall({ callId: 'c1', from: null, to: null, phase: 'greeter', test: false, startedAt: null, endedAt: '2026-11-02T09:00:00Z', durationSeconds: 60, endedReason: null, costUsd: 1.5, summary: null, transcript: null, disclosed: true, escapeRequested: false, messageSaved: true, passedOnTooEarly: null });
    await afterCall({ failed: false, costUsd: 1.5, test: false }, d);
    expect(effectivePhase(config, store)).toBe('off');
  });
  it('an override can only lower the phase, never raise it', () => {
    const { store } = mk();
    const off = loadConfig({ PHONEAI_PHASE: 'off' } as NodeJS.ProcessEnv, '/nonexistent.json');
    store.setKv('phase_override', 'greeter');
    expect(effectivePhase(off, store)).toBe('off');
    store.setKv('phase_override', 'garbage');
    expect(effectivePhase(off, store)).toBe('off');
  });
});
