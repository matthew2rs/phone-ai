// The Vapi webhook: tool calls during a call, and the end-of-call report after it.
// Framework-free so tests and the robot runner can drive it directly. Two gates apply:
// the route only exists when a webhook secret is set, and nothing runs unless the current
// rung is customer-facing. Either one alone is enough to keep it inert.
import { createHash, timingSafeEqual } from 'node:crypto';
import { findAbility } from './abilities/index.js';
import type { CallContext } from './abilities/types.js';
import { auditCall, callerUtterances } from './audit.js';
import { afterCall, callFailed, MIN_REAL_CALL_SECONDS, type BreakerDeps } from './breaker.js';
import type { Config } from './config.js';
import { NO_ONE_FREE_SAY, shouldEscalate } from './guardrails.js';
import { effectivePhase, isCustomerFacing } from './ladder.js';
import { log } from './log.js';
import { deliverAll } from './sinks/index.js';
import type { Store } from './store.js';
import type { CallRecord, Notifier, Sink, TakenMessage } from './types.js';
import type { VapiClient } from './vapiClient.js';

export interface Deps {
  config: Config;
  store: Store;
  sinks: Sink[];
  notifier: Notifier;
  vapi: VapiClient | null;
  now: () => Date;
}

const SECRET_HEADERS = ['x-vapi-secret', 'x-vapi-signature', 'x-vapi-server-secret'];

/**
 * Constant-time check of the shared secret. FAILS CLOSED: with no secret configured, or no
 * matching header, the answer is false. (Hashing first means the compare is always between
 * two 32-byte buffers, whatever was sent.)
 */
export function verifySecret(headers: Record<string, string | string[] | undefined>, secret: string | null): boolean {
  if (!secret) return false;
  const want = createHash('sha256').update(secret).digest();
  const candidates: string[] = [];
  for (const h of SECRET_HEADERS) {
    const v = headers[h];
    if (typeof v === 'string') candidates.push(v);
  }
  const auth = headers['authorization'];
  if (typeof auth === 'string' && /^Bearer /i.test(auth)) candidates.push(auth.slice(7));
  return candidates.some((c) => timingSafeEqual(createHash('sha256').update(c.trim()).digest(), want));
}

interface RawToolCall {
  id?: string;
  name?: string;
  arguments?: unknown;
  function?: { name?: string; arguments?: unknown };
}
type Raw = Record<string, any>;

function parseToolCalls(msg: Raw): Array<{ id: string; name: string; args: Record<string, unknown> }> {
  const list: RawToolCall[] = msg.toolCallList ?? msg.toolCalls ?? [];
  return list.map((c, i) => {
    const name = c.name ?? c.function?.name ?? '';
    let args = c.arguments ?? c.function?.arguments ?? {};
    if (typeof args === 'string') {
      try {
        args = JSON.parse(args);
      } catch {
        args = {};
      }
    }
    return { id: c.id ?? `call_${i}`, name, args: (args && typeof args === 'object' ? args : {}) as Record<string, unknown> };
  });
}

const isTest = (msg: Raw): boolean =>
  !!(msg.call?.assistantOverrides?.metadata?.phoneai_test ?? msg.assistant?.metadata?.phoneai_test ?? false);

export async function handleToolCalls(msg: Raw, d: Deps): Promise<{ results: Array<{ toolCallId: string; result: string }> }> {
  const phase = effectivePhase(d.config, d.store);
  if (!isCustomerFacing(phase)) return { results: [] };

  const callId: string = msg.call?.id ?? 'unknown';
  const ctx: CallContext = {
    callId,
    fromNumber: msg.call?.customer?.number ?? null,
    toNumber: msg.call?.phoneNumber?.number ?? null,
    phase,
    config: d.config,
    store: d.store,
    sinks: d.sinks,
    now: d.now,
    test: isTest(msg),
  };

  const said = callerUtterances(msg.artifact?.messages ?? msg.messages);
  const last = said[said.length - 1] ?? '';
  const mustEscape = last !== '' && shouldEscalate(last);
  // Taking a message and reading the hours ARE the safe response to an escalation; everything
  // else is answered as "nobody is free", and the tool never runs. The escape can never swallow a save.
  const SAFE_ON_ESCAPE = new Set(['capture_message', 'opening_hours']);

  const results = await Promise.all(
    parseToolCalls(msg).map(async (c) => {
      if (mustEscape && !SAFE_ON_ESCAPE.has(c.name)) {
        return { toolCallId: c.id, result: JSON.stringify({ transferred: false, say: NO_ONE_FREE_SAY }) };
      }
      const ability = findAbility(c.name, phase);
      if (!ability) {
        return { toolCallId: c.id, result: JSON.stringify({ status: 'blocked', say: 'That is not something you can do. Say nobody is free right now and take a message instead.' }) };
      }
      try {
        const r = await ability.handle(c.args, ctx);
        return { toolCallId: c.id, result: JSON.stringify({ status: r.status, ...(r.result ?? {}), ...(r.reason ? { reason: r.reason } : {}) }) };
      } catch (e) {
        log.error({ tool: c.name, err: (e as Error).message }, 'ability threw');
        return { toolCallId: c.id, result: JSON.stringify({ status: 'error', say: 'Something went wrong on our side. Take the message verbally as best you can, say the team will follow up, and do not claim it was saved.' }) };
      }
    }),
  );
  return { results };
}

