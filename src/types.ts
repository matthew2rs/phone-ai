// Shared types. Kept free of imports from the rest of the app so every module can use them.

/** How far the AI is allowed to go. See policy/ladder.md. Default is always 'off'. */
export type Phase = 'off' | 'shadow' | 'greeter' | 'faq';
export const PHASES: readonly Phase[] = ['off', 'shadow', 'greeter', 'faq'];
export const phaseRank = (p: Phase): number => PHASES.indexOf(p);

/** Rungs where a real caller can hear the AI. */
export const CUSTOMER_FACING: readonly Phase[] = ['greeter', 'faq'];

export type Region = 'AU' | 'INTL';

/** A tool the assistant can call, in Vapi's function-tool shape. */
export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, { type: string; description: string; enum?: string[] }>;
      required: string[];
    };
  };
}

/** What a tool handler returns. `say` is an instruction to the model, never read out verbatim. */
export interface ToolResult {
  status: 'ok' | 'blocked' | 'error';
  result?: Record<string, unknown>;
  reason?: string;
}

/** A message the AI took for the team. One per call (a second save updates it). */
export interface TakenMessage {
  callId: string;
  callerName: string;
  topic: string;
  about?: 'product' | 'order' | 'other';
  orderReference?: string;
  when?: string;
  askedFor?: string;
  /** The number they rang from. */
  fromNumber: string | null;
  /** E.164, only if the caller offered a different one. */
  callbackNumber?: string;
  callbackEmail?: string;
  /** True for a record made by the safety net: the call ended and no message was saved. */
  unsaved?: boolean;
  test?: boolean;
  createdAt: string;
  updatedAt: string;
}

/** The facts kept about every call, for the daily review. */
export interface CallRecord {
  callId: string;
  from: string | null;
  to: string | null;
  phase: Phase;
  test: boolean;
  startedAt: string | null;
  endedAt: string;
  durationSeconds: number | null;
  endedReason: string | null;
  costUsd: number | null;
  summary: string | null;
  transcript: string | null;
  /** Did the transcript contain the AI disclosure? */
  disclosed: boolean;
  /** Did the caller ask for a person, or raise a topic that goes to a person? */
  escapeRequested: boolean;
  messageSaved: boolean;
  /** The sentence where it said "passed that on" before anything was saved, if it did. */
  passedOnTooEarly: string | null;
}

/** Where a saved message is delivered to, besides the local database. */
export interface Sink {
  name: string;
  deliver(message: TakenMessage): Promise<void>;
}

export interface Notifier {
  send(subject: string, text: string): Promise<void>;
}
