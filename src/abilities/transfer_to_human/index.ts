// STUB (planned). v1 deliberately has NO transfer: the greeter is never told one exists,
// because a model that is told about a transfer it cannot perform will fake it ("putting
// you through now"). When this is built it needs a real destination and a tested fallback.
import { NOT_BUILT, type Ability } from '../types.js';

export const transferToHuman: Ability = {
  name: 'transfer_to_human',
  description: 'PLANNED. Warm-transfer the call to a person.',
  minPhase: 'faq',
  enabled: false,
  tool: {
    type: 'function',
    function: {
      name: 'transfer_to_human',
      description: 'PLANNED. Transfer the call to a person.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  async handle() {
    return NOT_BUILT;
  },
};
