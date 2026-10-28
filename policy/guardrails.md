# Guardrails

These are the non-negotiables, in plain words, and where the code enforces each. They apply on every rung that talks to callers, from the first live call. No ability can switch them off.

Some are **forced** by code. Some can only be **checked** after the fact, because the words come from the model. For those, the check is recorded on every call so you can see it.

| # | Rule | In plain words | Where enforced | How |
|---|---|---|---|---|
| 1 | Say AI and recorded, first turn | The first words on every call say it is an automated assistant and that calls are recorded. | `src/guardrails.ts` (`disclosureGreeting`), `src/assistant.ts` (`firstMessage`) | Forced: the greeting is built in code. Checked: `src/audit.ts` looks for "automated assistant" in the transcript. A missing disclosure is stored on the call record, shown in the digest, and emailed. |
| 2 | No facts from memory | The AI states no price, stock level, date or promise. A fact may only come from a tool result. | `src/guardrails.ts` (`HARD_RULES` rule 1), `src/abilities/` | Prompt rule. Abilities return facts only from a real source (your hours file). Checked by you in transcripts. |
| 3 | Honest "nobody is free" | The AI never pretends to transfer. If someone asks for a person, it says nobody is free and offers a message. | `src/guardrails.ts` (`HARD_RULES` rule 2, `BANNED_PHRASES`, `NO_ONE_FREE_SAY`), `src/webhook.ts` | There is no transfer tool. The greeter is never told one exists (a test pins that the hard rules do not name one). The server answers any non-message tool, once a caller has asked for a person, with "nobody is free". |
| 4 | Honest about being an AI | If asked again, it confirms. It never implies it is human. | `src/guardrails.ts` (`HARD_RULES` rule 3) | Prompt rule. Checked in transcripts. |
| 5 | Stay in scope | It takes messages and gives opening hours. Nothing else. | `src/guardrails.ts` (`HARD_RULES` rule 4), `src/abilities/index.ts`, `src/webhook.ts` | Only enabled abilities are offered. A tool call to anything else is blocked and the model is told to take a message. |
| 6 | Nothing about specific people | It does not discuss anyone's order, address or account, and does not confirm or deny that one exists. A caller ID is not proof of identity. | `src/guardrails.ts` (`HARD_RULES` rule 5) | Prompt rule. There is no ability that can look anyone up. |
| 7 | Nothing commercially sensitive | No margins, costs, suppliers, wholesale pricing, volumes or turnover. | `src/guardrails.ts` (`HARD_RULES` rule 6, `SENSITIVE_TOPICS`) | Prompt rule, plus topic detection that flags the call. |
| 8 | No statements about rights | It does not say what a caller is entitled to on warranty, faults, returns or refunds. | `src/guardrails.ts` (`HARD_RULES` rule 7, `SENSITIVE_TOPICS`) | Prompt rule, plus topic detection. Edit the lists for your country. |
| 9 | Never say certain words | "transfer", "put you through", "hold on", "let me check", "get someone on the line". | `src/guardrails.ts` (`BANNED_PHRASES`, `HARD_RULES` rule 8) | Prompt rule. Checked in transcripts. |
| 10 | Save only after a confirmed read-back | Nothing is saved until the caller has heard the message read back and said yes. | `src/abilities/take_message/index.ts` | Forced: the save needs `caller_confirmed: true` and a name and a topic. Otherwise the model is told to read it back. |
| 11 | Never save a guess | A garbled phone number or email is refused, and the model is told to ask again. | `src/phone.ts`, `src/abilities/take_message/index.ts` | Forced: numbers must pass the region's rules, emails a plain check. |
| 12 | Never promise a time | The AI says it cannot give a time. | `src/phone.ts` (`NO_TIME_SAY`), `src/assistant.ts` | Prompt rule and the instruction returned with each save. |
| 13 | Never claim a save that did not happen | "Passed on" is said only after the save succeeds. If the save throws, the model is told not to claim it. | `src/audit.ts` (`passedOnBeforeSave`), `src/webhook.ts` | Checked: flagged on the call record, in the digest, and emailed. Forced: a thrown error returns an instruction not to claim it was saved. |
| 14 | The escape rule never blocks a save | When a caller wants a person or raises a sensitive topic, saving a message and reading the hours still work. | `src/webhook.ts` (`SAFE_ON_ESCAPE`) | Forced. A robot scenario tests it. |
| 15 | No message vanishes | If the AI answered a real call and nothing was saved, a flagged "unsaved" record is made and delivered. | `src/webhook.ts` (`handleEndOfCall`) | Forced, at the end of every real call. Calls shorter than 8 seconds are treated as dead legs and skipped. |
| 16 | Webhook secret fails closed | No secret means rejected. | `src/webhook.ts` (`verifySecret`), `src/server.ts` | Forced. Constant-time compare. Checked before any body is read or database touched. |
| 17 | No secret, no route | Without a secret the webhook route is not mounted at all. | `src/server.ts` | Forced. |
| 18 | Ships off | The default rung is `off`. A typo is `off`. An override can only lower the rung. | `src/config.ts`, `src/ladder.ts` | Forced. |
| 19 | Inert unless customer-facing | Tool calls do nothing unless the rung is `greeter` or `faq`. | `src/webhook.ts`, `src/abilities/index.ts` | Forced. |
| 20 | Setup is a dry run by default | `setup-vapi` and `switch` show what they would do and change nothing without `--live`. | `src/cli/setupVapi.ts`, `src/cli/switch.ts` | Forced. |
| 21 | Disabled abilities are never offered | Stubs for planned abilities cannot be called. | `src/abilities/index.ts`, `src/abilities/types.ts` | Forced. They also fail closed if reached. |
| 22 | Test calls stay out of real life | Test calls are stored but not delivered to sinks, and do not count towards the breaker or cap. | `src/abilities/take_message/index.ts`, `src/breaker.ts`, `src/digest.ts` | Forced, if the test tag reaches the server (see [HANDOFF_NOTES.md](../HANDOFF_NOTES.md), untested item 7). |
| 23 | Failures do not break calls | A failing sink, email or ability never fails the webhook or the call. | `src/sinks/index.ts`, `src/notify/email.ts`, `src/webhook.ts` | Forced. Errors are logged. |

## The automatic switches

| Switch | Trigger | What it does |
|---|---|---|
| Breaker | Three failed real calls inside one hour. A call counts as failed if it ended with a reason containing error, failed, pipeline, vapifault or exceeded, or lasted under 8 seconds. | Sets the phase override to `off`, notifies you, and (if `PHONEAI_AUTO_DETACH` is not `false` and the Vapi key and phone number id are set) detaches the Vapi number from the assistant. |
| Daily cost cap | The sum of real calls' cost for the UTC day reaches `PHONEAI_DAILY_COST_CAP_USD` (default 10). Checked after each call ends. | The same switch-off. |
| Kill switch | You run `switch off --live`. | Sets the override to `off` and detaches the number. `switch on --live` clears the override and re-attaches. It never raises the rung above `PHONEAI_PHASE`. |

Both automatic switches are untested against a live Vapi account. Test the kill switch yourself before you rely on any of them.

## Editing the lists

The person-only topic lists in `src/guardrails.ts` (`ASKED_FOR_HUMAN`, `SENSITIVE_TOPICS`) are yours to edit for your business and your country. A false alarm costs little: the caller still leaves a message, and the call is flagged. A missed topic costs more. If you add a rule, add a robot scenario for it.
