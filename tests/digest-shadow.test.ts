import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config.js';
import { buildDigest } from '../src/digest.js';
import { reviewTranscript } from '../src/shadow/review.js';
import { Store } from '../src/store.js';

describe('digest', () => {
  it('puts calls with no saved message under NEEDS A LOOK', () => {
    const store = new Store(':memory:');
    const config = loadConfig({} as NodeJS.ProcessEnv, '/nonexistent.json');
    store.recordCall({ callId: 'bad1', from: '+61491570006', to: null, phase: 'greeter', test: false, startedAt: null, endedAt: '2026-11-02T09:00:00Z', durationSeconds: 45, endedReason: 'customer-ended-call', costUsd: 0.1, summary: 'hung up', transcript: null, disclosed: true, escapeRequested: false, messageSaved: false, passedOnTooEarly: null });
    store.recordCall({ callId: 'ok1', from: null, to: null, phase: 'greeter', test: false, startedAt: null, endedAt: '2026-11-02T09:30:00Z', durationSeconds: 80, endedReason: null, costUsd: 0.2, summary: 'took a message', transcript: null, disclosed: true, escapeRequested: false, messageSaved: true, passedOnTooEarly: null });
    const d = buildDigest(config, store, new Date('2026-11-02T12:00:00Z'));
    expect(d.red).toBe(1);
    expect(d.text).toContain('NEEDS A LOOK (1)');
    expect(d.text).toContain('bad1');
  });
});

describe('shadow review', () => {
  it('flags person-only topics and finds numbers and emails', () => {
    const r = reviewTranscript('Hi this is Sam, my unit is faulty, call 0491 570 006 or sam@example.com');
    expect(r.needsPerson).toBe(true);
    expect(r.numbersFound).toEqual(['+61491570006']);
    expect(r.emailsFound).toEqual(['sam@example.com']);
  });
  it('a plain message is fine', () => {
    expect(reviewTranscript('Just ringing to ask what time you open').needsPerson).toBe(false);
  });
});
