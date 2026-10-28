// ENABLED in v1. Takes a message for the team. The rules here were each learned from a real
// live-trial failure (see HANDOFF_NOTES.md "Lessons"): save only after the caller's yes,
// validate any number or email instead of guessing, a second save updates the same message.
import { normaliseEmail, normaliseNumber, BAD_EMAIL_SAY, BAD_NUMBER_SAY, NO_TIME_SAY } from '../../phone.js';
import { deliverAll } from '../../sinks/index.js';
import type { TakenMessage, ToolResult } from '../../types.js';
import type { Ability, CallContext } from '../types.js';

const str = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v.trim() : undefined);

/** Later values win; an empty new value never wipes an earlier one. */
export function mergeMessage(prev: TakenMessage, next: Partial<TakenMessage>): TakenMessage {
  const out = { ...prev };
  for (const [k, v] of Object.entries(next)) {
    if (v !== undefined && v !== '') (out as Record<string, unknown>)[k] = v;
  }
  return out;
}

async function handle(args: Record<string, unknown>, ctx: CallContext): Promise<ToolResult> {
  const name = str(args.caller_name);
  const topic = str(args.topic);
  if (!name || !topic) {
    return { status: 'ok', result: { saved: false, say: 'You still need their name and what it is about. Ask for what is missing. Do not save yet.' } };
  }
  // Save only after the caller said yes to the read-back. Never before.
  if (args.caller_confirmed !== true) {
    return { status: 'ok', result: { saved: false, say: 'Read the whole message back to them (name, what it is about, and any number or email they gave) and wait for a yes. Then save again with caller_confirmed true.' } };
  }

  let callbackNumber: string | undefined;
  if (str(args.callback_number)) {
    const n = normaliseNumber(args.callback_number, ctx.config.region);
    if (!n) return { status: 'ok', result: { saved: false, say: BAD_NUMBER_SAY } };
    callbackNumber = n;
  }
  let callbackEmail: string | undefined;
  if (str(args.callback_email)) {
    const e = normaliseEmail(args.callback_email);
    if (!e) return { status: 'ok', result: { saved: false, say: BAD_EMAIL_SAY } };
    callbackEmail = e;
  }

  const nowIso = ctx.now().toISOString();
  const about = ['product', 'order', 'other'].includes(String(args.about)) ? (args.about as TakenMessage['about']) : undefined;
  const fresh: TakenMessage = {
    callId: ctx.callId,
    callerName: name,
    topic,
    about,
    orderReference: str(args.order_reference),
    when: str(args.when),
    askedFor: str(args.asked_for),
    fromNumber: ctx.fromNumber,
    callbackNumber,
    callbackEmail,
    test: ctx.test || undefined,
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  const prev = ctx.store.getMessage(ctx.callId);
  const merged = prev && !prev.unsaved ? mergeMessage(prev, { ...fresh, createdAt: prev.createdAt }) : fresh;
  ctx.store.upsertMessage(merged);
  // Test calls are stored but never delivered to the team.
  if (!ctx.test) await deliverAll(ctx.sinks, merged);

  return {
    status: 'ok',
    result: {
      saved: true,
      updated: !!prev,
      say: `Saved. Now say, in your own words, that someone from the team will be in touch as soon as they can, and ask if there is anything else. Do not say you have "passed it on" before this point. ${NO_TIME_SAY}`,
    },
  };
}

export const takeMessage: Ability = {
  name: 'capture_message',
  description: 'Take a message so the team calls the caller back.',
  minPhase: 'greeter',
  enabled: true,
  tool: {
    type: 'function',
    function: {
      name: 'capture_message',
      description:
        'Take a message so the team calls the caller back. Ask their name and what it is about first. Never promise a time. Saving twice in one call is fine: the second save updates the same message (use it to add a different call-back number or email).',
      parameters: {
        type: 'object',
        properties: {
          caller_name: { type: 'string', description: 'Their name. Always ask for it and spell back anything unusual before saving.' },
          topic: { type: 'string', description: 'What they need, in a sentence, in their words.' },
          order_reference: { type: 'string', description: 'An order or reference number if they gave one.' },
          when: { type: 'string', description: 'When suits them for a call back, if they said.' },
          about: { type: 'string', enum: ['product', 'order', 'other'], description: 'product = wants to buy or asks about a product. order = something they have already ordered. other = anything else.' },
          asked_for: { type: 'string', description: 'If they asked for someone by name, that name. Leave it out if they did not. Never guess one.' },
          callback_number: { type: 'string', description: 'ONLY if the CALLER offers a different number to be called on. Digits as they said them. Never ask for a number yourself. Read it back in small groups and wait for a yes before saving.' },
          callback_email: { type: 'string', description: 'ONLY if the CALLER asks for an email reply or offers an address. Read it back letter by letter and wait for a yes before saving.' },
          caller_confirmed: { type: 'boolean', description: 'true ONLY after you have read the whole message back and they said yes. Never save before that.' },
        },
        required: ['caller_name', 'topic', 'caller_confirmed'],
      },
    },
  },
  handle,
};
