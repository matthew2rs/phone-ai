// Local state: messages, call records, and a small key/value table (phase override, breaker, spend).
// Uses node:sqlite, built into Node 22.13+, so there is nothing native to compile.
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { CallRecord, TakenMessage } from './types.js';

export class Store {
  private db: DatabaseSync;

  /** Pass ':memory:' for tests. */
  constructor(path: string) {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS messages (call_id TEXT PRIMARY KEY, json TEXT NOT NULL, updated_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS calls (call_id TEXT PRIMARY KEY, json TEXT NOT NULL, ended_at TEXT NOT NULL, cost_usd REAL);
      CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    `);
  }

  getMessage(callId: string): TakenMessage | null {
    const row = this.db.prepare('SELECT json FROM messages WHERE call_id = ?').get(callId) as { json: string } | undefined;
    return row ? (JSON.parse(row.json) as TakenMessage) : null;
  }

  upsertMessage(m: TakenMessage): void {
    this.db
      .prepare('INSERT INTO messages (call_id, json, updated_at) VALUES (?, ?, ?) ON CONFLICT(call_id) DO UPDATE SET json = excluded.json, updated_at = excluded.updated_at')
      .run(m.callId, JSON.stringify(m), m.updatedAt);
  }

  messagesSince(iso: string): TakenMessage[] {
    const rows = this.db.prepare('SELECT json FROM messages WHERE updated_at >= ? ORDER BY updated_at').all(iso) as Array<{ json: string }>;
    return rows.map((r) => JSON.parse(r.json) as TakenMessage);
  }

  recordCall(c: CallRecord): void {
    this.db
      .prepare('INSERT INTO calls (call_id, json, ended_at, cost_usd) VALUES (?, ?, ?, ?) ON CONFLICT(call_id) DO UPDATE SET json = excluded.json, ended_at = excluded.ended_at, cost_usd = excluded.cost_usd')
      .run(c.callId, JSON.stringify(c), c.endedAt, c.costUsd);
  }

  callsSince(iso: string): CallRecord[] {
    const rows = this.db.prepare('SELECT json FROM calls WHERE ended_at >= ? ORDER BY ended_at').all(iso) as Array<{ json: string }>;
    return rows.map((r) => JSON.parse(r.json) as CallRecord);
  }

  /** Real (non-test) spend since the start of the given ISO day prefix, e.g. '2026-01-15'. Uses UTC date of ended_at. */
  spendOnDay(dayPrefix: string): number {
    const row = this.db.prepare("SELECT COALESCE(SUM(cost_usd), 0) AS s FROM calls WHERE ended_at LIKE ? AND json_extract(json, '$.test') = 0").get(`${dayPrefix}%`) as { s: number };
    return row.s;
  }

  getKv(key: string): string | null {
    const row = this.db.prepare('SELECT value FROM kv WHERE key = ?').get(key) as { value: string } | undefined;
    return row ? row.value : null;
  }

  setKv(key: string, value: string): void {
    this.db.prepare('INSERT INTO kv (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, value);
  }

  deleteKv(key: string): void {
    this.db.prepare('DELETE FROM kv WHERE key = ?').run(key);
  }

  close(): void {
    this.db.close();
  }
}
