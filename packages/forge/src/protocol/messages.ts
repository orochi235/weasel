import type { SchemaDescription } from './schema';

export const PROTOCOL_VERSION = 1;

export type Globals = Readonly<Record<string, unknown>>;
export type Layout = 'centered' | 'padded' | 'fullscreen';
export interface Viewport {
  width: number;
  height: number;
}
export type FaultPhase = 'import' | 'render' | 'play' | 'protocol';

/** One custom property as the frame found it. */
export interface CssVarReport {
  name: string;
  value: string;
  /** Whether a `vars.set` override is in force on it. */
  overridden: boolean;
}

/** Visibility and validation answers, keyed by the config they were computed for. */
export interface ConfigAnswers {
  /** `stableStringify(config)` of the config the frame evaluated. */
  configKey: string;
  hidden: string[];
  errors: Record<string, string[]>;
}

export type ToFrame =
  | { type: 'init'; config: unknown; state: unknown; globals: Globals }
  | { type: 'config'; config: unknown }
  | { type: 'state'; state: unknown }
  | { type: 'globals'; globals: Globals }
  | { type: 'vars.set'; name: string; value: string | null }
  | { type: 'play' };

export type FromFrame =
  | { type: 'ready'; schema: SchemaDescription; layout: Layout; viewport: Viewport | null }
  | { type: 'answers'; answers: ConfigAnswers }
  | { type: 'setConfig'; path: string; value: unknown }
  | { type: 'setState'; state: unknown }
  | { type: 'size'; width: number; height: number }
  | { type: 'vars'; vars: CssVarReport[] }
  | { type: 'played'; ok: boolean; message?: string }
  /** `seq`, on a render fault only: how many `init`/`config`/`state`/`globals` messages the frame had received. */
  | { type: 'fault'; phase: FaultPhase; message: string; stack?: string; seq?: number };

export interface Envelope<M> {
  v: number;
  msg: M;
}

/** Posted on the frame's window with the port transferred alongside it. */
export const PORT_HANDOFF = 'weaselforge:port';

/** JSON with object keys sorted, so two equal configs produce one key. */
export function stableStringify(value: unknown): string {
  return JSON.stringify(value, (_key, v) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => (a < b ? -1 : 1)))
      : v,
  );
}
