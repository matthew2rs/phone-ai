import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config.js';

describe('config', () => {
  it('defaults are safe: off, low cap, nothing outbound', () => {
    const c = loadConfig({} as NodeJS.ProcessEnv, '/nonexistent.json');
    expect(c.phase).toBe('off');
    expect(c.dailyCostCapUsd).toBe(10);
    expect(c.webhookSecret).toBeNull();
    expect(c.smtp).toBeNull();
  });
  it('a typo in the phase can never turn it on', () => {
    expect(loadConfig({ PHONEAI_PHASE: 'gretaer' } as NodeJS.ProcessEnv, '/nonexistent.json').phase).toBe('off');
  });
  it('env beats file beats default', () => {
    const dir = mkdtempSync(join(tmpdir(), 'phoneai-'));
    const f = join(dir, 'c.json');
    writeFileSync(f, JSON.stringify({ businessName: 'From File', assistantName: 'FileBot' }));
    const c = loadConfig({ PHONEAI_BUSINESS_NAME: 'From Env' } as NodeJS.ProcessEnv, f);
    expect(c.businessName).toBe('From Env');
    expect(c.assistantName).toBe('FileBot');
  });
  it('a nonsense cost cap falls back to the default', () => {
    expect(loadConfig({ PHONEAI_DAILY_COST_CAP_USD: '-5' } as NodeJS.ProcessEnv, '/nonexistent.json').dailyCostCapUsd).toBe(10);
  });
});

describe('config: unset values', () => {
  it('an untouched <PLACEHOLDER> or empty value is treated as not set', () => {
    const c = loadConfig({ PHONEAI_NOTIFY_EMAIL_TO: '<YOUR_EMAIL>', PHONEAI_VAPI_ASSISTANT_ID: '', PHONEAI_BUSINESS_NAME: '' } as NodeJS.ProcessEnv, '/nonexistent.json');
    expect(c.notifyEmailTo).toBeNull();
    expect(c.assistantId).toBeNull();
    expect(c.businessName).toBe('Example Business');
  });
  it('an empty env value does not wipe the config file', () => {
    const dir = mkdtempSync(join(tmpdir(), 'phoneai-'));
    const f = join(dir, 'c.json');
    writeFileSync(f, JSON.stringify({ businessName: 'From File' }));
    expect(loadConfig({ PHONEAI_BUSINESS_NAME: '' } as NodeJS.ProcessEnv, f).businessName).toBe('From File');
  });
});
