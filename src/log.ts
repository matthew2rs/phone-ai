// Tiny logger. Never logs secrets or full transcripts.
type Fields = Record<string, unknown>;
const out = (level: string, fields: Fields | string, msg?: string): void => {
  const f = typeof fields === 'string' ? { msg: fields } : { ...fields, msg };
  console.log(JSON.stringify({ t: new Date().toISOString(), level, ...f }));
};
export const log = {
  info: (f: Fields | string, m?: string) => out('info', f, m),
  warn: (f: Fields | string, m?: string) => out('warn', f, m),
  error: (f: Fields | string, m?: string) => out('error', f, m),
};