export async function handleEndOfCall(msg: Raw, d: Deps): Promise<void> {
  const callId: string = msg.call?.id ?? `unknown-${d.now().getTime()}`;
  const test = isTest(msg);
  const transcript: string = msg.artifact?.transcript ?? msg.transcript ?? '';
  const messages = msg.artifact?.messages ?? msg.messages;
  const audit = auditCall(transcript, messages);
  const endedAt: string = msg.endedAt ?? msg.call?.endedAt ?? d.now().toISOString();
  const startedAt: string | null = msg.startedAt ?? msg.call?.startedAt ?? null;
  const duration: number | null =
    typeof msg.durationSeconds === 'number' ? msg.durationSeconds : startedAt ? Math.round((Date.parse(endedAt) - Date.parse(startedAt)) / 1000) : null;
  const endedReason: string | null = msg.endedReason ?? msg.call?.endedReason ?? null;
  const cost: number | null = typeof msg.cost === 'number' ? msg.cost : typeof msg.call?.cost === 'number' ? msg.call.cost : null;

  const existing = d.store.getMessage(callId);
  let messageSaved = !!existing && !existing.unsaved;

  // SAFETY NET: the AI answered a real call and no message was saved. Never let that vanish.
  const realCall = duration === null || duration >= MIN_REAL_CALL_SECONDS;
  if (!messageSaved && isCustomerFacing(d.config.phase) && realCall && !existing) {
    const nowIso = d.now().toISOString();
    const net: TakenMessage = {
      callId,
      callerName: 'Unknown caller',
      topic: (msg.summary as string | undefined)?.slice(0, 400) || 'The AI answered this call but no message was saved. Check the recording and call them back.',
      fromNumber: msg.call?.customer?.number ?? null,
      unsaved: true,
      test: test || undefined,
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    d.store.upsertMessage(net);
    if (!test) await deliverAll(d.sinks, net);
  }

  const record: CallRecord = {
    callId,
    from: msg.call?.customer?.number ?? null,
    to: msg.call?.phoneNumber?.number ?? null,
    phase: effectivePhase(d.config, d.store),
    test,
    startedAt,
    endedAt,
    durationSeconds: duration,
    endedReason,
    costUsd: cost,
    summary: (msg.summary as string | undefined) ?? null,
    transcript: transcript || null,
    disclosed: audit.disclosed,
    escapeRequested: audit.escapeRequested,
    messageSaved,
    passedOnTooEarly: audit.passedOnTooEarly,
  };
  d.store.recordCall(record);

  if (!test && realCall && !audit.disclosed) {
    log.warn({ callId }, 'call ended without the AI disclosure in the transcript');
    await d.notifier.send('phone-ai: a call is missing the AI disclosure', `Call ${callId} has no "automated assistant" line in its transcript. Check the greeting config before taking any more calls.`);
  }
  if (!test && audit.passedOnTooEarly) {
    await d.notifier.send('phone-ai: said "passed on" before saving', `Call ${callId}: "${audit.passedOnTooEarly}". Read this transcript.`);
  }

  const breakerDeps: BreakerDeps = { config: d.config, store: d.store, notifier: d.notifier, vapi: d.vapi, now: d.now };
  await afterCall({ failed: callFailed(endedReason, duration), costUsd: cost, test }, breakerDeps);
}

/** Entry point for the HTTP layer. Never throws. */
export async function handleVapiBody(body: unknown, d: Deps): Promise<unknown> {
  try {
    const msg = ((body as Raw)?.message ?? body ?? {}) as Raw;
    switch (msg.type) {
      case 'tool-calls':
      case 'function-call':
        return await handleToolCalls(msg, d);
      case 'end-of-call-report':
        await handleEndOfCall(msg, d);
        return {};
      default:
        return {};
    }
  } catch (e) {
    log.error({ err: (e as Error).message }, 'webhook handler failed');
    return {};
  }
}
