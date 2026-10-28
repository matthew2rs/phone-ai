// npm run digest              prints the review and emails it if SMTP is set up
// npm run digest -- --hours 48
import { loadConfig } from '../config.js';
import { createDeps } from '../deps.js';
import { buildDigest } from '../digest.js';

async function main(): Promise<void> {
  const i = process.argv.indexOf('--hours');
  const hours = i > -1 ? Number(process.argv[i + 1]) || 24 : 24;
  const config = loadConfig();
  const d = createDeps(config);
  const dg = buildDigest(config, d.store, d.now(), hours);
  console.log(dg.text);
  await d.notifier.send(dg.subject, dg.text);
}

main().catch((e) => {
  console.error((e as Error).message);
  process.exit(1);
});
