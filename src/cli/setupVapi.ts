// Create or refresh the Vapi assistant from your config.
//   npm run setup-vapi                  DRY RUN: prints the assistant it would send (secrets hidden)
//   npm run setup-vapi -- --live        creates (or updates, if PHONEAI_VAPI_ASSISTANT_ID is set) the LIVE assistant
//   npm run setup-vapi -- --test --live the same for the TEST assistant (own slot: PHONEAI_VAPI_TEST_ASSISTANT_ID)
// The assistant is managed ONLY by this script. Edits made in the Vapi dashboard get overwritten
// the next time you run it with --live, so change config here instead.
import { buildAssistantConfig } from '../assistant.js';
import { loadConfig } from '../config.js';
import { createVapiClient } from '../vapiClient.js';

async function main(): Promise<void> {
  const live = process.argv.includes('--live');
  const test = process.argv.includes('--test');
  const config = loadConfig();
  const body = buildAssistantConfig(config, { test, name: test ? `phone-ai TEST: ${config.businessName}` : undefined });

  const shown = JSON.parse(JSON.stringify(body));
  if (shown.server?.secret) shown.server.secret = '<hidden>';
  console.log(JSON.stringify(shown, null, 2));

  if (!live) {
    console.log('\nDRY RUN. Nothing was sent. Add --live to create/update the assistant.');
    return;
  }
  if (!config.vapiApiKey) throw new Error('PHONEAI_VAPI_API_KEY is not set');
  if (!config.webhookSecret) throw new Error('PHONEAI_VAPI_WEBHOOK_SECRET is not set');
  if (!config.publicUrl) throw new Error('PHONEAI_PUBLIC_URL is not set (the https address Vapi can reach this server on)');
  if (!config.voiceId) throw new Error('PHONEAI_VOICE_ID is not set (pick a voice in the Vapi dashboard and paste its id)');

  const vapi = createVapiClient(config.vapiApiKey);
  // The test and live assistants have separate id slots, so a test run can never overwrite the live one.
  const slot = test ? 'PHONEAI_VAPI_TEST_ASSISTANT_ID' : 'PHONEAI_VAPI_ASSISTANT_ID';
  const existing = test ? config.testAssistantId : config.assistantId;
  const r = existing ? await vapi.updateAssistant(existing, body) : await vapi.createAssistant(body);
  console.log(`\nDone. Assistant id: ${r.id}`);
  if (!existing) console.log(`Save it: ${slot}=${r.id}`);
}

main().catch((e) => {
  console.error(`setup-vapi failed: ${(e as Error).message}`);
  process.exit(1);
});
