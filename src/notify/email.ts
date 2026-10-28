// Email notifications over plain SMTP. If SMTP is not configured, notices go to the log
// instead, so the system works (and fails safe) on day one with no email set up.
import nodemailer from 'nodemailer';
import type { Config } from '../config.js';
import type { Notifier } from '../types.js';
import { log } from '../log.js';

export function buildNotifier(config: Config): Notifier {
  if (!config.smtp || !config.notifyEmailTo) {
    return {
      async send(subject, text) {
        log.info({ notice: subject, text }, 'notice (no SMTP configured, logged only)');
      },
    };
  }
  const { host, port, user, pass, from } = config.smtp;
  const transport = nodemailer.createTransport({ host, port, secure: port === 465, auth: user && pass ? { user, pass } : undefined });
  const to = config.notifyEmailTo;
  return {
    async send(subject, text) {
      try {
        await transport.sendMail({ from, to, subject, text });
      } catch (e) {
        // A failed email must never break a call or the breaker.
        log.error({ err: (e as Error).message }, 'email notice failed');
      }
    },
  };
}
