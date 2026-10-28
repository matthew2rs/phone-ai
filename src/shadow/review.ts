// SHADOW rung: reviews transcripts you ALREADY have (voicemail transcripts, past call notes) and
// shows what the guardrails would have done. Never speaks to anyone and needs no Vapi account.
//   npm run shadow -- ./my-transcripts      (a folder of .txt files, one call per file)
// v1 is deterministic (no AI model involved). Drafting a full message from the transcript
// with a model is planned (ROADMAP.md).
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { callerAskedForHuman, shouldEscalate } from '../guardrails.js';
import { normaliseEmail, normaliseNumber } from '../phone.js';
import type { Region } from '../types.js';

export interface ShadowReview {
  wouldTakeMessage: boolean;
  needsPerson: boolean;
  askedForPerson: boolean;
  numbersFound: string[];
  emailsFound: string[];
  firstLine: string;
}

export function reviewTranscript(text: string, region: Region = 'AU'): ShadowReview {
  const numbers = (text.match(/\+?\d[\d\s().-]{7,}\d/g) ?? []).map((n) => normaliseNumber(n, region)).filter((n): n is string => !!n);
  const emails = (text.match(/[A-Za-z0-9._%+'-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g) ?? []).map((e) => normaliseEmail(e)).filter((e): e is string => !!e);
  const needsPerson = shouldEscalate(text);
  return {
    // In v1 the greeter takes a message for everything. "needsPerson" marks the calls you
    // should expect to be upset or sensitive, so a human looks at them first.
    wouldTakeMessage: true,
    needsPerson,
    askedForPerson: callerAskedForHuman(text),
    numbersFound: [...new Set(numbers)],
    emailsFound: [...new Set(emails)],
    firstLine: text.trim().split(/\r?\n/)[0]?.slice(0, 160) ?? '',
  };
}

function main(): void {
  const dir = process.argv[2];
  if (!dir) {
    console.error('usage: npm run shadow -- <folder of .txt transcripts>');
    process.exit(1);
  }
  if (!existsSync(dir)) {
    console.error(`Folder not found: ${dir}`);
    process.exit(1);
  }
  const files = readdirSync(dir).filter((f) => f.endsWith('.txt'));
  let person = 0;
  for (const f of files) {
    const r = reviewTranscript(readFileSync(join(dir, f), 'utf8'));
    if (r.needsPerson) person++;
    console.log(`${f}: ${r.needsPerson ? 'NEEDS A PERSON FIRST' : 'message is fine'}${r.askedForPerson ? ' (asked for a person)' : ''} | numbers: ${r.numbersFound.length} emails: ${r.emailsFound.length} | "${r.firstLine}"`);
  }
  console.log(`\n${files.length} transcripts. ${person} would have been flagged for a person. Read them yourself before climbing a rung.`);
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) main();
