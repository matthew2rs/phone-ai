// Wires config into the objects the server and CLIs share.
import type { Config } from './config.js';
import { buildNotifier } from './notify/email.js';
import { buildSinks } from './sinks/index.js';
import { Store } from './store.js';
import { createVapiClient } from './vapiClient.js';
import type { Deps } from './webhook.js';

export function createDeps(config: Config): Deps {
  const notifier = buildNotifier(config);
  return {
    config,
    store: new Store(config.dbPath),
    sinks: buildSinks(config, notifier),
    notifier,
    vapi: config.vapiApiKey ? createVapiClient(config.vapiApiKey) : null,
    now: () => new Date(),
  };
}
