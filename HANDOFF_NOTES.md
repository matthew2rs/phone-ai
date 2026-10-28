# Handoff notes

An honest status report. Read this before you trust anything.

The code was ported from a working production phone agent that ran in a live trial. It was then rewritten as a standalone project. The rewrite has an automated test suite. It has **not** been run against a live Vapi account in this form.

## What works (tested by the automated suite)

`npm test` runs 90 tests in 11 files, and all pass on the author's machine. `npm run robot` plays 11 scripted scenarios, and all pass. `npm run smoke` loads every module except the command-line entry points (they run on import) with the network blocked.

What those tests cover:

- **Config.** Environment beats config file beats default. A typo in the phase counts as `off`. Safe defaults with an empty environment.
- **The ladder.** The stored override can only lower the phase. Nothing is offered or run unless the rung is customer-facing.
- **Secret check.** Fails closed. No secret, no header, or a wrong header is rejected. The route is not mounted without a secret.
- **Saving a message.** Nothing saves until the caller has confirmed the read-back. A second save in the same call updates the same message. Test calls are stored but never delivered.
- **Phone and email checks.** A garbled or too-short number is refused, never saved. Valid Australian numbers become E.164. Bad emails are refused.
- **Opening hours.** Open now, next opening, closed dates, split days, timezone handling, and "no hours set up" stating nothing.
- **Escape rule.** When the caller's last words ask for a person or touch a sensitive topic, every tool except saving a message and reading the hours is answered with "nobody is free". Saving still works.
- **Safety net.** A real call with no saved message creates a flagged record and delivers it.
- **Audit.** Missing disclosure is recorded. "Passed on" before the first successful save is flagged.
- **Breaker and cost cap.** Three failures in an hour trips the breaker. Spend at the cap switches off. Test calls do not count.
- **Digest.** Calls with no saved message are listed under "NEEDS A LOOK".
- **Shadow review.** Finds numbers and emails, and flags person-only topics.
- **Prompt content.** The hard rules never name a transfer tool. The greeting contains the disclosure and the recording notice. The assistant config offers exactly the two v1 tools and sets the goodbye as the platform's end-call message.
- **Sinks.** A failing sink never fails the save.

## What is UNTESTED

This is the important list. Treat every item as unproven until you have done it yourself.

1. **Every call to the Vapi API.** `createAssistant` (POST `/assistant`), `updateAssistant` (PATCH `/assistant/{id}`) and the call that points a phone number at an assistant or at nothing (PATCH `/phone-number/{id}` with `assistantId`) have **never been run against a live account in this bundle**. The tests use a fake. Request shapes follow Vapi's documentation as the author understood it. Vapi changes its API. Run `setup-vapi` as a dry run first, read what it sends, and check Vapi's current API docs.
2. **Auto-detach on the breaker or cost cap.** Never tried live. If detaching fails, the notice says so and tells you to do it in the dashboard. Do not rely on it until you have used `switch off --live` yourself and listened to what a caller hears.
3. **What a caller hears when the number is detached.** This is decided by Vapi and your phone provider.
4. **SMTP email sending.** Never sent through a real mail server from this bundle. Failed sends are logged and never break a call.
5. **The webhook sink.** Never tested against a real endpoint. It posts JSON with an 8 second timeout.
6. **Payload field names.** The code reads Vapi's documented `tool-calls` and `end-of-call-report` messages. It accepts both the `toolCallList` and the older `toolCalls` shapes. Fields such as `call.id`, `call.customer.number`, `artifact.messages`, `artifact.transcript`, `endedReason`, `cost` and `durationSeconds` are read from where Vapi documents them. Real payloads have not been inspected in this bundle. On your first test call, look at a real payload and compare.
7. **The test-call tag.** Test calls are recognised by `phoneai_test` in the assistant metadata. If Vapi does not include that metadata in the payload in the place the code looks (`call.assistantOverrides.metadata` or `assistant.metadata`), test calls will be treated as real and delivered to your sinks.
8. **The caller's number through forwarding.** The "Rang from" number is whatever Vapi reports as the customer number. Some phone providers replace the caller's number when they forward. Check on your first forwarded call.
9. **Region.** Only `AU` has been exercised. `INTL` is simple but lightly tested.
10. **`node:sqlite` prints an `ExperimentalWarning`.** It is Node's built-in database and is marked experimental. It works. The warning is expected.
11. **Shadow is deterministic.** It is word matching with no AI model. It will miss things a person would catch.
12. **The robot is offline only.** It tests our safeguards against the real webhook code. It cannot hear the AI, and it cannot tell you whether a conversation was good.
13. **Voice, model and speech settings.** The defaults (an ElevenLabs-type voice provider, a Claude model, Deepgram speech-to-text) have not been checked against Vapi's current option lists.
14. **Cost figures.** The daily cap relies on the `cost` Vapi reports at the end of each call. If that field is absent, the call counts as zero and the cap cannot trip.

