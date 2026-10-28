# Glossary

Plain-English meanings for the words used in these docs.

## Vapi

A company that runs voice AI for phone calls. It answers the call, listens (speech to text), asks a language model what to say, and speaks the answer (text to speech). phone-ai does not do any of that itself. It tells Vapi how to behave and handles the requests Vapi sends back. You need a Vapi account. Check Vapi's own pricing and docs.

## Assistant

In Vapi, an *assistant* is the AI persona for a phone line: its first words, its instructions, the voice it uses, the tools it may call, and where to send events. `npm run setup-vapi` builds one from your settings. Only that script should change it. Edits made in the Vapi dashboard get overwritten the next time the script runs with `--live`.

## Webhook

A web address on your server that another service calls when something happens. Vapi calls `/webhooks/vapi` on your server during a call and after it. A *webhook sink* (see Sink) is the reverse: your server calls a web address you own.

## Webhook secret

A long random string you make up. Vapi sends it with every webhook request. Your server rejects any request that does not carry it. With no secret set, the webhook route does not exist.

## Tool call

When the AI decides it needs to do something real, such as save a message, it asks Vapi to run a *tool*. Vapi sends your server a `tool-calls` request naming the tool and its arguments. Your server runs it and sends the result back. In v1 there are two tools: `capture_message` and `opening_hours`. The AI may only state facts that come back from a tool.

## Ability

A plugin that provides one tool. The code lives in `src/abilities/`. v1 turns on two: taking a message and giving opening hours. Others are documented stubs that stay switched off. See [ARCHITECTURE.md](ARCHITECTURE.md).

## End-of-call report

A message Vapi sends your server when a call finishes. It holds the transcript, a summary, how long the call lasted, why it ended and what it cost. phone-ai uses it to check the call, run the safety net and update the breaker.

## Transcript

The written record of a call: what the caller said and what the AI said. Reading transcripts is how you decide whether the AI is safe to keep on.

## Rung and ladder

The *ladder* is the list of steps that say how far the AI may go: `off`, `shadow`, `greeter`, `faq`. Each *rung* allows more than the one below. You climb one rung at a time, only on evidence. See [policy/ladder.md](policy/ladder.md).

## Shadow

The `shadow` rung. The AI never speaks. Instead `npm run shadow` reads transcripts you already have (a folder of `.txt` files) and prints what the guardrails would have done. In v1 this is simple word matching, not an AI model.

## Greeter

The `greeter` rung. The AI answers, says it is an automated assistant, takes a confirmed message and says goodbye.

## Sink

A place a saved message is delivered besides the local database. v1 ships an email sink and a webhook sink. The local SQLite file always keeps a copy. One sink failing never blocks another and never fails the call. You can write your own. See `src/sinks/exampleCrm.ts`.

## Breaker

A safety switch that trips on its own. If three calls fail inside one hour, the breaker switches the AI off. A call counts as failed if it ended with an error-type reason, or lasted under 8 seconds. Test calls do not count.

## Daily cost cap

A spend limit. When the total cost of the day's real calls reaches the cap (default $10), the AI switches itself off. The day is counted in UTC. The cap is checked after each call ends.

## Kill switch

`npm run switch`. A manual way to take the AI out of the path. `off --live` sets the phase to off and detaches the Vapi number from the assistant. `on --live` undoes it.

## Detach

Unlinking your Vapi phone number from the assistant, so the number no longer reaches the AI. The breaker, the cost cap and the kill switch do this when `PHONEAI_AUTO_DETACH` is not `false` and the Vapi settings are present.

## Fallback

What a caller gets when the AI is not answering. In this project that is whatever your phone provider does when the Vapi number does not pick up, such as your own voicemail. phone-ai does not provide one. Test it before you rely on it.

## Phase override

A stored value that can only *lower* the phase. The kill switch and the breaker set it to `off`. It can never raise the phase above what `PHONEAI_PHASE` says.

## Safety net

If the AI answered a real call and no message was saved, the end-of-call step creates a record marked "unsaved" and sends it to your sinks, so the call does not vanish. Email subject lines for these start with `[CHECK]`.

## Disclosure

The AI telling the caller that it is an automated assistant and that calls are recorded. It is in the first words of every call. The end-of-call check looks for the phrase "automated assistant" in the transcript.

## Brief

A few plain sentences about your business that the AI is told is everything it knows. Never prices, stock, promises, secrets or internal links.

## E.164

The international format for phone numbers: a plus sign, the country code, then the number, with no spaces. The Australian mobile 0491 570 006 is `+61491570006` in E.164. phone-ai stores call-back numbers in this form.

## SIP

A standard way to carry phone calls over the internet. You only need to know it if you want to connect an existing phone line or provider to Vapi instead of using a number from Vapi. That is outside this guide.

## STT and TTS

Speech to text (the AI hears) and text to speech (the AI speaks). Vapi handles both. The setup uses a Deepgram model for speech to text, and the voice provider you choose for text to speech.

## Tunnel

A tool (such as ngrok or cloudflared) that gives your computer a temporary public https address, so Vapi can reach a server running on it. For testing only.

## Robot

`npm run robot`. Plays scripted callers against the real webhook code on your machine, with no network. It tests the safeguards, not the AI model on a real line.

## Dry run

Running a command that shows what it would do, without doing it. `setup-vapi` and `switch` are dry runs unless you add `--live`.
