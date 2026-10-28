// Checks run on a finished call. The disclosure rule can only be CHECKED, not forced (the
// words come from the assistant config), so the evidence lives here: every call record says
// whether the AI actually disclosed itself. That flag is what you promote a rung on.
import { callerAskedForHuman, DISCLOSURE_MARKER, shouldEscalate } from './guardrails.js';

export interface VapiMessage {
  role?: string;
  message?: unknown;
  result?: unknown;
  name?: string;
  time?: number;
  secondsFromStart?: number;
}

const PASSED_ON = /\bpassed\b[^.?!]{0,15}\bon\b|\bI(?:'ve| have) let them know\b|\bI(?:'ve| have) let (?:the team|someone) know\b/i;

/**
 * Did the assistant say "passed that on" BEFORE the first save that actually succeeded?
 * That is the failure that matters: telling a caller their message is with the team when it
 * is not. Returns the offending sentence, or null. Also null when nothing ever saved
 * (that call is caught separately by the no-message safety net).
 */
export function passedOnBeforeSave(messages: unknown): string | null {
  if (!Array.isArray(messages)) return null;
  const msgs = messages as VapiMessage[];
  const saved = msgs.find((m) => m.role === 'tool_call_result' && (m.name === undefined || m.name === 'capture_message') && /"saved":\s*true/.test(String(m.result ?? '')));
  if (!saved) return null;
  for (const m of msgs) {
    if (m.role !== 'bot' || !PASSED_ON.test(String(m.message ?? ''))) continue;
    const before =
      typeof m.time === 'number' && typeof saved.time === 'number'
        ? m.time < saved.time
        : typeof m.secondsFromStart === 'number' && typeof saved.secondsFromStart === 'number'
          ? m.secondsFromStart < saved.secondsFromStart
          : msgs.indexOf(m) < msgs.indexOf(saved);
    if (before) return String(m.message).trim().slice(0, 200);
  }
  return null;
}

export function callerUtterances(messages: unknown): string[] {
  if (!Array.isArray(messages)) return [];
  return (messages as VapiMessage[]).filter((m) => m.role === 'user').map((m) => String(m.message ?? ''));
}

export interface CallAudit {
  disclosed: boolean;
  escapeRequested: boolean;
  passedOnTooEarly: string | null;
}

export function auditCall(transcript: string, messages: unknown): CallAudit {
  const said = callerUtterances(messages);
  const callerText = said.length ? said : [transcript];
  return {
    disclosed: DISCLOSURE_MARKER.test(transcript),
    escapeRequested: callerText.some((u) => callerAskedForHuman(u) || shouldEscalate(u)),
    passedOnTooEarly: passedOnBeforeSave(messages),
  };
}
