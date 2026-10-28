// WORKED EXAMPLE: what a "CRM ticket" sink looks like. Not used unless you wire it in.
// Copy this file, rename it, and replace the fetch call with your CRM's "create ticket" API.
//
// The shape to copy:
//   1. map the message to your CRM's fields (below),
//   2. flag it as "call back" so someone sees it,
//   3. set a stable external id (the call id) so a second save UPDATES instead of duplicating,
//   4. throw on failure (deliverAll catches it; the message is still safe in the local database).
import type { Sink, TakenMessage } from '../types.js';

export interface CrmSinkOptions {
  baseUrl: string;
  apiKey: string;
}

export class ExampleCrmSink implements Sink {
  name = 'example-crm';
  constructor(private opts: CrmSinkOptions) {}

  async deliver(m: TakenMessage): Promise<void> {
    const ticket = {
      externalId: m.callId,
      title: m.unsaved ? 'Phone AI answered, no message saved (check the call)' : `Call back: ${m.callerName}`,
      body: [m.topic, m.askedFor ? `Asked for: ${m.askedFor}` : '', m.orderReference ? `Order: ${m.orderReference}` : ''].filter(Boolean).join('\n'),
      phone: m.callbackNumber ?? m.fromNumber,
      email: m.callbackEmail ?? null,
      flag: 'call_back',
      priority: m.unsaved ? 'high' : 'normal',
    };
    const r = await fetch(`${this.opts.baseUrl}/tickets/upsert`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.opts.apiKey}` },
      body: JSON.stringify(ticket),
    });
    if (!r.ok) throw new Error(`CRM returned HTTP ${r.status}`);
  }
}
