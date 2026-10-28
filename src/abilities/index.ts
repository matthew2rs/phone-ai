// The registry. Only abilities that are enabled AND allowed on the current rung are ever
// offered to the model or runnable. `_template` is deliberately not in this list.
import type { Phase, ToolDefinition } from '../types.js';
import { isCustomerFacing } from '../ladder.js';
import { phaseRank } from '../types.js';
import { bookCallback } from './book_callback/index.js';
import { orderStatus } from './order_status/index.js';
import { storeHours } from './store_hours/index.js';
import { takeMessage } from './take_message/index.js';
import { transferToHuman } from './transfer_to_human/index.js';
import type { Ability } from './types.js';

export const ALL_ABILITIES: readonly Ability[] = [takeMessage, storeHours, orderStatus, transferToHuman, bookCallback];

export function activeAbilities(phase: Phase): Ability[] {
  if (!isCustomerFacing(phase)) return [];
  return ALL_ABILITIES.filter((a) => a.enabled && phaseRank(a.minPhase) <= phaseRank(phase));
}

export function toolsFor(phase: Phase): ToolDefinition[] {
  return activeAbilities(phase).map((a) => a.tool);
}

export function findAbility(name: string, phase: Phase): Ability | null {
  return activeAbilities(phase).find((a) => a.tool.function.name === name) ?? null;
}
