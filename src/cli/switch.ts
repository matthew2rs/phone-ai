// The kill switch.
//   npm run switch -- status
//   npm run switch -- off  [--live]   AI out of the path: sets the override and detaches the Vapi number
//   npm run switch -- on   [--live]   clears the override and re-attaches the assistant to the number
// Without --live it only says what it would do. "on" never raises the phase above what your
// config says (PHONEAI_PHASE); it only removes the override.
import { loadConfig } from '../config.js';
import { createDeps } from '../deps.js';
import { effectivePhase } from '../ladder.js';

async function main(): Promise<void> {
  const [cmd = 'status'] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  const live = process.argv.includes('--live');
  const config = loadConfig();
  const d = createDeps(config);

  if (cmd === 'status') {
    console.log(`configured phase: ${config.phase}`);
    console.log(`phase in force:   ${effectivePhase(config, d.store)}`);
    console.log(`override:         ${d.store.getKv('phase_override') ?? '(none)'} ${d.store.getKv('phase_override_reason') ?? ''}`);
    return;
  }
  if (cmd !== 'off' && cmd !== 'on') throw new Error('usage: switch status | off | on  [--live]');

  const attach = cmd === 'on' ? config.assistantId : null;
  console.log(`${live ? 'DOING' : 'DRY RUN, would do'}: ${cmd === 'off' ? 'set override off' : 'clear override'}; Vapi number ${config.vapiPhoneNumberId ?? '(not set)'} -> assistant ${attach ?? 'nothing'}`);
  if (!live) return;

  if (cmd === 'off') d.store.setKv('phase_override', 'off');
  else d.store.deleteKv('phase_override');
  if (d.vapi && config.vapiPhoneNumberId && (cmd === 'off' || config.assistantId)) {
    await d.vapi.setNumberAssistant(config.vapiPhoneNumberId, attach);
    console.log('Vapi number updated.');
  } else {
    console.log('Vapi number NOT changed (no API key, no phone number id, or no assistant id). Change it in the Vapi dashboard.');
  }
}

main().catch((e) => {
  console.error((e as Error).message);
  process.exit(1);
});
