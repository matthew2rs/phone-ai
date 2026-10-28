// HTTP server. The webhook route is only mounted when a webhook secret is set, and the
// secret is checked BEFORE any body is parsed or any database is touched.
import express from 'express';
import { loadConfig } from './config.js';
import { createDeps } from './deps.js';
import { effectivePhase } from './ladder.js';
import { log } from './log.js';
import { handleVapiBody, verifySecret, type Deps } from './webhook.js';

export function createApp(d: Deps): express.Express {
  const app = express();

  app.get('/healthz', (_req, res) => {
    res.json({ ok: true, phase: effectivePhase(d.config, d.store) });
  });

  if (d.config.webhookSecret) {
    app.post(
      '/webhooks/vapi',
      (req, res, next) => {
        if (!verifySecret(req.headers, d.config.webhookSecret)) {
          res.status(401).json({ error: 'unauthorised' });
          return;
        }
        next();
      },
      express.json({ limit: '2mb' }),
      async (req, res) => {
        res.json(await handleVapiBody(req.body, d));
      },
    );
  } else {
    log.warn('No PHONEAI_VAPI_WEBHOOK_SECRET set: /webhooks/vapi is NOT mounted, so no call can reach this server.');
  }
  return app;
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  const config = loadConfig();
  const deps = createDeps(config);
  createApp(deps).listen(config.port, () => {
    log.info({ port: config.port, phase: effectivePhase(config, deps.store) }, 'phone-ai listening');
  });
}
