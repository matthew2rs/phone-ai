// Contingency: never worse than today. Two automatic ways the AI takes itself out of the path:
//   1. the breaker: 3 failed AI calls inside an hour,
//   2. the daily cost cap.
// Either one sets the phase override to 'off', tells you, and (if configured) points your
// Vapi number at nothing so calls fall back to your own fallback / voicemail.
import type { Config } from './config.js';
import type { Store } from './store.js';
import type { Notifier } from './types.js';
import type { VapiClient } from './vapiClient.js';
import { log } from './log.js';

export const BREAKER_FAILURES = 3;
export const BREAKER_WINDOW_MS = 3_600_000;
/** Shorter than this and the call was almost certainly a dead leg (answered, then dropped). */
export const MIN_REAL_CALL_SECONDS = 8;

export function callFailed(endedReason: string | null, durationSeconds: number | null): boolean {
  if (endedReason && /error|failed|pipeline|vapifault|exceeded/i.test(endedReason)) return true;
  return durationSeconds !== null && durationSeconds < MIN_REAL_CALL_SECONDS;
}

/** Pure: given failure timestamps (ms), which are recent and has it tripped. */
export function breakerState(times: number[], now: number): { recent: number[]; tripped: boolean } {
  const recent = times.filter((t) => now - t < BREAKER_WINDOW_MS);
  return { recent, tripped: recent.length >= BREAKER_FAILURES };
}

export interface BreakerDeps {
  config: Config;
  store: Store;
  notifier: Notifier;
  vapi: VapiClient | null;
  now: () => Date;
}

/** Switch the AI off everywhere we can reach. Idempotent. */
export async function switchOff(reason: string, d: BreakerDeps): Promise<void> {
  if (d.store.getKv('phase_override') === 'off') return;
  d.store.setKv('phase_override', 'off');
  d.store.setKv('phase_override_reason', `${d.now().toISOString()} ${reason}`);
  log.error({ reason }, 'phone-ai switched OFF');
  let detached = 'Vapi number was NOT changed (auto-detach is off or Vapi is not configured). Calls may still reach the assistant: detach it in the Vapi dashboard.';
  if (d.config.autoDetach && d.vapi && d.config.vapiPhoneNumberId) {
    try {
      await d.vapi.setNumberAssistant(d.config.vapiPhoneNumberId, null);
      detached = 'The Vapi number was detached from the assistant, so callers now get your fallback behaviour.';
    } catch (e) {
      detached = `Detaching the Vapi number FAILED (${(e as Error).message}). Detach it in the Vapi dashboard now.`;
    }
  }
  await d.notifier.send('phone-ai switched itself OFF', `Reason: ${reason}\n${detached}\nTo turn it back on after you have fixed the cause: npm run switch -- on --live`);
}

/** Record the end of a call; trips the breaker or the cost cap if needed. */
export async function afterCall(args: { failed: boolean; costUsd: number | null; test: boolean }, d: BreakerDeps): Promise<void> {
  if (args.test) return;
  const now = d.now().getTime();
  if (args.failed) {
    const prior = JSON.parse(d.store.getKv('ai_failures') ?? '[]') as number[];
    const { recent, tripped } = breakerState([...prior, now], now);
    d.store.setKv('ai_failures', JSON.stringify(recent));
    if (tripped) await switchOff(`${BREAKER_FAILURES} failed AI calls inside an hour`, d);
  }
  const spent = d.store.spendOnDay(d.now().toISOString().slice(0, 10));
  if (spent >= d.config.dailyCostCapUsd) await switchOff(`daily cost cap reached ($${spent.toFixed(2)} of $${d.config.dailyCostCapUsd})`, d);
}
