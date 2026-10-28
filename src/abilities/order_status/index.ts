// STUB (planned, 'faq' rung). Not built in v1: it needs an order system to read from, and it
// must verify who is calling before saying anything about an order (see ROADMAP.md).
// Disabled abilities are never offered to the model.
import { NOT_BUILT, type Ability } from '../types.js';

export const orderStatus: Ability = {
  name: 'order_status',
  description: 'PLANNED. Look up an order and say where it is, after verifying the caller.',
  minPhase: 'faq',
  enabled: false,
  tool: {
    type: 'function',
    function: {
      name: 'order_status',
      description: 'PLANNED. Look up an order after the caller is verified.',
      parameters: { type: 'object', properties: { order_reference: { type: 'string', description: 'The order number.' } }, required: ['order_reference'] },
    },
  },
  async handle() {
    return NOT_BUILT;
  },
};
