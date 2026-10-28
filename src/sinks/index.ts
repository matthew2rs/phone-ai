// A Sink is where a saved message is delivered, besides the local database (which always
// keeps a copy). Add your own by implementing `Sink` (see exampleCrm.ts for the shape).
import type { Config } from '../config.js';
import type { Notifier, Sink, TakenMessage } from '../types.js';
import { log } from '../log.js';
import { WebhookSink } from './webhook.js';

/** Emails the operator each message, if a notifier is set up. */
export class EmailSink implements Sink {
  name = 'email';
  constructor(private notifier: Notifier) {}
  async deliver(m: TakenMessage): Promise<void> {
    const flag = m.unsaved ? 'NO MESSAGE SAVED, CHECK THIS CALL' : 'Message';
    const lines = [
      `${flag} from ${m.callerName || 'unknown caller'}`,
      `About: ${m.topic || '(nothing recorded)'}`,
      m.askedFor ? `Asked for: ${m.askedFor}` : '',
      m.orderReference ? `Order reference: ${m.orderReference}` : '',
      m.when ? `Best time: ${m.when}` : '',
      `Rang from: ${m.fromNumber ?? 'unknown'}`,
      m.callbackNumber ? `Call back on: ${m.callbackNumber} (not the number they rang from)` : '',
      m.callbackEmail ? `Reply by email: ${m.callbackEmail}` : '',
    ].filter(Boolean);
    await this.notifier.send(`${m.unsaved ? '[CHECK] ' : ''}Phone message: ${m.callerName || 'unknown'}`, lines.join('\n'));
  }
}

export function buildSinks(config: Config, notifier: Notifier): Sink[] {
  const sinks: Sink[] = [];
  if (config.notifyEmailTo) sinks.push(new EmailSink(notifier));
  if (config.sink === 'webhook') {
    if (config.sinkWebhookUrl) sinks.push(new WebhookSink(config.sinkWebhookUrl));
    else log.warn('PHONEAI_SINK=webhook but PHONEAI_SINK_WEBHOOK_URL is not set: messages stay in the local database only');
  }
  return sinks;
}

/** Deliver to every sink. One failing sink never blocks the others, and never fails the call. */
export async function deliverAll(sinks: Sink[], m: TakenMessage): Promise<void> {
  await Promise.all(
    sinks.map(async (s) => {
      try {
        await s.deliver(m);
      } catch (e) {
        log.error({ sink: s.name, err: (e as Error).message }, 'sink delivery failed');
      }
    }),
  );
}
