// Builds the Vapi assistant config. Pure: no network. The setup CLI sends it (dry run by default).
import type { Config } from './config.js';
import { disclosureGreeting, HARD_RULES } from './guardrails.js';
import { toolsFor } from './abilities/index.js';

export function buildSystemPrompt(config: Config): string {
  return [
    HARD_RULES,
    '',
    `You are ${config.assistantName}, an automated phone assistant for ${config.businessName}. Nobody can get to the phone right now, so you take messages for the team.`,
    '',
    'ABOUT THE BUSINESS (this is everything you know; it is not a source of prices, stock or promises):',
    config.brief,
    '',
    'HOW A CALL GOES',
    '1. The greeting has already been spoken. Do not repeat it. Listen to what they need.',
    '2. Speak plainly and briefly, one idea at a time. No slang, no filler like "just a sec".',
    '3. If they ask about opening hours, use the opening_hours tool and answer from its result only.',
    '4. Anything else: you cannot help with it yourself. Say nobody is free right now and offer to take a message.',
    '5. To take a message you need their name and what it is about. Ask for what is missing. Do NOT ask for their phone number: the team already has the number they rang from. Only if THEY offer a different number or email, take it.',
    '6. Read the whole message back, then ask "is that right?". Wait for a clear yes.',
    '7. The moment they say yes, save it with capture_message (caller_confirmed true). Saving is the very next thing you do after the yes. If they then give a different number or email, save again; the second save updates the same message.',
    '8. Only AFTER the save succeeds, say someone from the team will be in touch as soon as they can, and ask if there is anything else. Never give a time. Never say you have "passed it on" before the save has happened.',
    '9. If the save does not succeed, read the instruction in the result and fix it. If you are asked for an order number, ask at most twice, then take the message without it.',
    '10. If they are upset or frustrated, keep it short: take the message quickly, no questions you do not need.',
    '11. When they have nothing else, say goodbye and end the call.',
  ].join('\n');
}

export function buildAssistantConfig(config: Config, opts: { name?: string; test?: boolean } = {}): Record<string, unknown> {
  const serverUrl = config.publicUrl ? `${config.publicUrl.replace(/\/$/, '')}/webhooks/vapi` : undefined;
  return {
    name: opts.name ?? `phone-ai: ${config.businessName}`,
    firstMessage: disclosureGreeting(config.businessName, config.assistantName),
    model: {
      provider: config.model.provider,
      model: config.model.model,
      temperature: 0.3,
      maxTokens: 250,
      messages: [{ role: 'system', content: buildSystemPrompt(config) }],
      tools: toolsFor('greeter').map((t) => ({ ...t, messages: [{ type: 'request-start', blocking: false, content: '' }] })),
    },
    ...(config.voiceId ? { voice: { provider: config.voiceProvider, voiceId: config.voiceId } } : {}),
    transcriber: { provider: 'deepgram', model: 'nova-2', language: config.region === 'AU' ? 'en-AU' : 'en' },
    ...(serverUrl ? { server: { url: serverUrl, secret: config.webhookSecret ?? '' } } : {}),
    serverMessages: ['tool-calls', 'end-of-call-report', 'status-update'],
    // The goodbye is Vapi's own end-call message: without it the model went straight to hanging up
    // and the platform said a flat "Goodbye." instead.
    endCallMessage: config.goodbye,
    endCallFunctionEnabled: true,
    analysisPlan: { summaryPlan: { enabled: true } },
    maxDurationSeconds: 600,
    metadata: { phoneai: true, ...(opts.test ? { phoneai_test: true } : {}) },
  };
}
