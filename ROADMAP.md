# Roadmap

v1 is small on purpose. Two abilities are on. Everything below is **planned, not built**. Nothing here is a promise or a date.

## Planned

| Item | What it would do | What it needs first |
|---|---|---|
| `order_status` behind verification | Tell a caller where an order is. | An order system to read from, and a way to verify who is calling. A caller ID is not proof of identity. Without verification this ability must not be switched on, because it would tell a stranger about someone else's order. Sits on the `faq` rung. |
| `transfer_to_human` | Put a caller through to a real person. | A real destination that is staffed, and a tested fallback for when nobody answers. Until then the AI is never told a transfer exists, because a model told about a transfer it cannot perform will pretend to do it. |
| `book_callback` | Offer the caller a real call-back slot. | A real calendar that someone owns and keeps. A booked call-back that is missed is worse than making no promise. |
| Model-drafted shadow | The shadow rung would use a language model to draft the message it would have taken from each transcript, so you can compare. In v1 shadow is word matching only. | A safe way to run a model over transcripts that hold personal details. |
| Live robot callers via Vapi | Scripted or AI callers that ring a real test number and are graded. Today's robot is offline and cannot hear the AI. | A Vapi test line, a budget for the test calls, and a way to grade conversations that does not mistake a tick for a pass. |
| Twilio routing guide | A written guide to connecting your own number through Twilio and forwarding to Vapi. | Testing it end to end. |
| Multi-business support | One server answering for several businesses, each with its own brief, hours and rung. | A change from one global config to per-number config. |
| Per-ability cost tracking | Show what each ability costs per call, not just the call total. | Vapi cost breakdowns, and a place to record them. |

## Intentional limitations

These are choices, not gaps.

- **No facts from memory.** The AI will never answer a price, stock or delivery question. It takes a message.
- **No fake transfers.** It says plainly that nobody is free.
- **No promised times.** It says it cannot give a time.
- **No account or order information** until verification exists.
- **One phase for the whole server.** It is not per assistant or per number.
- **One business per install.**
- **Local SQLite, not a hosted database.** Simple to run and back up. Not built for many servers.
- **English only.** The speech settings are English (Australian or general).
- **Region AU is the only one exercised.** `INTL` exists but is lightly tested.
- **Sensitive topics go to a person.** Refunds, faults, discounts and commercially sensitive questions are never handled by the AI. False alarms are cheap.
- **It is not a call centre.** It answers missed calls. It does not handle queues or outbound calls.

## How a planned ability earns its way in

An ability moves from stub to on only after all four of these:

1. **A guardrail check.** Read `src/guardrails.ts` and `policy/guardrails.md`. Say in writing what could go wrong with this ability and which rule stops it. Update the hard rules and their tests if the ability changes what the AI may say.
2. **A break-it scenario.** Add a robot scenario where a caller tries to make the ability lie, skip a check, or reach something it should not. It must pass. (Passing proves the safeguard, not the conversation.)
3. **Real transcripts.** Call your test number and try to break it, as in [SETUP.md](SETUP.md) Stage 4. Read every transcript.
4. **One live day.** Run it on real closed-hours calls with a low cap. Read every call that evening. See [policy/ladder.md](policy/ladder.md).

Then test one day, gather the data, improve, and release again. Do not skip a step because an earlier one looked fine.
