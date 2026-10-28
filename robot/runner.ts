// The robot-caller runner (OFFLINE). Plays a scripted call against the real webhook code with an
// in-memory database and no network. It tests OUR safeguards: save gating, number validation,
// the escape rule, the safety net, the "passed on before saving" audit, the secret check.
// It does NOT test the AI model's behaviour on a real phone line. For that, call your test
// number yourself and READ the transcript (SETUP.md, stage 3). A green tick here is not a pass.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadConfig } from '../src/config.js';
import { Store } from '../src/store.js';
import { shouldEscalate } from '../src/guardrails.js';
import { handleVapiBody, verifySecret, type Deps } from '../src/webhook.js';
import type { Sink, TakenMessage } from '../src/types.js';

interface Expect {
  saved?: boolean;
  status?: string;
  sayIncludes?: string;
  sayExcludes?: string;
  updated?: boolean;
  unsavedFlag?: boolean;
  disclosed?: boolean;
  passedOnFlagged?: boolean;
  messageSaved?: boolean;
  delivered?: number;
  callbackNumber?: string;
}
type Step =
  | { say: string; expectEscalate?: boolean }
  | { tool: string; args: Record<string, unknown>; expect?: Expect }
  | { end: { transcript?: string; summary?: string; durationSeconds?: number; extraMessages?: unknown[] }; expect?: Expect }
  | { auth: Record<string, string>; expectAccepted: boolean };
export interface Scenario {
  name: string;
  description?: string;
  steps: Step[];
}

export interface ScenarioResult {
  name: string;
  failures: string[];
}

export function makeDeps(): { deps: Deps; delivered: TakenMessage[]; notices: string[] } {
  const delivered: TakenMessage[] = [];
  const notices: string[] = [];
  const sink: Sink = { name: 'capture', async deliver(m) { delivered.push(m); } };
  const config = loadConfig({ PHONEAI_PHASE: 'greeter', PHONEAI_VAPI_WEBHOOK_SECRET: 'robot-secret', PHONEAI_DB_PATH: ':memory:', PHONEAI_REGION: 'AU' } as NodeJS.ProcessEnv, '/nonexistent.json');
  config.hours = { weekly: { mon: [['09:00', '17:00']] }, closedDates: [] };
  const deps: Deps = {
    config,
    store: new Store(':memory:'),
    sinks: [sink],
    notifier: { async send(subject) { notices.push(subject); } },
    vapi: null,
    now: () => new Date('2026-11-02T10:00:00Z'),
  };
  return { deps, delivered, notices };
}

const DISCLOSED = 'AI: Example Business, Alex here, the automated assistant. Calls are recorded. How can I help?';

export async function runScenario(s: Scenario): Promise<ScenarioResult> {
  const { deps, delivered } = makeDeps();
  const failures: string[] = [];
  const callId = `robot-${s.name}`;
  const messages: Array<Record<string, unknown>> = [];
  const fail = (i: number, m: string) => failures.push(`step ${i + 1}: ${m}`);
  let lastSaveAt = 0;

  for (let i = 0; i < s.steps.length; i++) {
    const step = s.steps[i];
    if ('say' in step) {
      messages.push({ role: 'user', message: step.say });
      if (step.expectEscalate !== undefined && shouldEscalate(step.say) !== step.expectEscalate) fail(i, `expected escalate=${step.expectEscalate} for "${step.say}"`);
    } else if ('auth' in step) {
      const ok = verifySecret(step.auth, deps.config.webhookSecret);
      if (ok !== step.expectAccepted) fail(i, `secret check accepted=${ok}, wanted ${step.expectAccepted}`);
    } else if ('tool' in step) {
      const res = (await handleVapiBody(
        { message: { type: 'tool-calls', call: { id: callId, customer: { number: '+61491570006' } }, toolCallList: [{ id: 't1', name: step.tool, arguments: step.args }], artifact: { messages } } },
        deps,
      )) as { results: Array<{ result: string }> };
      const out = JSON.parse(res.results[0]?.result ?? '{}') as Record<string, unknown>;
      const e = step.expect ?? {};
      if (e.saved !== undefined && out.saved !== e.saved) fail(i, `saved=${String(out.saved)}, wanted ${e.saved}`);
      if (e.status !== undefined && out.status !== e.status) fail(i, `status=${String(out.status)}, wanted ${e.status}`);
      if (e.updated !== undefined && out.updated !== e.updated) fail(i, `updated=${String(out.updated)}, wanted ${e.updated}`);
      const say = String(out.say ?? '');
      if (e.sayIncludes && !say.toLowerCase().includes(e.sayIncludes.toLowerCase())) fail(i, `say did not include "${e.sayIncludes}": ${say.slice(0, 120)}`);
      if (e.sayExcludes && say.toLowerCase().includes(e.sayExcludes.toLowerCase())) fail(i, `say included forbidden "${e.sayExcludes}"`);
      if (e.delivered !== undefined && delivered.length !== e.delivered) fail(i, `delivered ${delivered.length}, wanted ${e.delivered}`);
      if (e.callbackNumber !== undefined && deps.store.getMessage(callId)?.callbackNumber !== e.callbackNumber) fail(i, `callbackNumber=${deps.store.getMessage(callId)?.callbackNumber}, wanted ${e.callbackNumber}`);
      if (out.saved === true) {
        messages.push({ role: 'tool_call_result', name: step.tool, result: JSON.stringify({ saved: true }), secondsFromStart: ++lastSaveAt });
      }
    } else if ('end' in step) {
      await handleVapiBody(
        {
          message: {
            type: 'end-of-call-report',
            call: { id: callId, customer: { number: '+61491570006' } },
            transcript: step.end.transcript ?? DISCLOSED,
            summary: step.end.summary,
            durationSeconds: step.end.durationSeconds ?? 60,
            endedReason: 'customer-ended-call',
            artifact: { transcript: step.end.transcript ?? DISCLOSED, messages: [...messages, ...(step.end.extraMessages ?? [])] },
          },
        },
        deps,
      );
      const e = step.expect ?? {};
      const msg = deps.store.getMessage(callId);
      const call = deps.store.callsSince('2000-01-01').find((c) => c.callId === callId);
      if (e.unsavedFlag !== undefined && !!msg?.unsaved !== e.unsavedFlag) fail(i, `unsaved flag=${!!msg?.unsaved}, wanted ${e.unsavedFlag}`);
      if (e.disclosed !== undefined && call?.disclosed !== e.disclosed) fail(i, `disclosed=${call?.disclosed}, wanted ${e.disclosed}`);
      if (e.messageSaved !== undefined && call?.messageSaved !== e.messageSaved) fail(i, `messageSaved=${call?.messageSaved}, wanted ${e.messageSaved}`);
      if (e.passedOnFlagged !== undefined && !!call?.passedOnTooEarly !== e.passedOnFlagged) fail(i, `passedOnFlagged=${!!call?.passedOnTooEarly}, wanted ${e.passedOnFlagged}`);
      if (e.delivered !== undefined && delivered.length !== e.delivered) fail(i, `delivered ${delivered.length}, wanted ${e.delivered}`);
    }
  }
  deps.store.close();
  return { name: s.name, failures };
}

export function loadScenarios(dir = join(import.meta.dirname, 'scenarios')): Scenario[] {
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')) as Scenario);
}
