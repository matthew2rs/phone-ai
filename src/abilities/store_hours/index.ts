// ENABLED in v1. Reads opening hours from your config. A fact only ever comes from here.
import { hoursNow } from '../../hours.js';
import type { Ability } from '../types.js';

export const storeHours: Ability = {
  name: 'opening_hours',
  description: 'Whether the phones are open now, when they next open, and this week\'s hours.',
  minPhase: 'greeter',
  enabled: true,
  tool: {
    type: 'function',
    function: {
      name: 'opening_hours',
      description: 'When the phones are open: whether they are open now, when they next open, and this week\'s hours. Use it whenever they ask about opening hours or when someone will be in.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  async handle(_args, ctx) {
    const h = hoursNow(ctx.config.hours, ctx.now(), ctx.config.timezone);
    return { status: 'ok', result: { open: h.open, say: h.say, week: h.week } };
  },
};
