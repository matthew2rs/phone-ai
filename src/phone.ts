// Phone numbers and emails as a caller speaks them. Region is configurable.
// 'AU' is the worked example (ten digits starting 0, or +61). 'INTL' accepts any E.164 number.
import type { Region } from './types.js';

/**
 * A spoken number to E.164, or null. Null means "ask them to say it again": a guess must
 * never be saved. 13/1300/1800 numbers are not call-back numbers and are refused in AU.
 */
export function normaliseNumber(raw: unknown, region: Region = 'AU'): string | null {
  if (typeof raw !== 'string') return null;
  let d = raw.replace(/[\s()\-.]/g, '');
  if (!/^\+?\d+$/.test(d)) return null;
  if (region === 'INTL') return /^\+\d{8,15}$/.test(d) ? d : null;
  if (d.startsWith('+61')) d = '0' + d.slice(3);
  else if (/^61\d{9}$/.test(d)) d = '0' + d.slice(2);
  else if (d.startsWith('+')) return null;
  if (!/^0[2-478]\d{8}$/.test(d)) return null;
  return '+61' + d.slice(1);
}

/** E.164 to how it is read out: 04xx xxx xxx (AU mobiles) or 0x xxxx xxxx (AU landlines). */
export function formatNumber(e164: string, region: Region = 'AU'): string {
  if (region !== 'AU' || !e164.startsWith('+61')) return e164;
  const d = '0' + e164.slice(3);
  if (/^04\d{8}$/.test(d)) return `${d.slice(0, 4)} ${d.slice(4, 7)} ${d.slice(7)}`;
  if (/^0\d{9}$/.test(d)) return `${d.slice(0, 2)} ${d.slice(2, 6)} ${d.slice(6)}`;
  return d;
}

/** A plausible email, lower-cased, or null. Deliberately plain: a sanity check, not RFC 5322. */
export function normaliseEmail(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const e = raw.trim().toLowerCase().replace(/\s+/g, '');
  return e.length <= 254 && /^[a-z0-9._%+'-]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/.test(e) ? e : null;
}

export const BAD_NUMBER_SAY =
  'That number did not come through as a full number. Ask them to say it again slowly, read it back in small groups, and wait for a yes. Do not save a guess.';
export const BAD_EMAIL_SAY =
  'That email address did not come through clearly. Ask them to say it again slowly, then read it back letter by letter and wait for a yes. Do not save a guess.';
export const NO_TIME_SAY =
  "If they ask when: say exactly, \"I can't give you a time, but the team has your message.\"";
