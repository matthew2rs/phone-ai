// Posts each message as JSON to a URL you control (a CRM endpoint, Zapier, n8n, Make...).
import type { Sink, TakenMessage } from '../types.js';

export class WebhookSink implements Sink {
  name = 'webhook';
  constructor(private url: string, private timeoutMs = 8000) {}

  async deliver(m: TakenMessage): Promise<void> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), this.timeoutMs);
    try {
      const r = await fetch(this.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: m.unsaved ? 'call.no_message_saved' : 'message.saved', message: m }),
        signal: ctrl.signal,
      });
      if (!r.ok) throw new Error(`webhook sink got HTTP ${r.status}`);
    } finally {
      clearTimeout(timer);
    }
  }
}
