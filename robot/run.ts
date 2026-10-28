// npm run robot   plays every scenario in robot/scenarios against the real webhook code, offline.
import { loadScenarios, runScenario } from './runner.js';

let bad = 0;
for (const s of loadScenarios()) {
  const r = await runScenario(s);
  console.log(`${r.failures.length ? 'FAIL' : 'ok  '} ${r.name}`);
  for (const f of r.failures) console.log(`       ${f}`);
  if (r.failures.length) bad++;
}
console.log(bad ? `\n${bad} scenario(s) failed.` : '\nAll scenarios passed. Reminder: this tests the safeguards, not the AI on a real line. Read real transcripts too.');
process.exit(bad ? 1 : 0);
