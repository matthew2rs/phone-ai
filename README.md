# phone-ai

> **v1. This is an early version and we are building it as we go. Only two abilities are switched on. Read [ROADMAP.md](ROADMAP.md) for what is planned and [HANDOFF_NOTES.md](HANDOFF_NOTES.md) for what is untested.**

phone-ai is a small Node/TypeScript server that answers phone calls nobody picked up. It runs on top of [Vapi](GLOSSARY.md#vapi), a voice AI platform. The code was ported from a working production phone agent that ran in a live trial.

## What it does

When a call comes in and nobody is free, the AI:

1. Says it is an automated assistant and that calls are recorded.
2. Listens to what the caller needs.
3. Takes a message: the caller's name and what it is about. If the caller offers a different call-back number or an email address, it takes that too.
4. Reads the message back and waits for a clear yes.
5. Saves the message, then says someone from the team will be in touch as soon as they can, and says goodbye.

If the caller asks about opening hours, it reads them from a file you control.

Saved messages go to a local SQLite file. They can also be emailed to you and/or posted to a webhook on your own system.

## Who it is for

A small business or a sole operator who misses calls and wants every missed caller to leave a usable message, without building a phone system. You do not need a CRM. You need to be able to use a terminal and install Node.

## What it does NOT do

Be clear about this before you switch it on.

- It does **not** answer questions about products, orders or prices. It knows nothing about them. It takes a message instead.
- It does **not** transfer calls. There is no way to put a caller through to a person. If a caller asks for a person, it says nobody is free right now and offers to take a message.
- It will **not** promise a call-back time. It says "I can't give you a time, but the team has your message."
- It does **not** look up or confirm orders, accounts or people.
- It does **not** discuss discounts, refunds, warranty, margins or suppliers. Those topics are flagged for a person.
- It has **not** been proven on a real phone line in this bundle. See [HANDOFF_NOTES.md](HANDOFF_NOTES.md).

## Quick start

```bash
npm install
```

```bash
npm test
```

```bash
npm run robot
```

```bash
cp credentials/phone-ai.env.example .env && cp examples/hours.example.json hours.json   # once only
```

Then open [SETUP.md](SETUP.md) and follow it from Stage 2. Stages 0 and 1 cost nothing and need no accounts.

## The ladder

The AI is only allowed to go as far as the rung you set. You climb one rung at a time, and only after reading real transcripts. The default is **off**. Set the rung with `PHONEAI_PHASE`.

| Rung | What it does | Speaks to callers? | Status |
|---|---|---|---|
| `off` | Nothing. The server does not act on any call. | No | Default |
| `shadow` | Reviews transcripts you already have and shows what the guardrails would have done. Run with `npm run shadow`. | No | Built |
| `greeter` | Answers calls, says it is an AI, takes a confirmed message, says goodbye. | Yes | Built |
| `faq` | Adds a short list of checkable answers, such as order status. | Yes | **Planned, not built** |

Details are in [policy/ladder.md](policy/ladder.md).

## Safety in one paragraph

Safety lives in the core, not in the model's good manners. The AI says it is an AI and that calls are recorded in its first turn. It states no facts from memory. It never fakes a transfer. The webhook refuses any request without your secret, and the route does not exist at all if you set no secret. It ships switched off. The setup script does a dry run unless you add `--live`. Three failed calls in an hour, or hitting a daily cost cap (default $10), switches the AI off by itself. A kill switch (`npm run switch`) does the same by hand. See [policy/guardrails.md](policy/guardrails.md).

## Offline test robot

`npm run robot` plays scripted callers against the real webhook code on your machine. It tests **our safeguards**. It does **not** test how the AI model behaves on a real phone line. A green tick is not a pass. Read real transcripts.

## Documents

| File | What is in it |
|---|---|
| [SETUP.md](SETUP.md) | Slow, numbered walkthrough from zero to one live day |
| [GLOSSARY.md](GLOSSARY.md) | Plain-English meaning of every term |
| [ARCHITECTURE.md](ARCHITECTURE.md) | How a call flows through the code, and how to add an ability |
| [ROADMAP.md](ROADMAP.md) | What is planned, and what is left out on purpose |
| [HANDOFF_NOTES.md](HANDOFF_NOTES.md) | What works, what is untested, lessons learned |
| [policy/ladder.md](policy/ladder.md) | Each rung, and the evidence needed to climb |
| [policy/guardrails.md](policy/guardrails.md) | The non-negotiables and where the code enforces them |
| [policy/review-checklist.md](policy/review-checklist.md) | What to check in every transcript and every daily digest |

## Licence

MIT. See [LICENSE](LICENSE).
