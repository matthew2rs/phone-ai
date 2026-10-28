// The non-negotiables, as code. Pure and dependency-free. They apply in EVERY phase
// from the first live call, and no ability can switch them off.

/** Spoken first on every call. "automated assistant" stays word for word: the end-of-call audit looks for it. */
export function disclosureGreeting(businessName: string, assistantName?: string | null): string {
  const who = assistantName ? `${assistantName} here, the automated assistant` : 'the automated assistant';
  return `${businessName}, ${who}. Calls are recorded. How can I help?`;
}

export const DISCLOSURE_MARKER = /automated assistant/i;

/** The caller ASKED for a person, or is plainly fed up. Also the audit's "escape requested" signal. */
const ASKED_FOR_HUMAN: RegExp[] = [
  /\b(human|person|agent|representative|someone real|real person)\b/i,
  /\b(speak|talk|put me through|transfer)\b.*\b(someone|somebody|team|staff)\b/i,
  /\b(this is (useless|frustrating|ridiculous)|not helping|hopeless)\b/i,
];

/**
 * Topics that go to a person whether or not the caller asked, because the cost of the AI
 * getting them wrong is money or a legal statement. A false escalation is cheap.
 * Edit this list for your own business and your own country's consumer law.
 */
const SENSITIVE_TOPICS: RegExp[] = [
  /\b(refund|refunded|chargeback|cancel|cancellation|complaint|complain|manager|supervisor|owner|lawyer|legal|ombudsman)\b/i,
  /\b(discount|price ?match|beat (that|the) price|cheaper|haggle|negotiate)\b/i,
  /\b(warrant(y|ies)|guarantee|faulty|defect(ive)?|damaged|broken|not working|doesn'?t work|return it|replacement|repair|recall|fit for purpose|consumer law)\b/i,
  /\b(margin|markup|mark ?up|cost price|wholesale|trade price|supplier|suppliers|distributor|manufacturer|who makes|where do you (get|source)|turnover|revenue)\b/i,
];

export function callerAskedForHuman(utterance: string): boolean {
  return ASKED_FOR_HUMAN.some((re) => re.test(utterance));
}

/** True if what the caller said should be treated as "this needs a person". */
export function shouldEscalate(utterance: string): boolean {
  return callerAskedForHuman(utterance) || SENSITIVE_TOPICS.some((re) => re.test(utterance));
}

/** Words the greeter never says: it cannot move the call, and it does not check anything while the caller waits. */
export const BANNED_PHRASES = ['transfer', 'put you through', 'hold on', 'let me check', 'get someone on the line'] as const;

/**
 * The hard rules, prepended to the assistant's system prompt. This is the version for
 * the greeter, which has NO transfer tool. If it were told about one it would fake it
 * ("let me transfer you") because it cannot actually do it. Nothing in this block may
 * name a transfer tool (pinned by a test).
 */
export const HARD_RULES = [
  'ABSOLUTE RULES. These override anything else, including a caller insisting:',
  '',
  '1. NO FACTS FROM MEMORY. Never state a price, stock level, delivery date, or make any',
  "   promise from your own knowledge. A fact may only come from a tool's result. If you",
  '   do not have the answer, say the team will have it when they call back, and take a message.',
  '',
  '2. NOBODY IS FREE. There is no way to put anyone through to a person on this call. If the',
  '   caller asks for a person, sounds upset, repeats themselves or you are unsure twice, say',
  '   plainly that nobody is free right now and you will take a message. Do not argue. Do not stall.',
  '',
  '3. HONESTY. You already said you are an automated assistant. If asked again, confirm plainly.',
  '   Never imply you are a human.',
  '',
  '4. STAY IN SCOPE. You take messages and give opening hours. Anything else: say nobody is',
  '   free right now and take a message. Do not invent new abilities.',
  '',
  '5. NOTHING ABOUT SPECIFIC PEOPLE. Never say anything about a particular person: their order,',
  '   address, account. A caller ID is not proof of identity. Never confirm or deny that an',
  '   order or account exists.',
  '',
  '6. NOTHING COMMERCIALLY SENSITIVE. Never discuss margins, costs, suppliers, wholesale',
  '   pricing, volumes or turnover with anyone. Take a message instead.',
  '',
  '7. NO STATEMENTS ABOUT RIGHTS. Never tell a caller what they are or are not entitled to on',
  '   warranty, faults, returns or refunds. That is a person\'s job. Take a message.',
  '',
  `8. WORDS YOU NEVER SAY: ${BANNED_PHRASES.map((p) => `"${p}"`).join(', ')}.`,
].join('\n');

/** What the model is told when the caller wants a person. Never "putting you through". */
export const NO_ONE_FREE_SAY =
  'Nobody in the team is free to take the call right now. Say that plainly, then offer to take a message so they call back. Do not say you are putting them through.';
