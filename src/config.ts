// Config. Precedence: environment variable > phone-ai.config.json > default.
// Every default is the safe one: phase 'off', a low daily cost cap, no outbound anything.
import { existsSync, readFileSync } from 'node:fs';
import type { Phase, Region } from './types.js';
import { PHASES } from './types.js';
import { parseHours, type Hours } from './hours.js';

export interface Config {
  phase: Phase;
  businessName: string;
  assistantName: string;
  timezone: string;
  region: Region;
  hours: Hours | null;
  sink: 'sqlite' | 'webhook';
  sinkWebhookUrl: string | null;
  dbPath: string;
  dailyCostCapUsd: number;
  vapiApiKey: string | null;
  webhookSecret: string | null;
  vapiPhoneNumberId: string | null;
  assistantId: string | null;
  /** The TEST assistant has its own slot so a test run can never overwrite the live one. */
  testAssistantId: string | null;
  publicUrl: string | null;
  voiceProvider: string;
  voiceId: string | null;
  model: { provider: string; model: string };
  /** What the AI knows about your business, in plain sentences. Never prices, stock or promises. */
  brief: string;
  goodbye: string;
  notifyEmailTo: string | null;
  smtp: { host: string; port: number; user: string | null; pass: string | null; from: string } | null;
  port: number;
  autoDetach: boolean;
}

type Raw = Record<string, unknown>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env, configPath?: string): Config {
  const path = configPath ?? env.PHONEAI_CONFIG ?? 'phone-ai.config.json';
  let file: Raw = {};
  if (existsSync(path)) {
    try {
      file = JSON.parse(readFileSync(path, 'utf8')) as Raw;
    } catch (e) {
      throw new Error(`Could not read ${path}: ${(e as Error).message}`);
    }
  }
  // An empty value, or an untouched <PLACEHOLDER> copied from the example file, counts as "not set".
  const unset = (v: unknown): boolean => v === undefined || v === null || (typeof v === 'string' && (v.trim() === '' || /^<.*>$/.test(v.trim())));
  const pick = (envKey: string, fileKey: string): unknown => (unset(env[envKey]) ? (unset(file[fileKey]) ? undefined : file[fileKey]) : env[envKey]);
  const str = (envKey: string, fileKey: string, dflt: string | null): string | null => {
    const v = pick(envKey, fileKey);
    return typeof v === 'string' && v.trim() ? v.trim() : dflt;
  };

  const phaseRaw = (str('PHONEAI_PHASE', 'phase', 'off') as string).toLowerCase();
  // An unknown value is a typo, and a typo must never turn the AI on.
  const phase: Phase = (PHASES as readonly string[]).includes(phaseRaw) ? (phaseRaw as Phase) : 'off';

  const hoursFile = str('PHONEAI_HOURS_FILE', 'hoursFile', null);
  let hours: Hours | null = null;
  if (hoursFile && existsSync(hoursFile)) hours = parseHours(JSON.parse(readFileSync(hoursFile, 'utf8')));
  else if (file.hours) hours = parseHours(file.hours);

  const smtpHost = str('PHONEAI_SMTP_HOST', 'smtpHost', null);
  const cap = Number(pick('PHONEAI_DAILY_COST_CAP_USD', 'dailyCostCapUsd') ?? 10);
  const sink = (str('PHONEAI_SINK', 'sink', 'sqlite') as string) === 'webhook' ? 'webhook' : 'sqlite';

  return {
    phase,
    businessName: str('PHONEAI_BUSINESS_NAME', 'businessName', 'Example Business') as string,
    assistantName: str('PHONEAI_ASSISTANT_NAME', 'assistantName', 'Alex') as string,
    timezone: str('PHONEAI_TIMEZONE', 'timezone', 'Australia/Sydney') as string,
    region: (str('PHONEAI_REGION', 'region', 'AU') as string).toUpperCase() === 'INTL' ? 'INTL' : 'AU',
    hours,
    sink,
    sinkWebhookUrl: str('PHONEAI_SINK_WEBHOOK_URL', 'sinkWebhookUrl', null),
    dbPath: str('PHONEAI_DB_PATH', 'dbPath', './data/phone-ai.sqlite') as string,
    dailyCostCapUsd: Number.isFinite(cap) && cap > 0 ? cap : 10,
    vapiApiKey: str('PHONEAI_VAPI_API_KEY', 'vapiApiKey', null),
    webhookSecret: str('PHONEAI_VAPI_WEBHOOK_SECRET', 'webhookSecret', null),
    vapiPhoneNumberId: str('PHONEAI_VAPI_PHONE_NUMBER_ID', 'vapiPhoneNumberId', null),
    assistantId: str('PHONEAI_VAPI_ASSISTANT_ID', 'assistantId', null),
    testAssistantId: str('PHONEAI_VAPI_TEST_ASSISTANT_ID', 'testAssistantId', null),
    publicUrl: str('PHONEAI_PUBLIC_URL', 'publicUrl', null),
    voiceProvider: str('PHONEAI_VOICE_PROVIDER', 'voiceProvider', '11labs') as string,
    voiceId: str('PHONEAI_VOICE_ID', 'voiceId', null),
    model: {
      provider: str('PHONEAI_MODEL_PROVIDER', 'modelProvider', 'anthropic') as string,
      model: str('PHONEAI_MODEL', 'model', 'claude-haiku-4-5-20251001') as string,
    },
    brief: str('PHONEAI_BRIEF', 'brief', 'You take messages for the team. You do not know anything about products, prices, stock or delivery.') as string,
    goodbye: str('PHONEAI_GOODBYE', 'goodbye', 'Thanks for calling. Someone from the team will be in touch as soon as they can. Bye for now.') as string,
    notifyEmailTo: str('PHONEAI_NOTIFY_EMAIL_TO', 'notifyEmailTo', null),
    smtp: smtpHost
      ? {
          host: smtpHost,
          port: Number(pick('PHONEAI_SMTP_PORT', 'smtpPort') ?? 587),
          user: str('PHONEAI_SMTP_USER', 'smtpUser', null),
          pass: str('PHONEAI_SMTP_PASS', 'smtpPass', null),
          from: str('PHONEAI_SMTP_FROM', 'smtpFrom', 'phone-ai@localhost') as string,
        }
      : null,
    port: Number(pick('PHONEAI_PORT', 'port') ?? 3000),
    autoDetach: String(pick('PHONEAI_AUTO_DETACH', 'autoDetach') ?? 'true').toLowerCase() !== 'false',
  };
}
