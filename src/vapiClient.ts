// A thin wrapper over the Vapi REST API. Only the few calls this project needs.
// NOT exercised against a live account by the automated tests (see HANDOFF_NOTES.md):
// check each call in a dry run before trusting it, and check Vapi's current API docs.
export interface VapiClient {
  createAssistant(body: Record<string, unknown>): Promise<{ id: string }>;
  updateAssistant(id: string, body: Record<string, unknown>): Promise<{ id: string }>;
  /** Point a phone number at an assistant, or at nothing (assistantId null). */
  setNumberAssistant(phoneNumberId: string, assistantId: string | null): Promise<void>;
}

export function createVapiClient(apiKey: string, fetchImpl: typeof fetch = fetch): VapiClient {
  const call = async (method: string, path: string, body: unknown): Promise<unknown> => {
    const r = await fetchImpl(`https://api.vapi.ai${path}`, {
      method,
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const text = await r.text();
    if (!r.ok) throw new Error(`Vapi ${method} ${path} returned ${r.status}: ${text.slice(0, 300)}`);
    return text ? JSON.parse(text) : null;
  };
  return {
    createAssistant: (body) => call('POST', '/assistant', body) as Promise<{ id: string }>,
    updateAssistant: (id, body) => call('PATCH', `/assistant/${id}`, body) as Promise<{ id: string }>,
    async setNumberAssistant(phoneNumberId, assistantId) {
      await call('PATCH', `/phone-number/${phoneNumberId}`, { assistantId });
    },
  };
}
