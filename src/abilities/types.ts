// The ability contract. To add an ability, copy ./_template and register it in ./index.ts.
// Rules (policy/ladder.md): an ability never throws, never states a fact it did not get from a
// tool result, and does not ship without a guardrail check and a break-it scenario.
import type { Config } from '../config.js';
import type { Store } from '../store.js';
import type { Phase, Sink, ToolDefinition, ToolResult } from '../types.js';

export interface CallContext {
  callId: string;
  fromNumber: string | null;
  toNumber: string | null;
  phase: Phase;
  config: Config;
  store: Store;
  sinks: Sink[];
  now: () => Date;
  /** A call to the test number: stored, but never delivered to your sinks. */
  test: boolean;
}

export interface Ability {
  name: string;
  description: string;
  /** The lowest rung this ability may run on. */
  minPhase: Phase;
  /** false = documented stub. It is never offered to the model. */
  enabled: boolean;
  tool: ToolDefinition;
  handle(args: Record<string, unknown>, ctx: CallContext): Promise<ToolResult>;
}

/** Stubs share this so "planned" abilities fail closed and honestly. */
export const NOT_BUILT: ToolResult = {
  status: 'blocked',
  reason: 'not_built_in_v1',
  result: { say: 'That is not something you can do. Say nobody is free right now and take a message instead.' },
};
