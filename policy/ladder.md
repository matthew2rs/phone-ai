# The ladder

The ladder says how far the AI is allowed to go. There are four rungs. You set the rung with `PHONEAI_PHASE`. Each rung allows more than the one below. You climb one rung at a time, and only on evidence.

The code deliberately has **no numeric thresholds** for climbing (no "after 50 calls"). A number in code invites people to satisfy the number instead of the intent. The evidence below is judged by a person who has read the calls.

An unknown value, or a typo, counts as `off`. A stored override from the kill switch or the breaker can only lower the rung, never raise it.

## Rung 1: off (the default)

**May do:** nothing. The server does not act on any call. Tool calls get an empty reply.

**Evidence to climb to shadow:** none needed. Shadow cannot speak to anyone.

## Rung 2: shadow

**May do:** review transcripts you already have (voicemail text, call notes) and print what the guardrails would have done. It never speaks. It needs no Vapi account. Run `npm run shadow -- <folder>`.

In v1 this is word matching, not an AI model. It does not take any action, and the webhook stays inert on this rung.

**Evidence to climb to greeter:**

- You have read a real sample of your own callers' messages, not only the examples. A week of them is a good start.
- You know roughly what share of your calls touch person-only topics (refunds, faults, discounts, managers, suppliers). If most do, think again about whether a message-taking AI is what you need.
- You have done the test-number round in [SETUP.md](../SETUP.md) Stage 4: the happy path and every break-it call, with every transcript read. Each of those calls:
  - disclosed that it is an automated assistant and that calls are recorded,
  - stated no fact it could not know,
  - did not fake a transfer,
  - saved the message only after the caller said yes,
  - did not say "passed on" before the save.
- You have tested the kill switch and heard what a caller hears when the AI is off.
- You know who will read the daily digest and when.

## Rung 3: greeter

**May do:** answer calls nobody picked up. Say it is an AI and that calls are recorded. Take a confirmed message. Read opening hours. Say goodbye. It resolves nothing and promises nothing.

**Stays off limits:** prices, stock, orders, accounts, rights, discounts, transfers, call-back times.

**Evidence to keep it on, day after day:** at the end of every live day, you have read every call and found:

- the disclosure was present on every call,
- no message went unsaved, or any unsaved call was caught by the safety net and followed up,
- no caller was told something false,
- no caller was promised a time or a transfer,
- nothing went to the wrong place,
- the cost stayed well under the cap.

**Evidence to climb to faq:** see below. `faq` is planned, not built.

## Rung 4: faq (planned, not built)

**Would do:** add a short list of checkable answers, such as order status. Each answer must come from a tool result, never from the model's memory.

**Evidence needed before any ability is added here:** the four steps in [ROADMAP.md](../ROADMAP.md), "How a planned ability earns its way in": a guardrail check, a break-it scenario, real transcripts read, and one live day. For order status in particular, a way to verify the caller exists first.

Today, setting `PHONEAI_PHASE=faq` gives the same behaviour as `greeter`, because no ability needs it. Do not use it.

## Demote triggers

Drop a rung (set `PHONEAI_PHASE` lower, or run `switch off --live`) the same day if any of these happens:

| Trigger | Why |
|---|---|
| A call has no AI disclosure. | The first non-negotiable failed. Do not take another call until the greeting is fixed. |
| The AI told a caller a fact it could not know (a price, stock, a date, a right). | It broke the no-facts rule. |
| The AI said or implied a transfer. | Callers get stranded. |
| The AI said "passed on" before saving. | The caller was told something false. |
| A message was lost and the safety net did not catch it. | Callers would be silently ignored. |
| The AI spoke to a caller about another person's order or account. | Privacy. |
| The breaker or cost cap tripped for a reason you do not understand. | Something is wrong that you have not found. |
| You cannot read the day's calls. | The rule is that it is not left on unreviewed. |
| The model, voice or Vapi settings changed. | Treat it as a new system. Test again from Stage 4. |

Automatic demotion already exists: three failed calls in an hour, or hitting the daily cost cap, set the phase to `off` and (if configured) detach the Vapi number. See [guardrails.md](guardrails.md).

After any demotion: find the cause, fix it, write down what changed, and climb back with fresh evidence.
