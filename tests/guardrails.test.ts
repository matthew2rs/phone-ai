import { describe, expect, it } from 'vitest';
import { BANNED_PHRASES, callerAskedForHuman, disclosureGreeting, DISCLOSURE_MARKER, HARD_RULES, shouldEscalate } from '../src/guardrails.js';

describe('guardrails', () => {
  it('greeting discloses AI and the recording, and ends on a question', () => {
    const g = disclosureGreeting('Example Business', 'Alex');
    expect(DISCLOSURE_MARKER.test(g)).toBe(true);
    expect(g).toContain('Calls are recorded');
    expect(g.trim().endsWith('?')).toBe(true);
  });
  it('detects a request for a person', () => {
    expect(callerAskedForHuman('can I talk to a real person')).toBe(true);
    expect(callerAskedForHuman('what time do you open')).toBe(false);
  });
  it.each(['I want a refund', 'is this under warranty', 'who is your supplier', 'what is your markup', 'I will call my lawyer'])('escalates "%s"', (u) => expect(shouldEscalate(u)).toBe(true));
  it.each(['what time do you open', 'my name is Sam', 'it is about a delivery'])('does not escalate "%s"', (u) => expect(shouldEscalate(u)).toBe(false));
  it('hard rules never name a transfer tool (the greeter cannot transfer, so it must not be told it can)', () => {
    expect(HARD_RULES).not.toMatch(/transfer_to_human/);
    for (const p of BANNED_PHRASES) expect(HARD_RULES).toContain(`"${p}"`);
  });
});
