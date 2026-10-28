// ABILITY TEMPLATE. Copy this folder to abilities/<your_ability>/, then:
//   1. rename `name` (it is also the tool name the model sees),
//   2. set `minPhase`, write the tool description for the MODEL (when to use it, when not to),
//   3. implement `handle`. It must never throw and must only state facts it got from a real source,
//   4. add your ability to the list in ../index.ts,
//   5. write robot/scenarios/<your_ability>.json including at least one break-it case
//      (a caller trying to make it lie, skip a check, or reach something it should not),
//   6. keep `enabled: false` until the scenarios pass AND you have read real test-call transcripts.
// This file is never registered, so it can be left as is.
import type { Ability } from '../types.js';

export const templateAbility: Ability = {
  name: 'example_ability',
  description: 'What this does, in one line.',
  minPhase: 'faq',
  enabled: false,
  tool: {
    type: 'function',
    function: {
      name: 'example_ability',
      description: 'Tell the model exactly when to call this.',
      parameters: { type: 'object', properties: { thing: { type: 'string', description: 'What it is.' } }, required: ['thing'] },
    },
  },
  async handle(_args, _ctx) {
    // Return facts only from a real source. `say` is an instruction to the model, not a script.
    return { status: 'ok', result: { say: 'Replace me.' } };
  },
};
