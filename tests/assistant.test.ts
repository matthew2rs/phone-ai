import { describe, expect, it } from 'vitest';
import { buildAssistantConfig, buildSystemPrompt } from '../src/assistant.js';
import { loadConfig } from '../src/config.js';
import { DISCLOSURE_MARKER } from '../src/guardrails.js';

const config = loadConfig({ PHONEAI_BUSINESS_NAME: 'Test Shop', PHONEAI_PUBLIC_URL: 'https://example.com/', PHONEAI_VOICE_ID: 'voice-1', PHONEAI_VAPI_WEBHOOK_SECRET: 'abc' } as NodeJS.ProcessEnv, '/nonexistent.json');

describe('assistant config', () => {
  const a = buildAssistantConfig(config) as any;
  it('opens with the AI disclosure and the recording notice', () => {
    expect(DISCLOSURE_MARKER.test(a.firstMessage)).toBe(true);
    expect(a.firstMessage).toContain('Calls are recorded');
  });
  it('offers only the two v1 tools', () => {
    expect(a.model.tools.map((t: any) => t.function.name).sort()).toEqual(['capture_message', 'opening_hours']);
  });
  it('points Vapi at the webhook with the secret and the goodbye as its own end message', () => {
    expect(a.server.url).toBe('https://example.com/webhooks/vapi');
    expect(a.endCallMessage).toBe(config.goodbye);
  });
  it('prompt carries the hard rules and never asks for the number they rang from', () => {
    const p = buildSystemPrompt(config);
    expect(p).toContain('ABSOLUTE RULES');
    expect(p).toContain('Do NOT ask for their phone number');
    expect(p).not.toMatch(/transfer_to_human/);
  });
  it('test assistants are marked', () => {
    expect((buildAssistantConfig(config, { test: true }) as any).metadata.phoneai_test).toBe(true);
  });
});
