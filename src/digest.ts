// The daily review: every call in the last N hours, with the red rows first. The rule that
// goes with it: you do not leave the AI on unless somebody reads this.
import type { Config } from './config.js';
import { effectivePhase } from './ladder.js';
import type { Store } from './store.js';
import type { CallRecord } from './types.js';

export interface Digest {
  subject: string;
  text: string;
  red: number;
}

function redReasons(c: CallRecord): string[] {
  const r: string[] = [];
  if (!c.messageSaved) r.push('no message saved');
  if (!c.disclosed) r.push('no AI disclosure in transcript');
  if (c.passedOnTooEarly) r.push(`said "passed on" before saving: "${c.passedOnTooEarly}"`);
  if (c.escapeRequested) r.push('caller asked for a person or raised a person-only topic');
  if (c.durationSeconds !== null && c.durationSeconds < 8) r.push('very short call (dead leg?)');
  return r;
}

export function buildDigest(config: Config, store: Store, now: Date, hours = 24): Digest {
  const since = new Date(now.getTime() - hours * 3_600_000).toISOString();
  const calls = store.callsSince(since).filter((c) => !c.test);
  const spend = calls.reduce((s, c) => s + (c.costUsd ?? 0), 0);
  const rows = calls.map((c) => ({ c, reasons: redReasons(c) }));
  const red = rows.filter((r) => r.reasons.length > 0 && !(r.reasons.length === 1 && r.reasons[0].startsWith('caller asked')));

  const lines: string[] = [
    `phone-ai review, last ${hours}h. Calls: ${calls.length}. Spend: $${spend.toFixed(2)} of $${config.dailyCostCapUsd} daily cap.`,
    `Phase in force: ${effectivePhase(config, store)}`,
    '',
    red.length ? `NEEDS A LOOK (${red.length}):` : 'Nothing flagged. Still read at least two transcripts.',
  ];
  for (const { c, reasons } of red) lines.push(`  - ${c.callId} from ${c.from ?? 'unknown'} (${c.durationSeconds ?? '?'}s): ${reasons.join('; ')}`);
  lines.push('', 'ALL CALLS:');
  for (const { c } of rows) lines.push(`  - ${c.endedAt} ${c.callId} ${c.durationSeconds ?? '?'}s saved=${c.messageSaved} ${c.summary ? '| ' + c.summary.slice(0, 120) : ''}`);
  lines.push('', 'Reminder: a green tick from the robot is not a pass. Read the transcripts.');
  return { subject: `phone-ai: ${calls.length} calls, ${red.length} to check`, text: lines.join('\n'), red: red.length };
}
