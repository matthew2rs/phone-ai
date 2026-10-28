// STUB (planned). Book a real slot in one person's callback calendar. Only worth building
// if someone owns that calendar and keeps it: a booked callback that is missed is worse
// than no promise at all.
import { NOT_BUILT, type Ability } from '../types.js';

export const bookCallback: Ability = {
  name: 'book_callback',
  description: 'PLANNED. Offer the caller a real callback slot.',
  minPhase: 'faq',
  enabled: false,
  tool: {
    type: 'function',
    function: {
      name: 'book_callback',
      description: 'PLANNED. Book a callback slot from the real calendar.',
      parameters: { type: 'object', properties: { slot: { type: 'string', description: 'A slot offered by this tool.' } }, required: ['slot'] },
    },
  },
  async handle() {
    return NOT_BUILT;
  },
};
