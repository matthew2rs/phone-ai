// The ladder: how far the AI may go. Each rung is strictly more capable than the last,
// and you only climb on evidence (see policy/ladder.md). The promote/demote gates are
// deliberately NOT encoded here: a number in code invites someone to satisfy the number
// rather than the intent.
import type { Config } from './config.js';
import type { Phase } from './types.js';
import { CUSTOMER_FACING, PHASES, phaseRank } from './types.js';

/** Minimal view of the local state store that the ladder needs. */
export interface KvReader {
  getKv(key: string): string | null;
}

/**
 * The phase actually in force. A stored override (set by the kill switch or the breaker)
 * can only ever LOWER the configured phase, never raise it. A typo or a corrupt value
 * counts as 'off'.
 */
export function effectivePhase(config: Config, kv: KvReader): Phase {
  const override = kv.getKv('phase_override');
  if (!override) return config.phase;
  if (!(PHASES as readonly string[]).includes(override)) return 'off';
  return phaseRank(override as Phase) < phaseRank(config.phase) ? (override as Phase) : config.phase;
}

export function isCustomerFacing(phase: Phase): boolean {
  return CUSTOMER_FACING.includes(phase);
}

export const RUNG_SUMMARY: Record<Phase, string> = {
  off: 'The AI does not exist as far as a caller is concerned. THE DEFAULT.',
  shadow: 'Reviews transcripts you already have and shows what it would have done. Never speaks to anyone.',
  greeter: 'Answers when nobody can, says it is an AI, takes a confirmed message, says goodbye. Resolves nothing.',
  faq: 'PLANNED. Adds a short list of checkable answers (for example order status). Not built in v1.',
};