## Lessons from the live trial

Each of these came from the live trial. Each is now encoded in the code or the prompt, or is a rule for how you work.

- **Save immediately after the caller's yes.** Saving is the very next step.
- **Never say "passed on" before the save succeeds.** The end-of-call audit now flags it.
- **Ask for an order number at most twice.** After that, take the message without it.
- **Keep a safety net for calls where nothing saved.** Some calls ended with no message. The end-of-call step now creates a flagged record so the call is never lost.
- **Use the platform's end-call message for goodbye.** The model hung up straight away, and the platform then said a flat "Goodbye." Setting the goodbye as the platform's own end-call message fixed it.
- **The escape rule must never block saving.** When a caller asks for a person, the "nobody is free" answer must not swallow the save. Saving a message is the safe response.
- **Never tell the greeter a transfer exists.** If the assistant is told about a transfer it cannot perform, it fakes one ("putting you through now") and the caller is stranded.
- **Do not ask the caller for the number they rang from.** The team already has it. Take a different number only if the caller offers one.
- **Read every transcript. A tick is not a pass.**
- **Test one day, gather data, improve, release again.** Small, watched steps beat a big launch.
- **Keep the phone brief short and free of internal links or IDs.**
- **Models get deprecated.** Model names change. Check Vapi's current model list and update `PHONEAI_MODEL` before your model disappears.
- **A repeated-phrase glitch** was seen on robot callers during the trial. It looks like a turn-taking issue on the platform side. Watch for it on real calls and in transcripts.

## Differences from the original

- **Rewritten standalone.** No CRM. This one needs nothing but Node and a Vapi account.
- **SQLite instead of a hosted database.** One local file.
- **A Vapi number instead of telephony routing.** Here you point a Vapi number at the assistant and forward unanswered calls to it. A Twilio routing guide is on the [roadmap](ROADMAP.md).
- **Region is configurable.** `AU` and `INTL`.
- **Names for the tools.** The two live tools are `capture_message` and `opening_hours`. Their folders are `take_message` and `store_hours`.

## Abstraction seams

These are the places built to be swapped.

- **Sink interface** (`src/types.ts`, `src/sinks/`). Implement `deliver(message)` to send messages to any system. `src/sinks/exampleCrm.ts` shows the pattern, including a stable id so a second save updates instead of duplicating.
- **Ability registry** (`src/abilities/index.ts`). Add an ability by copying `_template` and registering it. See [ARCHITECTURE.md](ARCHITECTURE.md).
- **Store** (`src/store.ts`). The only code that touches the database.

## Open decisions

For whoever runs this next.

1. **Where does it run for real?** A small always-on server with https. Not decided here.
2. **Which rung should be the target?** `greeter` is the only built rung that talks to callers. Whether it is enough depends on what your callers need. Run a shadow week first.
3. **What happens when the AI is off?** Your fallback (voicemail, another number) is outside this project. Decide it, and test it.
4. **Where do messages go?** Email only, a webhook into your own system, or the local file. Someone must own checking them.
5. **Who reads the daily digest, and when?** The rule is that it is not left on unless somebody reads it.
6. **Recording and privacy law.** The greeting says calls are recorded. Transcripts and caller numbers are stored in your database. Check what your country requires, and how long you should keep them. This is not legal advice.
7. **Which model and voice.** The defaults are a starting point. Choose after listening to real calls and checking cost.
8. **Whether to build `faq`.** Only if you can supply a trustworthy source of answers and a way to verify callers.

## Known rough edges found while writing these docs

- The `npm run` scripts load `.env` if it exists (Node's `--env-file-if-exists`). If you run a file with `node` directly, load it yourself with `--env-file=.env`.
- The phase is one setting for the whole server. Test calls are tagged, but the rung is not per assistant.
- The daily cost cap counts UTC days.
- Setting `PHONEAI_PHASE=faq` is accepted and counts as customer-facing, but no ability needs it and the assistant is built with the greeter's tools. It behaves like `greeter`. Do not use it.

## Small things worth knowing

- The server listens on all network interfaces. That is safe by default because the webhook route only exists when a secret is set and the phase is `off` until you change it, but put it behind HTTPS and do not expose other services next to it.
- Node 22.13 is the minimum in `package.json`, but the suite has only been run on Node 24.14.
- The scheduling examples run the code with `tsx`, which is a development dependency. If you install with `npm install --omit=dev`, install `tsx` as well, or compile the project first.
- The safety net that flags a call with no saved message checks the phase you configured, not the phase currently in force. A call that was already in progress when the breaker tripped can therefore still produce a flagged record. That is intended: the caller was talking to the AI.
- The test assistant and the live assistant have separate id settings (`PHONEAI_VAPI_TEST_ASSISTANT_ID` and `PHONEAI_VAPI_ASSISTANT_ID`), so a test run cannot overwrite the live assistant.
